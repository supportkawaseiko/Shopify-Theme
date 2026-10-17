(() => {
  if (customElements.get('club-signup')) return;

  customElements.define('club-signup', class extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      if (!this.form) return;
      this.fields = this.querySelector('fieldset');
      this.button = this.querySelector('[type="submit"]');
      this.status = this.querySelector('[data-club-status]');
      this.handler ||= this.submit.bind(this);
      this.form.addEventListener('submit', this.handler);
      this.fields.disabled = this.dataset.enabled !== 'true';
    }

    disconnectedCallback() {
      this.form?.removeEventListener('submit', this.handler);
    }

    async submit(event) {
      event.preventDefault();
      if (this.pending || this.completed || this.dataset.enabled !== 'true') return;
      if (!this.form.checkValidity()) {
        this.form.reportValidity();
        return;
      }
      const { publicKey, listId } = this.dataset;
      if (!publicKey || !listId) {
        this.showMessage('Sign-up is temporarily unavailable. Please try again later.', true);
        return;
      }
      this.pending = true;
      const label = this.button.textContent;
      this.button.disabled = true;
      this.button.textContent = 'Joining...';
      this.button.setAttribute('aria-busy', 'true');
      this.status.hidden = true;
      try {
        const response = await fetch(
          `https://a.klaviyo.com/client/subscriptions?company_id=${encodeURIComponent(publicKey)}`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/vnd.api+json',
              'Content-Type': 'application/vnd.api+json',
              revision: '2026-07-15',
            },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({ data: {
              type: 'subscription',
              attributes: {
                custom_source: 'Customversal Club Page',
                profile: { data: { type: 'profile', attributes: {
                  email: this.form.elements.email.value.trim(),
                  subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } },
                } } },
              },
              relationships: { list: { data: { type: 'list', id: listId } } },
            } }),
          }
        );
        if (response.status !== 202) throw new Error('Subscription not accepted');
        this.completed = true;
        this.form.reset();
        this.fields.hidden = true;
        this.showMessage('Check your inbox to confirm your email. Your discount code will arrive after confirmation. Already a member? Check your previous Club welcome email.');
      } catch {
        this.showMessage('We could not complete your request. Please try again in a moment.', true);
      } finally {
        this.pending = false;
        this.button.disabled = false;
        this.button.textContent = label;
        this.button.removeAttribute('aria-busy');
      }
    }

    showMessage(text, error = false) {
      this.status.textContent = text;
      this.status.setAttribute('role', error ? 'alert' : 'status');
      this.status.hidden = false;
      this.status.focus();
    }
  });
})();
