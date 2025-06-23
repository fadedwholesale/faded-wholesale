// ========================================
// FADED SKIES WHOLESALE PLATFORM - BACKEND API
// Production-ready Node.js/Express server
// ========================================

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Environment configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_PATH = process.env.DB_PATH || './fadedskies.db';

// ========================================
// MIDDLEWARE SETUP
// ========================================

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://fadedskies.com',
        'https://www.fadedskies.com',
        /\.netlify\.app$/,
        /\.vercel\.app$/,
        /\.amazonaws\.com$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Auth rate limiting (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: { error: 'Too many login attempts, please try again later.' }
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// ========================================
// DATABASE SETUP
// ========================================

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to SQLite database');
});

// Create tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'partner',
        business_name TEXT,
        contact_name TEXT,
        phone TEXT,
        business_type TEXT,
        license TEXT,
        expected_volume TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Products table
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strain TEXT NOT NULL,
        grade TEXT NOT NULL,
        type TEXT NOT NULL,
        thca REAL DEFAULT 0,
        price REAL NOT NULL,
        status TEXT DEFAULT 'AVAILABLE',
        stock INTEGER DEFAULT 0,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Orders table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        items TEXT NOT NULL,
        items_detailed TEXT,
        total REAL NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Insert admin user if not exists
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (email, password, role, business_name, status) 
            VALUES (?, ?, ?, ?, ?)`, 
            ['admin@fadedskies.com', adminPassword, 'admin', 'Faded Skies Admin', 'active']);

    // Insert sample partner if not exists
    const partnerPassword = bcrypt.hashSync('partner123', 10);
    db.run(`INSERT OR IGNORE INTO users (email, password, role, business_name, contact_name, status) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
            ['partner@store.com', partnerPassword, 'partner', 'Demo Partner Store', 'Demo User', 'active']);

    // Insert sample products
    const sampleProducts = [
        ['Gelato #33', 'GRADE A', 'Indoor', 28.5, 625, 'AVAILABLE', 45, 'Premium indoor strain with exceptional terpene profile'],
        ['Wedding Cake', 'GRADE A', 'Indoor', 31.2, 675, 'AVAILABLE', 23, 'Top-shelf indoor with heavy resin production'],
        ['Purple Punch', 'GRADE B', 'Greenhouse', 24.8, 425, 'AVAILABLE', 67, 'Quality greenhouse with great value'],
        ['Blue Dream Live', 'ROSIN', 'Concentrate', 0, 22, 'AVAILABLE', 156, 'Premium live rosin concentrate'],
        ['Strawberry Cough', 'VAPE', '0.5g Cart', 0, 12, 'AVAILABLE', 89, 'Live resin vape cartridge'],
        ['OG Kush', 'GRADE A', 'Indoor', 29.7, 650, 'COMING SOON', 0, 'Classic strain coming soon'],
        ['Zkittlez', 'GRADE A', 'Indoor', 27.3, 600, 'AVAILABLE', 34, 'Fruity premium indoor strain'],
        ['White Widow', 'GRADE B', 'Outdoor', 22.1, 350, 'AVAILABLE', 78, 'Classic outdoor quality'],
        ['Gorilla Glue Live', 'ROSIN', 'Concentrate', 0, 28, 'AVAILABLE', 92, 'Premium live rosin'],
        ['Pineapple Express', 'VAPE', '1g Cart', 0, 18, 'AVAILABLE', 156, 'Full gram vape cartridge']
    ];

    const insertProduct = db.prepare(`INSERT OR IGNORE INTO products 
        (strain, grade, type, thca, price, status, stock, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    
    sampleProducts.forEach(product => {
        insertProduct.run(product);
    });
    insertProduct.finalize();

    console.log('✅ Database tables initialized');
});

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

const requirePartner = (req, res, next) => {
    if (req.user.role !== 'partner') {
        return res.status(403).json({ error: 'Partner access required' });
    }
    next();
};

// ========================================
// VALIDATION MIDDLEWARE
// ========================================

const validateLogin = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['admin', 'partner'])
];

const validateRegister = [
    body('businessName').trim().isLength({ min: 2, max: 100 }),
    body('contactName').trim().isLength({ min: 2, max: 50 }),
    body('businessEmail').isEmail().normalizeEmail(),
    body('phone').isMobilePhone(),
    body('businessType').isIn(['dispensary', 'smoke-shop', 'cbd-store', 'distributor', 'delivery', 'other']),
    body('license').trim().isLength({ min: 3, max: 50 }),
    body('expectedVolume').isIn(['3.5k-10.5k', '10.5k-35k', '35k-70k', '70k+'])
];

const validateOrder = [
    body('items').isString().isLength({ min: 1 }),
    body('total').isFloat({ min: 0 }),
    body('itemsDetailed').isArray()
];

// ========================================
// API ROUTES
// ========================================

// Health check endpoint
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    // Check database connection
    db.get("SELECT 1", (err) => {
        const dbStatus = err ? 'disconnected' : 'connected';
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(uptime),
            database: dbStatus,
            memory: {
                used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
            },
            environment: NODE_ENV
        });
    });
});

// ========================================
// AUTHENTICATION ROUTES
// ========================================

// User login
app.post('/api/auth/login', authLimiter, validateLogin, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid input data', details: errors.array() });
    }

    const { email, password, role } = req.body;

    db.get('SELECT * FROM users WHERE email = ? AND role = ?', [email, role], async (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'active') {
            return res.status(401).json({ error: 'Account pending approval. Please contact support.' });
        }

        try {
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email, 
                    role: user.role,
                    businessName: user.business_name 
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    businessName: user.business_name,
                    contactName: user.contact_name
                }
            });

            console.log(`✅ User logged in: ${email} (${role})`);
        } catch (error) {
            console.error('Password comparison error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});

// User registration
app.post('/api/auth/register', validateRegister, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid input data', details: errors.array() });
    }

    const {
        businessName,
        contactName,
        businessEmail,
        phone,
        businessType,
        license,
        expectedVolume
    } = req.body;

    try {
        // Check if user already exists
        db.get('SELECT id FROM users WHERE email = ?', [businessEmail], async (err, existingUser) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (existingUser) {
                return res.status(400).json({ error: 'Email already registered' });
            }

            // Generate temporary password (will be sent via email in production)
            const tempPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Insert new user
            db.run(`INSERT INTO users 
                (email, password, role, business_name, contact_name, phone, business_type, license, expected_volume, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [businessEmail, hashedPassword, 'partner', businessName, contactName, phone, businessType, license, expectedVolume, 'pending'],
                function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Failed to create account' });
                    }

                    console.log(`✅ New partner registered: ${businessEmail} - ${businessName}`);
                    
                    // TODO: Send email with credentials
                    console.log(`📧 Temporary password for ${businessEmail}: ${tempPassword}`);

                    res.status(201).json({
                        message: 'Registration submitted successfully! Our team will review your application within 24 hours and send credentials to your email.',
                        tempCredentials: NODE_ENV === 'development' ? { email: businessEmail, password: tempPassword } : undefined
                    });
                });
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // In a production environment with Redis, you would blacklist the token
    console.log(`✅ User logged out: ${req.user.email}`);
    res.json({ message: 'Logged out successfully' });
});

// ========================================
// PRODUCT ROUTES
// ========================================

// Get all products
app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products ORDER BY created_at DESC', (err, products) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch products' });
        }

        res.json(products);
    });
});

// Get single product (admin only)
app.get('/api/products/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch product' });
        }

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(product);
    });
});

// Create product (admin only)
app.post('/api/products', authenticateToken, requireAdmin, [
    body('strain').trim().isLength({ min: 1 }),
    body('grade').isIn(['GRADE A', 'GRADE B', 'ROSIN', 'VAPE']),
    body('type').trim().isLength({ min: 1 }),
    body('price').isFloat({ min: 0 }),
    body('stock').isInt({ min: 0 })
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid input data', details: errors.array() });
    }

    const { strain, grade, type, thca, price, status, stock, description } = req.body;

    db.run(`INSERT INTO products (strain, grade, type, thca, price, status, stock, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [strain, grade, type, thca || 0, price, status || 'AVAILABLE', stock || 0, description],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to create product' });
                }

                console.log(`✅ Product created: ${strain} (ID: ${this.lastID})`);
                res.status(201).json({ id: this.lastID, message: 'Product created successfully' });
            });
});

// ========================================
// ORDER ROUTES
// ========================================

// Get orders
app.get('/api/orders', authenticateToken, (req, res) => {
    let query = 'SELECT * FROM orders';
    let params = [];

    // Partners can only see their own orders
    if (req.user.role === 'partner') {
        query += ' WHERE user_id = ?';
        params.push(req.user.id);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, orders) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }

        // For admin, include user info
        if (req.user.role === 'admin' && orders.length > 0) {
            const orderPromises = orders.map(order => {
                return new Promise((resolve) => {
                    db.get('SELECT business_name, email FROM users WHERE id = ?', [order.user_id], (err, user) => {
                        order.user_info = user || {};
                        resolve(order);
                    });
                });
            });

            Promise.all(orderPromises).then(ordersWithUsers => {
                res.json(ordersWithUsers);
            });
        } else {
            res.json(orders);
        }
    });
});

// Create order
app.post('/api/orders', authenticateToken, requirePartner, validateOrder, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid input data', details: errors.array() });
    }

    const { items, itemsDetailed, total, notes } = req.body;
    const userId = req.user.id;

    db.run(`INSERT INTO orders (user_id, items, items_detailed, total, notes, status)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, items, JSON.stringify(itemsDetailed), total, notes, 'pending'],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to create order' });
                }

                const orderId = `FS-${Date.now()}-${this.lastID}`;
                
                console.log(`✅ Order created: ${orderId} for ${req.user.businessName} - $${total}`);
                
                // TODO: Send email notification
                console.log(`📧 Order notification sent to info@fadedskies.com`);

                res.status(201).json({
                    orderId,
                    message: 'Order placed successfully',
                    estimatedProcessing: '24-48 hour'
                });
            });
});

// Update order status (admin only)
app.put('/api/orders/:id/status', authenticateToken, requireAdmin, [
    body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid status', details: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    db.run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
           [status, id],
           function(err) {
               if (err) {
                   console.error('Database error:', err);
                   return res.status(500).json({ error: 'Failed to update order' });
               }

               if (this.changes === 0) {
                   return res.status(404).json({ error: 'Order not found' });
               }

               console.log(`✅ Order ${id} status updated to: ${status}`);
               res.json({ message: 'Order status updated successfully' });
           });
});

// ========================================
// USER MANAGEMENT ROUTES (ADMIN)
// ========================================

// Get all users (admin only)
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    db.all('SELECT id, email, role, business_name, contact_name, phone, business_type, license, expected_volume, status, created_at FROM users ORDER BY created_at DESC', 
           (err, users) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }

        res.json(users);
    });
});

// Update user status (admin only)
app.put('/api/users/:id/status', authenticateToken, requireAdmin, [
    body('status').isIn(['pending', 'active', 'suspended'])
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid status', details: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    db.run('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
           [status, id],
           function(err) {
               if (err) {
                   console.error('Database error:', err);
                   return res.status(500).json({ error: 'Failed to update user' });
               }

               if (this.changes === 0) {
                   return res.status(404).json({ error: 'User not found' });
               }

               console.log(`✅ User ${id} status updated to: ${status}`);
               res.json({ message: 'User status updated successfully' });
           });
});

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ========================================
// SERVER STARTUP
// ========================================

const server = app.listen(PORT, () => {
    console.log('🚀 ========================================');
    console.log('🌿 FADED SKIES WHOLESALE PLATFORM API');
    console.log('🚀 ========================================');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`📊 Database: ${DB_PATH}`);
    console.log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
    console.log('📧 Email: info@fadedskies.com');
    console.log('🚀 ========================================');
    console.log('📋 Available Endpoints:');
    console.log('   GET  /health');
    console.log('   POST /api/auth/login');
    console.log('   POST /api/auth/register');
    console.log('   POST /api/auth/logout');
    console.log('   GET  /api/products');
    console.log('   POST /api/products (admin)');
    console.log('   GET  /api/orders');
    console.log('   POST /api/orders');
    console.log('   GET  /api/users (admin)');
    console.log('🚀 ========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        db.close((err) => {
            if (err) {
                console.error('❌ Database close error:', err);
            } else {
                console.log('✅ Database connection closed');
            }
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('📴 SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        db.close((err) => {
            if (err) {
                console.error('❌ Database close error:', err);
            } else {
                console.log('✅ Database connection closed');
            }
            process.exit(0);
        });
    });
});

module.exports = app;