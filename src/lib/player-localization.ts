import { getLocale } from './locale';

// Presentation only. Never pass player nicknames, alliance names or identity fields here.
const labels: Record<string, string> = {
  // Hero names match src/content/heroes nameEn; gear names match hero-source.json.
  '알카': 'Alcar', '알카르': 'Alcar', '아마데우스': 'Amadeus', '아마네': 'Amane', '아이바': 'Ava',
  '찰스': 'Charles', '첸코': 'Chenko', '다이애나': 'Diana', '에드윈': 'Edwin', '에릭': 'Eric', '파드': 'Fahd',
  '포스터': 'Forrest', '고든': 'Gordon', '헬가': 'Helga', '힐데': 'Hilde', '하워드': 'Howard', '제이벨': 'Jabel',
  '예거': 'Jaegar', '용비': 'Long Fei', '마르고': 'Margot', '마린': 'Marlin', '올리브': 'Olive', '리틀 페라': 'Petra',
  '퀸': 'Quinn', '로사': 'Rosa', '살로': 'Saul', '스미스': 'Seth', '소피아': 'Sophia', '스루드': 'Thrud',
  '트리톤': 'Triton', '비비안': 'Vivian', '웨이&론': 'Wee & Woo', '양': 'Yang', '연우': 'Yeonwoo', '조이': 'Zoe',
  '근위대': 'Praetorian Guard', '운명의 방패': 'Aegis of Fate', '진실의 모루': 'Anvil of Truth', '티레의 띠': 'Bands of Tyre',
  '계시': 'Revelation', '신앙의 각반': 'Greaves of Faith', '신앙의 경갑': 'Greaves of Faith',
  '방랑의 비가': 'Wanderwail', '방랑자의 통곡': 'Wanderwail', '불멸자의 술병': 'Immortal’s Flask', '불멸자의 플라스크': 'Immortal’s Flask',
  '광란의 송곳니': 'Revel Fang', '안개 술사': 'Mistweaver', '안개술사': 'Mistweaver', '운명의 서': 'Fate’s Writ',
  '아이올로스': 'Aeolian', '래빗기어 캐논': 'Rabbitgear Cannon', '진홍의 장미': 'Scarlet Rose', '피송곳니': 'Bloodfang',
  '파도의 홀': 'Tidal Scepter', '행운의 룰렛': 'Lucky Spinner', '프로스트킨': 'Frostkin', '불의한 자': 'The Unrighteous',
  '연맹장': 'Leader', '부맹주': 'Deputy Leader', '간부': 'Officer', '정예': 'Elite', '연맹원': 'Member', '신입': 'Recruit',
  '머리': 'Head', '장갑': 'Gloves', '갑옷': 'Armor', '신발': 'Boots', '투구': 'Helmet',
  '일반': 'Common', '고급': 'Uncommon', '레어': 'Rare', '에픽': 'Epic', '전설': 'Legendary', '신화': 'Mythic',
  '전투력': 'Power', '처치 수': 'Kills', '도시 센터': 'Town Center', '이민 점수': 'Transfer Score', '신비의 시련': 'Mystic Trial',
  '순금': 'TG', '도시 레벨': 'Town Level', '영주 찾기': 'Find a Governor', '영주 찾는 방법': 'Governor search methods',
  '닉네임 검색': 'Search Nickname', '왕국 지도': 'Kingdom Map', '영주 ID': 'Governor ID',
  '영주 ID (게임 프로필의 ID)': 'Governor ID (from your game profile)', '영주 ID 입력': 'Enter Governor ID',
  '조회 중…': 'Looking up…', '영주 조회': 'Look Up Governor', '영주 장비 & 지도': 'Governor Gear & Map',
  '게임에서 프로필을 열어 닉네임 아래의 ID를 확인하세요. 숫자 1~15자리를 입력해 주세요.': 'Open your in-game profile and find the ID below your nickname. Enter 1–15 digits.',
  '영주 정보를 불러오고 있습니다. 정보 갱신에 시간이 걸릴 수 있습니다.': 'Loading governor information. Refreshing the data may take a while.',
  '영주 조회 결과': 'Governor lookup results', '영주': 'Governor', '이름 정보 없음': 'Name unavailable', '영주 ID 정보 없음': 'Governor ID unavailable',
  '왕국': 'Kingdom', 'VIP 레벨': 'VIP Level', '갱신 시간': 'Updated', '(한국 시간)': '(KST)', '갱신 시간 정보 없음': 'Update time unavailable',
  '1분 이내 갱신': 'Updated less than a minute ago', '분 전 갱신': ' min ago',
  '연맹': 'Alliance', '연맹 ID': 'Alliance ID', '연맹 전투력': 'Alliance Power', '연맹원 수': 'Members', '맹주': 'Leader',
  '연맹 직위': 'Alliance Rank', '직위': 'Rank', '연맹 정보가 없습니다.': 'Alliance information unavailable.',
  '순위': 'Rankings', '위': ' place', '순위 정보 없음': 'Rank unavailable', '영주 장비': 'Governor Gear',
  '장비를 비공개로 설정한 영주입니다': 'This governor has made their gear private.', '장비': 'Gear', '등급': 'Quality', '티어': 'Tier', '성급': 'Stars',
  '강화 레벨': 'Enhancement Level', '장비 점수': 'Gear Score', '장착 보석': 'Equipped Gems', '개': '',
  '공개된 영주 장비 정보가 없습니다.': 'No public governor gear information.',
  '닉네임 또는 검색어': 'Nickname or search term', '닉네임을 입력하세요': 'Enter a nickname', '왕국 번호 (선택)': 'Kingdom Number (optional)',
  '예: 1622 · 비우면 전체 왕국': 'e.g. 1622 · Leave blank for all kingdoms', '검색 중…': 'Searching…',
  '왕국 지정 시 지도 스냅샷의 닉네임을 검색해 최대 100명을 표시합니다. 전체 왕국 검색은 제공처의 결과 수 제한으로 누락될 수 있습니다.': 'With a kingdom selected, searches map snapshot nicknames and shows up to 100 governors. All-kingdom searches may omit results due to provider limits.',
  '닉네임을 검색하고 있습니다.': 'Searching nicknames.', '검색 결과': 'Results', '명 · 표시 가능한 결과': ' · Available results', '명': '',
  '검색어를 입력하면 영주 목록이 표시됩니다.': 'Enter a search term to find governors.',
  '검색된 영주가 없습니다. 검색어를 줄이거나 왕국 번호를 비워 다시 검색해 주세요.': 'No governors found. Try a shorter search term or leave the kingdom number blank.',
  '정보 없음': 'Unavailable', '연맹 정보 없음': 'Alliance unavailable', '검색 결과 페이지': 'Search result pages', '이전': 'Previous', '쪽': '', '다음': 'Next',
  '전용 장비': 'Exclusive Gear', '보병': 'Infantry', '기병': 'Cavalry', '궁병': 'Archer', '성급 정보 없음': 'Star rating unavailable',
  '성 ·': ' stars ·', '단계': ' steps', '성': ' stars', '등급 미확인': 'Unknown quality', '· 빨간색': '· Red',
  '레벨': 'Level', '강화': 'Enhancement', '· 제련': '· Mastery', '· 장비 레벨': '· Gear Level', '· 장비 정보 없음': '· Gear unavailable',
  '제련': 'Mastery', '미확인': 'Unknown', '아레나 방어 영웅': 'Arena Defense Heroes', '방어 영웅': 'Defense Hero',
  '영웅 레벨': 'Hero Level', '전용 장비 레벨': 'Exclusive Gear Level', '방어 편성': 'Defense Position', '장비 상세': 'Gear Details',
  '· 레벨': '· Level', '· 강화': '· Enhancement', '스킬': 'Skill', '아레나 방어 영웅 정보가 없습니다.': 'Arena defense hero information unavailable.',
  '약칭 없음': 'No tag', '도시': 'Cities', '왕국 번호': 'Kingdom Number', '예: 1622': 'e.g. 1622', '지도 조회 중…': 'Loading map…',
  '왕국 지도 조회': 'Load Kingdom Map', '저장된 왕국 지도 데이터를 불러오고 있습니다.': 'Loading saved kingdom map data.',
  '왕국 번호를 입력하면 저장된 도시 위치를 확인할 수 있습니다.': 'Enter a kingdom number to view saved city locations.',
  '· 도시': '· Cities', '개 · 필터 결과': ' · Filtered', '위치 데이터 갱신 시간': 'Location data updated',
  '위치 데이터 갱신 시간 정보 없음': 'Location update time unavailable',
  '저장된 지도입니다. 현재 위치·보호막·연소 상태와 다를 수 있습니다.': 'This is a saved map. Current locations, shields and burning status may differ.',
  '도시 이름 또는 연맹 약칭': 'City Name or Alliance Tag', '닉네임 또는 연맹 약칭을 입력하세요': 'Enter a nickname or alliance tag', '이동': 'Go',
  '연맹 선택 · 밀집 구역으로 이동': 'Select Alliance · Go to Cluster', '모든 연맹': 'All Alliances', '조회한 영주 위치': 'Governor Location',
  '조회한 영주의 연맹': 'Governor’s Alliance', '연맹 구역으로 이동': 'Go to Alliance Cluster', '연맹 구역 (': 'Alliance Clusters (',
  '연맹 구역으로 이동 (': 'Go to Alliance Cluster (', '개 연맹)': ' alliances)', '도시 목록 (': 'City List (', '개) · 키보드로 선택': ') · Select with Keyboard',
  '표시할 도시가 없습니다. 검색어와 연맹 선택을 확인해 주세요.': 'No cities to display. Check the search term and alliance filter.',
  '좌표': 'Coordinates', '· 전투력': '· Power', '도시 목록 페이지': 'City list pages', '도시 레벨 정보 없음': 'Town level unavailable',
  '도시를 선택해 정보를 확인하세요': 'Select a city to view its details', '설원': 'Snowfield', '평야': 'Plains', '비옥한 땅': 'Fertile Land', '왕성': 'King’s Castle',
  '지도 확대': 'Zoom in', '확대 ＋': 'Zoom In ＋', '지도 축소': 'Zoom out', '축소 −': 'Zoom Out −', '전체 왕국': 'Entire Kingdom',
  '확장 닫기': 'Exit Expanded View', '화면 확장': 'Expand Map',
  '등각 투영 왕국 지도. 휠 또는 확대 버튼으로 확대하고 드래그하여 이동할 수 있습니다. 아래 도시 목록으로도 영주를 선택할 수 있습니다.': 'Isometric kingdom map. Use the wheel or zoom buttons to zoom and drag to pan. Governors can also be selected from the city list below.',
  '휠·두 손가락으로 확대 · 드래그로 이동': 'Wheel or pinch to zoom · Drag to pan', '배율': 'Zoom', '선택한 도시 정보': 'Selected city details',
  '도시 정보 닫기': 'Close city details', '저장 시점 보호막:': 'Saved shield status:', '있음': 'Yes', '없음': 'No', '· 연소:': '· Burning:', '장비 보기': 'View Gear',
  '왕국 번호가 없어 지도를 표시할 수 없습니다. (유효 범위: 1~10000)': 'A valid kingdom number is required to display the map (1–10000).',
  '좌표가 없거나 유효 범위(0~1200)를 벗어났습니다.': 'Coordinates are missing or outside the valid range (0–1200).',
  '위치 지도 닫기': 'Close Location Map', '지도에서 위치 보기': 'View Location on Map', '영주 위치 지도': 'Governor location map',
  '· 프로필 위치': '· Profile Location', '프로필 좌표로': 'Go to Profile Coordinates', '저장된 지도를 불러오는 중…': 'Loading saved map…',
  '저장된 지도 · 실시간 아님 ·': 'Saved map · Not live ·', '갱신 시각 미상': 'Update time unknown',
  '일치하는 UID의 도시가 없어': 'No city matches this UID;', '저장된 도시가 없어': 'No saved cities;',
  '프로필 좌표만 중심에 표시합니다.': 'the map is centered on profile coordinates only.', '저장된 도시 위치(X:': 'Saved city location (X:',
  ')가 다릅니다. 중심은 프로필 좌표, 선택 도시는 저장된 위치를 따릅니다.': ') differs. The map is centered on profile coordinates; the selected city uses its saved location.',
  '주변 도시 · 키보드로 선택': 'Nearby Cities · Select with Keyboard',
  '조회 ID는 1~15자리의 0보다 큰 숫자로 입력해 주세요.': 'Enter a positive ID of 1–15 digits.',
  '영주 정보를 불러오지 못했습니다. ID를 확인하고 다시 조회해 주세요.': 'Could not load governor information. Check the ID and try again.',
  '조회된 영주 정보가 없습니다. 다른 ID로 다시 조회해 주세요.': 'No governor information found. Try another ID.',
  '조회 시간이 초과되었습니다. 잠시 후 다시 조회해 주세요.': 'Lookup timed out. Please try again shortly.',
  '조회 연결에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.': 'Could not connect for lookup. Please try again shortly.',
  '닉네임이나 검색어를 2~80자로 입력해 주세요.': 'Enter a nickname or search term of 2–80 characters.',
  '왕국 번호는 1~10000 사이의 숫자로 입력해 주세요.': 'Enter a kingdom number from 1 to 10000.',
  '검색 결과를 불러오지 못했습니다. 잠시 후 다시 검색해 주세요.': 'Could not load search results. Please try again shortly.',
  '검색 시간이 초과되었습니다. 잠시 후 다시 검색해 주세요.': 'Search timed out. Please try again shortly.',
  '검색 연결에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.': 'Could not connect for search. Please try again shortly.',
  '왕국 지도를 불러오지 못했습니다. 잠시 후 다시 조회해 주세요.': 'Could not load the kingdom map. Please try again shortly.',
  '지도 조회 시간이 초과되었습니다. 잠시 후 다시 조회해 주세요.': 'Map lookup timed out. Please try again shortly.',
  '지도 연결에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.': 'Could not connect for the map. Please try again shortly.',
  '지도 조회 시간이 초과되었습니다. 닫은 뒤 다시 열어 주세요.': 'Map lookup timed out. Close and reopen the map to retry.',
  '지도를 불러오지 못했습니다. 닫은 뒤 다시 열어 주세요.': 'Could not load the map. Close and reopen it to retry.',
  '플레이어 조회 서비스가 아직 설정되지 않았습니다.': 'The player lookup service is not configured yet.',
  '게임 내 영주 ID를 1~15자리 양의 정수로 입력해 주세요.': 'Enter your in-game Governor ID as a positive integer of 1–15 digits.',
  'ID 유형은 governor_id 또는 uid만 지원합니다.': 'Only governor_id and uid ID types are supported.',
  'GET 요청만 지원합니다.': 'Only GET requests are supported.', '해당 영주 ID의 플레이어를 찾을 수 없습니다.': 'No player found for this Governor ID.',
  '플레이어 조회 서비스 인증에 문제가 있습니다.': 'The player lookup service has an authentication problem.',
  '조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.': 'Too many lookup requests. Please try again shortly.',
  '플레이어 조회 시간이 초과되었습니다. 다시 시도해 주세요.': 'Player lookup timed out. Please try again.',
  '플레이어 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.': 'Could not load player information. Please try again shortly.',
  '검색어를 2~80자로 입력해 주세요.': 'Enter a search term of 2–80 characters.',
  '왕국 번호를 1~10000 사이의 정수로 입력해 주세요.': 'Enter a whole kingdom number from 1 to 10000.',
  '조회 시간이 초과되었습니다. 다시 시도해 주세요.': 'Lookup timed out. Please try again.',
  '정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.': 'Could not load information. Please try again shortly.',
};

export type PlayerLocale = 'ko' | 'en';
export const playerNumberLocale = (locale: PlayerLocale = getLocale()) => locale === 'en' ? 'en-US' : 'ko-KR';

/** Exact UI copy lookup; preserves whitespace around JSX/template fragments. */
export function playerText(text: string, locale: PlayerLocale = getLocale()): string {
  if (locale === 'ko') return text;
  const key = text.trim();
  const translated = labels[key];
  return translated === undefined ? text : text.replace(key, () => translated);
}

export function playerError(message: string, locale: PlayerLocale = getLocale()): string {
  const translated = playerText(message, locale);
  return locale === 'en' && /[가-힣]/.test(translated)
    ? 'Could not load information. Please try again shortly.' : translated;
}

/** Provider labels only, never player/alliance identity strings. */
export function playerLabel(value?: string | null, locale: PlayerLocale = getLocale()): string | undefined {
  if (!value) return undefined;
  if (locale === 'ko') return /[가-힣]/.test(value) ? value : undefined;
  const translated = playerText(value, locale);
  if (!/[가-힣]/.test(translated)) return translated;
  return undefined;
}

const statWords: Record<string, string> = {
  '전체 부대': 'All Troops', '전체 병력': 'All Troops', '모든 부대': 'All Troops', '모든 병력': 'All Troops',
  '공격력': 'Attack', '방어력': 'Defense', '파괴력': 'Lethality', '살상력': 'Lethality', '치명타': 'Critical Hit',
  '생명력': 'Health', '체력': 'Health', '공격': 'Attack', '방어': 'Defense', '병력': 'Troop', '부대': 'Troop',
  '보병': 'Infantry', '기병': 'Cavalry', '궁병': 'Archer', '집결': 'Rally', '수비': 'Garrison',
  '피해량': 'Damage', '피해': 'Damage', '감소': 'Reduction', '증가': 'Increase', '속도': 'Speed',
  '행군': 'March', '치료': 'Healing', '건설': 'Construction', '연구': 'Research', '훈련': 'Training',
  '용량': 'Capacity', '수용량': 'Capacity', '확률': 'Chance', '스탯': 'Stat', '능력치': 'Stat',
};
const statPattern = new RegExp(Object.keys(statWords).sort((a, b) => b.length - a.length).join('|'), 'g');

export function playerStatLabel(value?: string | null, id?: string | number | null, locale: PlayerLocale = getLocale()): string {
  if (locale === 'ko') return value || `능력치 ${id ?? ''}`.trim();
  const text = value && playerText(value, locale).replace(statPattern, word => ` ${statWords[word]} `).replace(/\s+/g, ' ').trim();
  return text && !/[가-힣]/.test(text) ? text : `Stat ${id ?? ''}`.trim();
}

/** Translate numeric units without changing the stored provider value. */
export function playerStatValue(value: string | number | null | undefined, locale: PlayerLocale = getLocale()): string {
  if (value == null) return '—';
  if (typeof value === 'number') return value.toLocaleString(playerNumberLocale(locale));
  if (locale === 'ko' || !/[가-힣]/.test(value)) return value;
  const units: Record<string, string> = { '초': 's', '분': 'min', '시간': 'h', '일': 'd', '명': '', '개': '', '배': '×', '레벨': 'level', '티어': 'Tier', '단계': 'step' };
  const text = value.replace(/([+-]?[\d,.]+)\s*(만|억|조)/g, (_, amount: string, unit: string) =>
    (Number(amount.replace(/,/g, '')) * ({ '만': 1e4, '억': 1e8, '조': 1e12 }[unit] ?? 1)).toLocaleString(playerNumberLocale(locale)))
    .replace(/순금\s*(\d+)/g, 'TG $1')
    .replace(/시간|레벨|티어|단계|초|분|일|명|개|배/g, unit => ` ${units[unit]}`).trim();
  return /[가-힣]/.test(text) ? '—' : text;
}
