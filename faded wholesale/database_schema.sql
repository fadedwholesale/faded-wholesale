-- Faded Skies Wholesale Database Schema
-- MySQL/MariaDB compatible

CREATE DATABASE IF NOT EXISTS faded_skies 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE faded_skies;

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'admin', 'manager') DEFAULT 'admin',
    permissions JSON DEFAULT NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_last_login (last_login)
);

-- Partners table  
CREATE TABLE IF NOT EXISTS partners (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    business_type ENUM('dispensary', 'smoke_shop', 'cbd_store', 'delivery', 'distributor', 'other') NOT NULL,
    license_number VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    status ENUM('active', 'pending', 'review', 'suspended', 'inactive') DEFAULT 'pending',
    tier ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
    discount_rate DECIMAL(5,2) DEFAULT 0.00,
    credit_limit DECIMAL(10,2) DEFAULT 0.00,
    payment_terms ENUM('immediate', 'net_15', 'net_30', 'net_60', 'prepaid') DEFAULT 'immediate',
    notes TEXT,
    last_login TIMESTAMP NULL,
    password_reset_token VARCHAR(255) NULL,
    password_reset_expires TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_tier (tier),
    INDEX idx_business_type (business_type),
    INDEX idx_last_login (last_login),
    INDEX idx_password_reset (password_reset_token)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    grade ENUM('A-GRADE', 'B-GRADE', 'ROSIN', 'VAPE', 'BULK', 'CONCENTRATES') NOT NULL,
    strain VARCHAR(255) NOT NULL,
    thca DECIMAL(5,2) DEFAULT 0.00,
    price DECIMAL(10,2) NOT NULL,
    cost_basis DECIMAL(10,2) DEFAULT NULL,
    status ENUM('available', 'coming_soon', 'sold_out', 'discontinued') DEFAULT 'available',
    stock INT DEFAULT 0,
    type ENUM('indica', 'sativa', 'hybrid', 'concentrate') DEFAULT 'hybrid',
    description TEXT,
    image_url VARCHAR(500),
    sku VARCHAR(100) UNIQUE,
    weight_unit ENUM('lb', 'gram', 'unit') DEFAULT 'lb',
    lab_results JSON DEFAULT NULL,
    featured BOOLEAN DEFAULT FALSE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_grade (grade),
    INDEX idx_status (status),
    INDEX idx_strain (strain),
    INDEX idx_featured (featured),
    INDEX idx_created_at (created_at),
    FULLTEXT idx_search (strain, description),
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    partner_id INT NOT NULL,
    items JSON NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    payment_method VARCHAR(100),
    shipping_address TEXT,
    billing_address TEXT,
    tracking_number VARCHAR(255),
    carrier VARCHAR(100),
    shipped_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    estimated_delivery TIMESTAMP NULL,
    notes TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_partner (partner_id),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_payment_status (payment_status),
    INDEX idx_created_at (created_at),
    INDEX idx_tracking (tracking_number),
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

-- Order status history table
CREATE TABLE IF NOT EXISTS order_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(50) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') NOT NULL,
    notes TEXT,
    changed_by INT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_order (order_id),
    INDEX idx_status (status),
    INDEX idx_changed_at (changed_at),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- Shopping cart table (persistent cart storage)
CREATE TABLE IF NOT EXISTS cart_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    partner_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_cart_item (partner_id, product_id),
    INDEX idx_partner (partner_id),
    INDEX idx_product (product_id),
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- System settings table
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_key (setting_key)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    user_type ENUM('admin', 'partner') NOT NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(100),
    old_values JSON DEFAULT NULL,
    new_values JSON DEFAULT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id, user_type),
    INDEX idx_action (action),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_created_at (created_at)
);

-- Price history table (for tracking price changes)
CREATE TABLE IF NOT EXISTS price_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    old_price DECIMAL(10,2) NOT NULL,
    new_price DECIMAL(10,2) NOT NULL,
    changed_by INT,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_product (product_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- Inventory movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    movement_type ENUM('in', 'out', 'adjustment', 'order', 'return', 'damaged') NOT NULL,
    quantity INT NOT NULL,
    old_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reference_type ENUM('order', 'adjustment', 'restock', 'damage', 'manual') DEFAULT 'manual',
    reference_id VARCHAR(255),
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_product (product_id),
    INDEX idx_type (movement_type),
    INDEX idx_reference (reference_type, reference_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    recipient_id INT NOT NULL,
    recipient_type ENUM('admin', 'partner') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    read_at TIMESTAMP NULL,
    action_url VARCHAR(500),
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_recipient (recipient_id, recipient_type),
    INDEX idx_read_status (read_at),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at)
);

-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_key VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables JSON DEFAULT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_key (template_key),
    INDEX idx_active (active)
);

-- File uploads table
CREATE TABLE IF NOT EXISTS uploads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by INT,
    uploaded_type ENUM('admin', 'partner') DEFAULT 'admin',
    related_type VARCHAR(100),
    related_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_uploaded_by (uploaded_by, uploaded_type),
    INDEX idx_related (related_type, related_id),
    INDEX idx_created_at (created_at)
);

-- Insert default admin user
INSERT INTO admins (email, name, password, role, status) 
VALUES (
    'admin@fadedskies.com', 
    'System Administrator', 
    '$2a$10$N9qo8uLOickgx2ZMRZoMye1YxHgpqIYYe5G1gU3dJZHqDcOPXY8LO', -- password: admin123
    'super_admin',
    'active'
) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Insert default settings
INSERT INTO settings (setting_key, setting_value, description) VALUES
('company_name', 'Faded Skies Wholesale', 'Company name displayed throughout the application'),
('company_email', 'info@fadedskieswholesale.com', 'Main company contact email'),
('company_phone', '(210) 835-7834', 'Main company phone number'),
('company_address', '123 Cannabis Ave, Austin, TX 78701', 'Company physical address'),
('free_shipping_threshold', '1000.00', 'Minimum order amount for free shipping'),
('default_shipping_cost', '25.00', 'Default shipping cost for orders below threshold'),
('tax_rate', '0.0875', 'Default tax rate (8.75%)'),
('sync_interval', '45', 'Real-time sync interval in seconds'),
('low_stock_threshold', '10', 'Alert threshold for low stock items'),
('auto_approve_orders', 'false', 'Whether to auto-approve orders from trusted partners'),
('session_timeout', '8', 'Session timeout in hours'),
('max_cart_items', '50', 'Maximum items allowed in cart'),
('image_max_size', '5242880', 'Maximum image upload size in bytes (5MB)'),
('allowed_file_types', 'jpg,jpeg,png,gif,webp', 'Allowed image file extensions')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Insert sample email templates
INSERT INTO email_templates (template_key, name, subject, body_html, body_text, variables) VALUES
('welcome_partner', 'Partner Welcome Email', 'Welcome to Faded Skies Wholesale!', 
'<h1>Welcome {{partner_name}}!</h1><p>Your wholesale account has been approved. Login at: {{portal_url}}</p>', 
'Welcome {{partner_name}}! Your account has been approved. Login at: {{portal_url}}',
'["partner_name", "portal_url", "temp_password"]'),

('order_confirmation', 'Order Confirmation', 'Order Confirmation - {{order_id}}',
'<h1>Order Confirmed</h1><p>Your order {{order_id}} for ${{total}} has been received and is being processed.</p>',
'Order {{order_id}} for ${{total}} has been confirmed and is being processed.',
'["order_id", "total", "items", "estimated_delivery"]'),

('shipping_notification', 'Shipping Notification', 'Your Order Has Shipped - {{tracking_number}}',
'<h1>Order Shipped!</h1><p>Your order {{order_id}} has shipped. Tracking: {{tracking_number}}</p>',
'Your order {{order_id}} has shipped. Tracking: {{tracking_number}}',
'["order_id", "tracking_number", "carrier", "estimated_delivery"]'),

('password_reset', 'Password Reset', 'Reset Your Password - Faded Skies',
'<h1>Password Reset</h1><p>Click here to reset your password: {{reset_link}}</p><p>Link expires in 24 hours.</p>',
'Reset your password: {{reset_link}} (expires in 24 hours)',
'["reset_link", "partner_name"]')

ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Create triggers for automatic logging

DELIMITER $$

-- Trigger for price changes
CREATE TRIGGER price_change_log 
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    IF OLD.price != NEW.price THEN
        INSERT INTO price_history (product_id, old_price, new_price, changed_by, reason, created_at)
        VALUES (NEW.id, OLD.price, NEW.price, NEW.created_by, 'Manual update', NOW());
    END IF;
END$$

-- Trigger for inventory movements on stock change
CREATE TRIGGER inventory_movement_log
AFTER UPDATE ON products  
FOR EACH ROW
BEGIN
    IF OLD.stock != NEW.stock THEN
        INSERT INTO inventory_movements (
            product_id, movement_type, quantity, old_stock, new_stock, 
            reference_type, notes, created_by, created_at
        )
        VALUES (
            NEW.id, 
            CASE WHEN NEW.stock > OLD.stock THEN 'in' ELSE 'out' END,
            ABS(NEW.stock - OLD.stock),
            OLD.stock,
            NEW.stock,
            'adjustment',
            'Automatic stock adjustment',
            NEW.created_by,
            NOW()
        );
    END IF;
END$$

-- Trigger for order status history
CREATE TRIGGER order_status_log
AFTER UPDATE ON orders
FOR EACH ROW  
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO order_status_history (order_id, status, notes, changed_at)
        VALUES (NEW.id, NEW.status, 'Status updated via system', NOW());
    END IF;
END$$

DELIMITER ;

-- Create views for common queries

-- Product inventory view with calculated margins
CREATE VIEW product_inventory_view AS
SELECT 
    p.*,
    CASE 
        WHEN p.cost_basis IS NOT NULL AND p.cost_basis > 0 
        THEN ROUND(((p.price - p.cost_basis) / p.cost_basis) * 100, 2)
        ELSE NULL 
    END as margin_percentage,
    CASE 
        WHEN p.stock <= 0 THEN 'out_of_stock'
        WHEN p.stock <= 10 THEN 'low_stock'  
        ELSE 'in_stock'
    END as stock_status
FROM products p;

-- Partner performance view
CREATE VIEW partner_performance_view AS
SELECT 
    p.*,
    COUNT(o.id) as total_orders,
    COALESCE(SUM(o.total), 0) as total_revenue,
    COALESCE(AVG(o.total), 0) as avg_order_value,
    MAX(o.created_at) as last_order_date,
    DATEDIFF(NOW(), MAX(o.created_at)) as days_since_last_order
FROM partners p
LEFT JOIN orders o ON p.id = o.partner_id
GROUP BY p.id;

-- Order summary view
CREATE VIEW order_summary_view AS
SELECT 
    o.*,
    p.business_name as partner_name,
    p.email as partner_email,
    p.tier as partner_tier,
    JSON_LENGTH(o.items) as item_count
FROM orders o
LEFT JOIN partners p ON o.partner_id = p.id;

-- Daily sales view
CREATE VIEW daily_sales_view AS
SELECT 
    DATE(created_at) as sale_date,
    COUNT(*) as total_orders,
    SUM(total) as total_revenue,
    AVG(total) as avg_order_value,
    COUNT(DISTINCT partner_id) as unique_customers
FROM orders 
WHERE status NOT IN ('cancelled', 'refunded')
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- Low stock alerts view
CREATE VIEW low_stock_alerts AS
SELECT 
    p.*,
    CASE 
        WHEN p.stock = 0 THEN 'urgent'
        WHEN p.stock <= 5 THEN 'high'
        WHEN p.stock <= 10 THEN 'medium'
        ELSE 'low'
    END as alert_level
FROM products p 
WHERE p.stock <= 10 AND p.status = 'available'
ORDER BY p.stock ASC, p.strain ASC;

-- Analytics summary view
CREATE VIEW analytics_summary AS
SELECT 
    'orders' as metric_type,
    COUNT(*) as total_count,
    SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as last_30_days,
    SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as last_7_days,
    SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
FROM orders
UNION ALL
SELECT 
    'revenue' as metric_type,
    SUM(total) as total_count,
    SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN total ELSE 0 END) as last_30_days,
    SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN total ELSE 0 END) as last_7_days,
    SUM(CASE WHEN DATE(created_at) = CURDATE() THEN total ELSE 0 END) as today
FROM orders
WHERE status NOT IN ('cancelled', 'refunded')
UNION ALL
SELECT 
    'partners' as metric_type,
    COUNT(*) as total_count,
    SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as last_30_days,
    SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as last_7_days,
    SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
FROM partners
WHERE status = 'active';

-- Create indexes for performance optimization
CREATE INDEX idx_orders_date_status ON orders(created_at, status);
CREATE INDEX idx_products_status_stock ON products(status, stock);
CREATE INDEX idx_partners_tier_status ON partners(tier, status);
CREATE INDEX idx_activity_logs_date ON activity_logs(created_at);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, recipient_type, read_at);

-- Enable query cache and optimize settings (for MySQL)
SET GLOBAL query_cache_size = 16777216;
SET GLOBAL query_cache_type = 1;

-- Success message
SELECT 'Database schema created successfully! All tables, triggers, views, and indexes are ready.' as message;