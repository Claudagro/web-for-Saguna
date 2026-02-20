// Store JavaScript
let settings = {};
let allProducts = [];
let filteredProducts = [];
let currentCategory = 'all';
let currentProduct = null;
let currentImageIdx = 0;
let cart = JSON.parse(localStorage.getItem('waStoreCart')) || [];

async function init() {
    await loadSettings();
    await loadProducts();
    setupSearch();
    setupModal();
    setupCart();

    // Check if URL has a product ID to open modal automatically
    if (window.location.pathname.startsWith('/product/')) {
        const id = window.location.pathname.split('/product/')[1];
        if (id) openProduct(id);
    }
}

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        settings = await res.json();
        applySettings();
    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

function applySettings() {
    // Apply store name
    document.title = `${settings.storeName} - Shop via WhatsApp`;
    const el = (id) => document.getElementById(id);
    if (el('headerStoreName')) el('headerStoreName').textContent = settings.storeName;
    if (el('heroTitle')) el('heroTitle').textContent = settings.heroTitle || 'Discover Amazing Products';
    if (el('heroTagline')) el('heroTagline').textContent = settings.heroSubtitle || settings.storeTagline || '';
    if (el('footerStoreName')) el('footerStoreName').textContent = settings.storeName;

    // Apply hero banner image
    const heroBg = el('heroBg');
    const heroOverlay = el('heroOverlay');
    if (heroBg && settings.heroBannerImage) {
        heroBg.style.backgroundImage = `url('${settings.heroBannerImage}')`;
        heroBg.style.backgroundSize = 'cover';
        heroBg.style.backgroundPosition = 'center';
        // Hide animated pseudo-elements when image exists
        heroBg.classList.add('has-image');
        if (heroOverlay) heroOverlay.classList.add('has-image');
    } else if (heroBg) {
        heroBg.style.backgroundImage = '';
        heroBg.classList.remove('has-image');
        if (heroOverlay) heroOverlay.classList.remove('has-image');
    }

    // WhatsApp header link
    if (el('headerWa')) {
        el('headerWa').href = `https://wa.me/${settings.whatsappNumber}`;
    }

    // Apply primary color
    if (settings.primaryColor) {
        document.documentElement.style.setProperty('--primary', settings.primaryColor);
        document.documentElement.style.setProperty('--primary-dark', settings.primaryColor + 'cc');
    }
}

async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        allProducts = await res.json();
        filteredProducts = [...allProducts];
        renderCategories();
        renderProducts(filteredProducts);
    } catch (e) {
        console.error('Failed to load products', e);
        document.getElementById('productsGrid').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Failed to load products</h3>
      </div>`;
    }
}

function renderCategories() {
    const cats = ['all', ...new Set(allProducts.map(p => p.category).filter(Boolean))];
    const list = document.getElementById('categoryList');
    list.innerHTML = cats.map(c => `
    <button class="cat-btn ${c === currentCategory ? 'active' : ''}" data-cat="${c}">
      ${c === 'all' ? 'All Products' : c}
    </button>`).join('');
    list.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategory = btn.dataset.cat;
            list.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterAndRender();
        });
    });
}

function filterAndRender() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    filteredProducts = allProducts.filter(p => {
        const matchCat = currentCategory === 'all' || p.category === currentCategory;
        const matchSearch = !query || p.name.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query);
        return matchCat && matchSearch;
    });
    renderProducts(filteredProducts);
}

function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    const count = document.getElementById('productsCount');
    count.textContent = `${products.length} item${products.length !== 1 ? 's' : ''}`;

    if (products.length === 0) {
        grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛍️</div>
        <h3>No products found</h3>
        <p>Try a different search or category</p>
      </div>`;
        return;
    }

    grid.innerHTML = products.map(p => {
        const imgHtml = p.images && p.images.length > 0
            ? `<img class="product-card-img" src="${p.images[0]}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="product-card-img-placeholder" style="display:none">🛍️</div>`
            : `<div class="product-card-img-placeholder">🛍️</div>`;
        return `
      <div class="product-card" data-id="${p.id}" onclick="openProduct('${p.id}')">
        ${imgHtml}
        <div class="product-card-body">
          <div class="product-card-cat">${escapeHtml(p.category || 'Product')}</div>
          <div class="product-card-name">${escapeHtml(p.name)}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div class="product-card-price" style="margin-bottom:0">${settings.currencySymbol || ''}${Number(p.price).toLocaleString()}</div>
            <div style="font-size:0.75rem; font-weight:700; padding:4px 8px; border-radius:4px; background:${p.stock > 0 ? 'rgba(37,211,102,0.1)' : 'rgba(255,100,100,0.1)'}; color:${p.stock > 0 ? 'var(--success)' : 'var(--danger)'};">${p.stock > 0 ? p.stock + ' In Stock' : 'Out of Stock'}</div>
          </div>
          <button class="product-card-buy" ${p.stock <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} onclick="${p.stock > 0 ? `addToCart(event, '${p.id}')` : 'event.stopPropagation()'}">
            ${p.stock > 0 ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg> Add to Cart` : 'Out of Stock'}
          </button>
        </div>
      </div>`;
    }).join('');
}

function openProduct(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;
    currentProduct = product;
    currentImageIdx = 0;

    // Fill modal
    document.getElementById('modalName').textContent = product.name;
    document.getElementById('modalCategory').textContent = product.category || 'Product';
    document.getElementById('modalPrice').textContent = `${settings.currencySymbol || ''}${Number(product.price).toLocaleString()}`;
    const modalStock = document.getElementById('modalStock');
    if (modalStock) {
        modalStock.textContent = product.stock > 0 ? `${product.stock} In Stock` : 'Out of Stock';
        modalStock.style.color = product.stock > 0 ? 'var(--success)' : 'var(--danger)';
        modalStock.style.background = product.stock > 0 ? 'rgba(37,211,102,0.1)' : 'rgba(255,100,100,0.1)';
    }
    document.getElementById('modalDesc').textContent = product.description || 'Click "Buy on WhatsApp" to order this product.';

    // Gallery
    const gallery = document.getElementById('modalGallery');
    if (product.images && product.images.length > 0) {
        const imgs = product.images.map((src, i) =>
            `<img src="${src}" alt="${escapeHtml(product.name)}" class="${i === 0 ? 'active' : ''}" onclick="setImage(${i})" />`
        ).join('');
        const dots = product.images.length > 1
            ? `<div class="modal-gallery-nav">${product.images.map((_, i) =>
                `<div class="modal-gallery-dot ${i === 0 ? 'active' : ''}" onclick="setImage(${i})"></div>`
            ).join('')}</div>`
            : '';
        gallery.innerHTML = imgs + dots;
    } else {
        gallery.innerHTML = `<div class="modal-gallery-placeholder">🛍️</div>`;
    }

    // Buy button
    const btn = document.getElementById('modalBuyBtn');
    if (product.stock > 0) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg> Add to Cart`;
        btn.onclick = () => {
            addToCart(null, id);
            document.getElementById('modalOverlay').classList.remove('active');
            document.body.style.overflow = '';
            currentProduct = null;
        };
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.textContent = 'Out of Stock';
        btn.onclick = null;
    }

    // Show
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function setImage(idx) {
    if (!currentProduct) return;
    currentImageIdx = idx;
    const gallery = document.getElementById('modalGallery');
    gallery.querySelectorAll('img').forEach((img, i) => {
        img.classList.toggle('active', i === idx);
    });
    gallery.querySelectorAll('.modal-gallery-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === idx);
    });
}

function buyNow(event, id) {
    if (event) event.stopPropagation();
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    const productLink = `${window.location.origin}/product/${product.id}`;
    const msg = `Hi! 👋 I'm interested in buying:\n\n*${product.name}*\nPrice: ${settings.currencySymbol || ''}${Number(product.price).toLocaleString()}\nLink: ${productLink}\n\nPlease confirm availability. Thank you! 🙏`;
    const url = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

function setupSearch() {
    const input = document.getElementById('searchInput');
    let debounce;
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(filterAndRender, 300);
    });
}

function setupModal() {
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    const close = () => {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        currentProduct = null;
    };
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== CART LOGIC =====
function setupCart() {
    document.getElementById('cartOpenBtn').addEventListener('click', () => toggleCart(true));
    document.getElementById('cartCloseBtn').addEventListener('click', () => toggleCart(false));
    document.getElementById('cartOverlay').addEventListener('click', () => toggleCart(false));
    document.getElementById('checkoutBtn').addEventListener('click', checkoutCart);
    renderCart();
}

function toggleCart(show) {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if (show) {
        drawer.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        drawer.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function addToCart(e, id) {
    if (e) e.stopPropagation();
    const product = allProducts.find(p => p.id === id);
    if (!product || product.stock <= 0) return;

    const existing = cart.find(item => item.id === id);
    if (existing) {
        if (existing.qty < product.stock) {
            existing.qty += 1;
        } else {
            alert('Cannot add more, maximum stock reached.');
            return;
        }
    } else {
        cart.push({ id: product.id, name: product.name, price: Number(product.price), image: (product.images && product.images[0]) || '', qty: 1 });
    }
    saveCart();
    renderCart();
    toggleCart(true); // Open drawer
}

function updateCartQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    if (item.qty + delta > product.stock) {
        alert('Cannot exceed available stock.');
        return;
    }
    item.qty += delta;
    if (item.qty <= 0) {
        removeFromCart(id);
    } else {
        saveCart();
        renderCart();
    }
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    saveCart();
    renderCart();
}

function saveCart() {
    localStorage.setItem('waStoreCart', JSON.stringify(cart));
}

function renderCart() {
    const badge = document.getElementById('cartBadge');
    const container = document.getElementById('cartItemsContainer');
    const totalEl = document.getElementById('cartTotalPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');

    const count = cart.reduce((acc, item) => acc + item.qty, 0);
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }

    if (cart.length === 0) {
        container.innerHTML = '<div class="cart-empty-state">Your cart is empty</div>';
        totalEl.textContent = `${settings.currencySymbol || ''}0`;
        checkoutBtn.disabled = true;
        return;
    }

    let total = 0;
    container.innerHTML = cart.map(item => {
        total += item.price * item.qty;
        const fallbackImg = `<div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;">🛍️</div>`;
        const imgHtml = item.image ? `<img class="cart-item-img" src="${item.image}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` + fallbackImg : fallbackImg;
        return `
        <div class="cart-item">
            ${imgHtml}
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeHtml(item.name)}</div>
                <div class="cart-item-price">${settings.currencySymbol || ''}${item.price.toLocaleString()}</div>
                <div class="cart-item-controls">
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">-</button>
                        <span class="qty-val">${item.qty}</span>
                        <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
                    </div>
                    <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">Remove</button>
                </div>
            </div>
        </div>`;
    }).join('');

    totalEl.textContent = `${settings.currencySymbol || ''}${total.toLocaleString()}`;
    checkoutBtn.disabled = false;
}

function checkoutCart() {
    if (cart.length === 0) return;
    let msg = `Hi! 👋 I'd like to place an order from ${settings.storeName}:\n\n`;
    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        msg += `🛒 *${item.name}*\n`;
        msg += `   Qty: ${item.qty} x ${settings.currencySymbol || ''}${item.price.toLocaleString()} = ${settings.currencySymbol || ''}${itemTotal.toLocaleString()}\n\n`;
    });
    msg += `*Total Amount:* ${settings.currencySymbol || ''}${total.toLocaleString()}\n\n`;
    msg += `Please confirm my order. Thank you! 🙏`;

    const url = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

init();
