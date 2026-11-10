if (!customElements.get('holiday-collections')) {
  customElements.define('holiday-collections', class extends HTMLElement {
    connectedCallback() {
      this.controller?.abort();
      this.controller = new AbortController();
      const { signal } = this.controller;
      const buttons = [...this.querySelectorAll('[data-holiday-tab]')];
      const panels = [...this.querySelectorAll('[data-holiday-panel]')];
      const load = async (root) => {
        for (const target of root.querySelectorAll('[data-holiday-source]')) {
          if (target.dataset.loaded) continue;
          target.dataset.loaded = 'pending';
          const status = target.querySelector('[data-holiday-status]');
          try {
            const url = new URL(target.dataset.holidaySource, location.origin);
            if (url.origin !== location.origin) throw new Error('Invalid collection');
            url.searchParams.set('section_id', 'holiday-tag-products');
            const preview = new URL(location.href).searchParams.get('preview_theme_id');
            if (preview) url.searchParams.set('preview_theme_id', preview);
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error('Collection unavailable');
            const html = new DOMParser().parseFromString(await response.text(), 'text/html');
            const results = html.querySelector('[data-holiday-tag-results]');
            if (!results) throw new Error('Missing products');
            const items = [...results.children].slice(0, Number(this.dataset.limit) || 12);
            target.querySelector('[data-holiday-grid]').replaceChildren(...items);
            status.textContent = items.length ? '' : 'No gifts match this selection yet.';
            target.dataset.loaded = 'done';
            this.updateArrows?.();
          } catch (error) {
            delete target.dataset.loaded;
            if (error.name !== 'AbortError') status.textContent = 'Unable to load gifts. Use See all to browse this collection.';
          } finally { target.setAttribute('aria-busy', 'false'); }
        }
      };
      const select = (button, focus = false) => {
        buttons.forEach(tab => {
          tab.setAttribute('role', 'tab');
          tab.setAttribute('aria-selected', String(tab === button));
          tab.tabIndex = tab === button ? 0 : -1;
        });
        panels.forEach(panel => {
          panel.setAttribute('role', 'tabpanel');
          panel.tabIndex = 0;
          panel.hidden = panel.dataset.holidayPanel !== button.dataset.holidayTab;
          if (!panel.hidden) {
            load(panel);
            const topLink = this.querySelector('[data-holiday-top-link]');
            const collectionLink = panel.querySelector('.holiday-collections__more');
            if (topLink) {
              topLink.hidden = !collectionLink;
              if (collectionLink) topLink.href = collectionLink.href;
              else topLink.removeAttribute('href');
            }
          }
        });
        if (focus) button.focus();
      };
      this.querySelector('.holiday-collections__tabs')?.setAttribute('role', 'tablist');
      buttons.forEach((button, index) => {
        button.addEventListener('click', () => select(button), { signal });
        button.addEventListener('shopify:block:select', () => select(button), { signal });
        button.addEventListener('keydown', event => {
          const keys = { ArrowRight: (index + 1) % buttons.length, ArrowLeft: (index - 1 + buttons.length) % buttons.length, Home: 0, End: buttons.length - 1 };
          if (!(event.key in keys)) return;
          event.preventDefault();
          select(buttons[keys[event.key]], true);
        }, { signal });
      });
      if (buttons.length) select(buttons[0]);
      else load(this);
      const arrows = this.querySelector('.holiday-collections__arrows');
      if (arrows) {
        this.updateArrows = () => {
          const grid = this.querySelector('.holiday-collections__products');
          arrows.hidden = !grid || grid.scrollWidth <= grid.clientWidth + 1;
        };
        this.resizeObserver?.disconnect();
        this.resizeObserver = new ResizeObserver(this.updateArrows);
        this.resizeObserver.observe(this);
        this.updateArrows();
        arrows.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
          const grid = this.querySelector('.holiday-collections__products');
          grid?.scrollBy({ left: Number(button.dataset.holidayScroll) * grid.clientWidth * 0.8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        }, { signal }));
      }
    }
    disconnectedCallback() { this.controller?.abort(); this.resizeObserver?.disconnect(); }
  });
}
