self.addEventListener('push', (event) => {
    const fallback = { title: 'BidMart', body: 'You have a new notification.' };
    const payload = event.data ? event.data.json() : fallback;

    event.waitUntil(
        self.registration.showNotification(payload.title || fallback.title, {
            body: payload.body || fallback.body,
            icon: '/vite.svg',
            badge: '/vite.svg',
            data: payload,
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow('/');
        })
    );
});
