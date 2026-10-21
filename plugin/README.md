# Maestro Cue

An Audio Unit effect for djay Pro that sends performance cues to the musician. The DJ steps a red/amber/green light through Stop → Ready → Play → Ready → Stop. The plugin sends it over OSC to the [Maestro client](../client/README.md), which shows it on stage. Audio passes through unchanged.

## Build

You need Xcode and CMake 3.22+. CMake downloads JUCE 8.0.15 into `plugin/build/_deps` on first configure. The small MIT-licensed QR encoder is vendored under `ThirdParty/qrcodegen`; its upstream revision and license are recorded there.

```sh
cmake -S plugin -B plugin/build -G Xcode
cmake --build plugin/build --config Release
```

The build produces these outputs:

| Format | Output | Installed to |
| --- | --- | --- |
| AU v2 | `Maestro Cue.component` | `~/Library/Audio/Plug-Ins/Components` (copied automatically) |
| AUv3 | `Maestro Cue.appex` inside `Maestro Cue.app` | Registers when the app is launched once |
| Standalone | `Maestro Cue.app` | `plugin/build/MaestroCue_artefacts/Release/Standalone` |

Validate the AU v2 build with:

```sh
auval -v aufx Mcue Knde
```

Development builds are signed ad hoc. If djay refuses to load the AUv3 extension, sign it with an Apple Developer team.

## Package for another Mac

```sh
bash plugin/scripts/package.sh
```

In VS Code, you can instead select **Package plugin for sharing** in Run and Debug and press **F5**; when it finishes, Finder opens with the zip selected.

This builds a universal (Apple silicon + Intel) Release in `plugin/build-dist`. It then writes `plugin/dist/MaestroCue-<version>-macOS.zip`. The zip contains the AU v2 component, the app with the embedded AUv3, install and uninstall scripts, and a `READ ME.txt` for the recipient. The version comes from `project(... VERSION ...)` in `CMakeLists.txt`.

The package is ad-hoc signed, not notarized. The recipient must open `Install Maestro Cue.command` with right-click → Open the first time. The installer copies the plugin to `~/Library/Audio/Plug-Ins/Components` and the app to `~/Applications`. It also clears the download quarantine, refreshes the Audio Unit cache, registers the AUv3 and runs `auval`. A warning-free install would need a Developer ID certificate and notarization.

## Use in djay Pro

1. Start Maestro: `npm --prefix client start`.
2. In djay Pro, open the audio FX / plugin slot and load **Kenneide: Maestro Cue**. Use the AU v2 or AUv3 version, whichever djay lists.
3. Click the big button, or press Space while the main cue view has focus, to advance the cue: **Stop** (red) → **Ready** (amber, next Play) → **Play** (green) → **Ready** (amber, next Stop) → **Stop**. While Ready, the button shows **NEXT: PLAY** or **NEXT: STOP**.
4. Optional: MIDI-map the plugin's **Cue** parameter to a controller button.

The standalone app also works as a sender without djay, which is useful for rehearsal and testing. In VS Code, select **Run plugin (standalone)** in Run and Debug and press **F5**. This builds the Debug standalone app and launches it under the debugger. It needs the CodeLLDB extension.

## OSC contract

| Address | Args | Sent |
| --- | --- | --- |
| `/maestro/cue` | `s` `"red"` (Stop) or `"green"` (Play); `ss` `"amber"` plus `"green"` or `"red"` (Ready, heading to Play or Stop) | On every change, and resent every second as a heartbeat |
| `/maestro/wave` | `i` `seq`, `f` `min`, `f` `max`: lowest and highest sample of the mono mix in one 25 ms window, from -1 to 1. `seq` counts windows, so gaps stay in time | Each window, batched into one OSC bundle per 30 Hz tick |

Open the gear button for **Settings → CONNECTION**: enter the IP address (or hostname, such as `studio-mac.local`) and the **OSC PORT** of the computer running Maestro. **WEB PORT** is the musician app’s HTTP port (default **4173**), separate from the OSC port. Press **Apply** or Return to save all three values together. The default is `127.0.0.1:9000`, the same computer and the same port djay's own OSC uses; the Maestro bridge receives both. Each plugin instance saves its destination and web port with the djay session; older sessions use web port 4173. The last connection settings applied become the default for new instances. Invalid edits leave the applied settings and QR link unchanged. The footer shows **Sending to** or **Send failed** for the current destination. The musician app shows **Stop** when its cue heartbeat expires or the bridge disconnects.

To send to another computer, start Maestro there with **Run client — Wi-Fi**, then use one of the LAN addresses it lists under **Debug**, with port 9000. The first time cues go to another computer, macOS may ask whether djay (or Maestro Cue) can find devices on your local network. Choose **Allow**. To change it later, go to System Settings → Privacy & Security → Local Network.

The plugin never sends cues from the audio thread. Parameter changes, including host automation, set a flag. A 30 Hz message-thread timer then sends the cue.

## Open the musician app by QR

In **Settings → MUSICIAN APP**, scan the QR code to open `http://<destination-host>:<web-port>/`. The readable URL is shown beside it. Codes are generated locally and remain black on white in both themes.

If the OSC destination is `127.0.0.1` or `localhost`, the QR uses this Mac’s LAN IPv4 address instead: a phone’s localhost would point to the phone. If multiple addresses exist, choose the interface reachable by the musician under **LOCAL ADDRESS**. The selection is remembered locally and checked again each time Settings opens. Without a usable LAN address the QR is left empty.

Start Maestro on the destination Mac with `npm --prefix client run start:lan` and connect the musician’s device to the same network. This exposes the musician page and OSC receiver on that Mac’s LAN interfaces; the plugin itself does not start or reconfigure the server. The **Run client — Wi-Fi** launch exposes only OSC and is insufficient for phone access to the page. A QR code identifies the URL; it does not verify server reachability. A custom server `PORT` must match **WEB PORT**.

The gear toggles Settings; Escape returns to the main cue view. Space changes the cue only in the main view, so entering connection settings cannot accidentally cue a musician.

## Native tests

```sh
cmake --build plugin/build --config Debug --target MaestroCueTests
ctest --test-dir plugin/build -C Debug --output-on-failure
```

Tests use temporary preference files, never the user’s saved destinations. They cover QR links, interface filtering/selection, invalid settings, new-instance defaults, session round-trips and legacy web-port fallback, the four-step cue cycle, cue parameter labels and legacy text parsing, migration of sessions saved with the old two-state cue, and audio passthrough. On macOS an independent Core Image test decodes the generated QR and verifies its URL. To write a QR decoding fixture, run the test executable with a PNG output path as its first argument.

## Files

- `CMakeLists.txt`: fetches JUCE and defines the AU, AUv3 and Standalone targets.
- `Source/PluginProcessor.*`: the pass-through processor, the `Cue` parameter, and the OSC sender and heartbeat.
- `Source/PluginEditor.*`: the red/amber/green cue UI.

## Appearance

The sun/moon SVG button under **Settings → APPEARANCE** switches between dark and light modes and remembers the selection separately from DAW automation/state. Shared assets and token generation are documented in the [design system](../design/README.md). Node.js 18+ is required at CMake configuration time to check generated assets.
