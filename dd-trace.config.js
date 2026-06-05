// dd-trace.config.js — Datadog tracer config
// Được load qua: node --require dd-trace/init (xem package.json scripts)
// File này export config cho dd-trace/init tự đọc qua DD_TRACE_* env vars
// Ref: https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
'use strict';

// dd-trace/init tự đọc các DD_* env vars — không cần gọi tracer.init() thủ công.
// Các env vars cần set trên Railway:
//   DD_API_KEY         — Datadog API key
//   DD_SITE            — vd: ap1.datadoghq.com
//   DD_SERVICE         — discord-bot-diemdanh
//   DD_ENV             — production
//   DD_VERSION         — version bot (tùy chọn)
//   DD_TRACE_ENABLED   — true/false (mặc định true)
//   DD_LOG_INJECTION   — true  → inject trace_id/span_id vào pino logs
//   DD_RUNTIME_METRICS_ENABLED — true
//   DD_DOGSTATSD_PORT  — bỏ trống (Railway không có DD Agent)

// Không có code ở đây — config hoàn toàn qua env vars.
// File này chỉ để document các biến cần thiết.
module.exports = {};
