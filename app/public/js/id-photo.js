// WR6: uploads each side straight to S3 with a pre-signed POST (no file passes through EC2).
//   1. POST /api/upload-url      → { url, fields, key }  (signed by the server's IAM role, valid 5 min)
//   2. POST <S3 url>             → the file itself, with the signed fields
//   3. POST /api/upload-complete → server records the key in RDS and marks the user "pending"
(() => {
  const MAX = 10 * 1024 * 1024;
  const TYPES = ['image/jpeg', 'image/png'];
  const cont = document.getElementById('photo-continue');
  const done = { front: false, back: false };
  document.querySelectorAll('.drop').forEach((d) => { done[d.dataset.side] = d.classList.contains('done'); });
  const refresh = () => { cont.disabled = !(done.front && done.back); };

  const postJson = async (url, body) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed. Please try again.');
    return data;
  };

  // XMLHttpRequest (not fetch) so we can show upload progress.
  const send = (url, form, onProgress) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(
      xhr.status === 400 && /EntityTooLarge/.test(xhr.responseText) ? 'File is larger than 10 MB.' : 'Upload failed. Please try again.',
    )));
    xhr.onerror = () => reject(new Error('Network error. Check your connection and try again.'));
    xhr.send(form);
  });

  const setState = (drop, cls, html) => {
    drop.classList.remove('done', 'busy', 'failed');
    if (cls) drop.classList.add(cls);
    drop.querySelector('.state').innerHTML = html;
  };

  async function upload(drop, file) {
    const side = drop.dataset.side;
    const label = side === 'front' ? 'Front' : 'Back';
    if (!TYPES.includes(file.type)) return setState(drop, 'failed', 'Only JPG or PNG images.');
    if (file.size > MAX) return setState(drop, 'failed', 'File is larger than 10 MB.');

    done[side] = false; refresh();
    // Local preview of the chosen photo.
    let img = drop.querySelector('.preview');
    if (!img) {
      img = document.createElement('img');
      img.className = 'preview';
      img.alt = `${label} of ID preview`;
      drop.querySelector('.drop-ic').replaceWith(img);
    }
    img.src = URL.createObjectURL(file);
    setState(drop, 'busy', '<span class="bar"><i></i></span>');
    const bar = drop.querySelector('.bar i');

    try {
      const signed = await postJson('/api/upload-url', { side, contentType: file.type });
      const form = new FormData();
      Object.entries(signed.fields).forEach(([k, v]) => form.append(k, v));
      form.append('file', file); // must be the last field for S3
      await send(signed.url, form, (p) => { bar.style.width = `${Math.round(p * 100)}%`; });
      await postJson('/api/upload-complete', { side, key: signed.key });
      done[side] = true;
      setState(drop, 'done', `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>${label} · uploaded`);
    } catch (err) {
      setState(drop, 'failed', err.message);
    }
    refresh();
  }

  document.querySelectorAll('.drop').forEach((drop) => {
    const input = drop.querySelector('input[type=file]');
    input.addEventListener('change', () => input.files[0] && upload(drop, input.files[0]));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) upload(drop, f); });
  });
  refresh();
})();
