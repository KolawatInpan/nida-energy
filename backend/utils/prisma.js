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
  datasources: {
    db: { url: realDatabaseUrl },
  },
});

const demoPrisma = new PrismaClient({
  datasources: {
    db: { url: demoDatabaseUrl },
  },
});

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

const prisma = new Proxy({}, {
  get(_target, prop) {
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
  getCurrentMode,
  getCurrentPrisma,
  getModeFromRequest,
  getPrismaForMode,
  normalizeMode,
  prisma,
  runWithMode,
};

