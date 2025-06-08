const config = require('../config');
const { constants } = config;
const MatrixAuth = require('../auth/matrixAuth');
const PerformanceExtractor = require('../extractors/performanceExtractor');
const FileReporter = require('../reporters/fileReporter');

class ComparisonCrawler {
    constructor(csvReporter) {
        this.csvReporter = csvReporter;
        this.extractor = new PerformanceExtractor();
        this.fileReporter = new FileReporter();
        this.results = {
            totalUrls: 0,
            prodSuccessful: 0,
            dxpSuccessful: 0,
            prodFailed: 0,
            dxpFailed: 0,
            prodTimeouts: 0,
            dxpTimeouts: 0,
            prodNotFound: 0,
            dxpNotFound: 0,
            prodServerError: 0,
            dxpServerError: 0,
            comparisonData: [],
            failedUrls: [],
            notFoundUrls: [],
            serverErrorUrls: []
        };
    }

    async crawlComparison(browser, urls, credentials) {
        console.log(`🔀 Comparing ${urls.length} URLs (PROD vs DXP)...\n`);
        
        this.results.totalUrls = urls.length;
        const startTime = Date.now();
        
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const urlIndex = i + 1;
            
            console.log(`\n📍 [${urlIndex}/${urls.length}] ${url}`);
            
            // Calculate progress and ETA
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? ((urlIndex / elapsed) * 60).toFixed(1) : 'N/A';
            const remainingUrls = urls.length - urlIndex;
            const eta = speed !== 'N/A' && speed > 0 ? Math.round(remainingUrls / (parseFloat(speed) / 60)) : 'N/A';
            
            console.log(`🚀 Speed: ${speed}/min | ETA: ${eta}s`);
            
            // Launch both crawls in parallel using Promise.all
            const [prodResult, dxpResult] = await Promise.all([
                this.crawlSingleEnvironment(browser, url, credentials.prod, false, 'PROD').catch(error => ({
                    success: false,
                    error: 'GENERAL_ERROR',
                    message: error.message,
                    environment: 'PROD'
                })),
                this.crawlSingleEnvironment(browser, url, credentials.dxp, true, 'DXP').catch(error => ({
                    success: false,
                    error: 'GENERAL_ERROR', 
                    message: error.message,
                    environment: 'DXP'
                }))
            ]);
            
            const prodStatus = prodResult && prodResult.success ? '✅' : '❌';
            const dxpStatus = dxpResult && dxpResult.success ? '✅' : '❌';
            console.log(`   PROD: ${prodStatus} | DXP: ${dxpStatus}`);
            
            if (prodResult && prodResult.success) {
                await this.csvReporter.savePerformanceRecord(prodResult.data);
                this.results.prodSuccessful++;
                this.fileReporter.recordCrawledUrl(url + ' (PROD)');
            } else if (prodResult) {
                this.handleEnvironmentError(prodResult, 'PROD', url);
            }
            
            if (dxpResult && dxpResult.success) {
                await this.csvReporter.savePerformanceRecord(dxpResult.data);
                this.results.dxpSuccessful++;
                this.fileReporter.recordCrawledUrl(url + ' (DXP)');
            } else if (dxpResult) {
                this.handleEnvironmentError(dxpResult, 'DXP', url);
            }
            
            if (prodResult && dxpResult && prodResult.success && dxpResult.success) {
                const timeDiff = dxpResult.data.totalTime - prodResult.data.totalTime;
                const percentDiff = prodResult.data.totalTime > 0 ? 
                    ((timeDiff / prodResult.data.totalTime) * 100).toFixed(2) : 0;
                
                this.results.comparisonData.push({
                    url: url,
                    prod: prodResult.data,
                    dxp: dxpResult.data,
                    timeDifference: timeDiff,
                    percentageDifference: percentDiff
                });
            }
        }
        console.log('\n✅ Comparison completed!\n');
        return this.results;
    }

    async crawlSingleEnvironment(browser, url, credentials, isDxp, environmentName) {
        let context = null;
        let page = null;
        
        try {
            context = await browser.newContext();
            page = await context.newPage();
            
            page.setDefaultTimeout(config.browser.defaultTimeout);
            page.setDefaultNavigationTimeout(config.browser.navigationTimeout);
            
            if (isDxp) {
                await context.addCookies([{
                    name: constants.COOKIES.DXP_COOKIE.name,
                    value: constants.COOKIES.DXP_COOKIE.value,
                    domain: config.domain,
                    path: constants.COOKIES.DXP_COOKIE.path,
                    httpOnly: constants.COOKIES.DXP_COOKIE.httpOnly,
                    secure: constants.COOKIES.DXP_COOKIE.secure
                }]);
            }
            
            const auth = new MatrixAuth();
            auth.credentials = { matrix: credentials };
            
            const loginSuccess = await auth.login(page, isDxp);
            if (!loginSuccess) {
                throw new Error(`Authentication failed for ${environmentName}`);
            }
            
            const response = await page.goto(url, { 
                waitUntil: 'domcontentloaded', 
                timeout: constants.TIMEOUTS.LONG_OPERATION 
            });
            
            if (response.status() === constants.HTTP_STATUS.NOT_FOUND) {
                return {
                    success: false,
                    error: 'NOT_FOUND',
                    status: 404,
                    environment: environmentName,
                    url: url
                };
            }
            
            if (response.status() === constants.HTTP_STATUS.SERVER_ERROR) {
                return {
                    success: false,
                    error: 'SERVER_ERROR',
                    status: 500,
                    environment: environmentName,
                    url: url
                };
            }
            
            const perfData = await this.extractor.extractPerformanceData(page, url);
            perfData.environment = environmentName; // Add environment identifier
            
            return {
                success: true,
                data: perfData,
                environment: environmentName
            };
            
        } catch (error) {
            if (error.message.includes('TimeoutError') || error.message.includes('timeout')) {
                return {
                    success: false,
                    error: 'TIMEOUT',
                    environment: environmentName,
                    url: url
                };
            } else {
                return {
                    success: false,
                    error: 'GENERAL_ERROR',
                    message: error.message,
                    environment: environmentName,
                    url: url
                };
            }
        } finally {
            if (context) {
                await context.close();
            }
        }
    }

    handleEnvironmentError(errorData, envPrefix, url) {
        switch (errorData.error) {
            case 'NOT_FOUND':
                if (envPrefix === 'PROD') this.results.prodNotFound++;
                else this.results.dxpNotFound++;
                this.results.notFoundUrls.push(`${url} (${envPrefix})`);
                break;
            case 'SERVER_ERROR':
                if (envPrefix === 'PROD') this.results.prodServerError++;
                else this.results.dxpServerError++;
                this.results.serverErrorUrls.push(`${url} (${envPrefix})`);
                break;
            case 'TIMEOUT':
                if (envPrefix === 'PROD') this.results.prodTimeouts++;
                else this.results.dxpTimeouts++;
                this.results.failedUrls.push(`${url} (${envPrefix}) - Timeout`);
                break;
            default:
                if (envPrefix === 'PROD') this.results.prodFailed++;
                else this.results.dxpFailed++;
                this.results.failedUrls.push(`${url} (${envPrefix}) - ${errorData.message || 'Unknown error'}`);
        }
    }

    generateReports() {
        const combinedResults = {
            failedUrls: this.results.failedUrls,
            notFoundUrls: this.results.notFoundUrls,
            serverErrorUrls: this.results.serverErrorUrls
        };
        
        this.fileReporter.generateReports(combinedResults);
    }

    displaySummary(startTime) {
        this.displayComparisonSummary(startTime);
    }

    displayComparisonSummary(startTime) {
        console.log(`\n📊 Parallel Comparison Summary:`);
        console.log(`📝 Total URLs Processed: ${this.results.totalUrls}`);
        console.log(`🔵 PROD Results:`);
        console.log(`   ✅ Successful: ${this.results.prodSuccessful}`);
        console.log(`   ❌ Failed: ${this.results.prodFailed}`);
        console.log(`   ⚠️ Timeouts: ${this.results.prodTimeouts}`);
        console.log(`   🚫 404 Not Found: ${this.results.prodNotFound}`);
        console.log(`   🚨 500 Server Errors: ${this.results.prodServerError}`);
        
        console.log(`🟢 DXP Results:`);
        console.log(`   ✅ Successful: ${this.results.dxpSuccessful}`);
        console.log(`   ❌ Failed: ${this.results.dxpFailed}`);
        console.log(`   ⚠️ Timeouts: ${this.results.dxpTimeouts}`);
        console.log(`   🚫 404 Not Found: ${this.results.dxpNotFound}`);
        console.log(`   🚨 500 Server Errors: ${this.results.dxpServerError}`);
        
        if (this.results.comparisonData.length > 0) {
            console.log(`\n📈 Performance Comparison:`);
            console.log(`📊 URLs with both PROD & DXP data: ${this.results.comparisonData.length}`);
        }
        
        const totalTime = (Date.now() - startTime) / 1000 / 60;
        console.log(`\n⚡ Total parallel comparison time: ${totalTime.toFixed(2)} minutes`);
    }
}

module.exports = ComparisonCrawler;