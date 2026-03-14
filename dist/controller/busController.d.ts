import type { Request, Response } from 'express';
/**
 * Create Bus - Admin only
 * Body: { busNumber, model }
 */
export declare const createBus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Edit Bus - Admin only
 * PUT /api/buses/:id
 */
export declare const editBus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Delete Bus - Admin only. Prevent deletion if trips exist for this bus.
 */
export declare const deleteBus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * List buses scoped to organization
 */
export declare const listBuses: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Get single bus
 */
export declare const getBus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Get Fleet Status - Live status of all buses in the organization
 */
export declare const getFleetStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=busController.d.ts.map