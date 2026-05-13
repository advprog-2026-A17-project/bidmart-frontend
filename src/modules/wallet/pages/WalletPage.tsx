import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { readApiError, gatewayUrl } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';

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
}

interface PaymentIntent {
    paymentId: string;
    amountCents: number;
    status: string;
    redirectUrl: string;
    vaNumber?: string | null;
    paymentChannel?: string | null;
}

interface WithdrawalRequestState {
    withdrawalId: string;
    amountCents: number;
    status: string;
}

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

const toAmountCents = (value: string): number => Math.round(Number(value || 0) * 100);
const formatCents = (value: number | undefined): string => `$${((value ?? 0) / 100).toFixed(2)}`;
const walletDisplayName = (email?: string): string => {
    const localPart = email?.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase();
    return `BM-${localPart || 'ACCOUNT'}`;
};

const WalletPage: React.FC = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const location = useLocation();
    const navigate = useNavigate();
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [history, setHistory] = useState<WalletTransaction[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [walletNotFound, setWalletNotFound] = useState<boolean>(false);
    const [topUpAmount, setTopUpAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('bca_va');
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [bankAccount, setBankAccount] = useState<string>('');
    const [pendingPayment, setPendingPayment] = useState<PaymentIntent | null>(null);
    const [pendingWithdrawal, setPendingWithdrawal] = useState<WithdrawalRequestState | null>(null);
    const [showBalance, setShowBalance] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw'>('overview');
    const [acceptWalletTerms, setAcceptWalletTerms] = useState(false);

    const fetchWallet = useCallback(async () => {
        setLoading(true);
        setError(null);
        setWalletNotFound(false);
        if (!user) {
            setWallet(null);
            setHistory([]);
            setLoading(false);
            setError('Please sign in to view your wallet.');
            return;
        }
        try {
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/wallet/${user.id}/detail`));
            if (response.status === 404 || response.status === 500) {
                setWalletNotFound(true);
                return;
            }
            if (!response.ok) {
                setError(await readApiError(response, 'Wallet lookup failed'));
                return;
            }
            const data = await response.json();
            setWallet(data.wallet ?? data);
            setHistory(data.history ?? []);
        } catch (err: unknown) {
            console.error('Fetch wallet failed:', toErrorMessage(err));
            setError('Failed to connect to Wallet Service via API Gateway.');
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch, user]);

    const createWallet = async () => {
        setActionLoading(true);
        setError(null);
        if (!user) return;
        try {
            const response = await authenticatedFetch(gatewayUrl('/api/v1/wallet/add'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });
            if (!response.ok) {
                setError(`Failed to create wallet: HTTP ${response.status}`);
                return;
            }
            showSuccess('Wallet created successfully!');
            await fetchWallet();
        } catch (err: unknown) {
            setError(`Create wallet failed: ${toErrorMessage(err)}`);
        } finally {
            setActionLoading(false);
        }
    };

    const showSuccess = useCallback((msg: string) => {
        setSuccess(msg);
        setError(null);
        setTimeout(() => setSuccess(null), 3000);
    }, []);

    useEffect(() => {
        fetchWallet();
    }, [fetchWallet]);

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
        const amountCents = toAmountCents(topUpAmount);
        if (!amountCents || amountCents <= 0) {
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
                    body: JSON.stringify({ amountCents, paymentMethod }),
                }
            );
            if (!response.ok) {
                setError(`Top-up failed: ${await readApiError(response, 'Top-up failed')}`);
                return;
            }
            const payment = await response.json() as PaymentIntent;
            setPendingPayment(payment);
            setTopUpAmount('');
            showSuccess(`Sandbox payment created for ${formatCents(payment.amountCents)}.`);
        } catch (err: unknown) {
            setError(`Top-up failed: ${toErrorMessage(err)}`);
        } finally {
            setActionLoading(false);
        }
    };

    const syncPendingPayment = async () => {
        if (!pendingPayment) return;
        setActionLoading(true);
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
            setActionLoading(false);
        }
    };

    const handleWithdraw = async () => {
        const amountCents = toAmountCents(withdrawAmount);
        if (!amountCents || amountCents <= 0) {
            setError('Please enter a valid withdrawal amount.');
            return;
        }
        if (!bankAccount.trim()) {
            setError('Please enter a bank account for sandbox withdrawal.');
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
                    body: JSON.stringify({ amountCents, bankAccount }),
                }
            );
            if (!response.ok) {
                setError(`Withdrawal failed: ${await readApiError(response, 'Withdrawal failed')}`);
                return;
            }
            const withdrawal = await response.json() as WithdrawalRequestState;
            setPendingWithdrawal(withdrawal);
            setWithdrawAmount('');
            showSuccess(`Sandbox withdrawal requested for ${formatCents(withdrawal.amountCents)}.`);
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
                        Wallets are created during account setup and used for sandbox top-ups, bid holds, refunds, and withdrawals.
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
                <h1>Wallet</h1>
                <p>Manage your BidMart account balance</p>
            </section>

            {error && <div className="toast-error">{error}</div>}
            {success && <div className="toast-success">{success}</div>}

            {loading ? (
                walletSkeleton
            ) : walletNotFound ? (
                <div className="panel center-content">
                    <p className="text-muted">Your wallet is not active yet.</p>
                    <label className="terms-check">
                        <input
                            type="checkbox"
                            checked={acceptWalletTerms}
                            onChange={(event) => setAcceptWalletTerms(event.target.checked)}
                        />
                        <span>I agree to use BidMart Wallet only for sandbox bidding, top-up, and withdrawal simulation.</span>
                    </label>
                    <button
                        className="primary-button"
                        onClick={createWallet}
                        disabled={actionLoading || !acceptWalletTerms}
                    >
                        {actionLoading ? 'Creating...' : 'Activate Wallet'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="wallet-summary-grid">
                        <div className="wallet-summary-card wallet-main">
                            <div className="wallet-summary-top">
                                <span>Total Balance</span>
                                <button className="link-button" onClick={() => setShowBalance((value) => !value)}>
                                    {showBalance ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            <strong>
                                {showBalance ? formatCents(wallet?.activeBalance) : '••••••'}
                            </strong>
                            <small>Account verified and active</small>
                        </div>
                        <div className="wallet-summary-card">
                            <span>Held Balance</span>
                            <strong>{formatCents(wallet?.heldBalance)}</strong>
                            <small>Reserved for active bids</small>
                        </div>
                        <div className="wallet-summary-card">
                            <span>Wallet Account</span>
                            <strong>{walletDisplayName(user.email)}</strong>
                            <small>Display reference</small>
                        </div>
                    </div>

                    <div className="wallet-actions panel">
                        <button className="primary-button" onClick={() => setActiveTab('deposit')}>Add Funds</button>
                        <button className="secondary-button" onClick={() => setActiveTab('withdraw')}>Withdraw</button>
                        <button className="secondary-button" onClick={() => setActiveTab('overview')}>Transactions</button>
                    </div>

                    {activeTab === 'deposit' && (
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
                                {actionLoading ? 'Processing...' : 'Create Sandbox Payment Intent'}
                            </button>
                            {pendingPayment && (
                                <div className="summary-box sandbox-status">
                                    <strong>Midtrans Sandbox Payment</strong>
                                    <div>Payment ref: {pendingPayment.paymentId.slice(0, 8).toUpperCase()}</div>
                                    <div>Amount: {formatCents(pendingPayment.amountCents)}</div>
                                    {pendingPayment.paymentChannel && <div>Method: {pendingPayment.paymentChannel.replace('_', ' ')}</div>}
                                    <div>Status: {pendingPayment.status}</div>
                                    {pendingPayment.vaNumber && <div>Payment code: {pendingPayment.vaNumber}</div>}
                                    <a className="primary-button" href={pendingPayment.redirectUrl} target="_blank" rel="noreferrer">
                                        Open Midtrans Simulator
                                    </a>
                                    <button className="secondary-button" onClick={syncPendingPayment} disabled={actionLoading}>
                                        {actionLoading ? 'Syncing...' : 'Sync Payment Status'}
                                    </button>
                                </div>
                            )}
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
                                />
                            </label>
                            <label className="field">
                                Bank Account
                                <input
                                    className="form-input"
                                    placeholder="Sandbox bank account"
                                    value={bankAccount}
                                    onChange={(e) => setBankAccount(e.target.value)}
                                />
                            </label>
                            <button className="primary-button" onClick={handleWithdraw} disabled={actionLoading}>
                                {actionLoading ? 'Processing...' : 'Request Sandbox Withdrawal'}
                            </button>
                            {pendingWithdrawal && (
                                <div className="summary-box sandbox-status">
                                    <div>Withdrawal ref: {pendingWithdrawal.withdrawalId.slice(0, 8).toUpperCase()}</div>
                                    <div>Amount: {formatCents(pendingWithdrawal.amountCents)}</div>
                                    <div>Status: {pendingWithdrawal.status}</div>
                                    <span className="text-muted">Withdrawal status updates are reflected in transaction history.</span>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'overview' && (
                        <div className="panel">
                            <h3>Transaction History</h3>
                            {history.length > 0 ? (
                                history.map((tx) => (
                                    <div key={tx.id} className="transaction-item">
                                        <span className={`transaction-type type-${tx.type}`}>
                                            {tx.type.replace('_', ' ')}
                                        </span>
                                        <span className="transaction-amount">
                                            {formatCents(Number(tx.amount))}
                                        </span>
                                        <span className="transaction-date">
                                            {new Date(tx.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                ))
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
