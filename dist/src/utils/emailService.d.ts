export declare const sendOTPEmail: (email: string, otpCode: string, fullName: string) => Promise<void>;
export declare const sendUserCredentialsEmail: (email: string, password: string, fullName: string, orgName: string, role: string) => Promise<void>;
export declare const sendPasswordResetOTPEmail: (email: string, otpCode: string, fullName: string) => Promise<void>;
export declare const generateOTP: () => string;
//# sourceMappingURL=emailService.d.ts.map