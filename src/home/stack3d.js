// The homepage's interactive 3D stack (#stack3d). index.html imports this once the page has loaded and
// the stage is near the screen, so three.js isn't part of the first load.
import * as THREE from '../3d/three.js';

// canvas: the #stack3d canvas; hint: the hint line under the stage; input: live pointer, scroll and material
// values from index.html; reduce: prefers reduced motion; lite: phone or low-core device (lighter scene).
export function startStack({ canvas: cv, hint, input, reduce, lite }){
  let r;
  try { r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch(e){ return; }
  r.setPixelRatio(Math.min(devicePixelRatio, lite ? 1.5 : 2));
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(42, 1, .1, 100); cam.position.set(0, 1.5, 13);
  sc.add(new THREE.AmbientLight(0xffffff, .55));
  const la = new THREE.PointLight(0x00e5ff, 3, 40); la.position.set(6, 8, 8); sc.add(la);
  const lb = new THREE.PointLight(0x8b5cf6, 3, 40); lb.position.set(-7, -3, 6); sc.add(lb);
  const g = new THREE.Group(); g.rotation.set(.45, -.6, 0); sc.add(g);

  const data = [
    { n: 'AI & Automation', d: 'Assistants, workflows and AI prototypes', h: 'ai-automation-collection.html', c: 0xffd8bd, css: '#ffd8bd' },
    { n: 'UI/UX Design', d: 'Prototypes, journeys and flows', h: 'uiux-collection.html', c: 0x8b5cf6, css: '#b79cff' },
    { n: 'Web Apps', d: 'Dashboards and API-powered apps', h: 'web-apps-collection.html', c: 0x38bdf8, css: '#7dd3fc' },
    { n: 'Web Design', d: 'Landing pages and storefronts', h: 'web-design-collection.html', c: 0x00e5ff, css: '#00e5ff' }
  ];
  
  function skinTex(i, d){
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.strokeStyle = d.css; x.fillStyle = d.css; x.lineWidth = 3; x.globalAlpha = .85;
    if(i === 0){
      const P = [[90,120],[200,70],[330,110],[430,60],[130,250],[260,210],[380,260],[460,200],[100,380],[230,340],[350,390],[450,330]];
      [[0,1],[1,2],[2,3],[0,4],[1,5],[2,6],[3,7],[4,5],[5,6],[6,7],[4,8],[5,9],[6,10],[7,11],[8,9],[9,10],[10,11]].forEach(a => { x.beginPath(); x.moveTo(P[a[0]][0], P[a[0]][1]); x.lineTo(P[a[1]][0], P[a[1]][1]); x.stroke(); });
      P.forEach(p => { x.beginPath(); x.arc(p[0], p[1], 9, 0, 7); x.fill(); });
    }
    if(i === 1){
      x.lineWidth = 4; x.beginPath(); if(x.roundRect) x.roundRect(170, 60, 172, 300, 26); else x.rect(170, 60, 172, 300); x.stroke();
      x.setLineDash([10, 8]); [130, 190, 250, 310].forEach(y => x.strokeRect(194, y, 124, 34)); x.setLineDash([]);
    }
    if(i === 2){
      [[80,.45],[160,.7],[240,.55],[320,.9],[400,.65]].forEach(b => x.fillRect(b[0], 330 - b[1] * 250, 52, b[1] * 250));
      x.beginPath(); x.moveTo(60, 200); x.lineTo(140, 150); x.lineTo(230, 180); x.lineTo(330, 90); x.lineTo(450, 60); x.stroke();
    }
    if(i === 3){
      ['#00e5ff','#ff4b3e','#f2b134','#8b5cf6','#fafbfc'].forEach((cc, k) => { x.fillStyle = cc; x.fillRect(70 + k * 74, 80, 60, 60); });
      x.fillStyle = d.css; x.font = '700 170px "Plus Jakarta Sans",Arial,sans-serif'; x.textAlign = 'left'; x.fillText('Aa', 90, 300);
    }
    x.globalAlpha = 1; x.fillStyle = d.css; x.textAlign = 'center'; x.font = '700 54px "Plus Jakarta Sans",Arial,sans-serif'; x.shadowColor = d.css; x.shadowBlur = 14; x.fillText(d.n, 256, 452);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  
  const layers = [], hits = [];
  data.forEach((d, i) => {
    const grp = new THREE.Group(), geo = new THREE.BoxGeometry(4.8, .3, 4.8);
    const mat = new THREE.MeshStandardMaterial({ color: d.c, transparent: true, opacity: .32, roughness: .2, metalness: .6, emissive: d.c, emissiveIntensity: .25 });
    const mesh = new THREE.Mesh(geo, mat); mesh.userData.i = i; grp.add(mesh); hits.push(mesh);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: d.c })); grp.add(edge);
    const skin = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({ map: skinTex(i, d), transparent: true, depthWrite: false }));
    skin.rotation.x = -Math.PI / 2; skin.position.y = .17; grp.add(skin);
    const prop = new THREE.Group(); prop.position.set(1.55, .2, -1.5); grp.add(prop);
    const pm = (c, o) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: o || .5, roughness: .3, metalness: .5 });
    if(i === 0){ const ic = new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 1), pm(d.c, .7)); ic.material.wireframe = true; prop.add(ic); prop.add(new THREE.Mesh(new THREE.SphereGeometry(.14, 16, 16), pm(0xffffff, .9))); prop.position.y = .5; }
    if(i === 1){ const pf = [[0,-1.9],[.55,-1],[1.5,.05],[1.62,.22],[1.62,.34],[1.2,.78],[.78,1.02],[0,1.02]].map(p => new THREE.Vector2(p[0], p[1]));
      const gm = new THREE.Mesh(new THREE.LatheGeometry(pf, 10), new THREE.MeshStandardMaterial({ color: 0xb79cff, metalness: .9, roughness: .15, flatShading: true, emissive: 0x8b5cf6, emissiveIntensity: .35 })); gm.scale.setScalar(.25); gm.position.y = .5; prop.add(gm); }
    if(i === 2){ prop.userData.bars = []; for(let k = 0; k < 4; k++){ const b = new THREE.Mesh(new THREE.BoxGeometry(.14, .5, .14), pm(d.c, .6)); b.position.x = (k - 1.5) * .24; prop.add(b); prop.userData.bars.push(b); } }
    if(i === 3){ const bx = new THREE.Mesh(new THREE.BoxGeometry(.6, .8, .6), [0xf5eedc, 0x4a1f2e, 0xfafbfc, 0x15181c, 0xf6f3ec, 0xff4b3e].map(c => pm(c, .25))); bx.position.y = .4; prop.add(bx); }
    grp.userData = { mat, glow: 0, lift: 0, prop, skin }; g.add(grp); layers.push(grp);
  });
  
  if(document.fonts) document.fonts.load('700 54px "Plus Jakarta Sans"').then(() => layers.forEach((l, i) => { l.userData.skin.material.map = skinTex(i, data[i]); l.userData.skin.material.needsUpdate = true; })).catch(() => {});
  
  const MATS = { glass: { op: .32, me: .6, ro: .2, em: .25 }, neon: { op: .16, me: .2, ro: .4, em: .95 }, metal: { op: .9, me: .95, ro: .28, em: .08 } };
  // The material buttons are wired up in index.html, so a choice made before this loaded still counts.
  const cfg = Object.assign({}, MATS[input.mat] || MATS.glass);
  
  const floor = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.66, lite ? 64 : 96), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: .45, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3.4; g.add(floor);
  const floor2 = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.43, lite ? 64 : 96), new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: .35, side: THREE.DoubleSide }));
  floor2.rotation.x = -Math.PI / 2; floor2.position.y = -3.4; g.add(floor2);
  const pil = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: 0 }));
  pil.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24), 3)); g.add(pil);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 7, 12), new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(core);

  const N = lite ? 120 : 250, pa = new Float32Array(N * 3); for(let i = 0; i < N; i++) pa.set([(Math.random() - .5) * 16, (Math.random() - .5) * 12, (Math.random() - .5) * 10], i * 3);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pa, 3));
  sc.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xbff6ff, size: .055, transparent: true, opacity: .7 })));

  const ac = document.createElement('canvas'); ac.width = ac.height = 256; const ax = ac.getContext('2d'), gr = ax.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,229,255,.45)'); gr.addColorStop(.45, 'rgba(139,92,246,.15)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ax.fillStyle = gr; ax.fillRect(0, 0, 256, 256);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(ac), transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.scale.set(13, 13, 1); aura.position.set(0, 0, -3); sc.add(aura);

  const RP = lite ? 60 : 120, rp = new Float32Array(RP * 3), rs = [];
  for(let i = 0; i < RP; i++){ const a = Math.random() * 6.283, rd = Math.random() * 2.1; rp.set([Math.cos(a) * rd, (Math.random() - .5) * 7, Math.sin(a) * rd], i * 3); rs.push(.008 + Math.random() * .025); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rise = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xb8f6ff, size: .07, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(rise);

  const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
  function pick(e){ const b = cv.getBoundingClientRect(); mv.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(mv, cam); const h = ray.intersectObjects(hits)[0]; return h ? h.object.userData.i : -1; }

  let drag = false, lx = 0, ly = 0, tx = 0, ty = 0, open = 0, openT = 0, moved = 0, hover = -1, t0 = null;
  const setHint = i => { hint.textContent = i < 0 ? 'Drag to rotate · Click a layer to open it' : data[i].n + ' — ' + data[i].d + ' · click to open'; hint.style.color = i < 0 ? '' : 'var(--cyan)'; };
  cv.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; moved = 0; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if(drag){ g.rotation.y += (e.clientX - lx) * .009; g.rotation.x = Math.max(-.2, Math.min(1.2, g.rotation.x + (e.clientY - ly) * .006)); moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly); lx = e.clientX; ly = e.clientY; return; }
    const h = pick(e); if(h !== hover){ hover = h; cv.style.cursor = h < 0 ? '' : 'pointer'; setHint(h); }
  });
  cv.addEventListener('pointerleave', () => { hover = -1; setHint(-1); });
  cv.addEventListener('pointerup', e => { drag = false; if(moved > 6) return; const h = pick(e); if(h >= 0) location.href = data[h].h; else openT = openT > .5 ? 0 : 1; });
  function size(){ const w = cv.clientWidth, h = cv.clientHeight; if(!w || !h) return; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  new ResizeObserver(size).observe(cv); size();
  let vis = true; new IntersectionObserver(es => vis = es[0].isIntersecting).observe(cv);

  (function loop(now){
    const { nx, ny } = input;
    requestAnimationFrame(loop); if(!vis || document.hidden) return; const t = now * .001; if(t0 === null) t0 = t;
    const e0 = t - t0, want = Math.max(openT, Math.min(1, input.scrollY / 500) * .85, .3);
    open += (want - open) * .06;
    layers.forEach((l, i) => {
      const u = l.userData, k = reduce ? 1 : Math.min(1, Math.max(0, (e0 - .25 - i * .22) / 1.1)), ease = 1 - Math.pow(1 - k, 4);
      const drop = (1 - ease) * 9;
      const demo = (hover < 0 && !drag && !reduce && Math.floor(t / 2.2) % 4 === i) ? .45 : 0; u.glow += ((hover === i ? 1 : demo) - u.glow) * .15; u.lift += ((hover === i ? .45 : 0) - u.lift) * .12;
      l.position.y = (i - 1.5) * (.6 + open * 1.5) + drop + u.lift + Math.sin(t * 1.2 + i) * .07;
      l.rotation.y = (reduce ? 0 : t * (.22 + i * .09) * (i % 2 ? 1 : -1)) + open * i * .3;
      u.mat.emissiveIntensity = cfg.em + u.glow * .9; u.mat.opacity = (cfg.op + u.glow * .35) * ease; u.mat.metalness = cfg.me; u.mat.roughness = cfg.ro;
      l.scale.setScalar(1 + u.glow * .05);
      if(u.prop){ if(!reduce) u.prop.rotation.y += .012 + u.glow * .04;
        if(u.prop.userData.bars) u.prop.userData.bars.forEach((b, k) => { const h = reduce ? .6 : .25 + (Math.sin(t * 2 + k * 1.3) * .5 + .5) * .75; b.scale.y = h; b.position.y = h * .25; }); }
    });
    core.scale.set(1 + Math.sin(t * 4) * .3, 1, 1 + Math.sin(t * 4) * .3);
    const tgt = MATS[input.mat] || MATS.glass;
    ['op', 'me', 'ro', 'em'].forEach(k => cfg[k] += (tgt[k] - cfg[k]) * .08);
    const pp = pil.geometry.attributes.position, y0 = layers[0].position.y, y1 = layers[3].position.y;
    [[2.4, 2.4], [-2.4, 2.4], [2.4, -2.4], [-2.4, -2.4]].forEach((c, k) => { pp.setXYZ(k * 2, c[0], y0, c[1]); pp.setXYZ(k * 2 + 1, c[0], y1, c[1]); });
    pp.needsUpdate = true; pil.material.opacity = Math.max(0, open - .3) * .6;
    floor.scale.setScalar(1 + Math.sin(t * 1.5) * .02); floor2.rotation.z = t * .3;
    const ra = rise.geometry.attributes.position, lim = 2.4 + open * 2.6;
    for(let i = 0; i < RP; i++){ let y = ra.getY(i) + rs[i]; if(y > lim) y = -lim; ra.setY(i, y); } ra.needsUpdate = true;
    la.position.set(nx * 14, 8 - ny * 10, 8);
    if(!drag && !reduce) g.rotation.y += hover >= 0 ? .0008 : .0035;
    tx += (nx * .5 - tx) * .05; ty += (ny * .3 - ty) * .05; cam.position.x = tx * 3; cam.position.y = 1.5 - ty * 3; cam.lookAt(0, 0, 0);
    r.render(sc, cam);
  })(0);
}
