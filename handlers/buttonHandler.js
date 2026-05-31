// handlers/buttonHandler.js — thin router, backward-compat re-export
// Logic đã chuyển vào handlers/button/
'use strict';
const { handleButton } = require('./button/index.js');
module.exports = { handleButton };
