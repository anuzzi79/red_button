// ===== RULER TIMELINE - VERSIONE NUOVA E PULITA =====

class RulerRenderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    
    // Configurazione base
    this.PPS = 1; // Pixel per secondo
    this.workingDays = 1;
    this.timelineHeight = 220;
    this.slotSpacing = 10;
    this.horizontalOffset = 0;
    
    // Stato
    this.uiState = null;
    this.timeMode = 'real';
    this.simulatedStartTime = null;
    this.simulatedBaseTime = null;
    
    console.log('🎯 Nuovo RulerRenderer inizializzato');
  }
  
  // Ottiene il tempo corrente (reale o simulato)
  getCurrentTime() {
    if (this.timeMode === 'simulated' && this.simulatedStartTime && this.simulatedBaseTime) {
      const elapsed = Date.now() - this.simulatedStartTime;
      return new Date(this.simulatedBaseTime.getTime() + elapsed);
    }
    return new Date();
  }
  
  // Calcola la posizione X del tempo corrente (FISSO a destra)
  calculateCurrentTimeX(canvasWidth, rightPad) {
    if (!this.uiState || !this.uiState.sessionStartTime) return canvasWidth - rightPad;
    
    // Il segna presente rosso rimane sempre FISSO a destra
    // Solo il contenuto temporale (taccature + ruler) scorre verso sinistra
    return canvasWidth - rightPad + this.horizontalOffset;
  }
  
  // Metodo di compatibilità per il sistema di tracciamento esistente
  calculateZeroX(canvasWidth, rightPad, PPS, horizontalOffset) {
    return this.calculateCurrentTimeX(canvasWidth, rightPad);
  }
  
  // Calcola la data di un giorno specifico
  getDayDate(dayOffset) {
    if (!this.uiState || !this.uiState.sessionStartTime) return null;
    const baseDate = this.getCurrentTime();
    const dayDate = new Date(baseDate);
    dayDate.setDate(baseDate.getDate() - dayOffset);
    return dayDate;
  }
  
  // Formatta la data in portoghese brasiliano
  formatBrazilianDate(date) {
    const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const dayOfWeek = daysOfWeek[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayOfWeek} ${day} ${month} ${year}`;
  }
  
  // Aggiorna la configurazione
  updateConfig(config) {
    this.PPS = config.PPS || this.PPS;
    this.workingDays = config.workingDays || this.workingDays;
    this.horizontalOffset = config.horizontalOffset || this.horizontalOffset;
    this.timeMode = config.timeMode || this.timeMode;
    this.simulatedStartTime = config.simulatedStartTime || this.simulatedStartTime;
    this.simulatedBaseTime = config.simulatedBaseTime || this.simulatedBaseTime;
  }
  
  // Aggiorna lo stato
  updateState(uiState) {
    this.uiState = uiState;
  }
  
  // Determina la granularità delle taccature con sistema principale/secondario
  getTickGranularity() {
    if (this.PPS >= 3.0) {
      // Pentaminuti (5 min) principali, minuti secondari
      return {
        primary: { interval: 300, lineHeight: 0.9, strokeStyle: '#9ca3af', lineWidth: 2, label: '5min' },
        secondary: { interval: 60, lineHeight: 0.6, strokeStyle: '#a0a9b8', lineWidth: 1, label: '1min' }
      };
    } else if (this.PPS >= 1.5) {
      // Quarti d'ora (15 min) principali, minuti secondari
      return {
        primary: { interval: 900, lineHeight: 0.9, strokeStyle: '#9ca3af', lineWidth: 2, label: '15min' },
        secondary: { interval: 60, lineHeight: 0.5, strokeStyle: '#a0a9b8', lineWidth: 1, label: '1min' }
      };
    } else if (this.PPS >= 0.5) {
      // Mezz'ore (30 min) principali, decaminuti (10 min) secondari
      return {
        primary: { interval: 1800, lineHeight: 0.9, strokeStyle: '#9ca3af', lineWidth: 2, label: '30min' },
        secondary: { interval: 600, lineHeight: 0.5, strokeStyle: '#a0a9b8', lineWidth: 1, label: '10min' }
      };
    } else if (this.PPS >= 0.11) {
      // Ore principali, decaminuti (10 min) secondari
      return {
        primary: { interval: 3600, lineHeight: 0.9, strokeStyle: '#9ca3af', lineWidth: 2, label: '1hour' },
        secondary: { interval: 600, lineHeight: 0.5, strokeStyle: '#a0a9b8', lineWidth: 1, label: '10min' }
      };
    } else if (this.PPS >= 0.05) {
      // Ore principali, mezz'ore secondarie
      return {
        primary: { interval: 3600, lineHeight: 0.9, strokeStyle: '#9ca3af', lineWidth: 2, label: '1hour' },
        secondary: { interval: 1800, lineHeight: 0.4, strokeStyle: '#a0a9b8', lineWidth: 1, label: '30min' }
      };
    } else {
      // Solo ore (zoom molto basso)
      return {
        primary: { interval: 3600, lineHeight: 0.9, strokeStyle: '#9ca3af', lineWidth: 2, label: '1hour' },
        secondary: null // Nessuna tacca secondaria
      };
    }
  }
  
  // Rendering principale del ruler
  render() {
    if (!this.uiState || !this.uiState.sessionStartTime) {
      console.log('⚠️ Ruler non inizializzato');
      return;
    }
    
    const w = this.canvas.width;
    const h = this.canvas.height;
    const rightPad = 40;
    
    console.log('🎯 RULER RENDERING - PPS:', this.PPS);
    
    // Calcola la posizione del tempo corrente
    const currentTimeX = this.calculateCurrentTimeX(w, rightPad);
    console.log('Tempo corrente X:', currentTimeX);
    
    // Disegna le righe orizzontali per ogni giorno
    this.ctx.strokeStyle = '#2a2f3a';
    this.ctx.lineWidth = 1;
    
    for (let day = 0; day < this.workingDays; day++) {
      const dayY = day * (this.timelineHeight + this.slotSpacing);
      
      // Righe orizzontali di sfondo
      for (let y = dayY + 30; y < dayY + this.timelineHeight; y += 30) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(w, y);
        this.ctx.stroke();
      }
      
      // Linea separatrice tra i giorni
      if (day > 0) {
        this.ctx.strokeStyle = '#4b5362';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, dayY);
        this.ctx.lineTo(w, dayY);
        this.ctx.stroke();
        this.ctx.strokeStyle = '#2a2f3a';
        this.ctx.lineWidth = 1;
      }
    }
    
    // Disegna le taccature per ogni giorno
    for (let day = 0; day < this.workingDays; day++) {
      const dayY = day * (this.timelineHeight + this.slotSpacing);
      const dayDate = this.getDayDate(day);
      
      if (!dayDate) continue;
      
      this.drawTicksForDay(day, dayY, w, rightPad, currentTimeX);
      this.drawDayLabel(day, dayY, dayDate);
    }
    
    // Disegna il marcatore del tempo corrente
    this.drawCurrentTimeMarker(currentTimeX, h);
    
    console.log('✅ RULER RENDERING COMPLETATO');
  }
  
  // Disegna le taccature per un singolo giorno
  drawTicksForDay(day, dayY, canvasWidth, rightPad, currentTimeX) {
    const granularity = this.getTickGranularity();
    const currentTime = this.getCurrentTime();
    
    console.log(`Giorno ${day} - Granularità:`, granularity.primary.label, granularity.secondary ? granularity.secondary.label : 'solo principali');
    
    // Calcola il range di tempo da mostrare
    const timeRange = (canvasWidth / this.PPS) * 2; // 2x la larghezza del canvas
    const startTime = new Date(currentTime.getTime() - timeRange * 1000);
    const endTime = new Date(currentTime.getTime() + timeRange * 1000);
    
    // Trova il primo tick da mostrare
    const startTimestamp = Math.floor(startTime.getTime() / 1000);
    const endTimestamp = Math.ceil(endTime.getTime() / 1000);
    
    let primaryCount = 0;
    let secondaryCount = 0;
    
    // Disegna prima le taccature secondarie (se esistono)
    if (granularity.secondary) {
      const firstSecondaryTick = Math.ceil(startTimestamp / granularity.secondary.interval) * granularity.secondary.interval;
      
      for (let timestamp = firstSecondaryTick; timestamp <= endTimestamp; timestamp += granularity.secondary.interval) {
        const tickTime = new Date(timestamp * 1000);
        const timeDiff = (timestamp * 1000 - currentTime.getTime()) / 1000;
        const x = currentTimeX + timeDiff * this.PPS;
        
        // Solo se è visibile
        if (x < -50 || x > canvasWidth + 50) continue;
        
        // Non disegnare se coincide con una tacca principale
        if ((timestamp % granularity.primary.interval) === 0) continue;
        
        this.drawTick(x, dayY, tickTime, granularity.secondary, false);
        secondaryCount++;
      }
    }
    
    // Disegna le taccature principali
    const firstPrimaryTick = Math.ceil(startTimestamp / granularity.primary.interval) * granularity.primary.interval;
    
    for (let timestamp = firstPrimaryTick; timestamp <= endTimestamp; timestamp += granularity.primary.interval) {
      const tickTime = new Date(timestamp * 1000);
      const timeDiff = (timestamp * 1000 - currentTime.getTime()) / 1000;
      const x = currentTimeX + timeDiff * this.PPS;
      
      // Solo se è visibile
      if (x < -50 || x > canvasWidth + 50) continue;
      
      this.drawTick(x, dayY, tickTime, granularity.primary, true);
      primaryCount++;
    }
    
    console.log(`Giorno ${day} - Disegnate ${primaryCount} principali, ${secondaryCount} secondarie`);
  }
  
  // Disegna una singola tacca
  drawTick(x, dayY, time, tickConfig, isPrimary = true) {
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();
    
    // Usa la configurazione della tacca
    const lineHeight = this.timelineHeight * tickConfig.lineHeight;
    const strokeStyle = tickConfig.strokeStyle;
    const lineWidth = tickConfig.lineWidth;
    
    // Determina se mostrare l'etichetta
    let showLabel = false;
    let labelText = '';
    
    if (isPrimary) {
      // Le taccature principali mostrano sempre l'etichetta
      showLabel = true;
      
      if (tickConfig.label === '1hour') {
        labelText = `${hours.toString().padStart(2, '0')}:00`;
      } else if (tickConfig.label === '30min') {
        labelText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (tickConfig.label === '15min') {
        labelText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (tickConfig.label === '5min') {
        labelText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    } else {
      // Le taccature secondarie mostrano etichette più piccole con ore e minuti
      if (tickConfig.label === '30min' && (minutes === 30 || minutes === 0)) {
        showLabel = true;
        labelText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (tickConfig.label === '10min' && minutes % 10 === 0) {
        showLabel = true;
        labelText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (tickConfig.label === '1min' && seconds === 0) {
        showLabel = true;
        labelText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
    
    // Disegna la linea
    this.ctx.strokeStyle = strokeStyle;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(x, dayY);
    this.ctx.lineTo(x, dayY + lineHeight);
    this.ctx.stroke();
    
    // Disegna l'etichetta se necessario
    if (showLabel) {
      this.drawTickLabel(x, dayY, labelText, isPrimary);
    }
  }
  
  // Disegna l'etichetta di una tacca
  drawTickLabel(x, dayY, labelText, isPrimary = true) {
    // Posiziona l'etichetta più in basso e leggermente a sinistra della linea
    const labelX = x - 8; // Sposta a sinistra della linea
    const labelY = dayY + 40; // Sposta più in basso per evitare il taglio
    
    this.ctx.save();
    this.ctx.translate(labelX, labelY);
    this.ctx.rotate(-Math.PI / 2);
    
    // Sfondo semi-trasparente per migliorare la leggibilità
    const textWidth = this.ctx.measureText(labelText).width;
    this.ctx.fillStyle = 'rgba(16, 19, 26, 0.8)';
    this.ctx.fillRect(-2, -textWidth - 2, textWidth + 4, textWidth + 4);
    
    // Testo dell'etichetta (più piccolo per le secondarie)
    this.ctx.fillStyle = '#e6e8ee';
    this.ctx.font = isPrimary ? '11px system-ui' : '9px system-ui';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(labelText, 0, -1);
    
    this.ctx.restore();
  }

  // Disegna l'etichetta del giorno
  drawDayLabel(day, dayY, dayDate) {
    const dateStr = this.formatBrazilianDate(dayDate);
    this.ctx.font = 'bold 12px system-ui';
    this.ctx.fillStyle = '#9aa3b2';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(dateStr, 8, dayY + this.timelineHeight - 8);
  }
  
  // Disegna il marcatore del tempo corrente
  drawCurrentTimeMarker(x, canvasHeight) {
    // Linea verticale rossa
    this.ctx.strokeStyle = '#ff453a';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, 0);
    this.ctx.lineTo(x, canvasHeight);
    this.ctx.stroke();
    
    // Puntino rosso in alto
    this.ctx.fillStyle = '#ff453a';
    this.ctx.beginPath();
    this.ctx.arc(x, 0, 4, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Etichetta del tempo
    const currentTime = this.getCurrentTime();
    const timeStr = currentTime.toLocaleTimeString('it-IT', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    this.ctx.fillStyle = '#ff453a';
    this.ctx.font = 'bold 11px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    
    // Sfondo per l'etichetta
    const textWidth = this.ctx.measureText(timeStr).width;
    this.ctx.fillStyle = 'rgba(16, 19, 26, 0.9)';
    this.ctx.fillRect(x - textWidth/2 - 4, 0, textWidth + 8, 16);
    
    // Testo
    this.ctx.fillStyle = '#ff453a';
    this.ctx.fillText(timeStr, x, 14);
  }
}

// Esporta la classe
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RulerRenderer;
} else {
  window.RulerRenderer = RulerRenderer;
}