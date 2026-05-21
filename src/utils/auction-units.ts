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
