# PROJECT.md — AI Context Tracker

> **Last Updated:** July 13, 2026  
> **Status:** Phase 3 (Core Foundation) Completed
---

## Current Phase

🧠 **Phase 3: Core Foundation** — Complete. Moving into Phase 4.

## Architecture

**Style:** Event-driven, layered architecture (5 layers) with unidirectional data flow.  
**Backend:** None — fully local, privacy-first.  
**Full document:** [architecture.md](file:///C:/Users/VISHW/.gemini/antigravity-ide/brain/825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d/architecture.md)

### Layers
1. **Platform** — Chrome APIs, Host Page DOM
2. **Data Access** — Adapters, Storage, Model Database
3. **Intelligence** — Token Engine, Summary Engine, Degradation Detector
4. **Orchestration** — Service Worker
5. **Presentation** — Widget, Side Panel, Popup, Options

### Key Components
| Component | Technology | Rationale |
|:---|:---|:---|
| Build tool | WXT (Vite-based) | File-based entrypoints, auto-manifest, MV3-native |
| UI framework | Preact (3KB) | React DX at 1/13th bundle size |
| Tokenizer | js-tiktoken | Pure JS, zero-config, o200k_base |
| State | Zustand + chrome.storage | Lightweight, cross-context |
| Testing | Vitest + Playwright | Fast units + real browser E2E |

## Folder Structure

```
ai-context-tracker/
├── src/
│   ├── entrypoints/        # WXT entrypoints (background, content, sidepanel, popup, options, offscreen)
│   ├── adapters/            # Per-platform DOM adapters (chatgpt, claude, gemini)
│   ├── engines/             # Pure logic (token, summary, degradation)
│   ├── storage/             # 3-tier storage abstraction
│   ├── models/              # Static model database (JSON)
│   ├── messaging/           # Type-safe message passing
│   ├── notifications/       # Alert engine
│   ├── settings/            # Settings schema + validation
│   ├── ui/                  # Shared components, widget, hooks
│   └── shared/              # Constants, types, logger, errors
├── public/                  # Icons, static assets
├── scripts/                 # CI/CD helper scripts
└── wxt.config.ts            # WXT configuration
```

## Decisions

| # | Decision | Date | Rationale |
|:--|:---------|:-----|:----------|
| 1 | Privacy-first (zero network calls) | 2026-07-13 | Core brand promise; CSP enforced |
| 2 | Manifest V3 mandatory | 2026-07-13 | MV2 fully disabled since Oct 2024 |
| 3 | TypeScript strict mode | 2026-07-13 | Type safety for multi-platform adapters |
| 4 | Platform adapter pattern | 2026-07-13 | Isolates fragile DOM scraping |
| 5 | Shadow DOM for overlay UI | 2026-07-13 | CSS isolation from host pages |
| 6 | Side Panel over popup (primary UI) | 2026-07-13 | Persistent, stateful dashboard |
| 7 | `js-tiktoken` for GPT tokenization | 2026-07-13 | Pure JS, 99% accuracy |
| 8 | Extractive summarization for MVP | 2026-07-13 | Privacy-first; no LLM dependency |
| 9 | WXT as build framework | 2026-07-13 | File-based entrypoints, auto-manifest, cross-browser |
| 10 | Preact (not React) for UI | 2026-07-13 | 3KB vs 40KB+; content script weight matters |
| 11 | Web Worker via Offscreen API | 2026-07-13 | MV3 has no Worker constructor in service workers |
| 12 | 3-tier storage (session/local/IndexedDB) | 2026-07-13 | Right storage for right data lifetime |
| 13 | `connect-src 'none'` CSP | 2026-07-13 | Architectural privacy guarantee |
| 14 | Discriminated union messages | 2026-07-13 | Type-safe message passing, no stringly-typed bugs |
| 15 | Separate selectors.ts per adapter | 2026-07-13 | DOM changes → edit 1 file |
| 16 | Incremental tokenization | 2026-07-13 | Only re-count changed messages |
| 17 | Bundle size < 15KB per content script | 2026-07-13 | Performance budget for injected code |
| 18 | Dark-first design, auto theme detection | 2026-07-13 | AI platforms are predominantly dark; match host |
| 19 | Glassmorphism for floating widget | 2026-07-13 | Blends with host page; modern 2026 aesthetic |
| 20 | Lucide Icons (MIT, tree-shakeable) | 2026-07-13 | Open-source, consistent, < 500B per icon SVG |
| 21 | Inter + JetBrains Mono typography | 2026-07-13 | Industry-standard readability; monospace for code |
| 22 | WCAG 2.2 AA as baseline | 2026-07-13 | Accessible by default; color-blind safe design |

## Completed Work

- [x] Competitive landscape research (10 existing products)
- [x] Technical feasibility research
- [x] Product specification v1.0
- [x] Business model and pricing analysis
- [x] Risk assessment
- [x] Implementation phase planning (12 weeks)
- [x] **Complete software architecture design**
  - [x] 5-layer architecture with data flow diagrams
  - [x] Full folder structure (80+ files)
  - [x] Dependency graph with import rules
  - [x] 4 sequence diagrams (init, counting, transfer, alerts)
  - [x] Interface contracts (TypeScript types)
  - [x] Storage schema (3-tier + sync)
  - [x] Message passing protocol
  - [x] Security model + CSP
  - [x] Privacy architecture
  - [x] Performance budget
  - [x] Cross-browser strategy
  - [x] Future extensibility (plugin system)
- [x] **Complete UX design specification**
  - [x] 10 screen mockups generated (dark + light modes)
  - [x] Popup: dark (healthy) + light (caution) variants
  - [x] Dashboard side panel: dark + light with full metrics
  - [x] Floating widget: 4 health states + expanded view
  - [x] Settings page with sidebar navigation
  - [x] Transfer summary dialog with markdown preview
  - [x] Rolling summary screen with topic tags
  - [x] Conversation history with platform filters
  - [x] Snapshot manager with comparison feature
  - [x] Notification cards: 4 severity levels
  - [x] Onboarding welcome screen
  - [x] Design system: color tokens, typography, spacing, shadows
  - [x] Component library specifications (7 components)
  - [x] Animation specs: 14 micro-interactions with CSS
  - [x] Accessibility: WCAG 2.2 AA, ARIA patterns, color-blind safe
  - [x] Responsive behavior rules
  - [x] Icon system (Lucide)
  - [x] Empty states (4 variants)
  - [x] Keyboard shortcuts

## Pending Work

- [x] Founder review and approval of UX designs (Implied approved)
- [x] Project scaffolding and build pipeline (Phase 1)
  - [x] WXT with Preact config
  - [x] Tailwind CSS v4 setup
  - [x] ESlint (v8 fallback), Prettier, Husky, Commitlint
  - [x] Vitest, Playwright setup
  - [x] CI/CD Pipeline (GitHub Actions)

- [x] Phase 2: User Interface Implementation
  - [x] Shared Component Library (ContextMeter, HealthBadge, etc.)
  - [x] Popup Dashboard
  - [x] Side Panel Dashboard & Tabs
  - [x] Shadow DOM Floating Widget
  - [x] Settings Page

- [x] Phase 3: Core Foundation Implementation
  - [x] Type-safe Message Passing Layer
  - [x] Storage Abstraction Layer (3-tier)
  - [x] Background Service Worker (Event Router)
  - [x] Context Tracker (Live Updates & Settings)
  - [x] Custom Warning Thresholds (Caution/Warning/Critical)
  - [x] Zustand State Connection
  - [x] Manifest Permissions & WXT Build Verification

- [x] Phase 4: Modular Token Engine implementation
  - [x] Abstract `Tokenizer` interface with confidence scoring
  - [x] Exact tokenization via `js-tiktoken` (o200k_base)
  - [x] Heuristic tokenization via model-specific character ratios (Claude: 3.5, Gemini: 4.0)
  - [x] Message-level and full-conversation token estimation
  - [x] Remaining context tracking

## Completed Features

- [x] Phase 5: Platform Adapters Implementation
  - [x] Core Detection Engine (`detectPlatform`)
  - [x] Robust DOM Observation Engine (`RobustDOMEngine`)
  - [x] SPA History API Interception for new conversations
  - [x] `requestAnimationFrame` mutation batching for CPU optimization
  - [x] Lazy-loading recovery via Map-based state tracking
  - [x] Standardized `PlatformAdapter` interface
  - [x] ChatGPT adapter (`data-message-author-role`)
  - [x] Claude adapter (`.font-claude-message`)
  - [x] Gemini adapter (`message-content`)
  - [x] Grok adapter
  - [x] Perplexity adapter

- [x] Phase 6: Summary Engine Implementation
  - [x] Structured internal summary representation
  - [x] Incremental updates avoiding full conversation reprocessing
  - [x] Fact, Bug, Task, API, and Architecture extraction heuristics
  - [x] Current discussion topic tracking
  - [x] Headless integration with background service worker

- [x] Phase 7: Transfer Summary Engine & UI
  - [x] Abstract `TransferEngine` generator
  - [x] Markdown, Plain Text, and JSON formats
  - [x] Prompt tailoring for ChatGPT, Claude, Gemini, Generic
  - [x] Memory, Tasks, Bugs, and Files inclusion toggles
  - [x] Next Prompt append
  - [x] `TransferDialog` UI component with Live Preview
  - [x] One-click Copy, Download, and Open Chat actions

- [x] Phase 8: Alert Engine (Smart Context Switch)
  - [x] Unintrusive Notification UI (`NotificationCard`)
  - [x] Shadow DOM Integration (`NotificationManager`)
  - [x] Context Warning triggers (Caution / Critical)
  - [x] Auto-dismiss timers
  - [x] Global kill-switch (`notificationsEnabled` toggle)
  - [x] "Open New Chat" and "Generate Summary" Quick Actions
  - [x] Beautiful slide-in and fade-out animations

- [x] Phase 9: Snapshot Manager
  - [x] Added `snapshots` array to AppState
  - [x] Built `SnapshotManager` UI tab
  - [x] Allows saving current context, summary, token usage, timestamp
  - [x] Restoring snapshots overrides current working context
  - [x] Search snapshots by name or project goal
  - [x] Add and remove custom tags from snapshots

- [x] Phase 10: Complete Settings Configuration
  - [x] `SettingsManager` UI implemented
  - [x] Configurable warning thresholds (sliders)
  - [x] Theme settings (light/dark/system)
  - [x] Privacy controls (history retention, analytics)
  - [x] Backup & Restore JSON functionality
  - [x] Export formats & Summary frequency selects
  - [x] Reset to defaults capability
  - [x] Global notifications toggle

- [x] Phase 11: Profiling & Optimization
  - [x] Fixed memory leak in engine tear down
  - [x] Debounced MutationObserver from 60FPS to 250ms chunks (CPU/RAM boost)
  - [x] Replaced broad object destructuring in Zustand with atomic selectors (fixing laggy re-renders)
  - [x] Re-architected hooks for instant popup load times

## Known Issues

*None yet — pre-implementation phase.*

## Future Improvements

See [Product Spec Section 7.3](file:///C:/Users/VISHW/.gemini/antigravity-ide/brain/825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d/product_specification.md) for long-term roadmap.
