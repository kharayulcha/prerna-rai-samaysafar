import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../model/index.js';
import { generateOTP, sendOTPEmail, sendPasswordResetOTPEmail, sendUserCredentialsEmail } from '../utils/emailService.js';

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

    const existingOrg = await prisma.organization.findUnique({ where: { Email: email } });
    if (existingOrg) {
      return res.status(400).json({ message: 'Organization already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Process logo if provided - Logo is Bytes? in DB
    let logoBuffer: Buffer | null = null;
    if (file && file.buffer) {
      logoBuffer = file.buffer;
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    await prisma.pendingAdmin.upsert({
      where: { Email: email },
      update: {
        Name: name,
        Phone: phone,
        PasswordHash: passwordHash,
        Address: address,
        Logo: logoBuffer ? new Uint8Array(logoBuffer) : null,
        OTP: otp,
        OTPExpiresAt: expiresAt,
      },
      create: {
        Name: name,
        Email: email,
        Phone: phone,
        PasswordHash: passwordHash,
        Address: address,
        Logo: logoBuffer ? new Uint8Array(logoBuffer) : null,
        OTP: otp,
        OTPExpiresAt: expiresAt,
      }
    });

    await sendOTPEmail(email, otp, name);
    return res.status(200).json({ message: 'Registration successful. Verify OTP sent to email.' });

  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering organization', error: error.message });
  }
};

export const verifyOrganizationOTP = async (req: Request, res: Response) => {
  const { email, code } = req.body;
  try {
    const pending = await prisma.pendingAdmin.findUnique({ where: { Email: email } });
    if (!pending) return res.status(404).json({ message: 'Registration not found' });
    if (pending.Verified) return res.status(400).json({ message: 'Already verified' });
    if (pending.OTP !== code) return res.status(400).json({ message: 'Invalid OTP' });
    if (new Date() > pending.OTPExpiresAt) return res.status(400).json({ message: 'OTP expired' });

    // Transaction to create Org and Admin User
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          Name: pending.Name,
          Email: pending.Email,
          Phone: pending.Phone,
          Address: pending.Address || '',
          Logo: pending.Logo ? new Uint8Array(pending.Logo) : null,
        }
      });

      // ProfileImage in Users is String?
      // If we have logo bytes, we can convert to base64 data URL for User profile image string
      const profileImageStr = pending.Logo
        ? `data:image/png;base64,${Buffer.from(pending.Logo).toString('base64')}`
        : null;

      // Create Admin User
      const admin = await tx.users.create({
        data: {
          OrgId: org.OrgId,
          Role: 'admin',
          Name: pending.Name,
          Email: pending.Email,
          Phone: pending.Phone,
          ProfileImage: profileImageStr
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
    const pending = await prisma.pendingAdmin.findUnique({ where: { Email: email } });
    if (!pending) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    await prisma.pendingAdmin.update({
      where: { Email: email },
      data: { OTP: otp, OTPExpiresAt: expiresAt }
    });

    await sendOTPEmail(email, otp, pending.Name);
    return res.status(200).json({ message: 'OTP resent.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Error resending OTP', error: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.users.findUnique({
      where: { Email: email },
      include: {
        organization: true,
        parent: { select: { Name: true } },
        assignedBus: { select: { BusNumber: true } },
        assignedRoute: {
          include: {
            driverAssignments: {
              where: { Status: 'active' },
              include: {
                driver: {
                  include: { assignedBus: { select: { BusId: true, BusNumber: true } } }
                }
              }
            },
            busAssignments: {
              where: { Status: 'active' },
              include: { bus: { select: { BusNumber: true } } }
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
                  include: {
                    driver: {
                      include: { assignedBus: { select: { BusId: true, BusNumber: true } } }
                    }
                  }
                },
                busAssignments: {
                  where: { Status: 'active' },
                  include: { bus: { select: { BusNumber: true } } }
                }
              }
            }
          }
        }
      }
    });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const creds = await prisma.credentials.findUnique({ where: { UserId: user.UserId } });
    if (!creds) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, creds.PasswordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    // Extract route info for drivers if not directly assigned
    let routeId = user.RouteId;
    let busId = user.BusId || (user as any).assignedRoute?.busAssignments[0]?.BusId || (user as any).assignedRoute?.driverAssignments[0]?.driver?.assignedBus?.BusId || null;
    let routeName = (user as any).assignedRoute?.Name || null;
    let busNumber = (user as any).assignedRoute?.busAssignments[0]?.bus?.BusNumber || (user as any).assignedRoute?.driverAssignments[0]?.driver?.assignedBus?.BusNumber || (user as any).assignedBus?.BusNumber || null;

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
            busNumber = primaryAssignment.route.busAssignments[0]?.bus?.BusNumber || (user as any).assignedBus?.BusNumber || null;
          }
        }
      }
    }

    const token = jwt.sign(
      {
        userId: user.UserId,
        orgId: user.OrgId,
        role: user.Role,
        email: user.Email,
        name: user.Name,
        phone: user.Phone,
        address: user.organization?.Address || '',
        routeId: routeId,
        busId: busId,
        parentName: (user as any).parent?.Name || null,
        routeName: routeName,
        driverName: (user as any).assignedRoute?.driverAssignments[0]?.driver?.Name || null,
        driverPhone: (user as any).assignedRoute?.driverAssignments[0]?.driver?.Phone || null,
        busNumber: busNumber,
        children: user.children.map(c => ({
          name: c.Name,
          routeName: (c as any).assignedRoute?.Name || null,
          driverName: (c as any).assignedRoute?.driverAssignments[0]?.driver?.Name || null,
          driverPhone: (c as any).assignedRoute?.driverAssignments[0]?.driver?.Phone || null,
          busId: (c as any).assignedRoute?.busAssignments[0]?.BusId || (c as any).assignedRoute?.driverAssignments[0]?.driver?.assignedBus?.BusId || c.BusId || null,
          busNumber: (c as any).assignedRoute?.busAssignments[0]?.bus?.BusNumber || (c as any).assignedRoute?.driverAssignments[0]?.driver?.assignedBus?.BusNumber || (c as any).assignedBus?.BusNumber || null,
        }))
      },
      JWT_SECRET as string,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.UserId,
        name: user.Name,
        role: user.Role,
        orgId: user.OrgId,
        email: user.Email,
        phone: user.Phone,
        address: user.organization?.Address || '',
        routeId: routeId,
        busId: busId,
        profileImage: user.ProfileImage,
        parentName: (user as any).parent?.Name || null,
        routeName: routeName,
        driverName: (user as any).assignedRoute?.driverAssignments[0]?.driver?.Name || null,
        driverPhone: (user as any).assignedRoute?.driverAssignments[0]?.driver?.Phone || null,
        busNumber: busNumber,
        children: user.children.map(c => ({
          name: c.Name,
          routeName: (c as any).assignedRoute?.Name || null,
          driverName: (c as any).assignedRoute?.driverAssignments[0]?.driver?.Name || null,
          driverPhone: (c as any).assignedRoute?.driverAssignments[0]?.driver?.Phone || null,
          busId: (c as any).assignedRoute?.busAssignments[0]?.BusId || (c as any).assignedRoute?.driverAssignments[0]?.driver?.assignedBus?.BusId || c.BusId || null,
          busNumber: (c as any).assignedRoute?.busAssignments[0]?.bus?.BusNumber || (c as any).assignedRoute?.driverAssignments[0]?.driver?.assignedBus?.BusNumber || (c as any).assignedBus?.BusNumber || null,
        })),
        organization: user.organization ? {
          name: user.organization.Name,
          logo: user.organization.Logo ? `data:image/png;base64,${Buffer.from(user.organization.Logo).toString('base64')}` : null,
          address: user.organization.Address
        } : null
      }
    });

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'Error logging in', error: err.message });
  }
};

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

    const { name, email, phone, role, password, parentId, routeId } = req.body as any;

    const existing = await prisma.users.findUnique({ where: { Email: email } });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.users.create({
        data: {
          OrgId: orgId,
          Name: name,
          Email: email,
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

    const { name, phone, profileImage } = req.body;
    const file = (req as any).file;

    let processedProfileImage = profileImage;
    if (file && file.buffer) {
      processedProfileImage = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }

    const updated = await prisma.users.update({
      where: { UserId: userId },
      data: {
        ...(name ? { Name: name } : {}),
        ...(phone ? { Phone: phone } : {}),
        ...(processedProfileImage ? { ProfileImage: processedProfileImage } : {})
      }
    });

    return res.status(200).json({ message: 'Profile updated', user: updated });
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

    return res.status(200).json({ message: 'User updated', user: updated });

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
      await tx.credentials.deleteMany({ where: { UserId: targetId } });
      await tx.userCreationAudit.deleteMany({ where: { CreatedUserId: targetId } });
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

    const notifications = await prisma.notification.findMany({
      where: { UserId: userId },
      orderBy: { NotificationId: 'desc' },
      take: 20
    });

    return res.status(200).json({ notifications });
  } catch (error: any) {
    console.error('getNotifications error:', error);
    return res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};



