const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

// Try to load config - handle both old and new structures
let config;
let constants;

try {
    // Try new config structure first
    config = require('../config');
    constants = config.constants;
} catch (e) {
    // Fall back to old config
    try {
        config = require('../../config');
    } catch (e2) {
        console.error('❌ Could not load config from either location');
        throw e2;
    }
}

class CsvReporter {
    constructor() {
        this.csvWriter = null;
        this.csvFilePath = null;
        this.isComparisonMode = false;
    }

    async initialize(domain, environmentOrMode) {
        const cleanDomain = domain.replace(/^https?:\/\//i, '')
                                 .replace(/^www\./i, '')
                                 .replace(/[^\w.-]/g, '-');
        
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        // Handle different filename patterns
        let filename;
        let headers;
        
        if (environmentOrMode === 'comparison') {
            this.isComparisonMode = true;
            filename = `${cleanDomain}-comparison-${currentDate}-${hours}${minutes}.csv`;
            
            // Side-by-side comparison headers
            headers = [
                { id: 'url', title: 'URL' },
                { id: 'prodTotalTime', title: 'PROD Total Time (s)' },
                { id: 'prodSystemTime', title: 'PROD System Time (s)' },
                { id: 'prodQueriesTime', title: 'PROD Queries Time (s)' },
                { id: 'prodQueriesCount', title: 'PROD Queries Count' },
                { id: 'dxpTotalTime', title: 'DXP Total Time (s)' },
                { id: 'dxpSystemTime', title: 'DXP System Time (s)' },
                { id: 'dxpQueriesTime', title: 'DXP Queries Time (s)' },
                { id: 'dxpQueriesCount', title: 'DXP Queries Count' },
                { id: 'timeDifference', title: 'Time Difference (s)' },
                { id: 'timestamp', title: 'Timestamp' }
            ];
        } else {
            // Legacy single environment mode
            this.isComparisonMode = false;
            const environment = environmentOrMode ? 'dxp' : 'prod';
            filename = `${cleanDomain}-${environment}-${currentDate}-${hours}${minutes}.csv`;
            
            headers = (constants && constants.CSV && constants.CSV.HEADERS) 
                ? constants.CSV.HEADERS 
                : [
                    { id: 'url', title: 'URL' },
                    { id: 'totalTime', title: 'Total Time (s)' },
                    { id: 'systemTime', title: 'System Time (s)' },
                    { id: 'queriesTime', title: 'Queries Time (s)' },
                    { id: 'queriesCount', title: 'Queries Count' },
                    { id: 'timestamp', title: 'Timestamp' }
                ];
        }
        
        let reportsDir = 'reports'; // default
        
        if (config && config.directories) {
            if (typeof config.directories.reports === 'string') {
                reportsDir = config.directories.reports;
            } else if (config.directories.reportsDir) {
                reportsDir = config.directories.reportsDir;
            } else if (config.directories.reports && typeof config.directories.reports === 'object') {
                reportsDir = 'reports';
            }
        }
        
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        this.csvFilePath = path.join(reportsDir, filename);
        
        this.csvWriter = createObjectCsvWriter({
            path: this.csvFilePath,
            header: headers
        });
        
        console.log(`📝 Report: ${filename}`);
        return this.csvFilePath;
    }

    async savePerformanceRecord(record) {
        if (!this.csvWriter) {
            console.error('❌ CSV writer not initialized!');
            return;
        }
        
        try {
            const decimalSeparator = (constants && constants.CSV && constants.CSV.DECIMAL_SEPARATOR) 
                                   ? constants.CSV.DECIMAL_SEPARATOR 
                                   : ',';
            
            // Handle single environment mode (backward compatibility)
            if (!this.isComparisonMode) {
                const formattedRecord = {
                    url: record.url,
                    totalTime: record.totalTime ? record.totalTime.toString().replace('.', decimalSeparator) : null,
                    systemTime: record.systemTime ? record.systemTime.toString().replace('.', decimalSeparator) : null,
                    queriesTime: record.queriesTime ? record.queriesTime.toString().replace('.', decimalSeparator) : null,
                    queriesCount: record.queriesCount,
                    timestamp: record.timestamp
                };
                
                await this.csvWriter.writeRecords([formattedRecord]);
                return;
            }
            
            // This method shouldn't be called in comparison mode
            // Use saveComparisonRecord instead
            console.warn('⚠️ savePerformanceRecord called in comparison mode. Use saveComparisonRecord instead.');
            
        } catch (error) {
            console.error(`❌ Error saving CSV record: ${error.message}`);
        }
    }

    // New method specifically for comparison mode
    async saveComparisonRecord(url, prodData, dxpData, timeDifference) {
        if (!this.csvWriter || !this.isComparisonMode) {
            console.error('❌ CSV writer not initialized for comparison mode!');
            return;
        }
        
        try {
            const decimalSeparator = (constants && constants.CSV && constants.CSV.DECIMAL_SEPARATOR) 
                                   ? constants.CSV.DECIMAL_SEPARATOR 
                                   : ',';
            
            // Helper function to format numbers with proper rounding and decimal separator
            const formatNumber = (num) => {
                if (num === null || num === undefined) return null;
                // Round to 1 decimal place to avoid floating point precision issues
                const rounded = Math.round(num * 10) / 10;
                return rounded.toString().replace('.', decimalSeparator);
            };
            
            const record = {
                url: url,
                // PROD data
                prodTotalTime: prodData ? formatNumber(prodData.totalTime) : '',
                prodSystemTime: prodData ? formatNumber(prodData.systemTime) : '',
                prodQueriesTime: prodData ? formatNumber(prodData.queriesTime) : '',
                prodQueriesCount: prodData ? prodData.queriesCount : '',
                // DXP data
                dxpTotalTime: dxpData ? formatNumber(dxpData.totalTime) : '',
                dxpSystemTime: dxpData ? formatNumber(dxpData.systemTime) : '',
                dxpQueriesTime: dxpData ? formatNumber(dxpData.queriesTime) : '',
                dxpQueriesCount: dxpData ? dxpData.queriesCount : '',
                // Comparison metrics
                timeDifference: timeDifference !== null ? formatNumber(timeDifference) : '',
                timestamp: new Date().toISOString()
            };
            
            await this.csvWriter.writeRecords([record]);
            
        } catch (error) {
            console.error(`❌ Error saving comparison CSV record: ${error.message}`);
        }
    }

    getFilePath() {
        return this.csvFilePath;
    }
}

module.exports = CsvReporter;