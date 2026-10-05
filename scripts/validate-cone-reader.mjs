import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium, webkit } from 'playwright';

const root = process.cwd();
const reportDir = path.join(root, 'meta/audit/cone-reader');
fs.mkdirSync(reportDir, { recursive:true });
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json' };
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  let filename = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
  if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.html');
  if (!filename.startsWith(`${root}${path.sep}`) || !fs.existsSync(filename)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type':mime[path.extname(filename)] || 'application/octet-stream' });
  fs.createReadStream(filename).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/workbooks/cone/`;
const results = [];
const configurations = [
  { name:'desktop', engine:chromium, viewport:{ width:1280, height:900 } },
  { name:'android', engine:chromium, viewport:{ width:360, height:800 }, mobile:true },
  { name:'android-landscape', engine:chromium, viewport:{ width:915, height:412 }, mobile:true },
  { name:'iphone', engine:webkit, viewport:{ width:390, height:844 }, mobile:true },
  { name:'iphone-landscape', engine:webkit, viewport:{ width:844, height:390 }, mobile:true },
];

async function layout(page) {
  return page.evaluate(() => {
    const viewport = document.getElementById('cone-reader-viewport');
    const current = document.querySelector('.a4-page.is-current');
    const bounds = current.getBoundingClientRect();
    const host = viewport.getBoundingClientRect();
    const controls = Array.from(document.querySelectorAll('.cone-reader-toolbar button, .cone-reader-toolbar input, .cone-reader-toolbar a')).map((control) => ({ width:control.getBoundingClientRect().width, height:control.getBoundingClientRect().height }));
    return { visible:Array.from(document.querySelectorAll('.a4-page')).filter((sheet) => getComputedStyle(sheet).display !== 'none').length, width:current.offsetWidth, height:current.offsetHeight, left:bounds.left, right:bounds.right, bottom:bounds.bottom, hostBottom:host.bottom, viewportWidth:innerWidth, viewportHeight:innerHeight, scrollWidth:document.documentElement.scrollWidth, controls };
  });
}

try {
  for (const config of configurations) {
    const browser = await config.engine.launch({ headless:true });
    const context = await browser.newContext({ viewport:config.viewport, isMobile:Boolean(config.mobile), hasTouch:Boolean(config.mobile), deviceScaleFactor:1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    try {
      await page.goto(base, { waitUntil:'networkidle' });
      await page.waitForFunction(() => document.body.classList.contains('cone-reader-enabled'));
      const count = await page.locator('.a4-page').count();
      assert.equal(await page.locator('#cone-total').textContent(), String(count));
      assert.equal(await page.locator('#cone-prev').isDisabled(), true);
      await page.locator('#cone-next').click();
      await page.waitForFunction(() => document.getElementById('cone-page').value === '2');
      await page.reload({ waitUntil:'networkidle' });
      assert.equal(await page.locator('#cone-page').inputValue(), '2');
      await page.locator('#cone-page').fill(String(count + 1));
      await page.locator('#cone-page').press('Enter');
      assert.equal(await page.locator('#cone-page').inputValue(), String(count));
      assert.equal(await page.locator('#cone-next').isDisabled(), true);
      for (let number = 1; number <= count; number += 1) {
        await page.locator('#cone-page').fill(String(number));
        await page.locator('#cone-page').press('Enter');
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const measured = await layout(page);
        assert.equal(measured.visible, 1, `${config.name} page ${number}: one sheet visible`);
        assert.ok(Math.abs(measured.width - 210 * 96 / 25.4) < 1, 'native A4 width is preserved');
        assert.ok(Math.abs(measured.height - 297 * 96 / 25.4) < 1, 'native A4 height is preserved');
        assert.ok(measured.left >= -1 && measured.right <= measured.viewportWidth + 1, `${config.name} page ${number}: horizontal fit`);
        assert.ok(measured.bottom <= Math.min(measured.hostBottom, measured.viewportHeight) + 1, `${config.name} page ${number}: vertical fit`);
        assert.ok(measured.scrollWidth <= measured.viewportWidth + 1, `${config.name}: no shell overflow`);
        assert.ok(measured.controls.every((control) => control.width >= 44 && control.height >= 44), '44px touch controls');
      }
      await page.locator('#cone-zoom-in').click();
      await page.locator('#cone-fit').click();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.ok((await layout(page)).right <= config.viewport.width + 1);
      await page.screenshot({ path:path.join(reportDir, `${config.name}.png`) });

      if (config.name === 'desktop') {
        await page.emulateMedia({ media:'print' });
        const printGeometry = await page.locator('.a4-page').evaluateAll((sheets) => sheets.map((sheet) => ({ width:sheet.getBoundingClientRect().width, height:sheet.getBoundingClientRect().height, display:getComputedStyle(sheet).display })));
        assert.equal(printGeometry.filter((sheet) => sheet.display !== 'none').length, count);
        assert.ok(printGeometry.every((sheet) => Math.abs(sheet.width - 210 * 96 / 25.4) < 1 && Math.abs(sheet.height - 297 * 96 / 25.4) < 1));
        const pdf = await page.pdf({ preferCSSPageSize:true, printBackground:true });
        assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/gu) || []).length, count, 'one PDF page per source sheet');
        await page.evaluate(() => { document.body.dataset.conePrint = 'current'; });
        const single = await page.pdf({ preferCSSPageSize:true, printBackground:true });
        assert.equal((single.toString('latin1').match(/\/Type\s*\/Page\b/gu) || []).length, 1, 'print active sheet only');
      }
      assert.deepEqual(errors, [], `${config.name}: no script or asset errors`);
      results.push({ device:config.name, status:'passed', pages:count });
      console.log(`[cone-reader] ${config.name}: ${count} A4 pages, navigation and layout passed`);
    } catch (error) {
      await page.screenshot({ path:path.join(reportDir, `${config.name}-failure.png`) }).catch(() => {});
      results.push({ device:config.name, status:'failed', error:error.message });
      throw error;
    } finally { await context.close(); await browser.close(); }
  }
} finally {
  fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(results, null, 2));
  await new Promise((resolve) => server.close(resolve));
}
