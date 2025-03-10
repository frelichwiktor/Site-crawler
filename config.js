module.exports = {
    browser: {
        headless: false,
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
        slowestPercentage: 0.1,
        sitemapFetchTimeout: 10000
    },
    
    urlToFind: {
        pageToFind: 'The site for which we want to change the version to DXP'
    },
    
    pageUrls: {
        switcher: 'Link to the switcher',
        matrix: 'Link to the Matrix login page, with /_admin?FORCE_BACKUP_LOGIN=1'
    }
};