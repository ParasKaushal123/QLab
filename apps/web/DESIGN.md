# QUBIQ: design system

Direction: Adora's journey canvas combined with Steep's home dashboard. The product is bright and visual, built from white rounded cards on a dotted canvas, with one electric-violet action colour and pastel accents used sparingly, like confetti. This replaces the earlier ink-on-dark, serif "Stage" direction.

## Tokens (`tokens.css`)

| Role | Token | Value |
|---|---|---|
| The one filled action colour. Also used for selection, the playhead, active pills and the QUBIT cursor arrow | `--violet` | #592EFF |
| Display headings and big numbers | `--plum` | #21164C |
| Body text, wires and default strokes | `--ink` | #353241 |
| Secondary text | `--muted` | #5F5F69 |
| 1px borders | `--hairline` | #E0E0DB |
| Sidebar and canvas ground | `--recessed` | #F2F2EF |
| Canvas dots (20px pitch) | `--dot` | #D3D3CC |
| Pastel washes (backdrop, squiggle, cursor labels) | `--sky` / `--lime` / `--pink` | #BCF2FF / #DFFF9D / #FFAAE6 |
| Badge strokes and icon accents | `--cyan` / `--limepop` / `--magenta` | #2ED6FF / #A2EA13 / #F843C2 |

**Tinted insight cards** each have a background and a same-hue text colour, exposed as `--ti`:

| Tint | Background | Text |
|---|---|---|
| Blue | #E8F1FC | #1B4B82 |
| Rose | #FBEDEA | #7A2E1D |
| Lime | #F1FBDC | #3F5A0A |
| Lilac | #EFEAFF | #3A248F |

**Gate families** are rounded 10px chips with a pastel fill and a dark glyph:

| Family | Fill / glyph |
|---|---|
| Pauli and H | #BCF2FF / #0B5566 |
| Phase (S, T, P) | #FFD6F1 / #7A1F5E |
| Rotations | #DFFF9D / #3F5A0A |
| Controlled | #EFEAFF / #21164C, with a violet control dot |
| Two-qubit | #FFE9B8 / #6B4A00 |
| Measure and reset | #FFE1DC / #9A2A1A |

## Type

- **Display:** Instrument Sans 600/700 (Google Fonts), standing in for General Sans. The page CSP allows stylesheets only from Google Fonts, so Fontshare can't load.
- **UI and body:** Plus Jakarta Sans 400–700.
- **Kets, code and numbers:** JetBrains Mono.
- No serif anywhere.

## Shape and elevation

- **Radii:**
  - frame 40px;
  - circuit and stage cards 32px;
  - cards 24–28px;
  - pills, badges, toolbars and cursor labels stadium;
  - controls 10px;
  - gates 10px.
- **Elevation:** hairlines plus white-on-grey layering. Soft shadow (`0 8px 24px rgba(33,22,76,.08)`) only on floating elements: toolbar, drawers, popovers, cursor speech and the ask box.
- **Painterly frame:** blurred sky/lime/pink radial blobs, visible only in the 14px frame around the app window and behind the landing hero.

## Components

- **Canvas and cards** (`board.js`):
  - dotted board you can pan (drag the ground, Space, trackpad) and zoom (⌘-scroll, pinch, toolbar);
  - cards are draggable and resizable, and their layout persists per canvas;
  - connectors have rounded elbows and number pills (`good` = lime, `bad` = rose);
  - under 700px wide the canvas stacks its cards.
- **Floating toolbar:** a white stadium pill at the bottom centre holding tools, the gate tray, template search, undo/redo and zoom.
- **Cursor:** a filled arrow plus an uppercase stadium name label. QUBIT, the tutor, carries a white speech card.
- **Tinted metric card:** a pastel card with a big 40–56px number, a delta and a mini chart in `--ti`.
- **Filter pill, badge, primary button, ghost button, segmented pill (depth dial), slider with a violet thumb, listbox menu** (`ui.css`).

## Rules

- One violet filled button per view. Exercise **Check** buttons are the exception the brief asks for.
- About 85% of the screen stays white or grey. Colour comes from tinted cards, gate chips, visuals and badges.
- No gradients on buttons or text, no side-stripe accents, no emoji except the greeting's ☀.
- Every thumbnail and preview is rendered live from the simulator.
