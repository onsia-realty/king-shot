// 개발자 도구 단축키 안내와 콘솔 정리. 프로덕션에서만 BaseLayout 이 불러온다.
// 일부러 하지 않는 것: 복사·선택·드래그 차단, 창 크기 기반 devtools 감지, debugger 루프,
// 자동화(헤드리스) 감지로 화면 바꾸기, Function.prototype.toString 덮어쓰기, 숨은 함정 링크.
// → 네이버·구글 크롤러와 기프트 코드·닉네임 복사를 해치지 않기 위해서다.

const MESSAGE = '킹샷공략.xyz의 화면과 데이터는 보호되고 있습니다.';
const CONSOLE_METHODS = ['assert', 'clear', 'count', 'countReset', 'debug', 'dir', 'dirxml', 'group', 'groupCollapsed',
  'groupEnd', 'info', 'log', 'profile', 'profileEnd', 'table', 'time', 'timeEnd', 'timeLog', 'timeStamp', 'trace', 'warn'] as const;

let overlay: HTMLElement | null = null;
let opener: Element | null = null;

// Shift/Option 과 한글 자판에서는 e.key 가 달라지므로 e.code(물리 키)도 함께 본다.
function isKey(e: KeyboardEvent, letter: string) {
  return e.code === `Key${letter.toUpperCase()}` || (e.key ?? '').toLowerCase() === letter;
}

function isDevtoolsShortcut(e: KeyboardEvent) {
  if (e.key === 'F12' || e.code === 'F12') return true;
  // Windows/Linux: Ctrl+Shift+I/J/C, Ctrl+U
  if (e.ctrlKey && !e.altKey && !e.metaKey) {
    return e.shiftKey ? ['i', 'j', 'c'].some(l => isKey(e, l)) : isKey(e, 'u');
  }
  // Mac: Cmd+Option+I/J/C, Cmd+Option+U
  return e.metaKey && e.altKey && !e.ctrlKey && ['i', 'j', 'c', 'u'].some(l => isKey(e, l));
}

function closeOverlay() {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  if (opener instanceof HTMLElement) opener.focus();
}

function showOverlay() {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ks-shield';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ks-shield-title');
    overlay.setAttribute('aria-describedby', 'ks-shield-desc');
    overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl">
        <h2 id="ks-shield-title" class="text-lg font-bold text-text">🛡️ 콘텐츠 보호 중</h2>
        <p id="ks-shield-desc" class="mt-2 text-sm text-muted">${MESSAGE}</p>
        <div class="mt-5 flex items-center justify-center gap-3">
          <button type="button" data-shield-close class="min-h-11 rounded-lg bg-accent px-5 text-sm font-bold text-on-accent transition-opacity hover:opacity-85">계속 보기</button>
          <a href="/" class="inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold text-text no-underline hover:border-accent/50 hover:text-text">메인으로</a>
        </div>
      </div>`;
    overlay.querySelector('[data-shield-close]')!.addEventListener('click', closeOverlay);
    document.body.append(overlay);
  }
  if (overlay.hidden) opener = document.activeElement;
  overlay.hidden = false;
  overlay.querySelector<HTMLElement>('[data-shield-close]')!.focus();
}

// 열려 있는 동안 Tab 이 뒤쪽 페이지로 새지 않게 두 컨트롤 사이에서만 돈다.
function trapTab(e: KeyboardEvent) {
  const items = [...overlay!.querySelectorAll<HTMLElement>('button, a[href]')];
  const index = items.indexOf(document.activeElement as HTMLElement);
  e.preventDefault();
  items[(index + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
}

export function startShield() {
  document.addEventListener('keydown', e => {
    if (overlay && !overlay.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); }
      else if (e.key === 'Tab') trapTab(e);
    }
    if (isDevtoolsShortcut(e)) { e.preventDefault(); showOverlay(); }
  });

  // 입력창·링크·글자를 드래그해 둔 상태에서는 우클릭 메뉴(복사 등)를 그대로 둔다.
  document.addEventListener('contextmenu', e => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('input, textarea, select, a[href]') || (target as HTMLElement | null)?.isContentEditable) return;
    if (window.getSelection()?.toString().trim()) return;
    e.preventDefault();
  });

  // console.error 는 남겨 둔다. 실제 오류 보고까지 막지 않기 위해서다.
  const noop = () => {};
  for (const name of CONSOLE_METHODS) {
    try { console[name] = noop; } catch { /* 읽기 전용이면 그대로 둔다 */ }
  }
}
