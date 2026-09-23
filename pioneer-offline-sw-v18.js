/* Pioneer v18 TEST only. Caches the test page and fixed public SDK assets.
   It never caches Firebase data requests, passwords, index.html, or other repositories. */
'use strict';
const CACHE='pioneer-offline-test-v18-20260923-1';
const BASE=new URL('./',self.location.href);
const PAGE=new URL('signin-sync-test.html',BASE).href;
const SDK=['app','auth','firestore'].map(n=>'https://www.gstatic.com/firebasejs/12.19.0/firebase-'+n+'-compat.js');
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  const page=await fetch(new Request(PAGE+'?offlineBuild=18.0',{cache:'reload',credentials:'same-origin'}));
  if(!page.ok||!(await page.clone().text()).includes('v18.0 Offline test'))throw Error('Upload the v18 test HTML beside the worker before preparing offline.');
  await c.put(PAGE,page);
  await Promise.all(SDK.map(async url=>{const r=await fetch(new Request(url,{mode:'cors',cache:'reload',credentials:'omit'}));if(!r.ok)throw Error('Firebase SDK could not be cached');await c.put(url,r);}));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='PIONEER_OFFLINE_CHECK'&&event.ports[0])event.waitUntil((async()=>{const c=await caches.open(CACHE),checks=await Promise.all([PAGE,...SDK].map(u=>c.match(u)));event.ports[0].postMessage({ready:checks.every(Boolean),version:'18.0'});})());
});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;const u=new URL(req.url);
  if(u.origin===BASE.origin&&u.pathname===new URL(PAGE).pathname&&req.mode==='navigate'){
    event.respondWith((async()=>{
      const c=await caches.open(CACHE);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4000);
      try{const r=await fetch(new Request(req,{cache:'no-cache',signal:controller.signal}));clearTimeout(timer);if(r.ok){const body=await r.clone().text();if(body.includes('v18.0 Offline test'))await c.put(PAGE,r.clone());return r;}throw Error('Page unavailable');}
      catch(_){clearTimeout(timer);return await c.match(PAGE)||new Response('Offline page is not prepared. Reconnect to internet.',{status:503,headers:{'Content-Type':'text/plain'}});}
    })());return;
  }
  if(SDK.includes(u.href))event.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(u.href)||fetch(req);})());
  // Optional runtime font caching: fonts are not bundled or required for offline attendance.
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com')event.respondWith((async()=>{
    const c=await caches.open(CACHE),hit=await c.match(req);if(hit)return hit;try{const r=await fetch(req);if(r.ok||r.type==='opaque')await c.put(req,r.clone());return r;}catch(_){return new Response('',{status:200,headers:{'Content-Type':u.hostname==='fonts.googleapis.com'?'text/css':'application/octet-stream'}});}
  })());
});
