/** Verifica a sintaxe de todos os arquivos .js do backend (node --check). */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const root = path.join(__dirname, '..');
const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'test')), path.join(root, 'prisma', 'seed.js')];
let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    console.error(`✗ ${path.relative(root, f)}\n${err.stderr.toString()}`);
  }
}
console.log(`${files.length - failed}/${files.length} arquivos OK`);
process.exit(failed ? 1 : 0);
