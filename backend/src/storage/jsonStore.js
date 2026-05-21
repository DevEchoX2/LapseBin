const fs = require('fs/promises')
const path = require('path')

async function ensureJsonFile(filePath, fallbackValue) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  try {
    await fs.access(filePath)
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(fallbackValue, null, 2)}\n`, 'utf8')
  }
}

async function readJson(filePath, fallbackValue) {
  await ensureJsonFile(filePath, fallbackValue)
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

module.exports = {
  ensureJsonFile,
  readJson,
  writeJson,
}
