'use strict';
// listeners/commandTracingEnd.js
// Kết thúc transaction span khi command hoàn thành (thành công hoặc lỗi).
// Lỗi thật sự được đánh dấu 'error' trong commandError listener trước khi
// event Finish này chạy — finish() idempotent nên không bị double-end.
const { Listener, Events } = require('@sapphire/framework');
const tracing = require('../../utils/tracing.js');

class CommandTracingEndListener extends Listener {
  constructor(context) { super(context, { event: Events.ChatInputCommandFinish }); }
  run(interaction) {
    tracing.finish(interaction, 'ok');
  }
}
module.exports = { CommandTracingEndListener };
