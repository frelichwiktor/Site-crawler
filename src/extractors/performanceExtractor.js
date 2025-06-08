const config = require('../config');
const { constants } = config;

// Simplified and more reliable frame detection
class PerformanceExtractor {
    async extractPerformanceData(page, url) {
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
            await page.waitForLoadState('networkidle', { timeout: constants.TIMEOUTS.PERFORMANCE_WAIT })
                .catch(() => {});
            
            const extractedText = await this.findPerformanceFrame(page);
            
            if (extractedText) {
                perfData.rawText = extractedText.trim();
                this.parsePerformanceText(extractedText, perfData);
            }
            
        } catch (error) {
            perfData.error = error.message;
        }
        
        return perfData;
    }

    async findPerformanceFrame(page) {
        // Strategy 1: Wait for the frame to exist first, then access it
        try {
            await page.waitForSelector('#result_frame', { 
                timeout: constants.TIMEOUTS.PERFORMANCE_WAIT,
                state: 'attached' 
            });
            
            const frameLocator = page.frameLocator('#result_frame');
            await frameLocator.locator('#perfSummary .perfTotal').waitFor({ 
                timeout: constants.TIMEOUTS.PERFORMANCE_WAIT 
            });
            
            const text = await frameLocator.locator('#perfSummary .perfTotal').textContent();
            if (text && text.trim()) {
                return text;
            }
        } catch (error) {
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
                    return text;
                }
            }
        } catch (error) {
        }

        // Strategy 3: Last resort - check if it's in the main page
        try {
            const text = await page.locator('#perfSummary .perfTotal').textContent({ timeout: 5000 });
            if (text && text.trim()) {
                return text;
            }
        } catch (error) {
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
    }
}

module.exports = PerformanceExtractor;