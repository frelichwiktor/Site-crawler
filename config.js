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
    
    defaultCookie: {
        name: 'name',
        value: 'value',
        path: '/',
        httpOnly: true,
        secure: false
    },
    
    urlToFind: {
        pageToFind: 'https://www.cardiff.ac.uk'
    },
    
    pageUrls: {
        switcher: 'https://cardiff.ac.uk/__streamline/switcher/',
        matrix: 'https://www.cardiff.ac.uk/_admin/?FORCE_BACKUP_LOGIN=1'
    }
};