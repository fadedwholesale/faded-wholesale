const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const winston = require('winston');
require('dotenv').config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'faded-skies-wholesale' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Ensure logs directory exists
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs', { recursive: true });
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      'https://fadedskieswholesale.com',
      'https://admin.fadedskieswholesale.com',
      'https://portal.fadedskieswholesale.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT || 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files - serve the HTML files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Basic API routes (placeholder)
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', timestamp: new Date().toISOString() });
});

// Create public directory if it doesn't exist
if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public', { recursive: true });
}

// Check for HTML files and serve them
const checkAndCopyHtml = () => {
  const htmlFiles = [
    'faded_skies_portal-5.html',
    'fadedskies admin almost complete .html'
  ];
  
  htmlFiles.forEach(filename => {
    const sourcePath = path.join(__dirname, 'faded wholesale', filename);
    const destPath = path.join(__dirname, 'public', filename);
    
    if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
      fs.copyFileSync(sourcePath, destPath);
      logger.info(`Copied ${filename} to public directory`);
    }
  });
};

// Copy HTML files on startup
checkAndCopyHtml();

// Serve the HTML files based on route
app.get('/', (req, res) => {
  const portalFile = path.join(__dirname, 'public', 'faded_skies_portal-5.html');
  if (fs.existsSync(portalFile)) {
    res.sendFile(portalFile);
  } else {
    res.send(`
      <html>
        <head><title>Faded Skies Wholesale</title></head>
        <body>
          <h1>Welcome to Faded Skies Wholesale</h1>
          <p>Portal is starting up...</p>
          <a href="/admin">Admin Dashboard</a> | 
          <a href="/portal">Partner Portal</a> | 
          <a href="/health">Health Check</a>
        </body>
      </html>
    `);
  }
});

app.get('/admin', (req, res) => {
  const adminFile = path.join(__dirname, 'public', 'fadedskies admin almost complete .html');
  if (fs.existsSync(adminFile)) {
    res.sendFile(adminFile);
  } else {
    res.send(`
      <html>
        <head><title>Faded Skies Wholesale - Admin</title></head>
        <body>
          <h1>Admin Dashboard</h1>
          <p>Coming soon...</p>
          <a href="/">Home</a> | 
          <a href="/portal">Partner Portal</a>
        </body>
      </html>
    `);
  }
});

app.get('/portal', (req, res) => {
  const portalFile = path.join(__dirname, 'public', 'faded_skies_portal-5.html');
  if (fs.existsSync(portalFile)) {
    res.sendFile(portalFile);
  } else {
    res.send(`
      <html>
        <head><title>Faded Skies Wholesale - Portal</title></head>
        <body>
          <h1>Partner Portal</h1>
          <p>Coming soon...</p>
          <a href="/">Home</a> | 
          <a href="/admin">Admin Dashboard</a>
        </body>
      </html>
    `);
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);
  
  // Join rooms based on user role
  socket.on('join', (data) => {
    const { role, userId } = data;
    
    if (role === 'admin') {
      socket.join('admin');
      logger.info(`Admin user ${userId} joined admin room`);
    } else if (role === 'partner') {
      socket.join('partners');
      socket.join(`partner_${userId}`);
      logger.info(`Partner user ${userId} joined partner rooms`);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`WebSocket client disconnected: ${socket.id}`);
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Server startup
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    // Start server
    server.listen(PORT, HOST, () => {
      logger.info(`🌿 Faded Skies Wholesale server running on http://${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔧 Admin Dashboard: http://${HOST}:${PORT}/admin`);
      logger.info(`📊 Partner Portal: http://${HOST}:${PORT}/portal`);
      logger.info(`💚 WebSocket ready for real-time sync`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Export app and io for testing
module.exports = { app, server, io };
