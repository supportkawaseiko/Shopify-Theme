const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function fixture(fetch, enabled = 'true') {
  let Signup;
  const element = () => ({ hidden: false, textContent: '', disabled: false, setAttribute() {}, removeAttribute() {}, focus() {} });
  const status = element();
  const fields = element();
  const button = { ...element(), textContent: 'Join & Get 20% Off' };
  const form = {
    elements: { email: { value: '  member@example.com  ' } },
    checkValidity: () => true, reportValidity() {}, reset() { this.resetCalled = true; },
    addEventListener() {}, removeEventListener() {},
  };
  class HTMLElement {
    dataset = { enabled, publicKey: 'PUBLIC', listId: 'CLUB' };
    querySelector(selector) { return { form, fieldset: fields, '[type="submit"]': button, '[data-club-status]': status }[selector]; }
  }
  vm.runInNewContext(readFileSync('assets/club-signup.js', 'utf8'), {
    HTMLElement, customElements: { get: () => false, define: (_, value) => { Signup = value; } },
    fetch, AbortSignal, encodeURIComponent,
  });
  const signup = new Signup();
  signup.connectedCallback();
  return { signup, form, fields, status, button, submit: () => signup.submit({ preventDefault() {} }) };
}

test('submits only email consent to the Club list using a public client endpoint', async () => {
  let request;
  const f = fixture(async (...args) => { request = args; return { status: 202 }; });
  await f.submit();
  assert.equal(request[0], 'https://a.klaviyo.com/client/subscriptions?company_id=PUBLIC');
  const data = JSON.parse(request[1].body).data;
  assert.equal(data.relationships.list.data.id, 'CLUB');
  assert.equal(data.attributes.profile.data.attributes.email, 'member@example.com');
  assert.equal(data.attributes.profile.data.attributes.subscriptions.email.marketing.consent, 'SUBSCRIBED');
  assert.equal(request[1].headers.Authorization, undefined);
  assert.match(f.status.textContent, /confirm your email/i);
  assert.doesNotMatch(f.status.textContent, /HIPPOLORD|already confirmed/i);
  assert.equal(f.fields.hidden, true);
  await f.submit();
  assert.equal(f.form.resetCalled, true);
});

test('failed requests retain the email and allow retry', async () => {
  const f = fixture(async () => ({ status: 429 }));
  await f.submit();
  assert.equal(f.form.resetCalled, undefined);
  assert.equal(f.fields.hidden, false);
  assert.equal(f.button.disabled, false);
  assert.match(f.status.textContent, /try again/i);
});

test('network failures and timeouts show a retryable error', async () => {
  const f = fixture(async () => { throw new Error('offline'); });
  await f.submit();
  assert.match(f.status.textContent, /try again/i);
  assert.equal(f.button.disabled, false);
});

test('disabled signup and invalid consent never send requests', async () => {
  let count = 0;
  const f = fixture(async () => { count++; }, 'false');
  await f.submit();
  const invalid = fixture(async () => { count++; });
  invalid.form.checkValidity = () => false;
  await invalid.submit();
  assert.equal(count, 0);
  assert.equal(f.fields.disabled, true);
});

test('prevents duplicate submissions while the request is pending', async () => {
  let count = 0;
  let finish;
  const f = fixture(() => { count++; return new Promise(resolve => { finish = resolve; }); });
  const first = f.submit();
  await f.submit();
  assert.equal(count, 1);
  finish({ status: 202 });
  await first;
});

test('missing configuration never sends personal information', async () => {
  let count = 0;
  const f = fixture(async () => { count++; });
  f.signup.dataset.listId = '';
  await f.submit();
  assert.equal(count, 0);
  assert.match(f.status.textContent, /temporarily unavailable/i);
});
