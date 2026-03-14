import express from 'express';
import {
    esewaFailure,
    esewaSuccess,
    generateBills,
    generateReceiptPdf,
    getAdminBills,
    getAdminRoutes,
    getAllPayments,
    getMyBills,
    getPaymentHistory,
    getPaymentStatus,
    initiatePayment,
    verifyPayment,
} from '../controller/paymentController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// Parent endpoints
router.get('/bills', catchAsync(getMyBills)); // GET /api/payments/bills
router.get('/history', catchAsync(getPaymentHistory)); // GET /api/payments/history
router.post('/initiate', catchAsync(initiatePayment)); // POST /api/payments/initiate

// eSewa callbacks
router.get('/esewa/success', catchAsync(esewaSuccess));
router.get('/esewa/failure', catchAsync(esewaFailure));
router.post('/verify', catchAsync(verifyPayment));
router.get('/status/:paymentId', catchAsync(getPaymentStatus)); // GET /api/payments/status/:paymentId

// Admin endpoints
router.get('/admin/all', catchAsync(getAllPayments));
router.get('/admin/routes', catchAsync(getAdminRoutes));
router.post('/admin/generate', catchAsync(generateBills));
router.get('/admin/bills', catchAsync(getAdminBills));
router.post('/receipt', catchAsync(generateReceiptPdf));

export default router;
