/**
 * src/data/pack-value.ts 계산이 원본(kshot-lab.com/tools/pack-value) 수치와 맞는지 확인한다.
 *
 *   node --experimental-strip-types scripts/check-pack-value.mjs
 *
 * 하나라도 어긋나면 assert 가 던지고 exit 1. 이벤트 패키지 표를 갱신한 뒤 돌려 본다.
 */
import assert from 'node:assert/strict';
import {
  rankEventPackages,
  optimizeTokens,
  evaluateTokenPlan,
  TOKEN_SCENARIOS,
  planWind,
  planWindMax,
  windMarginalTable,
  EV_FULL_SYNTH,
} from '../src/data/pack-value.ts';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// 1. 효율 랭킹: 원본 페이지 1위 = 7,500원, 효율 194%, 가치 약 1.5만 원
const ranked = rankEventPackages();
assert.equal(ranked[0].pkg.id, 'skin_45_7500');
assert.equal(Math.round(ranked[0].ratio * 100), 194);
assert.equal(Math.round(ranked[0].totalValueKRW / 1000), 15);
assert.equal(ranked[0].grade, 'S');
for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].ratio >= ranked[i].ratio);

// 2. 토큰 최적화: 원본 시나리오 숫자(totalCost, progress, bonus)를 재계산으로 재현
const ORIGINAL = {
  2000: [[216000, 2000, 750], [217500, 2020, 750], [222000, 2000, 750], [235000, 2100, 750], [253500, 2200, 750]],
  5000: [[666000, 5000, 1550], [667500, 5020, 1550], [687500, 5040, 1550], [697500, 5000, 1550], [757500, 5240, 1550]],
  10000: [[1434500, 10000, 2550], [1437500, 10040, 2550], [1302500, 8740, 1550]],
};
for (const set of TOKEN_SCENARIOS) {
  set.scenarios.forEach((sc, i) => {
    const p = evaluateTokenPlan(set.target, true, sc.counts);
    assert.deepEqual([p.totalCost, p.progressTokens, p.bonusTokens], ORIGINAL[set.target][i], `${set.target} ${sc.name}`);
  });
  // 전수 탐색 최적해 = 원본 시나리오 A
  const best = optimizeTokens(set.target);
  assert.equal(best.totalCost, ORIGINAL[set.target][0][0]);
  assert.deepEqual(best.counts, [...set.scenarios[0].counts]);
}
assert.equal(optimizeTokens(140).totalCost, 0);
assert.equal(optimizeTokens(10040).totalCost, 1437500);
assert.equal(optimizeTokens(10041), null);

// 3. 바람을 쫓는 여행: 원본 안내문 — 20상자(15,000원) 최고, 350상자 262,500원, 600상자 약 22/만원(급락).
//    이 문구는 슬롯 증설 패키지를 안 쓴 경우의 수치다(원본 기본값은 슬롯 사용인데 문구는 고정). 슬롯 사용 시 350상자는 240,000원.
near(EV_FULL_SYNTH, 5.066666666666666, 1e-9);
assert.equal(planWind(350, false).totalCost, 262500);
assert.equal(planWind(350, true).totalCost, 240000);
const table = windMarginalTable(false);
const best = table.filter((r) => Number.isFinite(r.rewardPerManwon)).sort((a, b) => b.rewardPerManwon - a.rewardPerManwon)[0];
assert.equal(best.boxes, 20);
assert.equal(best.cumulativeCost, 15000);
const last = table[table.length - 1];
assert.equal(last.boxes, 600);
assert.equal(Math.round(last.rewardPerManwon), 22);
assert.equal(last.grade, 'poor');
assert.equal(planWindMax(false).boxes, (5 * (100 + 160 + 300 + 600)) / 8);

console.log('pack-value self-check OK');
console.table(ranked.map((r) => ({ 순위: r.rank, 패키지: r.pkg.packageName, 효율: `${Math.round(r.ratio * 100)}%`, 등급: r.grade, 가치: Math.round(r.totalValueKRW) })));
console.table(table.map((r) => ({ 상자: r.boxes, 추가비용: r.marginalCost, 추가보상: r.marginalReward, 만원당: r.rewardPerManwon.toFixed(1), 등급: r.grade })));
