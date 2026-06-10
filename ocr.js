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
    if (btn) btn.style.display = (isMobile || desktopCams.length > 1) ? 'inline-block' : 'none';
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
      lbl.textContent = '📷 ' + name + (total > 1 ? '  (' + (desktopIdxs[viewId] + 1) + '/' + total + ')' : '');
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
  function extractBelegNr(text) {
    const patterns = [
      /Beleg[-.\s]*Nr\.{2,}\s*([A-Z0-9][\w\-\/\.]+)/i,
      /Beleg[-.\s]*Nr[.\s:]+([A-Z0-9][\w\-\/\.]+)/i,
      /Beleg[-.\s]*Nr[^\n\r]{0,5}?\s+([A-Z0-9][\w\-\/\.]+)/i,
    ];
    for (const p of patterns) { const m = text.match(p); if (m && m[1]?.length >= 2) return m[1].trim(); }
    return null;
  }

  function extractAwtNr(text) {
    const patterns = [
      /AWT[-.\s]*Nr[.\s:]+([A-Z0-9][\w\-\/\.]+)/i,
      /AWT[-.\s]*Nr[^\n\r]{0,5}?\s+([A-Z0-9][\w\-\/\.]+)/i,
    ];
    for (const p of patterns) { const m = text.match(p); if (m && m[1]?.length >= 2) return m[1].trim(); }
    return null;
  }

  function extractDLAwtNr(text) {
    // Letzte nicht-leere Zeile die wie eine ID aussieht (AWT-Nummer fett unten)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^[A-Z0-9][\w\-]{3,}$/i.test(lines[i])) return lines[i];
    }
    return null;
  }

  function extractBestellNr(text) {
    const m = text.match(/\b(450\d{4,})\b/);
    return m ? m[1] : null;
  }

  function extractWagenId(text) {
    const m = text.match(/AWT[-\s]?[A-Z0-9]{3,}/i);
    return m ? m[0].replace(/\s/g, '').toUpperCase() : null;
  }

  return { start, stop, switchCam, capture, showPreview, hidePreview, recognize, extractBelegNr, extractAwtNr, extractDLAwtNr, extractBestellNr, extractWagenId };
})();
