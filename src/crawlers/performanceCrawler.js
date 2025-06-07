const config = require('../config');
const { constants } = config;
const PerformanceExtractor = require('../extractors/performanceExtractor');
const FileReporter = require('../reporters/fileReporter');

class PerformanceCrawler {
    constructor(csvReporter) {
        this.csvReporter = csvReporter;
        this.extractor = new PerformanceExtractor();
        this.fileReporter = new FileReporter();
        this.results = {
            crawledCount: 0,
            successfulCount: 0,
            timeoutCount: 0,
            errorCount: 0,
            notFoundCount: 0,
            serverErrorCount: 0,
            failedUrls: [],
            notFoundUrls: [],
            serverErrorUrls: [],
            performanceData: []
        };
    }

    async crawl(browser, context, page, urls) {
        page.setDefaultTimeout(config.browser.defaultTimeout);
        page.setDefaultNavigationTimeout(config.browser.navigationTimeout);
        
        console.log(`🚀 Starting to crawl ${urls.length} URLs...\n`);
        
        const startTime = Date.now();
        
        for (const url of urls) {
            this.results.crawledCount++;
            
            // Calculate speed and ETA
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? ((this.results.crawledCount / elapsed) * 60).toFixed(1) : 'N/A';
            const remainingUrls = urls.length - this.results.crawledCount;
            const estimatedTimeLeft = speed !== 'N/A' && speed > 0 ? Math.round(remainingUrls / (parseFloat(speed) / 60)) : 'N/A';
            
            console.log(`\n📍 [${this.results.crawledCount}/${urls.length}] Crawling: ${url}`);
            console.log(`🚀 Speed: ${speed}/min | ETA: ${estimatedTimeLeft}s remaining`);

            try {
                await this.crawlSingleUrl(page, url);
            } catch (error) {
                this.handleCrawlError(error, url);
            }
        }
        
        console.log('\n✅ Crawling completed!\n');
        
        return this.results;
    }

    async crawlSingleUrl(page, url) {
        const response = await page.goto(url, { 
            waitUntil: 'domcontentloaded', 
            timeout: constants.TIMEOUTS.LONG_OPERATION 
        });

        // Check response status
        if (response.status() === constants.HTTP_STATUS.NOT_FOUND) {
            console.log(`❌ 404 Not Found: ${url}`);
            this.results.notFoundCount++;
            this.results.notFoundUrls.push(url);
            return;
        }

        if (response.status() === constants.HTTP_STATUS.SERVER_ERROR) {
            console.log(`🚨 500 Internal Server Error: ${url}`);
            this.results.serverErrorCount++;
            this.results.serverErrorUrls.push(url);
            return;
        }

        // Extract performance data
        const perfData = await this.extractor.extractPerformanceData(page, url);
        
        // Store results
        this.results.performanceData.push(perfData);
        
        // Save to CSV immediately
        await this.csvReporter.savePerformanceRecord(perfData);
        
        // Record as successful
        this.results.successfulCount++;
        this.fileReporter.recordCrawledUrl(url);
    }

    handleCrawlError(error, url) {
        if (error.message.includes('TimeoutError')) {
            console.log(`⚠️ Timeout on: ${url}. Skipping...`);
            this.results.timeoutCount++;
        } else {
            console.log(`🚨 Error on: ${url}. Skipping...`, error.message);
            this.results.errorCount++;
        }
        this.results.failedUrls.push(url);
    }

    generateReports() {
        this.fileReporter.generateReports(this.results);
    }

    displaySummary(startTime) {
        this.fileReporter.displaySummary(this.results, startTime);
    }
}

module.exports = PerformanceCrawler;