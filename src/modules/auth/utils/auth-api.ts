import { apiUrl } from '../../../config/api';
import { readApiError } from '../../../config/apiClient';
import type { AuthLoginResult } from '../../../context/auth-context';

export type LoginResponsePayload = AuthLoginResult | { challengeToken: string };

export type LoginOutcome =
    | { kind: 'success'; payload: AuthLoginResult }
    | { kind: 'challenge'; token: string }
    | { kind: 'error'; message: string };

export type RegistrationOutcome =
    | { kind: 'success' }
    | { kind: 'error'; message: string };

export const isTwoFactorChallenge = (payload: LoginResponsePayload): payload is { challengeToken: string } =>
    'challengeToken' in payload;

export const postJson = async <T,>(path: string, body: unknown): Promise<{ response: Response; payload: T | null }> => {
    const response = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const payload = response.ok ? await response.json() as T : null;
    return { response, payload };
};

export const requestLogin = async (email: string, password: string): Promise<LoginOutcome> => {
    const { response, payload } = await postJson<LoginResponsePayload>('/api/v1/auth/login', { email, password });

    if (response.status === 401) {
        return { kind: 'error', message: 'Invalid email or password.' };
    }
    if (!response.ok) {
        return { kind: 'error', message: `Login failed: HTTP ${response.status}` };
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

export const requestOAuthLogin = async (provider: 'google', idToken: string): Promise<LoginOutcome> => {
    const { response, payload } = await postJson<AuthLoginResult>(
        '/api/v1/auth/oauth/login',
        { provider, idToken },
    );

    if (!response.ok) {
        return { kind: 'error', message: await readApiError(response, 'OAuth login failed') };
    }
    if (!payload) {
        return { kind: 'error', message: 'OAuth login failed: empty response.' };
    }
    return { kind: 'success', payload };
};

export const requestRegistration = async (email: string, password: string, role: string): Promise<RegistrationOutcome> => {
    const response = await fetch(apiUrl('/api/v1/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
    });

    if (response.ok) {
        return { kind: 'success' };
    }

    const errData = await response.json().catch(() => ({})) as { message?: string };
    return { kind: 'error', message: errData.message ?? `Registration failed: HTTP ${response.status}` };
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