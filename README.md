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

## Website

The promotional site lives in [`site/`](site/) and deploys to GitHub Pages at https://maestro.alanocinneide.com/ on every push to `main` that touches it. It reuses the design tokens, mark and the client's `music.js`, so it stays in step with the apps.

```sh
npm --prefix site start
```

Open http://localhost:4180. The live demo is a simulated set; no djay connection is needed.

## Project docs

- [Technical setup guide](docs/setup-guide.md): bridge startup, plugin QR codes, phone access and troubleshooting.
- [Next steps](docs/next-steps.md): shipping the bridge as a companion app the plugin can start, release housekeeping, lower cue latency.
- [Project description](docs/project-description.txt)
- [djay Pro OSC specification v4](docs/djay-pro-osc-specification-v4.pdf)

## Shared design and themes

Both apps use the [Maestro design system](design/README.md), with shared brand assets and generated web/JUCE theme tokens. Use the header's **Light mode / Dark mode** button to switch appearance. Both default to dark and remember the selection. Node.js 18+ is also required when configuring the plugin to verify shared assets.

## Website custom domain

GitHub Pages serves the promotional site at `https://maestro.alanocinneide.com/`. Cloudflare manages the DNS-only `maestro` CNAME pointing to `kenneide.github.io`. GitHub Pages settings associate that hostname with this repository; the Actions deployment does not need a repository `CNAME` file. The existing website workflow continues to publish relevant pushes to `main`. Enable Enforce HTTPS when GitHub has issued the domain certificate.

Only the explicitly copied public website files are deployed. The website includes the simulated demo and presentation; the local djay/OSC bridge and Audio Unit are not hosted services.


## Production hosting and updates

The public website is https://maestro.alanocinneide.com/, hosted by the GitHub-connected Cloudflare Pages project `maestro`. Push to this repository’s `main` branch to trigger an automatic Cloudflare build and deployment; no dashboard upload is needed. The build command is `npm run check && npm run build (root directory: site)`, and only `site/_site` is published. Cloudflare manages custom-domain certificates and HTTP-to-HTTPS redirects. Check the Cloudflare status on the GitHub commit before treating an update as live. Existing GitHub Pages workflows remain as a fallback; production DNS points to Cloudflare. Do not change mail records when maintaining website DNS.
