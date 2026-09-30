/* Acer storefront behaviours: carousels, drawer menu, footer accordion, quick add to cart. */

class AcerCarousel extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-track]');
    this.prev = this.querySelector('[data-prev]');
    this.next = this.querySelector('[data-next]');
    if (!this.track) return;

    this.prev?.addEventListener('click', () => this.go(-1));
    this.next?.addEventListener('click', () => this.go(1));
    this.track.addEventListener('scroll', () => this.queueUpdate(), { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.queueUpdate());
    this.resizeObserver.observe(this.track);
    this.update();
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
  }

  go(direction) {
    const item = this.track.firstElementChild;
    const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
    const step = item ? item.getBoundingClientRect().width + gap : this.track.clientWidth;
    const perView = Math.max(1, Math.floor((this.track.clientWidth + gap) / step));
    this.track.scrollBy({ left: direction * step * perView, behavior: 'smooth' });
  }

  queueUpdate() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  }

  update() {
    const { scrollLeft, scrollWidth, clientWidth } = this.track;
    const overflow = scrollWidth - clientWidth > 2;
    const arrows = this.querySelector('[data-arrows]');
    if (arrows) arrows.hidden = !overflow;
    if (this.prev) this.prev.disabled = !overflow || scrollLeft <= 2;
    if (this.next) this.next.disabled = !overflow || scrollLeft + clientWidth >= scrollWidth - 2;
  }
}

if (!customElements.get('acer-carousel')) customElements.define('acer-carousel', AcerCarousel);

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const opener = target.closest('[data-acer-drawer-open]');
  if (opener) {
    const drawer = document.getElementById(opener.getAttribute('aria-controls'));
    if (drawer instanceof HTMLDialogElement) {
      drawer.showModal();
      opener.setAttribute('aria-expanded', 'true');
      drawer.addEventListener('close', () => opener.setAttribute('aria-expanded', 'false'), { once: true });
    }
    return;
  }

  if (target.closest('[data-acer-drawer-close]')) {
    target.closest('dialog')?.close();
    return;
  }

  if (target instanceof HTMLDialogElement && target.classList.contains('acer-drawer')) {
    target.close();
    return;
  }

  const accordion = target.closest('[data-acer-accordion]');
  if (accordion) {
    const column = accordion.closest('.acer-footer__col');
    const open = !column.classList.contains('is-open');
    column.classList.toggle('is-open', open);
    accordion.setAttribute('aria-expanded', String(open));
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.matches('[data-acer-atc]')) {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const response = await fetch(`${window.Shopify?.routes?.root ?? '/'}cart/add.js`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (!response.ok) throw new Error(String(response.status));
      const cart = await (await fetch(`${window.Shopify?.routes?.root ?? '/'}cart.js`)).json();
      document.querySelectorAll('[data-acer-cart-count]').forEach((badge) => {
        badge.textContent = cart.item_count;
        badge.hidden = cart.item_count === 0;
      });
      button.setAttribute('aria-label', button.dataset.addedLabel || button.getAttribute('aria-label'));
    } catch (error) {
      window.location.href = `${window.Shopify?.routes?.root ?? '/'}cart`;
    } finally {
      button.disabled = false;
    }
    return;
  }

  if (form.matches('[data-acer-newsletter]')) {
    const tags = ['newsletter'];
    const business = form.querySelector('input[name="acer_business"]:checked');
    if (business) tags.push(business.value === 'yes' ? 'business' : 'consumer');
    const tagsInput = form.querySelector('input[name="contact[tags]"]');
    if (tagsInput) tagsInput.value = tags.join(',');
  }
});

document.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.name !== 'acer_business') return;
  const form = input.form;
  if (form?.matches('[data-acer-newsletter]') && form.checkValidity()) form.requestSubmit();
  else form?.reportValidity();
});
