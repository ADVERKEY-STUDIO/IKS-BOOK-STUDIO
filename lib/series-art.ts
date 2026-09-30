/** Stable, versioned character treatments. Never renumber these within version 1. */
export const characterStyles = [
  { id: 1, name: 'Gentle rounded', description: 'Rounded faces, softly curved silhouettes, large expressive eyes, compact child-friendly proportions and gentle expressions.' },
  { id: 2, name: 'Classic balanced', description: 'Oval faces, balanced natural proportions, medium almond-shaped eyes, graceful gestures and calm dignified expressions.' },
  { id: 3, name: 'Lyrical slender', description: 'Slender elongated silhouettes, delicate facial features, smaller expressive eyes, flowing hair and clothing, elegant restrained gestures.' },
  { id: 4, name: 'Bold expressive', description: 'Broad clear silhouettes, angular brows and noses, strong expressive poses, simplified facial planes and confident graphic shapes.' },
] as const;
export type CharacterOption = typeof characterStyles[number]['id'];
/** Retained only to read and resave drafts created by the retired website picker. */
export type SeriesArt = { version: 1; option?: CharacterOption; approved?: boolean };
export const seriesReferenceName = (option: CharacterOption) => `reference-series-${option}.png`;
export const characterOptionName = (option: CharacterOption) => `reference-character-option-${option}.png`;
export const isSeriesReference = (name: string) => /^reference-(series|character-option)-[1-4]\.png$/.test(name);
export const MAX_STYLE_REFERENCES = 11; // Three user references + four masters + four current sheets.
export function parseSeriesArt(value: unknown): SeriesArt | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid character style selection.');
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || (v.option !== undefined && !characterStyles.some(s => s.id === v.option)) ||
      (v.approved !== undefined && typeof v.approved !== 'boolean') || (v.approved && v.option === undefined))
    throw Error('Invalid character style selection.');
  return { version: 1, ...(v.option !== undefined ? { option: v.option as CharacterOption } : {}), ...(v.approved !== undefined ? { approved: v.approved as boolean } : {}) };
}
type ArtDraft = {
  templateId: string; title: string; language: string; source?: { name: string };
  visualDirection?: { seriesArt?: SeriesArt; characters: string; audience: string; notes: string };
  references?: Record<string, Blob>;
};

/** One conversation owns the choice; saved website approval metadata is legacy only. */
export function characterOptionsPrompt(draft: ArtDraft) {
  return `CHARACTER CHOICE IN CHATGPT — TWO PHASES, ONE CONVERSATION
This is the complete book request, including the production instructions and book.json schema below. Do not ask the user to return to the website for character-sheet uploads, approval or a second request.

PHASE 1 — SHOW FOUR OPTIONS AND WAIT
First create exactly FOUR different character reference sheet images for "${draft.title}", using the actual supplied source and the selected template described below.
Source: ${draft.source?.name || 'source.pdf'}. Language: ${draft.language}. Audience: ${draft.visualDirection?.audience || 'Family readers'}.
Characters: ${draft.visualDirection?.characters || 'Identify the recurring characters in the supplied source.'}
FIXED CATALOGUE: character-styles-v1. Keep all four option numbers and treatments the same across different books:
${characterStyles.map(s => `OPTION ${s.id} — ${s.name}: ${s.description} Output: character-option-${s.id}.png.`).join('\n')}
All four use the selected template's medium, palette, texture and visual theme; character shape language differs. Show the SAME source-appropriate cast, clothing, front/side/three-quarter views, expressions and relative heights in each option. Adapt identities to the current book; do not copy a different book's deity.
Reuse the corresponding prior option sheets already available in this ChatGPT conversation as style references for the series. When none are available, follow these fixed definitions; do not claim an exact visual match to an unseen book.
Return four separate actual PNG images, clearly numbered 1–4. Do not substitute prose descriptions or a single montage. If interrupted, return finished sheets and list the missing options.
Ask "Which option would you like: 1, 2, 3 or 4?" Then STOP and WAIT for the user's reply in this ChatGPT conversation. Do not generate book pages, covers or book.json yet. Any saved option or website approval metadata is not the user's choice for this request.

PHASE 2 — CONTINUE HERE AFTER THE USER CHOOSES
Once the user replies with an option number, use that exact generated sheet as images/character-reference.png and proceed directly with the FULL BOOK INSTRUCTIONS below in this same conversation. No website upload, website approval, new ZIP request or repeated confirmation is required.
Attach the chosen sheet to every illustration call. Do not regenerate it, blend the unselected options, or change its faces, proportions, clothing or rendering. Record character-styles-v1, the chosen option and its visual traits in characterGuide.
Preserve the requested passage grouping, meanings, template layout and complete source coverage. Generate all declared separate illustrations and return Completed-Book.zip containing book.json and images/. If generation limits interrupt completion, return completed work and list missing filenames for continuation in this conversation.
The instruction to WAIT for a choice takes precedence over any later instruction to complete the book in one go; those production instructions apply only after the choice.
`;
}
