# djay Pro Maestro

A hackathon project connecting DJs and live musicians through a plugin and web client.

Maestro aims to give musicians visibility into the current track's key, upcoming tracks, and performance cues (red light / green light), helping them improvise alongside a DJ's mixes and transitions.

## Status

Early MVP development. The [Maestro web client](client/README.md) includes a local OSC bridge for djay Pro. The [Maestro Cue plugin](plugin/README.md) is an Audio Unit for djay Pro. It sends red/amber/green performance cues (Stop / Ready / Play) to Maestro.

## Run the client

Requires Node.js 18+. No dependency installation is needed.

```sh
npm --prefix client start
```

Open http://localhost:4173. In VS Code, select **Run client** in Run and Debug and press **F5** to start the server and open the browser automatically.

```sh
npm --prefix client run check
npm --prefix client test
```

For OSC from another computer, use **Run client — Wi-Fi** and have the sender target your Mac’s LAN IP on UDP port 9000. See the [client README](client/README.md) for Wi-Fi diagnostics, djay OSC setup, and rehearsal mode.

## Build the plugin

```sh
cmake -S plugin -B plugin/build -G Xcode
cmake --build plugin/build --config Release
```

See the [plugin README](plugin/README.md) for installation and djay setup.

## Project docs

- [Project description](docs/project-description.txt)
- [djay Pro OSC specification v4](docs/djay-pro-osc-specification-v4.pdf)

## Shared design and themes

Both apps use the [Maestro design system](design/README.md), with shared brand assets and generated web/JUCE theme tokens. Use the header's **Light mode / Dark mode** button to switch appearance. Both default to dark and remember the selection. Node.js 18+ is also required when configuring the plugin to verify shared assets.
