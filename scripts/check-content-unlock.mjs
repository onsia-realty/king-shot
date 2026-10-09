/**
 * src/data/content-unlock.ts 의 계산이 kshot-lab API 응답과 같은지 대조한다.
 *
 *   node --experimental-strip-types scripts/check-content-unlock.mjs
 *
 * (Node 22.18+ / 23.6+ 는 플래그 없이도 된다.)
 * 기대값은 2026-10-09 수집한 GET /api/content-unlock?kingdomNumber=1|1200|2000 응답을 줄인 것.
 * 응답 시각이 2026-10-08 21:53 UTC 라서 남은 일수는 오늘 = 2026-10-08 로 맞춰 본다.
 * 원본 표나 규칙을 손볼 때마다 돌려서 어긋나면 exit 1.
 */
import assert from 'node:assert/strict';
import {
  dayNumber,
  isoDate,
  kingdomStartDay,
  predictUnlocks,
} from '../src/data/content-unlock.ts';

const TODAY = dayNumber('2026-10-08');

// [왕국, API startDate, "key 해금일 남은일수" 를 해금일 순으로]
const SAMPLES = [
  [1, '2025-02-24', `
    hero_gen_1 2025-04-13 0 | fog_plains 2025-04-21 0 | fog_fertile 2025-05-11 0 | hero_gen_2 2025-05-13 0
    alliance_exchange 2025-05-18 0 | castle_battle 2025-05-27 0 | pet_gen_1 2025-05-28 0 | gold_set_123 2025-06-12 0
    svs 2025-07-02 0 | hero_gen_3 2025-07-21 0 | gold_set_45 2025-09-01 0 | jewel_cap_unlock 2025-09-29 0
    hero_gen_4 2025-10-13 0 | war_academy 2025-11-10 0 | hero_gen_5 2026-01-05 0 | gold_set_678 2026-02-16 0
    hero_gen_6 2026-03-30 0 | hero_gen_7 2026-06-22 0 | gold_promotion 2026-08-03 0 | hero_gen_8 2026-09-14 0
    hero_gen_9 2026-12-07 60 | gold_set_910 2027-01-18 102 | hero_gen_10 2027-03-01 144`],
  [1200, '2025-10-23', `
    hero_gen_1 2025-10-26 0 | fog_plains 2025-11-03 0 | fog_fertile 2025-11-23 0 | hero_gen_2 2025-11-25 0
    alliance_exchange 2025-11-30 0 | castle_battle 2025-12-09 0 | pet_gen_1 2025-12-10 0 | gold_set_123 2025-12-25 0
    svs 2026-01-14 0 | hero_gen_3 2026-02-02 0 | gold_set_45 2026-03-16 0 | jewel_cap_unlock 2026-04-13 0
    hero_gen_4 2026-04-27 0 | war_academy 2026-05-25 0 | hero_gen_5 2026-07-20 0 | gold_set_678 2026-08-31 0
    hero_gen_6 2026-10-12 4 | hero_gen_7 2027-01-04 88 | gold_promotion 2027-02-15 130 | hero_gen_8 2027-03-29 172
    hero_gen_9 2027-06-21 256 | gold_set_910 2027-08-02 298 | hero_gen_10 2027-09-13 340`],
  [2000, '2026-04-28', `
    hero_gen_1 2026-04-28 0 | fog_plains 2026-05-06 0 | fog_fertile 2026-05-26 0 | hero_gen_2 2026-05-28 0
    alliance_exchange 2026-06-02 0 | castle_battle 2026-06-11 0 | pet_gen_1 2026-06-12 0 | gold_set_123 2026-06-27 0
    svs 2026-07-17 0 | hero_gen_3 2026-08-17 0 | gold_set_45 2026-09-28 0 | jewel_cap_unlock 2026-10-26 18
    hero_gen_4 2026-11-09 32 | war_academy 2026-12-07 60 | hero_gen_5 2027-02-01 116 | gold_set_678 2027-03-15 158
    hero_gen_6 2027-04-26 200 | hero_gen_7 2027-07-19 284 | gold_promotion 2027-08-30 326 | hero_gen_8 2027-10-11 368
    hero_gen_9 2028-01-03 452 | gold_set_910 2028-02-14 494 | hero_gen_10 2028-03-27 536`],
];

for (const [kingdom, startDate, table] of SAMPLES) {
  const expected = table.trim().split(/\s*[|\n]\s*/).map((row) => row.trim().split(/\s+/));
  const p = predictUnlocks(kingdom, TODAY);
  assert.ok(p, `K${kingdom}: 결과 없음`);
  assert.equal(isoDate(p.startDay), startDate, `K${kingdom} startDate`);
  const actual = p.items.map((it) => [
    it.rule.key,
    isoDate(it.unlockDay),
    String(Math.max(0, it.daysRemaining)),
  ]);
  assert.deepEqual(actual, expected, `K${kingdom} 해금 목록`);
  console.log(`ok K${kingdom}: ${actual.length}개 일치`);
}

// 경계: 표 끝(2483)은 있고 그 뒤와 0 이하는 없다.
assert.notEqual(kingdomStartDay(2483), null);
assert.equal(predictUnlocks(2484, TODAY), null);
assert.equal(predictUnlocks(0, TODAY), null);
assert.equal(isoDate(dayNumber('2025-03-03')), '2025-03-03');
console.log('ok 경계값');
