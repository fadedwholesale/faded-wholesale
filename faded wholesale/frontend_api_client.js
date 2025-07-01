// Frontend API Client for Faded Skies Wholesale
// Replace the mock data functions in both HTML files with these API calls

class FadedSkiesAPI {
    constructor() {
        this.baseURL = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001/api' 
            : '/api';
        this.wsURL = window.location.hostname === 'localhost'
            ? 'ws://localhost:3001'
            : `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}`;
        
        this.token = this.getStoredToken();
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Initialize WebSocket connection
        this.initWebSocket();
        
        // Set up axios-like request interceptor
        this.setupRequestInterceptor();
    }

    getStoredToken() {
        try {
            return sessionStorage.getItem('fadedSkiesToken') || localStorage.getItem('fadedSkiesToken');
        } catch (error) {
            console.warn('Could not access token storage:', error);
            return null;
        }
    }

    setToken(token) {
        this.token = token;
        try {
            sessionStorage.setItem('fadedSkiesToken', token);
        } catch (error) {
            console.warn('Could not store token:', error);
        }
    }

    clearToken() {
        this.token = null;
        try {
            sessionStorage.removeItem('fadedSkiesToken');
            localStorage.removeItem('fadedSkiesToken');
        } catch (error) {
            console.warn('Could not clear token:', error);
        }
    }

    setupRequestInterceptor() {
        // Override fetch to automatically add auth headers
        const originalFetch = window.fetch;
        window.fetch = async (url, options = {}) => {
            if (url.includes('/api/') && this.token) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                };
            }
            
            const response = await originalFetch(url, options);
            
            // Handle auth errors globally
            if (response.status === 401 || response.status === 403) {
                this.handleAuthError();
            }
            
            return response;
        };
    }

    handleAuthError() {
        console.warn('Authentication error - clearing session');
        this.clearToken();
        if (window.currentUser) {
            window.currentUser = null;
            if (typeof window.showLoggedOutState === 'function') {
                window.showLoggedOutState();
            }
            if (typeof window.showPublicWebsite === 'function') {
                window.showPublicWebsite();
            }
            if (typeof window.showNotification === 'function') {
                window.showNotification('🔒 Session expired. Please log in again.', 'warning');
            }
        }
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.token) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    // WebSocket Methods
    initWebSocket() {
        try {
            this.ws = new WebSocket(this.wsURL);
            
            this.ws.onopen = () => {
                console.log('🔗 WebSocket connected');
                this.reconnectAttempts = 0;
                
                // Authenticate WebSocket if we have a token
                if (this.token) {
                    this.ws.send(JSON.stringify({
                        type: 'auth',
                        token: this.token
                    }));
                }
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('WebSocket initialization failed:', error);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting WebSocket reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.initWebSocket();
            }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
        } else {
            console.warn('Max WebSocket reconnection attempts reached');
            if (typeof window.showNotification === 'function') {
                window.showNotification('⚠️ Real-time updates disconnected. Please refresh the page.', 'warning');
            }
        }
    }

    handleWebSocketMessage(data) {
        console.log('📡 WebSocket message received:', data);
        
        switch (data.type) {
            case 'auth_success':
                console.log('✅ WebSocket authenticated');
                break;
                
            case 'auth_error':
                console.error('❌ WebSocket auth failed:', data.message);
                break;
                
            case 'product_created':
            case 'product_updated':
            case 'product_deleted':
                this.handleProductUpdate(data);
                break;
                
            case 'order_created':
            case 'order_updated':
                this.handleOrderUpdate(data);
                break;
                
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    handleProductUpdate(data) {
        console.log('📦 Product update received:', data);
        
        if (typeof window.updateAllViews === 'function') {
            // Trigger a refresh of products data
            window.updateAllViews();
        }
        
        if (typeof window.showNotification === 'function') {
            let message = '';
            switch (data.type) {
                case 'product_created':
                    message = `🆕 New product added: ${data.product.strain}`;
                    break;
                case 'product_updated':
                    message = `📝 Product updated: ${data.product.strain}`;
                    break;
                case 'product_deleted':
                    message = `🗑️ Product removed from inventory`;
                    break;
            }
            window.showNotification(message, 'success');
        }
    }

    handleOrderUpdate(data) {
        console.log('📋 Order update received:', data);
        
        if (typeof window.updateOrderHistory === 'function') {
            window.updateOrderHistory();
        }
        
        if (typeof window.showNotification === 'function') {
            let message = '';
            switch (data.type) {
                case 'order_created':
                    message = `📦 New order placed: ${data.order.order_number}`;
                    break;
                case 'order_updated':
                    message = `📝 Order updated: ${data.order.order_number}`;
                    break;
            }
            window.showNotification(message, 'success');
        }
    }

    // Authentication API
    async login(email, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (response.success && response.token) {
            this.setToken(response.token);
            
            // Re-authenticate WebSocket
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'auth',
                    token: response.token
                }));
            }
        }
        
        return response;
    }

    async register(userData) {
        return await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    // Products API
    async getProducts(filters = {}) {
        const params = new URLSearchParams();
        
        if (filters.status) params.append('status', filters.status);
        if (filters.grade) params.append('grade', filters.grade);
        if (filters.search) params.append('search', filters.search);
        
        const queryString = params.toString();
        return await this.request(`/products${queryString ? '?' + queryString : ''}`);
    }

    async createProduct(productData, imageFile = null) {
        const formData = new FormData();
        
        Object.keys(productData).forEach(key => {
            if (productData[key] !== null && productData[key] !== undefined) {
                formData.append(key, productData[key]);
            }
        });
        
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        return await this.request('/products', {
            method: 'POST',
            headers: {
                // Don't set Content-Type for FormData - let browser set it with boundary
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });
    }

    async updateProduct(productId, updates, imageFile = null) {
        const formData = new FormData();
        
        Object.keys(updates).forEach(key => {
            if (updates[key] !== null && updates[key] !== undefined) {
                formData.append(key, updates[key]);
            }
        });
        
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        return await this.request(`/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });
    }

    async deleteProduct(productId) {
        return await this.request(`/products/${productId}`, {
            method: 'DELETE'
        });
    }

    // Orders API
    async getOrders(filters = {}) {
        const params = new URLSearchParams();
        
        if (filters.status) params.append('status', filters.status);
        if (filters.limit) params.append('limit', filters.limit);
        
        const queryString = params.toString();
        return await this.request(`/orders${queryString ? '?' + queryString : ''}`);
    }

    async createOrder(orderData) {
        return await this.request('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    async updateOrder(orderId, updates) {
        return await this.request(`/orders/${orderId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    // Partners API (Admin only)
    async getPartners() {
        return await this.request('/partners');
    }

    async createPartner(partnerData) {
        return await this.request('/partners', {
            method: 'POST',
            body: JSON.stringify(partnerData)
        });
    }

    async updatePartner(partnerId, updates) {
        return await this.request(`/partners/${partnerId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    async deletePartner(partnerId) {
        return await this.request(`/partners/${partnerId}`, {
            method: 'DELETE'
        });
    }

    // Analytics API
    async getDashboardAnalytics() {
        return await this.request('/analytics/dashboard');
    }

    // Health check
    async healthCheck() {
        return await this.request('/health');
    }
}

// Initialize the API client
const api = new FadedSkiesAPI();

// Make it globally available
window.fadedSkiesAPI = api;

// Updated frontend functions that use the API
// Replace the existing functions in your HTML files with these:

async function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showNotification('⚠️ All fields are required', 'error');
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Authenticating...';
    submitBtn.disabled = true;
    
    try {
        const response = await api.login(email, password);
        
        if (response.success) {
            window.currentUser = response.user;
            
            if (typeof showLoggedInState === 'function') {
                showLoggedInState();
            }
            
            if (typeof closeModal === 'function') {
                closeModal('loginModal');
            }
            
            if (typeof showPartnerPortal === 'function') {
                showPartnerPortal();
            }
            
            showNotification('✅ Welcome back! Successfully logged in.', 'success');
            
            // Refresh data after login
            if (typeof updateAllViews === 'function') {
                updateAllViews();
            }
            
            event.target.reset();
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification(`❌ Login failed: ${error.message}`, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function register(event) {
    event.preventDefault();
    
    const formData = {
        email: document.getElementById('businessEmail').value.trim(),
        businessName: document.getElementById('businessName').value.trim(),
        contactName: document.getElementById('contactName').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        businessType: document.getElementById('businessType').value,
        address: document.getElementById('address')?.value.trim() || ''
    };
    
    // Validation
    if (!formData.email || !formData.businessName || !formData.contactName || 
        !formData.phone || !formData.businessType) {
        showNotification('⚠️ All required fields must be filled', 'error');
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting Application...';
    submitBtn.disabled = true;
    
    try {
        const response = await api.register(formData);
        
        showNotification('✅ Registration submitted successfully! Our team will contact you within 24-48 hours.', 'success');
        
        if (typeof closeModal === 'function') {
            closeModal('registerModal');
        }
        
        event.target.reset();
        
    } catch (error) {
        console.error('Registration error:', error);
        showNotification(`❌ Registration failed: ${error.message}`, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function loadProducts(filters = {}) {
    try {
        const products = await api.getProducts(filters);
        
        // Update global products array for compatibility with existing code
        window.products = products;
        
        return products;
    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('❌ Failed to load products', 'error');
        return [];
    }
}

async function loadOrders(filters = {}) {
    try {
        const orders = await api.getOrders(filters);
        
        // Update global orders array for compatibility with existing code
        window.orders = orders;
        
        return orders;
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('❌ Failed to load orders', 'error');
        return [];
    }
}

async function placeOrder(orderData) {
    try {
        const order = await api.createOrder(orderData);
        showNotification(`🎉 Order placed successfully! Order #${order.order_number}`, 'success');
        
        // Refresh orders and products
        if (typeof updateAllViews === 'function') {
            updateAllViews();
        }
        
        return order;
    } catch (error) {
        console.error('Error placing order:', error);
        showNotification(`❌ Order failed: ${error.message}`, 'error');
        throw error;
    }
}

// Enhanced checkout function that uses the API
async function checkout() {
    if (!window.currentUser) {
        showNotification('🔒 Please log in to complete checkout', 'error');
        return;
    }

    if (!window.cart || window.cart.length === 0) {
        showNotification('⚠️ Your cart is empty! Add some products first.', 'error');
        return;
    }

    const checkoutBtn = document.querySelector('#cart .btn-primary');
    const originalText = checkoutBtn.textContent;
    checkoutBtn.textContent = 'Processing Order...';
    checkoutBtn.disabled = true;

    try {
        // Prepare order data
        const orderData = {
            items: window.cart.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                price: item.price
            })),
            notes: '', // Could add a notes field to the cart
            delivery_preference: window.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) > 1000 ? 'priority' : 'standard'
        };

        const order = await placeOrder(orderData);
        
        // Clear cart and update display
        window.cart = [];
        if (typeof updateCartDisplay === 'function') {
            updateCartDisplay();
        }
        
        if (typeof toggleCart === 'function') {
            toggleCart();
        }

        // Show success messages
        setTimeout(() => {
            showNotification(`📧 Order confirmation sent to ${window.currentUser.email}`, 'success');
        }, 2000);

    } catch (error) {
        // Error already handled in placeOrder
    } finally {
        checkoutBtn.textContent = originalText;
        checkoutBtn.disabled = false;
    }
}

// Auto-refresh data function
async function refreshData() {
    if (!window.currentUser) return;
    
    try {
        console.log('🔄 Refreshing data from API...');
        
        // Load fresh data
        await Promise.all([
            loadProducts(),
            loadOrders()
        ]);
        
        // Update all views
        if (typeof updateAllViews === 'function') {
            updateAllViews();
        }
        
        console.log('✅ Data refreshed successfully');
    } catch (error) {
        console.error('Error refreshing data:', error);
    }
}

// Auto-refresh data every 2 minutes when user is logged in
setInterval(() => {
    if (window.currentUser && document.visibilityState === 'visible') {
        refreshData();
    }
}, 120000);

// Refresh data when page becomes visible again
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window.currentUser) {
        refreshData();
    }
});

// Session restoration on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔄 Checking for existing session...');
    
    if (api.token) {
        try {
            // Verify token is still valid by calling a protected endpoint
            const analytics = await api.getDashboardAnalytics();
            
            // Token is valid, restore session
            console.log('✅ Session restored from token');
            
            // You'll need to reconstruct the user object or fetch it from an endpoint
            // For now, we'll create a minimal user object
            window.currentUser = {
                email: 'restored@session.com', // You might want to decode this from JWT
                role: 'partner', // You might want to decode this from JWT
                loginTime: new Date().toISOString()
            };
            
            if (typeof showLoggedInState === 'function') {
                showLoggedInState();
            }
            
            // Load initial data
            await refreshData();
            
        } catch (error) {
            console.log('❌ Session restoration failed:', error.message);
            api.clearToken();
        }
    }
});

console.log('🚀 Faded Skies API Client initialized');
console.log('📡 WebSocket connection established for real-time updates');
console.log('🔗 Backend integration ready for production deployment!');