/**
 * Backup do banco de dados (PostgreSQL) com verificação, cópia e retenção.
 *
 * Configuração (.env):
 *   BACKUP_ENABLED=true            liga o backup automático diário
 *   BACKUP_DIR=./backups           pasta principal dos backups
 *   BACKUP_COPY_DIR=               segunda pasta (Google Drive/OneDrive/HD externo/rede)
 *   BACKUP_TIME=02:00              horário diário (fuso da empresa)
 *   BACKUP_KEEP_DAILY=7            quantos backups diários manter
 *   BACKUP_KEEP_WEEKLY=4           ... semanais
 *   BACKUP_KEEP_MONTHLY=12         ... mensais
 *   PG_BIN_DIR=                    pasta do pg_dump/pg_restore, se não estiverem no PATH
 *                                  (Windows: C:\Program Files\PostgreSQL\16\bin)
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pgToolConnection, missingTablesInListing } = require('../lib/pgConnection');
const { backupFileName, parseBackupName, planRetention } = require('../lib/backupRetention');

// Tabelas que obrigatoriamente precisam estar no backup
const REQUIRED_TABLES = ['users', 'clients', 'companies', 'addresses', 'service_orders', 'contracts', 'monthly_payments', 'equipments'];
const STATUS_FILE = 'backup-status.json';
const LOCK_FILE = '.backup.lock';
const STALE_LOCK_MS = 3 * 60 * 60 * 1000;

function config() {
  const int = (v, d) => (Number.isInteger(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);
  return {
    enabled: process.env.BACKUP_ENABLED === 'true',
    dir: path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups')),
    copyDir: process.env.BACKUP_COPY_DIR ? path.resolve(process.env.BACKUP_COPY_DIR) : null,
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(process.env.BACKUP_TIME || '') ? process.env.BACKUP_TIME : '02:00',
    keep: {
      daily: int(process.env.BACKUP_KEEP_DAILY, 7),
      weekly: int(process.env.BACKUP_KEEP_WEEKLY, 4),
      monthly: int(process.env.BACKUP_KEEP_MONTHLY, 12),
    },
    timeoutMs: int(process.env.BACKUP_TIMEOUT_MIN, 60) * 60 * 1000,
    binDir: process.env.PG_BIN_DIR || '',
  };
}

function tool(name, cfg) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  return cfg.binDir ? path.join(cfg.binDir, exe) : exe;
}

/** Executa uma ferramenta do PostgreSQL e devolve a saída; erro com mensagem amigável. */
function run(cmd, args, { env, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    let stdout = '';
    let child;
    try {
      child = spawn(cmd, args, { env: { ...process.env, ...env }, windowsHide: true });
    } catch (err) {
      reject(err);
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`O backup passou do tempo limite (${Math.round(timeoutMs / 60000)} min) e foi interrompido.`));
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            `Programa "${path.basename(cmd)}" não encontrado. Instale as ferramentas do PostgreSQL ` +
              'ou defina PG_BIN_DIR no .env com a pasta onde ele está.'
          )
        );
      } else reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else {
        const detail = stderr.trim().split('\n').slice(-3).join(' ').slice(0, 500);
        reject(new Error(`${path.basename(cmd)} terminou com erro (código ${code}): ${detail || 'sem detalhes'}`));
      }
    });
  });
}

async function readStatus(dir = config().dir) {
  try {
    return JSON.parse(await fsp.readFile(path.join(dir, STATUS_FILE), 'utf8'));
  } catch {
    return { lastSuccess: null, lastAttempt: null };
  }
}

async function writeStatus(dir, status) {
  const tmp = path.join(dir, `${STATUS_FILE}.tmp`);
  await fsp.writeFile(tmp, JSON.stringify(status, null, 2));
  await fsp.rename(tmp, path.join(dir, STATUS_FILE));
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (d) => hash.update(d))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

async function acquireLock(dir) {
  const lock = path.join(dir, LOCK_FILE);
  try {
    const fh = await fsp.open(lock, 'wx');
    await fh.writeFile(String(process.pid));
    await fh.close();
    return lock;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    const stat = await fsp.stat(lock).catch(() => null);
    if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
      await fsp.rm(lock, { force: true }); // trava esquecida por uma queda do servidor
      return acquireLock(dir);
    }
    const busy = new Error('Já existe um backup em andamento.');
    busy.code = 'BACKUP_BUSY';
    throw busy;
  }
}

async function applyRetention(dir, keep) {
  const names = await fsp.readdir(dir);
  const plan = planRetention(names, keep);
  for (const name of plan.remove) await fsp.rm(path.join(dir, name), { force: true });
  return plan.remove.length;
}

/**
 * Faz um backup completo.
 * @param {{ reason?: 'agendado'|'manual'|'linha de comando', userName?: string }} opts
 */
async function runBackup({ reason = 'manual', userName } = {}) {
  const cfg = config();
  await fsp.mkdir(cfg.dir, { recursive: true });
  const lock = await acquireLock(cfg.dir);
  const startedAt = new Date();
  const status = await readStatus(cfg.dir);
  const name = backupFileName(startedAt);
  const finalPath = path.join(cfg.dir, name);
  const tmpPath = `${finalPath}.partial`;

  try {
    const conn = pgToolConnection(process.env.DATABASE_URL);
    const dumpArgs = ['--format=custom', '--no-owner', '--no-privileges', '--file', tmpPath];
    if (conn.schema) dumpArgs.push('--schema', conn.schema);
    dumpArgs.push('--dbname', conn.connectionString);
    await run(tool('pg_dump', cfg), dumpArgs, { env: conn.env, timeoutMs: cfg.timeoutMs });

    // Verificação: o arquivo precisa ser um backup legível e conter as tabelas do sistema
    const listing = await run(tool('pg_restore', cfg), ['--list', tmpPath], { env: {}, timeoutMs: 10 * 60 * 1000 });
    const missing = missingTablesInListing(listing, REQUIRED_TABLES);
    if (missing.length) {
      throw new Error(`Verificação falhou: tabela(s) ausente(s) no backup: ${missing.join(', ')}.`);
    }

    await fsp.rename(tmpPath, finalPath);
    const { size } = await fsp.stat(finalPath);
    const checksum = await sha256(finalPath);

    let copied = null;
    let copyError = null;
    if (cfg.copyDir) {
      try {
        await fsp.mkdir(cfg.copyDir, { recursive: true });
        const copyPath = path.join(cfg.copyDir, name);
        await fsp.copyFile(finalPath, `${copyPath}.partial`);
        const copyStat = await fsp.stat(`${copyPath}.partial`);
        if (copyStat.size !== size) throw new Error('a cópia ficou com tamanho diferente do original');
        await fsp.rename(`${copyPath}.partial`, copyPath);
        await applyRetention(cfg.copyDir, cfg.keep);
        copied = copyPath;
      } catch (err) {
        copyError = `Backup feito, mas a cópia para a segunda pasta falhou: ${err.message}`;
      }
    }

    const removed = await applyRetention(cfg.dir, cfg.keep);
    const result = {
      file: name,
      at: new Date().toISOString(),
      size,
      sha256: checksum,
      durationMs: Date.now() - startedAt.getTime(),
      database: conn.safeLabel,
      copied,
      removedOld: removed,
      reason,
      by: userName || null,
    };
    status.lastSuccess = result;
    status.lastAttempt = { at: result.at, ok: !copyError, error: copyError, reason };
    await writeStatus(cfg.dir, status);
    if (copyError) console.warn(`[backup] ${copyError}`);
    console.log(`[backup] ${name} (${Math.round(size / 1024)} KB) em ${Math.round(result.durationMs / 1000)} s`);
    return { ...result, warning: copyError };
  } catch (err) {
    await fsp.rm(tmpPath, { force: true });
    status.lastAttempt = { at: new Date().toISOString(), ok: false, error: err.message, reason };
    await writeStatus(cfg.dir, status).catch(() => {});
    console.error(`[backup] falhou: ${err.message}`);
    throw err;
  } finally {
    await fsp.rm(lock, { force: true });
  }
}

/** Backups existentes na pasta principal (mais recente primeiro). */
async function listBackups() {
  const cfg = config();
  let names = [];
  try {
    names = await fsp.readdir(cfg.dir);
  } catch {
    return [];
  }
  const files = [];
  for (const name of names) {
    const info = parseBackupName(name);
    if (!info) continue;
    const stat = await fsp.stat(path.join(cfg.dir, name)).catch(() => null);
    if (stat) files.push({ file: name, size: stat.size, createdAt: stat.mtime.toISOString() });
  }
  return files.sort((a, b) => (a.file < b.file ? 1 : -1));
}

/** Situação para a tela e para os alertas. */
async function backupOverview() {
  const cfg = config();
  const status = await readStatus(cfg.dir);
  const lastSuccessAt = status.lastSuccess ? new Date(status.lastSuccess.at) : null;
  const hoursSinceSuccess = lastSuccessAt ? (Date.now() - lastSuccessAt.getTime()) / 3600000 : null;
  return {
    enabled: cfg.enabled,
    time: cfg.time,
    dir: cfg.dir,
    copyDir: cfg.copyDir,
    keep: cfg.keep,
    lastSuccess: status.lastSuccess,
    lastAttempt: status.lastAttempt,
    hoursSinceSuccess: hoursSinceSuccess === null ? null : Math.round(hoursSinceSuccess * 10) / 10,
    files: await listBackups(),
  };
}

module.exports = { runBackup, listBackups, backupOverview, readStatus, config };
