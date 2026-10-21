export function loadPreferences(storage) {
 try {
  const current=storage.getItem('maestro-preferences');
  const legacy=current===null?storage.getItem('horizon-preferences'):null;
  const value=JSON.parse(current ?? legacy ?? '{}');
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const legacyInstruments={alto:'Eb',baritone:'Eb',tenor:'Bb',soprano:'Bb',concert:'C'};
  const normalized={...value,instrument:['C','Bb','Eb','F'].includes(value.instrument)?value.instrument:legacyInstruments[value.instrument]??'Eb'};
  if((current===null&&legacy!==null)||normalized.instrument!==value.instrument){try{storage.setItem('maestro-preferences',JSON.stringify(normalized));}catch{}}
  return normalized;
 }catch{return {};}
}
