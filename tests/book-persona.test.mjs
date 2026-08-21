import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const persona = await readFile(new URL("../lib/book-persona.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const pedagogy = await readFile(new URL("../lib/pedagogy.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("seven distinct source-led book identities are available", () => {
  for (const id of ["court-of-decisions", "theatre-of-feelings", "discovery-fieldbook", "living-history-chronicle", "wisdom-and-ideas", "folk-story-caravan", "makers-workshop"]) assert.match(persona, new RegExp(`id: "${id}"`));
  assert.match(persona, /inferBookPersona/);
  assert.match(persona, /avoidSignatures/);
});

test("source upload selects and persists a complete Book Persona", () => {
  assert.match(page, /const persona = inferBookPersona/);
  assert.match(page, /\.\.\.bookPersonaPatch\(persona\)/);
  assert.match(page, /bookPersona: persona/);
  assert.match(page, /SOURCE-LED BOOK IDENTITY/);
  assert.match(page, /bookPersonaDefinitions\.map/);
});

test("persona reaches writing, repair and illustration prompts", () => {
  assert.match(page, /bookPersona: snapshot\.bookPersona/);
  assert.match(worker, /bookPersona: project\.bookPersona/);
  assert.match(pedagogy, /bookPersonaPrompt\(bookPersona\)/);
  assert.match(page, /BOOK PERSONA/);
  assert.match(page, /project\.bookPersona\.illustrationStyle/);
});

test("preview, PDF and editor use visibly distinct persona families", () => {
  assert.match(page, /bookPersonaClass\(project\.bookPersona\)/);
  assert.match(css, /preview-cover\.book-persona-theatre-of-feelings/);
  assert.match(css, /preview-cover\.book-persona-discovery-fieldbook/);
  assert.match(css, /preview-cover\.book-persona-folk-story-caravan/);
  assert.match(css, /paper\[class\*="book-persona-"\]/);
});
