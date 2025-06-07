const config = require('../config');
const { constants } = config;

// Simplified and more reliable frame detection
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
            // Wait for page to stabilise first
            await page.waitForLoadState('networkidle', { timeout: constants.TIMEOUTS.PERFORMANCE_WAIT })
                .catch(() => console.log('⚠️ Page did not reach network idle state'));
            
            const extractedText = await this.findPerformanceFrame(page);
            
            if (extractedText) {
                perfData.rawText = extractedText.trim();
                this.parsePerformanceText(extractedText, perfData);
            } else {
                console.log(`❌ Performance data not found`);
            }
            
        } catch (error) {
            console.error(`❌ Error extracting performance data: ${error.message}`);
            perfData.error = error.message;
        }
        
        return perfData;
    }

    async findPerformanceFrame(page) {
        console.log(`🔍 Looking for performance frame...`);
        
        // Strategy 1: Wait for the frame to exist first, then access it
        try {
            // Wait for the frame element to be present in DOM
            await page.waitForSelector('#result_frame', { 
                timeout: constants.TIMEOUTS.PERFORMANCE_WAIT,
                state: 'attached' 
            });
            
            // Now try to access the frame content using frameLocator (most reliable)
            const frameLocator = page.frameLocator('#result_frame');
            await frameLocator.locator('#perfSummary .perfTotal').waitFor({ 
                timeout: constants.TIMEOUTS.PERFORMANCE_WAIT 
            });
            
            const text = await frameLocator.locator('#perfSummary .perfTotal').textContent();
            if (text && text.trim()) {
                console.log(`✅ Found performance data using frameLocator`);
                return text;
            }
        } catch (error) {
            console.log(`⚠️ frameLocator method failed: ${error.message}`);
        }

        // Strategy 2: Fallback - try to find frame by name
        try {
            const frame = page.frame({ name: 'result_frame' });
            if (frame) {
                await frame.waitForSelector('#perfSummary .perfTotal', { 
                    timeout: constants.TIMEOUTS.PERFORMANCE_WAIT 
                });
                const text = await frame.locator('#perfSummary .perfTotal').textContent();
                if (text && text.trim()) {
                    console.log(`✅ Found performance data using frame by name`);
                    return text;
                }
            }
        } catch (error) {
            console.log(`⚠️ Frame by name method failed: ${error.message}`);
        }

        // Strategy 3: Last resort - check if it's in the main page
        try {
            const text = await page.locator('#perfSummary .perfTotal').textContent({ timeout: 5000 });
            if (text && text.trim()) {
                console.log(`✅ Found performance data in main page`);
                return text;
            }
        } catch (error) {
            console.log(`⚠️ Main page method failed: ${error.message}`);
        }

        return null;
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