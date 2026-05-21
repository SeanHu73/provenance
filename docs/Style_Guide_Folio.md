# Style Guide: The Folio — Palo Alto palette

*Recoloured 2026-05-20 to the Palo Alto palette
(`docs/Style Guide - Palo Alto.png`). The original 1950s Mid-Century
cranberry/teal scheme is superseded; the values below match the
`[data-theme='teal']` block in `globals.css`.*

**Persona:** Scholarly Explorer

## Typography
- **Display / headings:** DM Serif Display (shared with the Red theme)
- **Content / body:** Newsreader (shared across both themes)

**Font pairing:** DM Serif Display (display) + Newsreader (body).
Both themes now share these; Cormorant Garamond has been dropped.

## Color Palette — Palo Alto

### Core
| Token | Hex | Usage |
|---|---|---|
| Primary | #175E54 | Palo Alto — main brand, buttons, accents |
| Primary (light) | #2D716F | Hover / lighter primary |
| Secondary | #8F993E | Olive — secondary accent |
| Secondary (light) | #A6B168 | Olive light — hover |
| Accent dark | #014240 | Palo Alto dark — section headings, timer, journal |
| Light accent | #7A863B | Olive dark — completed states, borders, advance buttons |
| "?" accent | #279989 | Palo Verde — question button |
| Text | #2D3D38 | Body text |
| Muted | #57605B | Secondary text, labels |
| Border | #D5D5D5 | Borders, dividers |
| Surface Alt | #F0F4F3 | Alternate surface |
| Surface | #FFFFFF | Card backgrounds |

### Semantic
| Token | Hex |
|---|---|
| Success | #1B7848 |
| Warning | #967B11 |
| Error | #B12828 |
| Info | #2A50A8 |

## Components
- **Primary button:** Solid #175E54, white text, rounded
- **Secondary button:** Outline #175E54, transparent bg
- **Tertiary button:** Outline dark, transparent bg
- **Badges:** Solid primary for category, outline for metadata
- **Cards:** White bg, subtle border, rounded-lg
- **Inputs:** Light border, rounded

## Tokens
- **Spacing:** 4, 8, 12, 16, 24, 32, 48, 64, 96
- **Border radius:** none, sm (2px), md (4px), lg (8px)
- **Elevation:** sm, md, lg (increasing shadow)
