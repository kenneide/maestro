# Maestro design system

The canonical identity and tokens for **Maestro / Musician** (web) and **Maestro / Cue** (JUCE). Assets are local and require no font service or runtime network request.

## Identity

Use `mark.svg` for the geometric M; tint the white silhouette with the theme accent (CSS mask or JUCE Drawable replacement). `wordmark.svg` supplies the monochrome lockup; its text uses system Arial. Product headers use the shared mark alongside native text for legibility and accessibility. `favicon.svg` is the fixed violet app icon. Keep clear space of at least 8px around the mark. Do not use cue red or green as brand colors.

Graphite surfaces and violet accents define dark mode; warm white surfaces and deeper violet define light mode. Red means **Stop** and green means **Play**. The musician app falls back to Stop if the cue signal is missing or stale. Always pair cues with visible text.

## Tokens and adapters

Edit `tokens.json`, then run from the repository root:

```sh
node design/generate.mjs
node design/generate.mjs --check
```

`generate.mjs` also renders `mark.svg` in the dark accent on the dark background into `generated/icon-180.png` and `generated/icon-512.png`, the iPhone/iPad home-screen icons. The mark must stay a straight-line path (`M`/`L`/`H`/`V`/`Z`) for this renderer.

Commit the JSON and all generated files together. Node 18+ is required for development. The web client loads `generated/tokens.css`; JUCE includes `generated/Tokens.h`. CMake configuration and the client check command reject stale adapters. New tokens must exist in the same order in both themes. Colors use hex RGB or RGBA; the generator converts RGBA to JUCE ARGB.

Use semantic color names rather than literals. `accent`/`onAccent` is the primary action pair. `ink` and `muted` are text roles. `line` and `focus` provide accessible boundaries and focus indicators. `buildWash` and `dropWash` tint marker labels. Shared spacing is 4/8/12/16/24/32/48px; control corners are 8px and panel corners 16px. Typography uses native system sans-serif, with caption/body/heading/brand/cue roles and tabular performance numerals. Responsive web layouts can scale display sizes and spacing.

## Theme selection

Both interfaces start dark. Open the gear button for Settings; the sun/moon icon names the theme it will activate through its tooltip and accessibility title. `icons/settings.svg`, `icons/sun.svg`, and `icons/moon.svg` match the web app’s SVG shapes and are bundled into the plugin. The web remembers `maestro-theme` and applies it before first paint. Existing `horizon-preferences` and saxophone instrument selections migrate into the current preferences. Unavailable browser storage falls back safely.

The plugin stores its selection in a JUCE PropertiesFile (`Maestro/Maestro.settings` under Application Support), separate from DAW state and automation. Editors sharing that file refresh their theme at 4Hz. Sandboxed hosts can isolate settings in their own containers. Plugin identifiers, audio behavior, OSC contract, and parameter IDs are unchanged.

## Verification

`npm --prefix client run check` checks generated assets and JavaScript syntax. `npm --prefix client test` includes semantic text, control-boundary and focus contrast checks, theme persistence/storage failure checks, legacy preference migration, and existing OSC integration tests. Browser and standalone visual checks should cover both themes, Stop/Play, missing cues, settings, QR scanning, diagnostics, keyboard focus, and narrow layouts.

Dark: graphite canvas, violet actions, pale neutral text, pale red/green cues. Light: warm white canvas, white panels, deep violet actions, charcoal text, deep red/green cues. Cue text carries the semantic color on the neutral background. The plugin’s large button retains a visible border and keyboard focus indicator. QR codes always use black modules on white with a four-module quiet zone.

Plugin redesign verification (2026-10-21): all 16 client tests and syntax/drift checks passed; Debug Standalone, AU, and AUv3 builds passed; both native test suites (configuration/state and independent QR decoding) passed; `auval -v aufx Mcue Knde` passed. The standalone editor was visually checked in both themes, including Settings, QR visibility, invalid and custom web ports, Escape, and Space-to-cue behavior. DAW-hosted editor interaction and scanning from a physical phone still need manual review.
