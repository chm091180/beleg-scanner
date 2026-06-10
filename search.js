// search.js – Suche & Bearbeitung

const Search = (() => {
  let editingId = null;

  // ---- SUCHE ----
  async function doSearch() {
    const q = document.getElementById('search-input').value.trim().toLowerCase();
    await DB.load();
    renderResults(q);
  }

  function renderResults(q) {
    const el = document.getElementById('search-results');
    const all = DB.getAll();
    if (!all.length) {
      el.innerHTML = '<div class="card" style="color:#888;font-size:14px;">Keine Daten vorhanden.</div>';
      return;
    }
    const results = q ? all.filter(r =>
      r.wagenId?.toLowerCase().includes(q) ||
      r.belege?.some(b => b.belegNr?.toLowerCase().includes(q) || b.awtNr?.toLowerCase().includes(q)) ||
      r.durchlaufer?.some(d => d.awtNr?.toLowerCase().includes(q) || d.bestellNr?.toLowerCase().includes(q))
    ) : all;

    if (!results.length) {
      el.innerHTML = '<div class="card" style="color:#888;font-size:14px;">Keine Treffer.</div>';
      return;
    }

    el.innerHTML = results.slice().reverse().map(r => `
      <div class="result-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <span class="result-wagen">🚐 ${r.wagenId} ${r.wagenSplit ? `<span class="split-badge">${r.wagenSplit}</span>` : ''}</span>
          <span style="font-size:12px;color:#888;white-space:nowrap;margin-left:8px;">${r.zeitstempel}</span>
        </div>
        ${r.belege?.length ? `<div class="result-detail"><strong>Belege:</strong> ${r.belege.map(b => b.belegNr + (b.awtNr ? ' (' + b.awtNr + ')' : '')).join(', ')}</div>` : ''}
        ${r.durchlaufer?.length ? `<div class="result-detail"><strong>Durchläufer:</strong> ${r.durchlaufer.map(d => (d.awtNr || d.bestellNr) + (d.packTotal > 1 ? ' ' + d.packNr + '/' + d.packTotal : '')).join(', ')}</div>` : ''}
      </div>`).join('');
  }

  // ---- BEARBEITEN ----
  async function doEditSearch() {
    const q = document.getElementById('edit-search').value.trim().toLowerCase();
    if (!q) { document.getElementById('edit-results').innerHTML = ''; return; }
    await DB.load();
    const all = DB.getAll();
    const results = all.filter(r =>
      r.wagenId?.toLowerCase().includes(q) ||
      r.belege?.some(b => b.belegNr?.toLowerCase().includes(q))
    );
    const el = document.getElementById('edit-results');
    if (!results.length) {
      el.innerHTML = '<div style="font-size:14px;color:#888;padding:0.5rem 0;">Keine Treffer.</div>';
      return;
    }
    el.innerHTML = results.map(r => `
      <div class="result-card" onclick="Search.openEdit(${r.id})">
        <div class="result-wagen">🚐 ${r.wagenId} ${r.wagenSplit ? `<span class="split-badge">${r.wagenSplit}</span>` : ''}</div>
        <div class="result-meta">${r.zeitstempel} · ${r.belege?.length || 0} Beleg(e) · ${r.durchlaufer?.length || 0} Durchläufer</div>
      </div>`).join('');
  }

  function openEdit(id) {
    editingId = id;
    const r = DB.getAll().find(x => x.id === id);
    if (!r) return;
    document.getElementById('edit-results').innerHTML = '';
    document.getElementById('edit-search').value = '';
    document.getElementById('edit-form').style.display = 'block';
    document.getElementById('edit-form-inner').innerHTML = `
      <div class="field"><label>Wagen-ID</label><input type="text" id="edit-wagenId" value="${r.wagenId}" /></div>
      <div class="field"><label>Split (z.B. 1/2 oder leer lassen)</label><input type="text" id="edit-split" value="${r.wagenSplit || ''}" placeholder="leer = kein Split" /></div>
      <div class="field">
        <label>Belege (eine pro Zeile: BelegNr;AwtNr)</label>
        <textarea id="edit-belege" rows="4">${(r.belege || []).map(b => b.belegNr + (b.awtNr ? ';' + b.awtNr : '')).join('\n')}</textarea>
      </div>
      <div class="field">
        <label>Durchläufer (eine pro Zeile: AwtNr;BestellNr)</label>
        <textarea id="edit-dl" rows="4">${(r.durchlaufer || []).map(d => (d.awtNr || '') + ';' + (d.bestellNr || '')).join('\n')}</textarea>
      </div>`;
  }

  async function saveEdit() {
    const all = DB.getAll();
    const r = all.find(x => x.id === editingId);
    if (!r) return;
    r.wagenId = document.getElementById('edit-wagenId').value.trim().toUpperCase();
    r.wagenSplit = document.getElementById('edit-split').value.trim() || null;
    r.belege = document.getElementById('edit-belege').value.trim().split('\n').filter(l => l).map(l => {
      const [belegNr, awtNr] = l.split(';');
      return { belegNr: belegNr?.trim(), awtNr: awtNr?.trim() || '', manual: true };
    });
    r.durchlaufer = document.getElementById('edit-dl').value.trim().split('\n').filter(l => l).map((l, i, arr) => {
      const [awtNr, bestellNr] = l.split(';');
      const same = arr.filter(x => x.split(';')[0]?.trim() === awtNr?.trim());
      return { awtNr: awtNr?.trim() || '', bestellNr: bestellNr?.trim() || '', packNr: i + 1, packTotal: same.length, manual: true };
    });
    DB.upsert(r);
    await DB.save('Bearbeitet: ' + r.wagenId);
    document.getElementById('edit-form').style.display = 'none';
    alert('✅ Gespeichert!');
  }

  async function deleteRecord() {
    if (!confirm('Datensatz wirklich löschen?')) return;
    DB.remove(editingId);
    await DB.save('Datensatz gelöscht');
    document.getElementById('edit-form').style.display = 'none';
    alert('🗑 Gelöscht!');
  }

  function cancelEdit() {
    document.getElementById('edit-form').style.display = 'none';
  }

  return { doSearch, doEditSearch, openEdit, saveEdit, deleteRecord, cancelEdit };
})();
