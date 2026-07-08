/**
 * FudBin Dynamic Stow Time & ASIN Histogram Extractor
 * Core Application Logic
 */

// Global tooltip viewing preference state
window.currentTooltipView = 'asin';

window.toggleTooltipView = function(e, btn) {
  e.stopPropagation();
  e.preventDefault();
  
  const nextView = window.currentTooltipView === 'asin' ? 'container' : 'asin';
  window.currentTooltipView = nextView;
  
  // Instantly toggle all tooltips on the screen
  document.querySelectorAll('.bar-tooltip').forEach(tooltip => {
    const asinView = tooltip.querySelector('.tooltip-asin-view');
    const containerView = tooltip.querySelector('.tooltip-container-view');
    const toggleBtn = tooltip.querySelector('.tooltip-toggle-btn');
    
    if (asinView && containerView && toggleBtn) {
      if (nextView === 'asin') {
        asinView.style.display = 'block';
        containerView.style.display = 'none';
        toggleBtn.textContent = '📦 View Containers';
      } else {
        asinView.style.display = 'none';
        containerView.style.display = 'block';
        toggleBtn.textContent = '🏷️ View ASINs';
      }
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const jsonInput = document.getElementById('jsonInput');
  const parseBtn = document.getElementById('parseBtn');
  const formatBtn = document.getElementById('formatBtn');
  const clearBtn = document.getElementById('clearBtn');
  const parseStatus = document.getElementById('parseStatus');
  
  const augmentedInput = document.getElementById('augmentedInput');
  const addAugmentedBtn = document.getElementById('addAugmentedBtn');
  const clearAugmentedBtn = document.getElementById('clearAugmentedBtn');
  const augmentedStatus = document.getElementById('augmentedStatus');
  const toggleAugmentedListBtn = document.getElementById('toggleAugmentedListBtn');
  const augmentedListSection = document.getElementById('augmentedListSection');
  const pendingTotesList = document.getElementById('pendingTotesList');
  const foundTotesList = document.getElementById('foundTotesList');
  
  const simulatorPanel = document.getElementById('simulatorPanel');
  const timeSlider = document.getElementById('timeSlider');
  const sliderMinLabel = document.getElementById('sliderMinLabel');
  const sliderMaxLabel = document.getElementById('sliderMaxLabel');
  const sliderValLabel = document.getElementById('sliderValLabel');
  
  const simTimeUtc = document.getElementById('simTimeUtc');
  const simTimeLocal = document.getElementById('simTimeLocal');
  const readoutLabel = document.getElementById('readoutLabel');
  const activeStowsCount = document.getElementById('activeStowsCount');
  
  const playBtn = document.getElementById('playBtn');
  const stopBtn = document.getElementById('stopBtn');
  const livePlayheadBtn = document.getElementById('livePlayheadBtn');
  const simSpeed = document.getElementById('simSpeed');
  
  const histogramsSection = document.getElementById('histogramsSection');
  const chart1Container = document.getElementById('chart1');
  const chart2Container = document.getElementById('chart2');
  const chart3Container = document.getElementById('chart3');

  // Application State
  let rawData = [];
  let allDiscoveredRecords = []; // Extracted flat list of objects containing 'asin'
  let discoveredTimeKeys = []; // Available time variable keys
  let selectedTimeKey = null; // Chosen key for time binning
  let parsedStows = []; // Active stows: Array of { asin: string, time: Date, timestamp: number }
  let minTime = null;
  let maxTime = null;
  let simulatedCurrentTime = null; // unix timestamp in ms
  let earliestStowByDate = null; // Minimum value of stowByDate in the dataset
  let augmentedTotes = [];
  let augmentedFoundTotes = [];
  
  // Animation / Playback State
  let isPlaying = false;
  let isLivePlayheadActive = false;
  let isScanModeActive = false;
  let animationFrameId = null;
  let lastFrameTime = null;

  // Constants
  const MS_IN_HOUR = 60 * 60 * 1000;
  const MS_IN_MIN = 60 * 1000;

  // Initialize UI
  initApp();

  function initApp() {
    // Event Listeners
    parseBtn.addEventListener('click', handleParse);
    formatBtn.addEventListener('click', formatJSON);
    clearBtn.addEventListener('click', clearInput);
    timeSlider.addEventListener('input', handleSliderChange);
    playBtn.addEventListener('click', togglePlayback);
    stopBtn.addEventListener('click', stopPlayback);
    if (livePlayheadBtn) {
      livePlayheadBtn.addEventListener('click', toggleLivePlayhead);
    }
    
    // Initialize Augmented Containers list from localStorage
    initAugmentedContainers();
    if (addAugmentedBtn) {
      addAugmentedBtn.addEventListener('click', addAugmentedContainers);
    }
    if (clearAugmentedBtn) {
      clearAugmentedBtn.addEventListener('click', clearAllAugmentedContainers);
    }
    if (augmentedInput) {
      augmentedInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addAugmentedContainers();
        }
      });
    }
    if (toggleAugmentedListBtn && augmentedListSection) {
      toggleAugmentedListBtn.addEventListener('click', () => {
        const isCollapsed = augmentedListSection.classList.contains('collapsed-list');
        if (isCollapsed) {
          augmentedListSection.classList.remove('collapsed-list');
          toggleAugmentedListBtn.textContent = '⚙️ Collapse List';
        } else {
          augmentedListSection.classList.add('collapsed-list');
          toggleAugmentedListBtn.textContent = '⚙️ Expand List';
        }
      });
    }
    


    // Auto resize text area on paste/input
    jsonInput.addEventListener('input', () => {
      setStatus('idle', 'JSON modified. Click "Parse & Initialize" to update.');
    });

    // File upload button logic
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
          processFile(files[0]);
        }
      });
    }

    // Drag and drop logic on the textarea wrapper
    const textareaWrapper = jsonInput.closest('.textarea-wrapper');
    if (textareaWrapper) {
      textareaWrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        textareaWrapper.classList.add('drag-over');
      });
      textareaWrapper.addEventListener('dragleave', () => {
        textareaWrapper.classList.remove('drag-over');
      });
      textareaWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        textareaWrapper.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          processFile(files[0]);
        }
      });
    }

    function processFile(file) {
      const nameLower = file.name.toLowerCase();
      if (!nameLower.endsWith('.json') && !nameLower.endsWith('.txt')) {
        setStatus('error', 'Error: Only JSON or TXT files are supported.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        jsonInput.value = event.target.result;
        setStatus('idle', `Loaded "${file.name}" successfully.`);
        handleParse();
      };
      reader.onerror = () => {
        setStatus('error', 'Error: Failed to read local file.');
      };
      reader.readAsText(file);
    }

    // Initialize sticky tooltips behavior
    setupTooltipBehavior();

    // Start System Real-Time Clock
    startRealTimeClock();

    // Initialize Scanner Integration
    initScannerIntegration();

    // Initialize Fullscreen Card Toggles
    initFullscreenToggles();
    
    // Wire Collapsible Input Card
    initInputCollapseToggle();
  }

  // Real-time clock updater
  function startRealTimeClock() {
    const clockEl = document.getElementById('realTimeClock');
    if (!clockEl) return;

    function update() {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      
      // Keep NOW marker synchronized with system time
      updateRealTimeMarker();
      
      // If Live Mode is active, update playhead to real-world current time
      if (isLivePlayheadActive) {
        simulatedCurrentTime = Date.now();
        if (timeSlider) {
          timeSlider.value = simulatedCurrentTime;
        }
        updateSimulationReadouts();
        updateHistograms();
      }
    }
    
    update();
    setInterval(update, 1000);
  }

  // Set the visual parsing status
  function setStatus(type, message) {
    parseStatus.className = `status-indicator ${type}`;
    const text = parseStatus.querySelector('.status-text');
    text.textContent = message;
  }

  // Format the JSON in the text box nicely
  function formatJSON() {
    try {
      const val = jsonInput.value.trim();
      if (!val) return;
      const parsed = JSON.parse(val);
      jsonInput.value = JSON.stringify(parsed, null, 2);
      setStatus('idle', 'JSON formatted successfully.');
    } catch (e) {
      setStatus('error', `Format error: ${e.message}`);
    }
  }

  // Clear input fields
  function clearInput() {
    jsonInput.value = '';
    setStatus('idle', 'Awaiting JSON input...');
    resetSimulationState();
  }

  // Reset all simulation and chart elements to clean hidden state
  function resetSimulationState() {
    stopPlayback();
    disableLivePlayhead();
    rawData = [];
    allDiscoveredRecords = [];
    discoveredTimeKeys = [];
    selectedTimeKey = null;
    parsedStows = [];
    minTime = null;
    maxTime = null;
    simulatedCurrentTime = null;
    earliestStowByDate = null;
    

    simulatorPanel.classList.add('hidden');
    histogramsSection.classList.add('hidden');

    const locSummary = document.getElementById('locationSummaryContainer');
    if (locSummary) locSummary.classList.add('hidden');

    // Reset input collapsible card
    const inputSection = document.getElementById('inputSection');
    const toggleInputBtn = document.getElementById('toggleInputCollapseBtn');
    if (inputSection) inputSection.classList.remove('collapsed-input');
    if (toggleInputBtn) {
      toggleInputBtn.style.display = 'none';
      toggleInputBtn.textContent = '⚙️ Collapse Input';
    }

    checkScannerCardVisibility();
  }

  // Recursive search to look for all objects containing 'asin' in the structure
  function findRecordsWithAsin(obj, records = []) {
    if (!obj || typeof obj !== 'object') return records;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        findRecordsWithAsin(item, records);
      }
    } else {
      const asinKey = Object.keys(obj).find(k => k.toLowerCase() === 'asin');
      if (asinKey && obj[asinKey] !== null && obj[asinKey] !== undefined) {
        records.push(obj);
        return records; // Found the record level, don't recurse deeper
      }
      for (const val of Object.values(obj)) {
        if (typeof val === 'object' && val !== null) {
          findRecordsWithAsin(val, records);
        }
      }
    }
    return records;
  }

  // Inspect records to discover possible date/timestamp variables
  function findPotentialTimeKeys(records) {
    const keys = new Set();
    const dateKeywords = /date|time|utc|psd|created|attached/i;
    
    records.forEach(rec => {
      for (const [key, val] of Object.entries(rec)) {
        if (typeof val === 'number') {
          // Check if value is a valid UTC unix timestamp (seconds or milliseconds)
          // Year 2001+ is > 1000000000 (seconds)
          if (val > 1000000000) {
            keys.add(key);
          }
        } else if (typeof val === 'string' && val.trim() !== '') {
          // Check if value is a parseable date string
          if (dateKeywords.test(key) && !isNaN(Date.parse(val))) {
            keys.add(key);
          }
        }
      }
    });
    
    return Array.from(keys);
  }

  // Sort variables to rank the most logical default first
  function sortTimeKeys(keys) {
    const score = key => {
      const k = key.toLowerCase();
      if (k.includes('stow')) return 100;
      if (k.includes('utc')) return 90;
      if (k.includes('timestamp')) return 80;
      if (k.includes('time')) return 70;
      if (k.includes('created')) return 60;
      if (k.includes('attached')) return 50;
      if (k.includes('date')) return 40;
      return 0;
    };
    return [...keys].sort((a, b) => score(b) - score(a));
  }

  // Core JSON Parser
  function handleParse() {
    resetSimulationState();
    const rawVal = jsonInput.value.trim();
    
    if (!rawVal) {
      setStatus('error', 'Error: Input is empty.');
      return;
    }

    try {
      const parsed = JSON.parse(rawVal);
      
      // Perform recursive search for ASIN records
      allDiscoveredRecords = findRecordsWithAsin(parsed);

      if (allDiscoveredRecords.length === 0) {
        throw new Error('Could not find any objects containing an "asin" key in the JSON tree structure.');
      }

      // Find earliest stowByDate in the records to set as initial simulation current time
      let stowByDates = [];
      allDiscoveredRecords.forEach(rec => {
        const stowByKey = Object.keys(rec).find(k => k.toLowerCase() === 'stowbydate');
        if (stowByKey && rec[stowByKey] !== undefined && rec[stowByKey] !== null) {
          const val = rec[stowByKey];
          let ts = null;
          if (typeof val === 'number') {
            ts = val < 100000000000 ? val * 1000 : val;
          } else if (!isNaN(Date.parse(val))) {
            ts = Date.parse(val);
          }
          if (ts) {
            stowByDates.push(ts);
          }
        }
      });
      
      if (stowByDates.length === 0) {
        throw new Error('Could not find any "stowByDate" keys in the JSON records.');
      }

      earliestStowByDate = Math.min(...stowByDates);

      // Auto-detect the exact casing of stowByDate in the first record
      const sampleRec = allDiscoveredRecords[0];
      selectedTimeKey = Object.keys(sampleRec).find(k => k.toLowerCase() === 'stowbydate') || 'stowByDate';

      setTimeVariable(selectedTimeKey);

      // Show simulator, scanner section, and charts
      checkScannerCardVisibility();
      simulatorPanel.classList.remove('hidden');
      histogramsSection.classList.remove('hidden');
      
      // Auto-collapse JSON text box to clear screen space
      const inputSection = document.getElementById('inputSection');
      const toggleInputBtn = document.getElementById('toggleInputCollapseBtn');
      if (inputSection) inputSection.classList.add('collapsed-input');
      if (toggleInputBtn) {
        toggleInputBtn.style.display = 'block';
        toggleInputBtn.textContent = '⚙️ Expand Input';
      }

      // Calculate aggregates
      const uniqueAsins = new Set();
      const uniqueContainers = new Set();
      let tsxCount = 0;
      let csxCount = 0;

      allDiscoveredRecords.forEach(rec => {
        // ASIN
        const asinKey = Object.keys(rec).find(k => k.toLowerCase() === 'asin');
        if (asinKey && rec[asinKey]) {
          uniqueAsins.add(String(rec[asinKey]).trim().toUpperCase());
        }

        // Container
        const containerId = rec.outermostScannableId || rec.scannableId;
        if (containerId) {
          uniqueContainers.add(String(containerId).trim().toUpperCase());
        }

        // Scannable ID starts with tsX / csX
        const scannable = String(rec.scannableId || rec.outermostScannableId || '').toLowerCase();
        if (scannable.startsWith('tsx')) {
          tsxCount++;
        } else if (scannable.startsWith('csx')) {
          csxCount++;
        }
      });

      const totalItems = allDiscoveredRecords.length;
      const tsxPct = totalItems > 0 ? Math.round((tsxCount / totalItems) * 100) : 0;
      const csxPct = totalItems > 0 ? Math.round((csxCount / totalItems) * 100) : 0;

      setStatus('success', 
        `Found ${totalItems} records! • ` +
        `${uniqueContainers.size} containers • ` +
        `${uniqueAsins.size} unique ASINs • ` +
        `tsX (totes): ${tsxPct}% • ` +
        `csX (cases): ${csxPct}%`
      );
      
      // Calculate warehouse locations summary
      const locationList = allDiscoveredRecords
        .map(rec => rec.outermostScannableId || rec.scannableId)
        .filter(Boolean);
      updateWarehouseLocationsSummary(locationList);

      // Smooth scroll to control panel
      simulatorPanel.scrollIntoView({ behavior: 'smooth' });

    } catch (e) {
      console.error(e);
      setStatus('error', `Parsing Error: ${e.message}`);
    }
  }

  // Set selected variable and parse details
  function setTimeVariable(key) {
    selectedTimeKey = key;
    parsedStows = [];
    
    allDiscoveredRecords.forEach(rec => {
      const asinKey = Object.keys(rec).find(k => k.toLowerCase() === 'asin');
      const asin = String(rec[asinKey]).trim();
      const timeVal = rec[key];
      
      let parsedDate = null;
      if (timeVal !== undefined && timeVal !== null) {
        if (typeof timeVal === 'number' || !isNaN(Number(timeVal))) {
          const num = Number(timeVal);
          // Auto-detect seconds vs milliseconds
          if (num < 100000000000) {
            parsedDate = new Date(num * 1000);
          } else {
            parsedDate = new Date(num);
          }
        } else {
          parsedDate = new Date(timeVal);
        }
      }

      if (parsedDate && !isNaN(parsedDate.getTime())) {
        parsedStows.push({
          asin: asin,
          time: parsedDate,
          timestamp: parsedDate.getTime(),
          originalRecord: rec
        });
      }
    });

    if (parsedStows.length === 0) {
      setStatus('error', `Error: Selected variable "${key}" could not compile into valid timestamps.`);
      return;
    }

    // Sort chronologically
    parsedStows.sort((a, b) => a.timestamp - b.timestamp);

    // Playhead is exactly 24 hours from the earliest stow
    minTime = parsedStows[0].timestamp;
    maxTime = Math.max(minTime + 24 * MS_IN_HOUR, Date.now() + 24 * MS_IN_HOUR);

    setupSimulationSlider();
    buildFineResolutionChartLayout();

    const realNow = Date.now();
    const hasOverlap = (realNow >= minTime && realNow <= maxTime);
    if (hasOverlap) {
      enableLivePlayhead();
    } else {
      disableLivePlayhead();
      // Initialize simulated time to earliestStowByDate if it exists and falls inside the playhead, otherwise minTime
      if (earliestStowByDate !== null && earliestStowByDate >= minTime && earliestStowByDate <= maxTime) {
        simulatedCurrentTime = earliestStowByDate;
      } else {
        simulatedCurrentTime = minTime;
      }
      timeSlider.value = simulatedCurrentTime;
      updateSimulationReadouts();
      updateHistograms();
    }
  }

  // Setup the simulation slider values
  function setupSimulationSlider() {
    timeSlider.min = minTime;
    timeSlider.max = maxTime;
    timeSlider.value = minTime;
    
    // Label updates
    sliderMinLabel.textContent = formatDateLabel(new Date(minTime));
    sliderMaxLabel.textContent = formatDateLabel(new Date(maxTime));
    updateSliderValLabel(minTime);
  }

  // Format dates for labels in simple readable format
  function formatDateLabel(date) {
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const mins = String(date.getUTCMinutes()).padStart(2, '0');
    const day = date.getUTCDate();
    const month = date.toLocaleString('default', { month: 'short', timeZone: 'UTC' });
    return `${day} ${month} ${hours}:${mins} (UTC)`;
  }

  // Update slider position readout text
  function updateSliderValLabel(time) {
    const d = new Date(time);
    const hrs = String(d.getUTCHours()).padStart(2, '0');
    const mins = String(d.getUTCMinutes()).padStart(2, '0');
    sliderValLabel.textContent = `${hrs}:${mins} UTC`;
  }

  // Handle manual dragging of the slider
  function handleSliderChange(e) {
    if (isPlaying) {
      stopPlayback();
    }
    if (isLivePlayheadActive) {
      disableLivePlayhead();
    }
    
    simulatedCurrentTime = Number(e.target.value);
    updateSimulationReadouts();
    updateHistograms();
  }

  // Update readouts for simulated time and active stows
  function updateSimulationReadouts() {
    const simDate = new Date(simulatedCurrentTime);
    
    // Format UTC Time Display
    simTimeUtc.textContent = simDate.toUTCString().replace('GMT', 'UTC');
    
    // Format Local Time Display
    simTimeLocal.textContent = simDate.toLocaleString();

    const isForward = isVariableForwardLooking(selectedTimeKey);
    
    // Update readout label text dynamically
    if (readoutLabel) {
      readoutLabel.textContent = isForward ? 'Fud still within time' : 'Fud waiting in warehouse';
    }

    // Calculate active stows based on forward/backward direction
    const activeCount = parsedStows.filter(s => {
      return isForward ? s.timestamp >= simulatedCurrentTime : s.timestamp <= simulatedCurrentTime;
    }).length;
    activeStowsCount.textContent = `${activeCount} / ${parsedStows.length}`;
    
    updateSliderValLabel(simulatedCurrentTime);
    updateRealTimeMarker();
  }

  // Playback control functions
  function togglePlayback() {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    if (isLivePlayheadActive) {
      disableLivePlayhead();
    }
    if (simulatedCurrentTime >= maxTime) {
      simulatedCurrentTime = minTime;
      timeSlider.value = minTime;
    }

    isPlaying = true;
    playBtn.textContent = '⏸ Pause';
    playBtn.classList.add('active');
    stopBtn.disabled = false;
    
    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(simulationTick);
  }

  function stopPlayback() {
    isPlaying = false;
    playBtn.textContent = '▶ Play';
    playBtn.classList.remove('active');
    stopBtn.disabled = true;
    
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // Playback tick
  function simulationTick(now) {
    if (!isPlaying) return;

    const deltaMs = now - lastFrameTime;
    lastFrameTime = now;

    const speedCoefficient = Number(simSpeed.value);
    const simulatedDelta = deltaMs * speedCoefficient;

    simulatedCurrentTime += simulatedDelta;

    if (simulatedCurrentTime >= maxTime) {
      simulatedCurrentTime = maxTime;
      timeSlider.value = maxTime;
      updateSimulationReadouts();
      updateHistograms();
      stopPlayback();
      return;
    }

    timeSlider.value = simulatedCurrentTime;
    updateSimulationReadouts();
    updateHistograms();

    animationFrameId = requestAnimationFrame(simulationTick);
  }

  // Build the fine resolution layout skeleton (Graph 3)
  function buildFineResolutionChartLayout() {
    chart3Container.innerHTML = '';
    
    // Create 96 bars representing 15m intervals going back 24h (1440 minutes)
    for (let i = 0; i < 96; i++) {
      const barContainer = document.createElement('div');
      
      // Assign shift classes based on chronological mapping
      let shiftClass = '';
      if (i < 24) {
        shiftClass = 'shift-1'; // 18-24h
      } else if (i < 48) {
        shiftClass = 'shift-2'; // 12-18h
      } else if (i < 64) {
        shiftClass = 'shift-3'; // 8-12h
      } else {
        shiftClass = 'shift-4'; // <8h
      }
      
      barContainer.className = `bar-container ${shiftClass}`;
      barContainer.style.setProperty('--bar-height', '0%');
      barContainer.setAttribute('data-bin', i);

      const tooltip = document.createElement('div');
      tooltip.className = 'bar-tooltip';
      tooltip.textContent = 'Loading...';

      const barValue = document.createElement('div');
      barValue.className = 'bar-value';
      barValue.textContent = '0';

      const barGlow = document.createElement('div');
      barGlow.className = 'bar-glow';

      const bar = document.createElement('div');
      bar.className = 'bar';

      const label = document.createElement('div');
      label.className = 'bar-label';
      
      // Decouple full hover label from short visible label
      const isForward = isVariableForwardLooking(selectedTimeKey);
      if (i === 95) {
        label.textContent = isLivePlayheadActive ? 'Now' : 'Miss';
      } else if (i === 0) {
        label.textContent = isForward ? '+24h' : '-24h';
      } else if ((95 - i) % 8 === 0) {
        const symbol = isForward ? '+' : '-';
        label.textContent = `${symbol}${(95 - i) / 4}h`;
      } else {
        label.textContent = '';
      }

      barContainer.appendChild(tooltip);
      barContainer.appendChild(barValue);
      barContainer.appendChild(barGlow);
      barContainer.appendChild(bar);
      barContainer.appendChild(label);
      chart3Container.appendChild(barContainer);
    }
  }

  // Master update function for all 3 histograms
  function updateHistograms() {
    if (chart3Container) {
      const rightmostLabel = chart3Container.querySelector('.bar-container[data-bin="95"] .bar-label');
      if (rightmostLabel) {
        rightmostLabel.textContent = isLivePlayheadActive ? 'Now' : 'Miss';
      }
    }

    const isForward = isVariableForwardLooking(selectedTimeKey);
    const activeStows = parsedStows.filter(s => {
      return isForward ? s.timestamp >= simulatedCurrentTime : s.timestamp <= simulatedCurrentTime;
    });

    // Bins
    const graph1Bins = [[], []];
    const graph2Bins = [[], [], [], []];
    const graph3Bins = Array.from({ length: 96 }, () => []);

    activeStows.forEach(stow => {
      const deltaMs = isForward ? stow.timestamp - simulatedCurrentTime : simulatedCurrentTime - stow.timestamp;
      const deltaHours = deltaMs / MS_IN_HOUR;
      const deltaMins = deltaMs / MS_IN_MIN;

      // Grouping logic for Graph 1
      if (deltaHours >= 0 && deltaHours < 4) {
        graph1Bins[1].push(stow); // < 4 hours (Bin 1)
      } else if (deltaHours >= 4 && deltaHours < 24) {
        graph1Bins[0].push(stow); // 4 - 24 hours (Bin 0)
      }

      // Grouping logic for Graph 2
      if (deltaHours >= 0 && deltaHours < 8) {
        graph2Bins[3].push(stow); // < 8 Hours
      } else if (deltaHours >= 8 && deltaHours < 12) {
        graph2Bins[2].push(stow); // 8 - 12 Hours
      } else if (deltaHours >= 12 && deltaHours < 18) {
        graph2Bins[1].push(stow); // 12 - 18 Hours
      } else if (deltaHours >= 18 && deltaHours < 24) {
        graph2Bins[0].push(stow); // 18 - 24 Hours
      }

      // Grouping logic for Graph 3 (Next/Last 24 hours in 15m bins, oldest to newest)
      if (deltaMins >= 0 && deltaMins < 1440) {
        const binIndex = 95 - Math.floor(deltaMins / 15);
        if (binIndex >= 0 && binIndex < 96) {
          graph3Bins[binIndex].push(stow);
        }
      }
    });

    const prefix = isForward ? 'Due in ' : 'Age: ';
    const suffix = isForward ? '' : ' ago';

    updateChartDom(chart1Container, graph1Bins, [
      `${prefix}4 - 24 Hours${suffix}`, 
      `${prefix}< 4 Hours${suffix}`
    ]);
    
    updateChartDom(chart2Container, graph2Bins, [
      `${prefix}18 - 24 Hours${suffix}`, 
      `${prefix}12 - 18 Hours${suffix}`, 
      `${prefix}8 - 12 Hours${suffix}`, 
      `${prefix}< 8 Hours${suffix}`
    ]);
    
    updateChartDom(chart3Container, graph3Bins, Array.from({ length: 96 }, (_, i) => {
      const startMin = (95 - i) * 15;
      const endMin = (96 - i) * 15;
      if (i === 95) {
        return isForward ? 'Due in < 15m' : 'Recent (< 15m ago)';
      }
      return `${prefix}${startMin} to ${endMin} min${suffix}`;
    }));
  }

  // Update the height style properties and tooltips on the DOM elements
  function updateChartDom(container, bins, binLabels) {
    const counts = bins.map(b => b.length);
    const maxCount = Math.max(...counts, 1);

    bins.forEach((stowArray, index) => {
      const barContainer = container.querySelector(`.bar-container[data-bin="${index}"]`);
      if (!barContainer) return;

      const heightPercentage = (stowArray.length / maxCount) * 100;
      barContainer.style.setProperty('--bar-height', `${heightPercentage}%`);

      // Toggle empty-bar class dynamically
      if (stowArray.length === 0) {
        barContainer.classList.add('empty-bar');
      } else {
        barContainer.classList.remove('empty-bar');
      }

      const valueEl = barContainer.querySelector('.bar-value');
      if (valueEl) {
        valueEl.textContent = stowArray.length;
      }

      const tooltipEl = barContainer.querySelector('.bar-tooltip');
      if (tooltipEl) {
        tooltipEl.innerHTML = buildTooltipHtml(binLabels[index], stowArray);
      }
    });
  }

  // Helper to build HTML tooltip layouts containing needed item information
  function buildTooltipHtml(title, items) {
    const isContainerView = window.currentTooltipView === 'container';
    
    let html = `
      <div class="tooltip-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 4px; margin-bottom: 6px;">
        <span class="tooltip-title" style="font-weight: 700; color: var(--accent-secondary); font-size: 0.72rem; border-bottom: none; padding-bottom: 0; margin-bottom: 0;">${title}</span>
        <button class="tooltip-toggle-btn" onclick="window.toggleTooltipView(event, this)">${isContainerView ? '🏷️ View ASINs' : '📦 View Containers'}</button>
      </div>
    `;
    
    if (items.length === 0) {
      html += `<div style="color: var(--text-dark); text-align: center; margin-top: 10px;">No items needed in this period.</div>`;
      return html;
    }

    // 1. ASIN VIEW DATA
    const asinCounts = {};
    items.forEach(item => {
      asinCounts[item.asin] = (asinCounts[item.asin] || 0) + 1;
    });
    const sortedAsins = Object.entries(asinCounts).sort((a, b) => b[1] - a[1]);

    // 2. CONTAINER VIEW DATA (Grouped by outermostScannableId, aggregated by scannableId)
    const containerGroups = {};
    const allScannables = new Set();
    
    items.forEach(item => {
      const parentId = item.originalRecord?.outermostScannableId || item.originalRecord?.scannableId || 'Unknown Container';
      if (!containerGroups[parentId]) {
        containerGroups[parentId] = {
          scannables: new Set(),
          unitsCount: 0
        };
      }
      containerGroups[parentId].unitsCount++;
      
      const scannableId = item.originalRecord?.scannableId;
      if (scannableId) {
        containerGroups[parentId].scannables.add(scannableId);
        allScannables.add(scannableId);
      }
    });

    const sortedContainers = Object.entries(containerGroups)
      .sort((a, b) => b[1].unitsCount - a[1].unitsCount);
      
    const totalContainers = Object.keys(containerGroups).length;
    const totalScannables = allScannables.size;
    const avgItems = totalScannables > 0 ? (items.length / totalScannables).toFixed(1) : 0;

    // ASIN VIEW PANEL
    html += `<div class="tooltip-view-section tooltip-asin-view" style="display: ${isContainerView ? 'none' : 'block'};">`;
    html += `<div class="tooltip-meta" style="font-size: 0.6rem; color: var(--text-muted); margin-bottom: 4px;">Total: ${items.length} items needed</div>`;
    html += `<ul class="tooltip-list">`;
    sortedAsins.forEach(([asin, count]) => {
      const percent = Math.round((count / items.length) * 100);
      const url = `https://fcresearch-eu.aka.amazon.com/NCL1/results?s=${asin}`;
      html += `
        <li class="tooltip-item">
          <a href="${url}" target="_blank" class="tooltip-asin-link">${asin}</a>
          <span class="tooltip-time">${count}x (${percent}%)</span>
        </li>
      `;
    });
    html += `</ul></div>`;

    // CONTAINER VIEW PANEL
    html += `<div class="tooltip-view-section tooltip-container-view" style="display: ${isContainerView ? 'block' : 'none'};">`;
    html += `<div class="tooltip-meta" style="font-size: 0.6rem; color: var(--text-muted); margin-bottom: 4px;">Total: ${totalContainers} containers (${totalScannables} scannables, avg ${avgItems} units/scannable)</div>`;
    html += `<ul class="tooltip-list">`;
    sortedContainers.forEach(([parentId, data]) => {
      const scannablesCount = data.scannables.size;
      html += `
        <li class="tooltip-item" style="flex-direction: column; align-items: flex-start; padding: 4px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
          <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
            <span class="tooltip-container-id" style="font-size: 0.7rem; font-weight: 600;">${parentId}</span>
            <span class="tooltip-time" style="color: #fff; font-weight: 600; font-size: 0.68rem;">${data.unitsCount} items</span>
          </div>
          <div style="font-size: 0.58rem; color: var(--text-muted); margin-top: 1px; opacity: 0.8;">
            📦 ${scannablesCount} scannable ID${scannablesCount !== 1 ? 's' : ''} (totes)
          </div>
        </li>
      `;
    });
    html += `</ul></div>`;

    return html;
  }

  // Detect if a time key represents a forward-looking deadline
  function isVariableForwardLooking(varName) {
    if (!varName) return false;
    const nameLower = varName.toLowerCase();
    return nameLower.includes('stowby') || nameLower.includes('needby') || nameLower.includes('psd');
  }

  // Manage tooltips dynamically to allow scrolling and sticky behavior
  function setupTooltipBehavior() {
    let activeTimeout = null;
    let currentActiveContainer = null;

    const chartContainers = [chart1Container, chart2Container, chart3Container];
    
    chartContainers.forEach(chart => {
      // Event delegation for mouseover
      chart.addEventListener('mouseover', (e) => {
        const barContainer = e.target.closest('.bar-container');
        if (!barContainer || barContainer.classList.contains('empty-bar')) return;

        // If mouse is moving within the same active container, do nothing
        if (currentActiveContainer === barContainer) {
          clearTimeout(activeTimeout);
          return;
        }

        // Close the previous active tooltip immediately
        if (currentActiveContainer) {
          currentActiveContainer.classList.remove('active-tooltip');
        }

        clearTimeout(activeTimeout);
        currentActiveContainer = barContainer;
        barContainer.classList.add('active-tooltip');
      });

      // Event delegation for mouseout
      chart.addEventListener('mouseout', (e) => {
        const barContainer = e.target.closest('.bar-container');
        if (!barContainer) return;

        // Check if mouse is moving to a child element (e.g. into the tooltip)
        const related = e.relatedTarget;
        if (related && barContainer.contains(related)) {
          // Still hovering inside the container boundaries or child elements
          return;
        }

        // Delay the fade-out slightly to allow the mouse to bridge the gap into the tooltip
        clearTimeout(activeTimeout);
        activeTimeout = setTimeout(() => {
          if (currentActiveContainer) {
            currentActiveContainer.classList.remove('active-tooltip');
            currentActiveContainer = null;
          }
        }, 500); // 500ms grace period
      });
    });
  }

  // Scanner Integration Logic

  function initScannerIntegration() {
    const toggle = document.getElementById('scanModeToggle');
    const hiddenInput = document.getElementById('barcodeHiddenInput');
    const panel = document.getElementById('scanStatusPanel');
    const text = document.getElementById('scanStatusText');
    const resultCard = document.getElementById('scanResultCard');
    
    if (!toggle || !hiddenInput) return;

    toggle.addEventListener('change', (e) => {
      isScanModeActive = e.target.checked;
      
      if (isScanModeActive) {
        if (panel) panel.className = 'scan-status-panel listening';
        if (text) text.textContent = 'Listening for scans... Scan barcode with handheld device.';
        if (resultCard) resultCard.classList.add('hidden');
        
        // Lock focus to the hidden barcode input
        setTimeout(() => hiddenInput.focus(), 50);
      } else {
        disableScanMode();
      }
    });

    // Intercept scanning keys inside hidden input
    hiddenInput.addEventListener('keydown', (e) => {
      if (!isScanModeActive) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        const code = hiddenInput.value.trim();
        if (code.length > 0) {
          processBarcode(code);
        }
        hiddenInput.value = '';
      }
    });

    // Global document click listener: keep refocusing the hidden scanner input
    // so the user never loses keyboard focus (unless editing inputs/textareas)
    document.addEventListener('click', (e) => {
      if (!isScanModeActive) return;
      
      // Do not hijack focus if user clicked inside input/textarea boxes or selects
      const target = e.target;
      const isInputBox = target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || 
                         (target.tagName === 'INPUT' && target !== toggle && target !== hiddenInput);
      
      if (isInputBox) return;

      // Refocus hidden scanner input
      hiddenInput.focus();
    });

    // In-browser mock test barcode injector
    const injectBtn = document.getElementById('injectTestBtn');
    if (injectBtn) {
      injectBtn.addEventListener('click', () => {
        const baseTime = minTime || Date.now();
        
        const mockRecords = [
          {
            asin: "TEST-FUD-CYAN",
            outermostScannableId: "dz-TEST-CYAN",
            scannableId: "tote-CYAN-01",
            warehouseId: "NCL1",
            stowByDate: new Date(baseTime + 2 * MS_IN_HOUR).toISOString()
          },
          {
            asin: "TEST-FUD-INDIGO",
            outermostScannableId: "dz-TEST-INDIGO",
            scannableId: "tote-INDIGO-01",
            warehouseId: "NCL1",
            stowByDate: new Date(baseTime + 10 * MS_IN_HOUR).toISOString()
          },
          {
            asin: "TEST-FUD-FUCHSIA",
            outermostScannableId: "dz-TEST-FUCHSIA",
            scannableId: "tote-FUCHSIA-01",
            warehouseId: "NCL1",
            stowByDate: new Date(baseTime + 15 * MS_IN_HOUR).toISOString()
          },
          {
            asin: "TEST-FUD-ORANGE",
            outermostScannableId: "dz-TEST-ORANGE",
            scannableId: "tote-ORANGE-01",
            warehouseId: "NCL1",
            stowByDate: new Date(baseTime + 20 * MS_IN_HOUR).toISOString()
          },
          {
            asin: "TEST-FUD-OVERDUE",
            outermostScannableId: "dz-TEST-RED",
            scannableId: "tote-RED-01",
            warehouseId: "NCL1",
            stowByDate: new Date(baseTime - 1.5 * MS_IN_HOUR).toISOString()
          }
        ];

        // Inject stows
        mockRecords.forEach(rec => {
          if (!parsedStows.some(stow => stow.asin === rec.asin)) {
            const parsedDate = new Date(rec.stowByDate);
            parsedStows.push({
              asin: rec.asin,
              time: parsedDate,
              timestamp: parsedDate.getTime(),
              originalRecord: rec
            });
            allDiscoveredRecords.push(rec);
          }
        });

        // Re-sort and refresh
        parsedStows.sort((a, b) => a.timestamp - b.timestamp);
        updateHistograms();
        
        alert("🧪 Injected 5 dynamic test barcodes into the dataset:\n\n" +
              "• TEST-FUD-CYAN (Due in 2h - Cyan Alert)\n" +
              "• TEST-FUD-INDIGO (Due in 10h - Indigo Alert)\n" +
              "• TEST-FUD-FUCHSIA (Due in 15h - Fuchsia Alert)\n" +
              "• TEST-FUD-ORANGE (Due in 20h - Orange Alert)\n" +
              "• TEST-FUD-OVERDUE (Due 1.5h ago - Red Alert)\n\n" +
              "You can now scan these ASINs or container IDs to test the shift highlight colors!");
      });
    }
  }

  function disableScanMode() {
    isScanModeActive = false;
    const hiddenInput = document.getElementById('barcodeHiddenInput');
    const panel = document.getElementById('scanStatusPanel');
    const text = document.getElementById('scanStatusText');
    const resultCard = document.getElementById('scanResultCard');
    
    if (hiddenInput) {
      hiddenInput.value = '';
      hiddenInput.blur();
    }
    if (panel) {
      panel.className = 'scan-status-panel idle';
      panel.style.borderColor = '';
      panel.style.boxShadow = '';
      panel.style.background = '';
      const indicator = panel.querySelector('.scan-status-indicator');
      if (indicator) {
        indicator.style.backgroundColor = '';
        indicator.style.boxShadow = '';
      }
    }
    if (text) text.textContent = 'Scan Mode is inactive. Toggle on to begin.';
    if (resultCard) {
      resultCard.classList.add('hidden');
      const resultHeader = document.getElementById('resultHeader');
      if (resultHeader) {
        resultHeader.style.color = '';
        resultHeader.style.textShadow = '';
      }
    }
  }

  function processBarcode(code) {
    const panel = document.getElementById('scanStatusPanel');
    const text = document.getElementById('scanStatusText');
    const resultCard = document.getElementById('scanResultCard');
    
    const resAsin = document.getElementById('resAsin');
    const resContainer = document.getElementById('resContainer');
    const resDeadline = document.getElementById('resDeadline');
    const resultHeader = document.getElementById('resultHeader');

    if (!panel || !text || !resultCard) return;

    const query = code.toUpperCase();
    
    // Search all matching stows (could be multiple if container holds multiple items)
    const matches = parsedStows.filter(stow => {
      const rec = stow.originalRecord;
      const asin = stow.asin.toUpperCase();
      const outerContainer = (rec?.outermostScannableId || '').toUpperCase();
      const innerContainer = (rec?.scannableId || '').toUpperCase();
      
      return asin === query || outerContainer === query || innerContainer === query;
    });

    const getRgba = (colorHex, alpha) => {
      if (colorHex.startsWith('var')) {
        return colorHex === 'var(--accent-secondary)' ? `rgba(6, 182, 212, ${alpha})` : `rgba(16, 185, 129, ${alpha})`;
      }
      const r = parseInt(colorHex.slice(1, 3), 16);
      const g = parseInt(colorHex.slice(3, 5), 16);
      const b = parseInt(colorHex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    if (matches.length > 0) {
      // Ensure priority FUD rows are visible, and augmented action row is hidden
      const resAsinRow = document.getElementById('resAsinRow');
      if (resAsinRow) resAsinRow.classList.remove('hidden');
      const resDeadlineRow = document.getElementById('resDeadlineRow');
      if (resDeadlineRow) resDeadlineRow.classList.remove('hidden');
      const augmentedActionRow = document.getElementById('resAugmentedActionRow');
      if (augmentedActionRow) augmentedActionRow.classList.add('hidden');
      // Sort matches chronologically to find the earliest (most urgent) deadline
      matches.sort((a, b) => a.timestamp - b.timestamp);
      const earliestMatch = matches[0];

      // Calculate remaining time relative to System Real Time if it overlaps, otherwise fall back to Simulated Current Time
      const realNow = new Date().getTime();
      const isRealTimeOverlap = (realNow >= minTime && realNow <= maxTime);
      const referenceTime = isRealTimeOverlap ? realNow : simulatedCurrentTime;
      
      const isForward = isVariableForwardLooking(selectedTimeKey);
      const deltaMs = earliestMatch.timestamp - referenceTime;
      
      // Resolve dynamic color based on Graph 2 shift deadlines:
      // <8h = Cyan (#06b6d4), 8-12h = Indigo (#6366f1), 12-18h = Fuchsia (#d946ef), 18-24h = Orange (#f97316), Overdue = Red (#ef4444)
      let matchColor = 'var(--accent-success)'; // Default Emerald Green for >24 hours
      if (isForward) {
        if (deltaMs < 0) {
          matchColor = '#ef4444'; // Red
        } else {
          const hoursRemaining = deltaMs / (3600 * 1000);
          if (hoursRemaining < 8) {
            matchColor = '#06b6d4'; // Cyan
          } else if (hoursRemaining < 12) {
            matchColor = '#6366f1'; // Indigo
          } else if (hoursRemaining < 18) {
            matchColor = '#d946ef'; // Fuchsia
          } else if (hoursRemaining < 24) {
            matchColor = '#f97316'; // Orange
          }
        }
      }

      // Priority FUD Match!
      panel.className = 'scan-status-panel match';
      panel.style.borderColor = matchColor;
      panel.style.boxShadow = `0 0 20px ${getRgba(matchColor, 0.35)}`;
      panel.style.background = getRgba(matchColor, 0.03);
      
      const indicator = panel.querySelector('.scan-status-indicator');
      if (indicator) {
        indicator.style.backgroundColor = matchColor;
        indicator.style.boxShadow = `0 0 8px ${matchColor}`;
      }

      text.textContent = `Priority scan detected: "${code}" (${matches.length} unit${matches.length !== 1 ? 's' : ''})`;
      
      if (resultHeader) {
        resultHeader.textContent = 'PRIORITY FUD ITEM DETECTED';
        resultHeader.style.color = matchColor;
        resultHeader.style.textShadow = `0 0 10px ${getRgba(matchColor, 0.5)}`;
      }
      
      // 1. Aggregate unique ASINs and quantities in matches
      const asinCounts = {};
      matches.forEach(m => {
        asinCounts[m.asin] = (asinCounts[m.asin] || 0) + 1;
      });
      const sortedAsins = Object.entries(asinCounts).sort((a, b) => a[0].localeCompare(b[0]));
      
      let asinHtml = '';
      sortedAsins.forEach(([asin, count]) => {
        const url = `https://fcresearch-eu.aka.amazon.com/NCL1/results?s=${asin}`;
        asinHtml += `
          <div style="display: flex; align-items: center; gap: 6px;">
            <a href="${url}" target="_blank" class="tooltip-asin-link" style="color: var(--accent-secondary); text-decoration: none; font-weight: 600; font-size: 0.85rem; border-bottom: 1px dashed rgba(6, 182, 212, 0.4); padding-bottom: 1px;">${asin}</a>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500; font-family: 'JetBrains Mono', monospace;">(${count}x)</span>
          </div>
        `;
      });
      if (resAsin) resAsin.innerHTML = asinHtml;

      // 2. Aggregate unique outermost/internal containers in matches
      const containers = new Set();
      matches.forEach(m => {
        const rec = m.originalRecord;
        const cId = rec?.outermostScannableId || rec?.scannableId || 'Unknown Container';
        containers.add(cId);
      });
      if (resContainer) resContainer.textContent = Array.from(containers).join(', ');


      
      if (resDeadline) {
        if (isForward) {
          if (deltaMs < 0) {
            resDeadline.textContent = `OVERDUE (due ${Math.abs(Math.round(deltaMs / 60000))}m ago)`;
            resDeadline.style.color = '#ef4444';
          } else {
            resDeadline.textContent = `Due in ${Math.round(deltaMs / 60000)}m`;
            resDeadline.style.color = matchColor;
          }
        } else {
          const ageMs = referenceTime - earliestMatch.timestamp;
          resDeadline.textContent = `Created ${Math.round(ageMs / 60000)}m ago`;
          resDeadline.style.color = 'var(--accent-secondary)';
        }
      }
      
      resultCard.classList.remove('hidden');
      
      // Play priority cyberpunk beep (high-pitched alarm)
      playBeep('priority');
      
      // Visual page flash indicator matching the priority color
      flashVisualPageIndicator(matchColor);
    } else {
      // Check if it exists in augmented containers list (either pending or found)
      const isAugmentedMatch = augmentedTotes.includes(query) || augmentedFoundTotes.includes(query);
      if (isAugmentedMatch) {
        // If it was pending, move it to found list
        if (augmentedTotes.includes(query)) {
          augmentedTotes = augmentedTotes.filter(t => t !== query);
          if (!augmentedFoundTotes.includes(query)) {
            augmentedFoundTotes.push(query);
          }
          localStorage.setItem('augmentedTotes', JSON.stringify(augmentedTotes));
          localStorage.setItem('augmentedFoundTotes', JSON.stringify(augmentedFoundTotes));
          renderAugmentedLists();
          updateAugmentedReadout();
        }

        const matchColor = 'var(--accent-secondary)'; // Cyan/secondary theme
        
        panel.className = 'scan-status-panel match';
        panel.style.borderColor = matchColor;
        panel.style.boxShadow = `0 0 20px ${getRgba(matchColor, 0.35)}`;
        panel.style.background = getRgba(matchColor, 0.03);
        
        const indicator = panel.querySelector('.scan-status-indicator');
        if (indicator) {
          indicator.style.backgroundColor = matchColor;
          indicator.style.boxShadow = `0 0 8px ${matchColor}`;
        }

        text.textContent = `Augmented container detected: "${code}"`;
        
        if (resultHeader) {
          resultHeader.textContent = 'AUGMENTED TOTE FOUND';
          resultHeader.style.color = matchColor;
          resultHeader.style.textShadow = `0 0 10px ${getRgba(matchColor, 0.5)}`;
        }

        // Hide ASIN row and Deadline row, show container row and action row
        const resAsinRow = document.getElementById('resAsinRow');
        if (resAsinRow) resAsinRow.classList.add('hidden');
        const resDeadlineRow = document.getElementById('resDeadlineRow');
        if (resDeadlineRow) resDeadlineRow.classList.add('hidden');
        const augmentedActionRow = document.getElementById('resAugmentedActionRow');
        if (augmentedActionRow) augmentedActionRow.classList.remove('hidden');

        // Container link:
        if (resContainer) {
          const url = `https://fcresearch-eu.aka.amazon.com/NCL1/results?s=${query}`;
          resContainer.innerHTML = `<a href="${url}" target="_blank" style="color: var(--accent-secondary); text-decoration: none; font-weight: 600; border-bottom: 1px dashed rgba(6, 182, 212, 0.4); padding-bottom: 1px;">${code}</a>`;
        }

        // Hook up the delete button
        const removeBtn = document.getElementById('resRemoveAugmentedBtn');
        if (removeBtn) {
          const newRemoveBtn = removeBtn.cloneNode(true);
          removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
          newRemoveBtn.addEventListener('click', () => {
            removeAugmentedContainer(query);
            // Hide result card and reset panel state
            resultCard.classList.add('hidden');
            panel.className = 'scan-status-panel idle';
            panel.style.borderColor = '';
            panel.style.boxShadow = '';
            panel.style.background = '';
            const indicator = panel.querySelector('.scan-status-indicator');
            if (indicator) {
              indicator.style.backgroundColor = '';
              indicator.style.boxShadow = '';
            }
            text.textContent = `Tote "${query}" removed from storage list.`;
          });
        }

        resultCard.classList.remove('hidden');
        
        // Play positive arpeggio
        playBeep('priority');
        flashVisualPageIndicator(matchColor);
      } else {
        // Non-Priority scan
        panel.className = 'scan-status-panel no-match';
        panel.style.borderColor = '#ef4444';
        panel.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.25)';
        panel.style.background = 'rgba(239, 68, 68, 0.03)';
        
        const indicator = panel.querySelector('.scan-status-indicator');
        if (indicator) {
          indicator.style.backgroundColor = '#ef4444';
          indicator.style.boxShadow = '0 0 8px #ef4444';
        }

        text.textContent = `Non-priority scan: "${code}"`;
        
        if (resultHeader) {
          resultHeader.textContent = 'NON-PRIORITY / NOT FOUND';
          resultHeader.style.color = '#ef4444';
          resultHeader.style.textShadow = '0 0 10px rgba(239, 68, 68, 0.5)';
        }
        
        // Reset row visibilities
        const resAsinRow = document.getElementById('resAsinRow');
        if (resAsinRow) resAsinRow.classList.remove('hidden');
        const resDeadlineRow = document.getElementById('resDeadlineRow');
        if (resDeadlineRow) resDeadlineRow.classList.remove('hidden');
        const augmentedActionRow = document.getElementById('resAugmentedActionRow');
        if (augmentedActionRow) augmentedActionRow.classList.add('hidden');
        
        if (resAsin) resAsin.textContent = code;
        if (resContainer) resContainer.textContent = 'Not in priority dataset';

        if (resDeadline) {
          resDeadline.textContent = '--';
          resDeadline.style.color = '#fff';
        }
        
        resultCard.classList.remove('hidden');
        
        // Play low error buzz
        playBeep('error');
        
        // Visual page flash indicator (red)
        flashVisualPageIndicator('#ef4444');
      }
    }
  }

  function flashVisualPageIndicator(color) {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100vw';
    flash.style.height = '100vh';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '99999';
    flash.style.background = color;
    flash.style.opacity = '0.15';
    flash.style.transition = 'opacity 0.4s ease-out';
    document.body.appendChild(flash);
    
    // Animate fade-out
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 400);
    }, 50);
  }

  // Synthetic beep generator using Web Audio API
  function playBeep(type) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.30);
        oscillator.stop(audioCtx.currentTime + 0.30);
      } else if (type === 'priority') {
        const playTone = (freq, startOffset, duration, volume) => {
          try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = 'triangle'; // Warm triangle wave harmonics to cut through warehouse background noise
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startOffset);
            gain.gain.setValueAtTime(volume, audioCtx.currentTime + startOffset);
            
            osc.start(audioCtx.currentTime + startOffset);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + startOffset + duration);
            osc.stop(audioCtx.currentTime + startOffset + duration);
          } catch(e){}
        };

        // Louder, sustained C-Major arpeggio (C5 -> E5 -> G5 -> C6) spanning 1.55s total
        playTone(523.25, 0.0, 0.45, 0.80);    // C5
        playTone(659.25, 0.15, 0.45, 0.80);   // E5
        playTone(783.99, 0.30, 0.45, 0.80);   // G5
        playTone(1046.50, 0.45, 1.10, 0.90);  // C6
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(180, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.40);
        oscillator.stop(audioCtx.currentTime + 0.40);
      }
    } catch (e) {
      console.warn('Audio blocked or unsupported:', e);
    }
  }

  // Fullscreen Histogram Toggles
  function initFullscreenToggles() {
    const btns = document.querySelectorAll('.fullscreen-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.card');
        if (!card) return;
        
        const isFullscreen = card.classList.contains('fullscreen-card');
        if (isFullscreen) {
          card.classList.remove('fullscreen-card');
          btn.textContent = '⛶ Expand';
          document.body.classList.remove('modal-open');
        } else {
          // Close other fullscreen cards if open
          document.querySelectorAll('.card.fullscreen-card').forEach(c => {
            c.classList.remove('fullscreen-card');
            const b = c.querySelector('.fullscreen-btn');
            if (b) b.textContent = '⛶ Expand';
          });
          
          card.classList.add('fullscreen-card');
          btn.textContent = '🗗 Minimize';
          document.body.classList.add('modal-open');
        }
      });
    });
  }

  // Collapsible Input Card toggle initializer
  function initInputCollapseToggle() {
    const toggleInputBtn = document.getElementById('toggleInputCollapseBtn');
    const inputSection = document.getElementById('inputSection');
    
    if (toggleInputBtn && inputSection) {
      toggleInputBtn.addEventListener('click', () => {
        const isCollapsed = inputSection.classList.contains('collapsed-input');
        if (isCollapsed) {
          inputSection.classList.remove('collapsed-input');
          toggleInputBtn.textContent = '⚙️ Collapse Input';
        } else {
          inputSection.classList.add('collapsed-input');
          toggleInputBtn.textContent = '⚙️ Expand Input';
        }
      });
    }
  }

  // Live Playhead control logic
  function toggleLivePlayhead() {
    if (isLivePlayheadActive) {
      disableLivePlayhead();
    } else {
      enableLivePlayhead();
    }
  }

  function enableLivePlayhead() {
    if (isPlaying) {
      stopPlayback();
    }
    isLivePlayheadActive = true;
    if (livePlayheadBtn) {
      livePlayheadBtn.classList.add('active');
    }
    
    // Lock to system clock
    simulatedCurrentTime = Date.now();
    if (timeSlider) {
      timeSlider.value = simulatedCurrentTime;
    }
    updateSimulationReadouts();
    updateHistograms();
  }

  function disableLivePlayhead() {
    isLivePlayheadActive = false;
    if (livePlayheadBtn) {
      livePlayheadBtn.classList.remove('active');
    }
    updateSimulationReadouts();
    updateHistograms();
  }

  // Update the position of the real-world time marker on the timeline
  function updateRealTimeMarker() {
    const marker = document.getElementById('realTimeMarker');
    if (!marker) return;

    if (!minTime || !maxTime) {
      marker.classList.add('hidden');
      return;
    }

    const realNow = Date.now();

    // Always expand slider max dynamically: 24 hours from current clock time
    maxTime = Math.max(minTime + 24 * MS_IN_HOUR, realNow + 24 * MS_IN_HOUR);
    if (timeSlider) {
      timeSlider.max = maxTime;
      if (simulatedCurrentTime !== null) {
        timeSlider.value = simulatedCurrentTime;
      }
    }
    const sliderMaxEl = document.getElementById('sliderMaxLabel');
    if (sliderMaxEl) {
      sliderMaxEl.textContent = formatDateLabel(new Date(maxTime));
    }

    if (realNow >= minTime && realNow <= maxTime) {
      const pct = ((realNow - minTime) / (maxTime - minTime)) * 100;
      marker.style.left = `${pct}%`;
      marker.classList.remove('hidden');
    } else {
      marker.classList.add('hidden');
    }
  }

  // Initialize Augmented Containers from localStorage
  function initAugmentedContainers() {
    try {
      const stored = localStorage.getItem('augmentedTotes');
      if (stored) {
        augmentedTotes = JSON.parse(stored) || [];
      } else {
        augmentedTotes = [];
      }

      const storedFound = localStorage.getItem('augmentedFoundTotes');
      if (storedFound) {
        augmentedFoundTotes = JSON.parse(storedFound) || [];
      } else {
        augmentedFoundTotes = [];
      }
    } catch (e) {
      console.error(e);
      augmentedTotes = [];
      augmentedFoundTotes = [];
    }
    updateAugmentedReadout();
    renderAugmentedLists();
    checkScannerCardVisibility();
  }

  // Render open-top box visual lists inside expanded containers card
  function renderAugmentedLists() {
    if (!pendingTotesList || !foundTotesList) return;

    // Render Pending List
    pendingTotesList.innerHTML = '';
    if (augmentedTotes.length === 0) {
      pendingTotesList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; padding: 4px;">No pending containers.</div>`;
    } else {
      const sortedPending = [...augmentedTotes].sort((a, b) => a.localeCompare(b));
      sortedPending.forEach(tote => {
        const box = document.createElement('div');
        box.className = 'aug-tote-box';
        
        const link = document.createElement('a');
        link.href = `https://fcresearch-eu.aka.amazon.com/NCL1/results?s=${tote}`;
        link.target = '_blank';
        link.textContent = tote;
        
        const delBtn = document.createElement('span');
        delBtn.className = 'delete-btn';
        delBtn.textContent = '×';
        delBtn.title = 'Remove container';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeAugmentedContainer(tote);
        });

        box.appendChild(link);
        box.appendChild(delBtn);
        pendingTotesList.appendChild(box);
      });
    }

    // Render Found List
    foundTotesList.innerHTML = '';
    if (augmentedFoundTotes.length === 0) {
      foundTotesList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; padding: 4px;">No found containers.</div>`;
    } else {
      const sortedFound = [...augmentedFoundTotes].sort((a, b) => a.localeCompare(b));
      sortedFound.forEach(tote => {
        const box = document.createElement('div');
        box.className = 'aug-tote-box found';
        
        const link = document.createElement('a');
        link.href = `https://fcresearch-eu.aka.amazon.com/NCL1/results?s=${tote}`;
        link.target = '_blank';
        link.textContent = tote;
        
        const delBtn = document.createElement('span');
        delBtn.className = 'delete-btn';
        delBtn.textContent = '×';
        delBtn.title = 'Remove container';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeAugmentedContainer(tote);
        });

        box.appendChild(link);
        box.appendChild(delBtn);
        foundTotesList.appendChild(box);
      });
    }
  }

  // Add items from input
  function addAugmentedContainers() {
    if (!augmentedInput) return;
    const inputVal = augmentedInput.value;
    if (!inputVal.trim()) return;

    // Split by commas, filter empty values, trim and uppercase
    const newItems = inputVal.split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);

    let addedCount = 0;
    newItems.forEach(item => {
      // Don't add to pending if it's already in pending or found
      if (!augmentedTotes.includes(item) && !augmentedFoundTotes.includes(item)) {
        augmentedTotes.push(item);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      localStorage.setItem('augmentedTotes', JSON.stringify(augmentedTotes));
      updateAugmentedReadout();
      renderAugmentedLists();
      checkScannerCardVisibility();
      setAugmentedStatus('success', `Added ${addedCount} container(s) successfully!`);
    } else {
      setAugmentedStatus('success', 'All entered containers are already in the list.');
    }

    augmentedInput.value = '';
  }

  // Clear all items
  function clearAllAugmentedContainers() {
    augmentedTotes = [];
    augmentedFoundTotes = [];
    localStorage.removeItem('augmentedTotes');
    localStorage.removeItem('augmentedFoundTotes');
    updateAugmentedReadout();
    renderAugmentedLists();
    checkScannerCardVisibility();
    setAugmentedStatus('idle', 'All augmented containers cleared.');
  }

  // Remove a single item from both lists
  function removeAugmentedContainer(toteId) {
    const uppercaseId = toteId.toUpperCase();
    augmentedTotes = augmentedTotes.filter(t => t !== uppercaseId);
    augmentedFoundTotes = augmentedFoundTotes.filter(t => t !== uppercaseId);
    
    localStorage.setItem('augmentedTotes', JSON.stringify(augmentedTotes));
    localStorage.setItem('augmentedFoundTotes', JSON.stringify(augmentedFoundTotes));
    
    updateAugmentedReadout();
    renderAugmentedLists();
    checkScannerCardVisibility();
    setAugmentedStatus('success', `Removed "${toteId}" from storage.`);
  }

  // Update status readout count and color
  function updateAugmentedReadout() {
    if (!augmentedStatus) return;
    const statusText = augmentedStatus.querySelector('.status-text');
    if (statusText) {
      const totalCount = augmentedTotes.length + augmentedFoundTotes.length;
      statusText.textContent = `${totalCount} auxiliary container(s) stored (${augmentedTotes.length} pending, ${augmentedFoundTotes.length} found)`;
    }
  }

  // Set the visual parsing status for Augmented card
  function setAugmentedStatus(type, message) {
    if (!augmentedStatus) return;
    augmentedStatus.className = `status-indicator ${type}`;
    const text = augmentedStatus.querySelector('.status-text');
    if (text) {
      text.textContent = message;
    }
  }

  // Dynamic visibility logic for Scanner Card
  function checkScannerCardVisibility() {
    const scannerSection = document.getElementById('scannerSection');
    if (!scannerSection) return;

    const hasParsedData = parsedStows && parsedStows.length > 0;
    const hasAugmentedData = (augmentedTotes.length + augmentedFoundTotes.length) > 0;

    if (hasParsedData || hasAugmentedData) {
      scannerSection.classList.remove('hidden');
    } else {
      scannerSection.classList.add('hidden');
      const toggle = document.getElementById('scanModeToggle');
      if (toggle) toggle.checked = false;
      disableScanMode();
    }
  }

  // Parse and display warehouse locations dynamically
  function updateWarehouseLocationsSummary(locationList) {
    const patterns = {
      P2: /^(dz-P-A2[1-4]\d{2}|cvFMS_AS01_(ARSTOW_\d{4}_\d{4}|ARSTOW_RUNOUT_\d{2}|TO_ARSTOW_FLOOR2))$/,
      P3: /^(dz-P-A3[1-4]\d{2}|cvFMS_AS02_(ARSTOW_\d{4}_\d{4}|ARSTOW_RUNOUT_\d{2}|TO_ARSTOW_FLOOR3))$/,
      P4: /^(dz-P-A4[1-4]\d{2}|cvFMS_AS03_(ARSTOW_\d{4}_\d{4}|ARSTOW_RUNOUT_\d{2}|TO_ARSTOW_FLOOR4))$/
    };

    const data = {
      P2: { total: 0, dz: [], bridges: [] },
      P3: { total: 0, dz: [], bridges: [] },
      P4: { total: 0, dz: [], bridges: [] }
    };

    const counts = {}; // Keep counts of stows/items at each friendly location name

    locationList.forEach(loc => {
      if (loc.includes('TO_ARSTOW')) return; // Skip entrances completely from summary
      let matchedFloor = null;
      
      if (patterns.P2.test(loc)) matchedFloor = 'P2';
      else if (patterns.P3.test(loc)) matchedFloor = 'P3';
      else if (patterns.P4.test(loc)) matchedFloor = 'P4';

      if (matchedFloor) {
        data[matchedFloor].total++;
        const translated = translateWarehouseLocation(loc, matchedFloor);
        counts[translated] = (counts[translated] || 0) + 1;

        if (loc.startsWith('dz-')) {
          if (!data[matchedFloor].dz.includes(translated)) {
            data[matchedFloor].dz.push(translated);
          }
        } else {
          if (!data[matchedFloor].bridges.includes(translated)) {
            data[matchedFloor].bridges.push(translated);
          }
        }
      }
    });

    // Populate DOM Elements
    ['P2', 'P3', 'P4'].forEach(floor => {
      const floorData = data[floor];
      
      // Sort alphabetically for clean presentation
      floorData.dz.sort((a, b) => a.localeCompare(b));
      floorData.bridges.sort((a, b) => a.localeCompare(b));

      // Append counts before the location with a colon: "12: Station 3160 (North P3)"
      const formattedDz = floorData.dz.map(name => `<span style="color: var(--accent-secondary); font-weight: bold; font-family: var(--font-mono);">${counts[name]}</span>: ${name}`);
      const formattedBridges = floorData.bridges.map(name => `<span style="color: var(--accent-secondary); font-weight: bold; font-family: var(--font-mono);">${counts[name]}</span>: ${name}`);

      const totalEl = document.getElementById(`floor${floor}Total`);
      const dzEl = document.getElementById(`floor${floor}Dz`);
      const bridgesEl = document.getElementById(`floor${floor}Bridges`);

      if (totalEl) totalEl.textContent = floorData.total;
      if (dzEl) dzEl.innerHTML = formattedDz.join('<br>') || 'None';
      if (bridgesEl) bridgesEl.innerHTML = formattedBridges.join('<br>') || 'None';
    });

    // Generate console output summary block
    let output = [];
    ['P2', 'P3', 'P4'].forEach(floor => {
      const floorData = data[floor];
      
      const consoleDz = floorData.dz.map(name => `${counts[name]}: ${name}`);
      const consoleBridges = floorData.bridges.map(name => `${counts[name]}: ${name}`);

      let section = `Total on ${floor}: ${floorData.total}\n`;
      section += `  Drop Zones:\n    - ${consoleDz.join('\n    - ') || 'None'}\n`;
      section += `  Bridges/Runouts:\n    - ${consoleBridges.join('\n    - ') || 'None'}`;
      output.push(section);
    });

    const summaryText = output.join('\n\n');
    console.log("Warehouse Floor Location Summary:\n", summaryText);

    // Show the container section
    const summaryContainer = document.getElementById('locationSummaryContainer');
    if (summaryContainer) summaryContainer.classList.remove('hidden');
  }

  // Translate cryptic location codes to friendly English descriptions
  function translateWarehouseLocation(loc, floor) {
    if (loc.startsWith('dz-')) {
      const match = loc.match(/^dz-P-A(\d{4})$/);
      if (match) {
        const stationNum = match[1]; // e.g. "3160"
        const dirDigit = stationNum.charAt(1); // e.g. "1"
        let direction = 'North';
        if (dirDigit === '2') direction = 'West';
        else if (dirDigit === '3') direction = 'South';
        else if (dirDigit === '4') direction = 'East';
        
        return `Station ${stationNum} (${direction} ${floor})`;
      }
      return loc;
    } else {
      if (loc.includes('RUNOUT')) {
        // Last 2 digits: 01 = North, 02 = South
        const match = loc.match(/RUNOUT_(\d{2})$/);
        if (match) {
          const runoutNum = match[1];
          let dir = '';
          if (runoutNum === '01') dir = ' North';
          else if (runoutNum === '02') dir = ' South';
          return `West Runout${dir} (${floor})`;
        }
        return `West Runout (${floor})`;
      } else {
        // It's a Bridge (extract the remaining ID and keep separate)
        const match = loc.match(/^cvFMS_AS\d{2}_(.+)$/);
        if (match && match[1]) {
          let bridgeId = match[1];
          // Strip ARSTOW_ prefix if present for cleaner station IDs
          if (bridgeId.startsWith('ARSTOW_')) {
            bridgeId = bridgeId.substring(7);
          }
          bridgeId = bridgeId.replace(/_/g, '-');
          return `West Bridge ${bridgeId} (${floor})`;
        }
        return `West Bridge (${floor})`;
      }
    }
  }
});
