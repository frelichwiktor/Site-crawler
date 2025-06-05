const config = require('../config');
const { constants } = config;

class PerformanceExtractor {
    async extractPerformanceData(page, url) {
        console.log(`📊 Extracting performance data from ${url}`);
        
        const perfData = {
            url: url,
            totalTime: null,
            systemTime: null,
            queriesTime: null,
            queriesCount: null,
            rawText: null,
            timestamp: new Date().toISOString()
        };
        
        try {
            // Wait for page to stabilize
            await page.waitForLoadState('networkidle', { timeout: constants.TIMEOUTS.PERFORMANCE_WAIT })
                .catch(() => console.log('⚠️ Page did not reach network idle state'));
            
            // Try different extraction strategies
            const extractionMethods = [
                this.extractFromFrameByName.bind(this),
                this.extractFromFrameByUrl.bind(this),
                this.extractFromFrameLocator.bind(this),
                this.extractFromMainPage.bind(this),
                this.extractGeneric.bind(this)
            ];
            
            let extractedText = null;
            
            for (const method of extractionMethods) {
                try {
                    extractedText = await method(page);
                    if (extractedText) {
                        console.log(`✅ Successfully extracted using ${method.name}`);
                        break;
                    }
                } catch (error) {
                    // Continue to next method
                }
            }
            
            if (extractedText) {
                perfData.rawText = extractedText.trim();
                this.parsePerformanceText(extractedText, perfData);
            } else {
                console.log(`❌ Performance data not found using any method`);
            }
            
        } catch (error) {
            console.error(`❌ Error extracting performance data: ${error.message}`);
            perfData.error = error.message;
        }
        
        return perfData;
    }

    async extractFromFrameByName(page) {
        console.log(`🔍 Looking for result_frame by name...`);
        const frame = page.frame({ name: constants.SELECTORS.PERFORMANCE_FRAME });
        
        if (!frame) return null;
        
        console.log(`✅ Found frame by name`);
        await frame.waitForSelector(constants.SELECTORS.PERFORMANCE_SUMMARY, { 
            timeout: constants.TIMEOUTS.PERFORMANCE_WAIT 
        });
        return await frame.locator(constants.SELECTORS.PERFORMANCE_SUMMARY).textContent();
    }

    async extractFromFrameByUrl(page) {
        console.log(`🔍 Looking for frame by URL pattern...`);
        const frame = page.frames().find(f => f.url().includes(constants.URL_PATTERNS.PERFORMANCE_RESULT));
        
        if (!frame) return null;
        
        console.log(`✅ Found frame by URL pattern`);
        await frame.waitForSelector(constants.SELECTORS.PERFORMANCE_SUMMARY, { 
            timeout: constants.TIMEOUTS.PERFORMANCE_WAIT 
        });
        return await frame.locator(constants.SELECTORS.PERFORMANCE_SUMMARY).textContent();
    }

    async extractFromFrameLocator(page) {
        console.log(`🔍 Looking for frame using frameLocator...`);
        const frameElement = await page.evaluate(() => {
            const elem = document.getElementById('result_frame');
            return elem ? true : false;
        });
        
        if (!frameElement) return null;
        
        console.log(`✅ Found frame element by ID`);
        const frameLocator = page.frameLocator(constants.SELECTORS.PERFORMANCE_FRAME_ID);
        return await frameLocator.locator(constants.SELECTORS.PERFORMANCE_SUMMARY).textContent();
    }

    async extractFromMainPage(page) {
        console.log(`🔍 Looking in main page...`);
        return await page.locator(constants.SELECTORS.PERFORMANCE_SUMMARY).textContent();
    }

    async extractGeneric(page) {
        console.log(`🔍 Trying generic approach...`);
        
        const anyPerfText = await page.evaluate(() => {
            const allDivs = document.querySelectorAll('div');
            for (const div of allDivs) {
                const text = div.textContent;
                if (text.includes('Total Time') && 
                    text.includes('System') && 
                    text.includes('Queries')) {
                    return text;
                }
            }
            return null;
        });
        
        return anyPerfText;
    }

    parsePerformanceText(text, data) {
        const totalTimeMatch = text.match(constants.REGEX.TOTAL_TIME);
        if (totalTimeMatch) data.totalTime = parseFloat(totalTimeMatch[1]);
        
        const systemTimeMatch = text.match(constants.REGEX.SYSTEM_TIME);
        if (systemTimeMatch) data.systemTime = parseFloat(systemTimeMatch[1]);
        
        const queriesMatch = text.match(constants.REGEX.QUERIES);
        if (queriesMatch) {
            data.queriesTime = parseFloat(queriesMatch[1]);
            data.queriesCount = parseInt(queriesMatch[2], 10);
        }
        
        console.log(`📊 Parsed performance data:`);
        console.log(`   - Total Time: ${data.totalTime}s`);
        console.log(`   - System Time: ${data.systemTime}s`);
        console.log(`   - Queries: ${data.queriesTime}s (${data.queriesCount} queries)`);
    }
}

module.exports = PerformanceExtractor;