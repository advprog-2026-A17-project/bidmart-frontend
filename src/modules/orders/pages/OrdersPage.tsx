import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { formatMoney } from '../../../utils/money';

type OrderRecord = {
    id: string;
    auctionId: string;
    listingId: string;
    sellerId: string;
    buyerId: string;
    finalPrice: number;
    shippingAddress?: string | null;
    status: string;
    shippingStatus?: string | null;
    trackingNumber?: string | null;
    carrier?: string | null;
    createdAt: string;
    updatedAt: string;
};

type ListingSummary = {
    id: string | number;
    title?: string | null;
    imageUrl?: string | null;
};

const orderStatusLabel = (order: OrderRecord): string =>
    order.shippingStatus || order.status;

const OrdersPage: React.FC = () => {
    const { user, activeRole } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const [orders, setOrders] = useState<OrderRecord[]>([]);
    const [listingsById, setListingsById] = useState<Record<string, ListingSummary>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const fetchOrders = useCallback(async () => {
        if (!user) {
            setOrders([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const response = await authenticatedFetch(gatewayUrl('/api/v1/orders'));
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Order lookup failed'));
            }

            const payload = await response.json() as OrderRecord[] | { items?: OrderRecord[] };
            const nextOrders = Array.isArray(payload) ? payload : payload.items ?? [];
            setOrders(nextOrders);

            const listingEntries = await Promise.all(
                Array.from(new Set(nextOrders.map((order) => order.listingId))).map(async (listingId): Promise<[string, ListingSummary] | null> => {
                    try {
                        const listingResponse = await fetch(gatewayUrl(`/api/v1/catalogue/listings/${encodeURIComponent(listingId)}`));
                        if (!listingResponse.ok) return null;
                        const listing = await listingResponse.json() as ListingSummary | null;
                        if (!listing) return null;
                        return [String(listing.id ?? listingId), listing];
                    } catch {
                        return null;
                    }
                })
            );
            setListingsById(Object.fromEntries(listingEntries.filter((entry): entry is [string, ListingSummary] => Boolean(entry))));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to load orders.');
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch, user]);

    useEffect(() => {
        void fetchOrders();
    }, [fetchOrders]);

    const totalValue = useMemo(
        () => orders.reduce((sum, order) => sum + Number(order.finalPrice || 0), 0),
        [orders]
    );

    const confirmReceipt = async (orderId: string) => {
        try {
            setError(null);
            setNotice(null);
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/orders/${encodeURIComponent(orderId)}/confirm`), {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Confirm receipt failed'));
            }
            setNotice('Order receipt confirmed.');
            await fetchOrders();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to confirm receipt.');
        }
    };

    return (
        <div className="page-wrap">
            <section className="page-head studio-head">
                <div>
                    <BackButton fallback="/active-auctions" />
                    <p className="eyebrow">{activeRole === 'SELLER' ? 'Seller Workspace' : 'Buyer Workspace'}</p>
                    <h1>Orders</h1>
                    <p>Track auctions you won after the seller settles them.</p>
                </div>
                <Link className="secondary-button" to="/active-auctions">
                    <span className="material-symbols-outlined" aria-hidden="true">gavel</span>
                    Active Auctions
                </Link>
            </section>

            {error && <div className="toast-error">{error}</div>}
            {notice && <div className="toast-success">{notice}</div>}

            <section className="seller-studio-overview" aria-label="Order summary">
                <div className="studio-kpi-card">
                    <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
                    <div>
                        <strong>{loading ? '--' : orders.length}</strong>
                        <small>Won auction orders</small>
                    </div>
                </div>
                <div className="studio-kpi-card">
                    <span className="material-symbols-outlined" aria-hidden="true">payments</span>
                    <div>
                        <strong>{loading ? '--' : formatMoney(totalValue)}</strong>
                        <small>Total final value</small>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="management-list skeleton-grid" aria-busy="true" aria-label="Loading orders">
                    <span className="skeleton-line" />
                    <span className="skeleton-line skeleton-line-medium" />
                    <span className="skeleton-button" />
                </div>
            ) : orders.length > 0 ? (
                <div className="management-list">
                    {orders.map((order) => {
                        const listing = listingsById[order.listingId];
                        const isBuyer = user?.id === order.buyerId;
                        return (
                            <article key={order.id} className="management-card">
                                <div>
                                    <span className={`status-badge status-${order.status}`}>{orderStatusLabel(order)}</span>
                                    <h3>{listing?.title || 'Won Auction'}</h3>
                                    <p className="text-muted">
                                        Created {new Date(order.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="listing-price-grid">
                                    <div>
                                        <span>Final Price</span>
                                        <strong>{formatMoney(Number(order.finalPrice || 0))}</strong>
                                    </div>
                                    <div>
                                        <span>Courier</span>
                                        <strong>{order.carrier || 'Not assigned'}</strong>
                                    </div>
                                    <div>
                                        <span>Tracking No.</span>
                                        <strong>{order.trackingNumber || 'Pending'}</strong>
                                    </div>
                                    <div>
                                        <span>Address</span>
                                        <strong>{order.shippingAddress || 'Not provided'}</strong>
                                    </div>
                                    <div>
                                        <span>Updated</span>
                                        <strong>{new Date(order.updatedAt).toLocaleDateString()}</strong>
                                    </div>
                                </div>
                                <div className="management-actions">
                                    <Link className="secondary-button" to={`/orders/${order.id}`}>View Details</Link>
                                    <Link className="secondary-button" to={`/active-auctions/${order.auctionId}`}>Auction</Link>
                                    <Link className="secondary-button" to={`/listings/${order.listingId}`}>Listing</Link>
                                    {isBuyer && order.status === 'SHIPPED' && (
                                        <button type="button" className="primary-button" onClick={() => confirmReceipt(order.id)}>
                                            Confirm Receipt
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <section className="panel center-content">
                    <span className="material-symbols-outlined section-title-icon" aria-hidden="true">receipt_long</span>
                    <h2>No orders yet</h2>
                    <p className="text-muted">Won auctions appear here after the seller settles the auction.</p>
                    <Link className="primary-button" to="/active-auctions">
                        Browse Auctions
                    </Link>
                </section>
            )}
        </div>
    );
};

export default OrdersPage;
