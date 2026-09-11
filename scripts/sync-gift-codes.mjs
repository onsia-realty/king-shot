/**
 * 킹샷 기프트 코드를 긁어와 src/data/gift-codes.json 에 병합한다.
 *
 *   node scripts/sync-gift-codes.mjs
 *
 * 매일 GitHub Actions(.github/workflows/sync-gift-codes.yml)가 돌리고,
 * 위처럼 손으로 돌려도 된다. 변경이 있을 때만 파일을 다시 쓴다.
 *
 * 출처는 두 곳이다. 성격이 달라서 둘 다 본다.
 *   1) ks.h5joy-games.com — 과거 코드까지 80여 개를 유효기간과 함께 들고 있다.
 *      날짜가 붙는 유일한 출처라서 startsAt / expiresAt 은 전부 여기서 온다.
 *   2) kingshotwiki.com(공식 위키) — 코드 문자열만 나오고 날짜가 없지만,
 *      갓 풀린 코드(KS0909 같은)가 h5joy 보다 먼저 올라온다. 최신을 놓치지 않으려고 본다.
 *
 * 병합 규칙
 *   - 새 코드만 덧붙인다. 출처에서 사라진 코드도 지우지 않는다
 *     (만료된 건지 파싱이 실패한 건지 구분할 수 없기 때문).
 *   - 이미 있는 코드의 rewards / note 는 절대 손대지 않는다.
 *     사람이 손으로 채워 넣은 값일 수 있다.
 *   - startsAt / expiresAt 은 **비어 있을 때만** 새로 알게 된 날짜로 채운다.
 *     값이 이미 있으면 손대지 않는다. 날짜 없이 들어온 옛 항목을 나중에
 *     보강할 수 있어야 해서 이 경로가 필요하다.
 *   - lastChecked 는 실행할 때마다 오늘(한국 시간)로 갱신한다.
 *
 * 안전장치 — 조용히 빈 배열로 덮어써서 페이지를 비워 버리는 일이 없어야 한다는 게 요점이다.
 *   - 두 출처 중 하나라도 살아 있으면 진행한다. 죽은 쪽은 경고만 찍는다.
 *     (한쪽 사이트가 잠깐 죽었다고 매일 도는 워크플로 전체를 실패시킬 이유가 없다.)
 *   - 둘 다 실패하거나 합쳐서 코드가 0개면 exit 1 로 죽고 파일은 건드리지 않는다.
 *   - 코드 형식(영숫자 4~20자)에 안 맞는 값은 그 항목만 버리고 경고한다.
 *     출처가 둘이라 한쪽 노이즈 하나로 전체가 죽으면 곤란하다. 단 걸러낸 뒤 0개면 죽는다.
 *   - 날짜도 YYYY-MM-DD 로 정규화하고, 형식이 어긋나면 그 날짜만 무시하고 경고한다.
 *
 * 사이트 구조가 바뀌었을 때
 *   추측하지 말고 실제 HTML을 받아서 눈으로 확인한 뒤 정규식을 고칠 것.
 *   curl -A "Mozilla/5.0" https://ks.h5joy-games.com/ko/gift-code/
 *   curl -A "Mozilla/5.0" https://kingshotwiki.com/ko/giftcode/
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const H5JOY_URL = 'https://ks.h5joy-games.com/ko/gift-code/';
const WIKI_URL = 'https://kingshotwiki.com/ko/giftcode/';

const DATA_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  'gift-codes.json'
);

/** 공식 위키 본문의 코드 마크업. 구조가 바뀌면 여기를 고친다. */
const CODE_PATTERN = /<span class="code">\s*([^<]+?)\s*<\/span>/gi;
/** 코드로 인정할 형식: 영숫자 4~20자 */
const CODE_SHAPE = /^[A-Za-z0-9]{4,20}$/;
/** 날짜로 인정할 형식 */
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const NOTE_H5JOY = '출처: ks.h5joy-games.com';
const NOTE_WIKI = '출처: 공식 위키 kingshotwiki.com/ko/giftcode';

/** 되살릴 수 없는 실패. 파일을 건드리지 않고 죽는다. */
function die(message) {
  console.error(`[기프트코드 동기화 중단] ${message}`);
  console.error('파일은 건드리지 않았다.');
  process.exit(1);
}

/** 한쪽 출처만 상한 경우. 경고만 찍고 나머지로 계속 간다. */
function warn(message) {
  console.warn(`[경고] ${message}`);
}

/** GitHub Actions 는 UTC로 돌기 때문에 날짜는 한국 시간 기준으로 만든다. */
function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * 날짜를 YYYY-MM-DD 로 맞춘다. h5joy 의 addedAt 은 ISO 타임스탬프라 앞 10자만 쓴다.
 * 형식이 어긋나면 undefined 를 돌려주고 경고한다 — 이상한 값을 데이터에 심지 않는다.
 */
function normalizeDate(value, where) {
  if (!value) return undefined;
  const d = String(value).slice(0, 10);
  if (!DATE_SHAPE.test(d)) {
    warn(`${where}: 날짜 형식이 이상해서 무시한다 — ${value}`);
    return undefined;
  }
  return d;
}

/** HTML 을 받아온다. 실패하면 null 을 돌려준다(죽지 않는다). */
async function fetchHtml(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      // h5joy 와 위키 둘 다 리다이렉트가 있다. follow 는 필수.
      redirect: 'follow',
    });
  } catch (err) {
    warn(`${url} 요청 실패: ${err.message}`);
    return null;
  }
  if (res.status !== 200) {
    warn(`HTTP ${res.status} ${res.statusText} — ${url}`);
    return null;
  }
  return await res.text();
}

/**
 * h5joy 파서.
 *
 * SvelteKit 이 SSR 페이로드를 IIFE 로 감싸면서 중복되는 객체를 변수로 호이스팅한다.
 * 실제 HTML 모양은 이렇다.
 *
 *   (function(a){a.code="VIP777";a.effectiveDate="2026-06-01";...;return {type:"data",data:{
 *     giftCodes:[{code:"KS0803",...}, ..., a, {code:"CHILDFUN2026",...}],
 *     activeGiftCodes:[a], ...}}}({}))
 *
 * 배열 안에 맨몸 식별자 `a` 가 원소로 끼어 있어서 JSON.parse 든 new Function 이든
 * 통째로 파싱하면 깨진다. 그래서 두 갈래로 훑는다.
 *   (1) 배열 안의 객체는 code 등장 지점부터 다음 code 직전까지를 한 항목으로 보고 필드별로 뽑는다.
 *   (2) 호이스팅된 `x.code="…";x.effectiveDate="…"` 할당 덩어리를 따로 훑어 그 항목을 살린다.
 * 두 갈래 결과를 HTML 안의 등장 위치로 정렬해 원래 순서를 되살린다.
 * 같은 코드가 양쪽에 다른 날짜로 있을 수 있는데(VIP777 이 실제로 그렇다),
 * 위치가 앞선 쪽이 최신이라 먼저 나온 것을 살린다.
 */
function parseH5Joy(html) {
  const found = [];

  // (1) giftCodes 배열 구간만 잘라낸다. 항목 안에는 rewards:{} 말고 대괄호가 없어서
  //     다음 ']' 까지가 곧 배열의 끝이다.
  const arrayKey = 'giftCodes:[';
  const start = html.indexOf(arrayKey);
  if (start >= 0) {
    const bodyStart = start + arrayKey.length;
    const end = html.indexOf(']', bodyStart);
    const segment = end >= 0 ? html.slice(bodyStart, end) : '';
    const offset = bodyStart;

    // code 등장 위치들을 먼저 모으고, 각 구간을 한 항목으로 본다.
    const heads = [...segment.matchAll(/code:"([^"]*)"/g)];
    for (let i = 0; i < heads.length; i += 1) {
      const head = heads[i];
      const from = head.index;
      const to = i + 1 < heads.length ? heads[i + 1].index : segment.length;
      const chunk = segment.slice(from, to);
      found.push({
        at: offset + from,
        code: head[1],
        startsAt: /effectiveDate:"([^"]*)"/.exec(chunk)?.[1],
        expiresAt: /expirationDate:"([^"]*)"/.exec(chunk)?.[1],
        addedAt: /addedAt:"([^"]*)"/.exec(chunk)?.[1],
      });
    }
  } else {
    warn(`h5joy: giftCodes 배열을 찾지 못했다. 페이지 구조가 바뀐 것으로 보인다 — ${H5JOY_URL}`);
  }

  // (2) 호이스팅된 변수 할당. 변수명이 a 라는 보장이 없어서 식별자를 잡아 되쓴다.
  for (const m of html.matchAll(/([A-Za-z_$][\w$]*)\.code\s*=\s*"([^"]*)"/g)) {
    const [, ident, code] = m;
    // 같은 변수에 대한 나머지 할당은 바로 뒤에 붙어 있다. 넉넉히 300자만 본다.
    const window = html.slice(m.index, m.index + 300);
    const esc = ident.replace(/\$/g, '\\$');
    found.push({
      at: m.index,
      code,
      startsAt: new RegExp(`${esc}\\.effectiveDate\\s*=\\s*"([^"]*)"`).exec(window)?.[1],
      expiresAt: new RegExp(`${esc}\\.expirationDate\\s*=\\s*"([^"]*)"`).exec(window)?.[1],
      addedAt: new RegExp(`${esc}\\.addedAt\\s*=\\s*"([^"]*)"`).exec(window)?.[1],
    });
  }

  found.sort((x, y) => x.at - y.at);

  return found.map((f) => ({
    code: f.code,
    startsAt: normalizeDate(f.startsAt, `h5joy ${f.code}`),
    expiresAt: normalizeDate(f.expiresAt, `h5joy ${f.code}`),
    addedAt: normalizeDate(f.addedAt, `h5joy ${f.code}`),
    note: NOTE_H5JOY,
  }));
}

/** 공식 위키 파서. 코드 문자열만 나오고 날짜는 없다. */
function parseWiki(html) {
  const codes = [...html.matchAll(CODE_PATTERN)].map((m) => m[1].trim()).filter(Boolean);
  if (codes.length === 0) {
    warn(
      `공식 위키: 코드를 하나도 찾지 못했다. HTML 구조가 바뀐 것으로 보인다. ` +
        `scripts/sync-gift-codes.mjs 의 CODE_PATTERN 을 확인할 것.`
    );
  }
  return codes.map((code) => ({ code, note: NOTE_WIKI }));
}

// 1. 두 출처를 동시에 받아온다. 한쪽이 죽어도 나머지로 간다.
const [h5joyHtml, wikiHtml] = await Promise.all([fetchHtml(H5JOY_URL), fetchHtml(WIKI_URL)]);

if (h5joyHtml === null && wikiHtml === null) {
  die('두 출처 모두 받아오지 못했다.');
}

// 2. 뽑아낸다. h5joy 를 앞에 둔다 — 날짜를 들고 있는 쪽이 먼저 자리를 잡아야 한다.
const raw = [
  ...(h5joyHtml ? parseH5Joy(h5joyHtml) : []),
  ...(wikiHtml ? parseWiki(wikiHtml) : []),
];

// 코드 형식에 안 맞는 값은 그 항목만 버린다. 출처가 둘이라 한쪽 노이즈로 전체를 죽이지 않는다.
const bad = raw.filter((e) => !CODE_SHAPE.test(e.code));
if (bad.length > 0) {
  warn(`코드 형식(영숫자 4~20자)에 안 맞아서 걸러낸 값: ${bad.map((e) => e.code).join(', ')}`);
}

// 대소문자만 다른 중복은 하나로 본다. 먼저 나온 표기를 살린다.
const scraped = [];
const seen = new Set();
for (const entry of raw) {
  if (!CODE_SHAPE.test(entry.code)) continue;
  const key = entry.code.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  scraped.push(entry);
}

if (scraped.length === 0) {
  die('쓸 만한 코드를 하나도 건지지 못했다. 두 출처의 파싱 규칙을 확인할 것.');
}

// 3. 기존 파일과 병합한다
let data;
try {
  data = JSON.parse(await readFile(DATA_FILE, 'utf8'));
} catch (err) {
  die(`${DATA_FILE} 을 읽지 못했다: ${err.message}`);
}
if (!Array.isArray(data.codes)) {
  die('gift-codes.json 의 codes 가 배열이 아니다.');
}

const today = todayKST();
const byCode = new Map(data.codes.map((c) => [String(c.code).toLowerCase(), c]));
const added = [];
const enriched = [];

for (const entry of scraped) {
  const key = entry.code.toLowerCase();
  const existing = byCode.get(key);

  if (!existing) {
    // 새 코드. rewards 는 어느 출처에도 없다 — 지어내지 않고 비워 둔다.
    const fresh = { code: entry.code, rewards: '' };
    if (entry.startsAt) fresh.startsAt = entry.startsAt;
    if (entry.expiresAt) fresh.expiresAt = entry.expiresAt;
    fresh.addedAt = entry.addedAt ?? today;
    fresh.note = entry.note;
    data.codes.push(fresh);
    byCode.set(key, fresh);
    added.push(entry.code);
    continue;
  }

  // 기존 코드. rewards / note 는 손대지 않고, 비어 있는 날짜만 채운다.
  let filled = false;
  if (!existing.startsAt && entry.startsAt) {
    existing.startsAt = entry.startsAt;
    filled = true;
  }
  if (!existing.expiresAt && entry.expiresAt) {
    existing.expiresAt = entry.expiresAt;
    filled = true;
  }
  if (filled) enriched.push(existing.code);
}

const lastCheckedChanged = data.lastChecked !== today;
data.lastChecked = today;

// 4. 결과 보고. 워크플로가 첫 줄을 커밋 메시지로 쓴다 — 형태를 함부로 바꾸지 말 것.
if (added.length === 0 && enriched.length === 0 && !lastCheckedChanged) {
  console.log(`변경 없음 (수집한 코드 ${scraped.length}개, 모두 이미 등록됨)`);
  process.exit(0);
}

await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const headline = [];
if (added.length > 0) headline.push(`새 코드 ${added.length}개 추가`);
if (enriched.length > 0) headline.push(`기존 ${enriched.length}개 날짜 보강`);
if (headline.length === 0) headline.push('새 코드 없음. 마지막 확인일만 갱신했다');

console.log(
  added.length > 0 ? `${headline.join(', ')}: ${added.join(', ')}` : headline.join(', ')
);
if (enriched.length > 0) console.log(`날짜를 채운 코드: ${enriched.join(', ')}`);
console.log(`마지막 확인일 -> ${today} / 전체 ${data.codes.length}개`);
