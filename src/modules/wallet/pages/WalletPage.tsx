import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { readApiError, gatewayUrl } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { isSellerUser, primaryRole } from '../../../context/primaryRole';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { useWalletUI } from '../../../context/WalletUIContext';
import { useNotificationsWebSocket } from '../../../context/useNotificationsWebSocket';
import PageToast from '../../../components/PageToast';
import { normalizeMoneyInput, toRupiahAmount } from '../../../utils/money';
import {
    formatCents,
    paymentExpiryMs,
    paymentReference,
    rememberPaymentExpiry,
    type PaymentIntent,
} from '../utils/payment';

interface Wallet {
    id: string;
    userId: string;
    activeBalance: number;
    heldBalance: number;
}

interface WalletTransaction {
    id: string;
    userId: string;
    type: string;
    amount: number;
    timestamp: string;
    correlationId?: string | null;
    sourceService?: string | null;
}

interface WithdrawalRequestState {
    withdrawalId: string;
    amount: number;
    status: string;
    bankCode?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
    payoutReference?: string | null;
}

const WITHDRAWAL_BANKS = [
    { value: 'bca', label: 'BCA' },
    { value: 'bni', label: 'BNI' },
    { value: 'bri', label: 'BRI' },
    { value: 'mandiri', label: 'Mandiri' },
    { value: 'permata', label: 'Permata' },
    { value: 'cimb', label: 'CIMB Niaga' },
    { value: 'danamon', label: 'Danamon' },
    { value: 'bsi', label: 'BSI' },
    { value: 'btn', label: 'BTN' },
    { value: 'ocbc', label: 'OCBC NISP' },
    { value: 'panin', label: 'Panin' },
];

const PAYMENT_METHODS = [
    { value: 'bca_va', label: 'BCA VA' },
    { value: 'bni_va', label: 'BNI VA' },
    { value: 'bri_va', label: 'BRI VA' },
    { value: 'permata_va', label: 'Permata VA' },
    { value: 'mandiri_bill', label: 'Mandiri Bill' },
    { value: 'qris', label: 'QRIS' },
];

const toErrorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : 'Unknown error';

const timestampMs = (value?: string | null): number => {
    if (!value) {
        return 0;
    }
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};
const effectivePaymentStatus = (payment: PaymentIntent): string => {
    const remainingMs = paymentExpiryMs(payment) - Date.now();
    if (payment.status === 'EXPIRED' && remainingMs > 0) {
        return 'PENDING';
    }
    return payment.status === 'PENDING' && remainingMs <= 0 ? 'EXPIRED' : payment.status;
};
const walletDisplayName = (email?: string): string => {
    const localPart = email?.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase();
    return `BM-${localPart || 'ACCOUNT'}`;
};

const WalletPage: React.FC = () => {
    const { user } = useAuth();
    const role = primaryRole(user);
    const authenticatedFetch = useAuthenticatedFetch();
    const { isConnected, subscribe, unsubscribe } = useNotificationsWebSocket();
    const location = useLocation();
    const navigate = useNavigate();
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [history, setHistory] = useState<WalletTransaction[]>([]);
    const [unpaidPayments, setUnpaidPayments] = useState<PaymentIntent[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [topUpAmount, setTopUpAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('bca_va');
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [withdrawBankCode, setWithdrawBankCode] = useState<string>('bca');
    const [withdrawAccountNumber, setWithdrawAccountNumber] = useState<string>('');
    const [pendingPayment, setPendingPayment] = useState<PaymentIntent | null>(null);
    const [pendingWithdrawal, setPendingWithdrawal] = useState<WithdrawalRequestState | null>(null);
    const { showBalance, setShowBalance } = useWalletUI();
    const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw'>('overview');
    const fetchWallet = useCallback(async () => {
        setLoading(true);
        setError(null);
        if (!user) {
            setWallet(null);
            setHistory([]);
            setUnpaidPayments([]);
            setLoading(false);
            setError('Please sign in to view your wallet.');
            return;
        }
        try {
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/wallet/${user.id}/detail?role=${role}`));
            if (!response.ok) {
                setError(await readApiError(response, 'Wallet lookup failed'));
                return;
            }
            const data = await response.json();
            setWallet(data.wallet ?? data);
            setHistory(data.history ?? []);
            setUnpaidPayments(data.unpaidPayments ?? []);
        } catch (err: unknown) {
            console.error('Fetch wallet failed:', toErrorMessage(err));
            setError('Failed to connect to Wallet Service via API Gateway.');
        } finally {
            setLoading(false);
        }
    }, [role, authenticatedFetch, user]);

    const showSuccess = useCallback((msg: string) => {
        setSuccess(msg);
        setError(null);
        setTimeout(() => setSuccess(null), 3000);
    }, []);

    useEffect(() => {
        fetchWallet();
    }, [fetchWallet]);

    useEffect(() => {
        if (!user || !isConnected) {
            return;
        }

        const destination = '/user/queue/notifications';
        subscribe(destination, (payload) => {
            const event = payload as { type?: string; payload?: { type?: string } };
            const type = String(event.payload?.type ?? event.type ?? '').toUpperCase();
            if (
                ['BID_PLACED', 'OUTBID', 'AUCTION_WON', 'AUCTION_ENDED', 'ORDER_CREATED'].includes(type) ||
                type.includes('WALLET') ||
                type.includes('PAYMENT') ||
                type.includes('WITHDRAW')
            ) {
                void fetchWallet();
            }
        });
        return () => unsubscribe(destination);
    }, [fetchWallet, isConnected, subscribe, unsubscribe, user]);

    useEffect(() => {
        if (!user) return;

        const params = new URLSearchParams(location.search);
        const orderId = params.get('order_id') ?? params.get('orderId');
        const transactionStatus = params.get('transaction_status') ?? params.get('transactionStatus');
        const statusCode = params.get('status_code') ?? params.get('statusCode');

        if (!orderId || !transactionStatus) {
            return;
        }

        let active = true;

        const syncMidtransReturn = async () => {
            setActionLoading(true);
            setError(null);
            try {
                const response = await authenticatedFetch(
                    gatewayUrl('/api/v1/wallet/midtrans/payments/return'),
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId, transactionStatus, statusCode }),
                    }
                );
                if (!response.ok) {
                    setError(`Midtrans payment sync failed: ${await readApiError(response, 'Midtrans payment sync failed')}`);
                    return;
                }
                const payment = await response.json() as PaymentIntent;
                if (!active) return;
                setPendingPayment(null);
                showSuccess(`Midtrans payment ${payment.status}.`);
                await fetchWallet();
                navigate('/wallet', { replace: true });
            } catch (err: unknown) {
                if (active) {
                    setError(`Midtrans payment sync failed: ${toErrorMessage(err)}`);
                }
            } finally {
                if (active) {
                    setActionLoading(false);
                }
            }
        };

        void syncMidtransReturn();

        return () => {
            active = false;
        };
    }, [authenticatedFetch, fetchWallet, location.search, navigate, showSuccess, user]);

    const walletSkeleton = (
        <div className="section-stack" aria-busy="true" aria-label="Loading wallet">
            <div className="wallet-summary-grid skeleton-grid">
                <div className="wallet-summary-card wallet-main skeleton-card">
                    <span className="skeleton-line skeleton-line-short" />
                    <span className="skeleton-line skeleton-line-large" />
                    <span className="skeleton-line skeleton-line-medium" />
                </div>
                <div className="wallet-summary-card skeleton-card">
                    <span className="skeleton-line skeleton-line-short" />
                    <span className="skeleton-line skeleton-line-large" />
                </div>
                <div className="wallet-summary-card skeleton-card">
                    <span className="skeleton-line skeleton-line-short" />
                    <span className="skeleton-line skeleton-line-medium" />
                </div>
            </div>
            <div className="panel section-stack skeleton-card">
                <span className="skeleton-line" />
                <span className="skeleton-line skeleton-line-medium" />
                <span className="skeleton-button" />
            </div>
        </div>
    );

    const handleTopUp = async () => {
        const amount = toRupiahAmount(topUpAmount);
        if (!amount || amount <= 0) {
            setError('Please enter a valid top-up amount.');
            return;
        }
        setActionLoading(true);
        setError(null);
        if (!user) return;
        try {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/wallet/${user.id}/top-up/intent`),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount, paymentMethod, role }),
                }
            );
            if (!response.ok) {
                setError(`Top-up failed: ${await readApiError(response, 'Top-up failed')}`);
                return;
            }
            const payment = await response.json() as PaymentIntent;
            const expiresAt = rememberPaymentExpiry(payment.paymentId);
            const paymentWithLocalExpiry = { ...payment, expiresAt: new Date(expiresAt).toISOString() };
            setPendingPayment(paymentWithLocalExpiry);
            setTopUpAmount('');
            showSuccess(`Payment created for ${formatCents(paymentWithLocalExpiry.amount)}.`);
            navigate(`/wallet/payments/${payment.paymentId}`);
        } catch (err: unknown) {
            setError(`Top-up failed: ${toErrorMessage(err)}`);
        } finally {
            setActionLoading(false);
        }
    };

    const syncPendingPayment = useCallback(async (silent = false) => {
        if (!pendingPayment) return;
        if (!silent) setActionLoading(true);
        setError(null);
        try {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/wallet/midtrans/payments/${pendingPayment.paymentId}/sync`),
                { method: 'POST' }
            );
            if (!response.ok) {
                setError(`Payment sync failed: ${await readApiError(response, 'Payment sync failed')}`);
                return;
            }
            const payment = await response.json() as PaymentIntent;
            setPendingPayment(payment.status === 'PENDING' ? payment : null);
            showSuccess(`Payment ${payment.status}.`);
            await fetchWallet();
        } catch (err: unknown) {
            setError(`Payment sync failed: ${toErrorMessage(err)}`);
        } finally {
            if (!silent) setActionLoading(false);
        }
    }, [authenticatedFetch, fetchWallet, pendingPayment, showSuccess]);

    useEffect(() => {
        if (!pendingPayment || pendingPayment.status !== 'PENDING') {
            return;
        }

        const sync = () => void syncPendingPayment(true);
        const interval = globalThis.setInterval(sync, 8_000);
        window.addEventListener('focus', sync);
        document.addEventListener('visibilitychange', sync);

        return () => {
            globalThis.clearInterval(interval);
            window.removeEventListener('focus', sync);
            document.removeEventListener('visibilitychange', sync);
        };
    }, [pendingPayment, syncPendingPayment]);

    const transactionRows = useMemo(() => [
        ...unpaidPayments.map((payment) => ({
            kind: 'payment' as const,
            id: payment.paymentId,
            timestamp: timestampMs(payment.createdAt),
            payment,
        })),
        ...history.map((transaction) => ({
            kind: 'transaction' as const,
            id: transaction.id,
            timestamp: timestampMs(transaction.timestamp),
            transaction,
        })),
    ].sort((a, b) => b.timestamp - a.timestamp), [history, unpaidPayments]);

    const handleWithdraw = async () => {
        const amount = toRupiahAmount(withdrawAmount);
        if (!amount || amount <= 0) {
            setError('Please enter a valid withdrawal amount.');
            return;
        }
        const normalizedAccountNumber = withdrawAccountNumber.replace(/[\s-]/g, '');
        if (!/^\d{6,32}$/.test(normalizedAccountNumber)) {
            setError('Enter a valid numeric bank account number.');
            return;
        }
        setActionLoading(true);
        setError(null);
        if (!user) return;
        try {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/wallet/${user.id}/withdrawals`),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount,
                        bankCode: withdrawBankCode,
                        accountNumber: normalizedAccountNumber,
                        role,
                    }),
                }
            );
            if (!response.ok) {
                setError(`Withdrawal failed: ${await readApiError(response, 'Withdrawal failed')}`);
                return;
            }
            const withdrawal = await response.json() as WithdrawalRequestState;
            setPendingWithdrawal(withdrawal);
            setWithdrawAmount('');
            setWithdrawAccountNumber('');
            showSuccess(`Withdrawal requested for ${formatCents(withdrawal.amount)}.`);
            await fetchWallet();
        } catch (err: unknown) {
            setError(`Withdrawal failed: ${toErrorMessage(err)}`);
        } finally {
            setActionLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="page-wrap">
                <section className="page-head">
                    <h1>Wallet</h1>
                    <p>Preview BidMart Wallet before signing in</p>
                </section>

                <section className="panel access-panel center-content">
                    <span className="hero-badge">Account Required</span>
                    <h2>Sign in to manage wallet funds</h2>
                    <p className="text-muted">
                        Wallets are created during account setup and used for top-ups, bid holds, refunds, and withdrawals.
                    </p>
                    <div className="access-actions">
                        <Link className="primary-button" to="/login">Sign In or Register</Link>
                        <Link className="secondary-button" to="/">Explore Auctions</Link>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="page-wrap">
            <section className="page-head">
                <BackButton fallback="/" />
                <p className="eyebrow">Financial Desk</p>
                <h1>Wallet Dashboard</h1>
                <p>Manage bidding liquidity, active holds, deposits, withdrawals, and audit history.</p>
                <span className={isConnected ? 'connection-live' : 'connection-idle'}>
                    {isConnected ? 'Live wallet events' : 'Realtime offline'}
                </span>
            </section>

            <PageToast error={error} success={success} />

            {loading ? (
                walletSkeleton
            ) : !wallet ? (
                <div className="panel center-content">
                    <p className="text-muted">Unable to load your wallet. Please refresh or try again shortly.</p>
                    <button className="primary-button" type="button" onClick={() => void fetchWallet()} disabled={actionLoading}>
                        Retry
                    </button>
                </div>
            ) : (
                <>
                    <div className="wallet-summary-grid">
                        <div className="wallet-summary-card wallet-main">
                            <div className="wallet-summary-top">
                                <span className="metric-label">Total Balance</span>
                                <button className="icon-button" aria-label={showBalance ? 'Hide balance' : 'Show balance'} onClick={() => setShowBalance((value) => !value)}>
                                    <span className="material-symbols-outlined" aria-hidden="true">{showBalance ? 'visibility_off' : 'visibility'}</span>
                                    {showBalance ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            <strong>
                                {showBalance ? formatCents(wallet?.activeBalance) : '••••••'}
                            </strong>
                            <small>Account verified and active</small>
                        </div>
                        <div className="wallet-summary-card">
                            <div className="wallet-summary-top">
                                <span className="metric-label">Active Holds</span>
                                <span className="material-symbols-outlined metric-icon" aria-hidden="true">lock</span>
                            </div>
                            <strong>{showBalance ? formatCents(wallet?.heldBalance) : '••••••'}</strong>
                            <small>
                                {isSellerUser(user)
                                    ? 'Pending sale proceeds (released after buyer confirms order)'
                                    : 'Reserved for active bids'}
                            </small>
                        </div>
                        <div className="wallet-summary-card">
                            <div className="wallet-summary-top">
                                <span className="metric-label">Wallet Account</span>
                                <span className="material-symbols-outlined metric-icon" aria-hidden="true">account_balance</span>
                            </div>
                            <strong>{walletDisplayName(user.email)}</strong>
                            <small>Display reference</small>
                        </div>
                    </div>

                    <div className="wallet-actions">
                        {!isSellerUser(user) && (
                            <button className={activeTab === 'deposit' ? 'primary-button' : 'secondary-button'} onClick={() => setActiveTab('deposit')}>
                                <span className="material-symbols-outlined" aria-hidden="true">add_card</span>
                                Add Funds
                            </button>
                        )}
                        <button className={activeTab === 'withdraw' ? 'primary-button' : 'secondary-button'} onClick={() => setActiveTab('withdraw')}>
                            <span className="material-symbols-outlined" aria-hidden="true">payments</span>
                            Withdraw
                        </button>
                        <button className={activeTab === 'overview' ? 'primary-button' : 'secondary-button'} onClick={() => setActiveTab('overview')}>
                            <span className="material-symbols-outlined" aria-hidden="true">receipt_long</span>
                            Transactions
                        </button>
                    </div>

                    {activeTab === 'deposit' && !isSellerUser(user) && (
                        <div className="panel section-stack">
                            <h3>Add Funds</h3>
                            <label className="field">
                                Amount
                                <input
                                    className="form-input"
                                    type="number"
                                    placeholder="Amount"
                                    value={topUpAmount}
                                    min={0}
                                    step="0.01"
                                    onChange={(e) => setTopUpAmount(e.target.value)}
                                    onBlur={() => setTopUpAmount((value) => value ? normalizeMoneyInput(value) : '')}
                                />
                            </label>
                            <label className="field">
                                Payment Method
                                <select
                                    className="form-input"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                >
                                    {PAYMENT_METHODS.map((method) => (
                                        <option key={method.value} value={method.value}>
                                            {method.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button className="primary-button" onClick={handleTopUp} disabled={actionLoading}>
                                <span className="material-symbols-outlined" aria-hidden="true">payments</span>
                                {actionLoading ? 'Processing...' : 'Continue to Payment'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'withdraw' && (
                        <div className="panel section-stack">
                            <h3>Withdraw Funds</h3>
                            <label className="field">
                                Amount
                                <input
                                    className="form-input"
                                    type="number"
                                    placeholder="Amount"
                                    value={withdrawAmount}
                                    min={0}
                                    step="0.01"
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    onBlur={() => setWithdrawAmount((value) => value ? normalizeMoneyInput(value) : '')}
                                />
                            </label>
                            <label className="field">
                                Destination Bank
                                <select
                                    className="form-input"
                                    value={withdrawBankCode}
                                    onChange={(e) => setWithdrawBankCode(e.target.value)}
                                >
                                    {WITHDRAWAL_BANKS.map((bank) => (
                                        <option key={bank.value} value={bank.value}>
                                            {bank.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="field">
                                Account Number
                                <input
                                    className="form-input"
                                    inputMode="numeric"
                                    placeholder="Numeric bank account number"
                                    value={withdrawAccountNumber}
                                    onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                                />
                            </label>
                            <button className="primary-button" onClick={handleWithdraw} disabled={actionLoading}>
                                <span className="material-symbols-outlined" aria-hidden="true">outbox</span>
                                {actionLoading ? 'Processing...' : 'Request Withdrawal'}
                            </button>
                            {pendingWithdrawal && (
                                <div className="summary-box payment-status-card">
                                    <div>Withdrawal ref: {pendingWithdrawal.withdrawalId.slice(0, 8).toUpperCase()}</div>
                                    <div>Amount: {formatCents(pendingWithdrawal.amount)}</div>
                                    {pendingWithdrawal.accountName && <div>Account name: {pendingWithdrawal.accountName}</div>}
                                    {pendingWithdrawal.payoutReference && <div>Payout ref: {pendingWithdrawal.payoutReference}</div>}
                                    <div>Status: {pendingWithdrawal.status}</div>
                                    <span className="text-muted">The bank account is validated before funds are reserved for payout.</span>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'overview' && (
                        <div className="panel transaction-panel">
                            <div className="section-title-row">
                                <div>
                                    <p className="eyebrow">Audit Trail</p>
                                    <h2>Transaction History</h2>
                                </div>
                                <span className="section-count">{history.length + unpaidPayments.length} records</span>
                            </div>
                            {transactionRows.length > 0 ? (
                                <>
                                    {transactionRows.map((row) => {
                                        if (row.kind === 'payment') {
                                            const status = effectivePaymentStatus(row.payment);
                                            return (
                                                <Link
                                                    key={`payment-${row.id}`}
                                                    to={`/wallet/payments/${row.payment.paymentId}`}
                                                    className="transaction-item transaction-link"
                                                >
                                                    <div>
                                                        <span className={`transaction-type type-PAYMENT_${status}`}>
                                                            {status === 'PENDING' ? 'UNPAID PAYMENT' : `PAYMENT ${status}`}
                                                        </span>
                                                        <span className="transaction-date">
                                                            {row.payment.createdAt ? new Date(row.payment.createdAt).toLocaleString() : paymentReference(row.payment.paymentId)}
                                                        </span>
                                                    </div>
                                                    <span className="transaction-amount">
                                                        {showBalance ? formatCents(row.payment.amount) : '••••••'}
                                                    </span>
                                                </Link>
                                            );
                                        }

                                        const tx = row.transaction;
                                        const paymentId = tx.correlationId && tx.sourceService === 'midtrans'
                                            ? tx.correlationId
                                            : null;
                                        const content = (
                                            <>
                                                <div>
                                                    <span className={`transaction-type type-${tx.type}`}>
                                                        {tx.type.replaceAll('_', ' ')}
                                                    </span>
                                                    <span className="transaction-date">
                                                        {new Date(tx.timestamp).toLocaleString()}
                                                    </span>
                                                </div>
                                                <span className="transaction-amount">{showBalance ? formatCents(Number(tx.amount)) : '••••••'}</span>
                                            </>
                                        );

                                        return paymentId ? (
                                            <Link
                                                key={`tx-${tx.id}`}
                                                to={`/wallet/payments/${paymentId}`}
                                                className="transaction-item transaction-link"
                                            >
                                                {content}
                                            </Link>
                                        ) : (
                                            <div key={`tx-${tx.id}`} className="transaction-item">
                                                {content}
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <div className="empty-state">No transactions yet.</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default WalletPage;
