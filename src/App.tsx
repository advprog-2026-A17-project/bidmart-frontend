import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import AuctionDetailPage from './modules/auction/pages/AuctionDetailPage';
import CataloguePage from './modules/catalogue/pages/CataloguePage';
import WalletPage from './modules/wallet/pages/WalletPage';
import LoginPage from './modules/auth/pages/LoginPage';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import './App.css';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav style={{ padding: '1rem', background: '#2b6cb0', color: 'white', display: 'flex', gap: '15px', alignItems: 'center' }}>
            <strong>BidMart</strong>
            <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Home (Catalogue)</Link>
            <Link to="/auctions/demo" style={{ color: 'white', textDecoration: 'none' }}>Live Auction</Link>
            <Link to="/wallet" style={{ color: 'white', textDecoration: 'none' }}>Wallet</Link>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {user ? (
                    <>
                        <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                            {user.email}
                            {user.roles?.length > 0 && (
                                <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 4, padding: '2px 6px', fontSize: '0.75rem' }}>
                                    {user.roles[0].name}
                                </span>
                            )}
                        </span>
                        <button
                            onClick={handleLogout}
                            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>Login</Link>
                )}
            </div>
        </nav>
    );
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="app-container">
                    <Navbar />
                    <main style={{ padding: '20px' }}>
                        <Routes>
                            <Route path="/" element={<CataloguePage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/auctions/:id" element={<AuctionDetailPage />} />
                            <Route path="/wallet" element={<WalletPage />} />
                        </Routes>
                    </main>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;