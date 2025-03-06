const config = require('./config');
const { chromium, selectors } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseStringPromise } = require('xml2js');
const axios = require('axios');

async function main() {
    const startTime = Date.now();
    
    try {
        // Load credentials first
        const credentials = await loadCredentials();
        
        // Set up browser
        const browser = await setupBrowser();
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Navigate to Page A and click the Public button for the target URL
        console.log("\n--- PHASE 1: Navigating to Switcher ---");
        const pageASuccess = await navigatePageA(page, config.targetUrls.pageA);
        if (!pageASuccess) {
            throw new Error("Failed to complete Switcher navigation");
        }
        
        // Log in to Page B
        console.log("\n--- PHASE 2: Logging into the Matrix! ---");
        const pageBSuccess = await loginToPageB(page, credentials.pageB);
        if (!pageBSuccess) {
            throw new Error("Failed to log in to Matrix");
        }
        
        // Continue with normal crawling process
        console.log("\n--- PHASE 3: Starting URL Crawling ---");
        const urls = await getUrlsToProcess();
        
        // // Force suffix to be _performance for all URLs
        // console.log("🔧 Adding suffix '/_performance' to all URLs");
        // const processedUrls = urls.map(url => {
        //     try {
        //         const urlObj = new URL(url);
        //         urlObj.pathname = urlObj.pathname + '/_performance';
        //         return urlObj.toString();
        //     } catch (error) {
        //         console.error(`Failed to add suffix to ${url}: ${error.message}`);
        //         return url;
        //     }
        // });
        
        const results = await crawlUrls(browser, context, page, processedUrls);
        
        generateReports(results);
        
        displaySummary(results, startTime);
        
        await browser.close();
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

main();

// async function loginToPageA(page, credentials) {
//     console.log("🔑 Logging into Page A...");
    
//     try {
//         // Navigate to Page A
//         await page.goto(credentials.pageAUrl, { waitUntil: 'domcontentloaded' });
        
//         // Fill in credentials
//         await page.fill('input[name="username"]', credentials.username);
//         await page.fill('input[name="password"]', credentials.password);
        
//         // Click login button
//         await page.click('button[type="submit"]');
        
//         // Wait for navigation to complete
//         await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        
//         console.log("✅ Successfully logged into Page A");
//         return true;
//     } catch (error) {
//         console.error("❌ Failed to log into Page A:", error);
//         return false;
//     }
// }

async function navigatePageA(page, targetUrl) {
    console.log(`🔍 Looking for URL "${targetUrl}" to click Public button...`);
    
    try {
        // Navigate to the switcher page
        await page.goto(config.pageUrls.pageA, { waitUntil: 'domcontentloaded' });
        console.log("✅ Loaded switcher page");
        
        // Wait for the page to load
        await page.waitForSelector('#switcher', { timeout: 30000 });
        console.log("✅ Switcher is visible");

        await page.locator('#sup-urls div').filter({ hasText: 'URL: https://www.cardiff.ac.uk Public Admin' })
        .getByRole('link')
        .first()
        .evaluate((link) => {
            link.removeAttribute('target');  // Remove the 'target' attribute
            link.click(); // Perform the click
        });
        console.log(`✅ Clicked Public button for "${targetUrl}"`);
        
        // Wait for any navigation or changes
        await page.waitForLoadState('networkidle');
        console.log(`✅ DXP is here!`);
        
        return true;
    } catch (error) {
        console.error(`❌ Failed to navigate Switcher:`, error);
    }
}


async function loginToPageB(page, credentials) {
    console.log("🔑 Attempting to log into Matrix...");
    
    try {
        // Navigate to Page B
        await page.goto(config.pageUrls.pageB, { waitUntil: 'domcontentloaded' });
        
        // First, verify we're on the right version by checking for "Matrix DXP" span
        const versionCheck = await page.textContent('#switched-ui-marker');
        if (!versionCheck || !versionCheck.includes('Matrix DXP')) {
            throw new Error("❌ Verification failed: Not on the correct Matrix DXP version");
        }
        console.log("✅ Verification passed: Matrix DXP version detected");
        
        // Fill in credentials
        await page.fill('input[name="SQ_LOGIN_USERNAME"]', credentials.username);
        await page.fill('input[name="SQ_LOGIN_PASSWORD"]', credentials.password);
        
        // Click login button
        await page.click('input[type="submit"][value="Log In"]');
        
        // Wait for navigation to complete
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        
        console.log("✅ Successfully logged into Matrix!");
        return true;
    } catch (error) {
        console.error("❌ Failed to log into Matrix:", error);
        return false;
    }
}

async function loadCredentials() {
    console.log("🔑 Loading credentials...");
    
    try {
        // Attempt to load from credentials.js
        const credentials = require('./credentials.js');
        console.log("✅ Credentials loaded from file");
        return credentials;
    } catch (error) {
        console.log("⚠️ credentials.js not found or invalid");
        console.log("ℹ️ Please create credentials.js based on credentials.sample.js");
        
        // Fall back to prompting
        const username = await askQuestion("Enter username for Page B: ");
        const password = await askQuestion("Enter password for Page B: ");
        
        return {
            pageB: {
                username,
                password
            }
        };
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

async function crawlUrls(browser, urls) {
    // const context = await browser.newContext();
    // const page = await context.newPage();
    
    page.setDefaultTimeout(config.browser.defaultTimeout);
    page.setDefaultNavigationTimeout(config.browser.navigationTimeout);
    
    const uniqueHosts = [...new Set(urls.map(url => new URL(url).host))];
    const cookies = uniqueHosts.map(host => ({
        ...config.defaultCookie,
        domain: '.' + host
    }));
    await context.addCookies(cookies);
    
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
        urlLoadTimes: []
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

            const pageLoadTime = (Date.now() - pageStartTime) / 1000;
            console.log(`✅ Load Time: ${pageLoadTime.toFixed(2)} seconds`);

            results.pageLoadTimes.push(pageLoadTime);
            results.urlLoadTimes.push({ url, loadTime: pageLoadTime });

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

    const sortedLoadTimes = [...results.urlLoadTimes].sort((a, b) => b.loadTime - a.loadTime);
    const slowestPagesCount = Math.ceil(results.urlLoadTimes.length * config.performance.slowestPercentage);
    const slowestPages = sortedLoadTimes.slice(0, slowestPagesCount);

    if (slowestPages.length > 0) {
        const slowPagesContent = slowestPages
            .map(item => `${item.url} - ${item.loadTime.toFixed(2)} seconds`)
            .join('\n');
            
        fs.writeFileSync(
            path.join(config.directories.output, config.directories.reports.slowest),
            slowPagesContent
        );
        console.log(`📌 Slowest pages (top ${config.performance.slowestPercentage * 100}%) saved to '${config.directories.output}/${config.directories.reports.slowest}'`);
    }
}

function displaySummary(results, startTime) {
    const averageLoadTime = results.pageLoadTimes.length > 0 
        ? (results.pageLoadTimes.reduce((a, b) => a + b, 0) / results.pageLoadTimes.length).toFixed(2)
        : 0;
        
    console.log(`\n📊 Crawl Summary:`);
    console.log(`✅ Total Sites Crawled: ${results.crawledCount}`);
    console.log(`✔️ Sites Fully Loaded: ${results.successfulCount}`);
    console.log(`⚠️ Sites with Timeout: ${results.timeoutCount}`);
    console.log(`❌ Sites with Error: ${results.errorCount}`);
    console.log(`🚫 404 Not Found Pages: ${results.notFoundCount}`);
    console.log(`🚨 500 Internal Server Errors: ${results.serverErrorCount}`);
    console.log(`⏱️ Average Load Time: ${averageLoadTime} seconds`);

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