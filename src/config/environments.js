// Default configuration (can be overridden)
module.exports = {
    default: {
        browser: {
            headless: false,
            defaultTimeout: 30000,
            navigationTimeout: 30000
        },
        directories: {
            output: 'URLs',
            reports: 'reports'
        }
    }
}
