import { useEffect, useRef, useState } from 'react';

/**
 * clipboard API 가 막힌 브라우저(비 HTTPS, 구형 사파리)를 위한 대체 경로.
 * GiftCodeTable 안에만 있던 것을 캘린더 아일랜드와 나눠 쓰려고 끌어냈다.
 */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export interface CopyState {
  copy(text: string): void;
  /** 방금 복사에 성공한 문자열. 1.6초 뒤 null 로 돌아간다. */
  copied: string | null;
  /** 방금 복사에 실패한 문자열. */
  failed: string | null;
}

/** 복사 + "복사됨" 플래시 상태를 한 묶음으로 돌려준다. */
export function useCopy(): CopyState {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 플래시가 걸린 채 언마운트되면 타이머가 남으므로 반드시 정리한다.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flash = (text: string, ok: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    setCopied(ok ? text : null);
    setFailed(ok ? null : text);
    timer.current = setTimeout(() => {
      setCopied(null);
      setFailed(null);
    }, 1600);
  };

  const copy = (text: string) => {
    void (async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          flash(text, true);
          return;
        }
      } catch {
        // 아래 대체 경로로 넘어간다
      }
      flash(text, legacyCopy(text));
    })();
  };

  return { copy, copied, failed };
}
