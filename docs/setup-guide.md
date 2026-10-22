# Maestro technical setup guide

Applies to the current repository implementation. Verified against the client, plugin and VS Code launch configuration on 22 October 2026.

## Required components

A working setup has four parts:

| Component | Runs on | Responsibility |
| --- | --- | --- |
| djay Pro | DJ's Mac | Plays audio and sends track, key, tempo and playback information over OSC |
| Maestro Cue Audio Unit | Inside djay Pro on the DJ's Mac | Sends Stop / Ready / Play cues and waveform measurements |
| Maestro Node server and OSC bridge | Mac with the Maestro repository | Receives OSC and serves the musician web app |
| Musician web app | Phone, tablet or browser | Displays the information received through the Mac bridge |

**Loading the plugin does not start the Node server. Scanning the plugin QR code does not start it either.** The QR is a link to the server and can appear even when that server is stopped.

The recommended arrangement is djay, the plugin and the Node server on the same Mac, with the musician's phone connected to that Mac over the same Wi-Fi. The phone may belong to anyone. It needs no Node installation or Maestro source files.

## Prerequisites

- A Mac with djay Pro and Maestro Cue installed and available in djay's Audio Unit effect list.
- The Maestro repository on the Mac running the bridge, with Node.js 18 or newer. The client needs no dependency installation.
- A phone or tablet with a browser and access to the same local network as the bridge Mac.
- A network that permits communication between devices. Guest Wi-Fi can isolate clients even when the network name matches.

Check Node in Terminal with `node --version`. For plugin installation or building, see the [plugin README](../plugin/README.md). Installing only the plugin package does not install or launch the Node bridge.

## Standard setup: DJ Mac and musician phone

### 1. Start the bridge with phone access

Open Terminal in the Maestro repository root and run:

```sh
npm --prefix client run start:lan
```

Alternatively, in VS Code choose **Run client — iPhone/iPad** under Run and Debug, then press **F5**. This launch mode also supports other phones with a browser.

Keep the Terminal process or VS Code debug session running throughout the performance. Allow incoming Node connections if macOS prompts.

The server prints a local URL and one or more phone URLs, for example:

```text
Maestro is ready: http://localhost:4173
Open on iPhone/iPad: http://192.168.125.190:4173
```

Use the address printed by the current run. `192.168.125.190` was this project's Mac address during setup and is an example, not a fixed Maestro address. DHCP or a network change can change it.

The `start:lan` command configures:

| Setting | Value | Effect |
| --- | --- | --- |
| `HTTP_HOST` | `0.0.0.0` | Makes the web app reachable on the Mac's network interfaces |
| `OSC_HOST` | `0.0.0.0` | Receives OSC through loopback and LAN interfaces |
| `DJAY_HOST` | Empty | Disables outgoing state requests to djay |

In this mode djay must actively stream OSC updates. For this same-Mac arrangement, you can also enable state requests while keeping phone access:

```sh
OSC_HOST=0.0.0.0 HTTP_HOST=0.0.0.0 DJAY_HOST=127.0.0.1 npm --prefix client start
```

Use one launch command at a time. Stop an existing server with **Ctrl+C**, or stop its VS Code debug session, before switching modes.

### 2. Configure djay Pro OSC

In **djay Pro → Settings → Advanced**, configure:

| djay setting | Value for the standard setup |
| --- | --- |
| OSC destination IP | `127.0.0.1` |
| OSC destination port | `9000` |
| Incoming OSC request port | `9001` |

Enable/start OSC sending. Load and play a track to check live data.

These addresses refer to the bridge on the same Mac. Do not put the musician phone's address into djay's OSC destination. The phone receives web updates from the bridge, rather than djay's UDP messages directly.

### 3. Configure Maestro Cue

Load **Kenneide: Maestro Cue** in a djay Audio Unit effect slot. Open the plugin's gear button and set **CONNECTION**:

| Plugin field | Value for the standard setup |
| --- | --- |
| Destination host / SEND TO | `127.0.0.1` |
| OSC PORT | `9000` |
| WEB PORT | `4173` |

Press **Apply** or Return. Existing djay sessions can restore previously saved destinations, so verify the applied values rather than assuming the defaults.

The OSC and web ports serve different purposes. Port `9000` receives plugin/djay data. Port `4173` serves the phone page. Setting WEB PORT changes the QR URL; it does not configure or start the server.

For a waveform, audio must pass through the plugin's effect slot. Cue controls do not require a waveform to be present.

### 4. Connect the musician's phone

1. Connect the phone to the same Wi-Fi as the bridge Mac.
2. Open **Settings → MUSICIAN APP** in the plugin.
3. Check the readable URL beside the QR. It should match a phone URL printed by the server, including the web port.
4. If **LOCAL ADDRESS** appears, select the Mac interface reachable from the phone, usually its Wi-Fi IPv4 address. Reopen plugin Settings after a network change to refresh the address list.
5. Scan the QR with the phone camera and open the link. If needed, type the printed server URL into the browser instead.

Example of a complete phone URL:

```text
http://192.168.125.190:4173/
```

Include `http://` and `:4173`. A bare IP uses the browser's default web port, which is not Maestro's default port. `localhost` or `127.0.0.1` on the phone refers to the phone itself.

With a loopback plugin destination, the QR substitutes a local LAN address from the plugin's Mac. With a remote destination, it uses that destination host. The QR does not test whether the URL is reachable or whether the Node server is running.

On iPhone/iPad, Safari's **Share → Add to Home Screen** optionally installs a full-screen shortcut. The Mac bridge must still run each time. Keep the phone awake using its Auto-Lock settings or Guided Access; the current plain-HTTP setup cannot rely on the browser's HTTPS-only wake-lock feature.

### 5. Verify before performing

- The phone page opens using the LAN URL.
- Load/play a track in djay. Confirm title, BPM and key arrive in the web app.
- In web app **Settings**, choose the musician's instrument key: C, B-flat, E-flat or F. This choice is stored in that browser.
- Click the plugin cue panel to cycle **Stop → Ready (next Play) → Play → Ready (next Stop) → Stop**. Confirm each state on the phone.
- Move the crossfader fully to each end to check deck following. During a blend, Maestro retains its current deck until the opposite endpoint. The opposite deck's preview is not a guaranteed next selection.
- Open **Debug** in the web app if data is missing. Check receiver status, incoming packet counts, recent OSC addresses and cue diagnostics. Cue packets and djay track packets are separate streams: one may work while the other fails.

The app displays the reported djay key transposed into the instrument's written key. It does not analyze the current chord progression or determine the combined key of a blend. Response of the reported playback key to djay pitch shifting remains unverified.

## Choosing the correct launch mode

| Launch option | OSC receiver | Web app | Phone access |
| --- | --- | --- | --- |
| `npm --prefix client start` / **Run client** | Loopback only | Loopback only | No |
| **Run client — Wi-Fi** | LAN and loopback | Loopback only | No |
| `npm --prefix client run start:lan` / **Run client — iPhone/iPad** | LAN and loopback | LAN and loopback | Yes |
| `client/Start Maestro.command` | Loopback by default | Loopback by default | No, unless LAN environment variables were supplied |

**Run client — Wi-Fi** means receiving OSC from another computer. It does not expose the web page to a phone. The promotional website, its simulated demo and the presentation are also separate from the live musician app.

## Optional: bridge on a second Mac

Use this only when the bridge runs on a different Mac from djay and the plugin.

1. Start `npm --prefix client run start:lan` on the bridge Mac.
2. Set djay's OSC destination to the **bridge Mac's LAN IPv4 address**, port `9000`, and start sending.
3. Set the plugin destination to that same bridge Mac address, OSC PORT `9000` and WEB PORT `4173`. Press Apply.
4. Connect the phone to the same network and scan the plugin QR. It should point to the bridge Mac.
5. Allow local-network access for djay or Maestro Cue if macOS asks, and incoming connections for Node on the bridge Mac.

The ordinary LAN mode receives passively. To enable state requests to the DJ Mac, set `DJAY_HOST` to the DJ Mac's address on the bridge launch command and keep djay's incoming request port matched to `DJAY_PORT` (default `9001`).

Use one DJ source at a time. The bridge does not isolate data from multiple senders.

## Troubleshooting

| Symptom | Checks and corrective action |
| --- | --- |
| QR is visible but phone cannot open the page | The QR does not prove the server is running. Start the bridge in LAN mode and compare the QR URL with its printed phone URL. |
| Page works on Mac at localhost but not on phone | Check `HTTP_HOST`: the normal launch and **Run client — Wi-Fi** serve only loopback. Restart using `start:lan`. |
| Neither localhost nor the phone URL opens | Confirm the Node server started successfully and remains running. Check Terminal for errors. Running djay and the plugin alone is insufficient. |
| Phone URL times out despite a running LAN server | Confirm the current IP, matching Wi-Fi and macOS firewall permission for Node. Guest/client isolation or a VPN can prevent the route. Test on a network that permits device-to-device traffic. |
| Browser tries HTTPS or reports a connection failure | Enter the full printed `http://<mac-ip>:4173/` URL explicitly. The server currently serves HTTP. |
| Page shows `Local access only` | The requested host/port is not allowed. Use the current printed IPv4 URL in LAN mode. Arbitrary DNS aliases are not automatically accepted. |
| Page loads but track/key/BPM remain empty | Enable djay OSC sending and check destination IP/UDP port. In passive LAN mode there are no state requests. Inspect `/djay/...` messages in Debug. |
| Track data works but cues do not | Check the loaded plugin's applied host and OSC port. Inspect `/maestro/cue` in Debug and cycle the plugin cue buttons. |
| Cues work but track data does not | Plugin OSC is arriving, but djay's separate stream may be disabled or misdirected. Check djay OSC settings. |
| Cue unexpectedly reads Stop | Stop is also the display's fallback when the cue heartbeat expires or the bridge connection drops. Check diagnostics before interpreting it as a deliberate DJ cue. |
| Waveform is flat | Confirm audio passes through the plugin and waveform messages arrive. The waveform is separate from djay metadata and cue delivery. |
| HTTP port `4173` or UDP port `9000` is already in use | Stop the old Maestro process before restarting. An HTTP page can exist while the UDP receiver has failed, so also check Debug receiver errors. |
| QR still contains an old address or wrong port | Reopen plugin Settings, check LOCAL ADDRESS and applied CONNECTION values, and confirm the current server address. A saved session can restore old values. |

### Read-only diagnostic commands

Run these on the bridge Mac. They inspect the running service without sending cues or changing djay playback:

```sh
# Check the server locally.
curl http://127.0.0.1:4173/api/status

# Check the LAN endpoint; replace the example with the current printed IP.
curl http://192.168.125.190:4173/api/status

# Inspect web and OSC listeners.
lsof -nP -iTCP:4173 -sTCP:LISTEN
lsof -nP -iUDP:9000
```

The status response includes `ready`, `error`, `receiveHost`, `receivePort`, `requestHost`, `requestsEnabled`, `incomingPackets`, `recentMessages`, `cue` and `pageUrls`. `ready: true` confirms the UDP receiver bound successfully. Overall `status` tracks djay packets, not cue heartbeats; a `waiting` status can coexist with working plugin cues.

A successful LAN curl on the Mac confirms the endpoint there. The phone must still have a working route to it.

## Port reference and custom configuration

| Direction | Protocol / default port | Purpose |
| --- | --- | --- |
| djay and plugin to bridge | UDP `9000` | OSC metadata, cues and waveform points |
| Bridge to djay, when enabled | UDP `9001` on DJ Mac | `/djay/request/dumpAll` state requests |
| Phone to bridge | HTTP over TCP `4173` | Web app, status and Server-Sent Events |

Server environment variables are `PORT`, `HTTP_HOST`, `OSC_PORT`, `OSC_HOST`, `DJAY_PORT` and `DJAY_HOST`. Changing the server web `PORT` requires matching the plugin WEB PORT. Changing `OSC_PORT` requires matching both djay's destination port and the plugin OSC PORT. `0.0.0.0` is a bind address, not an address to enter on the phone.

LAN mode has no login and serves live track data to devices that can reach the Mac. Use a trusted local network. It does not require a cloud account or router port forwarding.

## Each-session checklist

1. Join the intended network and start the bridge in LAN mode.
2. Verify djay OSC sending and the plugin's saved destination settings.
3. Compare the QR URL with the server's current phone URL.
4. Connect the musician's phone, choose its instrument key and keep its screen awake.
5. Test live track data and the complete cue cycle before the set.
6. Keep the Mac awake and the bridge process running. After a network/IP change, reconnect using the new URL and update any saved home-screen shortcut.

## Implementation references

- [Client usage and limitations](../client/README.md)
- [Plugin installation, controls and QR behavior](../plugin/README.md)
- [Launch configurations](../.vscode/launch.json)
- [Server bindings and routes](../client/server.mjs)
- [OSC bridge and diagnostics](../client/bridge.mjs)
- [QR URL construction](../plugin/Source/MusicianLink.h)
