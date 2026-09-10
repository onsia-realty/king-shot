/**
 * 공식 위키에서 킹샷 기프트 코드를 긁어와 src/data/gift-codes.json 에 병합한다.
 *
 *   node scripts/sync-gift-codes.mjs
 *
 * 매일 GitHub Actions(.github/workflows/sync-gift-codes.yml)가 돌리고,
 * 위처럼 손으로 돌려도 된다. 변경이 있을 때만 파일을 다시 쓴다.
 *
 * 병합 규칙
 *   - 새 코드만 덧붙인다. 위키에서 사라진 코드도 지우지 않는다
 *     (만료된 건지 파싱이 실패한 건지 구분할 수 없기 때문).
 *   - 이미 있는 코드의 rewards / note / expiresAt 은 손대지 않는다.
 *     사람이 손으로 채워 넣은 값일 수 있다.
 *   - lastChecked 는 실행할 때마다 오늘(한국 시간)로 갱신한다.
 *
 * 안전장치 — 아래 경우 파일을 쓰지 않고 exit 1 로 죽는다.
 *   - HTTP 응답이 200이 아님
 *   - 추출된 코드가 0개 (사이트 구조가 바뀐 것으로 본다)
 *   - 추출된 값이 코드 형식(영숫자 4~20자)에 맞지 않음
 *   빈 배열로 조용히 덮어써서 페이지를 비워 버리는 일이 없도록 하는 게 핵심이다.
 *
 * 위키 구조가 바뀌었을 때
 *   현재 파서는 본문의 `<span class="code">KS0909</span>` 마크업 하나만 본다.
 *   아래 CODE_PATTERN 을 실제 HTML에 맞춰 고치면 된다. 추측하지 말고
 *   `curl -A "Mozilla/5.0" https://kingshotwiki.com/ko/giftcode/` 로 받아
 *   눈으로 확인한 뒤 고칠 것. URL 자체가 바뀌었다면 SOURCE_URL 을 함께 고친다.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://kingshotwiki.com/ko/giftcode/';
const DATA_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  'gift-codes.json'
);

/** 위키 본문의 코드 마크업. 구조가 바뀌면 여기를 고친다. */
const CODE_PATTERN = /<span class="code">\s*([^<]+?)\s*<\/span>/gi;
/** 코드로 인정할 형식: 영숫자 4~20자 */
const CODE_SHAPE = /^[A-Za-z0-9]{4,20}$/;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** 실패는 조용히 넘기지 않는다. */
function die(message) {
  console.error(`[기프트코드 동기화 중단] ${message}`);
  console.error('파일은 건드리지 않았다.');
  process.exit(1);
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

// 1. 받아온다
let res;
try {
  res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
} catch (err) {
  die(`${SOURCE_URL} 요청 실패: ${err.message}`);
}
if (res.status !== 200) {
  die(`HTTP ${res.status} ${res.statusText} — ${SOURCE_URL}`);
}
const html = await res.text();

// 2. 뽑아낸다
const raw = [...html.matchAll(CODE_PATTERN)].map((m) => m[1].trim()).filter(Boolean);

if (raw.length === 0) {
  die(
    `코드를 하나도 찾지 못했다. 위키 HTML 구조가 바뀐 것으로 보인다. ` +
      `scripts/sync-gift-codes.mjs 의 CODE_PATTERN 을 확인할 것.`
  );
}

const bad = raw.filter((c) => !CODE_SHAPE.test(c));
if (bad.length > 0) {
  die(`코드 형식(영숫자 4~20자)에 맞지 않는 값이 섞여 있다: ${bad.join(', ')}`);
}

// 대소문자만 다른 중복은 하나로 본다. 먼저 나온 표기를 살린다.
const scraped = [];
const seen = new Set();
for (const c of raw) {
  const key = c.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  scraped.push(c);
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
const known = new Set(data.codes.map((c) => String(c.code).toLowerCase()));
const added = [];

for (const code of scraped) {
  if (known.has(code.toLowerCase())) continue; // 기존 코드는 절대 덮어쓰지 않는다
  known.add(code.toLowerCase());
  const entry = {
    code,
    rewards: '', // 위키에 보상이 적혀 있지 않다. 지어내지 않고 비워 둔다
    addedAt: today,
    note: '출처: 공식 위키 kingshotwiki.com/ko/giftcode',
  };
  data.codes.push(entry);
  added.push(code);
}

const lastCheckedChanged = data.lastChecked !== today;
data.lastChecked = today;

// 4. 결과 보고
if (added.length === 0 && !lastCheckedChanged) {
  console.log(`변경 없음 (위키 코드 ${scraped.length}개, 모두 이미 등록됨)`);
  process.exit(0);
}

await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

if (added.length > 0) {
  console.log(`새 코드 ${added.length}개 추가: ${added.join(', ')}`);
} else {
  console.log('새 코드 없음. 마지막 확인일만 갱신했다.');
}
console.log(`마지막 확인일 -> ${today} / 전체 ${data.codes.length}개`);
