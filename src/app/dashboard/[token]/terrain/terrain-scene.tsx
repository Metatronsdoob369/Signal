"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Terrain } from "@/lib/terrain/build";
import { contourSegments, heightAt, sampleField } from "@/lib/terrain/field";
import { temperatureRgb } from "@/lib/terrain/temperature";

const COLS = 112;
const ROWS = 112;
const EXTENT = 1.25;
const HEIGHT_SCALE = 0.8;
const LEVELS = 9;
const ORBIT_RADIUS = 2.2;
const ORBIT_HEIGHT = 1.02;
const ORBIT_SPEED = 0.00006;
const ZONE_WORD = { hot: "hot", warm: "warm", cold: "cold" } as const;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function srgb(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
}

function temperature(heat: number): THREE.Color {
  const [r, g, b] = temperatureRgb(heat);
  return srgb(r, g, b);
}

type Chip = { element: HTMLDivElement; world: THREE.Vector3 };

function mountScene(container: HTMLElement, terrain: Terrain): () => void {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "terrain-webgl";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0b0d, 3.1, 6.4);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  const target = new THREE.Vector3(0, 0.16, 0);

  const floor = srgb(0x12 / 255, 0x14 / 255, 0x18 / 255);

  // Ground: a heightfield of Gaussian hills, coloured by temperature and lifted out of the ash floor.
  const field = sampleField(terrain, { cols: COLS, rows: ROWS, extent: EXTENT });
  const ground = new THREE.PlaneGeometry(2 * EXTENT, 2 * EXTENT, COLS, ROWS);
  ground.rotateX(-Math.PI / 2);
  const position = ground.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const peak = Math.max(field.maxHeight, 1e-6);
  const mixed = new THREE.Color();
  for (let k = 0; k < position.count; k++) {
    const h = field.heights[k];
    position.setY(k, h * HEIGHT_SCALE);
    const lift = smoothstep(0.03, 0.6, h / peak);
    mixed.lerpColors(floor, temperature(field.heats[k]), lift);
    colors[k * 3] = mixed.r;
    colors[k * 3 + 1] = mixed.g;
    colors[k * 3 + 2] = mixed.b;
  }
  position.needsUpdate = true;
  ground.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const groundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.04 });
  scene.add(new THREE.Mesh(ground, groundMaterial));

  const apron = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: floor, roughness: 1, metalness: 0 }),
  );
  apron.position.y = -0.003;
  scene.add(apron);

  // Contours: sage line-work laid on the surface. Sage is never a status colour.
  const vertices: number[] = [];
  for (const level of contourSegments(field, LEVELS)) {
    for (const [x1, y1, x2, y2] of level) {
      for (const [gx, gy] of [
        [x1, y1],
        [x2, y2],
      ]) {
        vertices.push(
          -EXTENT + (gx / COLS) * 2 * EXTENT,
          heightAt(field, gx, gy) * HEIGHT_SCALE + 0.0035,
          -EXTENT + (gy / ROWS) * 2 * EXTENT,
        );
      }
    }
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  scene.add(
    new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: 0x8a9a86, transparent: true, opacity: 0.4, depthWrite: false }),
    ),
  );

  // Pages: an emissive marker in the page's temperature on its own hill, with a DOM chip.
  const chips: Chip[] = [];
  for (const point of terrain.points) {
    const colour = temperature(point.heat);
    const y = point.substance * HEIGHT_SCALE;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 24, 16),
      new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 1.5, roughness: 0.35 }),
    );
    marker.position.set(point.position[0], y + 0.028, point.position[2]);
    scene.add(marker);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.075, 0.083, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.position.set(point.position[0], y + 0.006, point.position[2]);
    scene.add(ring);

    const chip = document.createElement("div");
    chip.className = "terrain-chip";
    chip.dataset.testid = "terrain-chip";
    const dot = document.createElement("span");
    dot.className = "terrain-dot";
    dot.style.background = `#${colour.getHexString()}`;
    const path = document.createElement("span");
    path.className = "terrain-mono";
    path.textContent = point.path;
    const score = document.createElement("span");
    score.className = "terrain-muted";
    score.textContent = ` ${Math.round(point.scores.overall)} · ${ZONE_WORD[point.zone]}`;
    chip.append(dot, path, score);
    container.appendChild(chip);
    chips.push({ element: chip, world: new THREE.Vector3(point.position[0], y + 0.06, point.position[2]) });
  }

  scene.add(new THREE.HemisphereLight(0x39404b, 0x07080a, 0.8));
  const key = new THREE.DirectionalLight(0xffdcc0, 1.7);
  key.position.set(2.4, 3.0, 1.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x5b6470, 0.45);
  fill.position.set(-2.5, 1.2, -2.0);
  scene.add(fill);

  let width = 1;
  let height = 1;
  const resize = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(() => {
    resize();
    if (reducedMotion) frame(performance.now());
  });
  observer.observe(container);

  let pointerX = 0;
  let pointerY = 0;
  let easedX = 0;
  let easedY = 0;
  const onPointerMove = (event: PointerEvent) => {
    pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    pointerY = (event.clientY / window.innerHeight) * 2 - 1;
  };
  const onPointerLeave = () => {
    pointerX = 0;
    pointerY = 0;
  };
  if (!reducedMotion) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
  }

  let angle = 0.85;
  let last = performance.now();
  let raf = 0;
  const projected = new THREE.Vector3();

  const frame = (now: number) => {
    const dt = Math.min(64, now - last);
    last = now;
    if (!reducedMotion) {
      angle += dt * ORBIT_SPEED;
      easedX += (pointerX - easedX) * 0.04;
      easedY += (pointerY - easedY) * 0.04;
    }
    const a = angle + easedX * 0.16;
    camera.position.set(Math.cos(a) * ORBIT_RADIUS, ORBIT_HEIGHT - easedY * 0.14, Math.sin(a) * ORBIT_RADIUS);
    camera.lookAt(target);
    renderer.render(scene, camera);

    for (const chip of chips) {
      projected.copy(chip.world).project(camera);
      const visible = projected.z < 1;
      chip.element.style.opacity = visible ? "1" : "0";
      chip.element.style.transform = `translate(${((projected.x + 1) / 2) * width}px, ${((1 - projected.y) / 2) * height}px)`;
    }
  };

  const loop = (now: number) => {
    frame(now);
    raf = window.requestAnimationFrame(loop);
  };
  if (reducedMotion) {
    frame(performance.now());
  } else {
    raf = window.requestAnimationFrame(loop);
  }

  return () => {
    window.cancelAnimationFrame(raf);
    observer.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerleave", onPointerLeave);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const material = object.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    });
    renderer.dispose();
    container.replaceChildren();
  };
}

export function TerrainScene({ terrain }: { terrain: Terrain }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return mountScene(element, terrain);
  }, [terrain]);
  return <div ref={ref} className="terrain-canvas" data-testid="terrain-canvas" />;
}
