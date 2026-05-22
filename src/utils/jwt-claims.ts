/**
 * Reads JWT payload claims for client-side session timing only.
 * Tokens are validated by the API gateway; never use these claims for authorization.
 */
export const readJwtPayload = (token: string | null): Record<string, unknown> | null => {
    if (!token) {
        return null;
    }
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }

        const base64Url = parts[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }

        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
                .join(''),
        );

        return JSON.parse(jsonPayload) as Record<string, unknown>;
    } catch {
        return null;
    }
};

export const readJwtStringClaim = (token: string | null, claim: string): string | null => {
    const payload = readJwtPayload(token);
    const value = payload?.[claim];
    return typeof value === 'string' ? value : null;
};

export const readJwtNumericClaim = (token: string | null, claim: string): number | null => {
    const payload = readJwtPayload(token);
    const value = payload?.[claim];
    return typeof value === 'number' ? value : null;
};
