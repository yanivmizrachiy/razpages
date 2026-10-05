import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('workbooks/cone/index.html', 'utf8');
const reader = fs.readFileSync('workbooks/cone/reader.js', 'utf8');
const numbers = Array.from(html.matchAll(/<main\b[^>]*data-local-page="(\d+)"/gu), (match) => Number(match[1]));
const count = numbers.length;

function fixture(hash = '') {
  function element() {
    const classes = new Set();
    const attributes = new Map();
    const handlers = new Map();
    return {
      classList: { add:(name) => classes.add(name), remove:(name) => classes.delete(name), contains:(name) => classes.has(name) },
      setAttribute:(key, value) => attributes.set(key, value), removeAttribute:(key) => attributes.delete(key),
      addEventListener:(key, handler) => handlers.set(key, handler),
      fire:(key, event = {}) => handlers.get(key)?.(event),
      querySelectorAll:() => [], style:{ setProperty:() => {} }, dataset:{},
      scrollTop:0, scrollLeft:0, value:'1', disabled:true, hidden:true,
      blur:() => {}, closest:() => null,
    };
  }
  const pages = numbers.map(element);
  const ids = Object.fromEntries(['paper', 'toolbar', 'viewport', 'status'].map((id) => [`cone-reader-${id}`, element()]));
  for (const id of ['page', 'prev', 'next', 'total', 'zoom-in', 'zoom-out', 'fit', 'print-page', 'print-all']) ids[`cone-${id}`] = element();
  ids['cone-reader-paper'].querySelectorAll = (selector) => selector.includes('.a4-page') ? pages : [];
  const body = element();
  const location = { hash };
  const window = element();
  const printed = [];
  window.print = () => printed.push(body.dataset.conePrint);
  const document = { getElementById:(id) => ids[id], body, fonts:{ ready:Promise.resolve() } };
  vm.runInNewContext(reader, { document, window, location, URLSearchParams, history:{ replaceState:(_state, _title, url) => { location.hash = url; } }, requestAnimationFrame:() => 1, performance:{ now:() => 0 } });
  return { pages, ids, body, location, window, printed, current:() => pages.findIndex((page) => page.classList.contains('is-current')) + 1 };
}

test('חוברת החרוט שומרת רצף מקומי ומונה שנגזר מן הדפים', () => {
  assert.ok(count > 0);
  assert.deepEqual(numbers, Array.from({ length:count }, (_, index) => index + 1));
  const manifest = JSON.parse(fs.readFileSync('workbooks/manifest.json', 'utf8'));
  assert.equal(count, manifest.workbooks.cone.pages);
  const book = fixture();
  assert.equal(book.current(), 1);
  assert.equal(book.ids['cone-total'].textContent, String(count));
  assert.equal(book.ids['cone-page'].max, String(count));
  assert.equal(book.ids['cone-prev'].disabled, true);
  assert.equal(book.ids['cone-next'].disabled, false);
  assert.equal(book.pages.filter((page) => !page.inert).length, 1);
});

test('דפדוף וקפיצה מגיעים לדף המבוקש ולגבולות החוברת', () => {
  const book = fixture();
  book.ids['cone-next'].fire('click');
  assert.equal(book.current(), 2);
  assert.equal(book.location.hash, '#page=2');
  book.ids['cone-prev'].fire('click');
  assert.equal(book.current(), 1);
  for (const [value, expected] of [[count + 10, count], [0, 1], [-8, 1], ['invalid', 1], [2.9, 2]]) {
    book.ids['cone-page'].value = String(value);
    book.ids['cone-page'].fire('change');
    assert.equal(book.current(), expected);
    assert.equal(book.pages.filter((page) => !page.inert).length, 1);
    assert.equal(book.ids['cone-next'].disabled, expected === count);
    assert.equal(book.ids['cone-prev'].disabled, expected === 1);
  }
});

test('קישור ישיר ורענון שומרים את העמוד, וחצים פועלים בכיוון עברי', () => {
  const book = fixture('#page=3');
  assert.equal(book.current(), 3);
  const key = (name, target = book.ids['cone-reader-paper']) => book.window.fire('keydown', { key:name, target, preventDefault:() => {} });
  key('ArrowLeft');
  assert.equal(book.current(), 4);
  key('ArrowRight');
  assert.equal(book.current(), 3);
  key('End');
  assert.equal(book.current(), count);
  key('Home');
  assert.equal(book.current(), 1);
  key('ArrowLeft', { closest:() => true });
  assert.equal(book.current(), 1);
  book.location.hash = '#page=5';
  book.window.fire('hashchange');
  assert.equal(book.current(), 5);
  assert.equal(fixture(book.location.hash).current(), 5);
});

test('הדפסת דף פעיל והדפסת חוברת הן פעולות נפרדות', async () => {
  const book = fixture('#page=2');
  book.ids['cone-print-page'].fire('click');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(book.printed, ['current']);
  book.window.fire('afterprint');
  assert.equal(book.body.dataset.conePrint, undefined);
  book.ids['cone-print-all'].fire('click');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(book.printed, ['current', 'all']);
  assert.equal(book.current(), 2);
});
