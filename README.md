# Matrix Site Performance Crawler

A robust, modular site crawler specifically designed for Matrix-powered websites. It visits pages from a text file, XML sitemap, or both, and captures detailed performance metrics from the `/_performance` endpoint of each page. The crawler supports both Production and DXP environments with appropriate authentication and configuration.

## ✨ Key Features

- **Environment Selection**: Choose between PROD or DXP mode with appropriate cookies and version checks
- **Multiple URL Sources**: Import URLs from text file, XML sitemap, or both
- **Comprehensive Data Collection**: Records total time, system time, query times, and query counts
- **Error Detection**: Identifies and reports 404 and 500 errors separately
- **Speed data**: Real-time progress tracking with speed metrics and ETA
- **Detailed Reporting**: CSV reports named with domain, environment, and timestamp
- **Crash Resilience**: Performance data saved incrementally after each page
- **Custom URL Suffix**: Optional suffixes to test caching behaviour or alternate page versions

## 🏗️ Project Structure

```
├── src/
│   ├── main.js                     # Main application entry point
│   ├── auth/
│   │   └── matrixAuth.js          # Matrix authentication handler
│   ├── crawlers/
│   │   └── performanceCrawler.js  # Main crawling logic
│   ├── extractors/
│   │   └── performanceExtractor.js # Performance data extraction
│   ├── reporters/
│   │   ├── csvReporter.js         # CSV file generation
│   │   └── fileReporter.js        # File-based reporting
│   ├── utils/
│   │   └── urlProcessor.js        # URL processing and management
│   └── config/
│       ├── index.js               # Main configuration
│       ├── constants.js           # All constants and magic numbers
│       └── environments.js        # Environment-specific settings
├── URLs/                          # Output directory for URL lists
├── reports/                       # CSV performance reports
├── index.js                       # Entry point (backwards compatibility)
├── credentials.sample.js          # Sample credentials file
└── playwright.config.ts           # Playwright configuration
```

## 🚀 Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Install Playwright browsers:**
```bash
npx playwright install
```

3. **Set up credentials:**
```bash
cp credentials.sample.js credentials.js
```

4. **Edit credentials with your Matrix login details:**
```javascript
module.exports = {
    matrix: {
        username: "your_username_here",
        password: "your_password_here"
    }
};
```

**Note:** If your password contains `\`, you need to escape it as `\\` (each `\\` represents a single literal backslash).

## 📖 Step-by-Step Usage Guide

### 1. Start the Crawler
```bash
npm start
# or
node index.js
# or directly
node src/main.js
```

### 2. Configure Domain
- Enter the domain for crawling (e.g., "www.example.com" or "https://www.example.com/")
- The crawler extracts the domain name and builds the Matrix admin URL automatically

### 3. Select Environment
- Choose between **"prod"** or **"dxp"**
- **DXP mode**: Adds specific cookie and performs version verification
- **PROD mode**: Skips cookie and version verification

### 4. Authentication
- Crawler uses credentials from `credentials.js` to log into Matrix
- If file is missing, you'll be prompted for username and password

### 5. Choose URL Source
Three options available:
1. **From URLs file** - Uses `URLs/urls.txt`
2. **From sitemap URL** - Enter sitemap URL when prompted
3. **Both sources** - Combines URLs from file and sitemap (duplicates removed)

### 6. Custom Suffix (Optional)
- Option to add custom suffix to URLs (e.g., "/_nocache")
- Applied before the automatic "/_performance" suffix

### 7. Monitor Progress
- **Speed data** shows:
  - Completion percentage
  - Current/total URLs processed
  - Processing speed (URLs per minute)
  - Estimated time remaining
- Real-time performance metrics displayed for each URL
- All data saved to CSV incrementally

### 8. Review Results
- **Summary statistics** show counts of successful, failed, timeout, 404, and 500 URLs
- **CSV report** saved to `reports/` directory
- **Error URLs** saved to separate files in `URLs/` directory

## 📁 Output Files

### Performance Reports
- **Location**: `reports/domain-environment-YYYY-MM-DD-HHMM.csv`
- **Format**: CSV with European decimal separators (comma)
- **Columns**: URL, Total Time, System Time, Queries Time, Queries Count, Timestamp

### URL Lists
- **Crawled URLs**: `URLs/urls-crawled.txt` - Successfully processed URLs
- **Failed URLs**: `URLs/urls-failed.txt` - URLs that failed to load
- **404 URLs**: `URLs/urls-404.txt` - Not found URLs
- **500 URLs**: `URLs/urls-500.txt` - Server error URLs

## ⚙️ Configuration

The crawler uses a modular configuration system in `src/config/`:

### Browser Settings (`src/config/environments.js`)
```javascript
browser: {
    headless: false,           // Show browser UI (set to true for headless)
    defaultTimeout: 30000,     // 30 seconds default timeout
    navigationTimeout: 30000   // 30 seconds navigation timeout
}
```

### Constants (`src/config/constants.js`)
```javascript
TIMEOUTS: {
    DEFAULT: 30000,           // 30 seconds
    NAVIGATION: 30000,        // 30 seconds  
    PERFORMANCE_WAIT: 20000,  // 20 seconds
    LONG_OPERATION: 60000,    // 60 seconds (page loads)
    SITEMAP_FETCH: 10000      // 10 seconds
}
```

### Directory Settings
```javascript
directories: {
    output: 'URLs',           // URL lists directory
    reports: 'reports'        // CSV reports directory
}
```

## 🛠️ Tips & Troubleshooting

### Preparation
- **URLs file**: Create `URLs/urls.txt` with one URL per line for file-based crawling
- **Sitemap testing**: Verify sitemap URLs are accessible before crawling

### Common Issues
- **Network timeouts**: Increase `sitemapFetchTimeout` in constants.js for slow sitemaps
- **Login problems**: Verify Matrix credentials and domain correctness
- **Browser timeouts**: Increase `defaultTimeout` and `navigationTimeout` for slow sites
- **Missing performance data**: Ensure target site has `/_performance` capability enabled

### Performance Tips
- **Headless mode**: Set `headless: true` in config for faster crawling
- **Timeout tuning**: Adjust timeouts based on your site's response times
- **Batch processing**: For large sitemaps, consider processing in smaller batches

## 🔧 Internal Architecture

### Authentication Flow
1. Load credentials from `credentials.js` or prompt user
2. Navigate to Matrix admin URL with force login parameter
3. Perform DXP version verification (if in DXP mode)
4. Submit login form and wait for successful navigation

### URL Processing Pipeline
1. **Collection**: Gather URLs from file and/or sitemap
2. **Deduplication**: Remove duplicate URLs when using multiple sources
3. **Suffix Addition**: Apply custom suffixes if specified
4. **Performance Suffix**: Automatically append `/_performance` to all URLs

### Data Extraction Strategy
Multiple fallback methods for performance data extraction:
1. Frame by name (`result_frame`)
2. Frame by URL pattern (`performance_result`)
3. Frame locator by ID (`#result_frame`)
4. Main page content search
5. Generic DOM traversal for performance text

### Error Handling
- **Network timeouts**: Configurable timeouts with graceful degradation
- **HTTP errors**: Separate tracking for 404/500 responses
- **Extraction failures**: Fallback methods and detailed error logging
- **Authentication failures**: Clear error messages and retry prompts

## 🎯 Dependencies

### Runtime Dependencies
- **playwright**: Browser automation
- **axios**: HTTP requests for sitemap fetching
- **xml2js**: XML sitemap parsing
- **csv-writer**: CSV file generation

### Development Dependencies
- **@playwright/test**: Testing framework
- **@types/node**: TypeScript definitions

---

## 🚀 Happy Crawling!

This crawler is designed to be robust, informative, and easy to use. The modular architecture makes it simple to extend with new features or modify existing behaviour. For questions or issues, check the troubleshooting section above or review the detailed logging output during crawling.