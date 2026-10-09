/**
 * src/data/spec-up-roadmap.ts 추천 로직 self-check.
 *
 *   node --experimental-strip-types scripts/check-spec-up-roadmap.mjs
 *
 * 정렬·가중치·동점 처리·곰 모드를 원본(kshot-lab.com/tools/roadmap 모듈 55201) 규칙대로 확인한다.
 */
import assert from 'node:assert/strict';
import {
  createCharacter,
  normalizeCharacter,
  recommendRoadmap,
  ROADMAP_LIMIT,
  SAMPLE_CHARACTER,
} from '../src/data/spec-up-roadmap.ts';
import { calculateHeroGear, GOVERNOR_GEAR_MAX_TIER, GOVERNOR_GEAR_TIERS, heroGearStatPercent } from '../src/data/spec-up.ts';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const maxed = () => [200, 20];
const MAXED = (gen = 'gold_123') =>
  createCharacter(gen, maxed, () => GOVERNOR_GEAR_MAX_TIER, () => 22);

// 정렬: 효율 내림차순, 상위 30개, rank 1부터
const sample = recommendRoadmap(SAMPLE_CHARACTER);
assert.equal(sample.length, ROADMAP_LIMIT);
sample.forEach((x, i) => assert.equal(x.rank, i + 1));
for (let i = 1; i < sample.length; i++) {
  assert.ok(sample[i - 1].efficiencyScore >= sample[i].efficiencyScore - 1e-12);
}

// 다 찍은 캐릭터는 후보 없음
assert.equal(recommendRoadmap(MAXED()).length, 0);

// 가중치: 보병 갑옷 Lv.80 만 남기면 → 80→100 하나. 체력 ×1.1, 승급 없음
const one = createCharacter('gold_123', (t, s) => (t === 'infantry' && s === 'armor' ? [80, 20] : maxed()), () => GOVERNOR_GEAR_MAX_TIER, () => 22);
const [armor] = recommendRoadmap(one);
const r80 = calculateHeroGear({ generation: 'gold_123', fromLevel: 80, toLevel: 100, masteryFrom: 0, masteryTo: 0 });
assert.equal(armor.category, 'hero_gear');
assert.equal(armor.nextTarget, 'Lv.100');
near(armor.rawStatGain, 7);
near(armor.weightedStatGain, 7 * 1.1);
near(armor.efficiencyScore, (7 * 1.1) / r80.leveling.costKRW);

// 승급 보너스: 헬멧 119→120 은 공격 보너스 20 (가중치 1.0), 장비 스탯은 파괴력 1.1
const helm = createCharacter('gold_123', (t, s) => (t === 'archer' && s === 'helmet' ? [119, 20] : maxed()), () => GOVERNOR_GEAR_MAX_TIER, () => 22);
const h = recommendRoadmap(helm).find((x) => x.nextTarget === 'Lv.120');
near(h.weightedStatGain, 0.35 * 1.1 + 20 * 1);
assert.deepEqual(h.affectedStats, ['destruction', 'attack']);
assert.equal(recommendRoadmap(helm).length, 2); // 119→120, 120→139

// 마스터리: 단계당 = 장비 스탯 10%, 다음 2단계만
const mas = createCharacter('gold_123', (t, s) => (t === 'cavalry' && s === 'boots' ? [200, 3] : maxed()), () => GOVERNOR_GEAR_MAX_TIER, () => 22);
const m = recommendRoadmap(mas);
assert.deepEqual(m.map((x) => x.currentState).sort(), ['M.3', 'M.4']);
near(m[0].rawStatGain, heroGearStatPercent(200) * 0.1);

// 동점: 같은 레벨의 보병 장갑(보병방어=1)과 기병 갑옷(기병방어=6)은 효율이 같아 보병이 먼저
const tie = createCharacter(
  'gold_123',
  (t, s) => ((t === 'cavalry' && s === 'armor') || (t === 'infantry' && s === 'gloves') ? [50, 20] : maxed()),
  () => GOVERNOR_GEAR_MAX_TIER,
  () => 22,
);
const tr = recommendRoadmap(tie);
assert.equal(tr.length, 2);
near(tr[0].efficiencyScore, tr[1].efficiencyScore);
assert.deepEqual([tr[0].troop, tr[1].troop], ['infantry', 'cavalry']);
// 영주 장비 동점: 보병(10) > 궁병(11) > 기병(12)
const govTie = createCharacter('gold_123', maxed, (t) => (t === 'archer' || t === 'cavalry' ? 20 : GOVERNOR_GEAR_MAX_TIER), () => 22);
assert.deepEqual(
  recommendRoadmap(govTie).filter((x) => x.nextTarget === GOVERNOR_GEAR_TIERS[21]).map((x) => x.troop),
  ['archer', 'archer', 'cavalry', 'cavalry'],
);

// 곰 모드: 궁병만, 체력·방어 0 → 갑옷·장갑 일반 레벨업·마스터리는 빠진다
const bear = recommendRoadmap(SAMPLE_CHARACTER, 'bear');
assert.ok(bear.length > 0);
assert.ok(bear.every((x) => x.troop === 'archer'));
assert.ok(!bear.some((x) => (x.category === 'hero_mastery' || x.category === 'hero_gear') && ['갑옷', '장갑'].includes(x.slotLabel) && x.rawStatGain < 20));
const govBear = bear.find((x) => x.category === 'governor_gear');
near(govBear.weightedStatGain, govBear.rawStatGain * 0.5);
const jewelBear = bear.find((x) => x.category === 'jewel');
near(jewelBear.weightedStatGain, jewelBear.rawStatGain * 0.55);

// 저장값 정규화: 범위 밖은 클램프, 세대가 이상하면 null
assert.equal(normalizeCharacter({ generation: 'nope' }), null);
assert.equal(normalizeCharacter(null), null);
const n = normalizeCharacter({ generation: 'gold_45', heroGear: [{ troop: 'archer', slot: 'boots', level: 999, mastery: -3 }], governorJewels: [{ troop: 'archer', levels: [50] }] });
const boots = n.heroGear.find((g) => g.troop === 'archer' && g.slot === 'boots');
assert.deepEqual([boots.level, boots.mastery], [200, 0]);
assert.equal(n.governorJewels[1].levels[0], 22);
assert.equal(n.heroGear.length, 12);
assert.equal(n.governorGear.length, 6);
assert.deepEqual(normalizeCharacter(SAMPLE_CHARACTER), SAMPLE_CHARACTER);

console.log('ok');
