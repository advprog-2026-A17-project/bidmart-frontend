export const MAX_AVATAR_IMAGE_BYTES = 600 * 1024;

export const isValidImageReference = (imageUrl: string): boolean => {
    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl) return true;
    if (/^data:image\/(png|jpe?g|webp);base64,/i.test(trimmedUrl)) return true;
    try {
        const parsed = new URL(trimmedUrl);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

export const readAvatarImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Unable to read image file.'));
        reader.readAsDataURL(file);
    });
