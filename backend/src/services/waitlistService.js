const { ensureJsonFile, readJson, writeJson } = require('../storage/jsonStore')

function sanitizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\x20-\x7e]/g, '')
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function createWaitlistService({ waitlistFile }) {
  async function bootstrap() {
    await ensureJsonFile(waitlistFile, [])
  }

  async function signup(emailInput) {
    const email = sanitizeEmail(emailInput)
    if (!isValidEmail(email)) {
      return { ok: false, error: 'Invalid email format.' }
    }

    const rows = await readJson(waitlistFile, [])
    rows.push({
      email,
      createdAt: new Date().toISOString(),
    })

    await writeJson(waitlistFile, rows)
    return { ok: true }
  }

  return {
    bootstrap,
    signup,
  }
}

module.exports = {
  createWaitlistService,
}
