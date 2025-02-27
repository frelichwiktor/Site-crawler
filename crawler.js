const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseStringPromise } = require('xml2js');
const axios = require('axios');

(async () => {
    const startTime = Date.now();
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    process.on('SIGINT', function () {
        console.warn(' 🚨 Crawling stopped...');
        process.exit();
    });

    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    const outputDir = 'URLs';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
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
            const response = await axios.get(url, { timeout: 10000 });
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
        const filePath = path.join(outputDir, 'urls.txt');
        if (!fs.existsSync(filePath)) return [];

        return fs.readFileSync(filePath, 'utf-8')
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);
    }

    let choice = await askQuestion(
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
        return;
    }

    if (urls.length === 0) {
        console.log('⚠️ No URLs found. Exiting...');
        return;
    }

    // New code: Ask if user wants to add a suffix to each URL
    let addSuffix = await askQuestion("Do you want to add a suffix to each URL? (y/n): ");
    let suffix = '';

    if (addSuffix === 'y') {
        suffix = await askQuestion("Enter the suffix to add (e.g. /_nocache): ");
        console.log(`🔧 Adding suffix "${suffix}" to all URLs`);
    }

    // Modify the URLs with the suffix if specified
    if (suffix) {
        urls = urls.map(url => {
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

    const uniqueHosts = [...new Set(urls.map(url => new URL(url).host))];
    const cookies = uniqueHosts.map(host => ({
        name: 'name',
        value: 'value',
        domain: '.' + host,
        path: '/',
        httpOnly: true,
        secure: false,
    }));

    await context.addCookies(cookies);

    let crawledCount = 0;
    let successfulCount = 0;
    let timeoutCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;
    let serverErrorCount = 0;
    const failedUrls = [];
    const notFoundUrls = [];
    const serverErrorUrls = [];
    const pageLoadTimes = [];
    const urlLoadTimes = [];

    for (const url of urls) {
        crawledCount++;
        const totalPercentage = (crawledCount * 100) / urls.length;
        console.log(`\n🔍 Visiting ${crawledCount}/${urls.length} [${totalPercentage.toFixed(2)}%]`);
        console.log(`🌍 URL: ${url}`);

        try {
            const pageStartTime = Date.now();
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            if (response.status() === 404) {
                console.log(`❌ 404 Not Found: ${url}`);
                notFoundCount++;
                notFoundUrls.push(url);
                continue;
            }

            if (response.status() === 500) {
                console.log(`🚨 500 Internal Server Error: ${url}`);
                serverErrorCount++;
                serverErrorUrls.push(url);
                continue;
            }

            const pageLoadTime = (Date.now() - pageStartTime) / 1000;
            console.log(`✅ Load Time: ${pageLoadTime.toFixed(2)} seconds`);

            pageLoadTimes.push(pageLoadTime);
            urlLoadTimes.push({ url, loadTime: pageLoadTime });

            successfulCount++;
            fs.appendFileSync(path.join(outputDir, 'urls-crawled.txt'), url + '\n');

        } catch (error) {
            if (error.message.includes('TimeoutError')) {
                console.log(`⚠️ Timeout on: ${url}. Skipping...`);
                timeoutCount++;
            } else {
                console.log(`🚨 Error on: ${url}. Skipping...`, error);
                errorCount++;
            }
            failedUrls.push(url);
        }
    }

    if (failedUrls.length) {
        fs.writeFileSync(path.join(outputDir, 'urls-failed.txt'), failedUrls.join('\n'));
        console.log(`📌 Failed URLs saved to 'URLs/urls-failed.txt'`);
    }

    if (notFoundUrls.length) {
        fs.writeFileSync(path.join(outputDir, 'urls-404.txt'), notFoundUrls.join('\n'));
        console.log(`📌 404 Not Found URLs saved to 'URLs/urls-404.txt'`);
    }

    if (serverErrorUrls.length) {
        fs.writeFileSync(path.join(outputDir, 'urls-500.txt'), serverErrorUrls.join('\n'));
        console.log(`📌 500 Internal Server Error URLs saved to 'URLs/urls-500.txt'`);
    }

    const averageLoadTime = pageLoadTimes.length > 0 
        ? (pageLoadTimes.reduce((a, b) => a + b, 0) / pageLoadTimes.length).toFixed(2)
        : 0;

    const sortedLoadTimes = [...urlLoadTimes].sort((a, b) => b.loadTime - a.loadTime);
    const slowestPagesCount = Math.ceil(urlLoadTimes.length * 0.1); // 10% of total
    const slowestPages = sortedLoadTimes.slice(0, slowestPagesCount);

    if (slowestPages.length > 0) {
        const slowPagesContent = slowestPages
            .map(item => `${item.url} - ${item.loadTime.toFixed(2)} seconds`)
            .join('\n');
        fs.writeFileSync(path.join(outputDir, 'slowest-pages.txt'), slowPagesContent);
        console.log(`📌 Slowest pages (top 10%) saved to 'URLs/slowest-pages.txt'`);
    }

    console.log(`\n📊 Crawl Summary:`);
    console.log(`✅ Total Sites Crawled: ${crawledCount}`);
    console.log(`✔️ Sites Fully Loaded: ${successfulCount}`);
    console.log(`⚠️ Sites with Timeout: ${timeoutCount}`);
    console.log(`❌ Sites with Error: ${errorCount}`);
    console.log(`🚫 404 Not Found Pages: ${notFoundCount}`);
    console.log(`🚨 500 Internal Server Errors: ${serverErrorCount}`);
    console.log(`⏱️ Average Load Time: ${averageLoadTime} seconds`);

    const totalTimeTaken = (Date.now() - startTime) / 1000 / 60;
    console.log(`\n⏳ Total Time: ${totalTimeTaken.toFixed(2)} minutes`);

    await browser.close();
})();