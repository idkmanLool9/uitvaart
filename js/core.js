// Helpers + hash-router
// (DB en Auth staan in supabase-client.js)

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function esc(v) {
  return v == null ? '' : String(v).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmt(v) { return v && String(v).trim() ? v : '—'; }
function fmtEUR(n) { return '€ ' + (Number(n) || 0).toFixed(2).replace('.', ','); }
// Parseer een door de gebruiker getypt bedrag — robuust tegen verschillende
// notaties (EU komma-decimaal, US punt-decimaal, EU duizend-scheiding):
//   "625,40"       → 625.40
//   "625.40"       → 625.40  (punt-decimaal, 1-2 cijfers na)
//   "1.234,56"     → 1234.56 (EU: punt = duizend, komma = decimaal)
//   "1,234.56"     → 1234.56 (US: komma = duizend, punt = decimaal)
//   "62.540"       → 62540   (geen komma → punt = duizend-sep)
//   "62540"        → 62540
function parseEUR(s) {
  if (s == null) return 0;
  let str = String(s).replace(/[€\s]/g, '').trim();
  if (!str) return 0;
  const hasComma = str.includes(',');
  const hasDot   = str.includes('.');
  if (hasComma && hasDot) {
    // Beide aanwezig: laatste van de twee is de decimaal-scheiding.
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');         // EU
    } else {
      str = str.replace(/,/g, '');                            // US
    }
  } else if (hasComma) {
    str = str.replace(',', '.');                              // EU decimaal
  } else if (hasDot) {
    // Eén of meer punten zonder komma. Als het patroon precies één punt
    // is gevolgd door 1-2 cijfers tot het eind → punt-decimaal. Anders
    // (bv. "1.234" of "1.234.567") → duizend-scheiding.
    if (!/^\d+\.\d{1,2}$/.test(str)) str = str.replace(/\./g, '');
  }
  const n = parseFloat(str);
  return isFinite(n) ? n : 0;
}
function fmtDate(iso) {
  if (!iso) return '';
  if (typeof iso === 'string' && iso.length === 10) return iso.split('-').reverse().join('-');
  const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString('nl-NL');
}
// Relatieve tijd: 'zojuist', '5 min geleden', '3 uur geleden',
// '2 dagen geleden', of een volledige datum bij ouder dan een week.
function fmtRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)        return 'zojuist';
  if (diff < 3_600_000)     return Math.floor(diff / 60_000) + ' min geleden';
  if (diff < 86_400_000)    return Math.floor(diff / 3_600_000) + ' uur geleden';
  if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + ' dagen geleden';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fullName(d) { return [d.voornaam, d.achternaam].filter(Boolean).join(' '); }

// Foto-compressie vóór upload: verkleint grote afbeeldingen naar maxDim px
// (langste zijde) en re-encodet als JPEG met quality (0..1). SVG, GIF en kleine
// bestanden worden ongemoeid gelaten. Bespaart fors op Supabase Storage.
async function compressImage(file, maxDim = 1600, quality = 0.85) {
  if (!file || !file.type) return file;
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  if (file.size < 200 * 1024) return file; // al klein genoeg

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
    if (ratio >= 1 && file.size < 800 * 1024) return file; // al klein
    const w = Math.round(img.width  * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // compressie maakte het groter
    return new File([blob], file.name.replace(/\.[a-zA-Z0-9]+$/, '.jpg'), { type: 'image/jpeg' });
  } catch (_) {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Opent een URL die pas ná een async-call bekend is, betrouwbaar in een nieuw
// tabblad — ook op iOS/WKWebView. Truc: open het tabblad SYNCHROON binnen de
// klik-gesture (anders blokkeert de popup-blokkering het na 'await'), en laad
// de URL erin zodra die klaar is.
async function openUrlAsync(urlPromise) {
  // Native app: SFSafariViewController (zoom + tekstselectie + Live Text),
  // geen popup-blokkering. Geen synchrone-gesture-truc nodig.
  if (typeof Native !== 'undefined' && Native.isApp && Native.isApp()) {
    try {
      const url = await urlPromise;
      if (url) await Native.openUrl(url);
    } catch (_) {}
    return;
  }
  // Web: open het tabblad synchroon binnen de klik en laad de URL erin.
  const win = window.open('', '_blank');
  try {
    const url = await urlPromise;
    if (!url) { if (win) win.close(); return; }
    if (win) win.location.href = url;
    else window.open(url, '_blank'); // fallback (bv. als het blanco tabblad werd geweigerd)
  } catch (e) {
    if (win) win.close();
  }
}

// ─── Modal-pop-up (vervangt browser-alert) ─────────────────────────────────
const Modal = {
  _busy: false,
  _queue: [],
  show(opts) {
    if (Modal._busy) {
      // Volgende boodschap pas tonen na huidige
      Modal._queue.push(opts);
      return Promise.resolve();
    }
    return Modal._present(opts);
  },
  _present(opts) {
    const { type = 'info', title = '', message = '', html = null,
            confirmText = 'Begrepen', cancelText = null } = opts || {};
    const m = document.getElementById('modal');
    if (!m) { alert((title ? title + ': ' : '') + message); return Promise.resolve(true); }
    Modal._busy = true;
    document.getElementById('modal-title').textContent = title;
    const msgEl = document.getElementById('modal-message');
    if (html) msgEl.innerHTML = html;
    else msgEl.textContent = message;
    const btn = document.getElementById('modal-confirm');
    const btnCancel = document.getElementById('modal-cancel');
    btn.textContent = confirmText;
    if (cancelText) {
      btnCancel.textContent = cancelText;
      btnCancel.hidden = false;
    } else {
      btnCancel.hidden = true;
    }
    document.getElementById('modal-icon').innerHTML = Modal._iconFor(type);
    m.className = 'modal modal-' + type;
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('shown'));
    setTimeout(() => btn.focus(), 60);

    return new Promise(resolve => {
      const close = (result) => {
        Modal._currentClose = null;
        m.classList.remove('shown');
        m.classList.add('fading');
        btn.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', keyHandler);
        backdrop && backdrop.removeEventListener('click', onCancel);
        setTimeout(() => {
          m.hidden = true;
          m.classList.remove('fading');
          Modal._busy = false;
          resolve(result);
          if (Modal._queue.length) {
            const next = Modal._queue.shift();
            setTimeout(() => Modal._present(next), 60);
          }
        }, 280);
      };
      Modal._currentClose = close;
      const onConfirm = () => close(true);
      const onCancel = () => close(false);
      // Focus-trap: Tab/Shift+Tab cyclet binnen het modal i.p.v. te ontsnappen
      const trapFocus = e => {
        if (e.key !== 'Tab') return;
        const focusables = Array.from(m.querySelectorAll('button:not([hidden]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'))
          .filter(el => !el.hidden && el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last  = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      const keyHandler = e => {
        if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
        else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        else trapFocus(e);
      };
      btn.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);
      document.addEventListener('keydown', keyHandler);
      const backdrop = m.querySelector('.modal-backdrop');
      if (backdrop) backdrop.addEventListener('click', onCancel);
    });
  },
  // Programmatic sluiten — handig voor "Bezig met..."-loading-modals.
  // Result wordt doorgegeven aan eventuele wachtende .then-handlers.
  close(result) {
    if (typeof Modal._currentClose === 'function') {
      Modal._currentClose(result);
    }
  },
  // Confirm-dialoog met twee knoppen — resolved met true (confirm) of false (cancel)
  confirm(opts) {
    return Modal.show(Object.assign({
      type: 'warning',
      confirmText: 'OK',
      cancelText: 'Annuleren',
    }, opts || {}));
  },
  _iconFor(type) {
    if (type === 'offline' || type === 'warning') {
      return `<svg viewBox="0 0 64 64" width="42" height="42" aria-hidden="true">
        <path d="M32 50 L36 54 L32 58 L28 54 Z" fill="currentColor"/>
        <path d="M22 40 Q32 32 42 40" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M14 32 Q32 18 50 32" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".75"/>
        <path d="M6 24 Q32 4 58 24" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".5"/>
        <line x1="10" y1="10" x2="54" y2="54" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      </svg>`;
    }
    if (type === 'error') {
      return `<svg viewBox="0 0 64 64" width="42" height="42"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3.5"/><line x1="22" y1="22" x2="42" y2="42" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><line x1="42" y1="22" x2="22" y2="42" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>`;
    }
    if (type === 'success') {
      return `<svg viewBox="0 0 64 64" width="42" height="42"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3.5"/><polyline points="20,33 28,41 44,24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    return `<svg viewBox="0 0 64 64" width="42" height="42"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="32" cy="22" r="2.5" fill="currentColor"/><line x1="32" y1="30" x2="32" y2="46" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>`;
  },
};

// ─── Toast: korte, niet-blokkerende melding (auto-verdwijnt) ─────────────────
const Toast = {
  show(msg, type = 'info') {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-in'));
    setTimeout(() => {
      el.classList.remove('toast-in');
      setTimeout(() => el.remove(), 300);
    }, 3800);
  },
};

// ─── Lightbox: grotere preview van een afbeelding ───────────────────────────
const Lightbox = {
  show({ src, title = '', subtitle = '', price = '', svgFallback = '' } = {}) {
    const el = document.getElementById('lightbox');
    if (!el) return;
    const img = document.getElementById('lightbox-img');
    const wrap = el.querySelector('.lightbox-img-wrap');
    const titleEl = document.getElementById('lightbox-title');
    const subEl = document.getElementById('lightbox-sub');
    const priceEl = document.getElementById('lightbox-price');

    titleEl.textContent = title;
    subEl.textContent = subtitle;
    priceEl.textContent = price;
    if (src) {
      img.src = src;
      img.hidden = false;
      // SVG-fallback weghalen
      const oldSvg = wrap.querySelector('.lightbox-svg');
      if (oldSvg) oldSvg.remove();
    } else if (svgFallback) {
      img.removeAttribute('src');
      img.hidden = true;
      const oldSvg = wrap.querySelector('.lightbox-svg');
      if (oldSvg) oldSvg.remove();
      const div = document.createElement('div');
      div.className = 'lightbox-svg';
      div.innerHTML = svgFallback;
      wrap.appendChild(div);
    }

    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('shown'));

    const close = () => {
      el.classList.remove('shown');
      el.classList.add('fading');
      setTimeout(() => {
        el.hidden = true;
        el.classList.remove('fading');
      }, 280);
      document.getElementById('lightbox-close').removeEventListener('click', close);
      el.querySelector('.lightbox-backdrop').removeEventListener('click', close);
      document.removeEventListener('keydown', keyHandler);
    };
    const keyHandler = e => { if (e.key === 'Escape') close(); };
    document.getElementById('lightbox-close').addEventListener('click', close);
    el.querySelector('.lightbox-backdrop').addEventListener('click', close);
    document.addEventListener('keydown', keyHandler);
  },
};

// ─── Postcode-API: gratis PDOK Locatieserver (geen sleutel nodig) ──────────
const Postcode = {
  // Normaliseer "1234 ab" → "1234AB"
  normalize(pc) {
    return String(pc || '').replace(/\s+/g, '').toUpperCase();
  },
  isValid(pc) { return /^\d{4}[A-Z]{2}$/.test(Postcode.normalize(pc)); },
  // Pak het huisnummer (digits) en eventuele toevoeging uit een adres-string
  parseHuisnummer(adres) {
    const m = String(adres || '').match(/(\d+)\s*([A-Za-z]?\d?[A-Za-z]?)\s*$/);
    if (!m) return { nr: '', toev: '' };
    return { nr: m[1], toev: (m[2] || '').trim() };
  },
  // Bouw een "Straatnaam 12a" string uit PDOK-resultaat
  formatAdres(doc, huisToev) {
    const huisVoor = doc.huis_nlt || ((doc.huisnummer || '') + (huisToev || ''));
    return [doc.straatnaam, huisVoor].filter(Boolean).join(' ').trim();
  },
  async lookup(postcode, huisnummer) {
    const pc = Postcode.normalize(postcode);
    if (!Postcode.isValid(pc)) return null;
    const hnr = String(huisnummer || '').match(/\d+/)?.[0] || '';
    const q = hnr ? `postcode:${pc} and huisnummer:${hnr}` : `postcode:${pc}`;
    const url = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?' +
      'fl=straatnaam,woonplaatsnaam,huisnummer,huis_nlt&fq=type:adres&rows=1&q=' +
      encodeURIComponent(q);
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const j = await r.json();
      const doc = j && j.response && j.response.docs && j.response.docs[0];
      if (!doc) return null;
      return {
        straat: doc.straatnaam || '',
        woonplaats: doc.woonplaatsnaam || '',
        huis: doc.huis_nlt || doc.huisnummer || '',
      };
    } catch (_) { return null; }
  },
  // Bind een (adres, [huisnummer,] postcode, woonplaats)-set aan auto-aanvullen.
  // Vult alleen lege velden in én toont een vluchtige "✓ aangevuld"-hint.
  // Als huisnummerEl is meegegeven, wordt het huisnummer daaruit gelezen
  // en blijft de straat in adresEl staan (zonder huisnr).
  bindAutofill({ adresEl, huisnummerEl, postcodeEl, woonplaatsEl }) {
    if (!postcodeEl) return;

    const showHint = (el, text) => {
      const wrap = el.closest('label') || el.parentElement;
      if (!wrap) return;
      let h = wrap.querySelector('.pcode-hint');
      if (!h) {
        h = document.createElement('span');
        h.className = 'pcode-hint muted small';
        wrap.appendChild(h);
      }
      h.textContent = text;
      h.classList.add('pcode-hint-show');
      clearTimeout(h._t);
      h._t = setTimeout(() => h.classList.remove('pcode-hint-show'), 2400);
    };

    const run = async () => {
      const pc = postcodeEl.value;
      if (!Postcode.isValid(pc)) return;
      // Normaliseer postcode-veld zelf (1234ab → 1234 AB)
      const norm = Postcode.normalize(pc);
      postcodeEl.value = norm.replace(/^(\d{4})/, '$1 ');
      // Huisnummer ophalen: liever uit eigen veld, anders uit adres
      let nr = '', toev = '';
      if (huisnummerEl && huisnummerEl.value.trim()) {
        const m = huisnummerEl.value.match(/(\d+)\s*([A-Za-z]?\d?[A-Za-z]?)/);
        if (m) { nr = m[1]; toev = (m[2] || '').trim(); }
      } else if (adresEl) {
        ({ nr, toev } = Postcode.parseHuisnummer(adresEl.value));
      }
      const data = await Postcode.lookup(pc, nr);
      if (!data) return;
      let filled = [];
      if (woonplaatsEl && !woonplaatsEl.value.trim() && data.woonplaats) {
        woonplaatsEl.value = data.woonplaats;
        filled.push('woonplaats');
      }
      if (adresEl && data.straat) {
        const cur = adresEl.value.trim();
        const adresIsLeeg = !cur || /^\d/.test(cur);
        if (huisnummerEl) {
          // Apart huisnummer-veld: zet alleen straatnaam in adres
          if (adresIsLeeg) {
            adresEl.value = data.straat;
            filled.push('straat');
          }
          if (!huisnummerEl.value.trim() && (data.huis || nr)) {
            huisnummerEl.value = (data.huis || (nr + toev)).trim();
            filled.push('huisnr');
          }
        } else if (adresIsLeeg) {
          const huis = (data.huis || (nr + toev)).trim();
          adresEl.value = (data.straat + (huis ? ' ' + huis : '')).trim();
          filled.push('adres');
        }
      }
      if (filled.length) showHint(postcodeEl, '✓ ' + filled.join(' + ') + ' aangevuld');
    };

    postcodeEl.addEventListener('change', run);
    postcodeEl.addEventListener('blur', run);
    if (huisnummerEl) {
      huisnummerEl.addEventListener('blur', () => {
        if (Postcode.isValid(postcodeEl.value)) run();
      });
    }
    if (adresEl) {
      adresEl.addEventListener('blur', () => {
        if (Postcode.isValid(postcodeEl.value) && !woonplaatsEl?.value.trim()) run();
      });
    }
  },

  // Google-style autocomplete: typ straat + huisnummer, zie een lijstje
  // matches uit PDOK Locatieserver, klik = postcode/woonplaats meteen mee
  // ingevuld. Werkt op zowel "één gecombineerd adres-veld" als op
  // "aparte straat + huisnummer"-velden.
  //
  // straatEl     — verplicht. Krijgt of straatnaam (als huisnummerEl er is)
  //                of "Straat 12" (als huisnummerEl ontbreekt).
  // huisnummerEl — optioneel apart veld. Als ingevuld, dan splitsen we
  //                straat en huisnummer over twee velden.
  // postcodeEl   — verplicht. Wordt geformatteerd als '1234 AB'.
  // woonplaatsEl — verplicht.
  bindAddressAutocomplete({ straatEl, huisnummerEl, postcodeEl, woonplaatsEl }) {
    if (!straatEl || straatEl.dataset.autocompleteBound === '1') return;
    straatEl.dataset.autocompleteBound = '1';

    // Dropdown-container — eenmalig per veld
    const wrap = document.createElement('div');
    wrap.className = 'addr-autocomplete';
    const ddown = document.createElement('div');
    ddown.className = 'addr-autocomplete-list';
    ddown.hidden = true;

    // Plaats wrap rond straatEl
    straatEl.parentNode.insertBefore(wrap, straatEl);
    wrap.appendChild(straatEl);
    wrap.appendChild(ddown);

    let activeIdx = -1;
    let results = [];
    let abortCtrl = null;
    let debounceT = null;
    let suppressFetch = false;   // voorkomt her-openen van de lijst na een keuze

    const renderList = () => {
      if (!results.length) { ddown.hidden = true; return; }
      ddown.innerHTML = results.map((r, i) => `
        <button type="button" class="addr-autocomplete-item ${i === activeIdx ? 'active' : ''}" data-idx="${i}">
          <strong>${esc((r.straatnaam || '') + ' ' + (r.huis_nlt || r.huisnummer || ''))}</strong>
          <span class="muted small">${esc(formatPostcode(r.postcode || ''))} ${esc(r.woonplaatsnaam || '')}</span>
        </button>
      `).join('');
      ddown.hidden = false;
    };

    const formatPostcode = pc => {
      const n = String(pc || '').replace(/\s+/g, '').toUpperCase();
      return /^\d{4}[A-Z]{2}$/.test(n) ? n.slice(0, 4) + ' ' + n.slice(4) : pc;
    };

    const pickResult = r => {
      // Onderdruk de zoek-listener tijdens het programmatisch invullen, anders
      // heropent het gedispatchte 'input'-event de lijst na ~300ms.
      suppressFetch = true;
      clearTimeout(debounceT);
      // Adres-/straat-veld invullen
      if (huisnummerEl) {
        straatEl.value = r.straatnaam || '';
        huisnummerEl.value = r.huis_nlt || r.huisnummer || '';
        huisnummerEl.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        const huis = r.huis_nlt || r.huisnummer || '';
        straatEl.value = ((r.straatnaam || '') + (huis ? ' ' + huis : '')).trim();
      }
      if (postcodeEl)   postcodeEl.value   = formatPostcode(r.postcode || '');
      if (woonplaatsEl) woonplaatsEl.value = r.woonplaatsnaam || '';
      // Trigger change events zodat dependent listeners (autosave, validatie) actief blijven
      [straatEl, postcodeEl, woonplaatsEl].filter(Boolean).forEach(el => {
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      ddown.hidden = true;
      results = [];
      activeIdx = -1;
      // Onderdrukking pas opheffen ná het debounce-venster, zodat de door het
      // invullen veroorzaakte input-events geen nieuwe zoekopdracht starten.
      setTimeout(() => { suppressFetch = false; }, 400);
    };

    const fetchSuggestions = async () => {
      const straat = straatEl.value.trim();
      const huis   = huisnummerEl ? huisnummerEl.value.trim() : '';
      const q = (straat + ' ' + huis).trim();
      if (q.length < 3) { ddown.hidden = true; results = []; return; }

      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();
      const url = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?' +
        'fq=type:adres&fl=weergavenaam,straatnaam,huisnummer,huis_nlt,postcode,woonplaatsnaam&rows=8&q=' +
        encodeURIComponent(q);
      try {
        const r = await fetch(url, { signal: abortCtrl.signal });
        if (!r.ok) return;
        const j = await r.json();
        results = (j.response && j.response.docs) || [];
        activeIdx = -1;
        renderList();
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('PDOK suggest faalde:', e);
      }
    };

    const scheduleFetch = () => {
      if (suppressFetch) return;   // net een adres gekozen → niet opnieuw zoeken
      clearTimeout(debounceT);
      debounceT = setTimeout(fetchSuggestions, 300);
    };

    // Input-events op beide velden (straat én huisnummer indien apart)
    [straatEl, huisnummerEl].filter(Boolean).forEach(el => {
      el.addEventListener('input', scheduleFetch);
    });

    // Pijltjes + Enter + Escape
    [straatEl, huisnummerEl].filter(Boolean).forEach(el => {
      el.addEventListener('keydown', e => {
        if (ddown.hidden || !results.length) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault(); activeIdx = (activeIdx + 1) % results.length; renderList();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault(); activeIdx = (activeIdx - 1 + results.length) % results.length; renderList();
        } else if (e.key === 'Enter' && activeIdx >= 0) {
          e.preventDefault(); pickResult(results[activeIdx]);
        } else if (e.key === 'Escape') {
          ddown.hidden = true;
        }
      });
    });

    // Klik op een item
    ddown.addEventListener('click', e => {
      const item = e.target.closest('.addr-autocomplete-item');
      if (!item) return;
      pickResult(results[parseInt(item.dataset.idx, 10)]);
    });

    // Sluit dropdown bij klik buiten
    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) ddown.hidden = true;
    });
  },
};

// ─── WheelDate: dag/maand/jaar wiel-picker (iOS-stijl) ──────────────────────
// Vervangt de native datum-picker overal in de app zodat het overal hetzelfde
// uitziet en altijd de drie wielen toont (dag, maand, jaar).
const WheelDate = {
  MONTHS: ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'],
  ITEM_H: 44,
  VISIBLE: 5, // oneven, zodat er een midden-rij is

  daysInMonth(year, month1) { return new Date(year, month1, 0).getDate(); },

  open({ value, min, max, onConfirm, onClear } = {}) {
    const today = new Date();
    const parse = s => {
      if (!s) return null;
      const [y, m, d] = String(s).split('-').map(n => parseInt(n, 10));
      if (!y || !m || !d) return null;
      return { y, m, d };
    };
    const cur = parse(value) || { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };
    const minP = parse(min);
    const maxP = parse(max);
    const minYear = minP ? minP.y : 1900;
    const maxYear = maxP ? maxP.y : (today.getFullYear() + 10);

    let selDay = cur.d, selMonth = cur.m, selYear = cur.y;

    const padH = WheelDate.ITEM_H * Math.floor(WheelDate.VISIBLE / 2);

    const overlay = document.createElement('div');
    overlay.className = 'wheeldate-overlay';
    overlay.innerHTML = `
      <div class="wheeldate-backdrop"></div>
      <div class="wheeldate-card" role="dialog" aria-modal="true" aria-label="Datum kiezen">
        <div class="wheeldate-title">Kies een datum</div>
        <div class="wheeldate-wheels">
          <div class="wheeldate-band" aria-hidden="true"></div>
          <ul class="wheeldate-wheel" data-axis="day"></ul>
          <ul class="wheeldate-wheel wheeldate-wheel-month" data-axis="month"></ul>
          <ul class="wheeldate-wheel" data-axis="year"></ul>
        </div>
        <div class="wheeldate-actions">
          <button type="button" class="btn btn-ghost wd-clear">Wis</button>
          <button type="button" class="btn btn-ghost wd-cancel">Annuleren</button>
          <button type="button" class="btn btn-primary wd-ok">Klaar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const dayWheel   = overlay.querySelector('[data-axis="day"]');
    const monthWheel = overlay.querySelector('[data-axis="month"]');
    const yearWheel  = overlay.querySelector('[data-axis="year"]');

    function fillWheel(wheel, items, selectedValue) {
      const itemsHtml = items.map(it =>
        `<li class="wheeldate-item" data-value="${it.value}">${esc(it.label)}</li>`
      ).join('');
      wheel.innerHTML =
        `<li class="wheeldate-spacer" style="height:${padH}px"></li>` +
        itemsHtml +
        `<li class="wheeldate-spacer" style="height:${padH}px"></li>`;
      const idx = items.findIndex(it => String(it.value) === String(selectedValue));
      const target = idx >= 0 ? idx : 0;
      wheel.scrollTop = target * WheelDate.ITEM_H;
      markSelected(wheel);
    }

    function markSelected(wheel) {
      const idx = Math.round(wheel.scrollTop / WheelDate.ITEM_H);
      wheel.querySelectorAll('.wheeldate-item').forEach((el, i) =>
        el.classList.toggle('selected', i === idx));
    }
    function snappedValue(wheel) {
      const idx = Math.round(wheel.scrollTop / WheelDate.ITEM_H);
      const items = wheel.querySelectorAll('.wheeldate-item');
      return items[idx] ? items[idx].dataset.value : null;
    }

    function buildDays() {
      const dim = WheelDate.daysInMonth(selYear, selMonth);
      if (selDay > dim) selDay = dim;
      const days = Array.from({ length: dim }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
      fillWheel(dayWheel, days, selDay);
    }
    function buildMonths() {
      const months = WheelDate.MONTHS.map((m, i) => ({ value: i + 1, label: m }));
      fillWheel(monthWheel, months, selMonth);
    }
    function buildYears() {
      const years = [];
      for (let y = minYear; y <= maxYear; y++) years.push({ value: y, label: String(y) });
      fillWheel(yearWheel, years, selYear);
    }

    buildMonths(); buildYears(); buildDays();

    function bindScroll(wheel, onSnap) {
      let t;
      wheel.addEventListener('scroll', () => {
        markSelected(wheel);
        clearTimeout(t);
        t = setTimeout(() => {
          const v = snappedValue(wheel);
          if (v != null) onSnap(parseInt(v, 10));
        }, 110);
      });
    }
    bindScroll(dayWheel,   v => { selDay = v; });
    bindScroll(monthWheel, v => { selMonth = v; buildDays(); });
    bindScroll(yearWheel,  v => { selYear  = v; buildDays(); });

    // Klik op item → scrol er heen
    [dayWheel, monthWheel, yearWheel].forEach(wheel => {
      wheel.addEventListener('click', e => {
        const li = e.target.closest('.wheeldate-item');
        if (!li) return;
        const items = Array.from(wheel.querySelectorAll('.wheeldate-item'));
        const idx = items.indexOf(li);
        wheel.scrollTo({ top: idx * WheelDate.ITEM_H, behavior: 'smooth' });
      });
    });

    requestAnimationFrame(() => overlay.classList.add('shown'));

    function close() {
      overlay.classList.remove('shown');
      setTimeout(() => overlay.remove(), 200);
      document.removeEventListener('keydown', keyHandler);
    }
    function keyHandler(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', keyHandler);

    overlay.querySelector('.wheeldate-backdrop').addEventListener('click', close);
    overlay.querySelector('.wd-cancel').addEventListener('click', close);
    overlay.querySelector('.wd-clear').addEventListener('click', () => {
      if (onClear) onClear();
      close();
    });
    overlay.querySelector('.wd-ok').addEventListener('click', () => {
      // Forceer eind-snap-waarden (voor het geval een wheel nog niet 'snapped' was)
      const d = parseInt(snappedValue(dayWheel)   || selDay,   10);
      const m = parseInt(snappedValue(monthWheel) || selMonth, 10);
      const y = parseInt(snappedValue(yearWheel)  || selYear,  10);
      const dim = WheelDate.daysInMonth(y, m);
      const dd = Math.min(d, dim);
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      if (onConfirm) onConfirm(iso);
      close();
    });
  },

  // ISO (YYYY-MM-DD) → "2 mei 2026"
  formatLong(iso) {
    if (!iso) return '';
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    const [, y, mm, d] = m;
    const idx = parseInt(mm, 10) - 1;
    if (idx < 0 || idx > 11) return iso;
    return `${parseInt(d, 10)} ${WheelDate.MONTHS[idx].toLowerCase()} ${y}`;
  },

  // Bind alle <input type="date"> aan de wiel-picker. Idempotent.
  // We vervangen het type door 'text' + maken een hidden zustertje dat
  // de naam (en dus de form-submit-waarde) overneemt. Zo opent iOS Safari
  // nooit meer zijn eigen datum-picker.
  bindAll(root = document) {
    root.querySelectorAll('input[type="date"]').forEach(orig => {
      if (orig.dataset.wheelBound === '1') return;
      orig.dataset.wheelBound = '1';

      const isoVal = orig.value || '';
      const name   = orig.getAttribute('name') || '';
      const minA   = orig.getAttribute('min');
      const maxA   = orig.getAttribute('max');

      // Hidden veld (formulier-submit gaat hier doorheen)
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      if (name) hidden.name = name;
      hidden.value = isoVal;
      orig.parentNode.insertBefore(hidden, orig);

      // Origineel veld wordt zichtbare tekst-display
      orig.removeAttribute('name');
      orig.setAttribute('readonly', 'readonly');
      orig.setAttribute('autocomplete', 'off');
      orig.setAttribute('inputmode', 'none');
      orig.type = 'text';
      orig.placeholder = 'dd-mm-jjjj';
      orig.value = WheelDate.formatLong(isoVal);
      orig.dataset.wheelDisplayFor = name;
      orig.style.cursor = 'pointer';

      const openPicker = () => {
        WheelDate.open({
          value: hidden.value,
          min: minA, max: maxA,
          onConfirm: iso => {
            hidden.value = iso;
            orig.value   = WheelDate.formatLong(iso);
            hidden.dispatchEvent(new Event('input',  { bubbles: true }));
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
          },
          onClear: () => {
            hidden.value = '';
            orig.value   = '';
            hidden.dispatchEvent(new Event('input',  { bubbles: true }));
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
          },
        });
      };

      orig.addEventListener('mousedown', e => { e.preventDefault(); });
      orig.addEventListener('click',     e => { e.preventDefault(); openPicker(); });
      orig.addEventListener('keydown',   e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
      });
    });
  },

  // Synchroniseer alle zichtbare displays met hun hidden ISO-waarde —
  // nodig na een autosave-restore die rechtstreeks de hidden-velden
  // overschrijft.
  syncDisplays(root = document) {
    root.querySelectorAll('input[data-wheel-display-for]').forEach(disp => {
      const name = disp.dataset.wheelDisplayFor;
      if (!name) return;
      const hidden = root.querySelector(`input[type="hidden"][name="${CSS.escape(name)}"]`);
      if (hidden) disp.value = WheelDate.formatLong(hidden.value);
    });
  },
};

// Auto-bind nieuwe datum-inputs zodra ze in #view verschijnen
document.addEventListener('DOMContentLoaded', () => {
  WheelDate.bindAll(document);
  const view = document.getElementById('view');
  if (view) {
    new MutationObserver(() => WheelDate.bindAll(view))
      .observe(view, { childList: true, subtree: true });
  }
});

// ─── Dekking-berekening: hoeveel dekt de verzekering, hoeveel familie? ─────
// Werkt in twee modi:
//  1) 'categorie' — als de verzekeraar DELA is én het gekozen pakket een
//     categorieen-blok heeft (per categorie max-bedrag + gedekt-vlag) PLUS
//     een Geldverzekering-bucket. Per kost wordt eerst geprobeerd binnen de
//     categorie-max gedekt te worden; resterend kan via de Geldverzekering.
//  2) 'flat' — fallback op één polisbedrag (verzekering_dekking) of, voor
//     oude dossiers, op de som van handmatig 'gedekt'-aangevinkte posten.
function computeDekking(kosten, dossier, settings) {
  const verzekerd = dossier.verzekering_status === 'met verzekering';
  const totaal = (kosten || []).reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  if (!verzekerd) {
    return { mode: 'geen', totaal, dekking: 0, perKost: {}, perCategorie: {}, geldRest: 0 };
  }
  const polis = Number(dossier.verzekering_dekking) || 0;
  // Pakket-template opzoeken
  const pakkettenLijst = (settings && settings.verzekering_pakketten) || [];
  const pakket = pakkettenLijst.find(p =>
    p && typeof p === 'object' && (p.naam || '') === (dossier.verzekering_pakket || ''));
  const isDela = (dossier.verzekering_maatschappij || '').toLowerCase().includes('dela');
  const useCat = !!(pakket && pakket.categorieen && isDela);

  if (!useCat) {
    // Flat-modus: polisbedrag (zo niet ingevuld → som van gedekt-aangevinkte posten)
    const gedektFlag = (kosten || []).filter(k => k.gedekt)
      .reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
    const dekking = polis > 0 ? Math.min(polis, totaal) : gedektFlag;
    return { mode: 'flat', totaal, dekking, perKost: {}, perCategorie: {}, geldRest: 0 };
  }

  // Categorie-modus
  const cats = pakket.categorieen;
  const startGeld = polis > 0 ? polis : Number(pakket.geldverzekering_default) || 0;
  let geldBucket = startGeld;
  const catUsed = {};
  const perKost = {};
  const perCategorie = {};
  let totaalDekking = 0;

  // Sorteer kosten in een vaste volgorde zodat de verdeling deterministisch
  // is (niet afhankelijk van invoervolgorde)
  const sorted = [...(kosten || [])].sort((a, b) => (a.id || 0) - (b.id || 0));
  for (const k of sorted) {
    const bedrag = Number(k.bedrag) || 0;
    const cat = k.categorie || 'overig';
    const cfg = cats[cat] || cats.overig || { max: 0, gedekt: false };
    let dekt = 0;
    if (cfg.gedekt) {
      const max = Number(cfg.max) || 0;
      const used = catUsed[cat] || 0;
      const room = Math.max(0, max - used);
      dekt = Math.min(room, bedrag);
      catUsed[cat] = used + dekt;
    }
    // Restbedrag via Geldverzekering
    const rest = bedrag - dekt;
    if (rest > 0 && geldBucket > 0) {
      const fromGeld = Math.min(geldBucket, rest);
      dekt += fromGeld;
      geldBucket -= fromGeld;
    }
    perKost[k.id] = dekt;
    perCategorie[cat] = (perCategorie[cat] || 0) + dekt;
    totaalDekking += dekt;
  }

  return {
    mode: 'categorie',
    totaal,
    dekking: totaalDekking,
    perKost,
    perCategorie,
    geldStart: startGeld,
    geldRest: geldBucket,
    pakket,
  };
}

// ─── Cloudflare Web Analytics — beacon laden + SPA-routes tracken ──────────
// Privacy-vriendelijk, geen cookies, AVG-conform. Token komt uit config.js.
// Als CLOUDFLARE_BEACON_TOKEN leeg is gebeurt er niets.
(function () {
  if (typeof CLOUDFLARE_BEACON_TOKEN === 'undefined' || !CLOUDFLARE_BEACON_TOKEN) return;
  // Eén keer de beacon-script laden
  function loadBeacon() {
    if (document.getElementById('cf-beacon')) return;
    const s = document.createElement('script');
    s.id = 'cf-beacon';
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: CLOUDFLARE_BEACON_TOKEN, spa: true }));
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBeacon);
  } else {
    loadBeacon();
  }
  // Hash-router-wijzigingen handmatig melden zodat elke 'pagina' geteld wordt
  window.addEventListener('hashchange', function () {
    if (window.__cfBeacon && typeof window.__cfBeacon.load === 'function') {
      try { window.__cfBeacon.load(window.location.href); } catch (_) {}
    }
  });
})();

// Hash router
const Router = {
  routes: [],
  add(pattern, handler) {
    const keys = [];
    const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
    Router.routes.push({ regex, keys, handler });
  },
  go(path) { location.hash = '#' + path; },
  start() {
    window.addEventListener('hashchange', Router.handle);
    Router.handle();
  },
  handle() {
    const fullHash = (location.hash || '#/').slice(1) || '/';
    const path = fullHash.split('?')[0].split('#')[0];

    // Familie-portaal: anonieme route, geen login/profiel-keuze nodig
    if (path.startsWith('/familie/')) {
      for (const r of Router.routes) {
        const m = path.match(r.regex);
        if (m) {
          const params = {};
          r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
          r.handler(params, fullHash);
          window.scrollTo(0, 0);
          return;
        }
      }
      render404();
      return;
    }

    if (!Auth.current()) { showLogin(); return; }
    if (Settings.get('profielkiezer_actief') && !ActiveProfile.current()) { showProfilePicker(); return; }
    showApp();

    for (const r of Router.routes) {
      const m = path.match(r.regex);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
        r.handler(params, fullHash);
        $$('[data-route]').forEach(a => {
          const route = a.getAttribute('data-route');
          const active = route === '/dossiers'
            ? (path === '/' || path.startsWith('/dossiers'))
            : (route === '/leden'
                ? path.startsWith('/leden')
                : path === route);
          a.classList.toggle('active', active);
        });
        // "In een dossier" = detail / intake / bewerken / factuur (alles
        // ónder /dossiers/…). Dan verbergen we de zijbalk en tonen alleen
        // de bovenbalk; op de overige pagina's juist andersom.
        const inDossier = /^\/dossiers\/.+/.test(path);
        document.body.classList.toggle('in-dossier', inDossier);
        // Familie-portaal-beheer: kale pagina zonder bovenbalk.
        document.body.classList.toggle('portaal-page', path === '/portaal');
        // Naar een sectie-anker scrollen (bv. #/account#parochies); anders boven.
        const anchor = (fullHash.split('#')[1] || '').split('?')[0];
        const anchorEl = anchor ? document.getElementById(anchor) : null;
        if (anchorEl) anchorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo(0, 0);
        return;
      }
    }
    render404();
  },
};

// ─── PdfGen: PDF-opbouw met jsPDF (tekent tekst/tabellen zelf) ─────────────
// Geen html2canvas: dat rendert leeg op nieuwe iOS-Safari. jsPDF tekent de
// PDF direct uit een 'spec' (kop, secties, tabel, totalen) → betrouwbaar op
// web én app, en de tekst is selecteerbaar.
const PdfGen = {
  _loadPromise: null,
  CDN: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',

  load() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
    if (PdfGen._loadPromise) return PdfGen._loadPromise;
    PdfGen._loadPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PdfGen.CDN;
      s.async = true;
      s.onload  = () => resolve();
      s.onerror = () => reject(new Error('PDF-bibliotheek kon niet worden geladen — controleer internet.'));
      document.head.appendChild(s);
    });
    return PdfGen._loadPromise;
  },

  _jsPDF() {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) throw new Error('PDF-bibliotheek niet geladen.');
    return J;
  },

  // Bouw een jsPDF-document en geef de PDF-Blob terug. Accepteert een spec
  // (via makeDoc) OF een builder-functie die zelf een jsPDF-doc teruggeeft.
  async blobFromSpec(specOrBuilder) {
    await PdfGen.load();
    const doc = (typeof specOrBuilder === 'function') ? specOrBuilder() : PdfGen.makeDoc(specOrBuilder);
    return doc.output('blob');
  },

  // Teken een A4-document uit een spec:
  //   { title, meta:[..], intro:[{label,lines:[..]}], sections:[{heading,rows:[[k,v]]}],
  //     table:{heading,rows:[[oms,cat,bedrag]]}, totals:[[label,val,bold]], footer }
  makeDoc(spec) {
    const J = PdfGen._jsPDF();
    const doc = new J({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
    const M = 15, W = 210, H = 297, CW = W - 2 * M;
    const BLUE = [37, 99, 235], GRAY = [110, 110, 110], DARK = [35, 35, 35];
    let y = M;
    const ensure = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };
    // Emoji/pictogrammen strippen — het standaard jsPDF-lettertype kan ze niet
    // weergeven en verpest anders de regel (garbled tekens + rare spatiëring).
    const EMOJI_RX = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2022}]/gu;
    const clean = (t) => String(t == null ? '' : t).replace(EMOJI_RX, '').replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+/, '');
    const txt = (t, x, yy, o) => doc.text(Array.isArray(t) ? t : clean(t), x, yy, o);
    const split = (t, w) => doc.splitTextToSize(clean(t), w);

    // Kop
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    txt(s.app_name || 'Uitvaart Intake', M, y + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
    txt(s.app_tagline || '', M, y + 7);
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    txt(spec.title || '', W - M, y + 2, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
    (spec.meta || []).forEach((m, i) => txt(m, W - M, y + 7 + i * 4.5, { align: 'right' }));
    y += 15;
    doc.setDrawColor(210); doc.line(M, y, W - M, y); y += 7;

    // Intro (twee kolommen: bv. Voor / Betreft)
    if (spec.intro && spec.intro.length) {
      const colW = CW / 2, startY = y; let maxY = y;
      spec.intro.forEach((blk, i) => {
        const x = M + i * colW; let yy = startY;
        doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
        txt(blk.label + ':', x, yy); yy += 5;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(70, 70, 70);
        (blk.lines || []).filter(l => l && String(l).trim()).forEach(ln => {
          const w = split(ln, colW - 5);
          txt(w, x, yy); yy += w.length * 4.5;
        });
        maxY = Math.max(maxY, yy);
      });
      y = maxY + 5;
    }

    // Secties (kop + label/waarde-rijen)
    (spec.sections || []).forEach(sec => {
      const rows = (sec.rows || []).filter(r => r[1] != null && String(r[1]).trim() !== '');
      if (!rows.length) return;
      ensure(10);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BLUE);
      txt(sec.heading, M, y); y += 5.5;
      doc.setFontSize(9.5);
      rows.forEach(([label, val]) => {
        const vLines = split(val, CW - 45);
        ensure(vLines.length * 4.6 + 1);
        doc.setTextColor(...GRAY); doc.setFont('helvetica', 'bold'); txt(label, M, y);
        doc.setTextColor(...DARK); doc.setFont('helvetica', 'normal'); txt(vLines, M + 43, y);
        y += Math.max(5, vLines.length * 4.6);
      });
      y += 4;
    });

    // Tabel (Omschrijving / Categorie / Bedrag)
    if (spec.table && spec.table.rows && spec.table.rows.length) {
      ensure(12);
      if (spec.table.heading) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BLUE);
        txt(spec.table.heading, M, y); y += 6;
      }
      const xBedrag = W - M, xCat = W - M - 42;
      doc.setFontSize(9); doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold');
      txt('Omschrijving', M, y); txt('Categorie', xCat, y); txt('Bedrag', xBedrag, y, { align: 'right' });
      y += 1.5; doc.setDrawColor(210); doc.line(M, y, W - M, y); y += 4;
      doc.setFont('helvetica', 'normal');
      spec.table.rows.forEach(r => {
        const oms = split(r[0], xCat - M - 3);
        ensure(oms.length * 4.6 + 1);
        doc.setTextColor(...DARK); txt(oms, M, y);
        doc.setTextColor(...GRAY); txt(r[1] || '', xCat, y);
        doc.setTextColor(...DARK); txt(r[2] || '', xBedrag, y, { align: 'right' });
        y += Math.max(5, oms.length * 4.6);
      });
      y += 1; doc.setDrawColor(210); doc.line(M, y, W - M, y); y += 5;
    }

    // Totalen (rechts uitgelijnd)
    (spec.totals || []).forEach(([label, val, bold]) => {
      ensure(6);
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 11 : 9.5);
      doc.setTextColor(...(bold ? BLUE : DARK));
      txt(label, W - M - 45, y, { align: 'right' });
      txt(val, W - M, y, { align: 'right' });
      y += bold ? 6.5 : 5.5;
    });

    if (spec.footer) {
      ensure(8); y += 3;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
      const f = split(spec.footer, CW);
      txt(f, M, y);
    }
    return doc;
  },

  // Upload PDF Blob naar Supabase Storage en geef een tijdelijke download-link
  // (7 dagen) terug. Pad: documenten/<dossierId>/email-bijlagen/<timestamp>-<type>.pdf
  async uploadAsAttachment(dossierId, blob, type = 'bijlage') {
    const path = `${dossierId}/email-bijlagen/${Date.now()}-${type}.pdf`;
    const file = new File([blob], `${type}.pdf`, { type: 'application/pdf' });
    const { error } = await sb.storage.from('documenten').upload(path, file, { upsert: false });
    if (error) throw new Error('Upload van PDF-bijlage faalde: ' + error.message);
    const { data, error: urlErr } = await sb.storage.from('documenten')
      .createSignedUrl(path, 7 * 24 * 3600); // 7 dagen
    if (urlErr) throw new Error('Tijdelijke download-link maken faalde: ' + urlErr.message);
    return { url: data.signedUrl, path };
  },

  // Genereer een PDF en lever 'm af — betrouwbaar op web én in de app.
  // We uploaden naar Supabase en openen de https-link:
  //  · App: in de in-app Safari (bekijken, opslaan in Bestanden, printen, delen).
  //  · Web: in een nieuw tabblad (waar je 'm kunt bewaren/printen/delen).
  // Https i.p.v. een blob-URL, want iOS Safari kan blob-downloads niet openen
  // ("WebKitBlobResource fout 1").
  async deliver(spec, filename = 'document.pdf', dossierId = null) {
    const isApp = typeof Native !== 'undefined' && Native.isApp && Native.isApp();
    // Web: open het tabblad NU (nog binnen de klik-gesture), anders blokkeert
    // de popup-blokkering het na het async genereren.
    const win = isApp ? null : window.open('', '_blank');
    try {
      const blob = await PdfGen.blobFromSpec(spec);
      if (!blob || blob.size < 500) throw new Error('De PDF is leeg gebleven — probeer het opnieuw.');
      const naam = String(filename || 'document').replace(/\.pdf$/i, '');
      let url;
      if (dossierId != null) {
        ({ url } = await PdfGen.uploadAsAttachment(dossierId, blob, naam));
      } else {
        url = URL.createObjectURL(blob);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      if (isApp && typeof Native.openUrl === 'function') await Native.openUrl(url);
      else if (win) win.location.href = url;
      else window.open(url, '_blank');
    } catch (e) {
      if (win) win.close();
      throw e;
    }
  },
};

// ─── SignaturePad: digitale handtekening op een canvas ─────────────────────
class SignaturePad {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.drawing = false;
    this.lastX = 0; this.lastY = 0;
    this.empty = true;
    this._setup();
    this._bind();
  }
  _setup() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = 2.2;
    this.ctx.strokeStyle = '#1a1714';
  }
  _point(e) {
    const rect = this.canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
  _bind() {
    const start = e => {
      this.drawing = true;
      const p = this._point(e);
      this.lastX = p.x; this.lastY = p.y;
      this.empty = false;
      e.preventDefault();
    };
    const move = e => {
      if (!this.drawing) return;
      const p = this._point(e);
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
      this.lastX = p.x; this.lastY = p.y;
      e.preventDefault();
    };
    const end = () => { this.drawing = false; };
    this.canvas.addEventListener('mousedown', start);
    this.canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    this.canvas.addEventListener('mouseleave', end);
    this.canvas.addEventListener('touchstart', start, { passive: false });
    this.canvas.addEventListener('touchmove',  move,  { passive: false });
    this.canvas.addEventListener('touchend',   end);
    this.canvas.addEventListener('touchcancel', end);
  }
  clear() {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.empty = true;
  }
  isEmpty() { return this.empty; }
  toDataURL() { return this.empty ? null : this.canvas.toDataURL('image/png'); }
  fromDataURL(url) {
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      this.ctx.drawImage(img, 0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
      this.empty = false;
    };
    img.src = url;
  }
}

function showLogin() {
  $('#login-screen').hidden = false;
  $('#profile-screen').hidden = true;
  $('#app').hidden = true;
  // E-mail voor-invullen uit localStorage (laatst gebruikte login). Zo hoef
  // je op je eigen iPad alleen je wachtwoord in te tikken (of de keychain af
  // te wachten).
  try {
    const u = $('#login-username');
    if (u && !u.value) {
      const last = localStorage.getItem('sok_last_email');
      if (last) u.value = last;
    }
  } catch (_) {}
  // Vraag de browser stilletjes of 'ie opgeslagen gegevens heeft (Chrome/Edge).
  // `mediation: 'silent'` toont GEEN popup — alleen als de browser zeker weet
  // welke login het is (bv. maar één opgeslagen credential), vult 'ie meteen.
  try {
    if ('credentials' in navigator && window.PasswordCredential) {
      navigator.credentials.get({ password: true, mediation: 'silent' })
        .then(cred => {
          if (!cred) return;
          const u = $('#login-username');
          const p = $('#login-password');
          if (u && !u.value && cred.id) u.value = cred.id;
          if (p && !p.value && cred.password) p.value = cred.password;
        })
        .catch(() => {});
    }
  } catch (_) {}
}
function showProfilePicker() {
  $('#login-screen').hidden = true;
  $('#profile-screen').hidden = false;
  $('#app').hidden = true;
  // Vul de greeting in op basis van tijd van de dag
  const greetEl = $('#profile-greeting');
  if (greetEl) {
    const h = new Date().getHours();
    greetEl.textContent =
      h < 6  ? 'Goedenacht' :
      h < 12 ? 'Goedemorgen' :
      h < 18 ? 'Goedemiddag' :
               'Goedenavond';
  }
  // Render alle profielen dynamisch uit Settings
  const mount = $('#profile-options-mount');
  if (mount) {
    const profielen = ActiveProfile.list();
    if (profielen.length === 0) {
      mount.innerHTML = `
        <div class="profile-empty">
          <p class="muted">Nog geen profielen ingesteld.</p>
          <a href="#/account#profielen" class="btn btn-primary btn-sm">+ Profiel toevoegen</a>
        </div>`;
    } else {
      mount.innerHTML = profielen.map(p => {
        const letter = (p.name || '?').trim().charAt(0).toUpperCase();
        const c = p.color || '#6b1e2a';
        return `
          <button type="button" class="profile-option" data-profile="${esc(p.id)}">
            <span class="profile-avatar-wrap">
              <span class="profile-avatar-ring" style="--ring-color:${esc(c)};"></span>
              <span class="profile-avatar" style="background:${esc(c)};">${esc(letter)}</span>
            </span>
            <span class="profile-name">${esc(p.name)}</span>
          </button>`;
      }).join('');
    }
  }
}
function initialen(naam) {
  const delen = String(naam || '').trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return '–';
  if (delen.length === 1) return delen[0].slice(0, 2).toUpperCase();
  return (delen[0][0] + delen[delen.length - 1][0]).toUpperCase();
}
function showApp() {
  $('#login-screen').hidden = true;
  $('#profile-screen').hidden = true;
  $('#app').hidden = false;
  const s = Auth.current();
  if (s) {
    const naam = s.fullName || s.email;
    $('#user-name').textContent = naam;
    const sn = $('#side-user-name'); if (sn) sn.textContent = naam;
    const se = $('#side-user-email'); if (se) se.textContent = s.email || '';
    const av = $('#side-avatar'); if (av) av.textContent = initialen(naam);
  }
  ActiveProfile.renderChip();
}

// ─── Actief profiel — beheerd in Settings.profielen, onthouden in localStorage ───
const ActiveProfile = {
  STORAGE_KEY: 'sok_active_profile',
  list() {
    const arr = (typeof Settings !== 'undefined' && Array.isArray(Settings.get('profielen')))
      ? Settings.get('profielen') : [];
    return arr.filter(p => p && p.id && p.name);
  },
  byId(id) {
    return ActiveProfile.list().find(p => p.id === id) || null;
  },
  current() {
    try {
      const id = localStorage.getItem(ActiveProfile.STORAGE_KEY);
      return id ? ActiveProfile.byId(id) : null;
    } catch (_) { return null; }
  },
  set(id) {
    if (!ActiveProfile.byId(id)) return;
    try { localStorage.setItem(ActiveProfile.STORAGE_KEY, id); } catch (_) {}
  },
  clear() {
    try { localStorage.removeItem(ActiveProfile.STORAGE_KEY); } catch (_) {}
  },
  renderChip() {
    const chip = $('#btn-active-profile');
    if (!chip) return;
    const uit = (typeof Settings !== 'undefined') && !Settings.get('profielkiezer_actief');
    const p = ActiveProfile.current();
    if (uit || !p) { chip.hidden = true; return; }
    chip.hidden = false;
    $('#active-profile-name').textContent = p.name;
    $('#active-profile-dot').style.background = p.color || '#6b1e2a';
  },
};
