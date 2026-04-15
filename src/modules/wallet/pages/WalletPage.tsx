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

const DUMMY_USER_ID = 'user-001';

const toErrorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : 'Unknown error';

const WalletPage: React.FC = () => {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [history, setHistory] = useState<WalletTransaction[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [walletNotFound, setWalletNotFound] = useState<boolean>(false);
    const [topUpAmount, setTopUpAmount] = useState<string>('');
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');

    const fetchWallet = useCallback(async () => {
        setLoading(true);
        setError(null);
        setWalletNotFound(false);
        try {
            const response = await fetch(apiUrl(`/api/v1/wallet/${DUMMY_USER_ID}`));
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
    }, []);

    const createWallet = async () => {
        setActionLoading(true);
        setError(null);
        try {
            const response = await fetch(apiUrl('/api/v1/wallet/add'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: DUMMY_USER_ID }),
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
                apiUrl(`/api/v1/wallet/${DUMMY_USER_ID}/top-up?amount=${amount}`),
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
                apiUrl(`/api/v1/wallet/${DUMMY_USER_ID}/withdraw?amount=${amount}`),
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
        <div className="dashboard-container">
            <h1>My Wallet</h1>
            <p className="text-muted" style={{ textAlign: 'center', marginTop: '-10px', marginBottom: '15px' }}>
                User ID: <strong>{DUMMY_USER_ID}</strong>
            </p>

            {error && <div className="toast-error">{error}</div>}
            {success && <div className="toast-success">{success}</div>}

            {loading ? (
                <div className="loading-state">Loading wallet from API Gateway...</div>
            ) : walletNotFound ? (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                    <p className="text-muted">No wallet found for user <strong>{DUMMY_USER_ID}</strong>.</p>
                    <button
                        className="topup-button"
                        onClick={createWallet}
                        disabled={actionLoading}
                        style={{ marginTop: 10 }}
                    >
                        {actionLoading ? 'Creating...' : 'Create Wallet'}
                    </button>
                </div>
            ) : (
                <>
                    {/* Balance section */}
                    <div className="wallet-balance-section">
                        <div className="wallet-balance-label">Available Balance</div>
                        <div className="wallet-balance">
                            ${wallet ? Number(wallet.activeBalance).toFixed(2) : '0.00'}
                        </div>
                        {wallet && Number(wallet.heldBalance) > 0 && (
                            <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                                On hold (active bids): ${Number(wallet.heldBalance).toFixed(2)}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="wallet-actions">
                        {/* Top Up */}
                        <div className="wallet-action-card">
                            <h3>💰 Top Up</h3>
                            <div className="action-row">
                                <input
                                    className="form-input"
                                    type="number"
                                    placeholder="Amount"
                                    value={topUpAmount}
                                    min={0}
                                    step="0.01"
                                    onChange={(e) => setTopUpAmount(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="topup-button"
                                    onClick={handleTopUp}
                                    disabled={actionLoading}
                                >
                                    Top Up
                                </button>
                            </div>
                        </div>

                        {/* Withdraw */}
                        <div className="wallet-action-card">
                            <h3>💸 Withdraw</h3>
                            <div className="action-row">
                                <input
                                    className="form-input"
                                    type="number"
                                    placeholder="Amount"
                                    value={withdrawAmount}
                                    min={0}
                                    step="0.01"
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="withdraw-button"
                                    onClick={handleWithdraw}
                                    disabled={actionLoading}
                                >
                                    Withdraw
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Transaction History */}
                    <div className="transaction-history">
                        <h2>Transaction History</h2>
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
                </>
            )}
        </div>
    );
};

export default WalletPage;
