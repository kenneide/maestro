# Maestro Cue

An Audio Unit effect for djay Pro that sends performance cues to the musician. The DJ flips a red/green light. The plugin sends it over OSC to the [Maestro client](../client/README.md), which shows it on stage. Audio passes through unchanged.

## Build

You need Xcode and CMake 3.22+. CMake downloads JUCE 8.0.15 into `plugin/build/_deps` on first configure. Nothing is vendored.

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

This builds a universal (Apple silicon + Intel) Release in `plugin/build-dist`. It then writes `plugin/dist/MaestroCue-<version>-macOS.zip`. The zip contains the AU v2 component, the app with the embedded AUv3, install and uninstall scripts, and a `READ ME.txt` for the recipient. The version comes from `project(... VERSION ...)` in `CMakeLists.txt`.

The package is ad-hoc signed, not notarized. The recipient must open `Install Maestro Cue.command` with right-click → Open the first time. The installer copies the plugin to `~/Library/Audio/Plug-Ins/Components` and the app to `~/Applications`. It also clears the download quarantine, refreshes the Audio Unit cache, registers the AUv3 and runs `auval`. A warning-free install would need a Developer ID certificate and notarization.

## Use in djay Pro

1. Start Maestro: `npm --prefix client start`.
2. In djay Pro, open the audio FX / plugin slot and load **Kenneide: Maestro Cue**. Use the AU v2 or AUv3 version, whichever djay lists.
3. Click the big button, or press Space while the plugin window has focus, to switch between **HOLD** (red) and **PLAY** (green).
4. Optional: MIDI-map the plugin's **Cue** parameter to a controller button.

The standalone app also works as a sender without djay, which is useful for rehearsal and testing. In VS Code, select **Run plugin (standalone)** in Run and Debug and press **F5**. This builds the Debug standalone app and launches it under the debugger. It needs the CodeLLDB extension.

## OSC contract

| Address | Args | Sent |
| --- | --- | --- |
| `/maestro/cue` | `s` `"red"` or `"green"` | On every change, and resent every second as a heartbeat |

The destination is fixed at `127.0.0.1:9000` in this iteration. That is the same port djay's own OSC uses, and the Maestro bridge receives both. Maestro shows **NO CUE SIGNAL** when it has not received a heartbeat for 3 seconds.

The plugin never sends cues from the audio thread. Parameter changes, including host automation, set a flag. A 30 Hz message-thread timer then sends the cue.

## Files

- `CMakeLists.txt`: fetches JUCE and defines the AU, AUv3 and Standalone targets.
- `Source/PluginProcessor.*`: the pass-through processor, the `Cue` parameter, and the OSC sender and heartbeat.
- `Source/PluginEditor.*`: the red/green toggle UI.

## Appearance

The header theme button switches between dark and light modes and remembers the selection separately from DAW automation/state. Shared assets and token generation are documented in the [design system](../design/README.md). Node.js 18+ is required at CMake configuration time to check generated assets.
