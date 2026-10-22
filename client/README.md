# Maestro

For the complete DJ Mac and musician phone setup, including plugin QR codes and troubleshooting, see the [technical setup guide](../docs/setup-guide.md).

A local musician companion for performing musicians. Run the browser on your Mac, or [install it on an iPhone or iPad](#install-on-iphone-or-ipad) as a home-screen app.

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

Start OSC sending, then open Maestro. The app always follows djay. Maestro follows the crossfader endpoints: fully left selects Deck 1, fully right selects Deck 2, and every position between them retains the current song—even if its deck pauses. A 0.001 tolerance handles endpoint rounding. The last followed deck persists across page reloads; before an endpoint is observed, the saved deck (initially Deck 1) is retained. This assumes normal two-deck routing, not custom assignments or an external mixer. Missing crossfader data never triggers a playback-based handoff. The page shows connection details under **Debug** at the bottom of the page.

The local Node server receives OSC over UDP and pushes snapshots to the browser using Server-Sent Events. By default, all sockets bind to the Mac loopback address. The Wi-Fi launch option below exposes only the UDP receiver; the browser server remains local. It requests `/djay/request/dumpAll` on startup, browser connection, observed track replacement, recovery, and every five seconds. A central limiter prevents requests less than 1.1 seconds apart. No playback, key, mixer or other DJ controls are sent.

Title, current tempo, key, playback state, position, bar and beat are reported from djay. The large key is transposed for the instrument key selected in **Settings**. The app prefers `/playback/key` if available and labels it as a reported playback key. This address was observed in the user's live build on 19 October 2026; response to pitch-shifting has not been independently verified. Key mapping follows the PDF's alternating major/relative-minor encoding. Unknown codes remain unknown.

Track time follows reported djay position directly, including seeks. Missing or stale position leaves the timeline area empty; the browser does not estimate forward motion. Playback stays under djay’s control.

## Receive OSC from another computer over Wi-Fi

1. Connect both computers to the same Wi-Fi.
2. Stop the existing server/debug session, then select **Run client — Wi-Fi** in VS Code and press **F5**. Only one process can own UDP port 9000.
3. Open **Debug** at the bottom of the page. Give your colleague one of the listed LAN destination addresses and UDP port **9000**. Your Wi-Fi address at setup was `192.168.125.190`; it can change. `127.0.0.1` on his computer points back to his own computer.
4. Have him send djay-compatible OSC to that address. For performer cues, he enters the same address and port in the Maestro Cue plugin's **SEND TO** field. Open **Recent OSC messages** to see timestamps, sender IP/port, addresses, and arguments. The latest 100 entries are kept in memory, newest first; long arguments are shortened. Unsupported addresses and decode errors are visible even when they cannot drive the stage display.
5. Supported `/djay/...` fields update the existing live display. Live position requires `song/loaded = 1` and fresh `playback/time` for the followed deck.

The Wi-Fi configuration passively receives messages from any sender that can reach this Mac. Use one DJ source at a time; sources are not isolated. No messages are saved to disk. If no packets arrive, verify the destination, allow incoming Node traffic if macOS prompts, and check whether the Wi-Fi isolates devices from each other.

To start the same configuration from the repository root:

```sh
OSC_HOST=0.0.0.0 DJAY_HOST='' npm --prefix client start
```

An empty `DJAY_HOST` disables outgoing state requests and **Refresh state**. The colleague must stream updates. If his sender supports `/djay/request/dumpAll`, set `DJAY_HOST` to his IPv4 address and `DJAY_PORT` to his incoming request port (default 9001). The normal local launch keeps requesting state from `127.0.0.1:9001`.

## Install on iPhone or iPad

The iPhone or iPad shows the page. The Node server keeps running on a Mac on the same Wi-Fi, because iOS can't receive djay's UDP OSC. That Mac can be the DJ's Mac beside djay; the Maestro Cue plugin's default `127.0.0.1:9000` then works unchanged.

1. Connect the Mac and the iPhone/iPad to the same Wi-Fi.
2. Stop any running server. In VS Code, select **Run client — iPhone/iPad** and press **F5**, or run `npm --prefix client run start:lan`. If macOS asks whether Node can accept incoming connections, choose **Allow**.
3. The terminal prints `Open on iPhone/iPad: http://<mac-ip>:4173`. The address also appears under **Debug** at the bottom of the page. Open it in **Safari** on the device.
4. Tap **Share → Add to Home Screen → Add**. Launch Maestro from its icon: it opens full screen without Safari's toolbars.
5. Keep the screen on during a set: Settings → Display & Brightness → **Auto-Lock → Never** (or use Guided Access). Browsers only allow a page to hold the screen awake over HTTPS, and this local server is plain HTTP.

If the Mac's Wi-Fi address changes, open the new address in Safari and add it to the Home Screen again. In this mode, anyone on the same Wi-Fi can open the page and see the live track data. Requests for other host names are refused, and the default `npm --prefix client start` remains reachable only from the Mac itself.

## Performer cue

The [Maestro Cue plugin](../plugin/README.md) sends `/maestro/cue` with `"red"`, `"green"`, or `"amber"` followed by the state it is heading to (`"amber" "green"` or `"amber" "red"`) to the same receive port as djay. It resends the cue every second. Maestro shows **Play** in green, **Stop** in red, and **Ready** in amber with **Next: Play** or **Next: Stop** underneath, so musicians can prepare before the change. Missing or expired cues and bridge disconnections show **Stop**; cue connection details are available in **Debug**. Cue messages appear in the diagnostics message log but do not count as djay data.

## Waveform

The AUDIO section shows a waveform scrolling over about 8 seconds. It is drawn from `/maestro/wave` messages the Maestro Cue plugin sends: one `seq`, `min`, `max` point per 25 ms of audio. The plugin measures whatever djay routes through it, usually the master mix rather than the followed deck. Points are played out at a steady 25 ms per point, about 300 ms behind the newest one, so the strip scrolls smoothly even though updates arrive in batches. With no plugin, or no points for a second, it rests as a flat line. Waveform points are not added to the diagnostics message log; **Debug** shows how many have arrived. On very short landscape screens the waveform is hidden. With **Reduce motion** turned on, it updates in steps instead of animating.

## Musician settings

Open **Settings** to choose your instrument key: **C**, **B♭**, **E♭**, or **F**. Written keys transpose concert pitch by 0, 2, 9, or 7 semitones respectively. Changes apply immediately and persist in this browser; existing saxophone preferences migrate automatically. The default is E♭. The followed deck also persists.

The viewport-sized main view has matching uppercase section headings and divider lines: **CUE** for Play / Stop, **AUDIO** for the deck number, track title/artist and a read-only timeline, and **MUSIC** for balanced KEY and BPM columns with beat dots. A muted **Preview** row beneath the timeline shows the opposite deck’s title/artist, transposed key, BPM, and recent Playing/Paused state—even during a blend when both decks play. It is a preview of the other loaded track, not a guaranteed next selection. Missing fields are omitted; unloaded tracks and stale or disconnected streams hide the row. Playback-state labels expire after 6.5 seconds to accommodate the five-second state refresh. Long track names are truncated to keep the stage compact. Connection status and the Debug toggle sit at the bottom; expanded diagnostics scroll within an overlay panel. **F** enters full screen when no control or dialog has focus. Full-screen behavior depends on the browser.

**Debug** is collapsed on each page load. Expand it for connection instructions, receiver and crossfader diagnostics, refresh, and the filterable recent OSC message log. Rehearsal, audio loading, waveforms, manual markers, and browser playback are no longer part of the client.

## Verification and implementation

Run `npm test` for parser/reducer and isolated loopback bridge tests. Tests use UDP ports 19010 and 19011 plus OS-assigned ephemeral ports and never send fixtures to the production receiver or djay. LAN tests send to this Mac’s own IPv4 interface and skip when none is available. Current test coverage includes nested OSC bundles, malformed input, unknown keys, track unload/replacement, per-deck fields, dump throttling and stale-state detection.

- `server.mjs`: loopback HTTP server, status, refresh and SSE routes.
- `bridge.mjs`: UDP receiver, bounded diagnostics, freshness and state refresh.
- `osc.mjs`: OSC message/bundle parser and documented-address reducer.
- `app.js`, `index.html`, `styles.css`: live musician display.
- `music.js`: instrument transposition and time/beat helpers.

Default ports can be changed with `PORT`, `OSC_PORT`, and `DJAY_PORT`. `HTTP_HOST=0.0.0.0` serves the page to other devices on the Wi-Fi (default `127.0.0.1`). `OSC_HOST` controls the UDP bind address (default `127.0.0.1`); `DJAY_HOST` controls the request destination (default `127.0.0.1`, empty disables requests); the in-app diagnostics show the effective values. Only one server should own the production UDP receiver. No cloud hosting, analytics, or external dependencies.

## Appearance

Maestro defaults to dark mode. Open the gear icon for **Settings** and use the sun/moon SVG button under **Appearance** to change theme. Your selection is remembered in this browser. Existing Horizon musician preferences migrate automatically. The [shared design system](../design/README.md) contains the source colors, spacing, typography, and brand assets used by the web client and plugin.
