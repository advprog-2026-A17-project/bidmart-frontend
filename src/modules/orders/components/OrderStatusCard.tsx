import React from 'react';
import AppIcon from '../../../components/AppIcon';

export type OrderStatusValue =
    | 'CREATED'
    | 'PACKED'
    | 'SHIPPED'
    | 'CONFIRMED'
    | 'DISPUTED'
    | 'REFUNDED'
    | string;

type Step = {
    key: string;
    label: string;
    icon: React.ComponentProps<typeof AppIcon>['name'];
};

const FULFILLMENT_STEPS: Step[] = [
    { key: 'CREATED', label: 'Placed', icon: 'list' },
    { key: 'PACKED', label: 'Packed', icon: 'package' },
    { key: 'SHIPPED', label: 'Shipped', icon: 'truck' },
    { key: 'DONE', label: 'Complete', icon: 'check' },
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
        case 'REFUNDED':
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
            return 'Resolved for seller';
        case 'DISPUTED':
            return 'Dispute open';
        case 'REFUNDED':
            return 'Refunded to buyer';
        default:
            return status ? status.replaceAll('_', ' ') : 'Unknown status';
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
            return 'Dispute or delivery is resolved. Seller payout enters the hold window.';
        case 'DISPUTED':
            return 'Under review. Confirmation is paused until an admin resolves the dispute.';
        case 'REFUNDED':
            return 'The buyer won the dispute and the payment was refunded.';
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
    const isRefunded = status === 'REFUNDED';
    const isSellerResolved = status === 'CONFIRMED';
    const finalStepLabel = isDisputed ? 'In review' : isRefunded ? 'Refunded' : isSellerResolved ? 'Resolved' : 'Complete';
    const finalStepIcon: React.ComponentProps<typeof AppIcon>['name'] = isDisputed ? 'gavel' : isRefunded ? 'refresh' : 'check';

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
                                isFinal && (isDisputed || isRefunded) ? 'order-status-step-disputed' : '',
                                isFinal && active && !isDisputed ? 'order-status-step-active' : '',
                            ].filter(Boolean).join(' ')}
                        >
                            <span className="order-status-step-icon" aria-hidden="true">
                                <AppIcon name={icon} />
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
