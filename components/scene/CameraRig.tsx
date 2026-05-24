"use client";

// components/scene/CameraRig.tsx
//
// Owns the camera controls and:
//   - Allows the user to drag-pan (left mouse) and rotate (right mouse).
//   - Smoothly pans the camera target toward a focused agent.
//   - Resets to office centre when no agent is selected.
//   - Stops fighting the user — manual interaction always wins.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { MapControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { VisualAgent } from "@/lib/simulation/types.ts";
import { layoutToWorld } from "@/lib/simulation/world3d.ts";

export interface CameraRigHandle {
  reset(): void;
}

interface CameraRigProps {
  focusedAgent: VisualAgent | null;
}

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(
  function CameraRig({ focusedAgent }, ref) {
    const controlsRef = useRef<any>(null);
    const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));
    const desiredDistance = useRef<number | null>(null);
    const interacting = useRef(false);
    const { camera } = useThree();

    useImperativeHandle(ref, () => ({
      reset() {
        desiredTarget.current.set(0, 0, 0);
        desiredDistance.current = 80;
      },
    }));

    // When focus changes, recompute the desired target.
    useEffect(() => {
      if (focusedAgent) {
        const [wx, wz] = layoutToWorld(focusedAgent.x, focusedAgent.y);
        desiredTarget.current.set(wx, 1.0, wz);
      } else {
        desiredTarget.current.set(0, 0, 0);
      }
    }, [focusedAgent]);

    // Manual interaction should win: when the user starts dragging, freeze the
    // automatic lerp by snapping the desired target to wherever the user puts it.
    useEffect(() => {
      const c = controlsRef.current;
      if (!c) return;
      const onStart = () => {
        interacting.current = true;
      };
      const onEnd = () => {
        interacting.current = false;
        desiredTarget.current.copy(c.target);
        desiredDistance.current = null;
      };
      c.addEventListener("start", onStart);
      c.addEventListener("end", onEnd);
      return () => {
        c.removeEventListener("start", onStart);
        c.removeEventListener("end", onEnd);
      };
    }, []);

    // Smoothly lerp the orbit target each frame (unless the user is dragging).
    useFrame((_, dt) => {
      const c = controlsRef.current;
      if (!c || interacting.current) return;
      const cur = c.target as THREE.Vector3;
      const lerp = 1 - Math.exp(-dt * 3.5);
      cur.x += (desiredTarget.current.x - cur.x) * lerp;
      cur.y += (desiredTarget.current.y - cur.y) * lerp;
      cur.z += (desiredTarget.current.z - cur.z) * lerp;

      // If a desired distance is set (reset action), interpolate camera.
      if (desiredDistance.current != null) {
        const dir = camera.position.clone().sub(cur).normalize();
        const current = camera.position.distanceTo(cur);
        const next = current + (desiredDistance.current - current) * lerp;
        camera.position.copy(cur).addScaledVector(dir, next);
        if (Math.abs(next - desiredDistance.current) < 0.5) {
          desiredDistance.current = null;
        }
      }

      c.update();
    });

    // MapControls = OrbitControls with left=pan / right=rotate defaults.
    // Far more intuitive for navigating a top-down office floor plan.
    return (
      <MapControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.1}
        screenSpacePanning={false}
        minDistance={18}
        maxDistance={200}
        minPolarAngle={Math.PI / 7}
        maxPolarAngle={Math.PI / 2.1}
        zoomSpeed={0.9}
        panSpeed={1.0}
        rotateSpeed={0.7}
      />
    );
  },
);
