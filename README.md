# djay Pro Maestro

A hackathon project connecting DJs and live musicians through a plugin and web client.

Maestro aims to give musicians visibility into the current track's key, upcoming tracks, and performance cues (red light / green light), helping them improvise alongside a DJ's mixes and transitions.

## Status

Early MVP development. The [Horizon web client](client/README.md) includes a local OSC bridge for djay Pro; plugin development is next.

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

## Project docs

- [Project description](docs/project-description.txt)
- [djay Pro OSC specification v4](docs/djay-pro-osc-specification-v4.pdf)
