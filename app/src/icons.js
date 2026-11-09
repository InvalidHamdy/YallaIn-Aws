// Small inline SVG icon set (stroke icons, 24px grid) used by the templates: <%- icon('check') %>
const paths = {
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.6A9.7 9.7 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 01-3 3.7M6.6 6.6A16.6 16.6 0 002.5 12s3.5 6.5 9.5 6.5a9.5 9.5 0 004.4-1.1"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6L12 3z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.2v.3"/>',
  idcard: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><circle cx="8.5" cy="11" r="2"/><path d="M5.8 15.6c.6-1.3 1.6-2 2.7-2s2.1.7 2.7 2M13.5 10h4.5M13.5 13.5h3"/>',
  upload: '<path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9"/><path d="M4.5 15v3a2 2 0 002 2h11a2 2 0 002-2v-3"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.3"/>',
  corners: '<path d="M4.5 9V6.5a2 2 0 012-2H9M15 4.5h2.5a2 2 0 012 2V9M19.5 15v2.5a2 2 0 01-2 2H15M9 19.5H6.5a2 2 0 01-2-2V15"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  ticket: '<path d="M4 7.5A1.5 1.5 0 015.5 6h13A1.5 1.5 0 0120 7.5v2.3a2.2 2.2 0 000 4.4v2.3a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5v-2.3a2.2 2.2 0 000-4.4V7.5z"/><path d="M14.5 6v12" stroke-dasharray="2 2"/>',
  wifi: '<path d="M3 9.5a13 13 0 0118 0M6 12.7a8.5 8.5 0 0112 0M9 15.8a4 4 0 016 0"/><circle cx="12" cy="18.7" r=".6"/>',
  queue: '<rect x="3.5" y="6.5" width="17" height="11" rx="2"/><path d="M8 10.5h8M8 13.5h5"/>',
  logout: '<path d="M14 4.5h3.5a2 2 0 012 2v11a2 2 0 01-2 2H14"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  phone: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.5"/><path d="M11 17.8h2"/>',
  pencil: '<path d="M4.5 19.5l1-4L15.8 5.2a2 2 0 012.8 0l.2.2a2 2 0 010 2.8L8.5 18.5l-4 1z"/>',
};

function icon(name, size = 18, cls = '') {
  const p = paths[name];
  if (!p) return '';
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

module.exports = { icon };
