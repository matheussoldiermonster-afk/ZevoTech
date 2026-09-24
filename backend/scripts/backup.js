/**
 * Backup manual pela linha de comando:  npm run backup
 * Também pode ser usado pelo Agendador de Tarefas do Windows ou pelo cron,
 * se preferir não depender da API estar ligada.
 */
require('dotenv').config();
const { runBackup } = require('../src/services/backupService');

runBackup({ reason: 'linha de comando' })
  .then((r) => {
    console.log(`Backup concluído: ${r.file} (${Math.round(r.size / 1024)} KB)`);
    if (r.copied) console.log(`Cópia: ${r.copied}`);
    if (r.warning) console.warn(`Atenção: ${r.warning}`);
    process.exit(r.warning ? 2 : 0);
  })
  .catch((err) => {
    console.error(`Backup FALHOU: ${err.message}`);
    process.exit(1);
  });
