# Matrix Site Performance Crawler

A robust, modular site crawler specifically designed for Matrix-powered websites. It visits pages from a text file, XML sitemap, or both, and captures detailed performance metrics from the `/_performance` endpoint of each page. The crawler supports PROD-only, DXP-only, and **comparison modes** with parallel execution for maximum efficiency.

## ✨ Key Features

- **Three Crawling Modes**: PROD-only, DXP-only, or **parallel PROD vs DXP comparison**
- **Parallel Comparison Execution**: Compare environments simultaneously for ~50% time reduction
- **Multiple URL Sources**: Import URLs from text file, XML sitemap, or both
- **Comprehensive Data Collection**: Records total time, system time, query times, and query counts
- **Intelligent Error Detection**: Identifies and reports 404 and 500 errors separately
- **Real-time Progress Tracking**: Speed metrics and ETA calculations
- **Automated Reporting**: CSV reports with domain, environment, and timestamp
- **Crash Resilience**: Performance data saved incrementally after each page
- **Custom URL Suffixes**: Optional suffixes to test caching behaviour or alternate versions
- **Clean Logging**: Minimal, focused console output for daily use

## 🏗️ Project Structure

```
├── src/
│   ├── main.js                     # Main application entry point
│   ├── auth/
│   │   └── matrixAuth.js          # Matrix authentication handler
│   ├── crawlers/
│   │   ├── performanceCrawler.js  # Sequential single-environment crawling
│   │   └── comparisonCrawler.js   # Parallel PROD vs DXP comparison
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
    prod: {
        username: "your_prod_username_here",
        password: "your_prod_password_here"
    },
    dxp: {
        username: "your_dxp_username_here", 
        password: "your_dxp_password_here"
    }
};
```

**Note:** If your password contains `\`, you need to escape it as `\\` (each `\\` represents a single literal backslash).

## 📖 Step-by-Step Usage Guide

### 1. Start the Crawler
```bash
npm start
```

### 2. Configure Domain
- Enter the domain for crawling (e.g., "www.example.com" or "https://www.example.com/")
- The crawler extracts the domain name and builds the Matrix admin URL automatically

### 3. Select Crawling Mode
Choose from three powerful options:
- **[1] PROD only** - Sequential crawling of PROD environment
- **[2] DXP only** - Sequential crawling of DXP environment  
- **[3] Compare PROD vs DXP** - Parallel comparison mode

### 4. Choose URL Source
Three options available:
1. **From URLs file** - Uses `URLs/urls.txt`
2. **From sitemap URL** - Enter sitemap URL when prompted
3. **Both sources** - Combines URLs from file and sitemap (duplicates removed)

### 5. Custom Suffix (Optional)
- Option to add custom suffix to URLs (e.g., "/_nocache")
- Applied before the automatic "/_performance" suffix

### 6. Monitor Progress
**Clean, focused output shows:**
- **Current URL and progress** (e.g., "[15/100]")
- **Processing speed** (URLs per minute)
- **Estimated time remaining**
- **Success/failure status** per URL (✅ PROD | ✅ DXP)

### 7. Review Results
- **Summary statistics** show counts of successful, failed, timeout, 404, and 500 URLs
- **CSV report** saved to `reports/` directory with timestamp
- **Error URLs** saved to separate files in `URLs/` directory

## 🔥 Comparison Mode

**NEW: Parallel PROD vs DXP comparison** is the standout feature:

### **What It Does:**
- Crawls **same URLs simultaneously** in both PROD and DXP environments  
- **~50% faster** than running separate crawls
- **Side-by-side performance data** in one CSV file - one row per URL
- **Clean data format** perfect for Excel analysis and pivot tables

### **Example Console Output:**
```
📍 [5/50] https://example.com/checkout/_performance
🚀 Speed: 6/min | ETA: 450s
   PROD: ✅ | DXP: ✅

📍 [6/50] https://example.com/products/_performance  
🚀 Speed: 6/min | ETA: 440s
   PROD: ✅ | DXP: ❌
```

### **CSV Output Format - Side-by-Side Comparison:**

The comparison mode creates a **single row per URL** with PROD and DXP data in separate columns:

```csv
URL,PROD Total Time (s),PROD System Time (s),PROD Queries Time (s),PROD Queries Count,DXP Total Time (s),DXP System Time (s),DXP Queries Time (s),DXP Queries Count,Time Difference (s),Timestamp
https://example.com/page1,2,4,1,2,0,9,15,2,7,1,3,0,9,16,-0,3,2025-06-07T10:30:00Z
https://example.com/page2,1,8,0,8,0,4,12,2,1,0,9,0,5,13,0,3,2025-06-07T10:30:15Z
https://example.com/page3,3,2,,,,,,,,,2025-06-07T10:30:30Z
```

**Failed URL Handling:**
When PROD or DXP fails to load:
- Failed environment columns remain **empty**
- Successful environment data is still recorded
- Time difference is only calculated when both environments succeed
- Makes filtering and analysis in Excel much cleaner

## 📁 Output Files

### Performance Reports
- **Location**: `reports/domain-environment-YYYY-MM-DD-HHMM.csv`
- **Format**: CSV with European decimal separators (comma)
- **Single Mode**: `domain-prod-YYYY-MM-DD-HHMM.csv` or `domain-dxp-YYYY-MM-DD-HHMM.csv`
- **Comparison Mode**: `domain-comparison-YYYY-MM-DD-HHMM.csv` (side-by-side format)

### URL Lists
- **Crawled URLs**: `URLs/urls-crawled.txt` - Successfully processed URLs
- **Failed URLs**: `URLs/urls-failed.txt` - URLs that failed to load
- **404 URLs**: `URLs/urls-404.txt` - Not found URLs
- **500 URLs**: `URLs/urls-500.txt` - Server error URLs

### Comparison Mode Excel Tips
The side-by-side CSV format is optimised for Excel analysis:

1. **Import the CSV** - Excel will recognise the comma decimal separators
2. **Filter by empty cells** - Quickly find URLs where one environment failed
3. **Create pivot tables** - Analyse performance patterns across URL groups
4. **Sort by time difference** - Identify biggest performance gaps
5. **Use conditional formatting** - Highlight slow URLs or large differences

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
- **Credentials**: Ensure both PROD and DXP credentials are valid for comparison mode

### Common Issues
- **Network timeouts**: Increase `sitemapFetchTimeout` in constants.js for slow sitemaps
- **Login problems**: Verify Matrix credentials and domain correctness
- **Browser timeouts**: Increase `defaultTimeout` and `navigationTimeout` for slow sites
- **Missing performance data**: Ensure target site has `/_performance` capability enabled

### Performance Tips
- **Headless mode**: Set `headless: true` in config for faster crawling
- **Timeout tuning**: Adjust timeouts based on your site's response times
- **Comparison mode**: Use for maximum efficiency when testing PROD vs DXP
- **Batch processing**: For large sitemaps, consider processing in smaller batches

## 🔧 Internal Architecture

### Crawling Modes
1. **Single Environment (PROD/DXP)**: Sequential crawling with single authentication session
2. **Comparison Mode**: Parallel execution with independent authentication per environment

### Authentication Flow
1. Load credentials from `credentials.js` (PROD and DXP sections)
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
1. Frame locator by ID (`#result_frame`)
2. Frame by name (`result_frame`)
3. Main page content search as fallback

### Error Handling
- **Network timeouts**: Configurable timeouts with graceful degradation
- **HTTP errors**: Separate tracking for 404/500 responses
- **Extraction failures**: Fallback methods and clean error logging
- **Authentication failures**: Clear error messages and helpful tips

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

This crawler is designed to be robust, fast, and perfect for QA workflows. The **comparison mode with side-by-side CSV output** is the real game-changer - get clean, analysable PROD vs DXP performance data in half the time of separate crawls. Perfect for importing into Excel, creating performance reports, and identifying environment-specific issues.