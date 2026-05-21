const { readJson, writeJson, ensureJsonFile } = require('../storage/jsonStore')

const defaultPool = [
  {
    id: 'worker-01',
    name: 'GPU Node A',
    host: 'worker-01.internal',
    signalingEndpoint: 'wss://worker-01.example.com/signal',
    status: 'idle',
    tenantSessionId: null,
  },
  {
    id: 'worker-02',
    name: 'GPU Node B',
    host: 'worker-02.internal',
    signalingEndpoint: 'wss://worker-02.example.com/signal',
    status: 'idle',
    tenantSessionId: null,
  },
  {
    id: 'worker-03',
    name: 'Desktop Node',
    host: 'worker-03.internal',
    signalingEndpoint: 'wss://worker-03.example.com/signal',
    status: 'idle',
    tenantSessionId: null,
  },
]

function createInstancePoolService({ instancePoolFile }) {
  async function bootstrap() {
    await ensureJsonFile(instancePoolFile, defaultPool)
  }

  async function list() {
    return readJson(instancePoolFile, defaultPool)
  }

  async function claimIdleInstance(sessionId) {
    const pool = await list()
    const index = pool.findIndex((instance) => instance.status === 'idle')
    if (index < 0) {
      return null
    }

    const claimed = {
      ...pool[index],
      status: 'busy',
      tenantSessionId: sessionId,
      claimedAt: new Date().toISOString(),
    }

    pool[index] = claimed
    await writeJson(instancePoolFile, pool)
    return claimed
  }

  async function markProvisioning(instanceId) {
    const pool = await list()
    const index = pool.findIndex((instance) => instance.id === instanceId)
    if (index < 0) {
      return null
    }

    pool[index] = {
      ...pool[index],
      status: 'provisioning',
      provisioningAt: new Date().toISOString(),
    }

    await writeJson(instancePoolFile, pool)
    return pool[index]
  }

  async function releaseInstance(instanceId) {
    const pool = await list()
    const index = pool.findIndex((instance) => instance.id === instanceId)
    if (index < 0) {
      return null
    }

    pool[index] = {
      ...pool[index],
      status: 'idle',
      tenantSessionId: null,
      claimedAt: null,
      provisioningAt: null,
      lastResetAt: new Date().toISOString(),
    }

    await writeJson(instancePoolFile, pool)
    return pool[index]
  }

  async function getById(instanceId) {
    const pool = await list()
    return pool.find((instance) => instance.id === instanceId) || null
  }

  return {
    bootstrap,
    list,
    claimIdleInstance,
    markProvisioning,
    releaseInstance,
    getById,
  }
}

module.exports = {
  createInstancePoolService,
}
