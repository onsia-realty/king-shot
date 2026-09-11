/**
 * 참고 사이트 ks.h5joy-games.com 에서 영웅 스킬·전용 장비 아이콘을 내려받아
 * src/assets/skills/ 와 src/assets/gear/ 에 저장한다.
 *
 *   node scripts/sync-hero-icons.mjs
 *
 * 손으로만 돌린다. 아이콘이 매일 바뀌는 자료가 아니라서 GitHub Actions 는 붙이지 않았다.
 * 이미 있고 크기가 같은 파일은 다시 받지 않는다.
 *
 * 아이콘 목록의 출처
 *   src/data/hero-source.json (sync-heroes.mjs 가 만든 중간 산출물) 을 읽어
 *   필요한 아이콘 id 를 직접 모은다. URL 을 하드코딩하지 않는 이유는 영웅이
 *   늘어나면 목록도 저절로 따라와야 하기 때문이다.
 *
 * 아이콘 URL 규칙 — https://ks.h5joy-games.com/games/{파일명}.webp
 *   영웅 스킬   icon_hero_skill_{id}          explorationSkills[].id, expeditionSkills[].id, talentSkill.id
 *   전용 장비   icon_hero_special_{id}        special.id
 *   장비 스킬   icon_hero_special_skill_{id}  special.explorationSkill.id, special.expeditionSkill.id
 *
 * 저장 이름은 접두를 뗀 id 그대로다(ambrosia.webp, immortals-flask.webp).
 * 우리 저장소 안에서는 `icon_hero_skill_` 같은 접두가 군더더기다.
 * 영웅 스킬과 장비 스킬이 skills/ 를 같이 쓰는데, 만약 id 가 겹치면 내용을
 * 비교해서 다를 때만 장비 스킬 쪽에 `special-` 접두를 붙여 구분한다.
 *
 * 안전장치 — 아래 경우 파일을 쓰지 않고 exit 1 로 죽는다.
 *   - hero-source.json 이 없거나 읽히지 않음
 *   - 모은 아이콘 id 가 0개 (데이터 구조가 바뀐 것으로 본다)
 *   - 실패가 전체의 10% 를 넘음 (사이트 구조가 바뀐 것으로 본다)
 *   개별 아이콘의 404·비정상 응답은 경고만 찍고 넘어간다. 하나 때문에 전체를 날리지 않는다.
 *
 * 받은 바이트는 webp 매직 바이트(RIFF....WEBP)로 검사한다. HTML 에러 페이지를
 * .webp 로 저장해 두면 나중에 빌드가 죽는다. 임시 파일에 쓰고 검증한 뒤 옮기므로
 * 0바이트 파일이나 반쪽짜리 파일이 남지 않는다.
 */
import { readFile, writeFile, mkdir, stat, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ks.h5joy-games.com';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'hero-source.json');
const SKILLS_DIR = path.join(ROOT, 'src', 'assets', 'skills');
const GEAR_DIR = path.join(ROOT, 'src', 'assets', 'gear');

/** 아이콘 종류별 파일명 접두 */
const PREFIX = {
  heroSkill: 'icon_hero_skill_',
  gear: 'icon_hero_special_',
  gearSkill: 'icon_hero_special_skill_',
};

/** 실패를 이만큼 넘기면 사이트가 바뀐 것으로 본다 */
const FAIL_RATIO_LIMIT = 0.1;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** 요청 사이 지연(ms). 172개를 한꺼번에 쏘지 않는다. */
const DELAY_MIN = 150;
const DELAY_MAX = 300;

/** 실패는 조용히 넘기지 않는다. */
function die(message) {
  console.error(`[아이콘 동기화 중단] ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`  ! ${message}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** RIFF....WEBP 매직 바이트 확인 */
function isWebp(buf) {
  return (
    buf.length > 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  );
}

async function fileSize(file) {
  try {
    return (await stat(file)).size;
  } catch {
    return null; // 없으면 null
  }
}

// 1. hero-source.json 에서 아이콘 id 를 모은다
let source;
try {
  source = JSON.parse(await readFile(DATA_FILE, 'utf8'));
} catch (err) {
  die(`${DATA_FILE} 를 읽지 못했다: ${err.message}\n먼저 node scripts/sync-heroes.mjs 를 돌릴 것.`);
}

const heroes = source?.heroes;
if (!heroes || typeof heroes !== 'object') {
  die('hero-source.json 에 heroes 객체가 없다. 데이터 구조가 바뀐 것으로 보인다.');
}

/** key = `${kind}:${id}` -> { kind, id, users:Set<slug> } */
const wanted = new Map();

function want(kind, id, slug) {
  if (typeof id !== 'string' || id === '') return;
  const key = `${kind}:${id}`;
  if (!wanted.has(key)) wanted.set(key, { kind, id, users: new Set() });
  wanted.get(key).users.add(slug);
}

for (const [slug, entry] of Object.entries(heroes)) {
  // ko/en 어느 쪽이든 id 는 같다. ko 가 없으면 en 으로 떨어진다.
  const hero = entry?.ko ?? entry?.en;
  if (!hero) {
    warn(`${slug} 에 ko/en 데이터가 없다. 건너뛴다.`);
    continue;
  }

  for (const s of hero.explorationSkills ?? []) want('heroSkill', s?.id, slug);
  for (const s of hero.expeditionSkills ?? []) want('heroSkill', s?.id, slug);
  if (hero.talentSkill) want('heroSkill', hero.talentSkill.id, slug);

  const special = hero.special;
  if (special) {
    want('gear', special.id, slug);
    if (special.explorationSkill) want('gearSkill', special.explorationSkill.id, slug);
    if (special.expeditionSkill) want('gearSkill', special.expeditionSkill.id, slug);
  }
}

if (wanted.size === 0) {
  die(
    '아이콘 id 를 하나도 모으지 못했다. hero-source.json 의 구조가 바뀐 것으로 보인다. ' +
      'explorationSkills / expeditionSkills / special 키를 확인할 것.'
  );
}

// 2. 저장 경로를 정한다. skills/ 를 두 종류가 같이 쓰므로 id 충돌을 먼저 본다.
const heroSkillIds = new Set(
  [...wanted.values()].filter((t) => t.kind === 'heroSkill').map((t) => t.id)
);
const collided = new Set(
  [...wanted.values()]
    .filter((t) => t.kind === 'gearSkill' && heroSkillIds.has(t.id))
    .map((t) => t.id)
);

const tasks = [...wanted.values()].map((t) => {
  const dir = t.kind === 'gear' ? GEAR_DIR : SKILLS_DIR;
  // 충돌한 장비 스킬만 접두를 붙인다. 내용이 같은지는 받아 본 뒤에 판정한다.
  const base = t.kind === 'gearSkill' && collided.has(t.id) ? `special-${t.id}` : t.id;
  return { ...t, url: `${ORIGIN}/games/${PREFIX[t.kind]}${t.id}.webp`, dir, file: path.join(dir, `${base}.webp`) };
});
tasks.sort((a, b) => a.file.localeCompare(b.file));

if (collided.size > 0) {
  warn(
    `영웅 스킬과 id 가 겹치는 장비 스킬 ${collided.size}개: ${[...collided].join(', ')} ` +
      '— 내용이 다르면 special- 접두를 붙여 따로 저장한다.'
  );
}

const counts = { heroSkill: 0, gear: 0, gearSkill: 0 };
for (const t of tasks) counts[t.kind] += 1;
console.log(
  `아이콘 ${tasks.length}개 (영웅 스킬 ${counts.heroSkill} / 전용 장비 ${counts.gear} / 장비 스킬 ${counts.gearSkill})`
);

await mkdir(SKILLS_DIR, { recursive: true });
await mkdir(GEAR_DIR, { recursive: true });

// 3. 하나씩 받는다
let downloaded = 0;
let skipped = 0;
const failures = [];

for (const [i, t] of tasks.entries()) {
  const label = `${path.basename(t.dir)}/${path.basename(t.file)}`;
  const progress = `${String(i + 1).padStart(3)}/${tasks.length}`;

  // HEAD 로 크기를 먼저 물어, 이미 같은 크기면 본문을 받지 않는다.
  const have = await fileSize(t.file);
  await sleep(DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)));

  if (have != null && have > 0) {
    let remote = null;
    try {
      const head = await fetch(t.url, { method: 'HEAD', headers: { 'User-Agent': UA } });
      if (head.status === 200) {
        const len = Number(head.headers.get('content-length'));
        if (Number.isFinite(len) && len > 0) remote = len;
      }
    } catch {
      // HEAD 가 안 되면 그냥 본문을 받는다
    }
    if (remote != null && remote === have) {
      skipped += 1;
      continue;
    }
  }

  let buf;
  try {
    const res = await fetch(t.url, { headers: { 'User-Agent': UA, Accept: 'image/webp,image/*' } });
    if (res.status !== 200) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    warn(`${label} 실패 — ${err.message} (${t.url})`);
    failures.push({ label, url: t.url, reason: err.message });
    continue;
  }

  if (buf.length === 0) {
    warn(`${label} 실패 — 0바이트 응답 (${t.url})`);
    failures.push({ label, url: t.url, reason: '0바이트' });
    continue;
  }
  if (!isWebp(buf)) {
    warn(`${label} 실패 — webp 가 아니다(HTML 에러 페이지일 수 있다, ${buf.length}B)`);
    failures.push({ label, url: t.url, reason: 'webp 아님' });
    continue;
  }

  // 충돌한 장비 스킬인데 영웅 스킬 쪽 파일과 내용이 같으면 접두 없이 공유한다.
  let target = t.file;
  if (t.kind === 'gearSkill' && collided.has(t.id)) {
    const shared = path.join(SKILLS_DIR, `${t.id}.webp`);
    try {
      const existing = await readFile(shared);
      if (existing.equals(buf)) target = shared;
      else warn(`${t.id}: 영웅 스킬과 내용이 달라 special-${t.id}.webp 로 저장한다.`);
    } catch {
      // 영웅 스킬 쪽이 아직 없으면 그냥 접두를 붙인 채로 둔다
    }
  }

  // 임시 파일에 쓰고 옮긴다. 도중에 죽어도 반쪽짜리가 남지 않는다.
  const tmp = `${target}.tmp`;
  try {
    await writeFile(tmp, buf);
    await rename(tmp, target);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    warn(`${label} 저장 실패 — ${err.message}`);
    failures.push({ label, url: t.url, reason: `저장 실패: ${err.message}` });
    continue;
  }

  downloaded += 1;
  console.log(`받는 중 ${progress}  ${label.padEnd(44)} ${(buf.length / 1024).toFixed(1)}KB`);
}

// 4. 요약. 실패가 많으면 사이트가 바뀐 것으로 보고 죽는다.
console.log(`\n새로 받음 ${downloaded}개 / 이미 있음 ${skipped}개 / 실패 ${failures.length}개`);

if (failures.length > 0) {
  console.log('실패 목록:');
  for (const f of failures) console.log(`  - ${f.label}  ${f.reason}`);
}

if (failures.length > tasks.length * FAIL_RATIO_LIMIT) {
  die(
    `실패가 ${failures.length}/${tasks.length} 로 ${Math.round(FAIL_RATIO_LIMIT * 100)}% 를 넘었다. ` +
      '아이콘 URL 규칙이 바뀌었는지 확인할 것: ' +
      `curl -I -A "Mozilla/5.0" "${ORIGIN}/games/${PREFIX.heroSkill}ambrosia.webp"`
  );
}
