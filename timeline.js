// ===== RED BUTTON TIMELINE - VERSIONE SEMPLIFICATA CON MODULO RULER =====

// Stato globale dell'interfaccia
let uiState = {
  running: false,
  active: false,
  elapsedMs: 0,
  segments: [], // {startMs,endMs}
  redPeriods: [], // Array di { startMs, endMs } per i periodi in cui il bottone rosso è stato attivo
  sessionStartTime: null, // Timestamp reale di inizio sessione
  sessionPeriods: [], // Array di { startMs, endMs } per i periodi di sessione attiva (verdi)
  trackingStartTime: null // Timestamp quando inizia il tracking
};

// Configurazione timeline
let PPS = 1; // Pixel per secondo
let workingDays = 1; // Numero di giorni da mostrare
let timelineHeight = 220; // Altezza di ogni timeline
let slotSpacing = 10; // Spazio tra gli slot
let scrollOffset = 0; // Offset di scroll verticale
let horizontalOffset = 0; // Offset di scroll orizzontale
let isHorizontalDragging = false; // Flag per drag orizzontale
let dragStartX = 0; // Posizione X del mouse all'inizio del drag

// Gestione tempo simulato
let timeMode = 'real'; // 'real' o 'simulated'
let simulatedStartTime = null; // Timestamp di inizio del tempo simulato
let simulatedBaseTime = null; // Timestamp base del tempo simulato

// Sistema bandierine rimosso

// Gestione selezione per modifica colore
let selectionStart = null; // Inizio selezione (timestamp ms)
let selectionEnd = null; // Fine selezione (timestamp ms)
let isSelecting = false; // Flag per modalità selezione

// Elementi DOM e ruler
let canvas, ctx, rulerRenderer;
let playBtn, stopBtn, redBtn, zoomRange, zoomValue;
let workingDaysSelect, timeModeSelect, simulatedDateInput, simulatedTimeInput;
let applySimulatedBtn, savedDaysSelect, loadSavedBtn;

// ===== FUNZIONI UTILITY =====

// Funzione per ottenere il tempo corrente (reale o simulato)
function getCurrentTime() {
  if (timeMode === 'simulated' && simulatedStartTime && simulatedBaseTime) {
    const elapsed = Date.now() - simulatedStartTime;
    return new Date(simulatedBaseTime.getTime() + elapsed);
  }
  return new Date();
}

// Funzione per calcolare la data di un giorno specifico
function getDayDate(dayOffset) {
  if (!uiState.sessionStartTime) return null;
  const baseDate = getCurrentTime();
  const dayDate = new Date(baseDate);
  dayDate.setDate(baseDate.getDate() - dayOffset);
  return dayDate;
}

// ===== GESTIONE SALVATAGGI =====

async function saveCurrentDay() {
  const dayDate = getDayDate(0); // Giorno corrente
  const dateKey = dayDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  const dayData = {
    date: dateKey,
    sessionStartTime: uiState.sessionStartTime,
    sessionPeriods: JSON.parse(JSON.stringify(uiState.sessionPeriods)),
    redPeriods: JSON.parse(JSON.stringify(uiState.redPeriods)),
    savedAt: Date.now()
  };
  
  // Salva usando chrome.storage.local
  const storageKey = `saved_day_${dateKey}`;
  await chrome.storage.local.set({ [storageKey]: dayData });
  
  // Aggiorna la lista dei giorni salvati
  await loadSavedDaysList();
  
  alert(`Giorno ${dateKey} salvato con successo!`);
}

async function loadSavedDaysList() {
  const result = await chrome.storage.local.get(null);
  const savedDays = [];
  
  for (const key in result) {
    if (key.startsWith('saved_day_')) {
      savedDays.push(result[key]);
    }
  }
  
  // Ordina dal più recente al più vecchio
  savedDays.sort((a, b) => b.savedAt - a.savedAt);
  
  // Aggiorna il menu
  if (savedDaysSelect) {
    savedDaysSelect.innerHTML = '<option value="">Nenhum</option>';
    
    savedDays.forEach((day, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = day.date;
      savedDaysSelect.appendChild(option);
    });
  }
}

async function loadSavedDay(index) {
  if (index < 0) return;
  
  // Carica i dati salvati (implementazione semplificata)
  alert(`Giorno caricato! (Visualizzazione da implementare)`);
}

// ===== RENDERING PRINCIPALE =====

function render() {
  if (!canvas || !ctx || !rulerRenderer) {
    console.log('⚠️ Canvas or ruler not initialized');
    return;
  }
  
  const w = canvas.width;
  const totalHeight = workingDays * timelineHeight + (workingDays - 1) * slotSpacing;
  
  // Ridimensiona il canvas se necessario
  if (canvas.height !== totalHeight) {
    canvas.height = totalHeight;
  }
  
  const h = canvas.height;

  // Pulisci il canvas
  ctx.clearRect(0, 0, w, h);
  
  // Applica lo scroll offset
  ctx.save();
  ctx.translate(0, -scrollOffset);
  
  // Sfondo
  ctx.fillStyle = '#10131a';
  ctx.fillRect(0, 0, w, h);

  // Aggiorna la configurazione del ruler
  rulerRenderer.updateConfig({
    PPS: PPS,
    workingDays: workingDays,
    horizontalOffset: horizontalOffset,
    timeMode: timeMode,
    simulatedStartTime: simulatedStartTime,
    simulatedBaseTime: simulatedBaseTime
  });
  
  // Aggiorna lo stato del ruler
  rulerRenderer.updateState(uiState);
  
  // Renderizza il ruler
  rulerRenderer.render();

  // Disegna segmenti di tracciamento - solo sul primo giorno
  const currentDayY = 0;
  const rightPad = 40;
  const zeroX = rulerRenderer.calculateZeroX(w, rightPad, PPS, horizontalOffset);
  
  // Log di rendering solo per debug occasionale
  // console.log('🎯 Rendering segments:', uiState.segments.length, 'redPeriods:', uiState.redPeriods.length, 'sessionPeriods:', uiState.sessionPeriods.length);
  
  for (const seg of uiState.segments) {
    const currentTime = getCurrentTime();
    const segStartTime = new Date(uiState.sessionStartTime + seg.startMs);
    const timeDiffStart = (segStartTime.getTime() - currentTime.getTime()) / 1000;
    const x1 = zeroX + timeDiffStart * PPS;
    
    // Per il segmento corrente (endMs = null), usa elapsedMs
    const segEndMs = seg.endMs ?? uiState.elapsedMs;
    const segEndTime = new Date(uiState.sessionStartTime + segEndMs);
    const timeDiffEnd = (segEndTime.getTime() - currentTime.getTime()) / 1000;
    const x2 = zeroX + timeDiffEnd * PPS;
    
    console.log('🎯 Segment:', { x1, x2, active: uiState.active, elapsedMs: uiState.elapsedMs });
    
    if (x2 < 0 || x1 > w) continue;

    ctx.fillStyle = uiState.active ? '#dc2626' : '#16a34a';
    ctx.fillRect(x1, currentDayY + timelineHeight * 0.65, x2 - x1, timelineHeight * 0.20);
  }

  // Disegna periodi di sessione - solo sul primo giorno
  for (const sessionPeriod of uiState.sessionPeriods) {
    const currentTime = getCurrentTime();
    const sessionStartTime = new Date(uiState.sessionStartTime + sessionPeriod.startMs);
    const timeDiffStart = (sessionStartTime.getTime() - currentTime.getTime()) / 1000;
    const x1 = zeroX + timeDiffStart * PPS;
    
    // Per il periodo corrente (endMs = null), usa elapsedMs
    const endMs = sessionPeriod.endMs ?? uiState.elapsedMs;
    const sessionEndTime = new Date(uiState.sessionStartTime + endMs);
    const timeDiffEnd = (sessionEndTime.getTime() - currentTime.getTime()) / 1000;
    const x2 = zeroX + timeDiffEnd * PPS;
    
    if (x2 < 0 || x1 > w) continue;

    ctx.fillStyle = '#16a34a';
    ctx.fillRect(x1, currentDayY + timelineHeight * 0.65, x2 - x1, timelineHeight * 0.20);

    // Sovrapponi i periodi rossi che cadono dentro questo periodo di sessione
    for (const redPeriod of uiState.redPeriods) {
      const redStartTime = new Date(uiState.sessionStartTime + redPeriod.startMs);
      const redTimeDiffStart = (redStartTime.getTime() - currentTime.getTime()) / 1000;
      const redX1 = zeroX + redTimeDiffStart * PPS;
      
      // Per il periodo rosso corrente (endMs = null), usa elapsedMs
      const redEndMs = redPeriod.endMs ?? uiState.elapsedMs;
      const redEndTime = new Date(uiState.sessionStartTime + redEndMs);
      const redTimeDiffEnd = (redEndTime.getTime() - currentTime.getTime()) / 1000;
      const redX2 = zeroX + redTimeDiffEnd * PPS;
      
      if (redX2 < 0 || redX1 > w) continue;

      ctx.fillStyle = '#dc2626';
      ctx.fillRect(redX1, currentDayY + timelineHeight * 0.65, redX2 - redX1, timelineHeight * 0.20);
    }
  }

  // Sistema bandierine rimosso

  // Disegna selezione attiva
  if (selectionStart !== null && selectionEnd !== null && uiState.sessionStartTime) {
    const currentTime = getCurrentTime();
    const selStartTime = new Date(uiState.sessionStartTime + selectionStart);
    const selEndTime = new Date(uiState.sessionStartTime + selectionEnd);
    const timeDiffStart = (selStartTime.getTime() - currentTime.getTime()) / 1000;
    const timeDiffEnd = (selEndTime.getTime() - currentTime.getTime()) / 1000;
    const selX1 = zeroX + timeDiffStart * PPS;
    const selX2 = zeroX + timeDiffEnd * PPS;
    
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.fillRect(Math.min(selX1, selX2), currentDayY + timelineHeight * 0.65, Math.abs(selX2 - selX1), timelineHeight * 0.20);
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.min(selX1, selX2), currentDayY + timelineHeight * 0.65, Math.abs(selX2 - selX1), timelineHeight * 0.20);
  }

  // Etichetta tempo corrente - solo sul primo giorno (in alto a destra)
  ctx.fillStyle = '#e6e8ee';
  if (uiState.sessionStartTime) {
    const currentTime = getCurrentTime();
    const timeStr = currentTime.toLocaleTimeString('it-IT', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    ctx.fillText(timeStr, w - rightPad - 80, 20);
  }

  // Ripristina il context
  ctx.restore();

  // Scrollbar verticale personalizzata
  updateScrollbar();
}

// ===== GESTIONE SCROLLBAR =====

function updateScrollbar() {
  const totalHeight = workingDays * timelineHeight + (workingDays - 1) * slotSpacing;
  const visibleHeight = canvas.height;
  
  const scrollbar = document.getElementById('verticalScrollbar');
  if (!scrollbar) return;
  
  if (totalHeight <= visibleHeight) {
    scrollbar.style.display = 'none';
    return;
  }
  
  scrollbar.style.display = 'block';
  
  const thumb = scrollbar.querySelector('.scrollbar-thumb');
  if (!thumb) return;
  
  const thumbHeight = (visibleHeight / totalHeight) * visibleHeight;
  const maxScroll = totalHeight - visibleHeight;
  const thumbPosition = (scrollOffset / maxScroll) * (visibleHeight - thumbHeight);
  
  thumb.style.height = thumbHeight + 'px';
  thumb.style.top = thumbPosition + 'px';
}

// ===== EVENT LISTENERS =====

function initEventListeners() {
  // Sistema bandierine rimosso

  // Bottoni Play/Stop - ora gestiti dal bottone verde grande
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      console.log('🎯 Play button clicked - Starting tracking');
      sendDebugLog('play', '🎯 Play button clicked - Starting tracking');
      ensureOffscreenAndPlay();
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      sendDebugLog('stop', '🛑 Stop button clicked - Resetting to normal');
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop' }, (response) => {
        sendDebugLog('stop', '✅ Stop response', response);
      });
    });
  }

  // Bottone rosso/verde - ora gestisce il tracciamento principale
  if (redBtn) {
    redBtn.addEventListener('click', () => {
      console.log('🎯 Red/Green button clicked - Toggle tracking');
      sendDebugLog('play', '🎯 Red/Green button clicked - Toggle tracking');
      
      // Assicurati che l'offscreen sia attivo prima di inviare il messaggio
      ensureOffscreenAndPlay();
    });
  }

  // Bottone di test
  const testBtn = document.getElementById('testBtn');
  if (testBtn) {
    testBtn.addEventListener('click', () => {
      console.log('🎯 Test button clicked');
      alert('Test button works! Extension is loaded.');
    });
  }

  // Zoom
  if (zoomRange) {
    zoomRange.addEventListener('input', () => {
      PPS = parseFloat(zoomRange.value);
      if (zoomValue) zoomValue.value = PPS.toFixed(3);
      render();
    });
  }

  if (zoomValue) {
    zoomValue.addEventListener('input', () => {
      const value = parseFloat(zoomValue.value);
      if (value >= 0.01 && value <= 3) {
        PPS = value;
        if (zoomRange) zoomRange.value = PPS;
        render();
      }
    });
  }

  // Working Days
  if (workingDaysSelect) {
    workingDaysSelect.addEventListener('change', () => {
      workingDays = parseInt(workingDaysSelect.value);
      render();
    });
  }

  // Time Mode
  if (timeModeSelect) {
    timeModeSelect.addEventListener('change', () => {
      timeMode = timeModeSelect.value;
      const controls = document.getElementById('simulatedTimeControls');
      if (controls) {
        controls.style.display = timeMode === 'simulated' ? 'block' : 'none';
      }
    });
  }

  // Apply Simulated Time
  if (applySimulatedBtn) {
    applySimulatedBtn.addEventListener('click', () => {
      const dateStr = simulatedDateInput?.value;
      const timeStr = simulatedTimeInput?.value;
      
      if (!dateStr || !timeStr) {
        alert('Per favore, inserisci sia la data che l\'ora');
        return;
      }
      
      const simulatedDateTime = new Date(`${dateStr}T${timeStr}`);
      const simulatedBaseTime = simulatedDateTime;
      const simulatedStartTime = Date.now();
      
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'setSimulatedTime',
        payload: {
          simulatedBaseTime: simulatedBaseTime.toISOString(),
          simulatedStartTime: simulatedStartTime
        }
      });
    });
  }

  // Load Saved Day
  if (loadSavedBtn) {
    loadSavedBtn.addEventListener('click', () => {
      const selectedIndex = parseInt(savedDaysSelect?.value);
      if (!isNaN(selectedIndex)) {
        loadSavedDay(selectedIndex);
      }
    });
  }

  // Save Day
  const saveDayBtn = document.getElementById('saveDayBtn');
  if (saveDayBtn) {
    saveDayBtn.addEventListener('click', saveCurrentDay);
  }
}

// ===== GESTIONE CLICK E DRAG =====

function initCanvasEventListeners() {
  if (!canvas) return;
  
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + scrollOffset;
    
    // Controlla se si è cliccato su un pulsante X
    let clickedOnX = false;
    for (let day = 1; day < workingDays; day++) {
      const dayY = day * (timelineHeight + slotSpacing);
      const removeBtnX = canvas.width - 25;
      const removeBtnY = dayY + 15;
      const distance = Math.sqrt((x - removeBtnX) ** 2 + (y - removeBtnY) ** 2);
      if (distance <= 10) {
        // Rimuovi questo giorno
        workingDays = Math.max(1, workingDays - 1);
        if (workingDaysSelect) workingDaysSelect.value = workingDays.toString();
        render();
        clickedOnX = true;
        break;
      }
    }
    
    // Sistema bandierine rimosso
  });

  // Gestione mousedown per drag orizzontale
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + scrollOffset;
    
    // Solo se clicchi nella zona del ruler (y tra 0 e 85% della timeline)
    if (y >= 0 && y <= timelineHeight * 0.85) {
      isHorizontalDragging = true;
      dragStartX = x;
    }
  });

  // Gestione mousemove per drag orizzontale
  canvas.addEventListener('mousemove', (e) => {
    if (isHorizontalDragging) {
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const deltaX = currentX - dragStartX;
      
      horizontalOffset += deltaX;
      dragStartX = currentX;
      
      render();
    }
  });

  // Gestione mouseup per terminare drag
  canvas.addEventListener('mouseup', () => {
    isHorizontalDragging = false;
    dragStartX = 0;
  });

  canvas.addEventListener('mouseleave', () => {
    isHorizontalDragging = false;
    dragStartX = 0;
  });

  // Listener globale per assicurarsi che il drag finisca ovunque si rilasci il mouse
  document.addEventListener('mouseup', () => {
    isHorizontalDragging = false;
    dragStartX = 0;
  });
}

// ===== GESTIONE ASPETTO BOTTONE =====

function updateButtonAppearance() {
  if (!redBtn || !uiState) return;
  
  // Rimuovi tutte le classi di colore
  redBtn.classList.remove('green', 'red', 'blinking');
  
  if (!uiState.running) {
    // Non in esecuzione - bottone grigio
    redBtn.classList.add('green');
    redBtn.title = 'Click per avviare il tracciamento';
  } else if (uiState.active) {
    // In esecuzione e attivo - bottone rosso lampeggiante
    redBtn.classList.add('red', 'blinking');
    redBtn.title = 'Click per passare a verde';
  } else {
    // In esecuzione ma non attivo - bottone verde
    redBtn.classList.add('green');
    redBtn.title = 'Click per passare a rosso';
  }
}

// ===== COMUNICAZIONE CON OFFScreen =====

async function ensureOffscreenAndPlay() {
  try {
    // Prima assicurati che l'offscreen sia attivo
    await chrome.runtime.sendMessage({ target: 'service_worker', type: 'request_state' });
    
    // Poi invia il comando play
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'play' }, (response) => {
      console.log('🎯 Play response:', response);
      sendDebugLog('play', '✅ Tracking response', response);
    });
  } catch (error) {
    console.error('🎯 Error ensuring offscreen:', error);
    sendDebugLog('error', '❌ Error starting tracking', error);
  }
}

function sendDebugLog(level, message, data = null) {
  console.log('Sending debug log:', { level, message, data });
  chrome.runtime.sendMessage({
    type: 'debug-log',
    level: level,
    message: message,
    data: data
  }).then(() => {
    console.log('Debug log sent successfully');
  }).catch((error) => {
    console.log('Debug log send failed:', error);
  });
}

function requestState() {
  console.log('🎯 Requesting state from offscreen...');
  sendDebugLog('debug', '📡 Richiesta stato...');
  chrome.runtime.sendMessage({ target: 'offscreen', type: 'getState' }, (response) => {
    console.log('🎯 State response:', response);
    sendDebugLog('state', '📊 Stato ricevuto', response);
  });
}

// Ricezione aggiornamenti dall'offscreen
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target !== 'timeline') return;

  if (msg.type === 'state' || msg.type === 'tick') {
    // Solo log per cambiamenti di stato importanti, non per ogni tick
    if (msg.type === 'state' || (msg.type === 'tick' && (msg.payload?.running !== uiState?.running || msg.payload?.active !== uiState?.active))) {
      console.log('🎯 State change:', msg.type, { 
        running: msg.payload?.running, 
        active: msg.payload?.active, 
        segments: msg.payload?.segments?.length || 0 
      });
      sendDebugLog('state', `📨 ${msg.type} update`, { 
        running: msg.payload?.running, 
        active: msg.payload?.active, 
        segments: msg.payload?.segments?.length || 0,
        sessionPeriods: msg.payload?.sessionPeriods?.length || 0
      });
    }
    uiState = msg.payload;
    updateButtonAppearance();
    render();
  }
});

// ===== INIZIALIZZAZIONE =====

function initDOM() {
  console.log('🚀 Initializing DOM...');
  
  // Inizializza elementi DOM
  canvas = document.getElementById('timelineCanvas');
  if (!canvas) {
    console.error('❌ Canvas not found!');
    return;
  }
  
  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('❌ Canvas context not available!');
    return;
  }
  
  playBtn = document.getElementById('playBtn');
  stopBtn = document.getElementById('stopBtn');
  redBtn = document.getElementById('redBtn');
  zoomRange = document.getElementById('zoomRange');
  zoomValue = document.getElementById('zoomValue');
  workingDaysSelect = document.getElementById('workingDaysSelect');
  timeModeSelect = document.getElementById('timeModeSelect');
  simulatedDateInput = document.getElementById('simulatedDateInput');
  simulatedTimeInput = document.getElementById('simulatedTimeInput');
  applySimulatedBtn = document.getElementById('applySimulatedBtn');
  savedDaysSelect = document.getElementById('savedDaysSelect');
  loadSavedBtn = document.getElementById('loadSavedBtn');
  
  console.log('🔧 DOM elements initialized:', {
    canvas: !!canvas,
    ctx: !!ctx,
    playBtn: !!playBtn,
    stopBtn: !!stopBtn,
    redBtn: !!redBtn
  });
  
  // Inizializza il ruler renderer
  if (typeof RulerRenderer !== 'undefined') {
    rulerRenderer = new RulerRenderer(canvas, ctx);
    console.log('🎯 RulerRenderer created');
  } else {
    console.error('❌ RulerRenderer not available!');
    return;
  }
  
  // Inizializza sessionStartTime se non è già stato fatto
  if (uiState.sessionStartTime === null) {
    uiState.sessionStartTime = Date.now();
    console.log('🔧 Auto-inizializzato sessionStartTime:', new Date(uiState.sessionStartTime).toLocaleTimeString());
  }

  // Assicurati che l'offscreen sia attivo
  chrome.runtime.sendMessage({ target: 'service_worker', type: 'request_state' });

  // Prima richiesta di stato
  requestState();

  // Inizializza event listeners
  initEventListeners();
  
  // Aggiorna aspetto iniziale del bottone
  updateButtonAppearance();
  initCanvasEventListeners();

  // Inizializza il menu Working Days
  if (workingDaysSelect) {
    workingDaysSelect.value = '1';
  }

  // Carica la lista dei giorni salvati
  loadSavedDaysList();

  // Ridisegno periodico più frequente per lo scorrimento
  setInterval(render, 100); // Ridotto da 250ms a 100ms per scorrimento più fluido
  
  // Prima renderizzazione
  render();

  console.log('✅ Red Button Timeline - Script inizializzato completamente!');
  
  // Test debug log
  setTimeout(() => {
    sendDebugLog('debug', '🎯 Timeline inizializzato e pronto');
  }, 500);
}

// Inizializza quando il DOM è pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDOM);
} else {
  // DOM già caricato
  initDOM();
}