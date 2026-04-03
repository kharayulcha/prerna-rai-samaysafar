import express from 'express';
import multer from 'multer';
import path from 'path';

import {
    createUser,
    deleteNotification,
    deleteUser,
    editProfile,
    editUser,
    forgotPassword,
    getNotifications,
    getProfile,
    listUsers,
    login,
    markNotificationRead,
    registerOrganization,
    resendOrganizationOTP,
    resetPassword,
    sendNotice,
    verifyOrganizationOTP
} from '../controller/userController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// Multer setup for disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });


// Organization registration routes
// Expect multipart/form-data with fields: name, email, phone, password, address and file: logo
router.post('/organization/register', upload.single('logo'), catchAsync(registerOrganization));// US-1 registration code 
router.post('/organization/verify-otp', catchAsync(verifyOrganizationOTP));// US-2 verify otp
router.post('/organization/resend-otp', catchAsync(resendOrganizationOTP));// US-2 resend otp

// User creation route (by organization)
// code for create route
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
router.get('/profile', catchAsync(getProfile));
// Admin User Management
router.put('/:id', catchAsync(editUser));
router.delete('/:id', catchAsync(deleteUser));

// Notification routes
router.get('/notifications', catchAsync(getNotifications));
router.patch('/notifications/:notificationId/read', catchAsync(markNotificationRead));
router.post('/send-notice', catchAsync(sendNotice));
router.delete('/notifications/:notificationId', catchAsync(deleteNotification));

export default router;