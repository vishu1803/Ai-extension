# TODO.md — AI Context Tracker

> **Last Updated:** July 13, 2026

---

## 🔴 Blocked — Awaiting Decisions

- [ ] **Founder approval of Product Specification v1.0**
- [ ] Decision: UI framework (Preact vs Solid.js)
- [ ] Decision: Build tool (WXT vs CRXJS + Vite)
- [ ] Decision: Open-source strategy
- [ ] Decision: MVP platform scope (all 3 or drop one?)
- [ ] Decision: Pricing validation ($7.99/mo)
- [ ] Decision: Product name / branding

## 📋 Next Up — Phase 1: Foundation (After Approval)

- [ ] Initialize project with chosen build tool
- [ ] Configure TypeScript strict mode
- [ ] Set up Manifest V3 with minimal permissions
- [ ] Implement service worker skeleton
- [ ] Build chrome.storage abstraction layer
- [ ] Build message-passing infrastructure
- [ ] Set up content script injection for target domains
- [ ] Configure Vitest for unit testing
- [ ] Set up ESLint + Prettier
- [ ] Create CI pipeline (GitHub Actions)

## 📋 Phase 2: Platform Adapters

- [ ] Define adapter interface (TypeScript)
- [ ] ChatGPT DOM adapter
- [ ] Claude DOM adapter
- [ ] Gemini DOM adapter
- [ ] Platform auto-detection engine
- [ ] Model detection logic
- [ ] Adapter health check / self-healing system

## 📋 Phase 3: Token Estimation Engine

- [ ] Integrate `js-tiktoken` for GPT models
- [ ] Build BPE approximation for Claude
- [ ] Build SentencePiece approximation for Gemini
- [ ] Confidence scoring system
- [ ] Web Worker offloading for tokenization
- [ ] Performance benchmarking

## 📋 Phase 4: Degradation Detection

- [ ] Response repetition detector
- [ ] Response length tracking
- [ ] Instruction drift detection
- [ ] Composite health score algorithm
- [ ] Configurable alert thresholds

## 📋 Phase 5: Floating Widget UI

- [ ] Shadow DOM container
- [ ] Context meter component
- [ ] Health score indicator
- [ ] Token count display
- [ ] Drag-and-drop positioning
- [ ] Theme auto-detection
- [ ] Streaming response handling

## 📋 Phase 6: Side Panel Dashboard

- [ ] Side panel HTML/CSS structure
- [ ] Detailed metrics view
- [ ] Conversation history display
- [ ] Settings panel
- [ ] Warning threshold configuration

## 📋 Phase 7: Polish & Launch

- [ ] Performance profiling (< 1% CPU, < 15MB RAM)
- [ ] E2E tests with Playwright
- [ ] Cross-platform testing (ChatGPT, Claude, Gemini)
- [ ] Chrome Web Store listing assets
- [ ] Privacy policy
- [ ] Landing page
- [ ] Documentation

---

## 🔮 Future (V2+)

- [ ] Rolling summary engine
- [ ] Transfer summary generator
- [ ] Grok adapter
- [ ] Perplexity adapter
- [ ] Cost estimation
- [ ] Session history & analytics
- [ ] Export conversation (Markdown/JSON)
- [ ] Context optimization tips
- [ ] Keyboard shortcuts
