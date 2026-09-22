/** Measured composition families for the storybook reference, shared by art briefs and rendering.
 * Coordinates are percentages of an open 2:1 spread, not arbitrary model-generated CSS. */
export const storyCompositions = {
  'landscape-opening': {
    name: 'Landscape opening',
    scene: 'A low continuous landscape sweeps across the bottom third; an intimate rounded scene occupies the upper-right. Keep the upper-left sky and middle-right breathing space open. Art flows around the reading areas without a boxed panel.',
    regions: [{ x: 9, y: 13, w: 31, h: 43 }, { x: 63, y: 57, w: 28, h: 21 }],
  },
  'diagonal-scenes': {
    name: 'Two diagonal story moments',
    scene: 'Two distinct sequential moments in one continuous spread: a medium-distance scene across the upper-left, and a closer character interaction at the lower-right. Separate the moments with irregular cream negative space, not frames. Reading begins at lower-left and continues upper-right. Avoid a single monumental figure dominating the right half.',
    regions: [{ x: 6, y: 68, w: 29, h: 25 }, { x: 59, y: 8, w: 32, h: 25 }, { x: 55, y: 42, w: 19, h: 20 }],
  },
  'open-vignette': {
    name: 'Airy vignette & close-up',
    scene: 'An expressive close-up occupies the left half with irregular painted edges; a small distant scene sits at lower-right. Let unpainted paper connect both moments. Reserve upper-right for narrative and lower-left for a short explanation. Avoid wallpaper-like foliage around all four edges.',
    regions: [{ x: 59, y: 10, w: 32, h: 46 }, { x: 8, y: 73, w: 32, h: 20 }],
  },
} as const;
export type StoryComposition = keyof typeof storyCompositions;
export const storySequence = Object.keys(storyCompositions) as StoryComposition[];
export function storyCompositionAt(index: number): StoryComposition { return storySequence[index % storySequence.length]; }
export function storyCompositionPrompt(id: StoryComposition) {
  const c = storyCompositions[id];
  return `SPREAD BLUEPRINT: ${id} — ${c.name}. Flat 2:1 canvas, no book mockup. ${c.scene}\nTEXT-SAFE REGIONS (percent from top-left): ${c.regions.map((r, i) => `${i + 1}: x=${r.x}, y=${r.y}, width=${r.w}, height=${r.h}`).join('; ')}. Leave these areas pale cream or very light sky, with no faces, props or high-contrast marks. They are organic negative space, NOT painted rectangles. Do not render text, titles, decorative headings, borders, captions or lettering. The app typesets the words separately. Create the requested distinct narrative moments from the source; do not substitute unrelated village scenery.`;
}
/** Split only at whitespace; concatenation is byte-for-byte identical to the source. */
export function splitStoryText(text: string): [string, string] {
  if (!text) return ['', ''];
  const boundaries = [...text.matchAll(/\s+/g)].map(m => m.index + m[0].length);
  if (!boundaries.length) return [text, ''];
  const midpoint = boundaries.reduce((a, b) => Math.abs(b - text.length / 2) < Math.abs(a - text.length / 2) ? b : a);
  return [text.slice(0, midpoint), text.slice(midpoint)];
}
export function storyTextBlocks(page: { original: string; meaning: string; composition?: StoryComposition }) {
  const composition = page.composition || 'landscape-opening';
  const regions = storyCompositions[composition].regions;
  const originals = regions.length === 3 ? splitStoryText(page.original) : [page.original];
  return regions.map((region, i) => ({ ...region, role: i < originals.length ? 'original' : 'meaning', text: i < originals.length ? originals[i] : page.meaning }));
}
export function storyCompositionCss() {
  return `.composition-story-scene{aspect-ratio:2/1;container-type:inline-size;isolation:isolate;position:relative}
.composition-story-scene .copy{display:none}
.composition-story-scene .art{position:absolute;inset:0;width:100%;height:100%;padding:0;z-index:0}
.composition-story-scene .art>div{height:100%;width:100%!important}
.composition-story-scene .art img{width:100%!important;height:100%;object-fit:contain}
.composition-story-scene .story-text{position:absolute;z-index:1;margin:0;padding:0;background:transparent;border:0;box-shadow:none;color:#342e28;font-family:Book,Georgia,serif;white-space:pre-wrap;line-height:1.5;font-size:var(--story-font,1.35cqw);font-weight:400;overflow-wrap:anywhere}
.composition-story-scene .story-text.meaning{font-size:1.15cqw;font-style:italic}
.composition-story-scene .folio{display:none}
.ts-live.composition-story-scene{aspect-ratio:2/1}
.story-layout-note{font-size:13px;line-height:1.5;margin:10px 0;color:#65533f}`;
}
