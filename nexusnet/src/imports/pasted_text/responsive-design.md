┌───┐
│ ← │ EXPANDED state
└───┘

┌───┐
│ → │ COLLAPSED state
└───┘

text
- Size: 28px × 28px
- Position: top-right corner of sidebar, overlapping the edge
- Background: #000000
- Border: 2px solid #E8002D
- Text/Icon: Bebas Neue 16px, #E8002D
- Hard shadow: 2px 2px 0 #E8002D
- On click: sidebar animates width change
  Animation: 200ms, cubic-bezier(0.4, 0, 0.2, 1) (Material-like but faster)

### Sidebar Collapse Animation:
- Width: 240px → 72px (or 72px → 240px)
- Duration: 200ms
- Easing: steps(4) for snap feel (P5 style)
- Labels fade out: opacity 1 → 0, duration 100ms (first half)
- Icons shift: translateX to center in narrower sidebar
- Main content area: flex-grows to fill freed space simultaneously

### Persistent State:
- Remember collapsed/expanded state in localStorage
- Key: "phreak_sidebar_state" → "expanded" | "collapsed"
- On page load: restore previous state instantly (no animation on load)

### Keyboard Shortcut:
- Press [ (left bracket) to collapse
- Press ] (right bracket) to expand
- Show shortcut hint in tooltip: "[ CoLLaPSe"

---

## ✅ PART 4 — RESPONSIVE OVERHAUL

### Breakpoints (strict):
--bp-xs: 320px (Mobile S)
--bp-sm: 425px (Mobile L)
--bp-md: 768px (Tablet)
--bp-lg: 1024px (Desktop)
--bp-xl: 1280px (Desktop L)
--bp-2xl: 1440px (Desktop XL)

text

### Layout per breakpoint:

MOBILE S/L (320px–767px):
┌─────────────────────┐
│ PHREAK [🔔][U] │ ← Top bar: 48px
├─────────────────────┤
│ │
│ FEED CONTENT │ ← Full width, single column
│ (full width) │
│ │
├─────────────────────┤
│ [H] [/] [!] [M] [P] │ ← Bottom nav: 60px
└─────────────────────┘

text
- Sidebar: HIDDEN (translateX -240px, display none)
- Top bar: "PHREAK" logo left, icon buttons right (notification + avatar)
  Height: 48px, background: #0A0000, border-bottom: 2px solid #E8002D
- Content: 100% width, padding 0 12px
- Bottom nav: fixed, 5 items, full width
  Icons only (no labels on 320px, labels on 425px+)
  Active: red parallelogram bg on icon
  Height: 60px, background: #000000, border-top: 2px solid #E8002D

TABLET (768px–1023px):
┌──────────────────────────────────┐
│ PHREAK [search][notif] │ ← Top bar
├───────┬──────────────────────────┤
│ ICONS │ FEED CONTENT │ ← 72px sidebar + content
│ 72px │ │
│ │ │
└───────┴──────────────────────────┘

text
- Sidebar: COLLAPSED state (72px, icons only)
- No toggle button on tablet (auto-collapsed, can't expand)
- Top bar visible with logo + utility icons
- Content: fluid width

DESKTOP (1024px–1279px):
┌──────┬───────────────────────────────────┐
│ │ FEED CONTENT │
│ NAV │ (no right panel) │
│ │ │
└──────┴───────────────────────────────────┘

text
- Sidebar: COLLAPSED by default (72px), toggle to expand (240px)
- No right panel ("Who to Follow" etc.) — too cramped
- Content: fluid

DESKTOP L/XL (1280px+):
┌──────────┬────────────────┬───────────────┐
│ │ FEED CONTENT │ RIGHT PANEL │
│ NAV │ ~600px │ ~300px │
│ 240px │ │ │
│(expanded)│ │ │
└──────────┴────────────────┴───────────────┘

text
- Sidebar: EXPANDED by default (240px)
- Right panel: visible (Who to Follow, Trending)
- 3-column layout

### MESSAGES screen responsiveness:

MOBILE (< 768px) — 2 separate screens:
Screen A: Conversation List (full screen)
- Header: "★ MeSsAGeS" full width
- Back navigation not needed (this IS the base)
- Each conversation: full width, 72px height
- ">> NeW OPeRaTiON" button: fixed bottom, full width, red, 52px

Screen B: Chat Window (full screen, slides over Screen A)
- Top bar: "[<< BaCK]  SARAH CHEN  [...]" 
  Back button: Bebas Neue, "< BaCK", red, taps to return to Screen A
- Messages: full width
- Input: fixed bottom
- Transition: Chat slides in from right (translateX 100% → 0, 250ms)
  Return: slides back right (0 → 100%, 200ms)

TABLET (768px–1023px) — 2-column:
- Conversation list: 240px fixed
- Chat: fluid
- No sidebar (collapsed to 72px icons)

DESKTOP (1024px+) — 3-column:
- Nav sidebar: 72px or 240px (collapsible)
- Conversation list: 280px
- Chat: fluid

### POST CARD responsive adjustments:

MOBILE:
- Avatar hex: 36px (reduced from 44px)
- Username: Bebas 15px (reduced from 18px)
- Handle: Space Mono 10px
- Post body: Archivo 13px
- Action bar: 4 items, space-between, full width
  Count labels: HIDDEN (only icon + number, no "LiKe" text labels)
- SHOWTIME badge: 10px text, reduced padding
- Image: 100% width, aspect-ratio: 16/9, no rotation tilt on mobile

TABLET:
- Avatar: 40px
- Username: Bebas 16px
- Action bar: full labels visible
- Image: full width, slight -1deg tilt preserved

DESKTOP:
- All sizes as originally designed

### BOTTOM NAV (Mobile/Tablet) redesign:
┌──────────────────────────────────────────────┐
│ [H] [/] [!] [M] [P] │
│ FeeD STeaL aLeRTs MeSsGs PRoFiLe │
└──────────────────────────────────────────────┘

text
- Height: 60px on mobile, 52px on tablet
- Background: #000000
- Top border: 2px solid #E8002D
- Items: equal width flex, centered icon + label below
- Icon size: 20px SVG (sharp corners, no emojis)
- Label: Space Mono 8px, #CCCCCC (inactive) / #FFFFFF (active)
- Active item:
  * Background: parallelogram (skewX -8deg) in #E8002D
  * Icon: #FFFFFF
  * Label: #FFFFFF  
  * Small ★ indicator above icon (yellow, 8px)
- Inactive hover: background #1A0000, icon turns white

### COMPOSE FAB (Mobile/Tablet):
- Position: fixed, bottom: 80px (above bottom nav), right: 16px
- Shape: ROTATED SQUARE (transform: rotate(45deg)) — 52px × 52px
- Background: #E8002D
- Content: ">>" rotated back -45deg (counter-rotate so text is upright)
  Text: Bebas Neue 20px, #FFFFFF
- Shadow: 4px 4px 0 #000000
- Hover: shadow 6px 6px 0 #000000, translate(-2px, -2px)
- Active: translate(2px, 2px), shadow 2px 2px 0 #000000
- Pulse animation (idle): red glow expands every 4s:
  box-shadow: 0 0 0 0 #E8002D60 → 0 0 0 12px transparent
  animation: 4s ease-out infinite, starts after 2s of no interaction

---

## ✅ PART 5 — ADDITIONAL CLEANUP

### Top Bar (Mobile/Tablet):
- Left: "PHREAK" logo — Bebas Neue 24px, #FFFFFF, shadow 2px 2px 0 #E8002D
- Right side icons (SVG only, no emojis):
  * Notification: SVG bell icon (sharp/angular), 24px
    Badge: square #FFE600, #000000 text, Bebas 10px, rotation -3deg
  * User avatar: hexagonal, 32px, red border 2px
- Background: #0A0000
- Bottom border: 2px solid #E8002D
- Height: 48px, padding: 0 16px

### Right Panel (Desktop 1280px+):
"// WHo To FoLLoW" section:
- Section header: Bebas Neue 18px, #FFFFFF, red shadow, // prefix
- Each suggestion card:
  * Background: #111111, border-left: 3px solid #E8002D
  * Avatar hex 36px + Name Bebas 14px + Handle Space Mono 11px #FF2244
  * "FoLLoW" button: outlined red, sharp corners, 72px wide
    Hover: fills red (left-to-right sweep, 200ms clip-path animation)
  * NO emojis — verified = ★ (typographic)

"// TReNDiNG" section:
- Each trend: 
  * Rank number: Bebas Neue 24px, #E8002D, hard shadow
  * Topic: Bebas Neue 16px, #FFFFFF
  * Count: Space Mono 11px, #FFE600, "X PoSTs"
  * Hover: background #1A0000, left border red
🎨 Final Palette Reference — V7 STRICT
text
NEVER USE:                    USE INSTEAD:
──────────────────────────    ──────────────────────────
#00FFE5  (cyan)           →   #FF2244  (@handles, links)
#00FF88  (green online)   →   #FFE600  (online indicator)  
Any blue tone             →   #E8002D  (red accent)
Circle badges             →   Square badges, rotated
Emoji icons               →   SVG geometric icons
Smooth animations         →   steps() snap animations
Rounded corners           →   0px border-radius everywhere
Soft shadows (blur > 0)   →   Hard offset shadows (0 blur)
🆚 V6 → V7 Changes Summary
Issue	V6 ❌	V7 ✅
Cyan colors everywhere	#00FFE5 handles, indicators	#FF2244 handles, #FFE600 online
Emoji icons	⚡ 📎 😊 🔒 ★	SVG angular icons + ★ ◆ // only
Sidebar stuck open	Always 240px	Collapsible: 240 ↔ 72 ↔ hidden
Mobile layout broken	Sidebar overlaps content	Bottom nav + hidden sidebar
Messages not responsive	Split view breaks on mobile	2-screen slide system
No localStorage	Forgets collapse state	Saves to localStorage
Keyboard nav	None	[ ] bracket shortcuts
FAB shape	Circle	Diamond (rotated square)
Right panel always shows	Crowded on small screens	Only 1280px+