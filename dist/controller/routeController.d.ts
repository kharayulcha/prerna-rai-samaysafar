import type { Request, Response } from 'express';
/**
 * Create Route - Admin (organization admin) creates a route and assigns buses/drivers
 * Body: { name, description?, scheduleDays, startTime, busIds?: number[], driverIds?: number[] }
 */
export declare const createRoute: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Edit Route
 */
export declare const editRoute: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Delete Route
 */
export declare const deleteRoute: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * List Routes - GET /api/routes
 * Returns routes scoped to the authenticated user's organization
 */
export declare const listRoutes: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Get single Route - GET /api/routes/:id
 */
export declare const getRoute: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Get Student Schedule - GET /api/routes/student-schedule
 * Returns the schedule for the route assigned to the authenticated student
 */
export declare const getStudentSchedule: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=routeController.d.ts.map