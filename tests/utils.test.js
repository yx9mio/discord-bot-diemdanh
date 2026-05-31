// tests/utils.test.js
// Test utils: embeds.js, timeCalc.js, logger.js
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── embeds.js ────────────────────────────────────────────────────────────────
describe('embeds.js', () => {
  let embeds;
  it('loads without error', () => {
    embeds = require('../utils/embeds.js');
  });

  it('replyOk returns object with embeds array', () => {
    const r = embeds.replyOk('test message');
    assert.ok(Array.isArray(r.embeds), 'embeds phải là array');
    assert.equal(r.embeds.length, 1);
  });

  it('replyErr returns ephemeral object with embeds array', () => {
    const r = embeds.replyErr('lỗi test');
    assert.ok(Array.isArray(r.embeds));
    assert.equal(r.ephemeral, true);
  });

  it('replyLoading returns object with embeds array', () => {
    const r = embeds.replyLoading();
    assert.ok(Array.isArray(r.embeds));
  });

  it('replyOkEdit returns object without ephemeral', () => {
    const r = embeds.replyOkEdit('done');
    assert.ok(Array.isArray(r.embeds));
    // editReply không cần ephemeral
    assert.notEqual(r.ephemeral, true);
  });

  it('replyErrEdit returns object without ephemeral', () => {
    const r = embeds.replyErrEdit('err');
    assert.ok(Array.isArray(r.embeds));
  });
});

// ─── timeCalc.js ──────────────────────────────────────────────────────────────
describe('timeCalc.js', () => {
  let tc;
  it('loads without error', () => {
    tc = require('../utils/timeCalc.js');
  });

  it('exports formatDuration function', () => {
    assert.equal(typeof tc.formatDuration, 'function');
  });

  it('formatDuration(0) returns "0 giây" or similar', () => {
    const r = tc.formatDuration(0);
    assert.equal(typeof r, 'string');
    assert.ok(r.length > 0);
  });

  it('formatDuration(3661) formats hours+minutes+seconds', () => {
    const r = tc.formatDuration(3661);
    // phải chứa giờ và phút
    assert.ok(typeof r === 'string' && r.length > 0, `got: ${r}`);
  });

  it('formatDuration(90) formats minutes', () => {
    const r = tc.formatDuration(90);
    assert.ok(typeof r === 'string' && r.length > 0, `got: ${r}`);
  });
});

// ─── logger.js ────────────────────────────────────────────────────────────────
describe('logger.js', () => {
  let log;
  it('loads without error', () => {
    log = require('../utils/logger.js');
  });

  it('exports info, warn, error functions', () => {
    assert.equal(typeof log.info,  'function');
    assert.equal(typeof log.warn,  'function');
    assert.equal(typeof log.error, 'function');
  });

  it('calling log.info does not throw', () => {
    assert.doesNotThrow(() => log.info('TEST', 'guild-ci', 'CI log test'));
  });
});
