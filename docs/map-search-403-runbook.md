# 지도·이름 검색 403 진단과 복구 런북

기준: 2026-10-31 복원 코드. 지도·검색이 비거나 실패할 때 **실패한 요청의 목적지와 응답 종류부터 구분**한다. 브라우저 → 우리 API → 공개 원본 또는 기존 DB → 화면의 각 구간을 따로 확인한다. 이 문서는 실행 절차이며 배포 완료 기록이 아니다.

## 확인된 사실과 남은 불확실성

[당시 측정 원문](map-origin-comparison-2026-10-31.md)에 같은 PC의 Node fetch로 같은 지도 URL을 순차 비교한 결과가 있다. 인증·쿠키·프록시 없이 네 번 요청했다.

| 명시적으로 설정한 헤더 | 상태 | 응답 | cf-mitigated |
|---|---|---|---|
| 없음: Node 기본 UA | 403 | HTML | challenge |
| Accept JSON만 | 403 | HTML | challenge |
| 사이트 UA만 | 200 | JSON | 없음 |
| 사이트 UA + Accept JSON | 200 | JSON | 없음 |

실제 요청 순서는 기본 → 둘 다 → Accept만 → UA만이다. 사이트 UA는 `kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)`로 실제 서비스 식별자이며 브라우저나 다른 서비스를 사칭하지 않는다. 이 제한된 비교에서는 UA 변경이 성공 여부와 일치했고 Accept만으로는 해결되지 않았다.

같은 PC라는 사실이 모든 변수를 통제했다는 뜻은 아니다. 요청 시각·Cloudflare 엣지·보안 상태 등이 달랐고, PC와 Vercel 비교에서는 Node 패치 버전·네트워크 경로·자동 헤더도 달랐다. 동일 진단 소스와 명시적 헤더를 쓴 PC 및 **운영과 같은 지역인 Vercel preview iad1에서도 200 JSON**을 확인했다. 따라서 당시 결과로 Vercel 전체 차단, 키 문제, 결제 필요를 단정할 수 없다.

UA가 보안 판단에 영향을 주었다는 설명은 관측과 부합하지만 **정확한 Cloudflare 규칙·점수·운영자 의도는 관리자 로그 없이는 확정할 수 없다.** 영구 허용이나 사용 권한을 입증한 것도 아니다. 과거의 코드 1010 설명만으로 이번 `cf-mitigated: challenge`를 특정 규칙으로 확정하지 않는다.

## 먼저 구분할 실패

| 관측 위치·증상 | 해석과 다음 확인 |
|---|---|
| `mightpulse.com/api/map` 또는 `/api/search`가 403 HTML, `cf-mitigated: challenge` | 공개 원본에서 보안 챌린지를 받았다. 키를 추가할 문제가 아니다. 아래 단일 요청으로 실제 UA·응답 메타데이터를 비교한다. 모든 403이 같은 챌린지는 아니다. |
| 우리 `/api/map`, `/api/search`, `/api/player`가 403 JSON, `error: forbidden` | `same-site.ts`의 접근 제한일 수 있다. 실제 사이트 화면에서 재현하고 Host와 Origin/Referer 또는 `Sec-Fetch-Site` 관계를 확인한다. 원본 호출 전에 거부될 수 있다. CLI 직접 호출의 403을 원본 차단으로 오인하거나 보호 코드를 제거하지 않는다. |
| `api.mightpulse.com/v1/players/...`가 401 | 공식 프로필 API 인증 문제다. 서버의 `MIGHTPULSE_API_KEY` 설정 존재 여부·환경 범위를 확인한다. 우리 프로필 API는 제공처 401/403을 502 `upstream_auth`로 매핑하므로 상태 코드만으로 구분하지 않는다. 키가 없으면 우리 API는 503 `missing_key`다. |
| 공식 API가 429 또는 우리 API가 429 `rate_limited` | 제공처 할당량, 우리 same-site 요청 제한, 인스턴스 동시 실행 제한을 구분한다. `Retry-After`가 있으면 따른다. 반복 재시도로 확인하지 않는다. |
| 우리 API가 503 `storage_unavailable` | 기존 DB 대체 경로의 연결 문자열 누락·연결 실패·스키마/조회 문제다. `DATABASE_URL` 또는 `POSTGRES_URL`의 설정 여부와 해당 배포 환경을 확인한다. 값은 출력하지 않는다. 원본 성공에는 DB가 필요 없다. |
| 우리 지도/왕국 검색이 202 `not_collected` | DB에 아직 수집된 자료가 없는 상태다. 큐 등록은 완료 시각이나 자동 수집을 보장하지 않는다. |
| 200이지만 `stale: true` 또는 `partial: true` | 정상 원본 복구와 동일하지 않다. 이전 메모리 스냅샷이나 DB 부분 자료일 수 있으므로 `source`, 원본 시각, 건수를 함께 본다. |

공개 원본 실패는 이전 스냅샷 또는 DB로 대체되므로 우리 API 상태만으로 원본의 403을 역추정할 수 없다. HTML 챌린지·파싱 실패를 빈 배열의 성공 응답으로 바꾸지 않는다.

## 안전한 단일 요청 재현

Node 22 이상과 PowerShell에서 아래 블록을 실행한다. 한 번 실행하면 공개 지도에 **GET 한 번만** 보낸다. API 키·쿠키·Referer·프록시를 쓰지 않으며 재시도·리다이렉트도 하지 않는다. 본문은 건수·형식 확인에만 사용하고 출력하지 않는다.

```powershell
@'
const mode = 'site-and-accept'; // default | accept | site | site-and-accept
const ua = 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)';
const variants = {
  default: {},
  accept: { Accept: 'application/json' },
  site: { 'User-Agent': ua },
  'site-and-accept': { 'User-Agent': ua, Accept: 'application/json' },
};
if (!Object.hasOwn(variants, mode)) throw new Error('invalid diagnostic mode');
const started = Date.now();
try {
  const response = await fetch('https://mightpulse.com/api/map?kid=1622&layers=cities&limit=50000', {
    headers: variants[mode], redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  const body = await response.text();
  let data = null;
  if (response.ok && /application\/json/i.test(response.headers.get('content-type') ?? '')) {
    try { data = JSON.parse(body); } catch { /* only metadata is reported */ }
  }
  console.log(JSON.stringify({
    utc: new Date().toISOString(), node: process.version, mode,
    region: process.env.VERCEL_REGION ?? 'local', status: response.status,
    contentType: response.headers.get('content-type'),
    cfMitigated: response.headers.get('cf-mitigated'), cfRay: response.headers.get('cf-ray'),
    challengeMarker: body.includes('challenge-platform'), bytes: Buffer.byteLength(body),
    cities: Array.isArray(data?.cities) ? data.cities.length : null,
    alliances: Array.isArray(data?.alliances) ? data.alliances.length : null,
    locationUpdatedAt: typeof data?.stats?.location_updated_at === 'number'
      ? data.stats.location_updated_at : null,
    elapsedMs: Date.now() - started,
  }, null, 2));
} catch {
  console.log(JSON.stringify({ utc: new Date().toISOString(), mode,
    error: 'request_failed_or_timed_out', elapsedMs: Date.now() - started }));
  process.exitCode = 1;
}
'@ | node --input-type=module
```

필요한 경우에만 `mode`를 하나씩 바꿔 네 조건을 비교한다. 같은 키의 실패 후 최소 30초 쉬고, 챌린지가 지속되면 중단한다. 자동 루프·부하 시험으로 확대하지 않는다. 검색 진단이 필요하면 URL을 공개 `/api/search?q=...&live=0`으로 바꾸고 배열 건수 항목을 `results`로 맞춘 단일 요청을 사용한다.

로컬과 Vercel을 비교할 때는 같은 소스·URL·명시적 헤더로 별도 preview 진단을 준비하고 **현재 운영 함수와 같은 지역**에서 실행한다. 2026-10-31에는 iad1이었으나 현재 배포의 실제 지역을 다시 확인한다. Node 버전, UTC 시각, 배포 식별자, 지역, HTTP 상태, Content-Type, cf-mitigated, cf-ray, 소요 시간과 건수를 나란히 기록한다. preview 접근은 정상적인 Vercel 인증 절차를 사용하고 진단에서 공식 키를 원본으로 보내지 않는다. preview 생성은 배포 작업 범위 안에서 수행하며, 이 문서를 읽었다고 자동 생성하지 않는다.

전체 환경변수, Authorization, DB 연결 문자열, Cookie/Set-Cookie, 인증된 요청 복사본, 원본 HTML·전체 개인정보 JSON은 로그·문서·스크린샷에 남기지 않는다. 프록시 순환, IP 교체, 브라우저 쿠키 복사, 브라우저 사칭으로 통과시키지 않는다. 위 진단으로 해결되지 않으면 안전한 메타데이터를 근거로 제공처에 확인한다.

## 복원할 위치와 유지할 동작

| 파일 | 확인할 책임 |
|---|---|
| `src/lib/server/mightpulse-discovery.ts` | 실제 서비스 UA·Accept, 공개 요청에 키 미전송, JSON 검증, 10초 제한, `publicSnapshot`, 안전한 JSON 오류 |
| `src/lib/server/mightpulse-map.ts` | 원본 지도 정규화, 도시·연맹·좌표 검증, 이전 스냅샷과 기존 DB 대체 |
| `api/map.ts`, `api/search.ts` | 지도 원본 우선, 왕국 검색은 지도 필터, 전역 검색은 공개 검색, source/stale/partial 전달 |
| `src/lib/server/kingdom-store.ts` | 기존 DB 자료 조회와 큐 등록, DB 오류의 비밀정보 제거 |
| `api/player.ts`, `src/lib/server/same-site.ts` | 공식 프로필 인증과 UID/FID 분리, 우리 사이트 접근 제한 유지 |
| `src/components/islands/StoredKingdomMap.tsx`, `KingdomMap.tsx`, `KingdomMapCanvas.tsx`, `PlayerLocationMap.tsx`, `PlayerDiscovery.tsx` | 지도·검색·상세 아래 지도, 도시 선택·장비 조회. 현재 `fresh=1` 다시 불러오기는 `StoredKingdomMap.tsx`에 있다. |
| `api/map-refresh.ts`, `src/lib/map-refresh.ts`, `src/components/islands/MapRefresh.tsx` | 기존 수집 큐용 경로. 현재 지도 스냅샷 다시 읽기와 혼동하지 않는다. |
| `astro.config.mjs`, `vercel.json` | 로컬 Node 핸들러 연결, 경로·함수 시간 제한. 정적 preview만으로 API 검증하지 않는다. |

현재 지도·검색의 정상 원본 메모리 캐시는 **60초**다. 지도 최대 10개 왕국, 전역 검색 최대 100개 검색어로 제한하며 동일 인스턴스의 같은 키에 대해 진행 중 요청을 합친다. 왕국 검색은 정규화한 도시를 저장한 뒤 요청마다 필터링하므로 서로 다른 검색어가 결과를 덮어쓰지 않아야 한다. 인스턴스 간 공유나 전체 배포의 할당량 보장은 없다.

공개 fetch는 응답 본문 처리까지 **10초**에 중단한다. 실패하면 **30초 동안 원본 재요청을 보류**하고, 저장 시각 기준 **1시간 미만**의 이전 정상 스냅샷을 `stale: true`로 제공한다. 실패가 수명을 연장하지 않는다. 이전 자료가 없거나 만료되면 **기존 DB**로 대체한다. DB 결과는 30초 메모리 캐시하며 `source: official_profiles`, `partial: true`, `stale: true`로 표시한다. 원본 성공 결과를 새 DB에 영구 저장하는 설계는 아니다.

콜드 시작·재배포·인스턴스 교체·캐시 퇴출 뒤에는 이전 정상 메모리 자료가 없다. DB에 일부 좌표만 있으면 부분 지도, 자료가 없으면 202, DB 연결까지 없으면 503이 될 수 있다. 원본 시각을 현재 시각으로 바꾸거나 DB 수집 시각을 게임 위치 갱신 시각으로 표시하지 않는다.

정상 원본은 남은 TTL만큼 최대 60초 CDN 캐시하고 stale·DB 대체·오류·지도 `fresh=1`은 `no-store`다. `fresh=1`은 정상 캐시를 건너뛰어 **제공처에 저장된 스냅샷을 다시 읽는 요청**이며 게임 재수집이 아니다. 실패 대기 30초와 진행 중 요청 합치기는 우회하지 않는다. 프로필 API의 95초 제한·5분 캐시, Vercel의 지도/검색 60초·프로필 120초 함수 제한과 구분한다.

수집기는 **선택적 수동 백업**이다. `.github/workflows/collect-kingdoms.yml`은 예약을 끄고 `workflow_dispatch`만 사용하는 방침이며, 배포할 기본 브랜치에 `schedule`이 없는지 확인한다. 큐 등록 후 자동으로 매시간 수집된다고 안내하지 않는다. 수동 실행 전 호출 예산과 키·DB 설정을 확인하고, 기존 DB를 지우거나 새 수집 완료를 원본 복구의 전제 조건으로 삼지 않는다.

## 검증과 배포·롤백

1. 변경 전 `git status --short`와 관련 diff를 확인한다. 다른 작업자의 수정은 보존하고 담당 파일만 수정한다. 현재 운영 배포 ID·커밋·함수 지역과 복귀 후보를 기록한다.
2. 먼저 모의 테스트로 원본 403/HTML/잘못된 JSON/본문 시간 초과, 30초 대기, 1시간 만료, DB 대체, 요청 합치기, same-site, UID/FID 분리를 검증한다. 테스트 이름·수·결과는 이번 실행 기록을 남긴다.

   ```powershell
   node --test tests/mightpulse-api.test.mjs tests/mightpulse-discovery.test.mjs tests/same-site.test.mjs tests/map-refresh.test.mjs
   npm run check
   npm run build
   ```

3. 로컬은 `npm run dev`에서 확인한다. `npm run preview`는 정적 결과 확인용으로 Node API를 실행하지 않는다. 실제 사이트 화면에서 지도 → 닉네임 필터 → 도시 선택 → UID 프로필·장비 → 상세 아래 왕국 지도를 확인한다. 왕국 지정/미지정 검색, 다시 불러오기, stale/partial 표시도 확인한다.
4. live 확인은 왕국·검색어별 소수 요청으로 HTTP 상태, source/stale/partial, 도시·검색 결과 건수, 원본 시각을 기록한다. 당시 예시는 1622 도시 1332, 1601 도시 1375, zeras 검색 왕국 지정 2·미지정 21이었다. **고정 기대값으로 테스트하지 않는다.** 자료가 바뀔 수 있고 전역 검색은 제한될 수 있다. 연맹 메타데이터 배열 수와 도시 aid 기반 그룹 수도 서로 다르다. 건수 차이가 크면 원본과 정규화·필터·대체 경로를 비교한다.
5. 승인된 배포 범위에서 preview를 먼저 검증하고 운영과 같은 지역·환경 설정을 확인한 뒤 운영에 반영한다. 비밀값은 존재 여부만 확인하며 공개 빌드 산출물·응답에 포함되지 않아야 한다. 실제 배포 ID와 검증 시각을 기록하고 운영 도메인의 같은 화면 흐름을 재확인한다. HTTP 200만으로 복구 완료 처리하지 않는다.
6. 회귀 시 Vercel에서 **복귀 후보로 검증한 이전 배포**로 운영 연결을 되돌린다. 로컬 작업 트리를 `reset --hard`하거나 DB를 삭제해서 롤백하지 않는다. 환경변수·DB 상태는 코드 배포와 별개이므로 호환성을 확인한다. **바로 전 배포도 이미 지도 장애가 있었을 수 있다.** 후보의 지도·검색·프로필 동작을 먼저 확인하고, 정상 후보가 없으면 롤백을 해결책으로 단정하지 말고 부분 서비스 상태를 명시한 최소 수정으로 복구한다. 복귀 후에도 콜드 시작과 live 상태를 다시 검증한다.

당시 측정 문서의 테스트 151개·96페이지 빌드 기록은 과거 결과다. 이번 테스트·빌드·live·배포를 수행한 증거로 재사용하지 않는다.

## 재발 방지 빠른 점검

- [ ] 403을 공개 원본 챌린지와 우리 `forbidden`으로 구분했는가?
- [ ] 실제 서비스 UA와 JSON Accept를 유지하고 공개 요청에 키·쿠키를 보내지 않는가?
- [ ] 10초 fetch, 60초 캐시, 30초 실패 대기, 1시간 stale 한도와 인스턴스별 상한이 유지되는가?
- [ ] HTML·오류가 정상 캐시를 덮어쓰지 않고 source/stale/partial 및 원본 시각이 보존되는가?
- [ ] 콜드 시작·DB 누락·부분 좌표 상태를 검증했는가?
- [ ] 다시 불러오기가 재수집을 약속하지 않고 수집기는 선택적 수동 실행인가?
- [ ] 로컬/같은 지역 preview/운영 검증 결과를 구분하고 건수를 고정하지 않았는가?
- [ ] 로그에 비밀정보가 없고 정상 동작을 확인한 롤백 후보가 있는가?
