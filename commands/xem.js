'use strict';
const { Command } = require('@sapphire/framework');
const _orig = require('./xem._orig.js');
class XemCommand extends Command {
  constructor(context) { super(context, { name: _orig.data.name, description: _orig.data.description }); this._data = _orig.data; }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(this._data); }
  async chatInputRun(interaction) { return _orig.execute(interaction); }
}
module.exports = { XemCommand };
