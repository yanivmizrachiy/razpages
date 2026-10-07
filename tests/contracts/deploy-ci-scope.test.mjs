import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  classifyChangeScope,
  isMaintenanceOnlyPath,
  isMobileDeepRelevantPath,
  isMobileRelevantPath,
  isPythagorasRelevantPath,
} from '../../scripts/classify-ci-change-scope.mjs';

const root = process.cwd();
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');

test('Pythagoras is never validated from razpages', () => {
  for (const file of [
    'pythagoras-workbook.html',
    'עמוד-639.html',
    'styles/topics/pythagoras.css',
    'README.md',
  ]) {
    assert.equal(isPythagorasRelevantPath(file), false);
  }
  const result = classifyChangeScope({ eventName: 'push', changedFiles: ['pythagoras-workbook.html'] });
  assert.equal(result.pythagoras, false);
  assert.match(result.pythagorasReason, /yanivmizrachiy\/pythagoras/);
});

test('repository hygiene and deploy-CI files use the maintenance-only path', () => {
  const safeFiles = [
    '.gitignore',
    '.vscode/settings.json',
    'scripts/repo-health-report.mjs',
    'scripts/edit-map.mjs',
    'scripts/classify-ci-change-scope.mjs',
    'scripts/validate-pythagoras-canonical-pointer.mjs',
    '.github/workflows/deploy-pages.yml',
    'tests/contracts/deploy-ci-scope.test.mjs',
    'projects/coordinate-first-quadrant-workbook/dist/index.html',
  ];
  for (const file of safeFiles) assert.equal(isMaintenanceOnlyPath(file), true, `${file} should be maintenance-only`);
  const result = classifyChangeScope({ eventName: 'push', changedFiles: safeFiles });
  assert.equal(result.maintenanceOnly, true);
  assert.equal(result.mobile, false);
  assert.equal(result.mobileDeep, false);
  assert.equal(result.pythagoras, false);
});

test('page and topic edits run fast mobile gates but not whole-site deep audit', () => {
  const result = classifyChangeScope({
    eventName: 'push',
    changedFiles: ['עמוד-639.html', 'styles/pages/עמוד-639.css'],
  });
  assert.equal(result.mobile, true);
  assert.equal(result.mobileDeep, false);
  assert.equal(result.pythagoras, false);
  assert.equal(result.maintenanceOnly, false);
  assert.equal(isMobileRelevantPath('עמוד-639.html'), true);
  assert.equal(isMobileDeepRelevantPath('עמוד-639.html'), false);
});

test('global mobile/runtime changes require the expensive all-pages mobile audit', () => {
  for (const file of ['mobile-app.js', 'reader-actions.css', 'sw.js', 'styles/a4-base.css']) {
    assert.equal(isMobileDeepRelevantPath(file), true, `${file} should require deep mobile validation`);
  }
  const result = classifyChangeScope({ eventName: 'push', changedFiles: ['styles/a4-base.css'] });
  assert.equal(result.mobile, true);
  assert.equal(result.mobileDeep, true);
  assert.equal(result.pythagoras, false);
});

test('manual releases still run mobile gates but never duplicate Pythagoras validation', () => {
  const manual = classifyChangeScope({ eventName: 'workflow_dispatch', changedFiles: [] });
  assert.equal(manual.mobile, true);
  assert.equal(manual.mobileDeep, true);
  assert.equal(manual.pythagoras, false);
  assert.equal(manual.maintenanceOnly, false);
});

test('deploy workflow retains safe maintenance path and live commit verification', () => {
  assert.match(workflow, /maintenance_only:\s*\$\{\{ steps\.classify\.outputs\.maintenance_only \}\}/);
  assert.match(workflow, /build:\s*\n\s+needs: scope/);
  assert.match(workflow, /Lean maintenance validation[\s\S]*npm run health:report/);
  assert.match(workflow, /mobile-browser-gate:/);
  assert.match(workflow, /mobile-interaction-gate:/);
  assert.match(workflow, /mobile-deep-gate:/);
  assert.match(workflow, /Verify live deployment commit/);
  assert.match(workflow, /node scripts\/verify-live-build\.mjs "\$PAGE_URL" "\$EXPECTED_SHA"/);
  assert.match(workflow, /statuses: write/);
  assert.match(workflow, /"context":"live-pages"/);
});
