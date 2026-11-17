const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function component() {
  let registered;
  vm.runInNewContext(fs.readFileSync('assets/teeinblue-buy-box.js', 'utf8'), {
    HTMLElement: class {},
    customElements: { get: () => undefined, define: (_, value) => { registered = value; } },
  });
  return new registered();
}

test('forwards to Teeinblue original action without bypassing disabled state', () => {
  const element = component();
  let clicks = 0;
  const source = { disabled: false, getAttribute: () => null, click: () => clicks++ };
  element.sourceForm = { querySelector: () => source };
  element.forwardAction('cart');
  assert.equal(clicks, 1);
  source.disabled = true;
  element.forwardAction('cart');
  assert.equal(clicks, 1);
  source.disabled = false;
  source.getAttribute = () => 'true';
  element.forwardAction('cart');
  assert.equal(clicks, 1);
});

test('missing app action does not submit a native Shopify form', () => {
  const element = component();
  element.sourceForm = { querySelector: () => null };
  assert.doesNotThrow(() => element.forwardAction('cart'));
  element.sourceForm = null;
  assert.doesNotThrow(() => element.forwardAction('buy'));
});
