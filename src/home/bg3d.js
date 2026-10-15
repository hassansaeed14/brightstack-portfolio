// The homepage's background wireframe shapes (#bg3d). index.html imports this once the page has loaded
// and the browser is idle, so three.js isn't part of the first load.
import * as THREE from '../3d/three.js';

// canvas: the #bg3d canvas; input: live pointer and scroll values from index.html; reduce: prefers reduced
// motion (one still frame); lite: phone or low-core device (fewer segments).
export function startBackground({ canvas, input, reduce, lite }){
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch(e){ return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 1, .1, 200); cam.position.z = 14;
  const shapes = [[new THREE.TorusKnotGeometry(2.2, .5, lite ? 80 : 140, lite ? 10 : 14), 9, -7, -12, 0x00e5ff], [new THREE.IcosahedronGeometry(3, 1), -10, -24, -14, 0x8b5cf6], [new THREE.TorusGeometry(3, .6, 12, lite ? 32 : 48), 10, -41, -13, 0xffd8bd], [new THREE.OctahedronGeometry(3, 0), -9, -58, -13, 0x00e5ff]].map(a => {
    const m = new THREE.Mesh(a[0], new THREE.MeshBasicMaterial({ color: a[4], wireframe: true, transparent: true, opacity: .09 })); m.position.set(a[1], a[2], a[3]); scene.add(m); return m; });
  function size(){ renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
  addEventListener('resize', size); size();
  let sy = 0;
  function frame(t){
    const { nx, ny } = input;
    sy += (input.scrollY - sy) * .06;
    cam.position.y = -sy * .018;
    cam.position.x += (nx * 3 - cam.position.x) * .04;
    cam.rotation.y += ((-nx * .08) - cam.rotation.y) * .04;
    cam.rotation.x += ((ny * .05) - cam.rotation.x) * .04;
    shapes.forEach((m, i) => { m.rotation.x = t * .00012 * (i + 1) + sy * .0015; m.rotation.y = t * .00009 * (i + 2); });
    renderer.render(scene, cam);
  }
  if(reduce){ frame(0); return; }
  (function loop(t){ requestAnimationFrame(loop); if(!document.hidden) frame(t); })(0);
}
