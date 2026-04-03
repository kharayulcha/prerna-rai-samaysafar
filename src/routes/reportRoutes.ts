import express from 'express';
import { getPaymentReport, getTripReport } from '../controller/reportController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.get('/payments', catchAsync(getPaymentReport));
router.get('/trips', catchAsync(getTripReport));

export default router;
