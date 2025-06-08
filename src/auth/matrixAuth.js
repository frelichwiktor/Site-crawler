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
            const loadedCredentials = require('../../credentials.js');
            
            if (!loadedCredentials.prod && !loadedCredentials.dxp) {
                throw new Error("Invalid credential structure - missing 'prod' and 'dxp' sections");
            }
            
            return loadedCredentials;
            
        } catch (error) {
            console.log("⚠️ credentials.js not found or invalid");
            console.log("ℹ️ Please create credentials.js based on credentials.sample.js");
            
            const environment = await this.askQuestion("Which environment do you want to configure? (prod/dxp): ");
            const username = await this.askQuestion(`Enter username for ${environment.toUpperCase()}: `);
            const password = await this.askQuestion(`Enter password for ${environment.toUpperCase()}: `);
            
            const fallbackCredentials = {
                prod: environment === 'prod' ? { username, password } : { username: '', password: '' },
                dxp: environment === 'dxp' ? { username, password } : { username: '', password: '' }
            };
            
            return fallbackCredentials;
        }
    }

    async login(page, isDxpVersion = true) {
        if (!this.credentials) {
            throw new Error("Credentials not loaded. Call loadCredentials() first.");
        }
        
        let username, password;
        
        if (this.credentials.matrix) {
            username = this.credentials.matrix.username;
            password = this.credentials.matrix.password;
        } else {
            throw new Error("Invalid credentials structure - missing 'matrix' section");
        }
        
        if (!username || !password) {
            throw new Error("Missing username or password in credentials");
        }
        
        try {
            await page.goto(config.pageUrls.matrix, { waitUntil: 'domcontentloaded' });
            
            if (isDxpVersion) {
                try {
                    const versionCheckElement = await page.waitForSelector(constants.SELECTORS.DXP_MARKERS, { timeout: 10000 });
                    const versionCheck = versionCheckElement ? await versionCheckElement.textContent() : null;
                    
                    if (!versionCheck || 
                        (!versionCheck.includes(constants.DXP_VERSIONS.MATRIX_DXP) && 
                         !versionCheck.includes(constants.DXP_VERSIONS.DXP_SAAS))) {
                        throw new Error("❌ Verification failed: Not on the correct DXP version (Matrix DXP or DXP SaaS)");
                    }
                } catch (versionError) {
                    if (versionError.message.includes('Verification failed')) {
                        throw versionError;
                    }
                }
            }
            
            // Fill in login form
            await page.waitForSelector(constants.SELECTORS.USERNAME_INPUT, { timeout: 10000 });
            await page.waitForSelector(constants.SELECTORS.PASSWORD_INPUT, { timeout: 10000 });
            
            await page.fill(constants.SELECTORS.USERNAME_INPUT, '');
            await page.fill(constants.SELECTORS.USERNAME_INPUT, username);
            
            await page.fill(constants.SELECTORS.PASSWORD_INPUT, '');
            await page.fill(constants.SELECTORS.PASSWORD_INPUT, password);
            
            await page.click(constants.SELECTORS.LOGIN_BUTTON);
            
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
            
            console.log("✅ Login successful");
            return true;
            
        } catch (error) {
            console.error("❌ Login failed:", error.message);
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