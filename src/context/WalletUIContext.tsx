import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface WalletUIContextType {
    showBalance: boolean;
    setShowBalance: React.Dispatch<React.SetStateAction<boolean>>;
}

const WalletUIContext = createContext<WalletUIContextType | undefined>(undefined);

export const WalletUIProvider = ({ children }: { children: ReactNode }) => {
    const [showBalance, setShowBalance] = useState(true);

    return (
        <WalletUIContext.Provider value={{ showBalance, setShowBalance }}>
            {children}
        </WalletUIContext.Provider>
    );
};

export const useWalletUI = () => {
    const context = useContext(WalletUIContext);
    if (!context) {
        throw new Error('useWalletUI must be used within a WalletUIProvider');
    }
    return context;
};
