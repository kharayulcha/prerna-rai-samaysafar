import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { io } from '../app.js';
import prisma from '../model/index.js';
import { generateOTP, sendOTPEmail, sendPasswordResetOTPEmail, sendUserCredentialsEmail } from '../utils/emailService.js';
import { info, error as logError, warn } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'samaysafar_secret_key';
const OTP_EXPIRY_MINUTES = 10;
const SALT_ROUNDS = 10;

/**
 * Helper function to check if user is admin based on JWT payload
 */
const isAdminUser = (payload: any): boolean => {
  if (payload?.roleId === 1 || payload?.RoleId === 1) return true;
  const roleCandidates = [
    payload?.role,
    payload?.Role,
    payload?.userRole,
    payload?.UserRole,
    payload?.userType,
    payload?.UserType,
    payload?.roleName,
    payload?.RoleName,
  ]
    .filter((v) => v !== undefined && v !== null)
    .map((v) => String(v).toLowerCase());
  if (roleCandidates.some((r) => r === '1')) return true;
  if (roleCandidates.some((r) => /admin|orgadmin|organization/.test(r))) return true;
  return !!(payload?.isAdmin ?? payload?.IsAdmin ?? payload?.admin);
};

export const registerOrganization = async (req: Request, res: Response) => {
  const { name, email, phone, password, address } = req.body;
  const file = (req as any).file;

  try {
    const existingPending = await prisma.pendingAdmin.findUnique({ where: { Email: email } });
    if (existingPending) {
      if (existingPending.Verified) {
        return res.status(400).json({ message: 'Organization already verified. Please login.' });
      }
    }

    const existingOrg = await prisma.organization.findUnique({ where: { Email: email.toLowerCase() } });
    if (existingOrg) {
      return res.status(400).json({ message: 'Organization already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Process logo if provided - Logo is String? (path) in DB
    const logoPath = file ? file.filename : null;
    if (logoPath) info('[Register] Logo file saved:', logoPath);


    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    await prisma.pendingAdmin.upsert({
      where: { Email: normalizedEmail },
      update: {
        Name: name,
        Phone: phone,
        PasswordHash: passwordHash,
        Address: address,
        Logo: logoPath,
        OTP: otp,
        OTPExpiresAt: expiresAt,
      },
      create: {
        Name: name,
        Email: normalizedEmail,
        Phone: phone,
        PasswordHash: passwordHash,
        Address: address,
        Logo: logoPath,
        OTP: otp,
        OTPExpiresAt: expiresAt,
      }
    });
    info('[Register] Pending admin created/updated with logo:', logoPath);


    await sendOTPEmail(normalizedEmail, otp, name);
    return res.status(200).json({ message: 'Registration successful. Verify OTP sent to email.' });

  } catch (error: any) {
    logError('Registration error:', error);
    res.status(500).json({ message: 'Error registering organization', error: error.message });
  }
};

export const verifyOrganizationOTP = async (req: Request, res: Response) => {
  const { email, code } = req.body;
  try {
    info(`[OTP Verify] Attempting to verify OTP for email: ${email}, code: ${code}`);

    // Normalize email (lowercase for case-insensitive matching)
    const normalizedEmail = email.toLowerCase().trim();
    const pending = await prisma.pendingAdmin.findUnique({
      where: { Email: normalizedEmail }
    });

    if (!pending) {
      logError(`[OTP Verify] No pending registration found for email: ${normalizedEmail}`);
      return res.status(404).json({ message: 'Registration not found' });
    }

    info(`[OTP Verify] Found pending registration. Verified: ${pending.Verified}, OTP: ${pending.OTP}, OTPExpiresAt: ${pending.OTPExpiresAt}`);

    if (pending.Verified) return res.status(400).json({ message: 'Already verified' });

    // Normalize OTP comparison: convert both to string and trim whitespace
    const normalizedCode = String(code).trim();
    const normalizedOTP = String(pending.OTP).trim();

    info(`[OTP Verify] Comparing OTP - stored: '${normalizedOTP}' (type: ${typeof pending.OTP}), provided: '${normalizedCode}' (type: ${typeof code})`);

    if (normalizedOTP !== normalizedCode) {
      logError(`[OTP Verify] OTP mismatch: expected '${normalizedOTP}', got '${normalizedCode}'`);
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const now = new Date();
    if (now > pending.OTPExpiresAt) {
      logError(`[OTP Verify] OTP expired. Now: ${now}, ExpiresAt: ${pending.OTPExpiresAt}`);
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Transaction to create Org and Admin User
    await prisma.$transaction(async (tx) => {
      info('[OTP Verify] Creating organization with logo:', pending.Logo || 'null');
      const org = await tx.organization.create({
        data: {
          Name: pending.Name,
          Email: pending.Email,
          Phone: pending.Phone,
          Address: pending.Address || '',
          Logo: pending.Logo,
        }
      });
      info('[OTP Verify] Organization created:', org.OrgId);

      // Create Admin User
      const admin = await tx.users.create({
        data: {
          OrgId: org.OrgId,
          Role: 'admin',
          Name: pending.Name,
          Email: pending.Email,
          Phone: pending.Phone,
          ProfileImage: pending.Logo
        }
      });


      // Create Credentials
      await tx.credentials.create({
        data: {
          UserId: admin.UserId,
          PasswordHash: pending.PasswordHash,
          EmailSentAt: new Date(),
          MustChangePassword: false
        }
      });

      await tx.pendingAdmin.update({
        where: { PendingId: pending.PendingId },
        data: { Verified: true }
      });
    });

    return res.status(200).json({ message: 'Verification successful. Login to continue.' });

  } catch (error: any) {
    console.error("Verification error", error);
    return res.status(500).json({ message: 'Verification failed', error: error.message });
  }
};

export const resendOrganizationOTP = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();
    const pending = await prisma.pendingAdmin.findUnique({ where: { Email: normalizedEmail } });
    if (!pending) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    await prisma.pendingAdmin.update({
      where: { Email: normalizedEmail },
      data: { OTP: otp, OTPExpiresAt: expiresAt }
    });

    await sendOTPEmail(normalizedEmail, otp, pending.Name);
    return res.status(200).json({ message: 'OTP resent.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Error resending OTP', error: err.message });
  }
};

// Helper to fetch full user data structure used by login and getProfile
async function getUserFullData(email: string) {
  // Use findFirst with insensitive mode to gracefully handle case mismatches
  return await prisma.users.findFirst({
    where: { Email: { equals: email, mode: 'insensitive' } },

    include: {
      organization: { select: { OrgId: true, Name: true, Email: true, Phone: true, Address: true, Logo: true } },
      parent: { select: { Name: true } },
      assignedBus: { select: { BusId: true, BusNumber: true } },
      assignedRoute: {
        include: {
          driverAssignments: {
            where: { Status: 'active' },
            include: { driver: { select: { Name: true, Phone: true, assignedBus: { select: { BusId: true, BusNumber: true } } } } }
          },
          busAssignments: {
            where: { Status: 'active' },
            include: { bus: { select: { BusNumber: true, BusId: true } } }
          }
        }
      },
      driverRoutes: {
        where: { Status: 'active' },
        include: {
          route: {
            include: {
              busAssignments: {
                where: { Status: 'active' },
                include: { bus: { select: { BusNumber: true } } }
              }
            }
          }
        }
      },
      children: {
        include: {
          assignedBus: { select: { BusNumber: true } },
          assignedRoute: {
            include: {
              driverAssignments: {
                where: { Status: 'active' },
                include: { driver: { select: { Name: true, Phone: true, assignedBus: { select: { BusId: true, BusNumber: true } } } } }
              },
              busAssignments: {
                where: { Status: 'active' },
                include: { bus: { select: { BusNumber: true, BusId: true } } }
              }
            }
          }
        }
      }
    }
  });
}

function formatUserForResponse(user: any) {
  // Helper for image URLs
  const getImageUrl = (filename: any) => {
    if (!filename || typeof filename !== 'string') return null;
    if (filename.startsWith('http') || filename.startsWith('data:')) return filename;
    
    // Using a relative path so the frontend can prepend its own backend base URL
    return `/uploads/${filename}`;
  };


  // Extract route info for drivers if not directly assigned
  let routeId = user.RouteId;
  let busId = user.BusId || user.assignedRoute?.busAssignments[0]?.BusId || user.assignedRoute?.driverAssignments[0]?.driver?.assignedBus?.BusId || null;
  let routeName = user.assignedRoute?.Name || null;
  let busNumber = user.assignedRoute?.busAssignments[0]?.bus?.BusNumber || user.assignedRoute?.driverAssignments[0]?.driver?.assignedBus?.BusNumber || user.assignedBus?.BusNumber || null;

  if (user.Role?.toLowerCase() === 'driver' && (!routeId || !busId) && user.driverRoutes.length > 0) {
    const primaryAssignment = user.driverRoutes[0];
    if (primaryAssignment) {
      if (!routeId) {
        routeId = primaryAssignment.RouteId;
        routeName = primaryAssignment.route.Name;
      }
      if (!busId) {
        busId = primaryAssignment.route.busAssignments[0]?.BusId || null;
        if (!busNumber) {
          busNumber = primaryAssignment.route.busAssignments[0]?.bus?.BusNumber || user.assignedBus?.BusNumber || null;
        }
      }
    }
  }

  return {
    id: user.UserId,
    name: user.Name,
    role: user.Role,
    orgId: user.OrgId,
    email: user.Email,
    phone: user.Phone,
    address: user.organization?.Address || '',
    routeId: routeId,
    busId: busId,
    profileImage: getImageUrl(user.ProfileImage),
    parentName: user.parent?.Name || null,
    routeName: routeName,
    driverName: user.assignedRoute?.driverAssignments[0]?.driver?.Name || null,
    driverPhone: user.assignedRoute?.driverAssignments[0]?.driver?.Phone || null,
    busNumber: busNumber,
    children: user.children.map((c: any) => ({
      name: c.Name,
      routeId: c.RouteId || null,
      routeName: c.assignedRoute?.Name || null,
      driverName: c.assignedRoute?.driverAssignments[0]?.driver?.Name || null,
      driverPhone: c.assignedRoute?.driverAssignments[0]?.driver?.Phone || null,
      busNumber: c.assignedRoute?.busAssignments[0]?.bus?.BusNumber || c.assignedRoute?.driverAssignments[0]?.driver?.assignedBus?.BusNumber || c.assignedBus?.BusNumber || null,
    })),
    organization: user.organization ? {
      name: user.organization.Name,
      logo: getImageUrl(user.organization.Logo),
      address: user.organization.Address
    } : null
  };
}


export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    // Normalize email for case-insensitive matching
    const normalizedEmail = email.toLowerCase().trim();
    info(`[Login] Attempting login for: ${normalizedEmail}`);
    
    const user = await getUserFullData(normalizedEmail);


    if (!user) {
      info(`[Login] No user found with email: ${normalizedEmail}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const creds = await prisma.credentials.findUnique({ where: { UserId: user.UserId } });
    if (!creds) {
      info(`[Login] No credentials found for user ID: ${user.UserId}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, creds.PasswordHash);
    if (!valid) {
      info(`[Login] Password mismatch for: ${normalizedEmail}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    info(`[Login] Success for: ${normalizedEmail}`);
    const userForResponse = formatUserForResponse(user);


    const token = jwt.sign(
      {
        userId: userForResponse.id,
        orgId: userForResponse.orgId,
        role: userForResponse.role,
        email: userForResponse.email,
        name: userForResponse.name,
        phone: userForResponse.phone,
        address: userForResponse.address,
        routeId: userForResponse.routeId,
        busId: userForResponse.busId,
        parentName: userForResponse.parentName,
        routeName: userForResponse.routeName,
        driverName: userForResponse.driverName,
        driverPhone: userForResponse.driverPhone,
        busNumber: userForResponse.busNumber,
        children: userForResponse.children
      },
      JWT_SECRET as string,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: userForResponse
    });

  } catch (err: any) {
    logError(err);
    return res.status(500).json({ message: 'Error logging in', error: err.message });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const payload: any = jwt.verify(token as string, JWT_SECRET as string);

    const user = await getUserFullData(payload.email);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userForResponse = formatUserForResponse(user);
    return res.status(200).json({ user: userForResponse });

  } catch (err: any) {
    logError('[getProfile]', err);
    return res.status(500).json({ message: 'Error fetching profile', error: err.message });
  }
};
// code for creating user and assigning parents 
export const createUser = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const payload: any = jwt.verify(token as string, JWT_SECRET as string);

    const orgId = Number(payload.orgId || 0);
    if (!orgId) return res.status(400).json({ message: 'Invalid organization in token' });

    const { name, email, phone, role, password, parentId, routeId } = req.body || {};
    if (!req.body) {
      warn('[CreateUser] Warning: req.body is undefined.');
    }
    const normalizedEmail = (email || '').toLowerCase().trim();

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check if email already exists (case-insensitive)
    const existing = await prisma.users.findFirst({
      where: {
        Email: { equals: normalizedEmail, mode: 'insensitive' },
        OrgId: orgId
      }
    });

    if (existing) return res.status(400).json({ message: 'Email already exists in your organization' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.users.create({
        data: {
          OrgId: orgId,
          Name: name,
          Email: normalizedEmail,
          Phone: phone,

          Role: role,
          ParentId: parentId ? Number(parentId) : null,
          RouteId: routeId ? Number(routeId) : null
        }
      });
      await tx.credentials.create({
        data: {
          UserId: u.UserId,
          PasswordHash: passwordHash,
          EmailSentAt: new Date(),
          MustChangePassword: true
        }
      });

      // Audit trail
      await tx.userCreationAudit.create({
        data: {
          CreatedUserId: u.UserId,
          AdminUserId: Number(payload.userId || 0),
          EmailSentAt: new Date()
        }
      });

      return u;
    });

    try {
      // Get org name
      const org = await prisma.organization.findUnique({ where: { OrgId: orgId } });
      await sendUserCredentialsEmail(String(email), String(password), String(name), org?.Name || 'SamaySafar', String(role));
    } catch (emailErr) {
      console.warn('User created but failed to send email:', emailErr);
    }

    res.status(201).json({ message: 'User created successfully', user: newUser });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: 'Error creating user', error: err.message });
  }
};

export const listUsers = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const payload: any = jwt.verify(token as string, JWT_SECRET as string);
    const orgId = Number(payload.orgId || 0);

    const role = req.query.role as string;
    const where: any = { OrgId: orgId };
    if (role) where.Role = role.toLowerCase();
    else where.Role = { in: ['student', 'parent', 'driver'] };

    const users = await prisma.users.findMany({
      where,
      orderBy: { Name: 'asc' },
      include: {
        parent: { select: { Name: true } },
        assignedRoute: { select: { Name: true } }
      }
    });

    const mapped = users.map(u => ({
      id: u.UserId.toString(),
      name: u.Name,
      email: u.Email,
      phone: u.Phone,
      role: u.Role,
      parentId: u.ParentId,
      parentName: u.parent?.Name || null,
      routeId: u.RouteId,
      routeName: u.assignedRoute?.Name || null
    }));

    return res.status(200).json({ users: mapped });

  } catch (err: any) {
    return res.status(500).json({ message: 'Error listing users', error: err.message });
  }
};

export const editProfile = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const payload: any = jwt.verify(token as string, JWT_SECRET as string);
    const userId = Number(payload.userId || 0);
    if (!userId) return res.status(401).json({ message: 'Invalid userId' });

    const { name, phone, address, password, email } = req.body || {};
    const file = (req as any).file;
    
    // Add debugging log
    info(`[EditProfile Debug] Body: ${JSON.stringify(req.body)}, File present: ${!!file}`);
    
    if (!req.body || Object.keys(req.body).length === 0) {
      if (!file) {
        warn('[EditProfile] No name or other fields provided in body');
        // If it's empty, we might just skip update instead of failing
      }
    }


    // 1. Update User info
    const updateData: any = {};
    if (name) updateData.Name = name;
    if (phone) updateData.Phone = phone;
    if (email) {
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = email.toLowerCase().trim();
      
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      const existing = await prisma.users.findFirst({
        where: {
          Email: { equals: normalizedEmail, mode: 'insensitive' },
          UserId: { not: userId }
        }
      });
      if (existing) {
        return res.status(400).json({ message: 'Email already taken' });
      }
      updateData.Email = normalizedEmail;
    }
      updateData.Email = email;
    }
    if (file && file.filename) {
      updateData.ProfileImage = file.filename;
    }

    const updated = await prisma.users.update({
      where: { UserId: userId },
      data: updateData
    });

    // 2. If Admin, also update Organization details
    if (isAdminUser(payload)) {
      const orgId = Number(payload.orgId);
      if (orgId) {
        await prisma.organization.update({
          where: { OrgId: orgId },
          data: {
            ...(name ? { Name: name } : {}),
            ...(email ? { Email: email } : {}),
            ...(phone ? { Phone: phone } : {}),
            ...(address ? { Address: address } : {}),
            ...(file && file.filename ? { Logo: file.filename } : {})
          }
        });
      }
    }


    // 3. Update Password if provided
    if (password) {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await prisma.credentials.update({
        where: { UserId: userId },
        data: { PasswordHash: passwordHash }
      });
    }

    // 4. Fetch the full updated user with all relationships to return
    const user = await getUserFullData(updated.Email);
    if (!user) return res.status(404).json({ message: 'User not found after update' });

    const userForResponse = formatUserForResponse(user);

    // Generate new token with updated information
    const newToken = jwt.sign(
      {
        userId: userForResponse.id,
        orgId: userForResponse.orgId,
        role: userForResponse.role,
        email: userForResponse.email,
        name: userForResponse.name,
        phone: userForResponse.phone,
        address: userForResponse.address,
        routeId: userForResponse.routeId,
        busId: userForResponse.busId,
        parentName: userForResponse.parentName,
        routeName: userForResponse.routeName,
        driverName: userForResponse.driverName,
        driverPhone: userForResponse.driverPhone,
        busNumber: userForResponse.busNumber,
        children: userForResponse.children
      },
      JWT_SECRET as string,
      { expiresIn: '30d' }
    );

    return res.status(200).json({ message: 'Profile updated', user: userForResponse, token: newToken });
  } catch (err: any) {
    return res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
};
export const editUser = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const payload: any = jwt.verify(token as string, JWT_SECRET as string);

    if (!isAdminUser(payload)) return res.status(403).json({ message: 'Only admin can edit users' });

    const targetId = Number(req.params.id);
    const orgIdFromToken = Number(payload.orgId || 0);
    const { name, email, phone, parentId, routeId } = req.body as any;

    const existing = await prisma.users.findUnique({ where: { UserId: targetId } });
    if (!existing || existing.OrgId !== orgIdFromToken) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData: any = {};
    if (name) updateData.Name = name;
    if (email) updateData.Email = email;
    if (phone) updateData.Phone = phone;

    // Convert undefined to null or omit to satisfy exactOptionalPropertyTypes: true
    if (parentId !== undefined) {
      updateData.ParentId = parentId ? Number(parentId) : null;
    }
    if (routeId !== undefined) {
      updateData.RouteId = routeId ? Number(routeId) : null;
    }

    const updated = await prisma.users.update({
      where: { UserId: targetId },
      data: updateData
    });

    const userToReturn = {
      ...updated,
      ProfileImage: updated.ProfileImage ? `/uploads/${updated.ProfileImage}` : null
    };

    return res.status(200).json({ message: 'User updated', user: userToReturn });

  } catch (err: any) {
    return res.status(500).json({ message: 'Error updating user', error: err.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const payload: any = jwt.verify(token as string, JWT_SECRET as string);

    if (!isAdminUser(payload)) return res.status(403).json({ message: 'Only admin can delete users' });

    const targetId = Number(req.params.id);
    const orgIdFromToken = Number(payload.orgId || 0);
    const existing = await prisma.users.findUnique({ where: { UserId: targetId } });
    if (!existing || existing.OrgId !== orgIdFromToken) {
      return res.status(404).json({ message: 'User not found' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete notifications
      await tx.notification.deleteMany({ where: { UserId: targetId } });

      // 2. Delete audit logs (both as created user and as admin who created others)
      await tx.userCreationAudit.deleteMany({ where: { CreatedUserId: targetId } });
      await tx.userCreationAudit.deleteMany({ where: { AdminUserId: targetId } });

      // 3. Delete driver assignments
      await tx.routeDriverAssignment.deleteMany({ where: { DriverId: targetId } });

      // 4. Delete DriverAttendance record
      await tx.driverAttendance.deleteMany({ where: { DriverId: targetId } });

      // 5. Delete Payments
      await tx.payment.deleteMany({ where: { ParentId: targetId } });

      // 6. Delete Bills
      await tx.bill.deleteMany({
        where: {
          OR: [
            { StudentId: targetId },
            { ParentId: targetId }
          ]
        }
      });

      // 7. Handle Student references - if target is a parent, students point to them
      await tx.users.updateMany({
        where: { ParentId: targetId },
        data: { ParentId: null }
      });

      // 8. Delete Credentials
      await tx.credentials.deleteMany({ where: { UserId: targetId } });

      // 9. Finally Delete User
      await tx.users.delete({ where: { UserId: targetId } });
    });

    return res.status(200).json({ message: 'User deleted' });

  } catch (err: any) {
    return res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await prisma.users.findUnique({ where: { Email: email } });
    if (!user) {
      return res.status(404).json({ message: 'User with this email does not exist' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    await prisma.passwordReset.create({
      data: {
        Email: email,
        OTP: otp,
        OTPExpiresAt: expiresAt,
      },
    });

    await sendPasswordResetOTPEmail(email, otp, user.Name);
    return res.status(200).json({ message: 'Password reset OTP sent to email' });
  } catch (error: any) {
    console.error('ForgotPassword error:', error);
    return res.status(500).json({ message: 'Error sending password reset email', error: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, code, password, newPassword } = req.body;
    const finalPassword = password || newPassword;

    if (!finalPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    const passwordReset = await prisma.passwordReset.findFirst({
      where: {
        Email: email,
        OTP: code,
        Used: false,
        OTPExpiresAt: { gt: new Date() },
      },
      orderBy: { RequestedAt: 'desc' },
    });

    if (!passwordReset) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const user = await prisma.users.findUnique({ where: { Email: email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(finalPassword, SALT_ROUNDS);

    await prisma.$transaction(async (tx) => {
      await tx.credentials.update({
        where: { UserId: user.UserId },
        data: { PasswordHash: passwordHash },
      });

      await tx.passwordReset.update({
        where: { ResetId: passwordReset.ResetId },
        data: { Used: true },
      });
    });

    return res.status(200).json({ message: 'Password reset successful. You can now login.' });
  } catch (error: any) {
    console.error('ResetPassword error:', error);
    return res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

/**
 * Get Notifications - GET /api/users/notifications
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token as string, JWT_SECRET!) as any;
    const userId = Number(payload.userId);

    // Use raw query to ensure CreatedAt is always included
    const notifications = await prisma.$queryRaw`
      SELECT "NotificationId", "UserId", "Type", "Message", "TripId", "Read", "CreatedAt"
      FROM "Notification"
      WHERE "UserId" = ${userId}
      ORDER BY "NotificationId" DESC
      LIMIT 20
    ` as any[];

    return res.status(200).json({ notifications });
  } catch (error: any) {
    console.error('getNotifications error:', error);
    return res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

/**
 * Mark a Notification as Read - PATCH /api/users/notifications/:notificationId/read
 */
export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token as string, JWT_SECRET!) as any;
    const userId = Number(payload.userId);

    const { notificationId } = req.params;
    if (!notificationId || isNaN(Number(notificationId))) {
      return res.status(400).json({ message: 'Valid notification ID is required' });
    }

    const notifId = Number(notificationId);

    // Only allow marking your own notification as read
    await prisma.$executeRaw`
      UPDATE "Notification"
      SET "Read" = true
      WHERE "NotificationId" = ${notifId} AND "UserId" = ${userId}
    `;

    // Sync across devices
    io.to(`user-${userId}`).emit('notificationRead', { notificationId: notifId });


    return res.status(200).json({ message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('markNotificationRead error:', error);
    return res.status(500).json({ message: 'Error updating notification', error: error.message });
  }
};

/**
 * Send a notice to all users in the organization
 */
export const sendNotice = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token as string, JWT_SECRET!) as any;

    if (!isAdminUser(payload)) {
      return res.status(403).json({ message: 'Only admins can send notices' });
    }

    const orgId = Number(payload.orgId);
    if (!orgId) return res.status(400).json({ message: 'Organization context not found' });

    const { header, message } = req.body;
    if (!header || !message) {
      return res.status(400).json({ message: 'Header and message are required' });
    }

    // Get all users in the organization (parents, drivers, admins, etc.)
    const directUsers = await prisma.users.findMany({
      where: { OrgId: orgId },
      select: { UserId: true }
    });

    // Get all students whose parents belong to this organization
    const students = await prisma.users.findMany({
      where: {
        parent: {
          OrgId: orgId
        }
      },
      select: { UserId: true }
    });

    // Combine all user IDs and deduplicate using Set
    const uniqueUserIds = Array.from(new Set([
      ...directUsers.map(u => u.UserId),
      ...students.map(u => u.UserId)
    ]));

    const fullMessage = `${header}: ${message}`;

    // Create notifications for all unique users
    await prisma.notification.createMany({
      data: uniqueUserIds.map(userId => ({
        UserId: userId,
        Type: 'notice',
        Message: fullMessage,
        Read: false
      }))
    });

    // Send real-time notification via socket
    // Emit noticeAdded event so all users refetch their notifications
    io.emit('noticeAdded', {
      orgId: orgId
    });

    return res.status(200).json({ message: 'Notice sent successfully to all users' });
  } catch (error: any) {
    console.error('sendNotice error:', error);
    return res.status(500).json({ message: 'Error sending notice', error: error.message });
  }
};

/**
 * Delete a Notification - DELETE /api/users/notifications/:notificationId
 * Only admins can delete notifications
 */
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token as string, JWT_SECRET!) as any;

    // Permission check moved lower to differentiate between own deletion and notice deletion


    const { notificationId } = req.params;
    if (!notificationId || isNaN(Number(notificationId))) {
      return res.status(400).json({ message: 'Valid notification ID is required' });
    }

    const notificationIdNum = Number(notificationId);
    const userId = Number(payload.userId);

    // Fetch the notification first to check ownership and type
    const notificationToDelete = await prisma.notification.findUnique({
      where: { NotificationId: notificationIdNum }
    });

    if (!notificationToDelete) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Permission check: Admin can delete anything, User can delete their own
    const isAdmin = isAdminUser(payload);
    if (!isAdmin && notificationToDelete.UserId !== userId) {
      return res.status(403).json({ message: 'You do not have permission to delete this notification' });
    }

    if (isAdmin && notificationToDelete.Type === 'notice') {
      // If it's a notice and deleted by admin, delete all notices for this organization
      const orgId = Number(payload.orgId);
      if (!orgId) {
        return res.status(400).json({ message: 'Organization context not found' });
      }

      // Get all org users to ensure we only delete within this org
      const directUsers = await prisma.users.findMany({
        where: { OrgId: orgId },
        select: { UserId: true }
      });

      const students = await prisma.users.findMany({
        where: { parent: { OrgId: orgId } },
        select: { UserId: true }
      });

      const orgUserIds = [...directUsers.map(u => u.UserId), ...students.map(u => u.UserId)];

      const notificationsToDelete = await prisma.notification.findMany({
        where: {
          Type: 'notice',
          Message: notificationToDelete.Message,
          UserId: { in: orgUserIds }
        }
      });

      const idsToDelete = notificationsToDelete.map(n => n.NotificationId);

      if (idsToDelete.length > 0) {
        await prisma.notification.deleteMany({
          where: {
            NotificationId: { in: idsToDelete }
          }
        });

        // Notify clients to remove this notification
        idsToDelete.forEach(id => {
          io.emit('notificationDeleted', { notificationId: id });
        });
      }
    } else {
      // Delete a single notification (either user deleting own, or admin deleting non-notice)
      await prisma.notification.delete({
        where: { NotificationId: notificationIdNum }
      });

      io.emit('notificationDeleted', { notificationId: notificationIdNum });
    }


    return res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Notification not found' });
    }
    console.error('deleteNotification error:', error);
    return res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
};



