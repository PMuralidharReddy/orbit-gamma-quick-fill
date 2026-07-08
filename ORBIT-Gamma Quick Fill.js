// ==UserScript==
// @name         ORBIT-Gamma Quick Fill
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Smart fill + Safe Copy Last Annotation + Draggable panel for ORBIT-Gamma
// @author       pmred
// @match        *://orbit-gamma*
// @match        *://*.harmony.a2z.com/*
// @match        *://*/orbit-gamma*
// @exclude      *://orbit-beta*
// @exclude      *://*orbit-beta*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // LAST ANNOTATION MEMORY
  // ============================================================
  let lastAnnotation = null;

  const PRESETS = [
    // ---- SINGLE-TURN ----
    {
      group:         "Single-Turn",
      label:         "Accurate response",
      sublabel:      "CS: Yes | CC: N/A",
      color:         "#22c55e",
      turnType:      "Single-Turn",
      contextSwitch: "cs-yes",
      convContext:   "cc-na"
    },
    {
      group:         "Single-Turn",
      label:         "Not relevant",
      sublabel:      "CS: No | CC: N/A",
      color:         "#ef4444",
      turnType:      "Single-Turn",
      contextSwitch: "cs-no",
      convContext:   "cc-na"
    },
    {
      group:         "Single-Turn",
      label:         "No switch / First",
      sublabel:      "CS: N/A | CC: N/A",
      color:         "#6b7280",
      turnType:      "Single-Turn",
      contextSwitch: "cs-na",
      convContext:   "cc-na"
    },
    // ---- MULTI-TURN ----
    {
      group:         "Multi-Turn",
      label:         "Used context well",
      sublabel:      "CS: N/A | CC: Yes",
      color:         "#3b82f6",
      turnType:      "Multi-Turn",
      contextSwitch: "cs-na",
      convContext:   "cc-yes"
    },
    {
      group:         "Multi-Turn",
      label:         "Ignored context",
      sublabel:      "CS: N/A | CC: No",
      color:         "#f97316",
      turnType:      "Multi-Turn",
      contextSwitch: "cs-na",
      convContext:   "cc-no"
    },
    {
      group:         "Multi-Turn",
      label:         "N/A",
      sublabel:      "CS: N/A | CC: N/A",
      color:         "#6b7280",
      turnType:      "Multi-Turn",
      contextSwitch: "cs-na",
      convContext:   "cc-na"
    }
  ];

  // ============================================================
  // STYLES
  // ============================================================
  GM_addStyle(`
    #orbit-filler-panel {
      position: fixed;
      z-index: 999999;
      background: #1e1e2e;
      border: 1px solid #3b82f6;
      border-radius: 9px;
      padding: 0;
      width: 195px;
      font-family: Arial, sans-serif;
      box-shadow: 0 3px 16px rgba(0,0,0,0.55);
      transition: box-shadow 0.15s;
      user-select: none;
    }
    #orbit-filler-panel.dragging {
      box-shadow: 0 8px 32px rgba(0,0,0,0.8);
      opacity: 0.95;
      cursor: grabbing !important;
    }

    /* Collapsed */
    #orbit-filler-panel.collapsed {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      overflow: hidden;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    #orbit-filler-panel.collapsed .orbit-panel-inner { display: none; }
    #orbit-collapse-icon {
      display: none;
      font-size: 14px;
      color: #60a5fa;
      user-select: none;
    }
    #orbit-filler-panel.collapsed #orbit-collapse-icon { display: block; }

    /* Drag handle — the header acts as the drag zone */
    #orbit-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 8px 6px 8px;
      border-bottom: 1px solid #374151;
      cursor: grab;
      border-radius: 9px 9px 0 0;
      background: #252540;
    }
    #orbit-panel-header:active { cursor: grabbing; }

    #orbit-drag-hint {
      font-size: 8px;
      color: #4b5563;
      letter-spacing: 0.3px;
      pointer-events: none;
    }

    #orbit-panel-title {
      color: #93c5fd;
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.3px;
      pointer-events: none;
    }

    .orbit-header-right {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* Reset position button */
    #orbit-reset-pos-btn {
      background: none;
      border: none;
      color: #4b5563;
      font-size: 10px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: color 0.15s;
    }
    #orbit-reset-pos-btn:hover { color: #9ca3af; }

    #orbit-toggle-btn {
      background: none;
      border: none;
      color: #93c5fd;
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    #orbit-toggle-btn:hover { color: #fff; }

    /* Panel body padding */
    .orbit-panel-body {
      padding: 8px;
    }

    /* ---- COPY SECTION ---- */
    #orbit-copy-section {
      margin-bottom: 6px;
      border: 1px solid #2d2d45;
      border-radius: 6px;
      overflow: hidden;
    }
    #orbit-save-snap-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 100%;
      padding: 4px 0;
      border: none;
      border-bottom: 1px solid #2d2d45;
      background: #1a2535;
      color: #60a5fa;
      font-size: 9px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.3px;
      transition: background 0.15s;
      box-sizing: border-box;
    }
    #orbit-save-snap-btn:hover { background: #1e3050; }

    #orbit-snap-preview {
      padding: 4px 6px;
      font-size: 8px;
      color: #6b7280;
      background: #252535;
      line-height: 1.6;
      min-height: 20px;
      word-break: break-word;
      border-bottom: 1px solid #2d2d45;
    }
    #orbit-snap-preview.has-data { color: #9ca3af; }
    #orbit-snap-preview span {
      display: inline-block;
      background: #374151;
      border-radius: 3px;
      padding: 0 3px;
      margin: 1px 1px;
      font-size: 7.5px;
      color: #d1d5db;
    }

    #orbit-paste-snap-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 100%;
      padding: 5px 0;
      border: none;
      background: #252535;
      color: #6b7280;
      font-size: 9.5px;
      font-weight: 700;
      cursor: not-allowed;
      letter-spacing: 0.3px;
      transition: all 0.15s;
      box-sizing: border-box;
      opacity: 0.5;
    }
    #orbit-paste-snap-btn.ready {
      color: #fbbf24;
      cursor: pointer;
      opacity: 1;
      background: #2a2010;
    }
    #orbit-paste-snap-btn.ready:hover { background: #3a2e10; }
    #orbit-paste-snap-btn.ready:active { transform: scale(0.97); }

    /* Group label */
    .orbit-group-label {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin: 5px 0 3px 1px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .orbit-group-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #374151;
    }

    /* Preset card */
    .orbit-preset-card {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 3px;
      cursor: pointer;
      border-radius: 5px;
      padding: 4px 6px;
      background: #252535;
      border: 1px solid #2d2d45;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
    }
    .orbit-preset-card:hover {
      background: #2d2d45;
      border-color: #4b5563;
      transform: scale(1.01);
    }
    .orbit-preset-card:active { transform: scale(0.97); }

    .orbit-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .orbit-card-text { flex: 1; min-width: 0; }
    .orbit-card-main {
      font-size: 9.5px;
      font-weight: 600;
      color: #e5e7eb;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .orbit-card-sub {
      font-size: 8px;
      color: #6b7280;
      margin-top: 1px;
    }
    .orbit-tt-pill {
      font-size: 7.5px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
      color: #fff;
      flex-shrink: 0;
    }

    /* Status */
    #orbit-status {
      margin-top: 5px;
      font-size: 9px;
      min-height: 12px;
      text-align: center;
      border-top: 1px solid #374151;
      padding-top: 4px;
      color: #86efac;
    }

    /* Confirm overlay */
    #orbit-confirm-box {
      display: none;
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15,15,25,0.96);
      border-radius: 9px;
      z-index: 10;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px;
      box-sizing: border-box;
      gap: 8px;
    }
    #orbit-confirm-box.show { display: flex; }
    #orbit-confirm-text {
      font-size: 9.5px;
      color: #e5e7eb;
      text-align: center;
      line-height: 1.5;
    }
    #orbit-confirm-text strong { color: #fbbf24; }
    .orbit-confirm-btns {
      display: flex;
      gap: 6px;
      width: 100%;
    }
    .orbit-confirm-btns button {
      flex: 1;
      padding: 5px 0;
      border: none;
      border-radius: 5px;
      font-size: 9.5px;
      font-weight: 700;
      cursor: pointer;
    }
    #orbit-confirm-yes { background: #f59e0b; color: #1e1e2e; }
    #orbit-confirm-yes:hover { background: #fbbf24; }
    #orbit-confirm-no  { background: #374151; color: #d1d5db; }
    #orbit-confirm-no:hover { background: #4b5563; }
  `);

  // ============================================================
  // BUILD PANEL
  // ============================================================
  const panel = document.createElement('div');
  panel.id = 'orbit-filler-panel';

  // Restore saved position or use default top-right
  const savedPos = getSavedPosition();
  panel.style.top  = savedPos.top  + 'px';
  panel.style.left = savedPos.left + 'px';

  // Collapse icon (shown when collapsed)
  const collapseIcon = document.createElement('span');
  collapseIcon.id = 'orbit-collapse-icon';
  collapseIcon.textContent = '⚡';
  panel.appendChild(collapseIcon);

  // Inner wrapper
  const inner = document.createElement('div');
  inner.className = 'orbit-panel-inner';
  inner.style.position = 'relative';

  // ---- HEADER (drag handle) ----
  const header = document.createElement('div');
  header.id = 'orbit-panel-header';

  const titleEl = document.createElement('span');
  titleEl.id = 'orbit-panel-title';
  titleEl.textContent = '⚡ Quick Fill';

  const dragHint = document.createElement('span');
  dragHint.id = 'orbit-drag-hint';
  dragHint.textContent = '⠿ drag';

  const headerRight = document.createElement('div');
  headerRight.className = 'orbit-header-right';

  // Reset position button
  const resetPosBtn = document.createElement('button');
  resetPosBtn.id = 'orbit-reset-pos-btn';
  resetPosBtn.title = 'Reset to default position';
  resetPosBtn.textContent = '⌖';
  resetPosBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetPosition();
  });

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'orbit-toggle-btn';
  toggleBtn.title = 'Collapse';
  toggleBtn.textContent = '—';

  headerRight.appendChild(dragHint);
  headerRight.appendChild(resetPosBtn);
  headerRight.appendChild(toggleBtn);
  header.appendChild(titleEl);
  header.appendChild(headerRight);
  inner.appendChild(header);

  // ---- PANEL BODY ----
  const body = document.createElement('div');
  body.className = 'orbit-panel-body';

  // Copy section
  const copySection = document.createElement('div');
  copySection.id = 'orbit-copy-section';

  const saveSnapBtn = document.createElement('button');
  saveSnapBtn.id = 'orbit-save-snap-btn';
  saveSnapBtn.innerHTML = '📋 Save Current as Snapshot';
  saveSnapBtn.title = 'Save all current field values as a snapshot to paste later';
  saveSnapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const snap = captureSnapshot();
    if (!snap.turnType && !snap.contextSwitch && !snap.convContext) {
      setStatus('⚠️ Nothing to save — form is empty', '#fbbf24');
      return;
    }
    updateSnapshot(snap);
    setStatus('📋 Snapshot saved!', '#60a5fa');
  });
  copySection.appendChild(saveSnapBtn);

  const snapPreview = document.createElement('div');
  snapPreview.id = 'orbit-snap-preview';
  snapPreview.textContent = 'No snapshot saved yet';
  copySection.appendChild(snapPreview);

  const pasteSnapBtn = document.createElement('button');
  pasteSnapBtn.id = 'orbit-paste-snap-btn';
  pasteSnapBtn.innerHTML = '⎘ Paste Snapshot to This Chat';
  pasteSnapBtn.title = 'Save a snapshot first using the button above';
  pasteSnapBtn.disabled = true;
  pasteSnapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (lastAnnotation) showConfirm();
  });
  copySection.appendChild(pasteSnapBtn);
  body.appendChild(copySection);

  // Preset cards
  let lastGroup = null;
  PRESETS.forEach((preset) => {
    if (preset.group !== lastGroup) {
      const groupLbl = document.createElement('div');
      groupLbl.className = 'orbit-group-label';
      groupLbl.textContent = preset.group;
      body.appendChild(groupLbl);
      lastGroup = preset.group;
    }

    const card = document.createElement('div');
    card.className = 'orbit-preset-card';
    card.title = `${preset.label} — ${preset.sublabel}`;

    const dot = document.createElement('div');
    dot.className = 'orbit-dot';
    dot.style.background = preset.color;

    const textBlock = document.createElement('div');
    textBlock.className = 'orbit-card-text';
    const mainLbl = document.createElement('div');
    mainLbl.className = 'orbit-card-main';
    mainLbl.textContent = preset.label;
    const subLbl = document.createElement('div');
    subLbl.className = 'orbit-card-sub';
    subLbl.textContent = preset.sublabel;
    textBlock.appendChild(mainLbl);
    textBlock.appendChild(subLbl);

    const pill = document.createElement('span');
    pill.className = 'orbit-tt-pill';
    pill.style.background = preset.group === 'Single-Turn' ? '#0f766e' : '#1d4ed8';
    pill.textContent = preset.group === 'Single-Turn' ? 'ST' : 'MT';

    card.appendChild(dot);
    card.appendChild(textBlock);
    card.appendChild(pill);
    card.addEventListener('click', () => applyPreset(preset));
    body.appendChild(card);
  });

  const statusEl = document.createElement('div');
  statusEl.id = 'orbit-status';
  body.appendChild(statusEl);

  inner.appendChild(body);

  // Confirm overlay
  const confirmBox = document.createElement('div');
  confirmBox.id = 'orbit-confirm-box';
  confirmBox.innerHTML = `
    <div id="orbit-confirm-text">
      This will <strong>overwrite</strong> all current fields with the saved snapshot.<br>Are you sure?
    </div>
    <div class="orbit-confirm-btns">
      <button id="orbit-confirm-yes">✓ Yes, Paste</button>
      <button id="orbit-confirm-no">✗ Cancel</button>
    </div>
  `;
  inner.appendChild(confirmBox);

  panel.appendChild(inner);
  document.body.appendChild(panel);

  // Wire confirm buttons
  document.getElementById('orbit-confirm-yes').addEventListener('click', () => {
    confirmBox.classList.remove('show');
    applySnapshot(lastAnnotation);
  });
  document.getElementById('orbit-confirm-no').addEventListener('click', () => {
    confirmBox.classList.remove('show');
    setStatus('Paste cancelled', '#6b7280');
  });

  // ============================================================
  // COLLAPSE TOGGLE
  // ============================================================
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.add('collapsed');
  });
  collapseIcon.addEventListener('click', () => {
    panel.classList.remove('collapsed');
  });

  // ============================================================
  // DRAG TO MOVE
  // Dragging is triggered only from the header bar
  // Position is saved to GM storage so it persists on reload
  // ============================================================
  let isDragging   = false;
  let dragOffsetX  = 0;
  let dragOffsetY  = 0;

  header.addEventListener('mousedown', startDrag);
  collapseIcon.addEventListener('mousedown', startDrag); // drag when collapsed too

  function startDrag(e) {
    // Ignore clicks on buttons inside the header
    if (e.target.tagName === 'BUTTON') return;

    isDragging  = true;
    dragOffsetX = e.clientX - panel.getBoundingClientRect().left;
    dragOffsetY = e.clientY - panel.getBoundingClientRect().top;

    panel.classList.add('dragging');
    e.preventDefault();
  }

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    let newLeft = e.clientX - dragOffsetX;
    let newTop  = e.clientY - dragOffsetY;

    // Keep panel fully within viewport bounds
    const maxLeft = window.innerWidth  - panel.offsetWidth;
    const maxTop  = window.innerHeight - panel.offsetHeight;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop  = Math.max(0, Math.min(newTop,  maxTop));

    panel.style.left = newLeft + 'px';
    panel.style.top  = newTop  + 'px';
    // Clear right/bottom so left/top take full control
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    panel.classList.remove('dragging');
    // Save position so it survives page reload
    savePosition(
      parseInt(panel.style.top),
      parseInt(panel.style.left)
    );
  });

  // ============================================================
  // POSITION PERSISTENCE  (GM_setValue / GM_getValue)
  // ============================================================
  function savePosition(top, left) {
    GM_setValue('orbit_panel_top',  top);
    GM_setValue('orbit_panel_left', left);
  }

  function getSavedPosition() {
    const top  = GM_getValue('orbit_panel_top',  48);
    const left = GM_getValue('orbit_panel_left',
                  window.innerWidth - 233); // default: top-right
    return { top, left };
  }

  function resetPosition() {
    const defaultTop  = 48;
    const defaultLeft = window.innerWidth - 233;
    panel.style.top   = defaultTop  + 'px';
    panel.style.left  = defaultLeft + 'px';
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
    savePosition(defaultTop, defaultLeft);
    setStatus('↖ Position reset', '#9ca3af');
  }

  // ============================================================
  // CONFIRM OVERLAY
  // ============================================================
  function showConfirm() {
    confirmBox.classList.add('show');
  }

  // ============================================================
  // FILL HELPERS
  // ============================================================
  function setSelectById(id, value) {
    if (!value) return false;
    const el = document.getElementById(id);
    if (!el) return false;
    for (const opt of el.options) {
      if (opt.value === value || opt.text.trim() === value) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function setRadioById(id) {
    if (!id) return false;
    const el = document.getElementById(id);
    if (!el) return false;
    el.checked = true;
    el.click();
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function setTextById(id, value) {
    if (value === null || value === undefined) return false;
    const el = document.getElementById(id);
    if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // ============================================================
  // CAPTURE SNAPSHOT
  // ============================================================
  function captureSnapshot() {
    const csRadio  = document.querySelector('input[name="context-switch"]:checked');
    const ccRadio  = document.querySelector('input[name="conv-context"]:checked');
    const rcaRadio = document.querySelector('input[name="response-accurate"]:checked');
    const hvaVal   = getSelectValue('hva-category-select');

    return {
      turnType:         getSelectValue('turn-type-select'),
      contextSwitch:    csRadio  ? csRadio.id    : null,
      csValue:          csRadio  ? csRadio.value : '',
      convContext:      ccRadio  ? ccRadio.id    : null,
      ccValue:          ccRadio  ? ccRadio.value : '',
      hvaCategory:      hvaVal,
      customHva:        hvaVal === '__custom__' ? getTextValue('custom-hva-input') : '',
      interactionType:  getSelectValue('interaction-type-select'),
      staticResponse:   getSelectValue('static-response-type-select'),
      csRouting:        getSelectValue('cs-routing-select'),
      responseAccurate: rcaRadio ? rcaRadio.id    : null,
      rcaValue:         rcaRadio ? rcaRadio.value : '',
      negFeedback:      getSelectValue('neg-feedback-select'),
      expectedResponse: getTextValue('expected-response'),
      observations:     getTextValue('observations'),
    };
  }

  function getSelectValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }
  function getTextValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  // ============================================================
  // UPDATE SNAPSHOT PREVIEW
  // ============================================================
  function updateSnapshot(snap) {
    lastAnnotation = snap;

    pasteSnapBtn.disabled = false;
    pasteSnapBtn.classList.add('ready');
    pasteSnapBtn.title = 'Paste saved snapshot to this chat';

    snapPreview.innerHTML = '';
    snapPreview.classList.add('has-data');

    const chips = [
      snap.turnType                                              || null,
      snap.csValue    ? 'CS:'  + snap.csValue                   : null,
      snap.ccValue    ? 'CC:'  + snap.ccValue                   : null,
      snap.rcaValue   ? 'RCA:' + snap.rcaValue                  : null,
      snap.interactionType                                       || null,
      snap.negFeedback && snap.negFeedback !== 'N/A'
        ? 'NF:' + snap.negFeedback                              : null,
    ].filter(Boolean);

    chips.forEach(chip => {
      const s = document.createElement('span');
      s.textContent = chip;
      snapPreview.appendChild(s);
    });

    if (!chips.length) snapPreview.textContent = 'Snapshot saved (empty form)';
  }

  // ============================================================
  // APPLY SNAPSHOT
  // ============================================================
  function applySnapshot(snap) {
    if (!snap) return;

    if (snap.turnType)        setSelectById('turn-type-select',            snap.turnType);
    if (snap.hvaCategory)     setSelectById('hva-category-select',         snap.hvaCategory);
    if (snap.interactionType) setSelectById('interaction-type-select',     snap.interactionType);
    if (snap.staticResponse)  setSelectById('static-response-type-select', snap.staticResponse);
    if (snap.csRouting)       setSelectById('cs-routing-select',           snap.csRouting);
    if (snap.negFeedback)     setSelectById('neg-feedback-select',         snap.negFeedback);

    if (snap.hvaCategory === '__custom__' && snap.customHva) {
      const box = document.getElementById('custom-hva-box');
      if (box) box.classList.remove('hidden');
      setTextById('custom-hva-input', snap.customHva);
    }

    if (snap.contextSwitch)    setRadioById(snap.contextSwitch);
    if (snap.convContext)      setRadioById(snap.convContext);
    if (snap.responseAccurate) setRadioById(snap.responseAccurate);

    if (snap.expectedResponse) setTextById('expected-response', snap.expectedResponse);
    if (snap.observations)     setTextById('observations',      snap.observations);

    setStatus('⎘ Snapshot pasted!', '#f59e0b');
  }

  // ============================================================
  // APPLY PRESET
  // ============================================================
  function applyPreset(preset) {
    setSelectById('turn-type-select', preset.turnType);
    setRadioById(preset.contextSwitch);
    setRadioById(preset.convContext);
    setTextById('expected-response',     'N/A');
    setSelectById('neg-feedback-select', 'N/A');
    setStatus('✅ ' + preset.label, '#86efac');
  }

  function setStatus(msg, color) {
    statusEl.style.color = color;
    statusEl.textContent = msg;
    setTimeout(() => { statusEl.textContent = ''; }, 2500);
  }

})();
