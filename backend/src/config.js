const path = require('path')

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data')

module.exports = {
  PORT: Number(process.env.PORT || 5000),
  SESSION_DURATION_MS: 50 * 60 * 1000,
  CONNECT_TOKEN_TTL_MS: 2 * 60 * 1000,
  DATA_DIR,
  WAITLIST_FILE: process.env.WAITLIST_FILE || path.join(DATA_DIR, 'waitlist.json'),
  INSTANCE_POOL_FILE: process.env.INSTANCE_POOL_FILE || path.join(DATA_DIR, 'instance-pool.json'),
  SESSION_LOG_FILE: process.env.SESSION_LOG_FILE || path.join(DATA_DIR, 'session-log.json'),
}
