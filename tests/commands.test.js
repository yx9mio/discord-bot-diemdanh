// tests/commands.test.js
// Kiểm tra contract của mỗi command:
//   - Load được (không throw MODULE_NOT_FOUND)
//   - export { data, execute }
//   - data.name là string không rỗng
//   - execute là function
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
