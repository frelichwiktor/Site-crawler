const { chromium } = require('playwright');
const readline = require('readline');
const config = require('./config');
const { constants } = config;

// Import all our modules
const MatrixAuth = require('./auth/matrixAuth');
const UrlProcessor = require('./utils/urlProcessor');
const CsvReporter = require('./reporters/csvReporter');
const PerformanceCrawler = require('./crawlers/performanceCrawler');

class MatrixCrawlerApp {
    constructor() {
        this.auth = new MatrixAuth();
        this.urlProcessor = new UrlProcessor();
        this.csvReporter = new CsvReporter();
        this.startTime = Date.now();
    }

    async run() {
        try {
            // Step 1: Load credentials
            const credentials = await this.auth.loadCredentials();
            
            // Step 2: Setup domain
            const domain = await this.urlProcessor.setupDomain();
            
            // Step 3: Choose environment
            const versionChoice = await this.askQuestion("Do you want to run the crawler for PROD or DXP version? (prod/dxp): ");
            const isDxpVersion = versionChoice.toLowerCase() === 'dxp';
            
            // Step 4: Initialize CSV reporter
            const csvFilePath = await this.csvReporter.initialize(domain, isDxpVersion);
            
            // Step 5: Setup browser
            const browser = await this.setupBrowser();
            const context = await browser.newContext();
            const page = await context.newPage();
            
            // Step 6: Add DXP cookie if needed
            if (isDxpVersion) {
                console.log("🍪 Adding DXP cookie...");
                await context.addCookies([{
                    name: constants.COOKIES.DXP_COOKIE.name,
                    value: constants.COOKIES.DXP_COOKIE.value,
                    domain: domain,
                    path: constants.COOKIES.DXP_COOKIE.path,
                    httpOnly: constants.COOKIES.DXP_COOKIE.httpOnly,
                    secure: constants.COOKIES.DXP_COOKIE.secure
                }]);
            } else {
                console.log("🚫 No cookie added (PROD version)");
            }
            
            // Step 7: Login to Matrix
            console.log("\n--- PHASE 1: Logging into the Matrix! ---");
            const matrixSuccess = await this.auth.login(page, isDxpVersion);
            if (!matrixSuccess) {
                throw new Error("Failed to log in to Matrix");
            }
            
            // Step 8: Get URLs to process
            console.log("\n--- PHASE 2: Starting URL Crawling ---");
            const urls = await this.urlProcessor.getUrlsToProcess();
            
            // Step 9: Add performance suffix
            const processedUrls = this.urlProcessor.addPerformanceSuffix(urls);
            
            // Step 10: Crawl URLs
            const crawler = new PerformanceCrawler(this.csvReporter);
            const results = await crawler.crawl(browser, context, page, processedUrls);
            
            // Step 11: Generate reports
            crawler.generateReports();
            
            // Step 12: Display summary
            crawler.displaySummary(this.startTime);
            
            console.log(`📄 All performance data was saved incrementally during crawling`);
            
            await browser.close();
            
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    }

    async setupBrowser() {
        const browser = await chromium.launch({ 
            headless: config.browser.headless 
        });
        
        process.on('SIGINT', function () {
            console.warn(' 🚨 Crawling stopped...');
            process.exit();
        });
        
        return browser;
    }

    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise(resolve => rl.question(query, answer => {
            rl.close();
            resolve(answer.trim());
        }));
    }
}

// Run the application
const app = new MatrixCrawlerApp();
app.run();