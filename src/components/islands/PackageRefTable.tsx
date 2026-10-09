import { useState } from 'react';
import {
  BASE_PACKAGE_PRICE_KRW,
  PACKAGE_GENERATIONS,
  PACKAGE_ITEMS,
  unitPrice,
} from '@/data/package-ref';

/**
 * 패키지 기준표. 세대 탭을 고르면 기준 패키지(7,500원) 한 개의 아이템 수량과 개당 단가를 보여준다.
 * 데이터와 단가 공식은 src/data/package-ref.ts 를 그대로 쓴다.
 */

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 단가는 1원 미만도 나와서 크기에 따라 소수 자릿수를 다르게 둔다. */
function fmtPrice(n: number): string {
  const digits = n < 1 ? 2 : n < 100 ? 1 : 0;
  return n.toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

export default function PackageRefTable() {
  const [index, setIndex] = useState(0);
  const gen = PACKAGE_GENERATIONS[index];

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <div role="tablist" aria-label="순금 세대" className="flex flex-wrap gap-2">
        {PACKAGE_GENERATIONS.map((g, i) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            id={`pkg-tab-${g.key}`}
            aria-selected={i === index}
            aria-controls="pkg-panel"
            onClick={() => setIndex(i)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
              i === index
                ? 'border-accent bg-accent/15 text-accent-strong'
                : 'border-border bg-bg text-muted hover:text-text'
            }`}
          >
            {g.name}
            {g.predicted ? <span className="ml-1 text-xs text-warning">예측</span> : null}
          </button>
        ))}
      </div>

      <div
        id="pkg-panel"
        role="tabpanel"
        aria-labelledby={`pkg-tab-${gen.key}`}
        className="mt-5 border-t border-border pt-5"
      >
        {gen.predicted ? (
          <p className="mb-4 rounded-lg border border-warning/50 bg-bg px-3 py-3 text-sm text-muted">
            <span className="mr-2 rounded-full border border-warning/60 px-2 py-0.5 text-xs font-bold text-warning">
              예측치
            </span>
            {gen.notes ?? '아직 실측이 없어 앞 세대 증분으로 추정한 값입니다.'}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-border bg-bg">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              {gen.name} 기준 패키지 {fmt(BASE_PACKAGE_PRICE_KRW)}원 구성과 아이템 단가
            </caption>
            <thead>
              <tr className="bg-raised text-left">
                <th scope="col" className="px-4 py-3 font-bold whitespace-nowrap">
                  아이템
                </th>
                <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">
                  패키지당 수량
                </th>
                <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">
                  개당 단가
                </th>
              </tr>
            </thead>
            <tbody>
              {PACKAGE_ITEMS.map((item) => (
                <tr key={item.key} className="border-t border-border">
                  <th scope="row" className="px-4 py-3 text-left font-bold whitespace-nowrap">
                    {item.name}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmt(gen.quantities[item.key])}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent-strong whitespace-nowrap">
                    {fmtPrice(unitPrice(gen.key, item.key))}원
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
