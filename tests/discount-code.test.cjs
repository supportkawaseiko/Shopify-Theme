const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function component(copy) {
  let Registered, reset;
  vm.runInNewContext(fs.readFileSync('assets/discount-code.js','utf8'), {
    HTMLElement: class {}, navigator: { clipboard: { writeText: copy } },
    customElements: { get: () => undefined, define: (_, value) => { Registered = value; } },
    clearTimeout: () => {}, setTimeout: fn => { reset = fn; return 1; },
  });
  const element = new Registered();
  element.dataset = { code: 'SMP10' }; element.button = { disabled: false };
  element.label = { textContent: 'SMP10' }; element.status = { textContent: '' };
  return { element, reset: () => reset() };
}
test('copies the exact code and confirms only after clipboard success', async () => {
  let copied;
  const { element, reset } = component(async code => { copied = code; });
  await element.copy();
  assert.equal(copied,'SMP10'); assert.equal(element.label.textContent,'Copied!');
  assert.equal(element.button.disabled,false); reset(); assert.equal(element.label.textContent,'SMP10');
});
test('clipboard rejection displays failure and keeps code available', async () => {
  const { element, reset } = component(async () => { throw new Error('denied'); });
  await element.copy();
  assert.equal(element.label.textContent,'Copy failed'); assert.match(element.status.textContent,/manually/);
  reset(); assert.equal(element.label.textContent,'SMP10');
});
test('repeat clicks while a copy is pending do not start another request', async () => {
  let count = 0, finish;
  const { element } = component(() => { count++; return new Promise(resolve => { finish = resolve; }); });
  const first = element.copy(); await element.copy(); assert.equal(count,1);
  finish(); await first;
});
