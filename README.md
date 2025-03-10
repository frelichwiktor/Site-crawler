# Site crawler

This is a robust site crawler that visits websites either from a provided text file (urls.txt), an XML sitemap, or both. It authenticates through the Matrix DXP system, checks if the DOM content is loaded, and logs any issues encountered along the way.

The crawler provides comprehensive monitoring capabilities including:
- Immediate CSV logging of performance data for each page (resilient to crashes)
- Detection of 404 Not Found errors and 500 Internal Server Errors
- Real-time analysis of page load performance metrics
- Custom URL suffix support for testing cache behavior

Performance data is saved incrementally after each page is crawled, ensuring no data loss even if the program terminates unexpectedly. Results are organized in separate files for easy analysis, with a detailed summary provided upon completion.

## Installation

Install the necessary dependencies with npm:

```bash
npm install
```

Then, install Playwright:

```bash
npx playwright install
```

Install required packages for CSV export:
```bash
npm install csv-writer
```

Install required packages for parsing sitemaps:
```bash
npm install xml2js axios
```

## Usage

Run the crawler with:

```bash
node crawler.js
```

### Input Options

After running the script, you will be prompted to choose one of the following options:

1. **Crawl URLs from a `txt` file** – Reads URLs from `URLs/urls.txt`.
2. **Crawl URLs from a sitemap** – Extracts URLs from a provided XML sitemap.
3. **Crawl both sources** – Combines both methods.

#### Using a `txt` File

To use URLs from a text file, place them in:

```
URLs/urls.txt
```

Each URL should be on a new line.

#### Using a Sitemap

If you choose to crawl from a sitemap, you need to provide a valid URL, such as:

```
https://example.com/sitemap.xml
```

The crawler will parse the sitemap and extract all listed URLs.

### URL Suffix Feature

The crawler supports adding a custom suffix to all URLs before crawling. After selecting your URL source, you'll be prompted:

```
Do you want to add a suffix to each URL? (y/n):
```

If you choose 'y', you'll be asked to enter the suffix:

```
Enter the suffix to add (e.g. /_nocache):
```

This feature is useful for:
- Testing cache-busting with suffixes like `/_nocache` or `?nocache=true`
- Checking alternative page versions with suffixes like `/preview` or `/print`
- Testing URL parameters by adding query strings like `?test=true`

The suffix is added to the path portion of each URL, preserving the original domain and any existing query parameters.

### Configuration

The crawler now uses a configuration file (`config.js`) to manage settings. You can modify these settings without changing the main code:

```javascript
// Example config.js structure
module.exports = {
    // Browser settings
    browser: {
        headless: true,
        defaultTimeout: 30000,     // 30 seconds
        navigationTimeout: 30000   // 30 seconds
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
    
    // Performance settings, not related to the /_performance tab
    performance: {
        slowestPercentage: 0.1,    // Top 10%
        sitemapFetchTimeout: 10000 // 10 seconds
    },
    
    // Default cookie settings
    defaultCookie: {
        name: 'name',
        value: 'value',
        path: '/',
        httpOnly: true,
        secure: false
    }

    urlToFind: {
        pageToFind: 'the site for which we want to change the version to DXP'
    },
    
    pageUrls: {
        switcher: 'Link to the switcher',
        matrix: 'Link to the Matrix login page, with /_admin?FORCE_BACKUP_LOGIN=1'
    }
};
```

This allows you to easily adjust:
- Browser behavior and timeouts
- Output directories and file names
- Performance analysis thresholds
- Default cookie values

### Cookie Configuration

If you need to pass specific cookies, modify the `defaultCookie` object in `config.js`:

```javascript
defaultCookie: {
    name: 'name',
    value: 'value',
    path: '/',
    httpOnly: true,
    secure: false
}
```

### Timeout Settings

You can modify the default timeout settings in `config.js`:

```javascript
browser: {
    headless: true,
    defaultTimeout: 30000,     // 30 seconds in milliseconds
    navigationTimeout: 30000   // 30 seconds in milliseconds
}
```

### Output Files

Results are saved in the output directory specified in the config (default is `URLs/` folder):

- `performance-data.csv` – Performance data gathered from /_performance tab of each page.
- `urls-crawled.txt` – Successfully crawled URLs.
- `urls-failed.txt` – URLs that failed to load.
- `urls-404.txt` – URLs that returned a `404 Not Found` response.
- `urls-500.txt` – URLs that returned a `500 Internal Server Error` response.
- `slowest-pages.txt` – List of the slowest pages (percentage configurable) with their load times.

### Performance Analysis

The crawler includes performance monitoring features:

- Tracks individual page load times.
- Calculates average load time across all successfully loaded pages.
- Identifies and reports the slowest pages (configurable percentage, default 10%).
- Format of slowest-pages.txt: "URL - time in seconds".

### Summary Report

At the end of each run, a summary is displayed, including:

- Total sites crawled
- Successfully loaded sites
- Sites with timeouts
- Sites with errors
- `404 Not Found` pages
- `500 Internal Server Error` pages
- Average page load time
- Total execution time

## Project Structure

The project follows a modular approach:

- `crawler.js` - Main application with code organized into focused functions
- `config.js` - Configuration settings
- `URLs/` - Directory for input/output files

## Notes

- Ensure the output directory (specified in config) exists before running the crawler.
- If a URL file or sitemap is missing, the program will prompt you accordingly.
- Load times are measured from the start of navigation until the DOM content is loaded.
- The slowest pages report helps identify potential performance bottlenecks.
---

Happy crawling! 🚀