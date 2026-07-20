// Dossier detail: overzicht + taken + kosten + notities + print

function renderDossierDetail(params) {
  const id = parseInt(params.id, 10);
  const d = DB.byId(KEYS.DOSSIERS, id);
  if (!d) return render404();

  const kosten = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);
  const notities = DB.where(KEYS.NOTITIES, n => n.dossier_id === id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const totaal = kosten.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const betaald = kosten.filter(k => k.betaald).reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const verzekerd = d.verzekering_status === 'met verzekering';
  // Verzekeringsdekking via centrale helper: 'categorie'-modus voor DELA
  // wanneer een pakket-template met categorieen is gekozen, anders 'flat'.
  const dekkingInfo  = computeDekking(kosten, d, Settings.all());
  const verzDekking  = Number(d.verzekering_dekking) || 0;
  const dekking      = dekkingInfo.dekking;
  const familieTotaal  = Math.max(0, totaal - dekking);
  const moetNogBetalen = Math.max(0, totaal - betaald);
  const familieMoetNog = Math.max(0, familieTotaal - betaald);

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <a href="#/dossiers" class="back-link">← Dossiers</a>
          <h1>${esc(fullName(d) || 'Dossier')}</h1>
          <p class="muted">
            <strong>${esc(d.dossier_nummer)}</strong> ·
            <select id="status-select" class="status-inline status-${esc(d.status)}" data-id="${d.id}" aria-label="Status wijzigen">
              ${['nieuw','in_behandeling','voltooid','geannuleerd'].map(s =>
                `<option value="${s}" ${(d.status||'nieuw')===s?'selected':''}>${s.replace('_',' ')}</option>`).join('')}
            </select>
            ${d.gezinsnummer ? ' · gezinsnr. ' + esc(d.gezinsnummer) : ''}
          </p>
          <p class="muted small dossier-timestamps">
            Aangemaakt: <strong title="${esc(d.created_at ? new Date(d.created_at).toLocaleString('nl-NL') : '')}">${esc(fmtRelative(d.created_at) || '—')}</strong>
            · Laatst opgeslagen: <strong title="${esc(d.updated_at ? new Date(d.updated_at).toLocaleString('nl-NL') : '')}">${esc(fmtRelative(d.updated_at) || '—')}</strong>${d.bijgewerkt_door ? ' door <strong>' + esc(d.bijgewerkt_door) + '</strong>' : ''}
          </p>
        </div>
        <div class="page-actions">
          <a href="#/dossiers/${d.id}/factuur" class="btn btn-ghost" title="Kostenraming openen">📄 Kostenraming</a>
          <button type="button" class="btn btn-ghost" id="btn-email-dossier" title="Stuur dossier per e-mail">📧 E-mail dossier</button>
          <a href="#/dossiers/${d.id}/bewerken" class="btn btn-primary">Bewerken</a>
          <details class="page-actions-more">
            <summary class="btn btn-ghost" title="Meer acties">⋯</summary>
            <div class="page-actions-menu">
              <button type="button" class="btn btn-ghost btn-block" id="btn-email-factuur">📧 E-mail factuur</button>
              <button type="button" class="btn btn-ghost btn-block" id="btn-print">📄 Opslaan / delen als PDF</button>
              <button type="button" class="btn btn-ghost btn-block" id="btn-copy-nr">⧉ Kopieer dossiernummer</button>
              <button type="button" class="btn btn-danger btn-block" id="btn-delete">🗑 Verwijderen</button>
            </div>
          </details>
        </div>
      </div>

      <nav class="tabs">
        <a href="#/dossiers/${d.id}#overzicht">Overzicht</a>
        <a href="#/dossiers/${d.id}#kosten">Kosten</a>
        <a href="#/dossiers/${d.id}#notities">Notities (${notities.length})</a>
      </nav>

      <section id="overzicht" class="card">
        <div class="print-header">
          <div><h2 style="border:none;padding:0;background:none;">Uitvaartdossier</h2><p style="margin:0;">St. Ephrem de Syriër Klooster · Glanerbrugstr. 33, 7585 Glane/Losser</p></div>
          <div class="meta"><p><strong>${esc(d.dossier_nummer)}</strong></p><p>Status: ${esc((d.status||'').replace('_',' '))}</p><p>Afgedrukt: ${new Date().toLocaleString('nl-NL')}</p></div>
        </div>
        <h2>Overzicht</h2>

        <h3>Overledene</h3>
        <dl class="dl">
          ${dlRow('Naam', fullName(d))}
          ${dlRow('Geslacht', d.geslacht)}
          ${dlRow('Geboren', [fmtDate(d.geboortedatum), d.geboorteplaats && 'te ' + d.geboorteplaats].filter(Boolean).join(' '))}
          ${dlRow('Overleden', [fmtDate(d.overlijdensdatum), d.overlijdenstijd && 'om ' + d.overlijdenstijd, d.overlijdensplaats && 'te ' + d.overlijdensplaats].filter(Boolean).join(' '))}
          ${dlRow('Adres', [d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', '))}
          ${dlRow('BSN', d.bsn)}
          ${dlRow('Nationaliteit', d.nationaliteit)}
          ${dlRow('Lid SOK', d.syrisch_orthodox_lid)}
          ${dlRow('Verzekering', d.verzekering_maatschappij)}
          ${dlRow('Polisnummer', d.polisnummer)}
          ${dlRow('Gezinsnummer', d.gezinsnummer)}
          ${d.artsverklaring_pad ? `<div><dt>Artsverklaring</dt><dd><button type="button" class="link-btn" id="btn-view-artsverklaring">📄 Bekijk scan</button></dd></div>` : ''}
          ${dlRow('(Ex)partner', d.partner_naam)}
          ${dlRow('Kinderen', d.kinderen_status)}
          ${dlRow('Minderjarige kinderen', d.minderjarige_kinderen)}
          ${(d.minderjarige_kinderen === 'ja' && d.kinderen_namen) ? `<div><dt>Namen kinderen</dt><dd class="prewrap">${esc(d.kinderen_namen)}</dd></div>` : ''}
        </dl>
        <h3>Contactpersoon</h3>
        <dl class="dl">
          ${dlRow('BSN', d.contact_bsn)}
          ${dlRow('Naam', [d.contact_voornaam, d.contact_naam].filter(Boolean).join(' '))}
          ${dlRow('Adres', [d.contact_adres, d.contact_huisnummer].filter(Boolean).join(' '))}
          ${dlRow('Postcode / woonplaats', [d.contact_postcode, d.contact_woonplaats].filter(Boolean).join(' '))}
          ${dlRow('Geboortedatum', fmtDate(d.contact_geboortedatum))}
          ${dlRow('Telefoon', d.contact_telefoon)}
          ${dlRow('E-mail', d.contact_email)}
          ${dlRow('Relatie tot overledene', d.contact_relatie)}
        </dl>
        ${(d.contact_telefoon || d.contact_email) ? `
          <div class="quick-contact">
            ${d.contact_telefoon ? `<a class="btn btn-sm" href="tel:${esc(d.contact_telefoon.replace(/\s/g,''))}">📞 Bel</a>` : ''}
            ${d.contact_telefoon ? `<a class="btn btn-sm" href="https://wa.me/${esc(toWaNumber(d.contact_telefoon))}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
            ${d.contact_email ? `<a class="btn btn-sm" href="mailto:${esc(d.contact_email)}">✉️ E-mail</a>` : ''}
          </div>` : ''}
        <h3>Kerkelijk &amp; uitvaartdienst</h3>
        <dl class="dl">
          ${dlRow('Parochie', d.parochie)}
          ${dlRow('Priester', d.priester)}
          ${dlRow('Voorganger uitvaart', d.uitvaart_voorganger)}
          ${dlRow('Type uitvaart', d.uitvaart_type)}
          ${dlRow('Datum & tijdstip', [fmtDate(d.uitvaart_datum), d.uitvaart_tijd && 'om ' + d.uitvaart_tijd].filter(Boolean).join(' '))}
          ${dlRow('Kerk', d.kerk_locatie)}
          ${dlRow('Begraafplaats', [d.begraafplaats, d.grafnummer && 'graf ' + d.grafnummer, d.graf_type && '(' + d.graf_type + ')'].filter(Boolean).join(' — '))}
          ${d.graf_type === 'familiegraf' ? dlRow('Certificaatnummer', d.certificaat_nummer) : ''}
        </dl>
        <h3>Verzekering & betaling</h3>
        <dl class="dl">
          ${dlRow('Status', d.verzekering_status)}
          ${d.verzekering_status === 'met verzekering' ? `
            ${dlRow('Maatschappij', d.verzekering_maatschappij)}
            ${dlRow('Polisnummer', d.polisnummer)}
            ${dlRow('Polishouder', d.verzekering_polishouder)}
            ${dlRow('Dekkingsbedrag', d.verzekering_dekking ? fmtEUR(d.verzekering_dekking) : '')}
            ${dlRow('Pakket', d.verzekering_pakket)}
            ${dlRow('Aanmelding-status', d.verzekering_aanmelding_status)}
            ${dlRow('Contactpersoon', d.verzekering_contact_naam)}
            ${dlRow('Telefoon contact', d.verzekering_contact_telefoon)}
          ` : ''}
          ${d.verzekering_status === 'zonder verzekering' ? `
            ${dlRow('Betaalwijze', d.betaalwijze)}
            ${dlRow('Aanbetaling', d.aanbetaling_bedrag ? fmtEUR(d.aanbetaling_bedrag) + (d.aanbetaling_datum ? ' op ' + fmtDate(d.aanbetaling_datum) : '') : '')}
            ${dlRow('Eindafrekening', d.eindafrekening_bedrag ? fmtEUR(d.eindafrekening_bedrag) + (d.eindafrekening_status ? ' (' + d.eindafrekening_status + ')' : '') : '')}
            ${dlRow('Betalingstermijn', d.betalingstermijn)}
            ${dlRow('Verantwoordelijke', d.verantwoordelijke_persoon)}
          ` : ''}
          ${dlRow('Opdrachtgever', d.opdrachtgever_naam)}
          ${dlRow('Telefoon opdrachtgever', d.opdrachtgever_telefoon)}
        </dl>
        ${d.bijzonderheden ? `<h3>Bijzonderheden</h3><p class="prewrap">${esc(d.bijzonderheden)}</p>` : ''}

        ${(() => {
          const sigs = (d.handtekeningen && typeof d.handtekeningen === 'object') ? d.handtekeningen : {};
          const fields = Settings.get('signature_fields') || [];
          if (fields.length === 0) return '';
          const any = fields.some(f => sigs[f.id] && sigs[f.id].data);
          if (!any) return '';
          return `<h3>Handtekeningen</h3>
            <div class="signatures-grid signatures-readonly">
              ${fields.map(f => {
                const s = sigs[f.id];
                if (!s || !s.data) return '';
                const when = s.signed_at ? new Date(s.signed_at).toLocaleString('nl-NL') : '';
                return `<div class="signature-block">
                  <div class="signature-header"><strong>${esc(f.label)}</strong></div>
                  <img class="signature-img" src="${esc(s.data)}" alt="${esc(f.label)}">
                  <div class="signature-actions"><span class="muted small">Ondertekend ${esc(when)}</span></div>
                </div>`;
              }).join('')}
            </div>`;
        })()}
      </section>

      <section id="kosten" class="card kosten-card ${localStorage.getItem('sok_kosten_collapsed') !== '0' ? 'collapsed' : ''}">
        <button type="button" class="kosten-header" id="btn-kosten-toggle" aria-expanded="${localStorage.getItem('sok_kosten_collapsed') !== '0' ? 'false' : 'true'}" aria-controls="kosten-body" title="Klik om in- of uit te klappen">
          <span class="kosten-chevron" aria-hidden="true">▾</span>
          <h2 style="border:none;padding:0;margin:0;display:inline;">Kosten</h2>
          ${kosten.length > 0 ? `<span class="muted small kosten-summary">· ${kosten.length} ${kosten.length === 1 ? 'post' : 'posten'} · ${fmtEUR(totaal)}${moetNogBetalen > 0 ? ` · <strong style="color:#b34;">open ${fmtEUR(moetNogBetalen)}</strong>` : ' · <strong style="color:#2a7a3a;">volledig betaald</strong>'}</span>` : ''}
          ${kosten.length > 0 ? `<a href="#/dossiers/${d.id}/factuur" class="btn btn-sm kosten-factuur-link" onclick="event.stopPropagation()">📄 Kostenraming openen</a>` : ''}
        </button>
        <div id="kosten-body" class="kosten-body">
        ${kosten.length === 0 ? '<p class="muted">Nog geen kostenposten.</p>' : (() => {
          // Groepeer per categorie in vaste volgorde, en sorteer ITEMS
          // binnen elke groep volgens KOSTEN_PRESETS-volgorde (zodat de
          // lijst dezelfde rangschikking volgt als 'Snel toevoegen').
          const presetIdx = new Map();
          KOSTEN_PRESETS.forEach((p, i) => { if (!p.nav) presetIdx.set(p.omschrijving, i); });
          const KIST_TAG = 'Kist: ', BLOEM_TAG = '🌸 ', ETEN_TAG = '🍽 ';
          const navIdx = {
            [KIST_TAG]:  KOSTEN_PRESETS.findIndex(p => p.nav === 'kist'),
            [BLOEM_TAG]: KOSTEN_PRESETS.findIndex(p => p.nav === 'bloemen'),
            [ETEN_TAG]:  KOSTEN_PRESETS.findIndex(p => p.nav === 'eten'),
          };
          const presetRank = (oms) => {
            if (presetIdx.has(oms)) return presetIdx.get(oms) * 10;
            for (const tag in navIdx) if (oms.startsWith(tag)) return navIdx[tag] * 10 + 5;
            return KOSTEN_PRESETS.length * 10 + 100;
          };
          const buckets = {};
          kosten.forEach(k => {
            const cat = k.categorie || 'overig';
            (buckets[cat] = buckets[cat] || []).push(k);
          });
          Object.keys(buckets).forEach(cat => {
            buckets[cat].sort((a, b) => {
              const ra = presetRank(a.omschrijving || '');
              const rb = presetRank(b.omschrijving || '');
              return ra !== rb ? ra - rb : (a.id - b.id);
            });
          });
          const orderIds = KOSTEN_CATEGORIEEN.map(c => c.id);
          const orderedCats = orderIds.filter(id => buckets[id])
            .concat(Object.keys(buckets).filter(id => !orderIds.includes(id)));

          const colspanFront = 1; // omschrijving
          const colspanBack  = (verzekerd ? 1 : 0) + 1 + 1; // wie + status + delete
          return `
          <div class="kosten-groups">
            ${orderedCats.map(cat => {
              const items = buckets[cat];
              const sub = items.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
              return `
              <div class="kosten-group">
                <div class="kosten-group-head">
                  <span class="kosten-group-title">${categorieIcon(cat)} ${esc(categorieLabel(cat))}</span>
                  <span class="kosten-group-sub muted small">${items.length} ${items.length === 1 ? 'post' : 'posten'} · ${fmtEUR(sub)}</span>
                </div>
                <table class="table kosten-table">
                  <colgroup>
                    <col class="kc-col-omschrijving">
                    <col class="kc-col-aantal">
                    <col class="kc-col-bedrag">
                    ${dekkingInfo.mode === 'categorie' ? '<col class="kc-col-dekking">' : ''}
                    <col class="kc-col-del">
                  </colgroup>
                  <tbody>
                    ${items.map(k => {
                      const aantal = Number(k.aantal) || 1;
                      const stuk   = aantal > 0 ? (Number(k.bedrag) || 0) / aantal : 0;
                      const dekt   = (dekkingInfo.perKost && dekkingInfo.perKost[k.id]) || 0;
                      const familieDeel = Math.max(0, (Number(k.bedrag) || 0) - dekt);
                      return `<tr>
                      <td class="kc-omschrijving">${esc(k.omschrijving)}${aantal !== 1 ? ` <span class="muted small">(${fmtEUR(stuk)} per stuk)</span>` : ''}</td>
                      <td class="kc-aantal"><input type="number" class="kc-aantal-input" data-id="${k.id}" data-stuk="${stuk}" value="${esc(aantal)}" min="0" step="1" inputmode="numeric"></td>
                      <td class="kc-bedrag num">${fmtEUR(k.bedrag)}</td>
                      ${dekkingInfo.mode === 'categorie' ? `<td class="kc-dekking num small">${dekt > 0 ? `<span class="dekking-deel">🛡 ${fmtEUR(dekt)}</span>${familieDeel > 0 ? `<br><span class="familie-deel muted">👥 ${fmtEUR(familieDeel)}</span>` : ''}` : `<span class="familie-deel muted">👥 ${fmtEUR(familieDeel)}</span>`}</td>` : ''}
                      <td class="kc-del"><button type="button" class="btn-icon" data-action="del-kosten" data-id="${k.id}" title="Verwijderen">×</button></td>
                    </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>`;
            }).join('')}
          </div>
          <div class="kosten-totals">
            <div class="kosten-total-row">
              <span>Totaal factuur</span>
              <strong class="num">${fmtEUR(totaal)}</strong>
            </div>
            ${kosten.length > 0 ? `
              <div class="kosten-total-row">
                <span>Status</span>
                <button type="button" class="kost-toggle kost-toggle-big ${moetNogBetalen === 0 ? 'on-betaald' : 'off-betaald'}" data-action="toggle-factuur-betaald" title="Klik om te wisselen">
                  ${moetNogBetalen === 0 ? '✓ Volledig betaald' : '○ Nog open'}
                </button>
              </div>` : ''}
            ${verzekerd ? `
              <div class="kosten-totals-divider"></div>
              ${dekking === 0 && verzDekking === 0 ? `
                <div class="alert alert-info" style="margin:.25rem 0 .5rem;font-size:.85rem;">
                  Vul de <a href="#/dossiers/${d.id}/bewerken#verzekering-met-fields"><strong>maatschappij + pakket + dekkingsbedrag</strong></a>
                  in bij Verzekering &amp; betaling — voor DELA wordt dan
                  automatisch per categorie berekend wat verzekerd is.
                </div>
              ` : `
                ${dekkingInfo.mode === 'categorie' ? `
                  <div class="kosten-total-row muted small" style="font-weight:600;">
                    <span>${esc((dekkingInfo.pakket && dekkingInfo.pakket.naam) || 'Verzekering')}</span>
                    <span></span>
                  </div>
                  ${Object.entries(dekkingInfo.perCategorie).filter(([,v]) => v > 0).map(([cat, v]) => `
                    <div class="kosten-total-row muted small" style="padding-left:1rem;">
                      <span>· ${esc(categorieLabel(cat))}</span>
                      <span class="num">${fmtEUR(v)}</span>
                    </div>`).join('')}
                  ${dekkingInfo.geldStart > 0 ? `
                    <div class="kosten-total-row muted small" style="padding-left:1rem;">
                      <span>· Geldverzekering benut</span>
                      <span class="num">${fmtEUR(dekkingInfo.geldStart - dekkingInfo.geldRest)}${dekkingInfo.geldRest > 0 ? ` <span class="muted">(rest ${fmtEUR(dekkingInfo.geldRest)} aan familie)</span>` : ''}</span>
                    </div>` : ''}
                ` : ''}
                <div class="kosten-total-row">
                  <span>Verzekering dekt totaal${dekkingInfo.mode === 'categorie' ? '' : (verzDekking > 0 ? ' (uit polis)' : '')}</span>
                  <strong class="num">${fmtEUR(dekking)}</strong>
                </div>
                <div class="kosten-total-row muted small">
                  <span>Door familie te betalen</span>
                  <span class="num">${fmtEUR(familieTotaal)}</span>
                </div>
                <div class="kosten-total-row total-familie">
                  <span>Familie moet nog betalen</span>
                  <strong class="num">${fmtEUR(familieMoetNog)}</strong>
                </div>
              `}
            ` : ''}
          </div>`;
        })()}
        <h3 style="margin-top:1rem;">Snel toevoegen uit catalogus</h3>
        <p class="muted small">Klik om een vast tarief direct toe te voegen. Gebruik ✏️ om een prijs aan te passen.${(() => {
          const adminMode = !!Settings.get('catalog_admin_mode');
          return adminMode ? ' <em>Beheermodus aan — 🗑 verbergt een post uit de lijst.</em>' : '';
        })()}</p>
        <div class="preset-grid">
          ${(() => {
            const adminMode = !!Settings.get('catalog_admin_mode');
            return effectieveKostenPresets({ includeHidden: adminMode }).map((p, i) => {
              const cls = 'btn preset-btn'
                + (p.nav ? ' preset-nav preset-nav-' + p.nav : '')
                + (p._hidden ? ' is-hidden-preset' : '');
              const trailing = (p.bedrag != null && p.bedrag !== '')
                ? `<strong>${p.vraagPrijs ? '± ' : ''}${fmtEUR(p.bedrag)}${p._customBedrag && !p.vraagPrijs ? ' ✏️' : ''}</strong>`
                : (p.nav ? '<strong class="muted">→</strong>' : '');
              // Prijs aanpassen (✏️) mag ALTIJD — geen beheermodus nodig.
              // Verbergen/herstellen (🗑/↺) blijft achter beheermodus.
              const adminCtrls = !p.nav
                ? `<span class="preset-admin">
                    <button type="button" class="preset-edit" data-action="edit-preset" data-preset="${i}" title="Prijs aanpassen">✏️</button>
                    ${adminMode
                      ? (p._hidden
                          ? `<button type="button" class="preset-show" data-action="show-preset" data-preset="${i}" title="Herstel kostenpost">↺</button>`
                          : `<button type="button" class="preset-hide" data-action="hide-preset" data-preset="${i}" title="Verwijder uit lijst">🗑</button>`)
                      : ''}
                  </span>`
                : '';
              return `<span class="preset-wrap">
                <button type="button" class="${cls}" data-action="add-preset" data-preset="${i}" ${p._hidden ? 'disabled' : ''}>
                  <span>${esc(p.omschrijving)}${p.food ? ' <span class="badge badge-amber" title="Aantal wordt gevraagd bij toevoegen">×N</span>' : ''}${p.vraagPrijs ? ' <span class="badge badge-amber" title="Richtprijs — werkelijk bedrag wordt gevraagd">±</span>' : ''}</span>
                  ${trailing}
                </button>
                ${adminCtrls}
              </span>`;
            }).join('');
          })()}
        </div>
        <h3 style="margin-top:1rem;">Of voeg handmatig toe</h3>
        <form id="add-kosten" class="row-form">
          <input type="text" name="omschrijving" placeholder="Omschrijving..." required>
          <select name="categorie">
            <option value="">Categorie</option>
            ${KOSTEN_CATEGORIEEN.map(c =>
              `<option value="${c.id}">${esc(c.label)}</option>`).join('')}
          </select>
          <input type="number" name="aantal" placeholder="Aantal" min="1" step="1" inputmode="numeric" value="1" style="max-width:80px;">
          <input type="text" name="bedrag" placeholder="Prijs per stuk" inputmode="decimal" style="max-width:130px;">
          <label class="checkbox-inline"><input type="checkbox" name="betaald"> betaald</label>
          <button type="submit" class="btn">+ Toevoegen</button>
        </form>
        </div><!-- /.kosten-body -->
      </section>

      ${renderFamiliePortaalSection(d)}

      <section id="notities" class="card">
        <h2>Notities</h2>
        <form id="add-notitie" class="form">
          <textarea name="tekst" rows="3" placeholder="Nieuwe notitie..." required></textarea>
          <button type="submit" class="btn">+ Notitie toevoegen</button>
        </form>
        ${notities.length === 0 ? '<p class="muted">Nog geen notities.</p>' :
          '<ul class="notitie-list">' + notities.map(n => `
            <li>
              <div class="notitie-meta">
                <strong>${esc(n.auteur || 'Onbekend')}</strong>
                <span class="muted small">${esc(fmtDate(n.created_at))}</span>
                <button type="button" class="btn-icon right" data-action="del-notitie" data-id="${n.id}">×</button>
              </div>
              <div class="prewrap">${esc(n.tekst)}</div>
            </li>`).join('') + '</ul>'}
      </section>
    </div>`;

  bindDetailEvents(id);
  bindFamiliePortaalSection(id);
}

function toWaNumber(tel) {
  let num = String(tel || '').replace(/\D/g, '');
  if (num.startsWith('00')) num = num.slice(2);
  else if (num.startsWith('0')) num = '31' + num.slice(1);
  return num;
}

function emTable(rows) {
  const valid = rows.filter(r => r && r[1] != null && String(r[1]).trim() !== '');
  if (!valid.length) return '';
  return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:6px 0 14px;">
    ${valid.map(([k, v]) => `
      <tr>
        <td style="padding:6px 10px 6px 0;color:#6f6a62;vertical-align:top;width:38%;font-size:13px;">${esc(k)}</td>
        <td style="padding:6px 0;color:#2a2724;vertical-align:top;font-size:14px;">${esc(v)}</td>
      </tr>`).join('')}
  </table>`;
}
function emH3(t) {
  return `<h3 style="margin:18px 0 4px;font-family:inherit;font-size:15px;font-weight:600;color:#2563eb;border-bottom:1px solid #e5e2da;padding-bottom:4px;">${esc(t)}</h3>`;
}

// E-mail-footer: donker balkje met links + socials + adres,
// onderaan elke uitgaande mail. Configureerbaar via Account.
function buildEmailFooter() {
  const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
  if (s.email_footer_enabled === false) return '';

  const linkStyle = 'color:#a8b3c6;text-decoration:none;';
  const links = [];
  if (s.email_footer_terms_url)
    links.push(`<a href="${esc(s.email_footer_terms_url)}" style="${linkStyle}">Algemene Voorwaarden</a>`);
  if (s.email_footer_privacy_url)
    links.push(`<a href="${esc(s.email_footer_privacy_url)}" style="${linkStyle}">Privacy Voorwaarden</a>`);
  const linksRow = links.length
    ? `<div style="margin-bottom:14px;font-size:13px;">${links.join(' &nbsp;|&nbsp; ')}</div>` : '';

  const socials = [];
  if (s.email_footer_facebook_url) {
    socials.push(`<a href="${esc(s.email_footer_facebook_url)}" style="${linkStyle}display:inline-block;width:28px;height:28px;line-height:26px;border:1px solid #a8b3c6;border-radius:50%;margin:0 4px;font-weight:700;font-family:Arial,sans-serif;">f</a>`);
  }
  if (s.email_footer_instagram_url) {
    socials.push(`<a href="${esc(s.email_footer_instagram_url)}" style="${linkStyle}display:inline-block;width:28px;height:28px;line-height:26px;border:1px solid #a8b3c6;border-radius:50%;margin:0 4px;font-family:Arial,sans-serif;">IG</a>`);
  }
  const socialsRow = socials.length
    ? `<div style="margin-bottom:14px;">${socials.join('')}</div>` : '';

  const addrRow = s.email_footer_address
    ? `<div style="font-size:12px;color:#cfd6e3;margin-bottom:4px;">${esc(s.email_footer_address)}</div>` : '';

  // Contact-regel met ·-separator: alleen ingevulde velden tonen
  const contactParts = [];
  if (s.email_footer_phone)   contactParts.push(`<a href="tel:${esc(s.email_footer_phone.replace(/\s+/g,''))}" style="${linkStyle}">${esc(s.email_footer_phone)}</a>`);
  if (s.email_footer_email)   contactParts.push(`<a href="mailto:${esc(s.email_footer_email)}" style="${linkStyle}">${esc(s.email_footer_email)}</a>`);
  if (s.email_footer_website) {
    const url = /^https?:\/\//.test(s.email_footer_website) ? s.email_footer_website : 'https://' + s.email_footer_website;
    const label = s.email_footer_website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    contactParts.push(`<a href="${esc(url)}" style="${linkStyle}">${esc(label)}</a>`);
  }
  const contactRow = contactParts.length
    ? `<div style="font-size:12px;color:#a8b3c6;">${contactParts.join(' &nbsp;·&nbsp; ')}</div>` : '';

  if (!linksRow && !socialsRow && !addrRow && !contactRow) return '';

  return `
    <div style="margin-top:28px;background:#101a35;padding:28px 20px;border-radius:6px;text-align:center;font-family:system-ui,Arial,sans-serif;color:#a8b3c6;">
      ${linksRow}
      ${socialsRow}
      ${addrRow}
      ${contactRow}
    </div>`;
}

// Sorteer kosten volgens KOSTEN_PRESETS-volgorde (zelfde rangschikking
// als de 'Snel toevoegen'-lijst en het kostenoverzicht in het formulier).
function _kostenInPresetVolgorde(kosten) {
  const presetIdx = new Map();
  KOSTEN_PRESETS.forEach((p, i) => { if (!p.nav) presetIdx.set(p.omschrijving, i); });
  const tagAfter = {
    'Kist: ':  KOSTEN_PRESETS.findIndex(p => p.nav === 'kist'),
    '🌸 ':     KOSTEN_PRESETS.findIndex(p => p.nav === 'bloemen'),
    '🍽 ':     KOSTEN_PRESETS.findIndex(p => p.nav === 'eten'),
  };
  const rank = (k) => {
    const oms = k.omschrijving || '';
    if (presetIdx.has(oms)) return [presetIdx.get(oms) * 10, 0];
    for (const tag in tagAfter) if (oms.startsWith(tag)) return [tagAfter[tag] * 10 + 5, 0];
    return [KOSTEN_PRESETS.length * 10 + 100, Number(k.id) || 0];
  };
  return kosten.slice().sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    return ra[0] !== rb[0] ? ra[0] - rb[0] : ra[1] - rb[1];
  });
}

// Spec voor de PDF-generator (jsPDF) — volledig dossieroverzicht.
// Alle dossiervelden gegroepeerd — gedeeld door zowel de PDF als de e-mail,
// zodat beide exact hetzelfde tonen én compleet zijn. Lege waarden worden via
// _rijenMetStreep een "-", zodat élk veld altijd zichtbaar is.
function dossierGroepen(d) {
  const adresO = [d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', ');
  const adresC = [[d.contact_adres, d.contact_huisnummer].filter(Boolean).join(' '), d.contact_postcode, d.contact_woonplaats].filter(Boolean).join(', ');
  const geboren = [fmtDate(d.geboortedatum), d.geboorteplaats && 'te ' + d.geboorteplaats].filter(Boolean).join(' ');
  const overleden = [fmtDate(d.overlijdensdatum), d.overlijdenstijd && 'om ' + d.overlijdenstijd, d.overlijdensplaats && 'te ' + d.overlijdensplaats].filter(Boolean).join(' ');
  const huis = [fmtDate(d.huisbezoek_datum), d.huisbezoek_tijd && 'om ' + d.huisbezoek_tijd].filter(Boolean).join(' ');
  const avond = [fmtDate(d.avondwake_datum), d.avondwake_tijd && 'om ' + d.avondwake_tijd, d.avondwake_locatie].filter(Boolean).join(' ');
  const uitv = [fmtDate(d.uitvaart_datum), d.uitvaart_tijd && 'om ' + d.uitvaart_tijd].filter(Boolean).join(' ');
  const graf = [d.begraafplaats, d.grafnummer && 'graf ' + d.grafnummer, d.graf_type && '(' + d.graf_type + ')'].filter(Boolean).join(' — ');
  const geld = (bedrag, extra) => bedrag ? fmtEUR(bedrag) + (extra || '') : '';

  return [
    { heading: 'Overledene', rows: [
      ['Naam', fullName(d)],
      ['Doopnaam', d.doopnaam],
      ['Geslacht', d.geslacht],
      ['Geboren', geboren],
      ['Overleden', overleden],
      ['Adres', adresO],
      ['BSN', d.bsn],
      ['(Ex)partner', d.partner_naam],
      ['Kinderen', d.kinderen_status],
      ['Minderjarige kinderen', d.minderjarige_kinderen],
      ['Namen kinderen', d.kinderen_namen],
      ['Nationaliteit', d.nationaliteit],
      ['Lid SOK', d.syrisch_orthodox_lid],
      ['Gezinsnummer', d.gezinsnummer],
    ] },
    { heading: 'Contactpersoon', rows: [
      ['Naam', [d.contact_voornaam, d.contact_naam].filter(Boolean).join(' ')],
      ['BSN', d.contact_bsn],
      ['Adres', adresC],
      ['Geboortedatum', fmtDate(d.contact_geboortedatum)],
      ['Telefoon', d.contact_telefoon],
      ['E-mail', d.contact_email],
      ['Relatie tot overledene', d.contact_relatie],
    ] },
    { heading: 'Kerkelijk & uitvaartdienst', rows: [
      ['Parochie', d.parochie],
      ['Priester', d.priester],
      ['Huisbezoek', huis],
      ['Avondwake', avond],
      ['Type uitvaart', d.uitvaart_type],
      ['Datum & tijdstip', uitv],
      ['Kerk', d.kerk_locatie],
      ['Begraafplaats', graf],
      ['Condoleance', d.condoleance_locatie],
    ] },
    { heading: 'Verzekering & betaling', rows: [
      ['Verzekering', d.verzekering_status],
      ['Maatschappij', d.verzekering_maatschappij],
      ['Polisnummer', d.polisnummer],
      ['Polishouder', d.verzekering_polishouder],
      ['Dekkingsbedrag', d.verzekering_dekking ? fmtEUR(d.verzekering_dekking) : ''],
      ['Pakket', d.verzekering_pakket],
      ['Aanmelding-status', d.verzekering_aanmelding_status],
      ['Verzekering-contact', d.verzekering_contact_naam],
      ['Telefoon verz.-contact', d.verzekering_contact_telefoon],
      ['Betaalwijze', d.betaalwijze],
      ['Aanbetaling', geld(d.aanbetaling_bedrag, d.aanbetaling_datum ? ' op ' + fmtDate(d.aanbetaling_datum) : '')],
      ['Eindafrekening', geld(d.eindafrekening_bedrag, d.eindafrekening_status ? ' (' + d.eindafrekening_status + ')' : '')],
      ['Betalingstermijn', d.betalingstermijn],
      ['Verantwoordelijke', d.verantwoordelijke_persoon],
    ] },
    { heading: 'Opdrachtgever', rows: [
      ['Naam', d.opdrachtgever_naam],
      ['Telefoon', d.opdrachtgever_telefoon],
    ] },
    { heading: 'Bijzonderheden', rows: [
      ['Toelichting', d.bijzonderheden],
    ] },
  ];
}

// Vervang lege waarden door "-" zodat élk veld zichtbaar blijft.
function _rijenMetStreep(rows) {
  return rows.map(([k, v]) => [k, (v == null || String(v).trim() === '') ? '-' : v]);
}

function dossierSpec(d, kosten) {
  const kostenLijst = Array.isArray(kosten) ? _kostenInPresetVolgorde(kosten) : [];
  const totaal = kostenLijst.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const sections = dossierGroepen(d).map(g => ({ heading: g.heading, rows: _rijenMetStreep(g.rows) }));

  return {
    title: 'DOSSIER',
    meta: [
      'Dossier: ' + (d.dossier_nummer || '-'),
      'Status: ' + ((d.status || '-').replace('_', ' ')),
      'Datum: ' + new Date().toLocaleDateString('nl-NL'),
    ],
    sections,
    table: kostenLijst.length ? { heading: 'Kostenoverzicht', rows: kostenLijst.map(k => [k.omschrijving || '', k.categorie || '', fmtEUR(k.bedrag)]) } : null,
    totals: kostenLijst.length ? [['Totaal', fmtEUR(totaal), true]] : [],
  };
}

// Volledige dossier-mail: álle gegevens in de mailtekst zelf (net als de PDF),
// mét de PDF als bijlage bovenaan.
function buildDossierEmail(d, kosten) {
  const parts = [];
  parts.push(`<p style="margin:0 0 12px;">Beste,</p>`);
  parts.push(`<p style="margin:0 0 14px;">Hierbij de gegevens van het uitvaartdossier <strong>${esc(d.dossier_nummer || '')}</strong>${d.status ? ' (status: ' + esc((d.status||'').replace('_',' ')) + ')' : ''}.</p>`);

  dossierGroepen(d).forEach(g => {
    parts.push(emH3(g.heading));
    parts.push(emTable(_rijenMetStreep(g.rows)));
  });

  // ─── Kostenoverzicht ──────────────────────────────────────────────────
  const kostenLijst = Array.isArray(kosten) ? _kostenInPresetVolgorde(kosten) : [];
  const totaalKost = kostenLijst.reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const betaaldKost = kostenLijst.filter(k => k.betaald).reduce((s, k) => s + (Number(k.bedrag) || 0), 0);
  const openKost = Math.max(0, totaalKost - betaaldKost);
  parts.push(emH3('Kostenoverzicht'));
  if (kostenLijst.length === 0) {
    parts.push(`<p style="color:#6f6a62;font-style:italic;margin:6px 0 14px;">Geen kostenposten geregistreerd.</p>`);
  } else {
    parts.push(`<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:13px;">
      <thead>
        <tr style="background:#f6f4ef;">
          <th align="left"  style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Omschrijving</th>
          <th align="left"  style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Categorie</th>
          <th align="right" style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Aantal</th>
          <th align="right" style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Bedrag</th>
        </tr>
      </thead>
      <tbody>
        ${kostenLijst.map(k => {
          const aantal = Number(k.aantal) || 1;
          const stuk = aantal > 0 ? (Number(k.bedrag) || 0) / aantal : 0;
          return `<tr>
            <td style="padding:7px 10px;border-bottom:1px solid #f0eee8;">${esc(k.omschrijving)}${aantal !== 1 ? ` <span style="color:#8a847b;font-size:11px;">(${esc(fmtEUR(stuk))} per stuk)</span>` : ''}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #f0eee8;color:#6f6a62;">${esc(categorieLabel(k.categorie))}</td>
            <td align="right" style="padding:7px 10px;border-bottom:1px solid #f0eee8;font-variant-numeric:tabular-nums;">${aantal}</td>
            <td align="right" style="padding:7px 10px;border-bottom:1px solid #f0eee8;font-variant-numeric:tabular-nums;">${esc(fmtEUR(k.bedrag))}${k.betaald ? ' <span style="color:#2a7a3a;font-size:11px;">✓</span>' : ''}</td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" align="right" style="padding:8px 10px;font-weight:600;border-top:2px solid #d8d4ca;">Totaal</td>
          <td align="right" style="padding:8px 10px;font-weight:600;font-variant-numeric:tabular-nums;border-top:2px solid #d8d4ca;">${esc(fmtEUR(totaalKost))}</td>
        </tr>
        ${betaaldKost > 0 ? `<tr>
          <td colspan="3" align="right" style="padding:6px 10px;color:#2a7a3a;">Reeds betaald</td>
          <td align="right" style="padding:6px 10px;color:#2a7a3a;font-variant-numeric:tabular-nums;">- ${esc(fmtEUR(betaaldKost))}</td>
        </tr>` : ''}
        ${openKost > 0 ? `<tr>
          <td colspan="3" align="right" style="padding:8px 10px;font-weight:700;color:#b34;">Open saldo</td>
          <td align="right" style="padding:8px 10px;font-weight:700;color:#b34;font-variant-numeric:tabular-nums;">${esc(fmtEUR(openKost))}</td>
        </tr>` : ''}
      </tfoot>
    </table>`);
  }

  const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
  parts.push(`<p style="margin:18px 0 0;font-size:13px;color:#6f6a62;">Met vriendelijke groet,<br><strong>${esc(s.app_name || 'Uitvaartleider')}</strong>${s.app_tagline ? '<br>' + esc(s.app_tagline) : ''}</p>`);
  parts.push(buildEmailFooter());
  return parts.join('\n');
}

function buildFactuurEmail(d, kosten) {
  const verzekerd = d.verzekering_status === 'met verzekering';
  const totaal = kosten.reduce((s, k) => s + (Number(k.bedrag)||0), 0);
  const gedektFlag = kosten.filter(k => k.gedekt).reduce((s, k) => s + (Number(k.bedrag)||0), 0);
  const verzDek = Number(d.verzekering_dekking) || 0;
  const gedekt = !verzekerd ? 0
                 : (verzDek > 0 ? Math.min(verzDek, totaal) : gedektFlag);
  const familie = Math.max(0, totaal - gedekt);
  const aanbet = Number(d.aanbetaling_bedrag) || 0;
  const teBetalen = familie - aanbet;
  const s = (typeof Settings !== 'undefined') ? Settings.all() : {};

  const parts = [];
  parts.push(`<p style="margin:0 0 12px;">Beste,</p>`);
  parts.push(`<p style="margin:0 0 14px;">Hierbij de factuur voor uitvaartdossier <strong>${esc(d.dossier_nummer || '')}</strong>.</p>`);

  parts.push(emTable([
    ['Voor', d.opdrachtgever_naam || d.contact_naam],
    ['Betreft', `Uitvaart van ${fullName(d) || '—'}`],
    ['Overlijdensdatum', fmtDate(d.overlijdensdatum)],
    ['Uitvaartdatum', fmtDate(d.uitvaart_datum)],
  ]));

  if (verzekerd) {
    parts.push(`<p style="background:#e6eef9;color:#2b5d99;padding:10px 14px;border-radius:6px;margin:10px 0;font-size:13px;">
      Via verzekering: <strong>${esc(d.verzekering_maatschappij || '—')}</strong>${d.polisnummer ? ' — polisnummer ' + esc(d.polisnummer) : ''}${d.verzekering_pakket ? ' — ' + esc(d.verzekering_pakket) : ''}
    </p>`);
  }

  parts.push(emH3('Kosten'));
  if (kosten.length === 0) {
    parts.push(`<p style="color:#6f6a62;font-style:italic;">Nog geen kostenposten geregistreerd.</p>`);
  } else {
    parts.push(`<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:13px;">
      <thead>
        <tr style="background:#f6f4ef;">
          <th align="left" style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Omschrijving</th>
          <th align="left" style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Categorie</th>
          <th align="right" style="padding:7px 10px;border-bottom:1px solid #e5e2da;font-weight:600;color:#6f6a62;text-transform:uppercase;font-size:11px;letter-spacing:.04em;">Bedrag</th>
        </tr>
      </thead>
      <tbody>
        ${kosten.map(k => `
          <tr>
            <td style="padding:7px 10px;border-bottom:1px solid #f0eee8;">${esc(k.omschrijving)}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #f0eee8;color:#6f6a62;">${esc(k.categorie || '')}</td>
            <td align="right" style="padding:7px 10px;border-bottom:1px solid #f0eee8;font-variant-numeric:tabular-nums;">${esc(fmtEUR(k.bedrag))}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" align="right" style="padding:8px 10px;font-weight:600;">Totaal</td>
          <td align="right" style="padding:8px 10px;font-weight:600;font-variant-numeric:tabular-nums;">${esc(fmtEUR(totaal))}</td>
        </tr>
        ${verzekerd && gedekt > 0 ? `
          <tr>
            <td colspan="2" align="right" style="padding:6px 10px;color:#6f6a62;">Gedekt door verzekering</td>
            <td align="right" style="padding:6px 10px;color:#6f6a62;font-variant-numeric:tabular-nums;">- ${esc(fmtEUR(gedekt))}</td>
          </tr>
          <tr style="background:#f5e8ea;">
            <td colspan="2" align="right" style="padding:8px 10px;font-weight:600;color:#2563eb;">Door familie te betalen</td>
            <td align="right" style="padding:8px 10px;font-weight:600;color:#2563eb;font-variant-numeric:tabular-nums;">${esc(fmtEUR(familie))}</td>
          </tr>` : ''}
        ${aanbet > 0 ? `
          <tr>
            <td colspan="2" align="right" style="padding:6px 10px;color:#6f6a62;">Aanbetaling${d.aanbetaling_datum ? ' (' + fmtDate(d.aanbetaling_datum) + ')' : ''}</td>
            <td align="right" style="padding:6px 10px;color:#6f6a62;font-variant-numeric:tabular-nums;">- ${esc(fmtEUR(aanbet))}</td>
          </tr>
          <tr style="background:#f5e8ea;">
            <td colspan="2" align="right" style="padding:8px 10px;font-weight:600;color:#2563eb;">Nog te voldoen</td>
            <td align="right" style="padding:8px 10px;font-weight:600;color:#2563eb;font-variant-numeric:tabular-nums;">${esc(fmtEUR(teBetalen))}</td>
          </tr>` : ''}
      </tfoot>
    </table>`);
  }

  if (d.betalingstermijn || d.betaalwijze || d.eindafrekening_status || d.verantwoordelijke_persoon) {
    parts.push(emH3('Betalingsafspraken'));
    parts.push(emTable([
      ['Betaalwijze', d.betaalwijze],
      ['Termijn', d.betalingstermijn],
      ['Status', d.eindafrekening_status],
      ['Verantwoordelijke', d.verantwoordelijke_persoon],
    ]));
  }

  parts.push(`<p style="margin:18px 0 0;font-size:13px;color:#6f6a62;">Met vriendelijke groet,<br><strong>${esc(s.app_name || 'Uitvaartleider')}</strong>${s.app_tagline ? '<br>' + esc(s.app_tagline) : ''}</p>`);
  parts.push(buildEmailFooter());
  return parts.join('\n');
}

function openMailto(to, subject, body) {
  const url = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

function dlRow(label, value) {
  const v = value && String(value).trim() ? value : '—';
  // value mag al HTML zijn als 'ie van kistRowValue komt; anders escapen
  const isHtml = typeof v === 'string' && v.startsWith('<');
  return `<div><dt>${esc(label)}</dt><dd>${isHtml ? v : esc(v)}</dd></div>`;
}

function kistRowValue(kistNaam) {
  const k = KISTEN_CATALOGUS.find(x => x.naam === kistNaam);
  if (!k) return esc(kistNaam);
  const fotoUrl = KistFotos.urlVoor(k.naam);
  const thumb = fotoUrl
    ? `<img src="${esc(fotoUrl)}" alt="${esc(k.naam)}" loading="lazy">`
    : kistSVG(k.materiaal);
  return `<span class="kist-thumb-inline">${thumb}</span>` +
         `<strong>${esc(k.naam)}</strong> ` +
         `<span class="muted small">— ${esc(k.materiaal)} — ${fmtEUR(k.bedrag)}</span>`;
}

function bloemRowValue(bloemNaam) {
  const b = DB.list(KEYS.BLOEMEN).find(x => x.naam === bloemNaam);
  if (!b) return esc(bloemNaam);
  const fotoUrl = BloemenFotos.urlVoor(b.naam);
  const thumb = fotoUrl
    ? `<img src="${esc(fotoUrl)}" alt="${esc(b.naam)}" loading="lazy">`
    : (typeof bloemSVG === 'function' ? bloemSVG() : '');
  const meta = [b.omschrijving, b.bedrag ? fmtEUR(b.bedrag) : null].filter(Boolean).join(' — ');
  return `<span class="kist-thumb-inline">${thumb}</span>` +
         `<strong>${esc(b.naam)}</strong>` +
         (meta ? ` <span class="muted small">— ${esc(meta)}</span>` : '');
}

function bindDetailEvents(id) {
  const dRow = DB.byId(KEYS.DOSSIERS, id);
  $('#btn-print').addEventListener('click', async () => {
    const btn = $('#btn-print');
    const orig = btn.textContent; btn.disabled = true; btn.textContent = 'PDF maken…';
    try {
      const ks = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);
      await PdfGen.deliver(dossierSpec(dRow, ks), `dossier-${dRow.dossier_nummer}.pdf`, id);
    } catch (e) {
      Modal.show({ type: 'error', title: 'PDF maken mislukt', message: e.message || String(e) });
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  });

  // Artsverklaring bekijken (signed URL)
  const avBtn = $('#btn-view-artsverklaring');
  if (avBtn && dRow && dRow.artsverklaring_pad) {
    avBtn.addEventListener('click', () => {
      openUrlAsync(ArtsVerklaring.signedUrl(dRow.artsverklaring_pad, 300));
    });
  }

  // Overflow-menu (⋯) — sluit na klikken op een actie, of bij klik buiten
  const moreMenu = $('.page-actions-more');
  if (moreMenu) {
    moreMenu.querySelectorAll('.page-actions-menu button').forEach(btn => {
      btn.addEventListener('click', () => moreMenu.removeAttribute('open'));
    });
    document.addEventListener('click', e => {
      if (moreMenu.hasAttribute('open') && !moreMenu.contains(e.target)) {
        moreMenu.removeAttribute('open');
      }
    });
  }

  // Kosten-sectie in-/uitklappen, voorkeur onthouden in localStorage
  const kostenToggle = $('#btn-kosten-toggle');
  if (kostenToggle) {
    kostenToggle.addEventListener('click', () => {
      const section = $('#kosten');
      const collapsed = section.classList.toggle('collapsed');
      kostenToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      localStorage.setItem('sok_kosten_collapsed', collapsed ? '1' : '0');
    });
  }

  const emailDosBtn = $('#btn-email-dossier');
  if (emailDosBtn) {
    emailDosBtn.addEventListener('click', () => {
      const d = DB.byId(KEYS.DOSSIERS, id); if (!d) return;
      const kostenLijst = DB.where(KEYS.KOSTEN, k => k.dossier_id === d.id);
      MailComposer.open({
        dossier: d,
        type: 'dossier',
        subject: `Uitvaartdossier ${d.dossier_nummer} — ${fullName(d) || ''}`.trim(),
        body: buildDossierEmail(d, kostenLijst),
      });
    });
  }
  const emailFactBtn = $('#btn-email-factuur');
  if (emailFactBtn) {
    emailFactBtn.addEventListener('click', () => {
      const d = DB.byId(KEYS.DOSSIERS, id); if (!d) return;
      const ks = DB.where(KEYS.KOSTEN, k => k.dossier_id === id).sort((a, b) => a.id - b.id);
      MailComposer.open({
        dossier: d,
        type: 'factuur',
        subject: `Factuur uitvaart ${d.dossier_nummer} — ${fullName(d) || ''}`.trim(),
        body: buildFactuurEmail(d, ks),
        kosten: ks,
      });
    });
  }
  const copyBtn = $('#btn-copy-nr');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(dRow.dossier_nummer);
        Modal.show({ type: 'success', title: 'Gekopieerd', message: `Dossiernummer ${dRow.dossier_nummer} staat op het klembord.` });
      } catch (_) {
        Modal.show({ type: 'error', title: 'Kopiëren mislukt', message: 'Je browser staat klembord-toegang niet toe.' });
      }
    });
  }


  const statusSel = $('#status-select');
  if (statusSel) {
    statusSel.addEventListener('change', async e => {
      const nieuw = e.target.value;
      try {
        await DB.update(KEYS.DOSSIERS, id, { status: nieuw });
        renderDossierDetail({ id });
      } catch (_) {
        renderDossierDetail({ id });
      }
    });
  }

  $('#btn-delete').addEventListener('click', async () => {
    const ok = await Modal.confirm({
      title: 'Dossier verwijderen?',
      message: 'Het dossier en alle bijbehorende kosten en notities worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt.',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    if (!ok) return;
    try {
      await DB.remove(KEYS.DOSSIERS, id); // cascade verwijdert kosten/notities in DB
      ['kosten','notities'].forEach(t =>
        Cloud.cache[t] = Cloud.cache[t].filter(x => x.dossier_id !== id));
      Router.go('/dossiers');
    } catch (e) {}
  });

  $('#add-kosten').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const omsch = f.omschrijving.value.trim(); if (!omsch) return;
    const aantal = parseInt(f.aantal.value, 10);
    if (!isFinite(aantal) || aantal < 1) { Modal.show({ type: 'warning', title: 'Ongeldig aantal', message: 'Vul een aantal in van 1 of hoger.' }); return; }
    const stuk = parseEUR(f.bedrag.value);
    const bedrag = +(stuk * aantal).toFixed(2);
    try {
      await DB.insert(KEYS.KOSTEN, { dossier_id: id, omschrijving: omsch, categorie: f.categorie.value || null, bedrag, aantal, betaald: f.betaald.checked });
      await DB.touchDossier(id);
      renderDossierDetail({ id });
    } catch (_) {}
  });

  // Aantal aanpassen → bedrag herberekenen op basis van stukprijs en opslaan
  let _aantalSaveTimer = null;
  $$('input.kc-aantal-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      const tid = parseInt(inp.dataset.id, 10);
      const stuk = Number(inp.dataset.stuk) || 0;
      let nieuw = Math.max(0, parseInt(inp.value, 10) || 0);
      inp.value = String(nieuw);
      const k = DB.byId(KEYS.KOSTEN, tid); if (!k) return;
      const newBedrag = +(stuk * nieuw).toFixed(2);
      try {
        await DB.update(KEYS.KOSTEN, tid, { aantal: nieuw, bedrag: newBedrag });
        await DB.touchDossier(id);
        renderDossierDetail({ id });
      } catch (_) {}
    });
  });

  $('#add-notitie').addEventListener('submit', async e => {
    e.preventDefault();
    const tekst = e.target.tekst.value.trim(); if (!tekst) return;
    const profiel = ActiveProfile.current();
    const u = Auth.current();
    const auteur = profiel ? profiel.name : (u ? (u.fullName || u.email) : 'Onbekend');
    try {
      await DB.insert(KEYS.NOTITIES, { dossier_id: id, tekst, auteur });
      await DB.touchDossier(id);
      renderDossierDetail({ id });
    } catch (_) {}
  });

  $('#view').onclick = async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const tid = parseInt(btn.getAttribute('data-id'), 10);
    try {
      if (action === 'toggle-factuur-betaald') {
        const kostenList = DB.where(KEYS.KOSTEN, k => k.dossier_id === id);
        const allesBetaald = kostenList.length > 0 && kostenList.every(k => k.betaald);
        const nieuw = !allesBetaald;
        await Promise.all(kostenList.map(k =>
          DB.update(KEYS.KOSTEN, k.id, { betaald: nieuw })
        ));
        await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'toggle-gedekt') {
        const k = DB.byId(KEYS.KOSTEN, tid); if (!k) return;
        await DB.update(KEYS.KOSTEN, tid, { gedekt: !k.gedekt });
        await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'del-kosten') {
        const ok = await Modal.confirm({ title: 'Kostenpost verwijderen?', message: 'Deze actie kan niet ongedaan worden gemaakt.', confirmText: 'Verwijderen' });
        if (!ok) return;
        await DB.remove(KEYS.KOSTEN, tid); await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'del-notitie') {
        const ok = await Modal.confirm({ title: 'Notitie verwijderen?', message: 'Deze actie kan niet ongedaan worden gemaakt.', confirmText: 'Verwijderen' });
        if (!ok) return;
        await DB.remove(KEYS.NOTITIES, tid); await DB.touchDossier(id); renderDossierDetail({ id });
      } else if (action === 'edit-preset' || action === 'hide-preset' || action === 'show-preset') {
        const adminMode = !!Settings.get('catalog_admin_mode');
        const list = effectieveKostenPresets({ includeHidden: adminMode });
        const p = list[parseInt(btn.getAttribute('data-preset'), 10)];
        if (!p || p.nav) return;
        const cur = Object.assign({}, Settings.get('kosten_overrides') || {});
        const entry = Object.assign({}, cur[p.omschrijving] || {});
        if (action === 'edit-preset') {
          const huidig = p.bedrag != null ? (Number(p.bedrag) || 0).toFixed(2).replace('.', ',') : '';
          const input = window.prompt(
            `Nieuwe prijs voor "${p.omschrijving}" (€).\nLaat leeg en druk OK om de standaardprijs te herstellen.`,
            huidig
          );
          if (input == null) return;
          if (input.trim() === '') delete entry.bedrag;
          else {
            const bedrag = parseEUR(input);
            if (!isFinite(bedrag) || bedrag < 0) {
              Modal.show({ type: 'warning', title: 'Ongeldige prijs', message: 'Vul een geldig bedrag in (bv. 1234,56).' });
              return;
            }
            entry.bedrag = bedrag;
          }
        } else if (action === 'hide-preset') {
          const ok = await Modal.confirm({
            type: 'warning',
            title: 'Kostenpost verwijderen?',
            message: `"${p.omschrijving}" wordt definitief uit de snel-toevoeg-lijst verwijderd. Bestaande kostenposten in dit dossier blijven staan.`,
            confirmText: 'Verwijderen',
            cancelText: 'Annuleren',
          });
          if (!ok) return;
          entry.hidden = true;
        } else if (action === 'show-preset') {
          delete entry.hidden;
        }
        if (Object.keys(entry).length === 0) delete cur[p.omschrijving];
        else                                  cur[p.omschrijving] = entry;
        Settings.set({ kosten_overrides: cur });
        renderDossierDetail({ id });
        return;
      } else if (action === 'add-preset') {
        const adminMode = !!Settings.get('catalog_admin_mode');
        const list = effectieveKostenPresets({ includeHidden: adminMode });
        const p = list[parseInt(btn.getAttribute('data-preset'), 10)];
        if (!p) return;
        // Navigatie-tegels: open de juiste catalogus-pagina of focus
        // het handmatige invoer-formulier.
        if (p.nav === 'kist')    { Router.go('/kisten');  return; }
        if (p.nav === 'bloemen') { Router.go('/bloemen'); return; }
        if (p.nav === 'eten')    { Router.go('/eten');    return; }
        if (p.nav === 'extra') {
          const oms = document.querySelector('#add-kosten input[name="omschrijving"]');
          if (oms) {
            oms.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { try { oms.focus(); } catch (_) {} }, 250);
          }
          return;
        }
        // 'vraagPrijs' = richtprijs, vraag het werkelijke bedrag.
        // 'food' = aantal × prijs per stuk (totaal automatisch berekend).
        let aantalPreset = 1;
        let bedragPreset = p.bedrag;
        if (p.vraagPrijs) {
          const input = window.prompt(
            `Wat heeft "${p.omschrijving}" gekost? (richtprijs — vul het werkelijke bedrag in €)`,
            ''
          );
          if (input == null) return;
          bedragPreset = parseEUR(input);
          if (!isFinite(bedragPreset) || bedragPreset < 0) {
            Modal.show({ type: 'warning', title: 'Ongeldig bedrag', message: 'Vul een geldig bedrag in (bv. 45,00).' });
            return;
          }
        } else if (p.food) {
          const stuk = Number(p.bedrag) || 0;
          const input = window.prompt(
            `Hoeveel ${p.omschrijving}? (prijs per stuk: ${fmtEUR(stuk)})`,
            '1'
          );
          if (input == null) return;
          aantalPreset = parseInt(String(input).trim(), 10);
          if (!isFinite(aantalPreset) || aantalPreset < 1) {
            Modal.show({ type: 'warning', title: 'Ongeldig aantal', message: 'Vul een aantal in van 1 of hoger.' });
            return;
          }
          bedragPreset = +((stuk * aantalPreset).toFixed(2));
        }
        // Bestaat al een rij met dezelfde omschrijving + categorie?
        // Dan aantal ophogen en bedrag bijtellen (geen dubbele rij).
        const existing = DB.where(KEYS.KOSTEN, k =>
          k.dossier_id === id &&
          k.omschrijving === p.omschrijving &&
          (k.categorie || null) === (p.categorie || null)
        );
        if (existing.length > 0) {
          const e = existing[0];
          const newAantal = (Number(e.aantal) || 1) + aantalPreset;
          const newBedrag = +((Number(e.bedrag) || 0) + bedragPreset).toFixed(2);
          await DB.update(KEYS.KOSTEN, e.id, { aantal: newAantal, bedrag: newBedrag });
        } else {
          await DB.insert(KEYS.KOSTEN, { dossier_id: id, omschrijving: p.omschrijving, categorie: p.categorie, bedrag: bedragPreset, aantal: aantalPreset, betaald: false });
        }
        await DB.touchDossier(id); renderDossierDetail({ id });
      }
    } catch (_) {}
  };
}

// ─── Familie-portaal: tijdelijke deel-link + welkomtekst + checklist ──────
const FamiliePortaal = {
  TOKEN_LEN: 32,
  DEFAULT_DAYS: 60,

  // Cryptografisch veilige random token — base32-achtig zonder lookalikes
  generateToken() {
    const alf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // geen I/O/1/0
    const bytes = new Uint8Array(FamiliePortaal.TOKEN_LEN);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => alf[b % alf.length]).join('');
  },

  // Publieke basis-URL waar de web-app draait. In de native app is
  // location.origin een intern scheme (uitvaartbeheer://localhost), dus dan
  // gebruiken we de ingestelde/bekende publieke URL. Op het web klopt de
  // huidige oorsprong altijd.
  publicBase() {
    let base = '';
    try { base = (typeof Settings !== 'undefined' && (Settings.get('portaal_base_url') || '')) || ''; } catch (_) {}
    base = String(base).trim();
    if (!base && /^https?:$/.test(location.protocol)) {
      base = location.origin + location.pathname.replace(/[^/]*$/, ''); // map, zonder bestandsnaam
    }
    if (!base) base = 'https://uitvaartbeheer.pages.dev/';
    if (!/\/$/.test(base)) base += '/';
    return base;
  },

  buildUrl(token) {
    return `${FamiliePortaal.publicBase()}#/familie/${token}`;
  },

  // Sla de echte web-oorsprong op zodra de app in een browser wordt geopend,
  // zodat de native app (via de gedeelde cloud-instellingen) ook correcte
  // links maakt. Overschrijft alleen als er nog niets is ingesteld.
  captureWebBase() {
    try {
      if (!/^https?:$/.test(location.protocol)) return;      // niet in native app
      if (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return; // geen dev-URL
      if (typeof Settings === 'undefined') return;
      const stored = String(Settings.get('portaal_base_url') || '').trim();
      if (stored) return;                                     // al ingesteld → respecteren
      const base = location.origin + location.pathname.replace(/[^/]*$/, '');
      Settings.set({ portaal_base_url: base });
    } catch (_) {}
  },

  // Haal token voor dit dossier op uit de cloud (cache lokaal even)
  async getForDossier(dossierId) {
    const { data, error } = await sb.from('familie_portaal_tokens')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) { console.warn(error); return null; }
    return (data && data[0]) || null;
  },

  async createOrReplace(dossierId, days = FamiliePortaal.DEFAULT_DAYS) {
    // Oude tokens van dit dossier verwijderen
    await sb.from('familie_portaal_tokens').delete().eq('dossier_id', dossierId);
    const u = Auth.current();
    const token = FamiliePortaal.generateToken();
    const expires = new Date(Date.now() + days * 86400000).toISOString();
    const { data, error } = await sb.from('familie_portaal_tokens')
      .insert({ dossier_id: dossierId, token, expires_at: expires, created_by: u ? u.id : null })
      .select().single();
    if (error) throw error;
    return data;
  },

  async revoke(dossierId) {
    const { error } = await sb.from('familie_portaal_tokens').delete().eq('dossier_id', dossierId);
    if (error) throw error;
  },
};

// State per render: ingeladen token-info zodat de Familie-portaal-sectie
// async kan laden zonder de hele detail-view onhandig te maken.
const _portaalCache = new Map();

function renderFamiliePortaalSection(d) {
  const checklist = Array.isArray(d.familie_checklist) ? d.familie_checklist : [];
  const dagplan = Array.isArray(d.familie_dagplanning) ? d.familie_dagplanning : [];
  const ingesteld = checklist.length + dagplan.length;
  return `
    <section id="familie-portaal" class="card portaal-shortcut">
      <div class="portaal-shortcut-head">
        <div>
          <h2 style="border:none;padding:0;margin:0 0 .15rem;">Familie-portaal</h2>
          <p class="muted small" style="margin:0;">Deel de dagplanning en checklist met de contactpersoon via een online link — zonder inloggen, zonder gevoelige gegevens.</p>
        </div>
        <span class="muted small" id="portaal-status">…</span>
      </div>

      <div id="portaal-link-row" class="portaal-link-row" hidden style="margin-top:.75rem;">
        <input type="text" id="portaal-link" readonly>
        <button type="button" class="btn btn-sm" id="btn-portaal-copy">📋 Kopiëren</button>
        <button type="button" class="btn btn-sm btn-ghost" id="btn-portaal-open" title="Open in nieuw tabblad">↗ Open</button>
      </div>

      <div class="form-actions" style="justify-content:flex-start;gap:.5rem;flex-wrap:wrap;margin-top:.75rem;">
        <a class="btn btn-primary" href="#/portaal?dossier=${d.id}">⚙️ Portaal beheren${ingesteld ? '' : ' &amp; instellen'}</a>
      </div>
    </section>`;
}

async function bindFamiliePortaalSection(id) {
  const refreshStatus = async () => {
    const status = $('#portaal-status');
    const linkRow = $('#portaal-link-row');
    const linkInp = $('#portaal-link');
    try {
      const t = await FamiliePortaal.getForDossier(id);
      _portaalCache.set(id, t);
      if (t && new Date(t.expires_at) > new Date()) {
        if (linkInp) linkInp.value = FamiliePortaal.buildUrl(t.token);
        if (linkRow) linkRow.hidden = false;
        const daysLeft = Math.ceil((new Date(t.expires_at) - Date.now()) / 86400000);
        if (status) status.innerHTML = `<strong style="color:#2a7a3a;">actief</strong> · nog ${daysLeft} dagen`;
      } else {
        if (linkRow) linkRow.hidden = true;
        if (status) status.textContent = 'nog geen link';
      }
    } catch (_) {
      if (status) status.textContent = '(laden mislukt)';
    }
  };
  refreshStatus();

  const copyBtn = $('#btn-portaal-copy');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const link = $('#portaal-link').value;
    try {
      await navigator.clipboard.writeText(link);
      const orig = copyBtn.textContent; copyBtn.textContent = '✓ Gekopieerd';
      setTimeout(() => copyBtn.textContent = orig, 1500);
    } catch (_) {}
  });
  const openBtn = $('#btn-portaal-open');
  if (openBtn) openBtn.addEventListener('click', () => {
    const link = $('#portaal-link').value;
    if (link) window.open(link, '_blank');
  });
}

// ─── MailComposer: modal voor multi-recipient + CC + adresboek + PDF ──────
const MailComposer = {
  EMAIL_RX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Verzamel suggesties voor To/CC: contact + verzekeraar + persoonlijke
  // (Rume/Robert) + opgeslagen adresboek van dit dossier.
  collectSuggestions(d) {
    const set = new Map(); // email → label
    const add = (email, label) => {
      if (!email || !MailComposer.EMAIL_RX.test(email)) return;
      if (!set.has(email)) set.set(email, label || email);
    };
    add(d.contact_email, 'Contactpersoon');
    add(d.verzekering_contact_email || '', 'Verzekeraar');
    // adresboek per dossier
    const boek = Array.isArray(d.email_adresboek) ? d.email_adresboek : [];
    boek.forEach(item => {
      if (typeof item === 'string') add(item, 'Eerder gebruikt');
      else if (item && item.email) add(item.email, item.label || 'Eerder gebruikt');
    });
    return Array.from(set, ([email, label]) => ({ email, label }));
  },

  async open({ dossier, type, subject, body, kosten = null }) {
    const d = dossier;
    const suggesties = MailComposer.collectSuggestions(d);

    const overlay = document.createElement('div');
    overlay.className = 'mail-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'mail-title');
    overlay.innerHTML = `
      <div class="mail-backdrop"></div>
      <div class="mail-card" role="dialog" aria-modal="true" aria-labelledby="mail-title">
        <header class="mail-head">
          <h2 id="mail-title">${type === 'factuur' ? '📄 E-mail factuur' : '📋 E-mail dossier'}</h2>
          <button type="button" class="mail-close" aria-label="Sluiten">×</button>
        </header>
        <div class="mail-body">
          <p class="mail-sub muted small">Dossier <strong>${esc(d.dossier_nummer)}</strong> · ${esc(fullName(d) || '—')}</p>

          <label class="mail-field">
            <span>Aan</span>
            <div class="mail-tags" data-field="to">
              <input type="email" class="mail-tag-input" placeholder="Typ een adres en druk Enter">
            </div>
          </label>

          <label class="mail-field">
            <span>CC <span class="muted small">(elke ontvanger krijgt een aparte mail — geen echte CC-header)</span></span>
            <div class="mail-tags" data-field="cc">
              <input type="email" class="mail-tag-input" placeholder="Typ een adres en druk Enter">
            </div>
          </label>

          ${suggesties.length ? `
            <div class="mail-suggesties">
              <span class="muted small">Suggesties:</span>
              ${suggesties.map(s => `
                <span class="mail-sugg-wrap">
                  <button type="button" class="mail-sugg" data-email="${esc(s.email)}" data-target="to" title="Toevoegen aan 'Aan'">
                    + ${esc(s.email)} <span class="muted small">${esc(s.label)}</span>
                  </button>
                  <button type="button" class="mail-sugg mail-sugg-cc" data-email="${esc(s.email)}" data-target="cc" title="Toevoegen aan 'CC'">CC</button>
                </span>
              `).join('')}
            </div>` : ''}

          <label class="mail-field">
            <span>Onderwerp</span>
            <input type="text" class="mail-subject" value="${esc(subject)}">
          </label>

          <p class="muted small" style="margin:.25rem 0 0;">📎 De ${type === 'factuur' ? 'kostenraming' : 'het dossier'} wordt automatisch als PDF meegestuurd.</p>

          <div class="mail-status" hidden></div>
        </div>
        <footer class="mail-foot">
          <button type="button" class="btn btn-ghost mail-cancel">Annuleren</button>
          <button type="button" class="btn btn-primary mail-send">Verzenden ✉</button>
        </footer>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('shown'));

    // ─── Tag-input helpers ───
    const addTag = (fieldName, email) => {
      const e = String(email || '').trim().toLowerCase();
      if (!MailComposer.EMAIL_RX.test(e)) return false;
      const wrap = overlay.querySelector(`.mail-tags[data-field="${fieldName}"]`);
      if (!wrap) return false;
      // dubbele check
      const exists = Array.from(wrap.querySelectorAll('.mail-tag')).some(t => t.dataset.email === e);
      if (exists) return false;
      const input = wrap.querySelector('.mail-tag-input');
      const tag = document.createElement('span');
      tag.className = 'mail-tag';
      tag.dataset.email = e;
      tag.innerHTML = `${esc(e)}<button type="button" class="mail-tag-x" aria-label="Verwijderen">×</button>`;
      wrap.insertBefore(tag, input);
      tag.querySelector('.mail-tag-x').addEventListener('click', () => tag.remove());
      return true;
    };
    const readTags = fieldName =>
      Array.from(overlay.querySelectorAll(`.mail-tags[data-field="${fieldName}"] .mail-tag`))
        .map(t => t.dataset.email);

    // Vooraf-invullen: contact_email als 'Aan'
    if (d.contact_email && MailComposer.EMAIL_RX.test(d.contact_email)) {
      addTag('to', d.contact_email);
    }

    // Splitser: hetzelfde bij plak / Enter / blur. Splits op komma, puntkomma,
    // whitespace, of newline — zo werkt zowel "a@x.nl, b@y.nl" als één paste,
    // als één-voor-één getypt.
    const SPLIT_RX = /[,;\s]+/;
    const addManyFromText = (field, text) => {
      let added = 0;
      String(text || '').split(SPLIT_RX).forEach(piece => {
        if (piece && addTag(field, piece)) added++;
      });
      return added;
    };

    overlay.querySelectorAll('.mail-tag-input').forEach(inp => {
      const field = inp.parentElement.dataset.field;
      const tryAdd = () => {
        const added = addManyFromText(field, inp.value);
        if (added > 0) inp.value = '';
      };
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); tryAdd(); }
        if (e.key === 'Backspace' && !inp.value) {
          const lastTag = inp.parentElement.querySelector('.mail-tag:last-of-type');
          if (lastTag) lastTag.remove();
        }
      });
      inp.addEventListener('blur', tryAdd);
      // Plak van "a@x.nl, b@y.nl" → splits in losse tags
      inp.addEventListener('paste', e => {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (text && SPLIT_RX.test(text)) {
          e.preventDefault();
          addManyFromText(field, text);
          inp.value = '';
        }
      });
    });

    // Suggesties: data-target zegt waar de tag heen gaat ('to' of 'cc').
    // iPad-vriendelijk: aparte CC-knop in plaats van Shift+klik.
    overlay.querySelectorAll('.mail-sugg').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.target === 'cc' ? 'cc' : 'to';
        addTag(field, btn.dataset.email);
      });
    });

    // ─── Sluiten ───
    const close = () => {
      overlay.classList.remove('shown');
      setTimeout(() => overlay.remove(), 200);
    };
    overlay.querySelector('.mail-close').addEventListener('click', close);
    overlay.querySelector('.mail-cancel').addEventListener('click', close);
    overlay.querySelector('.mail-backdrop').addEventListener('click', close);

    // ─── Verzenden ───
    overlay.querySelector('.mail-send').addEventListener('click', async () => {
      // Forceer eventuele open tag-input naar tag
      overlay.querySelectorAll('.mail-tag-input').forEach(i => i.dispatchEvent(new Event('blur')));

      const to = readTags('to');
      const cc = readTags('cc');
      const subj = overlay.querySelector('.mail-subject').value.trim();
      const status = overlay.querySelector('.mail-status');
      const sendBtn = overlay.querySelector('.mail-send');

      if (!to.length) {
        status.hidden = false;
        status.className = 'mail-status mail-status-error';
        status.textContent = 'Vul ten minste één ontvanger in.';
        return;
      }

      sendBtn.disabled = true;
      const origLabel = sendBtn.textContent;

      try {
        // 1) PDF altijd genereren + uploaden; bijlage bovenaan in de mail
        sendBtn.textContent = 'PDF maken...';
        status.hidden = false;
        status.className = 'mail-status mail-status-info';
        status.textContent = 'PDF wordt gemaakt (~10s bij eerste keer)...';
        const ks = kosten || DB.where(KEYS.KOSTEN, k => k.dossier_id === d.id).sort((a,b)=>a.id-b.id);
        const pdfBlob = (type === 'factuur')
          ? await PdfGen.blobFromSpec(() => buildFactuurPdf(d, ks))
          : await PdfGen.blobFromSpec(dossierSpec(d, ks));
        sendBtn.textContent = 'Uploaden...';
        const up = await PdfGen.uploadAsAttachment(d.id, pdfBlob, type);
        const bijlageBox = `<p style="margin:0 0 16px;padding:11px 13px;background:#f6f4ef;border:1px solid #e5e2da;border-radius:8px;font-size:14px;">📎 <strong>Bijlage:</strong> <a href="${up.url}" style="color:#2563eb;">${type === 'factuur' ? 'Kostenraming' : 'Dossier'} ${esc(d.dossier_nummer || '')} (PDF)</a></p>`;
        let bodyMetBijlage = bijlageBox + body;
        if (cc.length) {
          bodyMetBijlage += `<p style="font-size:12px;color:#8a847b;margin-top:14px;">Deze e-mail is ook gestuurd naar: ${esc(cc.join(', '))}.</p>`;
        }

        // 2) Versturen
        sendBtn.textContent = 'Verzenden...';
        status.className = 'mail-status mail-status-info';
        status.textContent = `Versturen naar ${to.length + cc.length} ontvanger(s)...`;

        const alle = [...to, ...cc];
        if (EmailService.isConfigured()) {
          // Per ontvanger een aparte mail (EmailJS Free heeft geen native cc)
          let ok = 0, fout = [];
          for (const adres of alle) {
            try { await EmailService.send(adres, subj, bodyMetBijlage); ok++; }
            catch (e) { fout.push(`${adres}: ${(e && e.text) || e.message || String(e)}`); }
          }
          if (fout.length) {
            status.className = 'mail-status mail-status-error';
            status.textContent = `${ok} verstuurd, ${fout.length} mislukt: ${fout.join(' · ')}`;
            sendBtn.disabled = false; sendBtn.textContent = origLabel;
            return;
          }
          status.className = 'mail-status mail-status-success';
          status.textContent = `✓ ${ok} mail(s) verstuurd.`;
        } else {
          // Geen EmailJS — open mailclient met de eerste To (CC in tekst)
          openMailto(to.join(','), subj, bodyMetBijlage);
          status.className = 'mail-status mail-status-info';
          status.textContent = '✓ Mail-app geopend met tekst klaar. Klik op Verzenden in je mail-app.';
        }

        // 3) Adresboek bijwerken in Supabase (alleen nieuwe adressen)
        await MailComposer.saveToAddrBook(d, alle);

        // 4) Korte vertraging, dan sluiten
        setTimeout(close, 1500);
      } catch (e) {
        status.hidden = false;
        status.className = 'mail-status mail-status-error';
        status.textContent = e.message || String(e);
        sendBtn.disabled = false;
        sendBtn.textContent = origLabel;
      }
    });

    // Esc sluit
    // Focus-trap: Tab cyclet binnen het modal
    const trapFocus = e => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(overlay.querySelectorAll('button:not([hidden]), input, textarea, select, summary, [tabindex]:not([tabindex="-1"])'))
        .filter(el => !el.hidden && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const keyHandler = e => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', keyHandler); }
      else trapFocus(e);
    };
    document.addEventListener('keydown', keyHandler);
    // Initiële focus naar de eerste tag-input (To-veld)
    setTimeout(() => {
      const firstInput = overlay.querySelector('.mail-tag-input');
      if (firstInput) firstInput.focus();
    }, 60);
  },

  // Voeg gebruikte adressen toe aan dossier.email_adresboek (zonder dubbels)
  async saveToAddrBook(d, emails) {
    const huidig = Array.isArray(d.email_adresboek) ? d.email_adresboek : [];
    const set = new Set(huidig.map(e => typeof e === 'string' ? e : (e && e.email)).filter(Boolean));
    const nieuw = emails.filter(e => MailComposer.EMAIL_RX.test(e) && !set.has(e));
    if (!nieuw.length) return;
    const updated = [...huidig, ...nieuw];
    try {
      await DB.update(KEYS.DOSSIERS, d.id, { email_adresboek: updated });
    } catch (_) { /* niet fataal */ }
  },
};

// Minimale HTML voor dossier-PDF (mag verder uitgebreid worden)
function buildDossierDocHTML(d) {
  const s = Settings.all();
  return `
    <div class="factuur-doc">
      <div class="factuur-header">
        <div>
          <h2 style="border:none;padding:0;margin:0;font-size:1.4rem;">${esc(s.app_name)}</h2>
          <p style="margin:.15rem 0;font-size:.9rem;color:#666;">${esc(s.app_tagline)}</p>
        </div>
        <div class="factuur-meta">
          <p style="margin:0;"><strong>UITVAARTDOSSIER</strong></p>
          <p style="margin:.1rem 0;">Dossier: ${esc(d.dossier_nummer)}</p>
          <p style="margin:.1rem 0;">Datum: ${new Date().toLocaleDateString('nl-NL')}</p>
        </div>
      </div>

      <h3 style="margin-top:1rem;">Overledene</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;width:35%;color:#666;">Naam</td><td><strong>${esc(fullName(d) || '—')}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#666;">Geboortedatum</td><td>${esc(fmtDate(d.geboortedatum) || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Geboorteplaats</td><td>${esc(d.geboorteplaats || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Overlijdensdatum</td><td>${esc(fmtDate(d.overlijdensdatum) || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Overlijdensplaats</td><td>${esc(d.overlijdensplaats || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Adres</td><td>${esc([d.adres_overledene, d.postcode_overledene, d.woonplaats_overledene].filter(Boolean).join(', ') || '—')}</td></tr>
      </table>

      <h3 style="margin-top:1rem;">Contactpersoon</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;width:35%;color:#666;">Naam</td><td><strong>${esc([d.contact_voornaam, d.contact_naam].filter(Boolean).join(' ') || '—')}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#666;">Relatie</td><td>${esc(d.contact_relatie || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Telefoon</td><td>${esc(d.contact_telefoon || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">E-mail</td><td>${esc(d.contact_email || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Adres</td><td>${esc([d.contact_adres, d.contact_postcode, d.contact_woonplaats].filter(Boolean).join(', ') || '—')}</td></tr>
      </table>

      <h3 style="margin-top:1rem;">Uitvaart</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;width:35%;color:#666;">Datum</td><td>${esc(fmtDate(d.uitvaart_datum) || '—')} ${esc(d.uitvaart_tijd || '')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Type</td><td>${esc(d.uitvaart_type || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Parochie</td><td>${esc(d.parochie || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Priester</td><td>${esc(d.priester || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Kerklocatie</td><td>${esc(d.kerk_locatie || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Begraafplaats</td><td>${esc(d.begraafplaats || '—')}</td></tr>
      </table>
    </div>`;
}
