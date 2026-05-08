Redesign the MSGS (Messages) screen completely. The current version is too plain
and doesn't match the Persona 5 punk energy of the rest of the app.
Here are the exact fixes needed:

---

## ✅ PART 1 — MESSAGES SCREEN FULL REDESIGN

### OVERALL LAYOUT (3-column structure):
┌──────────────┬───────────────────┬─────────────────────────────────┐
│  LEFT NAV    │  CONVERSATION     │  ACTIVE CHAT WINDOW             │
│  (existing)  │  LIST             │                                 │
│              │  280px wide       │  fluid width, fills rest        │
└──────────────┴───────────────────┴─────────────────────────────────┘

---

## ✅ PART 2 — CONVERSATION LIST PANEL REDESIGN

### Panel Header:
- Background: #000000
- Title: "★ MeSsAGeS // メッセージ" 
  Bebas Neue 28px, #FFFFFF, shadow: 3px 3px 0 #E8002D
- Subtitle: "// エンド・ツー・エンド暗号化" (E2E Encrypted)
  Space Mono 9px, #00FFE5, tracked +200
- Bottom border: 2px dashed #E8002D
- Search bar below title:
  * Full width, height 36px, background #111111
  * Border: NONE except bottom 2px solid #E8002D
  * Placeholder: "SeaRCH CoNTaCTS..." Space Mono, #555555
  * Left icon: 🔍 in red
  * Focus: bottom border glows: box-shadow: 0 2px 8px #E8002D60

### Conversation Item — UNREAD STATE:
┌─────────────────────────────────────────────────┐ ← 4px left: solid #E8002D
│ [HEX] SARAH CHEN ★ 10:32 AM [!2] │
│ SC // @sarahchen │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ "HeY! HoW R U?" │
└─────────────────────────────────────────────────┘

text
- Background: #1A0000 (dark blood red — signals unread)
- Left border: 4px solid #E8002D + glow: -2px 0 8px #E8002D60
- Avatar: HEXAGONAL 42px, background #E8002D, initials white Bebas 16px
- Name: Bebas Neue 16px, #FFFFFF, hard shadow 2px 2px 0 #E8002D
- Handle: Space Mono 10px, #00FFE5
- Timestamp: Space Mono 10px, #AAAAAA, top-right corner
- Unread badge: [!2] — square (NOT circle!), 20px,
  background #FFE600, text #000000, Bebas 11px,
  hard shadow: 2px 2px 0 #000000, rotation -3deg
- Last message preview: Archivo 13px, #CCCCCC, italic,
  in mixed-case: "HeY! HoW R U?"
- Dashed separator: border-bottom: 1px dashed #E8002D60

### Conversation Item — READ STATE:
- Background: #111111
- Left border: 2px solid #333333 (no glow)
- Name: #CCCCCC (not full white)
- Last message: #666666
- No unread badge

### Conversation Item — ACTIVE/SELECTED STATE:
- Background: #1A0000
- Left border: 6px solid #E8002D + strong glow: -3px 0 12px #E8002D80
- Name: #FFFFFF
- Right edge: thin 2px solid #E8002D on RIGHT border too
- Add diagonal stripe overlay at 5% opacity:
  repeating-linear-gradient(
    -45deg, transparent, transparent 4px,
    rgba(232,0,45,0.08) 4px, rgba(232,0,45,0.08) 5px
  )

### Conversation Item — HOVER STATE:
- Background: #150000
- Left border brightens: #E8002D → #FF2244
- Transition: 120ms (snappy, not smooth)
- Cursor: pointer

---

## ✅ PART 3 — CHAT WINDOW REDESIGN

### Chat Header:
┌─────────────────────────────────────────────────────────────────┐
│ [HEX-64px] SARAH CHEN ★ @sarahchen 🔒 E2E ENCRYPTeD [⋮] │
│ // オンライン — ONLINE │
│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
└─────────────────────────────────────────────────────────────────┘

text
- Background: #0A0000
- Bottom border: 2px dashed #E8002D
- Avatar: hexagonal, 48px, red border 2px
- Online indicator: small green ◆ diamond (8px) overlapping avatar bottom-right
  Pulses: opacity 1 → 0.4 → 1, every 2s
- Name: Bebas Neue 22px, #FFFFFF, shadow: 2px 2px 0 #E8002D
- Handle: Space Mono 11px, #00FFE5
- "ONLINE" status: Space Mono 10px, #00FF88 (green)
- 🔒 E2E badge: sticker style
  * Background: #FFE600, text: #000000, Bebas 11px
  * Border: 2px solid #000000, shadow: 2px 2px 0 #000000
  * Rotation: -1deg
  * Icon: 🔒 before text
- ⋮ Options button: 3 vertical ◆ diamonds, red, top-right

### CHAT MESSAGES AREA:
Background: #0D0D0D with halftone dot pattern (SVG, 6% opacity)
Scroll area fills available height between header and input bar

### MESSAGE BUBBLE — RECEIVED (other person):
┌── [HEX-32px] ──────────────────────────────────┐
│ ThaT SouNDS eXCiTiNG! │
│ TeLL Me MoRe. 10:35 AM │
└─────────────────────────────────────────────────┘

text
- Layout: left-aligned, avatar on far left
- Background: #1E1E1E
- Border: 2px solid #333333
- Top-left corner: SHARP (0px radius) — like a cut corner
- Bottom-left corner: clip-path cut at 45deg:
  clip-path: polygon(0 12px, 12px 0, 100% 0, 100% 100%, 0 100%)
- Text: #F5F0E8, Archivo 14px, weight 400, mixed-case preserved
- Timestamp: Space Mono 9px, #666666, 
  positioned VERTICALLY on the RIGHT SIDE of bubble,
  writing-mode: vertical-rl, transform: rotate(180deg)
- Max width: 65% of chat area
- Margin: 12px 0, 8px left offset from avatar

### MESSAGE BUBBLE — SENT (current user):
┌──────────────────────────────────────────┐
│ I'M GReAT! WoRKiNG oN A NeW PRoJeCT. │
│ HoW ABoUT U? 10:32 AM │
└──────────────────────────────────────────┘

text
- Layout: RIGHT-aligned, no avatar
- Background: #E8002D
- Border: none, instead:
  inner highlight: box-shadow: inset 0 1px 0 rgba(255,255,255,0.2)
- Top-right corner: SHARP
- Bottom-right corner: clip-path cut:
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)
- Hard shadow: 4px 4px 0 #000000 (P5 stamp shadow)
- Text: #FFFFFF, Archivo 14px, weight 500
- Timestamp: Space Mono 9px, rgba(255,255,255,0.6),
  vertical on RIGHT SIDE (same as received)
- Max width: 65%

### MESSAGE — SYSTEM/STATUS:
When encryption is confirmed, new contact added, etc:
- Centered, full width
- Text: "// LoG ENCRYPTiON CoNFiRMeD ★ 暗号化確認" 
  Space Mono 10px, #00FFE5, tracked +200
- Before/after: ─ ─ ─ ─ ─ (dashed line in #333333)
- No background, just the line

### DATE SEPARATORS:
Instead of plain date text, show:
"◆ ─ ─ ToDAY // 今日 ─ ─ ◆"
Space Mono 10px, #E8002D, centered, tracked +300

### UNREAD MESSAGE SEPARATOR:
"⚡ ─ ─ ─ ─ ─  NeW MeSSAGeS // 未読  ─ ─ ─ ─ ─ ⚡"
Bebas Neue 12px, #FFE600 on #1A0000 background, full width bar

---

## ✅ PART 4 — MESSAGE INPUT BAR REDESIGN
┌──────────────────────────────────────────────────────────────┐
│ [📎] [😊] │ TyPe Yr MaNiFeSTo... │ [⚡ SEND] │
└──────────────────────────────────────────────────────────────┘

text
- Container background: #0A0000
- Top border: 2px dashed #E8002D
- Height: 64px, padding: 12px 16px

- Attachment button [📎]:
  * 40px square, background #111111, border 2px solid #333333
  * Icon: red paperclip SVG
  * Hover: border turns #E8002D, bg #1A0000, translate(-1px, -1px)
  * Shadow on hover: 2px 2px 0 #E8002D

- Emoji button [😊]:
  * Same size/style as attachment
  * Icon: yellow #FFE600 face
  * Hover: border turns #FFE600, slight rotate(10deg) on icon

- Text input field:
  * Flex: 1 (fills all space between buttons and send)
  * Background: #111111
  * Border: NONE top/sides, only bottom: 2px solid #444444
  * On focus: bottom border → #E8002D + glow: 0 2px 8px #E8002D40
  * Placeholder: "TyPe Yr MaNiFeSTo..." Space Mono 13px, #555555
  * Text: #F5F0E8, Archivo 14px
  * No border-radius on text field

- SEND button [⚡]:
  * Width: 80px, full height of input container
  * Background: #E8002D
  * Content: "⚡" icon + "SeND" text (Bebas 14px) OR just "⚡" on mobile
  * Border: none, hard shadow: 3px 3px 0 #000000
  * Hover: translate(-2px, -2px), shadow → 5px 5px 0 #000000
  * Active/Click: translate(2px, 2px), shadow → 1px 1px 0 #000000
    (stamp press effect — same as all P5 buttons)
  * Left border: 2px solid #FFFFFF (separates from input visually)

---

## ✅ PART 5 — CHAT ANIMATIONS

1. MESSAGE SEND ANIMATION:
   - Bubble starts at input position (bottom of screen)
   - Flies UP to its position in chat with arc trajectory:
     Initial: scale(0.8), opacity 0, translateY(40px)
     Final: scale(1), opacity 1, translateY(0)
     Easing: cubic-bezier(0.34, 1.56, 0.64, 1) (spring overshoot)
     Duration: 350ms
   - Brief red flash on send button: bg flashes to white then back

2. MESSAGE RECEIVE ANIMATION:
   - Slides in from LEFT:
     Initial: translateX(-30px), opacity 0, skewX(-5deg)
     Final: translateX(0), opacity 1, skewX(0deg)
     Duration: 300ms, easing: steps(4) then ease-out
     (gives it the P5 snap-in feel)

3. TYPING INDICATOR:
   Instead of smooth bouncing dots, use P5-style:
   - Show 3 ◆ diamond shapes in a row
   - Animation: each diamond scales 0.5 → 1.2 → 0.5
   - Timing: NOT smooth sine wave — use steps(2) for sharp blink
   - Color: #E8002D
   - Container: same style as received bubble (dark bg, cut corner)
   - Text before diamonds: "TyPiNG" Space Mono 10px, #666666

4. CONVERSATION SELECT:
   When clicking a conversation in the list:
   - List item: quick flash to full #E8002D bg (100ms), then settles to selected state
   - Chat window slides in from RIGHT: translateX(60px) → 0, 250ms, steps(3) + ease
   - Chat header elements stagger in: avatar (0ms), name (60ms), badge (120ms)

5. NEW MESSAGE NOTIFICATION (from non-active conversation):
   - The conversation item in list: 
     Left border flashes: #E8002D → #FFE600 → #E8002D (2 cycles, 400ms)
   - Unread badge SLAMS on: scale(0) → scale(1.4) → scale(1.0), 400ms elastic
   - The MSGS nav item badge updates with same animation

---

## ✅ PART 6 — RESPONSIVE MESSAGES

DESKTOP (1024px+):
- 3 column layout: nav | conversation list | chat
- Conversation list: 280px fixed
- Chat: fluid

TABLET (768px–1023px):
- Conversation list: 240px
- Chat: fills rest
- Nav: collapsed icon sidebar (80px)

MOBILE (< 768px):
- SCREEN 1: Full-screen conversation list
  Header: "★ MeSsAGeS" full width
  Each conversation: full width card
- SCREEN 2: Full-screen chat (tap conversation to open)
  Back button: top-left, "← MeSsAGeS" in Bebas red
  Slide transition: chat slides in from right (translateX 100% → 0)
- No split view on mobile
- Input bar: fixed to bottom, above device safe area

---

## ✅ PART 7 — EMPTY STATES

Empty conversation list:
- Center of panel
- Large ◆ diamond icon in red (80px)
- Text: "No CoNTaCTS YeT" Bebas 24px white
- Subtitle: "// MeSSAGeS WiLL APPeaR HeRe" Space Mono 11px red
- Button: "FiND PeoPLe ⚡" — red, sharp corners

Empty chat (no conversation selected):
- Center of chat area  
- Phantom Thieves logo / mask icon (stylized SVG, 120px, red + white)
- Text: "SeLeCT A CoNVeRSaTioN" Bebas 32px white, red shadow
- Subtitle: "// 会話を選択してください" Space Mono 12px red
- Speed line background radiating from center (red, 4% opacity)
🆚 Current vs Fixed
Element	Current ❌	Fixed ✅
Bubbles	Clean rectangles, too soft	Corner-cut clip-path, hard shadows
Sent bubble	Red box, floating	Stamped red + inset highlight + 4px black shadow
Received bubble	White/light box	Dark #1E1E1E + cut corner + sticker border
Timestamps	Inside bubble text	Vertical on side, Space Mono tiny
Typing indicator	Smooth dots	Sharp ◆ diamonds with step() blink
Input bar	Generic dark bar	Dashed red top border + stamp send button
Conversation list	Clean rows	Unread=blood red bg, Active=dual border glow
Unread badge	Circle number	Yellow SQUARE, rotated -3deg, black shadow
Animations	None / generic	Arc send, snap-in receive, elastic badge slam
Empty states	Missing	Phantom mask + speed lines + P5 copy
Claude Sonnet 4.6


mejora la reactividad y que no esten en la paleta de colores los tonos celestes tambien que no se usen emojis y que en web se pueda ocultar el sidebar


🎭 Follow-Up Prompt — PHREAK V7 (Responsive + No Cyan + No Emojis + Collapsible Sidebar)
text
This is a focused improvement pass on PHREAK V7.
Four specific goals:
1. Fix responsiveness across all breakpoints
2. REMOVE all cyan/teal colors — replace with pure red/white/yellow palette
3. REMOVE all emojis — replace with geometric SVG icons or symbols
4. Add collapsible sidebar on desktop web

---

## 🚫 PART 1 — COLOR PURGE: NO MORE CYAN

### Remove ALL instances of:
- #00FFE5 (metaverse cyan)
- #00FFE0, #00FFCC, teal, turquoise, any blue-green tones
- The green "ONLINE" indicator (#00FF88)
- Any blue-tinted grays

### Replace with this STRICT 5-color palette:

PRIMARY:
--color-black:     #000000  (page background)
--color-dark:      #0D0D0D  (card backgrounds)
--color-darker:    #0A0000  (dark blood red bg, sidebar, header)
--color-blood:     #1A0000  (hover states, unread items, active chat)

ACCENT:
--color-red:       #E8002D  (primary accent — borders, buttons, active states)
--color-red-bright:#FF2244  (hover state red, brighter)
--color-red-glow:  #E8002D40 (glow shadows, transparencies)

TEXT:
--color-white:     #FFFFFF  (primary text)
--color-offwhite:  #F5F0E8  (body text, message text)
--color-gray-1:    #CCCCCC  (secondary text, inactive nav)
--color-gray-2:    #AAAAAA  (timestamps, subtitles)
--color-gray-3:    #666666  (placeholder text, zero counts)
--color-gray-4:    #333333  (subtle borders, dividers)
--color-gray-5:    #222222  (action bar separators)

HIGHLIGHT:
--color-yellow:    #FFE600  (SHOWTIME badge, counts >0, star icons)
--color-yellow-dk: #CC9900  (yellow hover, pressed state)

### SPECIFIC REPLACEMENTS:

@handles (were cyan): → #FF2244 (bright red)
  - All @username text: Space Mono, #FF2244, tracked +100

ONLINE indicator (was green): → #FFE600 (yellow)
  - Online dot: small ◆ diamond, 8px, #FFE600, pulsing opacity

E2E ENCRYPTED badge (was yellow-on-yellow): →
  - Background: #FFE600, text: #000000, border: 2px solid #000000 ✓ (keep)

Typing indicator dots (were red): → #FFFFFF (white ◆ diamonds)

Search input focus border (was cyan glow): →
  - border: 2px solid #E8002D, glow: 0 2px 8px #E8002D40

Active session/online count text: → #FFE600

All icon colors that were cyan: → #FFFFFF (default) or #E8002D (active)

Navigation Japanese subtitles (were bright red #FF4444): →
  - Keep as #E8002D for inactive
  - White #FFFFFF when nav item is active

Message handle (@sarahchen was cyan): → #FF2244

---

## 🚫 PART 2 — EMOJI PURGE: NO EMOJIS ALLOWED

### Remove ALL emojis and replace with geometric/typographic symbols:

BANNED: 🔒 ❤ 💬 🔁 ↗ 📎 😊 ⚡ ★ ◆ ✓ ✗ ☠ ●
(Note: ★ ◆ // are ALLOWED as they are typographic characters, not emojis)

### Replacement System — Use SVG Icons or Unicode Symbols:

LIKE (heart):        → SVG: simple diamond-heart shape, OR use ♦ rotated
                       Icon style: outlined square containing an X or +
                       Label: "LiKe" in Space Mono 9px below icon

REPOST (arrows):     → SVG: two angular arrows (< >) forming a cycle
                       Or use: ↺ (Unicode rotate arrow, not emoji)
                       Label: "RePoST"

COMMENT (bubble):    → SVG: sharp-cornered rectangle with bottom-left tail
                       (No rounded corners — P5 style sharp speech box)
                       Label: "RePLY"

SHARE:               → SVG: upward arrow with base line
                       Or use: ↑ with a box around it
                       Label: "SHaRe"

ATTACH (paperclip):  → SVG: simple angular paperclip OR use: [+] symbol
                       Bebas Neue 16px in a square

EMOJI PICKER:        → Replace with: [Aa] — text formatting toggle
                       Or: a simple ◆ in a square (mood selector)

SEND (paper plane):  → Replace with: [→] right arrow in a box
                       Or: "> SeND" with arrow bracket
                       Bebas Neue, styled as a button

LOCK (encryption):   → SVG: simple rectangular padlock (2 rectangles)
                       Keep the E2E ENCRYPTED text label

ONLINE dot:          → ◆ (diamond) in #FFE600, no circle/dot

NOTIFICATION bell:   → SVG: simple trapezoid bell shape (sharp corners)
                       Or: [!] in a square

SEARCH:              → SVG: circle + line (magnifying glass, sharp style)
                       Or: [?] in a square

VERIFIED/STAR (★):   → ★ is ALLOWED (typographic star, not emoji)

SHOWTIME badge:      → "SHoWTiMe ★" — the ★ here is typographic, allowed
                       Remove the ⚡ lightning emoji, replace with: "//"
                       New badge: "// SHoWTiMe ★"

STORM THE FEED btn:  → ">> SToRM THe FeeD" — use >> arrow bracket
                       No lightning emoji

LIVE badge:          → "● LiVe" where ● is Unicode bullet (not emoji)
                       Or: "[LiVe]" with square brackets

ACTION BAR icons:
- All icons must be SVG or pure CSS shapes
- Style: sharp corners, 1-2px stroke, no fill (outlined)
- On hover: stroke turns red, optional red background fill
- Size: 16px × 16px in a 28px × 28px container

PHANTOM CREW group:  → Use "> PC" or "[PC]" initials, no emoji

### ICON DESIGN LANGUAGE:
All custom SVG icons must follow these rules:
- NO curves — all paths use only straight lines and 45deg angles
- Stroke only (no fill on default state)
- Stroke-width: 1.5px
- Color: #CCCCCC default, #FFFFFF hover, #E8002D active
- Viewbox: 16×16 or 24×24
- Style: looks like it was drawn with a ruler — angular, mechanical

---

## ✅ PART 3 — COLLAPSIBLE SIDEBAR (Desktop Web)

### Sidebar has 3 states:

STATE 1 — EXPANDED (default, 240px):
- Full labels + icons + Japanese subtitles visible
- Toggle button: at TOP of sidebar, right edge
  Appearance: a small square button [←] with left arrow
  Background: #1A0000, border: 1px solid #E8002D
  Label: "CoLLaPSe // 折りたたむ" in Space Mono 9px

STATE 2 — COLLAPSED (72px):
- Icons only (no text labels)
- Toggle button becomes [→] right arrow
- Japanese subtitles hidden
- Active indicator: red parallelogram bg still shows (just smaller)
- Tooltip on hover over each icon:
  Position: absolute, left: 80px, 
  Background: #E8002D, text: #FFFFFF Bebas 14px
  Sharp corners, hard black shadow: 3px 3px 0 #000000
  Slides in from left: translateX(-8px) → translateX(0), 150ms
  Shows: "FEED // フィード" etc.

STATE 3 — HIDDEN (0px, mobile/tablet):
- Completely off-screen: translateX(-240px)
- Bottom navigation bar appears instead

### Toggle Button Design:
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