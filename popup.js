// ===== POPUP DEBUG CONSOLE =====

class DebugConsole {
  constructor() {
    this.console = document.getElementById('console');
    this.clearBtn = document.getElementById('clearBtn');
    this.testBtn = document.getElementById('testBtn');
    
    this.init();
  }
  
  init() {
    // Event listeners
    this.clearBtn.addEventListener('click', () => this.clear());
    this.testBtn.addEventListener('click', () => this.testPlay());
    
    // Ascolta i messaggi dal service worker
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      console.log('Popup received message:', msg);
      if (msg.type === 'debug-log') {
        this.addLog(msg.level, msg.message, msg.data);
      }
    });
    
    // Richiedi lo stato iniziale
    this.requestState();
    
    // Test di connessione
    this.addLog('debug', '🔌 Popup inizializzato');
    
    // Test immediato
    setTimeout(() => {
      this.addLog('debug', '🧪 Test messaggio dopo 1 secondo');
    }, 1000);
  }
  
  addLog(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${level}`;
    
    let content = `<span class="log-timestamp">[${timestamp}]</span>`;
    content += `<span class="log-${level}">${message}</span>`;
    
    if (data) {
      content += ` <span style="color: #888;">${JSON.stringify(data)}</span>`;
    }
    
    logEntry.innerHTML = content;
    this.console.appendChild(logEntry);
    
    // Auto-scroll to bottom
    this.console.scrollTop = this.console.scrollHeight;
    
    // Limita il numero di log (mantieni solo gli ultimi 100)
    while (this.console.children.length > 100) {
      this.console.removeChild(this.console.firstChild);
    }
  }
  
  clear() {
    this.console.innerHTML = '';
    this.addLog('debug', '🧹 Console pulita');
  }
  
  testPlay() {
    this.addLog('debug', '🧪 Test Play inviato');
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'play' }, (response) => {
      this.addLog('play', '✅ Play response:', response);
    });
  }
  
  requestState() {
    this.addLog('debug', '📡 Richiesta stato...');
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'getState' }, (response) => {
      this.addLog('state', '📊 Stato ricevuto:', response);
    });
  }
}

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  new DebugConsole();
});
