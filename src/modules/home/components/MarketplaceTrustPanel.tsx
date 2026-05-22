const trustItems = [
    {
        icon: 'account_balance_wallet',
        title: 'Wallet-backed bidding',
        copy: 'Funds are held before bids, reducing failed settlements and unclear winner states.',
    },
    {
        icon: 'notifications_active',
        title: 'Realtime auction signals',
        copy: 'Bid, outbid, and order updates stay visible across marketplace and notification views.',
    },
    {
        icon: 'local_shipping',
        title: 'Order follow-through',
        copy: 'Winning auctions continue into order, dispute, and payout workflows with clear status.',
    },
];

export default function MarketplaceTrustPanel() {
    return (
        <section className="home-section trust-panel" aria-labelledby="trust-panel-heading">
            <div className="section-title-row">
                <div>
                    <p className="eyebrow">Why BidMart</p>
                    <h2 id="trust-panel-heading">Built for serious marketplace workflows</h2>
                </div>
            </div>
            <div className="trust-grid">
                {trustItems.map((item) => (
                    <article key={item.title} className="trust-card">
                        <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                        <div>
                            <strong>{item.title}</strong>
                            <p>{item.copy}</p>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
