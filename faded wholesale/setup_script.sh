#!/bin/bash

# ========================================
# FADED SKIES BACKEND SETUP SCRIPT
# ========================================

echo "🌿 Setting up Faded Skies Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="16.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to 16+."
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️ Creating environment file..."
    cp .env.example .env
    
    # Generate a random JWT secret
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    # Update .env file with generated secret
    if command -v sed &> /dev/null; then
        sed -i "s/your-super-secure-jwt-secret-key-minimum-32-characters-long-random-string/$JWT_SECRET/" .env
    else
        echo "⚠️ Please manually update JWT_SECRET in .env file"
    fi
    
    echo "✅ Environment file created at .env"
    echo "⚠️ Please review and update the .env file with your production values"
else
    echo "✅ Environment file already exists"
fi

# Create logs directory
mkdir -p logs
echo "✅ Logs directory created"

# Create data directory for database
mkdir -p data
echo "✅ Data directory created"

# Test the server
echo "🧪 Testing server startup..."
timeout 10s npm start &
SERVER_PID=$!

sleep 5

# Check if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ Server started successfully"
    kill $SERVER_PID
else
    echo "❌ Server failed to start"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "🚀 To start the server:"
echo "   npm start          # Production mode"
echo "   npm run dev        # Development mode with auto-reload"
echo ""
echo "🌐 Server will run on:"
echo "   http://localhost:3001"
echo ""
echo "📋 API Endpoints:"
echo "   GET  /health                 # Health check"
echo "   POST /api/auth/login         # User login"
echo "   POST /api/auth/register      # Partner registration"
echo "   GET  /api/products           # Product inventory"
echo "   POST /api/orders             # Place orders"
echo ""
echo "🔐 Default Credentials:"
echo "   Admin: admin@fadedskies.com / admin123"
echo "   Partner: partner@store.com / partner123"
echo ""
echo "⚠️ Important:"
echo "   1. Update .env with your production values"
echo "   2. Change default passwords in production"
echo "   3. Set up SSL certificates for HTTPS"
echo "   4. Configure your domain DNS"
echo ""
echo "📧 Support: info@fadedskies.com"
echo "🌿 Ready to launch your wholesale platform!"