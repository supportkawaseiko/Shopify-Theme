if (!customElements.get('teeinblue-buy-box')) {
  customElements.define('teeinblue-buy-box', class extends HTMLElement {
    connectedCallback() {
      this.root = this.closest('.product-details');
      if (!this.root) return;
      this.quantity = this.querySelector('input');
      this.addEventListener('click', this.onClick);
      this.quantity.addEventListener('change', this.onQuantity);
      this.root.addEventListener('input', this.onSourceInput);
      this.root.addEventListener('change', this.onSourceInput);
      this.observer = new MutationObserver(() => this.sync());
      this.observer.observe(this.root, {
        childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['disabled', 'aria-disabled', 'class', 'style'],
      });
      this.sync();
    }

    disconnectedCallback() {
      this.observer?.disconnect();
      this.removeEventListener('click', this.onClick);
      this.quantity?.removeEventListener('change', this.onQuantity);
      this.root?.removeEventListener('input', this.onSourceInput);
      this.root?.removeEventListener('change', this.onSourceInput);
    }

    // Keep Teeinblue's validation, artwork generation and cart payload in control.
    forwardAction(action) {
      const selector = action === 'buy' ? '#teeBuynowButton' : '#teeAtcButton';
      const button = this.sourceForm?.querySelector(selector);
      if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') button.click();
    }

    onClick = (event) => {
      const button = event.target.closest('[data-tee-action]');
      if (button && this.contains(button)) this.forwardAction(button.dataset.teeAction);
    };

    onQuantity = () => {
      const source = this.sourceForm?.querySelector('.tee-quantity-input');
      if (!source) return;
      const minimum = Number(source.min) || 1;
      const maximum = Number(source.max) || Infinity;
      source.value = String(Math.min(maximum, Math.max(minimum, Math.floor(Number(this.quantity.value) || minimum))));
      source.dispatchEvent(new Event('input', { bubbles: true }));
      source.dispatchEvent(new Event('change', { bubbles: true }));
      this.sync();
    };

    onSourceInput = (event) => {
      if (this.sourceForm?.contains(event.target)) this.sync();
    };

    sync() {
      this.sourceForm = this.root.querySelector('#tee-artwork-form');
      const sourceCart = this.sourceForm?.querySelector('#teeAtcButton');
      const ready = !!sourceCart && getComputedStyle(sourceCart).display !== 'none';
      this.toggleAttribute('data-ready', ready);
      if (!ready) return;
      for (const [action, selector] of [['cart', '#teeAtcButton'], ['buy', '#teeBuynowButton']]) {
        const source = this.sourceForm.querySelector(selector);
        const button = this.querySelector(`[data-tee-action="${action}"]`);
        const hidden = !source || getComputedStyle(source).display === 'none';
        if (button.hidden !== hidden) button.hidden = hidden;
        const disabled = !source || source.disabled || source.getAttribute('aria-disabled') === 'true';
        if (button.disabled !== disabled) button.disabled = disabled;
        const label = source?.textContent.trim();
        if (label && button.textContent !== label) button.textContent = label;
      }
      const sourceQuantity = this.sourceForm.querySelector('.tee-quantity-input');
      if (sourceQuantity && document.activeElement !== this.quantity && this.quantity.value !== sourceQuantity.value) {
        this.quantity.value = sourceQuantity.value || '1';
      }
      const sourcePrice = this.sourceForm.querySelector('.tee-product-price');
      const price = this.closest('.product-buy-box').querySelector('.product-buy-box__price');
      if (sourcePrice && price && sourcePrice.textContent.trim() && price.textContent.trim() !== sourcePrice.textContent.trim()) {
        price.textContent = sourcePrice.textContent.trim();
      }
    }
  });
}
