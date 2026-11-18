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
      await navigator.clipboard.writeText(code);
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
}
if (!customElements.get('discount-code')) customElements.define('discount-code', DiscountCode);
