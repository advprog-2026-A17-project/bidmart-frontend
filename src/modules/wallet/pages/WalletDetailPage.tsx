import { useState, useEffect } from 'react';

export default function WalletPage() {
    const [userId, setUserId] = useState("111");
    const [dompet, setDompet] = useState(null);
    const [history, setHistory] = useState([]);
    const [amount, setAmount] = useState("");
    const [pesan, setPesan] = useState("Memuat data...");
    const fetchDompet = async () => {
        try {
            const res = await fetch(`http://localhost:8000/api/v1/wallet/${userId}`);
            if (res.ok) {
                const data = await res.json();
                setDompet(data.wallet);
                setHistory(data.history);
                setPesan("Data dompet berhasil dimuat! ✅");
            } else {
                setPesan("Dompet belum ada. Silakan buat dompet terlebih dahulu. ⚠️");
                setDompet(null);
                setHistory([]);
            }
        } catch (error) {
            setPesan("Koneksi ke Gateway (Port 8000) terputus! ❌");
        }
    };

    const buatDompet = async () => {
        try {
            const res = await fetch(`http://localhost:8000/api/v1/wallet/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, activeBalance: 0, heldBalance: 0 })
            });
            if (res.ok) {
                fetchDompet();
            }
        } catch (error) {
            setPesan("Gagal membuat dompet baru.");
        }
    };

    const aksiTransaksi = async (endpoint: string) => {
        if (!amount || Number(amount) <= 0) {
            setPesan("Masukkan nominal uang yang valid! ⚠️");
            return;
        }

        try {
            const res = await fetch(`http://localhost:8000/api/v1/wallet/${userId}/${endpoint}?amount=${amount}`, {
                method: 'POST'
            });

            if (res.ok) {
                setPesan(`Transaksi ${endpoint} sebesar Rp ${amount} Berhasil! 🎉`);
                setAmount("");
                fetchDompet();
            } else {
                setPesan(`Transaksi Gagal! Saldo mungkin tidak mencukupi. ❌`);
            }
        } catch (error) {
            setPesan("Terjadi kesalahan jaringan.");
        }
    };

    useEffect(() => {
        fetchDompet();
    }, []);

    const formatRupiah = (angka: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(angka || 0);
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#0a192f',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            boxSizing: 'border-box'
        }}>

            <div style={{
                width: '100%',
                maxWidth: '600px',
                backgroundColor: '#ffffff',
                padding: '40px',
                borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                fontFamily: 'Arial, sans-serif',
                color: '#333'
            }}>
                <h1 style={{ textAlign: 'center', color: '#0a192f', marginTop: 0 }}>DOMPET USER</h1>

                <div style={{ padding: '12px', backgroundColor: '#e8f4f8', borderLeft: '5px solid #3498db', marginBottom: '25px', borderRadius: '4px' }}>
                    <strong>Status:</strong> {pesan}
                </div>

                {!dompet && (
                    <div style={{ textAlign: 'center', padding: '30px 20px', border: '2px dashed #ccc', borderRadius: '12px' }}>
                        <p style={{ marginBottom: '20px' }}>Akun dengan ID {userId} belum memiliki dompet di database.</p>
                        <button onClick={buatDompet} style={btnStyle('#27ae60')}>Buat Dompet Baru</button>
                    </div>
                )}

                {dompet && (
                    <>

                        <div style={{ background: 'linear-gradient(135deg, #1e3c72, #2a5298)', color: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                            <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>ID Pengguna: {dompet.userId}</p>
                            <h2 style={{ margin: '10px 0', fontSize: '36px' }}>{formatRupiah(dompet.activeBalance)}</h2>
                            <p style={{ margin: 0, fontSize: '15px' }}>Saldo Tertahan (Bidding): <strong>{formatRupiah(dompet.heldBalance)}</strong></p>
                        </div>

                        <div style={{ marginTop: '30px', padding: '25px', backgroundColor: '#f4f7f6', borderRadius: '12px', border: '1px solid #e1e8ed' }}>
                            <h3 style={{ marginTop: 0, color: '#2c3e50' }}>Mulai Transaksi</h3>
                            <input
                                type="number"
                                placeholder="Masukkan nominal (Misal: 50000)"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #bdc3c7', boxSizing: 'border-box', fontSize: '16px' }}
                            />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => aksiTransaksi('top-up')} style={btnStyle('#27ae60')}>Top Up</button>
                                <button onClick={() => aksiTransaksi('withdraw')} style={btnStyle('#e74c3c')}>Tarik Tunai</button>
                                <button onClick={() => aksiTransaksi('trybid')} style={btnStyle('#f39c12')}>Coba Bid</button>
                            </div>
                        </div>

                        <div style={{ marginTop: '30px' }}>
                            <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Riwayat Transaksi</h3>
                            {history.length === 0 ? (
                                <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>Belum ada transaksi.</p>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, maxHeight: '250px', overflowY: 'auto' }}>
                                    {history.map((tx: any, index: number) => (
                                        <li key={index} style={{ padding: '15px 10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '14px', padding: '4px 8px', borderRadius: '4px', backgroundColor: tx.type === 'TOP_UP' ? '#e8f8f5' : tx.type === 'BID' ? '#fef5e7' : '#fdedec', color: tx.type === 'TOP_UP' ? '#27ae60' : tx.type === 'BID' ? '#f39c12' : '#e74c3c' }}>
                                                {tx.type}
                                            </span>
                                            <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{formatRupiah(tx.amount)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const btnStyle = (bgColor: string) => ({
    flex: 1,
    padding: '12px',
    backgroundColor: bgColor,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'opacity 0.2s, transform 0.1s',
});