# Faded Skies Wholesale API Documentation

## Overview

The Faded Skies Wholesale API provides a complete backend solution for managing inventory, orders, partners, and real-time synchronization between the admin dashboard and partner portal.

**Base URL:** `https://api.fadedskieswholesale.com`

**WebSocket URL:** `wss://api.fadedskieswholesale.com`

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "partner@store.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "partner@store.com",
    "role": "partner",
    "status": "active"
  }
}
```

### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "new@partner.com",
  "businessName": "Green Valley Dispensary",
  "contactName": "John Smith",
  "phone": "(555) 123-4567",
  "businessType": "Licensed Dispensary",
  "licenseNumber": "CDPH-10001234",
  "address": "123 Cannabis St, Los Angeles, CA"
}
```

## Products API

### Get Products
```http
GET /api/products?status=AVAILABLE&grade=A-GRADE&search=kush
```

**Query Parameters:**
- `status`: Filter by status (AVAILABLE, COMING SOON, SOLD OUT)
- `grade`: Filter by grade (A-GRADE, B-GRADE, ROSIN, VAPE, BULK)
- `search`: Search in strain names

**Response:**
```json
[
  {
    "id": "uuid",
    "grade": "A-GRADE",
    "strain": "Blue Gelatti (EXTC)",
    "thca": 29.5,
    "price": 964.00,
    "status": "AVAILABLE",
    "stock": 15,
    "type": "Sativa",
    "image_url": "https://api.fadedskieswholesale.com/uploads/products/product-123.jpg",
    "created_at": "2025-01-01T12:00:00Z",
    "last_modified": "2025-01-01T12:00:00Z"
  }
]
```

### Create Product (Admin Only)
```http
POST /api/products
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data

grade: A-GRADE
strain: Purple Haze
thca: 28.5
price: 850.00
status: AVAILABLE
stock: 25
type: Sativa
image: <file>
```

### Update Product (Admin Only)
```http
PUT /api/products/:id
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data

price: 900.00
stock: 20
image: <file>
```

### Delete Product (Admin Only)
```http
DELETE /api/products/:id
Authorization: Bearer <admin-token>
```

## Orders API

### Get Orders
```http
GET /api/orders?status=PENDING&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `status`: Filter by status (PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED)
- `limit`: Maximum number of orders to return (default: 50)

**Response:**
```json
[
  {
    "id": "uuid",
    "order_number": "ORD-000001",
    "user_id": "uuid",
    "items_json": [
      {
        "productId": "uuid",
        "quantity": 2,
        "price": 964.00,
        "strain": "Blue Gelatti (EXTC)"
      }
    ],
    "total": 1928.00,
    "status": "PENDING",
    "payment_status": "PAID",
    "tracking_number": null,
    "carrier": null,
    "notes": "Priority delivery requested",
    "created_at": "2025-01-01T12:00:00Z",
    "partner_email": "partner@store.com",
    "partner_name": "Green Valley Dispensary"
  }
]
```

### Create Order
```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2
    }
  ],
  "notes": "Handle with care",
  "delivery_preference": "priority"
}
```

### Update Order
```http
PUT /api/orders/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "SHIPPED",
  "tracking_number": "FS-TRK-12345678",
  "carrier": "FedEx",
  "notes": "Updated delivery instructions"
}
```

## Partners API (Admin Only)

### Get Partners
```http
GET /api/partners
Authorization: Bearer <admin-token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "business_name": "Green Valley Dispensary",
    "contact_name": "John Smith",
    "email": "partner@store.com",
    "phone": "(555) 123-4567",
    "business_type": "Licensed Dispensary",
    "tier": "Gold",
    "status": "active",
    "total_orders": 23,
    "total_revenue": 18450.00,
    "credit_limit": 25000.00,
    "payment_terms": "Net 30",
    "discount_rate": 15.00
  }
]
```

## Analytics API

### Get Dashboard Analytics
```http
GET /api/analytics/dashboard
Authorization: Bearer <token>
```

**Admin Response:**
```json
{
  "products": {
    "total": 150,
    "available": 120
  },
  "orders": {
    "total": 500,
    "pending": 15
  },
  "partners": {
    "total": 50,
    "active": 45
  },
  "revenue": {
    "total": 250000.00
  }
}
```

**Partner Response:**
```json
{
  "orders": {
    "total": 12,
    "pending": 2
  },
  "spending": {
    "total": 18450.00
  }
}
```

## WebSocket Real-Time Updates

Connect to WebSocket at: `wss://api.fadedskieswholesale.com`

### Authentication
```json
{
  "type": "auth",
  "token": "your-jwt-token"
}
```

### Real-Time Events

**Product Updates:**
```json
{
  "type": "product_updated",
  "product": {
    "id": "uuid",
    "strain": "Blue Gelatti (EXTC)",
    "price": 950.00,
    "stock": 12
  }
}
```

**Order Updates:**
```json
{
  "type": "order_created",
  "order": {
    "id": "uuid",
    "order_number": "ORD-000002",
    "status": "PENDING",
    "total": 1500.00
  }
}
```

## Frontend Integration

### Step 1: Include the API Client

Add the API client script to your HTML files:

```html
<script src="api-client.js"></script>
```

### Step 2: Replace Mock Data Functions

Replace your existing mock data functions with API calls:

```javascript
// OLD: Using mock data
let products = [...];

// NEW: Using API
async function loadProducts() {
  const products = await api.getProducts();
  window.products = products;
  updateProductDisplay();
}
```

### Step 3: Update Authentication

Replace your login function:

```javascript
async function login(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    const response = await api.login(email, password);
    window.currentUser = response.user;
    showLoggedInState();
    showPartnerPortal();
  } catch (error) {
    showNotification('Login failed: ' + error.message, 'error');
  }
}
```

### Step 4: Update Cart/Checkout

Replace your checkout function:

```javascript
async function checkout() {
  const orderData = {
    items: cart.map(item => ({
      productId: item.id,
      quantity: item.quantity
    })),
    notes: 'Standard order'
  };
  
  try {
    const order = await api.createOrder(orderData);
    cart = [];
    updateCartDisplay();
    showNotification('Order placed successfully!', 'success');
  } catch (error) {
    showNotification('Checkout failed: ' + error.message, 'error');
  }
}
```

## Error Handling

All API responses follow this error format:

```json
{
  "error": "Error message here",
  "details": "Additional error details (development only)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

API is rate limited to 100 requests per 15-minute window per IP address.

When rate limited, you'll receive:
```json
{
  "error": "Too many requests, please try again later"
}
```

## Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00Z",
  "version": "1.0.0"
}
```

## Deployment Notes

1. **Environment Variables**: Copy `.env.example` to `.env` and configure
2. **Database**: Run `schema.sql` to create database structure
3. **SSL**: Required for production WebSocket connections
4. **CORS**: Configure `ALLOWED_ORIGINS` for your domains
5. **File Uploads**: Ensure `/uploads` directory is writable
6. **Backups**: Database backups run daily via Docker service

## Support

For API support:
- Email: support@fadedskieswholesale.com
- Phone: (210) 835-7834
- Documentation: https://docs.fadedskieswholesale.com