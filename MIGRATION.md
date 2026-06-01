# Migration Log — JS → Sapphire JS

## Kiến trúc mới

```
index.js                    ← SapphireClient (thay Client thủ công)
commands/*.js               ← class Command extends Command (chatInputRun)
interaction-handlers/*.js   ← class InteractionHandler (buttons, selects, modals)
listeners/*.js              ← class Listener (events)
preconditions/AdminOnly.js  ← thay requireAdmin() thủ công
```

## Trạng thái

### Phase 1 — Infrastructure ✅
| File cũ | File mới | Trạng thái |
|---|---|---|
| `index.js` (Client thủ công) | `index.js` (SapphireClient) | ✅ Done |
| `events/ready.js` | `listeners/ready.js` | ✅ Done |
| `events/guildCreate.js` | `listeners/guildCreate.js` | ✅ Done |
| `events/messageDelete.js` | `listeners/messageDelete.js` | ✅ Done |
| `utils/errorHandler.js` | `listeners/commandError.js` + `listeners/interactionHandlerError.js` | ✅ Done |
| `utils/permissions.js` requireAdmin() | `preconditions/AdminOnly.js` | ✅ Done |
| `handlers/commandHandler.js` | Sapphire auto-scan `commands/` | ✅ Removed |
| `events/interactionCreate.js` | Sapphire auto-route | ✅ Removed |
| `package.json` | Thêm @sapphire/* packages | ✅ Done |

### Phase 2 — Commands ⏳
| File | Trạng thái |
|---|---|
| `commands/batdau.js` | ⏳ Pending |
| `commands/ketthuc.js` | ⏳ Pending |
| `commands/diemdanh.js` | ⏳ Pending |
| `commands/help.js` | ⏳ Pending |
| (remaining commands) | ⏳ Pending |

### Phase 3 — Interaction Handlers ⏳
| File | Trạng thái |
|---|---|
| `handlers/buttonHandler.js` + `handlers/button/` | ⏳ Pending |
| `handlers/setupUiHandler.js` + `handlers/setup/` | ⏳ Pending |
| `handlers/userPanelHandler.js` | ⏳ Pending |

## Template: Command

```js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits } = require('discord.js');

class TenCommand extends Command {
  constructor(context) {
    super(context, {
      name: 'ten',
      description: 'Mô tả lệnh',
      preconditions: ['AdminOnly'], // nếu cần admin
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('ten')
        .setDescription('Mô tả lệnh')
        // ...options
    );
  }

  // Paste logic execute() cũ vào đây — không cần thay gì bên trong
  async chatInputRun(interaction) {
    // logic cũ
  }
}

module.exports = { TenCommand };
```

## Template: InteractionHandler (button/select/modal)

```js
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');

class TenHandler extends InteractionHandler {
  constructor(context) {
    super(context, { interactionHandlerType: InteractionHandlerTypes.Button });
  }

  // Chỉ xử lý customId match — trả về null = skip
  parse(interaction) {
    if (!interaction.customId.startsWith('prefix:')) return this.none();
    return this.some();
  }

  async run(interaction) {
    // logic
  }
}

module.exports = { TenHandler };
```

## Cài đặt

```bash
npm install
npm run dev
```
