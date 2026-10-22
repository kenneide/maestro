// Simulated two-track set driving the booth plugin and the musician's phone.
// Keys are transposed with the musician app's own writtenKey().
import {writtenKey, formatTime} from './shared/music.js';

const TRACKS = [
  {deck: 1, title: 'Heart Like Mine', artist: 'Sam Feldt', key: 4, mode: 'minor', bpm: 124, start: 62, duration: 182},
  {deck: 2, title: 'Golden Hour', artist: 'Nova Lane', key: 9, mode: 'minor', bpm: 122, start: 30, duration: 205},
];
// Each track plays the same phrase: the DJ holds the musician during the breakdown,
// warns them through the build, cues them in on the drop and warns again before the mix.
const SECTIONS = [
  {name: 'Breakdown', kind: 'breakdown', length: 8, cue: 'stop'},
  {name: 'Build', kind: 'build', length: 5, cue: 'ready', next: 'play'},
  {name: 'Build', kind: 'pause', length: 0.35, cue: 'ready', next: 'play'},
  {name: 'Drop', kind: 'drop', length: 8.65, cue: 'play'},
  {name: 'Mix out', kind: 'outro', length: 3, cue: 'ready', next: 'stop'},
];
const TRACK_LENGTH = SECTIONS.reduce((sum, s) => sum + s.length, 0);
const LOOP = TRACK_LENGTH * TRACKS.length;
// Same strip as client/wave.js: one min/max point per 25 ms, 8 s on screen.
const WINDOW = 0.025, SPAN = 320, MANUAL_HOLD = 8000;
const WORDS = {stop: 'Stop', ready: 'Ready', play: 'Play'};

const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function locate(t) {
  const index = Math.floor(t / TRACK_LENGTH) % TRACKS.length;
  let local = t - index * TRACK_LENGTH, at = local;
  for (const section of SECTIONS) {
    if (at < section.length) return {index, track: TRACKS[index], section, local, within: at};
    at -= section.length;
  }
  return {index, track: TRACKS[index], section: SECTIONS.at(-1), local, within: SECTIONS.at(-1).length};
}

function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// The same breakdown → build → pause → drop envelope as docs/cover/make_cover.py.
function buildWave() {
  const rnd = random(7), bump = (t, at, width) => Math.exp(-(((t - at) / width) ** 2));
  const words = TRACKS.map(() => {
    const list = [];
    for (let at = 0.3; at < 7.6; at += 0.28 + rnd() * 0.3) list.push([at, 0.25 + rnd() * 0.4]);
    return list;
  });
  const points = [];
  for (let i = 0; i < LOOP / WINDOW; i++) {
    const {index, track, section, within} = locate(i * WINDOW);
    const beat = 60 / track.bpm, u = within / section.length;
    let level;
    if (section.kind === 'breakdown') {
      level = 0.1 + 0.05 * Math.sin(within * 2) + words[index].reduce((sum, [at, a]) => sum + a * bump(within, at, 0.1), 0);
    } else if (section.kind === 'build') {
      const gap = beat / 2 ** Math.min(3, Math.floor(u * 4));
      level = 0.12 + 0.3 * u + (0.25 + 0.55 * u) * Math.exp(-((within % gap) / gap) * 5);
    } else if (section.kind === 'pause') {
      level = 0.03;
    } else {
      const phase = (within % beat) / beat;
      level = (0.5 + 0.45 * Math.exp(-phase * 10) + 0.1 * bump(phase, 0.5, 0.05)) * (section.kind === 'outro' ? 1 - 0.45 * u : 1);
    }
    const amp = Math.min(0.97, level * (0.92 + 0.08 * rnd()));
    points.push([-amp * (0.88 + 0.12 * rnd()), amp]);
  }
  return points;
}

const wave = buildWave();
const canvas = $('phoneWave'), context = canvas.getContext('2d');
const colours = {};
function readColours() {
  const style = getComputedStyle(document.documentElement);
  colours.accent = style.getPropertyValue('--accent').trim();
}
function sizeCanvas() {
  const box = canvas.getBoundingClientRect(), scale = devicePixelRatio || 1;
  canvas.width = Math.round(box.width * scale);
  canvas.height = Math.round(box.height * scale);
}

// Mirrors drawWave in client/app.js: newest audio on the right, accent fill fading in from the left.
function drawWave(t) {
  const {width, height} = canvas, mid = height / 2;
  context.clearRect(0, 0, width, height);
  if (!width || !height) return;
  const pos = t / WINDOW, start = pos - SPAN, step = width / SPAN, total = wave.length;
  const x = seq => (seq - start) * step, y = value => mid - value * mid * 0.95;
  const first = Math.floor(start), last = Math.ceil(pos);
  const at = seq => wave[((seq % total) + total) % total];
  context.beginPath();
  for (let seq = first; seq <= last; seq++) seq === first ? context.moveTo(x(seq), y(at(seq)[1])) : context.lineTo(x(seq), y(at(seq)[1]));
  for (let seq = last; seq >= first; seq--) context.lineTo(x(seq), y(at(seq)[0]));
  context.closePath();
  const fade = context.createLinearGradient(0, 0, width * 0.2, 0);
  fade.addColorStop(0, 'transparent');
  fade.addColorStop(1, colours.accent);
  context.fillStyle = fade;
  context.fill();
}

function buildTimeline() {
  const bar = $('timelineBar');
  bar.innerHTML = SECTIONS.filter(s => s.kind !== 'pause').map(s =>
    `<span class="seg seg-${s.kind}" style="flex:${s.kind === 'build' ? s.length + SECTIONS[2].length : s.length}">${s.name}</span>`
  ).join('') + '<i class="playhead" id="playhead"></i>';
}

const state = {t: 0, playing: !reduceMotion.matches, visible: true, manual: null, instrument: 'Eb', shown: {}, last: 0};

function currentCue(where) {
  if (state.manual && performance.now() < state.manual.until) return state.manual;
  state.manual = null;
  return {cue: where.section.cue, next: where.section.next};
}

function setText(id, value) {
  const el = $(id);
  if (el.textContent !== value) el.textContent = value;
}

function renderCue({cue, next}) {
  const key = cue + (next || '');
  if (state.shown.cue === key) return;
  const changed = state.shown.cue !== undefined;
  state.shown.cue = key;
  const nextText = cue === 'ready' ? `Next: ${WORDS[next]}` : '';
  for (const el of [$('phone'), $('pluginCue'), $('plugin')]) el.dataset.cue = cue;
  setText('phoneCue', WORDS[cue]); setText('phoneNext', nextText);
  setText('trafficWord', WORDS[cue]); setText('trafficNext', nextText);
  setText('pluginWord', WORDS[cue]); setText('pluginNext', nextText);
  document.querySelectorAll('.plugin-steps span').forEach(s => s.classList.toggle('on', s.dataset.step === cue));
  if (changed) {
    const pulse = $('linkPulse');
    pulse.classList.remove('go');
    void pulse.offsetWidth;
    pulse.classList.add('go');
  }
}

function renderKeys(where) {
  const {track} = where, other = TRACKS[(where.index + 1) % TRACKS.length];
  const id = `${where.index}${state.instrument}`;
  if (state.shown.keys === id) return;
  state.shown.keys = id;
  const concert = writtenKey(track.key, 'C', track.mode), written = writtenKey(track.key, state.instrument, track.mode);
  setText('phoneTitle', `Deck ${track.deck} · ${track.title}`);
  setText('phoneArtist', track.artist);
  setText('phoneDuration', formatTime(track.duration));
  setText('phoneKey', written); setText('phoneMode', track.mode);
  setText('phoneBpm', String(track.bpm));
  setText('phonePreview', `Preview · Deck ${other.deck} · ${other.title} — ${other.artist}`);
  setText('deckName', `Deck ${track.deck} · ${track.title}`);
  $('concert').innerHTML = state.instrument === 'C'
    ? `Concert ${concert} ${track.mode}: no transposition`
    : `Concert ${concert} ${track.mode} → you read <b>${written} ${track.mode}</b>`;
  const keyBlock = $('phoneKey').parentElement;
  keyBlock.classList.remove('flash');
  void keyBlock.offsetWidth;
  keyBlock.classList.add('flash');
}

function render() {
  const where = locate(state.t), {track, section, local} = where;
  const other = TRACKS[(where.index + 1) % TRACKS.length];
  renderCue(currentCue(where));
  renderKeys(where);
  const position = track.start + local;
  setText('phoneTime', formatTime(position));
  setText('phoneStatus', state.playing ? 'Playing' : 'Paused');
  $('phoneProgress').style.width = `${(position / track.duration) * 100}%`;
  const mixing = section.kind === 'outro';
  setText('phonePreviewDetails', `${writtenKey(other.key, state.instrument, other.mode)} ${other.mode} · ${other.bpm} BPM · ${mixing ? 'Playing' : 'Paused'}`);
  const beat = Math.floor(local * track.bpm / 60) % 4;
  if (state.shown.beat !== beat) {
    state.shown.beat = beat;
    $('beatDots').querySelectorAll('i').forEach((dot, i) => dot.classList.toggle('active', i === beat));
  }
  setText('sectionName', section.name);
  $('playhead').style.left = `${(local / TRACK_LENGTH) * 100}%`;
  drawWave(state.t);
}

function frame(now) {
  const elapsed = Math.min(0.1, (now - state.last) / 1000);
  state.last = now;
  if (state.playing) state.t = (state.t + elapsed) % LOOP;
  render();
  if (state.playing && state.visible) requestAnimationFrame(frame);
  else state.running = false;
}

function run() {
  if (state.running || !state.playing || !state.visible) return;
  state.running = true;
  state.last = performance.now();
  requestAnimationFrame(frame);
}

// The plugin's cycle: Stop → Ready → Play → Ready → Stop.
function stepCue() {
  const shown = currentCue(locate(state.t));
  const next = shown.cue === 'stop' ? {cue: 'ready', next: 'play'}
    : shown.cue === 'play' ? {cue: 'ready', next: 'stop'}
    : {cue: shown.next || 'play'};
  state.manual = {...next, until: performance.now() + MANUAL_HOLD};
  $('announce').textContent = `Cue: ${WORDS[next.cue]}${next.next ? `, next ${WORDS[next.next]}` : ''}`;
  render();
}

function setPlaying(playing) {
  state.playing = playing;
  const button = $('playPause');
  button.dataset.playing = playing;
  button.setAttribute('aria-label', playing ? 'Pause demo' : 'Play demo');
  button.title = playing ? 'Pause demo' : 'Play demo';
  render();
  run();
}

$('pluginCue').addEventListener('click', stepCue);
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat || !state.visible) return;
  if (event.target.closest('input, select, textarea, button, a, summary')) return;
  event.preventDefault();
  stepCue();
});
$('instrument').addEventListener('change', event => { state.instrument = event.target.value; render(); });
$('traffic').addEventListener('change', event => { $('phone').classList.toggle('traffic-on', event.target.checked); });
$('playPause').addEventListener('click', () => setPlaying(!state.playing));

new IntersectionObserver(([entry]) => { state.visible = entry.isIntersecting; run(); }).observe($('demo'));
new MutationObserver(() => { readColours(); render(); }).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
new ResizeObserver(() => { sizeCanvas(); render(); }).observe(canvas);

// Start on the build so the first thing a visitor sees is the drop arriving.
state.t = SECTIONS[0].length - 2;
buildTimeline();
readColours();
sizeCanvas();
setPlaying(state.playing);
