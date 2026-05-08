This is a follow-up redesign pass on the existing PHREAK app.
The current version has the right colors but is still too clean and too much
like a standard dark-mode Twitter. We need to push it MUCH further into
authentic Persona 5 territory. Here is exactly what needs to change:

---

## 🚨 CORE PROBLEM: IT STILL LOOKS LIKE TWITTER. FIX THIS.

The current layout uses:
- Clean rectangular cards with subtle borders → WRONG
- Standard bubble-free chat that's still too minimal → WRONG
- Typography that is just "bold white text" → WRONG
- Uniform spacing and alignment → WRONG
- No texture, no halftone, no chaos → WRONG

Persona 5 UI feels like someone SPRAY PAINTED a battle HUD
onto a punk zine. Every element looks INTENTIONALLY aggressive.

---

## ✅ PART 1 — MAKE IT ACTUALLY LOOK LIKE PERSONA 5

### Rule 1: The "COMMAND MENU" DNA must be everywhere
In Persona 5, every menu, every list, every option looks like
a battle command selector. Replicate this pattern:

- Every post card = a "selectable battle option row"
  * Left edge: thick 6px red bar (like P5 selected item indicator)
  * Background on hover: diagonal red stripe fills from bottom-left to top-right
    using a CSS linear-gradient at 135deg (red + transparent stripes)
  * The entire card tilts -1deg on hover like it's being "selected"

- Navigation items = exact P5 command menu style:
  * Each nav item has a PARALLELOGRAM shape background (skewX -8deg)
  * Active state: solid red parallelogram + white text + icon flips white
  * Inactive: transparent + red outline parallelogram + red icon
  * Text inside: Bebas Neue, ALL CAPS, with Japanese below in 10px

- Sidebar background: NOT flat black.
  Use repeating diagonal lines pattern:
  repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 4px,
    rgba(232,0,45,0.08) 4px,
    rgba(232,0,45,0.08) 5px
  )
  This creates subtle red diagonal hatching like P5 UI backgrounds

---

### Rule 2: Typography needs to be CHAOTIC and STAMPED

Current version just uses bold text. Persona 5 typography feels like:
- Letters were individually CUT OUT and PASTED at slightly different angles
- Some letters are larger than others in the SAME word
- Text has visible borders/outlines like a sticker or rubber stamp

Implement this:

USERNAMES in feed:
- Each letter of the display name uses font-size alternating 18px / 22px / 18px
- The name has: white fill + 2px black stroke (text-stroke)
- A 3px red hard shadow offset (3px 3px 0 #E8002D)
- Example render: "JaNe DeV" — not uniform size

POST ACTION COUNTS (likes, reposts, comments):
- Numbers use Space Mono font, electric cyan #00FFE5
- When count > 0: yellow #FFE600 with -2deg rotation on the number element
- The action icons: use SQUARE icon containers with 2px white border
  and slight rotation (-3deg for like, +2deg for repost, -1deg for comment)
  Like P5 skill icons in battle

SECTION HEADERS ("FeeD", "MeSsAGeS", etc.):
- Apply the actual Persona 5 mixed-case more aggressively:
  Feed → "FeeD"   Messages → "MeSsAGeS"   Alerts → "aLeRTs"
  Profile → "PRoFiLe"   Steal → "STeaL"
- Each header: Bebas Neue 42px, white text, red drop shadow 4px 4px 0
- Add a ★ or ◆ diamond shape before the header text (red, 16px)
- Japanese subtitle immediately below: 11px Space Mono, red #E8002D, tracked +300

---

### Rule 3: Cards need TEXTURE and STAMP effects

Post cards currently look like clean dark boxes. They need to look like
torn cardboard with paint on them.

Each post card must have:
1. Background: #0D0D0D (not pure black, slightly warm dark)
2. A HALFTONE TEXTURE overlay at 8% opacity:
   Use an SVG background pattern of repeating circles:
   <pattern id="halftone" patternUnits="userSpaceOnUse" width="6" height="6">
     <circle cx="3" cy="3" r="1.2" fill="rgba(255,255,255,0.15)"/>
   </pattern>
   Apply this as background-image on all post cards
3. Left border: 5px solid #E8002D with a glow: box-shadow: -2px 0 8px #E8002D40
4. TOP-RIGHT corner: a folded corner effect (CSS triangle clip or ::after pseudo)
5. On hover: the card background becomes a diagonal red stripe pattern

Message bubbles (SENT - red ones) need:
- NOT clean rectangles — add a 3px offset inner shadow on bottom-right
  to simulate a stamped/printed look: box-shadow: inset -3px -3px 0 rgba(0,0,0,0.4)
- Top-right corner: hard cut (clip-path: polygon that cuts the corner at 45deg)
- Text: white, Archivo Black weight

Message bubbles (RECEIVED - dark ones):
- Border: 2px solid white with the STICKER double-border effect:
  outline: 2px solid black offset by 1px (simulate with box-shadow: 0 0 0 2px black)
- Corner cut: bottom-left 45deg clip-path
- Text: white, normal weight

---

### Rule 4: Add P5's Signature Decorative Elements EVERYWHERE

These decorative elements are what make Persona 5 instantly recognizable.
Add them throughout the UI:

◆ DIAMOND BULLETS: Replace ALL bullet points, separators, and list markers
  with ◆ in red #E8002D. Use these between username and timestamp too.
  Example: "JANE DEV ◆ @janedev ◆ 2H"

★ STAR ACCENTS: Add small ★ in yellow #FFE600 on:
  - Verified users (replace checkmark)
  - Active nav item top-right corner
  - Post with SHOWTIME status

// SLASH DIVIDERS: All section separators must be:
  "// ────────────────" in red, not horizontal rules

⚡ LIGHTNING: Use ⚡ as the icon for the SHOWTIME badge, new post button,
   and notifications tab

SPEED LINES: Behind featured/hero content areas, add CSS radial
speed lines (like manga action lines) using:
repeating-conic-gradient from center, alternating transparent and
rgba(232,0,45,0.05) every 5deg
This gives the P5 "explosion" background feel

DASHED RED BORDER on the entire feed header:
border-bottom: 2px dashed #E8002D (already partially done, keep and extend
to ALL section headers and card group separators)

---

## ✅ PART 2 — POST UI OVERHAUL

The current post cards are too minimal. Here is the complete redesign:

### POST CARD — Full Spec:
┌─────────────────────────────────────────────────────────┐ ← 5px left: solid red
│ [HEX] JANE DEVELOPER ★ @janedev ◆ 2H [SHOWTIME]│ ← top row
│ スタンプ済 — Phantom Thief Verified │ ← subtitle row
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ ← dashed red divider
│ │
│ Post content text goes here in Archivo 15px white │
│ with 1.6 line height. Max 280 chars displayed. │
│ │
│ [IMAGE if present: full width, clipped to 16:9, │
│ with 3px red border and -1deg tilt, │
│ bottom-right corner folded] │
│ │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ [💬◆8] [🔁◆23] [❤◆142] [↗] │
└─────────────────────────────────────────────────────────┘

text

Details:
- AVATAR: Hexagonal shape (clip-path: polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%))
  Size 44px, border 2px solid red, small red glow
- DISPLAY NAME: Bebas Neue 20px, white, 2px red drop shadow, mixed-case stamps
- HANDLE: Space Mono 12px, #00FFE5 cyan, tracked +100
- TIMESTAMP: Space Mono 10px, gray #666, preceded by ◆
- SHOWTIME BADGE (if trending):
  * Yellow #FFE600 background, black text "SHoWTiMe ⚡"
  * Bebas Neue 12px, -2deg rotation, hard black drop shadow
  * Sticker double-border style
- CONTENT AREA: padding 16px, normal readable text
- IMAGE ATTACHMENT:
  * Slight -1deg rotation on the image container
  * 3px solid red border
  * Bottom-right corner fold effect (::after triangle)
  * Red scan line overlay at 3% opacity using repeating-linear-gradient
- ACTION BAR:
  * NO rounded buttons — flat icon + count pairs
  * Each action: [icon in a 28px square with 1px white border, rotated ±2deg]
    + count in #FFE600 if >0 or white if 0
  * On hover: the square border turns red and shifts -2px,-2px
  * LIKE icon: heart shape, on click → fills red + brief scale slam 0.7→1.3→1.0
  * REPOST icon: on active → rotates 180deg full spin in 400ms
  * Icons spaced with ◆ diamond spacers between them

### COMPOSE POST BUTTON:
- Full width across top of feed
- Height: 52px
- Background: solid red #E8002D
- Text: "⚡ SToRm THe FeeD" in Bebas Neue 20px white
- Left edge: 4px solid white (inner left border)
- Hard black shadow: 4px 4px 0 #000000
- Hover: translate(-2px, -2px), shadow becomes (6px, 6px)
- Active/Click: translate(2px, 2px), shadow (2px, 2px) — "stamp" effect

### COMPOSE MODAL (Persona 5 Command Menu):
When clicked, the compose modal opens as a COMMAND MENU:
- Black overlay with diagonal red stripe pattern
- Modal: pure black, 600px wide, sharp corners, 4px red left border
- Title bar: "◆ SToRm THe FeeD // 投稿する" in Bebas Neue red
- Textarea: NO border-radius, just a 2px white bottom border
  placeholder text: "WHaT's YoUr MaNiFeSTo?" in 40% opacity
- Character counter: circular SVG progress ring, 40px diameter
  Turns red at 250/280, stroke-dasharray animation
- Bottom toolbar — P5 Command Menu style options stacked:
  Each option is a parallelogram shape row:
  [📸 PHoTo // 写真]   [◆ PoLL // 投票]   [⚡ MooD // 気分]   [👁 AuDieNce // 公開]
  These slide in from left with 60ms stagger on modal open
- Submit: full-width red button, "⚡ EXeCuTe" text

---

## ✅ PART 3 — RESPONSIVE SYSTEM

### Breakpoints:
- Desktop XL: 1440px+ (3 column: sidebar 240px + feed + right panel)
- Desktop: 1024px–1439px (2.5 col: sidebar 80px icon-only + feed + partial right)
- Tablet: 768px–1023px (2 col: bottom nav + feed + slide-in right panel)
- Mobile L: 425px–767px (1 col: bottom nav + feed, no right panel)
- Mobile S: 320px–424px (1 col, compressed)

### Responsive Rules per breakpoint:

**DESKTOP XL (1440px):**
- Left sidebar: 240px, full labels visible, parallelogram nav items
- Feed: 600px center column
- Right panel: 320px ("WHO TO STeaL FRoM" + trending)
- Typography: full sizes as designed

**DESKTOP (1024px):**
- Left sidebar collapses to 80px: icon-only, label appears on hover as tooltip
  Tooltip: absolute positioned, red background, white Bebas text, slides from right
- Feed: fluid width filling space
- Right panel: hidden, accessible via swipe/button

**TABLET (768px):**
- Navigation moves to BOTTOM BAR (70px height)
  Bottom nav: full width, 5 items, parallelogram active state
  Active item: red parallelogram bg, icon + Japanese label
- Feed: full width minus 32px margin
- Compose button: FAB (Floating Action Button) bottom-right
  Shape: NOT circle — use a DIAMOND shape (rotate(45deg) square)
  Color: red, ⚡ icon in white, hard black shadow
  Pulse animation: red glow expands and fades every 3s
- Post cards: same design, image goes full width

**MOBILE (425px):**
- Everything single column
- Post card: compressed — avatar 36px, typography -2px across the board
- Action bar: 4 actions evenly spaced, no gap fill
- SHOWTIME badge: top-right absolute, smaller 10px text
- Bottom nav: 5 icons only (no labels), red active indicator dot above icon
- Header: "PHREAK ◆ FeeD" in single line, 28px Bebas
- Compose FAB: persistent, bottom-right, 56px diamond shape

**MOBILE S (320px):**
- Typography: H1 → 36px, body → 13px
- Post card padding: 10px
- Image: 100% width, maintain aspect ratio
- Action bar: icons 22px, no count labels (just counts)
- Bottom nav: icons only, 44px tap targets

### RESPONSIVE COMPONENTS TO BUILD:

1. **Collapsible Sidebar** → Desktop: full | Tablet: icons | Mobile: bottom nav
2. **Adaptive Post Card** → Layout reflows, image stacks below text on mobile
3. **Compose FAB** (Mobile/Tablet only) → Diamond-shaped floating button
4. **Slide-in Right Panel** → Triggered by swipe or "STeaL" tab on mobile
5. **Responsive Chat** → On mobile: conversation list is full-screen,
   tap to open chat (full screen), back button returns to list
6. **Responsive Modal** → On mobile: modals come up from BOTTOM as sheets
   (not centered modals), 90vh height, drag to dismiss
7. **Responsive Typography** → Use clamp() for fluid type:
   font-size: clamp(14px, 2vw, 18px) for body
   font-size: clamp(28px, 5vw, 72px) for display headings

---

## ✅ PART 4 — MISSING SCREENS TO ADD

These screens were not built yet and need full P5 treatment:

### PROFILE PAGE (Priority: HIGH):
- Banner: full-bleed, halftone dot overlay, diagonal red speed lines at edges
- Avatar: HEXAGONAL (not circular!), 80px, 3px red border, slight red glow
- Username: 48px Bebas Neue, white, 3px 3px 0 red shadow, mixed-case
- Handle: Space Mono cyan below username
- "FoLLoW" button:
  * 160px wide, sharp corners (0px radius)
  * Inactive state: white border + white text "FoLLoW"
  * Hover: red swipes in left-to-right (clip-path animation 300ms)
  * Active/Following state: red bg + "フォロー済 ★" white text
- Stats row: "◆ 142 PoSTs  ◆ 8.4K FoLLoWeRS  ◆ 320 FoLLoWiNG"
  Numbers in 28px Bebas red, labels in 11px Space Mono white
- Tabs: "PoSTs / RePLieS / MeDiA / LiKeS"
  Active tab: red parallelogram underline slides between tabs
  Inactive: just white text, no bg

### NOTIFICATIONS PAGE:
Style each notification as a CONFIDANT RANK CARD:
┌──────────────────────────────────────────────────────┐
│ [❤ RED SQUARE] JANE DEV LiKeD YouR PoST // 5M │
│ "Just shipped a new feature..." │
│ RANK UP ★│
└──────────────────────────────────────────────────────┘

text
- Icon square: 40px, rotated 5deg, red bg for likes, cyan for follows, yellow for mentions
- RANK UP badge: yellow, Bebas, sticker style — only shows for milestone notifications
- Unread: card has left 5px red border + halftone bg tint
- Read: flat dark card

### SETTINGS PAGE (Arcana Theme):
Split into arcana sections with P5-style divider headers:

"★ THE ToWeR // アカウントセキュリティ"
  - Email, Username, Password fields: flat inputs, bottom-border only (2px red)
  - Change Password button: red, sharp corners

"★ THE HeRMiT // プライバシー"  
  - Privacy toggles: custom toggle that looks like a Phantom Thieves eye
    (stylized eye SVG: closed=OFF/dark, open=ON/red iris)
  - Block list: table style, sharp, with red "REMOVE" buttons

"★ THE EMPeRoR // セッション"
  - Each active session = a "TARGET CARD":
    Device icon (laptop/phone) + IP + Location + Last seen
    Red "TeRMiNaTe" button right-aligned (outline red → fill red on hover)

"★ THE JuDGeMeNT // 危険区域"
  - Danger Zone section: dark red background (#1a0000)
  - "DeLeTE ACCouNT" button: outlined red, all-caps, Bebas, only fills on hold (2s)

### ADMIN / PALACE DASHBOARD:
Header: "★ PaLaCe StaTuS // メタバース" with speed-line background

4 status cards in a 2x2 grid:
Each card = battle stat display:
┌─────────────────────────────┐
│ ★ API SERViCeS │
│ ████████████░░ 87% │ ← HP bar, red fill, black track, 4px height, sharp
│ PODS: 3/3 ◆ HEALTHY │
│ ✓ ONLINE │
└─────────────────────────────┘

text

- HP-style bars for CPU (red), SP-style bars for RAM (cyan)
- Pod slots: show as 10 small squares in a row, filled=red, empty=dark outline
- "ALL-OUT ATTACK ⚡" button for manual scale: full-width red, Bebas 20px
- Alert cards: "☠ SHaDoW DeTeCTeD // エラー" on red dark background

---

## ✅ PART 5 — FINAL POLISH CHECKLIST

Apply these globally to ALL screens:

[ ] Every card has a halftone dot texture overlay (SVG pattern, 6% opacity)
[ ] Every section header has // prefix and Japanese subtitle
[ ] All avatar shapes are HEXAGONAL (not circular)
[ ] All borders are SHARP (0px border-radius) everywhere
[ ] All badges are STICKER style (double border: white outer, black inner)
[ ] Active/selected states use PARALLELOGRAM red backgrounds
[ ] Numbers in engagement counts use yellow #FFE600
[ ] Handles use cyan #00FFE5 Space Mono
[ ] Drop shadows are always HARD OFFSET (no blur): 3-4px offset, 0 blur
[ ] Diagonal ◆ and ★ decorators used as separators between metadata items
[ ] Speed line backgrounds on hero/banner areas
[ ] Dashed red borders on section separators
[ ] Mixed-case typography on ALL navigation labels and UI headers
[ ] "SHOWTIME" badge appears on posts crossing engagement thresholds
[ ] Bottom nav on tablet/mobile uses parallelogram active state
[ ] FAB on mobile is a diamond shape (rotate 45deg square)
[ ] All modals enter from bottom on mobile (bottom sheet pattern)
🆚 What's Wrong Now vs. What This Fixes
Current Problem	This Prompt Fixes
Cards look like clean dark boxes	✅ Halftone texture + red glow borders + folded corners
Typography is just "bold white"	✅ Mixed-case stamped text + alternating sizes + text-stroke
Round avatars = still Twitter	✅ Hexagonal clip-path on all avatars
Nav items look like standard sidebar	✅ Parallelogram P5 command menu shapes
No P5 decorative DNA	✅ ◆ ★ ⚡ // separators, speed lines, dashed dividers
Not responsive	✅ Full 5-breakpoint system + bottom nav + diamond FAB
Missing screens	✅ Profile, Notifications, Settings (Arcana), Admin Palace
Compose button is boring	✅ Stamp effect + P5 Command Menu modal
Shadows are soft/blurred	✅ All shadows are hard offset (0 blur), red or black
