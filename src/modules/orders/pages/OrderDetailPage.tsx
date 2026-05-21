import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { isSellerUser } from '../../../context/primaryRole';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { formatMoney } from '../../../utils/money';
import OrderStatusCard from '../components/OrderStatusCard';

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
    disputeReason?: string | null;
    disputeDetails?: string | null;
    createdAt: string;
    updatedAt: string;
};

type ListingSummary = {
    id: string | number;
    title?: string | null;
    imageUrl?: string | null;
};

const CARRIER_OPTIONS = [
    'JNE',
    'J&T Express',
    'SiCepat',
    'Anteraja',
    'Pos Indonesia',
    'TIKI',
];

const OrderDetailPage: React.FC = () => {
    const { orderId } = useParams();
    const { user } = useAuth();
    const isSellerView = isSellerUser(user);
    const authenticatedFetch = useAuthenticatedFetch();
    const [order, setOrder] = useState<OrderRecord | null>(null);
    const [listing, setListing] = useState<ListingSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [selectedCarrier, setSelectedCarrier] = useState('');
    const [carrierError, setCarrierError] = useState<string | null>(null);
    const [disputeReason, setDisputeReason] = useState('Never received');
    const [disputeDetails, setDisputeDetails] = useState('');

    const isSeller = useMemo(() => user?.id && order?.sellerId === user.id, [order?.sellerId, user?.id]);
    const isBuyer = useMemo(() => user?.id && order?.buyerId === user.id, [order?.buyerId, user?.id]);

    const fetchOrder = useCallback(async () => {
        if (!orderId || !user) {
            setOrder(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/orders/${encodeURIComponent(orderId)}`));
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Order lookup failed'));
            }

            const payload = await response.json() as OrderRecord;
            setOrder(payload);
            // Pre-fill carrier from existing order data
            if (payload.carrier) {
                setSelectedCarrier(payload.carrier);
            }

            try {
                const listingResponse = await fetch(gatewayUrl(`/api/v1/catalogue/listings/${encodeURIComponent(payload.listingId)}`));
                if (listingResponse.ok) {
                    const listingPayload = await listingResponse.json() as ListingSummary | null;
                    setListing(listingPayload);
                } else {
                    setListing(null);
                }
            } catch {
                setListing(null);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to load order.');
            setOrder(null);
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch, orderId, user]);

    useEffect(() => {
        void fetchOrder();
    }, [fetchOrder]);

    const openDispute = async () => {
        if (!order) return;
        try {
            setError(null);
            setNotice(null);
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/orders/${encodeURIComponent(order.id)}/dispute`),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reason: disputeReason,
                        details: disputeDetails,
                    }),
                },
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Open dispute failed'));
            }
            setNotice('Dispute opened. An administrator will review your case.');
            await fetchOrder();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to open dispute.');
        }
    };

    const confirmReceipt = async () => {
        if (!order) return;
        try {
            setError(null);
            setNotice(null);
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/orders/${encodeURIComponent(order.id)}/confirm`), {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Confirm receipt failed'));
            }
            setNotice('Order receipt confirmed. Seller payout will be released after 5 minutes.');
            await fetchOrder();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to confirm receipt.');
        }
    };

    const updateShipping = async (nextStatus: 'PACKED' | 'SHIPPED') => {
        if (!order) return;

        // Carrier is required when marking as SHIPPED
        if (nextStatus === 'SHIPPED') {
            if (!selectedCarrier) {
                setCarrierError('Please select a courier before marking the order as shipped.');
                return;
            }
        }

        setCarrierError(null);
        try {
            setError(null);
            setNotice(null);
            const body: { status: string; carrier?: string } = { status: nextStatus };
            if (nextStatus === 'SHIPPED' && selectedCarrier) {
                body.carrier = selectedCarrier;
            }
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/orders/${encodeURIComponent(order.id)}/status`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Update shipping failed'));
            }
            setNotice('Shipping status updated.');
            await fetchOrder();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to update shipping.');
        }
    };

    if (loading) {
        return (
            <div className="page-wrap">
                <section className="page-head studio-head">
                    <BackButton fallback="/orders" />
                    <h1>Order Details</h1>
                </section>
                <div className="management-list skeleton-grid" aria-busy="true" aria-label="Loading order">
                    <span className="skeleton-line" />
                    <span className="skeleton-line skeleton-line-medium" />
                    <span className="skeleton-button" />
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="page-wrap">
                <section className="page-head studio-head">
                    <BackButton fallback="/orders" />
                    <h1>Order Details</h1>
                </section>
                {error && <div className="toast-error">{error}</div>}
                <section className="panel center-content">
                    <span className="material-symbols-outlined section-title-icon" aria-hidden="true">receipt_long</span>
                    <h2>Order not found</h2>
                    <p className="text-muted">We could not load the requested order.</p>
                    <Link className="primary-button" to="/orders">Back to orders</Link>
                </section>
            </div>
        );
    }

    return (
        <div className="page-wrap">
            <section className="page-head studio-head">
                <div>
                    <BackButton fallback="/orders" />
                    <p className="eyebrow">{isSellerView ? 'Seller Workspace' : 'Buyer Workspace'}</p>
                    <h1>Order Details</h1>
                    <p>Monitor shipping progress and finalize delivery confirmation.</p>
                </div>
                <Link className="secondary-button" to={`/listings/${order.listingId}`}>
                    <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
                    View Listing
                </Link>
            </section>

            {error && <div className="toast-error">{error}</div>}
            {notice && <div className="toast-success">{notice}</div>}

            <OrderStatusCard
                status={order.status}
                role={isSeller ? 'seller' : 'buyer'}
                trackingNumber={order.trackingNumber}
                carrier={order.carrier}
            />

            <article className="management-card">
                <div>
                    <h3>{listing?.title || 'Won Auction'}</h3>
                    <p className="text-muted">Created {new Date(order.createdAt).toLocaleString()}</p>
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
                        <span>Shipping Address</span>
                        <strong>{order.shippingAddress || 'Not provided'}</strong>
                    </div>
                    <div>
                        <span>Updated</span>
                        <strong>{new Date(order.updatedAt).toLocaleDateString()}</strong>
                    </div>
                </div>
                <div className="management-actions">
                    <Link className="secondary-button" to={`/active-auctions/${order.auctionId}`}>Auction</Link>
                    <Link className="secondary-button" to="/orders">All Orders</Link>
                </div>
            </article>

            {isSeller && order.status !== 'CONFIRMED' && (
                <section className="panel section-stack" style={{ marginTop: '1.5rem' }}>
                    <h2>Update Shipping</h2>
                    <p className="text-muted">Advance shipping status in order: Packed then Shipped.</p>

                    {/* Carrier dropdown — only shown when PACKED, right before marking as Shipped */}
                    {order.status === 'PACKED' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '20rem' }}>
                            <label htmlFor="carrier-select" style={{ fontWeight: 600 }}>
                                Courier <span style={{ color: 'var(--color-danger, #e55)' }}>*</span>
                            </label>
                            <select
                                id="carrier-select"
                                value={selectedCarrier}
                                onChange={(e) => {
                                    setSelectedCarrier(e.target.value);
                                    setCarrierError(null);
                                }}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    border: `1px solid ${carrierError ? 'var(--color-danger, #e55)' : 'var(--color-border, #333)'}`,
                                    background: 'var(--color-surface, #1e1e2e)',
                                    color: 'var(--color-text, #fff)',
                                    fontSize: '0.95rem',
                                }}
                            >
                                <option value="">— Select courier —</option>
                                {CARRIER_OPTIONS.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            {carrierError && (
                                <p style={{ color: 'var(--color-danger, #e55)', margin: 0, fontSize: '0.875rem' }}>
                                    {carrierError}
                                </p>
                            )}
                        </div>
                    )}

                    {order.status === 'CREATED' && (
                        <button type="button" className="primary-button" onClick={() => updateShipping('PACKED')}>
                            Mark as Packed
                        </button>
                    )}
                    {order.status === 'PACKED' && (
                        <button type="button" className="primary-button" onClick={() => updateShipping('SHIPPED')}>
                            Mark as Shipped
                        </button>
                    )}
                    {order.status === 'SHIPPED' && (
                        <div className="text-muted">Order already shipped.</div>
                    )}
                </section>
            )}

            {isBuyer && order.status === 'SHIPPED' && (
                <section className="panel section-stack" style={{ marginTop: '1.5rem' }}>
                    <h2>Confirm Receipt</h2>
                    <p className="text-muted">Confirm when the order has arrived. This releases the seller payout after 5 minutes.</p>
                    <button type="button" className="primary-button" onClick={confirmReceipt}>
                        Confirm Receipt
                    </button>
                </section>
            )}

            {isBuyer && order.status === 'SHIPPED' && (
                <section className="panel section-stack" style={{ marginTop: '1.5rem' }}>
                    <h2>Open Dispute</h2>
                    <p className="text-muted">Report delivery issues before confirming receipt.</p>
                    <label>
                        Reason
                        <input value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} />
                    </label>
                    <label>
                        Details
                        <textarea value={disputeDetails} onChange={(event) => setDisputeDetails(event.target.value)} />
                    </label>
                    <button type="button" className="danger-button" onClick={openDispute}>
                        Open Dispute
                    </button>
                </section>
            )}

            {order.status === 'DISPUTED' && (
                <section className="panel section-stack" style={{ marginTop: '1.5rem' }}>
                    <h2>Dispute in review</h2>
                    <p className="text-muted">{order.disputeReason || 'Dispute opened'}</p>
                    {order.disputeDetails && <p>{order.disputeDetails}</p>}
                </section>
            )}
        </div>
    );
};

export default OrderDetailPage;
