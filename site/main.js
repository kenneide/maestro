// Page chrome: theme toggle, scroll reveals, header state and the mock store's beta toast.
const $ = id => document.getElementById(id);
const root = document.documentElement;

function labelTheme() {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  const label = `Switch to ${next} mode`;
  $('themeToggle').setAttribute('aria-label', label);
  $('themeToggle').title = label;
}
$('themeToggle').addEventListener('click', () => {
  window.maestroTheme.set(root.dataset.theme === 'light' ? 'dark' : 'light');
  labelTheme();
});
labelTheme();

const reveal = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('in');
    reveal.unobserve(entry.target);
  }
}, {rootMargin: '0px 0px -10% 0px'});
document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));

const header = document.querySelector('.nav');
const onScroll = () => header.classList.toggle('scrolled', scrollY > 8);
addEventListener('scroll', onScroll, {passive: true});
onScroll();

let toastTimer;
document.querySelectorAll('.beta').forEach(button => button.addEventListener('click', () => {
  const toast = $('toast');
  toast.textContent = 'Maestro is in private beta. Launching soon.';
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}));
