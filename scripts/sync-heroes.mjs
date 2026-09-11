/**
 * 참고 사이트 ks.h5joy-games.com 에서 영웅 상세 데이터를 긁어와
 * src/data/hero-source.json 에 저장한다.
 *
 *   node scripts/sync-heroes.mjs
 *
 * 손으로만 돌린다. 수치가 자주 바뀌는 자료가 아니라서 GitHub Actions 는 붙이지 않았다.
 * 변경이 있을 때만 파일을 다시 쓴다.
 *
 * 이 파일이 만드는 건 "중간 산출물"이다
 *   - src/content/heroes/*.md 에 직접 쓰지 않는다. 참고 사이트의 한국어는 기계번역이라
 *     조사가 깨져 있다(`을(를)`, `영웅는`). 그래서 한/영을 나란히 받아 두고,
 *     다음 단계에서 사람이 영문 원문을 보고 한국어를 새로 쓴다.
 *   - 나중에 수치가 바뀌었는지는 이 JSON 을 다시 만들고 `git diff` 로 본다.
 *     그래서 슬러그를 정렬해 키 순서를 결정론적으로 고정한다.
 *
 * 수집 방식
 *   목록 페이지에서 `/heroes/gen{N}/{slug}/` 링크를 훑어 대상을 정하고(하드코딩하지
 *   않는다. gen7 이 나중에 붙을 수 있다), 슬러그마다 한국어/영문 두 페이지를 받는다.
 *   SvelteKit SSR HTML 안에 `hero:{...}` 객체 리터럴이 통째로 들어 있어서,
 *   중괄호 매칭으로 잘라낸 뒤 new Function 으로 평가한다. 외부 변수 참조가 없는
 *   순수 리터럴이라 이 방식이 통한다(기프트 코드 쪽 배열과 다른 점).
 *
 * 안전장치 — 아래 경우 파일을 쓰지 않고 exit 1 로 죽는다.
 *   - HTTP 응답이 200이 아님 (목록 페이지)
 *   - 목록에서 영웅을 0명 찾음 (사이트 구조가 바뀐 것으로 본다)
 *   - 파싱에 성공한 영웅이 0명
 *   개별 영웅의 실패는 경고만 찍고 넘어간다. 한 명 때문에 전체를 날리지 않는다.
 *
 * 사이트 구조가 바뀌었을 때
 *   추측하지 말고 실제 HTML 을 먼저 받아 눈으로 확인할 것.
 *   curl -A "Mozilla/5.0" "https://ks.h5joy-games.com/ko/heroes/gen5/long-fei/" -o h.html
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://ks.h5joy-games.com';
const INDEX_URL = `${ORIGIN}/ko/heroes/`;

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'hero-source.json');
const HEROES_DIR = path.join(ROOT, 'src', 'content', 'heroes');

/** 목록 페이지의 영웅 링크. 구조가 바뀌면 여기를 고친다. */
const HERO_LINK_PATTERN = /\/heroes\/gen(\d+)\/([a-z0-9][a-z0-9-]*)\//g;
/** 없으면 그 영웅을 버리는 필수 키 */
const REQUIRED_KEYS = ['id', 'name', 'explorationStats', 'explorationSkills'];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** 요청 사이 지연(ms). 38번을 한꺼번에 쏘지 않는다. */
const DELAY_MIN = 200;
const DELAY_MAX = 400;

/** 실패는 조용히 넘기지 않는다. */
function die(message) {
  console.error(`[영웅 데이터 동기화 중단] ${message}`);
  console.error('파일은 건드리지 않았다.');
  process.exit(1);
}

function warn(message) {
  console.warn(`  ! ${message}`);
}

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (res.status !== 200) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * `hero:{` 뒤의 객체 리터럴을 중괄호 매칭으로 잘라낸다.
 * 문자열 리터럴 안의 중괄호는 세지 않는다.
 */
function sliceHeroLiteral(html) {
  const marker = 'hero:{';
  const at = html.indexOf(marker);
  if (at === -1) return null;

  const start = at + marker.length - 1; // 여는 `{` 위치
  let depth = 0;
  let quote = null; // 문자열 안이면 따옴표 문자

  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];

    if (quote) {
      if (ch === '\\') {
        i += 1; // 이스케이프된 다음 글자는 통째로 건너뛴다
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null; // 닫히지 않았다
}

/** 잘라낸 리터럴을 평가한다. 실패하면 null. */
function parseHero(html) {
  const literal = sliceHeroLiteral(html);
  if (!literal) return null;
  try {
    const value = new Function(`return (${literal});`)();
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

// 1. 목록 페이지에서 대상을 정한다
let indexHtml;
try {
  indexHtml = await fetchText(INDEX_URL);
} catch (err) {
  die(`${INDEX_URL} 요청 실패: ${err.message}`);
}

/** slug -> generation */
const targets = new Map();
for (const m of indexHtml.matchAll(HERO_LINK_PATTERN)) {
  const gen = Number(m[1]);
  const slug = m[2];
  if (!targets.has(slug)) targets.set(slug, gen);
}

if (targets.size === 0) {
  die(
    '목록에서 영웅을 하나도 찾지 못했다. 사이트 HTML 구조가 바뀐 것으로 보인다. ' +
      'scripts/sync-heroes.mjs 의 HERO_LINK_PATTERN 을 확인할 것.'
  );
}

const slugs = [...targets.keys()].sort();
console.log(`목록에서 영웅 ${slugs.length}명을 찾았다.`);

// 2. 슬러그마다 한국어/영문 두 페이지를 받는다
const heroes = {};
const failed = [];

for (const slug of slugs) {
  const gen = targets.get(slug);
  const pages = {
    ko: `${ORIGIN}/ko/heroes/gen${gen}/${slug}/`,
    en: `${ORIGIN}/heroes/gen${gen}/${slug}/`,
  };

  const parsed = {};
  let broken = null;

  for (const [lang, url] of Object.entries(pages)) {
    await sleep(DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)));
    let html;
    try {
      html = await fetchText(url);
    } catch (err) {
      broken = `${lang} 페이지 요청 실패 (${err.message})`;
      break;
    }
    const hero = parseHero(html);
    if (!hero) {
      broken = `${lang} 페이지에서 hero 객체를 파싱하지 못했다`;
      break;
    }
    const missing = REQUIRED_KEYS.filter((k) => hero[k] == null);
    if (missing.length > 0) {
      broken = `${lang} 데이터에 필수 키가 없다: ${missing.join(', ')}`;
      break;
    }
    parsed[lang] = hero;
  }

  if (broken) {
    warn(`${slug} 제외 — ${broken}`);
    failed.push(slug);
    continue;
  }

  heroes[slug] = { generation: gen, ko: parsed.ko, en: parsed.en };
  console.log(`  + ${slug} (gen${gen}) ${parsed.ko.name} / ${parsed.en.name}`);
}

if (Object.keys(heroes).length === 0) {
  die('파싱에 성공한 영웅이 한 명도 없다. 사이트 구조가 바뀐 것으로 보인다.');
}

// 3. 슬러그 정렬로 키 순서를 고정한 뒤 쓴다
const ordered = {};
for (const slug of Object.keys(heroes).sort()) ordered[slug] = heroes[slug];

const payload = {
  fetchedAt: todayKST(),
  source: `${ORIGIN}/`,
  heroes: ordered,
};

// fetchedAt 만 다른 건 변경으로 치지 않는다. 실질 내용이 같으면 파일을 두지 않는다.
let previous = null;
try {
  previous = JSON.parse(await readFile(DATA_FILE, 'utf8'));
} catch {
  // 첫 실행이면 파일이 없다. 정상이다.
}

const sameContent =
  previous != null &&
  JSON.stringify(previous.heroes) === JSON.stringify(payload.heroes) &&
  previous.source === payload.source;

if (sameContent) {
  console.log(`변경 없음 (영웅 ${Object.keys(ordered).length}명)`);
} else {
  await writeFile(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`${DATA_FILE} 갱신 — 영웅 ${Object.keys(ordered).length}명`);
}

// 4. 우리 콘텐츠와 대조해 양쪽 차이를 알린다 (실패가 아니라 정보다)
let ourSlugs = [];
try {
  ourSlugs = (await readdir(HEROES_DIR))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
} catch (err) {
  warn(`${HEROES_DIR} 를 읽지 못해 대조를 건너뛴다: ${err.message}`);
}

if (ourSlugs.length > 0) {
  const collected = new Set(Object.keys(ordered));
  const onlyOurs = ourSlugs.filter((s) => !collected.has(s));
  const onlyTheirs = [...collected].filter((s) => !ourSlugs.includes(s));

  if (onlyOurs.length > 0) {
    console.log(`참고 사이트에 없는 영웅 ${onlyOurs.length}명: ${onlyOurs.join(', ')}`);
  }
  if (onlyTheirs.length > 0) {
    console.log(
      `우리 src/content/heroes 에 없는 슬러그 ${onlyTheirs.length}개: ${onlyTheirs.join(', ')}`
    );
  }
}

if (failed.length > 0) {
  console.log(`수집 실패 ${failed.length}명: ${failed.join(', ')}`);
}
