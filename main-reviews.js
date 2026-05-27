import { db } from './main-firebase.js';
import { AUTH } from './main-auth.js';
import { CHAT } from './main-chat.js';
import { collection, addDoc, doc, getDoc, updateDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const REVIEWS = {
  selectedRating: 0,
  reviewOrderId: null,

  setupReviewStars() {
    document.querySelectorAll('.star-rating i').forEach(star => {
      star.onclick = () => {
        REVIEWS.selectedRating = parseInt(star.dataset.rating);
        document.querySelectorAll('.star-rating i').forEach((s, i) => {
          s.className = i < REVIEWS.selectedRating? 'bx bxs-star active' : 'bx bx-star';
        });
      };
    });
  },

  async showReviewModal(orderOrId) {
    let order;
    if (typeof orderOrId === 'string') {
      const snap = await getDoc(doc(db, "orders", orderOrId));
      order = { id: orderOrId,...snap.data() };
    } else {
      order = orderOrId;
    }

    REVIEWS.reviewOrderId = order.id;
    REVIEWS.selectedRating = 0;

    document.getElementById('reviewProduct').innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${order.productImage}" style="width:50px;height:50px;border-radius:12px;object-fit:cover">
        <div>
          <div style="font-weight:600">${order.productName}</div>
          <div style="font-size:12px;color:var(--text2)">from ${order.sellerName}</div>
        </div>
      </div>
    `;

    document.querySelectorAll('.star-rating i').forEach(s => s.className = 'bx bx-star');
    document.getElementById('reviewText').value = '';
    document.getElementById('reviewModal').classList.add('show');
  },

  closeReviewModal() {
    document.getElementById('reviewModal').classList.remove('show');
    REVIEWS.reviewOrderId = null;
  },

  async submitReview() {
    if (!REVIEWS.selectedRating) return window.APP.toast('Please select a rating');

    const text = document.getElementById('reviewText').value.trim();
    const orderSnap = await getDoc(doc(db, "orders", REVIEWS.reviewOrderId));
    const order = orderSnap.data();

    await addDoc(collection(db, "reviews"), {
      orderId: REVIEWS.reviewOrderId,
      productId: order.productId,
      sellerId: order.sellerId,
      buyerId: AUTH.user.uid,
      buyerName: AUTH.user.name,
      buyerPhoto: AUTH.user.photo,
      rating: REVIEWS.selectedRating,
      text,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, "orders", REVIEWS.reviewOrderId), { reviewed: true });

    await updateDoc(doc(db, "users", order.sellerId), {
      ratingSum: increment(REVIEWS.selectedRating),
      ratingCount: increment(1)
    });

    window.APP.toast('Review submitted!');
    REVIEWS.closeReviewModal();
  }
};
