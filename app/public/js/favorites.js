// WR8: selected count on the button + search (LIKE query on RDS via /api/catalog/search).
(() => {
  const form = document.getElementById('fav-form');
  const count = document.getElementById('fav-count');
  const update = () => {
    const n = form.querySelectorAll('.picks input:checked').length;
    count.textContent = n ? ` · ${n} selected` : '';
  };
  form.addEventListener('change', update);
  update();

  const q = document.getElementById('q');
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(q.value.trim())}`);
        const data = await res.json();
        ['clubs', 'artists'].forEach((group) => {
          const keep = new Set(data[group].map(String));
          const items = form.querySelectorAll(`[data-group="${group}"] .pick`);
          items.forEach((el) => { el.hidden = !keep.has(el.dataset.id); });
          form.querySelector(`[data-empty="${group}"]`).hidden = keep.size > 0;
        });
      } catch (_) { /* leave the list as it is */ }
    }, 200);
  });
})();
