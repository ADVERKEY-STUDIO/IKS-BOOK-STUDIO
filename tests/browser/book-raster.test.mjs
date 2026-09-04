import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(resolve(process.cwd(), "package.json"));
const { chromium } = require(process.env.IKS_PLAYWRIGHT_MODULE || "playwright");
const ts = require("typescript");
const code = ts.transpileModule(readFileSync("lib/book-raster.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const browser = await chromium.launch({ headless: true });
after(async () => browser.close());
const page = await browser.newPage();
await page.setContent('<style>*{box-sizing:border-box}#sheet{position:absolute;left:40px;top:120px;width:200px;height:240px;background:white;outline:3px solid green;outline-offset:-3px}#sheet::after{content:"";position:absolute;left:140px;top:180px;width:30px;height:30px;background:color-mix(in srgb,red 50%,blue)}img{position:absolute;left:20px;top:30px;width:100px;height:160px;object-fit:contain;object-position:center}</style><article id="sheet"><img></article>');
await page.evaluate(async (code) => {
  const exports = {}; new Function("exports", code)(exports); globalThis.raster = exports;
  const image = document.createElement("canvas"); image.width = 100; image.height = 50;
  const context = image.getContext("2d"); context.fillStyle = "red"; context.fillRect(0, 0, 100, 50);
  document.querySelector("img").src = image.toDataURL(); await document.querySelector("img").decode();
}, code);

for (const scale of [1, 1.7, 2.5]) test(`PDF raster at ${scale} preserves image fit, page origin, modern theme colours and pseudo-elements`, async () => {
  const result = await page.evaluate(async (scale) => {
    const canvas = await raster.renderBookPageCanvas(document.querySelector("#sheet"), { scale });
    const ctx = canvas.getContext("2d");
    const pixel = (x, y) => Array.from(ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data);
    return { width: canvas.width, height: canvas.height, border: pixel(1, 10), aboveArtwork: pixel(50, 45), artwork: pixel(50, 100), belowArtwork: pixel(50, 160), decoration: pixel(150, 190) };
  }, scale);
  assert.equal(result.width, Math.round(200 * scale)); assert.equal(result.height, Math.round(240 * scale));
  assert.deepEqual(result.border, [0, 128, 0, 255]);
  assert.deepEqual(result.aboveArtwork, [255, 255, 255, 255]);
  assert.deepEqual(result.artwork, [255, 0, 0, 255]);
  assert.deepEqual(result.belowArtwork, [255, 255, 255, 255]);
  assert.deepEqual(result.decoration, [128, 0, 128, 255]);
});

test("the folk border stays on the page edge and does not fill the page", async () => {
  const pixels = await page.evaluate(async () => {
    const sheet = document.querySelector("#sheet");
    sheet.style.border = "8px solid transparent";
    sheet.style.borderImage = "repeating-linear-gradient(45deg, red 0 8px, blue 8px 16px) 8";
    const canvas = await raster.renderBookPageCanvas(sheet, { scale: 1 });
    const ctx = canvas.getContext("2d");
    return { center: Array.from(ctx.getImageData(130, 100, 1, 1).data), edge: Array.from(ctx.getImageData(4, 50, 1, 1).data) };
  });
  assert.deepEqual(pixels.center, [255, 255, 255, 255]);
  assert.notDeepEqual(pixels.edge, [255, 255, 255, 255]);
});
