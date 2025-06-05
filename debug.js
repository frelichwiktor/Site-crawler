// Debug script to figure out the config issue
// Run from project root: node debug-config.js

console.log('🔍 Debugging config issue...\n');

// Check which config is being used
try {
    const oldConfig = require('./config.js');
    console.log('✅ Old config.js exists in root');
    console.log('   directories:', JSON.stringify(oldConfig.directories, null, 2));
    
    if (oldConfig.directories && oldConfig.directories.reports) {
        console.log('   directories.reports type:', typeof oldConfig.directories.reports);
        console.log('   directories.reports value:', oldConfig.directories.reports);
    }
} catch (e) {
    console.log('❌ Old config.js not found in root');
}

console.log('\n');

try {
    const newConfig = require('./src/config');
    console.log('✅ New config exists in src/config/');
    console.log('   directories:', JSON.stringify(newConfig.directories, null, 2));
    
    if (newConfig.directories) {
        console.log('   directories.reports type:', typeof newConfig.directories.reports);
        console.log('   directories.reportsDir:', newConfig.directories.reportsDir);
    }
    
    if (newConfig.constants) {
        console.log('   ✅ Constants are available');
    } else {
        console.log('   ❌ Constants not found in config');
    }
} catch (e) {
    console.log('❌ New config not found:', e.message);
}

console.log('\n🔧 Testing CSV Reporter...\n');

try {
    const CsvReporter = require('./src/reporters/csvReporter');
    const reporter = new CsvReporter();
    console.log('✅ CsvReporter loads successfully');
    
    // Test initialization
    reporter.initialize('test-domain.com', true).then(() => {
        console.log('✅ CsvReporter initializes successfully');
    }).catch(err => {
        console.log('❌ CsvReporter initialization failed:', err.message);
    });
} catch (e) {
    console.log('❌ Failed to load CsvReporter:', e.message);
}

console.log('\n💡 Solution:');
console.log('The updated csvReporter.js should now work with both old and new config structures.');
console.log('If you still have issues, make sure to save the updated csvReporter.js file.');