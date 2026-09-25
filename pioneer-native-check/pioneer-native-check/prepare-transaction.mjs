// Pure write preparation. Uses the actual native server snapshot for audit.before.
import {clone} from './support.mjs';
export function prepareTransactionWrites(c,snapshots,convert,uploadMs=Date.now()) {
  const writes=clone(c.writes),punch=writes.find(w=>w.path.startsWith('punches/')),audit=writes.find(w=>w.path.startsWith('audit/'));
  if(!punch||!audit)throw Error('Source fixture must supply the canonical four-write shape');
  punch.data._clientMs=uploadMs+(c.clientMsShiftMs||0);audit.data.after=clone(punch.data);
  const native=writes.map(w=>({...w,data:convert(w.data)}));
  native.find(w=>w.path.startsWith('audit/')).data.before=snapshots[punch.path]?.exists()?snapshots[punch.path].data():null;
  // Apply negative-test mutations AFTER normal linking. Never repair an attack.
  for(const mutation of c.alterWrites||[]){
    const w=native.find(w=>w.path.startsWith(mutation.collection+'/'));
    if(!w)throw Error('Mutation target not found');
    const parts=mutation.field.split('.');let target=w.data;
    for(const key of parts.slice(0,-1)){if(!target[key]||typeof target[key]!=='object')throw Error('Invalid mutation path');target=target[key];}
    target[parts.at(-1)]=convert(mutation.value);
  }
  return native.filter(w=>!(c.omitWrites||[]).includes(w.path.split('/')[0]));
}
