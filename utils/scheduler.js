'use strict';
// utils/scheduler.js
const db  = require('../db.js');
const log = require('./logger.js');
const metrics = require('./metrics.js'); // [Phase C]
const { msToNextWeekday, msFromOpenToClose, msToCloseFromNow } = require('./timeCalc.js');
const { buildSessionEmbed, buildSessionActionRow, buildSummaryEmbed, buildClosedSessionEmbed } = require('./embeds.js');
const { ketThucPhien, thongBaoHuyHieu, guiCsvDinhKem } = require('./session.js');
const { LichSchema, safeParse } = require('./validate.js');
