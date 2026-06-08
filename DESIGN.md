# Design System: Tenaxis ERP/FSM

## 1. Visual Theme & Atmosphere
A clean, precise, and high-density operational dashboard atmosphere tailored for Field Service Management (FSM) and enterprise resource planning. The visual style is clinical, structural, and robust, emphasizing clear data hierarchies, grid lines, and high-contrast indicators. The interface uses a dark canvas theme with subtle border definitions to convey stability, power, and real-time responsiveness.

## 2. Color Palette & Roles
- **Canvas Dark** (#09090b) — Primary background for the entire application canvas.
- **Pure Surface** (#121214) — Container background, card fills, and dashboard panel bodies.
- **Slate Ink** (#f4f4f5) — High-contrast primary text and prominent typography.
- **Muted Zinc** (#71717a) — Secondary metadata, descriptions, empty states, and inactive tab titles.
- **Whisper Border** (rgba(255,255,255,0.08)) — 1px structural division lines, table borders, and card outlines.
- **Teal Command** (#0d9488) — Primary accent for critical action buttons, active dispatch routes, and focus states.
- **Status Indicators**:
  - *Success / Active / Scheduled*: #10b981 (Calibrated Emerald)
  - *Alert / Delayed / Review*: #f59e0b (Amber Warning)
  - *Critical / Error / Offline*: #ef4444 (Crimson Red)

## 3. Typography Rules
- **Display & Headlines**: Satoshi — Track-tight, bold geometric sans-serif. Visual hierarchy is driven by varying weights rather than massive font sizes to maintain professional data density.
- **Body Text**: Satoshi — Regular weight, optimized leading (1.5), max-width of 65 characters per line (65ch) for paragraphs.
- **Operational/Monospace**: Geist Mono — Used for all numerical values, timeslots, latitude/longitude coordinates, order numbers, and system logs.
- **Banned Typography**: Inter (strictly banned), generic system sans-serifs, and any serif fonts (Times New Roman, Georgia, etc.).

## 4. Component Stylings
- **Buttons**: Flat design with solid fills. No outer glows or neon dropshadows. Primary buttons use Teal Command (#0d9488) with white text. Provide a tactile physical feedback state (translate -1px on active). Secondary actions use ghost/outline variants with Whisper Border.
- **Cards**: Moderately rounded corners (0.75rem / 12px) to match the industrial feel. No deep heavy shadows; elevation is represented strictly by Whisper Border outlines and flat Pure Surface fills.
- **Inputs & Fields**: Labels must be strictly positioned above the input fields. Focus rings must use Teal Command. Loading indicators must utilize structural skeletal shimmers that match layout dimensions instead of circular spinner icons.
- **Skeletal Loaders**: Structured, flat, matching block sizes. Avoid spinning loader icons.

## 5. Layout & Grid Principles
- **Asymmetric Composition**: Center-aligned layouts are strictly banned for primary content. Use left-aligned, split-screen, or asymmetric structural compositions.
- **Grid Systems**: Layouts must be built using CSS Grid with explicit columns and gap scaling. Avoid percentage math or flexbox for structural page grid lines.
- **Content Zones**: Elements must never overlap. All components must occupy their own clean spatial zone. 
- **Mobile responsiveness**: Multi-column systems must collapse into a clean single column under 768px. All text scales smoothly using CSS `clamp()`. Vertical margins and padding scale proportionally (`clamp(2rem, 5vw, 5rem)`).

## 6. Motion & Interaction
- **Spring Physics**: All interactive elements must animate using weighty, natural spring motion curves (e.g., stiffness: 100, damping: 20). Avoid linear or standard easing functions.
- **Cascade Loading**: List items, table rows, and dispatch cards must render with staggered cascade delays rather than appearing all at once.
- **Transforms**: Animations must be restricted to CSS `transform` and `opacity` to ensure hardware acceleration. Do not animate layout properties such as `width`, `height`, `top`, or `left`.

## 7. Anti-Patterns (Strictly Banned)
- No emojis anywhere in the user interface.
- No purple, blue, or violet neon gradient effects or glowing shadows.
- No pure black (#000000) for canvases or panels.
- No standard "3 equal horizontal cards" blocks (use asymmetric layout or horizontal scrolling viewports instead).
- No generic AI copy phrases: "seamless", "next-generation", "elevate", "unleash", or "empower".
- No generic placeholder names (e.g., "John Doe", "Acme Corp"). Use realistic business domain examples.
- No broken Unsplash URLs; use structural SVGs or neutral CSS patterns for media placeholders.
