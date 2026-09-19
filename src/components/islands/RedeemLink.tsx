import { REDEEM_URL } from '@/lib/gift-codes';

interface Props {
  code: string;
  /** useCopy() 의 copy. 클릭 순간 클립보드에 코드를 담아 둔다. */
  onCopy(code: string): void;
}

/**
 * 코드를 복사하면서 공식 교환 페이지를 새 탭으로 연다.
 * button + window.open 이 아니라 <a> 로 둔 이유는, 복사가 비동기라
 * await 뒤에 창을 열면 브라우저가 팝업으로 보고 막기 때문이다.
 */
export default function RedeemLink({ code, onCopy }: Props) {
  return (
    <a
      href={REDEEM_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onCopy(code)}
      title={`${code} 를 복사하고 공식 교환 페이지를 엽니다`}
      className="shrink-0 rounded-md border border-accent/60 bg-accent/10 px-2 py-1 text-xs font-bold whitespace-nowrap text-accent-strong no-underline transition-colors hover:border-accent hover:bg-accent/20 hover:text-accent-strong"
    >
      리딤 <span aria-hidden="true">↗</span>
    </a>
  );
}
