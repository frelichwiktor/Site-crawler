const config = require('./config');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseStringPromise } = require('xml2js');
const axios = require('axios');

async function main() {
    const startTime = Date.now();
    
    try {
        const browser = await setupBrowser();
        
        const urls = await getUrlsToProcess();
        
        const results = await crawlUrls(browser, urls);
        
        generateReports(results);
        
        displaySummary(results, startTime);
        
        await browser.close();
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

main();

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
    const context = await browser.newContext();
    const page = await context.newPage();
    
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