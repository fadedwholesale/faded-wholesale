// ========================================
// TEST ENVIRONMENT SETUP
// ========================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.PORT = 3002; // Different port for testing
process.env.DB_PATH = ':memory:'; // In-memory SQLite for tests

// Increase test timeout for slower operations
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
    console.log('🧪 Setting up test environment...');
    
    // Create test logs directory
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Suppress console logs during tests (optional)
    if (process.env.SUPPRESS_LOGS === 'true') {
        global.console = {
            ...console,
            log: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: console.error // Keep errors visible
        };
    }
    
    console.log('✅ Test environment setup complete');
});

// Global test cleanup
afterAll(async () => {
    console.log('🧹 Cleaning up test environment...');
    
    // Give time for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Test cleanup complete');
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// Test utilities
global.testUtils = {
    // Wait for a specified time
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // Generate random email for testing
    randomEmail: () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
    
    // Generate random string
    randomString: (length = 10) => Math.random().toString(36).substring(2, length + 2),
    
    // Mock environment variable
    mockEnv: (key, value) => {
        const original = process.env[key];
        process.env[key] = value;
        return () => {
            if (original === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = original;
            }
        };
    }
};

// Database test utilities
global.dbUtils = {
    // Clear all tables
    clearTables: async (db) => {
        const tables = ['users', 'products', 'orders'];
        for (const table of tables) {
            await new Promise((resolve, reject) => {
                db.run(`DELETE FROM ${table}`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    },
    
    // Seed test data
    seedTestData: async (db) => {
        // Add test admin user
        await new Promise((resolve, reject) => {
            const bcrypt = require('bcryptjs');
            const adminPassword = bcrypt.hashSync('admin123', 10);
            
            db.run(
                `INSERT INTO users (email, password, role, business_name, status) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['admin@fadedskies.com', adminPassword, 'admin', 'Faded Skies Admin', 'active'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Add test partner user
        await new Promise((resolve, reject) => {
            const bcrypt = require('bcryptjs');
            const partnerPassword = bcrypt.hashSync('partner123', 10);
            
            db.run(
                `INSERT INTO users (email, password, role, business_name, contact_name, status) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                ['partner@store.com', partnerPassword, 'partner', 'Demo Partner Store', 'Demo User', 'active'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Add test products
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO products (strain, grade, type, thca, price, status, stock, description) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                ['Test Strain', 'GRADE A', 'Indoor', 25.0, 500, 'AVAILABLE', 10, 'Test product'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
};

// API test utilities
global.apiUtils = {
    // Common headers for API requests
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    
    // Create authorization header
    authHeader: (token) => ({
        'Authorization': `Bearer ${token}`
    }),
    
    // Validate response structure
    validateResponse: (response, expectedFields) => {
        expectedFields.forEach(field => {
            expect(response.body).toHaveProperty(field);
        });
    },
    
    // Validate error response
    validateError: (response, expectedStatus, expectedMessage) => {
        expect(response.status).toBe(expectedStatus);
        expect(response.body).toHaveProperty('error');
        if (expectedMessage) {
            expect(response.body.error).toContain(expectedMessage);
        }
    }
};

// Mock external services for testing
jest.mock('nodemailer', () => ({
    createTransport: jest.fn(() => ({
        sendMail: jest.fn((options, callback) => {
            console.log('📧 Mock email sent:', options.subject);
            if (callback) callback(null, { messageId: 'mock-message-id' });
            return Promise.resolve({ messageId: 'mock-message-id' });
        })
    }))
}));

// Mock AWS SDK if needed
jest.mock('aws-sdk', () => ({
    SES: jest.fn(() => ({
        sendEmail: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({ MessageId: 'mock-aws-message-id' })
        })
    })),
    S3: jest.fn(() => ({
        upload: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({ Location: 'mock-s3-url' })
        })
    }))
}));

console.log('🔧 Test setup configuration loaded');

// ========================================
// ADDITIONAL TEST CONFIGURATION:
// 
// Environment variables for testing:
// NODE_ENV=test
// JWT_SECRET=test-secret
// DB_PATH=:memory:
// SUPPRESS_LOGS=true
// 
// To run tests with specific configuration:
// NODE_ENV=test npm test
// ========================================