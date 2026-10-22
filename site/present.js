// Pitch deck controls: scaling, navigation, criterion chips and legend, 3-minute timer,
// speaker notes and an overview. Keys: arrows/Space/PageUp/PageDown, N, T, F, Esc, Home, End.
(() => {
  const $ = id => document.getElementById(id);
  const stage = $('stage'), slides = [...document.querySelectorAll('.slide')];
  const NAMES = {fit: 'Product–market fit', originality: 'Originality', artistic: 'Artistic potential', clarity: 'Demo & clarity'};
  const TOTAL = 180;
  const format = seconds => `${seconds < 0 ? '-' : ''}${Math.floor(Math.abs(seconds) / 60)}:${String(Math.abs(seconds) % 60).padStart(2, '0')}`;
  let index = 0, timer = {start: null, shown: false, id: 0};

  const criteria = slide => slide.dataset.criteria.split(' ');
  // Target finish time for each slide, from the running total of their budgets.
  const targets = slides.reduce((list, slide) => [...list, (list.at(-1) || 0) + Number(slide.dataset.time)], []);

  function fit() {
    const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.setProperty('--scale', scale);
  }

  for (const slide of slides) {
    const list = criteria(slide);
    if (list.length === 4) continue;
    const chips = document.createElement('div');
    chips.className = 'chips-crit';
    chips.setAttribute('aria-label', 'Judging criteria');
    chips.innerHTML = list.map(key => `<span>${NAMES[key]}</span>`).join('');
    slide.append(chips);
  }

  const overview = document.createElement('nav');
  overview.className = 'overview';
  overview.hidden = true;
  overview.setAttribute('aria-label', 'All slides');
  overview.innerHTML = slides.map((slide, i) =>
    `<button type="button" data-go="${i}"><span class="ov-num">${i + 1} · ${format(Number(slide.dataset.time))}</span>` +
    `<span class="ov-title">${slide.getAttribute('aria-label')}</span>` +
    `<span class="ov-meta">${criteria(slide).length === 4 ? 'All criteria' : criteria(slide).map(key => NAMES[key]).join(' · ')}</span></button>`
  ).join('');
  stage.append(overview);
  overview.addEventListener('click', event => {
    const button = event.target.closest('[data-go]');
    if (button) { toggleOverview(false); go(Number(button.dataset.go)); }
  });

  function go(next) {
    index = Math.max(0, Math.min(slides.length - 1, next));
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
      slide.setAttribute('aria-hidden', String(i !== index));
    });
    const active = criteria(slides[index]);
    document.querySelectorAll('#legend [data-criterion]').forEach(el => el.classList.toggle('on', active.includes(el.dataset.criterion)));
    $('counter').textContent = `${index + 1} / ${slides.length}`;
    $('announce').textContent = `Slide ${index + 1} of ${slides.length}: ${slides[index].getAttribute('aria-label')}`;
    $('notesText').textContent = slides[index].querySelector('.notes')?.textContent.trim() || '';
    $('notesTarget').textContent = `Slide budget ${format(Number(slides[index].dataset.time))} · finish by ${format(targets[index])} of ${format(TOTAL)}`;
    overview.querySelectorAll('button').forEach((b, i) => b.classList.toggle('current', i === index));
    history.replaceState(null, '', `#${index + 1}`);
  }

  function tick() {
    const left = TOTAL - Math.floor((performance.now() - timer.start) / 1000);
    const el = $('timer');
    el.textContent = `${format(left)} · next at ${format(TOTAL - targets[index])}`;
    el.classList.toggle('warn', left <= 30 && left > 0);
    el.classList.toggle('over', left <= 0);
  }

  // T starts the countdown and shows it; T again hides it; Shift+T restarts.
  function toggleTimer(restart) {
    if (restart || timer.start === null) timer.start = performance.now();
    timer.shown = restart || !timer.shown;
    $('timer').hidden = !timer.shown;
    clearInterval(timer.id);
    if (timer.shown) { tick(); timer.id = setInterval(tick, 250); }
  }

  function toggleOverview(open = overview.hidden) {
    overview.hidden = !open;
    if (open) overview.querySelector('.current')?.focus();
  }

  addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(key)) go(index + 1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(key)) go(index - 1);
    else if (key === 'Home') go(0);
    else if (key === 'End') go(slides.length - 1);
    else if (key === 'n' || key === 'N') $('notesPanel').hidden = !$('notesPanel').hidden;
    else if (key === 't' || key === 'T') toggleTimer(event.shiftKey);
    else if (key === 'f' || key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    else if (key === 'Escape') toggleOverview();
    else return;
    event.preventDefault();
  });

  // Click the right two-thirds to advance, the left third to go back.
  stage.addEventListener('click', event => {
    if (!overview.hidden || event.target.closest('a, button')) return;
    const box = stage.getBoundingClientRect();
    go(event.clientX - box.left > box.width / 3 ? index + 1 : index - 1);
  });

  addEventListener('resize', fit);
  addEventListener('hashchange', () => go(Number(location.hash.slice(1)) - 1 || 0));
  setTimeout(() => $('help').classList.add('hide'), 4000);
  fit();
  go(Number(location.hash.slice(1)) - 1 || 0);
})();
