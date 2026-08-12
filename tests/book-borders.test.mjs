import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("borderless plus three decorative borders can be selected independently", () => {
  for (const border of ["No Border", "Lotus Arch", "Folk Geometry", "Golden Lines"]) {
    assert.match(page, new RegExp(border));
  }
  assert.match(page, /bookBorder: string/);
  assert.match(page, /function bookBorderPatch/);
  assert.match(page, /value=\{project\.bookBorder\}/);
});

test("book-border selections appear in the live multi-page glimpse", () => {
  assert.match(page, /book-border-\$\{borderClass\}/);
  assert.match(page, /\{border\.label\} border/);
  assert.match(css, /\.book-glimpse\.book-border-lotus-arch \.glimpse-page/);
  assert.match(css, /\.book-glimpse\.book-border-folk-geometry \.glimpse-page/);
  assert.match(css, /\.book-glimpse\.book-border-golden-lines \.glimpse-page/);
  assert.match(css, /\.book-border-no-border/);
});

test("screen preview and PDF use the same physical page sheets", () => {
  assert.match(page, /function paginateReaderHtml/);
  assert.match(page, /book-sheet preview-page chapter-preview/);
  assert.match(page, /PAGE \{pageIndex \+ 1\} OF \{pageCount\}/);
  assert.match(css, /\.preview-scroll>article\.book-sheet[^}]*height:665px/);
  assert.match(css, /\.preview-scroll>article\.book-sheet[^}]*height:263mm!important/);
});

test("selected borders reach editor, preview and print output", () => {
  assert.match(page, /paper[^`]*book-border-\$\{borderClass\}/);
  assert.match(page, /preview-cover[^`]*\$\{borderClass\}/);
  assert.match(page, /chapter-preview[^`]*\$\{borderClass\}/);
  assert.match(css, /\.preview-page\.book-border-lotus-arch/);
  assert.match(css, /\.preview-page\.book-border-folk-geometry/);
  assert.match(css, /\.preview-page\.book-border-golden-lines/);
  assert.match(css, /@media print\{\.book-border-lotus-arch/);
});

test("older saved books receive a safe border default", () => {
  assert.match(page, /bookBorder\(cleanSaved\.bookBorder \?\? ""\)/);
  assert.match(page, /bookBorder: border\.value/);
});
