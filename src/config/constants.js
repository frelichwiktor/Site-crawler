// All the magic numbers and strings extracted into constants
module.exports = {
    // Timeouts (in milliseconds)
    TIMEOUTS: {
        DEFAULT: 30000,           // 30 seconds
        NAVIGATION: 30000,        // 30 seconds
        PERFORMANCE_WAIT: 20000,  // 20 seconds
        LONG_OPERATION: 60000,    // 60 seconds (for page loads)
        SITEMAP_FETCH: 10000      // 10 seconds
    },

    // DOM Selectors
    SELECTORS: {
        // Login form
        USERNAME_INPUT: 'input[name="SQ_LOGIN_USERNAME"]',
        PASSWORD_INPUT: 'input[name="SQ_LOGIN_PASSWORD"]',
        LOGIN_BUTTON: 'input[type="submit"][value="Log In"]',
        
        // DXP version check
        DXP_MARKERS: '#switched-ui-marker, #streamline-ui-marker',
        
        // Performance data
        PERFORMANCE_FRAME: 'result_frame',
        PERFORMANCE_SUMMARY: '#perfSummary .perfTotal',
        PERFORMANCE_FRAME_ID: '#result_frame'
    },

    // Regular expressions for parsing performance data
    REGEX: {
        TOTAL_TIME: /Total Time[^\d]*([\d.]+)/i,
        SYSTEM_TIME: /System[^\d]*([\d.]+)/i,
        QUERIES: /Queries:[^\d]*([\d.]+)[^\d]*\((\d+)\)/i
    },

    // Cookie configuration
    COOKIES: {
        DXP_COOKIE: {
            name: 'SUP_COOKIE',
            value: 'new',
            path: '/',
            httpOnly: true,
            secure: false
        }
    },

    // URL patterns
    URL_PATTERNS: {
        MATRIX_ADMIN: '/_admin/?FORCE_BACKUP_LOGIN=1',
        PERFORMANCE_SUFFIX: '/_performance',
        PERFORMANCE_RESULT: 'performance_result'
    },

    // DXP version strings
    DXP_VERSIONS: {
        MATRIX_DXP: 'Matrix DXP',
        DXP_SAAS: 'DXP SaaS'
    },

    // File names
    FILE_NAMES: {
        URLS_SOURCE: 'urls.txt',
        CRAWLED: 'urls-crawled.txt',
        FAILED: 'urls-failed.txt',
        NOT_FOUND: 'urls-404.txt',
        SERVER_ERROR: 'urls-500.txt'
    },

    // HTTP Status codes
    HTTP_STATUS: {
        NOT_FOUND: 404,
        SERVER_ERROR: 500
    },

    // CSV configuration
    CSV: {
        DECIMAL_SEPARATOR: ',', // European format
        
        // Standard headers for single environment mode (backward compatibility)
        HEADERS: [
            { id: 'url', title: 'URL' },
            { id: 'totalTime', title: 'Total Time (s)' },
            { id: 'systemTime', title: 'System Time (s)' },
            { id: 'queriesTime', title: 'Queries Time (s)' },
            { id: 'queriesCount', title: 'Queries Count' },
            { id: 'timestamp', title: 'Timestamp' }
        ],
        
        // Headers for comparison mode (includes environment column)
        COMPARISON_HEADERS: [
            { id: 'url', title: 'URL' },
            { id: 'environment', title: 'Environment' },
            { id: 'totalTime', title: 'Total Time (s)' },
            { id: 'systemTime', title: 'System Time (s)' },
            { id: 'queriesTime', title: 'Queries Time (s)' },
            { id: 'queriesCount', title: 'Queries Count' },
            { id: 'timestamp', title: 'Timestamp' }
        ]
    }
};