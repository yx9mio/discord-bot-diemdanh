'use strict';
// listeners/commandTracingStart.js
// Bắt đầu transaction span cho mỗi slash command khi bắt đầu chạy.
const { Listener, Events } = require('@sapphire/framework');
const tracing = require('../../utils/tracing.js');

class CommandTracingStartListener extends Listener {
  constructor(context) { super(context, { event: Events.PreChatInputCommandRun }); }
  run(interaction) {
    tracing.begin(interaction);
  }
}
module.exports = { CommandTracingStartListener };
