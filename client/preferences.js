export function loadPreferences(storage) {
 try {
  const current=storage.getItem('maestro-preferences');
  const legacy=current===null?storage.getItem('horizon-preferences'):null;
  const value=JSON.parse(current ?? legacy ?? '{}');
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  if(current===null&&legacy!==null)storage.setItem('maestro-preferences',JSON.stringify(value));
  return value;
 }catch{return {};}
}
