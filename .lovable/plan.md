

## Global App Density Reduction (90% Scale)

### Approach

Since the app looks correct at 90% browser zoom, the most efficient fix is to scale down the entire app globally rather than modifying hundreds of individual components. Tailwind CSS uses `rem` units for all spacing, font sizes, and component dimensions. By reducing the root `font-size` from the default `16px` to `14.4px` (90% of 16px), every `rem`-based value in the app shrinks proportionally -- padding, margins, font sizes, icon containers, table rows, etc.

This is the industry-standard approach for achieving a denser UI (used by tools like Linear, Jira, and Notion).

### Changes

**File: `src/index.css`**
- Add `font-size: 14.4px` (90% of 16px) to the `html` element in the base layer
- This single change cascades to ALL components since Tailwind spacing (`p-4`, `gap-2`, `text-sm`, `h-16`, etc.) are all rem-based
- No individual component changes needed

### Technical Details

```text
Before:  html { font-size: 16px }   ->  1rem = 16px  ->  p-4 = 16px
After:   html { font-size: 14.4px } ->  1rem = 14.4px -> p-4 = 14.4px
```

This achieves the exact same result as 90% browser zoom but baked into the app itself, so users see the compact layout at 100% zoom.

### What Scales Down
- All text sizes (headings, body, labels)
- All spacing (padding, margins, gaps)
- Component heights (header bar, table rows, buttons)
- Sidebar width and icon sizes
- Modal/dialog sizes

### What Does NOT Change
- Pixel-based values (borders, box shadows)
- Viewport units (min-h-screen still works)
- Images/logos using explicit pixel dimensions

