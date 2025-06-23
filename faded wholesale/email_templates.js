// ========================================
// FADED SKIES EMAIL TEMPLATES
// ========================================

const nodemailer = require('nodemailer');

// Email configuration
const EMAIL_CONFIG = {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'info@fadedskies.com',
        pass: process.env.EMAIL_PASS
    }
};

// Create transporter
const transporter = nodemailer.createTransporter(EMAIL_CONFIG);

// ========================================
// EMAIL TEMPLATES
// ========================================

const templates = {
    // Welcome email for new partners
    partnerWelcome: (userData) => ({
        subject: '🌿 Welcome to Faded Skies Wholesale Family!',
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Faded Skies</title>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    line-height: 1.6; 
                    color: #333; 
                    max-width: 600px; 
                    margin: 0 auto; 
                    padding: 20px; 
                }
                .header { 
                    background: linear-gradient(135deg, #00C851, #1DD65F); 
                    color: white; 
                    padding: 30px; 
                    text-align: center; 
                    border-radius: 10px 10px 0 0; 
                }
                .content { 
                    background: #f8f9fa; 
                    padding: 30px; 
                    border-radius: 0 0 10px 10px; 
                }
                .button { 
                    display: inline-block; 
                    background: #00C851; 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                    font-weight: bold; 
                }
                .footer { 
                    text-align: center; 
                    margin-top: 30px; 
                    padding-top: 20px; 
                    border-top: 1px solid #ddd; 
                    color: #666; 
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🌿 Welcome to Faded Skies!</h1>
                <p>Premium THCA Wholesale Platform</p>
            </div>
            
            <div class="content">
                <h2>Hi ${userData.contactName || userData.businessName}!</h2>
                
                <p>Thank you for joining the Faded Skies wholesale family! We're excited to partner with <strong>${userData.businessName}</strong> and help grow your business with our premium THCA products.</p>
                
                <h3>🎁 Your Welcome Bonus</h3>
                <p>You've automatically received <strong>500 Faded Points</strong> to start earning rewards on every purchase!</p>
                
                <h3>📋 What's Next?</h3>
                <ul>
                    <li>✅ Your registration has been received</li>
                    <li>🔍 Our team will verify your business license within 24 hours</li>
                    <li>📧 You'll receive login credentials via email</li>
                    <li>🛒 Start ordering premium THCA products</li>
                </ul>
                
                <a href="https://fadedskies.com" class="button">Visit Our Platform</a>
                
                <h3>💰 Partnership Benefits</h3>
                <ul>
                    <li><strong>Wholesale Pricing:</strong> Up to 25% off retail prices</li>
                    <li><strong>Quality Guarantee:</strong> 100% lab-tested products</li>
                    <li><strong>Fast Shipping:</strong> 24-48 hour processing</li>
                    <li><strong>Dedicated Support:</strong> Your success is our priority</li>
                </ul>
                
                <p>Questions? Reply to this email or call us at <strong>(210) 835-7834</strong>.</p>
                
                <p>Welcome to the family!<br>
                <strong>The Faded Skies Team</strong></p>
            </div>
            
            <div class="footer">
                <p>Faded Skies Wholesale | Austin, TX<br>
                📧 info@fadedskies.com | 📞 (210) 835-7834<br>
                Licensed Hemp Processor | Farm Bill Compliant</p>
            </div>
        </body>
        </html>
        `,
        text: `
        Welcome to Faded Skies Wholesale, ${userData.contactName || userData.businessName}!
        
        Thank you for joining our wholesale family! We're excited to partner with ${userData.businessName}.
        
        Your Welcome Bonus: 500 Faded Points automatically added to your account!
        
        What's Next:
        - Your registration has been received
        - Our team will verify your business license within 24 hours
        - You'll receive login credentials via email
        - Start ordering premium THCA products
        
        Partnership Benefits:
        - Wholesale Pricing: Up to 25% off retail prices
        - Quality Guarantee: 100% lab-tested products
        - Fast Shipping: 24-48 hour processing
        - Dedicated Support: Your success is our priority
        
        Questions? Reply to this email or call (210) 835-7834.
        
        Welcome to the family!
        The Faded Skies Team
        
        Faded Skies Wholesale | Austin, TX
        info@fadedskies.com | (210) 835-7834
        Licensed Hemp Processor | Farm Bill Compliant
        `
    }),

    // Order confirmation email
    orderConfirmation: (orderData, userData) => ({
        subject: `🎉 Order Confirmation - ${orderData.orderId}`,
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation</title>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    line-height: 1.6; 
                    color: #333; 
                    max-width: 600px; 
                    margin: 0 auto; 
                    padding: 20px; 
                }
                .header { 
                    background: linear-gradient(135deg, #00C851, #1DD65F); 
                    color: white; 
                    padding: 30px; 
                    text-align: center; 
                    border-radius: 10px 10px 0 0; 
                }
                .content { 
                    background: #f8f9fa; 
                    padding: 30px; 
                }
                .order-details { 
                    background: white; 
                    padding: 20px; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                    border-left: 4px solid #00C851; 
                }
                .order-items { 
                    background: white; 
                    padding: 20px; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                }
                .total { 
                    font-size: 1.25em; 
                    font-weight: bold; 
                    color: #00C851; 
                    text-align: right; 
                    margin-top: 15px; 
                    padding-top: 15px; 
                    border-top: 2px solid #00C851; 
                }
                .footer { 
                    text-align: center; 
                    margin-top: 30px; 
                    padding-top: 20px; 
                    border-top: 1px solid #ddd; 
                    color: #666; 
                    border-radius: 0 0 10px 10px; 
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🎉 Order Confirmed!</h1>
                <p>Thank you for your order, ${userData.businessName}!</p>
            </div>
            
            <div class="content">
                <div class="order-details">
                    <h3>📋 Order Details</h3>
                    <p><strong>Order ID:</strong> ${orderData.orderId}</p>
                    <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Processing Time:</strong> ${orderData.estimatedProcessing || '24-48 hours'}</p>
                    <p><strong>Status:</strong> <span style="color: #00C851;">Confirmed</span></p>
                </div>
                
                <div class="order-items">
                    <h3>📦 Items Ordered</h3>
                    <p>${orderData.items}</p>
                    ${orderData.notes ? `<p><strong>Notes:</strong> ${orderData.notes}</p>` : ''}
                    
                    <div class="total">
                        Total: $${orderData.total.toFixed(2)}
                    </div>
                </div>
                
                <h3>📍 What Happens Next?</h3>
                <ul>
                    <li>✅ Your order is confirmed and in our queue</li>
                    <li>📦 We'll process and package your order within ${orderData.estimatedProcessing || '24-48 hours'}</li>
                    <li>🚚 You'll receive tracking information once shipped</li>
                    <li>📞 Our team may contact you if we have any questions</li>
                </ul>
                
                <p>Questions about your order? Reply to this email or call <strong>(210) 835-7834</strong>.</p>
                
                <p>Thank you for choosing Faded Skies!<br>
                <strong>Your Wholesale Team</strong></p>
            </div>
            
            <div class="footer">
                <p>Faded Skies Wholesale | Austin, TX<br>
                📧 info@fadedskies.com | 📞 (210) 835-7834<br>
                Licensed Hemp Processor | Farm Bill Compliant</p>
            </div>
        </body>
        </html>
        `,
        text: `
        Order Confirmed! - ${orderData.orderId}
        
        Thank you for your order, ${userData.businessName}!
        
        Order Details:
        - Order ID: ${orderData.orderId}
        - Order Date: ${new Date().toLocaleDateString()}
        - Processing Time: ${orderData.estimatedProcessing || '24-48 hours'}
        - Status: Confirmed
        
        Items Ordered:
        ${orderData.items}
        ${orderData.notes ? `Notes: ${orderData.notes}` : ''}
        
        Total: $${orderData.total.toFixed(2)}
        
        What Happens Next:
        - Your order is confirmed and in our queue
        - We'll process and package your order within ${orderData.estimatedProcessing || '24-48 hours'}
        - You'll receive tracking information once shipped
        - Our team may contact you if we have any questions
        
        Questions? Reply to this email or call (210) 835-7834.
        
        Thank you for choosing Faded Skies!
        Your Wholesale Team
        
        Faded Skies Wholesale | Austin, TX
        info@fadedskies.com | (210) 835-7834
        Licensed Hemp Processor | Farm Bill Compliant
        `
    }),

    // Admin notification for new registration
    adminNewRegistration: (userData) => ({
        subject: `🔔 New Partner Registration - ${userData.businessName}`,
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Partner Registration</title>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    line-height: 1.6; 
                    color: #333; 
                    max-width: 600px; 
                    margin: 0 auto; 
                    padding: 20px; 
                }
                .header { 
                    background: linear-gradient(135deg, #007BFF, #0056B3); 
                    color: white; 
                    padding: 30px; 
                    text-align: center; 
                    border-radius: 10px 10px 0 0; 
                }
                .content { 
                    background: #f8f9fa; 
                    padding: 30px; 
                    border-radius: 0 0 10px 10px; 
                }
                .partner-info { 
                    background: white; 
                    padding: 20px; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                    border-left: 4px solid #007BFF; 
                }
                .action-required { 
                    background: #FFF3CD; 
                    border: 1px solid #FFEAA7; 
                    padding: 15px; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                }
                .button { 
                    display: inline-block; 
                    background: #007BFF; 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                    font-weight: bold; 
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔔 New Partner Registration</h1>
                <p>Admin Notification</p>
            </div>
            
            <div class="content">
                <div class="action-required">
                    <strong>⚡ Action Required:</strong> New partner registration requires approval
                </div>
                
                <div class="partner-info">
                    <h3>📋 Partner Information</h3>
                    <p><strong>Business Name:</strong> ${userData.businessName}</p>
                    <p><strong>Contact Name:</strong> ${userData.contactName}</p>
                    <p><strong>Email:</strong> ${userData.businessEmail}</p>
                    <p><strong>Phone:</strong> ${userData.phone}</p>
                    <p><strong>Business Type:</strong> ${userData.businessType}</p>
                    <p><strong>License:</strong> ${userData.license}</p>
                    <p><strong>Expected Volume:</strong> ${userData.expectedVolume}</p>
                    <p><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                
                <h3>📝 Next Steps</h3>
                <ul>
                    <li>🔍 Verify business license information</li>
                    <li>📞 Contact partner for any additional verification</li>
                    <li>✅ Approve partner account in admin portal</li>
                    <li>📧 Partner will receive login credentials automatically</li>
                </ul>
                
                <a href="https://api.fadedskies.com/admin" class="button">Access Admin Portal</a>
                
                <p><strong>Faded Skies Admin Team</strong></p>
            </div>
        </body>
        </html>
        `,
        text: `
        New Partner Registration - ${userData.businessName}
        
        Action Required: New partner registration requires approval
        
        Partner Information:
        - Business Name: ${userData.businessName}
        - Contact Name: ${userData.contactName}
        - Email: ${userData.businessEmail}
        - Phone: ${userData.phone}
        - Business Type: ${userData.businessType}
        - License: ${userData.license}
        - Expected Volume: ${userData.expectedVolume}
        - Registration Date: ${new Date().toLocaleDateString()}
        
        Next Steps:
        - Verify business license information
        - Contact partner for any additional verification
        - Approve partner account in admin portal
        - Partner will receive login credentials automatically
        
        Access Admin Portal: https://api.fadedskies.com/admin
        
        Faded Skies Admin Team
        `
    }),

    // Admin notification for new order
    adminNewOrder: (orderData, userData) => ({
        subject: `💰 New Order - ${orderData.orderId} - $${orderData.total.toFixed(2)}`,
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Order Notification</title>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    line-height: 1.6; 
                    color: #333; 
                    max-width: 600px; 
                    margin: 0 auto; 
                    padding: 20px; 
                }
                .header { 
                    background: linear-gradient(135deg, #28A745, #20C997); 
                    color: white; 
                    padding: 30px; 
                    text-align: center; 
                    border-radius: 10px 10px 0 0; 
                }
                .content { 
                    background: #f8f9fa; 
                    padding: 30px; 
                    border-radius: 0 0 10px 10px; 
                }
                .order-info { 
                    background: white; 
                    padding: 20px; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                    border-left: 4px solid #28A745; 
                }
                .total { 
                    font-size: 1.5em; 
                    font-weight: bold; 
                    color: #28A745; 
                    text-align: center; 
                    margin: 20px 0; 
                    padding: 15px; 
                    background: white; 
                    border-radius: 8px; 
                    border: 2px solid #28A745; 
                }
                .button { 
                    display: inline-block; 
                    background: #28A745; 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                    font-weight: bold; 
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>💰 New Order Received!</h1>
                <p>Order Management Required</p>
            </div>
            
            <div class="content">
                <div class="total">
                    Order Value: $${orderData.total.toFixed(2)}
                </div>
                
                <div class="order-info">
                    <h3>📋 Order Details</h3>
                    <p><strong>Order ID:</strong> ${orderData.orderId}</p>
                    <p><strong>Customer:</strong> ${userData.businessName}</p>
                    <p><strong>Contact:</strong> ${userData.contactName}</p>
                    <p><strong>Email:</strong> ${userData.email}</p>
                    <p><strong>Phone:</strong> ${userData.phone || 'Not provided'}</p>
                    <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                
                <div class="order-info">
                    <h3>📦 Items Ordered</h3>
                    <p>${orderData.items}</p>
                    ${orderData.notes ? `<p><strong>Customer Notes:</strong> ${orderData.notes}</p>` : ''}
                </div>
                
                <h3>⚡ Action Required</h3>
                <ul>
                    <li>📦 Process and package order items</li>
                    <li>📧 Send confirmation to customer</li>
                    <li>🚚 Arrange shipping and provide tracking</li>
                    <li>💳 Process payment if needed</li>
                </ul>
                
                <a href="https://api.fadedskies.com/admin/orders" class="button">Manage Order</a>
                
                <p><strong>Faded Skies Admin Team</strong></p>
            </div>
        </body>
        </html>
        `,
        text: `
        New Order Received! - ${orderData.orderId}
        
        Order Value: $${orderData.total.toFixed(2)}
        
        Order Details:
        - Order ID: ${orderData.orderId}
        - Customer: ${userData.businessName}
        - Contact: ${userData.contactName}
        - Email: ${userData.email}
        - Phone: ${userData.phone || 'Not provided'}
        - Order Date: ${new Date().toLocaleDateString()}
        
        Items Ordered:
        ${orderData.items}
        ${orderData.notes ? `Customer Notes: ${orderData.notes}` : ''}
        
        Action Required:
        - Process and package order items
        - Send confirmation to customer
        - Arrange shipping and provide tracking
        - Process payment if needed
        
        Manage Order: https://api.fadedskies.com/admin/orders
        
        Faded Skies Admin Team
        `
    })
};

// ========================================
// EMAIL SENDING FUNCTIONS
// ========================================

const emailService = {
    // Send email function
    sendEmail: async (to, template, data = {}) => {
        try {
            const emailTemplate = templates[template];
            if (!emailTemplate) {
                throw new Error(`Email template '${template}' not found`);
            }

            const templateData = emailTemplate(data);
            
            const mailOptions = {
                from: `"Faded Skies Wholesale" <${EMAIL_CONFIG.auth.user}>`,
                to: Array.isArray(to) ? to.join(', ') : to,
                subject: templateData.subject,
                html: templateData.html,
                text: templateData.text,
                headers: {
                    'X-Mailer': 'Faded Skies Wholesale Platform',
                    'X-Priority': '3'
                }
            };

            const result = await transporter.sendMail(mailOptions);
            console.log('✅ Email sent successfully:', {
                messageId: result.messageId,
                to: mailOptions.to,
                subject: mailOptions.subject
            });

            return result;
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            throw error;
        }
    },

    // Send welcome email to new partner
    sendPartnerWelcome: async (userData) => {
        return await emailService.sendEmail(
            userData.businessEmail || userData.email,
            'partnerWelcome',
            userData
        );
    },

    // Send order confirmation
    sendOrderConfirmation: async (orderData, userData) => {
        return await emailService.sendEmail(
            userData.email,
            'orderConfirmation',
            { orderData, userData }
        );
    },

    // Send admin notifications
    sendAdminNotification: async (type, data) => {
        const adminEmails = [
            'admin@fadedskies.com',
            'info@fadedskies.com'
        ];

        return await emailService.sendEmail(
            adminEmails,
            type,
            data
        );
    },

    // Test email configuration
    testEmailConfig: async () => {
        try {
            await transporter.verify();
            console.log('✅ Email configuration is valid');
            return true;
        } catch (error) {
            console.error('❌ Email configuration error:', error);
            return false;
        }
    }
};

module.exports = {
    emailService,
    templates,
    EMAIL_CONFIG
};

// ========================================
// USAGE EXAMPLES:
// 
// Send welcome email:
// await emailService.sendPartnerWelcome(userData);
// 
// Send order confirmation:
// await emailService.sendOrderConfirmation(orderData, userData);
// 
// Send admin notification:
// await emailService.sendAdminNotification('adminNewOrder', { orderData, userData });
// 
// Test email configuration:
// await emailService.testEmailConfig();
// ========================================