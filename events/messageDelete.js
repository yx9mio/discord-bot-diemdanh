// events/messageDelete.js
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');

async function onMessageDelete(client, message) {
  if (!message.guild) return;
  try {
    const session = await db.getActiveSession(message.guild.id);
    if (!session || session.message_id !== message.id) return;

    const attended = await db.getAttendances(session.id);
    const embed    = await buildSessionEmbed(message.guild, session, attended);
    const newMsg   = await message.channel.send({
      embeds: [embed],
      components: [buildAttendanceButtons(false)],
    });
    await db.updateSessionMessageId(session.id, newMsg.id);
  } catch (_) {}
}

module.exports = { onMessageDelete };
