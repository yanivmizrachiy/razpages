import fs from 'node:fs';

const canonical = 'https://yanivmizrachiy.github.io/pythagoras/';
const redirectFile = 'pythagoras-workbook.html';
const retiredRuntime = [
  'pythagoras-workbook.js',
  'pythagoras-workbook-model.js',
  'styles/pythagoras-workbook.css',
];

const source = fs.readFileSync(redirectFile, 'utf8');
if (!source.includes(canonical)) {
  throw new Error(`Legacy Pythagoras pointer must target ${canonical}`);
}
for (const file of retiredRuntime) {
  if (fs.existsSync(file)) throw new Error(`Retired duplicate Pythagoras runtime still exists: ${file}`);
}
console.log(`Pythagoras canonical source: ${canonical}`);
