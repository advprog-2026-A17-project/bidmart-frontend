import { useEffect, useId } from 'react';
import { useToast, type ToastVariant } from '../context/ToastContext';

type PageToastProps = {
    error?: string | null;
    success?: string | null;
    notice?: string | null;
};

/**
 * Mirrors page-level error/success state into global bottom-right toast popups.
 * Renders nothing in the document flow.
 */
const PageToast: React.FC<PageToastProps> = ({ error, success, notice }) => {
    const { publish, dismissBySource } = useToast();
    const sourceId = useId();

    useEffect(() => {
        const errorMsg = error?.trim() ?? '';
        const successMsg = success?.trim() ?? '';
        const noticeMsg = notice?.trim() ?? '';

        let message = '';
        let variant: ToastVariant = 'success';

        if (errorMsg) {
            message = errorMsg;
            variant = 'error';
        } else if (successMsg) {
            message = successMsg;
        } else if (noticeMsg) {
            message = noticeMsg;
        }

        if (!message) {
            dismissBySource(sourceId);
            return;
        }

        publish(message, variant, { sourceId });
    }, [dismissBySource, error, notice, publish, sourceId, success]);

    return null;
};

export default PageToast;
