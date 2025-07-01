const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));
app.use('/admin', express.static('public/admin'));
app.use('/portal', express.static('public/portal'));

// File upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/products';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'faded_skies',
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000
};

let db;

async function initDatabase() {
  try {
    db = await mysql.createPool(dbConfig);
    console.log('✅ Database connected successfully');
    
    // Test connection
    const connection = await db.getConnection();
    await connection.ping();
    connection.release();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Authentication middleware
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

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

// Real-time sync system
class SyncManager {
  constructor() {
    this.connectedClients = new Map();
    this.adminClients = new Set();
    this.partnerClients = new Set();
  }

  addClient(socket, userType, userId = null) {
    this.connectedClients.set(socket.id, { socket, userType, userId });
    
    if (userType === 'admin') {
      this.adminClients.add(socket.id);
    } else if (userType === 'partner') {
      this.partnerClients.add(socket.id);
    }
    
    console.log(`📡 ${userType} client connected: ${socket.id}`);
  }

  removeClient(socketId) {
    const client = this.connectedClients.get(socketId);
    if (client) {
      this.adminClients.delete(socketId);
      this.partnerClients.delete(socketId);
      this.connectedClients.delete(socketId);
      console.log(`📡 Client disconnected: ${socketId}`);
    }
  }

  broadcastToAdmins(event, data) {
    this.adminClients.forEach(socketId => {
      const client = this.connectedClients.get(socketId);
      if (client) {
        client.socket.emit(event, data);
      }
    });
  }

  broadcastToPartners(event, data) {
    this.partnerClients.forEach(socketId => {
      const client = this.connectedClients.get(socketId);
      if (client) {
        client.socket.emit(event, data);
      }
    });
  }

  broadcastToAll(event, data) {
    this.connectedClients.forEach(client => {
      client.socket.emit(event, data);
    });
  }
}

const syncManager = new SyncManager();

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('📡 New WebSocket connection:', socket.id);

  socket.on('authenticate', (data) => {
    try {
      const { token, userType } = data;
      
      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
          socket.emit('auth_error', { error: 'Invalid token' });
          return;
        }
        
        syncManager.addClient(socket, userType, user.id);
        socket.emit('authenticated', { success: true });
        
        // Send initial data sync
        if (userType === 'admin') {
          syncManager.broadcastToAdmins('sync_status', { 
            connected: true, 
            timestamp: new Date().toISOString() 
          });
        }
      });
    } catch (error) {
      socket.emit('auth_error', { error: 'Authentication failed' });
    }
  });

  socket.on('disconnect', () => {
    syncManager.removeClient(socket.id);
  });
});

// ROUTES

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected'
  });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, userType } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    let user;
    if (userType === 'admin') {
      // Admin login
      const [rows] = await db.execute(
        'SELECT * FROM admins WHERE email = ?',
        [email]
      );
      user = rows[0];
    } else {
      // Partner login
      const [rows] = await db.execute(
        'SELECT * FROM partners WHERE email = ? AND status = "active"',
        [email]
      );
      user = rows[0];
    }

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    const table = userType === 'admin' ? 'admins' : 'partners';
    await db.execute(
      `UPDATE ${table} SET last_login = NOW() WHERE id = ?`,
      [user.id]
    );

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: userType === 'admin' ? 'admin' : 'partner' 
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.business_name,
        role: userType === 'admin' ? 'admin' : 'partner'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      businessName,
      contactName,
      email,
      phone,
      businessType,
      licenseNumber,
      address
    } = req.body;

    // Validation
    if (!businessName || !contactName || !email || !phone || !businessType) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Check if email already exists
    const [existing] = await db.execute(
      'SELECT id FROM partners WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Generate temporary password (should be sent via email in production)
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Insert new partner
    const [result] = await db.execute(
      `INSERT INTO partners (
        business_name, contact_name, email, phone, business_type, 
        license_number, address, password, status, tier, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'bronze', NOW())`,
      [businessName, contactName, email, phone, businessType, licenseNumber, address, hashedPassword]
    );

    // Notify admins of new registration
    syncManager.broadcastToAdmins('new_partner_registration', {
      id: result.insertId,
      businessName,
      contactName,
      email,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Registration submitted successfully',
      partnerId: result.insertId,
      tempPassword // In production, this should be sent via email
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Products routes
app.get('/api/products', async (req, res) => {
  try {
    const { status, search, category } = req.query;
    
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (strain LIKE ? OR grade LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      query += ' AND grade = ?';
      params.push(category);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/products', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    const {
      grade, strain, thca, price, status, stock, type, costBasis, description
    } = req.body;

    // Validation
    if (!grade || !strain || !price || !status) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

    const [result] = await db.execute(
      `INSERT INTO products (
        grade, strain, thca, price, status, stock, type, cost_basis, 
        description, image_url, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [grade, strain, thca || 0, price, status, stock || 0, type, costBasis, description, imageUrl, req.user.id]
    );

    const newProduct = {
      id: result.insertId,
      grade, strain, thca: thca || 0, price, status, stock: stock || 0, 
      type, cost_basis: costBasis, description, image_url: imageUrl,
      created_at: new Date().toISOString()
    };

    // Broadcast to all clients
    syncManager.broadcastToAll('product_added', newProduct);

    res.status(201).json(newProduct);

  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/products/:id', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      grade, strain, thca, price, status, stock, type, costBasis, description
    } = req.body;

    // Get current product
    const [current] = await db.execute('SELECT * FROM products WHERE id = ?', [productId]);
    if (current.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : current[0].image_url;

    await db.execute(
      `UPDATE products SET 
        grade = ?, strain = ?, thca = ?, price = ?, status = ?, stock = ?, 
        type = ?, cost_basis = ?, description = ?, image_url = ?, updated_at = NOW()
      WHERE id = ?`,
      [grade, strain, thca || 0, price, status, stock || 0, type, costBasis, description, imageUrl, productId]
    );

    const updatedProduct = {
      id: productId,
      grade, strain, thca: thca || 0, price, status, stock: stock || 0,
      type, cost_basis: costBasis, description, image_url: imageUrl,
      updated_at: new Date().toISOString()
    };

    // Broadcast to all clients
    syncManager.broadcastToAll('product_updated', updatedProduct);

    res.json(updatedProduct);

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const productId = req.params.id;

    // Get product to delete image file
    const [product] = await db.execute('SELECT image_url FROM products WHERE id = ?', [productId]);
    
    await db.execute('DELETE FROM products WHERE id = ?', [productId]);

    // Delete image file if exists
    if (product[0]?.image_url) {
      try {
        await fs.unlink(`public${product[0].image_url}`);
      } catch (error) {
        console.warn('Could not delete image file:', error.message);
      }
    }

    // Broadcast to all clients
    syncManager.broadcastToAll('product_deleted', { id: productId });

    res.json({ message: 'Product deleted successfully' });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Orders routes
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let query = `
      SELECT o.*, p.business_name as partner_name 
      FROM orders o 
      LEFT JOIN partners p ON o.partner_id = p.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by partner for non-admin users
    if (req.user.role !== 'admin') {
      query += ' AND o.partner_id = ?';
      params.push(req.user.id);
    }

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (o.id LIKE ? OR o.items LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY o.created_at DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { items, notes, priority } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order items required' });
    }

    // Calculate total and validate stock
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const [productRows] = await db.execute(
        'SELECT * FROM products WHERE id = ? AND status = "available"',
        [item.productId]
      );

      if (productRows.length === 0) {
        return res.status(400).json({ error: `Product ${item.productId} not available` });
      }

      const product = productRows[0];
      
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.strain}. Available: ${product.stock}` 
        });
      }

      total += product.price * item.quantity;
      orderItems.push({
        productId: item.productId,
        strain: product.strain,
        quantity: item.quantity,
        price: product.price
      });
    }

    // Create order
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    const [result] = await db.execute(
      `INSERT INTO orders (
        id, partner_id, items, total, status, notes, priority, created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, NOW())`,
      [orderId, req.user.id, JSON.stringify(orderItems), total, notes, priority || 'normal']
    );

    // Update product stock
    for (const item of orderItems) {
      await db.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
      
      // Check if product is out of stock
      const [stockCheck] = await db.execute(
        'SELECT stock FROM products WHERE id = ?',
        [item.productId]
      );
      
      if (stockCheck[0].stock <= 0) {
        await db.execute(
          'UPDATE products SET status = "soldout" WHERE id = ?',
          [item.productId]
        );
      }
    }

    const newOrder = {
      id: orderId,
      partner_id: req.user.id,
      items: orderItems,
      total,
      status: 'pending',
      notes,
      priority: priority || 'normal',
      created_at: new Date().toISOString()
    };

    // Broadcast to admins
    syncManager.broadcastToAdmins('new_order', newOrder);
    
    // Broadcast inventory updates to all
    syncManager.broadcastToAll('inventory_updated', { 
      timestamp: new Date().toISOString() 
    });

    res.status(201).json(newOrder);

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/orders/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, trackingNumber, carrier, notes } = req.body;

    await db.execute(
      `UPDATE orders SET 
        status = ?, tracking_number = ?, carrier = ?, 
        admin_notes = ?, updated_at = NOW()
      WHERE id = ?`,
      [status, trackingNumber, carrier, notes, orderId]
    );

    const updateData = {
      id: orderId,
      status,
      trackingNumber,
      carrier,
      notes,
      updated_at: new Date().toISOString()
    };

    // Broadcast to all clients
    syncManager.broadcastToAll('order_status_updated', updateData);

    res.json(updateData);

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Partners routes (admin only)
app.get('/api/partners', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, 
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_revenue,
        MAX(o.created_at) as last_order_date
      FROM partners p
      LEFT JOIN orders o ON p.id = o.partner_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    
    res.json(rows);

  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/partners/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const partnerId = req.params.id;
    const { status } = req.body;

    await db.execute(
      'UPDATE partners SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, partnerId]
    );

    // Broadcast to admins
    syncManager.broadcastToAdmins('partner_status_updated', {
      id: partnerId,
      status,
      updated_at: new Date().toISOString()
    });

    res.json({ message: 'Partner status updated successfully' });

  } catch (error) {
    console.error('Error updating partner status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics routes
app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    const { timeframe = '30' } = req.query;
    
    // Base date filter
    let dateFilter = '';
    if (timeframe !== 'all') {
      dateFilter = `AND created_at >= DATE_SUB(NOW(), INTERVAL ${timeframe} DAY)`;
    }

    // Partner filter for non-admin users
    let partnerFilter = '';
    if (req.user.role !== 'admin') {
      partnerFilter = `AND partner_id = ${req.user.id}`;
    }

    const queries = {
      // Order analytics
      orderStats: `
        SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(total), 0) as total_revenue,
          COALESCE(AVG(total), 0) as avg_order_value,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_orders,
          SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped_orders,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders
        FROM orders 
        WHERE 1=1 ${dateFilter} ${partnerFilter}
      `,
      
      // Daily revenue for chart
      dailyRevenue: `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as orders,
          COALESCE(SUM(total), 0) as revenue
        FROM orders 
        WHERE 1=1 ${dateFilter} ${partnerFilter}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `
    };

    const [orderStats] = await db.execute(queries.orderStats);
    const [dailyRevenue] = await db.execute(queries.dailyRevenue);

    res.json({
      orderStats: orderStats[0],
      dailyRevenue,
      timeframe,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// File serving routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/portal/index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/portal/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start server
    server.listen(PORT, () => {
      console.log(`
🌿 Faded Skies Wholesale Server Started! 🚀

📡 Server running on port ${PORT}
🔧 Admin portal: http://localhost:${PORT}/admin
🏪 Partner portal: http://localhost:${PORT}/portal
📊 API endpoints: http://localhost:${PORT}/api
🔌 WebSocket server: Active
💾 Database: Connected
📁 File uploads: Enabled

🎯 Ready for production deployment!
      `);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    if (db) {
      db.end();
    }
    process.exit(0);
  });
});

startServer();