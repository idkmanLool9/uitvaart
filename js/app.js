// Init: Supabase auth, route registratie, login form, offline-modus

// Versie-schema (semver MAJOR.MINOR.PATCH, gekoppeld aan buildnummer)
//  · APP_BUILD   — monotoon groeiend nummer, +1 bij ELKE release.
//                  Wordt gebruikt voor service-worker cache-invalidatie.
//  · APP_VERSION — semver-weergave:
//                    PATCH (laatste cijfer) — kleine UI-tweaks, bugfixes,
//                          knop toevoegen/weghalen
//                    MINOR (middelste)      — nieuwe features
//                    MAJOR (eerste)         — grote architectuur-wijziging
//                  Voorbeeld:
//                    5.5.0 → 5.5.1: knop uit topnav weggehaald
//                    5.5.1 → 5.6.0: nieuwe agenda-functie toegevoegd
//                    5.6.x → 6.0.0: totaal nieuwe layout
const APP_BUILD      = 159;
const APP_VERSION    = '5.47.0';
const APP_BUILD_DATE = '2026-07-14';

// ─── Instellingen (cloud-first, localStorage als offline-spiegel) ──────────
const Settings = {
  KEY: 'sok_settings',          // lokale spiegel (gedeelde instellingen)
  TABLE: 'app_instellingen',
  ROW_ID: 1,                    // single-row model (gedeeld door hele parochie)
  _cache: null,                 // huidige gedeelde overrides (zonder defaults)
  // Gevoelige, PER-ACCOUNT instellingen: API-sleutels e.d. Deze horen NIET in de
  // gedeelde instellingenrij (dan zou elk ander account ze zien). Ze worden
  // opgeslagen in de auth-metadata van de ingelogde gebruiker (alleen voor die
  // gebruiker leesbaar) + een per-account lokale spiegel.
  SENSITIVE: [
    'emailjs_public_key', 'emailjs_service_id', 'emailjs_template_id',
    'snelstart_actief', 'snelstart_subscription_key', 'snelstart_client_key',
  ],
  SECRET_KEY_PREFIX: 'sok_secrets_',  // + user-id = per-account lokale spiegel
  _secretCache: null,                 // per-account gevoelige overrides
  // Demo-/review-account bewaart zijn keuzes (lettertype, logo, ontwerp) hier,
  // uitsluitend lokaal op het toestel — nooit naar de cloud. Zo overleven de
  // instellingen een herstart, zonder de echte gedeelde instellingen te raken.
  DEMO_KEY: 'sok_settings_demo',
  defaults: {
    splash_enabled: true,
    splash_duration_ms: 2500,
    splash_animation: 'glass', // 'glass' | 'fade' | 'scale' | 'slide'
    splash_title: 'Welkom',
    splash_subtitle: 'Uitvaart Intake · Syrisch-Orthodoxe Kerk van Antiochië',
    splash_offline_title: 'Welkom terug',
    // Branding
    app_name: 'Uitvaart Intake',
    app_tagline: 'Syrisch-Orthodoxe Kerk van Antiochië',
    primary_color: '#2563eb',
    accent_color: '#c9a24a',
    logo_data_url: '',
    // UI
    compact_mode: false,
    rounded_cards: true,
    font_id: 'default',
    form_density: 'normaal', // 'compact' | 'normaal' | 'ruim' | 'extraruim'
    // Ontwerp-versie: 'v1' = klassieke bovenbalk-layout (standaard),
    // 'v2' = nieuwe zijbalk-layout.
    design_version: 'v1',
    // Beheermodus: knoppen 'Vervang foto' / 'Verwijder' tonen op
    // catalogi (kisten, bloemen, eten & drinken)
    catalog_admin_mode: false,
    // Per-naam overrides voor de Unigra-kistencatalogus (alleen wijzigbaar
    // in beheermodus): { 'Naam kist': { bedrag?: number, hidden?: bool } }
    kisten_overrides: {},
    // Idem voor de standaard-kostenpresets (Snel toevoegen uit lijst).
    // Sleutels = omschrijving (uitgezonderd nav-tegels Kist/Bloemen/Extra).
    kosten_overrides: {},
    // Handtekeningen-velden in het intake-formulier
    signature_fields: [
      { id: 'opdrachtgever',   label: 'Handtekening opdrachtgever',   required: true },
      { id: 'uitvaartleider',  label: 'Handtekening uitvaartleider',  required: true },
    ],
    // EmailJS-koppeling voor auto-versturen
    emailjs_public_key: '',
    emailjs_service_id: '',
    emailjs_template_id: '',
    // Push-notificaties (zie PushNotificaties + docs/push-setup.md)
    push_vapid_public_key: 'BFrHC8o3zxJ4e1qirE93vUm5wPZpEdqWIV9OwczE-Omgf3QkoM_hKFI1ZFK2Lon4f7bvwVNKQVUfOZxkFQ6nUmg',
    push_remind_days_ahead: 1,   // x dagen voor uitvaart een push sturen
    // Begraafplaats-plattegrond (PNG/JPG, getoond bovenaan begraafplaats-view)
    cemetery_map_url: '',
    // Profielkiezer ("Wie werkt vandaag?") na login tonen. Uit = meteen door
    // naar de app zonder profielkeuze.
    profielkiezer_actief: false,
    // Profielen — Wie werkt vandaag? Beheer in Account
    profielen: [
      { id: 'rume',   name: 'Rume',   color: '#6b1e2a' },
      { id: 'robert', name: 'Robert', color: '#2a5d6b' },
    ],
    // Automatisch dossier mailen naar klooster bij opslaan (leeg = uit)
    auto_send_dossier_email: 'monastery@morephrem.com',
    // E-mail-footer (handtekening onderaan elke verzonden mail)
    email_footer_enabled: true,
    email_footer_terms_url:     '',
    email_footer_privacy_url:   '',
    email_footer_facebook_url:  'https://www.facebook.com/SintEphrem/',
    email_footer_instagram_url: 'https://www.instagram.com/sint_ephrem_klooster/',
    email_footer_address: 'St. Ephrem de Syriër Klooster · Glanerbrugstr. 33, 7585 Glane/Losser',
    email_footer_phone:   '053 461 4764',
    email_footer_email:   '',
    email_footer_website: 'morephrem.com',
    // Login-scherm teksten (split-screen)
    login_brand_title: 'Welkom terug',
    login_brand_subtitle: 'Beheer dossiers, kosten, documenten en facturen — alles op één plek.',
    login_brand_features: [
      'Dossiers met kosten en notities — altijd up-to-date',
      'Facturen direct opmaken en als PDF mailen',
      'Digitale handtekeningen onder elk dossier',
      'Versleutelde sessie · automatische uitlog',
    ],
    login_brand_foot: '© Syrisch-Orthodoxe parochies',
    login_form_title: 'Inloggen',
    login_form_subtitle: 'Voer je e-mailadres en wachtwoord in om door te gaan.',
    login_secretariaat_text: 'Geen account? Vraag het secretariaat.',
    // Verzekeringsmaatschappijen (datalist in intake)
    verzekering_maatschappijen: [
      'DELA', 'Monuta', 'Yarden', 'Ardanta', 'Nuvema', 'Klooster eigen polis',
    ],
    // Pakket-uitvoeringen — per pakket optioneel een standaard-dekkingsbedrag
    // dat in het dossier-formulier automatisch wordt voorgesteld bij de
    // dekkingsbedrag-input. Voor DELA-pakketten is er een 'categorieen'-blok
    // met max-bedragen per kostencategorie; die worden automatisch gedekt
    // wanneer maatschappij = DELA én dit pakket is gekozen. De rest gaat uit
    // de Geldverzekering-bucket (geldverzekering_default of polisbedrag).
    verzekering_pakketten: [
      {
        naam: 'DELA UitvaartPlan in Diensten — externe uitvaartleider',
        verzekeraar: 'DELA',
        dekking: '3957',
        geldverzekering_default: 800,
        categorieen: {
          aannametarief: { max: 600, gedekt: true  },
          vervoer:       { max: 500, gedekt: true  },
          verzorging:    { max: 200, gedekt: true  },
          kist:          { max: 600, gedekt: true  },
          aula:          { max: 300, gedekt: true  },
          kerk:          { max:   0, gedekt: false },  // niet-DELA-locatie
          begraafplaats: { max: 800, gedekt: true  },  // alleen algemeen graf
          bloemen:       { max:   0, gedekt: false },  // via Geldverzekering
          rouwkaarten:   { max: 250, gedekt: true  },
          schoonmaak:    { max:   0, gedekt: false },
          administratie: { max:  50, gedekt: true  },
          overig:        { max: 657, gedekt: true  },
        },
        opmerking: 'Vergoeding bij niet-DELA-uitvaartleider: €3.157 dienstendeel + min. €800 Geldverzekering. Familie betaalt het verschil.',
      },
      {
        naam: 'DELA UitvaartPlan in Geld',
        verzekeraar: 'DELA',
        dekking: '',
        opmerking: 'Vrij te besteden bedrag — vul polisbedrag in als dekking.',
      },
      {
        naam: 'DELA UitvaartPlan in Diensten — DELA verzorgt zelf',
        verzekeraar: 'DELA',
        dekking: '8800',
        opmerking: 'Alleen relevant als DELA de uitvaart zelf verzorgt — zelden van toepassing in onze parochie.',
      },
      { naam: 'Standaard pakket',  dekking: '' },
      { naam: 'Uitgebreid pakket', dekking: '' },
      { naam: 'Vrije keuze',       dekking: '' },
      { naam: 'Maatwerk',          dekking: '' },
    ],
    // Parochies + bijbehorende standaard-priester (Abuna).
    // Wordt automatisch ingevuld in het intake-formulier wanneer een
    // parochie wordt gekozen.
    parochies: [
      { naam: 'St. Ephrem de Syriër Klooster — Glane/Losser', priester: '' },
      { naam: 'Mor Ephrem — Glanerbrug',                       priester: '' },
      { naam: 'Mor Severios — Hengelo',                        priester: '' },
      { naam: 'Mor Kuryakos — Enschede',                       priester: '' },
      { naam: 'Mor Aday — Rijssen',                            priester: '' },
      { naam: 'Sint Maria — Amsterdam',                        priester: '' },
      { naam: 'Mor Gabriël — Holland',                         priester: '' },
    ],
    // Defaults voor het intake-formulier (auto-ingevuld bij nieuw dossier)
    default_kerk_locatie: 'Maria kathedraal',
    default_begraafplaats: 'St. Ephrem',
    // Publieke web-URL van de app — nodig om familie-portaal-links te maken
    // die buiten de app werken. In de native app is location.origin een
    // intern scheme (uitvaartbeheer://localhost), dus daar kan het niet uit
    // afgeleid worden. Wordt automatisch ingevuld zodra de app in een browser
    // op de echte URL wordt geopend; handmatig aan te passen in Account.
    portaal_base_url: '',
    // Standaard familie-portaal-sjabloon: dagplanning + checklist die
    // automatisch verschijnen bij elk dossier (zolang er nog niets eigen is
    // opgeslagen). Blijft altijd bewerkbaar per dossier.
    portaal_default_dagplanning: [
      { tijd: '11:00', moment: 'Opbaring',                       locatie: 'Kerk' },
      { tijd: '12:45', moment: 'Balseming & Sluiten van de kist', locatie: 'Kerk' },
      { tijd: '13:00', moment: 'Start kerkdienst',               locatie: 'Kerk' },
      { tijd: '13:45', moment: 'Einde kerkdienst',               locatie: 'Kerk' },
      { tijd: '13:45', moment: 'Ter aarde brengen — begin',      locatie: 'Begraafplaats' },
      { tijd: '14:15', moment: 'Ter aarde brengen — einde',      locatie: 'Begraafplaats' },
      { tijd: '14:15', moment: 'Koffie / thee (catering)',       locatie: 'Zaal' },
    ],
    portaal_default_checklist: [
      { titel: 'ID-kaart', beschrijving: 'ID-kaart brengen / appen van overledene én contactpersoon — voor- en achterkant.' },
      { titel: 'Kleding overledene meenemen', beschrijving: 'Onderkleding, bovenkleding, eventueel schoenen, parfum, accessoires, kafan.' },
      { titel: 'Nadenken over tekst linten', beschrijving: 'Nadenken over de teksten op de linten van de bloemstukken.' },
      { titel: 'Foto meenemen', beschrijving: 'Foto meenemen van de overledene in een fotolijst.' },
      { titel: 'Nadenken over kistdragers', beschrijving: 'Nadenken over wie de kist gaat dragen (welke personen).' },
    ],
    // Factuur-bedrijfsgegevens (kop + betaalgegevens op de PDF-factuur)
    factuur_bedrijfsnaam: 'Syrisch-Orthodoxe Kerk van Antiochië',
    factuur_adres: 'Glanerbrugstraat 33\n7585 PK Glane',
    factuur_telefoon: '+31 53 461 4764',
    factuur_email: 'monastery@morephrem.com',
    factuur_iban: 'NL65 RABO 0129 6111 58',
    factuur_btw: 'NL006544137B01',
    factuur_kvk: '58679561',
    factuur_betalingstermijn_dagen: 30,
    // Oplopend factuurnummer: laatste volgnummer + toegekende nummers per
    // dossier (zodat een dossier altijd hetzelfde factuurnummer houdt).
    factuur_volgnr: 0,
    factuur_nummers: {},
    // SnelStart-koppeling (boekhouding) — sleutels invullen in Account.
    snelstart_actief: false,
    snelstart_subscription_key: '',
    snelstart_client_key: '',
  },
  // Synchrone read uit cache + lokale spiegel (gedeelde instellingen).
  // Voor het demo-account: uit de aparte, alleen-lokale demo-spiegel.
  _localOverrides() {
    if (Settings._cache) return Settings._cache;
    const key = (typeof Demo !== 'undefined' && Demo.isActive()) ? Settings.DEMO_KEY : Settings.KEY;
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) { return {}; }
  },
  // Per-account gevoelige overrides (uit cache of per-account lokale spiegel)
  _secretOverrides() {
    if (Settings._secretCache) return Settings._secretCache;
    const u = (typeof Auth !== 'undefined' && Auth.current()) || null;
    if (u && u.id) {
      try {
        const raw = localStorage.getItem(Settings.SECRET_KEY_PREFIX + u.id);
        if (raw) return JSON.parse(raw) || {};
      } catch (_) {}
    }
    return {};
  },
  // Gevoelige sleutels uit een object filteren (voor de gedeelde rij)
  _stripSensitive(obj) {
    const out = {};
    for (const k in obj) if (Settings.SENSITIVE.indexOf(k) === -1) out[k] = obj[k];
    return out;
  },
  // Defaults + gedeelde overrides + per-account gevoelige overrides
  all() {
    return Object.assign({}, Settings.defaults, Settings._localOverrides(), Settings._secretOverrides());
  },
  get(key) { return Settings.all()[key]; },

  // Synchroon: update cache + spiegels; cloud-push fire-and-forget.
  // Gevoelige sleutels gaan naar de per-account store, de rest naar de
  // gedeelde instellingenrij.
  set(patch) {
    // Demo-/review-account: alle keuzes (lettertype, logo, ontwerp, enz.) alleen
    // lokaal op het toestel bewaren zodat ze een herstart overleven — nooit naar
    // de cloud en niet in de gedeelde/gevoelige stores.
    if (typeof Demo !== 'undefined' && Demo.isActive()) {
      const next = Object.assign({}, Settings._localOverrides(), patch);
      const trimmed = {};
      for (const k in next) if (next[k] !== Settings.defaults[k]) trimmed[k] = next[k];
      Settings._cache = trimmed;
      Settings._secretCache = {};
      try { localStorage.setItem(Settings.DEMO_KEY, JSON.stringify(trimmed)); } catch (_) {}
      return;
    }

    const secretPatch = {}, sharedPatch = {};
    for (const k in patch) {
      if (Settings.SENSITIVE.indexOf(k) !== -1) secretPatch[k] = patch[k];
      else sharedPatch[k] = patch[k];
    }

    // ── Gedeelde (niet-gevoelige) instellingen ──
    if (Object.keys(sharedPatch).length) {
      const next = Object.assign({}, Settings._localOverrides(), sharedPatch);
      const trimmed = {};
      for (const k in next) {
        if (Settings.SENSITIVE.indexOf(k) !== -1) continue;           // nooit gevoelig in de gedeelde rij
        if (next[k] !== Settings.defaults[k]) trimmed[k] = next[k];
      }
      Settings._cache = trimmed;
      try { localStorage.setItem(Settings.KEY, JSON.stringify(trimmed)); } catch (_) {}
      Settings._pushCloud(trimmed);
    }

    // ── Gevoelige (per-account) instellingen ──
    if (Object.keys(secretPatch).length) {
      const next = Object.assign({}, Settings._secretOverrides(), secretPatch);
      const trimmed = {};
      for (const k in next) if (next[k] !== Settings.defaults[k]) trimmed[k] = next[k];
      Settings._secretCache = trimmed;
      Settings._persistSecrets(trimmed);
      Settings._pushSecrets(trimmed);
    }
  },

  // Per-account lokale spiegel van de gevoelige sleutels
  _persistSecrets(data) {
    const u = (typeof Auth !== 'undefined' && Auth.current()) || null;
    if (!u || !u.id) return;
    try { localStorage.setItem(Settings.SECRET_KEY_PREFIX + u.id, JSON.stringify(data)); } catch (_) {}
  },
  // Gevoelige sleutels opslaan in de auth-metadata van deze gebruiker
  _pushSecrets(data) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return;
    if (!navigator.onLine) return;
    if (!Auth.current()) return;
    sb.auth.updateUser({ data: { sok_secrets: data } })
      .then(r => { if (r.error) console.warn('Gevoelige instellingen opslaan faalde:', r.error.message); })
      .catch(err => console.warn('Gevoelige instellingen opslaan-fout:', err));
  },
  // Bij login: gevoelige sleutels uit de auth-metadata halen (bron van waarheid),
  // met de per-account lokale spiegel als terugval.
  _loadSecretsFromSession() {
    let secrets = null;
    try {
      const meta = (typeof Auth !== 'undefined' && Auth.metadata()) || {};
      if (meta.sok_secrets && typeof meta.sok_secrets === 'object') secrets = meta.sok_secrets;
    } catch (_) {}
    if (secrets) { Settings._secretCache = secrets; Settings._persistSecrets(secrets); }
    else { Settings._secretCache = Settings._secretOverrides(); }
  },

  // Geluidloos pushen naar Supabase (gedeelde instellingenrij)
  _pushCloud(data) {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return; // demo schrijft nooit gedeelde instellingen
    if (!navigator.onLine) return;
    if (!Auth.current()) return;
    sb.from(Settings.TABLE)
      .upsert({ id: Settings.ROW_ID, data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .then(r => { if (r.error) console.warn('Settings cloud-push faalde:', r.error.message); })
      .catch(err => console.warn('Settings cloud-push error:', err));
  },

  // Bij login / app-start: haal de gedeelde instellingen op
  async loadFromCloud() {
    if (!Auth.current()) return;

    // Demo-/review-account: nooit de echte gedeelde instellingen of gevoelige
    // sleutels laden. Wél de eigen, alleen-lokale demo-keuzes terughalen zodat
    // lettertype/logo/ontwerp een herstart overleven. Niets naar de cloud.
    if (typeof Demo !== 'undefined' && Demo.isActive()) {
      try { Settings._cache = JSON.parse(localStorage.getItem(Settings.DEMO_KEY) || '{}') || {}; }
      catch (_) { Settings._cache = {}; }
      Settings._secretCache = {};
      try { if (typeof FamiliePortaal !== 'undefined') FamiliePortaal.captureWebBase(); } catch (_) {}
      return;
    }

    // 1) Per-account gevoelige sleutels uit de auth-metadata van deze gebruiker
    Settings._loadSecretsFromSession();

    // 2) Gedeelde instellingen uit de cloud (nooit met gevoelige sleutels erin)
    try {
      const { data, error } = await sb.from(Settings.TABLE)
        .select('data').eq('id', Settings.ROW_ID).maybeSingle();
      if (error) throw error;
      const cloud = (data && data.data) ? data.data : null;
      if (cloud === null || Object.keys(cloud).length === 0) {
        // Cloud is nog leeg — push de lokale (niet-gevoelige) overrides
        const local = Settings._stripSensitive(Settings._localOverrides());
        if (Object.keys(local).length > 0) {
          Settings._pushCloud(local);
          Settings._cache = local;
        } else {
          Settings._cache = {};
        }
      } else {
        // Eenmalige migratie: vroeger stonden gevoelige sleutels in de gedeelde
        // rij. Neem ze (eenmalig) over in het eigen account en verwijder ze uit
        // de gedeelde rij, zodat andere accounts ze niet meer kunnen zien.
        const leaked = {};
        for (const k of Settings.SENSITIVE) if (cloud[k] !== undefined) leaked[k] = cloud[k];
        const cleaned = Settings._stripSensitive(cloud);
        Settings._cache = cleaned;
        try { localStorage.setItem(Settings.KEY, JSON.stringify(cleaned)); } catch (_) {}
        if (Object.keys(leaked).length) {
          if (Object.keys(Settings._secretOverrides()).length === 0) {
            const trimmed = {};
            for (const k in leaked) if (leaked[k] !== Settings.defaults[k]) trimmed[k] = leaked[k];
            Settings._secretCache = trimmed;
            Settings._persistSecrets(trimmed);
            Settings._pushSecrets(trimmed);
            console.info('[uitvaart] Gevoelige API-sleutels overgezet naar je eigen account.');
          }
          Settings._pushCloud(cleaned); // gevoelige sleutels uit de gedeelde rij verwijderen
        }
      }
    } catch (e) {
      // Offline of API-fout: gebruik de lokale spiegel (zonder gevoelige sleutels)
      try { Settings._cache = Settings._stripSensitive(JSON.parse(localStorage.getItem(Settings.KEY) || '{}')); }
      catch (_) { Settings._cache = {}; }
    }
    // Leg de echte web-URL vast (voor correcte familie-portaal-links in de app)
    try { if (typeof FamiliePortaal !== 'undefined') FamiliePortaal.captureWebBase(); } catch (_) {}
  },

  reset() {
    Settings._cache = {};
    localStorage.removeItem(Settings.KEY);
    Settings._pushCloud({});
  },
};

// ─── Lettertypen (curated lijst, Google Fonts gecached door SW) ─────────────
const FONTS = [
  { id: 'default',      label: 'Standaard — Georgia + systeem (klassiek + leesbaar)',
    body: '', heading: '', google: null },
  { id: 'system',       label: 'Sober — alleen systeemfonts',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    google: null },
  { id: 'inter',        label: 'Modern — Inter (strak, helder)',
    body: 'Inter, system-ui, sans-serif',
    heading: 'Inter, system-ui, sans-serif',
    google: 'family=Inter:wght@400;500;600;700' },
  { id: 'merriweather', label: 'Lezen — Merriweather (rustig, traditioneel)',
    body: 'Merriweather, Georgia, serif',
    heading: 'Merriweather, Georgia, serif',
    google: 'family=Merriweather:wght@400;700' },
  { id: 'playfair',     label: 'Plechtig — Playfair Display + Lora',
    body: 'Lora, Georgia, serif',
    heading: '"Playfair Display", Georgia, serif',
    google: 'family=Lora:wght@400;500;600&family=Playfair+Display:wght@600;700' },
  { id: 'crimson',      label: 'Literair — Crimson Pro',
    body: '"Crimson Pro", Georgia, serif',
    heading: '"Crimson Pro", Georgia, serif',
    google: 'family=Crimson+Pro:wght@400;600;700' },
  { id: 'notoserif',    label: 'Universeel — Noto Serif',
    body: '"Noto Serif", Georgia, serif',
    heading: '"Noto Serif", Georgia, serif',
    google: 'family=Noto+Serif:wght@400;600;700' },
];

function applyFont(fontId) {
  const f = FONTS.find(x => x.id === fontId) || FONTS[0];
  // Verwijder eventueel oude Google Fonts-link
  const old = document.getElementById('dynamic-font-link');
  if (old) old.remove();
  // Nieuwe Google Fonts-link injecteren als nodig
  if (f.google) {
    const link = document.createElement('link');
    link.id = 'dynamic-font-link';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${f.google}&display=swap`;
    document.head.appendChild(link);
  }
  // CSS-variabelen zetten (lege string = fallback in CSS)
  const root = document.documentElement;
  if (f.body)    root.style.setProperty('--font-body', f.body);    else root.style.removeProperty('--font-body');
  if (f.heading) root.style.setProperty('--font-heading', f.heading); else root.style.removeProperty('--font-heading');
}

// ─── Branding (logo, kleuren, app-naam, tagline) ────────────────────────────
const Branding = {
  apply() {
    const s = Settings.all();
    const root = document.documentElement;

    // Kleuren via CSS-variabelen (primary-dark/-soft worden automatisch
    // afgeleid via color-mix() in style.css)
    if (s.primary_color) root.style.setProperty('--primary', s.primary_color);
    if (s.accent_color)  root.style.setProperty('--accent',  s.accent_color);

    // Theme-color voor mobiele statusbalk
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && s.primary_color) meta.setAttribute('content', s.primary_color);

    // Tekst overal
    document.querySelectorAll('.brand-text strong').forEach(el => el.textContent = s.app_name);
    document.querySelectorAll('.brand-text small').forEach(el => el.textContent = s.app_tagline);

    // Login-scherm
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('login-app-name', s.app_name);
    setText('login-app-tagline', s.app_tagline);
    setText('login-brand-title', s.login_brand_title);
    setText('login-brand-subtitle', s.login_brand_subtitle);
    setText('login-form-title', s.login_form_title);
    setText('login-form-subtitle', s.login_form_subtitle);
    setText('login-secretariaat', s.login_secretariaat_text);
    setText('login-brand-foot', s.login_brand_foot);
    const featUl = document.getElementById('login-brand-features');
    if (featUl) {
      const items = Array.isArray(s.login_brand_features) ? s.login_brand_features : [];
      featUl.innerHTML = items.filter(Boolean).map(t => {
        const safe = String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        return `<li>${safe}</li>`;
      }).join('');
    }

    // Document-titel
    document.title = `${s.app_name} · ${s.app_tagline}`;

    // Logo: vervang ✝ door <img> als er een eigen logo is
    document.querySelectorAll('.brand-mark').forEach(el => {
      if (s.logo_data_url) {
        el.innerHTML = `<img src="${s.logo_data_url}" alt="Logo">`;
        el.classList.add('has-custom-logo');
      } else {
        el.innerHTML = '✝';
        el.classList.remove('has-custom-logo');
      }
    });

    // Compact / afgeronde hoeken
    document.body.classList.toggle('ui-compact', !!s.compact_mode);
    document.body.classList.toggle('ui-square', !s.rounded_cards);

    // Ontwerp-versie: v1 = klassieke bovenbalk (standaard), v2 = nieuwe zijbalk
    document.body.classList.toggle('design-v1', (s.design_version || 'v1') === 'v1');

    // Form-dichtheid
    document.body.classList.remove('density-compact','density-normaal','density-ruim','density-extraruim');
    document.body.classList.add('density-' + (s.form_density || 'normaal'));

    // Lettertype
    applyFont(s.font_id);

    // Favicon + PWA-icoon meekleuren met het logo
    Branding.applyFaviconAndManifest(s);
  },

  applyFaviconAndManifest(s) {
    const iconLink     = document.querySelector('link[rel="icon"]');
    const appleLink    = document.querySelector('link[rel="apple-touch-icon"]');
    const manifestLink = document.querySelector('link[rel="manifest"]');

    if (s.logo_data_url) {
      if (iconLink)  iconLink.href  = s.logo_data_url;
      if (appleLink) appleLink.href = s.logo_data_url;

      // Dynamische manifest met eigen logo + naam + kleur
      if (manifestLink) {
        const manifest = {
          name: `${s.app_name} — ${s.app_tagline}`,
          short_name: s.app_name,
          start_url: './',
          scope: './',
          display: 'standalone',
          background_color: '#f6f4ef',
          theme_color: s.primary_color,
          lang: 'nl',
          icons: [
            { src: s.logo_data_url, sizes: 'any', purpose: 'any maskable' }
          ],
        };
        // Oude blob-URL opruimen
        const old = manifestLink.dataset.dynamicHref;
        if (old) { try { URL.revokeObjectURL(old); } catch (_) {} }
        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
        const url = URL.createObjectURL(blob);
        manifestLink.href = url;
        manifestLink.dataset.dynamicHref = url;
      }
    } else {
      // Reset naar standaard
      if (iconLink)  iconLink.href  = 'icon.svg';
      if (appleLink) appleLink.href = 'icon.svg';
      if (manifestLink) {
        const old = manifestLink.dataset.dynamicHref;
        if (old) { try { URL.revokeObjectURL(old); } catch (_) {} delete manifestLink.dataset.dynamicHref; }
        manifestLink.href = 'manifest.webmanifest';
      }
    }
  },
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ─── BrandingFotos: logo-upload naar Supabase Storage (publieke bucket) ─────
const BrandingFotos = {
  async uploadLogo(file) {
    file = await compressImage(file, 800, 0.92);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `logo.${ext || 'png'}`;
    // Verwijder eerst oude logo-bestanden van andere extensies
    const exts = ['png','jpg','jpeg','svg','webp','gif'].filter(e => e !== ext);
    if (exts.length) await sb.storage.from('branding').remove(exts.map(e => `logo.${e}`)).catch(() => {});
    const { error } = await sb.storage.from('branding').upload(path, file, {
      upsert: true, cacheControl: '3600', contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = sb.storage.from('branding').getPublicUrl(path);
    return data.publicUrl + '?v=' + Date.now();
  },
  async removeLogo() {
    const exts = ['png','jpg','jpeg','svg','webp','gif'];
    await sb.storage.from('branding').remove(exts.map(e => `logo.${e}`)).catch(() => {});
  },

  // Plattegrond van de begraafplaats — getoond als visuele referentie
  async uploadCemeteryMap(file) {
    file = await compressImage(file, 2400, 0.92); // grote map mag breder
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `cemetery-map.${ext || 'png'}`;
    const exts = ['png','jpg','jpeg','svg','webp'].filter(e => e !== ext);
    if (exts.length) await sb.storage.from('branding').remove(exts.map(e => `cemetery-map.${e}`)).catch(() => {});
    const { error } = await sb.storage.from('branding').upload(path, file, {
      upsert: true, cacheControl: '3600', contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = sb.storage.from('branding').getPublicUrl(path);
    return data.publicUrl + '?v=' + Date.now();
  },
  async removeCemeteryMap() {
    const exts = ['png','jpg','jpeg','svg','webp'];
    await sb.storage.from('branding').remove(exts.map(e => `cemetery-map.${e}`)).catch(() => {});
  },
};

const Splash = {
  shownAt: Date.now(),
  dismissed: false,
  handlersBound: false,

  show(state /* 'online' | 'offline' */, opts = {}) {
    const s = Settings.all();
    const splash = document.getElementById('splash');
    if (!splash) return;

    // Animatie-klasse op de splash zetten
    splash.classList.remove('anim-glass', 'anim-fade', 'anim-scale', 'anim-slide');
    splash.classList.add('anim-' + (s.splash_animation || 'glass'));

    const onlineEl = document.getElementById('splash-online');
    const offlineEl = document.getElementById('splash-offline');
    const titleEl = document.getElementById('splash-title');
    const subEl = splash.querySelector('.splash-sub');
    const cont = document.getElementById('splash-continue');
    const hint = document.getElementById('splash-hint');

    if (subEl) subEl.textContent = s.splash_subtitle;

    onlineEl.hidden = state !== 'online';
    offlineEl.hidden = state !== 'offline';
    if (state === 'offline') {
      titleEl.textContent = s.splash_offline_title;
      cont.hidden = false;
      cont.textContent = 'Verder in leesmodus';
      hint.hidden = true;
    } else {
      titleEl.textContent = s.splash_title;
      cont.hidden = true;
      hint.hidden = false;
    }

    splash.hidden = false;
    splash.classList.remove('fading');
    Splash.shownAt = Date.now();
    Splash.dismissed = false;
    Splash.setupHandlers();
  },

  setupHandlers() {
    if (Splash.handlersBound) return;
    Splash.handlersBound = true;
    const splash = document.getElementById('splash');
    if (!splash) return;
    const dismiss = () => Splash.dismiss();
    splash.addEventListener('click', dismiss);
    document.getElementById('splash-continue').addEventListener('click', e => {
      e.stopPropagation(); dismiss();
    });
    document.addEventListener('keydown', e => {
      if (!Splash.dismissed && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) dismiss();
    });
  },

  async autoDismiss() {
    const minMs = Math.max(0, parseInt(Settings.get('splash_duration_ms'), 10) || 0);
    const elapsed = Date.now() - Splash.shownAt;
    if (elapsed < minMs) await new Promise(r => setTimeout(r, minMs - elapsed));
    Splash.dismiss();
  },

  dismiss() {
    if (Splash.dismissed) return;
    Splash.dismissed = true;
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.add('fading');
    setTimeout(() => { splash.hidden = true; }, 750);
  },

  // Voorbeeld vanuit instellingen-pagina
  preview(state) {
    Splash.show(state || (navigator.onLine ? 'online' : 'offline'));
    if (state === 'online' || (!state && navigator.onLine)) Splash.autoDismiss();
  },
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // updateViaCache:'none' zorgt dat de browser de service-worker.js
    // file zelf NOOIT uit zijn HTTP-cache haalt — anders denkt-ie soms
    // dagenlang dat er geen nieuwe versie is, ook al staat hij er.
    navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' })
      .catch(err => console.warn('Service worker registratie mislukt:', err));
  });
}

// ─── Push-notificaties (Web Push API) ───────────────────────────────────────
// Werkt op alle moderne browsers + iOS Safari 16.4+ (vereist dat de app
// 'op beginscherm' staat geïnstalleerd voor iOS).
//
// Setup-vereisten (in Supabase):
//   1. VAPID-sleutels genereren (eenmalig)
//   2. Public key in Settings → push_vapid_public_key zetten
//   3. Edge Function 'send-push' draaien die elke ochtend de
//      aankomende uitvaarten checkt en push verstuurt
// Zie docs/push-setup.md voor de complete handleiding.
const PushNotificaties = {
  STORAGE_KEY: 'sok_push_subscription_id',

  get vapidPublicKey() {
    const s = (typeof Settings !== 'undefined') ? Settings.all() : {};
    return s.push_vapid_public_key || '';
  },

  // base64-URL → Uint8Array (vereist door PushManager.subscribe)
  _urlBase64ToUint8Array(b64) {
    const padding = '='.repeat((4 - b64.length % 4) % 4);
    const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  },

  async supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window &&
           'Notification' in window;
  },

  async currentSubscription() {
    if (!await PushNotificaties.supported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  },

  async permission() {
    return Notification.permission; // 'default' | 'granted' | 'denied'
  },

  async subscribe() {
    if (!await PushNotificaties.supported()) {
      throw new Error('Deze browser ondersteunt geen push-notificaties.');
    }
    const key = PushNotificaties.vapidPublicKey;
    if (!key) {
      throw new Error('Push is nog niet ingesteld. Voer de VAPID public key in via Account → Push-notificaties.');
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      throw new Error('Toestemming voor notificaties geweigerd. Pas dit aan in de browser-instellingen.');
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: PushNotificaties._urlBase64ToUint8Array(key),
    });
    // Sla op in Supabase zodat Edge Function ons kan bereiken
    const u = Auth.current();
    const profielNaam = (typeof ActiveProfile !== 'undefined' && ActiveProfile.current())
      ? ActiveProfile.current().name : null;
    const payload = {
      user_id: u ? u.id : null,
      profiel: profielNaam,
      endpoint: sub.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
      auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
      user_agent: navigator.userAgent.slice(0, 200),
    };
    const { data, error } = await sb.from('push_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' })
      .select().single();
    if (error) throw error;
    localStorage.setItem(PushNotificaties.STORAGE_KEY, String(data.id));
    return data;
  },

  async unsubscribe() {
    const sub = await PushNotificaties.currentSubscription();
    if (sub) await sub.unsubscribe();
    const id = localStorage.getItem(PushNotificaties.STORAGE_KEY);
    if (id) {
      await sb.from('push_subscriptions').delete().eq('id', parseInt(id, 10)).catch(() => {});
      localStorage.removeItem(PushNotificaties.STORAGE_KEY);
    }
  },

  // Lokaal een test-notificatie tonen (zonder push-server)
  async testLocal() {
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return false;
    }
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Uitvaart Intake · test', {
      body: 'Push-notificaties werken op dit apparaat. Je krijgt voortaan herinneringen voor aankomende uitvaarten.',
      icon: './icon.svg',
      badge: './icon.svg',
      tag: 'sok-test',
    });
    return true;
  },
};

// ─── E-mail-service (EmailJS) ───────────────────────────────────────────────
const EmailService = {
  isConfigured() {
    const s = Settings.all();
    return !!(s.emailjs_public_key && s.emailjs_service_id && s.emailjs_template_id);
  },
  async send(toEmail, subject, message) {
    if (!EmailService.isConfigured()) throw new Error('E-mail-koppeling niet ingesteld in Account.');
    if (!window.emailjs) throw new Error('E-mail-bibliotheek niet geladen — controleer internet.');
    const s = Settings.all();
    emailjs.init({ publicKey: s.emailjs_public_key });
    return emailjs.send(s.emailjs_service_id, s.emailjs_template_id, {
      to_email: toEmail,
      subject: subject,
      message: message,
      from_name: s.app_name || 'Uitvaartleider',
      reply_to: '',
    });
  },
};

// ─── Update-check (handmatig vanuit Account) ────────────────────────────────
const Updater = {
  async check() {
    let remoteVersion = null;
    let remoteBuild = null;
    try {
      // Vraag app.js opnieuw op met cache-bypass om de versie te lezen
      const r = await fetch('./js/app.js?_check=' + Date.now(), { cache: 'no-store' });
      const text = await r.text();
      // Pak APP_BUILD (monotoon nummer) — ondubbelzinnig voor update-detectie.
      // APP_VERSION (semver) is voor weergave; voor cache-vergelijking gebruiken
      // we het buildnummer.
      const mb = text.match(/APP_BUILD\s*=\s*(\d+)/);
      const mv = text.match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/);
      if (mb) {
        remoteBuild = parseInt(mb[1], 10);
        remoteVersion = `${mv ? mv[1] : '?'} (build ${mb[1]})`;
      }
    } catch (e) {
      throw new Error('Kon servergegevens niet ophalen (offline?)');
    }

    const hasUpdate = !!(remoteBuild && remoteBuild > APP_BUILD);

    // Niet de moeite om de SW te triggeren als er sowieso geen update is
    let swReady = false;
    if (hasUpdate && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          // VOOR de update-trigger al een controllerchange-listener opzetten,
          // anders missen we de event omdat-ie direct na SKIP_WAITING vuurt
          const controllerChange = new Promise(resolve => {
            navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
          });

          await reg.update();

          // Wacht tot een eventueel installerende SW de installed-fase haalt
          if (reg.installing) {
            await new Promise(resolve => {
              const sw = reg.installing;
              const onchange = () => {
                if (sw.state === 'installed' || sw.state === 'activated' || sw.state === 'redundant') {
                  sw.removeEventListener('statechange', onchange);
                  resolve();
                }
              };
              sw.addEventListener('statechange', onchange);
              setTimeout(resolve, 5000);
            });
          }

          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            // Wacht tot de nieuwe SW de pagina overneemt vóór we returnen.
            // Race met 3s safety zodat we niet eeuwig blokkeren.
            await Promise.race([
              controllerChange,
              new Promise(resolve => setTimeout(resolve, 3000)),
            ]);
            swReady = true;
          } else if (reg.active) {
            // SW al actief en niets in waiting — niets te doen
            swReady = true;
          }
        }
      } catch (_) {}
    }

    const currentLabel = `${APP_VERSION} (build ${APP_BUILD})`;
    return {
      currentVersion: currentLabel,
      remoteVersion,
      hasUpdate,
      swUpdated: swReady,
    };
  },

  // Nucleaire reset: unregister service-worker + wis alle caches + reload.
  // Voor het geval dat de SW vast blijft zitten op een oude versie en
  // de gewone Update-knop het niet meer trekt. Verliest alleen de
  // offline-cache — dossiers staan veilig in de cloud.
  async hardReset() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) { console.warn('hardReset issue:', e); }
    // Bypass HTTP-cache met query-param + force reload
    const u = new URL(location.href);
    u.searchParams.set('_reset', Date.now());
    location.replace(u.toString());
  },

  // Reload de pagina met cache-buster. Updater.check() wacht inmiddels al
  // op controllerchange dus tegen de tijd dat dit wordt aangeroepen is
  // de nieuwe SW al in control en zal de reload verse files ophalen.
  async reloadHard() {
    const u = new URL(location.href);
    u.searchParams.set('_v', Date.now());
    location.replace(u.toString());
  },
};

function updateOfflineUI() {
  const offline = !navigator.onLine || !!Cloud.offline;
  const badge = document.getElementById('offline-badge');
  if (badge) badge.hidden = !offline;
  document.body.classList.toggle('is-offline', offline);
}
window.addEventListener('online', () => {
  updateOfflineUI();
  if (Cloud.offline && Auth.current()) {
    Cloud.loadAll().then(() => { updateOfflineUI(); Router.handle(); }).catch(() => {});
  }
});
window.addEventListener('offline', updateOfflineUI);

Router.add('/', (p, full) => renderDossierList(p, full));
Router.add('/dossiers', (p, full) => renderDossierList(p, full));
Router.add('/dossiers/nieuw', () => renderDossierForm({}));
Router.add('/dossiers/:id', p => renderDossierDetail(p));
Router.add('/dossiers/:id/bewerken', p => renderDossierForm(p));
Router.add('/dossiers/:id/factuur', p => renderFactuur(p));
Router.add('/leden', (p, full) => renderLedenList(p, full));
Router.add('/leden/nieuw', () => renderGezinForm({}));
Router.add('/leden/:id', p => renderGezinDetail(p));
Router.add('/leden/:id/bewerk', p => renderGezinForm(p));
Router.add('/begraafplaats', () => renderBegraafplaats());
Router.add('/kisten', () => renderKistenBeheer());
Router.add('/bloemen', () => renderBloemenBeheer());
Router.add('/eten', () => renderEtenBeheer());
Router.add('/portaal', (p, full) => renderPortaalBeheer(full));
Router.add('/account', () => renderAccount());
Router.add('/familie/:token', p => FamiliePortaalView.render(p.token));

(async function init() {
  // Branding meteen toepassen — vóór de splash zichtbaar wordt
  Branding.apply();

  // Versie-indicator overal injecteren
  const verLabel = `Versie ${APP_VERSION} · ${APP_BUILD_DATE}`;
  const fv = document.getElementById('footer-version');
  if (fv) fv.textContent = ' · ' + verLabel;
  const sv = document.getElementById('splash-version');
  if (sv) sv.textContent = verLabel;

  // Welkomscherm meteen tonen op basis van verbinding (tenzij uitgezet)
  const splashOn = Settings.get('splash_enabled');
  if (splashOn) {
    Splash.show(navigator.onLine ? 'online' : 'offline');
  } else {
    document.getElementById('splash').hidden = true;
    Splash.dismissed = true;
  }

  const sess = await Auth.init();
  if (sess) {
    try { await Cloud.loadAll(); }
    catch (e) { console.warn('Laden mislukt:', e.message || e); }
    // Instellingen uit de cloud halen en branding opnieuw toepassen
    try {
      await Settings.loadFromCloud();
      Branding.apply();
    } catch (e) { console.warn('Settings laden faalde:', e.message || e); }
  }
  updateOfflineUI();

  // Auto-keepalive: voorkomt dat het gratis Supabase-project pauzeert
  // bij inactiviteit. Doet elke 5+ dagen een mini-query.
  try {
    const lastPing = parseInt(localStorage.getItem('sok_last_ping') || '0', 10);
    const ageMs = Date.now() - lastPing;
    if (sess && navigator.onLine && ageMs > 5 * 24 * 3600 * 1000) {
      sb.from('app_instellingen').select('id').limit(1)
        .then(() => localStorage.setItem('sok_last_ping', String(Date.now())))
        .catch(() => {});
    }
  } catch (_) {}

  // Online: automatisch wegfaden na de ingestelde duur.
  // Offline: blijft staan tot de gebruiker op "Verder" klikt.
  if (splashOn && navigator.onLine && !Cloud.offline) {
    Splash.autoDismiss();
  }

  const clearBtn = document.getElementById('login-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      const errEl = document.getElementById('login-error');
      if (errEl) errEl.hidden = true;
      document.getElementById('login-username').focus();
    });
  }

  const forgot = document.getElementById('login-forgot');
  if (forgot) {
    forgot.addEventListener('click', async e => {
      e.preventDefault();
      const def = document.getElementById('login-username').value.trim();
      const email = prompt('Vul je e-mailadres in om een herstel-link te ontvangen:', def);
      if (!email) return;
      try {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: location.origin + location.pathname,
        });
        if (error) throw error;
        Modal.show({ type: 'success', title: 'Herstel-link verstuurd',
          message: `We hebben een wachtwoord-herstel-link gestuurd naar ${email}. Check je inbox (en spam-map).` });
      } catch (err) {
        Modal.show({ type: 'error', title: 'Verzenden mislukt',
          message: err.message || String(err) });
      }
    });
  }

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-username').value.trim();
    const pw = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.hidden = true;
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Bezig met inloggen...';
    const err = await Auth.login(email, pw);
    btn.disabled = false; btn.textContent = 'Inloggen';
    if (err) {
      errEl.textContent = (err.toLowerCase().includes('invalid') || err.toLowerCase().includes('credentials'))
        ? 'Onjuist e-mailadres of wachtwoord.' : err;
      errEl.hidden = false;
      return;
    }
    document.getElementById('login-password').value = '';
    try { await Cloud.loadAll(); } catch (e2) { Modal.show({ type: 'error', title: 'Laden mislukt', message: e2.message || String(e2) }); }
    try { await Settings.loadFromCloud(); Branding.apply(); } catch (_) {}
    updateOfflineUI();
    if (!location.hash || location.hash === '#/login') location.hash = '#/';
    Router.handle();
  });

  const doLogout = async () => {
    await Auth.logout();
    cleanSessionStorage();
    location.hash = '';
    Router.handle();
  };
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  const btnLogoutSide = document.getElementById('btn-logout-side');
  if (btnLogoutSide) btnLogoutSide.addEventListener('click', doLogout);

  // ─── Profielkeuze: Rume of Robert ────────────────────────────
  function cleanSessionStorage() {
    ActiveProfile.clear();
    Cloud.cache = { dossiers: [], kosten: [], notities: [], kist_afbeeldingen: [], bloemen_catalogus: [], eten_drinken_catalogus: [], gezinnen: [], leden: [] };
    Cloud.loaded = false;
    // Sessie-specifieke localStorage opruimen — voorkomt dat de volgende
    // gebruiker op een gedeelde iPad de cache/voorkeuren van de vorige ziet
    // Gevoelige per-account instellingen uit het geheugen halen zodat het
    // volgende account op dit toestel ze niet ziet (opnieuw geladen bij login).
    Settings._secretCache = null;
    try {
      const sessieKeys = ['sok_mirror', 'sok_kosten_collapsed', 'sok_last_ping', 'sok_id_show_color'];
      sessieKeys.forEach(k => localStorage.removeItem(k));
      // Alle draft-keys (per-dossier intake-formulier autosave) én de
      // per-account gevoelige spiegels (sok_secrets_<id>) ook weg
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sok_draft_') || k.startsWith('sok_wizard_step_') || k.startsWith('sok_wizard_max_') || k.startsWith(Settings.SECRET_KEY_PREFIX))) localStorage.removeItem(k);
      }
    } catch (_) {}
  }

  // Event delegation — profielknoppen worden dynamisch gerenderd per opening
  document.getElementById('profile-screen').addEventListener('click', e => {
    const btn = e.target.closest('.profile-option[data-profile]');
    if (!btn) return;
    const id = btn.getAttribute('data-profile');
    ActiveProfile.set(id);
    Router.handle();
  });
  document.getElementById('profile-logout').addEventListener('click', async () => {
    await Auth.logout();
    cleanSessionStorage();
    location.hash = '';
    Router.handle();
  });
  // Klik op de chip in de topbar → terug naar profielkeuze
  document.getElementById('btn-active-profile').addEventListener('click', () => {
    ActiveProfile.clear();
    Router.handle();
  });

  Router.start();
})();
