import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBPFk5dgQufe7iSN49e93onlPw0EZJmPeU",
  authDomain: "trenddrop-3f5e4.firebaseapp.com",
  projectId: "trenddrop-3f5e4",
  storageBucket: "trenddrop-3f5e4.appspot.com",
  messagingSenderId: "839968116137",
  appId: "1:839968116137:web:146ddea9cdb9ae5410c8b8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const provider = new GoogleAuthProvider();
