const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function runtime(responses = []) {
  let Registered;
  const calls = [], events = [];
  const context = {
    HTMLElement: class {},
    customElements: { get: () => undefined, define: (_, value) => { Registered = value; } },
    StandardEvents: { cartLinesUpdate: 'cart:lines:update' },
    CartLinesUpdateEvent: class {
      constructor(value) { Object.assign(this, value); }
      static createCartFromAjaxResponse(cart) { return cart; }
    },
    window: { Shopify: { routes: { root: '/en/' } }, location: { pathname: '/en/products/main' } },
    document: { querySelectorAll: () => [{ dataset: { sectionId: 'cart' } }], dispatchEvent: event => events.push(event) },
    fetch: async (url, options) => { calls.push({ url, options }); const result = responses.shift(); if (result instanceof Error) throw result; return result; },
  };
  vm.createContext(context);
  const code = fs.readFileSync('assets/product-addon.js','utf8').replace(/^import .*;\r?\n/,'').replace('export function','function');
  vm.runInContext(code, context);
  const element = new Registered();
  element.status = { textContent: '' };
  element.toggleAttribute = () => {};
  element.sync = () => {};
  element.busyCount = 0;
  return { element, calls, events, quantity: (...args) => vm.runInContext(`addonQuantity(${args.map(x => JSON.stringify(x)).join(',')})`, context) };
}
const response = (value, ok = true) => ({ ok, json: async () => value });

test('quantity respects minimum, increment and maximum', () => {
  const { quantity } = runtime();
  assert.equal(quantity(-3, 1, 1, 10), 1);
  assert.equal(quantity(99, 2, 2, 7), 6);
  assert.equal(quantity(3.8, 1, 1, 10), 3);
  assert.equal(quantity('', 2, 2, 10), 2);
  assert.equal(quantity(1, 1, 1, 0), 0);
  assert.equal(quantity(5, 5, 1, 2), 0);
});

test('unchecked add-on does not produce a cart selection', () => {
  const { element } = runtime();
  element.check = { checked: false };
  assert.equal(element.selection(), null);
});
test('no cart request starts before the main product succeeds', async () => {
  const { element, calls } = runtime([response({ items: [] }), response({ items: [] })]);
  let resolve;
  const main = new Promise(done => { resolve = done; });
  const pending = element.enqueue(main, { id: 123, quantity: 1 });
  await Promise.resolve();
  assert.equal(calls.length, 0);
  resolve({ detail: {} });
  await pending;
  assert.equal(calls.length, 2);
});

test('main product failure never adds the add-on', async () => {
  const { element, calls } = runtime();
  await element.enqueue(Promise.resolve({ detail: { didError: true } }), { id: 123, quantity: 2 });
  assert.equal(calls.length, 0);
  assert.equal(element.busyCount, 0);
});

test('success sends only variant and quantity, then refreshes localized cart', async () => {
  const { element, calls, events } = runtime([
    response({ items: [{ id: 123 }], sections: { cart: 'updated' } }), response({ items: [{ id: 123, quantity: 2 }] }),
  ]);
  await element.enqueue(Promise.resolve({ detail: {} }), { id: 123, quantity: 2 });
  assert.equal(calls[0].url, '/en/cart/add.js');
  assert.deepEqual(JSON.parse(calls[0].options.body), { items: [{ id: 123, quantity: 2 }], sections: 'cart', sections_url: '/en/products/main' });
  assert.equal(calls[1].url, '/en/cart.js');
  assert.equal(events.length, 1);
  assert.equal((await events[0].promise).detail.sections.cart, 'updated');
});

test('out-of-stock response reports partial success without automatic retry', async () => {
  const { element, calls } = runtime([response({ status: 422, description: 'Sold out' }, false)]);
  await element.addItem({ id: 123, quantity: 2 });
  assert.equal(calls.length, 1);
  assert.match(element.status.textContent, /main item was added.*Sold out/);
});

test('cart refresh failure after successful add does not add twice', async () => {
  const { element, calls } = runtime([response({ items: [] }), new Error('offline')]);
  await element.addItem({ id: 123, quantity: 1 });
  assert.equal(calls.length, 2);
  assert.match(element.status.textContent, /add-on was added/);
});

test('Teeinblue hook waits for selected add-on before calling existing callback', async () => {
  const code = fs.readFileSync('snippets/product-addon-tee-hook.liquid','utf8').replace(/<\/?script>/g,'');
  const order = [];
  const window = { teeinblue: { onItemAdded: () => order.push('previous') } };
  vm.runInNewContext(code, { window, CustomEvent: class { constructor(type, value) { this.detail = value.detail; } },
    document: { dispatchEvent: event => event.detail.promises.push(Promise.resolve().then(() => order.push('addon'))) } });
  await window.teeinblue.onItemAdded({ product_id: 456 });
  assert.deepEqual(order, ['addon','previous']);
});
