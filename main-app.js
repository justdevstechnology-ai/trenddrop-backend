import { DASHBOARD } from './main-dashboard.js';
import { NOTIFY } from './main-notify.js';
import { CHAT } from './main-chat.js';
import { AUTH } from './main-auth.js';
import { PRODUCTS } from './main-products.js';
import { SOCIAL } from './main-social.js';
import { ORDERS } from './main-orders.js';
import { REVIEWS } from './main-reviews.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect, getRedirectResult, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, provider } from './main-firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './main-firebase.js';

window.showPage = (id) => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[onclick="showPage('${id}')"]`)?.classList.add("active");

  const footer = document.querySelector('.footer');
  if (footer) {
    if (id === 'login-page') {
      footer.style.display = 'none';
    } else {
      footer.style.display = 'flex';
    }
  }

  if (id === 'dashboard-page' && DASHBOARD?.init) DASHBOARD.init();
  if (id === 'subaccount-page' && DASHBOARD?.checkSubaccount) DASHBOARD.checkSubaccount();
};

window.APP = {
...AUTH,
...PRODUCTS,
...SOCIAL,
...ORDERS,
...REVIEWS,
...CHAT,
...NOTIFY,
...DASHBOARD,

showApp() {
  // FIX 1: Guard against null AUTH.user
  if (!AUTH.user) return;

  showPage("home-page");
  document.getElementById('profile-pic').src = AUTH.user.photo || 'https://via.placeholder.com/40';
  document.getElementById('me-photo').src = AUTH.user.photo || 'https://via.placeholder.com/80';
  document.getElementById('me-name').innerText = AUTH.user.name || AUTH.user.email;
  document.getElementById('me-email').innerText = AUTH.user.email;
  document.getElementById('followerCount').innerText = AUTH.user.followers || 0;
  document.getElementById('followingCount').innerText = AUTH.user.following || 0;
  document.getElementById('ratingAvg').innerText = AUTH.getRatingAvg();
  PRODUCTS.init();
  PRODUCTS.loadCache();
  if (ORDERS?.loadOrders) ORDERS.loadOrders();
  if (CHAT?.loadChatList) CHAT.loadChatList();
  if (NOTIFY?.init) NOTIFY.init();
  if (REVIEWS?.setupReviewStars) REVIEWS.setupReviewStars();
},

  formatPrice(price) {
    const cur = AUTH.user?.currency || 'USD';
    const symbol = cur === 'NGN'? '₦' : '$';
    return `${symbol}${price?.toLocaleString() || 0}`;
  },

  timeAgo(timestamp) {
    if (!timestamp) return 'now';
    const seconds = Math.floor((Date.now() - timestamp.toMillis()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  },

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },

  async renderProductDetail(product) {
    const liked = await window.SOCIAL.checkUserLiked(product.id);
    const following = await window.SOCIAL.checkUserFollowing(product.userId);
    const isVideo = product.type === 'video';

    document.getElementById('productView').innerHTML = `
      ${isVideo? `<video src="${product.url}" controls></video>` : `<img src="${product.url}">`}
      <h2>${product.name}</h2>
      <div class="price">${window.APP.formatPrice(product.price)}</div>
      <div class="seller-info">
        <img src="${product.sellerPhoto || 'https://via.placeholder.com/40'}">
        <div style="flex:1">
          <div style="font-weight:600">${product.sellerName}</div>
          <div style="font-size:12px;color:var(--text2)"><span id="followerCount">0</span> followers</div>
        </div>
        <button id="messageBtn" class="action-btn" style="padding:8px 12px;flex:0" onclick="CHAT.startChat('${product.userId}', '${product.sellerName}', '${product.sellerPhoto || ''}', '${product.id}', '${product.name}')">
          <i class='bx bx-message-dots'></i>
        </button>
        <button id="followBtn" class="follow-btn ${following? 'following' : ''}" onclick="SOCIAL.handleFollow('${product.userId}')">${following? 'Following' : 'Follow'}</button>
      </div>
      <div style="display:flex;gap:12px;margin:16px 0">
        <button class="action-btn" onclick="SOCIAL.handleLike('${product.id}', this, true)">
          <i class='bx ${liked? 'bxs-heart' : 'bx-heart'}' id="detailHeart" style="${liked? 'color:#ef4444' : ''}"></i> <span id="detailLikeCount">${product.likes || 0}</span>
        </button>
        <button class="action-btn" onclick="ORDERS.buyProduct('${product.id}')" style="flex:1;background:var(--accent)">
          Buy Now - ${window.APP.formatPrice(product.price)}
        </button>
      </div>
      <p style="color:var(--text2);line-height:1.6">${product.desc || 'No description'}</p>
      <div class="comments-section">
        <div class="comments-header">
          <span>Comments</span>
          <span id="commentCount" style="color:var(--text2);font-size:14px">0</span>
        </div>
        <div id="commentsList"></div>
      </div>
    `;

    window.SOCIAL.listenLikes(product.id, (count) => {
      document.getElementById('detailLikeCount').innerText = count;
    });

    window.SOCIAL.listenFollowers(product.userId, (count) => {
      document.getElementById('followerCount').innerText = count;
    });
  },

  closeReviewModal() {
    document.getElementById('reviewModal').classList.remove('show');
    if (REVIEWS) REVIEWS.reviewOrderId = null;
  },

  logout() {
    AUTH.logout();
  }
};

let isLogin = true;
document.getElementById("auth-btn").onclick = async () => {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  const name = document.getElementById("name").value;
  try {
    if (isLogin) {
      await signInWithEmailAndPassword(auth, email, pass);
    } else {
      if (!document.getElementById("terms").checked) return APP.toast("Accept terms");
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, "users", res.user.uid), { name, email });
    }
  } catch (e) { APP.toast(e.message); }
};

document.getElementById("toggle-auth").onclick = () => {
  isLogin =!isLogin;
  document.getElementById("name").style.display = isLogin? "none" : "block";
  document.getElementById("terms-wrap").style.display = isLogin? "none" : "block";
  document.getElementById("auth-btn").innerText = isLogin? "Login" : "Sign Up";
  document.getElementById("toggle-auth").innerText = isLogin? "Don't have account? Sign up" : "Have account? Login";
};

document.getElementById("google-login").onclick = () => signInWithRedirect(auth, provider);

// FIX 2: Handle redirect result for Google login
getRedirectResult(auth).then((result) => {
  if (result?.user) {
    AUTH.user = result.user;
    window.APP.showApp();
  }
});

// FIX 3: Listen for auth state changes on page load/refresh
onAuthStateChanged(auth, (user) => {
  AUTH.user = user;
  if (user) {
    window.APP.showApp();
  } else {
    showPage("login-page");
  }
});

document.querySelectorAll(".cat").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".cat").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    PRODUCTS.currentCategory = btn.dataset.cat;
    PRODUCTS.render();
  };
});

let searchTimeout;
document.getElementById("search").oninput = (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    PRODUCTS.searchQuery = e.target.value.toLowerCase();
    PRODUCTS.render();
  }, 300);
};

document.getElementById("postBtn").onclick = () => PRODUCTS.postProduct();
document.getElementById("sendCommentBtn").onclick = () => PRODUCTS.sendComment && PRODUCTS.sendComment();
document.getElementById("logoutBtn").onclick = () => APP.logout();
document.getElementById("submitReviewBtn").onclick = () => REVIEWS?.submitReview && REVIEWS.submitReview();
document.getElementById("buyingTab").onclick = () => ORDERS?.showOrderTab && ORDERS.showOrderTab('buying');
document.getElementById("sellingTab").onclick = () => ORDERS?.showOrderTab && ORDERS.showOrderTab('selling');
document.getElementById("sendMessageBtn").onclick = () => CHAT?.sendMessage && CHAT.sendMessage();
document.getElementById("chatImageInput").onchange = (e) => CHAT?.sendImage && CHAT.sendImage(e.target.files[0]);
document.getElementById("messageInput").onkeypress = (e) => {
  if (e.key === 'Enter' && CHAT?.sendMessage) CHAT.sendMessage();
};

window.AUTH = AUTH;
window.PRODUCTS = PRODUCTS;
window.SOCIAL = SOCIAL;
window.ORDERS = ORDERS;
window.REVIEWS = REVIEWS;
window.CHAT = CHAT;
window.NOTIFY = NOTIFY;
window.DASHBOARD = DASHBOARD;

export const THEME = {
  init() {
    const saved = localStorage.getItem('trenddrop_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateIcon(saved);
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark'? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('trenddrop_theme', next);
    this.updateIcon(next);
  },

  updateIcon(theme) {
    const icon = document.getElementById('theme-toggle');
    if (icon) {
      icon.className = theme === 'dark'? 'bx bx-sun' : 'bx bx-moon';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  THEME.init();
  document.getElementById('theme-toggle')?.addEventListener('click', () => THEME.toggle());
});

window.THEME = THEME;
AUTH.init();
