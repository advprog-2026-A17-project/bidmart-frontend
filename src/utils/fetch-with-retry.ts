export type FetchWithRetryOptions = {
    retries?: number;
    retryDelayMs?: number;
    retryOn?: (response: Response) => boolean;
};

const DEFAULT_RETRY_ON = (response: Response) =>
    response.status === 502 || response.status === 503 || response.status === 504;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    options: FetchWithRetryOptions = {},
): Promise<Response> {
    const retries = options.retries ?? 2;
    const retryDelayMs = options.retryDelayMs ?? 400;
    const retryOn = options.retryOn ?? DEFAULT_RETRY_ON;

    let attempt = 0;
    let lastResponse: Response | null = null;

    while (attempt <= retries) {
        const response = await fetch(input, init);
        if (!retryOn(response) || attempt === retries) {
            return response;
        }
        lastResponse = response;
        attempt += 1;
        await sleep(retryDelayMs * attempt);
    }

    return lastResponse ?? fetch(input, init);
}
