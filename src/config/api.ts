const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

const normalizedApiBaseUrl = rawApiBaseUrl.endsWith('/')
    ? rawApiBaseUrl.slice(0, -1)
    : rawApiBaseUrl;

export const apiUrl = (path: string): string => {
    if (!path.startsWith('/')) {
        throw new Error('API path must start with "/"');
    }
    return normalizedApiBaseUrl ? `${normalizedApiBaseUrl}${path}` : path;
};
