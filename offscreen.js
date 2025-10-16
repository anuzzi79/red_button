// offscreen.js
// Gestisce il timer a 100ms e lo stato della sessione.
// Mantiene: running (play/stop), active (bottone rosso acceso), elapsedMs, segments (intervalli rossi).

const TICK_MS = 100;

const state = {
  running: false,      // Play/Stop della timeline tracking
  active: false,       // Bottone rosso lampeggiante ON/OFF
  elapsedMs: 0,        // Tempo totale "interno" (continua sempre per il ruler)
  lastTickWall: null,  // Per calcolare delta tra tick
  segments: [],        // Array di { startMs, endMs } per i periodi attivi (rossi)
  redPeriods: [],      // Array di { startMs, endMs } per i periodi in cui il bottone rosso è stato attivo
  sessionStartTime: null,  // Timestamp reale di inizio sessione (per calcolare l'orario reale)
  sessionPeriods: [],  // Array di { startMs, endMs } per i periodi di sessione attiva (verdi)
  trackingStartTime: null,  // Timestamp quando inizia il tracking (per calcolare il tempo relativo di tracciamento)
  simulatedBaseTime: null,  // Timestamp base del tempo simulato
  simulatedStartTime: null  // Timestamp di inizio del tempo simulato
};

let intervalId = null;

// Funzione per ottenere il tempo corrente (reale o simulato)
function getCurrentTime() {
  if (state.simulatedStartTime && state.simulatedBaseTime) {
    const elapsed = Date.now() - state.simulatedStartTime;
    return new Date(state.simulatedBaseTime.getTime() + elapsed);
  }
  return new Date();
}

function startInterval() {
  if (intervalId) return;
  state.lastTickWall = performance.now();
  intervalId = setInterval(() => {
    const now = performance.now();
    const delta = now - state.lastTickWall;
    state.lastTickWall = now;

    // Il tempo continua sempre (per il ruler)
    state.elapsedMs += delta;

    // Solo se running=true, aggiorna il tracking
    if (state.running) {
      if (state.active) {
        const last = state.segments[state.segments.length - 1];
        if (last && last.endMs == null) {
          last.endMs = state.elapsedMs; // provvisorio, sarà riscritto al prossimo tick
        }
      }
    }

    // Notifica i client (timeline) - sempre, per aggiornare il ruler
    chrome.runtime.sendMessage({ target: 'timeline', type: 'tick', payload: getPublicState() }).catch(() => {});
  }, TICK_MS);
}

function stopInterval() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  state.lastTickWall = null;
}

function getPublicState() {
  // Copia "sanificata" per UI
  return {
    running: state.running,
    active: state.active,
    elapsedMs: Math.floor(state.elapsedMs),
    segments: state.segments.map(s => ({ startMs: s.startMs, endMs: s.endMs ?? state.elapsedMs })),
    redPeriods: state.redPeriods.map(p => ({ startMs: p.startMs, endMs: p.endMs ?? state.elapsedMs })),
    sessionStartTime: state.sessionStartTime,
    sessionPeriods: state.sessionPeriods.map(p => ({ startMs: p.startMs, endMs: p.endMs ?? state.elapsedMs })),
    trackingStartTime: state.trackingStartTime
  };
}

function play() {
  if (!state.running) {
    // Se è la prima volta che si avvia, salva il timestamp di inizio sessione
    if (state.sessionStartTime === null) {
      state.sessionStartTime = getCurrentTime().getTime();
    }
    state.running = true;
    // Salva quando inizia il tracking per questo periodo
    state.trackingStartTime = state.elapsedMs;
    // Inizia un nuovo periodo di sessione
    state.sessionPeriods.push({ startMs: state.elapsedMs, endMs: null });
    chrome.runtime.sendMessage({ target: 'timeline', type: 'state', payload: getPublicState() }).catch(() => {});
  }
}

function stop() {
  if (state.running) {
    state.running = false;
    // Chiudi eventuale segmento e periodo rosso aperti
    if (state.active) {
      const last = state.segments[state.segments.length - 1];
      if (last && last.endMs == null) last.endMs = state.elapsedMs;
      
      const lastRedPeriod = state.redPeriods[state.redPeriods.length - 1];
      if (lastRedPeriod && lastRedPeriod.endMs == null) lastRedPeriod.endMs = state.elapsedMs;
    }
    // Chiudi il periodo di sessione corrente
    const lastSessionPeriod = state.sessionPeriods[state.sessionPeriods.length - 1];
    if (lastSessionPeriod && lastSessionPeriod.endMs == null) {
      lastSessionPeriod.endMs = state.elapsedMs;
    }
    // Reset del tracking start time
    state.trackingStartTime = null;
    chrome.runtime.sendMessage({ target: 'timeline', type: 'state', payload: getPublicState() }).catch(() => {});
  }
}

function toggleActive() {
  // Se timeline non è in play, accendiamo il play automaticamente
  if (!state.running) {
    play(); // Questo inizializzerà sessionStartTime se necessario
  }

  if (!state.active) {
    // accendi bottone rosso → apri nuovo segmento rosso e nuovo periodo rosso
    state.active = true;
    state.segments.push({ startMs: state.elapsedMs, endMs: null });
    state.redPeriods.push({ startMs: state.elapsedMs, endMs: null });
  } else {
    // spegni bottone rosso → chiudi segmento e periodo rosso
    state.active = false;
    const last = state.segments[state.segments.length - 1];
    if (last && last.endMs == null) last.endMs = state.elapsedMs;
    
    const lastRedPeriod = state.redPeriods[state.redPeriods.length - 1];
    if (lastRedPeriod && lastRedPeriod.endMs == null) lastRedPeriod.endMs = state.elapsedMs;
  }
  chrome.runtime.sendMessage({ target: 'timeline', type: 'state', payload: getPublicState() }).catch(() => {});
}

// Avvio immediato: timer parte sempre per il ruler
startInterval(); // crea l'intervallo; running=false controlla solo il tracking

// Inizializza il timestamp di sessione se non è già stato fatto
if (state.sessionStartTime === null) {
  state.sessionStartTime = getCurrentTime().getTime();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return;
  if (msg.type === 'play') {
    play();
    sendResponse?.({ ok: true });
  } else if (msg.type === 'stop') {
    stop();
    sendResponse?.({ ok: true });
  } else if (msg.type === 'toggle_active') {
    toggleActive();
    sendResponse?.({ ok: true });
  } else if (msg.type === 'get_state') {
    chrome.runtime.sendMessage({ target: 'timeline', type: 'state', payload: getPublicState() }).catch(() => {});
    sendResponse?.({ ok: true });
  } else if (msg.type === 'set_simulated_time') {
    state.simulatedBaseTime = new Date(msg.payload.simulatedBaseTime);
    state.simulatedStartTime = msg.payload.simulatedStartTime;
    
    // Aggiorna il sessionStartTime per riflettere il nuovo tempo simulato
    // Il sessionStartTime deve essere impostato al tempo simulato corrente
    state.sessionStartTime = getCurrentTime().getTime();
    
    sendResponse?.({ ok: true });
  }
  return true;
});
