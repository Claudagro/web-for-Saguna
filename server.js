const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Data file paths ---
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// --- Ensure directories exist ---
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- Initialize data files ---
if (!fs.existsSync(PRODUCTS_FILE)) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
    storeName: "ShopEase",
    whatsappNumber: "923001234567",
    adminPassword: "admin123",
    currency: "PKR",
    currencySymbol: "₨",
    storeTagline: "Quality Products, Best Prices",
    primaryColor: "#6C63FF",
    heroTitle: "Discover Amazing Products",
    heroSubtitle: "Quality Products, Best Prices",
    heroBannerImage: ""
  }, null, 2));
}

// --- Helpers ---
function readProducts() {
  return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
}
function writeProducts(data) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(data, null, 2));
}
function readSettings() {
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
}
function writeSettings(data) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// --- Multer setup for image uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
      allowed.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Admin auth middleware ---
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  const settings = readSettings();
  if (token === settings.adminPassword) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// ==================== PUBLIC API ====================

// Get all products
app.get('/api/products', (req, res) => {
  res.json(readProducts());
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const products = readProducts();
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

// Get public settings (no password)
app.get('/api/settings', (req, res) => {
  const s = readSettings();
  res.json({
    storeName: s.storeName,
    whatsappNumber: s.whatsappNumber,
    currency: s.currency,
    currencySymbol: s.currencySymbol,
    storeTagline: s.storeTagline,
    primaryColor: s.primaryColor,
    heroTitle: s.heroTitle || 'Discover Amazing Products',
    heroSubtitle: s.heroSubtitle || s.storeTagline || '',
    heroBannerImage: s.heroBannerImage || ''
  });
});

// ==================== ADMIN API ====================

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const settings = readSettings();
  if (password === settings.adminPassword) {
    res.json({ success: true, token: settings.adminPassword });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// Add product (with images)
app.post('/api/admin/products', adminAuth, upload.array('images', 10), (req, res) => {
  const { name, price, description, category } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });

  const images = (req.files || []).map(f => `/uploads/${f.filename}`);
  const product = {
    id: uuidv4(),
    name: name.trim(),
    price: parseFloat(price),
    description: description ? description.trim() : '',
    category: category ? category.trim() : 'General',
    images,
    createdAt: new Date().toISOString()
  };

  const products = readProducts();
  products.unshift(product);
  writeProducts(products);
  res.json(product);
});

// Update product
app.put('/api/admin/products/:id', adminAuth, upload.array('images', 10), (req, res) => {
  const products = readProducts();
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const { name, price, description, category, keepImages } = req.body;
  const newImages = (req.files || []).map(f => `/uploads/${f.filename}`);

  // Keep existing images if specified
  let existingImages = [];
  if (keepImages) {
    existingImages = Array.isArray(keepImages) ? keepImages : [keepImages];
  }

  products[idx] = {
    ...products[idx],
    name: name ? name.trim() : products[idx].name,
    price: price ? parseFloat(price) : products[idx].price,
    description: description !== undefined ? description.trim() : products[idx].description,
    category: category ? category.trim() : products[idx].category,
    images: [...existingImages, ...newImages],
    updatedAt: new Date().toISOString()
  };

  writeProducts(products);
  res.json(products[idx]);
});

// Delete product
app.delete('/api/admin/products/:id', adminAuth, (req, res) => {
  const products = readProducts();
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  // Delete product images
  const product = products[idx];
  product.images.forEach(img => {
    const imgPath = path.join(__dirname, 'public', img);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  });

  products.splice(idx, 1);
  writeProducts(products);
  res.json({ success: true });
});

// Upload hero banner image
app.post('/api/admin/settings/hero-image', adminAuth, upload.single('heroBanner'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  const current = readSettings();
  // Delete old banner image if exists
  if (current.heroBannerImage) {
    const oldPath = path.join(__dirname, 'public', current.heroBannerImage);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  writeSettings({ ...current, heroBannerImage: imageUrl });
  res.json({ success: true, url: imageUrl });
});

// Remove hero banner image
app.delete('/api/admin/settings/hero-image', adminAuth, (req, res) => {
  const current = readSettings();
  if (current.heroBannerImage) {
    const imgPath = path.join(__dirname, 'public', current.heroBannerImage);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  writeSettings({ ...current, heroBannerImage: '' });
  res.json({ success: true });
});

// Update settings
app.put('/api/admin/settings', adminAuth, (req, res) => {
  const current = readSettings();
  const { storeName, whatsappNumber, adminPassword, currency, currencySymbol, storeTagline, primaryColor, heroTitle, heroSubtitle } = req.body;

  const updated = {
    storeName: storeName || current.storeName,
    whatsappNumber: whatsappNumber || current.whatsappNumber,
    adminPassword: adminPassword || current.adminPassword,
    currency: currency || current.currency,
    currencySymbol: currencySymbol || current.currencySymbol,
    storeTagline: storeTagline !== undefined ? storeTagline : current.storeTagline,
    primaryColor: primaryColor || current.primaryColor,
    heroTitle: heroTitle !== undefined ? heroTitle : current.heroTitle,
    heroSubtitle: heroSubtitle !== undefined ? heroSubtitle : current.heroSubtitle,
    heroBannerImage: current.heroBannerImage
  };
  writeSettings(updated);
  res.json({ success: true });
});

// Get admin settings (full)
app.get('/api/admin/settings', adminAuth, (req, res) => {
  res.json(readSettings());
});

// ==================== SPA Routes ====================
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/product/:id', (req, res) => {
  const products = readProducts();
  const product = products.find(p => p.id === req.params.id);
  const settings = readSettings();

  const indexPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  if (product) {
    const escapeHtmlAttr = str => String(str).replace(/"/g, '&quot;');
    const title = escapeHtmlAttr(`${product.name} - ${settings.storeName}`);
    const desc = escapeHtmlAttr(product.description || settings.storeTagline || '');
    const imgUrl = product.images && product.images.length > 0 ? product.images[0] : settings.heroBannerImage;
    const fullImgUrl = imgUrl ? (req.protocol + '://' + req.get('host') + imgUrl) : '';
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;

    const ogTags = `
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${fullImgUrl}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="product">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${fullImgUrl}">
    `;

    html = html.replace('</head>', ogTags + '\n</head>');
  }

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🛍️  Store: http://localhost:${PORT}`);
  console.log(`🔧 Admin: http://localhost:${PORT}/admin`);
});
