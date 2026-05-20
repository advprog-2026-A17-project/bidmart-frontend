import { formatCents as formatIdrCents } from '../../../utils/money';

export interface PaymentIntent {
    paymentId: string;
    amountCents: number;
    status: string;
    redirectUrl: string;
    vaNumber?: string | null;
    paymentChannel?: string | null;
    createdAt?: string;
    updatedAt?: string;
    expiresAt?: string;
}

const PAYMENT_TTL_MS = 10 * 60 * 1000;
const paymentExpiryStorageKey = (paymentId: string): string => `bidmart:payment-expiry:${paymentId}`;

export const formatCents = (value: number | undefined): string => formatIdrCents(value);

export const formatPaymentMethod = (value?: string | null): string =>
    (value ?? '')
        .replace(/^local-/, '')
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.toUpperCase())
        .join(' ');

export const paymentReference = (paymentId: string): string => paymentId.slice(0, 8).toUpperCase();

export const rememberPaymentExpiry = (paymentId: string, expiresAt = Date.now() + PAYMENT_TTL_MS): number => {
    try {
        window.localStorage.setItem(paymentExpiryStorageKey(paymentId), String(expiresAt));
    } catch {
        // Local persistence is an enhancement; checkout still works without it.
    }
    return expiresAt;
};

const rememberedPaymentExpiry = (paymentId: string): number | null => {
    try {
        const value = window.localStorage.getItem(paymentExpiryStorageKey(paymentId));
        const parsed = value ? Number(value) : NaN;
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const parsePaymentDate = (value?: string | number | null): number | null => {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    if (typeof value === 'number') {
        const millis = value < 10_000_000_000 ? value * 1000 : value;
        return Number.isFinite(millis) ? millis : null;
    }

    const native = new Date(value).getTime();
    if (Number.isFinite(native)) {
        return native;
    }

    const sqlUtc = new Date(`${value.replace(' ', 'T')}Z`).getTime();
    return Number.isFinite(sqlUtc) ? sqlUtc : null;
};

export const paymentExpiryMs = (payment: PaymentIntent): number => {
    const remembered = rememberedPaymentExpiry(payment.paymentId);
    if (remembered !== null && payment.status === 'PENDING') {
        return remembered;
    }

    const expiresAt = parsePaymentDate(payment.expiresAt);
    if (expiresAt !== null) {
        return expiresAt;
    }

    const createdAt = parsePaymentDate(payment.createdAt);
    return (createdAt ?? Date.now()) + PAYMENT_TTL_MS;
};

export const formatRemainingTime = (remainingMs: number): string => {
    const safeMs = Math.max(0, remainingMs);
    const minutes = Math.floor(safeMs / 60_000);
    const seconds = Math.floor((safeMs % 60_000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
