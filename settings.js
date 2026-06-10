// settings.js – Einstellungen & Initialisierung

const Settings = (() => {
  function load() {
    const s = JSON.parse(localStorage.getItem('awt_config') || '{}');
    document.getElementById('gh-token').value = s.token || '';
    document.getElementById('gh-user').value = s.user || '';
    document.getElementById('gh-repo').value = s.repo || '';
  }

  function save() {
    const config = {
      token: document.getElementById('gh-token').value.trim(),
      user: document.getElementById('gh-user').value.trim(),
      repo: document.getElementById('gh-repo').value.trim()
    };
    if (!config.token || !config.user || !config.repo) {
      alert('Bitte alle drei Felder ausfüllen!');
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

  return { load, save, initDB };
})();
