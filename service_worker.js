// service_worker.js (MV3)
// - Crea i menu "Play", "Stop", "Reopen Timeline"
// - Mantiene/coordina il documento offscreen che gestisce il timer
// - Apre/riapre la tab della timeline

console.log('🎯 Service Worker loaded');

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');
const TIMELINE_URL  = chrome.runtime.getURL('timeline.html');

// Sistema di logging per debugging
let debugLogs = [];
const MAX_LOGS = 100; // Limita i log per evitare di riempire la memoria

async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument?.();
  if (exists) return;

  // Crea un documento offscreen persistente per gestire un timer sub-secondo
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['IFRAME_SCRIPTING'],
    justification: 'Tenere in vita un timer a 100ms per aggiornare una timeline anche senza tab visibile.'
  });
}

async function sendToOffscreen(message) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({ target: 'offscreen', ...message });
}

async function openOrFocusTimeline() {
  console.log('🎯 Opening timeline...');
  try {
    // Cerca tab già aperta con la timeline
    const tabs = await chrome.tabs.query({});
    const existing = tabs.find(t => t.url === TIMELINE_URL);
    if (existing) {
      console.log('🎯 Timeline tab found, focusing...');
      await chrome.tabs.update(existing.id, { active: true });
      return;
    }
    // Altrimenti apri una nuova tab
    console.log('🎯 Creating new timeline tab...');
    await chrome.tabs.create({ url: TIMELINE_URL });
  } catch (error) {
    console.error('🎯 Error in openOrFocusTimeline:', error);
    // Fallback: prova ad aprire direttamente
    try {
      await chrome.tabs.create({ url: TIMELINE_URL });
    } catch (fallbackError) {
      console.error('🎯 Fallback also failed:', fallbackError);
    }
  }
}

// Context menus su icona dell’estensione
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: 'play',
    title: 'Play (avvia timeline)',
    contexts: ['action']
  });
  chrome.contextMenus.create({
    id: 'stop',
    title: 'Stop (ferma timeline)',
    contexts: ['action']
  });
  chrome.contextMenus.create({
    id: 'reopen',
    title: 'Reopen Timeline (riapri la tab)',
    contexts: ['action']
  });
  chrome.contextMenus.create({
    id: 'show_logs',
    title: 'Red Button Debug',
    contexts: ['action']
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'play') {
    await ensureOffscreen();
    await sendToOffscreen({ type: 'play' });
    await openOrFocusTimeline();
  } else if (info.menuItemId === 'stop') {
    await ensureOffscreen();
    await sendToOffscreen({ type: 'stop' });
  } else if (info.menuItemId === 'reopen') {
    await ensureOffscreen();
    await openOrFocusTimeline();
  } else if (info.menuItemId === 'show_logs') {
    await showDebugLogs();
  }
});

// Funzione per mostrare i log di debug
async function showDebugLogs() {
  const logsText = debugLogs.map(log => {
    const timestamp = new Date(log.timestamp).toLocaleTimeString();
    return `[${timestamp}] ${log.action}\n${JSON.stringify(log, null, 2)}\n---\n`;
  }).join('\n');
  
  // Apri una nuova tab con i log
  await chrome.tabs.create({
    url: `data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html>
<head>
  <title>Debug Logs - Red Button Extension</title>
  <style>
    body { font-family: monospace; font-size: 12px; background: #1a1a1a; color: #fff; padding: 20px; }
    pre { background: #2a2a2a; padding: 10px; border-radius: 5px; overflow-x: auto; }
    button { background: #4a4a4a; color: #fff; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px 0; }
    button:hover { background: #5a5a5a; }
  </style>
</head>
<body>
  <h1>🔍 Debug Logs - Red Button Extension</h1>
  <button onclick="copyAll()">📋 Copia Tutto</button>
  <button onclick="clearLogs()">🗑️ Pulisci Log</button>
  <pre id="logs">${logsText || 'Nessun log disponibile. Fai alcuni click sulla timeline per generare log.'}</pre>
  
  <script>
    function copyAll() {
      const logs = document.getElementById('logs').textContent;
      navigator.clipboard.writeText(logs).then(() => {
        alert('Log copiati negli appunti!');
      });
    }
    
    function clearLogs() {
      if (confirm('Sei sicuro di voler pulire tutti i log?')) {
        fetch('chrome-extension://${chrome.runtime.id}/clear-logs', { method: 'POST' });
        document.getElementById('logs').textContent = 'Log puliti.';
      }
    }
  </script>
</body>
</html>
    `)}`
  });
}

// Click sull'icona: apre/porta in primo piano la timeline
chrome.action.onClicked.addListener(async () => {
  console.log('🎯 Icon clicked - Opening timeline');
  try {
    await ensureOffscreen();
    console.log('🎯 Offscreen ensured');
    await openOrFocusTimeline();
    console.log('🎯 Timeline opened');
  } catch (error) {
    console.error('🎯 Error opening timeline:', error);
  }
});

// Messaggistica da timeline
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.target !== 'service_worker') return;

    if (msg.type === 'request_state') {
      await ensureOffscreen();
      // gira la richiesta all'offscreen
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'get_state' });
      sendResponse({ ok: true });
    }

    if (msg.type === 'toggle_active') {
      await sendToOffscreen({ type: 'toggle_active' });
      sendResponse({ ok: true });
    }

    if (msg.type === 'play') {
      await sendToOffscreen({ type: 'play' });
      sendResponse({ ok: true });
    }

    if (msg.type === 'stop') {
      await sendToOffscreen({ type: 'stop' });
      sendResponse({ ok: true });
    }

    if (msg.type === 'debug_log') {
      // Aggiungi il log all'array
      debugLogs.push(msg.payload);
      
      // Limita il numero di log per evitare di riempire la memoria
      if (debugLogs.length > MAX_LOGS) {
        debugLogs = debugLogs.slice(-MAX_LOGS);
      }
      
      sendResponse({ ok: true, totalLogs: debugLogs.length });
    }
  })();
  // keep async channel open
  return true;
});
