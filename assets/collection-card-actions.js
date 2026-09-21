class CollectionCardActions extends HTMLElement {
  connectedCallback() {
    this.select = this.querySelector('select');
    this.variantInput = this.querySelector('input[name="id"]');
    this.addButton = this.querySelector('button[name="add"]');

    if (!this.select || !this.variantInput) return;

    this.select.addEventListener('change', this.handleChange);
    this.updateVariant();
  }

  disconnectedCallback() {
    this.select?.removeEventListener('change', this.handleChange);
  }

  handleChange = () => {
    this.updateVariant();
  };

  updateVariant() {
    const option = this.select.selectedOptions[0];
    if (!option) return;

    this.variantInput.value = option.value;
    if (this.addButton) this.addButton.disabled = option.disabled;
  }
}

if (!customElements.get('collection-card-actions')) {
  customElements.define('collection-card-actions', CollectionCardActions);
}
