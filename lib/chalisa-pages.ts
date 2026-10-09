/** A spread shares one artwork; each physical page owns its complete text and scene. */
export const LEGACY_CHALISA_BLUEPRINT = 'chalisa-facing-pages';
export const DIAGONAL_CHALISA_BLUEPRINT = 'chalisa-illustrated-facing-pages';
export const CHALISA_BLUEPRINT = 'chalisa-full-spread';
export const CHALISA_FULL_SPREAD_IDS = [CHALISA_BLUEPRINT, 'chalisa-full-spread-canopy', 'chalisa-full-spread-flow'] as const;
export const isFullSpreadChalisa = (id: unknown) => CHALISA_FULL_SPREAD_IDS.some(value => value === id);
export const isChalisaBlueprint = (id: unknown) => isFullSpreadChalisa(id) || id === DIAGONAL_CHALISA_BLUEPRINT || id === LEGACY_CHALISA_BLUEPRINT;
export const hasCompactChalisaText = (id: unknown) => isFullSpreadChalisa(id) || id === DIAGONAL_CHALISA_BLUEPRINT;
export type ChalisaPage = { original: string; meaning: string; sourceReference: string; scene: string };
export function parseChalisaPages(value: unknown): ChalisaPage[] | undefined {
 if (value === undefined) return;
 if (!Array.isArray(value) || value.length < 1 || value.length > 2) throw Error('A Chalisa spread needs one or two physical pages.');
 return value.map(item => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('Invalid Chalisa page.');
  const result = {} as ChalisaPage;
  for (const key of ['original','meaning','sourceReference','scene'] as const) {
   if (typeof item[key] !== 'string' || item[key].length > (key === 'sourceReference' ? 1000 : 12000)) throw Error(`Invalid Chalisa page ${key}.`);
   result[key] = item[key];
  }
  return result;
 });
}
/** Compatibility fields remain exact aggregates, never a shared explanation. */
export function chalisaSpreadText(pages: ChalisaPage[]) {
 return {
  original: pages.map(p => p.original).join('\n\n'),
  meaning: pages.map(p => p.meaning).join('\n\n'),
  sourceReference: pages.map(p => p.sourceReference).join(' / '),
  scene: pages.map((p,i) => `${i === 0 ? 'LEFT' : 'RIGHT'} PAGE — ${p.sourceReference}: ${p.scene}`).join('\n\n'),
 };
}
export function chalisaPageText(page: ChalisaPage) {
 return `${page.original}\n\n${page.meaning}`;
}
