import type { Request, Response } from 'express';
/**
 * Organization Registration
 * Organization registers with name, email, phone, password
 * Gets OTP code via email
 * Address will be collected during OTP verification
 */
export declare const registerOrganization: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Resend OTP for Organization Registration
 */
export declare const resendOrganizationOTP: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Verify OTP for Organization Registration
 * After verification, organization is created in the database
 */
export declare const verifyOrganizationOTP: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Create User (Parent, Student, or Driver) by Organization
 * Only organizations can create users
 */
export declare const createUser: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Login for all user types (Organization, Parent, Student, Driver)
 */
export declare const login: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=userController.d.ts.map