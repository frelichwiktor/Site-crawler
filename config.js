module.exports = {
    browser: {
        headless: true,
        defaultTimeout: 30000,
        navigationTimeout: 30000
    },
    
    directories: {
        output: 'URLs',
        reports: {
            crawled: 'urls-crawled.txt',
            failed: 'urls-failed.txt',
            notFound: 'urls-404.txt',
            serverError: 'urls-500.txt',
            slowest: 'slowest-pages.txt'
        }
    },
    
    performance: {
        sitemapFetchTimeout: 10000
    },
    
    domain: '',
    pageUrls: {
        matrix: ''
    }
};