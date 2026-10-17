// Manual, dependency-free audit. Run after npm run build (Node >= 20.12).
import { execFileSync } from 'node:child_process';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const secretNames = ['MIGHTPULSE_API_KEY', 'DATABASE_URL', 'POSTGRES_URL'];

// Deliberately limited filename policy, not a generic "key" content search.
function sensitivePath(path) {
  const parts = path.toLowerCase().split('/');
  const name = parts.at(-1);
  return (name !== '.env.example' && (name === '.env' || name.startsWith('.env.')))
    || parts.some(part => ['.git', '.ssh', '.aws', '.vercel', 'secrets'].includes(part))
    || ['.npmrc', '.netrc', 'credentials.json', 'service-account.json',
      'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519'].includes(name)
    || /\.(?:pem|key|p12|pfx|keystore)$/.test(name);
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    // Do not silently skip or follow files outside the public output.
    if (entry.isSymbolicLink()) throw new Error('unsupported entry');
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error('unsupported entry');
  }
  return files;
}

async function audit() {
  let local = {};
  try {
    local = parseEnv(await readFile(join(root, '.env.local'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Check both sources, even when the process overrides a local value.
  const values = [...new Set(secretNames.flatMap(name => [local[name], process.env[name]])
    .filter(value => typeof value === 'string' && value.length > 0))];
  const available = secretNames.filter(name => local[name] || process.env[name]).length;
  const needles = values.map(value => Buffer.from(value));
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).split('\0').filter(Boolean);
  const dist = join(root, 'dist');
  const stat = await lstat(dist);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('invalid build');
  const files = await walk(dist);
  if (files.length === 0) throw new Error('empty build');

  let javascript = 0;
  let maps = 0;
  let references = 0;
  let leakedFiles = 0;
  let sensitiveFiles = 0;
  for (const file of files) {
    const relative = file.slice(dist.length + 1).replaceAll('\\', '/');
    const data = await readFile(file);
    if (sensitivePath(relative)) sensitiveFiles++;
    if (/\.map$/i.test(file)) maps++;
    // Include inline scripts in HTML, as well as standalone browser bundles.
    if (/\.(?:[cm]?js|html?)$/i.test(file)) {
      if (/\.[cm]?js$/i.test(file)) javascript++;
      if (/(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/.test(data.toString('utf8'))) references++;
    }
    if (needles.some(value => data.includes(value))) leakedFiles++;
  }

  const checks = [
    ['tracked sensitive paths', tracked.filter(sensitivePath).length],
    ['public sensitive paths', sensitiveFiles],
    ['public .map files', maps],
    ['JS/HTML sourcemap reference files', references],
    ['public files containing known secret values', leakedFiles],
  ];
  // Counts only: filenames, errors, snippets and environment values are never logged.
  console.log(`Scanned: public files=${files.length}; browser JS files=${javascript}; tracked files=${tracked.length}`);
  console.log(`Secret coverage: available=${available}/3; unavailable=${3 - available}; distinct values=${values.length}`);
  for (const [label, count] of checks) {
    console.log(`${label}: ${count ? 'FAIL' : 'PASS'}; count=${count}`);
  }
  if (!values.length) console.log('Secret value scan: SKIP; available values=0');
  const failed = checks.some(([, count]) => count > 0);
  console.log(`Audit: ${failed ? 'FAIL' : 'PASS'}`);
  process.exitCode = failed ? 1 : 0;
}

audit().catch(() => {
  // Exception messages can contain credentials or raw git output.
  console.error('Audit: ERROR; incomplete checks=1');
  process.exitCode = 2;
});
