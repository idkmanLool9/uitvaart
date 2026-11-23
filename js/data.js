// Constanten + catalogi gebaseerd op intake-template St. Ephrem de Syriër Klooster
// en Unigra-tarievenlijst.

const PAROCHIES = [
  'St. Ephrem de Syriër Klooster — Glane/Losser',
  'Mor Ephrem — Glanerbrug',
  'Mor Severios — Hengelo',
  'Mor Kuryakos — Enschede',
  'Mor Aday — Rijssen',
  'Sint Maria — Amsterdam',
  'Mor Gabriël — Holland',
];

// Vaste tarieven uit het intake-formulier
// Categorieën voor kostenposten — volgorde + nette labels worden gebruikt
// in het kosten-overzicht (gegroepeerd per categorie) en in de invul-dropdown.
const KOSTEN_CATEGORIEEN = [
  { id: 'aannametarief', label: 'Aanname & uitvoering', icon: '📋' },
  { id: 'vervoer',       label: 'Vervoer',              icon: '🚐' },
  { id: 'verzorging',    label: 'Verzorging',           icon: '🧴' },
  { id: 'kist',          label: 'Kist',                 icon: '⚰️' },
  { id: 'aula',          label: 'Aula',                 icon: '🏛️' },
  { id: 'kerk',          label: 'Kerk',                 icon: '✝️' },
  { id: 'begraafplaats', label: 'Begraafplaats & graf', icon: '🪦' },
  { id: 'bloemen',       label: 'Bloemen',              icon: '💐' },
  { id: 'rouwkaarten',   label: 'Rouwkaarten',          icon: '✉️' },
  { id: 'schoonmaak',    label: 'Schoonmaak',           icon: '🧹' },
  { id: 'administratie', label: 'Administratie',        icon: '📝' },
  { id: 'overig',        label: 'Overig',               icon: '•'   },
];
function categorieLabel(id) {
  const c = KOSTEN_CATEGORIEEN.find(x => x.id === id);
  return c ? c.label : (id ? (id.charAt(0).toUpperCase() + id.slice(1)) : 'Overig');
}
function categorieIcon(id) {
  const c = KOSTEN_CATEGORIEEN.find(x => x.id === id);
  return c ? c.icon : '•';
}

// Volgorde komt 1-op-1 overeen met de gewenste volgorde van de
// gebruiker. Items met een 'nav'-veld zijn navigatie-tegels die in de
// wizard naar een andere pagina linken (Kisten/Bloemen) of het formulier
// voor 'eigen invoer' openen ('extra').
const KOSTEN_PRESETS = [
  { categorie: 'aannametarief', omschrijving: 'Benodigd personeel en uitvoering',                bedrag: 622.00 },
  { categorie: 'vervoer',       omschrijving: 'Kosten ziekenhuismortuarium (Almelo / Enschede)', bedrag: 146.00 },
  { categorie: 'vervoer',       omschrijving: 'Transport overledene (0–40 km vanaf Oldenzaal)',  bedrag: 231.00 },
  { nav: 'kist',     categorie: 'kist',          omschrijving: '🪦 Kist — kies in catalogus',     bedrag: null   },
  { categorie: 'aula',          omschrijving: 'Gebruik aula 3 dagen',                            bedrag: 446.00 },
  { categorie: 'verzorging',    omschrijving: 'Verzorging & Inkisten',                           bedrag: 174.00 },
  { categorie: 'kerk',          omschrijving: 'Gebruik Kerk en Dolabani Zaal',                   bedrag: 500.00 },
  { categorie: 'begraafplaats', omschrijving: 'Openen graf',                                     bedrag: 250.00 },
  { categorie: 'begraafplaats', omschrijving: 'Naamsteen',                                       bedrag: 295.00 },
  { categorie: 'begraafplaats', omschrijving: 'Onderhoudskosten',                                bedrag: 600.00 },
  { categorie: 'begraafplaats', omschrijving: 'Algemeen graf',                                   bedrag: 1250.00 },
  { categorie: 'begraafplaats', omschrijving: 'Grafmonument verwijderen en terugplaatsen incl. tekst + foto', bedrag: 1368.00 },
  { categorie: 'begraafplaats', omschrijving: 'Graf delven',                                     bedrag: 410.00 },
  { categorie: 'kerk',          omschrijving: 'Kruis 115/25 oud messing',                        bedrag:  31.00 },
  { categorie: 'kerk',          omschrijving: 'Kruis 115/25 oud koper',                          bedrag:  31.00 },
  { categorie: 'administratie', omschrijving: 'Akte van Overlijden',                             bedrag:  17.80 },
  { nav: 'bloemen',  categorie: 'bloemen',       omschrijving: '💐 Bloemen — kies in catalogus', bedrag: null   },
  { nav: 'eten',     categorie: 'overig',        omschrijving: '🍽 Eten & drinken — kies in catalogus', bedrag: null },
  // Items met food: true vragen om een aantal bij toevoegen (totaal = aantal × prijs)
  { food: true, categorie: 'overig', omschrijving: 'Simit',                                       bedrag:   0.95 },
  { categorie: 'overig',        omschrijving: 'Papier op tafels',                                 bedrag:  60.00 },
  // vraagPrijs: bij toevoegen vraagt de app om het werkelijke bedrag
  // (richtprijs — varieert per dossier). Geen aantal-prompt.
  { vraagPrijs: true, categorie: 'overig', omschrijving: 'Koffie / thee / water',                 bedrag:   0    },
  { categorie: 'schoonmaak',    omschrijving: 'Schoonmaken Dolabani-zaal',                       bedrag: 100.00 },
  { nav: 'extra',    categorie: 'overig',        omschrijving: '＋ Extra uitgave (zelf invullen)', bedrag: null },
];

// Beheermodus-overrides: prijzen + verberg-vlag worden in Settings
// opgeslagen. Helpers passen ze toe op de "view" van de catalogus
// zonder de constante zelf te muteren — zo blijven de fabrieksprijzen
// bewaard en kan een gebruiker eenvoudig terugzetten.
function effectieveKostenPresets({ includeHidden = false } = {}) {
  const ov = (typeof Settings !== 'undefined' && Settings.get('kosten_overrides')) || {};
  return KOSTEN_PRESETS
    .filter(p => p.nav || includeHidden || !(ov[p.omschrijving] && ov[p.omschrijving].hidden))
    .map(p => {
      if (p.nav) return p;
      const o = ov[p.omschrijving];
      if (!o) return p;
      const out = Object.assign({}, p);
      if (o.bedrag != null) { out.bedrag = Number(o.bedrag); out._customBedrag = true; }
      if (o.hidden) out._hidden = true;
      return out;
    });
}
function effectieveKistenCatalogus({ includeHidden = false } = {}) {
  const ov = (typeof Settings !== 'undefined' && Settings.get('kisten_overrides')) || {};
  return KISTEN_CATALOGUS
    .filter(k => includeHidden || !(ov[k.naam] && ov[k.naam].hidden))
    .map(k => {
      const o = ov[k.naam];
      if (!o) return k;
      const out = Object.assign({}, k);
      if (o.bedrag != null) { out.bedrag = Number(o.bedrag); out._customBedrag = true; }
      if (o.hidden) out._hidden = true;
      return out;
    });
}
function vindKist(naam) {
  // Lookup-by-naam met override toegepast (ook voor verborgen kisten —
  // zodat oude dossiers nog correct hun kist-prijs vertonen).
  const ov = (typeof Settings !== 'undefined' && Settings.get('kisten_overrides')) || {};
  const k = KISTEN_CATALOGUS.find(x => x.naam === naam);
  if (!k) return null;
  const o = ov[naam];
  if (!o || o.bedrag == null) return k;
  return Object.assign({}, k, { bedrag: Number(o.bedrag), _customBedrag: true });
}

// Unigra kistencatalogus (adviesprijzen per nov 2025)
const KISTEN_CATALOGUS = [
  { naam: 'Natuurkist',                 materiaal: 'Massief populieren, natuur',  bedrag: 1054.00 },
  { naam: 'Natuurkist Wilgenteen',      materiaal: 'Massief populieren, natuur',  bedrag: 1255.50 },
  { naam: '8-10 HC8 Natuur',            materiaal: 'Massief populieren, natuur',  bedrag:  784.50 },
  { naam: '8-10 TC8 Natuur',            materiaal: 'Massief populieren, natuur',  bedrag:  838.00 },
  { naam: '1-70 HC8 Eco',               materiaal: 'Massief eiken, Eco',          bedrag: 1128.00 },
  { naam: '1-70 TC8 Eco',               materiaal: 'Massief eiken, Eco',          bedrag: 1214.00 },
  { naam: '8-10 HC8 Bloemenband',       materiaal: 'Massief populieren, natuur',  bedrag: 1025.00 },
  { naam: '8-10 HC8 Veldbloemen',       materiaal: 'Massief populieren, natuur',  bedrag: 1029.50 },
  { naam: '8-10 HC8 Rustiek',           materiaal: 'Massief populieren, rustiek', bedrag:  864.50 },
  { naam: 'Kleurplaatkist Aan de oever',materiaal: 'Massief populieren, natuur',  bedrag: 1349.50 },
  { naam: 'Kleurplaatkist Sterrenkijken met beren', materiaal: 'Massief populieren', bedrag: 1349.50 },
  { naam: 'Carino HBL2 (2x1) Eiken',    materiaal: 'Massief eiken',               bedrag: 1310.50 },
  { naam: 'Carino HBL2 (2x1) Natuur',   materiaal: 'Massief populieren, natuur',  bedrag: 1147.00 },
  { naam: 'Fiori',                      materiaal: 'Massief populieren, natuur',  bedrag: 1355.00 },
  { naam: '1-50 HBL2 (2x1) Hollands Hout', materiaal: 'Massief grenen',           bedrag: 1257.00 },
  { naam: 'Opbaarplank Hollands Hout',  materiaal: 'Massief grenen',              bedrag: 1017.50 },
  { naam: '1-70 HC8 Hollands Hout',     materiaal: 'Massief eiken',               bedrag: 1244.00 },
  { naam: 'WigRust',                    materiaal: 'Vuren',                       bedrag: 1148.00 },
  { naam: 'Linum Natuur TC8',           materiaal: 'Massief populieren, Eco',     bedrag: 1290.50 },
  { naam: 'GC Rotan Eco Rond',          materiaal: 'Rotan',                       bedrag: 1245.00 },
  { naam: 'GC Bamboe Eco Rond',         materiaal: 'Bamboe',                      bedrag: 1145.00 },
  { naam: 'GC Wilgenteen Cromer',       materiaal: 'Wilgenteen',                  bedrag: 1075.00 },
  { naam: 'UB07 Abaca',                 materiaal: 'Manillahennep',               bedrag: 1295.50 },
  { naam: 'Opbaarplank Abaca',          materiaal: 'Manillahennep',               bedrag:  956.50 },
  { naam: '1-97 HC8 Wild Eiken',        materiaal: 'Houtdecor, wild eiken',       bedrag:  715.50 },
  { naam: '1-90 HC8 Wild Eiken',        materiaal: 'Houtdecor, wild eiken',       bedrag:  579.00 },
  { naam: '1-97 HC8 Naturel',           materiaal: 'Houtdecor, naturel',          bedrag:  715.50 },
  { naam: '1-90 HC8 Naturel',           materiaal: 'Houtdecor, naturel',          bedrag:  579.00 },
  { naam: '1-97 HC8 Wit Wax',           materiaal: 'Houtdecor, wit wax',          bedrag:  715.50 },
  { naam: '1-90 HC8 Wit Wax',           materiaal: 'Houtdecor, wit wax',          bedrag:  579.00 },
  { naam: '1-97 HC8 Grijs Wax',         materiaal: 'Houtdecor, grijs wax',        bedrag:  715.50 },
  { naam: '1-90 HC8 Grijs Wax',         materiaal: 'Houtdecor, grijs wax',        bedrag:  579.00 },
  { naam: '1-20 WHC8',                  materiaal: 'Eikenprint, wit gelakt',      bedrag:  797.50 },
  { naam: '1-20 HC8 RAL',               materiaal: 'Ralkleur gelakt, zijdeglans', bedrag:  964.00 },
  { naam: '1-77 E S',                   materiaal: 'Massief eiken',               bedrag: 1445.00 },
  { naam: '1-70 E S',                   materiaal: 'Massief eiken',               bedrag: 1231.50 },
  { naam: '2-79 G S',                   materiaal: 'Massief eiken, geprofileerd', bedrag: 1615.00 },
  { naam: '2-79 G S Arti Zwart',        materiaal: 'Massief eiken, Arti zwart',   bedrag: 1967.00 },
  { naam: 'La Linea Wit',               materiaal: 'Wit gelakt, zijdeglans',      bedrag: 1895.50 },
  { naam: 'La Linea Zwart',             materiaal: 'Ralkleur gelakt, zijdeglans', bedrag: 1895.50 },
  { naam: 'T10 S',                      materiaal: 'Massief mahonie, geprofileerd', bedrag: 2349.50 },
  { naam: 'T10 S Wit',                  materiaal: 'Wit gelakt, zijdeglans',      bedrag: 2349.50 },
  { naam: 'Hudson',                     materiaal: 'Massief Hout',                bedrag: 4664.00 },
  { naam: 'Da Vinci',                   materiaal: 'Massief Hout',                bedrag: 4664.00 },
  { naam: 'Provincial',                 materiaal: 'Massief Hout',                bedrag: 4664.00 },
];

// Geef een kleur per kist-materiaal voor de preview-afbeelding
function kistKleur(materiaal) {
  const m = (materiaal || '').toLowerCase();
  if (m.includes('zwart') || m.includes('arti zwart')) return '#1f1c1a';
  if (m.includes('wit'))                                return '#ece6d6';
  if (m.includes('grijs'))                              return '#7d7872';
  if (m.includes('mahonie'))                            return '#5a2418';
  if (m.includes('rotan') || m.includes('bamboe') || m.includes('manilla') || m.includes('wilgen'))
                                                        return '#c8a268';
  if (m.includes('eiken') && m.includes('wild'))        return '#9a6a36';
  if (m.includes('eiken'))                              return '#7a4a20';
  if (m.includes('grenen') || m.includes('vuren'))      return '#d2a972';
  if (m.includes('populieren') || m.includes('eco'))    return '#dcc09a';
  if (m.includes('houtdecor'))                          return '#b88a55';
  return '#a07a4a';
}

// SVG-silhouet van een kist in de gegeven kleur (zes-zijdige top-down look)
function kistSVG(materiaal) {
  const k = kistKleur(materiaal);
  const m = (materiaal || '').toLowerCase();
  const grain = m.includes('wit') ? '#a99878' : (m.includes('zwart') ? '#3a3633' : '#00000022');
  const handle = m.includes('zwart') ? '#888' : (m.includes('wit') ? '#9a8a6a' : '#3a2a18');
  return `
    <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="kg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${k}" stop-opacity="1"/>
          <stop offset="1" stop-color="${k}" stop-opacity="0.78"/>
        </linearGradient>
        <pattern id="kgrain" patternUnits="userSpaceOnUse" width="6" height="60" patternTransform="rotate(0)">
          <rect width="6" height="60" fill="url(#kg)"/>
          <path d="M 0 12 Q 3 14 6 12 M 0 28 Q 3 30 6 28 M 0 44 Q 3 46 6 44" stroke="${grain}" stroke-width=".4" fill="none"/>
        </pattern>
      </defs>
      <!-- kist top-down met taps toelopende voetzijde -->
      <path d="M 30 35 L 95 25 L 145 25 L 210 35 L 210 95 L 145 105 L 95 105 L 30 95 Z"
            fill="url(#kgrain)" stroke="#1a120a" stroke-width="1.2"/>
      <!-- kistdeksel-rand -->
      <path d="M 30 35 L 95 25 L 145 25 L 210 35" fill="none" stroke="#00000033" stroke-width=".8"/>
      <!-- handvatten -->
      <rect x="60"  y="55" width="14" height="3" rx="1" fill="${handle}"/>
      <rect x="165" y="55" width="14" height="3" rx="1" fill="${handle}"/>
      <rect x="60"  y="74" width="14" height="3" rx="1" fill="${handle}"/>
      <rect x="165" y="74" width="14" height="3" rx="1" fill="${handle}"/>
      <!-- kruisje midden (subtiel) -->
      <g opacity=".25" fill="${handle}">
        <rect x="118" y="55" width="4" height="20" rx="1"/>
        <rect x="110" y="62" width="20" height="4" rx="1"/>
      </g>
    </svg>`;
}

// Velden die we als 'aangeraden in te vullen' beschouwen — bij opslaan
// zonder deze waardes verschijnt een waarschuwingspop-up.
const AANBEVOLEN_VELDEN = [
  { name: 'voornaam',              label: 'Voornaam overledene' },
  { name: 'achternaam',            label: 'Achternaam overledene' },
  { name: 'geboortedatum',         label: 'Geboortedatum' },
  { name: 'overlijdensdatum',      label: 'Overlijdensdatum' },
  { name: 'adres_overledene',      label: 'Adres overledene' },
  { name: 'woonplaats_overledene', label: 'Woonplaats overledene' },
  { name: 'contact_naam',          label: 'Achternaam contactpersoon' },
  { name: 'contact_telefoon',      label: 'Telefoon contactpersoon' },
  { name: 'parochie',              label: 'Parochie' },
  { name: 'uitvaart_type',         label: 'Type uitvaart' },
  { name: 'uitvaart_datum',        label: 'Datum uitvaart' },
  { name: 'kerk_locatie',          label: 'Kerk / dienstlocatie' },
  { name: 'begraafplaats',         label: 'Begraafplaats' },
];

const DOSSIER_VELDEN = [
  'voornaam','achternaam','geslacht','geboortedatum','geboorteplaats',
  'overlijdensdatum','overlijdenstijd','overlijdensplaats',
  'adres_overledene','postcode_overledene','woonplaats_overledene',
  'bsn','nationaliteit','syrisch_orthodox_lid',
  'gezinsnummer','grafnummer','certificaat_nummer','artsverklaring_pad',
  'partner_naam','kinderen_status','minderjarige_kinderen','kinderen_namen',
  'contact_naam','contact_voornaam','contact_relatie','contact_telefoon','contact_email',
  'contact_adres','contact_huisnummer','contact_postcode','contact_woonplaats',
  'contact_bsn','contact_geboortedatum',
  'parochie','priester','uitvaart_voorganger','huisbezoek_datum','huisbezoek_tijd',
  'uitvaart_type','uitvaart_datum','uitvaart_tijd','kerk_locatie',
  'begraafplaats','graf_type',
  'kist_type','rouwauto','aantal_volgauto','dragers','bloemstukken',
  'rouwkaarten_aantal','condoleance_locatie',
  'verzekering_status','verzekering_maatschappij','polisnummer',
  'verzekering_polishouder','verzekering_dekking','verzekering_pakket',
  'verzekering_aanmelding_status','verzekering_contact_naam','verzekering_contact_telefoon',
  'betaalwijze','aanbetaling_bedrag','aanbetaling_datum',
  'eindafrekening_bedrag','eindafrekening_status','betalingstermijn',
  'verantwoordelijke_persoon',
  'opdrachtgever_naam','opdrachtgever_telefoon',
  'bijzonderheden','status'
];
