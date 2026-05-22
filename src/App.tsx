import { BrowserRouter as Router } from 'react-router-dom';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { NotificationsWebSocketProvider } from './context/NotificationsWebSocketContext';
import SessionSlidingRefresh from './context/SessionSlidingRefresh';
import { ToastProvider } from './context/ToastContext';
import { WalletUIProvider } from './context/WalletUIContext';
import AppRoutes from './layout/AppRoutes';
import Navbar from './layout/Navbar';
import './App.css';

function App() {
    return (
        <GlobalErrorBoundary>
            <ToastProvider>
                <AuthProvider>
                    <WalletUIProvider>
                        <NotificationsWebSocketProvider>
                            <Router>
                                <SessionSlidingRefresh />
                                <div className="app-shell">
                                    <Navbar />
                                    <div className="app-body app-body-public">
                                        <main className="app-main">
                                            <AppRoutes />
                                        </main>
                                    </div>
                                </div>
                            </Router>
                        </NotificationsWebSocketProvider>
                    </WalletUIProvider>
                </AuthProvider>
            </ToastProvider>
        </GlobalErrorBoundary>
    );
}

export default App;
