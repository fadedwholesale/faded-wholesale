// ========================================
// FADED SKIES API TESTS
// ========================================

const request = require('supertest');
const app = require('../server');

describe('Faded Skies API', () => {
    let adminToken;
    let partnerToken;
    let testUserId;

    // ========================================
    // HEALTH CHECK TESTS
    // ========================================

    describe('GET /health', () => {
        it('should return health status', async () => {
            const res = await request(app)
                .get('/health')
                .expect(200);

            expect(res.body).toHaveProperty('status', 'healthy');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('uptime');
        });
    });

    // ========================================
    // AUTHENTICATION TESTS
    // ========================================

    describe('Authentication', () => {
        describe('POST /api/auth/login', () => {
            it('should login admin user', async () => {
                const res = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'admin@fadedskies.com',
                        password: 'admin123',
                        role: 'admin'
                    })
                    .expect(200);

                expect(res.body).toHaveProperty('token');
                expect(res.body).toHaveProperty('user');
                expect(res.body.user.role).toBe('admin');
                
                adminToken = res.body.token;
            });

            it('should login partner user', async () => {
                const res = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'partner@store.com',
                        password: 'partner123',
                        role: 'partner'
                    })
                    .expect(200);

                expect(res.body).toHaveProperty('token');
                expect(res.body).toHaveProperty('user');
                expect(res.body.user.role).toBe('partner');
                
                partnerToken = res.body.token;
            });

            it('should reject invalid credentials', async () => {
                await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'invalid@email.com',
                        password: 'wrongpassword',
                        role: 'partner'
                    })
                    .expect(401);
            });

            it('should reject missing fields', async () => {
                await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'admin@fadedskies.com',
                        // missing password and role
                    })
                    .expect(400);
            });
        });

        describe('POST /api/auth/register', () => {
            it('should register new partner', async () => {
                const res = await request(app)
                    .post('/api/auth/register')
                    .send({
                        businessName: 'Test Dispensary',
                        contactName: 'John Doe',
                        businessEmail: 'test@dispensary.com',
                        phone: '+1234567890',
                        businessType: 'dispensary',
                        license: 'TEST-LICENSE-123',
                        expectedVolume: '10.5k-35k'
                    })
                    .expect(201);

                expect(res.body).toHaveProperty('message');
                expect(res.body.message).toContain('Registration submitted successfully');
            });

            it('should reject duplicate email', async () => {
                await request(app)
                    .post('/api/auth/register')
                    .send({
                        businessName: 'Another Store',
                        contactName: 'Jane Doe',
                        businessEmail: 'partner@store.com', // Existing email
                        phone: '+1987654321',
                        businessType: 'cbd-store',
                        license: 'ANOTHER-LICENSE-456',
                        expectedVolume: '3.5k-10.5k'
                    })
                    .expect(400);
            });

            it('should reject invalid input', async () => {
                await request(app)
                    .post('/api/auth/register')
                    .send({
                        businessName: '', // Empty required field
                        contactName: 'Test User',
                        businessEmail: 'invalid-email', // Invalid email
                        phone: 'invalid-phone', // Invalid phone
                        businessType: 'invalid-type', // Invalid business type
                        license: 'L1', // Too short
                        expectedVolume: 'invalid-volume' // Invalid volume
                    })
                    .expect(400);
            });
        });

        describe('POST /api/auth/logout', () => {
            it('should logout successfully with valid token', async () => {
                await request(app)
                    .post('/api/auth/logout')
                    .set('Authorization', `Bearer ${partnerToken}`)
                    .expect(200);
            });

            it('should reject logout without token', async () => {
                await request(app)
                    .post('/api/auth/logout')
                    .expect(401);
            });
        });
    });

    // ========================================
    // PRODUCT TESTS
    // ========================================

    describe('Products', () => {
        describe('GET /api/products', () => {
            it('should get all products (public)', async () => {
                const res = await request(app)
                    .get('/api/products')
                    .expect(200);

                expect(Array.isArray(res.body)).toBe(true);
                expect(res.body.length).toBeGreaterThan(0);
                
                // Check product structure
                const product = res.body[0];
                expect(product).toHaveProperty('id');
                expect(product).toHaveProperty('strain');
                expect(product).toHaveProperty('grade');
                expect(product).toHaveProperty('price');
                expect(product).toHaveProperty('status');
            });
        });

        describe('POST /api/products', () => {
            it('should create product (admin only)', async () => {
                const res = await request(app)
                    .post('/api/products')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        strain: 'Test Strain',
                        grade: 'GRADE A',
                        type: 'Indoor',
                        thca: 25.5,
                        price: 500,
                        status: 'AVAILABLE',
                        stock: 10,
                        description: 'Test product for automated testing'
                    })
                    .expect(201);

                expect(res.body).toHaveProperty('id');
                expect(res.body).toHaveProperty('message', 'Product created successfully');
            });

            it('should reject product creation by partner', async () => {
                await request(app)
                    .post('/api/products')
                    .set('Authorization', `Bearer ${partnerToken}`)
                    .send({
                        strain: 'Unauthorized Product',
                        grade: 'GRADE A',
                        type: 'Indoor',
                        price: 500
                    })
                    .expect(403);
            });

            it('should reject invalid product data', async () => {
                await request(app)
                    .post('/api/products')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        strain: '', // Empty strain
                        grade: 'INVALID_GRADE', // Invalid grade
                        type: 'Indoor',
                        price: -100 // Negative price
                    })
                    .expect(400);
            });
        });
    });

    // ========================================
    // ORDER TESTS
    // ========================================

    describe('Orders', () => {
        describe('POST /api/orders', () => {
            it('should create order (partner only)', async () => {
                const res = await request(app)
                    .post('/api/orders')
                    .set('Authorization', `Bearer ${partnerToken}`)
                    .send({
                        items: 'Test Strain (x2)',
                        itemsDetailed: [
                            {
                                productId: 1,
                                strain: 'Test Strain',
                                quantity: 2,
                                price: 500
                            }
                        ],
                        total: 1000,
                        notes: 'Test order from automated testing'
                    })
                    .expect(201);

                expect(res.body).toHaveProperty('orderId');
                expect(res.body).toHaveProperty('message', 'Order placed successfully');
                expect(res.body.orderId).toMatch(/^FS-\d+-\d+$/);
            });

            it('should reject order creation by admin', async () => {
                await request(app)
                    .post('/api/orders')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        items: 'Admin Test Order',
                        itemsDetailed: [],
                        total: 500,
                        notes: 'This should fail'
                    })
                    .expect(403);
            });

            it('should reject invalid order data', async () => {
                await request(app)
                    .post('/api/orders')
                    .set('Authorization', `Bearer ${partnerToken}`)
                    .send({
                        items: '', // Empty items
                        itemsDetailed: 'invalid', // Should be array
                        total: -100 // Negative total
                    })
                    .expect(400);
            });
        });

        describe('GET /api/orders', () => {
            it('should get partner orders', async () => {
                const res = await request(app)
                    .get('/api/orders')
                    .set('Authorization', `Bearer ${partnerToken}`)
                    .expect(200);

                expect(Array.isArray(res.body)).toBe(true);
            });

            it('should get all orders (admin)', async () => {
                const res = await request(app)
                    .get('/api/orders')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .expect(200);

                expect(Array.isArray(res.body)).toBe(true);
                
                // Admin should see orders with user info
                if (res.body.length > 0) {
                    const order = res.body[0];
                    expect(order).toHaveProperty('user_info');
                }
            });

            it('should reject orders access without auth', async () => {
                await request(app)
                    .get('/api/orders')
                    .expect(401);
            });
        });
    });

    // ========================================
    // USER MANAGEMENT TESTS (ADMIN)
    // ========================================

    describe('User Management', () => {
        describe('GET /api/users', () => {
            it('should get all users (admin only)', async () => {
                const res = await request(app)
                    .get('/api/users')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .expect(200);

                expect(Array.isArray(res.body)).toBe(true);
                expect(res.body.length).toBeGreaterThan(0);
                
                // Check user structure (no passwords should be returned)
                const user = res.body[0];
                expect(user).toHaveProperty('id');
                expect(user).toHaveProperty('email');
                expect(user).toHaveProperty('role');
                expect(user).not.toHaveProperty('password');
            });

            it('should reject user list access by partner', async () => {
                await request(app)
                    .get('/api/users')
                    .set('Authorization', `Bearer ${partnerToken}`)
                    .expect(403);
            });
        });

        describe('PUT /api/users/:id/status', () => {
            it('should update user status (admin only)', async () => {
                // First get a user ID
                const usersRes = await request(app)
                    .get('/api/users')
                    .set('Authorization', `Bearer ${adminToken}`);
                
                const testUser = usersRes.body.find(u => u.email === 'test@dispensary.com');
                if (testUser) {
                    await request(app)
                        .put(`/api/users/${testUser.id}/status`)
                        .set('Authorization', `Bearer ${adminToken}`)
                        .send({ status: 'active' })
                        .expect(200);
                }
            });

            it('should reject invalid status', async () => {
                await request(app)
                    .put('/api/users/1/status')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ status: 'invalid_status' })
                    .expect(400);
            });
        });
    });

    // ========================================
    // ERROR HANDLING TESTS
    // ========================================

    describe('Error Handling', () => {
        it('should return 404 for non-existent routes', async () => {
            await request(app)
                .get('/api/nonexistent')
                .expect(404);
        });

        it('should handle malformed JSON', async () => {
            await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}')
                .expect(400);
        });

        it('should handle missing Authorization header', async () => {
            await request(app)
                .get('/api/orders')
                .expect(401);
        });

        it('should handle invalid JWT token', async () => {
            await request(app)
                .get('/api/orders')
                .set('Authorization', 'Bearer invalid.jwt.token')
                .expect(403);
        });
    });

    // ========================================
    // RATE LIMITING TESTS
    // ========================================

    describe('Rate Limiting', () => {
        it('should rate limit auth attempts', async () => {
            // Make multiple failed login attempts
            for (let i = 0; i < 6; i++) {
                await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'test@test.com',
                        password: 'wrong',
                        role: 'partner'
                    });
            }
            
            // The 6th attempt should be rate limited
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@test.com',
                    password: 'wrong',
                    role: 'partner'
                });
            
            expect(res.status).toBe(429);
        }, 10000); // Increase timeout for this test
    });
});

// ========================================
// TEST SETUP AND TEARDOWN
// ========================================

beforeAll(async () => {
    // Setup test database or any global test configuration
    console.log('🧪 Starting API tests...');
});

afterAll(async () => {
    // Cleanup test data
    console.log('✅ API tests completed');
});

// ========================================
// TEST UTILITIES
// ========================================

const testUtils = {
    // Helper to create test user
    createTestUser: async (userData) => {
        const response = await request(app)
            .post('/api/auth/register')
            .send(userData);
        return response.body;
    },

    // Helper to get auth token
    getAuthToken: async (email, password, role) => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email, password, role });
        return response.body.token;
    },

    // Helper to create test product
    createTestProduct: async (token, productData) => {
        const response = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${token}`)
            .send(productData);
        return response.body;
    }
};

module.exports = { testUtils };

// ========================================
// RUNNING TESTS:
// 
// Run all tests:
// npm test
// 
// Run with coverage:
// npm run test:coverage
// 
// Run specific test file:
// npm test -- tests/api.test.js
// 
// Run tests in watch mode:
// npm test -- --watch
// ========================================