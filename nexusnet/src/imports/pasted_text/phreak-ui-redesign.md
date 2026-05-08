Redesign the entire "NexusNet" social network UI with a bold PERSONA 5-inspired
punk aesthetic. This is NOT Twitter. This is a rebellion. Every screen must feel
like a Phantom Thieves operation. Follow these rules strictly:

---

## 🎨 VISUAL IDENTITY — "PHANTOM FEED"

### App Name & Concept:
- New name: **"PHREAK"** — tagline: *"Steal the Feed. Own the Truth."*
- The app feels like a living manifesto — rough, loud, intentional, dangerous
- Mix of digital punk zine + Japanese street art + battle UI

---

## 🖤 COLOR SYSTEM — Hard Contrast Only:

Primary palette:
- Background: Pure black #000000
- Primary accent: Crimson red #E8002D
- Secondary accent: Bone white #F5F0E8
- Highlight: Electric cyan #00FFE5 (used sparingly, like a glitch)
- Warning/Alert: Toxic yellow #FFE600
- Overlay texture: #1a0000 (dark blood red for cards)

NO gradients. NO soft shadows. Only:
- Hard drop shadows (offset 4px–8px, solid black or red)
- Stark borders (2px–4px solid white or red)
- Halftone dot overlays on images and banners (SVG pattern)

---

## ✍️ TYPOGRAPHY SYSTEM — Persona 5 Style:

Rules:
- Mix uppercase and lowercase RANDOMLY within the same word
  Example: "CoMMeNT", "ReTwEaK", "FoLLoWeR", "MeSsAgE"
- Use 2-3 font weights in the SAME text element
- Fonts to use:
  * Headlines: **Bebas Neue** or **Black Han Sans** (heavy, condensed)
  * Body mixed: **Archivo Black** + **Space Mono** (monospace for handles)
  * Accent labels: **Permanent Marker** or hand-drawn style font
  * Japanese accent text: Add small Japanese subtitles under section
    headers (decorative only):
    - Feed → フィード
    - Messages → メッセージ  
    - Followers → フォロワー
    - Profile → プロフィール
    - Notifications → 通知
    - Settings → 設定

Typography scale:
- H1: 72px Bebas Neue, red, hard black shadow offset
- H2: 48px Black Han Sans, white, italic
- Labels: 11px Space Mono, ALL CAPS, tracked +200
- Body: 15px Archivo, white, 1.6 line height
- Handles/@username: Space Mono, cyan #00FFE5, 13px

---

## 🃏 LAYOUT RULES — No Clean Grids Allowed:

- Tilted elements: Rotate cards, badges, and labels between -3° and +3°
- Sticker borders: All tags and badges have thick white border +
  black outer border (double stroke effect = sticker look)
- Diagonal slashes: Section dividers use a diagonal red slash //
  instead of horizontal lines
- Overlapping layers: Profile avatar slightly overlaps the banner card
- Asymmetric sidebar: Left nav is 72px wide with only icons +
  Japanese labels on hover
- Hard-cut sections: No rounded hero sections — use
  parallelogram shapes (skewX(-5deg)) for featured content areas
- "COMMAND menu" inspiration: When composing a post, show options
  (Photo, Poll, Mood, Audience) in a stacked diagonal list like
  Persona 5's battle command menu — each option slides in from left
  with staggered timing

---

## ⚡ ANIMATION SYSTEM — Persona 5 Energy:

### Micro-animations (component level):

1. **Button Hover** → 
   - Hard translate(-3px, -3px) on hover
   - Shadow shifts from (3px,3px) to (6px,6px) black
   - Red underline sweeps left-to-right in 120ms
   - NO easing — use steps() or linear for snappy feel

2. **Like Button** →
   - On click: icon slams down (scale 0.7) then SLAPS back to 1.3 then 1.0
   - Red paint splatter SVG burst emits from center (4 drops, radiate out)
   - Counter flips like a slot machine digit (CSS transform rotateX)
   - Duration: 400ms total

3. **Post Card Appear** →
   - Cards fly in from LEFT with skewX(-10deg) → straightens to 0deg
   - Like a Persona 5 menu item being selected
   - Stagger each card: 80ms delay per item
   - Add a thin red horizontal line that "draws" under the card on load

4. **Navigation Active State** →
   - Active nav item: red background slices in from bottom (clip-path animation)
   - Icon shakes once (rotate -10deg → 10deg → 0deg) in 200ms
   - Japanese label fades in below icon

5. **New Notification** →
   - Badge slams onto the icon (scale 0 → 1.4 → 1.0) with elastic bounce
   - Screen edge flashes red for 1 frame (vignette flash)
   - Sound design note: describe a sharp UI "thwack" feel visually

6. **Follow Button** →
   - UNFOLLOW state: outline style, white border
   - On FOLLOW click: button FILLS red with a swipe animation left→right
   - Text flips: "Follow" → "フォロー済" → "Following" (3 frame flip, 600ms)
   - Confetti-like small diamond shapes (◆) scatter upward

7. **Profile Page Load** →
   - Banner image cuts in with a horizontal wipe (like a Persona All-Out Attack)
   - Username slams in from below with a slight overshoot (bounceOut)
   - Stats (posts/followers/following) count up from 0 rapidly

8. **Message Send** →
   - Message bubble shoots from input → up into chat with
     arc trajectory (cubic-bezier spring)
   - Brief red checkmark flash on send
   - Typing indicator: 3 dots with "erratic" timing — not smooth pulse,
     but sharp on/off blinks (like a glitch)

9. **Feed Refresh (Pull to Refresh)** →
   - Show a Phantom Thieves mask icon spinning
   - Text: "STeaLiNG NeW PosTs..." with glitching letters
   - Completes with a red flash + "SHOWTIME" text stamp that fades out

10. **Page Transitions** →
    - Route change: current page does a hard CUT to black (1 frame)
    - New page slides in from RIGHT with skewX(-15deg) → 0deg in 300ms
    - Red horizontal scan line sweeps top to bottom on entry

11. **Modal Open (Compose Post)** →
    - Black overlay fades in (200ms)
    - Modal card SLAMS in from top with overshoot bounce
    - Each input field slides in staggered (50ms apart) from left
    - Command menu options appear one-by-one with hard pop (scale 0→1, steps(2))

12. **SHOWTIME Moment** (special interaction) →
    - When a post gets 100+ likes in real time:
    - Full-width banner flashes: black bg + "SHoWTiMe ⚡" in 80px Bebas Neue
    - Lasts 1.5 seconds with red scan lines
    - Post card gets a golden #FFE600 border that pulses twice then settles

---

## 📱 SCREEN REDESIGNS — Persona 5 UI Layout:

### 1. LOGIN SCREEN:
- Full black screen
- Giant tilted red diamond shape as background element
- "PHREAK" logo: white letters, each slightly different rotation, red drop shadow
- Input fields: flat, no border-radius, bottom-border only (2px red line)
- "ENTER THE METAVERSE" as the submit button text
- MFA screen: Show a 6-digit OTP as 6 separate black boxes with red active border
  that "unlocks" left-to-right

### 2. MAIN FEED:
- Left sidebar (72px): Icon-only, red active state, Japanese label tooltip
- Feed column: NO card border-radius — sharp rectangle cards
  * Post cards have a red LEFT border accent (4px)
  * Author name in Bebas Neue white + @handle in cyan Space Mono below
  * Bottom action bar: flat icons, no circles, just raw SVGs
  * Engagement counts in yellow #FFE600 when non-zero
- Right panel: "WHO TO STEAL FROM" (Who to Follow)
  * Each suggestion has a sticker-style card with rotated name badge

### 3. USER PROFILE:
- Banner: Full bleed image with halftone dot overlay at 20% opacity
- Avatar: hexagonal clip-path (not circular), thick 3px red border
- Username display: GIANT Bebas Neue, white, slight -2° tilt
- "FOLLOW" button: wide, sharp corners, red fill, white text in Bebas Neue
- Stats bar: POSTS / フォロワー / フォロー with number in red, label in small caps white
- Tab bar (Posts/Replies/Media/Likes): underline-only tabs,
  active tab has red underline that slides between tabs (300ms)

### 4. DIRECT MESSAGES:
- Conversation list: dark red (#1a0000) bg, white text, no separators —
  just space
- Active conversation: hard red left border (4px) on list item
- Chat window:
  * Sent messages: right-aligned, RED background, white text, sharp corners
  * Received messages: left-aligned, WHITE background, black text, sharp corners
  * No bubble tails — flat rectangles
  * Timestamp: tiny, Space Mono, rotated 90° on the side of the message
  * 🔒 "E2E ENCRiPTeD" badge at top — yellow sticker style

### 5. NOTIFICATIONS:
- Each notification is a CARD that looks like a Persona 5 "Confidant Rank Up" card
- Left: colored icon (red heart, cyan arrow, yellow star) in a tilted square
- Right: text with mixed-case styling
- Unread: card has left red border + slight red bg tint
- "RANK UP" style animation when you get a new follower milestone

### 6. COMPOSE POST MODAL:
- Looks like Persona 5's COMMAND SELECT menu
- Stacked diagonal options: Photo 📸, Poll ◆, Mood ⚡, Audience 👁
- Each option: white text on black, hover = red fill sweeps from left
- Character counter: shown as a circular progress ring, turns RED at 250/280
- Post button: "SToRm THe FeED" — Bebas Neue, full width, red, white text

### 7. SETTINGS & SECURITY:
- Sections labeled like Persona 5 confidant arcana:
  * "THE TOWER — Account Security"
  * "THE HERMIT — Privacy"  
  * "THE EMPEROR — Sessions & Devices"
  * "THE JUDGEMENT — Danger Zone"
- MFA toggle: custom toggle that looks like a Phantom Thieves mask
  (open eyes = ON / closed = OFF), red accent
- Active sessions list: each session is a "target card" style —
  device icon + IP + red "TERMINATE" button

### 8. INFRASTRUCTURE DASHBOARD (Admin):
- "METAVERSE STATUS" as the header — styled like a Persona Palace name reveal
- System cards use the battle UI layout:
  * HP bar style for CPU usage (red fills from left)
  * SP bar style for Memory (blue-cyan fills from left)
  * Pod count shown as character portrait slots (filled/empty)
  * "ALL-OUT ATTACK" button to trigger manual scaling
- Alerts styled as "SHADOW DETECTED" warning cards — red bg, white text,
  skull icon ☠️

---

## 🎴 COMPONENT DESIGN TOKENS:

Borders:
- --border-sharp: 0px border-radius (default for ALL elements)
- --border-sticker: 2px solid white + 1px solid black offset
- --border-accent: 4px solid #E8002D (left accent on cards)

Shadows:
- --shadow-hard: 4px 4px 0px #000000
- --shadow-red: 4px 4px 0px #E8002D
- --shadow-cyan: 3px 3px 0px #00FFE5

Spacing: 8px base grid, but elements can intentionally BREAK the grid by ±4px

---

## 🗂️ DESIGN SYSTEM PAGE MUST INCLUDE:
- Color tokens with Persona 5 codenames (e.g., "Phantom Red", "Morgana White",
  "Metaverse Cyan", "Treasure Yellow")
- Typography specimens showing mixed-case examples
- Animation timing reference sheet (durations, easing curves as visual diagrams)
- Button states: default → hover (translate) → active (slam) → disabled (50% opacity)
- Sticker badge variants: Follow, Rank MAX, ONLINE, ENCRYPTED, SHOWTIME
- Card variants: Post, Profile, Notification, Message, Alert/Shadow
- Icon set: custom icons that look hand-stamped / woodblock print style
- Halftone dot pattern swatch (SVG)
- Diagonal divider component
- "COMMAND MENU" component (reusable stacked option list)