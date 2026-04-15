const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

const normalizedBaseUrl = configuredBaseUrl.endsWith('/')
    ? configuredBaseUrl.slice(0, -1)
    : configuredBaseUrl;

export const apiUrl = (path: string): string => {
    if (!path.startsWith('/')) {
        throw new Error('API path must start with "/"');
    }
    return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
};
