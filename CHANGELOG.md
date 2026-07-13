# CHANGELOG.md — AI Context Tracker

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- **Software Architecture v1.0** (2026-07-13)
  - 5-layer event-driven architecture (Platform → Data Access → Intelligence → Orchestration → Presentation)
  - Full folder structure with 80+ planned files across 12 modules
  - Module dependency graph with enforced import rules (ESLint)
  - 6 extension entrypoints: background, content, sidepanel, popup, options, offscreen
  - Platform adapter system with interface contracts and self-healing fallback
  - Token estimation engine with 4 strategies (tiktoken, BPE-approx, SentencePiece-approx, char-ratio)
  - Web Worker offloading via Offscreen API for CPU-intensive tokenization
  - Summary engine design (TF-IDF extractive + structured transfer templates)
  - Degradation detection engine with 5 weighted signals and composite health scoring
  - 3-tier storage architecture (session → local → IndexedDB) + sync for settings
  - Static model database with JSON registry per provider
  - Type-safe message passing protocol (discriminated union)
  - Notification engine with suppression rules
  - Security model with `connect-src 'none'` CSP
  - Privacy architecture (zero-network guarantee)
  - Performance budget (< 15KB content script, < 50ms load, < 2% CPU)
  - Cross-browser compatibility strategy (Chrome P0, Firefox V2, Edge V1.1)
  - Future extensibility design (adapter plugins, engine plugins, feature flags)
  - 4 Mermaid sequence diagrams (init, counting, transfer, alerts)
  - Complete TypeScript interface contracts

- **Product Specification v1.0** (2026-07-13)
  - Competitive landscape analysis covering 10 existing products
  - Technical feasibility research
  - MVP feature specification (ChatGPT + Claude + Gemini)
  - V2 roadmap (rolling summaries, transfer summaries, Grok, Perplexity)
  - Long-term vision (WebLLM, team features, cross-browser, enterprise)
  - Business model: Freemium ($7.99/mo Pro tier)
  - 12-week implementation plan across 7 phases
  - Risk matrix with mitigation strategies

- **Project Tracking** (2026-07-13)
  - PROJECT.md, CHANGELOG.md, TODO.md, ARCHITECTURE.md initialized
