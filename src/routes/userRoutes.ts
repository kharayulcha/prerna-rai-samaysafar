import express from 'express';
import multer from 'multer';
import {
    createUser,
    deleteUser,
    editProfile,
    editUser,
    forgotPassword,
    getNotifications,
    listUsers,
    login,
    registerOrganization,
    resendOrganizationOTP,
    resetPassword,
    verifyOrganizationOTP
} from '../controller/userController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// Multer setup for organization logo upload (stored in memory, not as URL)
const upload = multer({ storage: multer.memoryStorage() });

// Organization registration routes
// Expect multipart/form-data with fields: name, email, phone, password, address and file: logo
router.post('/organization/register', upload.single('logo'), catchAsync(registerOrganization));// US-1 registration code 
router.post('/organization/verify-otp', catchAsync(verifyOrganizationOTP));// US-2 verify otp
router.post('/organization/resend-otp', catchAsync(resendOrganizationOTP));// US-2 resend otp

// User creation route (by organization)
router.post('/create', catchAsync(createUser));//US-3
// List users route
router.get('/list', catchAsync(listUsers));

// Login route (for all user types)
router.post('/login', catchAsync(login)); //US-4 login code

// Password reset routes
router.post('/forgot-password', catchAsync(forgotPassword));// US-5
router.post('/reset-password', catchAsync(resetPassword)); // US-5

// Edit profile route (authenticated user) - accepts multipart/form-data with optional file: profileImage
router.put('/edit-profile', upload.single('profileImage'), catchAsync(editProfile)); // US-6

export default router;