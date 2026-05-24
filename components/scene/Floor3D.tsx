"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { FLOOR_SIZE } from "@/lib/simulation/world3d.ts";

/** A subtle dark grid floor — gives the office spatial structure. */
export function Floor3D() {
  const gridTex = useMemo(() => createGridTexture(), []);

  return (
    <group>
      {/* Main floor plate */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshStandardMaterial
          color="#3d4a6a"
          roughness={0.8}
          metalness={0.08}
          map={gridTex}
        />
      </mesh>

      {/* Outer plate so the camera doesn't see void on rotation */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[FLOOR_SIZE * 2, FLOOR_SIZE * 2]} />
        <meshStandardMaterial color="#1a2640" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

function createGridTexture(): THREE.Texture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Lighter, more visible base — mid grey-blue.
  ctx.fillStyle = "#3d4a6a";
  ctx.fillRect(0, 0, size, size);

  // Minor grid — clearly visible.
  ctx.strokeStyle = "rgba(200, 215, 240, 0.18)";
  ctx.lineWidth = 1;
  const cell = 32;
  for (let i = 0; i <= size; i += cell) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Major grid — pronounced.
  ctx.strokeStyle = "rgba(220, 230, 250, 0.32)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= size; i += cell * 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 8;
  return tex;
}
