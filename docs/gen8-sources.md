# 8세대 영웅 출처 메모

확인일: 2026-10-17. 적용 대상은 `diego.md`, `liz.md`, `luna.md`와 `gen8-` 접두 이미지뿐이다.

## 원문 URL

- 한국어명 우선 확인: https://kingshotwiki.com/ko/heroes/
- 디에고: https://kingshotwiki.com/ko/heroes/kingshot_wiki_diego_kingshot_end/
- 리지: https://kingshotwiki.com/ko/heroes/kingshot_wiki_liz_kingshot_end-2/
- 루나: https://kingshotwiki.com/ko/heroes/kingshot_wiki_luna_kingshot_end/
- 디에고 대조: https://kingshot.net/heroes/diego
- 리지 대조: https://kingshot.net/heroes/liz
- 루나 대조: https://kingshot.net/heroes/luna
- 세대·영문명·레벨별 수치·획득 경로 대조: https://kingshotdata.com/heroes/generation-8-heroes/

## 반영 기준

한국어 영웅명은 디에고·리지·루나이며 스킬 24개의 한국어명도 공식 페이지에서 확인했다. 효과 설명은 기능만 짧게 재서술했다. 미확인 번역 스킬명은 없다. 공식 위키와 Kingshot.net의 토벌 스탯이 달라 공식값을 사용했다. 디에고 장비도 공식 1737/1737/17370을 우선했다.

디에고 ‘검의 의지’의 두 수치 배열은 공식 `1/3/3/4/5%`를 보존했다. Kingshot Database의 `1/2/3/4/5%`로 보정하지 않았다.

리지 장비명 제목은 공식 한국어 페이지에서 비어 있다. `Midas Staff`는 두 커뮤니티 자료의 영문명이며 한국어 장비명은 미확인이다. 루나 장비명 제목도 비어 있으나, 공식 스토리와 장비 스킬 설명의 ‘고대 수호자’를 사용했다. 루나 원정 스탯의 누락된 `%` 단위는 두 대조 자료로 확인했다.

장비 부속품 수량은 출처에 없어 `parts`를 생략했다. 평가를 뒷받침하는 검증 자료가 없어 세 영웅 모두 `ratings: {}`다. 리지의 패키지 분류는 공통 획득 경로인 Daily Deals, 루나는 Hall of Heroes에 근거한다.

## 공식 이미지 URL 대응

아래 파일명은 각 공식 상세 페이지의 실제 `img src`에서 확인했다. URL은 공통 접두와 원본 파일명을 결합한 값이다.

공통 접두: `https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2026/09/`

| 영웅 | ID | 초상화 원본 파일명 | 장비 원본 파일명 |
| --- | --- | --- | --- |
| diego | 50034 | hero_headpic_50034_orange_reference_effect_128_v4.png | equipment_icon_1050034.png |
| liz | 50035 | hero_headpic_50035_orange_reference_effect_128_v4.png | equipment_icon_1050035.png |
| luna | 50036 | hero_headpic_50036_orange_reference_effect_128_v4.png | equipment_icon_1050036.png |

초상화는 `src/assets/heroes/gen8-{slug}.png`, 장비는 `src/assets/gear/gen8-{slug}-gear.png`에 저장한다.

스킬 원본은 `hero_skill_icon_{ID}{n}.png`이며 `n=1..8`이다. 1–3은 토벌, 4–6은 원정, 7–8은 장비의 토벌·원정 스킬 순서다. 각 파일은 `src/assets/skills/gen8-{slug}-{n}.png`에 저장한다. 예: 디에고 첫 스킬의 정확한 URL은 https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2026/09/hero_skill_icon_500341.png 이다.

원본 PNG를 그대로 저장하며 크롭·리사이즈·이미지 재생성을 하지 않는다. 전체 빌드와 배포는 통합 작업 담당자가 수행한다.

## 수행한 검사

- 기존 `src/content.config.ts`의 heroes 스키마를 메모리에서 불러와 3개 프론트매터 검사 통과. Astro 이미지 헬퍼는 경로 문자열 검사로 대체하고, 실제 참조 파일은 별도로 PNG 디코딩 검사했다.
- 공식 한국어 원문과 스킬명 24개·5단계 수치 배열 29개를 자동 대조해 일치 확인. `{v1}`·`{v2}` 자리표시자와 토벌/원정 구분도 검사했다.
- 초상화 3개·장비 3개·스킬 24개의 경로 존재 및 PNG 형식·크기 검사 통과. 다운로드 URL이 해당 공식 상세 HTML에 존재하는지도 확인했다.
- 각 영웅의 일반 스킬 6개·장비 스킬 2개, 빈 평가, `parts` 생략 확인.
- 전체 빌드·커밋·배포는 수행하지 않았다.
