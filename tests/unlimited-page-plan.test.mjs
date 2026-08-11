import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("adaptations have no global maximum page limit", () => {
  assert.doesNotMatch(page, /Maximum book length/);
  assert.doesNotMatch(page, /UP TO 100 PAGES/);
  assert.doesNotMatch(page, /OUTPUT LIMIT/);
  assert.doesNotMatch(page, /project\.maxPages/);
  assert.doesNotMatch(page, /disabled=\{overBudget\}/);
  assert.match(page, /NO FIXED PAGE LIMIT/);
  assert.match(page, /No fixed maximum page limit/);
});

test("chapter summary page inputs accept any positive length", () => {
  assert.doesNotMatch(page, /max="30"/);
  assert.doesNotMatch(page, /Math\.min\(30/);
  assert.match(page, /There is no maximum page limit\./);
});
