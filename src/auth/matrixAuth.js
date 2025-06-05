const config = require('../config');
const { constants } = config;
const readline = require('readline');
const path = require('path');

class MatrixAuth {
    constructor() {
        this.credentials = null;
    }

    async loadCredentials() {
        console.log("🔑 Loading credentials...");
        
        try {
            this.credentials = require('../../credentials.js');
            console.log("✅ Credentials loaded from file");
            return this.credentials;
        } catch (error) {
            console.log("⚠️ credentials.js not found or invalid");
            console.log("ℹ️ Please create credentials.js based on credentials.sample.js");
            
            const username = await this.askQuestion("Enter username for Matrix: ");
            const password = await this.askQuestion("Enter password for Matrix: ");
            
            this.credentials = {
                matrix: {
                    username,
                    password
                }
            };
            
            return this.credentials;
        }
    }

    async login(page, isDxpVersion = true) {
        console.log("🔑 Attempting to log into Matrix...");
        
        if (!this.credentials) {
            throw new Error("Credentials not loaded. Call loadCredentials() first.");
        }
        
        try {
            await page.goto(config.pageUrls.matrix, { waitUntil: 'domcontentloaded' });
            
            if (isDxpVersion) {
                console.log("🧪 Performing DXP version check...");
                const versionCheckElement = await page.waitForSelector(constants.SELECTORS.DXP_MARKERS);
                const versionCheck = versionCheckElement ? await versionCheckElement.textContent() : null;
                
                if (!versionCheck || 
                    (!versionCheck.includes(constants.DXP_VERSIONS.MATRIX_DXP) && 
                     !versionCheck.includes(constants.DXP_VERSIONS.DXP_SAAS))) {
                    throw new Error("❌ Verification failed: Not on the correct DXP version (Matrix DXP or DXP SaaS)");
                }
                
                console.log("✅ Verification passed: Correct DXP version detected");
            } else {
                console.log("🚫 Skipping DXP version check (PROD mode)");
            }
            
            await page.fill(constants.SELECTORS.USERNAME_INPUT, this.credentials.matrix.username);
            await page.fill(constants.SELECTORS.PASSWORD_INPUT, this.credentials.matrix.password);
            
            await page.click(constants.SELECTORS.LOGIN_BUTTON);
            
            await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
            
            console.log("✅ Successfully logged into Matrix!");
            return true;
        } catch (error) {
            console.error("❌ Failed to log into Matrix:", error);
            return false;
        }
    }

    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise(resolve => rl.question(query, answer => {
            rl.close();
            resolve(answer.trim());
        }));
    }
}

module.exports = MatrixAuth;