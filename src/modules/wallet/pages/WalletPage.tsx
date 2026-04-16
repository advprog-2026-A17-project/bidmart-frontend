import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../../../config/api';

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

const toErrorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : 'Unknown error';

const WalletPage: React.FC = () => {
    const [userId] = useState<string | null>(() => {
        try {
            const raw = localStorage.getItem('bidmart_user');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.id ?? null;
        } catch {
            return null;
        }
    });
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [history, setHistory] = useState<WalletTransaction[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [walletNotFound, setWalletNotFound] = useState<boolean>(false);
    const [topUpAmount, setTopUpAmount] = useState<string>('');
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [showBalance, setShowBalance] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw'>('overview');

    const fetchWallet = useCallback(async () => {
        setLoading(true);
        setError(null);
        setWalletNotFound(false);
        if (!userId) {
            setLoading(false);
            setError('User tidak ditemukan. Silakan login ulang.');
            return;
        }
        try {
            const response = await fetch(apiUrl(`/api/v1/wallet/${userId}`));
            if (response.status === 404 || response.status === 500) {
                setWalletNotFound(true);
                return;
            }
            if (!response.ok) {
                setError(`HTTP error! status: ${response.status}`);
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
    }, [userId]);

    const createWallet = async () => {
        setActionLoading(true);
        setError(null);
        try {
            const response = await fetch(apiUrl('/api/v1/wallet/add'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId }),
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

    useEffect(() => {
        fetchWallet();
    }, [fetchWallet]);

    const showSuccess = (msg: string) => {
        setSuccess(msg);
        setError(null);
        setTimeout(() => setSuccess(null), 3000);
    };

    const handleTopUp = async () => {
        const amount = parseFloat(topUpAmount);
        if (!amount || amount <= 0) {
            setError('Please enter a valid top-up amount.');
            return;
        }
        setActionLoading(true);
        setError(null);
        try {
            const response = await fetch(
                apiUrl(`/api/v1/wallet/${userId}/top-up?amount=${amount}`),
                { method: 'POST' }
            );
            if (!response.ok) {
                const errData = await response.json().catch(() => ({})) as { message?: string };
                setError(`Top-up failed: ${errData.message ?? `HTTP error! status: ${response.status}`}`);
                return;
            }
            setTopUpAmount('');
            showSuccess(`Successfully topped up $${amount.toFixed(2)}!`);
            await fetchWallet();
        } catch (err: unknown) {
            setError(`Top-up failed: ${toErrorMessage(err)}`);
        } finally {
            setActionLoading(false);
        }
    };

    const handleWithdraw = async () => {
        const amount = parseFloat(withdrawAmount);
        if (!amount || amount <= 0) {
            setError('Please enter a valid withdrawal amount.');
            return;
        }
        setActionLoading(true);
        setError(null);
        try {
            const response = await fetch(
                apiUrl(`/api/v1/wallet/${userId}/withdraw?amount=${amount}`),
                { method: 'POST' }
            );
            if (!response.ok) {
                const errData = await response.json().catch(() => ({})) as { message?: string };
                setError(`Withdrawal failed: ${errData.message ?? `HTTP error! status: ${response.status}`}`);
                return;
            }
            setWithdrawAmount('');
            showSuccess(`Successfully withdrew $${amount.toFixed(2)}!`);
            await fetchWallet();
        } catch (err: unknown) {
            setError(`Withdrawal failed: ${toErrorMessage(err)}`);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="page-wrap">
            <section className="page-head">
                <h1>Wallet</h1>
                <p>Manage your BidMart account balance</p>
            </section>

            {error && <div className="toast-error">{error}</div>}
            {success && <div className="toast-success">{success}</div>}

            {loading ? (
                <div className="loading-state">Loading wallet from API Gateway...</div>
            ) : walletNotFound ? (
                <div className="panel center-content">
                    <p className="text-muted">No wallet found for user <strong>{userId}</strong>.</p>
                    <button
                        className="primary-button"
                        onClick={createWallet}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Creating...' : 'Create Wallet'}
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
                                {showBalance ? `$${wallet ? Number(wallet.activeBalance).toFixed(2) : '0.00'}` : '••••••'}
                            </strong>
                            <small>Account verified and active</small>
                        </div>
                        <div className="wallet-summary-card">
                            <span>Held Balance</span>
                            <strong>${wallet ? Number(wallet.heldBalance).toFixed(2) : '0.00'}</strong>
                            <small>Reserved for active bids</small>
                        </div>
                        <div className="wallet-summary-card">
                            <span>User ID</span>
                            <strong>{userId}</strong>
                            <small>Gateway profile</small>
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
                            <button className="primary-button" onClick={handleTopUp} disabled={actionLoading}>
                                {actionLoading ? 'Processing...' : 'Top Up'}
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
                                />
                            </label>
                            <button className="primary-button" onClick={handleWithdraw} disabled={actionLoading}>
                                {actionLoading ? 'Processing...' : 'Withdraw'}
                            </button>
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
                                            ${Number(tx.amount).toFixed(2)}
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
