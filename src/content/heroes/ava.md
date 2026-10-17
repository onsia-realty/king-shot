---
name: 아이바
nameEn: Ava
generation: 7
rarity: SSR
troopClass: 기병
portrait: ../../assets/heroes/ava.webp
acquisition: 명예의전당
summary: 적 방어력을 낮추고 받는 피해를 높이며 아군 파괴력을 강화하는 7세대 기병
heroClass: 전투
stats:
  exploration:
    attack: 7126
    defense: 7126
    hp: 71262
  expedition:
    attack: "650.52%"
    defense: "650.52%"
skills:
  - name: "폭발 염료"
    nameEn: Color Bomb
    icon: ../../assets/skills/gen7-ava-1.png
    mode: 토벌
    description: "3초 동안 0.5초마다 주변 적에게 공격력 * {v1}의 피해를 줍니다."
    levels: ["50%","55%","60%","65%","70%"]
  - name: "부식 염료"
    nameEn: Corruption Bomb
    icon: ../../assets/skills/gen7-ava-2.png
    mode: 토벌
    description: "대상에게 0.5초마다 공격력 * {v1}의 피해를 주며, 2초 동안 대상이 받는 피해를 {v2} 높입니다."
    levels: ["25%","27.5%","30%","32.5%","35%"]
    levels2: ["5%","10%","15%","20%","25%"]
  - name: "위장 염료"
    nameEn: Disguise Pigment
    icon: ../../assets/skills/gen7-ava-3.png
    mode: 토벌
    description: "아이바의 방어력이 {v1} 증가합니다."
    levels: ["25%","37.5%","50%","62.5%","75%"]
  - name: "용해"
    nameEn: Dissolution
    icon: ../../assets/skills/gen7-ava-4.png
    mode: 원정
    description: "적 부대의 총 방어력이 {v1} 감소합니다."
    levels: ["5%","10%","15%","20%","25%"]
  - name: "빛과 그림자의 대비"
    nameEn: Chiaroscuro
    icon: ../../assets/skills/gen7-ava-5.png
    mode: 원정
    description: "4턴마다 2턴 동안 모든 적 병사가 받는 피해를 {v1} 높입니다."
    levels: ["10%","20%","30%","40%","50%"]
  - name: "차가움과 따뜻함의 대비"
    nameEn: Light and Cold
    icon: ../../assets/skills/gen7-ava-6.png
    mode: 원정
    description: "아군 부대의 파괴력이 {v1} 증가합니다."
    levels: ["5%","10%","15%","20%","25%"]
exclusiveGear:
  name: 변색룡
  nameEn: Chameleos
  icon: ../../assets/gear/gen7-ava-gear.png
  exploration:
    attack: 1444
    defense: 1444
    hp: 14445
  expedition:
    lethality: "160.50%"
    hp: "160.50%"
  parts: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
  skills:
    - name: "절대 색감"
      nameEn: Irradiance
      icon: ../../assets/skills/gen7-ava-7.png
      mode: 토벌
      description: "아이바가 주는 피해가 25% 증가하고, 영향을 받은 대상의 공격력이 {v1} 감소합니다."
      levels: ["5%","10%","15%","20%","25%"]
    - name: "색채 폭풍"
      nameEn: Color Storm
      icon: ../../assets/skills/gen7-ava-8.png
      mode: 원정
      description: "집결을 개시할 때 집결 부대의 파괴력이 {v1} 증가합니다."
      levels: ["5%","7.5%","10%","12.5%","15%"]
order: 701
---

## 스킬 구성과 획득

토벌에서는 지속 피해와 대상의 받는 피해 증가를 사용합니다. 원정에서는 적 방어력 감소, 주기적인 받는 피해 증가, 아군 파괴력 증가를 제공합니다. 전용 장비의 원정 효과에는 집결 개시 조건이 있습니다.

공식 획득 경로는 영웅의 전당입니다. 곰사냥 전용 효과나 특정 병력 비율을 권장하는 근거로 확대하지 않습니다.

## 수치 기준과 확인 사항

능력치는 공식 위키의 영웅 총 속성·전용 장비 총 속성 표시값입니다. 스킬 수치는 1~5레벨 순서이며, 장비 부속품은 강화 1~10단계의 소모량입니다. 출처가 다른 수치는 섞지 않았습니다.

절대 색감은 공식 한국어 위키대로 피해 증가 25% 고정, 대상 공격력 감소 5/10/15/20/25%로 기록했습니다. 커뮤니티 자료는 피해 증가 5/10/15/20/25%·공격력 감소 15%로 안내하므로 서로 다릅니다. 게임 내 설명이 다르면 게임을 우선 확인하세요.

## 출처

2026-10-17 확인. 한국어 이름·스탯·스킬명·단계별 효과·이미지는 [공식 한국어 위키](https://kingshotwiki.com/ko/heroes/kingshot_wiki_hero_name_50015_kingshot_end-2/)를 우선했습니다. [Kingshot.net](https://kingshot.net/heroes/ava)와 [Kingshot Database 7세대](https://kingshotdata.com/heroes/generation-7-heroes/)로 영문명과 장비 부속품 수량을 교차 확인했습니다.
