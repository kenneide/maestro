# Next steps

Planned work after the ADE Lab Hackathon 2026 submission, written 22 October 2026. The main item is making the bridge something a DJ can install, rather than something run from this repository with Node.

## 1. Ship the bridge as a companion app the plugin can start

### Why

Today the musician app only works while the Node bridge (`client/server.mjs`, `bridge.mjs`, `osc.mjs`) runs from a checkout of this repository. A DJ who installs the Maestro Cue package gets a plugin whose QR code points at a server they don't have; see the [setup guide](setup-guide.md). To distribute Maestro, the bridge has to install with the plugin and start without a terminal.

The bridge has three jobs, and each needs a listening socket:

1. **Receive OSC over UDP on port 9000**: djay's track, key and position data, and the plugin's `/maestro/cue` and `/maestro/wave`.
2. **Request djay state over port 9001**: `/djay/request/dumpAll` on start, on reconnect and every five seconds, rate-limited.
3. **Serve the musician app on port 4173**: the static files, Server-Sent Events at `/api/events`, `/api/status` and `/api/refresh`, with the existing host and origin checks.

### Decision: run it in a menu-bar app, not inside the plugin

Running the bridge inside the Audio Unit was rejected:

- **Sandbox.** The AUv3 is sandboxed with `network.client` only (`plugin/CMakeLists.txt`) and can't open listening ports. The AU v2 runs inside djay under djay's own entitlements, which we neither control nor can rely on across djay updates.
- **Lifetime.** The bridge would stop whenever djay unloads or the DJ removes the effect, taking every musician's screen down.
- **Instances.** Two plugin instances would compete for the same ports.
- **Risk.** A network server inside the DJ's audio app adds failure modes to a live set.

Instead, `Maestro Cue.app`, which already contains the AUv3, becomes **Maestro**: a small menu-bar app that runs the bridge. The plugin checks whether the bridge is running and can start it.

### Architecture

```
djay Pro ──OSC :9000──▶ Maestro.app (menu bar) ──HTTP + SSE :4173──▶ musician's phone
   ▲  ◀─dumpAll :9001──┘        ▲
   │                            │ GET /api/status (status check)
   └── Maestro Cue AU ──OSC :9000┘   maestro://open (launch)
```

**Native bridge (C++/JUCE), inside the app:**
- UDP receive and OSC decoding with `juce_osc` (`OSCReceiver`). djay message handling ports from `client/osc.mjs` and `client/bridge.mjs`.
- `dumpAll` requests sent with `juce::DatagramSocket`, keeping the 1.1 s limiter and the 5 s refresh.
- A minimal HTTP/1.1 server: `juce::StreamingSocket`, or a vendored single-header server such as cpp-httplib (MIT, recorded under `plugin/ThirdParty` like qrcodegen). It needs:
  - static files embedded through `juce_add_binary_data`;
  - SSE fan-out every 100 ms, plus an immediate push when a cue arrives (see section 3);
  - the same `allowedHosts` and origin rules as `client/server.mjs`.
- Snapshot JSON identical to `bridge.snapshot()`, so `client/app.js` runs unchanged.

**Menu-bar app:**
- A status item showing the bridge state ("Receiving from djay", "Waiting for djay", "Port in use").
- The musician QR code, reusing `MaestroCueEditor::QrView` and `MusicianLink`.
- Choice of network interface, "Open musician app", "Launch at login" (`SMAppService`) and Quit.
- A `maestro://open` URL scheme so the plugin can launch the app.
- It keeps hosting the AUv3, so there is still one app to install.

**Plugin changes:**
- A bridge status row: "Maestro running" or "Start Maestro". The plugin polls `http://127.0.0.1:<webPort>/api/status`, an outgoing request its current `network.client` entitlement allows.
- **Start Maestro** opens `maestro://open`. If the host's sandbox blocks the launch, it tells the DJ to open Maestro from Applications instead.

### Phases

| Phase | Work | Done when |
|---|---|---|
| 0 · Spikes (½ day) | Check from the AU v2 and the AUv3 inside djay whether (a) `maestro://open` launches the app and (b) `GET 127.0.0.1:4173/api/status` succeeds. Check the firewall and Local Network prompts for a signed app that listens on 4173 and 9000. | The launch path is chosen and both results are recorded in this file |
| 1 · Native bridge (1–2 days) | Port the OSC receive, djay requests, snapshot, HTTP and SSE to C++ in a `MaestroBridge` library target. Add native tests mirroring `client/bridge.test.mjs` and `client/osc.test.mjs`, including host and origin rejection. | The existing web client works against the native bridge with djay; the native tests pass in `ctest` |
| 2 · Menu-bar app (1 day) | Turn the Standalone target into a status-item app, or add a dedicated app target that embeds the AUv3, with QR code, interface choice, launch at login and the URL scheme. | Installing and opening Maestro serves the musician app with no terminal |
| 3 · Plugin integration (½ day) | Add the bridge status row and the Start Maestro button to the editor, matching the redesigned layout. | The plugin shows the live bridge state and can start it, or guides the DJ |
| 4 · Distribution (1 day + Apple wait) | Developer ID signing, hardened runtime and notarization for the app, the AUv3 and the AU v2. Replace `plugin/scripts/package.sh`'s ad-hoc zip with a signed `.pkg` (component to `~/Library/Audio/Plug-Ins/Components`, app to `/Applications`) and a signed uninstaller. | A fresh Mac installs with no Gatekeeper warnings; `auval` passes; the musician app opens from the plugin's QR code |
| 5 · Docs and site | Update the setup guide, the READMEs and the website FAQ ("What do I need?") for the one-download install. | The setup guide describes install → open djay → scan |

The Node bridge stays as the development server and as the reference implementation until the native bridge passes the same tests. Then it is either removed or kept only for the browser-only demo.

### Alternative considered: bundle the Node bridge

Packaging `client/server.mjs` as a single executable (Node SEA or `bun build --compile`) that the app launches would reuse today's code and tests and take less than a day. It was set aside because:
- it adds roughly 60–100 MB;
- the nested runtime needs its own signing, hardened-runtime JIT entitlements and notarization;
- it keeps two languages in the shipped product.

It remains the fallback if the native port slips.

### Risks and open questions

- **djay sandbox:** whether a URL-scheme launch works from the AU inside djay (phase 0). The fallback is guidance text, which costs nothing.
- **Port conflicts:** another app on 9000 or 4173. The app must report this clearly and offer to change ports, keeping the plugin's destination and web port in sync with its settings.
- **First-run prompts:** "accept incoming connections" and Local Network access. Explain both in the app's first-run screen.
- **Mac App Store:** an App Store build is possible later (an app with the AUv3 and the bridge, sandboxed with `network.server` and `network.client`), but the AU v2 can't ship there. Decide after phase 4.

## 2. Release housekeeping

- Rebuild the shareable plugin package (`plugin/dist`). The current zip predates the redesigned editor.
- Update the GitHub Actions in `.github/workflows/pages.yml` to versions that run on Node 24 (`checkout`, `setup-node`, `configure-pages`, `upload-pages-artifact`, `deploy-pages`), to clear the deprecation notice.
- Replace the website placeholders: the Deck 2 preview track ("Golden Hour — Nova Lane"), the demo keys and BPMs, and the mock pricing.

## 3. Lower cue latency

Cues currently reach the phone in about 70–80 ms on typical Wi-Fi, a fraction of a beat. Most of that is batching rather than the network. Two small changes would bring it to about 20–30 ms:
- Push a snapshot to SSE clients as soon as a `/maestro/cue` message arrives, instead of waiting for the next 100 ms tick (`client/bridge.mjs`, and the native bridge in section 1).
- Send the cue from the plugin's message thread when the DJ clicks, instead of waiting for the next 30 Hz timer tick (`MaestroCueProcessor`).

After this, the How it works heading could say "in milliseconds".
