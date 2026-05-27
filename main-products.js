import { db, storage } from './main-firebase.js';
import { AUTH } from './main-auth.js';
import { collection, addDoc, onSnapshot, doc, updateDoc, increment, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export const PRODUCTS = {
  products: [],
  currentCategory: 'all',
  currentProduct: null,
  mediaType: 'image',
  selectedFile: null,
  searchQuery: '',

  loadCache() {
    const cached = localStorage.getItem('cached_products');
    if (cached) {
      try {
        PRODUCTS.products = JSON.parse(cached);
        PRODUCTS.render();
      } catch(e) {
        localStorage.removeItem('cached_products');
      }
    }
    PRODUCTS.loadProducts();
  },

  async loadProducts() {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
      PRODUCTS.products = snap.docs.map(d => ({ id: d.id,...d.data() }));
      localStorage.setItem('cached_products', JSON.stringify(PRODUCTS.products));
      PRODUCTS.render();
    }, (error) => {
      console.error("Firestore error:", error);
      window.APP.toast('Failed to load products');
    });
  },

  render() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    let data = [...PRODUCTS.products];

    if (PRODUCTS.searchQuery) {
      data = data.filter(p =>
        p.name.toLowerCase().includes(PRODUCTS.searchQuery) ||
        p.desc?.toLowerCase().includes(PRODUCTS.searchQuery)
      );
    }

    if (PRODUCTS.currentCategory!== 'all') {
      data = data.filter(p => p.category === PRODUCTS.currentCategory);
    }

    if (data.length === 0) {
      feed.innerHTML = '<p style="text-align:center;color:var(--text2);padding:40px;grid-column:1/-1">No products found</p>';
      return;
    }

    feed.innerHTML = data.map(p => `
      <div class="product-card" onclick="PRODUCTS.openProduct('${p.id}')">
        <div class="card-media">
          ${p.type === 'video'? `<video src="${p.url}" muted></video><div class="video-badge"><i class='bx bx-play'></i></div>` : `<img src="${p.url}">`}
          <div class="views">👁 ${p.views || 0}</div>
        </div>
        <div class="card-body">
          <div class="product-name">${p.name}</div>
          <div class="price">${window.APP.formatPrice(p.price)}</div>
          <div class="actions">
            <button onclick="event.stopPropagation();SOCIAL.handleLike('${p.id}', this)">
              <i class='bx bx-heart'></i> ${p.likes || 0}
            </button>
            <button onclick="event.stopPropagation();ORDERS.buyProduct('${p.id}')">Buy</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  async openProduct(productId) {
    const product = PRODUCTS.products.find(p => p.id === productId);
    if (!product) return;
    PRODUCTS.currentProduct = product;
    showPage('product-page');
    window.APP.renderProductDetail(product);
    updateDoc(doc(db, "products", productId), { views: increment(1) }).catch(()=>{});
  },

  async postProduct() {
    const file = PRODUCTS.selectedFile;
    if (!file) return window.APP.toast('Upload an image or video');

    const name = document.getElementById('product-name').value.trim();
    const price = parseFloat(document.getElementById('price').value);
    const category = document.getElementById('category').value;
    const desc = document.getElementById('description').value.trim();

    if (!name ||!price) return window.APP.toast('Fill product name and price');

    const btn = document.getElementById('postBtn');
    btn.disabled = true;
    btn.innerText = 'Uploading...';

    try {
      // FIREBASE STORAGE - NOW ACTIVE
      const fileName = `products/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          document.getElementById('progressBar').classList.add('show');
          document.getElementById('progressFill').style.width = progress + '%';
        },
        (error) => {
          window.APP.toast('Upload failed: ' + error.message);
          btn.disabled = false;
          btn.innerText = 'Post Product';
          document.getElementById('progressBar').classList.remove('show');
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await PRODUCTS.saveProductToDB(name, price, category, desc, url, file.type.startsWith('video/')? 'video' : 'image', btn);
        }
      );

    } catch (e) {
      window.APP.toast('Error: ' + e.message);
      btn.disabled = false;
      btn.innerText = 'Post Product';
    }
  },

  async saveProductToDB(name, price, category, desc, url, type, btn) {
    await addDoc(collection(db, "products"), {
      name,
      price,
      category,
      desc,
      url,
      type,
      userId: AUTH.user.uid,
      sellerName: AUTH.user.name,
      sellerPhoto: AUTH.user.photo,
      views: 0,
      likes: 0,
      createdAt: serverTimestamp()
    });

    window.APP.toast('Product posted!');
    document.getElementById('product-name').value = '';
    document.getElementById('price').value = '';
    document.getElementById('description').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('videoPreview').style.display = 'none';
    document.getElementById('uploadPlaceholder').style.display = 'block';
    document.getElementById('progressBar').classList.remove('show');
    PRODUCTS.selectedFile = null;
    btn.disabled = false;
    btn.innerText = 'Post Product';
    showPage('home-page');
  },

  async uploadProfilePic(file) {
    if (!file) return;
    if (file.size > 5242880) return window.APP.toast('Image too large. Max 5MB');

    const btn = document.createElement('button');
    btn.disabled = true;

    try {
      const fileName = `profiles/${AUTH.user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', null,
        (error) => window.APP.toast('Upload failed: ' + error.message),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(doc(db, "users", AUTH.user.uid), { photo: url });
          AUTH.user.photo = url;
          localStorage.setItem('trenddrop_user', JSON.stringify(AUTH.user));
          document.getElementById('profile-pic').src = url;
          document.getElementById('me-photo').src = url;
          window.APP.toast('Profile photo updated');
        }
      );
    } catch (e) {
      window.APP.toast('Error: ' + e.message);
    }
  }
};

document.getElementById('fileInput').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  PRODUCTS.selectedFile = file;
  const isVideo = file.type.startsWith('video/');
  PRODUCTS.mediaType = isVideo? 'video' : 'image';

  document.getElementById('uploadPlaceholder').style.display = 'none';
  document.getElementById('uploadLimit').innerText = isVideo? 'MP4, MOV up to 50MB' : 'JPG, PNG up to 5MB';

  if (isVideo) {
    const video = document.getElementById('videoPreview');
    video.src = URL.createObjectURL(file);
    video.style.display = 'block';
    document.getElementById('imagePreview').style.display = 'none';
  } else {
    const img = document.getElementById('imagePreview');
    img.src = URL.createObjectURL(file);
    img.style.display = 'block';
    document.getElementById('videoPreview').style.display = 'none';
  }
};

document.getElementById('me-photo').onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => PRODUCTS.uploadProfilePic(e.target.files[0]);
  input.click();
};
