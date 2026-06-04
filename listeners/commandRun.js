'use strict';
// listeners/commandRun.js
// [Phase C] Emit metrics.commandCalled() cho mọi slash command thành công
const { Listener, Events } = require('@sapphire/framework');
const metrics = require('../utils/metrics.js');

class CommandRunListener extends Listener {
  constructor(context) { super(context, { event: Events.ChatInputCommandRun }); }
  run(_result, { interaction }) {
    const commandName = interaction?.commandName ?? 'unknown';
    const guildId = interaction?.guildId ?? 'unknown';
    metrics.commandCalled(commandName, guildId);
  }
}
module.exports = { CommandRunListener };
