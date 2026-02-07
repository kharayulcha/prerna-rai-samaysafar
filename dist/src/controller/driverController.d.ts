import type { Request, Response } from 'express';
/**
 * Create Driver - Admin only
 * Body: { name, email, phone, password }
 */
export declare const createDriver: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Edit Driver - Admin only
 */
export declare const editDriver: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Delete Driver - admin only. Prevent deletion if trips or route assignments exist
 */
export declare const deleteDriver: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * List drivers scoped to organization
 */
export declare const listDrivers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Get single driver
 */
export declare const getDriver: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=driverController.d.ts.map