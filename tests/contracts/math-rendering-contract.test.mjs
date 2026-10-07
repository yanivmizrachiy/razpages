import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const read = (file) => fs.readFileSync(file, 'utf8');
const validatorPath = path.resolve('scripts/validate-math-rendering.mjs');

function runValidatorFixture({ activeHtml, archivedHtml }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'math-rendering-contract-'));

  try {
    fs.writeFileSync(
      path.join(tempRoot, 'עמוד-1.html'),
      '<!doctype html><html lang="he" dir="rtl"><body>דף תקין</body></html>',
    );

    const workbookRoot = path.join(tempRoot, 'workbooks', 'circle');
    fs.mkdirSync(workbookRoot, { recursive: true });

    if (activeHtml) fs.writeFileSync(path.join(workbookRoot, 'page-1.html'), activeHtml);

    if (archivedHtml) {
      const archiveRoot = path.join(workbookRoot, 'source', 'original');
      fs.mkdirSync(archiveRoot, { recursive: true });
      fs.writeFileSync(path.join(archiveRoot, 'page-2.html'), archivedHtml);
    }

    return spawnSync(process.execPath, [validatorPath], {
      cwd: tempRoot,
      encoding: 'utf8',
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

test('math rendering policy stays global while Pythagoras ownership stays external', () => {
  const rules = read('CLAUDE.md');
  const pkg = JSON.parse(read('package.json'));
  const globalValidator = read('scripts/validate-math-rendering.mjs');
  const pythagorasPointer = read('scripts/validate-pythagoras-canonical-pointer.mjs');
  const legacyRedirect = read('pythagoras-workbook.html');

  assert.match(rules, /אחידות גופן מתמטי — כלל גורף/u);
  assert.match(rules, /תרשים מתמטי חדש נבנה כ־SVG\/HTML וקטורי/u);
  assert.match(rules, /צילום או איור דקורטיבי/u);
  assert.match(rules, /raster/u);

  assert.equal(pkg.scripts['validate:math-rendering'], 'node scripts/validate-math-rendering.mjs');
  assert.match(pkg.scripts['ci:all'], /validate:math-rendering/u);
  assert.equal(pkg.scripts['pythagoras:check'], 'node scripts/validate-pythagoras-canonical-pointer.mjs');
  assert.equal(pkg.scripts['validate:pythagoras'], 'node scripts/validate-pythagoras-canonical-pointer.mjs');

  assert.match(globalValidator, /collectCanonicalPages/u);
  assert.match(globalValidator, /path\.join\(root, 'workbooks'\)/u);
  assert.match(globalValidator, /new Set\(\['source', 'sources'\]\)/u);
  assert.match(globalValidator, /archiveDirectoryNames\.has/u);
  assert.match(globalValidator, /root-symbol\|root-radicand/u);
  assert.match(globalValidator, /katex/iu);
  assert.match(globalValidator, /<\(\?:object\|embed\)/u);
  assert.doesNotMatch(globalValidator, /<img\\b/u);

  assert.match(pythagorasPointer, /https:\/\/yanivmizrachiy\.github\.io\/pythagoras\//u);
  assert.match(pythagorasPointer, /Retired duplicate Pythagoras runtime still exists/u);
  assert.match(legacyRedirect, /https:\/\/yanivmizrachiy\.github\.io\/pythagoras\//u);
  assert.doesNotMatch(legacyRedirect, /MathJax/u);
});

test('active workbooks are enforced while source archives stay excluded', () => {
  const activeResult = runValidatorFixture({
    activeHtml: '<!doctype html><html><body><canvas></canvas></body></html>',
  });

  assert.equal(activeResult.error, undefined);
  assert.equal(activeResult.status, 1);
  assert.match(
    `${activeResult.stdout}\n${activeResult.stderr}`,
    /workbooks\/circle\/page-1\.html: Canvas אסור/u,
  );

  const archivedResult = runValidatorFixture({
    archivedHtml: '<!doctype html><html><body><canvas></canvas></body></html>',
  });

  assert.equal(archivedResult.error, undefined);
  assert.equal(archivedResult.status, 0, archivedResult.stderr || archivedResult.stdout);
  assert.match(archivedResult.stdout, /MATH_RENDERING_OK/u);
});
