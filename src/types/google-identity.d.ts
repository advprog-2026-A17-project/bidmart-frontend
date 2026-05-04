export {};

declare global {
    interface GoogleCredentialResponse {
        credential?: string;
        select_by?: string;
    }

    interface GoogleAccountsId {
        initialize(options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
        }): void;
        renderButton(parent: HTMLElement, options?: {
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'large' | 'medium' | 'small';
            text?: 'continue_with' | 'signin_with' | 'signup_with';
            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            width?: number;
        }): void;
        prompt: () => void;
    }

    interface GoogleAccounts {
        id: GoogleAccountsId;
    }

    interface GoogleApi {
        accounts: GoogleAccounts;
    }

    interface Window {
        google?: GoogleApi;
    }
}
