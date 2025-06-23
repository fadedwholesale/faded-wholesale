// ========================================
// DOCKER HEALTH CHECK SCRIPT
// ========================================

const http = require('http');

const options = {
    hostname: 'localhost',
    port: process.env.PORT || 3001,
    path: '/health',
    method: 'GET',
    timeout: 2000
};

const request = http.request(options, (res) => {
    console.log(`Health check status: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
        process.exit(0); // Success
    } else {
        process.exit(1); // Failure
    }
});

request.on('error', (err) => {
    console.error('Health check failed:', err.message);
    process.exit(1); // Failure
});

request.on('timeout', () => {
    console.error('Health check timeout');
    request.destroy();
    process.exit(1); // Failure
});

request.end();