// Re-triggering server restart to load new prisma client
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import prisma from '../model/index.js';
import { info, error as logError } from '../utils/logger.js';
import { io } from '../app.js';

applyPlugin(jsPDF);

const JWT_SECRET = process.env.JWT_SECRET || 'samaysafar_secret_key';

// eSewa configuration
const ESEWA_CONFIG = {
    merchantId: process.env.ESEWA_MERCHANT_ID || 'EPAYTEST',
    merchantSecret: process.env.ESEWA_MERCHANT_SECRET || '8gBm/:&EnhH.1/q',
    // Test environment URLs
    paymentUrl: process.env.ESEWA_PAYMENT_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
    verifyUrl: process.env.ESEWA_VERIFY_URL || 'https://rc.esewa.com.np/mobile/transaction',
};

// Khalti configuration
const KHALTI_CONFIG = {
    secretKey: process.env.KHALTI_SECRET_KEY || 'test_secret_key',
    baseUrl: process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2',
};


// Helper to get user from token
const getUserFromToken = (req: Request): { userId: number; role: string } | null => {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        return { userId: Number(payload.userId), role: payload.role || '' };
    } catch {
        return null;
    }
};

/**
 * GET /api/payments/bills
 * Get all pending bills for the logged-in parent
 */
export const getMyBills = async (req: Request, res: Response) => {
    try {
        const user = getUserFromToken(req);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const bills = await prisma.bill.findMany({
            where: {
                ParentId: user.userId,
                Status: { in: ['pending', 'overdue', 'partial'] },
            },
            include: {
                student: { select: { UserId: true, Name: true } },
                route: { select: { Name: true } },
                payments: true,
            },
            orderBy: { DueDate: 'asc' },
        });

        return res.status(200).json({ bills });
    } catch (error: any) {
        logError('Error fetching bills:', error.message, error.stack);
        return res.status(500).json({ message: 'Error fetching bills', error: error.message, stack: error.stack });
    }
};

/**
 * GET /api/payments/history
 * Get payment history for the logged-in user
 */
export const getPaymentHistory = async (req: Request, res: Response) => {
    try {
        const user = getUserFromToken(req);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const payments = await prisma.payment.findMany({
            where: { ParentId: user.userId },
            include: {
                bill: {
                    include: {
                        student: { select: { Name: true } },
                        route: { select: { Name: true } },
                    },
                },
            },
            orderBy: { PaymentId: 'desc' },
        });

        return res.status(200).json({ payments });
    } catch (error: any) {
        logError('Error fetching payment history:', error);
        return res.status(500).json({ message: 'Error fetching payment history', error: error.message });
    }
};

/**
 * POST /api/payments/initiate
 * Create a payment record and return payment parameters (eSewa or Khalti)
 * Body: { billId: number, provider: 'esewa' | 'khalti' }
 */
export const initiatePayment = async (req: Request, res: Response) => {
    try {
        const user = getUserFromToken(req);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const { billId, provider = 'esewa' } = req.body as any;
        if (!billId) return res.status(400).json({ message: 'Missing billId' });

        // Fetch the bill
        const bill = await prisma.bill.findFirst({
            where: { BillId: Number(billId), ParentId: user.userId },
            include: { 
                student: { select: { Name: true } },
                parent: { select: { Name: true, Email: true, Phone: true } }
            },
        });

        if (!bill) return res.status(404).json({ message: 'Bill not found' });
        if (bill.Status === 'paid') return res.status(400).json({ message: 'Bill already paid' });

        // Calculate remaining amount (subtract any partial payments)
        const existingPayments = await prisma.payment.aggregate({
            where: { BillId: bill.BillId, Status: 'completed' },
            _sum: { Amount: true },
        });
        const paidSoFar = existingPayments._sum.Amount || 0;
        const remainingAmount = bill.Amount - paidSoFar;

        if (remainingAmount <= 0) {
            return res.status(400).json({ message: 'Bill already fully paid' });
        }

        // Create a pending payment record
        const payment = await prisma.payment.create({
            data: {
                BillId: bill.BillId,
                ParentId: user.userId,
                Amount: remainingAmount,
                Provider: provider,
                Status: 'pending',
                TransactionId: `SS-${bill.BillId}-${Date.now()}`,
            },
        });

        if (provider === 'khalti') {
            const backendUrl = `${req.protocol}://${req.get('host')}`;
            const returnUrl = `${backendUrl}/api/payments/khalti/callback`;
            const websiteUrl = req.get('origin') || `http://192.168.1.69:8081`;


            const khaltiPayload = {
                return_url: returnUrl,
                website_url: websiteUrl,
                amount: Math.round(remainingAmount * 100), // convert to paisa
                purchase_order_id: payment.TransactionId,
                purchase_order_name: `School Bus Fee - ${bill.student?.Name}`,
                customer_info: {
                    name: bill.parent?.Name || 'Parent',
                    email: bill.parent?.Email || 'parent@example.com',
                    phone: bill.parent?.Phone || '9800000000',
                },
            };

            const response = await fetch(`${KHALTI_CONFIG.baseUrl}/epayment/initiate/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Key ${KHALTI_CONFIG.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(khaltiPayload),
            });

            if (!response.ok) {
                const errData = await response.json() as any;
                throw new Error(errData.detail || 'Khalti initiation failed');
            }

            const khaltiData = await response.json() as any;

            return res.status(200).json({
                message: 'Khalti payment initiated',
                payment,
                khaltiConfig: {
                    paymentUrl: khaltiData.payment_url,
                    pidx: khaltiData.pidx,
                },
            });
        }


        // Generate eSewa payment parameters
        // product_id is our unique transaction identifier
        const productId = payment.TransactionId!;
        const amount = remainingAmount;
        const taxAmount = 0;
        const serviceCharge = 0;
        const deliveryCharge = 0;
        const totalAmount = amount + taxAmount + serviceCharge + deliveryCharge;

        // The success/failure URLs that eSewa will redirect to
        const backendUrl = `${req.protocol}://${req.get('host')}`;
        const successUrl = `${backendUrl}/api/payments/esewa/success`;
        const failureUrl = `${backendUrl}/api/payments/esewa/failure`;


        const esewaParams = {
            amount: amount.toString(),
            tax_amount: taxAmount.toString(),
            total_amount: totalAmount.toString(),
            transaction_uuid: productId,
            product_code: ESEWA_CONFIG.merchantId,
            product_service_charge: serviceCharge.toString(),
            product_delivery_charge: deliveryCharge.toString(),
            success_url: successUrl,
            failure_url: failureUrl,
            signed_field_names: 'total_amount,transaction_uuid,product_code',
        };

        // Generate HMAC signature for eSewa
        const crypto = await import('crypto');
        const signedMessage = `total_amount=${totalAmount},transaction_uuid=${productId},product_code=${ESEWA_CONFIG.merchantId}`;
        const signature = crypto
            .createHmac('sha256', ESEWA_CONFIG.merchantSecret)
            .update(signedMessage)
            .digest('base64');

        return res.status(200).json({
            message: 'Payment initiated',
            payment,
            esewaConfig: {
                paymentUrl: ESEWA_CONFIG.paymentUrl,
                params: {
                    ...esewaParams,
                    signature,
                },
            },
        });
    } catch (error: any) {
        logError('Error initiating payment:', error);
        return res.status(500).json({ message: 'Error initiating payment', error: error.message });
    }
};

/**
 * GET /api/payments/esewa/success
 * eSewa redirects here after successful payment
 */
export const esewaSuccess = async (req: Request, res: Response) => {
    try {
        const { data } = req.query as any;

        if (!data) {
            return res.send(generateRedirectHtml('error', 'No payment data received'));
        }

        // Decode base64 eSewa response
        let decodedData: any;
        try {
            decodedData = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));
        } catch {
            return res.send(generateRedirectHtml('error', 'Invalid payment data'));
        }

        info('eSewa success callback data:', decodedData);

        const transactionUuid = decodedData.transaction_uuid;
        const esewaRefId = decodedData.transaction_code;
        const totalAmount = parseFloat(decodedData.total_amount);
        const status = decodedData.status;

        if (status !== 'COMPLETE') {
            return res.send(generateRedirectHtml('error', 'Payment not completed'));
        }

        // Find the payment record
        const payment = await prisma.payment.findFirst({
            where: { TransactionId: transactionUuid },
        });

        if (!payment) {
            return res.send(generateRedirectHtml('error', 'Payment record not found'));
        }

        // Verify with eSewa API
        const verified = await verifyEsewaPayment(transactionUuid, totalAmount);

        if (verified) {
            // Update payment record
            await prisma.payment.update({
                where: { PaymentId: payment.PaymentId },
                data: {
                    Status: 'completed',
                    RefId: esewaRefId,
                    PaidAt: new Date(),
                },
            });

            // Check if bill is fully paid
            const allPayments = await prisma.payment.aggregate({
                where: { BillId: payment.BillId, Status: 'completed' },
                _sum: { Amount: true },
            });

            const bill = await prisma.bill.findUnique({
                where: { BillId: payment.BillId },
            });

            if (bill && (allPayments._sum.Amount || 0) >= bill.Amount) {
                await prisma.bill.update({
                    where: { BillId: payment.BillId },
                    data: { Status: 'paid' },
                });
            }

            // Create a notification record for the parent
            const billWithStudent = await prisma.bill.findUnique({
                where: { BillId: payment.BillId },
                include: { student: { select: { Name: true } } }
            });

            await prisma.notification.create({
                data: {
                    UserId: payment.ParentId,
                    Type: 'payment_success',
                    Message: `Payment of Rs. ${payment.Amount} for ${billWithStudent?.student?.Name || 'your child'} was successful!`,
                }
            });

            // Emit real-time notification
            io.to(`user-${payment.ParentId}`).emit('notification', {
                type: 'payment_success',
                message: `Payment of Rs. ${payment.Amount} for ${billWithStudent?.student?.Name || 'your child'} was successful!`,
            });


            return res.send(generateRedirectHtml('success', 'Payment successful!', payment.PaymentId));

        } else {
            await prisma.payment.update({
                where: { PaymentId: payment.PaymentId },
                data: { Status: 'verification_failed' },
            });
            return res.send(generateRedirectHtml('error', 'Payment verification failed'));
        }
    } catch (error: any) {
        logError('eSewa success callback error:', error);
        return res.send(generateRedirectHtml('error', 'Server error processing payment'));
    }
};

/**
 * GET /api/payments/khalti/callback
 * Khalti redirects here after payment attempt
 */
export const khaltiCallback = async (req: Request, res: Response) => {
    try {
        const { pidx, status, amount, purchase_order_id, transaction_id } = req.query as any;

        if (!pidx || status !== 'Completed') {
            return res.send(generateRedirectHtml('failed', 'Payment was not completed'));
        }

        // Find the payment record
        const payment = await prisma.payment.findFirst({
            where: { TransactionId: purchase_order_id },
        });

        if (!payment) {
            return res.send(generateRedirectHtml('error', 'Payment record not found'));
        }

        // Verify with Khalti API
        const verified = await verifyKhaltiPayment(pidx);

        if (verified) {
            // Update payment record
            await prisma.payment.update({
                where: { PaymentId: payment.PaymentId },
                data: {
                    Status: 'completed',
                    RefId: transaction_id || pidx,
                    PaidAt: new Date(),
                },
            });

            // Check if bill is fully paid
            const allPayments = await prisma.payment.aggregate({
                where: { BillId: payment.BillId, Status: 'completed' },
                _sum: { Amount: true },
            });

            const bill = await prisma.bill.findUnique({
                where: { BillId: payment.BillId },
            });

            if (bill && (allPayments._sum.Amount || 0) >= bill.Amount) {
                await prisma.bill.update({
                    where: { BillId: payment.BillId },
                    data: { Status: 'paid' },
                });
            }

            // Create a notification record for the parent
            const billWithStudent = await prisma.bill.findUnique({
                where: { BillId: payment.BillId },
                include: { student: { select: { Name: true } } }
            });

            await prisma.notification.create({
                data: {
                    UserId: payment.ParentId,
                    Type: 'payment_success',
                    Message: `Payment of Rs. ${payment.Amount} for ${billWithStudent?.student?.Name || 'your child'} was successful!`,
                }
            });

            // Emit real-time notification
            io.to(`user-${payment.ParentId}`).emit('notification', {
                type: 'payment_success',
                message: `Payment of Rs. ${payment.Amount} for ${billWithStudent?.student?.Name || 'your child'} was successful!`,
            });


            return res.send(generateRedirectHtml('success', 'Payment successful!', payment.PaymentId));

        } else {
            await prisma.payment.update({
                where: { PaymentId: payment.PaymentId },
                data: { Status: 'verification_failed' },
            });
            return res.send(generateRedirectHtml('error', 'Payment verification failed'));
        }
    } catch (error: any) {
        logError('Khalti callback error:', error);
        return res.send(generateRedirectHtml('error', 'Server error processing payment'));
    }
};

/**
 * GET /api/payments/esewa/failure
 * eSewa redirects here when payment fails or is cancelled
 */
export const esewaFailure = async (req: Request, res: Response) => {
    try {
        info('eSewa failure callback:', req.query);
        return res.send(generateRedirectHtml('failed', 'Payment was cancelled or failed'));
    } catch (error: any) {
        logError('eSewa failure callback error:', error);
        return res.send(generateRedirectHtml('error', 'Server error'));
    }
};


/**
 * POST /api/payments/verify
 * Manual verification endpoint for the mobile app
 * Body: { paymentId: number }
 */
export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const user = getUserFromToken(req);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const { paymentId } = req.body as any;

        const payment = await prisma.payment.findFirst({
            where: { PaymentId: Number(paymentId), ParentId: user.userId },
            include: {
                bill: {
                    include: {
                        student: { select: { Name: true } },
                    },
                },
            },
        });

        if (!payment) return res.status(404).json({ message: 'Payment not found' });

        return res.status(200).json({ payment });
    } catch (error: any) {
        logError('Error verifying payment:', error);
        return res.status(500).json({ message: 'Error verifying payment', error: error.message });
    }
};

/**
 * GET /api/payments/status/:paymentId
 * Check payment status (for polling after eSewa redirect)
 * Parent can check their own payment status
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
    try {
        const user = getUserFromToken(req);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const { paymentId } = req.params as any;
        const payment = await prisma.payment.findFirst({
            where: { PaymentId: Number(paymentId), ParentId: user.userId },
            include: {
                bill: {
                    include: {
                        student: { select: { UserId: true, Name: true } },
                        route: { select: { RouteId: true, Name: true } },
                    },
                },
            },
        });

        if (!payment) return res.status(404).json({ message: 'Payment not found' });

        return res.status(200).json({
            paymentId: payment.PaymentId,
            status: payment.Status,
            amount: payment.Amount,
            provider: payment.Provider,
            paidAt: payment.PaidAt,
            bill: payment.bill ? {
                billId: payment.bill.BillId,
                studentName: payment.bill.student?.Name,
                routeName: payment.bill.route?.Name,
                totalAmount: payment.bill.Amount,
                billStatus: payment.bill.Status,
            } : null,
        });
    } catch (error: any) {
        logError('Error checking payment status:', error);
        return res.status(500).json({ message: 'Error checking payment status', error: error.message });
    }
};

/**
 * GET /api/payments/admin/all
 * Admin: Get all payments for the organization
 */
export const getAllPayments = async (req: Request, res: Response) => {
    try {
        const user = getUserFromToken(req);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        // Get the admin's orgId
        const adminUser = await prisma.users.findUnique({
            where: { UserId: user.userId },
        });

        if (!adminUser || !adminUser.OrgId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const payments = await prisma.payment.findMany({
            where: {
                bill: { OrgId: adminUser.OrgId },
            },
            include: {
                bill: {
                    include: {
                        student: { select: { Name: true } },
                        route: { select: { Name: true } },
                    },
                },
                parent: { select: { Name: true, Phone: true } },
            },
            orderBy: { PaymentId: 'desc' },
        });

        return res.status(200).json({ payments });
    } catch (error: any) {
        logError('Error fetching all payments:', error.message, error.stack);
        return res.status(500).json({ message: 'Error fetching all payments', error: error.message, stack: error.stack });
    }
};

// ═══════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════

// Helper: get admin's OrgId
async function getAdminOrgId(userId: number): Promise<number | null> {
    const adminUser = await prisma.users.findUnique({ where: { UserId: userId } });
    return adminUser?.OrgId ?? null;
}

/**
 * GET /api/payments/admin/routes
 * Admin: Get routes with student counts for the organization
 */
export const getAdminRoutes = async (req: Request, res: Response) => {
    try {
        const user = getUserFromToken(req);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const orgId = await getAdminOrgId(user.userId);
        if (!orgId) return res.status(403).json({ message: 'Not authorized' });
        logError(`[PAYMENT] Fetching routes for OrgId: ${orgId}`);

        const routes = await prisma.route.findMany({
            where: { OrgId: orgId },
            include: {
                students: {
                    where: { Role: 'student' },
                    select: {
                        UserId: true,
                        Name: true,
                        ParentId: true,
                        parent: { select: { UserId: true, Name: true, Phone: true } },
                    },
                },
                bills: {
                    select: { BillId: true, Status: true, Amount: true }
                },
                stops: true,
                _count: {
                    select: { students: true }
                },
            },
            orderBy: { Name: 'asc' },
        });

        return res.status(200).json({ routes });
    } catch (error: any) {
        logError('Error fetching admin routes FULL ERROR:', error);
        return res.status(500).json({ 
            message: 'Error fetching admin routes', 
            error: error.message,
            stack: error.stack 
        });
    }
};

/**
 * POST /api/payments/admin/generate-bills
 * Admin: Generate bills for students on a route
 * Body: { routeId: number, amount: number, periodStart: string, periodEnd: string, dueDate: string }
 */
export const generateBills = async (req: Request, res: Response) => {
    try {
        const user = getUserFromToken(req);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const orgId = await getAdminOrgId(user.userId);
        if (!orgId) return res.status(403).json({ message: 'Not authorized' });

        const { routeId, amount, periodStart, periodEnd, dueDate } = req.body as any;

        if (!routeId || !amount || !periodStart || !periodEnd || !dueDate) {
            return res.status(400).json({ message: 'Missing required fields: routeId, amount, periodStart, periodEnd, dueDate' });
        }

        // Get all students on this route that have a parent
        const students = await prisma.users.findMany({
            where: {
                RouteId: Number(routeId),
                Role: 'student',
                ParentId: { not: null },
                organization: { OrgId: orgId },
            },
            select: { UserId: true, Name: true, ParentId: true },
        });

        if (students.length === 0) {
            return res.status(400).json({ message: 'No students found on this route with assigned parents' });
        }

        // Check for duplicate bills (same route, same period)
        const existingBills = await prisma.bill.findMany({
            where: {
                RouteId: Number(routeId),
                OrgId: orgId,
                PeriodStart: new Date(periodStart),
                PeriodEnd: new Date(periodEnd),
            },
            select: { StudentId: true },
        });
        const alreadyBilledIds = new Set(existingBills.map(b => b.StudentId));

        const newStudents = students.filter(s => !alreadyBilledIds.has(s.UserId));

        if (newStudents.length === 0) {
            return res.status(400).json({ message: 'Bills already generated for all students on this route for this period' });
        }

        // Create bills
        const billData = newStudents.map(student => ({
            OrgId: orgId,
            StudentId: student.UserId,
            ParentId: student.ParentId!,
            Amount: Number(amount),
            PeriodStart: new Date(periodStart),
            PeriodEnd: new Date(periodEnd),
            DueDate: new Date(dueDate),
            Status: 'pending',
            RouteId: Number(routeId),
        }));

        const result = await prisma.bill.createMany({ data: billData });

        // Add notifications for all parents
        const uniqueParents = [...new Set(newStudents.map(s => s.ParentId!))];
        for (const parentId of uniqueParents) {
            // Group students per parent for a single notification if possible
            const parentStudents = newStudents.filter(s => s.ParentId === parentId);
            const studentNames = parentStudents.map(s => s.Name).join(", ");
            
            await prisma.notification.create({
                data: {
                    UserId: parentId,
                    Type: 'bill_generated',
                    Message: `A new bill of Rs. ${amount} has been generated for ${studentNames}`,
                }
            });

            // Emit real-time notification
            io.to(`user-${parentId}`).emit('notification', {
              type: 'bill_generated',
              message: `A new bill of Rs. ${amount} has been generated for ${studentNames}`,
            });
        }


        return res.status(201).json({

            message: 'The bill is generated successfully',
            count: result.count,
            skipped: alreadyBilledIds.size,
        });
    } catch (error: any) {
        logError('Error generating bills:', error);
        return res.status(500).json({ message: 'Error generating bills', error: error.message });
    }
};

/**
 * GET /api/payments/admin/bills
 * Admin: Get all bills for the organization, optional filter by routeId
 */
export const getAdminBills = async (req: Request, res: Response) => {
    try {
        const user = getUserFromToken(req);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const orgId = await getAdminOrgId(user.userId);
        if (!orgId) return res.status(403).json({ message: 'Not authorized' });

        const { routeId, status } = req.query as any;

        const where: any = { OrgId: orgId };
        if (routeId) where.RouteId = Number(routeId);
        if (status) where.Status = status;

        const bills = await prisma.bill.findMany({
            where,
            include: {
                student: { select: { Name: true } },
                parent: { select: { Name: true, Phone: true } },
                route: { select: { Name: true } },
                payments: {
                    select: { PaymentId: true, Amount: true, Status: true, PaidAt: true, Provider: true },
                },
            },
            orderBy: { GeneratedAt: 'desc' },
        });

        return res.status(200).json({ bills });
    } catch (error: any) {
        logError('Error fetching admin bills:', error);
        return res.status(500).json({ message: 'Error fetching admin bills', error: error.message });
    }
};


// Correct eSewa v2 verification endpoint and parameters
async function verifyEsewaPayment(transactionUuid: string, amount: number): Promise<boolean> {
    try {
        const url = `https://rc-epay.esewa.com.np/api/epay/transaction/status/?product_code=${ESEWA_CONFIG.merchantId}&total_amount=${amount}&transaction_uuid=${transactionUuid}`;
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) return false;
        const data = await response.json() as any;
        // Check for status COMPLETE and matching transaction_uuid and amount
        return data.status === 'COMPLETE' && data.transaction_uuid === transactionUuid && Number(data.total_amount) === Number(amount);
    } catch (error) {
        logError('eSewa verification error:', error);
        return false;
    }
}

// Khalti verification (Lookup)
async function verifyKhaltiPayment(pidx: string): Promise<boolean> {
    try {
        const response = await fetch(`${KHALTI_CONFIG.baseUrl}/epayment/lookup/`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${KHALTI_CONFIG.secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pidx }),
        });

        if (!response.ok) return false;
        const data = await response.json() as any;
        return data.status === 'Completed';
    } catch (error) {
        logError('Khalti verification error:', error);
        return false;
    }
}


function generateRedirectHtml(status: string, message: string, paymentId?: number): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Payment ${status === 'success' ? 'Successful' : 'Failed'}</title>
    <style>
        body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
        .card { text-align: center; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 320px; }
        .icon { font-size: 48px; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: bold; color: #333; margin-bottom: 8px; }
        .msg { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">${status === 'success' ? '✅' : '❌'}</div>
        <div class="title">${status === 'success' ? 'Payment Successful!' : 'Payment Failed'}</div>
        <div class="msg">${message}</div>
    </div>
    <script>
        // Send message to React Native WebView
        setTimeout(function() {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    status: '${status}',
                    message: '${message}',
                    paymentId: ${paymentId || 'null'}
                }));
            }
        }, 1500);
    </script>
</body>
</html>`;
}

/**
 * GET /api/payments/receipt/:paymentId
 * Generates a PDF receipt for a completed payment
 */
export const generateReceiptPdf = async (req: Request, res: Response) => {
    try {
        const user = getUserFromToken(req);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const { paymentId } = req.params;
        info(`[PDF] Generating receipt for payment ID: ${paymentId}`);

        const payment = await prisma.payment.findUnique({
            where: { PaymentId: Number(paymentId) },
            include: {
                parent: { select: { Name: true, Email: true, Phone: true } },
                bill: {
                    include: {
                        student: { select: { Name: true } },
                        route: { select: { Name: true } },
                        organization: { select: { Name: true, Address: true, Phone: true } }
                    }
                }
            }
        });

        info(`[PDF] Payment found:`, payment ? 'Yes' : 'No');
        if (!payment) return res.status(404).json({ message: 'Payment not found' });
        
        // Ensure user is the parent or an admin of the org
        if (payment.ParentId !== user.userId && user.role.toLowerCase() !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to view this receipt' });
        }

        if (payment.Status !== 'completed') {
            return res.status(400).json({ message: 'Receipt is only available for completed payments' });
        }

        // Validate required nested data
        info(`[PDF] Validating data structure...`);
        if (!payment.bill) return res.status(500).json({ message: 'Bill data not found for this payment' });
        if (!payment.parent) return res.status(500).json({ message: 'Parent data not found for this payment' });
        if (!payment.bill.student) return res.status(500).json({ message: 'Student data not found' });
        if (!payment.bill.organization) return res.status(500).json({ message: 'Organization data not found' });

        info(`[PDF] Data valid, creating PDF document...`);
        
        // Create PDF
        const doc = new jsPDF();
        const org = payment.bill.organization;

        info(`[PDF] Adding header with org name: ${org?.Name}`);
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(59, 130, 246); // Primary Blue
        doc.text(org?.Name || 'SamaySafar', 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(org?.Address || 'Nepal', 105, 28, { align: 'center' });
        doc.text(`Contact: ${org?.Phone || 'N/A'}`, 105, 33, { align: 'center' });

        doc.setDrawColor(200);
        doc.line(20, 40, 190, 40);

        // Bill Title
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('PAYMENT RECEIPT', 20, 55);
        
        doc.setFontSize(10);
        doc.text(`Receipt No: REC-${payment.PaymentId}`, 150, 55);
        doc.text(`Date: ${payment.PaidAt?.toLocaleDateString() || new Date().toLocaleDateString()}`, 150, 60);

        // Details Grid
        const detailsData = [
            ['Student Name', payment.bill.student?.Name || 'N/A'],
            ['Route', payment.bill.route?.Name || 'N/A'],
            ['Parent Name', payment.parent?.Name || 'N/A'],
            ['Transaction ID', payment.RefId || payment.TransactionId || 'N/A'],
            ['Payment Method', payment.Provider || 'N/A']
        ];

        info(`[PDF] Adding table with details...`);
        (doc as any).autoTable({
            startY: 70,
            head: [['Description', 'Details']],
            body: detailsData,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] }
        });

        // Amount Section
        const finalY = ((doc as any).lastAutoTable?.finalY ?? 120) + 10;
        doc.setFontSize(14);
        doc.text(`Paid Amount: NPR ${payment.Amount.toLocaleString()}`, 190, finalY, { align: 'right' });
        
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('This is a computer generated receipt.', 105, 280, { align: 'center' });

        info(`[PDF] Converting to buffer...`);
        
        // Output as Buffer
        const pdfOutput = doc.output('arraybuffer');
        const buffer = Buffer.from(pdfOutput);

        info(`[PDF] PDF generated successfully, size: ${buffer.length} bytes`);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment.PaymentId}.pdf`);
        return res.send(buffer);

    } catch (error: any) {
        logError('[PDF] ERROR generating PDF:', error.message);
        logError('[PDF] Stack:', error.stack);
        logError('[PDF] Full error:', error);
        return res.status(500).json({ 
            message: 'Error generating PDF receipt', 
            error: error.message,
            details: error.stack 
        });
    }
};
