// Environment-specific configurations
module.exports = {
    // Default configuration (can be overridden)
    default: {
        browser: {
            headless: true,
            defaultTimeout: 30000,
            navigationTimeout: 30000
        },
        directories: {
            output: 'URLs',
            reports: 'reports'
        }
    },
    
    // Development environment
    development: {
        browser: {
            headless: false,  // Show browser in dev for debugging
            defaultTimeout: 60000,  // Longer timeouts for debugging
            navigationTimeout: 60000
        }
    },
    
    // Production environment
    production: {
        browser: {
            headless: true,
            defaultTimeout: 30000,
            navigationTimeout: 30000
        }
    },
    
    // Test environment
    test: {
        browser: {
            headless: true,
            defaultTimeout: 5000,  // Shorter timeouts for tests
            navigationTimeout: 5000
        },
        directories: {
            output: 'test-output',
            reports: 'test-reports'
        }
    }
};