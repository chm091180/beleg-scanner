// db.js – GitHub API Datenbankzugriff

const DB = (() => {
  const FILE = 'daten.json';
  let sha = '';
  let data = [];

  function getConfig() {
    const s = JSON.parse(localStorage.getItem('awt_config') || '{}');
    return { token: s.token || '', user: s.user || '', repo: s.repo || '' };
  }

  function headers() {
    const { token } = getConfig();
    return {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  function baseUrl() {
    const { user, repo } = getConfig();
    return `https://api.github.com/repos/${user}/${repo}/contents/${FILE}`;
  }

  async function load() {
    try {
      const r = await fetch(baseUrl(), { headers: headers() });
      const json = await r.json();
      if (json.sha) {
        sha = json.sha;
        data = JSON.parse(decodeURIComponent(escape(atob(json.content.replace(/\n/g, '')))));
      } else {
        data = []; sha = '';
      }
    } catch (e) {
      data = []; sha = '';
    }
    return data;
  }

  async function save(message) {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body = { message, content };
    if (sha) body.sha = sha;
    const r = await fetch(baseUrl(), { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    const json = await r.json();
    if (json.content) sha = json.content.sha;
    return json;
  }

  async function init() {
    const cfg = getConfig();
    if (!cfg.token || !cfg.user || !cfg.repo) throw new Error('Bitte zuerst Einstellungen speichern!');
    data = []; sha = '';
    return save('Datenbank initialisiert');
  }

  function getAll() { return data; }

  function upsert(record) {
    const idx = data.findIndex(r => r.id === record.id);
    if (idx >= 0) data[idx] = record;
    else data.push(record);
  }

  function remove(id) {
    const idx = data.findIndex(r => r.id === id);
    if (idx >= 0) data.splice(idx, 1);
  }

  return { load, save, init, getAll, upsert, remove, getConfig };
})();
