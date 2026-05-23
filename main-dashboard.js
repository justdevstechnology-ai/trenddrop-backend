import { db } from './main-firebase.js';
import { AUTH } from './main-auth.js';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const DASHBOARD = {
  revenueChart: null,
  stats: {
    revenue: 0,
    orders: 0,
    views: 0,
    likes: 0,
    products: []
  },

  async init() {
    await DASHBOARD.checkSubaccount();
    await DASHBOARD.loadStats();
    DASHBOARD.renderStats();
    DASHBOARD.loadChart();
    DASHBOARD.loadTopProducts();
    DASHBOARD.loadRecentSales();
    DASHBOARD.loadInventory();
    DASHBOARD.setupBankVerification();
  },

  async checkSubaccount() {
    const userSnap = await getDoc(doc(db, "users", AUTH.user.uid));
    const subaccountCode = userSnap.data()?.subaccountCode;
    
    const banner = document.getElementById('subaccountBanner');
    const statusDiv = document.getElementById('subaccountStatus');
    const form = document.getElementById('subaccountForm');
    
    if (!banner || !statusDiv || !form) return;
    
    if (!subaccountCode) {
      banner.style.display = 'block';
      statusDiv.innerHTML = `
        <div style="background:var(--error);color:#fff;padding:12px;border-radius:12px;margin-bottom:16px">
          <strong>Not Connected</strong><br>
          <span style="font-size:13px">You won't receive payments until you connect your bank</span>
        </div>
      `;
      form.style.display = 'block';
    } else {
      banner.style.display = 'none';
      statusDiv.innerHTML = `
        <div style="background:var(--success);color:#fff;padding:12px;border-radius:12px;margin-bottom:16px">
          <i class='bx bx-check-circle'></i> <strong>Bank Connected</strong><br>
          <span style="font-size:13px">Payments go directly to ${userSnap.data().bankName} ••••${userSnap.data().accountNumber.slice(-4)}</span>
        </div>
      `;
      form.style.display = 'none';
    }
  },

  setupBankVerification() {
    const accountInput = document.getElementById('subAccountNumber');
    const bankSelect = document.getElementById('subBankName');
    
    if (!accountInput || !bankSelect) return;
    
    const verifyAccount = async () => {
      const account = accountInput.value;
      const bank = bankSelect.value;
      
      if (account.length === 10 && bank) {
        try {
          // WARNING: This exposes your secret key. Use Cloud Functions in production.
          window.APP.toast('Bank verification requires backend. Contact support to set up.');
          document.getElementById('subAccountName').value = 'Enter manually';
        } catch(e) {
          console.error('Bank verification failed:', e);
        }
      }
    };
    
    accountInput.oninput = verifyAccount;
    bankSelect.onchange = verifyAccount;
  },

  async createSubaccount() {
    window.APP.toast('⚠️ Security Alert: Subaccount creation requires backend. Never put secret keys in frontend. Deploy Cloud Function first.');
    return;
    
    /* 
    PRODUCTION CODE - MOVE TO CLOUD FUNCTION:
    const bankCode = document.getElementById('subBankName').value;
    const accountNumber = document.getElementById('subAccountNumber').value;
    const accountName = document.getElementById('subAccountName').value;
    const percent = parseInt(document.getElementById('subPercent').value);
    
    if (!bankCode ||!accountNumber || accountName === 'Invalid account') {
      return window.APP.toast('Please verify your bank details');
    }
    if (percent < 1 || percent > 99) {
      return window.APP.toast('Split must be 1-99%');
    }
    
    const btn = document.getElementById('createSubaccountBtn');
    btn.disabled = true;
    btn.innerText = 'Connecting...';
    
    try {
      // Call your Cloud Function instead:
      const res = await fetch('https://YOUR_CLOUD_FUNCTION/createSubaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: AUTH.user.uid,
          bankCode,
          accountNumber,
          accountName,
          percent
        })
      });
      
      const data = await res.json();
      
      if (data.status) {
        await updateDoc(doc(db, "users", AUTH.user.uid), {
          subaccountCode: data.data.subaccount_code,
          bankName: data.data.settlement_bank,
          accountNumber: accountNumber,
          accountName: accountName,
          splitPercent: percent
        });
        
        window.APP.toast('Bank connected! You\'ll now receive payments automatically');
        DASHBOARD.checkSubaccount();
      } else {
        window.APP.toast('Failed: ' + data.message);
      }
    } catch(e) {
      window.APP.toast('Connection failed. Check your internet');
      console.error(e);
    } finally {
      btn.disabled = false;
      btn.innerText = 'Connect Bank Account';
    }
    */
  },

  async loadStats() {
    const productsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", AUTH.user.uid)
    ));
    
    DASHBOARD.stats.products = productsSnap.docs.map(d => ({ id: d.id,...d.data() }));
    DASHBOARD.stats.views = DASHBOARD.stats.products.reduce((sum, p) => sum + (p.views || 0), 0);
    DASHBOARD.stats.likes = DASHBOARD.stats.products.reduce((sum, p) => sum + (p.likes || 0), 0);

    const ordersSnap = await getDocs(query(
      collection(db, "orders"),
      where("sellerId", "==", AUTH.user.uid),
      where("status", "==", "paid")
    ));
    
    DASHBOARD.stats.orders = ordersSnap.size;
    
    const userSnap = await getDoc(doc(db, "users", AUTH.user.uid));
    const splitPercent = userSnap.data()?.splitPercent || 90;
    const totalSales = ordersSnap.docs.reduce((sum, d) => sum + d.data().price, 0);
    DASHBOARD.stats.revenue = Math.floor(totalSales * (splitPercent / 100));
  },

  renderStats() {
    const revenue = document.getElementById('totalRevenue');
    const orders = document.getElementById('totalOrders');
    const views = document.getElementById('totalViews');
    const likes = document.getElementById('totalLikes');
    
    if (revenue) revenue.innerText = window.APP.formatPrice(DASHBOARD.stats.revenue);
    if (orders) orders.innerText = DASHBOARD.stats.orders;
    if (views) views.innerText = DASHBOARD.stats.views.toLocaleString();
    if (likes) likes.innerText = DASHBOARD.stats.likes.toLocaleString();
  },

  async loadChart() {
    const rangeEl = document.getElementById('chartRange');
    if (!rangeEl) return;
    
    const range = parseInt(rangeEl.value);
    const days = [];
    const revenue = [];
    const now = new Date();
    const userSnap = await getDoc(doc(db, "users", AUTH.user.uid));
    const splitPercent = userSnap.data()?.splitPercent || 90;

    for (let i = range - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      days.push(date.toLocaleDateString('en', { month: 'short', day: 'numeric' }));
      
      const dayStart = new Date(date.setHours(0,0,0,0));
      const dayEnd = new Date(date.setHours(23,59,999));
      
      const ordersSnap = await getDocs(query(
        collection(db, "orders"),
        where("sellerId", "==", AUTH.user.uid),
        where("status", "==", "paid"),
        where("createdAt", ">=", dayStart),
        where("createdAt", "<=", dayEnd)
      ));
      
      const dayRevenue = ordersSnap.docs.reduce((sum, d) => sum + d.data().price, 0);
      revenue.push(Math.floor(dayRevenue * (splitPercent / 100)));
    }

    if (DASHBOARD.revenueChart) DASHBOARD.revenueChart.destroy();

    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    DASHBOARD.revenueChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'Your Earnings',
          data: revenue,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: { color: '#a1a1aa' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          x: { 
            ticks: { color: '#a1a1aa' },
            grid: { display: false }
          }
        }
      }
    });
  },

  async loadTopProducts() {
    const sorted = [...DASHBOARD.stats.products]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);

    const container = document.getElementById('topProductsList');
    if (!container) return;
    
    if (sorted.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text2);padding:20px">No products yet</p>';
      return;
    }

    container.innerHTML = sorted.map((p, i) => `
      <div class="inventory-item">
        <div style="font-size:18px;font-weight:700;color:var(--text2);width:20px">#${i+1}</div>
        <img src="${p.url}">
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${p.name}</div>
          <div style="font-size:12px;color:var(--text2)">👁 ${p.views || 0} views • ❤️ ${p.likes || 0} likes</div>
        </div>
        <div style="text-align:right">
          <div style="color:var(--accent);font-weight:700">${window.APP.formatPrice(p.price)}</div>
        </div>
      </div>
    `).join('');
  },

  async loadRecentSales() {
    const ordersSnap = await getDocs(query(
      collection(db, "orders"),
      where("sellerId", "==", AUTH.user.uid),
      where("status", "==", "paid"),
      orderBy("createdAt", "desc"),
      limit(5)
    ));

    const container = document.getElementById('recentSalesList');
    if (!container) return;
    
    if (ordersSnap.empty) {
      container.innerHTML = '<p style="text-align:center;color:var(--text2);padding:20px">No sales yet</p>';
      return;
    }

    const userSnap = await getDoc(doc(db, "users", AUTH.user.uid));
    const splitPercent = userSnap.data()?.splitPercent || 90;

    container.innerHTML = ordersSnap.docs.map(d => {
      const o = d.data();
      const sellerEarning = Math.floor(o.price * (splitPercent / 100));
      return `
        <div class="inventory-item">
          <img src="${o.productImage}">
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${o.productName}</div>
            <div style="font-size:12px;color:var(--text2)">${o.buyerName} • ${window.APP.timeAgo(o.createdAt)}</div>
          </div>
          <div style="color:var(--success);font-weight:700">+${window.APP.formatPrice(sellerEarning)}</div>
        </div>
      `;
    }).join('');
  },

  loadInventory() {
    const container = document.getElementById('inventoryList');
    if (!container) return;
    
    if (DASHBOARD.stats.products.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text2);padding:20px">No products in inventory</p>';
      return;
    }

    container.innerHTML = DASHBOARD.stats.products.map(p => `
      <div class="inventory-item">
        <img src="${p.url}">
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${p.name}</div>
          <div style="font-size:12px;color:var(--text2)">${window.APP.formatPrice(p.price)} • 👁 ${p.views || 0}</div>
        </div>
        <div class="inventory-actions">
          <button class="btn-edit" onclick="DASHBOARD.editProduct('${p.id}')">Edit</button>
          <button class="btn-delete" onclick="DASHBOARD.deleteProduct('${p.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  },

  async deleteProduct(productId) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    
    try {
      await deleteDoc(doc(db, "products", productId));
      window.APP.toast('Product deleted');
      DASHBOARD.init();
    } catch(e) {
      window.APP.toast('Failed to delete');
    }
  },

  editProduct(productId) {
    window.APP.toast('Edit feature coming soon');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('chartRange')?.addEventListener('change', () => {
    DASHBOARD.loadChart();
  });
});
