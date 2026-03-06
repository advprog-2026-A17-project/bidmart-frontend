import React, { useState, useEffect } from 'react';

// Mendefinisikan tipe data sesuai dengan model Item Anda di Java
interface Item {
    id: number;
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
    const [listings, setListings] = useState<Item[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // fungsi untuk mengambil data dari backend spring boot
    useEffect(() => {
        const fetchListings = async () => {
            try {
                const response = await fetch('http://localhost:8080/api/catalogue/listings/search');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setListings(data);
                setLoading(false);
            } catch (err) {
                console.error("Gagal mengambil data:", err);
                setError("Gagal mengambil data dari server. Pastikan Spring Boot menyala!");
                setLoading(false);
            }
        };

        fetchListings();
    }, []);

    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Memuat katalog...</div>;
    if (error) return <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>{error}</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Katalog Produk BidMart</h1>

            {listings.length === 0 ? (
                <p style={{ textAlign: 'center', fontStyle: 'italic', color: '#666' }}>Belum ada produk lelang yang aktif saat ini.</p>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '20px'
                }}>
                    {listings.map(item => (
                        <div key={item.id} style={{
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            padding: '15px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}>
                            {/* jika imageUrl kosong, tampilkan gambar placeholder */}
                            <img
                                src={item.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image'}
                                alt={item.title}
                                style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px' }}
                            />
                            <h3 style={{ margin: '15px 0 10px 0' }}>{item.title}</h3>
                            <p style={{ color: '#555', fontSize: '0.9em' }}>{item.description}</p>
                            <h2 style={{ color: '#28a745', margin: '10px 0' }}>
                                Rp {item.currentPrice.toLocaleString('id-ID')}
                            </h2>
                            <p style={{ fontSize: '0.8em', color: '#888' }}>
                                Berakhir: {new Date(item.endTime).toLocaleString('id-ID')}
                            </p>
                            <p style={{ fontSize: '0.8em', color: '#888' }}>Penjual: {item.sellerId}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CatalogPage;