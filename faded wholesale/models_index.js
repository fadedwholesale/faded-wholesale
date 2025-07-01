const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const winston = require('winston');

// Configure database logger
const dbLogger = winston.createLogger({
  level: process.env.DB_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'database' },
  transports: [
    new winston.transports.File({ filename: './logs/database.log' }),
    new winston.transports.Console({ 
      format: winston.format.simple(),
      silent: process.env.NODE_ENV === 'test'
    })
  ]
});

// Database configuration
const config = {
  development: {
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'faded_skies_dev',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    logging: (msg) => dbLogger.debug(msg),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ESOCKETTIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ],
      max: 3
    }
  },
  staging: {
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'faded_skies_staging',
    username: process.env.DB_USER || 'faded_skies_user',
    password: process.env.DB_PASSWORD,
    logging: (msg) => dbLogger.info(msg),
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ESOCKETTIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ],
      max: 5
    }
  },
  production: {
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'faded_skies',
    username: process.env.DB_USER || 'faded_skies_user',
    password: process.env.DB_PASSWORD,
    logging: process.env.DB_LOGGING === 'true' ? (msg) => dbLogger.info(msg) : false,
    pool: {
      max: 30,
      min: 10,
      acquire: 60000,
      idle: 10000
    },
    retry: {
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ESOCKETTIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ],
      max: 5
    },
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  },
  test: {
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'faded_skies_test',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};

// Get environment configuration
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

if (!dbConfig) {
  throw new Error(`No database configuration found for environment: ${env}`);
}

// Validate required environment variables for production
if (env === 'production') {
  const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

// Initialize Sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    ...dbConfig,
    define: {
      // Global model options
      timestamps: true,
      underscored: false,
      freezeTableName: true,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    },
    timezone: process.env.TZ || '+00:00',
    benchmark: env === 'development',
    logQueryParameters: env === 'development'
  }
);

// Test database connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    dbLogger.info(`✅ Database connection established successfully (${env})`);
    return true;
  } catch (error) {
    dbLogger.error('❌ Unable to connect to the database:', error);
    throw error;
  }
}

// Database models
const db = {};

// Import all model files dynamically
const modelsPath = __dirname;
const modelFiles = fs
  .readdirSync(modelsPath)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== 'index.js' &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.') === -1
    );
  });

// Load all models
modelFiles.forEach(file => {
  try {
    const model = require(path.join(modelsPath, file));
    
    // Handle both default exports and named exports
    const Model = model.default || model;
    
    if (Model && Model.name) {
      db[Model.name] = Model;
      dbLogger.debug(`✅ Model loaded: ${Model.name}`);
    } else {
      dbLogger.warn(`⚠️ Skipping invalid model file: ${file}`);
    }
  } catch (error) {
    dbLogger.error(`❌ Error loading model ${file}:`, error);
  }
});

// Set up model associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    try {
      db[modelName].associate(db);
      dbLogger.debug(`✅ Associations set up for: ${modelName}`);
    } catch (error) {
      dbLogger.error(`❌ Error setting up associations for ${modelName}:`, error);
    }
  }
});

// Add Sequelize instance and constructor to db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Database utility functions
db.utils = {
  /**
   * Sync database with force option
   */
  async sync(options = {}) {
    try {
      await sequelize.sync(options);
      dbLogger.info(`✅ Database synced ${options.force ? '(forced)' : ''}`);
      return true;
    } catch (error) {
      dbLogger.error('❌ Database sync failed:', error);
      throw error;
    }
  },

  /**
   * Close database connection
   */
  async close() {
    try {
      await sequelize.close();
      dbLogger.info('✅ Database connection closed');
      return true;
    } catch (error) {
      dbLogger.error('❌ Error closing database connection:', error);
      throw error;
    }
  },

  /**
   * Execute raw SQL query
   */
  async query(sql, options = {}) {
    try {
      const result = await sequelize.query(sql, {
        type: Sequelize.QueryTypes.SELECT,
        ...options
      });
      return result;
    } catch (error) {
      dbLogger.error('❌ Raw query failed:', error);
      throw error;
    }
  },

  /**
   * Create database transaction
   */
  async transaction(callback) {
    const transaction = await sequelize.transaction();
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  /**
   * Health check for database
   */
  async healthCheck() {
    try {
      await sequelize.authenticate();
      
      // Get connection pool info
      const pool = sequelize.connectionManager.pool;
      
      return {
        status: 'healthy',
        database: dbConfig.database,
        host: dbConfig.host,
        dialect: dbConfig.dialect,
        environment: env,
        pool: {
          size: pool ? pool.size : 0,
          used: pool ? pool.used : 0,
          waiting: pool ? pool.pending : 0
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const stats = {};
      
      // Get table row counts
      for (const modelName of Object.keys(db)) {
        if (db[modelName] && typeof db[modelName].count === 'function') {
          try {
            stats[modelName] = await db[modelName].count();
          } catch (error) {
            stats[modelName] = 'error';
          }
        }
      }
      
      return {
        tables: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      dbLogger.error('❌ Error getting database stats:', error);
      throw error;
    }
  },

  /**
   * Initialize sample data for development
   */
  async initSampleData() {
    if (env === 'production') {
      throw new Error('Sample data initialization not allowed in production');
    }

    try {
      // This would be implemented based on your seeding requirements
      dbLogger.info('✅ Sample data initialization would run here');
      return true;
    } catch (error) {
      dbLogger.error('❌ Sample data initialization failed:', error);
      throw error;
    }
  }
};

// Global error handlers for database
sequelize.addHook('afterConnect', (connection, config) => {
  dbLogger.debug('New database connection established');
});

sequelize.addHook('beforeDisconnect', (connection) => {
  dbLogger.debug('Database connection closing');
});

// Handle connection errors
sequelize.connectionManager.on('error', (error) => {
  dbLogger.error('Database connection error:', error);
});

// Test connection on startup
if (env !== 'test') {
  testConnection().catch(error => {
    dbLogger.error('Initial database connection test failed:', error);
    process.exit(1);
  });
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  dbLogger.info('Received SIGINT, closing database connections...');
  try {
    await db.utils.close();
    process.exit(0);
  } catch (error) {
    dbLogger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  dbLogger.info('Received SIGTERM, closing database connections...');
  try {
    await db.utils.close();
    process.exit(0);
  } catch (error) {
    dbLogger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Export database instance
module.exports = db;