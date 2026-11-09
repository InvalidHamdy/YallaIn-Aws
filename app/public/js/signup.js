// WR2: live password strength + mobile formatting. The server re-checks everything.
(() => {
  document.querySelectorAll('[data-reveal]').forEach((btn) => {
    const input = document.getElementById(btn.dataset.reveal);
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.style.color = show ? 'var(--lime)' : '';
    });
  });

  const pw = document.getElementById('password');
  const meter = document.querySelector('.meter');
  const label = document.querySelector('.meter-label');
  const labels = ['', 'Weak', 'Okay', 'Strong', 'Very strong'];
  const update = () => {
    const v = pw.value;
    const rules = { length: v.length >= 8, number: /\d/.test(v), symbol: /[^A-Za-z0-9]/.test(v) };
    Object.entries(rules).forEach(([k, ok]) => document.querySelector(`[data-rule="${k}"]`).classList.toggle('met', ok));
    let score = 0;
    if (v.length) score = 1;
    if (rules.length && (rules.number || rules.symbol)) score = 2;
    if (rules.length && rules.number) score = 3;
    if (rules.length && rules.number && rules.symbol && v.length >= 12) score = 4;
    meter.dataset.score = score;
    label.dataset.score = score;
    label.textContent = labels[score];
  };
  pw.addEventListener('input', update);
  update();

  // Format as "10 1234 5678" while typing.
  const mobile = document.getElementById('mobile');
  mobile.addEventListener('input', () => {
    let d = mobile.value.replace(/\D/g, '');
    if (d.startsWith('0')) d = d.slice(1);
    d = d.slice(0, 10);
    mobile.value = [d.slice(0, 2), d.slice(2, 6), d.slice(6)].filter(Boolean).join(' ');
  });
})();
