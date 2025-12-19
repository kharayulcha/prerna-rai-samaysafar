import express from 'express';
import { createUser, login, registerOrganization, resendOrganizationOTP, verifyOrganizationOTP, } from '../controller/userController.js';
import catchAsync from '../utils/catchAsync.js';
const router = express.Router();
// Organization registration routes
router.post('/organization/register', catchAsync(registerOrganization));
router.post('/organization/verify-otp', catchAsync(verifyOrganizationOTP));
router.post('/organization/resend-otp', catchAsync(resendOrganizationOTP));
// User creation route (by organization)
router.post('/create', catchAsync(createUser));
// Login route (for all user types)
router.post('/login', catchAsync(login));
export default router;
//# sourceMappingURL=userRoutes.js.map