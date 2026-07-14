# CHANGELOG.md — AI Context Tracker

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- **Phase 11: Profiling & Optimization** (2026-07-14)
  - Placed a 250ms debounce on the core `RobustDOMEngine` MutationObserver to massively decrease CPU load during active chat streaming.
  - Eliminated unnecessary React re-renders across the Popup, Dashboard, and Content Scripts by implementing strict Zustand state selectors.
  - Fixed a hidden memory leak where `stop()` would fail to clear active debounce timers.
  - Improved time-to-interactive for the Popup by preventing large object allocations.


- **Phase 10: Settings Configuration Engine** (2026-07-14)
  - Built comprehensive `SettingsManager` interface.
  - Implemented Backup and Restore functionality using JSON blobs.
  - Added configurable Context Alert thresholds with slider controls.
  - Added Privacy, Platform, and Export Preference toggles directly wired to local storage.
  - Added 'Reset to Defaults' capability.


- **Phase 9: Snapshot Manager** (2026-07-14)
  - Implemented the Snapshot Manager in the Sidepanel.
  - Added ability to save the current conversation state (Context summary, Token usage, Timestamp).
  - Added full search (by name or goal) and tagging (add/remove tags, filter by tag) functionality.
  - Added ability to "Restore Context" which seamlessly overwrites the current active summary.
  - Added ability to delete old snapshots.


- **Phase 8: Alert Engine (Smart Context Switch)** (2026-07-14)
  - Implemented completely custom, beautiful toast-style `NotificationCard` system rendering directly within the host page's Shadow DOM to prevent CSS conflicts.
  - Added smart context thresholds that trigger non-intrusive warnings when context approaches limits.
  - Implemented 1-click Quick Actions straight from the notification cards (e.g., "Generate Summary", "Open Transfer", "New Chat").
  - Included a global settings toggle to disable notifications completely.
  - Added smooth slide-in and fade-out animations using pure CSS for optimal performance.

- **Phase 7: Transfer Summary Dialog & Engine** (2026-07-14)
  - Engineered `TransferEngine` to compile structured data into LLM-optimized prompts.
  - Added export formats: Markdown, Plain Text, and JSON.
  - Implemented target-specific prompt tuning (ChatGPT, Claude, Gemini).
  - Built `TransferDialog` UI with a live-updating raw preview pane.
  - Added toggle controls for Memory, Completed Tasks, and Pending Bugs.
  - Included 1-click "Copy & Open Chat" deep links to target AI platforms.

- **Phase 6: Summary Engine** (2026-07-14)
  - Engineered heuristic-based `SummaryEngine` for real-time conversation analysis.
  - Implemented incremental processing to drastically reduce CPU overhead during long conversations.
  - Added structured extraction for Facts, Bugs, Pending Tasks, Completed Tasks, and APIs.
  - Built intelligent tracking for Project Goals, Architecture Decisions, and User Preferences.
  - Integrated directly into the Background Service Worker to update alongside the token count seamlessly.

- **Phase 4: Modular Token Engine & Context Tracker** (2026-07-14)
  - Engineered flexible `TokenEngine` capable of estimating tokens per message and full conversation.
  - Wired Token Engine to Background Service Worker to calculate live usage on DOM mutations.
  - Implemented live progress bar updating with remaining tokens and used tokens.
  - Established configurable health warning levels (Caution: 70%, Warning: 85%, Critical: 95%).
  - Added interactive threshold sliders to Options page, persistently synced via `wxt/storage`.
  - Implemented exact `tiktoken` provider (1.0 confidence) for ChatGPT using `js-tiktoken`.
  - Implemented `HeuristicRatioTokenizer` (0.6 confidence) for Claude/Gemini using custom character ratios.
  - Designed architecture for future drop-in support of exact APIs.

- **Phase 5: Platform Adapters & Robust Engine** (2026-07-14)
  - Engineered `RobustDOMEngine` for highly efficient DOM tracking during streaming AI generation.
  - Intercepted HTML5 History API (`pushState`/`replaceState`) to detect new conversations.
  - Implemented CPU-optimized mutation batching via `requestAnimationFrame`.
  - Added Map-based lazy-loading recovery to prevent token counts from dropping when nodes unmount.
  - Implemented decoupled, scalable Website Detection Engine (`src/adapters`).
  - Created standardized `PlatformAdapter` interface for cross-website tracking.
  - Added specific DOM adapters for ChatGPT, Claude, Gemini, Grok, and Perplexity.
  - Hooked detection engine into WXT Content Script injection flow.


- **Phase 3: Core Foundation** (2026-07-14)
  - Engineered strict discriminated union messaging protocol (`src/messaging`).
  - Created 3-tier reactive storage abstraction wrapping WXT storage APIs.
  - Initialized Background Service Worker event router.
  - Connected Preact UI's Zustand store directly to Chrome storage for persistence.
  - Granted `sidePanel` permissions and configured automatic dashboard opening.
  - Resolved WXT file-based routing collisions by converting UI entry scripts to `main.tsx`.


- **Phase 2: User Interface** (2026-07-13)
  - Created shared component library (`ContextMeter`, `HealthBadge`, `MetricCard`, `PlatformBadge`).
  - Integrated `lucide-preact` for tree-shakeable SVG icons.
  - Implemented Popup entrypoint with metrics grid and navigation actions.
  - Built Dashboard Side Panel with tabbed navigation and interactive visual gauges.
  - Established Shadow DOM rendering for the Floating Widget to ensure host-page CSS isolation.
  - Developed full-page Options layout with responsive sidebar for settings.
  - Connected UI to mock Zustand store (`useAppState`) for visual validation of health states.


- **Phase 1: Project Scaffolding** (2026-07-13)
  - Initialized Git repository and WXT project with React/Preact module.
  - Established complete directory architecture for core engines, adapters, and UI.
  - Setup Tailwind CSS v4 with initial global styling tokens.
  - Downgraded ESLint to v8 to resolve react-hooks plugin dependency issues.
  - Configured Husky, lint-staged, and commitlint for pre-commit hooks.
  - Generated Vitest and Playwright test configurations.
  - Added GitHub Actions workflow (`ci.yml`) for automated pipeline execution.


- **UX Design Specification v1.0** (2026-07-13)
  - 10 pixel-perfect screen mockups generated (dark + light modes)
  - Popup designs: dark mode (42%, healthy) and light mode (72%, caution)
  - Dashboard side panel: dark and light mode with gauge, metrics, health signals
  - Floating widget: 4 states (healthy, caution, warning, critical) + expanded
  - Settings page with sidebar navigation, threshold sliders, toggles
  - Transfer summary dialog with markdown preview and copy/edit/save actions
  - Rolling summary screen with auto-update and topic tags
  - Conversation history with platform filters and card-based list
  - Snapshot manager with comparison feature and storage indicator
  - Notification card system: 4 severity levels with contextual actions
  - Onboarding welcome screen with feature highlights and privacy tagline
  - Full design system: color palette (dark + light tokens), typography scale, spacing, shadows, border radii
  - Component library specs: ContextMeter, HealthBadge, MetricCard, SignalRow, NotificationCard, PlatformBadge
  - Animation specifications: 14 micro-interactions with timing, easing, and CSS examples
  - Accessibility: WCAG 2.2 AA, keyboard navigation, ARIA patterns, color-blind safe design
  - Responsive behavior rules for side panel, popup, widget, and options page
  - Icon system using Lucide Icons (MIT, tree-shakeable)
  - Empty state designs for 4 edge cases
  - Keyboard shortcuts (Alt+Shift+C/D/T/S)
  - Screen inventory: 14 screens total (10 MVP, 4 V2)

- **Software Architecture v1.0** (2026-07-13)
  - 5-layer event-driven architecture with data flow diagrams
  - Full folder structure with 80+ planned files across 12 modules
  - Module dependency graph with enforced import rules
  - 4 sequence diagrams (init, counting, transfer, alerts)
  - Interface contracts, storage schema, message passing protocol
  - Security model with `connect-src 'none'` CSP
  - Privacy architecture, performance budget, cross-browser strategy

- **Product Specification v1.0** (2026-07-13)
  - Competitive landscape (10 products), technical feasibility
  - MVP spec (ChatGPT + Claude + Gemini), V2 roadmap
  - Business model: Freemium ($7.99/mo Pro)
  - 12-week implementation plan, risk matrix

- **Project Tracking** (2026-07-13)
  - PROJECT.md, CHANGELOG.md, TODO.md, ARCHITECTURE.md initialized
