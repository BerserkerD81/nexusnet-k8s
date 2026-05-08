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