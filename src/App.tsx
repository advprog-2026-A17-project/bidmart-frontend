import { useState, useEffect } from 'react'
import './App.css'

interface Item {
    id: number;
    title: string;
    description: string;
    imageUrl: string | null;
    currentPrice: number;
    endTime: string;
    sellerId: string;
}

function App() {
    const [listings, setListings] = useState<Item[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // tembak API Backend catalogue
        fetch('http://localhost:8000/api/v1/catalogue/listings/search')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                setListings(data); // simpan datanya ke wadah
                setLoading(false); // matikan status loading
            })
            .catch(err => {
                console.error("Gagal fetch data:", err);
                setError("Gagal terhubung ke server. Pastikan Spring Boot menyala!");
                setLoading(false);
            });
    }, []);

    return (
        <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
            <h1 style={{ textAlign: 'center' }}>Katalog BidMart</h1>

            {loading && <p style={{ textAlign: 'center' }}>Memuat katalog...</p>}

            {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

            {!loading && !error && listings.length === 0 && (
                <p style={{ textAlign: 'center' }}>Belum ada produk lelang yang aktif saat ini.</p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', marginTop: '30px' }}>
                {listings.map(item => (
                    <div key={item.id} style={{
                        border: '1px solid #ddd',
                        padding: '20px',
                        borderRadius: '12px',
                        width: '300px',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                        backgroundColor: 'white',
                        color: 'black'
                    }}>
                        <h3 style={{ marginTop: 0 }}>{item.title}</h3>
                        <p style={{ color: '#555' }}>{item.description}</p>
                        <h2 style={{ color: '#28a745' }}>Rp {item.currentPrice.toLocaleString('id-ID')}</h2>
                        <p style={{ fontSize: '14px', color: '#888' }}>Penjual: {item.sellerId}</p>
                        <p style={{ fontSize: '12px', color: '#aaa' }}>
                            Berakhir: {new Date(item.endTime).toLocaleString('id-ID')}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default App