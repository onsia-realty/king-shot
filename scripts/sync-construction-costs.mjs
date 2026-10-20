// Public data only. Parse literal AST nodes; never execute the downloaded bundle.
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { mergeConstructionSupplement } from './construction-supplement.mjs';

const pageUrl = 'https://kshot-lab.com/tools/construction';
async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}
function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken)
    return !literal(node.operand);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(p => {
    if (!ts.isPropertyAssignment(p)) throw new Error('Nonliteral property');
    return [p.name.text, literal(p.initializer)];
  }));
  throw new Error(`Unexpected data AST kind ${ts.SyntaxKind[node.kind]}`);
}
const html = await fetchText(pageUrl);
let buildings, bundleUrl, bundle;
for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
  const url = new URL(match[1], pageUrl).href;
  const text = await fetchText(url);
  if (!text.includes('temperedTrueGold') || !text.includes('cityCenterRequired')) continue;
  const ast = ts.createSourceFile('public.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isArrayLiteralExpression(node) && node.elements.length && ts.isObjectLiteralExpression(node.elements[0])) {
      const first = node.elements[0];
      if (first.properties.some(p => p.name?.text === 'maxLevel') && first.properties.some(p => p.name?.text === 'levels')) {
        if (buildings) throw new Error('Multiple building datasets');
        buildings = literal(node); bundleUrl = url; bundle = text;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
if (!buildings) throw new Error('Building dataset not found');
console.log(JSON.stringify(buildings.map(b => ({id:b.id,max:b.maxLevel,count:b.levels.length})), null, 2));
if (!process.argv.includes('--write')) process.exit(0);
function normalizedLevel(s) {
  if (s.level <= 30) return s.level;
  if (!Number.isInteger(s.trueGoldLevel) || !Number.isInteger(s.trueGoldStep)) throw new Error('Missing TG metadata');
  return 30 + 5 * s.trueGoldLevel + (s.isTrueGoldMilestone ? 0 : s.trueGoldStep);
}
const normalized = buildings.map(b => ({
  id: b.id, name: b.name.ko,
  steps: b.levels.map((s, index) => {
    const previous = b.levels[index - 1];
    const fromLevel = previous ? normalizedLevel(previous) : undefined;
    const requirements = {};
    for (const r of s.requirements) requirements[r.buildingId] = Math.max(requirements[r.buildingId] ?? 0, r.targetLevel ?? r.level);
    if (s.cityCenterRequired > 0) requirements['town-center'] = Math.max(requirements['town-center'] ?? 0, s.cityCenterRequired);
    return {level:normalizedLevel(s),
      ...(fromLevel !== undefined && normalizedLevel(s) !== fromLevel + 1 ? {fromLevel} : {}),
      bread:s.food,wood:s.wood,stone:s.stone,iron:s.iron,truegold:s.trueGold,
      temperedTruegold:s.temperedTrueGold,seconds:s.timeSeconds,
      ...(s.powerGain === undefined ? {} : {power:s.powerGain}),requirements};
  }),
}));
for (const b of normalized) {
  const levels = b.steps.map(s => s.level);
  if (new Set(levels).size !== levels.length || levels.some((v,i) => !Number.isInteger(v) || v < 1 || v > 70 || (i > 0 && v <= levels[i-1]))) throw new Error(`Invalid level ordering ${b.id}`);
  for (const s of b.steps) {
  for (const [key,value] of Object.entries(s)) if (key !== 'requirements' && (!Number.isFinite(value) || value < 0)) throw new Error(`Invalid ${b.id}/${s.level}/${key}`);
  for (const [id,level] of Object.entries(s.requirements)) if (!normalized.find(b => b.id === id)?.steps.some(s => s.level === level)) throw new Error(`Missing prerequisite ${id}/${level}`);
  }
}
// Validate upstream prerequisites before appending TC-only rows. Supplemental requirements
// retain source levels even when other buildings' cost data does not yet cover them.
const supplement = JSON.parse(await readFile(new URL('../src/data/construction-supplement.json', import.meta.url), 'utf8'));
const merged = mergeConstructionSupplement(normalized, supplement);
const provenance = {
  pageUrl,bundleUrl,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(bundle).digest('hex'),
  referenceUiMinLevel:25, referenceSupportBuildingIds:['academy','embassy','barracks','range','stable','commandcenter'],
  notes:[
    'Raw source values retained; not independently verified in game. No interpolated rows.',
    'requirements merges explicit targetLevel (not displayed TG level) and cityCenterRequired.',
    'Early text-only prerequisites are NOT inferred; consult raw requirementText. Reference UI starts at 25.',
    'power preserves source powerGain verbatim; may represent cumulative building power, not upgrade delta. Do not claim summed values are verified power increases.',
    'Source label/trueGoldLevel can describe the preceding TG tier on partial steps. Use integer level for ordering.',
    'Academy raw TG1 is index31, TG8 index66; canonical indices are 35 and 70. Raw TG1 partial steps do not exist: canonical31..34 are absent, never filled with invented zero costs. All other TG building indices already match canonical indices.',
    'Academy TG1 single row explicitly has zero resource costs and 2 seconds in source; this is preserved, not an assumed free upgrade.',
    'Optional fromLevel records a direct transition between consecutive source rows when canonical levels are not consecutive. Only academy level35 has fromLevel30; no intermediate costs are invented.',
    'Simplegameguide corroborates TC31..35: 67M bread/wood,13M stone,3.3M iron,132 TG,604800 seconds each.',
    'Known discrepancy: TC11 stone is 20000 in reference versus 260000 in simplegameguide and old local table. Retained reference value, not silently corrected.',
  ],
  corroborationUrl:'https://simplegameguide.com/kingshot-building-requirements/',
  supplementFile:'construction-supplement.json',
};
const source = {provenance,buildings};
const header = `/**\n * Generated from public kshot-lab construction data by scripts/sync-construction-costs.mjs.\n * Source, raw labels, incomplete text prerequisites and provenance: construction-source.json.\n * No extrapolation: supported levels differ by building; inspect steps, not a universal cap.\n * Level 1..30 = normal; 31..35 = progress to TG1; ... 66..70 = progress to TG8.\n * Source powerGain is preserved, NOT guaranteed to be an incremental power gain.\n */\nexport interface ConstructionStep {\n  level: number;\n  bread: number;\n  wood: number;\n  stone: number;\n  iron: number;\n  truegold: number;\n  temperedTruegold: number;\n  seconds: number;\n  power?: number;\n  requirements: Record<string, number>;\n}\nexport interface ConstructionBuilding {\n  id: string;\n  name: string;\n  steps: ConstructionStep[];\n}\n/** Reference UI lower bound; source contains earlier levels with incomplete prerequisites. */\nexport const CONSTRUCTION_REFERENCE_MIN_LEVEL = 25;\nexport const CONSTRUCTION_REFERENCE_SUPPORT_IDS = ${JSON.stringify(provenance.referenceSupportBuildingIds)} as const;\nexport const CONSTRUCTION_BUILDINGS: ConstructionBuilding[] = `;
await writeFile(new URL('../src/data/construction-source.json', import.meta.url), JSON.stringify(source,null,2)+'\n');
const typedHeader = header.replace('  level: number;', '  level: number;\n  /** Explicit atomic source transition; academy TG1 goes directly from 30 to 35. Otherwise level - 1. */\n  fromLevel?: number;')
  .replace(' * No extrapolation:', ' * Town Center 71..80: construction-supplement.json (public sources checked 2026-10-21).\n * No extrapolation:');
await writeFile(new URL('../src/data/construction-costs.ts', import.meta.url),typedHeader + JSON.stringify(merged,null,2)+';\n');
console.log(`Wrote ${merged.length} buildings, ${merged.reduce((n,b)=>n+b.steps.length,0)} steps`);
