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

### 아직 안 채운 데이터

다음 항목은 스키마에 자리만 있고 비어 있다. **공식 위키 상세 페이지에 값이 있으니**
채울 때 거기서 가져오면 된다.

- 영웅: `stats`(공격·방어·체력), `skills`(원정/성장/합류 스킬명과 설명), `exclusiveGear`
- 펫: `skills`(스킬명과 설명)
- 건물: `unlock`(해금 조건), `maxLevel`(최대 레벨)

## 기프트 코드 갱신법

`src/data/gift-codes.json` 하나만 고치면 `/gift-codes/` 페이지가 따라 바뀐다.

```json
{
  "lastChecked": "2026-09-10",
  "codes": [
    {
      "code": "KINGSHOT100",
      "rewards": "골드 100, 속성 아이템",
      "addedAt": "2026-09-10",
      "expiresAt": "2026-09-30",
      "note": "신규 계정 한정"
    }
  ]
}
```

- `code` / `rewards` / `addedAt` 은 필수, `expiresAt` / `note` 는 선택.
- 날짜는 전부 `YYYY-MM-DD`.
- `expiresAt` 이 빌드 시각보다 이르면 자동으로 "만료된 코드" 표로 내려간다.
  `expiresAt` 이 없으면 계속 유효한 코드로 본다.
- **확인 안 된 코드는 올리지 않는다.** [공식 교환 페이지](https://ks-giftcode.centurygame.com)에서
  실제로 교환되는지 확인한 것만 추가하고, 확인할 때마다 `lastChecked` 를 그날 날짜로 바꾼다.
- `codes` 가 빈 배열이면 페이지에 "현재 확인된 코드가 없습니다" 안내가 뜬다.

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
