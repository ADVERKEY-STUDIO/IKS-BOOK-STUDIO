import { parseExternalManuscript, type ExternalManuscriptResult } from './external-manuscript.ts';
import { attachSourceBookManifest, parseSourceBookManifest } from './source-book-package.ts';

export type ManuscriptInspection = { text: string; result: ExternalManuscriptResult; errors: string[] };

/** Chapter discovery survives package validation failures so readers can see what was found. */
export function inspectManuscript(text: string, audience: string, manifestText?: string): ManuscriptInspection {
  const result = parseExternalManuscript(text, audience);
  try {
    if (manifestText !== undefined) return { text, result: attachSourceBookManifest(result, parseSourceBookManifest(JSON.parse(manifestText))), errors: [] };
    if (/\{\{SLOKA:|:::sloka\s/.test(text)) throw new Error('This manuscript contains Sanskrit verse markers. Include source-manifest.json in the ZIP with the chapter files.');
    return { text, result, errors: [] };
  } catch (error) {
    return { text, result, errors: [error instanceof Error ? error.message : 'The source manifest could not be checked.'] };
  }
}

export function inspectManuscriptArchive(archive: Record<string, Uint8Array>, audience: string): ManuscriptInspection {
  const entries = Object.keys(archive).filter(path => !path.split('/').some(part => part.startsWith('.') || part === '__MACOSX'));
  const names = entries.filter(path => /\.(md|markdown|txt)$/i.test(path)).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!names.length) throw new Error('The ZIP contains no Markdown or text chapter files.');
  const decode = (path: string) => new TextDecoder().decode(archive[path]);
  const text = names.map(decode).join('\n\n');
  const manifests = entries.filter(path => path.split('/').at(-1) === 'source-manifest.json');
  if (manifests.length > 1) return { text, result: parseExternalManuscript(text, audience), errors: ['The ZIP contains more than one source-manifest.json. Keep one manuscript package and its matching manifest.'] };
  return inspectManuscript(text, audience, manifests.length ? decode(manifests[0]) : undefined);
}

export function manuscriptRepairRequest(errors: string[]) {
  return `Correct the attached manuscript ZIP using the original source PDF and its source-manifest.json. Return a complete corrected ZIP containing every chapter in the existing order and one matching source-manifest.json. Preserve the reader text, Sanskrit in Devanagari, source images and references.\n\nBook Studio found these problems:\n${errors.map(error => `- ${error}`).join('\n')}\n\nFor each declared verse, include exactly one :::sloka ID block in its declared section, containing the exact Sanskrit from the manifest and ending with ::: on its own line. Place it beside the relevant discussion. Count all sections, including introduction, conclusion and glossary, starting at 1. Check every verse and image anchor against its section before returning the ZIP. Do not invent Sanskrit, silently remove declared verses, or change source references to bypass validation. If a source detail cannot be verified, retain it with an explicit review note.`;
}
