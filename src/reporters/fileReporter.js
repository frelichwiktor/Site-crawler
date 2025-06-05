const fs = require('fs');
const path = require('path');
const config = require('../config');
const { constants } = config;

class FileReporter {
    constructor() {
        this.ensureDirectoryExists();
    }

    ensureDirectoryExists() {
        if (!fs.existsSync(config.directories.output)) {
            fs.mkdirSync(config.directories.output);
        }
    }

    recordCrawledUrl(url) {
        fs.appendFileSync(
            path.join(config.directories.output, constants.FILE_NAMES.CRAWLED), 
            url + '\n'
        );
    }

    generateReports(results) {
        if (results.failedUrls && results.failedUrls.length) {
            fs.writeFileSync(
                path.join(config.directories.output, constants.FILE_NAMES.FAILED), 
                results.failedUrls.join('\n')
            );
            console.log(`📌 Failed URLs saved to '${config.directories.output}/${constants.FILE_NAMES.FAILED}'`);
        }

        if (results.notFoundUrls && results.notFoundUrls.length) {
            fs.writeFileSync(
                path.join(config.directories.output, constants.FILE_NAMES.NOT_FOUND), 
                results.notFoundUrls.join('\n')
            );
            console.log(`📌 404 Not Found URLs saved to '${config.directories.output}/${constants.FILE_NAMES.NOT_FOUND}'`);
        }

        if (results.serverErrorUrls && results.serverErrorUrls.length) {
            fs.writeFileSync(
                path.join(config.directories.output, constants.FILE_NAMES.SERVER_ERROR), 
                results.serverErrorUrls.join('\n')
            );
            console.log(`📌 500 Internal Server Error URLs saved to '${config.directories.output}/${constants.FILE_NAMES.SERVER_ERROR}'`);
        }
    }

    displaySummary(results, startTime) {
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
}

module.exports = FileReporter;