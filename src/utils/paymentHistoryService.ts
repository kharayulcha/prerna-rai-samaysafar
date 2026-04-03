import jwt from 'jsonwebtoken';
import type { Request } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'samaysafar_secret_key';

/**
 * Payment History Service
 * Utilities for frontend to work with payment history endpoints
 */

export interface PaymentHistoryFilter {
  status?: 'completed' | 'pending' | 'failed' | 'verification_failed';
  studentName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface FormattedPayment {
  paymentId: number;
  studentName: string;
  routeName: string;
  amount: number;
  provider: string;
  status: string;
  paidAt: string | null;
  billStatus: string;
  daysAgo: number;
}

/**
 * Extract user info from Authorization header
 * For use in frontend hooks that need to pass token-based queries
 */
export const getFrontendUserFromToken = (authHeader?: string) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: Number(payload.userId),
      role: payload.role || '',
      name: payload.name || '',
    };
  } catch {
    return null;
  }
};

/**
 * Format payment records for frontend display
 * Adds helper fields like daysAgo, formatted dates, etc.
 */
export const formatPaymentHistory = (
  payments: any[],
  filters?: PaymentHistoryFilter
): FormattedPayment[] => {
  const now = new Date();

  return payments
    .filter((p) => {
      if (filters?.status && p.bill?.Status !== filters.status) return false;
      if (filters?.studentName && !p.bill?.student?.Name?.includes(filters.studentName)) return false;
      if (filters?.minAmount && p.Amount < filters.minAmount) return false;
      if (filters?.maxAmount && p.Amount > filters.maxAmount) return false;
      return true;
    })
    .map((p) => {
      const paidAt = p.PaidAt ? new Date(p.PaidAt) : null;
      const daysAgo = paidAt ? Math.floor((now.getTime() - paidAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      return {
        paymentId: p.PaymentId,
        studentName: p.bill?.student?.Name || 'Unknown',
        routeName: p.bill?.route?.Name || 'Unknown',
        amount: p.Amount,
        provider: p.Provider || 'N/A',
        status: p.Status,
        paidAt: paidAt ? paidAt.toLocaleDateString() : null,
        billStatus: p.bill?.Status || 'unknown',
        daysAgo,
      };
    });
};

/**
 * Validate payment status for UI display
 * Returns user-friendly status message
 */
export const getPaymentStatusMessage = (
  status: string
): { color: string; label: string; icon: string } => {
  switch (status.toLowerCase()) {
    case 'completed':
      return { color: '#10b981', label: 'Completed', icon: '✓' };
    case 'pending':
      return { color: '#f59e0b', label: 'Pending', icon: '⏱' };
    case 'failed':
      return { color: '#ef4444', label: 'Failed', icon: '✕' };
    case 'verification_failed':
      return { color: '#ef4444', label: 'Verification Failed', icon: '⚠' };
    default:
      return { color: '#6b7280', label: 'Unknown', icon: '?' };
  }
};

/**
 * Calculate bill payment progress
 * Returns percentage of bill paid
 */
export const getBillPaymentProgress = (
  completedPayments: number[],
  billAmount: number
): { paid: number; remaining: number; percentage: number } => {
  const paid = completedPayments.reduce((sum, amount) => sum + amount, 0);
  const remaining = Math.max(0, billAmount - paid);
  const percentage = billAmount > 0 ? Math.round((paid / billAmount) * 100) : 0;

  return { paid, remaining, percentage };
};

/**
 * Generate payment summary for a given period
 * Returns total paid, pending, and failed amounts
 */
export const getPaymentSummary = (
  payments: any[],
  startDate?: Date,
  endDate?: Date
): {
  totalCompleted: number;
  totalPending: number;
  totalFailed: number;
  count: number;
} => {
  const filtered = payments.filter((p) => {
    if (!p.PaidAt) return p.Status !== 'completed'; // Only include non-completed in pending
    const paidDate = new Date(p.PaidAt);
    if (startDate && paidDate < startDate) return false;
    if (endDate && paidDate > endDate) return false;
    return true;
  });

  return {
    totalCompleted: filtered
      .filter((p) => p.Status === 'completed')
      .reduce((sum, p) => sum + p.Amount, 0),
    totalPending: filtered
      .filter((p) => p.Status === 'pending')
      .reduce((sum, p) => sum + p.Amount, 0),
    totalFailed: filtered
      .filter((p) => p.Status === 'failed' || p.Status === 'verification_failed')
      .reduce((sum, p) => sum + p.Amount, 0),
    count: filtered.length,
  };
};
