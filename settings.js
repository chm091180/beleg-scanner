// settings.js – Einstellungen & Initialisierung

const Settings = (() => {
  function load() {
    const s = JSON.parse(localStorage.getItem('awt_config') || '{}');
    document.getElementById('gh-token').value     = s.token         || '';
    document.getElementById('gh-user').value      = s.user          || '';
    document.getElementById('gh-repo').value      = s.repo          || '';
    document.getElementById('wagen-prefix').value = s.wagenPrefix   || '050';
    document.getElementById('wagen-length').value = s.wagenLength   || '8';
    document.getElementById('beleg-prefix').value = s.belegPrefix   || '498';
    document.getElementById('beleg-length').value = s.belegLength   || '9';
    document.getElementById('bestell-prefix').value = s.bestellPrefix || '450';
    document.getElementById('bestell-length').value = s.bestellLength || '10';

    // Wagenliste Status
    const cnt = WagenListe.getCount();
    document.getElementById('wagen-liste-status').textContent =
      cnt > 0 ? `✅ ${cnt} Wagen geladen` : 'Noch nicht geladen';
  }

  function save() {
    const config = {
      token:         document.getElementById('gh-token').value.trim(),
      user:          document.getElementById('gh-user').value.trim(),
      repo:          document.getElementById('gh-repo').value.trim(),
      wagenPrefix:   document.getElementById('wagen-prefix').value.trim() || '050',
      wagenLength:   document.getElementById('wagen-length').value.trim() || '8',
      belegPrefix:   document.getElementById('beleg-prefix').value.trim() || '498',
      belegLength:   document.getElementById('beleg-length').value.trim() || '9',
      bestellPrefix: document.getElementById('bestell-prefix').value.trim() || '450',
      bestellLength: document.getElementById('bestell-length').value.trim() || '10',
    };
    if (!config.token || !config.user || !config.repo) {
      alert('Bitte Token, Benutzername und Repository ausfüllen!');
      return;
    }
    localStorage.setItem('awt_config', JSON.stringify(config));
    alert('✅ Einstellungen gespeichert!');
  }

  async function initDB() {
    const el = document.getElementById('init-result');
    el.textContent = 'Wird angelegt…';
    try {
      const res = await DB.init();
      if (res.content) {
        el.innerHTML = '<span style="color:green;">✅ daten.json erfolgreich angelegt!</span>';
      } else {
        el.innerHTML = '<span style="color:red;">Fehler: ' + (res.message || JSON.stringify(res)) + '</span>';
      }
    } catch (e) {
      el.innerHTML = '<span style="color:red;">Fehler: ' + e.message + '</span>';
    }
  }

  async function ladeWagenliste() {
    const el = document.getElementById('wagen-liste-status');
    el.textContent = 'Wird geladen…';
    await WagenListe.load();
    const cnt = WagenListe.getCount();
    el.textContent = cnt > 0 ? `✅ ${cnt} Wagen geladen` : '⚠ Keine Einträge gefunden – CSV prüfen';
  }

  return { load, save, initDB, ladeWagenliste };
})();
