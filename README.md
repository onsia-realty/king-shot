# 킹샷 공략 (Kingshot Guide KR)

킹샷(Kingshot) 한국어 공략 사이트. Astro 7 + Tailwind CSS v4 정적 사이트.

## 실행법

```powershell
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ 로 정적 빌드
npm run preview  # 빌드 결과 미리보기
npm run check    # 타입 / Astro 진단
```

Node 22 이상 필요.

## 프로젝트 구조

```
src/
  content.config.ts   컬렉션 스키마 (guides / heroes / buildings / pets)
  content/            콘텐츠 마크다운
    guides/  heroes/  buildings/  pets/
  layouts/BaseLayout.astro
  components/         Header, Footer, Breadcrumb, Disclaimer, 배지들
  data/nav.ts         네비게이션 단일 소스 (Header/Footer 공유)
  pages/              라우트
  styles/global.css   Tailwind v4 + 디자인 토큰
public/               robots.txt, favicon.svg 등 정적 자산
```

## 공략 글 추가법

1. `src/content/guides/` 에 `슬러그.md` 파일을 만든다. 파일명이 곧 URL 슬러그.
2. 프론트매터를 스키마에 맞게 작성한다.

```markdown
---
title: 초보자 성장 로드맵
description: 킹샷 첫 7일 동안 무엇을 먼저 올려야 하는지 정리했습니다.
category: 입문          # 입문 | 영웅 | 전투 | 건설 | 이벤트 | 연맹 | 과금 | 이민
tags: [초보, 로드맵]
published: 2026-09-10
updated: 2026-09-11      # 선택
difficulty: 입문         # 입문 | 중급 | 고급 (기본 중급)
featured: false
draft: false
related: []              # 다른 guides 슬러그 배열
---

본문...
```

- `related` 에 적은 슬러그는 **실제로 존재하는 guides 파일**이어야 빌드 로그에 오류가 남지 않는다.
- `draft: true` 인 글은 목록 페이지에서 걸러 쓰면 된다.
- `cover` 는 `src/assets/` 등 프로젝트 내부 이미지 경로를 쓰면 Astro가 최적화한다.
- 영웅/건물/펫은 각각 `src/content/heroes|buildings|pets/` 에 같은 방식으로 추가한다.
  스키마는 `src/content.config.ts` 참조.

## 데이터 출처

**영웅·건물·펫의 한국어 표기는 게임 내 공식 표기를 따른다.** 기준은 Century Games
공식 위키 한국어판이다.

- 공식 위키 한국어판: <https://kingshotwiki.com/ko/>
  (푸터 표기: "Kingshot - Official Wiki | Century Games")
- 영웅 상세 URL 형태:
  `https://kingshotwiki.com/ko/heroes/kingshot_wiki_hero_name_{ID}_kingshot_end-2/`
  영문판(`https://kingshotwiki.com/heroes/`)과 hero ID가 같아서 ID로 한↔영 대조가 된다.

### 규칙

- **새 영웅·건물·펫을 추가할 때는 반드시 공식 위키의 한국어 표기를 먼저 확인하고 쓸 것.**
  한국 유저는 게임에서 본 이름으로 검색하기 때문에 임의 음역은 검색 유입을 통째로 날린다.
  (예: Forrest = 포레스트 ✗ / **포스터** ✓, Truegold Crucible = 황금용광로 ✗ / **순금 용광로** ✓)
- 파일명(슬러그)과 URL은 영문 기준으로 **한 번 정하면 바꾸지 않는다.** 표기가 틀렸으면
  `name` 필드만 고친다. (`jaeger.md`의 공식 영문 표기는 `Jaegar`지만 슬러그는 `jaeger` 유지)
- 화면에 보이는 등급·병종 라벨은 `src/lib/labels.ts` 한 곳에 모아뒀다.
  스키마 enum(`SSR`/`SR`/`R`/`N`)은 코드 식별자로 그대로 두고, 표시 문자열만 여기서 바꾼다.
  - `SSR` → 전설 / `SR` → 에픽 / `R` → 레어 / `N` → 일반
  - 병종은 보병 / **궁병** / 기병 (게임 표기는 '궁수'가 아니라 '궁병')

### 영웅 상세 데이터

영웅 프론트매터의 `stats` / `skills` / `exclusiveGear` 는 게임 구조를 그대로 따른다.

- `stats.exploration` — **토벌** 스탯. 공격력·방어력·HP 절대수치.
- `stats.expedition` — **원정** 스탯. 퍼센트 문자열이라 따옴표가 필요하다(`"444.35%"`).
- `skills[]` — `mode` 가 `토벌` / `원정` / `특성`. 영웅마다 토벌 3 + 원정 3이 기본이고,
  일부는 `특성` 스킬을 하나 더 가진다.
- `exclusiveGear` — 전용 장비. 자체 스탯(원정 쪽은 `lethality`=파괴력)과 스킬 2개,
  부속품 수량 `parts` 를 가진다. `parts` 는 지금 전 영웅이 `[5, 10, ... 50]` 로 같다.

**스킬 설명의 자리표시자**: `description` 에 `{v1}` / `{v2}` 를 남겨 두고 단계별 수치는
`levels` / `levels2` 배열에 넣는다. 렌더링할 때 `src/lib/hero-skill.ts` 가
`80% / 90% / 100% / 110% / 120%` 형태로 강조해 끼워 넣는다. **수치를 설명문에 직접
적지 말 것** — 강조가 안 붙고 데이터로도 다룰 수 없게 된다.

수치가 두 줄인 스킬이 152개 중 20개 있다. 그 경우에만 `{v2}` + `levels2` 를 쓴다.

```yaml
  - name: 암브로시아
    nameEn: Ambrosia
    mode: 토벌
    description: 용비가 특제 암브로시아를 들이켜 전장과 하나가 된다. 4초 동안 공격 속도가 {v1} 오르고 제어 효과에 면역이 된다.
    levels: ["80%", "90%", "100%", "110%", "120%"]
```

### 아직 안 채운 데이터

- 영웅 15명 — gen1 에픽·레어 12명(아마네·첸코·다이애나·파드·고든·하워드·퀸·연우·
  에드윈·포스터·올리브·세스)과 gen7 3명(아바·찰스·위앤우). 수집원(`ks.h5joy-games.com`)에
  이 영웅들이 없다. **추측으로 채우지 말 것.** 페이지에 "아직 비워 뒀습니다" 안내가 뜬다.
- 펫: `skills`(스킬명과 설명)
- 건물: `unlock`(해금 조건), `maxLevel`(최대 레벨)

### 영웅 데이터 동기화

```powershell
node scripts/sync-heroes.mjs
```

`ks.h5joy-games.com` 의 영웅 상세 페이지에서 한국어·영문 원본을 함께 긁어
`src/data/hero-source.json` 에 저장한다. 이 파일은 **중간 산출물**이다 — 마크다운에
직접 들어가지 않고, 사람이 한국어를 새로 쓸 때의 입력이자 나중에 수치가 바뀌었는지
`git diff` 로 확인하는 기준이다. 커밋한다.

기프트 코드와 달리 매일 돌 이유가 없어서 **수동 실행 전용**이다. 워크플로가 없다.

**수집원의 한국어는 기계번역이다.** `을(를)` 미해결 조사, `영웅는` 같은 오류,
`infantry`/`combat` 미번역이 그대로 있다. 그래서 **수치·구조만 가져오고 문장은
영문 원문을 보고 새로 쓴다.** 영웅 이름도 마찬가지다 — 거기서는 Long Fei 를 "롱페이"라
부르지만 게임 내 표기는 **용비**다. `name` 필드는 공식 위키 한국어판을 따르고
수집원 표기로 덮어쓰지 않는다.

## 기프트 코드 갱신법

`src/data/gift-codes.json` 하나만 고치면 `/gift-codes/` 페이지가 따라 바뀐다.

```json
{
  "lastChecked": "2026-09-10",
  "codes": [
    {
      "code": "KINGSHOT100",
      "rewards": "골드 100, 속성 아이템",
      "startsAt": "2026-09-10",
      "addedAt": "2026-09-10",
      "expiresAt": "2026-09-30",
      "note": "신규 계정 한정"
    }
  ]
}
```

- `code` / `rewards` / `addedAt` 은 필수, `startsAt` / `expiresAt` / `note` 는 선택.
- 날짜는 전부 `YYYY-MM-DD`.
- 유효/만료 판정은 `src/lib/gift-codes.ts` 의 `statusOf()` 한 곳에서만 한다.
  기준일은 **한국 시간** 오늘(`todayKST()`)이다. 빌드가 UTC 로 돌아도 하루가 어긋나지 않게.
- `startsAt` 이 오늘보다 미래면 `예정`, `expiresAt` 이 오늘보다 과거면 `만료`,
  나머지는 `활성`. 날짜가 아예 없으면 계속 유효한 코드로 본다.
- **확인 안 된 코드는 올리지 않는다.** [공식 교환 페이지](https://ks-giftcode.centurygame.com)에서
  실제로 교환되는지 확인한 것만 추가하고, 확인할 때마다 `lastChecked` 를 그날 날짜로 바꾼다.
- `codes` 가 빈 배열이면 페이지에 "현재 확인된 코드가 없습니다" 안내가 뜬다.
- `rewards` 는 필수 필드지만 **모르면 빈 문자열 `""` 로 둔다.** 표에 `보상 미확인` 으로
  나온다. 추측한 보상을 적지 않는다.

### 자동 동기화

두 곳에서 코드를 긁어와 `gift-codes.json` 에 **병합**하는 스크립트가 있다.

- `ks.h5joy-games.com/ko/gift-code/` — 과거 코드까지 80여 개를 유효기간과 함께 들고 있다.
  `startsAt` / `expiresAt` 은 전부 여기서 온다.
- `kingshotwiki.com/ko/giftcode/`(공식 위키) — 날짜는 없지만 갓 풀린 코드가 먼저 올라온다.

```powershell
node scripts/sync-gift-codes.mjs
```

`.github/workflows/sync-gift-codes.yml` 이 매일 **한국 시간 오전 9시**
(cron `0 0 * * *`, UTC 기준 00:00)에 자동으로 돌리고, `gift-codes.json` 에
변경이 있을 때만 커밋·푸시한다. 푸시되면 Vercel 이 재배포한다.
Actions 탭에서 **Run workflow** 로 수동 실행도 된다.

병합 규칙

- 새 코드만 덧붙인다. 출처에서 사라진 코드도 **지우지 않는다** —
  만료된 건지 파싱이 실패한 건지 구분할 수 없기 때문.
- 이미 있는 코드의 `rewards` / `note` 는 덮어쓰지 않는다.
  손으로 채워 넣은 값이 날아가지 않게 하기 위한 것.
- `startsAt` / `expiresAt` 은 **비어 있을 때만** 새로 알게 된 날짜로 채운다.
  값이 이미 있으면 손대지 않는다.
- `lastChecked` 는 실행할 때마다 오늘(한국 시간)로 갱신한다.

안전장치 — 조용히 빈 배열로 덮어써서 페이지를 비워 버리는 일이 없어야 한다는 게 요점이다.

- 두 출처 중 **하나라도** 살아 있으면 진행한다. 죽은 쪽은 경고만 찍는다.
  한쪽 사이트가 잠깐 죽었다고 매일 도는 워크플로를 통째로 실패시키지 않는다.
- 둘 다 실패하거나 합쳐서 코드가 0개면 **파일을 쓰지 않고 exit 1** 로 죽고,
  워크플로도 같이 실패한다.
- 코드 형식(영숫자 4~20자)에 안 맞는 값은 그 항목만 버리고 경고한다.
  날짜 형식이 어긋나면 그 날짜만 무시한다.

**사이트 구조가 바뀌면** `scripts/sync-gift-codes.mjs` 의 파서를 고친다.
공식 위키 쪽은 본문의 `<span class="code">KS0909</span>` 마크업(`CODE_PATTERN`) 하나만 보고,
h5joy 쪽은 SSR 페이로드의 `giftCodes:[...]` 를 필드별 정규식으로 훑는다
(배열 안에 호이스팅된 변수 참조가 섞여 있어서 통째로 JSON 파싱하면 깨진다).
추측하지 말고 `curl` 로 실제 HTML 을 받아 눈으로 확인한 뒤 고칠 것.
고치기 전에 `curl -A "Mozilla/5.0" https://kingshotwiki.com/ko/giftcode/` 로 받아
실제 HTML을 눈으로 확인할 것. URL 자체가 바뀌었다면 `SOURCE_URL` 도 같이 고친다.

## 배포 전 체크리스트

- [ ] `astro.config.mjs` 의 `SITE` 를 실제 도메인으로 교체
- [ ] `public/robots.txt` 의 `Sitemap:` 줄 도메인 교체
- [ ] `src/layouts/BaseLayout.astro` 의 `NAVER_SITE_VERIFICATION` 값 입력
- [ ] `public/og-default.png` (1200×630) 추가

## 네이버 서치어드바이저 등록 절차

1. https://searchadvisor.naver.com 접속 → 네이버 계정 로그인.
2. **웹마스터 도구 → 사이트 등록**에 배포 도메인(`https://도메인/`)을 입력.
3. 사이트 소유확인 방법에서 **HTML 태그**를 선택하면 `content` 값이 나온다.
4. 그 값을 `src/layouts/BaseLayout.astro` 상단의
   `const NAVER_SITE_VERIFICATION = ''` 에 넣는다. 값이 있을 때만 메타 태그가 렌더된다.
5. 재배포 후 서치어드바이저에서 **소유확인** 버튼을 누른다.
6. 확인되면 **요청 → 사이트맵 제출**에 `sitemap-index.xml` 을 등록하고,
   **robots.txt 수집 요청**도 함께 진행한다.
7. 추가로 **웹페이지 수집**에서 주요 URL을 수동 수집 요청하면 초기 색인이 빨라진다.

> 구글은 Search Console에서 동일하게 `sitemap-index.xml` 을 제출한다.

## 폰트

현재 Pretendard를 jsDelivr dynamic-subset CSS로 불러온다
(`BaseLayout.astro`, v1.3.9). **추후 `public/fonts/` self-host 로 전환 예정** —
CDN 의존 제거와 LCP 개선을 위해 woff2 서브셋을 직접 서빙하고 `@font-face` 를
`global.css` 로 옮기면 된다.

## 디자인 토큰

`src/styles/global.css` 의 `:root` 에 원시 팔레트(`--ks-*`)를 두고
`@theme inline` 이 Tailwind 색상 유틸(`bg-surface`, `text-muted`,
`text-rarity-ssr` 등)로 노출한다. 라이트 테마는 나중에
`[data-theme="light"]` 블록에서 `--ks-*` 만 재정의하면 얹힌다.

## 고지

본 사이트는 Kingshot 이용자가 운영하는 비공식 팬 사이트입니다.
Kingshot 및 관련 이미지·명칭의 모든 권리는 Century Games에 있습니다.
