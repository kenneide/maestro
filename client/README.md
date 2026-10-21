# Maestro

A local musician companion for a saxophonist. Run the browser on your Mac and move it to the iPad extended display.

## Start

From the repository root, run:

```sh
npm --prefix client start
```

Open http://localhost:4173. Keep Terminal open and stop with Control-C. Node.js 18+ is required; there are no dependencies or installation step.

In VS Code, open the repository folder, select **Run client** in Run and Debug, and press **F5**. This starts the Node server under the debugger and opens the client in your default browser when it is ready. Stop the debug session to stop the server.

On macOS, `zsh "client/Start Maestro.command"` also starts the server and opens the browser.

## Connect djay

In djay Pro → Settings → Advanced, configure:

| Setting | Value |
| --- | --- |
| OSC destination IP | 127.0.0.1 |
| OSC destination port | 9000 |
| Incoming OSC request port | 9001 |

Start OSC sending, then open Maestro. The app starts in **Follow djay** mode. Maestro follows the crossfader endpoints: fully left selects Deck 1, fully right selects Deck 2, and every position between them retains the current song—even if its deck pauses. A 0.001 tolerance handles endpoint rounding. The last followed deck persists across page reloads; before an endpoint is observed, the saved deck (initially Deck 1) is retained. This assumes normal two-deck routing, not custom assignments or an external mixer. Missing crossfader data never triggers a playback-based handoff. The page shows connection details under **OSC connection setup & diagnostics**.

The local Node server receives OSC over UDP and pushes snapshots to the browser using Server-Sent Events. By default, all sockets bind to the Mac loopback address. The Wi-Fi launch option below exposes only the UDP receiver; the browser server remains local. It requests `/djay/request/dumpAll` on startup, browser connection, observed track replacement, recovery, and every five seconds. A central limiter prevents requests less than 1.1 seconds apart. No playback, key, mixer or other DJ controls are sent.

Title, current tempo, key, playback state, position, bar and beat are reported from djay. The large key is transposed for the selected saxophone. The app prefers `/playback/key` if available and labels it as a reported playback key. This address was observed in the user's live build on 19 October 2026; response to pitch-shifting has not been independently verified. Key mapping follows the PDF's alternating major/relative-minor encoding. Unknown codes remain unknown.

The page suspends its preview when the selected deck has no fresh position, the stream is stale, or loop state is active/unknown. It follows reported position directly, including seeks, without estimating forward motion through a lost connection. Browser playback controls are disabled in Follow djay mode, and the browser audio is paused.

## Receive OSC from another computer over Wi-Fi

1. Connect both computers to the same Wi-Fi.
2. Stop the existing server/debug session, then select **Run client — Wi-Fi** in VS Code and press **F5**. Only one process can own UDP port 9000.
3. Open **OSC connection setup & diagnostics**. Give your colleague one of the listed LAN destination addresses and UDP port **9000**. Your Wi-Fi address at setup was `192.168.125.190`; it can change. `127.0.0.1` on his computer points back to his own computer.
4. Have him send djay-compatible OSC to that address. For performer cues, he enters the same address and port in the Maestro Cue plugin's **SEND TO** field. Open **Recent OSC messages** to see timestamps, sender IP/port, addresses, and arguments. The latest 100 entries are kept in memory, newest first; long arguments are shortened. Unsupported addresses and decode errors are visible even when they cannot drive the stage display.
5. Supported `/djay/...` fields update the existing live display. Live position requires `song/loaded = 1` and fresh `playback/time` for the followed deck.

The Wi-Fi configuration passively receives messages from any sender that can reach this Mac. Use one DJ source at a time; sources are not isolated. No messages are saved to disk. If no packets arrive, verify the destination, allow incoming Node traffic if macOS prompts, and check whether the Wi-Fi isolates devices from each other.

To start the same configuration from the repository root:

```sh
OSC_HOST=0.0.0.0 DJAY_HOST='' npm --prefix client start
```

An empty `DJAY_HOST` disables outgoing state requests and **Refresh state**. The colleague must stream updates. If his sender supports `/djay/request/dumpAll`, set `DJAY_HOST` to his IPv4 address and `DJAY_PORT` to his incoming request port (default 9001). The normal local launch keeps requesting state from `127.0.0.1:9001`.

## Add a live waveform

OSC does **not** transmit waveform samples or build/drop locations.

1. Select **Rehearsal**.
2. In **Set up**, load the exact same local audio edit that is loaded in djay. Browser-supported files up to 150 MB and 30 minutes are supported by this initial decoder. Long DJ sets can still supply live OSC metadata, but are beyond the current waveform loader's limit.
3. Optionally enter build/drop positions as `m:ss`, `m:ss.s`, or seconds. These are manual annotations, not detected sections.
4. Return to **Follow djay**, check that the automatically followed track is the correct one, and click **Confirm matching audio**.
5. The app checks duration within two seconds. Your confirmation establishes identity; similar duration is not proof that two files match. It never automatically matches a title to a file.

The waveform then follows djay's reported source position without playing duplicate audio. It is labeled in **track seconds**: tempo changes alter elapsed listening time, so the current view does not claim a tempo-adjusted arrival countdown. Live estimated bar countdowns are withheld; djay's reported current bar and beat still display. Looping suspends forward preview rather than implying the track will advance beyond the loop.

Automatically switching decks, receiving a changed title/duration or unload, or reconnecting after a long stream gap detaches matching audio and markers. UDP is unordered and the protocol has no track IDs or atomic snapshot marker, so this is best-effort invalidation. Reconfirm after any ambiguous track replacement.

## Performer cue

The [Maestro Cue plugin](../plugin/README.md) sends `/maestro/cue` with `"red"` or `"green"` to the same receive port as djay. It resends the cue every second. Maestro shows a large red (hold) or green (play) light above the track. If no cue has arrived for 3 seconds, or the bridge disconnects, Maestro shows **NO CUE SIGNAL**. Cue messages appear in the diagnostics message log but do not count as djay data.

## Rehearsal

Rehearsal offers a silent demo or playback of a local audio file. Key, mode, tempo, beat-grid start and markers are entered manually. Bar counts assume constant tempo and 4/4. Select alto/baritone (E-flat), tenor/soprano (B-flat), or concert pitch. Space plays/pauses and arrow keys seek when no form control has focus; F enters full screen. Full-screen behavior depends on the browser.

Instrument, preview length and volume persist. Audio, markers and manual matching are session-only. After reloading, prepare audio again. Files are decoded in the browser and are not uploaded.

## Verification and implementation

Run `npm test` for parser/reducer and isolated loopback bridge tests. Tests use UDP ports 19010 and 19011 plus OS-assigned ephemeral ports and never send fixtures to the production receiver or djay. LAN tests send to this Mac’s own IPv4 interface and skip when none is available. Current test coverage includes nested OSC bundles, malformed input, unknown keys, track unload/replacement, per-deck fields, dump throttling and stale-state detection.

- `server.mjs`: loopback HTTP server, status, refresh and SSE routes.
- `bridge.mjs`: UDP receiver, bounded diagnostics, freshness and state refresh.
- `osc.mjs`: OSC message/bundle parser and documented-address reducer.
- `app.js`, `index.html`, `styles.css`: stage display, rehearsal and live modes.
- `music.js`: instrument transposition and time/beat helpers.

Default ports can be changed with `PORT`, `OSC_PORT`, and `DJAY_PORT`. `OSC_HOST` controls the UDP bind address (default `127.0.0.1`); `DJAY_HOST` controls the request destination (default `127.0.0.1`, empty disables requests); the in-app diagnostics show the effective values. Only one server should own the production UDP receiver. No cloud hosting, analytics, or external dependencies.

## Appearance

Maestro defaults to dark mode. The header's **Light mode / Dark mode** button remembers your selection in this browser. Existing Horizon musician preferences migrate automatically. The [shared design system](../design/README.md) contains the source colors, spacing, typography, and brand assets used by the web client and plugin.
