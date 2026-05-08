This is a targeted improvement pass on PHREAK. Two main goals:
1. Fix contrast and visual hierarchy across all elements
2. Make SHOWTIME a fully interactive, animated, functional experience

---

## ✅ PART 1 — CONTRAST & READABILITY OVERHAUL

### THE PROBLEM:
The dark card backgrounds (#0D0D0D) with dark red accents create
too little contrast. Text needs to breathe. The UI feels muddy.

### FIX THE COLOR HIERARCHY — 4 levels of contrast:

Level 1 — PRIMARY TEXT (must be pure white):
- Display names: #FFFFFF, Bebas Neue, text-shadow: 2px 2px 0 #E8002D
- Post body text: #F5F0E8 (warm white, NOT pure white — easier to read on dark)
- Navigation labels: #FFFFFF when active, #CCCCCC when inactive

Level 2 — SECONDARY TEXT (readable but subordinate):
- @handles: #00FFE5 (cyan) — already good, keep it
- Timestamps: #888888 — INCREASE to #AAAAAA (was too dark)
- Japanese subtitles in nav: #FF4444 (brighter red, not dark red)
- "// スタンプ済" subtitle under username: #FF6666, 11px

Level 3 — ACCENT / INTERACTIVE (must POP):
- Engagement counts when > 0: #FFE600 (yellow) — increase font-weight to 700
- Engagement counts when = 0: #666666
- SHOWTIME badge text: #000000 on #FFE600 background (MAX contrast)
- Active nav item text: #FFFFFF on #E8002D (not dark red, FULL red)

Level 4 — BACKGROUNDS (layered depth):
- Page background: #000000
- Sidebar background: #0A0000 (very dark red tint, not pure black)
  This separates it visually from the feed WITHOUT needing a border
- Post card background: #111111 (slightly lighter than page)
- Post card hover: #1A0000 (dark blood red — signals interactivity)
- Card left accent border: #E8002D with glow: 0 0 8px #E8002D60

### SPECIFIC ELEMENT FIXES:

NAVIGATION SIDEBAR:
- Active item:
  * Background: #E8002D (FULL bright red, not dark red)
  * Text: #FFFFFF 100% opacity
  * Left edge: 4px solid #FFFFFF (white, not another red)
  * Japanese label: #FFFFFF 80% opacity
- Inactive item:
  * Background: transparent
  * Text: #CCCCCC
  * Border: 1px solid #333333 (very subtle)
  * On hover: background #1A0000, text #FFFFFF, border #E8002D
- The parallelogram nav items need MORE visible red border:
  Change current border from 1px to 2px solid #E8002D on inactive
  Change to NO border + solid red fill on active

FEED HEADER ("FeeD // フィード"):
- "FeeD": Bebas Neue 48px, #FFFFFF, shadow: 4px 4px 0 #E8002D
- "// フィード": Space Mono 12px, #E8002D, tracked +400
- "LIVE" badge: #E8002D background, #FFFFFF text, 
  add a blinking dot before it: ● LIVE
  The dot pulses: opacity 1 → 0 → 1 every 1.2s (CSS animation)

STORM THE FEED BUTTON:
- Current red is good but text needs more weight
- Text: "⚡ SToRM THe FeeD" — increase to Bebas Neue 22px
- Add white left border: 4px solid #FFFFFF on the left edge of the button
- Hard shadow: 5px 5px 0 #000000 (increase offset)
- On hover: shadow shifts to 8px 8px 0 #000000, button translates -3px -3px

POST CARD CONTRAST:
- Username line: increase Bebas Neue to 18px (currently looks small)
- The dashed red separator line between username and body:
  Change from border-color: #E8002D40 (too transparent) to #E8002D99
  This makes the dashed line actually visible
- Post body text: #F5F0E8, 15px, line-height 1.7
- Action bar icons: increase from current size to 20px
- Action bar container: add top border 1px solid #222222 (subtle separator)

SHOWTIME BADGE (contrast fix):
- Background: #FFE600 (bright yellow — NEVER dark yellow)
- Text: #000000 (pure black — maximum contrast ratio 21:1)
- Font: Bebas Neue 13px, tracked +100
- Border: 2px solid #000000
- Shadow: 3px 3px 0 #000000
- Rotation: -2deg
- The ⚡ icon before text: 14px, black

---

## ✅ PART 2 — SHOWTIME: FULL INTERACTIVE SYSTEM

### WHAT SHOWTIME IS (define the mechanic):

SHOWTIME is a special state that activates when a post is "on fire."
A post earns SHOWTIME status when it reaches 100+ likes OR 50+ reposts.

The badge is NOT just a label — it is a CLICKABLE TRIGGER
that launches a full dramatic sequence, like pressing "All-Out Attack" in P5.

---

### SHOWTIME BADGE BEHAVIOR — 3 States:

STATE 1 — IDLE (post has SHOWTIME status, not yet triggered):
- Badge shows: [⚡ SHoWTiMe] — yellow, -2deg rotation
- Subtle idle animation: badge scale oscillates 1.0 → 1.04 → 1.0
  every 2 seconds (slow breathing pulse)
- Cursor: pointer
- Tooltip on hover: "⚡ TRiGGeR SHoWTiMe // クリックして発動"
  Tooltip: black bg, white Bebas text, appears below badge with -3deg tilt

STATE 2 — HOVER (user mouses over badge):
- Badge scale: 1.0 → 1.1 (quick 150ms)
- Shadow: 3px 3px 0 #000 → 5px 5px 0 #000
- Badge translates: (-2px, -2px)
- Background flashes from #FFE600 → #FFFFFF → #FFE600 once (200ms flash)

STATE 3 — TRIGGERED (user clicks badge):
Launch the full SHOWTIME SEQUENCE:

---

### SHOWTIME SEQUENCE — Step by Step:

STEP 1 — IMPACT FLASH (0ms → 100ms):
- The clicked post card: scale(1) → scale(0.97) → scale(1.02) in 100ms
- A white flash overlay covers the entire VIEWPORT for 1 frame (16ms)
  CSS: position fixed, inset 0, background white, opacity 0→1→0, duration 80ms

STEP 2 — CARD TAKEOVER (100ms → 400ms):
- The post card expands: height animates from current → 100vh
- Cards ABOVE scroll up and out of view (transform: translateY(-120%))
- Cards BELOW slide down and out (transform: translateY(120%))
- The SHOWTIME card gets: z-index 100, position relative, red border glows

STEP 3 — SHOWTIME BANNER (400ms → 900ms):
- A full-screen overlay appears: background #000000
- Giant text SLAMS in from top:
  "SHoWTiMe" in Bebas Neue, responsive size (clamp(64px, 12vw, 120px))
  Color: alternates between #FFFFFF and #E8002D every 100ms (3 flashes)
  Then settles on #FFFFFF with 6px red hard shadow
- ⚡ lightning bolt icon (80px) drops from top with bounce easing
- Japanese subtitle fades in below: "スタンプ発動 // ALL-OUT ATTACK"
  Space Mono, 16px, #E8002D, tracked +200

STEP 4 — POST SPOTLIGHT (900ms → 2500ms):
The full-screen overlay fades to 85% dark, and the post content
is displayed centered and enlarged:
- Avatar (hexagonal): 80px, glowing red border animation
- Username: 32px Bebas Neue, white, red shadow
- Post content: 18px Archivo, white, centered
- Engagement stats DISPLAYED LARGE:
  "❤ 142  ◆  🔁 23  ◆  💬 8"
  Each number: 36px Bebas Neue, #FFE600, hard black shadow
  Numbers COUNT UP from current values: +1 on each stat during this view
  (simulates the post going viral in real time)
- Speed line background (radial, red, 10% opacity) radiates behind the card

STEP 5 — EXIT (2500ms → 3000ms):
User can click anywhere OR wait 3 seconds:
- Click anywhere: immediate dismiss
- Auto-dismiss at 3000ms
- Exit animation:
  * Overlay fades to 0 opacity (400ms)
  * Cards animate back to original positions (translateY back to 0, 300ms)
  * Post card returns to normal size with slight elastic bounce
  * SHOWTIME badge changes to: TRIGGERED state — gray bg, "★ SHoWN" text
    (can only trigger once per session per post)

---

### SHOWTIME BADGE — TRIGGERED/SPENT STATE:
After being activated:
- Background: #333333
- Text: "★ SHoWN" in white, 11px Bebas
- No more hover effects
- Tooltip: "SHoWTiMe aTReaD TRiGGeReD // 発動済"
- This resets if page refreshes

---

### POST CARD — SHOWTIME ELIGIBLE INDICATOR:

When a post FIRST reaches 100 likes (live update via socket),
trigger a "SHOWTIME UNLOCK" animation ON THE CARD:

1. Card border flashes: red → yellow → red → yellow (4 flashes, 100ms each)
2. SHOWTIME badge SLAMS onto the top-right corner:
   scale(0) → scale(1.4) → scale(0.9) → scale(1.0) with elastic timing
   Duration: 600ms
3. Brief yellow particle burst (4 ◆ diamonds scatter from badge position,
   animate outward and fade, 500ms)
4. Card gets a permanent yellow corner accent: 
   top-right corner gets a 16px yellow triangle (CSS ::after)

---

### SHOWTIME COUNTER (global):
In the feed header area, add a live counter:
"⚡ 3 SHoWTiMeS ToDaY // 本日の発動"
Space Mono 11px, #FFE600
When a new SHOWTIME post appears: counter increments with a flip animation
(rotateX(180deg) → 0deg on the number, 300ms)

---

## ✅ PART 3 — ADDITIONAL CONTRAST FIXES BY SCREEN

### MESSAGES SCREEN:
- Conversation list items:
  * Unread: #1A0000 background + #FFFFFF name text + #FFE600 unread count badge
  * Read: #111111 background + #CCCCCC name text
  * Active/Selected: #E8002D left border 5px + #1A0000 background
  * Last message preview: #AAAAAA (increase from current gray)
  * Timestamp: #888888, Space Mono 10px

- Chat bubbles SENT (red):
  * Background: #E8002D → keep
  * Text: #FFFFFF 100% — INCREASE font-weight to 500
  * Add: 1px solid #FF4444 inner border (box-shadow: inset 0 0 0 1px #FF4444)

- Chat bubbles RECEIVED (dark):
  * Background: #1E1E1E (lighter than #111, more contrast against text)
  * Text: #F5F0E8 (warm white)
  * Border: 2px solid #333333 (increase visibility)

- Message input:
  * Background: #111111
  * Border: 2px solid #333333, on focus: 2px solid #E8002D
  * Placeholder: #666666 → increase to #888888
  * Text: #FFFFFF

### NAVIGATION:
- "PHREAK" logo: increase to 32px Bebas Neue
  Add red underline: 3px solid #E8002D, 4px below text
- "// 怪盗団" subtitle: #FF4444 (brighter), 11px Space Mono
- The dashed line separator below logo: 
  border-bottom: 2px dashed #E8002D (brighter, currently too dim)

---

## ✅ PART 4 — MICRO-CONTRAST DETAILS

Apply these small but impactful fixes:

1. HALFTONE TEXTURE on cards: increase opacity from 6% to 10%
   The dots should be BARELY visible but add analog warmth

2. LEFT ACCENT BORDER on cards:
   Current: 5px solid #E8002D
   Fix: 5px solid #E8002D + box-shadow: -3px 0 10px #E8002D50 (red glow)
   This makes the red border "bleed" light and look more dramatic

3. CARD HOVER STATE:
   Current: probably just background change
   Fix: 
   - background: #1A0000
   - left border glow intensifies: box-shadow: -4px 0 16px #E8002D80
   - cursor: pointer
   - transition: all 150ms (fast, snappy — not smooth)

4. DASHED SEPARATORS:
   All dashed red lines (between header and content, between username and post):
   border: 1px dashed #E8002D99 (60% opacity, still visible, not overwhelming)
   
5. ACTION BAR ICON SQUARES:
   Current fill: unknown
   Fix: 
   - Default: 1px solid #444444 (visible but subtle)
   - Hover: 1px solid #E8002D, background: #1A0000
   - The number next to each: Space Mono 12px,
     > 0 = #FFE600 weight 700
     = 0 = #555555

6. "LIVE" INDICATOR in feed header:
   Add pulsing dot: ● (red, 8px) with animation:
   @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
   animation: pulse 1.2s infinite