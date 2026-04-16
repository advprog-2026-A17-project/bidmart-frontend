import React, { useState, useEffect } from 'react';
import CreateListing from './CreateListing';
import { useAuth } from '../../../context/useAuth';

export interface Item {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    startingPrice: number;
    currentPrice: number;
    endTime: string;
    sellerId: string;
    category: any;
}

const CatalogPage: React.FC = () => {
    const { user, accessToken } = useAuth();
    const isSeller = user?.roles?.some(r => r.name === 'SELLER');

    const [listings, setListings] = useState<Item[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);

    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchCategory, setSearchCategory] = useState('');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');

    const fetchListings = async (forcedReset = false) => {
        setLoading(true);
        try {
            let url = 'http://localhost:8000/api/v1/catalogue/listings';
            
            if (!forcedReset) {
                const queryParams = new URLSearchParams();
                if (searchKeyword.trim()) queryParams.append('keyword', searchKeyword.trim());
                if (searchCategory.trim()) queryParams.append('category', searchCategory.trim());
                if (minPrice.trim()) queryParams.append('minPrice', minPrice.trim());
                if (maxPrice.trim()) queryParams.append('maxPrice', maxPrice.trim());
                
                if (queryParams.toString()) {
                    url = `http://localhost:8000/api/v1/catalogue/listings/search?${queryParams.toString()}`;
                }
            }

            const headers: HeadersInit = {};
            if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            setListings(data);
            setError(null);
        } catch (err) {
            console.error("Gagal mengambil data:", err);
            setError("Gagal mengambil data dari server. Pastikan API Gateway dan Spring Boot menyala!");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchListings();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus produk lelang ini?")) return;

        try {
            const headers: HeadersInit = {};
            if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

            const response = await fetch(`http://localhost:8000/api/v1/catalogue/listings/${id}`, {
                method: 'DELETE',
                headers
            });

            if (!response.ok) throw new Error('Gagal menghapus produk');

            setListings(prev => prev.filter(item => item.id !== id));
            setView('list'); 
        } catch (error) {
            console.error("Error:", error);
            alert('Terjadi kesalahan saat menghapus produk.');
        }
    };

    const renderDetail = () => {
        if (!selectedItem) return null;
        return (
            <div className="glass-panel" style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
                <button className="btn btn-warning" onClick={() => setView('list')} style={{ marginBottom: '20px' }}>
                    ← Kembali ke Katalog
                </button>
                <h1 className="text-gradient" style={{ marginBottom: '20px' }}>{selectedItem.title}</h1>
                <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <img 
                        src={selectedItem.imageUrl || 'https://images.unsplash.com/photo-1588628566587-bf5c308d1326?auto=format&fit=crop&q=80&w=800'} 
                        alt={selectedItem.title} 
                        style={{ width: '100%', maxHeight: '450px', objectFit: 'cover' }} 
                    />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '5px' }}>Current Bid</p>
                        <h2 style={{ color: 'var(--success)', fontSize: '2.5rem', margin: 0 }}>
                            Rp {selectedItem.currentPrice.toLocaleString('id-ID')}
                        </h2>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '5px' }}>Harga Awal</p>
                        <h3 style={{ margin: 0 }}>Rp {selectedItem.startingPrice.toLocaleString('id-ID')}</h3>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Penjual</p>
                        <p style={{ fontWeight: 600 }}>{selectedItem.sellerId}</p>
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Berakhir pada</p>
                        <p style={{ fontWeight: 600, color: 'var(--warning)' }}>{new Date(selectedItem.endTime).toLocaleString('id-ID')}</p>
                    </div>
                </div>

                <div>
                    <h3 style={{ marginBottom: '15px', color: 'var(--accent-primary)' }}>Deskripsi Produk</h3>
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', color: 'var(--text-secondary)' }}>{selectedItem.description}</p>
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '40px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                <h1 className="text-gradient" style={{ fontSize: '3.5rem', marginBottom: '10px' }}>Katalog BidMart</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Temukan barang lelang impianmu hari ini</p>
            </div>

            {view === 'form' && (
                <CreateListing
                    itemToEdit={selectedItem}
                    onCancel={() => setView('list')}
                    onSuccess={() => {
                        fetchListings();
                        setView('list');
                    }}
                />
            )}

            {view === 'detail' && renderDetail()}

            {view === 'list' && (
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Semua Lelang</h2>
                        {isSeller && (
                            <button className="btn btn-primary" onClick={() => { setSelectedItem(null); setView('form'); }} style={{ padding: '12px 24px', fontSize: '1.1rem' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Tambah Produk
                            </button>
                        )}
                    </div>

                    {/* Filter Section */}
                    <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <input 
                                type="text" 
                                placeholder="Cari kata kunci..." 
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchListings(false)}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                            />
                        </div>
                        <div style={{ flex: '1 1 150px' }}>
                            <select 
                                value={searchCategory}
                                onChange={(e) => setSearchCategory(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                            >
                                <option value="" style={{color: 'black'}}>Semua Kategori</option>
                                <option value="Elektronik" style={{color: 'black'}}>Elektronik</option>
                                <option value="Fashion" style={{color: 'black'}}>Fashion</option>
                                <option value="Kendaraan" style={{color: 'black'}}>Kendaraan</option>
                                <option value="Properti" style={{color: 'black'}}>Properti</option>
                                <option value="Olahraga" style={{color: 'black'}}>Olahraga</option>
                                <option value="Lainnya" style={{color: 'black'}}>Lainnya</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flex: '1 1 200px', gap: '10px' }}>
                            <input 
                                type="number" 
                                placeholder="Min Harga" 
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchListings(false)}
                                style={{ width: '50%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                            />
                            <input 
                                type="number" 
                                placeholder="Max Harga" 
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchListings(false)}
                                style={{ width: '50%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                            />
                        </div>
                        <button 
                            className="btn btn-primary"
                            style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                            onClick={() => fetchListings(false)}
                        >
                            Cari
                        </button>
                        <button 
                            className="btn"
                            style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', cursor: 'pointer' }}
                            onClick={() => {
                                setSearchKeyword('');
                                setSearchCategory('');
                                setMinPrice('');
                                setMaxPrice('');
                                fetchListings(true);
                            }}
                        >
                            Reset
                        </button>
                    </div>

                    {loading && (
                        <div style={{ textAlign: 'center', padding: '50px 0' }}>
                            <div style={{ width: '50px', height: '50px', border: '3px solid var(--glass-border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                            <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>Memuat katalog kosmik...</p>
                        </div>
                    )}
                    
                    {error && (
                        <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '15px' }}><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            <h3 style={{ color: 'var(--danger)', marginBottom: '10px' }}>Koneksi Terputus</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
                        </div>
                    )}

                    {!loading && !error && listings.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.5 }}>🪐</div>
                            <h3>Ruang Kosong</h3>
                            <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>Belum ada produk lelang yang aktif saat ini. Mulailah dengan menambahkan satu!</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' }}>
                            {listings.map((item, i) => (
                                <div key={item.id} className="glass-panel card" style={{ animation: `fadeInUp 0.5s ease forwards ${(i%10)*0.1}s`, opacity: 0 }}>
                                    <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                                    
                                    <div className="card-img-wrapper" onClick={() => { setSelectedItem(item); setView('detail'); }} style={{ cursor: 'pointer' }}>
                                        <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '6px 12px', borderRadius: '20px', zIndex: 2, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            ⏳ {new Date(item.endTime).toLocaleDateString()}
                                        </div>
                                        <img
                                            src={item.imageUrl || `https://images.unsplash.com/photo-${1580000000000 + i}?auto=format&fit=crop&q=80&w=400&h=300`}
                                            alt={item.title}
                                            className="card-img"
                                            onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&q=80&w=400&h=300' }}
                                        />
                                    </div>
                                    
                                    <div style={{ padding: '24px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                        <h3 style={{ margin: '0 0 10px 0', cursor: 'pointer', fontSize: '1.4rem', lineHeight: '1.3' }} onClick={() => { setSelectedItem(item); setView('detail'); }}>
                                            {item.title}
                                        </h3>
                                        
                                        <div style={{ margin: '15px 0', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Current Bid</p>
                                            <div className="price-tag">Rp {item.currentPrice.toLocaleString('id-ID')}</div>
                                        </div>
                                        
                                        <div style={{ flexGrow: 1 }}></div>

                                        {isSeller && (
                                            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                                                <button className="btn btn-warning" onClick={() => { setSelectedItem(item); setView('form'); }} style={{ flex: 1 }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    Edit
                                                </button>
                                                <button className="btn btn-danger" onClick={() => handleDelete(item.id)} style={{ flex: 1 }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                    Hapus
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CatalogPage;