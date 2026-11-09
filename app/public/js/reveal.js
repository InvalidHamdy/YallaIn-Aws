// Show / hide password toggle.
document.querySelectorAll('[data-reveal]').forEach((btn) => {
  const input = document.getElementById(btn.dataset.reveal);
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    btn.style.color = show ? 'var(--lime)' : '';
  });
});
