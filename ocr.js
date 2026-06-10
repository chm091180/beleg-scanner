// ocr.js – Kamera & Tesseract OCR

const OCR = (() => {
  let streams = {};
  let facings = {};
  let desktopCams = [];
  let desktopIdxs = {};
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  async function initDesktopCams() {
    if (!isMobile && desktopCams.length === 0) {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tmp.getTracks().forEach(t => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        desktopCams = devices.filter(d => d.kind === 'videoinput');
      } catch (e) {}
    }
  }

  async function start(viewId) {
    if (!isMobile) await initDesktopCams();
    facings[viewId] = facings[viewId] || 'environment';
    desktopIdxs[viewId] = desktopIdxs[viewId] || 0;
    await _startStream(viewId);
    const btn = document.getElementById('btn-switch-' + viewId);
    if (btn) btn.style.display = (isMobile || desktopCams.length > 1) ? 'inline-flex' : 'none';
  }

  async function _startStream(viewId) {
    if (streams[viewId]) { streams[viewId].getTracks().forEach(t => t.stop()); streams[viewId] = null; }
    let constraints;
    if (isMobile) {
      constraints = { video: { facingMode: { ideal: facings[viewId] }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false };
    } else {
      const cam = desktopCams[desktopIdxs[viewId]];
      constraints = cam
        ? { video: { deviceId: { exact: cam.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }
        : { video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false };
    }
    try {
      streams[viewId] = await navigator.mediaDevices.getUserMedia(constraints);
      document.getElementById('video-' + viewId).srcObject = streams[viewId];
      _setLabel(viewId);
    } catch (e) {
      const lbl = document.getElementById('cam-label-' + viewId);
      if (lbl) lbl.textContent = '⚠ Kamera nicht verfügbar';
    }
  }

  function _setLabel(viewId) {
    const lbl = document.getElementById('cam-label-' + viewId);
    if (!lbl) return;
    if (isMobile) {
      lbl.textContent = facings[viewId] === 'environment' ? '🔍 Rückkamera' : '🤳 Frontkamera';
    } else {
      const cam = desktopCams[desktopIdxs[viewId]];
      const name = cam ? (cam.label || ('Kamera ' + (desktopIdxs[viewId] + 1))) : 'Kamera';
      const total = desktopCams.length;
      lbl.textContent = '📷 ' + name + (total > 1 ? ' (' + (desktopIdxs[viewId] + 1) + '/' + total + ')' : '');
    }
  }

  async function switchCam(viewId) {
    if (isMobile) {
      facings[viewId] = facings[viewId] === 'environment' ? 'user' : 'environment';
    } else {
      desktopIdxs[viewId] = (desktopIdxs[viewId] + 1) % Math.max(desktopCams.length, 1);
    }
    await _startStream(viewId);
  }

  function stop(viewId) {
    if (streams[viewId]) { streams[viewId].getTracks().forEach(t => t.stop()); streams[viewId] = null; }
  }

  function capture(viewId) {
    const video = document.getElementById('video-' + viewId);
    const c = document.createElement('canvas');
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 720;
    c.getContext('2d').drawImage(video, 0, 0);
    return c.toDataURL('image/jpeg', 0.97);
  }

  function showPreview(viewId, dataUrl) {
    document.getElementById('video-' + viewId).style.display = 'none';
    const img = document.getElementById('preview-' + viewId);
    if (img) { img.src = dataUrl; img.style.display = 'block'; }
    const lbl = document.getElementById('cam-label-' + viewId);
    if (lbl) lbl.style.display = 'none';
    const snap = document.getElementById('btn-snap-' + viewId);
    if (snap) snap.style.display = 'none';
    const sw = document.getElementById('btn-switch-' + viewId);
    if (sw) sw.style.display = 'none';
    const retry = document.getElementById('btn-retry-' + viewId);
    if (retry) retry.style.display = 'inline-flex';
  }

  function hidePreview(viewId) {
    document.getElementById('video-' + viewId).style.display = 'block';
    const img = document.getElementById('preview-' + viewId);
    if (img) img.style.display = 'none';
    const lbl = document.getElementById('cam-label-' + viewId);
    if (lbl) lbl.style.display = 'block';
    const snap = document.getElementById('btn-snap-' + viewId);
    if (snap) snap.style.display = 'inline-flex';
    const sw = document.getElementById('btn-switch-' + viewId);
    if (sw) sw.style.display = (isMobile || desktopCams.length > 1) ? 'inline-flex' : 'none';
    const retry = document.getElementById('btn-retry-' + viewId);
    if (retry) retry.style.display = 'none';
  }

  async function recognize(dataUrl, spinnerId, textId, progressId) {
    const spinner = document.getElementById(spinnerId);
    if (spinner) spinner.classList.add('active');
    const result = await Tesseract.recognize(dataUrl, 'deu', {
      logger: m => {
        const txt = document.getElementById(textId);
        const prog = document.getElementById(progressId);
        if (m.status === 'recognizing text') {
          if (txt) txt.textContent = 'Text wird erkannt…';
          if (prog) prog.value = Math.round(m.progress * 100);
        } else if (m.status === 'loading tesseract core') {
          if (txt) txt.textContent = 'OCR-Engine wird geladen…';
        } else if (m.status === 'loading language traineddata') {
          if (txt) txt.textContent = 'Sprachdaten werden geladen…';
        }
      }
    });
    if (spinner) spinner.classList.remove('active');
    return result.data.text;
  }

  // ---- Extraktoren ----

  // Wagen-Barcode: 8-stellig, beginnt mit konfigurierbarem Präfix (Standard: 050)
  function extractWagenBarcode(text) {
    const cfg = JSON.parse(localStorage.getItem('awt_config') || '{}');
    const prefix = cfg.wagenPrefix || '050';
    const len = parseInt(cfg.wagenLength || '8');
    const re = new RegExp('\\b(' + prefix + '\\d{' + (len - prefix.length) + '})\\b');
    const m = text.match(re);
    return m ? m[1] : null;
  }

  // Beleg-Nr: konfigurierbare Länge und Präfix (Standard: 9-stellig, beginnt mit 498)
  function extractBelegNr(text) {
    const cfg = JSON.parse(localStorage.getItem('awt_config') || '{}');
    const prefix = cfg.belegPrefix || '498';
    const len = parseInt(cfg.belegLength || '9');
    // Zuerst nach Stichwort suchen
    const patterns = [
      /Beleg[-.\s]*Nr\.{2,}\s*([A-Z0-9][\w\-\/\.]+)/i,
      /Beleg[-.\s]*Nr[.\s:]+([A-Z0-9][\w\-\/\.]+)/i,
      /Beleg[-.\s]*Nr[^\n\r]{0,5}?\s+([A-Z0-9][\w\-\/\.]+)/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]?.length >= 2) {
        // Bereinigen: nur Ziffern wenn Präfix numerisch
        const raw = m[1].replace(/[^A-Z0-9]/gi, '');
        if (raw.startsWith(prefix) && raw.length === len) return raw;
        if (m[1].trim().length >= 2) return m[1].trim(); // fallback
      }
    }
    // Fallback: direkte Suche nach Muster im Text
    const re = new RegExp('\\b(' + prefix + '\\d{' + (len - prefix.length) + '})\\b');
    const m2 = text.match(re);
    return m2 ? m2[1] : null;
  }

  // AWT-Nr aus Kommissionierbeleg: z.B. "HA 1013" – Buchstaben + Leerzeichen + Ziffern
  function extractAwtNr(text) {
    const patterns = [
      // Stichwort "AWT-Nr:" gefolgt von Wert (mit Leerzeichen im Wert erlaubt)
      /AWT[-.\s]*Nr[.\s:]+([A-Z]{1,3}\s*\d{3,6})/i,
      /AWT[-.\s]*Nr[.\s:]+([A-Z0-9][\w\s\-\/\.]{1,15})/i,
      /AWT[-.\s]*Nr[^\n\r]{0,5}?\s+([A-Z]{1,3}\s*\d{3,6})/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]?.trim().length >= 2) return m[1].trim();
    }
    return null;
  }

  // Durchläufer-Etikett: AWT-Nr unten links, groß (z.B. "M 1043")
  // Muster: 1-3 Großbuchstaben, Leerzeichen, 3-5 Ziffern – in den letzten Zeilen
  function extractDLAwtNr(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    // Von unten suchen – AWT-Nr ist die letzte große Zeile
    for (let i = lines.length - 1; i >= 0; i--) {
      // Muster: "M 1043" oder "HA 1013" – Buchstaben + optional Leerzeichen + Ziffern
      const m = lines[i].match(/^([A-Z]{1,3}\s{0,2}\d{3,5})$/i);
      if (m) return m[1].trim();
    }
    // Breiterer Fallback: irgendwo im Text
    const m = text.match(/\b([A-Z]{1,3}\s{1,2}\d{3,5})\b/);
    return m ? m[1].trim() : null;
  }

  // Bestellnummer: konfigurierbare Länge und Präfix (Standard: 10-stellig, beginnt mit 450)
  function extractBestellNr(text) {
    const cfg = JSON.parse(localStorage.getItem('awt_config') || '{}');
    const prefix = cfg.bestellPrefix || '450';
    const len = parseInt(cfg.bestellLength || '10');
    const re = new RegExp('\\b(' + prefix + '\\d{' + (len - prefix.length) + '})\\b');
    const m = text.match(re);
    return m ? m[1] : null;
  }

  return {
    start, stop, switchCam, capture, showPreview, hidePreview, recognize,
    extractWagenBarcode, extractBelegNr, extractAwtNr,
    extractDLAwtNr, extractBestellNr
  };
})();
