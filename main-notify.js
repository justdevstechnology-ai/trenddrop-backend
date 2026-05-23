import { db, auth } from './main-firebase.js';
import { AUTH } from './main-auth.js';
import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

export const NOTIFY = {
  messaging: null,
  vapidKey: 'YOUR_VAPID_KEY_HERE', // Get from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates

  async init() {
    try {
      if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.log('Notifications not supported');
        return;
      }

      NOTIFY.messaging = getMessaging();
      
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return;
      }
      
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      
      const token = await getToken(NOTIFY.messaging, {
        vapidKey: NOTIFY.vapidKey,
        serviceWorkerRegistration: registration
      });
      
      if (token) {
        await NOTIFY.saveToken(token);
        console.log('FCM Token:', token);
      }

      onMessage(NOTIFY.messaging, (payload) => {
        console.log('Message received:', payload);
        NOTIFY.showToast(payload.notification.title, payload.notification.body);
        
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmFgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
        audio.play().catch(()=>{});
      });

    } catch (e) {
      console.error('Notification init failed:', e);
    }
  },

  async saveToken(token) {
    if (!AUTH.user) return;
    await updateDoc(doc(db, "users", AUTH.user.uid), {
      fcmToken: token,
      notificationsEnabled: true
    }).catch(()=>{});
  },

  showToast(title, body) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<strong>${title}</strong><br>${body}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  },

  async sendToUser(userId, title, body, data = {}) {
    try {
      const userSnap = await getDoc(doc(db, "users", userId));
      const token = userSnap.data()?.fcmToken;
      if (!token) return;
      
      // For production: Call your Cloud Function
      // await fetch('https://your-cloud-function/sendNotification', {
      //   method: 'POST',
      //   body: JSON.stringify({ token, title, body, data })
      // });
      console.log('Should send notification to:', userId, { title, body, data });
    } catch(e) {
      console.error('Send notification error:', e);
    }
  }
};
