'use strict';
const { Command } = require('@sapphire/framework');
const _orig = require('./thongke_server._orig.js');
class ThongKeServerCommand extends Command {
  constructor(context) { super(context, { name: _orig.data.name, description: _orig.data.description, preconditions: ['AdminOnly'] }); this._data = _orig.data; }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(this._data); }
  async chatInputRun(interaction) { return _orig.execute(interaction); }
}
module.exports = { ThongKeServerCommand };
