// wagenliste.js – CSV Wagenliste laden und nachschlagen

const WagenListe = (() => {
  let liste = {}; // { barcode: bezeichnung }
  let loaded = false;

  async function load() {
    const cfg = JSON.parse(localStorage.getItem('awt_config') || '{}');
    if (!cfg.user || !cfg.repo || !cfg.token) return;
    try {
      const r = await fetch(
        `https://api.github.com/repos/${cfg.user}/${cfg.repo}/contents/inventare.csv`,
        { headers: { 'Authorization': 'token ' + cfg.token, 'Accept': 'application/vnd.github.v3+json' } }
      );
      const json = await r.json();
      if (!json.content) return;
      const csv = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
      parse(csv);
      loaded = true;
    } catch (e) {
      console.warn('Wagenliste konnte nicht geladen werden:', e);
    }
  }

  function parse(csv) {
    liste = {};
    const lines = csv.split('\n');
    if (lines.length < 2) return;

    // Header-Zeile analysieren
    const sep = lines[0].includes('\t') ? '\t' : ';';
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));

    const barcodeIdx = headers.findIndex(h => h === 'Barcode');
    const bezeichnungIdx = headers.findIndex(h => h === 'Inventar-Bezeichnung');

    if (barcodeIdx === -1 || bezeichnungIdx === -1) {
      console.warn('Spalten Barcode oder Inventar-Bezeichnung nicht gefunden');
      return;
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
      const barcode = cols[barcodeIdx];
      const bez = cols[bezeichnungIdx];
      if (barcode && bez) liste[barcode] = bez;
    }
    console.log('Wagenliste geladen:', Object.keys(liste).length, 'Einträge');
  }

  async function lookup(barcode) {
    if (!loaded) await load();
    return liste[barcode] || liste[barcode?.toUpperCase()] || null;
  }

  function isLoaded() { return loaded; }
  function getCount() { return Object.keys(liste).length; }

  return { load, lookup, isLoaded, getCount };
})();
