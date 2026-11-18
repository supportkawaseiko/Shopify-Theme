import { StandardEvents, CartLinesUpdateEvent } from '@shopify/events';

export function addonQuantity(value, minimum = 1, step = 1, maximum = Infinity) {
  const min = Math.max(1, Number(minimum) || 1);
  const increment = Math.max(1, Number(step) || 1);
  const max = maximum !== '' && maximum != null ? Number(maximum) : Infinity;
  if (Number.isFinite(max) && max < min) return 0;
  const requested = Math.max(min, Math.floor(Number(value) || min));
  return min + Math.floor((Math.min(max, requested) - min) / increment) * increment;
}

class ProductAddon extends HTMLElement {
  connectedCallback() {
    this.root = this.closest('.product-details');
    this.check = this.querySelector('[data-addon-check]');
    this.variant = this.querySelector('[data-addon-variant]');
    this.quantity = this.querySelector('[data-addon-quantity]');
    this.status = this.querySelector('[data-addon-status]');
    this.busyCount = 0;
    this.seen = new WeakSet();
    this.addEventListener('change', this.sync);
    this.addEventListener('click', this.onClick);
    document.addEventListener(StandardEvents.cartLinesUpdate, this.onCart);
    document.addEventListener('customversal:tee-item-added', this.onTee);
    this.sync();
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.sync);
    this.removeEventListener('click', this.onClick);
    document.removeEventListener(StandardEvents.cartLinesUpdate, this.onCart);
    document.removeEventListener('customversal:tee-item-added', this.onTee);
  }

  sync = () => {
    const option = this.variant.selectedOptions[0];
    if (!option) return;
    const { min, step, max } = option.dataset;
    this.quantity.min = min || '1';
    this.quantity.step = step || '1';
    this.quantity.max = max || '';
    this.quantity.value = String(addonQuantity(this.quantity.value, min, step, max));
    if (Number(this.quantity.value) === 0) this.check.checked = false;
    this.querySelector('[data-addon-price]').textContent = option.dataset.price;
    this.toggleAttribute('data-selected', this.check.checked);
    this.check.disabled = this.busyCount > 0 || Number(this.quantity.value) === 0;
    this.variant.disabled = this.busyCount > 0;
    this.quantity.disabled = !this.check.checked || this.busyCount > 0;
    for (const button of this.querySelectorAll('[data-addon-step]')) {
      const next = Number(this.quantity.value) + Number(button.dataset.addonStep) * (Number(step) || 1);
      button.disabled = this.quantity.disabled || next < Number(this.quantity.min) || (Number(max) > 0 && next > Number(max));
    }
  };

  onClick = (event) => {
    const button = event.target.closest('[data-addon-step]');
    if (!button || button.disabled) return;
    this.quantity.value = String(Number(this.quantity.value) + Number(button.dataset.addonStep) * Number(this.quantity.step));
    this.sync();
  };

  selection() {
    if (!this.check.checked) return null;
    const id = Number(this.variant.value);
    const quantity = addonQuantity(this.quantity.value, this.quantity.min, this.quantity.step, this.quantity.max);
    return Number.isSafeInteger(id) && id > 0 && quantity > 0 ? { id, quantity } : null;
  }

  onCart = (event) => {
    const source = event.target.closest?.('product-form-component');
    if (event.action !== 'add' || !source || !this.root?.contains(source) || !event.promise || this.seen.has(event.promise)) return;
    this.seen.add(event.promise);
    const selection = this.selection();
    if (selection) this.enqueue(event.promise, selection);
  };

  onTee = (event) => {
    if (!this.root?.querySelector('#tee-artwork-form')) return;
    const productId = event.detail.item?.product_id;
    if (productId && String(productId) !== this.dataset.productId) return;
    const selection = this.selection();
    if (selection) event.detail.promises.push(this.enqueue(Promise.resolve({ detail: {} }), selection));
  };

  enqueue(mainResult, selection) {
    const confirmed = mainResult.catch(() => ({ detail: { didError: true } }));
    this.busyCount++;
    this.sync();
    this.pending = (this.pending || Promise.resolve()).then(async () => {
      const result = await confirmed;
      if (result.detail?.didError) return;
      await this.addItem(selection);
    }).catch(() => {
      this.toggleAttribute('data-error', true);
      this.status.textContent = 'We could not confirm the main item. Your add-on was not added. Please check your cart.';
    }).finally(() => {
      this.busyCount--;
      this.sync();
    });
    return this.pending;
  }

  async addItem(selection) {
    const root = window.Shopify?.routes?.root || '/';
    const sections = [...new Set(Array.from(document.querySelectorAll('cart-items-component'), element => element.dataset.sectionId).filter(Boolean))].slice(0, 5);
    let added = false;
    this.toggleAttribute('data-error', false);
    this.status.textContent = 'Adding your add-on…';
    try {
      const result = await fetch(`${root}cart/add.js`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [selection], sections: sections.join(','), sections_url: window.location.pathname }),
      });
      const response = await result.json();
      if (!result.ok || response.status) throw new Error(response.description || response.message || 'The add-on is unavailable.');
      added = true;
      const cartResult = await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } });
      if (!cartResult.ok) throw new Error('Cart refresh failed');
      const cart = await cartResult.json();
      document.dispatchEvent(new CartLinesUpdateEvent({
        action: 'add', context: 'product', lines: [{ merchandiseId: String(selection.id), quantity: selection.quantity }],
        promise: Promise.resolve({ cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
          detail: { source: 'product-addon', items: cart.items, sections: response.sections, didError: false } }),
      }));
      this.status.textContent = 'Add-on added to your cart.';
    } catch (error) {
      this.toggleAttribute('data-error', true);
      this.status.textContent = added
        ? 'Your add-on was added. Refresh your cart to view it.'
        : `Your main item was added, but the add-on could not be added. ${error.message}`;
    }
  }
}

if (!customElements.get('product-addon')) customElements.define('product-addon', ProductAddon);
