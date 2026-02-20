// Store JavaScript
let settings = {};
let allProducts = [];
let filteredProducts = [];
let currentCategory = 'all';
let currentProduct = null;
let currentImageIdx = 0;

async function init() {
    await loadSettings();
    await loadProducts();
    setupSearch();
    setupModal();

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
          <button class="product-card-buy" ${p.stock <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} onclick="${p.stock > 0 ? `buyNow(event, '${p.id}')` : 'event.stopPropagation()'}">
            ${p.stock > 0 ? `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Buy on WhatsApp` : 'Out of Stock'}
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
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Buy on WhatsApp`;
        btn.onclick = () => buyNow(null, id);
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
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
