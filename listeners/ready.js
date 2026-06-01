// listeners/ready.js
'use strict';
const { Listener, Events } = require('@sapphire/framework');

class ReadyListener extends Listener {
  constructor(context) {
    super(context, { event: Events.ClientReady, once: true });
  }

  run(client) {
    this.container.logger.info(
      `[Ready] Đăng nhập thành công: ${client.user.tag} · ${client.guilds.cache.size} server(s)`
    );
  }
}

module.exports = { ReadyListener };
