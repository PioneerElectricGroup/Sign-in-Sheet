// Pure fixture/rules utilities. No Firebase SDK or network access in this module.
export const PROJECT = 'demo-pioneer-v19';
export const HOST = '127.0.0.1';
export const PORT = 8080;
export const ROOT = 'attendanceSites/launch-check-v19';
export const TABLET = 'native-test-field-kiosk';
export const MANAGER = 'native-test-manager-isaac';
export const MANAGER_JAKE = 'native-test-manager-jake';
export const MANAGER_ERIC = 'native-test-manager-eric';
export const MANAGERS = [MANAGER,MANAGER_JAKE,MANAGER_ERIC];
export const clone = value => structuredClone(value);

export function assertIsolation(env = process.env) {
  if (env.FIRESTORE_EMULATOR_HOST !== `${HOST}:${PORT}` && env.FIRESTORE_EMULATOR_HOST !== `localhost:${PORT}`) {
    throw new Error('STOP: only the local Firestore emulator on port 8080 is permitted.');
  }
  for (const key of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT']) {
    if (env[key] && env[key] !== PROJECT) throw new Error(`STOP: unexpected ${key}.`);
  }
  if (env.FIREBASE_TOKEN || env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('STOP: this test must not receive Firebase/Google credentials.');
}

export function docPath(path) {
  if (!/^(config\/(setup|job|security)|roster\/(check-hourly|check-salary|__permission_probe)|codes\/1000|punches\/([0-9-]+__check-(hourly|salary)|__permission_probe)|state\/check-(hourly|salary)|audit\/[a-zA-Z0-9_-]+|receipts\/[a-zA-Z0-9_-]+)$/.test(path)) {
    throw new Error(`Unexpected synthetic fixture path: ${path}`);
  }
  return `${ROOT}/${path}`;
}

export function rebaseFixture(fixture, sourceCase, now = Date.now()) {
  // Put all recorded captures inside one recent minute. The SDK upload timestamp
  // is set separately just before commit. This does not claim to check iPad clocks.
  const target = Math.floor((now - 60000) / 60000) * 60000 + 10000;
  const delta = target - fixture.anchorMs;
  const local = new Date(target + fixture.offset * 60000).toISOString();
  const day = local.slice(0,10), hm = local.slice(11,16);
  function walk(value) {
    if (typeof value === 'number' && value > fixture.anchorMs - 86400000 && value < fixture.anchorMs + 86400000) return value + delta;
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return new Date(Date.parse(value) + delta).toISOString();
      if (value === fixture.originalLocalTime) return hm;
      return value.replaceAll(fixture.originalDate, day);
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,walk(v)]));
    return value;
  }
  return {...walk(sourceCase), rebasedAt:new Date(now).toISOString(), delta, day, hm};
}

export function convertValues(value, makeTimestamp, makeServerTimestamp) {
  if (value && typeof value === 'object') {
    if (value.__serverTimestamp === true && Object.keys(value).length === 1) return makeServerTimestamp();
    if (Object.keys(value).length === 1 && '__timestampMillis' in value) return makeTimestamp(value.__timestampMillis);
    if (Array.isArray(value)) return value.map(v => convertValues(v,makeTimestamp,makeServerTimestamp));
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,convertValues(v,makeTimestamp,makeServerTimestamp)]));
  }
  return value;
}

function closeBrace(source, open) {
  let level=1, quote=null, lineComment=false, blockComment=false;
  for(let i=open+1;i<source.length;i++){
    const c=source[i],next=source[i+1];
    if(lineComment){if(c==='\n')lineComment=false;continue;}
    if(blockComment){if(c==='*'&&next==='/'){blockComment=false;i++;}continue;}
    if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(c==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(c==='{')level++;if(c==='}'&&--level===0)return i;
  }
  throw new Error('Unbalanced rule block.');
}

export function rewriteCollection(rules, collection, verb, condition) {
  const cut=rules.indexOf('match /attendanceSites/{siteId}');
  if(cut<0)throw new Error('v19 scope missing');
  const prefix=rules.slice(0,cut);let live=rules.slice(cut);
  const match=new RegExp(`match /${collection}/\\{[^}]+\\}\\s*\\{`).exec(live);
  if(!match)throw new Error(`Missing ${collection} rules`);
  const begin=match.index+match[0].length-1,end=closeBrace(live,begin);
  let block=live.slice(begin,end+1);
  const pat=new RegExp(`allow ${verb.replaceAll(',','\\s*,')}\\s*:[\\s\\S]*?;`);
  if(!pat.test(block))throw new Error(`Missing ${collection}: ${verb}`);
  block=block.replace(pat,`allow ${verb}: if ${condition};`);
  return prefix+live.slice(0,begin)+block+live.slice(end+1);
}

export function isolateRules(baseline, focus, helper) {
  // These deliberately permissive supporting-write rules exist ONLY in the
  // disposable demo emulator. They are not a proposed production rules patch.
  let rules=baseline;
  const demoGate='isTablet() && siteAllowed()';
  const variants=[['punches','create'],['punches','update'],['audit','create'],['state','create, update'],['receipts','create']];
  for(const [collection,verb] of variants){
    if(collection!==focus)rules=rewriteCollection(rules,collection,verb,demoGate);
  }
  if(helper)rules=rewriteCollection(rules,'punches','update',`liveTablet() && (${helper})`);
  return rules;
}

export const helperChecks = {
  metadata:'metadata(request.resource.data)',
  summary:'summaries(request.resource.data)',
  worker:'activeWorker(request.resource.data)',
  capturedDate:'request.resource.data.date == localDate(request.resource.data._capturedMs,request.resource.data._offset)',
  signedDeparture:"newOut(request.resource.data.segments['s'+string(resource.data.segmentCount-1)],resource.data.segments['s'+string(resource.data.segmentCount-1)],request.resource.data)",
  code:'validCode(request.resource.data)',
  state:'headMatches(id,request.resource.data)',
  audit:'auditMatches(id,request.resource.data)',
  receipt:'receiptRequired(id,request.resource.data)',
};
