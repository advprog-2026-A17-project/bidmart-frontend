import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import PageToast from '../../../components/PageToast';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { isSellerUser } from '../../../context/primaryRole';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { useNotificationRealtime } from '../../../hooks/useNotificationRealtime';
import { formatMoney } from '../../../utils/money';
import OrderStatusCard from '../components/OrderStatusCard';
import AppIcon from '../../../components/AppIcon';

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

const OrdersPage: React.FC = () => {
    const { user } = useAuth();
    const isSellerView = isSellerUser(user);
    const authenticatedFetch = useAuthenticatedFetch();
    const [orders, setOrders] = useState<OrderRecord[]>([]);
    const [listingsById, setListingsById] = useState<Record<string, ListingSummary>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [disputeOrder, setDisputeOrder] = useState<OrderRecord | null>(null);
    const [disputeReason, setDisputeReason] = useState('Never received');
    const [disputeDetails, setDisputeDetails] = useState('');
    const [disputeSaving, setDisputeSaving] = useState(false);

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

    useNotificationRealtime(user?.id, () => {
        void fetchOrders();
    }, { orderTypesOnly: true });

    const totalValue = useMemo(
        () => orders.reduce((sum, order) => sum + Number(order.finalPrice || 0), 0),
        [orders]
    );

    const updateOrderStatus = async (orderId: string, status: 'PACKED' | 'SHIPPED', carrier?: string) => {
        try {
            setError(null);
            setNotice(null);
            const body: { status: string; carrier?: string } = { status };
            if (carrier) {
                body.carrier = carrier;
            }
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/orders/${encodeURIComponent(orderId)}/status`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Update order failed'));
            }
            setNotice(status === 'PACKED' ? 'Order marked as packed.' : 'Order marked as shipped.');
            await fetchOrders();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to update order.');
        }
    };

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

    const openDispute = async () => {
        if (!disputeOrder) return;
        if (!disputeReason.trim() || !disputeDetails.trim()) {
            setError('Please provide a dispute reason and details.');
            return;
        }
        try {
            setDisputeSaving(true);
            setError(null);
            setNotice(null);
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/orders/${encodeURIComponent(disputeOrder.id)}/dispute`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: disputeReason.trim(),
                    details: disputeDetails.trim(),
                }),
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Open dispute failed'));
            }
            setNotice('Dispute opened. Admin will review it from the dispute console.');
            setDisputeOrder(null);
            setDisputeReason('Never received');
            setDisputeDetails('');
            await fetchOrders();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to open dispute.');
        } finally {
            setDisputeSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="page-wrap">
                <section className="page-head">
                    <h1>Orders</h1>
                    <p>Track and manage your auction orders</p>
                </section>

                <section className="panel access-panel center-content">
                    <span className="hero-badge">Account Required</span>
                    <h2>Sign in to view your orders</h2>
                    <p className="text-muted">
                        Orders are created automatically after you win an auction or a buyer wins your listing.
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
            <section className="page-head studio-head">
                <div>
                    <BackButton fallback={isSellerView ? '/seller-studio' : '/'} />
                    <p className="eyebrow">{isSellerView ? 'Seller Workspace' : 'Buyer Workspace'}</p>
                    <h1>Orders</h1>
                    <p>{isSellerView ? 'Monitor buyer orders, shipping progress, and settlement status for your sold listings.' : 'Track auctions you won after the seller settles them.'}</p>
                </div>
                <Link className="secondary-button" to="/">
                    <AppIcon name="gavel" />
                    Marketplace
                </Link>
            </section>

            <PageToast error={error} success={notice} />

            <section className="seller-studio-overview" aria-label="Order summary">
                <div className="studio-kpi-card">
                    <AppIcon name="package" className="studio-kpi-icon" />
                    <div>
                        <strong>{loading ? '--' : orders.length}</strong>
                        <small>{isSellerView ? 'Orders to fulfill' : 'Won auction orders'}</small>
                    </div>
                </div>
                {isSellerView && (
                    <div className="studio-kpi-card">
                        <AppIcon name="wallet" className="studio-kpi-icon" />
                        <div>
                            <strong>{loading ? '--' : formatMoney(totalValue)}</strong>
                            <small>Total expected receivable</small>
                        </div>
                    </div>
                )}
            </section>

            {loading ? (
                <div className="management-list skeleton-grid" aria-busy="true" aria-label="Loading orders">
                    <span className="skeleton-line" />
                    <span className="skeleton-line skeleton-line-medium" />
                    <span className="skeleton-button" />
                </div>
            ) : orders.length > 0 ? (
                <div className="management-list orders-list">
                    {orders.map((order) => {
                        const listing = listingsById[order.listingId];
                        const isBuyer = user?.id === order.buyerId;
                        const isOrderSeller = user?.id === order.sellerId;
                        const orderRole = isOrderSeller ? 'seller' as const : 'buyer' as const;
                        return (
                            <article key={order.id} className="management-card order-management-card">
                                <OrderStatusCard
                                    status={order.status}
                                    role={orderRole}
                                    compact
                                    trackingNumber={order.trackingNumber}
                                    carrier={order.carrier}
                                />
                                <div>
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
                                    {isOrderSeller && order.status === 'CREATED' && (
                                        <button type="button" className="primary-button" onClick={() => updateOrderStatus(order.id, 'PACKED')}>
                                            Mark Packed
                                        </button>
                                    )}
                                    {isOrderSeller && order.status === 'PACKED' && (
                                        <button type="button" className="primary-button" onClick={() => updateOrderStatus(order.id, 'SHIPPED', 'JNE')}>
                                            Mark Shipped
                                        </button>
                                    )}
                                    {isBuyer && order.status === 'SHIPPED' && (
                                        <button type="button" className="primary-button" onClick={() => confirmReceipt(order.id)}>
                                            Confirm Receipt
                                        </button>
                                    )}
                                    {isBuyer && order.status === 'SHIPPED' && (
                                        <button
                                            type="button"
                                            className="danger-button"
                                            onClick={() => setDisputeOrder(order)}
                                        >
                                            Open Dispute
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
                    <p className="text-muted">
                        {isSellerView
                            ? 'Orders from your sold listings will appear here after auction settlement.'
                            : 'Won auctions appear here after the seller settles the auction.'}
                    </p>
                    <Link className="primary-button" to="/">
                        Browse Marketplace
                    </Link>
                </section>
            )}
            {disputeOrder && (
                <div className="modal-backdrop order-dispute-backdrop" role="presentation">
                    <section
                        className="panel order-dispute-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="order-dispute-title"
                    >
                        <div className="order-dispute-modal-head">
                            <div>
                                <p className="eyebrow">Buyer dispute</p>
                                <h2 id="order-dispute-title">Open a dispute</h2>
                                <p className="text-muted">Describe the delivery issue clearly so admin can resolve it.</p>
                            </div>
                            <button
                                type="button"
                                className="icon-button"
                                aria-label="Close dispute form"
                                onClick={() => setDisputeOrder(null)}
                                disabled={disputeSaving}
                            >
                                <AppIcon name="close" />
                            </button>
                        </div>
                        <label className="field">
                            <span>Reason</span>
                            <input
                                className="form-input"
                                value={disputeReason}
                                onChange={(event) => setDisputeReason(event.target.value)}
                                placeholder="Missing package, damaged item, wrong item"
                            />
                        </label>
                        <label className="field">
                            <span>Details</span>
                            <textarea
                                className="form-input"
                                rows={5}
                                value={disputeDetails}
                                onChange={(event) => setDisputeDetails(event.target.value)}
                                placeholder="Add timeline, tracking condition, and evidence summary"
                            />
                        </label>
                        <div className="management-actions">
                            <button type="button" className="danger-button" onClick={() => void openDispute()} disabled={disputeSaving}>
                                {disputeSaving ? 'Submitting...' : 'Submit dispute'}
                            </button>
                            <button type="button" className="secondary-button" onClick={() => setDisputeOrder(null)} disabled={disputeSaving}>
                                Cancel
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default OrdersPage;
