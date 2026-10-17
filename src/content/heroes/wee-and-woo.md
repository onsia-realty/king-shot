---
name: 웨이&론
nameEn: Wee & Woo
generation: 7
rarity: SSR
troopClass: 궁병
portrait: ../../assets/heroes/wee-and-woo.webp
acquisition: 영웅룰렛
summary: 광역 포격과 부대 공격력·파괴력 증가를 갖춘 7세대 궁병 듀오
heroClass: 전투
stats:
  exploration:
    attack: 8656
    defense: 7126
    hp: 53446
  expedition:
    attack: "650.52%"
    defense: "650.52%"
skills:
  - name: "더 높게, 더 멀리"
    nameEn: High Ground
    icon: ../../assets/skills/gen7-wee-and-woo-1.png
    mode: 토벌
    description: "공격력 * {v1}의 광역 피해를 줍니다."
    levels: ["300%","330%","360%","390%","420%"]
  - name: "연소탄"
    nameEn: Incendiaries
    icon: ../../assets/skills/gen7-wee-and-woo-2.png
    mode: 토벌
    description: "공격력 * {v1}의 광역 피해를 줍니다. 남은 화염은 2초 동안 0.5초마다 주변 적에게 공격력 * {v2}의 피해를 줍니다."
    levels: ["60%","66%","72%","78%","84%"]
    levels2: ["17%","19%","21%","23%","25%"]
  - name: "저 녀석을 버려"
    nameEn: Frontal Support
    icon: ../../assets/skills/gen7-wee-and-woo-3.png
    mode: 토벌
    description: "공격력이 {v1} 증가합니다."
    levels: ["10%","14%","18%","22%","26%"]
  - name: "포병단"
    nameEn: Artillerymen
    icon: ../../assets/skills/gen7-wee-and-woo-4.png
    mode: 원정
    description: "아군 부대의 총 공격력이 {v1}, 총 파괴력이 {v2} 증가합니다."
    levels: ["3%","6%","9%","12%","15%"]
    levels2: ["2%","4%","6%","8%","10%"]
  - name: "연쇄 포탄"
    nameEn: Chain Shelling
    icon: ../../assets/skills/gen7-wee-and-woo-5.png
    mode: 원정
    description: "아군 부대가 적 궁병에게 주는 피해가 {v1}, 적 보병에게 주는 피해가 {v2} 증가합니다."
    levels: ["6%","12%","18%","24%","30%"]
    levels2: ["5%","10%","15%","20%","25%"]
  - name: "중포 출격"
    nameEn: Boom Boom
    icon: ../../assets/skills/gen7-wee-and-woo-6.png
    mode: 원정
    description: "아군 부대의 공격이 {v1} 확률로 50% 추가 피해를 줍니다."
    levels: ["10%","20%","30%","40%","50%"]
exclusiveGear:
  name: 중형 화포
  nameEn: Mortar
  icon: ../../assets/gear/gen7-wee-and-woo-gear.png
  exploration:
    attack: 1752
    defense: 1444
    hp: 10833
  expedition:
    lethality: "160.50%"
    hp: "160.50%"
  parts: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
  skills:
    - name: "무정한 포수"
      nameEn: Zero Sympathy
      icon: ../../assets/skills/gen7-wee-and-woo-7.png
      mode: 토벌
      description: "5초 동안 영웅과 호위병의 공격 속도가 {v1} 증가합니다."
      levels: ["6%","8%","10%","12%","14%"]
    - name: "지뢰 매설"
      nameEn: Landmines
      icon: ../../assets/skills/gen7-wee-and-woo-8.png
      mode: 원정
      description: "수비 부대의 공격력이 {v1} 증가합니다."
      levels: ["5%","7.5%","10%","12.5%","15%"]
order: 703
---

## 스킬 구성과 획득

토벌에서는 광역 포격과 화염의 지속 피해를 사용합니다. 원정은 부대 공격력·파괴력 증가, 적 궁병·보병 대상 피해 증가, 확률형 추가 피해로 구성됩니다. 전용 장비에는 수비 부대 공격력 증가가 있어 아레나 전용 영웅으로 단정하지 않습니다.

공식 획득 경로는 영웅 룰렛입니다.

## 수치 기준과 확인 사항

능력치는 공식 위키의 영웅 총 속성·전용 장비 총 속성 표시값입니다. 스킬 수치는 1~5레벨 순서이며, 장비 부속품은 강화 1~10단계의 소모량입니다. 출처가 다른 수치는 섞지 않았습니다.

토벌 공격력 8,656·방어력 7,126·HP 53,446은 공식 값입니다. Kingshot.net의 8,658·7,125·53,435와 다릅니다. 공식 스킬명 ‘저 녀석을 버려’를 그대로 유지했습니다. 무정한 포수는 공개 설명에 없는 발동 조건을 추가하지 않았습니다.

## 출처

2026-10-17 확인. 한국어 이름·스탯·스킬명·단계별 효과·이미지는 [공식 한국어 위키](https://kingshotwiki.com/ko/heroes/kingshot_wiki_hero_name_50033_kingshot_end/)를 우선했습니다. [Kingshot.net](https://kingshot.net/heroes/wee-woo)와 [Kingshot Database 7세대](https://kingshotdata.com/heroes/generation-7-heroes/)로 영문명과 장비 부속품 수량을 교차 확인했습니다.
