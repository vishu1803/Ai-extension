# PROJECT.md — AI Context Tracker

> **Last Updated:** July 13, 2026  
> **Status:** Architecture Design Phase

---

## Current Phase

📐 **Architecture Design** — Complete. Awaiting founder approval before implementation.

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

## Pending Work

- [ ] Founder review and approval of architecture
- [ ] Resolve open questions from product spec
- [ ] Project scaffolding and build pipeline (Phase 1)
- [ ] Implementation (Phases 1-7)

## Known Issues

*None yet — pre-implementation phase.*

## Future Improvements

See [Product Spec Section 7.3](file:///C:/Users/VISHW/.gemini/antigravity-ide/brain/825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d/product_specification.md) for long-term roadmap.
