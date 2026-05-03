export const getPersistentItem = (key: string): string | null => {
    return window.localStorage.getItem(key);
};

export const setPersistentItem = (key: string, value: string): void => {
    window.localStorage.setItem(key, value);
};

export const removePersistentItem = (key: string): void => {
    window.localStorage.removeItem(key);
};