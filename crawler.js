const config = require('./config');
const { chromium, selectors } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseStringPromise } = require('xml2js');
const axios = require('axios');
const { createObjectCsvWriter } = require('csv-writer');

let csvWriter = null;

async function main() {
    const startTime = Date.now();
    
    try {
        const credentials = await loadCredentials();
        
        const domain = await setupDomain();
        
        await initializeCsvWriter();
        
        const browser = await setupBrowser();
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await context.addCookies([{
            name: 'SUP_COOKIE',
            value: 'new',
            domain: domain,
            path: '/',
            httpOnly: true,
            secure: false
        }]);
        
        console.log("\n--- PHASE 1: Logging into the Matrix! ---");
        const matrixSuccess = await loginToMatrix(page, credentials.matrix);
        if (!matrixSuccess) {
            throw new Error("Failed to log in to Matrix");
        }
        
        console.log("\n--- PHASE 2: Starting URL Crawling ---");
        const urls = await getUrlsToProcess();
        
        console.log("🔧 Adding suffix '/_performance' to all URLs");
        const processedUrls = urls.map(url => {
            try {
                const urlObj = new URL(url);
                urlObj.pathname = urlObj.pathname + '/_performance';
                return urlObj.toString();
            } catch (error) {
                console.error(`Failed to add suffix to ${url}: ${error.message}`);
                return url;
            }
        });
        
        const results = await crawlUrls(browser, context, page, processedUrls);
        
        generateReports(results);
        
        displaySummary(results, startTime);
        
        console.log(`📄 All performance data was saved incrementally during crawling`);
        
        await browser.close();
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

main();

async function initializeCsvWriter() {
    const csvFilePath = path.join(config.directories.output, 'performance-data.csv');
    
    if (!fs.existsSync(config.directories.output)) {
        fs.mkdirSync(config.directories.output);
    }
    
    const fileExists = fs.existsSync(csvFilePath);
    
    csvWriter = createObjectCsvWriter({
        path: csvFilePath,
        header: [
            { id: 'url', title: 'URL' },
            { id: 'totalTime', title: 'Total Time (s)' },
            { id: 'systemTime', title: 'System Time (s)' },
            { id: 'queriesTime', title: 'Queries Time (s)' },
            { id: 'queriesCount', title: 'Queries Count' },
            { id: 'timestamp', title: 'Timestamp' }
        ],
    });
    
    console.log(`📝 CSV writer initialized: ${csvFilePath}`);
}

async function setupDomain() {
    const userInput = await askQuestion("Enter the domain or URL (e.g., www.example.com or https://www.example.com/): ");

    let domain;
    let baseUrl;
    
    try {
        if (userInput.includes('://')) {
            const urlObj = new URL(userInput);
            domain = urlObj.hostname; // Just the hostname for the cookie
            baseUrl = `${urlObj.protocol}//${urlObj.hostname}`; // Protocol + hostname for matrix URL
        } else {
            domain = userInput.trim().replace(/\/$/, ''); // Remove any trailing slash
            baseUrl = `https://${domain}`; // Assume https
        }
        
        // Strip any trailing slashes
        if (domain.endsWith('/')) {
            domain = domain.slice(0, -1);
        }
        
        console.log(`✅ Domain extracted for cookie: ${domain}`);
        console.log(`✅ Base URL for Matrix: ${baseUrl}`);
        
        // Set in config
        config.domain = domain;
        config.pageUrls.matrix = `${baseUrl}/_admin/?FORCE_BACKUP_LOGIN=1`;
        
        return domain;
    } catch (error) {
        console.error(`❌ Error parsing domain: ${error.message}`);
        // Fallback to direct input if parsing fails
        console.log(`⚠️ Using input directly: ${userInput}`);
        domain = userInput.replace(/^https?:\/\//, '').replace(/\/$/, '');
        config.domain = domain;
        config.pageUrls.matrix = `https://${domain}/_admin/?FORCE_BACKUP_LOGIN=1`;
        return domain;
    }
}
async function savePerformanceRecord(record) {
    if (!csvWriter) {
        console.error('❌ CSV writer not initialized!');
        return;
    }
    
    try {
        await csvWriter.writeRecords([record]);
    } catch (error) {
        console.error(`❌ Error saving CSV record: ${error.message}`);
    }
}

async function loadCredentials() {
    console.log("🔑 Loading credentials...");
    
    try {
        const credentials = require('./credentials.js');
        console.log("✅ Credentials loaded from file");
        return credentials;
    } catch (error) {
        console.log("⚠️ credentials.js not found or invalid");
        console.log("ℹ️ Please create credentials.js based on credentials.sample.js");
        
        const username = await askQuestion("Enter username for Matrix: ");
        const password = await askQuestion("Enter password for Matrix: ");
        
        return {
            matrix: {
                username,
                password
            }
        };
    }
}

async function loginToMatrix(page, credentials) {
    console.log("🔑 Attempting to log into Matrix...");
    
    try {
        await page.goto(config.pageUrls.matrix, { waitUntil: 'domcontentloaded' });
        
        const versionCheckElement = await page.waitForSelector('#switched-ui-marker, #streamline-ui-marker');
        const versionCheck = versionCheckElement ? await versionCheckElement.textContent() : null;
        
        if (!versionCheck || (!versionCheck.includes('Matrix DXP') && !versionCheck.includes('DXP SaaS'))) {
            throw new Error("❌ Verification failed: Not on the correct DXP version (Matrix DXP or DXP SaaS)");
        }
        
        console.log("✅ Verification passed: Correct DXP version detected");
        
        await page.fill('input[name="SQ_LOGIN_USERNAME"]', credentials.username);
        await page.fill('input[name="SQ_LOGIN_PASSWORD"]', credentials.password);
        
        await page.click('input[type="submit"][value="Log In"]');
        
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        
        console.log("✅ Successfully logged into Matrix!");
        return true;
    } catch (error) {
        console.error("❌ Failed to log into Matrix:", error);
        return false;
    }
}

async function setupBrowser() {
    const browser = await chromium.launch({ 
        headless: config.browser.headless 
    });
    
    process.on('SIGINT', function () {
        console.warn(' 🚨 Crawling stopped...');
        process.exit();
    });
    
    return browser;
}

async function getUrlsToProcess() {
    if (!fs.existsSync(config.directories.output)) {
        fs.mkdirSync(config.directories.output);
    }
    
    const choice = await askQuestion(
        "How do you want to crawl?\n" +
        "[1] From URLs file (urls.txt)\n" +
        "[2] From a sitemap URL\n" +
        "[3] Both (txt & sitemap)\n" +
        "Enter your choice (1, 2, or 3): "
    );
    
    let urls = [];
    
    if (choice === '1') {
        console.log("📂 Crawling URLs from 'URLs/urls.txt'...");
        urls = getUrlsFromFile();
    } else if (choice === '2') {
        let sitemapUrl = await askQuestion("Enter the sitemap URL: ");
        console.log(`📥 Crawling URLs from sitemap: ${sitemapUrl}...`);
        urls = await extractUrlsFromSitemap(sitemapUrl);
    } else if (choice === '3') {
        let sitemapUrl = await askQuestion("Enter the sitemap URL: ");
        console.log("📂 Crawling both 'URLs/urls.txt' and the sitemap...");
        urls = [...new Set([...getUrlsFromFile(), ...await extractUrlsFromSitemap(sitemapUrl)])];
    } else {
        console.log("❌ Invalid choice. Exiting...");
        return [];
    }
    
    if (urls.length === 0) {
        console.log('⚠️ No URLs found. Exiting...');
        return [];
    }
    
    urls = await processSuffixOption(urls);
    
    return urls;
}

async function processSuffixOption(urls) {
    let addSuffix = await askQuestion("Do you want to add a suffix to each URL? (y/n): ");
    let suffix = '';

    if (addSuffix === 'y') {
        suffix = await askQuestion("Enter the suffix to add (e.g. /_nocache): ");
        console.log(`🔧 Adding suffix "${suffix}" to all URLs`);
        
        return urls.map(url => {
            try {
                const urlObj = new URL(url);
                urlObj.pathname = urlObj.pathname + suffix;
                return urlObj.toString();
            } catch (error) {
                console.error(`Failed to add suffix to ${url}: ${error.message}`);
                return url;
            }
        });
    }
    
    return urls;
}

async function crawlUrls(browser, context, page, urls) {
    
    page.setDefaultTimeout(config.browser.defaultTimeout);
    page.setDefaultNavigationTimeout(config.browser.navigationTimeout);
    
    const results = {
        crawledCount: 0,
        successfulCount: 0,
        timeoutCount: 0,
        errorCount: 0,
        notFoundCount: 0,
        serverErrorCount: 0,
        failedUrls: [],
        notFoundUrls: [],
        serverErrorUrls: [],
        pageLoadTimes: [],
        urlLoadTimes: [],
        performanceData: [] // We'll still keep this for reference, but save incrementally
    };
    
    for (const url of urls) {
        results.crawledCount++;
        const totalPercentage = (results.crawledCount * 100) / urls.length;
        console.log(`\n🔍 Visiting ${results.crawledCount}/${urls.length} [${totalPercentage.toFixed(2)}%]`);
        console.log(`🌍 URL: ${url}`);

        try {
            const pageStartTime = Date.now();
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            if (response.status() === 404) {
                console.log(`❌ 404 Not Found: ${url}`);
                results.notFoundCount++;
                results.notFoundUrls.push(url);
                continue;
            }

            if (response.status() === 500) {
                console.log(`🚨 500 Internal Server Error: ${url}`);
                results.serverErrorCount++;
                results.serverErrorUrls.push(url);
                continue;
            }

            await extractPerformanceData(page, url, results);

            results.successfulCount++;
            fs.appendFileSync(path.join(config.directories.output, 'urls-crawled.txt'), url + '\n');

        } catch (error) {
            if (error.message.includes('TimeoutError')) {
                console.log(`⚠️ Timeout on: ${url}. Skipping...`);
                results.timeoutCount++;
            } else {
                console.log(`🚨 Error on: ${url}. Skipping...`, error);
                results.errorCount++;
            }
            results.failedUrls.push(url);
        }
    }
    
    return results;
}

/**
 * Extracts performance data from the result_frame on a performance page
 * @param {Page} page - Playwright page object
 * @param {string} url - The URL being processed
 * @param {Object} results - Results object to store the extracted data
 */
async function extractPerformanceData(page, url, results) {
    try {
        console.log(`📊 Extracting performance data from ${url}`);
        
        const perfData = {
            url: url,
            totalTime: null,
            systemTime: null,
            queriesTime: null,
            queriesCount: null,
            rawText: null,
            timestamp: new Date().toISOString()
        };
        
        await page.waitForLoadState('networkidle', { timeout: 20000 })
            .catch(() => console.log('⚠️ Page did not reach network idle state'));
        
        // Debug: List all frames on the page
        const frames = page.frames();
        console.log(`🔍 Found ${frames.length} frames on the page`);
        for (const f of frames) {
            console.log(`   - Frame: name=${f.name()}, url=${f.url()}`);
        }
        
        // Try multiple methods to find the frame
        console.log(`🔍 Looking for result_frame...`);
        let frame = null;
        
        // Method 1: Try by name
        frame = page.frame({ name: 'result_frame' });
        if (frame) {
            console.log(`✅ Found frame by name: result_frame`);
        } else {
            // Method 2: Try by URL pattern
            frame = page.frames().find(f => f.url().includes('performance_result'));
            if (frame) {
                console.log(`✅ Found frame by URL pattern: performance_result`);
            } else {
                // Method 3: Try by ID using evaluate
                const frameElement = await page.evaluate(() => {
                    const elem = document.getElementById('result_frame');
                    return elem ? true : false;
                });
                
                if (frameElement) {
                    console.log(`✅ Found frame element by ID, trying to access content...`);
                    // Try using frame locator instead
                    const frameLocator = page.frameLocator('#result_frame');
                    
                    // Try to extract using frameLocator
                    const perfText = await frameLocator.locator('#perfSummary .perfTotal').textContent()
                        .catch(() => null);
                    
                    if (perfText) {
                        console.log(`✅ Successfully extracted using frameLocator`);
                        perfData.rawText = perfText.trim();
                        parsePerformanceText(perfText, perfData);
                        storeResults(results, perfData);
                        return;
                    } else {
                        console.log(`❌ Could not extract using frameLocator`);
                    }
                }
            }
        }
        
        if (frame) {
            try {
                console.log(`🔍 Looking for #perfSummary .perfTotal in frame...`);
                await frame.waitForSelector('#perfSummary .perfTotal', { timeout: 20000 })
                    .then(() => console.log(`✅ Found #perfSummary .perfTotal in frame`))
                    .catch(() => console.log(`❌ Could not find #perfSummary .perfTotal in frame`));
                
                // Extract the performance data text
                const perfText = await frame.locator('#perfSummary .perfTotal').textContent()
                    .catch(() => null);
                
                if (perfText) {
                    console.log(`✅ Successfully extracted text from frame`);
                    perfData.rawText = perfText.trim();
                    parsePerformanceText(perfText, perfData);
                    storeResults(results, perfData);
                    return;
                }
            } catch (frameError) {
                console.error(`❌ Error accessing frame content: ${frameError.message}`);
            }
        }
        
        console.log(`⚠️ Could not extract from frame, trying direct page access...`);
        
        // Last resort: try to find in main page
        const mainPagePerfText = await page.locator('#perfSummary .perfTotal').textContent()
            .catch(() => null);
        
        if (mainPagePerfText) {
            console.log(`✅ Found performance data in main page`);
            perfData.rawText = mainPagePerfText.trim();
            parsePerformanceText(mainPagePerfText, perfData);
            storeResults(results, perfData);
        } else {
            // Try one more approach - look for any elements that might contain the info
            console.log(`🔍 Trying generic approach to find performance data...`);
            
            // Take screenshot for debugging
            await page.screenshot({ path: `${url.replace(/[^a-zA-Z0-9]/g, '_')}.png` })
                .catch(err => console.log(`Could not take screenshot: ${err.message}`));
                
            // Look for any div that might contain our data
            const anyPerfText = await page.evaluate(() => {
                // Try various selectors that might contain performance data
                const selectors = [
                    '.perfTotal', 
                    '[id*="perf"]', 
                    '[class*="perf"]',
                    'div:contains("Total Time")',
                    'div:contains("Queries:")'
                ];
                
                for (const selector of selectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        for (const el of elements) {
                            if (el.textContent.includes('Total Time') && 
                                el.textContent.includes('System') && 
                                el.textContent.includes('Queries')) {
                                return el.textContent;
                            }
                        }
                    } catch (e) {
                        // Ignore errors with individual selectors
                    }
                }
                
                // Try to find element with text that looks like performance data
                const allDivs = document.querySelectorAll('div');
                for (const div of allDivs) {
                    const text = div.textContent;
                    if (text.includes('Total Time') && 
                        text.includes('System') && 
                        text.includes('Queries')) {
                        return text;
                    }
                }
                
                return null;
            }).catch(() => null);
            
            if (anyPerfText) {
                console.log(`✅ Found performance-like data using generic approach`);
                perfData.rawText = anyPerfText.trim();
                parsePerformanceText(anyPerfText, perfData);
                storeResults(results, perfData);
            } else {
                console.log(`❌ Performance data not found using any method`);
                storeResults(results, perfData);
            }
        }
    } catch (error) {
        console.error(`❌ Error extracting performance data: ${error.message}`);
        
        // Record the error in results
        storeResults(results, {
            url: url,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }

    function parsePerformanceText(text, data) {
        const totalTimeMatch = text.match(/Total Time[^\d]*([\d.]+)/i);
        if (totalTimeMatch) data.totalTime = parseFloat(totalTimeMatch[1]);
        
        const systemTimeMatch = text.match(/System[^\d]*([\d.]+)/i);
        if (systemTimeMatch) data.systemTime = parseFloat(systemTimeMatch[1]);
        
        const queriesMatch = text.match(/Queries:[^\d]*([\d.]+)[^\d]*\((\d+)\)/i);
        if (queriesMatch) {
            data.queriesTime = parseFloat(queriesMatch[1]);
            data.queriesCount = parseInt(queriesMatch[2], 10);
        }
        
        console.log(`📊 Parsed performance data:`);
        console.log(`   - Total Time: ${data.totalTime}s`);
        console.log(`   - System Time: ${data.systemTime}s`);
        console.log(`   - Queries: ${data.queriesTime}s (${data.queriesCount} queries)`);
    }
    
    // Modified storeResults function to save data immediately
    function storeResults(results, data) {
        if (!results.performanceData) {
            results.performanceData = [];
        }
        results.performanceData.push(data);
        
        // Save the data immediately
        savePerformanceRecord(data).catch(err => 
            console.error(`Failed to save performance record: ${err.message}`));
    }
}

/**
 * Saves performance data to CSV - now used as a backup/fallback method
 * @param {Object} results - Results object containing the performance data
 */
async function savePerformanceDataToCsv(results) {
    if (!results.performanceData || results.performanceData.length === 0) {
        console.log('⚠️ No performance data to save');
        return;
    }
    
    console.log(`📄 Saving ${results.performanceData.length} performance records as backup...`);
    
    if (csvWriter) {
        // Use existing writer
        await csvWriter.writeRecords(results.performanceData);
    } else {
        // Initialize a new writer (fallback)
        const csvFilePath = path.join(config.directories.output, 'performance-data.csv');
        
        const tempCsvWriter = createObjectCsvWriter({
            path: csvFilePath,
            header: [
                { id: 'url', title: 'URL' },
                { id: 'totalTime', title: 'Total Time (s)' },
                { id: 'systemTime', title: 'System Time (s)' },
                { id: 'queriesTime', title: 'Queries Time (s)' },
                { id: 'queriesCount', title: 'Queries Count' },
                { id: 'timestamp', title: 'Timestamp' }
            ]
        });
        
        await tempCsvWriter.writeRecords(results.performanceData);
    }
    
    console.log(`📄 Performance data backup saved to CSV`);
}

function generateReports(results) {
    if (results.failedUrls.length) {
        fs.writeFileSync(
            path.join(config.directories.output, config.directories.reports.failed), 
            results.failedUrls.join('\n')
        );
        console.log(`📌 Failed URLs saved to '${config.directories.output}/${config.directories.reports.failed}'`);
    }

    if (results.notFoundUrls.length) {
        fs.writeFileSync(
            path.join(config.directories.output, config.directories.reports.notFound), 
            results.notFoundUrls.join('\n')
        );
        console.log(`📌 404 Not Found URLs saved to '${config.directories.output}/${config.directories.reports.notFound}'`);
    }

    if (results.serverErrorUrls.length) {
        fs.writeFileSync(
            path.join(config.directories.output, config.directories.reports.serverError), 
            results.serverErrorUrls.join('\n')
        );
        console.log(`📌 500 Internal Server Error URLs saved to '${config.directories.output}/${config.directories.reports.serverError}'`);
    }
}

function displaySummary(results, startTime) {
        
    console.log(`\n📊 Crawl Summary:`);
    console.log(`✅ Total Sites Crawled: ${results.crawledCount}`);
    console.log(`✔️ Sites Fully Loaded: ${results.successfulCount}`);
    console.log(`⚠️ Sites with Timeout: ${results.timeoutCount}`);
    console.log(`❌ Sites with Error: ${results.errorCount}`);
    console.log(`🚫 404 Not Found Pages: ${results.notFoundCount}`);
    console.log(`🚨 500 Internal Server Errors: ${results.serverErrorCount}`);

    const totalTimeTaken = (Date.now() - startTime) / 1000 / 60;
    console.log(`\n⏳ Total Time: ${totalTimeTaken.toFixed(2)} minutes`);
}

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, answer => {
        rl.close();
        resolve(answer.trim().toLowerCase());
    }));
}

async function extractUrlsFromSitemap(url) {
    try {
        console.log(`📥 Fetching sitemap: ${url}`);
        const response = await axios.get(url, { 
            timeout: config.performance.sitemapFetchTimeout 
        });
        const xmlData = response.data;
        const result = await parseStringPromise(xmlData);
        const urls = [];

        if (result.urlset && result.urlset.url) {
            result.urlset.url.forEach(urlObj => {
                if (urlObj.loc && urlObj.loc[0]) {
                    urls.push(urlObj.loc[0]);
                }
            });
        }

        if (result.sitemapindex && result.sitemapindex.sitemap) {
            for (const sitemap of result.sitemapindex.sitemap) {
                if (sitemap.loc && sitemap.loc[0]) {
                    console.log(`📥 Found nested sitemap: ${sitemap.loc[0]}`);
                    const nestedUrls = await extractUrlsFromSitemap(sitemap.loc[0]);
                    urls.push(...nestedUrls);
                }
            }
        }

        return urls;
    } catch (error) {
        console.error(`🚨 Error fetching or parsing sitemap: ${error.message}`);
        return [];
    }
}

function getUrlsFromFile() {
    const filePath = path.join(config.directories.output, 'urls.txt');
    if (!fs.existsSync(filePath)) return [];

    return fs.readFileSync(filePath, 'utf-8')
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);
}