import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AuctionDetailPage from './modules/auction/pages/AuctionDetailPage';
import './App.css';

const CatalogDashboard = () => <div><h2>Catalogue Dashboard</h2><p>PIC: Jovanus</p></div>;
const LoginPage = () => <div><h2>Login Page</h2><p>PIC: Pradipta</p></div>;
const WalletDashboard = () => <div><h2>My Wallet</h2><p>PIC: William</p></div>;

const Navbar = () => (
    <nav style={{ padding: '1rem', background: '#2b6cb0', color: 'white', display: 'flex', gap: '15px' }}>
        <strong>BidMart</strong>
        <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Home (Catalogue)</Link>
        <Link to="/auctions/demo" style={{ color: 'white', textDecoration: 'none' }}>Live Auction</Link>
        <Link to="/wallet" style={{ color: 'white', textDecoration: 'none' }}>Wallet</Link>
        <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>Login</Link>
    </nav>
);

function App() {
    return (
        <Router>
            <div className="app-container">
                <Navbar />
                <main style={{ padding: '20px' }}>
                    <Routes>
                        <Route path="/" element={<CatalogDashboard />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/auctions/:id" element={<AuctionDetailPage />} />
                        <Route path="/wallet" element={<WalletDashboard />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;