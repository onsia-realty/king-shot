/**
 * src/data/spec-up.ts 계산 함수 self-check.
 *
 *   node --experimental-strip-types scripts/check-spec-up.mjs
 *
 * 기댓값은 kshot-lab.com/tools/progress 기본 화면(순금 1/2/3, Lv.80→100, 마스터리 5→8)에
 * 찍힌 숫자와, 원본 계산 함수를 손으로 따라가 얻은 값이다. 통과하면 아무것도 안 찍고 ok 만 출력한다.
 */
import assert from 'node:assert/strict';
import {
  calculateGovernorGear,
  calculateHeroGear,
  calculateJewel,
  costGrade,
  GOVERNOR_GEAR_MAX_TIER,
  JEWEL_MAX_LEVEL,
} from '../src/data/spec-up.ts';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// 원본 기본값: 총 ₩29.2만, +22.0%, 1%당 ₩1.3만, EXP 38,500개 ₩16.0만, 마스터리 소계 ₩13.1만
const hero = calculateHeroGear({ generation: 'gold_123', fromLevel: 80, toLevel: 100, masteryFrom: 5, masteryTo: 8 });
assert.equal(hero.levelingSteps.length, 1);
assert.equal(hero.levelingSteps[0].items[0].amount, 38500);
near(hero.leveling.costKRW, 38500 * (7500 / 1800));
near(hero.leveling.statGain, 7);
near(hero.mastery.costKRW, 131250);
near(hero.mastery.statGain, 15);
near(hero.total.statGain, 22);
assert.equal((hero.total.costKRW / 1e4).toFixed(1), '29.2');
assert.equal((hero.total.costPer1Percent / 1e4).toFixed(1), '1.3');
assert.equal(hero.prices.mythicGearKRW, 62501); // 원본 ceil(100/12*7500) 부동소수 결과
assert.equal(hero.masterySteps[0].costPer1Percent, 7500);

// 승급 구간: 100→120 은 [100→101 승급, 101→119 EXP, 120 승급] 으로 끊기고 120 보너스 +20 이 붙는다
const promo = calculateHeroGear({ generation: 'gold_123', fromLevel: 100, toLevel: 120, masteryFrom: 0, masteryTo: 0 });
assert.deepEqual(promo.levelingSteps.map((s) => s.label), ['Lv.101 승급', 'Lv.101 → 119', 'Lv.120 승급']);
near(promo.total.statGain, 0.35 * 20 + 20);
near(promo.levelingSteps[2].costKRW, 10 * 7500 + 3 * 62501);
assert.equal(promo.masterySteps.length, 0);

// 영주 장비: 없음(-1) → 고급 은 2 × (66.98 - 2.5×18) = 43.96, 끝까지 누적합 = 마지막 티어 성능
const gov = calculateGovernorGear({ generation: 'gold_123', fromTier: -1, toTier: GOVERNOR_GEAR_MAX_TIER });
assert.equal(gov.steps.length, GOVERNOR_GEAR_MAX_TIER + 1);
near(gov.steps[0].statGain, 43.96);
near(gov.total.statGain, gov.steps.at(-1).statTo);
near(gov.prices.satinKRW, 3750 / 9000);
near(gov.prices.threadKRW, 3750 / 90);
near(gov.steps[0].costKRW, 1500 * (3750 / 9000) + 15 * (3750 / 90));

// 영주 보석: 0→22 누적 = 2×99 = 198%, 매뉴얼·도면 같은 단가 7500/60
const jewel = calculateJewel({ generation: 'gold_123', fromLevel: 0, toLevel: JEWEL_MAX_LEVEL });
near(jewel.total.statGain, 198);
near(jewel.unitPriceKRW, 125);
near(jewel.steps[0].costKRW, 10 * 125);
const jewelMid = calculateJewel({ generation: 'gold_123', fromLevel: 5, toLevel: 6 });
near(jewelMid.total.statGain, 2 * (30 - 25));

// 빈 구간
assert.equal(calculateJewel({ generation: 'gold_45', fromLevel: 3, toLevel: 3 }).total.costKRW, 0);

assert.equal(costGrade(5000), 'good');
assert.equal(costGrade(15000), 'fair');
assert.equal(costGrade(50000), 'poor');
assert.equal(costGrade(50001), 'bad');

console.log('ok');
