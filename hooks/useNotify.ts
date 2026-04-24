import { useCallback } from 'react';

export type NotificationType = 'SUCCESS' | 'ALERT' | 'ERROR' | 'OFFLINE' | 'INFO';

export const useNotify = () => {
    const trigger = useCallback((type: NotificationType, message: string) => {
        const event = new CustomEvent('app-notification', { detail: { type, message } });
        window.dispatchEvent(event);
    }, []);

    return {
        success: useCallback((message: string) => trigger('SUCCESS', message), [trigger]),
        alert: useCallback((message: string) => trigger('ALERT', message), [trigger]),
        error: useCallback((message: string) => trigger('ERROR', message), [trigger]),
        offline: useCallback((message: string) => trigger('OFFLINE', message), [trigger]),
        info: useCallback((message: string) => trigger('INFO', message), [trigger]),
    };
};
