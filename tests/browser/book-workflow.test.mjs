import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

const appUrl = process.env.IKS_APP_URL;
const require = createRequire(resolve('package.json'));
const ts = require('typescript');
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const source = readFileSync(file, 'utf8') + (file.endsWith('/app/page.tsx') ? '\nexport { emptyProject };' : '');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.') ? load(resolve(dirname(file), /\.tsx?$/.test(name) ? name : existsSync(resolve(dirname(file),name+'.ts')) ? name+'.ts' : name+'.tsx')) : require(name), module, module.exports);
  return module.exports;
}

test('new books measure all trim sizes and preserve saved Designer/Preview geometry', { skip: !appUrl, timeout: 180000 }, async () => {
  const { emptyProject } = load(resolve('app/page.tsx'));
  const engine = require(process.env.IKS_PLAYWRIGHT_MODULE || 'playwright')[process.env.IKS_BROWSER || 'chromium'];
  const browser = await engine.launch({ headless: true });
  try {
    for (const format of ['7x10', 'a4', 'a5', '6x9']) {
      const page = await browser.newPage({ viewport: { width: 1536, height: 1050 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const artwork = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 180; const ctx = c.getContext('2d'); ctx.fillStyle = '#ad6b35'; ctx.fillRect(0, 0, 300, 180); return c.toDataURL(); });
      const prose = Array.from({ length: 16 }, (_, i) => `<p id="p${i}"><strong>Observation ${i}.</strong> ${'The children compare the seeds, record what they see, and discuss why each plant grows differently. '.repeat(5)}</p>`).join('');
      const table = '<table><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody>' + Array.from({ length: 25 }, (_, i) => `<tr><td>धर्म ${i}</td><td>Careful observation and thoughtful action.</td></tr>`).join('') + '</tbody></table>';
      let project = { ...emptyProject, id: `layout-regression-${format}`, title: 'Garden structure regression', source: 'Garden.pdf', bookFormat: format, bookBorder: 'No border', briefApproved: true, adaptationPlanConfirmed: true, designerPages: [], designerPageOrder: [], designerLayoutSnapshot: false, chapters: [{ id: 1, title: 'A growing garden', sectionKind: 'chapter', body: prose + '<h3>Try it</h3><ol start="4"><li>Compare two seeds.</li><li>Explain your observation.</li></ol>', imageUrl: artwork, visualType: 'external-uploaded', imageCaption: 'The children study a garden.', imageAlt: 'A garden scene', pages: 5, status: 'approved', generationStatus: 'Completed', manualApproved: true, locked: false, sourceRefs: [] }, { id: 2, title: 'Glossary', sectionKind: 'glossary', body: table, pages: 2, status: 'approved', generationStatus: 'Completed', manualApproved: true, locked: false, sourceRefs: [] }] };
      await page.route('**/api/preferences', route => route.fulfill({ json: { preferences: [] } }));
      await page.route('**/api/projects', async route => { if (route.request().method() === 'POST') project = route.request().postDataJSON(); await route.fulfill({ json: route.request().method() === 'POST' ? { project } : { projects: [project] } }); });
      await page.goto(appUrl);
      await page.getByRole('button', { name: /CHAPTERS.*Garden structure/ }).click();
      if (await page.getByRole('button', { name: 'Designer', exact: true }).count()) await page.getByRole('button', { name: 'Designer', exact: true }).click();
      await page.waitForFunction(() => /balanced locally|Layout balancing failed/.test(document.body.innerText), {}, { timeout: 60000 });
      assert.equal(project.designerLayoutSnapshot, true, await page.locator('.designer-status').innerText());
      const count = project.designerPages.filter(p => !p.deleted).length;
      assert.ok(count > 4);
      await page.getByRole('button', { name: 'Preview & PDF', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.book-preflight-results'));
      assert.match(await page.locator('.book-preflight-results').textContent(), /0 blocking pages/, format);
      assert.equal(await page.locator('.pdf-render-stack .preview-body img').count(), 1, 'Uploaded artwork survives normalization and reflow');
      const differences = await page.evaluate(() => {
        const differences = [];
        for (const source of document.querySelectorAll('.designer-flow-page .book-sheet')) {
          const target = document.querySelector(`.preview-v2 .pdf-render-stack [data-page-slot="${source.dataset.pageSlot}"]`);
          if (!target) { differences.push('missing page'); continue; }
          const a = source.getBoundingClientRect(), b = target.getBoundingClientRect();
          const scaleA = a.width / source.offsetWidth, scaleB = b.width / target.offsetWidth;
          const nodes = [...source.querySelectorAll('.preview-body, .preview-body p, .preview-body img, figcaption, .sheet-number')];
          const others = [...target.querySelectorAll('.preview-body, .preview-body p, .preview-body img, figcaption, .sheet-number')];
          if (nodes.length !== others.length) { differences.push('missing content'); continue; }
          nodes.forEach((node, i) => { const r = node.getBoundingClientRect(), t = others[i].getBoundingClientRect(); if (Math.abs((r.x - a.x) / scaleA - (t.x - b.x) / scaleB) > .2 || Math.abs((r.y - a.y) / scaleA - (t.y - b.y) / scaleB) > .2) differences.push(node.tagName); });
        }
        return differences;
      });
      assert.deepEqual(differences, [], format);
      assert.deepEqual(errors, []);
      await page.reload();
      await page.getByRole('button', { name: /CHAPTERS.*Garden structure/ }).click();
      await page.locator('.designer-flow-page').first().waitFor();
      assert.equal(await page.locator('.designer-flow-page').count(), count, 'Saved pagination survives reload');
      await page.close();
    }
  } finally { await browser.close(); }
});
