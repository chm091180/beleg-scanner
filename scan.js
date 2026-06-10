// scan.js – Scan-Workflow (Schritt 1–4)

const Scan = (() => {
  let state = { wagenId: '', belege: [], durchlaufer: [] };

  function init() {
    OCR.start('wagen');
  }

  // ---- Helpers ----
  function showAlert(type, msg) {
    const el = document.getElementById('alert-scan');
    el.className = 'alert alert-' + type + ' show';
    el.textContent = msg;
    setTimeout(() => el.classList.remove('show'), 5000);
  }

  function clearAlert() {
    document.getElementById('alert-scan').classList.remove('show');
  }

  function setStep(n) {
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById('step' + i);
      el.classList.remove('active', 'done');
      if (i < n) el.classList.add('done');
      else if (i === n) el.classList.add('active');
    }
  }

  function wagenHeaderHTML(id) {
    return `<div class="wagen-id">🚐 ${id}</div><div class="wagen-sub">Aktiver Wagen</div>`;
  }

  function showView(n) {
    [1, 2, 3, 4].forEach(i => {
      const el = document.getElementById('view-step' + i);
      if (el) el.style.display = i === n ? 'block' : 'none';
    });
    setStep(n);
  }

  // ---- STEP 1: WAGEN ----
  async function snapWagen() {
    const dataUrl = OCR.capture('wagen');
    OCR.showPreview('wagen', dataUrl);
    const text = await OCR.recognize(dataUrl, 'spinner-wagen', 'spinner-wagen-text', 'prog-wagen');
    const id = OCR.extractWagenId(text);
    if (id) {
      document.getElementById('manual-wagen').value = id;
      clearAlert();
    } else {
      showAlert('warning', '⚠ Wagen-ID nicht erkannt – bitte manuell eingeben.');
    }
  }

  function retryWagen() {
    OCR.hidePreview('wagen');
    document.getElementById('manual-wagen').value = '';
  }

  function confirmWagen() {
    const id = document.getElementById('manual-wagen').value.trim().toUpperCase();
    if (!id) { showAlert('danger', 'Bitte Wagen-ID eingeben!'); return; }
    state.wagenId = id;
    state.belege = [];
    state.durchlaufer = [];
    OCR.stop('wagen');
    showView(2);
    document.getElementById('wagen-header-2').innerHTML = wagenHeaderHTML(id);
    document.getElementById('beleg-list-card').style.display = 'none';
    document.getElementById('beleg-list').innerHTML = '';
    OCR.start('beleg');
    clearAlert();
  }

  // ---- STEP 2: BELEGE ----
  async function snapBeleg() {
    const dataUrl = OCR.capture('beleg');
    OCR.showPreview('beleg', dataUrl);
    const text = await OCR.recognize(dataUrl, 'spinner-beleg', 'spinner-beleg-text', 'prog-beleg');
    const belegNr = OCR.extractBelegNr(text);
    const awtNr = OCR.extractAwtNr(text);
    if (belegNr) {
      addBeleg(belegNr, awtNr || '', false);
      OCR.hidePreview('beleg');
      clearAlert();
    } else {
      showAlert('warning', '⚠ Beleg-Nr. nicht erkannt – bitte manuell eingeben oder neu scannen.');
    }
  }

  function retryBeleg() { OCR.hidePreview('beleg'); }

  function addBeleg(belegNr, awtNr, manual) {
    if (!belegNr) return;
    if (awtNr && state.belege.length > 0) {
      const existing = state.belege.find(b => b.awtNr);
      if (existing?.awtNr && awtNr.slice(0, -1) !== existing.awtNr.slice(0, -1)) {
        showAlert('warning', '⚠ AWT-Nr. weicht stark ab (nicht nur letzte Stelle)!');
      }
    }
    state.belege.push({ belegNr, awtNr, manual });
    renderBelegList();
  }

  function addBelegManual() {
    const nr = document.getElementById('manual-beleg-nr').value.trim();
    const awt = document.getElementById('manual-beleg-awt').value.trim();
    if (!nr) { showAlert('danger', 'Bitte Beleg-Nr. eingeben!'); return; }
    addBeleg(nr, awt, true);
    document.getElementById('manual-beleg-nr').value = '';
    document.getElementById('manual-beleg-awt').value = '';
    clearAlert();
  }

  function removeBeleg(i) { state.belege.splice(i, 1); renderBelegList(); }

  function renderBelegList() {
    const list = document.getElementById('beleg-list');
    const card = document.getElementById('beleg-list-card');
    if (state.belege.length === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    list.innerHTML = state.belege.map((b, i) => `
      <li>
        <div>
          <div class="item-label">${b.belegNr}${b.manual ? '<span class="manual-tag">manuell</span>' : ''}</div>
          ${b.awtNr ? `<div class="item-sub">AWT-Nr: ${b.awtNr}</div>` : ''}
        </div>
        <button class="item-remove" onclick="Scan.removeBeleg(${i})">✕</button>
      </li>`).join('');
  }

  function goStep3() {
    OCR.stop('beleg');
    showView(3);
    document.getElementById('wagen-header-3').innerHTML = wagenHeaderHTML(state.wagenId);
    document.getElementById('dl-list-card').style.display = 'none';
    document.getElementById('dl-list').innerHTML = '';
    OCR.start('dl');
  }

  // ---- STEP 3: DURCHLÄUFER ----
  async function snapDL() {
    const dataUrl = OCR.capture('dl');
    OCR.showPreview('dl', dataUrl);
    const text = await OCR.recognize(dataUrl, 'spinner-dl', 'spinner-dl-text', 'prog-dl');
    const awtNr = OCR.extractDLAwtNr(text);
    const bestellNr = OCR.extractBestellNr(text);
    if (awtNr || bestellNr) {
      addDL(awtNr || '', bestellNr || '', false);
      OCR.hidePreview('dl');
      clearAlert();
    } else {
      showAlert('warning', '⚠ Kein Text erkannt – bitte manuell eingeben oder neu scannen.');
    }
  }

  function retryDL() { OCR.hidePreview('dl'); }

  function addDL(awtNr, bestellNr, manual) {
    if (!awtNr && !bestellNr) return;
    const sameAwtCount = state.durchlaufer.filter(d => d.awtNr === awtNr && awtNr).length;
    const packNr = sameAwtCount + 1;
    state.durchlaufer.push({ awtNr, bestellNr, packNr, packTotal: packNr, manual });
    // Alle mit gleicher awtNr aktualisieren
    const total = state.durchlaufer.filter(d => d.awtNr === awtNr && awtNr).length;
    state.durchlaufer.forEach(d => { if (d.awtNr === awtNr && awtNr) d.packTotal = total; });
    renderDLList();
  }

  function addDLManual() {
    const awt = document.getElementById('manual-dl-awt').value.trim();
    const best = document.getElementById('manual-dl-best').value.trim();
    if (!awt && !best) { showAlert('danger', 'Bitte mindestens eine Nummer eingeben!'); return; }
    addDL(awt, best, true);
    document.getElementById('manual-dl-awt').value = '';
    document.getElementById('manual-dl-best').value = '';
    clearAlert();
  }

  function removeDL(i) {
    const removed = state.durchlaufer.splice(i, 1)[0];
    let cnt = 0;
    const total = state.durchlaufer.filter(d => d.awtNr === removed.awtNr && removed.awtNr).length;
    state.durchlaufer.forEach(d => { if (d.awtNr === removed.awtNr && removed.awtNr) { cnt++; d.packNr = cnt; d.packTotal = total; } });
    renderDLList();
  }

  function renderDLList() {
    const list = document.getElementById('dl-list');
    const card = document.getElementById('dl-list-card');
    if (state.durchlaufer.length === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    list.innerHTML = state.durchlaufer.map((d, i) => `
      <li>
        <div>
          <div class="item-label">${d.awtNr || d.bestellNr}${d.manual ? '<span class="manual-tag">manuell</span>' : ''}
            ${d.packTotal > 1 ? `<span class="split-badge">${d.packNr}/${d.packTotal}</span>` : ''}
          </div>
          ${d.awtNr && d.bestellNr ? `<div class="item-sub">Bestellnr: ${d.bestellNr}</div>` : ''}
          ${!d.awtNr && d.bestellNr ? `<div class="item-sub">Bestellnr: ${d.bestellNr}</div>` : ''}
        </div>
        <button class="item-remove" onclick="Scan.removeDL(${i})">✕</button>
      </li>`).join('');
  }

  // ---- STEP 4: ABSCHLUSS ----
  async function finish() {
    OCR.stop('dl');
    const cfg = DB.getConfig();
    if (!cfg.token) {
      showAlert('danger', '⚠ Kein GitHub Token! Bitte zuerst Einstellungen ausfüllen.');
      return;
    }

    showView(4);
    document.getElementById('summary-spinner').style.display = 'flex';
    document.getElementById('summary-content').style.display = 'none';

    await DB.load();
    const allData = DB.getAll();
    const now = new Date().toLocaleString('de-DE');

    // Split-Logik
    state.belege.forEach(b => {
      const prev = allData.find(r => r.belege?.find(x => x.belegNr === b.belegNr));
      if (prev) {
        prev.wagenSplit = '1/2';
        b._split = '2/2';
        DB.upsert(prev);
      }
    });

    const record = {
      id: Date.now(),
      wagenId: state.wagenId,
      zeitstempel: now,
      belege: state.belege,
      durchlaufer: state.durchlaufer,
      wagenSplit: state.belege.find(b => b._split)?.['_split'] || null
    };

    DB.upsert(record);
    await DB.save(`Wagen ${state.wagenId} – ${now}`);

    document.getElementById('summary-spinner').style.display = 'none';
    document.getElementById('summary-content').style.display = 'block';
    document.getElementById('summary-text').textContent =
      `Wagen: ${state.wagenId} | ${state.belege.length} Beleg(e) | ${state.durchlaufer.length} Durchläufer`;
  }

  function reset() {
    state = { wagenId: '', belege: [], durchlaufer: [] };
    document.getElementById('manual-wagen').value = '';
    OCR.hidePreview('wagen');
    showView(1);
    OCR.start('wagen');
  }

  return {
    init, snapWagen, retryWagen, confirmWagen,
    snapBeleg, retryBeleg, addBelegManual, removeBeleg, goStep3,
    snapDL, retryDL, addDLManual, removeDL, finish, reset
  };
})();
