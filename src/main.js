const { chromium } = require('playwright');
const readline = require('readline');
const config = require('./config');
const { constants } = config;

// Import all our modules
const MatrixAuth = require('./auth/matrixAuth');
const UrlProcessor = require('./utils/urlProcessor');
const CsvReporter = require('./reporters/csvReporter');
const PerformanceCrawler = require('./crawlers/performanceCrawler');
const ComparisonCrawler = require('./crawlers/comparisonCrawler');

class MatrixCrawlerApp {
    constructor() {
        this.auth = new MatrixAuth();
        this.urlProcessor = new UrlProcessor();
        this.csvReporter = new CsvReporter();
        this.startTime = Date.now();
    }

    async run() {
        try {
            const credentials = await this.auth.loadCredentials();
            
            const domain = await this.urlProcessor.setupDomain();
            
            const crawlMode = await this.askQuestion(
                "\nWhich crawling mode do you want?\n" +
                "[1] PROD only\n" +
                "[2] DXP only\n" +
                "[3] Compare PROD vs DXP\n" +
                "Enter your choice (1, 2, or 3): "
            );
            
            if (crawlMode === '3') {
                await this.runComparisonMode(domain, credentials);
            } else {
                const isDxpVersion = crawlMode === '2';
                await this.runSingleMode(domain, credentials, isDxpVersion);
            }
            
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    }

    async runComparisonMode(domain, credentials) {
        console.log("\n🔀 Starting PROD vs DXP comparison...");
        
        if (!credentials.prod || !credentials.dxp) {
            console.error("❌ Comparison mode requires both PROD and DXP credentials!");
            console.log("ℹ️ Please update your credentials.js file with both 'prod' and 'dxp' sections.");
            process.exit(1);
        }
        
        if (!credentials.prod.username || !credentials.prod.password) {
            console.error("❌ PROD credentials are incomplete!");
            process.exit(1);
        }
        
        if (!credentials.dxp.username || !credentials.dxp.password) {
            console.error("❌ DXP credentials are incomplete!");
            process.exit(1);
        }
        
        const csvFilePath = await this.csvReporter.initialize(domain, 'comparison');
        
        const browser = await this.setupBrowser();
        
        const urls = await this.urlProcessor.getUrlsToProcess();
        const processedUrls = this.urlProcessor.addPerformanceSuffix(urls);
        
        const comparisonCrawler = new ComparisonCrawler(this.csvReporter);
        
        const results = await comparisonCrawler.crawlComparison(browser, processedUrls, credentials);
        
        comparisonCrawler.generateReports();
        
        comparisonCrawler.displaySummary(this.startTime);
        
        console.log(`📄 Results saved to: ${csvFilePath}`);
        
        await browser.close();
    }

    async runSingleMode(domain, credentials, isDxpVersion) {
        const versionText = isDxpVersion ? 'DXP' : 'PROD';
        console.log(`\n🔧 Running ${versionText} mode...`);
        
        let selectedCredentials;
        if (isDxpVersion) {
            // DXP mode - use DXP credentials
            if (!credentials.dxp || !credentials.dxp.username) {
                console.error(`❌ No valid DXP credentials found!`);
                console.log("ℹ️ Please add 'dxp' section to your credentials.js file");
                process.exit(1);
            }
            selectedCredentials = { matrix: credentials.dxp };
        } else {
            // PROD mode - use PROD credentials
            if (!credentials.prod || !credentials.prod.username) {
                console.error(`❌ No valid PROD credentials found!`);
                console.log("ℹ️ Please add 'prod' section to your credentials.js file");
                process.exit(1);
            }
            selectedCredentials = { matrix: credentials.prod };
        }
        
        const csvFilePath = await this.csvReporter.initialize(domain, isDxpVersion);
        
        const browser = await this.setupBrowser();
        const context = await browser.newContext();
        const page = await context.newPage();
        
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
        
        console.log("\n--- PHASE 1: Logging into the Matrix! ---");
        this.auth.credentials = selectedCredentials;
        const matrixSuccess = await this.auth.login(page, isDxpVersion);
        if (!matrixSuccess) {
            throw new Error("Failed to log in to Matrix");
        }
        
        console.log("\n--- PHASE 2: Starting URL Crawling ---");
        const urls = await this.urlProcessor.getUrlsToProcess();
        
        const processedUrls = this.urlProcessor.addPerformanceSuffix(urls);
        
        const crawler = new PerformanceCrawler(this.csvReporter);
        const results = await crawler.crawl(browser, context, page, processedUrls);
        
        crawler.generateReports();
        
        crawler.displaySummary(this.startTime);
        
        console.log(`📄 All performance data was saved incrementally during crawling`);
        
        await browser.close();
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

const app = new MatrixCrawlerApp();
app.run();