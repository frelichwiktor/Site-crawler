# Basic site crawler

This is a basic site crawler that visits websites either from a provided text file (urls.txt), an XML sitemap, or both. It checks if the DOM content is loaded and logs any issues encountered. Additionally, the crawler detects 404 Not Found errors, 500 Internal Server Errors, and analyzes page load performance metrics, saving the results in separate files.

## Installation

Install the necessary dependencies with npm:

```bash
npm install
```

Then, install Playwright:

```bash
npx playwright install
```

Additionally, install required packages for parsing sitemaps:
```
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

The crawler now supports adding a custom suffix to all URLs before crawling. After selecting your URL source, you'll be prompted:

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

### Cookie Configuration

If you need to pass a specific cookie, modify the `cookie` object inside `crawler.js`:

```javascript
const cookie = {
    name: 'name',
    value: 'value',
    domain: '.' + host,
    path: '/',
    httpOnly: true,
    secure: false,
};
```

Make sure to add it to the browser context:

```javascript
await context.addCookies([cookie]);
```

### Timeout Settings

You can modify the default timeout settings inside `crawler.js`:

```javascript
page.setDefaultTimeout(60000);
page.setDefaultNavigationTimeout(60000);
```

### Output Files

Results are saved in the `URLs/` folder:

- `urls-crawled.txt` – Successfully crawled URLs.
- `urls-failed.txt` – URLs that failed to load.
- `urls-404.txt` – URLs that returned a `404 Not Found` response.
- `urls-500.txt` – URLs that returned a `500 Internal Server Error` response.
- `slowest-pages.txt` – List of the slowest 10% of pages with their load times.

### Performance Analysis

The crawler now includes performance monitoring features:

- Tracks individual page load times.
- Calculates average load time across all successfully loaded pages.
- Identifies and reports the slowest 10% of pages.
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

## Notes

- Ensure the `URLs/` folder exists before running the crawler.
- If a URL file or sitemap is missing, the program will prompt you accordingly.
- Load times are measured from the start of navigation until the DOM content is loaded.
- The slowest pages report helps identify potential performance bottlenecks.
---

Happy crawling! 🚀
