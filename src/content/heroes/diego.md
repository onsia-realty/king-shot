---
name: 디에고
nameEn: Diego
generation: 8
rarity: SSR
troopClass: 보병
portrait: ../../assets/heroes/gen8-diego.png
acquisition: 영웅룰렛
summary: 보호막과 회피로 버티며 아군의 방어력·HP·파괴력을 높이는 8세대 전설 보병
stats:
  exploration:
    attack: 6573
    defense: 8568
    hp: 128538
  expedition:
    attack: "780.62%"
    defense: "780.62%"
heroClass: 전투
skills:
  - name: 철통같은 방어
    nameEn: Undefendable
    icon: ../../assets/skills/gen8-diego-1.png
    mode: 토벌
    description: 공격력 * {v1}의 보호막을 얻는다. 최대 5초 동안 유지되며 피해를 먼저 흡수한다.
    levels: ["220%", "260%", "300%", "340%", "380%"]
  - name: 검의 의지
    nameEn: Blade Soul
    icon: ../../assets/skills/gen8-diego-2.png
    mode: 토벌
    description: 3초 동안 적 영웅들의 공격력을 {v1} 낮추고, 자신의 공격력을 위협한 영웅 수 * {v2}만큼 높인다.
    levels: ["1%", "3%", "3%", "4%", "5%"]
    levels2: ["1%", "3%", "3%", "4%", "5%"]
  - name: 이형환영
    nameEn: Shadow Flicker
    icon: ../../assets/skills/gen8-diego-3.png
    mode: 토벌
    description: 일반 공격을 {v1} 확률로 피하고, 자신의 공격은 {v2} 확률로 치명타가 된다.
    levels: ["3%", "6%", "9%", "12%", "15%"]
    levels2: ["4%", "8%", "12%", "16%", "20%"]
  - name: 방어 지도
    nameEn: Defensive Guidance
    icon: ../../assets/skills/gen8-diego-4.png
    mode: 원정
    description: 아군 전체 부대의 총 방어력을 {v1}, 총 HP를 {v2} 높인다.
    levels: ["3%", "6%", "9%", "12%", "15%"]
    levels2: ["2%", "4%", "6%", "8%", "10%"]
  - name: 검기 무형
    nameEn: Piercing Aura
    icon: ../../assets/skills/gen8-diego-5.png
    mode: 원정
    description: 아군 전체 부대가 공격할 때 50% 확률로 {v1}의 추가 피해를 준다.
    levels: ["10%", "20%", "30%", "40%", "50%"]
  - name: 검의 숙정
    nameEn: Cold Frost
    icon: ../../assets/skills/gen8-diego-6.png
    mode: 원정
    description: 아군 전체 부대의 총 파괴력을 {v1} 높인다.
    levels: ["5%", "10%", "15%", "20%", "25%"]
exclusiveGear:
  name: 운철검
  nameEn: Meteor Blade
  icon: ../../assets/gear/gen8-diego-gear.png
  exploration:
    attack: 1737
    defense: 1737
    hp: 17370
  expedition:
    lethality: "193.00%"
    hp: "193.00%"
  skills:
    - name: 중검무봉
      nameEn: Doomblade
      icon: ../../assets/skills/gen8-diego-7.png
      mode: 토벌
      description: 철통같은 방어에 공격력 * {v1}의 보호막을 추가한다. 보호막이 있는 동안 받은 피해의 {v2}를 반사한다.
      levels: ["55%", "65%", "75%", "85%", "95%"]
      levels2: ["10%", "15%", "20%", "25%", "30%"]
    - name: 궁극의 간결함
      nameEn: Extraordinary
      icon: ../../assets/skills/gen8-diego-8.png
      mode: 원정
      description: 수성 부대의 방어력을 {v1} 높인다.
      levels: ["5%", "7.5%", "10%", "12.5%", "15%"]
ratings: {}
order: 801
---

## 확인한 정보

영웅 룰렛과 성검 상점에서 획득하는 8세대 보병이다. 토벌에서는 보호막·회피·피해 반사를, 원정에서는 전체 부대 강화와 수성 방어력 증가를 제공한다. 콘텐츠별 등급 평가는 검증하지 않아 비워 두었다.

## 수치 확인 메모

공식 한국어 위키의 토벌 방어력 **8,568**, HP **128,538**을 사용했다. Kingshot.net의 8,567·128,514와 다르다. 전용 장비도 공식값인 공격력·방어력 **1,737**, HP **17,370**을 사용했다. Kingshot.net의 장비 공격력 1,331·HP 26,055로 대체하지 않았다.

‘검의 의지’의 두 배열은 공식 원문에 모두 **1% / 3% / 3% / 4% / 5%**로 적혀 있다. Kingshot Database의 1% / 2% / 3% / 4% / 5%와 다르지만 임의로 보정하지 않았다. 장비 부속품 수량은 확인되지 않아 생략했다.

## 출처

2026-10-17 확인. 영웅·스킬·장비 한국어명과 수치는 공식 위키를 우선하고, 효과 설명은 간추려 새로 작성했다.

- [공식 한국어 영웅 목록](https://kingshotwiki.com/ko/heroes/)
- [공식 디에고 상세 — 한국어명·능력치·스킬·장비·이미지](https://kingshotwiki.com/ko/heroes/kingshot_wiki_diego_kingshot_end/)
- [Kingshot.net Diego — 세대·영문명·수치 대조](https://kingshot.net/heroes/diego)
- [Kingshot Database 8세대 — 단계별 수치 대조](https://kingshotdata.com/heroes/generation-8-heroes/)
