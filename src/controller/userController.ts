import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../model/index.js';
import { sendOTPEmail, sendUserCredentialsEmail, sendPasswordResetOTPEmail } from '../utils/emailService.js';
import { Prisma } from '../../generated/prisma/client.js';


const JWT_SECRET = process.env.JWT_SECRET || 'samaysafar_secret_key';
const OTP_EXPIRY_MINUTES = 10;

// Helper function to generate OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Helper function to hash password
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

// Helper function to compare password
const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// Helper function to generate JWT token
const generateToken = (userId: number, role: string, orgId?: number): string => {
  const payload: any = { userId, role };
  if (orgId) payload.orgId = orgId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

/**
 * Organization Registration
 * Organization registers with name, email, phone, password, address and logo
 * Gets OTP code via email
 */
export const registerOrganization = async (req: Request, res: Response) => {
  const { name, email, phone, password, address } = req.body;
  const logoFile = (req as any).file as any;

  // Validate required fields
  if (!name || !email || !phone || !password || !address) {
    return res.status(400).json({ 
      message: 'Missing required fields: name, email, phone, password, address' 
    });
  }

  // Validate password strength (optional - add your requirements)
  if (password.length < 6) {
    return res.status(400).json({ 
      message: 'Password must be at least 6 characters long' 
    });
  }

  try {
    // Check if organization already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { Email: email },
    });

    if (existingOrg) {
      return res.status(400).json({ message: 'Organization with this email already exists' });
    }

    // Check if there's a pending registration for this email
    const pendingAdmin = await prisma.pendingAdmin.findUnique({
      where: { Email: email },
    });

    if (pendingAdmin && !pendingAdmin.Verified) {
      // Check if OTP is still valid
      if (new Date() < pendingAdmin.OTPExpiresAt) {
        return res.status(400).json({ 
          message: 'Registration already in progress. Please check your email for OTP or use resend OTP.' 
        });
      }
      // OTP expired, delete old record
      await prisma.pendingAdmin.delete({
        where: { PendingId: pendingAdmin.PendingId },
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    // Create pending admin record (for organization registration)
    await prisma.pendingAdmin.create({
      data: {
        Name: name,
        Email: email,
        Phone: phone,
        PasswordHash: passwordHash,
        Address: address,
        Logo: logoFile ? logoFile.buffer : null,
        OTP: otpCode,
        OTPExpiresAt: expiresAt,
        Verified: false,
      },
    });

    // Send OTP via email
    try {
      await sendOTPEmail(email, otpCode, name);
    } catch (emailError: any) {
      console.error('Error sending OTP email:', emailError);
      // Delete the pending admin record if email fails
      await prisma.pendingAdmin.deleteMany({
        where: { Email: email },
      });
      return res.status(500).json({ 
        message: 'Failed to send OTP email. Please try again.' });
    }

    return res.status(201).json({
      message: 'Registration initiated. Please check your email for the OTP verification code to complete registration.',
      email: email,
    });
  } catch (error: any) {
    console.error('Error registering organization:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Email already in use' });
    }
    return res.status(500).json({ 
      message: 'Error registering organization', 
      error: error.message 
    });
  }
};

/**
 * Resend OTP for Organization Registration
 */
export const resendOrganizationOTP = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Check if organization already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { Email: email },
    });

    if (existingOrg) {
      return res.status(400).json({ 
        message: 'Organization already registered. Please login instead.' 
      });
    }

    // Find pending registration
    const pendingAdmin = await prisma.pendingAdmin.findUnique({
      where: { Email: email },
    });

    if (!pendingAdmin) {
      return res.status(404).json({ 
        message: 'No pending registration found. Please register first.' 
      });
    }

    if (pendingAdmin.Verified) {
      return res.status(400).json({ 
        message: 'Organization already verified. Please login instead.' 
      });
    }

    // Generate new OTP
    const otpCode = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    // Update pending admin with new OTP
    await prisma.pendingAdmin.update({
      where: { PendingId: pendingAdmin.PendingId },
      data: {
        OTP: otpCode,
        OTPExpiresAt: expiresAt,
      },
    });

    try {
      await sendOTPEmail(email, otpCode, pendingAdmin.Name);
      return res.status(200).json({
        message: 'OTP has been resent to your email address.',
      });
    } catch (emailError: any) {
      console.error('Error sending OTP email:', emailError);
      return res.status(500).json({
        message: 'Failed to send OTP email. Please try again later.',
      });
    }
  } catch (error: any) {
    console.error('Error resending OTP:', error);
    return res.status(500).json({ message: 'Error resending OTP', error: error.message });
  }
};

/**
 * Verify OTP for Organization Registration
 * After verification, organization is created in the database
 */
export const verifyOrganizationOTP = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and OTP code are required' });
  }

  try {
    // Find pending admin record
    const pendingAdmin = await prisma.pendingAdmin.findUnique({
      where: { Email: email },
    });

    if (!pendingAdmin) {
      return res.status(400).json({ message: 'No pending registration found' });
    }

    if (pendingAdmin.Verified) {
      return res.status(400).json({ message: 'Organization already verified. Please login instead.' });
    }

    // Check if OTP matches and is not expired
    if (pendingAdmin.OTP !== code) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    if (new Date() > pendingAdmin.OTPExpiresAt) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Check if organization already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { Email: email },
    });

    if (existingOrg) {
      // Mark as verified and delete pending record
      await prisma.pendingAdmin.update({
        where: { PendingId: pendingAdmin.PendingId },
        data: { Verified: true },
      });
      return res.status(400).json({ message: 'Organization already exists' });
    }

    // Check if an admin user already exists for this email
    const existingUser = await prisma.users.findUnique({
      where: { Email: pendingAdmin.Email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Admin user with this email already exists' });
    }

    // Create organization and admin user in a single transaction
    const { organization } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create organization in database
      const organization = await tx.organization.create({
        data: {
          Name: pendingAdmin.Name,
          Email: pendingAdmin.Email,
          Phone: pendingAdmin.Phone,
          Address: pendingAdmin.Address || '',
          Logo: pendingAdmin.Logo ?? null,
        },
      });

      // Create the admin user for this organization
      const adminUser = await tx.users.create({
        data: {
          OrgId: organization.OrgId,
          Role: 'admin',
          Name: pendingAdmin.Name,
          Email: pendingAdmin.Email,
          Phone: pendingAdmin.Phone,
        },
      });

      // Store credentials for the new admin using the original hashed password
      await tx.credentials.create({
        data: {
          UserId: adminUser.UserId,
          PasswordHash: pendingAdmin.PasswordHash,
          MustChangePassword: false,
          EmailSentAt: new Date(),
        },
      });

      // Mark pending admin as verified
      await tx.pendingAdmin.update({
        where: { PendingId: pendingAdmin.PendingId },
        data: { Verified: true },
      });

      return { organization };
    });

    // Generate JWT token
    const token = generateToken(organization.OrgId, 'organization', organization.OrgId);

    return res.status(200).json({
      message: 'OTP verified successfully. Organization account created.',
      token,
      organization: {
        orgId: organization.OrgId,
        name: organization.Name,
        email: organization.Email,
        phone: organization.Phone,
        address: organization.Address,
      },
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Organization with this email already exists' });
    }
    return res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

