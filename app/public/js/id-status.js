// WR7: polls the API until the verification service (Lambda) has written a result to RDS.
(() => {
  const root = document.getElementById('status-root');
  if (!['pending', 'none'].includes(root.dataset.status)) return;
  let tries = 0;
  const poll = async () => {
    tries += 1;
    try {
      const res = await fetch('/api/verification-status', { headers: { Accept: 'application/json' } });
      const { status } = await res.json();
      if (status === 'verified' || status === 'rejected') { window.location.reload(); return; }
    } catch (_) { /* network blip: keep polling */ }
    if (tries < 100) setTimeout(poll, tries < 20 ? 3000 : 10000);
  };
  setTimeout(poll, 2000);
})();
