/* Pioneer live v19.0-rc1. Scope: /Sign-in-Sheet/live/ only.
   Public app/SDK cache ONLY. No API data, account passwords, worker roster,
   signed attendance, original index.html, or v18 test page in this cache. */
'use strict';
const VERSION='19.0-rc1';
const CACHE='pioneer-live-page-v19-rc1-20260923';
const BASE=new URL('./',self.location.href);
const PAGE=new URL('index.html',BASE).href;
const SDK=['app','auth','firestore'].map(n=>'https://www.gstatic.com/firebasejs/12.19.0/firebase-'+n+'-compat.js');
const correct=body=>body.includes('name="app-version" content="19.0-rc1-live')&&body.includes('var LIVE_SITE=');
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 const page=await fetch(new Request(PAGE+'?offlineBuild='+VERSION,{cache:'reload',credentials:'same-origin'}));
 if(!page.ok||!correct(await page.clone().text()))throw Error('Matching v19 live HTML is not available. Upload both files inside live/.');
 await cache.put(PAGE,page);
 for(const url of SDK){const response=await fetch(new Request(url,{mode:'cors',cache:'reload',credentials:'omit'}));if(!response.ok)throw Error('Required Firebase SDK could not be cached.');await cache.put(url,response);}
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(event.data&&event.data.type==='PIONEER_LIVE_OFFLINE_CHECK'&&event.ports[0])event.waitUntil((async()=>{
  const c=await caches.open(CACHE),entries=await Promise.all([PAGE,...SDK].map(u=>c.match(u)));
  event.ports[0].postMessage({ready:entries.every(Boolean),version:VERSION});
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;const u=new URL(req.url);
 // Canonical HTML is the same for validation and live; the URL selects isolated
 // Auth/data/outbox namespaces inside that HTML. No private state is in this cache.
 if(u.origin===BASE.origin&&[new URL(PAGE).pathname,BASE.pathname].includes(u.pathname)&&req.mode==='navigate'){
  event.respondWith((async()=>{
   const c=await caches.open(CACHE),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
   try{const r=await fetch(new Request(req,{cache:'no-cache',signal:controller.signal}));clearTimeout(timer);if(r.ok&&correct(await r.clone().text())){await c.put(PAGE,r.clone());return r;}throw Error('Matching app page unavailable');}
   catch(_){clearTimeout(timer);return await c.match(PAGE)||new Response('Offline page is not prepared. Reconnect and prepare this tablet.',{status:503,headers:{'Content-Type':'text/plain'}});}
  })());return;
 }
 if(SDK.includes(u.href))event.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(u.href)||fetch(req);})());
 // Fonts are optional; no font files are bundled or required for attendance.
 if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com')event.respondWith((async()=>{
  const c=await caches.open(CACHE),hit=await c.match(req);if(hit)return hit;
  try{const r=await fetch(req);if(r.ok||r.type==='opaque')await c.put(req,r.clone());return r;}
  catch(_){return new Response('',{status:200,headers:{'Content-Type':u.hostname==='fonts.googleapis.com'?'text/css':'application/octet-stream'}});}
 })());
});
