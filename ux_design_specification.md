# AI Context Tracker — UX Design Specification

> **Document Version:** 1.0  
> **Date:** July 13, 2026  
> **Status:** Draft — Awaiting Approval  
> **Prerequisites:** [Product Spec](file:///C:/Users/VISHW/.gemini/antigravity-ide/brain/825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d/product_specification.md) · [Architecture](file:///C:/Users/VISHW/.gemini/antigravity-ide/brain/825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d/architecture.md)

---

## 1. Design Philosophy

### Core Principles

| Principle | What It Means |
|:---|:---|
| **Invisible until useful** | The extension should never distract. Widget stays minimal until context matters. |
| **Glanceable metrics** | A user should understand their context status in < 1 second. |
| **Dark-first** | Most AI platforms are dark-themed. Our default must match. |
| **Premium, not flashy** | Glassmorphism, subtle gradients, and micro-animations — not neon or cartoon. |
| **Trust through transparency** | Show confidence levels, explain estimates, never pretend to be more accurate than we are. |
| **Accessible by default** | WCAG 2.2 AA minimum. Keyboard navigable. Screen-reader friendly. |

---

## 2. Screen Designs

### 2.1 Popup — Dark Mode

The popup is the **quick-glance entry point**. Users spend < 2 seconds here.

![Popup dark mode — 42% context used, GPT-5.5, healthy status, gradient context ring with cyan-to-purple fill](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\popup_dark_mode_1783947816236.png)

**Key Design Decisions:**
- **Circular gauge** as the hero element — instantly communicates context fill percentage
- **Gradient ring** (cyan → purple) serves as brand identity across all screens
- **Three stat rows** provide the essential numbers without scrolling
- **Two CTAs**: "Open Dashboard" (primary, gradient) and "Transfer" (secondary, outline)
- **Dimensions:** 360 × 480px — within Chrome's popup size limits

---

### 2.2 Popup — Light Mode

Same layout, adapted for light environments. Colors shift to warmer tones to indicate a different health state.

![Popup light mode — 72% context used, Claude Fable 5, caution status, warm amber-to-coral gradient ring](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\popup_light_mode_1783947824951.png)

**Light Mode Adaptations:**
- Background shifts to `#FAFAFE` with subtle warm gradient
- Ring gradient becomes amber → coral to reinforce the warning state
- Text inverts to dark (`#1A1A2E`) with medium-gray labels
- Buttons use the warm accent palette

---

### 2.3 Dashboard — Side Panel (Dark Mode)

The side panel is the **persistent workspace companion**. It stays open alongside the AI chat.

![Dashboard dark mode — semicircular gauge at 67%, metric cards showing input/output tokens, turns, and avg/turn, health signals breakdown, quick action buttons](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\dashboard_sidepanel_dark_1783947866777.png)

**Layout Structure:**
```
┌─────────────────────────────┐
│  Header + Tab Navigation    │  44px
├─────────────────────────────┤
│  Context Gauge (semicircle) │  160px
│  + Model Badge              │
├─────────────────────────────┤
│  Metric Cards (2×2 grid)    │  120px
├─────────────────────────────┤
│  Health Section             │  200px
│  (bar + 5 signal rows)      │
├─────────────────────────────┤
│  Quick Actions              │  48px
└─────────────────────────────┘
```

**Tab Navigation:** Dashboard | Summary | History | Settings

---

### 2.4 Dashboard — Side Panel (Light Mode)

![Dashboard light mode — semicircular gauge at 42%, all health signals green, clean white card design with indigo accents](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\dashboard_light_mode_1783948060763.png)

**Light Mode Accent:** Indigo (`#4F46E5`) replaces cyan as the primary accent to ensure readability on white backgrounds.

---

### 2.5 Floating Widget — All States

The widget lives **on top of the AI chat page** inside a Shadow DOM container. It must be minimal, draggable, and state-aware.

![Four widget states — Collapsed Healthy (green dot, 42%, 58K), Collapsed Warning (amber glow, 78%, 156K), Collapsed Critical (red pulse, 93%, 186K), and Expanded view with mini-gauge and detailed stats](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\floating_widget_states_1783947876871.png)

**Widget Behavior Matrix:**

| State | Trigger | Visual | Size |
|:---|:---|:---|:---|
| **Collapsed Healthy** | Health 80-100 | Green dot, white text, no glow | 180 × 36px |
| **Collapsed Caution** | Health 60-79 | Amber dot, amber glow border | 180 × 36px |
| **Collapsed Warning** | Health 40-59 | Orange dot, orange pulse glow | 180 × 36px |
| **Collapsed Critical** | Health 0-39 | Red dot with pulse ring, red glow | 180 × 36px |
| **Expanded** | User clicks pill | Full metrics card | 240 × 200px |
| **Streaming** | AI is generating | Animated counter, pulsing dot | 180 × 36px |
| **Error** | Adapter broken | ⚠️ icon, muted appearance | 180 × 36px |
| **Hidden** | User dismisses | Not visible | 0px |

**Glassmorphism Properties:**
```css
.widget-collapsed {
  background: rgba(15, 15, 20, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}
```

---

### 2.6 Settings Page

Full options page with sidebar navigation. Shown when user clicks "Settings" in side panel or opens options from extension menu.

![Settings page dark mode — sidebar navigation with General/Appearance/Alerts/Platforms/Privacy/About, main content showing theme toggle, widget position, confidence badge toggle, alert threshold sliders with gradient tracks, sound alerts toggle](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\settings_page_dark_1783947917159.png)

**Settings Sections:**

| Section | Contents |
|:---|:---|
| **General** | Theme, widget position, default state, confidence badge |
| **Appearance** | Accent color, font size, widget opacity |
| **Alerts** | Threshold sliders (caution/warning/critical), sound, badge |
| **Platforms** | Enable/disable per platform, adapter status indicators |
| **Privacy** | Conversation history toggle, data export, clear all data |
| **About** | Version, changelog, feedback link, privacy policy |

**Threshold Sliders** use gradient tracks (green→yellow→red) to visually communicate severity zones.

---

### 2.7 Transfer Summary Dialog

Modal that appears when user clicks "Generate Transfer Summary." Shows the generated summary with copy/edit/save actions.

![Transfer summary dialog — dark glass modal with gradient top border, rendered markdown preview showing key topics, decisions made, current task, and continuation instructions, copy/edit/save action buttons, clipboard success indicator](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\transfer_summary_dialog_1783947927815.png)

**Interaction Flow:**
```
User clicks "Transfer" → Loading spinner (< 200ms) → Summary appears
    ├── "Copy" → Copies markdown to clipboard → "✓ Copied!" green text
    ├── "Edit" → Summary becomes editable textarea → "Save Edit" button
    └── "Save" → Stores in IndexedDB → "✓ Saved" confirmation
```

---

### 2.8 Rolling Summary Screen

The Summary tab in the side panel shows an auto-updating conversation summary.

![Rolling summary screen — auto-updated summary with 5 topic sections (Architecture, Token Engine, Storage, Security, Current Focus), topic tags as pills, regenerate and copy buttons, confidence footer showing coverage](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\summary_screen_dark_1783947962908.png)

**Summary Update Rules:**
- Auto-regenerates every 5 turns (configurable)
- Green dot indicator shows "live" status
- Topic tags are extracted keywords for quick scanning
- "Regenerate" forces an immediate re-computation

---

### 2.9 Conversation History

The History tab shows past conversations with filtering and search.

![History screen — platform filter pills (All/ChatGPT/Claude/Gemini), scrollable card list showing conversations with platform icon, model name, timestamp, title, turn count, token count, and health percentage badges](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\history_screen_dark_1783947972905.png)

**Card Information Hierarchy:**
1. **Platform + Model** (icon + text) — identify which AI
2. **Title** (semibold) — conversation topic (auto-extracted or user-named)
3. **Stats pills** — turns, tokens, health % — quick scanning
4. **Timestamp** — recency context

---

### 2.10 Snapshot Manager

Power-user feature for saving and comparing conversation states at specific points.

![Snapshot manager — list of saved snapshots with titles, metadata, health badges, restore/export/delete actions, comparison section with two slot selectors and compare button, storage usage indicator](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\snapshot_manager_dark_1783948020959.png)

**Snapshot Use Cases:**
- Save state before a major conversation direction change
- Compare token growth between checkpoints
- Restore a previous context summary if AI "forgot"

---

### 2.11 Notification Cards

In-extension notification system for context alerts, model changes, and adapter issues.

![Four notification card types — Context Caution (amber border), Context Critical (red border with red background tint), Model Changed (cyan border), Adapter Issue (gray border), each with icon, title, description, and contextual action buttons](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\notification_cards_1783948010698.png)

**Notification Severity Design:**

| Severity | Left Border | Background Tint | Icon | Action |
|:---|:---|:---|:---|:---|
| **Caution** | Amber 3px | None | ⚠️ Triangle | View Dashboard |
| **Critical** | Red 3px | Red tint overlay | 🔴 Alert | Generate Transfer |
| **Info** | Cyan 3px | None | ℹ️ Circle | Got It |
| **System** | Gray 3px | None | 🔧 Wrench | Report Issue |

---

### 2.12 Onboarding / Welcome Screen

First-run experience when the extension is installed.

![Onboarding welcome screen — neural network logo icon with cyan-purple gradient glow, welcome title, subtitle, three feature cards (Track Context, Health Alerts, Smart Transfer), platform icons with checkmarks, Get Started CTA button, privacy-first tagline](C:\Users\VISHW\.gemini\antigravity-ide\brain\825cbabc-4df0-4eaf-aad3-f54f8dbd9d8d\onboarding_welcome_1783948069946.png)

**Onboarding Flow (3 steps):**
```
Step 1: Welcome → Feature highlights + "Get Started"
Step 2: Quick Setup → Theme preference + widget position
Step 3: Done → "Open any AI chat to start tracking" + link to supported platforms
```

---

## 3. Design System

### 3.1 Color Palette

#### Dark Mode Tokens

| Token | Value | Usage |
|:---|:---|:---|
| `--bg-primary` | `#0B0B12` | Main background |
| `--bg-secondary` | `#13131E` | Cards, sections |
| `--bg-tertiary` | `#1A1A2A` | Hover states, inputs |
| `--bg-glass` | `rgba(15,15,20,0.85)` | Glassmorphism overlays |
| `--text-primary` | `#FFFFFF` | Headlines, values |
| `--text-secondary` | `#A0A0B8` | Labels, descriptions |
| `--text-muted` | `#6B6B80` | Timestamps, footnotes |
| `--accent-cyan` | `#00D4FF` | Primary accent, links |
| `--accent-purple` | `#7B61FF` | Secondary accent, gradients |
| `--accent-gradient` | `linear-gradient(135deg, #00D4FF, #7B61FF)` | CTAs, ring fill |
| `--status-healthy` | `#10B981` | Green health states |
| `--status-caution` | `#F59E0B` | Yellow/amber caution |
| `--status-warning` | `#F97316` | Orange warning |
| `--status-critical` | `#EF4444` | Red critical |
| `--border-subtle` | `rgba(255,255,255,0.08)` | Card borders |
| `--shadow-card` | `0 4px 24px rgba(0,0,0,0.4)` | Card elevation |

#### Light Mode Tokens

| Token | Value | Usage |
|:---|:---|:---|
| `--bg-primary` | `#FAFAFE` | Main background |
| `--bg-secondary` | `#FFFFFF` | Cards |
| `--bg-tertiary` | `#F0F0F5` | Hover states |
| `--text-primary` | `#1A1A2E` | Headlines |
| `--text-secondary` | `#6B6B80` | Labels |
| `--text-muted` | `#9CA3AF` | Timestamps |
| `--accent-primary` | `#4F46E5` | Indigo (replaces cyan for contrast) |
| `--accent-gradient` | `linear-gradient(135deg, #4F46E5, #7C3AED)` | CTAs |
| `--border-subtle` | `rgba(0,0,0,0.06)` | Card borders |
| `--shadow-card` | `0 2px 12px rgba(0,0,0,0.08)` | Softer elevation |

### 3.2 Typography

| Element | Font | Weight | Size | Line Height |
|:---|:---|:---|:---|:---|
| **Page Title** | Inter | 600 (SemiBold) | 18px | 24px |
| **Section Header** | Inter | 600 | 16px | 22px |
| **Card Title** | Inter | 600 | 14px | 20px |
| **Body Text** | Inter | 400 (Regular) | 13px | 18px |
| **Label** | Inter | 500 (Medium) | 12px | 16px |
| **Caption / Muted** | Inter | 400 | 11px | 14px |
| **Metric Value** | Inter | 700 (Bold) | 28px | 32px |
| **Widget Value** | Inter | 700 | 14px | 18px |
| **Code / Monospace** | JetBrains Mono | 400 | 12px | 18px |

### 3.3 Spacing Scale

```
4px  — micro (between icon and label)
8px  — tight (within components)
12px — standard (between related elements)
16px — section (padding inside cards)
20px — gap (between cards)
24px — section gap (between major sections)
32px — page margin (top/bottom breathing room)
```

### 3.4 Border Radius

| Element | Radius |
|:---|:---|
| Widget collapsed (pill) | 18px (full round) |
| Widget expanded / Cards | 12px |
| Buttons | 10px |
| Input fields | 8px |
| Badge pills | 6px |
| Progress bars | 4px |

### 3.5 Shadows & Elevation

| Level | Shadow | Usage |
|:---|:---|:---|
| Level 0 | None | Flat elements, within cards |
| Level 1 | `0 2px 8px rgba(0,0,0,0.15)` | Cards at rest |
| Level 2 | `0 4px 16px rgba(0,0,0,0.25)` | Cards on hover |
| Level 3 | `0 8px 32px rgba(0,0,0,0.4)` | Floating widget, modals |

---

## 4. Component Library

### 4.1 ContextMeter

The primary visual component. Two variants:

| Variant | Where Used | Size |
|:---|:---|:---|
| **Circular ring** | Popup | 140px diameter, 8px stroke |
| **Semicircular gauge** | Dashboard | 200px wide, 100px tall |
| **Mini ring** | Widget expanded | 60px diameter, 4px stroke |

**Color Logic:**
```
0-49%  → Gradient: cyan → blue (healthy)
50-69% → Gradient: yellow → amber (caution)
70-89% → Gradient: amber → orange (warning)
90-100% → Gradient: orange → red (critical)
```

**Animation:** Ring fills with `stroke-dashoffset` CSS animation, 300ms ease-out on value change.

### 4.2 HealthBadge

Status indicator pill:

```
🟢 Healthy  — Green dot + "Healthy" text + green background tint
🟡 Caution  — Amber dot + "Caution" text + amber background tint
🟠 Warning  — Orange dot (pulsing) + "Warning" text + orange tint
🔴 Critical — Red dot (animated pulse ring) + "Critical" text + red tint
```

**Dot Animation (Critical):**
```css
@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}
```

### 4.3 MetricCard

```
┌─────────────────┐
│ Label     12px  │
│ Value     28px  │
│ Trend ↑   11px  │
└─────────────────┘
```

**Hover:** Slight scale (1.02) + shadow increase (Level 1 → Level 2).

### 4.4 SignalRow

```
Context Fill   ████████░░░░  67%
```
- Label (left) + value (right) + thin progress bar below
- Bar color matches signal severity
- 6px height bar with 4px border-radius

### 4.5 NotificationCard

Left-border colored card with icon, title, body, timestamp, and action buttons.
- Enter animation: `slide-in-right` 200ms
- Exit animation: `fade-out` 150ms
- Auto-dismiss after 10 seconds (configurable)

### 4.6 PlatformBadge

Small pill showing platform name + icon:
```
[🤖 GPT-5.5]  [🟤 Claude Fable 5]  [💎 Gemini 3.1 Pro]
```
Uses platform brand colors for the icon dot.

---

## 5. Animations & Micro-Interactions

### 5.1 Animation Principles

| Principle | Rule |
|:---|:---|
| **Duration** | 150-300ms for UI transitions. Never > 500ms. |
| **Easing** | `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard) for most. `ease-out` for entrances. |
| **Purpose** | Every animation must communicate state change. No decoration-only animation. |
| **Reduced Motion** | Honor `prefers-reduced-motion: reduce`. Replace animations with instant transitions. |

### 5.2 Specific Animations

| Interaction | Animation | Duration | Easing |
|:---|:---|:---|:---|
| Widget collapse → expand | Scale + opacity | 200ms | ease-out |
| Widget expand → collapse | Scale + opacity | 150ms | ease-in |
| Ring fill on load | `stroke-dashoffset` SVG | 600ms | ease-out |
| Ring value update | `stroke-dashoffset` interpolation | 300ms | ease-out |
| Health status change | Color transition + dot pulse | 400ms | ease-in-out |
| Notification enter | Slide from right + fade in | 200ms | ease-out |
| Notification dismiss | Fade out + slide right | 150ms | ease-in |
| Card hover | Scale(1.02) + shadow increase | 150ms | ease-out |
| Tab switch | Content crossfade | 150ms | ease-in-out |
| Counter streaming | Number increment animation | Per-tick (60fps) | linear |
| Button press | Scale(0.97) | 100ms | ease-out |
| Toggle switch | Thumb slide + color change | 200ms | spring |
| Threshold slider | Thumb position + tooltip follow | real-time | none |

### 5.3 Streaming Counter Animation

While the AI is generating a response, the token counter animates smoothly:

```css
.token-count-streaming {
  /* Smooth number transitions using CSS counter + transition */
  transition: --token-count 300ms ease-out;
  /* Subtle pulsing glow to indicate active tracking */
  animation: counter-pulse 2s ease-in-out infinite;
}

@keyframes counter-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
```

---

## 6. Accessibility

### 6.1 WCAG 2.2 AA Compliance

| Requirement | Implementation |
|:---|:---|
| **Color Contrast** | All text ≥ 4.5:1 ratio against background. Large text ≥ 3:1. |
| **Focus Indicators** | Visible 2px cyan outline on all interactive elements. `outline-offset: 2px`. |
| **Keyboard Navigation** | Full Tab navigation through all controls. Enter/Space to activate. Escape to close modals. |
| **Screen Reader** | All components have appropriate `aria-*` attributes. Live regions for dynamic updates. |
| **Reduced Motion** | `prefers-reduced-motion: reduce` disables all animations, replaces with instant transitions. |
| **Text Scaling** | All font sizes use `rem`. UI adapts to 200% browser zoom. |
| **Touch Targets** | All interactive elements ≥ 44 × 44px touch target (mobile/tablet). |

### 6.2 ARIA Patterns

```html
<!-- Context Meter -->
<div role="meter" 
     aria-valuenow="67" 
     aria-valuemin="0" 
     aria-valuemax="100"
     aria-label="Context window usage: 67 percent">
</div>

<!-- Health Status -->
<div role="status" aria-live="polite" aria-label="Context health: caution">
  🟡 Caution
</div>

<!-- Notification -->
<div role="alert" aria-live="assertive">
  Context window is 93% full. Consider starting a new conversation.
</div>

<!-- Tab Navigation -->
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel-dashboard">
    Dashboard
  </button>
</div>
```

### 6.3 Color-Blind Safe Design

We don't rely on color alone for any information:

| Status | Color | Secondary Indicator |
|:---|:---|:---|
| Healthy | Green | ✓ checkmark icon + "Healthy" text |
| Caution | Amber | ⚠ triangle icon + "Caution" text |
| Warning | Orange | ⚠ triangle icon (filled) + "Warning" text |
| Critical | Red | ✕ circle icon + pulse animation + "Critical" text |

---

## 7. Responsive Behavior

### 7.1 Side Panel Widths

The side panel width is controlled by the browser, typically 300-420px:

| Width Range | Behavior |
|:---|:---|
| **300-340px** | Compact: Metric cards stack to single column. Gauge shrinks. |
| **340-400px** | Standard: 2×2 metric grid. Full gauge. (Our target) |
| **400px+** | Comfortable: Extra padding, larger text. |

### 7.2 Popup Behavior

The popup has fixed dimensions (360 × 480px) and does not need to be responsive. Content is designed to fit exactly within these bounds.

### 7.3 Widget Behavior

| Scenario | Behavior |
|:---|:---|
| Page is narrow (< 768px) | Widget becomes more transparent, smaller text |
| Widget overlaps chat input | Smart repositioning to avoid input area |
| Multiple monitors / zoom | Widget position stored as percentage, not pixels |
| Page scroll | Widget stays fixed (position: fixed in Shadow DOM) |

### 7.4 Options Page

The options page is a full browser tab — responsive from 600px to 1400px:

| Width | Layout |
|:---|:---|
| **600-768px** | Sidebar collapses to top horizontal nav |
| **768-1200px** | Side-by-side: 200px sidebar + content |
| **1200px+** | Centered content with max-width: 800px |

---

## 8. Interaction Patterns

### 8.1 Widget Interactions

```
Click pill → Expand widget
Click outside expanded widget → Collapse
Drag pill → Reposition (position saved to storage)
Double-click pill → Open side panel
Right-click pill → Context menu: "Hide", "Settings", "Open Dashboard"
Hover pill → Slight brightness increase (1.05)
```

### 8.2 Dashboard Interactions

```
Click tab → Switch view with crossfade
Click metric card → Tooltip with detailed breakdown
Click health signal → Expand with explanation text
Click "Summary" → Navigate to Summary tab
Click "Transfer" → Open transfer dialog
Click "Export" → Download conversation as JSON/Markdown
Scroll → Sections scroll independently within panel
```

### 8.3 Settings Interactions

```
Toggle switch → Immediate effect (no save button needed for toggles)
Slider drag → Real-time preview of threshold
Theme change → Instant theme switch with crossfade
"Reset to Defaults" → Confirmation dialog → Reset all
Platform toggle → Re-scan active tabs for adapter activation
```

### 8.4 Keyboard Shortcuts (Global)

| Shortcut | Action |
|:---|:---|
| `Alt+Shift+C` | Toggle widget visibility |
| `Alt+Shift+D` | Open/focus side panel dashboard |
| `Alt+Shift+T` | Generate transfer summary |
| `Alt+Shift+S` | Take conversation snapshot |

---

## 9. Empty States & Edge Cases

### 9.1 No Conversation Detected

```
┌─────────────────────────────┐
│                             │
│     💬                      │
│     Start a conversation    │
│                             │
│  Send a message to begin    │
│  tracking context usage.    │
│                             │
└─────────────────────────────┘
```

### 9.2 Unsupported Platform

```
┌─────────────────────────────┐
│                             │
│     🔒                      │
│     Not Available Here      │
│                             │
│  AI Context Tracker works   │
│  on ChatGPT, Claude, and    │
│  Gemini. Visit a supported  │
│  platform to get started.   │
│                             │
└─────────────────────────────┘
```

### 9.3 Adapter Error

```
┌─────────────────────────────┐
│  ⚠️ Layout Update Detected  │
│                             │
│  ChatGPT changed its UI.    │
│  Metrics are estimated.     │
│                             │
│  [Report Issue]  [Dismiss]  │
└─────────────────────────────┘
```

### 9.4 No History Yet

```
┌─────────────────────────────┐
│                             │
│     📚                      │
│     No History Yet          │
│                             │
│  Conversation metrics will  │
│  appear here as you chat.   │
│  Enable history in Settings │
│  to track across sessions.  │
│                             │
└─────────────────────────────┘
```

---

## 10. Icon System

### 10.1 Extension Icons

| Size | Usage |
|:---|:---|
| 16×16 | Favicon, tab icon |
| 32×32 | Windows taskbar |
| 48×48 | Extension management page |
| 128×128 | Chrome Web Store, installation |

**Icon Design:** Circular gradient (cyan → purple) with a stylized neural/context ring motif inside. Should read well at 16px.

### 10.2 UI Icons

Using [Lucide Icons](https://lucide.dev/) (open-source, MIT, tree-shakeable):

| Icon | Usage |
|:---|:---|
| `gauge` | Context meter |
| `heart-pulse` | Health status |
| `arrow-right-left` | Transfer |
| `clipboard-copy` | Copy |
| `settings` | Settings gear |
| `history` | History tab |
| `camera` | Snapshot |
| `download` | Export |
| `bell` | Notifications |
| `sun` / `moon` | Theme toggle |
| `chevron-down` / `chevron-up` | Expand/collapse |
| `x` | Close / dismiss |
| `check` | Success confirmation |
| `alert-triangle` | Warning |
| `alert-circle` | Error/critical |
| `info` | Information |
| `search` | Search |
| `filter` | Filter |

All icons rendered as SVG at 16px or 20px, using `currentColor` for theme-awareness.

---

## 11. Screen Inventory Summary

| # | Screen | Entrypoint | MVP | V2 |
|:---|:---|:---|:---|:---|
| 1 | Popup (dark) | popup/ | ✅ | ✅ |
| 2 | Popup (light) | popup/ | ✅ | ✅ |
| 3 | Dashboard (dark) | sidepanel/ | ✅ | ✅ |
| 4 | Dashboard (light) | sidepanel/ | ✅ | ✅ |
| 5 | Floating Widget (4 states) | content/ | ✅ | ✅ |
| 6 | Settings Page | options/ | ✅ | ✅ |
| 7 | Rolling Summary | sidepanel/ | ❌ | ✅ |
| 8 | Transfer Summary Dialog | sidepanel/ | ❌ | ✅ |
| 9 | Conversation History | sidepanel/ | ❌ | ✅ |
| 10 | Snapshot Manager | sidepanel/ | ❌ | ✅ |
| 11 | Notification Cards | content/ + sidepanel/ | ✅ | ✅ |
| 12 | Onboarding (Welcome) | options/ | ✅ | ✅ |
| 13 | Onboarding (Setup) | options/ | ✅ | ✅ |
| 14 | Empty States (4 variants) | various | ✅ | ✅ |

**MVP UI Scope:** Screens 1-6, 11-14 (10 screens)  
**V2 UI Scope:** Screens 7-10 added (4 screens)

---

*This UX specification is designed to be implemented directly into Preact components. Every spacing value, color token, and animation timing is production-ready. The design system ensures visual consistency across all screens with a single source of truth for tokens.*
