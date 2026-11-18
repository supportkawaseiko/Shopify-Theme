class DiscountCode extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('button');
    this.label = this.querySelector('[data-code-label]');
    this.status = this.querySelector('[data-copy-status]');
    this.button?.addEventListener('click', this.copy);
  }

  disconnectedCallback() {
    this.button?.removeEventListener('click', this.copy);
    clearTimeout(this.timer);
  }

  copy = async () => {
    const code = this.dataset.code;
    if (!code || this.button.disabled) return;
    this.button.disabled = true;
    try {
      if (!(await this.writeText(code))) throw new Error('Clipboard unavailable');
      this.label.textContent = 'Copied!';
      this.status.textContent = `Code ${code} copied.`;
    } catch {
      this.label.textContent = 'Copy failed';
      this.status.textContent = `Could not copy. Please enter code ${code} manually.`;
    } finally {
      this.button.disabled = false;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.label.textContent = code; }, 2000);
    }
  };

  async writeText(code) {
    try {
      await navigator.clipboard.writeText(code);
      return true;
    } catch {
      // Theme Editor frames can block the Clipboard API. Keep a user-initiated fallback.
      const previousFocus = document.activeElement;
      const input = document.createElement('textarea');
      input.value = code;
      input.readOnly = true;
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      input.setAttribute('aria-hidden', 'true');
      document.body.append(input);
      input.select();
      try {
        return document.execCommand('copy');
      } finally {
        input.remove();
        previousFocus?.focus();
      }
    }
  }
}
if (!customElements.get('discount-code')) customElements.define('discount-code', DiscountCode);
