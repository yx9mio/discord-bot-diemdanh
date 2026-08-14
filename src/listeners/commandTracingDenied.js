'use strict';
// listeners/commandTracingDenied.js
// Precondition deny (thiếu quyền, nhịp độ...) → kết thúc span với trạng thái error.
const { Listener, Events } = require('@sapphire/framework');
const tracing = require('../../utils/tracing.js');

class CommandTracingDeniedListener extends Listener {
  constructor(context) { super(context, { event: Events.ChatInputCommandDenied }); }
  run(_error, { interaction }) {
    tracing.finish(interaction, 'error');
  }
}
module.exports = { CommandTracingDeniedListener };
