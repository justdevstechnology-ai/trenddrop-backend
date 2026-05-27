// Import Firebase scripts for push notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Firebase config
firebase.initializeApp({
  apiKey: "AIzaSyBPFk5dgQufe7iSN49e93onlPw0EZJmPeU",
  authDomain: "trenddrop-3f5e4.firebaseapp.com",
  projectId: "trenddrop-3f5e4",
  storageBucket: "trenddrop-3f5e4.appspot.com",
  messagingSenderId: "839968116137",
  appId: "1:839968116137:web:146ddea9cdb9ae5410c8b8"
});

const messaging = firebase.messaging();

// Handle background push notifications
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Click handler for notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Cache config
const CACHE_NAME = "trenddrop-v3";

const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/main-app.js",
  "/main-firebase.js",
  "/main-auth.js",
  "/main-products.js"
];

// INSTALL
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(err => console.log('Cache addAll error:', err)))
  );
});

// ACTIVATE - Delete old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  return self.clients.claim();
});

// FETCH - Cache first, then network
self.addEventListener("fetch", (e) => {
  // Skip Firebase/Chrome extension requests
  if (e.request.url.includes('firestore.googleapis.com') || 
      e.request.url.includes('firebaseinstallations') ||
      e.request.url.includes('chrome-extension')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request)
      .then(res => res || fetch(e.request))
      .catch(() => caches.match("/index.html"))
  );
});
