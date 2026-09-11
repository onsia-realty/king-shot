import { useCopy } from '@/lib/copy';

export interface GiftCode {
  code: string;
  rewards: string;
  addedAt: string;
  startsAt?: string;
  expiresAt?: string;
  note?: string;
}

interface Props {
  codes: GiftCode[];
  /** 만료된 코드 표는 복사 버튼 대신 회색 처리 */
  expired?: boolean;
  emptyMessage: string;
}

export default function GiftCodeTable({ codes, expired = false, emptyMessage }: Props) {
  const { copy, copied, failed } = useCopy();

  if (codes.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-raised text-left">
            <th className="px-4 py-3 font-bold whitespace-nowrap">코드</th>
            <th className="px-4 py-3 font-bold">보상</th>
            <th className="px-4 py-3 font-bold whitespace-nowrap">유효 시작일</th>
            <th className="px-4 py-3 font-bold whitespace-nowrap">
              {expired ? '만료일' : '유효 기간'}
            </th>
          </tr>
        </thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.code} className="border-t border-border align-top">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <code
                    className={[
                      'rounded-md border border-border px-2 py-1 font-mono text-sm font-bold',
                      expired ? 'text-muted line-through' : 'bg-raised text-accent-strong',
                    ].join(' ')}
                  >
                    {c.code}
                  </code>
                  {!expired && (
                    <button
                      type="button"
                      onClick={() => copy(c.code)}
                      className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-bold text-text transition-colors hover:border-accent/60 hover:text-accent"
                    >
                      {copied === c.code ? '복사됨' : failed === c.code ? '복사 실패' : '복사'}
                    </button>
                  )}
                </div>
                {c.note && <p className="mt-1 text-xs text-muted">{c.note}</p>}
              </td>
              <td className="px-4 py-3 text-muted">
                {c.rewards.trim() || '보상 미확인'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted tabular-nums">
                {c.startsAt ?? '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted tabular-nums">
                {c.expiresAt ?? (expired ? '-' : '기한 미확인')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
