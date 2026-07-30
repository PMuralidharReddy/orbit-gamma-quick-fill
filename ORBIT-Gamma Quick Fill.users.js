// ==UserScript==
// @name         ORBIT-Gamma Quick Fill V3
// @namespace    http://tampermonkey.net/
// @version      7.5
// @description  Smart fill + Safe Copy Last Annotation + Draggable panel for ORBIT-Gamma + Beta
// @author       pmred
// @author       bhurak
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
  // ENVIRONMENT DETECTION
  // ============================================================
  const IS_BETA = window.location.hostname.includes('abc-mlops.beta') ||
                  window.location.pathname.includes('/reviewer');

  // ============================================================
  // LAST ANNOTATION MEMORY
  // ============================================================
  let lastAnnotation = null;

  const PRESETS = [
    {
      group:              "Single-Turn",
      label:              "Accurate response",
      sublabel:           "CS: Yes | CC: N/A",
      color:              "#22c55e",
      turnType:           "Single-Turn",
      betaTurnType:       "Single Turn",
      contextSwitchId:    "cs-yes",
      contextSwitchValue: "Yes",
      convContextId:      "cc-na",
      convContextValue:   "N/A"
    },
    {
      group:              "Single-Turn",
      label:              "Not relevant",
      sublabel:           "CS: No | CC: N/A",
      color:              "#ef4444",
      turnType:           "Single-Turn",
      betaTurnType:       "Single Turn",
      contextSwitchId:    "cs-no",
      contextSwitchValue: "No",
      convContextId:      "cc-na",
      convContextValue:   "N/A"
    },
    {
      group:              "Single-Turn",
      label:              "No switch / First",
      sublabel:           "CS: N/A | CC: N/A",
      color:              "#6b7280",
      turnType:           "Single-Turn",
      betaTurnType:       "Single Turn",
      contextSwitchId:    "cs-na",
      contextSwitchValue: "N/A",
      convContextId:      "cc-na",
      convContextValue:   "N/A"
    },
    {
      group:              "Multi-Turn",
      label:              "Used context well",
      sublabel:           "CS: N/A | CC: Yes",
      color:              "#3b82f6",
      turnType:           "Multi-Turn",
      betaTurnType:       "Multi-Turn",
      contextSwitchId:    "cs-na",
      contextSwitchValue: "N/A",
      convContextId:      "cc-yes",
      convContextValue:   "Yes"
    },
    {
      group:              "Multi-Turn",
      label:              "Ignored context",
      sublabel:           "CS: N/A | CC: No",
      color:              "#f97316",
      turnType:           "Multi-Turn",
      betaTurnType:       "Multi-Turn",
      contextSwitchId:    "cs-na",
      contextSwitchValue: "N/A",
      convContextId:      "cc-no",
      convContextValue:   "No"
    },
    {
      group:              "Cannot Judge",
      label:              "Human Evaluator - Cannot Judge",
      sublabel:           "ALL fields → Cannot Judge",
      color:              "#a855f7",
      turnType:           "Human Evaluator - Cannot Judge",
      betaTurnType:       "Human Evaluator - Cannot Judge",
      contextSwitchId:    "cs-cannot-judge",
      contextSwitchValue: "Human Evaluator - Cannot Judge",
      convContextId:      "cc-cannot-judge",
      convContextValue:   "Human Evaluator - Cannot Judge",
      fillAll:            true
    }
  ];

  // ============================================================
  // BETA CORE HELPERS
  // ============================================================

  // Minimal event sequence that works with Cloudscape/React
  function minimalClick(el) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup',   opts));
    el.dispatchEvent(new MouseEvent('click',     opts));
  }

  // Find a formField button by its label text
  function betaFindBtnByLabel(labelText) {
    const btns = document.querySelectorAll('button[id^="formField"]');
    for (const btn of btns) {
      let el = btn;
      for (let i = 0; i < 10; i++) {
        el = el.parentElement;
        if (!el) break;
        const lbl = el.querySelector('label');
        if (lbl && lbl.textContent.replace(' *', '').trim() === labelText) return btn;
      }
    }
    return null;
  }

  // Open a Cloudscape dropdown and click an option by its exact text
  function betaSetDropdown(labelText, optionText) {
    return new Promise((resolve) => {
      const btn = betaFindBtnByLabel(labelText);
      if (!btn) { resolve(false); return; }

      // Open it
      minimalClick(btn);

      // Poll for the open dialog
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        const dialog = document.querySelector('[class*="awsui_open"]');
        if (dialog) {
          clearInterval(poll);

          // Find option by exact own text
          let target = null;
          dialog.querySelectorAll('span, li, div').forEach(el => {
            const own = [...el.childNodes]
              .filter(n => n.nodeType === 3)
              .map(n => n.textContent.trim())
              .filter(Boolean)
              .join('');
            if (own === optionText) target = el;
          });

          if (target) {
            minimalClick(target);
            resolve(true);
          } else {
            // Close and give up
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            resolve(false);
          }
        }
        if (attempts >= 20) {
          clearInterval(poll);
          resolve(false);
        }
      }, 50);
    });
  }

  // Set a radio inside a section found by its label text, matched by value
  function betaSetRadio(labelText, value) {
    // Find all labels, locate the one matching labelText
    const allEls = document.querySelectorAll('label, span, div, legend, fieldset');
    for (const lbl of allEls) {
      const txt = lbl.textContent.replace(' *', '').trim();
      if (txt !== labelText) continue;

      // Walk up to find radio group container
      let container = lbl;
      for (let i = 0; i < 10; i++) {
        container = container.parentElement;
        if (!container) break;
        const radios = container.querySelectorAll('input[type="radio"]');
        if (radios.length >= 2) {
          for (const radio of radios) {
            if (radio.value === value) {
              minimalClick(radio);
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  // Set text field by placeholder
  function betaSetText(placeholder, value) {
    const el = document.querySelector(`[placeholder="${placeholder}"]`);
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================
  // BETA: APPLY PRESET
  // ============================================================
  async function betaApplyPreset(preset) {
    const CJ = 'Human Evaluator - Cannot Judge';

    setStatus('⏳ Filling...', '#60a5fa');

    if (preset.fillAll) {
      await betaSetDropdown('Turn Type Classification', CJ);          await delay(300);
      betaSetRadio('Context Switch Accurate',           CJ);          await delay(150);
      betaSetRadio('Conversation Context Accurate',     CJ);          await delay(150);
      betaSetRadio('Tool Invoked Accurate',             CJ);          await delay(150);
      await betaSetDropdown('HVA Category',             CJ);          await delay(300);
      await betaSetDropdown('Interaction Type',         CJ);          await delay(300);
      await betaSetDropdown('Static Response Type',     CJ);          await delay(300);
      await betaSetDropdown('Customer Service Routing', CJ);          await delay(300);
      betaSetRadio('Response Content Accurate',         CJ);          await delay(150);
      await betaSetDropdown('Negative Customer Feedback Classification', CJ); await delay(300);
      betaSetText('Enter expected response...', 'N/A');
    } else {
      await betaSetDropdown('Turn Type Classification', preset.betaTurnType); await delay(300);
      betaSetRadio('Context Switch Accurate',           preset.contextSwitchValue); await delay(150);
      betaSetRadio('Conversation Context Accurate',     preset.convContextValue);   await delay(150);
      betaSetText('Enter expected response...', 'N/A');
      await betaSetDropdown('Negative Customer Feedback Classification', 'N/A');
    }

    setStatus('✅ ' + preset.label, '#86efac');
  }

  // ============================================================
  // BETA: CAPTURE SNAPSHOT
  // ============================================================
  function betaCaptureSnapshot() {
    const getDropdownVal = (labelText) => {
      const btn = betaFindBtnByLabel(labelText);
      return btn ? btn.textContent.trim() : '';
    };

    const getRadioVal = (labelText) => {
      const allEls = document.querySelectorAll('label, span, div, legend, fieldset');
      for (const lbl of allEls) {
        if (lbl.textContent.replace(' *', '').trim() !== labelText) continue;
        let container = lbl;
        for (let i = 0; i < 10; i++) {
          container = container.parentElement;
          if (!container) break;
          const checked = container.querySelector('input[type="radio"]:checked');
          if (checked) return checked.value;
        }
      }
      return '';
    };

    const getTextVal = (ph) => {
      const el = document.querySelector(`[placeholder="${ph}"]`);
      return el ? el.value : '';
    };

    return {
      turnType:         getDropdownVal('Turn Type Classification'),
      csValue:          getRadioVal('Context Switch Accurate'),
      ccValue:          getRadioVal('Conversation Context Accurate'),
      toolValue:        getRadioVal('Tool Invoked Accurate'),
      hvaCategory:      getDropdownVal('HVA Category'),
      interactionType:  getDropdownVal('Interaction Type'),
      staticResponse:   getDropdownVal('Static Response Type'),
      csRouting:        getDropdownVal('Customer Service Routing'),
      rcaValue:         getRadioVal('Response Content Accurate'),
      negFeedback:      getDropdownVal('Negative Customer Feedback Classification'),
      expectedResponse: getTextVal('Enter expected response...'),
      observations:     getTextVal('Add observations...'),
      // nulls for gamma-only fields
      contextSwitch: null, convContext: null,
      toolInvoked: null, responseAccurate: null, customHva: ''
    };
  }

  // ============================================================
  // BETA: APPLY SNAPSHOT
  // ============================================================
  async function betaApplySnapshot(snap) {
    if (!snap) return;
    setStatus('⏳ Pasting...', '#60a5fa');

    const skip = ['Select...', 'Select HVA category...', 'Select interaction type...',
                  'Select static response type...', ''];

    if (snap.turnType && !skip.includes(snap.turnType)) {
      await betaSetDropdown('Turn Type Classification', snap.turnType); await delay(300);
    }
    if (snap.csValue)   betaSetRadio('Context Switch Accurate',       snap.csValue);
    if (snap.ccValue)   betaSetRadio('Conversation Context Accurate', snap.ccValue);
    if (snap.toolValue) betaSetRadio('Tool Invoked Accurate',         snap.toolValue);

    if (snap.hvaCategory && !skip.includes(snap.hvaCategory)) {
      await betaSetDropdown('HVA Category', snap.hvaCategory); await delay(300);
    }
    if (snap.interactionType && !skip.includes(snap.interactionType)) {
      await betaSetDropdown('Interaction Type', snap.interactionType); await delay(300);
    }
    if (snap.staticResponse && !skip.includes(snap.staticResponse)) {
      await betaSetDropdown('Static Response Type', snap.staticResponse); await delay(300);
    }
    if (snap.csRouting && !skip.includes(snap.csRouting)) {
      await betaSetDropdown('Customer Service Routing', snap.csRouting); await delay(300);
    }
    if (snap.rcaValue) betaSetRadio('Response Content Accurate', snap.rcaValue);
    if (snap.negFeedback && !skip.includes(snap.negFeedback)) {
      await betaSetDropdown('Negative Customer Feedback Classification', snap.negFeedback); await delay(300);
    }
    if (snap.expectedResponse) betaSetText('Enter expected response...', snap.expectedResponse);
    if (snap.observations)     betaSetText('Add observations...',        snap.observations);

    setStatus('⎘ Snapshot pasted!', '#f59e0b');
  }

  // ============================================================
  // STYLES
  // ============================================================
  GM_addStyle(`
    #orbit-filler-panel {
      position: fixed; z-index: 999999;
      background: #1e1e2e; border: 1px solid #3b82f6;
      border-radius: 9px; padding: 0; width: 195px;
      font-family: Arial, sans-serif;
      box-shadow: 0 3px 16px rgba(0,0,0,0.55);
      transition: box-shadow 0.15s; user-select: none;
    }
    #orbit-filler-panel.dragging {
      box-shadow: 0 8px 32px rgba(0,0,0,0.8); opacity: 0.95; cursor: grabbing !important;
    }
    #orbit-filler-panel.collapsed {
      width: 28px; height: 28px; border-radius: 6px; overflow: hidden;
      cursor: grab; display: flex; align-items: center; justify-content: center; padding: 0;
    }
    #orbit-filler-panel.collapsed .orbit-panel-inner { display: none; }
    #orbit-collapse-icon { display: none; font-size: 14px; color: #60a5fa; user-select: none; }
    #orbit-filler-panel.collapsed #orbit-collapse-icon { display: block; }
    #orbit-panel-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 7px 8px 6px 8px; border-bottom: 1px solid #374151;
      cursor: grab; border-radius: 9px 9px 0 0; background: #252540;
    }
    #orbit-panel-header:active { cursor: grabbing; }
    #orbit-drag-hint { font-size: 8px; color: #4b5563; letter-spacing: 0.3px; pointer-events: none; }
    #orbit-panel-title { color: #93c5fd; font-size: 10px; font-weight: bold; letter-spacing: 0.3px; pointer-events: none; }
    .orbit-header-right { display: flex; align-items: center; gap: 5px; }
    #orbit-reset-pos-btn {
      background: none; border: none; color: #4b5563; font-size: 10px;
      cursor: pointer; padding: 0; line-height: 1; transition: color 0.15s;
    }
    #orbit-reset-pos-btn:hover { color: #9ca3af; }
    #orbit-toggle-btn { background: none; border: none; color: #93c5fd; font-size: 12px; cursor: pointer; padding: 0; line-height: 1; }
    #orbit-toggle-btn:hover { color: #fff; }
    .orbit-panel-body { padding: 8px; }
    #orbit-copy-section { margin-bottom: 6px; border: 1px solid #2d2d45; border-radius: 6px; overflow: hidden; }
    #orbit-save-snap-btn {
      display: flex; align-items: center; justify-content: center; gap: 4px;
      width: 100%; padding: 4px 0; border: none; border-bottom: 1px solid #2d2d45;
      background: #1a2535; color: #60a5fa; font-size: 9px; font-weight: 700;
      cursor: pointer; letter-spacing: 0.3px; transition: background 0.15s; box-sizing: border-box;
    }
    #orbit-save-snap-btn:hover { background: #1e3050; }
    #orbit-snap-preview {
      padding: 4px 6px; font-size: 8px; color: #6b7280; background: #252535;
      line-height: 1.6; min-height: 20px; word-break: break-word; border-bottom: 1px solid #2d2d45;
    }
    #orbit-snap-preview.has-data { color: #9ca3af; }
    #orbit-snap-preview span {
      display: inline-block; background: #374151; border-radius: 3px;
      padding: 0 3px; margin: 1px 1px; font-size: 7.5px; color: #d1d5db;
    }
    #orbit-paste-snap-btn {
      display: flex; align-items: center; justify-content: center; gap: 4px;
      width: 100%; padding: 5px 0; border: none; background: #252535; color: #6b7280;
      font-size: 9.5px; font-weight: 700; cursor: not-allowed; letter-spacing: 0.3px;
      transition: all 0.15s; box-sizing: border-box; opacity: 0.5;
    }
    #orbit-paste-snap-btn.ready { color: #fbbf24; cursor: pointer; opacity: 1; background: #2a2010; }
    #orbit-paste-snap-btn.ready:hover { background: #3a2e10; }
    #orbit-paste-snap-btn.ready:active { transform: scale(0.97); }
    .orbit-group-label {
      font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      color: #6b7280; margin: 5px 0 3px 1px; display: flex; align-items: center; gap: 4px;
    }
    .orbit-group-label::after { content: ''; flex: 1; height: 1px; background: #374151; }
    .orbit-preset-card {
      display: flex; align-items: center; gap: 5px; margin-bottom: 3px; cursor: pointer;
      border-radius: 5px; padding: 4px 6px; background: #252535; border: 1px solid #2d2d45;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
    }
    .orbit-preset-card:hover { background: #2d2d45; border-color: #4b5563; transform: scale(1.01); }
    .orbit-preset-card:active { transform: scale(0.97); }
    .orbit-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .orbit-card-text { flex: 1; min-width: 0; }
    .orbit-card-main { font-size: 9.5px; font-weight: 600; color: #e5e7eb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .orbit-card-sub { font-size: 8px; color: #6b7280; margin-top: 1px; }
    .orbit-tt-pill { font-size: 7.5px; font-weight: 700; padding: 1px 4px; border-radius: 3px; color: #fff; flex-shrink: 0; }
    #orbit-status { margin-top: 5px; font-size: 9px; min-height: 12px; text-align: center; border-top: 1px solid #374151; padding-top: 4px; color: #86efac; }
    #orbit-confirm-box {
      display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15,15,25,0.96); border-radius: 9px; z-index: 10;
      flex-direction: column; align-items: center; justify-content: center;
      padding: 12px; box-sizing: border-box; gap: 8px;
    }
    #orbit-confirm-box.show { display: flex; }
    #orbit-confirm-text { font-size: 9.5px; color: #e5e7eb; text-align: center; line-height: 1.5; }
    #orbit-confirm-text strong { color: #fbbf24; }
    .orbit-confirm-btns { display: flex; gap: 6px; width: 100%; }
    .orbit-confirm-btns button { flex: 1; padding: 5px 0; border: none; border-radius: 5px; font-size: 9.5px; font-weight: 700; cursor: pointer; }
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
  const savedPos = getSavedPosition();
  panel.style.top  = savedPos.top  + 'px';
  panel.style.left = savedPos.left + 'px';

  const collapseIcon = document.createElement('span');
  collapseIcon.id = 'orbit-collapse-icon';
  collapseIcon.textContent = '⚡';
  panel.appendChild(collapseIcon);

  const inner = document.createElement('div');
  inner.className = 'orbit-panel-inner';
  inner.style.position = 'relative';

  // Header
  const header = document.createElement('div');
  header.id = 'orbit-panel-header';

  const titleEl = document.createElement('span');
  titleEl.id = 'orbit-panel-title';
  titleEl.innerHTML = IS_BETA
    ? '⚡ Quick Fill <span style="background:#f97316;color:#fff;font-size:7px;font-weight:700;padding:1px 4px;border-radius:3px;margin-left:3px">BETA</span>'
    : '⚡ Quick Fill <span style="background:#22c55e;color:#fff;font-size:7px;font-weight:700;padding:1px 4px;border-radius:3px;margin-left:3px">GAMMA</span>';

  const dragHint = document.createElement('span');
  dragHint.id = 'orbit-drag-hint';
  dragHint.textContent = '⠿ drag';

  const headerRight = document.createElement('div');
  headerRight.className = 'orbit-header-right';

  const resetPosBtn = document.createElement('button');
  resetPosBtn.id = 'orbit-reset-pos-btn';
  resetPosBtn.title = 'Reset to default position';
  resetPosBtn.textContent = '⌖';
  resetPosBtn.addEventListener('click', e => { e.stopPropagation(); resetPosition(); });

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

  // Body
  const body = document.createElement('div');
  body.className = 'orbit-panel-body';

  // Copy section
  const copySection = document.createElement('div');
  copySection.id = 'orbit-copy-section';

  const saveSnapBtn = document.createElement('button');
  saveSnapBtn.id = 'orbit-save-snap-btn';
  saveSnapBtn.innerHTML = '📋 Save Current as Snapshot';
  saveSnapBtn.addEventListener('click', e => {
    e.stopPropagation();
    const snap = IS_BETA ? betaCaptureSnapshot() : captureSnapshot();
    if (!snap.turnType && !snap.csValue && !snap.ccValue) {
      setStatus('⚠️ Nothing to save', '#fbbf24'); return;
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
  pasteSnapBtn.disabled = true;
  pasteSnapBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (lastAnnotation) showConfirm();
  });
  copySection.appendChild(pasteSnapBtn);
  body.appendChild(copySection);

  // Preset cards
  let lastGroup = null;
  PRESETS.forEach(preset => {
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
    if (preset.group === 'Single-Turn')     { pill.style.background = '#0f766e'; pill.textContent = 'ST'; }
    else if (preset.group === 'Multi-Turn') { pill.style.background = '#1d4ed8'; pill.textContent = 'MT'; }
    else                                    { pill.style.background = '#7c3aed'; pill.textContent = '🤷'; }

    card.appendChild(dot);
    card.appendChild(textBlock);
    card.appendChild(pill);
    card.addEventListener('click', () => IS_BETA ? betaApplyPreset(preset) : applyPreset(preset));
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
    </div>`;
  inner.appendChild(confirmBox);
  panel.appendChild(inner);
  document.body.appendChild(panel);

  document.getElementById('orbit-confirm-yes').addEventListener('click', () => {
    confirmBox.classList.remove('show');
    IS_BETA ? betaApplySnapshot(lastAnnotation) : applySnapshot(lastAnnotation);
  });
  document.getElementById('orbit-confirm-no').addEventListener('click', () => {
    confirmBox.classList.remove('show');
    setStatus('Paste cancelled', '#6b7280');
  });

  // Collapse
  toggleBtn.addEventListener('click', e => { e.stopPropagation(); panel.classList.add('collapsed'); });
  collapseIcon.addEventListener('click', () => panel.classList.remove('collapsed'));

  // ============================================================
  // DRAG
  // ============================================================
  let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
  header.addEventListener('mousedown', startDrag);
  collapseIcon.addEventListener('mousedown', startDrag);

  function startDrag(e) {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragOffsetX = e.clientX - panel.getBoundingClientRect().left;
    dragOffsetY = e.clientY - panel.getBoundingClientRect().top;
    panel.classList.add('dragging');
    e.preventDefault();
  }
  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    let newLeft = Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth  - panel.offsetWidth));
    let newTop  = Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - panel.offsetHeight));
    panel.style.left = newLeft + 'px';
    panel.style.top  = newTop  + 'px';
    panel.style.right = panel.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    panel.classList.remove('dragging');
    savePosition(parseInt(panel.style.top), parseInt(panel.style.left));
  });

  // ============================================================
  // POSITION
  // ============================================================
  function savePosition(top, left) { GM_setValue('orbit_panel_top', top); GM_setValue('orbit_panel_left', left); }
  function getSavedPosition() {
    return { top: GM_getValue('orbit_panel_top', 48), left: GM_getValue('orbit_panel_left', window.innerWidth - 233) };
  }
  function resetPosition() {
    panel.style.top = '48px'; panel.style.left = (window.innerWidth - 233) + 'px';
    panel.style.right = panel.style.bottom = 'auto';
    savePosition(48, window.innerWidth - 233);
    setStatus('↖ Position reset', '#9ca3af');
  }
  function showConfirm() { confirmBox.classList.add('show'); }

  // ============================================================
  // SHARED: UPDATE SNAPSHOT PREVIEW
  // ============================================================
  function updateSnapshot(snap) {
    lastAnnotation = snap;
    pasteSnapBtn.disabled = false;
    pasteSnapBtn.classList.add('ready');
    pasteSnapBtn.title = 'Paste saved snapshot to this chat';
    snapPreview.innerHTML = '';
    snapPreview.classList.add('has-data');
    const chips = [
      snap.turnType || null,
      snap.csValue    ? 'CS:'  + snap.csValue  : null,
      snap.ccValue    ? 'CC:'  + snap.ccValue  : null,
      snap.toolValue  ? 'TI:'  + snap.toolValue : null,
      snap.rcaValue   ? 'RCA:' + snap.rcaValue  : null,
      snap.interactionType || null,
      (snap.negFeedback && snap.negFeedback !== 'N/A') ? 'NF:' + snap.negFeedback : null,
    ].filter(Boolean);
    chips.forEach(chip => {
      const s = document.createElement('span');
      s.textContent = chip;
      snapPreview.appendChild(s);
    });
    if (!chips.length) snapPreview.textContent = 'Snapshot saved (empty form)';
  }

  function setStatus(msg, color) {
    statusEl.style.color = color;
    statusEl.textContent = msg;
    setTimeout(() => { statusEl.textContent = ''; }, 2500);
  }

  // ============================================================
  // GAMMA HELPERS (original — unchanged)
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
  function setSelectByIdFuzzy(id, value) {
    if (!value) return false;
    const el = document.getElementById(id);
    if (!el) return false;
    const norm = s => s.replace(/[\u2014\u2013\u2012\u2015\u2212—–-]/g,'-').trim().toLowerCase();
    const nv = norm(value);
    for (const opt of el.options) {
      if (opt.value === value || opt.text.trim() === value) { el.value = opt.value; el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('input',{bubbles:true})); return true; }
    }
    for (const opt of el.options) {
      if (norm(opt.value) === nv || norm(opt.text) === nv) { el.value = opt.value; el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('input',{bubbles:true})); return true; }
    }
    return false;
  }
  function setRadioById(id) {
    if (!id) return false;
    const el = document.getElementById(id);
    if (!el) return false;
    el.checked = true; el.click(); el.dispatchEvent(new Event('change',{bubbles:true})); return true;
  }
  function setRadioByNameFuzzy(name, valueText) {
    if (!name || !valueText) return false;
    const norm = s => s.replace(/[\u2014\u2013\u2012\u2015\u2212—–-]/g,'-').trim().toLowerCase();
    const nv = norm(valueText);
    const radios = document.querySelectorAll(`input[name="${name}"]`);
    for (const r of radios) {
      if (norm(r.value) === nv) { r.checked=true; r.click(); r.dispatchEvent(new Event('change',{bubbles:true})); return true; }
      const lbl = document.querySelector(`label[for="${r.id}"]`) || r.closest('label');
      if (lbl && norm(lbl.textContent) === nv) { r.checked=true; r.click(); r.dispatchEvent(new Event('change',{bubbles:true})); return true; }
    }
    return false;
  }
  function setTextById(id, value) {
    if (value == null) return false;
    const el = document.getElementById(id);
    if (!el) return false;
    el.value = value; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return true;
  }
  function captureSnapshot() {
    const csR  = document.querySelector('input[name="context-switch"]:checked');
    const ccR  = document.querySelector('input[name="conv-context"]:checked');
    const rcaR = document.querySelector('input[name="response-accurate"]:checked');
    const toolR= document.querySelector('input[name="tool-invoked"]:checked') ||
                 document.querySelector('input[name="tool-accurate"]:checked') ||
                 document.querySelector('input[name="tool-invocation"]:checked');
    const hvaVal = getSelectValue('hva-category-select');
    return {
      turnType: getSelectValue('turn-type-select'),
      contextSwitch: csR ? csR.id : null, csValue: csR ? csR.value : '',
      convContext: ccR ? ccR.id : null,   ccValue: ccR ? ccR.value : '',
      toolInvoked: toolR ? toolR.id : null, toolValue: toolR ? toolR.value : '',
      hvaCategory: hvaVal, customHva: hvaVal === '__custom__' ? getTextValue('custom-hva-input') : '',
      interactionType: getSelectValue('interaction-type-select'),
      staticResponse: getSelectValue('static-response-type-select'),
      csRouting: getSelectValue('cs-routing-select'),
      responseAccurate: rcaR ? rcaR.id : null, rcaValue: rcaR ? rcaR.value : '',
      negFeedback: getSelectValue('neg-feedback-select'),
      expectedResponse: getTextValue('expected-response'),
      observations: getTextValue('observations'),
    };
  }
  function getSelectValue(id) { const el=document.getElementById(id); return el?el.value:''; }
  function getTextValue(id)   { const el=document.getElementById(id); return el?el.value:''; }
  function applySnapshot(snap) {
    if (!snap) return;
    if (snap.turnType)        setSelectById('turn-type-select', snap.turnType);
    if (snap.hvaCategory)     setSelectById('hva-category-select', snap.hvaCategory);
    if (snap.interactionType) setSelectById('interaction-type-select', snap.interactionType);
    if (snap.staticResponse)  setSelectById('static-response-type-select', snap.staticResponse);
    if (snap.csRouting)       setSelectById('cs-routing-select', snap.csRouting);
    if (snap.negFeedback)     setSelectById('neg-feedback-select', snap.negFeedback);
    if (snap.hvaCategory === '__custom__' && snap.customHva) {
      const box = document.getElementById('custom-hva-box');
      if (box) box.classList.remove('hidden');
      setTextById('custom-hva-input', snap.customHva);
    }
    if (snap.contextSwitch)    setRadioById(snap.contextSwitch);
    if (snap.convContext)      setRadioById(snap.convContext);
    if (snap.toolInvoked)      setRadioById(snap.toolInvoked);
    if (snap.responseAccurate) setRadioById(snap.responseAccurate);
    if (snap.expectedResponse) setTextById('expected-response', snap.expectedResponse);
    if (snap.observations)     setTextById('observations', snap.observations);
    setStatus('⎘ Snapshot pasted!', '#f59e0b');
  }
  function applyPreset(preset) {
    setSelectById('turn-type-select', preset.turnType);
    setRadioById(preset.contextSwitchId);
    setRadioById(preset.convContextId);
    setTextById('expected-response', 'N/A');
    setSelectById('neg-feedback-select', 'N/A');
    if (preset.fillAll) {
      const cj = 'Human Evaluator - Cannot Judge';
      setSelectByIdFuzzy('turn-type-select', cj);
      if (!setRadioById('cs-cannot-judge'))  setRadioByNameFuzzy('context-switch', cj);
      if (!setRadioById('cc-cannot-judge'))  setRadioByNameFuzzy('conv-context', cj);
      if (!setRadioById('tool-cannot-judge')) {
        if (!setRadioById('ti-cannot-judge')) {
          if (!setRadioByNameFuzzy('tool-invoked', cj)) {
            if (!setRadioByNameFuzzy('tool-accurate', cj)) setRadioByNameFuzzy('tool-invocation', cj);
          }
        }
      }
      setSelectByIdFuzzy('hva-category-select', cj);
      setSelectByIdFuzzy('interaction-type-select', cj);
      setSelectByIdFuzzy('static-response-type-select', cj);
      setSelectByIdFuzzy('cs-routing-select', cj);
      if (!setRadioById('rca-cannot-judge')) {
        if (!setRadioByNameFuzzy('response-accurate', cj)) setRadioByNameFuzzy('response-content', cj);
      }
      setSelectByIdFuzzy('neg-feedback-select', cj);
      setTextById('expected-response', 'N/A');
    }
    setStatus('✅ ' + preset.label, '#86efac');
  }

})();
