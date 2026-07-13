# AI Context Tracker — Software Architecture

> **Full document:** See [architecture.md](file:///C:/Users/VISHW/.gemini/antigravity-ide/brain/825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d/architecture.md) for the complete architecture with diagrams.
>
> This file is a summary reference kept in the workspace.

## Architecture Style
Event-driven, layered architecture with strict unidirectional data flow. Zero backend — fully local.

## Layers
1. **Platform** — Chrome APIs, Host Page DOM
2. **Data Access** — Platform Adapters, Storage Layer, Model Database
3. **Intelligence** — Token Engine, Summary Engine, Degradation Detector
4. **Orchestration** — Service Worker (Event Router)
5. **Presentation** — Floating Widget, Side Panel, Popup, Options Page

## Key Patterns
- **Adapter Pattern** — Each AI platform has isolated DOM scraping logic
- **Strategy Pattern** — Token engine selects tokenizer per model
- **Observer Pattern** — MutationObserver → events → state updates → UI re-render
- **Shadow DOM** — Widget CSS isolation from host page
- **Web Worker** — Tokenization offloaded from main thread via Offscreen API

## Performance Budget
- Content script: < 15KB gzip, < 50ms load
- CPU at idle: 0%, during streaming: < 2%
- Memory per tab: < 10MB
- Token counting: < 100ms incremental, < 500ms full

## Security
- CSP: `connect-src 'none'` (no network requests possible)
- Minimal permissions (only specific AI platform URLs)
- Shadow DOM isolation for injected UI
- Read-only host page interaction
