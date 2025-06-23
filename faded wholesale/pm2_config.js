module.exports = {
  apps: [
    {
      name: 'faded-skies-api',
      script: 'server.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto-restart settings
      watch: false, // Set to true for development
      ignore_watch: ['node_modules', 'logs', 'data'],
      max_memory_restart: '512M',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Health monitoring
      health_check_grace_period: 30000,
      health_check_fatal_exceptions: true,
      
      // Advanced settings
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      
      // Source map support
      source_map_support: true,
      
      // Environment-specific overrides
      env_development: {
        NODE_ENV: 'development',
        watch: true,
        instances: 1
      }
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'git@github.com:fadedskies/backend.git',
      path: '/var/www/faded-skies-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'sudo apt-get update && sudo apt-get install -y git nodejs npm'
    },
    staging: {
      user: 'ubuntu',
      host: ['staging-server-ip'],
      ref: 'origin/develop',
      repo: 'git@github.com:fadedskies/backend.git',
      path: '/var/www/faded-skies-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging'
    }
  }
};

// ========================================
// PM2 USAGE COMMANDS:
// 
// Start application:
// pm2 start ecosystem.config.js --env production
// 
// Monitor processes:
// pm2 monit
// 
// View logs:
// pm2 logs faded-skies-api
// 
// Restart application:
// pm2 restart faded-skies-api
// 
// Stop application:
// pm2 stop faded-skies-api
// 
// Deploy to production:
// pm2 deploy production setup
// pm2 deploy production
// 
// Save PM2 configuration:
// pm2 save
// pm2 startup
// ========================================