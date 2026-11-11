/**
 * CQM2 v4.0.0 — CQM-25 Canonical Capability Profile & 150-Peer ALife Comparative Landscape Filters
 * (`alife/cqm-capability-profile.html` & `alife/cqm-alife-catalog.html`).
 * Strict CSP (`script-src 'self'`) interactive client-side filtering — zero inline scripts, zero composite aggregation.
 */

function initAlifeCatalogFilter(): void {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.alife-catalog-grid article'));
  const search = document.querySelector<HTMLInputElement>('#search');
  const category = document.querySelector<HTMLSelectElement>('#category');
  const status = document.querySelector<HTMLSelectElement>('#status');
  const countEl = document.querySelector<HTMLElement>('#count');

  if (!search || !category || !status || !countEl || cards.length === 0) return;

  const filter = (): void => {
    const terms = search.value
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    let shown = 0;
    for (const card of cards) {
      const catOk = !category.value || card.dataset.category === category.value;
      const statOk = !status.value || card.dataset.status === status.value;
      const hay = card.dataset.search ?? '';
      const termOk = terms.every((t) => hay.includes(t));
      const visible = catOk && statOk && termOk;
      card.hidden = !visible;
      if (visible) shown++;
    }
    countEl.textContent = `Showing ${shown} of ${cards.length} audited comparison entries (focal system CQM2 v4.0.0 listed separately above).`;
  };

  search.addEventListener('input', filter);
  category.addEventListener('input', filter);
  status.addEventListener('input', filter);
  filter();
}

function initCqm25ProfileFilter(): void {
  const form = document.querySelector<HTMLFormElement>('.cqm25-filters');
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.cqm25-grid .axis'));
  const search = document.querySelector<HTMLInputElement>('#search');
  const domain = document.querySelector<HTMLSelectElement>('#domain');
  const scope = document.querySelector<HTMLSelectElement>('#scope');
  const state = document.querySelector<HTMLSelectElement>('#state');
  const resultCount = document.querySelector<HTMLElement>('#result-count');
  const emptyEl = document.querySelector<HTMLElement>('#empty');

  if (!form || !search || !domain || !scope || !state || !resultCount || cards.length === 0) return;

  const filter = (): void => {
    const q = search.value.trim().toLowerCase();
    let count = 0;
    for (const card of cards) {
      const textOk = !q || (card.textContent ?? '').toLowerCase().includes(q);
      const domOk = !domain.value || card.dataset.domain === domain.value;
      const scopes = (card.dataset.scope ?? '').split(' ');
      const scopeOk = !scope.value || scopes.includes(scope.value);
      const stateOk = !state.value || card.dataset.state === state.value;
      const show = textOk && domOk && scopeOk && stateOk;
      card.hidden = !show;
      if (show) count++;
    }
    resultCount.textContent = `Showing ${count} of ${cards.length} axes. Review states are evidence categories, not capability scores (aggregation: "prohibited", score: null).`;
    if (emptyEl) emptyEl.hidden = count !== 0;
  };

  for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-estimate-axis] a'))) {
    link.addEventListener('click', (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      form.reset();
      filter();
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
    });
  }

  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('reset', () => setTimeout(filter, 0));
  filter();
}

function bootAlifeScripts(): void {
  initAlifeCatalogFilter();
  initCqm25ProfileFilter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAlifeScripts);
} else {
  bootAlifeScripts();
}
