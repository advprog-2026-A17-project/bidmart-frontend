import { apiUrl } from '../../../config/api';
import { readApiError } from '../../../config/apiClient';
import type { AuthLoginResult } from '../../../context/auth-context';

export type LoginResponsePayload = AuthLoginResult | { challengeToken: string };

export type LoginOutcome =
    | { kind: 'success'; payload: AuthLoginResult }
    | { kind: 'challenge'; token: string }
    | { kind: 'error'; message: string; code?: string };

export type RegistrationOutcome =
    | { kind: 'success' }
    | { kind: 'error'; message: string; code?: string };

export const isTwoFactorChallenge = (payload: LoginResponsePayload): payload is { challengeToken: string } =>
    'challengeToken' in payload;

export const postJson = async <T,>(path: string, body: unknown): Promise<{ response: Response; payload: T | null; error?: any }> => {
    const response = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    
    if (response.ok) {
        const payload = await response.json() as T;
        return { response, payload };
    } else {
        const error = await response.json().catch(() => ({}));
        return { response, payload: null, error };
    }
};

export const requestLogin = async (email: string, password: string): Promise<LoginOutcome> => {
    const { response, payload, error } = await postJson<LoginResponsePayload>('/api/v1/auth/login', { email, password });

    if (!response.ok) {
        return { 
            kind: 'error', 
            message: error?.message ?? `Login failed: HTTP ${response.status}`,
            code: error?.error
        };
    }
    if (!payload) {
        return { kind: 'error', message: 'Login failed: empty response.' };
    }
    if (isTwoFactorChallenge(payload)) {
        return { kind: 'challenge', token: payload.challengeToken };
    }
    return { kind: 'success', payload };
};

export const requestTwoFactorLogin = async (challengeToken: string, code: string): Promise<LoginOutcome> => {
    const { response, payload } = await postJson<AuthLoginResult>(
        '/api/v1/auth/2fa/login-verify',
        { challengeToken, code },
    );

    if (!response.ok) {
        return { kind: 'error', message: await readApiError(response, 'Two-factor verification failed') };
    }
    if (!payload) {
        return { kind: 'error', message: 'Two-factor verification failed: empty response.' };
    }
    return { kind: 'success', payload };
};

export const requestRegistration = async (email: string, password: string, role: string): Promise<RegistrationOutcome> => {
    const { response, error } = await postJson<unknown>('/api/v1/auth/register', { email, password, role });

    if (response.ok) {
        return { kind: 'success' };
    }

    return { 
        kind: 'error', 
        message: error?.message ?? `Registration failed: HTTP ${response.status}`,
        code: error?.error
    };
};

export const requestEmailVerification = async (token: string): Promise<{ kind: 'success' } | { kind: 'error'; message: string }> => {
    const response = await fetch(apiUrl('/api/v1/auth/verify-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    });

    if (response.ok) {
        return { kind: 'success' };
    }

    const errData = await response.json().catch(() => ({})) as { message?: string };
    return { kind: 'error', message: errData.message ?? 'Verification failed. The link may be invalid or expired.' };
};