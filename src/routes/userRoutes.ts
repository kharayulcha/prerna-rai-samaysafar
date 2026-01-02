import express from 'express';
import multer from 'multer';
import {
    createUser,
    registerOrganization,
    resendOrganizationOTP,
    verifyOrganizationOTP,
    login,
    forgotPassword,
    resetPassword,
} from '../controller/userController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// Multer setup for organization logo upload (stored in memory, not as URL)
const upload = multer({ storage: multer.memoryStorage() });

// Organization registration routes
// Expect multipart/form-data with fields: name, email, phone, password, address and file: logo
router.post('/organization/register',upload.single('logo'),catchAsync(registerOrganization));// US-1
router.post('/organization/verify-otp', catchAsync(verifyOrganizationOTP));// US-2
router.post('/organization/resend-otp', catchAsync(resendOrganizationOTP));// US-2

// User creation route (by organization)
router.post('/create', catchAsync(createUser));//US-3
// Login route (for all user types)
router.post('/login', catchAsync(login)); //US-4

// Password reset routes
router.post('/forgot-password', catchAsync(forgotPassword));// US-5
router.post('/reset-password', catchAsync(resetPassword)); // US-5


export default router;