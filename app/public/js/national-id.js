// WR5: groups the 14 digits as on the card (C YYMMDD GG SSSS K) and shows a format check.
(() => {
  const input = document.getElementById('nationalId');
  const control = document.getElementById('nid-control');
  const ok = document.getElementById('nid-ok');
  const groups = [1, 6, 2, 4, 1];
  const format = () => {
    const d = input.value.replace(/\D/g, '').slice(0, 14);
    const parts = [];
    let i = 0;
    for (const g of groups) { if (i < d.length) parts.push(d.slice(i, i + g)); i += g; }
    input.value = parts.join(' ');
    const valid = d.length === 14 && /^[23]/.test(d);
    ok.hidden = !valid;
    control.classList.toggle('valid', valid);
  };
  input.addEventListener('input', format);
  format();
})();
