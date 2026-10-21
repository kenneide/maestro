// Runs before styles load to avoid a flash of the wrong theme.
(() => {
 const storageKey='maestro-theme';
 function updateBrowserColor(){document.querySelector('meta[name="theme-color"]')?.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());}
 document.addEventListener('DOMContentLoaded',updateBrowserColor,{once:true});
 function set(theme){
  theme=theme==='light'?'light':'dark';
  document.documentElement.dataset.theme=theme;
  if(document.readyState!=='loading')updateBrowserColor();
  try{localStorage.setItem(storageKey,theme);}catch{}
 }
 let theme='dark';try{theme=localStorage.getItem(storageKey)||'dark';}catch{}
 set(theme);
 window.maestroTheme={set};
})();
