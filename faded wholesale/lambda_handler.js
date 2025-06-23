// ========================================
// AWS LAMBDA HANDLER FOR FADED SKIES API
// ========================================

const serverlessExpress = require('@vendia/serverless-express');
const app = require('./server');

// Lambda handler
exports.handler = serverlessExpress({ app });

// Alternative handler with custom configuration
exports.customHandler = async (event, context) => {
    console.log('Lambda invocation:', {
        requestId: context.awsRequestId,
        httpMethod: event.httpMethod,
        path: event.path,
        queryStringParameters: event.queryStringParameters,
        headers: event.headers
    });

    // Custom middleware for Lambda
    const customApp = require('./server');
    
    // Add Lambda-specific middleware
    customApp.use((req, res, next) => {
        req.lambda = {
            event,
            context
        };
        next();
    });

    const handler = serverlessExpress({ 
        app: customApp,
        logLevel: 'info',
        resolutionMode: 'PROMISE'
    });

    try {
        const result = await handler(event, context);
        
        console.log('Lambda response:', {
            statusCode: result.statusCode,
            requestId: context.awsRequestId
        });
        
        return result;
    } catch (error) {
        console.error('Lambda error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                requestId: context.awsRequestId
            })
        };
    }
};

// ========================================
// LAMBDA DEPLOYMENT NOTES:
// 
// 1. Install serverless dependencies:
//    npm install @vendia/serverless-express
// 
// 2. Update package.json main entry:
//    "main": "lambda.js"
// 
// 3. Environment variables in Lambda:
//    - NODE_ENV=production
//    - JWT_SECRET=your-secret
//    - DATABASE_URL=your-rds-url
// 
// 4. Lambda configuration:
//    - Runtime: Node.js 18.x
//    - Memory: 512 MB
//    - Timeout: 30 seconds
//    - Handler: lambda.handler
// 
// 5. VPC Configuration (if using RDS):
//    - Add Lambda to VPC
//    - Configure security groups
//    - Add NAT Gateway for internet access
// ========================================