import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import PageToast from '../../../components/PageToast';

type OrderRecord = {
    id: string;
    status: string;
    disputeReason?: string | null;
    buyerId?: string;
    sellerId?: string;
};

const AdminDisputesPage: React.FC = () => {
    const authenticatedFetch = useAuthenticatedFetch();
    const [orders, setOrders] = useState<OrderRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await authenticatedFetch(gatewayUrl('/api/v1/orders/admin/disputes'));
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to load orders'));
            }
            const payload = await response.json() as OrderRecord[];
            setOrders(Array.isArray(payload) ? payload : []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to load disputes.');
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch]);

    useEffect(() => {
        void loadOrders();
    }, [loadOrders]);

    const resolveDispute = async (orderId: string, winner: 'BUYER' | 'SELLER') => {
        setError(null);
        try {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/orders/${encodeURIComponent(orderId)}/dispute/resolve`),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ winner }),
                },
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to resolve dispute'));
            }
            await loadOrders();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to resolve dispute.');
        }
    };

    return (
        <div className="section-stack">
            <section className="page-head studio-head">
                <h1>Disputes</h1>
                <p className="text-muted">Resolve open order disputes.</p>
            </section>
            <PageToast error={error} />
            {loading ? (
                <div className="loading-state">Loading disputes...</div>
            ) : (
                <div className="management-list">
                    {orders.map((order) => (
                        <article key={order.id} className="management-card">
                            <div>
                                <h3>Order {order.id}</h3>
                                <p className="text-muted">{order.disputeReason || 'No reason provided'}</p>
                            </div>
                            <div className="management-actions">
                                <Link className="secondary-button" to={`/orders/${order.id}`}>View order</Link>
                                <button type="button" className="primary-button" onClick={() => void resolveDispute(order.id, 'BUYER')}>
                                    Buyer wins
                                </button>
                                <button type="button" className="secondary-button" onClick={() => void resolveDispute(order.id, 'SELLER')}>
                                    Seller wins
                                </button>
                            </div>
                        </article>
                    ))}
                    {orders.length === 0 && <p className="text-muted">No open disputes.</p>}
                </div>
            )}
        </div>
    );
};

export default AdminDisputesPage;
