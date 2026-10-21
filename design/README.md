# Maestro design system

The canonical identity and tokens for **Maestro / Musician** (web) and **Maestro / Cue** (JUCE). Assets are local and require no font service or runtime network request.

## Identity

Use `mark.svg` for the geometric M; tint the white silhouette with the theme accent (CSS mask or JUCE Drawable replacement). `wordmark.svg` supplies the monochrome lockup; its text uses system Arial. Product headers use the shared mark alongside native text for legibility and accessibility. `favicon.svg` is the fixed violet app icon. Keep clear space of at least 8px around the mark. Do not use cue red or green as brand colors.

Graphite surfaces and violet accents define dark mode; warm white surfaces and deeper violet define light mode. Red means **HOLD**, green means **PLAY**, neutral means **NO CUE SIGNAL**. Always pair cues with visible text. Amber identifies upcoming markers, not performance permission.

## Tokens and adapters

Edit `tokens.json`, then run from the repository root:

```sh
node design/generate.mjs
node design/generate.mjs --check
```

Commit the JSON and both generated files together. Node 18+ is required for development. The web client loads `generated/tokens.css`; JUCE includes `generated/Tokens.h`. CMake configuration and the client check command reject stale adapters. New tokens must exist in the same order in both themes. Colors use hex RGB or RGBA; the generator converts RGBA to JUCE ARGB.

Use semantic color names rather than literals. `accent`/`onAccent` is the primary action pair. `ink` and `muted` are text roles. `line` and `focus` provide accessible boundaries and focus indicators. `buildWash` and `dropWash` tint marker labels. Shared spacing is 4/8/12/16/24/32/48px; control corners are 8px and panel corners 16px. Typography uses native system sans-serif, with caption/body/heading/brand/cue roles and tabular performance numerals. Responsive web layouts can scale display sizes and spacing.

## Theme selection

Both interfaces start dark. The header button names the theme it will activate. The web remembers `maestro-theme`, applies it before first paint, and updates canvas colors immediately. Existing `horizon-preferences` migrate into `maestro-preferences`; preview duration still uses the functional `horizon` field. Unavailable browser storage falls back safely.

The plugin stores its selection in a JUCE PropertiesFile (`Maestro/Maestro.settings` under Application Support), separate from DAW state and automation. Editors sharing that file refresh their theme at 4Hz. Sandboxed hosts can isolate settings in their own containers. Plugin identifiers, audio behavior, OSC contract, and parameter IDs are unchanged.

## Verification

`npm --prefix client run check` checks generated assets and JavaScript syntax. `npm --prefix client test` includes semantic text, control-boundary and focus contrast checks, theme persistence/storage failure checks, legacy preference migration, and existing OSC integration tests. Browser and standalone visual checks should cover both themes, HOLD/PLAY/unknown, rehearsal waveform, dialogs, diagnostics, keyboard focus, and narrow layouts.

Dark: graphite canvas, violet actions, pale neutral text, pale red/green cues. Light: warm white canvas, white panels, deep violet actions, charcoal text, deep red/green cues. The cue surface remains lightly tinted in both apps.

Implementation verification (2026-10-21): all 11 client tests and syntax/drift checks passed; Debug Standalone, AU, and AUv3 builds passed; `auval -v aufx Mcue Knde` passed. Both themes were visually inspected in Safari and the native standalone editor, including the web rehearsal waveform and light setup dialog. Narrow layouts and DAW-hosted editor interaction still need manual review.
