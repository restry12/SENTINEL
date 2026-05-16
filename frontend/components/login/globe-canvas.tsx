'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const TEXTURE   = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const BUMP      = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-topology.png';
const SPECULAR  = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-water.png';

export function GlobeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef     = useRef({ x: 0, y: 0 });
  const targetRef    = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const w = el.clientWidth;
    const h = el.clientHeight;

    // --- Scene ---
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.z = 2.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    // --- Lights ---
    scene.add(new THREE.AmbientLight(0x222244, 2.5));
    const sun = new THREE.DirectionalLight(0xfff5e0, 3.5);
    sun.position.set(4, 2, 5);
    scene.add(sun);
    // Subtle fill light from opposite side
    const fill = new THREE.DirectionalLight(0x112244, 0.5);
    fill.position.set(-4, -2, -3);
    scene.add(fill);

    // --- Earth mesh ---
    const loader = new THREE.TextureLoader();
    const geo    = new THREE.SphereGeometry(1, 96, 96);
    const mat    = new THREE.MeshPhongMaterial({
      map:         loader.load(TEXTURE),
      bumpMap:     loader.load(BUMP),
      bumpScale:   0.04,
      specularMap: loader.load(SPECULAR),
      specular:    new THREE.Color(0x224466),
      shininess:   18,
    });
    const earth = new THREE.Mesh(geo, mat);
    earth.rotation.y = -1.2; // start roughly over Africa/Europe
    scene.add(earth);

    // --- Atmosphere rim glow ---
    const atmGeo = new THREE.SphereGeometry(1.025, 64, 64);
    const atmMat = new THREE.MeshPhongMaterial({
      color:       0x38bdf8,
      transparent: true,
      opacity:     0.06,
      side:        THREE.FrontSide,
    });
    scene.add(new THREE.Mesh(atmGeo, atmMat));

    // --- Mouse tracking ---
    const onMouseMove = (e: MouseEvent) => {
      targetRef.current = {
        x:  (e.clientY / window.innerHeight - 0.5) * 1.8,
        y: -(e.clientX / window.innerWidth  - 0.5) * 1.8,
      };
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // --- Animation loop ---
    let raf: number;
    const tick = () => {
      raf = requestAnimationFrame(tick);

      // Smooth lerp mouse tilt
      mouseRef.current.x += (targetRef.current.x - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (targetRef.current.y - mouseRef.current.y) * 0.05;

      earth.rotation.x = mouseRef.current.x * 0.5;
      earth.rotation.y += 0.0012; // slow auto-spin

      // Exaggerated camera parallax
      camera.position.x = mouseRef.current.y * 1.1;
      camera.position.y = -mouseRef.current.x * 1.1;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };
    tick();

    // --- Resize ---
    const onResize = () => {
      const nw = el.clientWidth;
      const nh = el.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouseMove);
      ro.disconnect();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }}
    />
  );
}
