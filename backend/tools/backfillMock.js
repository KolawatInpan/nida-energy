#!/usr/bin/env node
/**
 * backfillMock.js
 * Usage:
 *  node tools/backfillMock.js --start=2026-01-01T00:00:00Z [--end=2026-05-19T15:00:00Z] [--delayMs=500]
 *
 * This script calls the server-side generateHourlyEntries() for each meter where isAutoMock=true.
 * It runs sequentially per meter to avoid overloading the DB.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  });
  return args;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async function main() {
  try {
    const args = parseArgs();
    const startArg = args.start;
    if (!startArg) {
      console.error('Missing --start argument (ISO timestamp)');
      process.exit(2);
    }
    const start = new Date(startArg);
    if (isNaN(start)) {
      console.error('Invalid --start date');
      process.exit(2);
    }

    const end = args.end ? new Date(args.end) : new Date();
    if (isNaN(end)) {
      console.error('Invalid --end date');
      process.exit(2);
    }
    // round end down to hour boundary
    end.setMinutes(0,0,0);

    const delayMs = args.delayMs ? parseInt(args.delayMs,10) : 500;

    // require app modules (assumes script runs from /app inside container or project root)
    const prismaPath = path.resolve(__dirname, '../utils/prisma');
    const runningModelPath = path.resolve(__dirname, '../features/energy/runningMeter.model');
    const { prisma } = require(prismaPath);
    const RunningMeter = require(runningModelPath);

    console.log(`Backfill start=${start.toISOString()} end=${end.toISOString()} delayMs=${delayMs}`);

    // prepare status file
    const tmpDir = path.resolve(__dirname, '../tmp');
    try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (e) {}
    const statusFile = path.join(tmpDir, `backfill-status-${process.pid}.json`);
    function writeStatus(obj) {
      try {
        const tmpFile = `${statusFile}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(obj, null, 2));
        try { fs.renameSync(tmpFile, statusFile); } catch (e) { fs.writeFileSync(statusFile, JSON.stringify(obj, null, 2)); }
      } catch (e) {
        // ignore
      }
    }

    const status = {
      pid: process.pid,
      start: start.toISOString(),
      end: end.toISOString(),
      delayMs,
      totalMeters: 0,
      processedMeters: 0,
      currentMeter: null,
      perMeter: [],
      startedAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      completed: false,
      error: null
    };
    writeStatus(status);

    const meters = await prisma.meterInfo.findMany({ where: { isAutoMock: true }, select: { snid: true } });
    if (!meters || meters.length === 0) {
      console.log('No meters with isAutoMock=true found. Exiting.');
      status.completed = true;
      status.lastUpdate = new Date().toISOString();
      writeStatus(status);
      process.exit(0);
    }

    console.log(`Found ${meters.length} meters to backfill.`);
    status.totalMeters = meters.length;
    status.lastUpdate = new Date().toISOString();
    writeStatus(status);

    for (const m of meters) {
      const snid = m.snid;
      console.log(`Processing meter ${snid} ...`);
      status.currentMeter = snid;
      status.lastUpdate = new Date().toISOString();
      writeStatus(status);
      try {
        const res = await RunningMeter.generateHourlyEntries(snid, start.toISOString(), end.toISOString(), { intervalHours: 1, valueProfile: 'sinusoidal', startingKwh: 1000 });
        console.log(` -> Completed ${snid}: ${JSON.stringify(res)}`);
        status.perMeter.push({ snid, result: res });
        status.processedMeters += 1;
        status.lastUpdate = new Date().toISOString();
        writeStatus(status);
      } catch (err) {
        console.error(` -> Error for ${snid}:`, err?.message || err);
        status.perMeter.push({ snid, error: String(err?.message || err) });
        status.error = status.error || [];
        status.error.push({ snid, message: String(err?.message || err) });
        status.lastUpdate = new Date().toISOString();
        writeStatus(status);
      }
      await sleep(delayMs);
    }

    console.log('Backfill completed for all meters.');
    status.completed = true;
    status.completedAt = new Date().toISOString();
    status.lastUpdate = new Date().toISOString();
    writeStatus(status);
    process.exit(0);
  } catch (err) {
    console.error('Backfill script failed:', err);
    try {
      const tmpDir = path.resolve(__dirname, '../tmp');
      const statusFile = path.join(tmpDir, `backfill-status-${process.pid}.json`);
      fs.writeFileSync(statusFile, JSON.stringify({ pid: process.pid, error: String(err), lastUpdate: new Date().toISOString() }));
    } catch (e) {}
    process.exit(1);
  }
})();
