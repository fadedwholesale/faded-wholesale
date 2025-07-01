module.exports = {
  apps: [
    {
      name: 'faded-skies-wholesale',
      script: 'server.js',
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_HOST: process.env.DB_HOST || 'localhost',
        DB_USER: process.env.DB_USER || 'faded_skies_user',
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_NAME: process.env.DB_NAME || 'faded_skies',
        JWT_SECRET: process.env.JWT_SECRET,
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
        SESSION_SECRET: process.env.SESSION_SECRET,
        UPLOAD_MAX_SIZE: process.env.UPLOAD_MAX_SIZE || '5242880',
        EMAIL_HOST: process.env.EMAIL_HOST,
        EMAIL_PORT: process.env.EMAIL_PORT || '587',
        EMAIL_USER: process.env.EMAIL_USER,
        EMAIL_PASS: process.env.EMAIL_PASS,
        DEBUG: process.env.DEBUG || 'false',
        API_RATE_LIMIT: process.env.API_RATE_LIMIT || '1000',
        CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
      },
      
      // Development environment
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        DEBUG: 'true',
        instances: 1,
        exec_mode: 'fork',
        watch: true,
        API_RATE_LIMIT: '10000'
      },
      
      // Staging environment
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        DEBUG: 'false',
        instances: 2,
        API_RATE_LIMIT: '5000'
      },
      
      // Production environment
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DEBUG: 'false',
        instances: 'max',
        API_RATE_LIMIT: '1000'
      },
      
      // Process management
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      
      // Logging
      log_file: './logs/pm2/app.log',
      out_file: './logs/pm2/out.log',
      error_file: './logs/pm2/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',
      
      // Advanced features
      watch: false, // Set to true in development
      ignore_watch: [
        'node_modules',
        'uploads',
        'logs',
        'backups',
        'public',
        '*.log',
        '.git'
      ],
      
      // Health monitoring
      pmx: true,
      
      // Auto-restart on file changes (development only)
      watch_options: {
        followSymlinks: false,
        usePolling: false,
        interval: 1000,
        ignoreInitial: true
      },
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Source map support
      source_map_support: true,
      
      // Process title
      instance_var: 'INSTANCE_ID',
      
      // Interpreter options
      node_args: '--max-old-space-size=2048 --optimize-for-size',
      
      // Cron restart (daily at 3 AM)
      cron_restart: '0 3 * * *',
      
      // Autorestart
      autorestart: true,
      
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      
      // Error handling
      error_file: './logs/pm2/error.log',
      combine_logs: true,
      
      // Time zone
      time: true
    },
    
    // Background worker for email sending and cleanup tasks
    {
      name: 'faded-skies-worker',
      script: 'workers/background-worker.js',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'background',
        QUEUE_NAME: 'background-tasks',
        WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY || '5'
      },
      
      env_development: {
        NODE_ENV: 'development',
        WORKER_TYPE: 'background',
        WORKER_CONCURRENCY: '2',
        DEBUG: 'true'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        WORKER_TYPE: 'background',
        WORKER_CONCURRENCY: '3'
      },
      
      env_production: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'background',
        WORKER_CONCURRENCY: '5'
      },
      
      // Worker-specific settings
      max_memory_restart: '512M',
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 10000,
      
      // Logging
      log_file: './logs/pm2/worker.log',
      out_file: './logs/pm2/worker-out.log',
      error_file: './logs/pm2/worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Cron restart (daily at 4 AM)
      cron_restart: '0 4 * * *',
      
      autorestart: true,
      exp_backoff_restart_delay: 200,
      
      // Health monitoring
      pmx: true,
      
      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 5000
    },
    
    // Real-time sync service
    {
      name: 'faded-skies-sync',
      script: 'services/sync-service.js',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'production',
        SERVICE_TYPE: 'sync',
        SYNC_INTERVAL: process.env.SYNC_INTERVAL || '30000'
      },
      
      env_development: {
        NODE_ENV: 'development',
        SERVICE_TYPE: 'sync',
        SYNC_INTERVAL: '60000',
        DEBUG: 'true'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        SERVICE_TYPE: 'sync',
        SYNC_INTERVAL: '45000'
      },
      
      env_production: {
        NODE_ENV: 'production',
        SERVICE_TYPE: 'sync',
        SYNC_INTERVAL: '30000'
      },
      
      // Sync service settings
      max_memory_restart: '256M',
      min_uptime: '20s',
      max_restarts: 15,
      restart_delay: 5000,
      
      // Logging
      log_file: './logs/pm2/sync.log',
      out_file: './logs/pm2/sync-out.log',
      error_file: './logs/pm2/sync-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      autorestart: true,
      exp_backoff_restart_delay: 150,
      
      // Health monitoring
      pmx: true,
      
      // Graceful shutdown
      kill_timeout: 8000,
      listen_timeout: 4000
    },
    
    // Scheduled job runner
    {
      name: 'faded-skies-scheduler',
      script: 'services/scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'production',
        SERVICE_TYPE: 'scheduler',
        SCHEDULER_ENABLED: process.env.SCHEDULER_ENABLED || 'true'
      },
      
      env_development: {
        NODE_ENV: 'development',
        SERVICE_TYPE: 'scheduler',
        SCHEDULER_ENABLED: 'false',
        DEBUG: 'true'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        SERVICE_TYPE: 'scheduler',
        SCHEDULER_ENABLED: 'true'
      },
      
      env_production: {
        NODE_ENV: 'production',
        SERVICE_TYPE: 'scheduler',
        SCHEDULER_ENABLED: 'true'
      },
      
      // Scheduler settings
      max_memory_restart: '128M',
      min_uptime: '15s',
      max_restarts: 20,
      restart_delay: 3000,
      
      // Logging
      log_file: './logs/pm2/scheduler.log',
      out_file: './logs/pm2/scheduler-out.log',
      error_file: './logs/pm2/scheduler-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      autorestart: true,
      exp_backoff_restart_delay: 100,
      
      // Health monitoring
      pmx: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['server1.fadedskieswholesale.com', 'server2.fadedskieswholesale.com'],
      ref: 'origin/main',
      repo: 'git@github.com:fadedskies/wholesale-platform.git',
      path: '/var/www/faded-skies-wholesale',
      ssh_options: 'StrictHostKeyChecking=no',
      
      // Pre-deploy commands
      'pre-deploy-local': [
        'echo "Starting deployment to production..."',
        'git status',
        'npm run test:ci'
      ].join(' && '),
      
      'pre-deploy': [
        'git fetch --all',
        'pm2 stop all || true',
        'mkdir -p /var/www/faded-skies-wholesale/logs/pm2'
      ].join(' && '),
      
      // Post-deploy commands
      'post-deploy': [
        'npm ci --production --silent',
        'npm run build',
        'npm run db:migrate',
        'pm2 reload ecosystem.config.js --env production',
        'pm2 save',
        'pm2 startup',
        'echo "Production deployment completed successfully"'
      ].join(' && '),
      
      // Post-setup commands
      'post-setup': [
        'npm install --production --silent',
        'pm2 install pm2-logrotate',
        'pm2 set pm2-logrotate:max_size 10M',
        'pm2 set pm2-logrotate:retain 30',
        'pm2 set pm2-logrotate:compress true'
      ].join(' && '),
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    
    staging: {
      user: 'deploy',
      host: 'staging.fadedskieswholesale.com',
      ref: 'origin/develop',
      repo: 'git@github.com:fadedskies/wholesale-platform.git',
      path: '/var/www/faded-skies-wholesale-staging',
      ssh_options: 'StrictHostKeyChecking=no',
      
      'pre-deploy-local': [
        'echo "Starting deployment to staging..."',
        'git status'
      ].join(' && '),
      
      'pre-deploy': [
        'git fetch --all',
        'pm2 stop all || true',
        'mkdir -p /var/www/faded-skies-wholesale-staging/logs/pm2'
      ].join(' && '),
      
      'post-deploy': [
        'npm ci --silent',
        'npm run build',
        'npm run db:migrate',
        'pm2 reload ecosystem.config.js --env staging',
        'pm2 save',
        'echo "Staging deployment completed successfully"'
      ].join(' && '),
      
      'post-setup': [
        'npm install --silent',
        'pm2 install pm2-logrotate'
      ].join(' && '),
      
      env: {
        NODE_ENV: 'staging',
        PORT: 3000
      }
    },
    
    development: {
      user: 'dev',
      host: 'dev.fadedskieswholesale.com',
      ref: 'origin/develop',
      repo: 'git@github.com:fadedskies/wholesale-platform.git',
      path: '/var/www/faded-skies-wholesale-dev',
      ssh_options: 'StrictHostKeyChecking=no',
      
      'pre-deploy-local': 'echo "Starting deployment to development..."',
      
      'pre-deploy': [
        'git fetch --all',
        'pm2 stop all || true'
      ].join(' && '),
      
      'post-deploy': [
        'npm install',
        'npm run build',
        'pm2 reload ecosystem.config.js --env development',
        'pm2 save'
      ].join(' && '),
      
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        DEBUG: 'true'
      }
    }
  }
};