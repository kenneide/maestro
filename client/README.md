# Horizon

A local musician companion for a saxophonist. Run the browser on your Mac and move it to the iPad extended display.

## Start

From the repository root, run:

```sh
npm --prefix client start
```

Open http://localhost:4173. Keep Terminal open and stop with Control-C. Node.js 18+ is required; there are no dependencies or installation step.

In VS Code, open the repository folder, select **Run client** in Run and Debug, and press **F5**. This starts the Node server under the debugger and opens the client in your default browser when it is ready. Stop the debug session to stop the server.

On macOS, `zsh "client/Start Horizon.command"` also starts the server and opens the browser.

## Connect djay

In djay Pro → Settings → Advanced, configure:

| Setting | Value |
| --- | --- |
| OSC destination IP | 127.0.0.1 |
| OSC destination port | 9000 |
| Incoming OSC request port | 9001 |

Start OSC sending, then open Horizon. The app starts in **Follow djay** mode. Horizon follows the crossfader endpoints: fully left selects Deck 1, fully right selects Deck 2, and every position between them retains the current song—even if its deck pauses. A 0.001 tolerance handles endpoint rounding. The last followed deck persists across page reloads; before an endpoint is observed, the saved deck (initially Deck 1) is retained. This assumes normal two-deck routing, not custom assignments or an external mixer. Missing crossfader data never triggers a playback-based handoff. The page shows connection details under **OSC connection setup & diagnostics**.

The local Node server receives OSC over UDP and pushes snapshots to the browser using Server-Sent Events. All sockets bind to the Mac loopback address. It requests `/djay/request/dumpAll` on startup, browser connection, observed track replacement, recovery, and every five seconds. A central limiter prevents requests less than 1.1 seconds apart. No playback, key, mixer or other DJ controls are sent.

Title, current tempo, key, playback state, position, bar and beat are reported from djay. The large key is transposed for the selected saxophone. The app prefers `/playback/key` if available and labels it as a reported playback key. This address was observed in the user's live build on 19 October 2026; response to pitch-shifting has not been independently verified. Key mapping follows the PDF's alternating major/relative-minor encoding. Unknown codes remain unknown.

The page suspends its preview when the selected deck has no fresh position, the stream is stale, or loop state is active/unknown. It follows reported position directly, including seeks, without estimating forward motion through a lost connection. Browser playback controls are disabled in Follow djay mode, and the browser audio is paused.

## Add a live waveform

OSC does **not** transmit waveform samples or build/drop locations.

1. Select **Rehearsal**.
2. In **Set up**, load the exact same local audio edit that is loaded in djay. Browser-supported files up to 150 MB and 30 minutes are supported by this initial decoder. Long DJ sets can still supply live OSC metadata, but are beyond the current waveform loader's limit.
3. Optionally enter build/drop positions as `m:ss`, `m:ss.s`, or seconds. These are manual annotations, not detected sections.
4. Return to **Follow djay**, check that the automatically followed track is the correct one, and click **Confirm matching audio**.
5. The app checks duration within two seconds. Your confirmation establishes identity; similar duration is not proof that two files match. It never automatically matches a title to a file.

The waveform then follows djay's reported source position without playing duplicate audio. It is labeled in **track seconds**: tempo changes alter elapsed listening time, so the current view does not claim a tempo-adjusted arrival countdown. Live estimated bar countdowns are withheld; djay's reported current bar and beat still display. Looping suspends forward preview rather than implying the track will advance beyond the loop.

Automatically switching decks, receiving a changed title/duration or unload, or reconnecting after a long stream gap detaches matching audio and markers. UDP is unordered and the protocol has no track IDs or atomic snapshot marker, so this is best-effort invalidation. Reconfirm after any ambiguous track replacement.

## Rehearsal

Rehearsal offers a silent demo or playback of a local audio file. Key, mode, tempo, beat-grid start and markers are entered manually. Bar counts assume constant tempo and 4/4. Select alto/baritone (E-flat), tenor/soprano (B-flat), or concert pitch. Space plays/pauses and arrow keys seek when no form control has focus; F enters full screen. Full-screen behavior depends on the browser.

Instrument, preview length and volume persist. Audio, markers and manual matching are session-only. After reloading, prepare audio again. Files are decoded in the browser and are not uploaded.

## Verification and implementation

Run `npm test` for parser/reducer and isolated loopback bridge tests. Tests use UDP ports 19010 and 19011 and never send fixtures to the production receiver or djay. Current test coverage includes nested OSC bundles, malformed input, unknown keys, track unload/replacement, per-deck fields, dump throttling and stale-state detection.

- `server.mjs`: loopback HTTP server, status, refresh and SSE routes.
- `bridge.mjs`: UDP receiver, bounded diagnostics, freshness and state refresh.
- `osc.mjs`: OSC message/bundle parser and documented-address reducer.
- `app.js`, `index.html`, `styles.css`: stage display, rehearsal and live modes.
- `music.js`: instrument transposition and time/beat helpers.

Default ports can be changed with `PORT`, `OSC_PORT`, and `DJAY_PORT`; the in-app diagnostics show the effective values. Only one server should own the production UDP receiver. No cloud hosting, analytics, or external dependencies.
