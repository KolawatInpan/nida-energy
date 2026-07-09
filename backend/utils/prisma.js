const { PrismaClient } = require('@prisma/client');
const { AsyncLocalStorage } = require('async_hooks');

const REAL_MODE = 'real';
const DEMO_MODE = 'demo';
const HEADER_NAME = 'x-data-mode';

const asyncLocalStorage = new AsyncLocalStorage();

function normalizeMode(value) {
  return String(value || '').toLowerCase() === DEMO_MODE ? DEMO_MODE : REAL_MODE;
}

const defaultMode = normalizeMode(process.env.DEFAULT_DATA_MODE);
const realDatabaseUrl = process.env.DATABASE_URL;
const demoDatabaseUrl = process.env.DATABASE_URL_DEMO || realDatabaseUrl;

const realPrisma = new PrismaClient({
  datasources: { db: { url: realDatabaseUrl } },
});

const demoPrisma = new PrismaClient({
  datasources: { db: { url: demoDatabaseUrl } },
});

// ============================================================
// TABLE ROUTING
// ============================================================
// Shared tables → always realPrisma (synced on write)
// Mode-specific tables → mode-dependent Prisma
// ============================================================

/** Tables that are shared across modes (always read from real, synced on write) */
const SHARED_TABLES = new Set([
  'user',
  'userCredential',
  'building',
  'meterInfo',
  'battery',
  'energyRateRule',
  'tokenRateRule',
  'notification',
  'activityLog',
]);

/** Tables that exist in both DBs but should be synced when written to shared */
const SYNC_ON_WRITE = new Set([
  'user',
  'userCredential',
  'building',
  'meterInfo',
]);

// ============================================================
// MODE HELPERS (must come before proxy)
// ============================================================

function getModeFromRequest(req) {
  return normalizeMode(req.headers[HEADER_NAME] || req.query.dataMode || defaultMode);
}

function getPrismaForMode(mode) {
  return normalizeMode(mode) === DEMO_MODE ? demoPrisma : realPrisma;
}

function runWithMode(mode, fn) {
  return asyncLocalStorage.run({ mode: normalizeMode(mode) }, fn);
}

function getCurrentMode() {
  return normalizeMode(asyncLocalStorage.getStore()?.mode || defaultMode);
}

function getCurrentPrisma() {
  return getPrismaForMode(getCurrentMode());
}

// ============================================================
// SYNC HELPERS
// ============================================================

/**
 * Smart sync: Real mode = write to both (real is source of truth).
 * Demo mode = write to demo ONLY (sandbox, no effect on real).
 */
async function syncWrite(table, method, args) {
  const mode = getCurrentMode();

  if (mode === DEMO_MODE) {
    // Demo mode: isolated sandbox — write ONLY to demo
    return await demoPrisma[table][method](args);
  }

  // Real mode: source of truth — write to real, then sync to demo
  const realResult = await realPrisma[table][method](args);
  try {
    await demoPrisma[table][method](args);
  } catch (err) {
    if (err.code !== 'P2025') {
      console.warn(`[prisma sync] demo.${table}.${method} failed:`, err.message);
    }
  }
  return realResult;
}

/**
 * Get the correct Prisma client for shared table reads.
 * Real mode → realPrisma | Demo mode → demoPrisma
 */
function getSharedPrisma() {
  return getCurrentMode() === DEMO_MODE ? demoPrisma : realPrisma;
}

// ============================================================
// PROXY
// ============================================================

const prisma = new Proxy({}, {
  get(_target, prop) {
    const table = String(prop);

    // Shared tables → mode-aware routing
    if (SHARED_TABLES.has(table)) {
      const delegate = getSharedPrisma()[table];

      // For synced tables: wrap delegate to intercept write methods
      if (SYNC_ON_WRITE.has(table)) {
        const writeMethods = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];
        return new Proxy(delegate, {
          get(delegateTarget, methodProp) {
            const method = String(methodProp);
            const original = delegateTarget[methodProp];
            if (writeMethods.includes(method) && typeof original === 'function') {
              return (...args) => syncWrite(table, method, args[0]);
            }
            return original;
          },
        });
      }

      return delegate;
    }

    // Mode-specific tables → mode-dependent Prisma
    const client = getCurrentPrisma();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

module.exports = {
  DEMO_MODE,
  HEADER_NAME,
  REAL_MODE,
  defaultMode,
  demoPrisma,
  getCurrentMode,
  getCurrentPrisma,
  getModeFromRequest,
  getPrismaForMode,
  normalizeMode,
  prisma,
  realPrisma,
  runWithMode,
};

