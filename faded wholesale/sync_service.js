const winston = require('winston');
const Product = require('../models/Product');
const User = require('../models/User');

// Configure logger for sync service
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'sync-service' },
  transports: [
    new winston.transports.File({ filename: './logs/sync.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

class SyncService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.adminConnections = new Set(); // Set of admin socket IDs
    this.partnerConnections = new Map(); // partnerId -> Set of socket IDs
    this.syncQueue = []; // Queue for failed sync operations
    this.isProcessingQueue = false;
  }

  /**
   * Initialize the sync service with Socket.IO instance
   */
  initialize(io) {
    this.io = io;
    this.setupEventHandlers();
    logger.info('SyncService initialized with WebSocket support');
    
    // Start queue processing
    this.startQueueProcessing();
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Handle user authentication and room joining
      socket.on('authenticate', async (data) => {
        try {
          const { userId, role, email } = data;
          
          // Store user connection info
          this.connectedUsers.set(userId, socket.id);
          socket.userId = userId;
          socket.userRole = role;
          socket.userEmail = email;

          if (role === 'admin') {
            this.adminConnections.add(socket.id);
            socket.join('admin');
            logger.info(`Admin ${email} authenticated and joined admin room`);
            
            // Send admin-specific sync data
            await this.sendAdminSyncData(socket);
            
          } else if (role === 'partner') {
            if (!this.partnerConnections.has(userId)) {
              this.partnerConnections.set(userId, new Set());
            }
            this.partnerConnections.get(userId).add(socket.id);
            
            socket.join('partners');
            socket.join(`partner_${userId}`);
            logger.info(`Partner ${email} authenticated and joined partner rooms`);
            
            // Send partner-specific sync data
            await this.sendPartnerSyncData(socket, userId);
          }

          socket.emit('authenticated', {
            success: true,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          logger.error('Authentication error:', error);
          socket.emit('authentication_error', {
            error: 'Authentication failed',
            message: error.message
          });
        }
      });

      // Handle sync requests
      socket.on('sync_request', async (data) => {
        try {
          const response = await this.handleSyncRequest(data, socket);
          socket.emit('sync_response', response);
        } catch (error) {
          logger.error('Sync request error:', error);
          socket.emit('sync_error', {
            error: 'Sync failed',
            message: error.message
          });
        }
      });

      // Handle real-time inventory requests
      socket.on('request_inventory_update', async () => {
        try {
          await this.sendInventoryUpdate(socket);
        } catch (error) {
          logger.error('Inventory update error:', error);
          socket.emit('inventory_error', {
            error: 'Failed to get inventory update',
            message: error.message
          });
        }
      });

      // Handle admin broadcasts
      socket.on('admin_broadcast', async (data) => {
        if (socket.userRole === 'admin') {
          try {
            await this.broadcastToPartners(data);
            logger.info(`Admin broadcast sent: ${data.type}`);
          } catch (error) {
            logger.error('Admin broadcast error:', error);
          }
        }
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });
    });
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(socket) {
    const { userId, userRole } = socket;
    
    logger.info(`Client disconnected: ${socket.id} (${userRole})`);

    if (userRole === 'admin') {
      this.adminConnections.delete(socket.id);
    } else if (userRole === 'partner' && userId) {
      const userSockets = this.partnerConnections.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.partnerConnections.delete(userId);
        }
      }
    }

    // Clean up connected users mapping
    if (userId && this.connectedUsers.get(userId) === socket.id) {
      this.connectedUsers.delete(userId);
    }
  }

  /**
   * Send admin-specific sync data
   */
  async sendAdminSyncData(socket) {
    try {
      const [products, stats, recentActivity] = await Promise.all([
        Product.findAll({ order: [['lastModified', 'DESC']], limit: 50 }),
        Product.getInventoryStats(),
        this.getRecentActivity()
      ]);

      socket.emit('admin_sync_data', {
        products,
        stats,
        recentActivity,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error sending admin sync data:', error);
      throw error;
    }
  }

  /**
   * Send partner-specific sync data
   */
  async sendPartnerSyncData(socket, userId) {
    try {
      const [availableProducts, userStats] = await Promise.all([
        Product.findAvailable(),
        this.getPartnerStats(userId)
      ]);

      // Hide internal data for partners
      availableProducts.forEach(product => {
        product.hideInternal = true;
      });

      socket.emit('partner_sync_data', {
        products: availableProducts,
        stats: userStats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error sending partner sync data:', error);
      throw error;
    }
  }

  /**
   * Handle sync requests from clients
   */
  async handleSyncRequest(data, socket) {
    const { type, payload } = data;

    switch (type) {
      case 'product_list':
        return await this.getProductList(payload, socket.userRole);
        
      case 'inventory_stats':
        return await this.getInventoryStats();
        
      case 'user_stats':
        return await this.getPartnerStats(socket.userId);
        
      case 'recent_activity':
        return await this.getRecentActivity();
        
      default:
        throw new Error(`Unknown sync request type: ${type}`);
    }
  }

  /**
   * Get product list with filtering
   */
  async getProductList(filters = {}, userRole) {
    try {
      const where = {};
      
      if (filters.available) {
        where.status = 'AVAILABLE';
        where.stock = { [Product.sequelize.Sequelize.Op.gt]: 0 };
      }
      
      if (filters.grade) where.grade = filters.grade;
      if (filters.status) where.status = filters.status;

      const products = await Product.findAll({
        where,
        order: [['strain', 'ASC']]
      });

      // Hide internal data for non-admin users
      if (userRole !== 'admin') {
        products.forEach(product => {
          product.hideInternal = true;
        });
      }

      return {
        success: true,
        data: { products },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error getting product list:', error);
      throw error;
    }
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats() {
    try {
      const stats = await Product.getInventoryStats();
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting inventory stats:', error);
      throw error;
    }
  }

  /**
   * Get partner-specific statistics
   */
  async getPartnerStats(userId) {
    try {
      // This would typically involve Order model
      // For now, return placeholder data
      return {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null,
        tier: 'Gold'
      };
    } catch (error) {
      logger.error('Error getting partner stats:', error);
      throw error;
    }
  }

  /**
   * Get recent activity
   */
  async getRecentActivity() {
    try {
      const recentProducts = await Product.findAll({
        where: {
          lastModified: {
            [Product.sequelize.Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        order: [['lastModified', 'DESC']],
        limit: 10
      });

      return recentProducts.map(product => ({
        type: 'product_update',
        productId: product.id,
        strain: product.strain,
        action: 'updated',
        timestamp: product.lastModified,
        modifiedBy: product.modifiedBy
      }));

    } catch (error) {
      logger.error('Error getting recent activity:', error);
      return [];
    }
  }

  /**
   * Broadcast product update to all connected clients
   */
  async broadcastProductUpdate(action, product) {
    if (!this.io) return;

    try {
      const updateData = {
        action,
        product: product.toJSON ? product.toJSON() : product,
        timestamp: new Date().toISOString()
      };

      // Send to all admin connections
      this.io.to('admin').emit('product_update', updateData);

      // Send to all partner connections (hide internal data)
      if (product.toJSON) {
        product.hideInternal = true;
        updateData.product = product.toJSON();
      }
      
      this.io.to('partners').emit('product_update', updateData);

      logger.info(`Product update broadcasted: ${action} - ${product.strain || product.id}`);

    } catch (error) {
      logger.error('Error broadcasting product update:', error);
      // Add to queue for retry
      this.addToSyncQueue('product_update', { action, product });
    }
  }

  /**
   * Broadcast bulk product updates
   */
  async broadcastBulkProductUpdate(products) {
    if (!this.io || !Array.isArray(products)) return;

    try {
      const updateData = {
        action: 'bulk_update',
        products: products.map(p => p.toJSON ? p.toJSON() : p),
        timestamp: new Date().toISOString()
      };

      // Send to admin connections
      this.io.to('admin').emit('bulk_product_update', updateData);

      // Send to partner connections (hide internal data)
      const partnerUpdateData = {
        ...updateData,
        products: products.map(p => {
          if (p.toJSON) {
            p.hideInternal = true;
            return p.toJSON();
          }
          return p;
        })
      };

      this.io.to('partners').emit('bulk_product_update', partnerUpdateData);

      logger.info(`Bulk product update broadcasted: ${products.length} products`);

    } catch (error) {
      logger.error('Error broadcasting bulk product update:', error);
      // Add to queue for retry
      this.addToSyncQueue('bulk_product_update', { products });
    }
  }

  /**
   * Broadcast order update to specific partner and admins
   */
  async broadcastOrderUpdate(action, order, partnerId) {
    if (!this.io) return;

    try {
      const updateData = {
        action,
        order,
        timestamp: new Date().toISOString()
      };

      // Send to all admin connections
      this.io.to('admin').emit('order_update', updateData);

      // Send to specific partner
      if (partnerId) {
        this.io.to(`partner_${partnerId}`).emit('order_update', updateData);
      }

      logger.info(`Order update broadcasted: ${action} - ${order.id}`);

    } catch (error) {
      logger.error('Error broadcasting order update:', error);
      this.addToSyncQueue('order_update', { action, order, partnerId });
    }
  }

  /**
   * Broadcast system notification to all or specific users
   */
  async broadcastNotification(notification, targetType = 'all', targetId = null) {
    if (!this.io) return;

    try {
      const notificationData = {
        ...notification,
        timestamp: new Date().toISOString(),
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      switch (targetType) {
        case 'admin':
          this.io.to('admin').emit('notification', notificationData);
          break;
          
        case 'partner':
          if (targetId) {
            this.io.to(`partner_${targetId}`).emit('notification', notificationData);
          } else {
            this.io.to('partners').emit('notification', notificationData);
          }
          break;
          
        case 'all':
        default:
          this.io.emit('notification', notificationData);
          break;
      }

      logger.info(`Notification broadcasted: ${notification.type} to ${targetType}`);

    } catch (error) {
      logger.error('Error broadcasting notification:', error);
      this.addToSyncQueue('notification', { notification, targetType, targetId });
    }
  }

  /**
   * Broadcast to all partners
   */
  async broadcastToPartners(data) {
    if (!this.io) return;

    try {
      this.io.to('partners').emit('admin_message', {
        ...data,
        timestamp: new Date().toISOString()
      });

      logger.info(`Admin message broadcasted to all partners: ${data.type}`);

    } catch (error) {
      logger.error('Error broadcasting to partners:', error);
      this.addToSyncQueue('admin_message', data);
    }
  }

  /**
   * Send inventory update to specific socket
   */
  async sendInventoryUpdate(socket) {
    try {
      const products = await Product.findAvailable();
      
      if (socket.userRole !== 'admin') {
        products.forEach(product => {
          product.hideInternal = true;
        });
      }

      socket.emit('inventory_update', {
        products,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error sending inventory update:', error);
      throw error;
    }
  }

  /**
   * Add failed sync operation to queue for retry
   */
  addToSyncQueue(type, data) {
    this.syncQueue.push({
      type,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });

    logger.info(`Added to sync queue: ${type}`);
  }

  /**
   * Process sync queue for failed operations
   */
  async startQueueProcessing() {
    setInterval(async () => {
      if (this.isProcessingQueue || this.syncQueue.length === 0) return;

      this.isProcessingQueue = true;

      try {
        const item = this.syncQueue.shift();
        
        if (item.retryCount >= 3) {
          logger.warn(`Dropping sync queue item after 3 retries: ${item.type}`);
          return;
        }

        // Retry the sync operation
        switch (item.type) {
          case 'product_update':
            await this.broadcastProductUpdate(item.data.action, item.data.product);
            break;
            
          case 'bulk_product_update':
            await this.broadcastBulkProductUpdate(item.data.products);
            break;
            
          case 'order_update':
            await this.broadcastOrderUpdate(item.data.action, item.data.order, item.data.partnerId);
            break;
            
          case 'notification':
            await this.broadcastNotification(item.data.notification, item.data.targetType, item.data.targetId);
            break;
            
          case 'admin_message':
            await this.broadcastToPartners(item.data);
            break;
        }

        logger.info(`Sync queue item processed: ${item.type}`);

      } catch (error) {
        // Re-add to queue with incremented retry count
        const item = this.syncQueue[0];
        if (item) {
          item.retryCount++;
          this.syncQueue.push(item);
        }
        
        logger.error('Error processing sync queue:', error);
      } finally {
        this.isProcessingQueue = false;
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      totalConnections: this.connectedUsers.size,
      adminConnections: this.adminConnections.size,
      partnerConnections: this.partnerConnections.size,
      queueSize: this.syncQueue.length
    };
  }

  /**
   * Health check for sync service
   */
  healthCheck() {
    return {
      status: 'healthy',
      connections: this.getConnectionStats(),
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const syncService = new SyncService();

module.exports = syncService;