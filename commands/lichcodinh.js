// commands/lichcodinh.js — giữ nguyên logic, chỉ wrap Sapphire
'use strict';
const { Command } = require('@sapphire/framework');
const { readFileSync } = require('fs');
// Đọc nội dung gốc để tái sử dụng execute logic
const _orig = require('./lichcodinh._orig.js');

class LichCoDinhCommand extends Command {
  constructor(context) {
    super(context, { name: _orig.data.name, description: _orig.data.description, preconditions: ['AdminOnly'] });
    this._data = _orig.data;
  }
  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(this._data);
  }
  async chatInputRun(interaction) {
    return _orig.execute(interaction);
  }
}
module.exports = { LichCoDinhCommand };
