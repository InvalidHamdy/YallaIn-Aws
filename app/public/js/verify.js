// WR3: 6 single-digit boxes with paste support, auto-submit, and the resend countdown.
(() => {
  const form = document.getElementById('otp-form');
  const boxes = [...form.querySelectorAll('.otp input')];
  const hidden = document.getElementById('code');
  const btn = document.getElementById('verify-btn');

  const sync = () => {
    hidden.value = boxes.map((b) => b.value).join('');
    btn.disabled = hidden.value.length !== 6;
    return hidden.value.length === 6;
  };
  const fill = (start, digits) => {
    digits.split('').forEach((d, i) => { if (boxes[start + i]) boxes[start + i].value = d; });
    const next = boxes[Math.min(start + digits.length, 5)];
    next.focus();
    if (sync()) form.requestSubmit();
  };

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      const digits = box.value.replace(/\D/g, '');
      box.value = '';
      if (digits) fill(i, digits);
      else sync();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); sync(); e.preventDefault(); }
      if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
      if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
    });
    box.addEventListener('paste', (e) => {
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (digits) { e.preventDefault(); fill(0, digits); }
    });
    box.addEventListener('focus', () => box.select());
  });
  form.addEventListener('submit', () => { btn.disabled = true; btn.textContent = 'Verifying…'; });

  const wait = document.getElementById('resend-wait');
  const ready = document.getElementById('resend-ready');
  const timer = document.getElementById('resend-timer');
  let left = Number(wait.dataset.seconds) || 0;
  const tick = () => {
    if (left <= 0) { wait.hidden = true; ready.hidden = false; return; }
    timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    left -= 1;
    setTimeout(tick, 1000);
  };
  tick();
})();
