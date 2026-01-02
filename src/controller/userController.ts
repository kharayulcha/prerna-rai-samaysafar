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
/**
 * Create User (Parent, Student, or Driver) by Organization
 * Only organizations can create users
 */
export const createUser = async (req: Request, res: Response) => {
  const { name, email, phone, password, role, profileImage } = req.body;
  const orgId = (req as any).orgId || req.body.orgId; // Assuming middleware sets orgId

  // Validate required fields
  if (!name || !email || !phone || !password || !role) {
    return res.status(400).json({ 
      message: 'Missing required fields: name, email, phone, password, role' 
    });
}

  // Validate role
const validRoles = ['parent', 'student', 'driver'];
const userRole = role.toLowerCase();
if (!validRoles.includes(userRole)) {
    return res.status(400).json({ 
    message: 'Invalid role. Must be one of: parent, student, driver' 
    });
}

  // Validate password strength
if (password.length < 6) {
    return res.status(400).json({ 
    message: 'Password must be at least 6 characters long' 
    });
}

  // If orgId is not in request body, it should come from authenticated organization
if (!orgId) {
    return res.status(400).json({ 
    message: 'Organization ID is required. Please ensure you are authenticated as an organization.' 
    });
}

try {
    // Verify organization exists
    const organization = await prisma.organization.findUnique({
    where: { OrgId: orgId },
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { Email: email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user and credentials in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create user
      const user = await tx.users.create({
        data: {
          OrgId: orgId,
          Role: userRole,
          Name: name,
          Email: email,
          Phone: phone,
          ProfileImage: profileImage || null,
        },
      });

      // Create credentials
      await tx.credentials.create({
        data: {
          UserId: user.UserId,
          PasswordHash: passwordHash,
          MustChangePassword: false, // Organization sets password, so no need to change
          EmailSentAt: new Date(),
        },
      });

      // Create audit record
      // Note: AdminUserId must reference a Users record, not Organization
      // Try to find an admin user for this organization, or skip audit if none exists
      const adminUser = await tx.users.findFirst({
        where: {
          OrgId: orgId,
          Role: 'admin', // Assuming there might be admin users
        },
      });

      if (adminUser) {
        await tx.userCreationAudit.create({
          data: {
            CreatedUserId: user.UserId,
            AdminUserId: adminUser.UserId,
            EmailSentAt: new Date(),
            DeliveryStatus: 'sent',
          },
        });
      } else {
        // If no admin user exists, we skip audit creation
        // You may want to create an admin user for the organization or update the schema
        console.warn('No admin user found for organization ${orgId}. Skipping audit creation.');
      }

      return user;
    });

    // Send welcome email with permanent credentials (optional)
    try {
      await sendUserCredentialsEmail(
        email,
        password,
        name,
        organization.Name,
        userRole
      );
    } catch (emailError) {
      console.error('Error sending welcome email with credentials:', emailError);
      // Don't fail the request if email fails
    }

    return res.status(201).json({
      message: '${userRole} created successfully',
      user: {
        userId: result.UserId,
        name: result.Name,
        email: result.Email,
        phone: result.Phone,
        role: result.Role,
        orgId: result.OrgId,
      },
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Email already in use' });
    }
    return res.status(500).json({ 
      message: 'Error creating user', 
      error: error.message 
    });
  }
};

/**
 * Login for all user types (Organization, Parent, Student, Driver)
 */
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // 1. Try to login as a regular user (parent, student, driver, admin)
    const user = await prisma.users.findUnique({
      where: { Email: email },
      include: {
        credentials: true,
        organization: true,
      },
    });

    if (user && user.credentials) {
      const isPasswordValid = await comparePassword(password, user.credentials.PasswordHash);
      if (isPasswordValid) {
        // Successful user login
        const token = generateToken(user.UserId, user.Role, user.OrgId || undefined);

        return res.status(200).json({
          message: 'Login successful',
          token,
          user: {
            userId: user.UserId,
            name: user.Name,
            email: user.Email,
            phone: user.Phone,
            role: user.Role,
            orgId: user.OrgId,
            profileImage: user.ProfileImage,
            organization: user.organization
              ? {
                  orgId: user.organization.OrgId,
                  name: user.organization.Name,
                }
              : null,
          },
        });
      }
    }

    // 2. If not a regular user, try to login as an organization
    const organization = await prisma.organization.findUnique({
      where: { Email: email },
    });

    if (!organization) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Organization password is stored in PendingAdmin
    const pendingAdmin = await prisma.pendingAdmin.findFirst({
      where: {
        Email: email,
        Verified: true,
      },
      orderBy: {
        RequestedAt: 'desc',
      },
    });

    if (!pendingAdmin) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isOrgPasswordValid = await comparePassword(password, pendingAdmin.PasswordHash);
    if (!isOrgPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token for organization
    const token = generateToken(organization.OrgId, 'organization', organization.OrgId);

    return res.status(200).json({
      message: 'Login successful',
      token,
      organization: {
        orgId: organization.OrgId,
        name: organization.Name,
        email: organization.Email,
        phone: organization.Phone,
        address: organization.Address,
        role: 'organization',
      },
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    return res.status(500).json({ message: 'Error during login', error: error.message });
  }
};



/**
 * Forgot Password - Request OTP
 * User provides email, receives OTP code via email
 */
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Check if user exists (either in Users table or Organization table)
    const user = await prisma.users.findUnique({
      where: { Email: email },
      include: { credentials: true },
    });

    const organization = await prisma.organization.findUnique({
      where: { Email: email },
    });

    if (!user && !organization) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({
        message: 'If an account with this email exists, a password reset OTP has been sent.',
      });
    }

    // Determine user name and type
    const userName = user ? user.Name : organization?.Name || 'User';
    const userId = user ? user.UserId : null;

    // Check if there's an existing unused password reset request
    const existingReset = await prisma.passwordReset.findFirst({
      where: {
        Email: email,
        Used: false,
        OTPExpiresAt: { gt: new Date() },
      },
      orderBy: {
        RequestedAt: 'desc',
      },
    });

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    if (existingReset) {
      // Update existing reset request with new OTP
      await prisma.passwordReset.update({
        where: { ResetId: existingReset.ResetId },
        data: {
          OTP: otpCode,
          OTPExpiresAt: expiresAt,
          RequestedAt: new Date(),
        },
      });
    } else {
      // Create new password reset request
      await prisma.passwordReset.create({
        data: {
          Email: email,
          OTP: otpCode,
          OTPExpiresAt: expiresAt,
        },
      });
    }

    // Send OTP via email
    try {
      await sendPasswordResetOTPEmail(email, otpCode, userName);
      return res.status(200).json({
        message: 'If an account with this email exists, a password reset OTP has been sent to your email address.',
      });
    } catch (emailError: any) {
      console.error('Error sending password reset OTP email:', emailError);
      // Delete the password reset record if email fails
      await prisma.passwordReset.deleteMany({
        where: { Email: email, Used: false },
      });
      return res.status(500).json({
        message: 'Failed to send password reset OTP email. Please try again.',
      });
    }
  } catch (error: any) {
    console.error('Error in forgot password:', error);
    return res.status(500).json({
      message: 'Error processing password reset request',
      error: error.message,
    });
  }
};

/**
 * Reset Password - Verify OTP and Update Password
 * User provides email, OTP code, and new password
 */
export const resetPassword = async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({
      message: 'Email, OTP code, and new password are required',
    });
  }

  // Validate password strength
  if (newPassword.length < 6) {
    return res.status(400).json({
      message: 'Password must be at least 6 characters long',
    });
  }

  try {
    // Find password reset request
    const passwordReset = await prisma.passwordReset.findFirst({
      where: {
        Email: email,
        Used: false,
      },
      orderBy: {
        RequestedAt: 'desc',
      },
    });

    if (!passwordReset) {
      return res.status(400).json({
        message: 'No password reset request found. Please request a new OTP.',
      });
    }

    // Check if OTP matches
    if (passwordReset.OTP !== code) {
      return res.status(400).json({
        message: 'Invalid OTP code',
      });
    }

    // Check if OTP is expired
    if (new Date() > passwordReset.OTPExpiresAt) {
      return res.status(400).json({
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password in transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Check if user exists in Users table
      const user = await tx.users.findUnique({
        where: { Email: email },
        include: { credentials: true },
      });

      if (user) {
        // Update user credentials
        if (user.credentials) {
          await tx.credentials.update({
            where: { UserId: user.UserId },
            data: {
              PasswordHash: passwordHash,
              PasswordGeneratedAt: new Date(),
              MustChangePassword: false,
            },
          });
        } else {
          // Create credentials if they don't exist
          await tx.credentials.create({
            data: {
              UserId: user.UserId,
              PasswordHash: passwordHash,
              MustChangePassword: false,
            },
          });
        }
      } else {
        // Check if it's an organization
        const organization = await tx.organization.findUnique({
          where: { Email: email },
        });

        if (organization) {
          // For organizations, update the PendingAdmin record
          const pendingAdmin = await tx.pendingAdmin.findFirst({
            where: {
              Email: email,
              Verified: true,
            },
            orderBy: {
              RequestedAt: 'desc',
            },
          });

          if (pendingAdmin) {
            await tx.pendingAdmin.update({
              where: { PendingId: pendingAdmin.PendingId },
              data: {
                PasswordHash: passwordHash,
              },
            });
          } else {
            // If no pending admin found, we need to handle this case
            // For now, we'll throw an error
            throw new Error('Organization password reset requires existing verified admin record');
          }
        } else {
          throw new Error('User or organization not found');
        }
      }

      // Mark password reset as used
      await tx.passwordReset.update({
        where: { ResetId: passwordReset.ResetId },
        data: { Used: true },
      });
    });

    return res.status(200).json({
      message: 'Password has been reset successfully. You can now login with your new password.',
    });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      message: 'Error resetting password',
      error: error.message,
    });
  }
};
