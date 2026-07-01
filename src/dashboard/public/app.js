document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // State Variables
  let keywords = [];
  let locations = [];
  let isPolling = false;
  let pollIntervalId = null;
  let lastLogIndex = 0;
  let autoscroll = true;

  // DOM Elements
  const scrapeForm = document.getElementById('scrape-form');
  const keywordsInput = document.getElementById('keywords-input');
  const keywordsTags = document.getElementById('keywords-tags');
  const locationsInput = document.getElementById('locations-input');
  const locationsTags = document.getElementById('locations-tags');
  
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const downloadCombinedBtn = document.getElementById('download-combined-btn');
  
  const batchProgressContainer = document.getElementById('batch-progress-bar-container');
  const batchProgressLabel = document.getElementById('batch-progress-label');
  const batchProgressPercent = document.getElementById('batch-progress-percent');
  const batchProgressFill = document.getElementById('batch-progress-fill');
  
  const queueList = document.getElementById('queue-list');
  const consoleOutput = document.getElementById('console-output');
  const clearConsoleBtn = document.getElementById('clear-console-btn');
  const autoscrollToggle = document.getElementById('autoscroll-toggle');
  
  const globalStatusBadge = document.getElementById('global-status-badge');

  // API Base URL (Relative as we serve from same domain)
  const API_URL = '';

  // ==========================================
  // Tag Inputs & Suggestions Management
  // ==========================================

  function renderTags(list, containerId, removeCallback) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    list.forEach((val, idx) => {
      const tagEl = document.createElement('div');
      tagEl.className = 'tag';
      tagEl.innerHTML = `
        <span>${val}</span>
        <button type="button" data-idx="${idx}"><i data-lucide="x" style="width: 12px; height: 12px;"></i></button>
      `;
      container.appendChild(tagEl);
    });
    lucide.createIcons();

    // Attach click events to delete buttons
    container.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        removeCallback(idx);
      });
    });
  }

  function addKeyword(val) {
    const clean = val.trim();
    if (clean && !keywords.includes(clean)) {
      keywords.push(clean);
      renderTags(keywords, 'keywords-tags', removeKeyword);
      updateSuggestionHighlight('keyword-suggestions', keywords);
    }
  }

  function removeKeyword(idx) {
    keywords.splice(idx, 1);
    renderTags(keywords, 'keywords-tags', removeKeyword);
    updateSuggestionHighlight('keyword-suggestions', keywords);
  }

  function addLocation(val) {
    const clean = val.trim();
    if (clean && !locations.includes(clean)) {
      locations.push(clean);
      renderTags(locations, 'locations-tags', removeLocation);
      updateSuggestionHighlight('location-suggestions', locations);
    }
  }

  function removeLocation(idx) {
    locations.splice(idx, 1);
    renderTags(locations, 'locations-tags', removeLocation);
    updateSuggestionHighlight('location-suggestions', locations);
  }

  function updateSuggestionHighlight(containerId, list) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.suggest-tag').forEach(tag => {
      const val = tag.getAttribute('data-val');
      if (list.includes(val)) {
        tag.classList.add('active');
      } else {
        tag.classList.remove('active');
      }
    });
  }

  // Bind input listeners
  keywordsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (keywordsInput.value) {
        addKeyword(keywordsInput.value);
        keywordsInput.value = '';
      }
    }
  });

  locationsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (locationsInput.value) {
        addLocation(locationsInput.value);
        locationsInput.value = '';
      }
    }
  });

  // Suggestion click listeners
  document.querySelectorAll('.suggestions-list').forEach(listEl => {
    listEl.addEventListener('click', (e) => {
      const tag = e.target.closest('.suggest-tag');
      if (!tag) return;

      const val = tag.getAttribute('data-val');
      const isKeywordList = listEl.id === 'keyword-suggestions';

      if (isKeywordList) {
        if (keywords.includes(val)) {
          removeKeyword(keywords.indexOf(val));
        } else {
          addKeyword(val);
        }
      } else {
        if (locations.includes(val)) {
          removeLocation(locations.indexOf(val));
        } else {
          addLocation(val);
        }
      }
    });
  });

  // Pre-seed some default tags
  addKeyword('Restaurant');
  addLocation('Mumbai');

  // ==========================================
  // Console Log Utilities
  // ==========================================

  function addConsoleLine(text, level = 'SYSTEM') {
    const lineEl = document.createElement('div');
    lineEl.className = `console-line ${level.toLowerCase()}-line`;
    lineEl.textContent = text;
    consoleOutput.appendChild(lineEl);

    if (autoscroll) {
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  }

  clearConsoleBtn.addEventListener('click', () => {
    consoleOutput.innerHTML = '';
  });

  autoscrollToggle.addEventListener('click', () => {
    autoscroll = !autoscroll;
    autoscrollToggle.classList.toggle('active', autoscroll);
  });

  // ==========================================
  // API Calls & UI Updates
  // ==========================================

  async function pollStatus() {
    try {
      const response = await fetch(`${API_URL}/api/status`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();

      updateUI(data);
    } catch (err) {
      console.error('Error polling status:', err);
    }
  }

  function startPolling() {
    if (isPolling) return;
    isPolling = true;
    pollStatus();
    pollIntervalId = setInterval(pollStatus, 1500);
  }

  function stopPolling() {
    if (!isPolling) return;
    isPolling = false;
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
    }
  }

  function updateUI(data) {
    const { activeBatch, logs } = data;

    // Update global status badge
    if (activeBatch && activeBatch.status === 'running') {
      globalStatusBadge.className = 'status-badge status-running';
      globalStatusBadge.querySelector('.status-text').textContent = 'SCRAPING...';
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else if (activeBatch && activeBatch.status === 'completed') {
      globalStatusBadge.className = 'status-badge status-completed';
      globalStatusBadge.querySelector('.status-text').textContent = 'COMPLETED';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    } else if (activeBatch && activeBatch.status === 'stopped') {
      globalStatusBadge.className = 'status-badge status-stopped';
      globalStatusBadge.querySelector('.status-text').textContent = 'STOPPED';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    } else {
      globalStatusBadge.className = 'status-badge status-idle';
      globalStatusBadge.querySelector('.status-text').textContent = 'SYSTEM READY';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }

    // Render task logs
    if (logs && logs.length > lastLogIndex) {
      for (let i = lastLogIndex; i < logs.length; i++) {
        const logLine = logs[i];
        let level = 'INFO';
        if (logLine.includes('[ERROR]')) level = 'ERROR';
        else if (logLine.includes('[WARN]')) level = 'WARN';
        else if (logLine.includes('[DEBUG]')) level = 'DEBUG';
        
        addConsoleLine(logLine, level);
      }
      lastLogIndex = logs.length;
    }

    if (!activeBatch) {
      downloadCombinedBtn.disabled = true;
      batchProgressContainer.style.display = 'none';
      return;
    }

    // Update batch overall progress
    const totalTasks = activeBatch.tasks.length;
    const completedTasks = activeBatch.tasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'stopped').length;
    
    batchProgressContainer.style.display = 'flex';
    batchProgressLabel.textContent = `Batch Progress: ${completedTasks} / ${totalTasks} Completed`;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    batchProgressPercent.textContent = `${percentage}%`;
    batchProgressFill.style.width = `${percentage}%`;

    // Enable combined download button if at least one task is completed
    const hasCompletedTask = activeBatch.tasks.some(t => t.status === 'completed');
    downloadCombinedBtn.disabled = !hasCompletedTask;

    // Render task cards in list
    queueList.innerHTML = '';
    activeBatch.tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = `task-item task-${task.status}`;

      let taskProgressHtml = '';
      if (task.status === 'running') {
        const percent = task.total > 0 ? Math.round((task.current / task.total) * 100) : 0;
        taskProgressHtml = `
          <div class="progress-info" style="margin-top: 8px;">
            <span class="progress-label" style="font-size: 11px;">Scraping details...</span>
            <span class="progress-percentage" style="font-size: 11px;">${task.current} / ${task.total}</span>
          </div>
          <div class="progress-track" style="height: 4px; margin-top: 4px;">
            <div class="progress-bar" style="width: ${percent}%; height: 100%;"></div>
          </div>
        `;
      }

      let downloadSectionHtml = '';
      if (task.status === 'completed' && task.outputFolder) {
        downloadSectionHtml = `
          <div class="task-downloads">
            <span>Download Reports:</span>
            <a href="/api/download/task?outputFolder=${task.outputFolder}&format=xlsx" class="btn btn-secondary btn-mini"><i data-lucide="file-spreadsheet" style="width: 12px; height: 12px;"></i>Excel</a>
            <a href="/api/download/task?outputFolder=${task.outputFolder}&format=csv" class="btn btn-secondary btn-mini"><i data-lucide="file-text" style="width: 12px; height: 12px;"></i>CSV</a>
            <a href="/api/download/task?outputFolder=${task.outputFolder}&format=json" class="btn btn-secondary btn-mini"><i data-lucide="code" style="width: 12px; height: 12px;"></i>JSON</a>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="task-item-header">
          <div class="task-title">
            <i data-lucide="search" style="width: 16px; height: 16px; color: var(--text-secondary);"></i>
            <h3>${task.keyword} in ${task.location}</h3>
          </div>
          <span class="task-badge task-badge-${task.status}">${task.status}</span>
        </div>
        <p class="task-msg">${task.message}</p>
        <div class="task-stats">
          <div class="stat-item"><i data-lucide="database"></i><span>Rows: ${task.resultsCount}</span></div>
          ${task.error ? `<div class="stat-item" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i><span>Failed</span></div>` : ''}
        </div>
        ${taskProgressHtml}
        ${downloadSectionHtml}
      `;
      queueList.appendChild(card);
    });

    lucide.createIcons();
  }

  // ==========================================
  // Form Actions
  // ==========================================

  scrapeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (keywords.length === 0) {
      alert('Please add at least one keyword / business type.');
      return;
    }
    if (locations.length === 0) {
      alert('Please add at least one target location.');
      return;
    }

    const maxResults = parseInt(document.getElementById('max-results').value, 10) || 50;
    const headless = document.getElementById('headless-toggle').checked;

    addConsoleLine('[SYSTEM] Requesting server to start new batch scrape...', 'SYSTEM');
    
    try {
      const response = await fetch(`${API_URL}/api/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keywords,
          locations,
          maxResults,
          headless
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to start scrape');
      }

      const data = await response.json();
      lastLogIndex = 0;
      addConsoleLine('[SYSTEM] Scraper batch successfully initialized and started.', 'SYSTEM');
      
      updateUI(data);
      startPolling();
    } catch (err) {
      addConsoleLine(`[ERROR] Failed to start scraping: ${err.message}`, 'ERROR');
      alert(`Error starting scraper: ${err.message}`);
    }
  });

  stopBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to stop the scraper batch? Current task progress will be lost.')) {
      return;
    }

    addConsoleLine('[SYSTEM] Sending stop command to server...', 'WARN');
    
    try {
      const response = await fetch(`${API_URL}/api/stop`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to stop scrape');
      }

      addConsoleLine('[SYSTEM] Scraper halted. Clearing running tasks...', 'WARN');
    } catch (err) {
      addConsoleLine(`[ERROR] Failed to stop scraper: ${err.message}`, 'ERROR');
      alert(`Error stopping scraper: ${err.message}`);
    }
  });

  downloadCombinedBtn.addEventListener('click', () => {
    window.location.href = `${API_URL}/api/download/combined`;
  });

  // Start polling on page load to restore state if scraper is already running
  startPolling();
});
