import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { readApiError, gatewayUrl } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import {
    formatCents,
    formatPaymentMethod,
    formatRemainingTime,
    paymentExpiryMs,
    paymentReference,
    type PaymentIntent,
} from '../utils/payment';
import PageToast from '../../../components/PageToast';

const toErrorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : 'Unknown error';

const PaymentDetailPage: React.FC = () => {
    const { paymentId } = useParams<{ paymentId: string }>();
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const navigate = useNavigate();
    const [payment, setPayment] = useState<PaymentIntent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [remainingMs, setRemainingMs] = useState<number | null>(null);
    const syncInFlightRef = useRef(false);

    const fetchPayment = useCallback(async (silent = false) => {
        if (!user || !paymentId) {
            return;
        }
        if (!silent) {
            setLoading(true);
        }
        setError(null);
        try {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/wallet/${user.id}/payments/${paymentId}`)
            );
            if (!response.ok) {
                setError(await readApiError(response, 'Payment lookup failed'));
                return;
            }
            const data = await response.json() as PaymentIntent;
            setPayment(data);
            setRemainingMs(paymentExpiryMs(data) - Date.now());
        } catch (err: unknown) {
            setError(`Payment lookup failed: ${toErrorMessage(err)}`);
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [authenticatedFetch, paymentId, user]);

    const syncPayment = useCallback(async () => {
        if (!payment || payment.status !== 'PENDING') {
            return;
        }
        if (syncInFlightRef.current) {
            return;
        }
        syncInFlightRef.current = true;
        try {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/wallet/midtrans/payments/${payment.paymentId}/sync`),
                { method: 'POST' }
            );
            if (!response.ok) {
                return;
            }
            const data = await response.json() as PaymentIntent;
            setPayment(data);
            if (data.status !== 'PENDING') {
                navigate('/wallet', { replace: true });
                return;
            }
        } catch {
            // Keep the payment instruction visible; the next polling tick can retry.
        } finally {
            syncInFlightRef.current = false;
        }
    }, [authenticatedFetch, navigate, payment]);

    useEffect(() => {
        void fetchPayment();
    }, [fetchPayment]);

    useEffect(() => {
        if (!payment) {
            return;
        }

        const tick = () => setRemainingMs(paymentExpiryMs(payment) - Date.now());
        tick();
        const interval = globalThis.setInterval(tick, 1000);
        return () => globalThis.clearInterval(interval);
    }, [payment]);

    useEffect(() => {
        if (!payment || payment.status !== 'PENDING') {
            return;
        }

        const interval = globalThis.setInterval(() => void syncPayment(), 8_000);
        const refresh = () => void syncPayment();
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);

        return () => {
            globalThis.clearInterval(interval);
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [payment, syncPayment]);

    const statusLabel = payment?.status ?? 'PENDING';
    const displayedRemainingMs = remainingMs ?? (payment ? paymentExpiryMs(payment) - Date.now() : 10 * 60 * 1000);
    const displayStatus = statusLabel === 'EXPIRED' && displayedRemainingMs > 0 ? 'PENDING' : statusLabel;
    const expired = displayStatus === 'EXPIRED' || (payment?.status === 'PENDING' && displayedRemainingMs <= 0);
    const paymentCode = payment?.vaNumber ?? payment?.paymentId ?? '';
    const readableMethod = useMemo(
        () => formatPaymentMethod(payment?.paymentChannel),
        [payment?.paymentChannel]
    );

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="page-wrap payment-detail-page">
            <section className="page-head">
                <BackButton fallback="/wallet" />
                <p className="eyebrow">Checkout</p>
                <h1>Payment Details</h1>
                <p>Review your payment instruction and complete the transfer before it expires.</p>
            </section>

            <PageToast error={error} />

            {loading ? (
                <div className="panel section-stack" aria-busy="true" aria-label="Loading payment">
                    <span className="skeleton-line skeleton-line-short" />
                    <span className="skeleton-line skeleton-line-large" />
                    <span className="skeleton-button" />
                </div>
            ) : payment ? (
                <section className="payment-checkout-grid">
                    <div className="payment-waiting-card payment-checkout-card">
                        <div className="payment-waiting-header">
                            <span className="material-symbols-outlined" aria-hidden="true">
                                account_balance
                            </span>
                            <div>
                                <strong>{expired ? 'Payment Expired' : 'Waiting for Payment'}</strong>
                                <span>
                                    {expired
                                        ? 'This payment can no longer be completed.'
                                        : 'Complete the transfer using the payment code below.'}
                                </span>
                            </div>
                            <span className={`payment-status payment-status-${displayStatus.toLowerCase()}`}>
                                {expired ? 'EXPIRED' : displayStatus}
                            </span>
                        </div>

                        {!expired && (
                            <div className="payment-countdown">
                                <span>Expires in</span>
                                <strong>{formatRemainingTime(displayedRemainingMs)}</strong>
                            </div>
                        )}

                        <div className="payment-code-box">
                            <span>Payment Code</span>
                            <strong>{paymentCode}</strong>
                        </div>

                        <div className="payment-detail-grid">
                            <div>
                                <span>Payment Ref</span>
                                <strong>{paymentReference(payment.paymentId)}</strong>
                            </div>
                            <div>
                                <span>Amount</span>
                                <strong>{formatCents(payment.amount)}</strong>
                            </div>
                            <div>
                                <span>Method</span>
                                <strong>{readableMethod || 'Payment'}</strong>
                            </div>
                        </div>

                        <p className="text-muted">
                            This page checks the payment status automatically. Unpaid payment records remain available from your wallet history.
                        </p>
                    </div>
                </section>
            ) : (
                <div className="panel empty-state">Payment not found.</div>
            )}
        </div>
    );
};

export default PaymentDetailPage;
