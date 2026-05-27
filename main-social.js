import { db } from './main-firebase.js';
import { AUTH } from './main-auth.js';
import { doc, setDoc, getDoc, updateDoc, increment, query, where, onSnapshot, serverTimestamp, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const SOCIAL = {
  likesUnsub: null,
  followersUnsub: null,

  async toggleLike(productId) {
    if (!AUTH.user) return window.APP.toast('Login first');

    const likeId = `${productId}_${AUTH.user.uid}`;
    const likeRef = doc(db, "likes", likeId);
    const likeSnap = await getDoc(likeRef);
    const wasLiked = likeSnap.exists() &&!likeSnap.data().deleted;

    if (wasLiked) {
      await setDoc(likeRef, { deleted: true, updatedAt: serverTimestamp() }, { merge: true });
      await updateDoc(doc(db, "products", productId), { likes: increment(-1) });
    } else {
      await setDoc(likeRef, {
        productId,
        userId: AUTH.user.uid,
        deleted: false,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "products", productId), { likes: increment(1) });

      const product = await getDoc(doc(db, "products", productId));
      await window.NOTIFY.sendToUser(
        product.data().userId,
        'New Like ❤️',
        `${AUTH.user.name} liked your ${product.data().name}`,
        { url: '/?product=' + productId }
      );
    }
  },

  listenLikes(productId, callback) {
    const q = query(collection(db, "likes"), where("productId", "==", productId), where("deleted", "==", false));
    SOCIAL.likesUnsub = onSnapshot(q, (snap) => callback(snap.size));
  },

  async checkUserLiked(productId) {
    if (!AUTH.user) return false;
    const likeId = `${productId}_${AUTH.user.uid}`;
    const snap = await getDoc(doc(db, "likes", likeId));
    return snap.exists() &&!snap.data().deleted;
  },

  async handleLike(productId, btn, isDetail = false) {
    await SOCIAL.toggleLike(productId);
    const liked = await SOCIAL.checkUserLiked(productId);
    const icon = btn.querySelector('i');

    if (liked) {
      icon.className = 'bx bxs-heart';
      icon.style.color = '#ef4444';
      SOCIAL.showHeart(null, btn.closest('.product-card') || btn);
      if (isDetail) {
        document.getElementById('detailHeart').className = 'bx bxs-heart';
        document.getElementById('detailHeart').style.color = '#ef4444';
      }
    } else {
      icon.className = 'bx bx-heart';
      icon.style.color = '';
      if (isDetail) {
        document.getElementById('detailHeart').className = 'bx bx-heart';
        document.getElementById('detailHeart').style.color = '';
      }
    }
  },

  showHeart(e, targetEl) {
    const heart = document.createElement('div');
    heart.innerHTML = '❤️';
    heart.className = 'heart-float';
    const rect = targetEl.getBoundingClientRect();
    heart.style.left = (e?.clientX - rect.left || rect.width/2) + 'px';
    heart.style.top = (e?.clientY - rect.top || rect.height/2) + 'px';
    targetEl.appendChild(heart);
    setTimeout(() => heart.remove(), 1000);
  },

  async toggleFollow(targetUserId) {
    if (!AUTH.user) return window.APP.toast('Login first');
    if (targetUserId === AUTH.user.uid) return window.APP.toast("Can't follow yourself");

    const followId = `${AUTH.user.uid}_${targetUserId}`;
    const followRef = doc(db, "followers", followId);
    const followSnap = await getDoc(followRef);

    if (followSnap.exists() &&!followSnap.data().deleted) {
      await setDoc(followRef, { deleted: true, updatedAt: serverTimestamp() }, { merge: true });
      await updateDoc(doc(db, "users", targetUserId), { followers: increment(-1) });
      await updateDoc(doc(db, "users", AUTH.user.uid), { following: increment(-1) });
      AUTH.user.following = (AUTH.user.following || 0) - 1;
    } else {
      await setDoc(followRef, {
        followerId: AUTH.user.uid,
        followingId: targetUserId,
        deleted: false,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "users", targetUserId), { followers: increment(1) });
      await updateDoc(doc(db, "users", AUTH.user.uid), { following: increment(1) });
      AUTH.user.following = (AUTH.user.following || 0) + 1;
    }
    document.getElementById('followingCount').innerText = AUTH.user.following || 0;
  },

  listenFollowers(userId, callback) {
    const q = query(collection(db, "followers"), where("followingId", "==", userId), where("deleted", "==", false));
    SOCIAL.followersUnsub = onSnapshot(q, (snap) => callback(snap.size));
  },

  async checkUserFollowing(targetUserId) {
    if (!AUTH.user) return false;
    const followId = `${AUTH.user.uid}_${targetUserId}`;
    const snap = await getDoc(doc(db, "followers", followId));
    return snap.exists() &&!snap.data().deleted;
  },

  async handleFollow(userId) {
    await SOCIAL.toggleFollow(userId);
    const following = await SOCIAL.checkUserFollowing(userId);
    const btn = document.getElementById('followBtn');
    btn.innerText = following? 'Following' : 'Follow';
    btn.classList.toggle('following', following);
  }
};
