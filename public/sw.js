const CACHE_NAME = 'dubai-bus-buddy-v1';
const BASE_PATH = '/dubai-bus-buddy';
const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/assets/index-B2AojwPR.js`,
  `${BASE_PATH}/assets/index-BT-Ptn8g.css`
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercept network requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // If response is in cache, return cached response
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request).then(
          (response) => {
            // Check if response is valid
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New bus information update',
    icon: `${BASE_PATH}/icon-placeholder.svg`,
    badge: `${BASE_PATH}/icon-placeholder.svg`,
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: `${BASE_PATH}/icon-placeholder.svg`
      },
      {
        action: 'close',
        title: 'Close',
        icon: `${BASE_PATH}/icon-placeholder.svg`
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Bus Reminder', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow(`${BASE_PATH}/`)
    );
  }
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
