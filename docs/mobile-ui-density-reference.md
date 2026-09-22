# Mobile UI density reference

This is a practical sizing baseline for a dense, premium-feeling mobile UI. It uses public, first-party design-system guidance rather than reverse-engineered screenshots from proprietary apps.

## What the major systems actually specify

### Apple iOS

- Default body text: **17 pt / 22 pt leading**.
- Supporting text: subhead **15/20**, footnote **13/18**, captions **12/16** and **11/13**.
- Titles: **20/25**, **22/28**, **28/34**, with large title **34/41**.
- Minimum text size: **11 pt**; custom thin fonts should be larger.
- Minimum hit region: **44 × 44 pt**. The visible control may be smaller if its interactive region remains 44 pt.
- Apple explicitly recommends fitting primary content to the screen without horizontal scrolling.

Sources: [Apple typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Apple UI design tips](https://developer.apple.com/design/tips/).

### Google Material 3

- Body: large **16/24 sp**, medium **14/20**, small **12/16**.
- Labels: large **14/20**, medium **12/16**, small **11/16**.
- Titles: large **22/28**, medium **16/24**, small **14/20**.
- Headlines: **24/32**, **28/36**, **32/40**.
- Material's compact navigation bar is intended for **3–5 destinations**.
- Material uses a small semantic type set in real product examples rather than applying the full display scale everywhere.

Sources: [Material 3 typography in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3), [Material navigation bar](https://developer.android.com/develop/ui/compose/components/navigation-bar), [Material adaptive layouts](https://m3.material.io/foundations/layout/canonical-examples/overview).

### Microsoft Fluent and IBM Carbon

- Fluent tags require only **4 px** between extra-small tags, **6 px** between small tags, and **8 px** between medium tags. This is useful evidence that pills do not need large card-like gutters.
- Carbon input heights are **32 px** small, **40 px** medium/default, and **48 px** large. Carbon recommends 32 px for dense/long forms and 40 px for normal forms; 48 px is for roomy, simple forms.
- Fluent cards are content-sized by default (`fit-content`); a card should not receive a large fixed height merely because it is a card.

Sources: [Fluent tag spacing](https://fluent2.microsoft.design/components/web/react/core/tag/usage), [Fluent cards](https://fluent2.microsoft.design/components/web/react/core/card/usage), [Carbon text inputs](https://carbondesignsystem.com/components/text-input/usage/).

## Recommended scale for this app

Use CSS pixels for this web app. On a normal mobile viewport, these values visually track the dense end of established native systems while keeping touch targets accessible.

| Element | Mobile recommendation |
|---|---:|
| Page side gutter | **16 px** |
| Primary section gap | **24 px** |
| Related-content gap | **12–16 px** |
| Micro gap | **4–8 px** |
| Eyebrow / metadata / table heading | **11 px / 16 px**, medium or semibold |
| Secondary label / nav label | **12 px / 16 px** |
| Default body / field value | **14 px / 20 px** |
| Important body / button label | **15–16 px / 20–22 px** |
| Compact page title | **28–32 px / 32–36 px** |
| Editorial hero title | **40–48 px / 0.95–1.0**; only one per screen |
| Pill visible height | **32–36 px** |
| Pill horizontal padding | **12–16 px** |
| Button/input visible height | **40–44 px** |
| Minimum interactive hit box | **44 × 44 px** |
| Compact list/table row | **48–56 px** |
| Two-line list row | **64–72 px** |
| Bottom navigation content height | **56–64 px**, plus safe-area inset |
| Bottom-nav icon | **22–24 px** |
| Card padding | **16 px** (use **20–24 px** only for a single hero card) |
| Card radius | **16–20 px**; pills use full radius |
| Form field stack gap | **12–16 px** |
| Form section gap | **24 px** |

## Density rules

1. **Separate visual size from touch size.** A 32–36 px pill can still have a 44 px hit region through padding or a pseudo-element. Accessibility does not require every control to look 44 px tall.
2. **Use 14 px as the working body size.** Reserve 16–17 px for high-attention copy, not every label, stat, and row.
3. **Keep decorative typography scarce.** One editorial headline can be 40–48 px; routine page titles should stay around 28–32 px.
4. **Do not use fixed card heights for ordinary content.** Let cards fit their content; use 16 px internal padding and 12–16 px gaps.
5. **Compress data surfaces.** Table headings at 11 px, values at 14–16 px, rows at 48–56 px, with alignment and contrast doing the hierarchy work.
6. **Fit the primary task above the fold, not the entire app.** Scrolling is normal on mobile. Excessive scrolling comes from repeated 40–80 px gaps, oversized controls, and fixed-height presentation blocks—not from using a mobile viewport.
7. **Use a 4 px spacing grid.** Favor 4, 8, 12, 16, 24, and 32. Avoid arbitrary large vertical gaps unless they create a deliberate hero moment.

## Immediate target

For the current UI, the highest-impact pass is to normalize routine text to **11/12/14/16 px**, controls to **32–44 px visible height**, rows to **48–56 px**, card padding to **16 px**, and ordinary section spacing to **24 px**. Preserve oversized serif type only for one primary editorial statement per screen.
