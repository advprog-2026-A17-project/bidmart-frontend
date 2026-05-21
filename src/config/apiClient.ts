export { apiUrl as gatewayUrl } from './api';

export const readApiJson = async <T>(response: Response): Promise<T | null> => {
    const text = await response.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
};

export const readApiError = async (response: Response, fallback: string): Promise<string> => {
    const payload = await readApiJson<{ message?: string; error?: string }>(response).catch(() => null);
    return payload?.message ?? payload?.error ?? `${fallback}: HTTP ${response.status}`;
};

export const buildJsonRequest = (accessToken: string | null, body?: unknown): RequestInit => ({
    method: body === undefined ? 'GET' : 'POST',
    headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
