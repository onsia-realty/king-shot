import { useEffect, useRef, useState } from 'react';

interface Props {
  /** 서버가 렌더한 카드 개수 */
  total: number;
  placeholder?: string;
}

/**
 * 공략 목록 즉시 검색.
 * 카드는 서버가 이미 렌더했고, 이 아일랜드는 DOM 표시만 토글한다.
 * → JS가 꺼져 있으면 입력창이 안 뜨고 전체 목록이 그대로 보인다.
 */
export default function GuideSearch({ total, placeholder = '제목·태그로 검색' }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(total);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-guide-card]'));
    const needle = query.trim().toLowerCase();
    const words = needle.split(/\s+/).filter(Boolean);

    let visible = 0;
    for (const card of cards) {
      const haystack = card.dataset.search ?? '';
      const match = words.length === 0 || words.every((w) => haystack.includes(w));
      const host = card.parentElement?.hasAttribute('data-guide-item')
        ? card.parentElement
        : card;
      host.hidden = !match;
      if (match) visible += 1;
    }
    setHits(visible);

    return () => {
      for (const card of cards) {
        const host = card.parentElement?.hasAttribute('data-guide-item')
          ? card.parentElement
          : card;
        host.hidden = false;
      }
    };
  }, [query]);

  const empty = query.trim() !== '' && hits === 0;

  return (
    <div className="mb-6">
      <label htmlFor="guide-search" className="sr-only">
        공략 검색
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          aria-hidden="true"
        >
          🔍
        </span>
        <input
          id="guide-search"
          ref={inputRef}
          type="search"
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-surface py-3 pr-4 pl-10 text-text placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <p className="mt-2 text-sm text-muted" aria-live="polite">
        {query.trim() === '' ? `공략 ${total}편` : `${hits}편 찾음`}
      </p>

      {empty && (
        <div className="mt-4 rounded-xl border border-border bg-surface p-6 text-center">
          <p className="font-bold text-text">검색 결과가 없습니다</p>
          <p className="mt-1 text-sm text-muted">
            다른 단어로 찾아보거나 위쪽 카테고리에서 골라보세요.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="mt-4 rounded-lg border border-border px-3 py-1.5 text-sm font-bold text-text hover:bg-raised"
          >
            검색어 지우기
          </button>
        </div>
      )}
    </div>
  );
}
