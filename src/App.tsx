import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import AuctionDetailPage from './modules/auction/pages/AuctionDetailPage';
import CataloguePage from './modules/catalogue/pages/CataloguePage';
import SellPage from './modules/catalogue/pages/SellPage';
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
        <nav className="app-nav">
            <div className="app-brand-wrap">
                <div className="app-logo">BM</div>
                <strong className="app-brand">BidMart</strong>
            </div>
            <div className="app-nav-links">
                <Link to="/" className="app-nav-link">Explore</Link>
                <Link to="/auctions/demo" className="app-nav-link">Auction</Link>
                <Link to="/sell" className="app-nav-link">Sell</Link>
                <Link to="/wallet" className="app-nav-link">Wallet</Link>
            </div>
            <div className="app-nav-right">
                {user ? (
                    <>
                        <span className="app-user-pill">
                            {user.email}
                            {user.roles?.length > 0 && (
                                <span className="app-role-pill">
                                    {user.roles[0].name}
                                </span>
                            )}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="app-logout-button"
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <Link to="/login" className="app-logout-button">Sign In</Link>
                )}
            </div>
        </nav>
    );
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="app-shell">
                    <Navbar />
                    <main className="app-main">
                        <Routes>
                            <Route path="/" element={<CataloguePage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/auctions/:id" element={<AuctionDetailPage />} />
                            <Route path="/sell" element={<SellPage />} />
                            <Route path="/wallet" element={<WalletPage />} />
                        </Routes>
                    </main>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;
