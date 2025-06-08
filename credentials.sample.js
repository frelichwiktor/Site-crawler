// You need to change the name of this file to 'credentials.js' (or create a separate 'credentials.js' file).
// Copy this module.exports to 'credentials.js' and update with real credentials
module.exports = {
    prod: {
        username: "your_prod_username_here",
        password: "your_prod_password_here"
    },
    dxp: {
        username: "your_dxp_username_here", 
        password: "your_dxp_password_here"
    }
    
    // Note: If PROD and DXP use the same credentials, just duplicate them above
    // The crawler will automatically use the right credentials based on your selected mode:
    // - Mode 1 (PROD only) → uses 'prod' credentials
    // - Mode 2 (DXP only) → uses 'dxp' credentials  
    // - Mode 3 (Comparison) → uses both 'prod' and 'dxp' credentials
};