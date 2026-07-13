# CHANGELOG.md — AI Context Tracker

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
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
