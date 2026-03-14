import express from 'express';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// Dynamically import controller to avoid static ESM resolution issues during TS checks
(async () => {
    // @ts-ignore
    const ctrl = await import('../controller/paymentController.js');

    // Parent endpoints
    router.get('/bills', catchAsync(ctrl.getMyBills)); // GET /api/payments/bills
    router.get('/history', catchAsync(ctrl.getPaymentHistory)); // GET /api/payments/history
    router.post('/initiate', catchAsync(ctrl.initiatePayment)); // POST /api/payments/initiate

    // eSewa callbacks
    router.get('/esewa/success', catchAsync(ctrl.esewaSuccess));
    router.get('/esewa/failure', catchAsync(ctrl.esewaFailure));
    router.post('/verify', catchAsync(ctrl.verifyPayment));

    // Admin endpoints
    router.get('/admin/all', catchAsync(ctrl.getAllPayments));
    router.get('/admin/routes', catchAsync(ctrl.getAdminRoutes));
    router.post('/admin/generate', catchAsync(ctrl.generateBills));
    router.get('/admin/bills', catchAsync(ctrl.getAdminBills));
    router.post('/receipt', catchAsync(ctrl.generateReceiptPdf));
})();

export default router;
