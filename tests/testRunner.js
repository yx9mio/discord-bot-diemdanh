'use strict';

/**
 * TestRunner — chạy một suite, ghi nhận kết quả.
 *
 * Suite = async function(guildId, client) trả về Array<TestResult>:
 *   { name, passed, error?, durationMs }
 */
async function runSuite(label, suiteFn, guildId, client) {
  const start = Date.now();
  let results = [];
  try {
    results = await suiteFn(guildId, client);
  } catch (err) {
    // Suite-level fatal error (không phải test-level)
    results = [{ name: `[FATAL] ${label}`, passed: false, error: err.message, durationMs: 0 }];
  }
  const total    = results.length;
  const passed   = results.filter(r => r.passed).length;
  const duration = Date.now() - start;
  return { label, results, passed, total, duration };
}

/**
 * Helper để viết test case đơn lẻ trong suite.
 * Usage:
 *   const r = await test('Tên test', async () => {
 *     const data = await someDbCall();
 *     if (!data) throw new Error('không có data');
 *   });
 */
async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    return { name, passed: true, durationMs: Date.now() - start };
  } catch (err) {
    return { name, passed: false, error: err.message, durationMs: Date.now() - start };
  }
}

/**
 * buildEmbed — tạo Discord embed từ kết quả các suite.
 */
function buildEmbed(suiteResults, totalDurationMs) {
  const grandTotal  = suiteResults.reduce((a, s) => a + s.total, 0);
  const grandPassed = suiteResults.reduce((a, s) => a + s.passed, 0);
  const allPassed   = grandPassed === grandTotal;

  const COLOR_OK   = 0x43b581; // xanh Discord
  const COLOR_FAIL = 0xf04747; // đỏ Discord

  const fields = suiteResults.map(suite => {
    const icon   = suite.passed === suite.total ? '✅' : '❌';
    const header = `${icon} ${suite.label} — ${suite.passed}/${suite.total} (${suite.duration}ms)`;
    const lines  = suite.results.map(r => {
      if (r.passed) return `  ✓ ${r.name} (${r.durationMs}ms)`;
      return `  ✗ ${r.name}\n    └ ${r.error ?? 'unknown error'}`;
    });
    return { name: header, value: lines.join('\n') || '—', inline: false };
  });

  return {
    color: allPassed ? COLOR_OK : COLOR_FAIL,
    title: `🤖 Test Bot Report — ${grandPassed}/${grandTotal} passed ${allPassed ? '✅' : '❌'}`,
    fields,
    footer: { text: `Tổng thời gian: ${totalDurationMs}ms` },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { runSuite, test, buildEmbed };
