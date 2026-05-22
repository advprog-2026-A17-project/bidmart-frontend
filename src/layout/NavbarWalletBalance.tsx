import { useEffect } from 'react';
import { useAuthenticatedFetch } from '../context/useAuthenticatedFetch';
import { useNotificationsWebSocket } from '../context/useNotificationsWebSocket';
import { useWalletUI } from '../context/WalletUIContext';
import { walletApiRole } from '../context/primaryRole';
import { gatewayUrl } from '../config/apiClient';
import { formatCents } from '../modules/wallet/utils/payment';
import type { AuthUser } from '../context/auth-context';
import AppIcon from '../components/AppIcon';

interface NavbarWalletBalanceProps {
    user: AuthUser | null;
    isAdmin: boolean;
}

export default function NavbarWalletBalance({ user, isAdmin }: NavbarWalletBalanceProps) {
    const authenticatedFetch = useAuthenticatedFetch();
    const { isConnected, subscribe } = useNotificationsWebSocket();
    const { showBalance, setShowBalance, walletSnapshot, setWalletSnapshot } = useWalletUI();
    const walletBalance = walletSnapshot?.activeBalance ?? null;

    useEffect(() => {
        if (!user || isAdmin) {
            setWalletSnapshot(null);
            return;
        }

        let active = true;
        const marketplaceRole = walletApiRole(user);

        const fetchWallet = async () => {
            try {
                const response = await authenticatedFetch(
                    gatewayUrl(`/api/v1/wallet/${user.id}/detail?role=${marketplaceRole}`)
                );
                if (response.ok) {
                    const data = await response.json();
                    if (active) {
                        const wallet = data.wallet ?? data;
                        setWalletSnapshot({
                            activeBalance: wallet?.activeBalance ?? null,
                            heldBalance: wallet?.heldBalance ?? null,
                        });
                    }
                } else if (response.status === 404 || response.status === 500) {
                    if (active) setWalletSnapshot(null);
                }
            } catch (err) {
                console.error('Failed to fetch wallet for navbar:', err);
            }
        };

        void fetchWallet();

        if (isConnected) {
            const handleWalletEvent = (payload: unknown) => {
                const event = payload as { type?: string; payload?: { type?: string } };
                const type = String(event.payload?.type ?? event.type ?? '').toUpperCase();
                if (
                    ['BID_PLACED', 'OUTBID', 'AUCTION_WON', 'AUCTION_ENDED', 'ORDER_CREATED'].includes(type) ||
                    type.includes('WALLET') ||
                    type.includes('PAYMENT') ||
                    type.includes('WITHDRAW')
                ) {
                    void fetchWallet();
                }
            };
            const releaseQueue = subscribe('/user/queue/notifications', handleWalletEvent);
            const releaseTopic = subscribe(`/topic/notifications/users/${user.id}`, handleWalletEvent);
            return () => {
                active = false;
                releaseQueue();
                releaseTopic();
            };
        }

        return () => {
            active = false;
        };
    }, [user, isAdmin, authenticatedFetch, isConnected, subscribe, setWalletSnapshot]);

    if (walletBalance === null) return null;

    return (
        <div className="navbar-wallet-balance">
            <AppIcon name="wallet" size={18} />
            <strong>{showBalance ? formatCents(walletBalance) : '••••••'}</strong>
            <button
                type="button"
                className="icon-button"
                onClick={() => setShowBalance(prev => !prev)}
                aria-label={showBalance ? 'Hide balance' : 'Show balance'}
            >
                <AppIcon name={showBalance ? 'eyeOff' : 'eye'} size={18} />
            </button>
        </div>
    );
}
