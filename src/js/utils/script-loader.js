/* TradeLite Script Loader - Beautiful Loading System */

class ScriptLoader {
  // One value per page load, shared by every script tag it creates, so a
  // plain refresh always fetches fresh files instead of a stale cached copy.
  static _cacheBust = Date.now();

  constructor(containerId = 'script-loading-indicator') {
    this.scripts = [];
    this.loadedScripts = new Set();
    this.failedScripts = new Set();
    this.containerId = containerId;
    this.startTime = Date.now();
    this.isVisible = false;
    
    this.createLoadingUI();
  }
  
  createLoadingUI() {
    // Don't create if already exists
    if (document.getElementById(this.containerId)) return;
    
    const loadingHTML = `
      <div id="${this.containerId}" class="script-loading-overlay">
        <div class="loading-content">
          <div class="loading-header">
            <div class="loading-logo">
              <div class="logo-chart">
                <div class="chart-bar" style="--delay: 0ms"></div>
                <div class="chart-bar" style="--delay: 100ms"></div>
                <div class="chart-bar" style="--delay: 200ms"></div>
                <div class="chart-bar" style="--delay: 300ms"></div>
                <div class="chart-bar" style="--delay: 400ms"></div>
              </div>
              <span class="loading-title">TradeLite</span>
            </div>
            <div class="loading-subtitle">Initializing Trading Platform</div>
          </div>
          
          <div class="loading-progress">
            <div class="progress-bar">
              <div class="progress-fill" id="script-progress-fill"></div>
            </div>
            <div class="progress-text">
              <span id="script-progress-text">Loading components...</span>
              <span id="script-progress-percentage">0%</span>
            </div>
          </div>
          
          <div class="loading-scripts" id="script-loading-list">
            <!-- Script items will be added here -->
          </div>
          
          <div class="loading-footer">
            <div class="loading-stats">
              <span id="loading-time">0.0s</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Insert at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', loadingHTML);
    
    // Add styles
    this.addStyles();
    
    // Start timer update
    this.updateTimer();
  }
  
  addStyles() {
    if (document.getElementById('script-loader-styles')) return;
    
    const styles = `
      <style id="script-loader-styles">
        .script-loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #0b0f14 0%, #1a1f2e 100%);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
        }
        
        .script-loading-overlay.visible {
          opacity: 1;
          visibility: visible;
        }
        
        .loading-content {
          background: linear-gradient(145deg, #161b22 0%, #21262d 100%);
          border: 1px solid #30404d;
          border-radius: 16px;
          padding: 2rem;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(20px);
        }
        
        .loading-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        
        .loading-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }
        
        .logo-chart {
          display: flex;
          align-items: end;
          gap: 3px;
          height: 32px;
        }
        
        .chart-bar {
          width: 4px;
          background: linear-gradient(180deg, #00d4aa 0%, #00a085 100%);
          border-radius: 2px;
          animation: chartPulse 1.5s ease-in-out infinite;
          animation-delay: var(--delay);
        }
        
        @keyframes chartPulse {
          0%, 100% { height: 8px; opacity: 0.5; }
          50% { height: 24px; opacity: 1; }
        }
        
        .loading-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #e6edf3;
          letter-spacing: -0.5px;
        }
        
        .loading-subtitle {
          color: #8b949e;
          font-size: 0.9rem;
          font-weight: 500;
        }
        
        .loading-progress {
          margin-bottom: 1.5rem;
        }
        
        .progress-bar {
          height: 6px;
          background: #21262d;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 0.5rem;
          position: relative;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #00d4aa 0%, #00f5d4 100%);
          border-radius: 3px;
          width: 0%;
          transition: width 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .progress-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
          animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        .progress-text {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
        }
        
        #script-progress-text {
          color: #e6edf3;
          font-weight: 500;
        }
        
        #script-progress-percentage {
          color: #00d4aa;
          font-weight: 600;
        }
        
        .loading-scripts {
          max-height: 120px;
          overflow-y: auto;
          margin-bottom: 1rem;
          scrollbar-width: thin;
          scrollbar-color: #30404d #161b22;
        }
        
        .script-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(48, 64, 77, 0.3);
          font-size: 0.8rem;
        }
        
        .script-item:last-child {
          border-bottom: none;
        }
        
        .script-icon {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          flex-shrink: 0;
        }
        
        .script-icon.loading {
          background: #f59e0b;
          animation: spin 1s linear infinite;
        }
        
        .script-icon.loaded {
          background: #22c55e;
          color: white;
        }
        
        .script-icon.failed {
          background: #ef4444;
          color: white;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .script-name {
          flex: 1;
          color: #e6edf3;
          font-weight: 500;
        }
        
        .script-name.loading {
          color: #f59e0b;
        }
        
        .script-name.loaded {
          color: #22c55e;
        }
        
        .script-name.failed {
          color: #ef4444;
        }
        
        .loading-footer {
          text-align: center;
          padding-top: 1rem;
          border-top: 1px solid rgba(48, 64, 77, 0.3);
        }
        
        .loading-stats {
          color: #8b949e;
          font-size: 0.8rem;
        }
        
        /* Smooth fade out animation */
        .script-loading-overlay.fade-out {
          opacity: 0;
          transform: scale(0.95);
          transition: all 0.5s ease;
        }
        
        /* Custom scrollbar */
        .loading-scripts::-webkit-scrollbar {
          width: 4px;
        }
        
        .loading-scripts::-webkit-scrollbar-track {
          background: #161b22;
        }
        
        .loading-scripts::-webkit-scrollbar-thumb {
          background: #30404d;
          border-radius: 2px;
        }
      </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', styles);
  }
  
  addScript(name, src, description = '') {
    const script = {
      name,
      src,
      description,
      status: 'pending'
    };
    
    this.scripts.push(script);
    this.addScriptToUI(script);
    return this;
  }
  
  addScriptToUI(script) {
    const scriptsList = document.getElementById('script-loading-list');
    if (!scriptsList) return;
    
    const scriptHTML = `
      <div class="script-item" id="script-${script.name}">
        <div class="script-icon loading">⟳</div>
        <div class="script-name loading">${script.description || script.name}</div>
      </div>
    `;
    
    scriptsList.insertAdjacentHTML('beforeend', scriptHTML);
  }
  
  show() {
    const overlay = document.getElementById(this.containerId);
    if (overlay) {
      overlay.classList.add('visible');
      this.isVisible = true;
    }
  }
  
  hide() {
    const overlay = document.getElementById(this.containerId);
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.remove();
        // Remove styles
        const styles = document.getElementById('script-loader-styles');
        if (styles) styles.remove();
      }, 500);
      this.isVisible = false;
    }
  }
  
  async loadScripts() {
    if (!this.isVisible) this.show();
    
    const totalScripts = this.scripts.length;
    let loadedCount = 0;
    
    for (let i = 0; i < this.scripts.length; i++) {
      const script = this.scripts[i];
      
      try {
        this.updateScriptStatus(script.name, 'loading');
        await this.loadScript(script.src);
        
        this.updateScriptStatus(script.name, 'loaded');
        this.loadedScripts.add(script.name);
        loadedCount++;
        
      } catch (error) {
        console.error(`Failed to load ${script.name}:`, error);
        this.updateScriptStatus(script.name, 'failed');
        this.failedScripts.add(script.name);
        loadedCount++; // Count as processed
      }
      
      // Update progress
      const progress = (loadedCount / totalScripts) * 100;
      this.updateProgress(progress, script.description || script.name);
      
      // Yield so the progress bar can paint. (This used to wait 200ms per
      // script purely for the animation - ~4s of load time across a page.)
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Show completion
    this.updateProgress(100, 'All components loaded!');

    // Brief beat on "loaded", then hide
    setTimeout(() => {
      this.hide();
    }, 250);
  }
  
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Cache-bust on every page load so edited indicator/chart scripts take
      // effect on a plain refresh instead of silently serving a stale cached copy.
      script.src = src + (src.includes('?') ? '&' : '?') + 'v=' + ScriptLoader._cacheBust;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  updateScriptStatus(name, status) {
    const scriptElement = document.getElementById(`script-${name}`);
    if (!scriptElement) return;
    
    const icon = scriptElement.querySelector('.script-icon');
    const nameElement = scriptElement.querySelector('.script-name');
    
    // Reset classes
    icon.className = 'script-icon';
    nameElement.className = 'script-name';
    
    switch (status) {
      case 'loading':
        icon.classList.add('loading');
        nameElement.classList.add('loading');
        icon.textContent = '⟳';
        break;
      case 'loaded':
        icon.classList.add('loaded');
        nameElement.classList.add('loaded');
        icon.textContent = '✓';
        break;
      case 'failed':
        icon.classList.add('failed');
        nameElement.classList.add('failed');
        icon.textContent = '✗';
        break;
    }
  }
  
  updateProgress(percentage, text) {
    const progressFill = document.getElementById('script-progress-fill');
    const progressText = document.getElementById('script-progress-text');
    const progressPercentage = document.getElementById('script-progress-percentage');
    
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = text;
    if (progressPercentage) progressPercentage.textContent = `${Math.round(percentage)}%`;
  }
  
  updateTimer() {
    const updateTime = () => {
      if (!this.isVisible) return;
      
      const elapsed = (Date.now() - this.startTime) / 1000;
      const timeElement = document.getElementById('loading-time');
      if (timeElement) {
        timeElement.textContent = `${elapsed.toFixed(1)}s`;
      }
      
      requestAnimationFrame(updateTime);
    };
    
    updateTime();
  }
  
  // Static method for easy use
  static async loadTradingScripts(scripts = [], options = {}) {
    const { showOverlay = true, autoStart = true } = options;
    
    const defaultScripts = [
      { name: 'utils', src: 'utils.js', description: 'Core Utilities' },
      { name: 'indicators', src: 'indicators.js', description: 'Chart Indicators' },
      { name: 'technical-indicators', src: 'technical-indicators.js', description: 'Technical Analysis' },
      { name: 'multi-indicator-system', src: 'multi-indicator-system.js', description: 'Multi-Panel System' },
      { name: 'recording-system', src: 'recording-system.js', description: 'Trading Recorder' }
    ];
    
    const loader = new ScriptLoader();
    
    // Add scripts
    (scripts.length ? scripts : defaultScripts).forEach(script => {
      loader.addScript(script.name, script.src, script.description);
    });
    
    // Only show overlay if requested
    if (showOverlay && autoStart) {
      await loader.loadScripts();
    } else if (autoStart) {
      // Load scripts without showing overlay
      await loader.loadScriptsQuietly();
    }
    
    return loader;
  }
  
  // Load scripts without showing the overlay (for navigation pages)
  async loadScriptsQuietly() {
    const totalScripts = this.scripts.length;
    let loadedCount = 0;
    
    console.log(`🔄 Loading ${totalScripts} scripts in background...`);
    
    for (let i = 0; i < this.scripts.length; i++) {
      const script = this.scripts[i];
      
      try {
        await this.loadScript(script.src);
        this.loadedScripts.add(script.name);
        loadedCount++;
        console.log(`✅ Loaded: ${script.description || script.name}`);
        
      } catch (error) {
        console.warn(`⚠️ Failed to load ${script.name}:`, error.message);
        this.failedScripts.add(script.name);
        loadedCount++;
      }
    }
    
    console.log(`✨ Background loading complete: ${this.loadedScripts.size}/${totalScripts} scripts loaded successfully`);
    return this;
  }
}

// Make it globally available
window.ScriptLoader = ScriptLoader;