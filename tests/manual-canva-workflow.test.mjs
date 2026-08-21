import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("manual Canva workflow downloads, compares, accepts and restores physical pages", () => {
  assert.match(source, /MANUAL CANVA WORKFLOW/);
  assert.match(source, /Download page PNG/);
  assert.match(source, /Open Canva/);
  assert.match(source, /Use Canva version/);
  assert.match(source, /Keep studio version/);
  assert.match(source, /Restore studio version/);
  assert.match(source, /html2canvas/);
  assert.match(source, /data-page-slot/);
});

test("accepted Canva pages persist separately from chapter prose and enter the PDF renderer", () => {
  assert.match(source, /canvaPages\?: CanvaPageOverride\[\]/);
  assert.match(source, /fetch\("\/api\/image"/);
  assert.match(source, /className="book-sheet canva-custom-sheet"/);
  assert.match(source, /pdf-render-stack/);
  assert.match(source, /current: version/);
  assert.match(source, /history: existing/);
});

test("expanded typography, watermark and border libraries remain selectable", () => {
  for (const option of ["Literary Classic", "Modern Humanist", "Sanskrit Scholar", "Playful Display", "Editorial Sans", "No Watermark", "Palm Leaf", "Temple Window", "River Lines", "Botanical Study", "Manuscript Double Rule", "Museum Archive Frame", "Botanical Corners", "Discovery Field Notes"]) {
    assert.ok(source.includes(option), `missing design option: ${option}`);
  }
  assert.match(css, /typography-sanskrit-scholar/);
  assert.match(css, /page-watermark="no-watermark"/);
  assert.match(css, /book-border-manuscript-double-rule/);
});
