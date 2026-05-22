import React, { createContext, useContext, useState, type ReactNode } from 'react';

type WalletSnapshot = {
    activeBalance: number | null;
    heldBalance: number | null;
} | null;

interface WalletUIContextType {
    showBalance: boolean;
    setShowBalance: React.Dispatch<React.SetStateAction<boolean>>;
    walletSnapshot: WalletSnapshot;
    setWalletSnapshot: React.Dispatch<React.SetStateAction<WalletSnapshot>>;
}

const WalletUIContext = createContext<WalletUIContextType | undefined>(undefined);

export const WalletUIProvider = ({ children }: { children: ReactNode }) => {
    const [showBalance, setShowBalance] = useState(true);
    const [walletSnapshot, setWalletSnapshot] = useState<WalletSnapshot>(null);

    return (
        <WalletUIContext.Provider value={{ showBalance, setShowBalance, walletSnapshot, setWalletSnapshot }}>
            {children}
        </WalletUIContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWalletUI = () => {
    const context = useContext(WalletUIContext);
    if (!context) {
        throw new Error('useWalletUI must be used within a WalletUIProvider');
    }
    return context;
};
