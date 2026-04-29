import { apiUrl } from './api';

export const readApiError = async (response: Response, fallback: string): Promise<string> => {
    const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
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

export const gatewayUrl = apiUrl;
