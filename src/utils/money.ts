export const normalizeMoneyInput = (value: string | number | null | undefined): string => {
    const normalizedValue = typeof value === 'number'
        ? value
        : String(value ?? '').trim().replace(',', '.');
    const numeric = typeof normalizedValue === 'number' ? normalizedValue : Number(normalizedValue || 0);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
};

export const normalizeRupiahInput = (value: string | number | null | undefined): string => {
    const normalizedValue = typeof value === 'number'
        ? value
        : String(value ?? '').trim().replace(',', '.');
    const numeric = typeof normalizedValue === 'number' ? normalizedValue : Number(normalizedValue || 0);
    return Number.isFinite(numeric) ? String(Math.round(numeric)) : '0';
};

export const toMoneyAmount = (value: string | number | null | undefined): number =>
    Number(normalizeMoneyInput(value));

export const toRupiahAmount = (value: string | number | null | undefined): number =>
    Number(normalizeRupiahInput(value));

export const toAmountCents = (value: string | number | null | undefined): number =>
    Math.round(toMoneyAmount(value) * 100);

export const formatMoney = (value: number | null | undefined): string =>
    `IDR ${normalizeMoneyInput(value)}`;

export const formatCents = (value: number | null | undefined): string =>
    formatMoney((value ?? 0) / 100);
