import React from 'react';

export type OrderStatusValue =
    | 'CREATED'
    | 'PACKED'
    | 'SHIPPED'
    | 'CONFIRMED'
    | 'DISPUTED'
    | string;

type Step = {
    key: string;
    label: string;
    icon: string;
};

const FULFILLMENT_STEPS: Step[] = [
    { key: 'CREATED', label: 'Placed', icon: 'receipt_long' },
    { key: 'PACKED', label: 'Packed', icon: 'inventory_2' },
    { key: 'SHIPPED', label: 'Shipped', icon: 'local_shipping' },
    { key: 'DONE', label: 'Complete', icon: 'check_circle' },
];

const statusRank = (status: OrderStatusValue): number => {
    switch (status) {
        case 'CREATED':
            return 0;
        case 'PACKED':
            return 1;
        case 'SHIPPED':
            return 2;
        case 'CONFIRMED':
        case 'DISPUTED':
            return 3;
        default:
            return 0;
    }
};

const statusHeadline = (status: OrderStatusValue): string => {
    switch (status) {
        case 'CREATED':
            return 'Awaiting packing';
        case 'PACKED':
            return 'Ready to ship';
        case 'SHIPPED':
            return 'In transit';
        case 'CONFIRMED':
            return 'Delivered & confirmed';
        case 'DISPUTED':
            return 'Dispute open';
        default:
            return status;
    }
};

const statusHint = (status: OrderStatusValue, role?: 'seller' | 'buyer'): string => {
    switch (status) {
        case 'CREATED':
            return role === 'seller' ? 'Pack the item before shipping.' : 'Seller is preparing your order.';
        case 'PACKED':
            return role === 'seller' ? 'Add courier and tracking, then mark shipped.' : 'Seller will ship soon.';
        case 'SHIPPED':
            return role === 'buyer' ? 'Confirm receipt when the item arrives.' : 'Waiting for buyer confirmation.';
        case 'CONFIRMED':
            return 'Payout is scheduled for the seller.';
        case 'DISPUTED':
            return 'Under review — confirmation is paused.';
        default:
            return '';
    }
};

type OrderStatusCardProps = {
    status: OrderStatusValue;
    role?: 'seller' | 'buyer';
    compact?: boolean;
    trackingNumber?: string | null;
    carrier?: string | null;
};

const OrderStatusCard: React.FC<OrderStatusCardProps> = ({
    status,
    role,
    compact = false,
    trackingNumber,
    carrier,
}) => {
    const rank = statusRank(status);
    const isDisputed = status === 'DISPUTED';
    const finalStepLabel = isDisputed ? 'Disputed' : 'Complete';
    const finalStepIcon = isDisputed ? 'gavel' : 'check_circle';

    return (
        <section
            className={`order-status-card ${compact ? 'order-status-card-compact' : ''} order-status-${status.toLowerCase()}`}
            aria-label={`Order status: ${statusHeadline(status)}`}
        >
            <div className="order-status-card-header">
                <span className={`status-badge status-${status}`}>{statusHeadline(status)}</span>
                {!compact && (
                    <p className="order-status-card-hint text-muted">{statusHint(status, role)}</p>
                )}
            </div>

            <ol
                className={[
                    'order-status-steps',
                    `order-status-steps-rank-${rank}`,
                    isDisputed ? 'order-status-steps-disputed' : '',
                ].filter(Boolean).join(' ')}
            >
                {FULFILLMENT_STEPS.map((step, index) => {
                    const isFinal = step.key === 'DONE';
                    const stepRank = isFinal ? 3 : index;
                    const completed = rank > stepRank;
                    const active = rank === stepRank;
                    const label = isFinal ? finalStepLabel : step.label;
                    const icon = isFinal ? finalStepIcon : step.icon;

                    return (
                        <li
                            key={step.key}
                            className={[
                                'order-status-step',
                                completed ? 'order-status-step-done' : '',
                                active ? 'order-status-step-active' : '',
                                isFinal && isDisputed ? 'order-status-step-disputed' : '',
                                isFinal && active && !isDisputed ? 'order-status-step-active' : '',
                            ].filter(Boolean).join(' ')}
                        >
                            <span className="order-status-step-icon material-symbols-outlined" aria-hidden="true">
                                {icon}
                            </span>
                            <span className="order-status-step-label">{label}</span>
                        </li>
                    );
                })}
            </ol>

            {!compact && status === 'SHIPPED' && (trackingNumber || carrier) && (
                <div className="order-status-shipment-meta">
                    {carrier && <span><strong>Courier:</strong> {carrier}</span>}
                    {trackingNumber && <span><strong>Tracking:</strong> {trackingNumber}</span>}
                </div>
            )}
        </section>
    );
};

export default OrderStatusCard;
