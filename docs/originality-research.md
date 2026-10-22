# Maestro originality research

Research date: 22 October 2026. Scope: public product pages, developer documentation and developer-supplied app listings, compared with this repository's MVP. This is a product-positioning review, not a determination of patent novelty. Products were not installed or tested.

## Finding

Maestro has a credible, specific product angle: a musician-facing companion to an improvised DJ set, combining the followed deck's reported key transposed for the player's instrument with live entry/exit cues from the DJ. The building blocks have clear precedent. The search found no verified exact match for the complete djay workflow, but does not establish that Maestro is the first or only such product.

The strongest claim is **a focused workflow for DJ + live musician**, rather than a new key detector, remote display, or cue-light invention. Its distinction is the combination and intended performer experience. It is technically reproducible with existing tools, so usability and evidence from performances will matter more than feature exclusivity.

## Closest precedents

“Not documented” below means the cited sources did not establish the capability. It does not mean a product cannot do it.

| Product / source | Documented overlap | Implication for Maestro |
| --- | --- | --- |
| [ShowKontrol Core](https://www.tc-supply.com/showkontrol-core), [data keys](https://manual.showkontrol.com/manual/data-keys), [quick reference](https://manual.showkontrol.com/quickref) | Live DJ playback data, waveforms, metadata including key, beat/BPM and extensive production routing. The current manual also documents stage messages and key variables. Core's page identifies a web server in Club and Live. | Strongest DJ-data precedent. Remote displays and reacting to an evolving DJ set are established. Instrument-specific written-key transposition combined with a dedicated musician cue workflow is not documented in these sources. Avoid portraying ShowKontrol as incapable of performer displays or custom workflows. |
| [Beat Link Trigger: triggers](https://blt-guide.deepsymmetry.org/beat-link-trigger/8.0.0/Triggers.html), [player status](https://blt-guide.deepsymmetry.org/beat-link-trigger/8.0.0/Players.html) | Live player status, effective BPM, beats, track-key metadata, detailed waveforms, scripting and an embedded overlay server. | Open-source building blocks could support a similar custom display. Maestro's value must include removing the need to assemble that solution for this use case. |
| [FOLLOW ME: Live Band Cues](https://apps.apple.com/au/app/follow-me-live-band-cues/id6813754055) | Musical-director cues reach band phones as full-screen flashes and in-ear speech. Supports key-change calls, STOP/HOLD, MIDI controllers and clock, count-ins and QR joining. | Closest performer-communication precedent. Sending musical instructions to phones is already a product category. Automatic DJ-deck metadata ingestion and instrument-specific key transposition are not documented in the listing. This is developer-described functionality, not independently verified behavior. |
| [Mixed In Key Live](https://mixedinkey.com/get-live/) | Analyzes computer audio and displays key, BPM and notes, including a compact floating view. | Live key/BPM assistance already exists. Maestro reads djay's reported data and adds deck context and explicit human cues. Do not claim superior key accuracy without testing. |
| [Transpose Assistant](https://play.google.com/store/apps/details?id=com.transposeassistant.p) | Converts manually selected concert keys to written keys for B-flat, E-flat and F instruments and shows scales. Listing shows an August 2025 update. | Even the exact instrument families and written-key conversion have precedent. The useful distinction is automatically applying that conversion as the DJ changes tracks. |
| [Ableton Link manual](https://www.ableton.com/en/live-manual/12/synchronizing-with-link-tempo-follower-and-midi/) | Shares beat, tempo and phase, with optional transport start/stop synchronization. | Timing synchronization is established. Transport synchronization and a DJ telling a human soloist when to enter are different functions. |
| [TouchOSC manual](https://hexler.net/touchosc/manual%20/complete), [scripting API](https://hexler.net/pub/touchosc/scripting-api.html) | Configurable OSC send/receive controls, text labels and Lua scripting. | A custom implementation is a realistic substitute. Inferring that a programmer could build transposition plus cues is reasonable, but these sources do not establish an existing turnkey Maestro equivalent. |

## Recommended presentation angle

Slide headline:

> The DJ's changing set,
> in your instrument's key.
> Live booth cues.
> One musician's screen.

Suggested spoken explanation, approximately 15 seconds:

> Live DJ displays and band cue apps already exist. Maestro brings the workflow to a musician beside the DJ: the changing set in their instrument's written key, with Stop, Ready and Play from the booth on the same screen. Our contribution is this focused combination.

For a judge asking what is original:

> ShowKontrol demonstrates live DJ data, FOLLOW ME demonstrates band cues, and transposition apps already convert keys. Maestro combines those functions around the player accompanying an unpredictable DJ set, directly in the djay workflow. We have not established that nobody else has combined them.

## Other angles worth developing

- **Spontaneous collaboration:** demonstrate an unannounced track change and a musician joining without a prepared chart or set list. This could establish the value of the combination more convincingly than a broad novelty claim.
- **The DJ directs the arrangement:** demonstrate Ready-to-Play and Ready-to-Stop while audio keeps running. Those cues express musical intent independent of deck transport. Band cue systems already do related work, so connect this specifically to the DJ's changing set.
- **Less setup for a small act:** compare the complete Maestro setup with a custom OSC layout or production system in a timed trial. Local operation and an existing phone are current implementation properties, but “easier” needs measurement and the current MVP still requires a Mac bridge and LAN setup.
- **Musician confidence during transitions:** assess whether players notice deck handovers and prepare the right key sooner. This is a user-value hypothesis until tested.

## Boundaries the demo should respect

- The MVP transposes reported key metadata. It does not infer the live chord progression, guarantee a correct musical key, or resolve the combined harmony of two tracks during a blend.
- The client follows crossfader endpoints and retains the current deck between them. Do not describe this as automatic understanding of which track dominates a mix.
- The other deck is a preview, not a guaranteed next track. Pitch-shift response of the reported playback key remains unverified in the client README.
- “No new hardware” assumes an existing Mac and compatible djay rig plus a musician device and local network. Sources reviewed do not establish a lower total cost than alternatives.
- Sources reflect current pages as retrieved on the research date, not verified launch chronology. The search cannot rule out private tools, unpublished prototypes, discontinued products or differently named niche competitors.

## Best evidence to collect next

1. Run a short session with DJ + sax and DJ + another instrument. Compare their normal cues with Maestro during unfamiliar track changes. Record missed entries, wrong-key starts and feedback.
2. Check reported keys after pitch changes and during actual deck handovers before making stronger accuracy claims.
3. Measure setup time and cue delivery delay on the intended venue network. Use the results to support convenience and timing claims in the pitch.

Searches included DJ/musician and saxophone companion apps, live key and transposition tools, band cue apps, ShowKontrol, Beat Link Trigger, Ableton Link and OSC-based custom displays. Broad searches produced many irrelevant DJ and sheet-music tools. Absence of an exact match in these results is limited evidence, not exclusivity.
