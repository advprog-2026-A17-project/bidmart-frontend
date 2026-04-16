import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/useAuth';

interface Props {
    itemToEdit?: any | null; 
    onSuccess: () => void;   
    onCancel: () => void;    
}

const CreateListing: React.FC<Props> = ({ itemToEdit, onSuccess, onCancel }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        imageUrl: '',
        startingPrice: '',
        endTime: '',
        category: 'Elektronik',
    });

    const { user, accessToken } = useAuth();

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (itemToEdit) {
            const formattedDate = new Date(itemToEdit.endTime).toISOString().slice(0, 16);
            setFormData({
                title: itemToEdit.title,
                description: itemToEdit.description,
                imageUrl: itemToEdit.imageUrl || '',
                startingPrice: itemToEdit.startingPrice.toString(),
                endTime: formattedDate,
                category: itemToEdit.category || 'Elektronik',
            });
        }
    }, [itemToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const payload = {
            title: formData.title,
            description: formData.description,
            imageUrl: formData.imageUrl,
            startingPrice: parseFloat(formData.startingPrice),
            currentPrice: itemToEdit ? itemToEdit.currentPrice : parseFloat(formData.startingPrice),
            endTime: formData.endTime.length === 16 ? formData.endTime + ':00' : formData.endTime,
            status: 'ACTIVE',
            sellerId: user?.id || 'unknown',
            category: formData.category
        };

        try {
            const url = itemToEdit
                ? `http://localhost:8000/api/v1/catalogue/listings/${itemToEdit.id}`
                : `http://localhost:8000/api/v1/catalogue/listings`;

            const method = itemToEdit ? 'PUT' : 'POST';
            
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Gagal menyimpan produk');

            setMessage({ text: `Produk berhasil ${itemToEdit ? 'diperbarui' : 'ditambahkan'}!`, type: 'success' });

            setTimeout(() => {
                onSuccess();
            }, 1500);

        } catch (error) {
            console.error("Error:", error);
            setMessage({ text: 'Terjadi kesalahan saat menyimpan produk.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel" style={{ padding: '40px', maxWidth: '650px', margin: '40px auto 0 auto', position: 'relative', overflow: 'hidden' }}>
            {/* Background glowing effects for the form */}
            <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'var(--accent-primary)', filter: 'blur(80px)', opacity: 0.3, zIndex: 0 }}></div>
            <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', width: '150px', height: '150px', background: 'var(--accent-secondary)', filter: 'blur(80px)', opacity: 0.3, zIndex: 0 }}></div>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
                <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '30px', textAlign: 'center' }}>
                    {itemToEdit ? 'Edit Produk Lelang' : 'Buat Listing Baru'}
                </h2>

                {message && (
                    <div style={{ 
                        padding: '16px', 
                        marginBottom: '25px', 
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                        color: message.type === 'success' ? 'var(--success)' : 'var(--danger)', 
                        borderLeft: `4px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                        borderRadius: '0 8px 8px 0',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        {message.type === 'success' ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        )}
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    <div className="input-group">
                        <label>Nama Produk</label>
                        <input required type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Contoh: iPhone 15 Pro Max 256GB" />
                    </div>

                    <div className="input-group">
                        <label>Deskripsi Detail</label>
                        <textarea required name="description" value={formData.description} onChange={handleChange} rows={4} placeholder="Jelaskan kondisi, spesifikasi, dan kelengkapan barang..." />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="input-group">
                            <label>Kategori</label>
                            <select 
                                required 
                                name="category" 
                                value={formData.category} 
                                onChange={handleChange} 
                                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                            >
                                <option value="Elektronik" style={{color: 'black'}}>Elektronik</option>
                                <option value="Fashion" style={{color: 'black'}}>Fashion</option>
                                <option value="Kendaraan" style={{color: 'black'}}>Kendaraan</option>
                                <option value="Properti" style={{color: 'black'}}>Properti</option>
                                <option value="Olahraga" style={{color: 'black'}}>Olahraga</option>
                                <option value="Lainnya" style={{color: 'black'}}>Lainnya</option>
                            </select>
                        </div>
                        
                        <div className="input-group">
                            <label>URL Gambar (Opsional)</label>
                            <input type="url" name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://contoh.com/gambar.jpg" style={{boxSizing: 'border-box', width: '100%'}} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="input-group">
                            <label>Harga Awal (Rp)</label>
                            <input required type="number" name="startingPrice" value={formData.startingPrice} onChange={handleChange} min="0" placeholder="1000000" />
                        </div>

                        <div className="input-group">
                            <label>Waktu Berakhir</label>
                            <input required type="datetime-local" name="endTime" value={formData.endTime} onChange={handleChange} style={{ colorScheme: 'dark' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2, padding: '14px', fontSize: '1rem', cursor: loading ? 'wait' : 'pointer' }}>
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                    Menyimpan...
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                    Simpan Produk
                                </span>
                            )}
                        </button>
                        <button type="button" onClick={onCancel} className="btn btn-danger" style={{ flex: 1, padding: '14px', fontSize: '1rem' }}>
                            Batal
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateListing;