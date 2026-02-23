import type { Request, Response } from 'express';
export declare const registerOrganization: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const verifyOrganizationOTP: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const resendOrganizationOTP: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const login: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createUser: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const listUsers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const editProfile: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const editUser: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteUser: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const forgotPassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const resetPassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Get Notifications - GET /api/users/notifications
 */
export declare const getNotifications: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=userController.d.ts.map