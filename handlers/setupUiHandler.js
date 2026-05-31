// handlers/setupUiHandler.js — thin router, backward-compat re-export
// Logic đã chuyển vào handlers/setup/
'use strict';
const { handleSetupUi } = require('./setup/index.js');
const { buildDashboard } = require('./setup/dashboardHandler.js');
module.exports = { handleSetupUi, buildDashboard };
