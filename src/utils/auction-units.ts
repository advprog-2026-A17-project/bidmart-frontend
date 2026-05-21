export const centsToAmount = (value?: number | null): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return value / 100;
};

export const centsToAmountFromUnknown = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value / 100;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed / 100 : undefined;
    }
    return undefined;
};

export const toIsoFromUnixSeconds = (value?: number | null): string | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return new Date(value * 1000).toISOString();
};

/** Parse auction end/start from Unix seconds or ISO (always as UTC instant). */
export const parseAuctionEndTime = (value?: string | number | null): Date | null => {
    if (value == null || value === '') {
        return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const ms = value < 10_000_000_000 ? value * 1000 : value;
        const parsed = new Date(ms);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const raw = String(value).trim();
    if (!raw) {
        return null;
    }
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
        const ms = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
        const parsed = new Date(ms);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
        const parsed = new Date(`${raw}Z`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
