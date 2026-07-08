# ⚡ ORBIT-Gamma Quick Fill

A Tampermonkey userscript that supercharges annotation workflows in ORBIT-Gamma with one-click preset fills, snapshot copy-paste, and a sleek draggable panel. Designed to eliminate repetitive form-filling for Single-Turn and Multi-Turn chat evaluations.

![Version](https://img.shields.io/badge/version-7.0-blue)
![Platform](https://img.shields.io/badge/platform-Tampermonkey-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

## ✨ Features

- **One-Click Presets** — 6 pre-configured annotation combos for common scenarios (Single-Turn & Multi-Turn)
- **Snapshot Save & Paste** — Capture all current form values and paste them into the next chat
- **Draggable Panel** — Reposition anywhere on screen; position persists across reloads
- **Collapsible UI** — Minimize to a ⚡ icon when not in use
- **Reset Position** — One-click reset to default top-right position
- **Confirmation Dialog** — Prevents accidental overwrites when pasting
- **Dark Theme** — Clean, minimal dark UI that stays out of your way

## 🎯 Presets

### Single-Turn

| Preset | Context Switch | Conv. Context | Color |
|--------|---------------|---------------|-------|
| Accurate response | Yes | N/A | 🟢 Green |
| Not relevant | No | N/A | 🔴 Red |
| No switch / First | N/A | N/A | ⚫ Gray |

### Multi-Turn

| Preset | Context Switch | Conv. Context | Color |
|--------|---------------|---------------|-------|
| Used context well | N/A | Yes | 🔵 Blue |
| Ignored context | N/A | No | 🟠 Orange |
| N/A | N/A | N/A | ⚫ Gray |

## 📋 Supported Fields

| Field Type | IDs Captured |
|------------|-------------|
| Dropdowns | `turn-type-select`, `hva-category-select`, `interaction-type-select`, `static-response-type-select`, `cs-routing-select`, `neg-feedback-select` |
| Radio Buttons | `context-switch`, `conv-context`, `response-accurate` |
| Text Inputs | `custom-hva-input` |
| Textareas | `expected-response`, `observations` |

## 🚀 Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Click **Create a new script** in the Tampermonkey dashboard
