#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const MOBILE_RELEVANT_PATTERNS = [
  /^(?:mobile-app|catalog)\.(?:html|css|js)$/,
  /^(?:mobile-deep-link|catalog-deep-link)\.js$/,
  /^reader-actions\.(?:css|js)$/,
  /^mobile-app\.webmanifest$/,
  /^sw\.js$/,
  /^עמוד-\d+\.html$/u,
  /^styles\//,
  /^assets\//,
  /^vendor\//,
  /^meta\/topics\.json$/,
  /^scripts\/(?:copy-static-site|validate-mobile(?:-[^/]+)?|vendorize-cdn)\.mjs$/,
  /^scripts\/lib\//,
  /^vite\.config\.[cm]?[jt]s$/,
  /^package(?:-lock)?\.json$/,
];

export const MOBILE_DEEP_RELEVANT_PATTERNS = [
  /^(?:mobile-app|catalog)\.(?:html|css|js)$/,
  /^(?:mobile-deep-link|catalog-deep-link)\.js$/,
  /^reader-actions\.(?:css|js)$/,
  /^mobile-app\.webmanifest$/,
  /^sw\.js$/,
  /^styles\/a4-base\.css$/,
  /^scripts\/(?:copy-static-site|validate-mobile(?:-[^/]+)?|vendorize-cdn)\.mjs$/,
  /^scripts\/lib\//,
  /^vite\.config\.[cm]?[jt]s$/,
  /^package(?:-lock)?\.json$/,
];

export const MAINTENANCE_ONLY_PATTERNS = [
  /^\.gitignore$/,
  /^\.vscode\/(?:settings|launch|tasks)\.json$/,
  /^scripts\/(?:repo-health-report|edit-map|classify-ci-change-scope|validate-pythagoras-canonical-pointer)\.mjs$/,
  /^\.github\/workflows\/deploy-pages\.yml$/,
  /^tests\/contracts\/(?:deploy-ci-scope|fast-pr-ci)\.test\.mjs$/,
  /^projects\/coordinate-first-quadrant-workbook\/dist\//,
];

export function isMobileRelevantPath(file) {
  return MOBILE_RELEVANT_PATTERNS.some((pattern) => pattern.test(file));
}

export function isMobileDeepRelevantPath(file) {
  return MOBILE_DEEP_RELEVANT_PATTERNS.some((pattern) => pattern.test(file));
}

export function isMaintenanceOnlyPath(file) {
  return MAINTENANCE_ONLY_PATTERNS.some((pattern) => pattern.test(file));
}

// Compatibility exports: Pythagoras is no longer owned or validated in this repository.
export function buildCanonicalPythagorasPaths() {
  return new Set();
}

export function isPythagorasRelevantPath() {
  return false;
}

export function classifyChangeScope({ eventName, changedFiles }) {
  const mobileMatched = changedFiles.filter(isMobileRelevantPath);
  const mobileDeepMatched = changedFiles.filter(isMobileDeepRelevantPath);

  if (eventName === 'workflow_dispatch') {
    return {
      mobile: true,
      mobileDeep: true,
      pythagoras: false,
      maintenanceOnly: false,
      reason: 'manual release requires full validation',
      mobileDeepReason: 'manual release requires full validation',
      pythagorasReason: 'Pythagoras is validated only in yanivmizrachiy/pythagoras',
      maintenanceReason: 'manual release never uses the maintenance-only shortcut',
    };
  }

  const mobile = mobileMatched.length > 0;
  const mobileDeep = mobileDeepMatched.length > 0;
  const maintenanceOnly = changedFiles.length > 0 && changedFiles.every(isMaintenanceOnlyPath);

  return {
    mobile,
    mobileDeep,
    pythagoras: false,
    maintenanceOnly,
    reason: mobile
      ? `mobile-relevant files changed: ${mobileMatched.join(', ')}`
      : 'no mobile, reader, A4, style, asset, PWA or build files changed',
    mobileDeepReason: mobileDeep
      ? `global mobile/runtime files changed: ${mobileDeepMatched.join(', ')}`
      : 'no app-runtime or global-layout files changed; deep all-pages audit is unnecessary',
    pythagorasReason: 'Pythagoras is validated only in yanivmizrachiy/pythagoras',
    maintenanceReason: maintenanceOnly
      ? `repository-only maintenance files changed: ${changedFiles.join(', ')}`
      : 'change includes runtime/content or an unclassified file; use the full static validation path',
  };
}

function readChangedFiles(baseSha, headSha) {
  if (!baseSha || !headSha || /^0+$/u.test(baseSha)) return [];
  const output = execFileSync('git', ['diff', '--name-only', `${baseSha}...${headSha}`], { encoding: 'utf8' });
  return output.split(/\r?\n/u).map((file) => file.trim()).filter(Boolean);
}

function writeOutputs(outputPath, values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value).replace(/\r?\n/gu, ' ')}`);
  if (outputPath) fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
  else console.log(lines.join('\n'));
}

function main() {
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const changedFiles = eventName === 'workflow_dispatch' ? [] : readChangedFiles(process.env.BASE_SHA, process.env.HEAD_SHA);
  const result = classifyChangeScope({ eventName, changedFiles });
  writeOutputs(process.env.GITHUB_OUTPUT, {
    mobile: result.mobile,
    mobile_deep: result.mobileDeep,
    pythagoras: result.pythagoras,
    maintenance_only: result.maintenanceOnly,
    changed_count: changedFiles.length,
    reason: result.reason,
    mobile_deep_reason: result.mobileDeepReason,
    pythagoras_reason: result.pythagorasReason,
    maintenance_reason: result.maintenanceReason,
  });
  console.log(`[ci-scope] mobile=${result.mobile} mobile-deep=${result.mobileDeep} pythagoras=false maintenance-only=${result.maintenanceOnly} changed=${changedFiles.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
