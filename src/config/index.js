const constants = require('./constants');
const environments = require('./environments');

const currentEnv = process.env.NODE_ENV || 'production';

const envConfig = {
    ...environments.default,
    ...environments[currentEnv]
};

const config = {
    // Environment info
    env: currentEnv,
    
    // Browser settings
    browser: envConfig.browser,
    
    // Directory settings
    directories: {
        ...envConfig.directories,
        reportsDir: envConfig.directories.reports || 'reports',  // Add this for the reports directory path
        reports: {
            crawled: constants.FILE_NAMES.CRAWLED,
            failed: constants.FILE_NAMES.FAILED,
            notFound: constants.FILE_NAMES.NOT_FOUND,
            serverError: constants.FILE_NAMES.SERVER_ERROR
        }
    },
    
    // Performance settings
    performance: {
        sitemapFetchTimeout: constants.TIMEOUTS.SITEMAP_FETCH
    },
    
    // Dynamic properties (set at runtime)
    domain: '',
    pageUrls: {
        matrix: ''
    },
    
    // Export constants for easy access
    constants: constants
};

// Helper function to update domain-related config
config.setDomain = function(domain, baseUrl) {
    this.domain = domain;
    this.pageUrls.matrix = `${baseUrl}${constants.URL_PATTERNS.MATRIX_ADMIN}`;
};

module.exports = config;