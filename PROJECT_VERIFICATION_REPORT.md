# AI Context Tracker - Project Verification Report

> Audit date: July 15, 2026  
> Scope reviewed: `architecturePlan.md`, `product_specification.md`, `ux_design_specification.md`, workspace source code, build/test/lint configuration, and generated Chrome MV3 output.

## Executive Summary

The project has progressed beyond pure planning. It contains a working WXT browser-extension scaffold, Preact UI entrypoints, platform adapters, a background service worker, local state storage, token estimation, rolling summary logic, transfer export logic, notifications, and snapshot/history UI components.

However, the implementation should be treated as an alpha prototype, not a completed V1. It compiles and builds, but several core architecture promises are not yet met: CSP is not zero-network, tokenization is not offloaded to an offscreen worker, state is not per-tab/session-first, no real degradation engine exists, tests do not run, lint fails, and the final bundle is far above the documented performance budget.

The planning documents are also inconsistent with the repository status. `TODO.md` still describes the project as pre-implementation with all phases unchecked, while `PROJECT.md` claims phases through profiling and optimization are complete. The source code supports a middle position: many screens and engines exist, but several are partial, static, or not wired end-to-end.

## Verification Commands

| Check                 |     Result | Notes                                                                                                                            |
| --------------------- | ---------: | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run compile` |       Pass | TypeScript strict compile completed successfully.                                                                                |
| `npm.cmd run build`   |       Pass | Chrome MV3 extension output generated under `.output/chrome-mv3`.                                                                |
| `npm.cmd test`        |       Fail | Vitest config fails before tests run: `wxt/testing` is ESM-only but is loaded through CJS config bundling.                       |
| `npm.cmd run lint`    |       Fail | 47 total findings: 34 errors and 13 warnings. Main issues are `any`, `@ts-ignore`, unused imports, and hook dependency warnings. |
| Test file discovery   | None found | No `*.test.*`, `*.spec.*`, or `__tests__` files were found, despite `vitest.config.ts` referencing `src/__tests__/setup.ts`.     |

## What Was Planned

### Product Plan

The product specification describes a privacy-first browser extension that makes AI chat context usage visible across AI platforms. The MVP scope is:

| MVP Feature                   | Priority |
| ----------------------------- | -------: |
| Context window meter          |       P0 |
| Real-time token counter       |       P0 |
| Remaining token estimate      |       P0 |
| Degradation health score      |       P0 |
| Platform and model detection  |       P0 |
| Accuracy confidence indicator |       P0 |
| Floating widget               |       P0 |
| Side panel dashboard          |       P1 |
| Warning thresholds            |       P1 |
| Conversation turn counter     |       P1 |
| Dark/light theme              |       P1 |

The MVP platform plan is ChatGPT, Claude, and Gemini. Grok, Perplexity, rolling summaries, transfer summaries, session history, export, snapshots, cost estimation, and analytics are described as V2 or later.

### Architecture Plan

The architecture plan calls for:

| Area               | Planned Direction                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Architecture style | Event-driven, layered, unidirectional data flow                                                    |
| Privacy            | No backend and no network exfiltration path                                                        |
| CSP                | `connect-src 'none'` and `object-src 'none'`                                                       |
| Entrypoints        | Background, content, side panel, popup, options, offscreen document                                |
| Token engine       | Exact GPT tokenizer, approximate non-GPT tokenizers, worker/offscreen offload                      |
| Degradation engine | Separate weighted signal engine                                                                    |
| Storage            | Session for active metrics, sync for settings, local/IndexedDB for persisted history and summaries |
| Adapters           | Isolated per-platform DOM adapters with health reporting                                           |
| Performance        | Content script under 15 KB gzip, service worker around 10 KB gzip, low CPU idle                    |
| UI                 | Shadow DOM widget, popup, side panel, options, notification cards, onboarding                      |

### UX Plan

The UX spec defines a dark-first premium interface with:

| Screen                          | Planned Status |
| ------------------------------- | -------------- |
| Popup dark/light                | MVP            |
| Side panel dashboard dark/light | MVP            |
| Floating widget states          | MVP            |
| Settings page                   | MVP            |
| Notification cards              | MVP            |
| Onboarding                      | MVP            |
| Rolling summary                 | V2             |
| Transfer summary dialog         | V2             |
| Conversation history            | V2             |
| Snapshot manager                | V2             |

## What Was Built

### Project Foundation

| Built Item                  | Evidence                                                 |
| --------------------------- | -------------------------------------------------------- |
| WXT extension scaffold      | `wxt.config.ts`, WXT entrypoints under `src/entrypoints` |
| Preact UI                   | Popup, side panel, options, widget components            |
| Tailwind CSS v4 integration | `@tailwindcss/vite`, `src/ui/styles/tailwind.css`        |
| MV3 manifest generation     | Build output `.output/chrome-mv3/manifest.json`          |
| CI workflow                 | `.github/workflows/ci.yml`                               |
| TypeScript strict compile   | `npm.cmd run compile` passes                             |

### Runtime Architecture

| Built Item                | Status                                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| Background service worker | Implemented as a central message handler                                |
| Content script            | Implemented with platform detection, DOM observation, widget mount      |
| Messaging layer           | Implemented, but simplified versus the spec protocol                    |
| Storage layer             | Implemented with WXT storage, but mainly a single `local:appState` item |
| Zustand UI state          | Implemented and watches app state across contexts                       |
| Shadow DOM widget         | Implemented through `createShadowRootUi`                                |

### Platform Support

| Platform   | Planned Phase | Built Status         |
| ---------- | ------------: | -------------------- |
| ChatGPT    |           MVP | Adapter exists       |
| Claude     |           MVP | Adapter exists       |
| Gemini     |           MVP | Adapter exists       |
| Grok       |         V2/P1 | Early adapter exists |
| Perplexity |         V2/P1 | Early adapter exists |

The Grok and Perplexity adapters are ahead of the MVP plan, but the shared `PlatformId` type still only includes `chatgpt`, `claude`, and `gemini`, causing casts to `any` around platform handling.

### Engines

| Engine              | Built Status               | Notes                                                                                  |
| ------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| Token engine        | Partial                    | Uses `js-tiktoken` for ChatGPT and char-ratio heuristics for Claude/Gemini.            |
| Summary engine      | Implemented                | Extractive and heuristic structured summary logic exists.                              |
| Transfer engine     | Implemented                | Generates Markdown, text, and JSON transfer exports.                                   |
| Degradation engine  | Missing as separate module | Health is mostly threshold-based with lightweight inline heuristics.                   |
| Notification engine | Partial                    | UI notifications exist, but no separate engine or Chrome notification API integration. |

### UI Surface

| UI Area                | Built Status         | Notes                                                                     |
| ---------------------- | -------------------- | ------------------------------------------------------------------------- |
| Popup                  | Partial              | Dark popup exists; settings overlay exists; Transfer button is not wired. |
| Side panel dashboard   | Partial              | Metrics, health rows, summary/history/settings tabs exist.                |
| Floating widget        | Partial/functional   | Draggable collapsed/expanded widget exists.                               |
| Options page           | Partial              | Onboarding gate and sidebar exist; non-general sections are placeholders. |
| Settings manager       | Partial              | Some thresholds and toggles exist; several toggles are visual only.       |
| Summary screen         | Functional prototype | Uses live summary state and supports regeneration request.                |
| Transfer dialog        | Functional prototype | Can copy/download/open target chat from generated export.                 |
| Transfer summary modal | Partial              | Copy works; Edit and Save buttons are visual only.                        |
| Conversation history   | Partial              | Uses snapshots as history, not real conversation persistence.             |
| Snapshot manager       | Partial              | Component exists, but it is imported and not exposed as a side panel tab. |
| Notification cards     | Partial              | Warning/critical UI exists; some actions are placeholders.                |

## Planned vs Built Matrix

| Capability                              | Planned | Built     | Verification                                                                        |
| --------------------------------------- | ------- | --------- | ----------------------------------------------------------------------------------- |
| MV3 extension scaffold                  | Yes     | Yes       | Builds successfully                                                                 |
| Specific host permissions               | Yes     | Partially | Includes extra wildcard hosts for Grok/Perplexity                                   |
| Zero-network CSP                        | Yes     | No        | CSP allows `connect-src 'self'`, `ws://localhost:3000`, and `http://localhost:3000` |
| No external assets                      | Yes     | No        | CSS imports Google Fonts URL                                                        |
| Service worker event router             | Yes     | Partial   | Exists, but combines orchestration, health logic, summary, and token work           |
| Offscreen worker for heavy tokenization | Yes     | No        | No offscreen entrypoint exists                                                      |
| Token counting                          | Yes     | Partial   | Exact GPT, heuristic Claude/Gemini, no worker, no incremental cache                 |
| Per-tab state                           | Yes     | No        | Single global `local:appState`, keyed mostly by platform                            |
| Session storage for active metrics      | Yes     | No        | Active state is stored in local storage                                             |
| Sync settings                           | Yes     | No        | No `sync:` settings store                                                           |
| IndexedDB history/summaries             | Yes     | No        | `idb` dependency exists, but no IndexedDB storage layer                             |
| Model database                          | Yes     | No        | No `src/models` directory or model registry                                         |
| Degradation detector                    | Yes     | No        | No standalone degradation engine or weighted signal system                          |
| Adapter health reporting                | Yes     | No        | No health reports or selector diagnostics                                           |
| Scoped DOM observation                  | Yes     | No        | Observer watches `document.body` with `subtree: true`                               |
| Page visibility suspension              | Yes     | No        | No visibility handling found                                                        |
| Popup                                   | Yes     | Partial   | Core view exists; light mode and transfer flow incomplete                           |
| Side panel dashboard                    | Yes     | Partial   | Dashboard exists; some actions not wired                                            |
| Settings                                | Yes     | Partial   | Many planned sections are placeholders or visual-only                               |
| Onboarding                              | Yes     | Partial   | Component exists and options page gates on `onboardingComplete`                     |
| Rolling summary                         | V2      | Partial   | Implemented as live summary prototype                                               |
| Transfer summary                        | V2      | Partial   | Engine and dialogs exist; some actions incomplete                                   |
| Conversation history                    | V2      | Partial   | Snapshot-derived list only                                                          |
| Snapshot manager                        | V2      | Partial   | Component exists but not reachable from side panel tabs                             |
| CI                                      | Yes     | Partial   | Workflow exists but test/lint currently fail locally                                |

## Key Findings

### 1. Privacy Architecture Is Not Enforced Yet

The architecture promises zero network and `connect-src 'none'`, but the current WXT config allows extension-page connections to `self`, `ws://localhost:3000`, and `http://localhost:3000`. The stylesheet also imports Google Fonts from `https://fonts.googleapis.com`.

This is the highest-priority gap because privacy is the core product claim. Even if localhost allowances are for development, production config should not ship them.

### 2. Performance Budget Is Missed

The production build succeeds, but emitted sizes are far beyond the architecture budget:

| Bundle          |          Planned Budget |   Actual Build Output |
| --------------- | ----------------------: | --------------------: |
| Service worker  |       10 KB gzip target |  5.64 MB uncompressed |
| Content script  |       15 KB gzip target | 98.32 KB uncompressed |
| Content CSS     | Not separately budgeted |              48.78 KB |
| Total extension |      125 KB gzip target |  5.96 MB uncompressed |

The large service worker is likely caused by loading `js-tiktoken` directly in the background bundle instead of offloading tokenization into an offscreen worker or separate chunk.

### 3. Storage Does Not Match the Data-Lifetime Plan

The plan requires session state for active metrics, sync state for settings, and IndexedDB/local persistence for history and summaries. The current code centralizes almost everything into `local:appState`.

This makes the prototype simpler, but it means active conversation state is persistent by default and not clearly per-tab. It also weakens the privacy and MV3 resilience design described in the specs.

### 4. The Degradation System Is Mostly Threshold Logic

The product promises context degradation detection using context fill, repetition, length drift, instruction drift, explicit forgetfulness, and turn count. Current behavior computes status mainly from token-fill thresholds and stores basic heuristic labels in the background worker.

There is no standalone `engines/degradation` module, no weighted score object, and no signal interface matching the architecture contract.

### 5. DOM Observation Is Functional but Too Broad

The content script uses a `MutationObserver`, but it observes `document.body` with `subtree: true`. The architecture specifically warns against broad body observation and calls for scoped observation of the conversation container, debounce, visibility suspension, and adapter health reporting.

Current debounce helps, but the observation scope still risks CPU overhead and false updates on complex AI pages.

### 6. Messaging Protocol Is Simplified

The implemented messages are `GET_STATE`, `UPDATE_TOKEN_COUNT`, `CONTENT_MUTATION`, `OPEN_SIDE_PANEL`, and `REGENERATE_SUMMARY`. The architecture specifies a richer discriminated union around `MESSAGES_UPDATED`, `PLATFORM_DETECTED`, `ADAPTER_HEALTH`, `METRICS_UPDATED`, `REQUEST_TRANSFER_SUMMARY`, and `SUMMARY_READY`.

The simplified protocol is acceptable for a prototype, but it does not yet support the planned observability, adapter health, per-tab state, or transfer workflow cleanly.

### 7. UI Implementation Is Ahead of Core Integration

Many V2 UI surfaces exist before their underlying data systems are complete. Summary, transfer, history, snapshot, and notification screens are useful prototypes, but several actions are placeholders or visual-only:

| UI Action                     | Current Gap               |
| ----------------------------- | ------------------------- |
| Popup Transfer                | Button has no handler     |
| Side panel Transfer           | Button has no handler     |
| Side panel Export             | Button has no handler     |
| Transfer summary modal Edit   | Button has no edit mode   |
| Transfer summary modal Save   | Button has no persistence |
| Notification Generate Summary | Logs to console           |
| Snapshot compare              | Disabled placeholder      |
| Options non-general sections  | Placeholder text          |

### 8. Tests and Lint Are Not Launch-Ready

TypeScript compile passes, which is good. But lint fails with 34 errors and test startup fails before any tests can run. There are no discovered unit or integration test files in the repo.

This means the CI workflow is present but would not currently give a clean quality gate.

## Documentation Accuracy

| Document                     | Accuracy                                                                |
| ---------------------------- | ----------------------------------------------------------------------- |
| `architecturePlan.md`        | Accurate as target architecture, not current implementation             |
| `product_specification.md`   | Accurate as product vision and phase plan                               |
| `ux_design_specification.md` | Accurate as target design language; implementation partially follows it |
| `ARCHITECTURE.md`            | Accurate as a summary target, but not current implementation            |
| `PROJECT.md`                 | Overstates completion; several claimed items are missing or partial     |
| `TODO.md`                    | Understates progress; still shows pre-implementation tasks unchecked    |

## Current Build Classification

Recommended classification: alpha prototype.

The extension can compile and produce a Chrome MV3 build. It has enough UI and engine code to demonstrate the concept, but it is not ready for production release, Chrome Web Store submission, or a privacy/security claim without addressing CSP, storage, tests, lint, and performance.

## Recommended Next Work

1. Fix production privacy guarantees: remove external font import, set production CSP to `connect-src 'none'` and `object-src 'none'`, and separate dev-only localhost allowances.
2. Move tokenization out of the service worker into an offscreen document or worker-like architecture to reduce the background bundle and match MV3 performance goals.
3. Replace `local:appState` with a proper state model: session per-tab metrics, sync settings, local/IndexedDB persisted summaries and snapshots.
4. Implement the degradation engine as a real module with weighted signals and testable pure functions.
5. Scope each adapter's `MutationObserver` to the conversation container and add visibility pause/resume plus adapter health reports.
6. Repair Vitest configuration, add focused tests for token engine, summary engine, transfer engine, storage updates, and adapter extraction helpers.
7. Clear lint errors, especially `any`, `@ts-ignore`, unused imports, and hook dependency warnings.
8. Wire incomplete UI actions or mark them disabled with explicit product-stage labels.
9. Reconcile `PROJECT.md` and `TODO.md` so planning status reflects source reality.
10. Add a small smoke checklist for installing `.output/chrome-mv3` into Chrome and testing ChatGPT, Claude, and Gemini manually.

## Bottom Line

We planned a privacy-first, production-grade AI context monitoring extension with strict architecture boundaries and a clear MVP/V2 split.

We built a substantial prototype: WXT extension, Preact UI, adapters, token counting, summary generation, transfer export, notifications, and snapshots. The core product direction is visible and promising, but the implementation currently mixes MVP and V2 features, misses several architecture constraints, and lacks passing tests/lint. The next phase should focus less on adding screens and more on hardening privacy, storage, performance, and verification.
