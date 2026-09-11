/**
 * 스킬 설명의 {v1}·{v2} 자리표시자를 단계별 수치로 채우는 헬퍼.
 *
 * 영웅 스킬과 전용 장비 스킬이 같은 형식을 쓰므로 한 곳에 모아 둔다.
 * 결과를 set:html 로 꽂기 때문에, 우리가 관리하는 콘텐츠라도
 * 설명과 수치를 모두 이스케이프한 뒤에 강조 태그만 직접 붙인다.
 */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** HTML 특수문자 이스케이프 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]!);
}

/** 자리표시자 — 스킬 하나가 수치 줄을 둘까지 가진다 */
const PLACEHOLDER_1 = '{v1}';
const PLACEHOLDER_2 = '{v2}';

/** 수치 한 줄을 ' / ' 로 이어 붙여 강조 태그로 감싼다 (값도 먼저 이스케이프) */
function highlight(levels: readonly string[]): string {
  const values = levels.map((level) => escapeHtml(level)).join(' / ');
  return `<strong class="text-accent">${values}</strong>`;
}

/**
 * 설명 + 단계 수치 → 안전한 HTML 문자열.
 * 자리표시자가 없거나 짝이 되는 수치 줄이 비면 그 자리표시자는 그대로 둔다.
 */
export function renderSkillDescription(
  description: string,
  levels: readonly string[] = [],
  levels2: readonly string[] = [],
): string {
  let html = escapeHtml(description);
  if (levels.length > 0) html = html.replaceAll(PLACEHOLDER_1, highlight(levels));
  if (levels2.length > 0) html = html.replaceAll(PLACEHOLDER_2, highlight(levels2));
  return html;
}
