/**
 * Backup automático diário.
 * A cada 10 minutos verifica se já passou do horário (BACKUP_TIME, fuso da
 * empresa) e se o backup de hoje ainda não foi feito. Assim, se o servidor
 * estava desligado no horário, o backup acontece assim que ele voltar.
 * Em caso de falha, tenta de novo a cada hora (e o Dashboard mostra um alerta).
 */
const { runBackup, readStatus, config } = require('../services/backupService');
const { zonedParts } = require('../lib/dates');

const CHECK_EVERY_MS = 10 * 60 * 1000;
const RETRY_AFTER_MS = 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

function dayKey(instant) {
  const p = zonedParts(instant);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Decide se é hora de fazer o backup (função pura, testada). */
function isBackupDue({ now, time, lastSuccessAt, lastAttemptAt, lastAttemptOk }) {
  const p = zonedParts(now);
  const current = `${pad(p.hour)}:${pad(p.minute)}`;
  if (current < time) return false;
  if (lastSuccessAt && dayKey(new Date(lastSuccessAt)) === dayKey(now)) return false;
  if (lastAttemptAt && lastAttemptOk === false && now - new Date(lastAttemptAt) < RETRY_AFTER_MS) return false;
  return true;
}

function startBackupJob() {
  const cfg = config();
  if (!cfg.enabled) {
    console.log('[backup] backup automático DESATIVADO (defina BACKUP_ENABLED=true no .env).');
    return null;
  }
  console.log(`[backup] backup automático diário às ${cfg.time} em ${cfg.dir}${cfg.copyDir ? ` (cópia em ${cfg.copyDir})` : ''}.`);

  const tick = async () => {
    try {
      const status = await readStatus(cfg.dir);
      const due = isBackupDue({
        now: new Date(),
        time: cfg.time,
        lastSuccessAt: status.lastSuccess?.at,
        lastAttemptAt: status.lastAttempt?.at,
        lastAttemptOk: status.lastAttempt?.ok !== false || Boolean(status.lastSuccess && status.lastAttempt?.at === status.lastSuccess.at),
      });
      if (due) await runBackup({ reason: 'agendado' });
    } catch (err) {
      if (err.code !== 'BACKUP_BUSY') console.error('[backup] erro no agendamento:', err.message);
    }
  };
  setTimeout(tick, 60 * 1000).unref(); // primeira verificação 1 min após subir
  const timer = setInterval(tick, CHECK_EVERY_MS);
  timer.unref();
  return timer;
}

module.exports = { startBackupJob, isBackupDue };
