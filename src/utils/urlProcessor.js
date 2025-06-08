const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const readline = require('readline');
const config = require('../config');
const { constants } = config;

class UrlProcessor {
    constructor() {
        this.rl = null;
    }

    async setupDomain() {
        const userInput = await this.askQuestion("Enter the domain or URL (e.g., www.example.com or https://www.example.com/): ");

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
            
            console.log(`✅ Domain: ${domain}`);
            
            config.setDomain(domain, baseUrl);
            
            return domain;
        } catch (error) {
            console.error(`❌ Error parsing domain: ${error.message}`);
            domain = userInput.replace(/^https?:\/\//, '').replace(/\/$/, '');
            config.setDomain(domain, `https://${domain}`);
            return domain;
        }
    }

    async getUrlsToProcess() {
        if (!fs.existsSync(config.directories.output)) {
            fs.mkdirSync(config.directories.output);
        }
        
        const choice = await this.askQuestion(
            "\nHow do you want to crawl?\n" +
            "[1] From URLs file (urls.txt)\n" +
            "[2] From a sitemap URL\n" +
            "[3] Both (txt & sitemap)\n" +
            "Enter your choice (1, 2, or 3): "
        );
        
        let urls = [];
        
        if (choice === '1') {
            console.log(`\n📂 Loading URLs from file...`);
            urls = this.getUrlsFromFile();
        } else if (choice === '2') {
            let sitemapUrl = await this.askQuestion("Enter the sitemap URL: ");
            console.log(`\n📥 Loading URLs from sitemap...`);
            urls = await this.extractUrlsFromSitemap(sitemapUrl);
        } else if (choice === '3') {
            let sitemapUrl = await this.askQuestion("Enter the sitemap URL: ");
            console.log(`\n📂 Loading URLs from both sources...`);
            urls = [...new Set([...this.getUrlsFromFile(), ...await this.extractUrlsFromSitemap(sitemapUrl)])];
        } else {
            console.log("❌ Invalid choice. Exiting...");
            return [];
        }
        
        if (urls.length === 0) {
            console.log('⚠️ No URLs found. Exiting...');
            return [];
        }
        
        console.log(`✅ Loaded ${urls.length} URLs`);
        
        urls = await this.processSuffixOption(urls);
        
        return urls;
    }

    getUrlsFromFile() {
        const filePath = path.join(config.directories.output, constants.FILE_NAMES.URLS_SOURCE);
        if (!fs.existsSync(filePath)) return [];

        return fs.readFileSync(filePath, 'utf-8')
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);
    }

    async extractUrlsFromSitemap(url) {
        try {
            const response = await axios.get(url, { 
                timeout: constants.TIMEOUTS.SITEMAP_FETCH
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
                        const nestedUrls = await this.extractUrlsFromSitemap(sitemap.loc[0]);
                        urls.push(...nestedUrls);
                    }
                }
            }

            return urls;
        } catch (error) {
            console.error(`❌ Error fetching sitemap: ${error.message}`);
            return [];
        }
    }

    async processSuffixOption(urls) {
        let addSuffix = await this.askQuestion("Do you want to add a suffix to each URL? (y/n): ");
        let suffix = '';

        if (addSuffix === 'y') {
            suffix = await this.askQuestion("Enter the suffix to add (e.g. /_nocache): ");
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

    addPerformanceSuffix(urls) {
        console.log(`🔧 Adding /_performance suffix to all URLs`);
        return urls.map(url => {
            try {
                const urlObj = new URL(url);
                urlObj.pathname = urlObj.pathname + constants.URL_PATTERNS.PERFORMANCE_SUFFIX;
                return urlObj.toString();
            } catch (error) {
                console.error(`Failed to add suffix to ${url}: ${error.message}`);
                return url;
            }
        });
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

module.exports = UrlProcessor;