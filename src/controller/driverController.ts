import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../model/index.js';
import { sendUserCredentialsEmail } from '../utils/emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'samaysafar_secret_key';

/**
 * Helper function to check if user is admin based on JWT payload
 * Checks multiple possible field names for flexibility
 */
const isAdminUser = (payload: any): boolean => {
  // Check roleId first (most reliable)
  if (payload?.roleId === 1 || payload?.RoleId === 1) return true;

  // Collect all possible role field values
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

  // Check if any role field contains "1" (roleId as string)
  if (roleCandidates.some((r) => r === '1')) return true;

  // Check if any role field contains admin-related keywords
  if (roleCandidates.some((r) => /admin|orgadmin|organization/.test(r))) {
    return true;
  }

  // Check boolean admin flags
  return !!(payload?.isAdmin ?? payload?.IsAdmin ?? payload?.admin);
};

const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

/**
 * Create Driver - Admin only
 * Body: { name, email, phone, password }
 */
export const createDriver = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!isAdminUser(payload)) {
      return res.status(403).json({ message: 'Only admin users can create drivers' });
    }

    const orgId = payload?.orgId;
    if (!orgId) return res.status(400).json({ message: 'Organization ID missing from token' });

    const { name, email, phone, password, routeId, busId } = req.body as any;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Missing required fields: name, email, phone, password' });
    }

    // Ensure email not already used
    const existingUser = await prisma.users.findUnique({ where: { Email: email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          OrgId: orgId,
          Role: 'driver',
          Name: name,
          Email: email,
          Phone: phone,
          RouteId: routeId ? Number(routeId) : null,
          BusId: busId ? Number(busId) : null,
        },
      });

      await tx.credentials.create({
        data: {
          UserId: user.UserId,
          PasswordHash: passwordHash,
          MustChangePassword: false,
          EmailSentAt: new Date(),
        },
      });

      return user;
    });

    // Optionally send credentials email (don't fail request on email error)
    try {
      // sendUserCredentialsEmail expects organization name as string; pass empty string if not available
      await sendUserCredentialsEmail(email, password, name, String(payload?.orgName || ''), 'driver');
    } catch (emailError: any) {
      console.error('Error sending driver credentials email:', emailError);
    }

    return res.status(201).json({ message: 'Driver created successfully', driver: { userId: result.UserId, name: result.Name, email: result.Email, phone: result.Phone } });
  } catch (error: any) {
    console.error('Error creating driver:', error);
    return res.status(500).json({ message: 'Error creating driver', error: error.message });
  }
};

/**
 * Edit Driver - Admin only
 */
export const editDriver = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!isAdminUser(payload)) {
      return res.status(403).json({ message: 'Only admin users can edit drivers' });
    }

    const orgId = payload?.orgId;
    if (!orgId) return res.status(400).json({ message: 'Organization ID missing from token' });

    const driverId = Number(req.params.id);
    if (isNaN(driverId)) return res.status(400).json({ message: 'Invalid driver id' });

    const existing = await prisma.users.findUnique({ where: { UserId: driverId } });
    if (!existing || existing.OrgId !== orgId || existing.Role !== 'driver') return res.status(404).json({ message: 'Driver not found' });

    const { name, phone, password, routeId, busId } = req.body as any;

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.users.update({
        where: { UserId: driverId }, data: {
          ...(name !== undefined ? { Name: name } : {}),
          ...(phone !== undefined ? { Phone: phone } : {}),
          ...(routeId !== undefined ? { RouteId: routeId ? Number(routeId) : null } : {}),
          ...(busId !== undefined ? { BusId: busId ? Number(busId) : null } : {}),
        }
      });

      if (password !== undefined) {
        const passwordHash = await hashPassword(String(password));
        // Update or create credentials
        const cred = await tx.credentials.findUnique({ where: { UserId: driverId } });
        if (cred) {
          await tx.credentials.update({ where: { UserId: driverId }, data: { PasswordHash: passwordHash, PasswordGeneratedAt: new Date() } });
        } else {
          await tx.credentials.create({ data: { UserId: driverId, PasswordHash: passwordHash, MustChangePassword: false } });
        }
      }

      return user;
    });

    return res.status(200).json({ message: 'Driver updated successfully', driver: { userId: updated.UserId, name: updated.Name, email: updated.Email, phone: updated.Phone } });
  } catch (error: any) {
    console.error('Error updating driver:', error);
    return res.status(500).json({ message: 'Error updating driver', error: error.message });
  }
};

/**
 * Delete Driver - admin only. Prevent deletion if trips or route assignments exist
 */
export const deleteDriver = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!isAdminUser(payload)) {
      return res.status(403).json({ message: 'Only admin users can delete drivers' });
    }

    const orgId = payload?.orgId;
    if (!orgId) return res.status(400).json({ message: 'Organization ID missing from token' });

    const driverId = Number(req.params.id);
    if (isNaN(driverId)) return res.status(400).json({ message: 'Invalid driver id' });

    const driver = await prisma.users.findUnique({ where: { UserId: driverId }, include: { trips: true, driverRoutes: true } });
    if (!driver || driver.OrgId !== orgId || driver.Role !== 'driver') return res.status(404).json({ message: 'Driver not found' });

    if (driver.trips && driver.trips.length > 0) {
      return res.status(400).json({ message: 'Cannot delete driver with existing trips. Remove trips first.' });
    }

    await prisma.$transaction(async (tx) => {
      // Delete route assignments first
      await tx.routeDriverAssignment.deleteMany({ where: { DriverId: driverId } });

      // Delete audit logs related to this user
      await tx.userCreationAudit.deleteMany({ where: { CreatedUserId: driverId } });
      await tx.userCreationAudit.deleteMany({ where: { AdminUserId: driverId } });

      // Delete notifications
      await tx.notification.deleteMany({ where: { UserId: driverId } });

      // Delete credentials
      await tx.credentials.deleteMany({ where: { UserId: driverId } });

      // Delete user
      await tx.users.delete({ where: { UserId: driverId } });
    });

    return res.status(200).json({ message: 'Driver deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting driver:', error);
    return res.status(500).json({ message: 'Error deleting driver', error: error.message });
  }
};

/**
 * List drivers scoped to organization
 */
export const listDrivers = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    let orgId = payload?.orgId;
    if (!orgId && payload?.userId) {
      const user = await prisma.users.findUnique({ where: { UserId: Number(payload.userId) } });
      orgId = user?.OrgId;
    }

    if (!orgId) return res.status(400).json({ message: 'Organization context not found' });

    const { name, email } = req.query as any;
    const where: any = { OrgId: Number(orgId), Role: 'driver' };
    if (name) where.Name = { contains: String(name), mode: 'insensitive' };
    if (email) where.Email = { contains: String(email), mode: 'insensitive' };

    const drivers = await prisma.users.findMany({
      where,
      orderBy: { Name: 'asc' },
      include: {
        driverRoutes: {
          include: {
            route: true,
          },
        },
        assignedBus: true,
      },
    });

    const mappedDrivers = drivers.map((driver) => {
      // Find the first assigned route name
      let routeName = '';
      if (driver.driverRoutes && driver.driverRoutes.length > 0) {
        routeName = driver.driverRoutes[0]?.route?.Name ?? '';
      }

      return {
        ...driver,
        Route: routeName,
        RouteId: driver.RouteId,
        BusId: driver.BusId,
        BusNumber: driver.assignedBus?.BusNumber ?? '',
      };
    });

    return res.status(200).json({ drivers: mappedDrivers });
  } catch (error: any) {
    console.error('Error listing drivers:', error);
    return res.status(500).json({ message: 'Error listing drivers', error: error.message });
  }
};

/**
 * Get single driver
 */
export const getDriver = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    let orgId = payload?.orgId;
    if (!orgId && payload?.userId) {
      const user = await prisma.users.findUnique({ where: { UserId: Number(payload.userId) } });
      orgId = user?.OrgId;
    }

    if (!orgId) return res.status(400).json({ message: 'Organization context not found' });

    const driverId = Number(req.params.id);
    if (isNaN(driverId)) return res.status(400).json({ message: 'Invalid driver id' });

    const driver = await prisma.users.findUnique({ where: { UserId: driverId } });
    if (!driver || driver.OrgId !== orgId || driver.Role !== 'driver') return res.status(404).json({ message: 'Driver not found' });

    return res.status(200).json({ driver });
  } catch (error: any) {
    console.error('Error fetching driver:', error);
    return res.status(500).json({ message: 'Error fetching driver', error: error.message });
  }
};