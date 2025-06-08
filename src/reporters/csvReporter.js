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
        if (environmentOrMode === 'comparison') {
            filename = `${cleanDomain}-comparison-${currentDate}-${hours}${minutes}.csv`;
        } else {
            // Legacy single environment mode
            const environment = environmentOrMode ? 'dxp' : 'prod';
            filename = `${cleanDomain}-${environment}-${currentDate}-${hours}${minutes}.csv`;
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
        
        let headers;
        if (environmentOrMode === 'comparison') {
            headers = [
                { id: 'url', title: 'URL' },
                { id: 'environment', title: 'Environment' },
                { id: 'totalTime', title: 'Total Time (s)' },
                { id: 'systemTime', title: 'System Time (s)' },
                { id: 'queriesTime', title: 'Queries Time (s)' },
                { id: 'queriesCount', title: 'Queries Count' },
                { id: 'timestamp', title: 'Timestamp' }
            ];
        } else {
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
            
            const formattedRecord = {
                url: record.url,
                totalTime: record.totalTime ? record.totalTime.toString().replace('.', decimalSeparator) : null,
                systemTime: record.systemTime ? record.systemTime.toString().replace('.', decimalSeparator) : null,
                queriesTime: record.queriesTime ? record.queriesTime.toString().replace('.', decimalSeparator) : null,
                queriesCount: record.queriesCount,
                timestamp: record.timestamp
            };
            
            if (record.environment) {
                formattedRecord.environment = record.environment;
            }
            
            await this.csvWriter.writeRecords([formattedRecord]);
        } catch (error) {
            console.error(`❌ Error saving CSV record: ${error.message}`);
        }
    }

    getFilePath() {
        return this.csvFilePath;
    }
}

module.exports = CsvReporter;