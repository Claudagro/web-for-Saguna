// Admin Dashboard JavaScript
let adminToken = '';
let adminProducts = [];
let adminSettings = {};
let editingImages = []; // for edit mode

// ===== AUTH =====
async function init() {
    const saved = sessionStorage.getItem('adminToken');
    if (saved) {
        adminToken = saved;
        await loadDashboard();
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pw = document.getElementById('loginPassword').value;
        const btn = document.getElementById('loginBtn');
        btn.textContent = 'Logging in...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pw })
            });
            if (res.ok) {
                const data = await res.json();
                adminToken = data.token;
                sessionStorage.setItem('adminToken', adminToken);
                await loadDashboard();
            } else {
                document.getElementById('loginError').style.display = 'block';
                btn.textContent = 'Login →';
                btn.disabled = false;
            }
        } catch (e) {
            btn.textContent = 'Login →';
            btn.disabled = false;
        }
    });
}

function logout() {
    sessionStorage.removeItem('adminToken');
    adminToken = '';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

async function loadDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').style.display = 'grid';
    await Promise.all([loadAdminProducts(), loadAdminSettings()]);
    setupAddForm();
    setupSettingsForm();
    setupColorPicker();
}

// ===== PRODUCTS =====
async function loadAdminProducts() {
    const res = await fetch('/api/products');
    adminProducts = await res.json();
    renderAdminProducts(adminProducts);
    document.getElementById('productCount').textContent = `${adminProducts.length} product${adminProducts.length !== 1 ? 's' : ''} in store`;
}

function filterAdminProducts() {
    const q = document.getElementById('adminSearch').value.toLowerCase();
    const filtered = adminProducts.filter(p =>
        p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
    );
    renderAdminProducts(filtered);
}

function renderAdminProducts(products) {
    const grid = document.getElementById('adminProductGrid');
    if (products.length === 0) {
        grid.innerHTML = `<div class="empty-state"><span class="empty-icon">📦</span><h3>No products yet</h3><p>Click "Add Product" to get started</p></div>`;
        return;
    }
    grid.innerHTML = products.map(p => {
        const img = p.images && p.images.length > 0
            ? `<img class="admin-card-img" src="${p.images[0]}" alt="${escHtml(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="admin-card-img-placeholder" style="display:none">🛍️</div>`
            : `<div class="admin-card-img-placeholder">🛍️</div>`;
        return `
      <div class="admin-card">
        ${img}
        <div class="admin-card-body">
          <div class="admin-card-cat">${escHtml(p.category || 'Product')}</div>
          <div class="admin-card-name" title="${escHtml(p.name)}">${escHtml(p.name)}</div>
          <div class="admin-card-price">${adminSettings.currencySymbol || ''}${Number(p.price).toLocaleString()}</div>
          <div class="admin-card-actions">
            <button class="btn-edit" onclick="editProduct('${p.id}')">✏️ Edit</button>
            <button class="btn-delete" onclick="deleteProduct('${p.id}', '${escHtml(p.name)}')">🗑️ Delete</button>
          </div>
        </div>
      </div>`;
    }).join('');
}

// ===== ADD / EDIT PRODUCT =====
function setupAddForm() {
    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitProductBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const formData = new FormData();
        formData.append('name', document.getElementById('prodName').value);
        formData.append('price', document.getElementById('prodPrice').value);
        formData.append('category', document.getElementById('prodCategory').value);
        formData.append('description', document.getElementById('prodDesc').value);

        // Add kept existing images (edit mode)
        editingImages.forEach(src => formData.append('keepImages', src));

        // Add new uploaded files
        const fileInput = document.getElementById('prodImages');
        for (const file of fileInput.files) formData.append('images', file);

        const editId = document.getElementById('editProductId').value;
        const method = editId ? 'PUT' : 'POST';
        const url = editId ? `/api/admin/products/${editId}` : '/api/admin/products';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'x-admin-token': adminToken },
                body: formData
            });

            if (res.ok) {
                showFormMsg('formMsg', 'success', '✅ Product saved successfully!');
                resetForm();
                await loadAdminProducts();
                showTab('products', document.querySelector('[data-tab=products]'));
            } else {
                const err = await res.json();
                showFormMsg('formMsg', 'error', '❌ Error: ' + (err.error || 'Unknown error'));
            }
        } catch (e) {
            showFormMsg('formMsg', 'error', '❌ Connection error. Try again.');
        }

        btn.disabled = false;
        btn.textContent = editId ? '✓ Update Product' : '✓ Save Product';
    });
}

function editProduct(id) {
    const p = adminProducts.find(x => x.id === id);
    if (!p) return;

    document.getElementById('editProductId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodCategory').value = p.category || '';
    document.getElementById('prodDesc').value = p.description || '';
    document.getElementById('addTabTitle').textContent = 'Edit Product';
    document.getElementById('submitProductBtn').textContent = '✓ Update Product';

    // Show existing images
    editingImages = [...(p.images || [])];
    renderExistingImages();

    showTab('add', document.querySelector('[data-tab=add]'));
}

function renderExistingImages() {
    const previews = document.getElementById('imagePreviews');
    const placeholder = document.getElementById('uploadPlaceholder');
    placeholder.style.display = editingImages.length ? 'none' : 'block';

    const existingHtml = editingImages.map((src, i) => `
    <div class="image-preview-item" data-existing="${i}">
      <img src="${src}" alt="Product image" />
      <button type="button" class="remove-img" onclick="removeExistingImage(${i})">✕</button>
    </div>`).join('');

    previews.innerHTML = existingHtml;
}

function removeExistingImage(idx) {
    editingImages.splice(idx, 1);
    renderExistingImages();
}

function previewImages(input) {
    const previews = document.getElementById('imagePreviews');
    const placeholder = document.getElementById('uploadPlaceholder');
    const files = Array.from(input.files);
    if (files.length === 0) return;
    placeholder.style.display = 'none';

    // Keep existing previews (for edit mode)
    const existingItems = previews.querySelectorAll('[data-existing]');

    // Add new file previews
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'image-preview-item';
            div.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
            previews.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function resetForm() {
    document.getElementById('addProductForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('addTabTitle').textContent = 'Add New Product';
    document.getElementById('submitProductBtn').textContent = '✓ Save Product';
    document.getElementById('imagePreviews').innerHTML = '';
    document.getElementById('uploadPlaceholder').style.display = 'block';
    document.getElementById('formMsg').className = 'form-msg';
    document.getElementById('formMsg').textContent = '';
    editingImages = [];
}

// ===== DELETE =====
function deleteProduct(id, name) {
    // Create confirm dialog
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `
    <div class="confirm-box">
      <h3>Delete Product?</h3>
      <p>Are you sure you want to delete <strong>${escHtml(name)}</strong>? This cannot be undone.</p>
      <div class="actions">
        <button class="btn-secondary" onclick="this.closest('.confirm-modal').remove()">Cancel</button>
        <button class="btn-delete" id="confirmDeleteBtn">Delete</button>
      </div>
    </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#confirmDeleteBtn').addEventListener('click', async () => {
        modal.remove();
        try {
            const res = await fetch(`/api/admin/products/${id}`, {
                method: 'DELETE',
                headers: { 'x-admin-token': adminToken }
            });
            if (res.ok) {
                await loadAdminProducts();
            }
        } catch (e) { console.error(e); }
    });
}

// ===== SETTINGS =====
async function loadAdminSettings() {
    try {
        const res = await fetch('/api/admin/settings', { headers: { 'x-admin-token': adminToken } });
        if (res.ok) {
            adminSettings = await res.json();
            populateSettings();
        }
    } catch (e) { console.error(e); }
}

function populateSettings() {
    const s = adminSettings;
    document.getElementById('setStoreName').value = s.storeName || '';
    document.getElementById('setTagline').value = s.storeTagline || '';
    document.getElementById('setWhatsapp').value = s.whatsappNumber || '';
    document.getElementById('setCurrencySymbol').value = s.currencySymbol || '';
    document.getElementById('setCurrency').value = s.currency || '';
    document.getElementById('setPrimaryColor').value = s.primaryColor || '#6C63FF';
    document.getElementById('setPrimaryColorText').value = s.primaryColor || '#6C63FF';
    document.getElementById('sidebarStoreName').textContent = s.storeName || 'Store';
    // Hero banner fields
    document.getElementById('setHeroTitle').value = s.heroTitle || '';
    document.getElementById('setHeroSubtitle').value = s.heroSubtitle || '';
    // Show existing banner image preview
    const previewWrap = document.getElementById('heroBannerPreviewWrap');
    const previewImg = document.getElementById('heroBannerPreview');
    const uploadZone = document.getElementById('heroBannerUploadZone');
    if (s.heroBannerImage) {
        previewImg.src = s.heroBannerImage;
        previewWrap.style.display = 'block';
        uploadZone.style.display = 'none';
    } else {
        previewWrap.style.display = 'none';
        uploadZone.style.display = 'block';
    }
}

function setupSettingsForm() {
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pw = document.getElementById('setPassword').value;
        const payload = {
            storeName: document.getElementById('setStoreName').value,
            storeTagline: document.getElementById('setTagline').value,
            whatsappNumber: document.getElementById('setWhatsapp').value,
            currencySymbol: document.getElementById('setCurrencySymbol').value,
            currency: document.getElementById('setCurrency').value,
            primaryColor: document.getElementById('setPrimaryColor').value,
            heroTitle: document.getElementById('setHeroTitle').value,
            heroSubtitle: document.getElementById('setHeroSubtitle').value
        };
        if (pw) payload.adminPassword = pw;

        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                if (pw) { adminToken = pw; sessionStorage.setItem('adminToken', pw); }
                adminSettings = { ...adminSettings, ...payload };
                document.getElementById('sidebarStoreName').textContent = payload.storeName || adminSettings.storeName;
                document.getElementById('setPassword').value = '';
                showFormMsg('settingsMsg', 'success', '✅ Settings saved! Refresh the store to see changes.');
            } else {
                showFormMsg('settingsMsg', 'error', '❌ Failed to save settings.');
            }
        } catch (e) {
            showFormMsg('settingsMsg', 'error', '❌ Connection error.');
        }
    });
}

// ===== HERO BANNER =====
async function uploadBanner(input) {
    if (!input.files || !input.files[0]) return;
    const formData = new FormData();
    formData.append('heroBanner', input.files[0]);

    // Show loading state
    const zone = document.getElementById('heroBannerUploadZone');
    zone.innerHTML = '<div style="text-align:center;padding:12px"><div class="spinner" style="margin:0 auto 8px"></div><p>Uploading...</p></div>';

    try {
        const res = await fetch('/api/admin/settings/hero-image', {
            method: 'POST',
            headers: { 'x-admin-token': adminToken },
            body: formData
        });
        if (res.ok) {
            const data = await res.json();
            adminSettings.heroBannerImage = data.url;
            const previewWrap = document.getElementById('heroBannerPreviewWrap');
            const previewImg = document.getElementById('heroBannerPreview');
            previewImg.src = data.url;
            previewWrap.style.display = 'block';
            zone.style.display = 'none';
            showFormMsg('settingsMsg', 'success', '✅ Banner image uploaded!');
        } else {
            showFormMsg('settingsMsg', 'error', '❌ Upload failed.');
            // Restore upload zone
            populateSettings();
        }
    } catch (e) {
        showFormMsg('settingsMsg', 'error', '❌ Upload error.');
        populateSettings();
    }
}

async function removeBanner() {
    try {
        const res = await fetch('/api/admin/settings/hero-image', {
            method: 'DELETE',
            headers: { 'x-admin-token': adminToken }
        });
        if (res.ok) {
            adminSettings.heroBannerImage = '';
            document.getElementById('heroBannerPreviewWrap').style.display = 'none';
            // Restore upload zone
            document.getElementById('heroBannerUploadZone').innerHTML = `
        <input type="file" id="heroBannerInput" accept="image/*" onchange="uploadBanner(this)" />
        <span class="upload-icon">🖼️</span>
        <p>Upload Hero Banner Image</p>
        <small>Recommended: 1920×600px · JPG, PNG, WebP</small>`;
            document.getElementById('heroBannerUploadZone').style.display = 'block';
            showFormMsg('settingsMsg', 'success', '✅ Banner removed.');
        }
    } catch (e) {
        showFormMsg('settingsMsg', 'error', '❌ Failed to remove banner.');
    }
}

function setupColorPicker() {
    const picker = document.getElementById('setPrimaryColor');
    const text = document.getElementById('setPrimaryColorText');
    picker.addEventListener('input', () => { text.value = picker.value; });
    text.addEventListener('input', () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) picker.value = text.value;
    });
}

// ===== NAV TABS =====
function showTab(tabId, link) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    const tab = document.getElementById('tab-' + tabId);
    if (tab) tab.classList.add('active');
    if (link) link.classList.add('active');
    // If switching away from add while editing, reset
    if (tabId !== 'add') resetForm();

    // Close mobile menu if open
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleMobileMenu();
        }
    }
}

// ===== UTILS =====
function showFormMsg(id, type, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = `form-msg ${type}`;
    setTimeout(() => { el.className = 'form-msg'; el.textContent = ''; }, 5000);
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== MOBILE NAV =====
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileOverlay');
    sidebar.classList.toggle('active');

    if (sidebar.classList.contains('active')) {
        overlay.style.display = 'block';
        setTimeout(() => overlay.classList.add('active'), 10);
    } else {
        overlay.classList.remove('active');
        setTimeout(() => overlay.style.display = 'none', 300);
    }
}

init();
