# Matrix Site Performance Crawler

This is a robust site crawler specifically designed for Matrix-powered websites. It visits pages from a text file, XML sitemap, or both, and captures detailed performance metrics from the `/_performance` endpoint of each page. The crawler supports both Production and DXP environments, with appropriate authentication and configuration for each.

## Key Features

- **Environment Selection**: Choose between PROD or DXP mode with appropriate cookies and version checks
- **Multiple URL Sources**: Import URLs from a text file, XML sitemap, or both
- **Comprehensive Data Collection**: Records total time, system time, query times, and query counts
- **Error Detection**: Identifies and reports 404 and 500 errors separately
- **Detailed Reporting**: CSV reports named with domain, environment, and date for easy tracking
- **Crash Resilience**: Performance data is saved incrementally after each page is processed
- **Custom URL Suffix**: Optionally add suffixes to test caching behavior or alternate page versions

## Installation

1. Install dependencies:

```bash
npm install
```

2. Install Playwright:

```bash
npx playwright install
```

3. Install additional required packages:

```bash
npm install csv-writer xml2js axios
```

4. Set up your credentials by copying the sample file:

```bash
cp credentials.sample.js credentials.js
```

5. Edit `credentials.js` with your Matrix login details

```bash
NOTE: if your password contains `\`, you need to add `\` next to it, as each `\\` is interpreted as a single literal backslash.
```

## Step-by-Step Usage Guide

1. **Start the crawler**:

```bash
node crawler.js
```

2. **Enter the domain**:
   - When prompted, enter the domain for crawling (e.g., "www.example.com" or "https://www.example.com/")
   - The crawler will extract the domain name and build the Matrix admin URL

3. **Select environment**:
   - Choose between "prod" or "dxp" when prompted
   - If DXP is selected, a specific cookie will be added and version verification performed
   - If PROD is selected, no cookie is added and version verification is skipped

4. **Log in to Matrix**:
   - The crawler will use your credentials from credentials.js to log in
   - If credentials.js is missing, you'll be prompted to enter username and password

5. **Select URL source**:
   - Choose one of three options:
     1. From URLs file (URLs/urls.txt)
     2. From a sitemap URL
     3. Both (combines URLs from file and sitemap)
   - If using a sitemap, you'll be asked to enter the sitemap URL

6. **Add custom suffix** (optional):
   - Choose whether to add a custom suffix to URLs
   - If yes, enter the suffix (e.g., "/_nocache")

7. **Monitor crawling progress**:
   - The crawler will show real-time progress as it visits each URL
   - Performance metrics are displayed and saved to CSV immediately

8. **Review results**:
   - When finished, a summary shows counts of successful, failed, timeout, 404, and 500 URLs
   - CSV report is saved in the "reports" directory with naming format: domain-environment-date.csv
   - Error URLs are saved to separate files in the URLs directory

## Output Files

- **Performance Data**: Saved in `reports/domain-environment-YYYY-MM-DD.csv`
- **Crawled URLs**: Successfully crawled URLs saved to `URLs/urls-crawled.txt`
- **Failed URLs**: URLs that failed to load saved to `URLs/urls-failed.txt`
- **404 URLs**: Not found URLs saved to `URLs/urls-404.txt`
- **500 URLs**: Server error URLs saved to `URLs/urls-500.txt`

## Configuration

The crawler uses a configuration file (`config.js`) for settings:

```javascript
module.exports = {
    // Browser settings
    browser: {
        headless: true,             // Run browser headlessly (no UI)
        defaultTimeout: 30000,      // 30 seconds
        navigationTimeout: 30000    // 30 seconds
    },
    
    // Directory settings
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
    
    // Performance settings
    performance: {
        sitemapFetchTimeout: 10000  // 10 seconds
    },
    
    domain: '',
    pageUrls: {
        matrix: ''
    }
};
```

Adjust these settings to customize timeouts, file paths, and browser behavior.

## Tips & Troubleshooting

- **Prepare URLs file**: For crawling from a file, create `URLs/urls.txt` with one URL per line
- **Network issues**: If sitemap extraction fails, try increasing the `sitemapFetchTimeout` in config.js
- **Login problems**: Verify your Matrix credentials and ensure the domain is correct
- **Browser timeout**: For slow sites, increase the `defaultTimeout` and `navigationTimeout` values
- **No performance data**: Ensure the site has the `/_performance` capability enabled

## Internal Working

1. The crawler logs into Matrix using provided credentials
2. It collects URLs from the specified source(s)
3. Each URL is modified to add "/_performance" to access the performance page
4. For each page:
   - The performance metrics are extracted from the page content
   - Data is parsed and saved immediately to the CSV file
   - Any errors are logged appropriately
5. Summary reports are generated at the end of the crawl

---

Happy crawling! 🚀
