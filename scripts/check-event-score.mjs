// 이벤트 점수 계산 self-check. 기대값은 kshot-lab 원본 로직(모듈 45174)으로 손계산한 값.
// 실행: node --experimental-strip-types scripts/check-event-score.mjs
import assert from 'node:assert/strict';
import { compareEvents, planEvent, SCORE_EVENTS } from '../src/data/event-score.ts';

const [kvk, sl] = SCORE_EVENTS;
const inv = { training_speedup_min: 1000, gold_bar: 10, legend_shard: 5, mithril: 1 };
const t10 = { mode: 'training', tier: 10, fromTier: 10, availableTroops: 0, trainSpeedPercent: 0 };

// 속도 0%: T10 394명 x 60 = 23,640 + 남는 1분 태우기 30 < 가속 태우기 30,000 → burn
const a = planEvent(kvk, inv, t10);
assert.equal(a.route.chosen, 'burn');
assert.equal(a.route.troops, 394);
assert.equal(a.route.trainScore, 23670);
assert.equal(a.totalScore, 105200);
const legend = a.itemPlans.find((p) => p.id === 'legend_shard');
assert.deepEqual([legend.day, legend.tiedDays], [2, [3]]);
assert.equal(a.stages[0].subtotal, 50000); // 순금 20,000 + 가속 30,000 → 1일차

// 속도 100%: 789명 → KvK 47,340 / 지고 30,771 둘 다 train, KvK 추천
const fast = { ...t10, trainSpeedPercent: 100 };
const { plans, margin } = compareEvents(inv, fast);
assert.equal(plans[0].event.id, 'kvk');
assert.equal(plans[0].totalScore, 122540);
assert.equal(plans[0].route.powerGain, 52074);
assert.equal(plans[1].totalScore, 105971);
assert.equal(margin, 16569);
assert.ok(!plans[0].itemPlans.some((p) => p.id === 'training_speedup_min'));

// 승급 T10→T11 보유 100명: 1,500 + 남는 953분 태우기 28,590 = 30,090 > 30,000
const promo = planEvent(kvk, inv, { ...t10, mode: 'promotion', tier: 11, availableTroops: 100 });
assert.equal(promo.route.leftoverMinutes, 953);
assert.equal(promo.route.leftoverUse, 'burn');
assert.equal(promo.route.trainScore, 30090);
assert.equal(promo.route.chosen, 'train');

// 지고의 영주에서 점수 없는 아이템은 unused 로
assert.equal(planEvent(sl, { mithril: 2 }, t10).totalScore, 80000);
assert.deepEqual(planEvent(kvk, {}, t10).unusedItems, []);

console.log('event-score self-check OK');
