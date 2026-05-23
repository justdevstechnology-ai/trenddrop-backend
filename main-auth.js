import { auth, db } from './main-firebase.js';
import { onAuthStateChanged, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const AUTH = {
  user: null,

  async init() {
    // Initialize theme first so colors are correct on first load
    THEME.init(); 

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    getRedirectResult(auth).catch(err => console.error(err));

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        await AUTH.syncUser(user);
        setTimeout(() => window.APP.showApp(), 100);
      } else {
        showPage("login-page");
      }
    });
  },

  async syncUser(user) {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      let userData = {};

      if (!userSnap.exists()) {
        userData = {
          email: user.email,
          name: user.displayName || 'User',
          photo: user.photoURL || '',
          currency: navigator.language.includes('NG')? 'NGN' : 'USD',
          followers: 0,
          following: 0,
          ratingSum: 0,
          ratingCount: 0,
          joined: Date.now()
        };
        await setDoc(userRef, userData);
      } else {
        userData = userSnap.data();
      }

      AUTH.user = { uid: user.uid, email: user.email,...userData };
      localStorage.setItem('trenddrop_user', JSON.stringify(AUTH.user));
    } catch(e) {
      console.error("Sync error:", e);
      AUTH.user = JSON.parse(localStorage.getItem('trenddrop_user') || '{}');
      if (!AUTH.user.uid) AUTH.user = { uid: user.uid, email: user.email, name: user.displayName || 'User', photo: user.photoURL || '' };
    }
  },

  getRatingAvg() {
    if (!AUTH.user?.ratingCount) return '0.0';
    return (AUTH.user.ratingSum / AUTH.user.ratingCount).toFixed(1);
  },

  logout() {
    auth.signOut();
    localStorage.clear();
    location.reload();
  }
};
