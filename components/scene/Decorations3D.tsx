"use client";

import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";

import { layoutToWorld } from "@/lib/simulation/world3d.ts";

/**
 * Ambient office decorations — plants, couches, coffee bar, water cooler,
 * bookshelves, wall art. Purely cosmetic; no agent interaction. Fills empty
 * floor area so the office feels lived-in.
 */
export function Decorations3D() {
  return (
    <group>
      {/* ---- Plants scattered around the floor ---- */}
      <Plant at={[6, 30]} variant="palm" />
      <Plant at={[32, 32]} variant="bush" />
      <Plant at={[71, 30]} variant="palm" />
      <Plant at={[6, 62]} variant="bush" />
      <Plant at={[32, 60]} variant="palm" />
      <Plant at={[71, 60]} variant="bush" />
      <Plant at={[97, 50]} variant="palm" />
      <Plant at={[50, 95]} variant="bush" />
      <Plant at={[18, 95]} variant="palm" />

      {/* ---- Coffee bar in the strategy room corner ---- */}
      <CoffeeBar at={[28, 8]} />

      {/* ---- Water cooler near engineering ---- */}
      <WaterCooler at={[66, 6]} />

      {/* ---- Couch in design studio ---- */}
      <Couch at={[76, 25]} />

      {/* ---- Couch in growth room ---- */}
      <Couch at={[8, 90]} rotation={Math.PI / 2} />

      {/* ---- Bookshelf in QA lab ---- */}
      <Bookshelf at={[4, 50]} />

      {/* ---- Bookshelf in security ---- */}
      <Bookshelf at={[74, 55]} />

      {/* ---- Wall art frames ---- */}
      <WallArt at={[26, 4]} accent="#60a5fa" />
      <WallArt at={[44, 4]} accent="#22d3ee" />
      <WallArt at={[88, 4]} accent="#a78bfa" />
      <WallArt at={[18, 65]} accent="#10b981" />

      {/* ---- Deployment monitor wall ---- */}
      <MonitorWall at={[52, 50]} />
    </group>
  );
}

// ---------- primitives ----------

function Plant({ at, variant }: { at: [number, number]; variant: "palm" | "bush" }) {
  const [x, z] = layoutToWorld(at[0], at[1]);

  if (variant === "palm") {
    return (
      <group position={[x, 0, z]}>
        {/* Pot */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.32, 0.6, 16]} />
          <meshStandardMaterial color="#3a2e22" roughness={0.7} metalness={0.05} />
        </mesh>
        {/* Soil top */}
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.40, 0.40, 0.05, 16]} />
          <meshStandardMaterial color="#1a1308" roughness={1} />
        </mesh>
        {/* Trunk */}
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 1.6, 8]} />
          <meshStandardMaterial color="#5a4426" roughness={0.7} />
        </mesh>
        {/* Fronds */}
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.sin(a) * 0.6, 2.25, Math.cos(a) * 0.6]}
              rotation={[-0.4, a, 0]}
              castShadow
            >
              <coneGeometry args={[0.18, 1.1, 6]} />
              <meshStandardMaterial
                color="#4ea569"
                emissive="#4ea569"
                emissiveIntensity={0.08}
                roughness={0.65}
              />
            </mesh>
          );
        })}
      </group>
    );
  }

  // bush
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.32, 0.56, 16]} />
        <meshStandardMaterial color="#3a2e22" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial
          color="#3f9461"
          emissive="#3f9461"
          emissiveIntensity={0.10}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[-0.25, 1.2, 0.1]} castShadow>
        <sphereGeometry args={[0.32, 12, 12]} />
        <meshStandardMaterial
          color="#52a872"
          emissive="#52a872"
          emissiveIntensity={0.10}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[0.3, 1.15, -0.1]} castShadow>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial
          color="#3f9461"
          emissive="#3f9461"
          emissiveIntensity={0.10}
          roughness={0.7}
        />
      </mesh>
    </group>
  );
}

function CoffeeBar({ at }: { at: [number, number] }) {
  const [x, z] = layoutToWorld(at[0], at[1]);
  return (
    <group position={[x, 0, z]}>
      {/* Counter */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 1.0, 0.9]} />
        <meshStandardMaterial color="#6b513a" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Counter top */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[2.5, 0.08, 1.0]} />
        <meshStandardMaterial color="#2a3550" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Espresso machine */}
      <mesh position={[-0.7, 1.32, 0]} castShadow>
        <boxGeometry args={[0.55, 0.5, 0.45]} />
        <meshStandardMaterial color="#1a2030" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[-0.7, 1.45, 0.23]}>
        <boxGeometry args={[0.42, 0.10, 0.02]} />
        <meshStandardMaterial color="#5eebff" emissive="#5eebff" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      {/* Cups */}
      <mesh position={[0.4, 1.2, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.12, 16]} />
        <meshStandardMaterial color="#f4f5f7" roughness={0.5} />
      </mesh>
      <mesh position={[0.6, 1.2, 0.1]}>
        <cylinderGeometry args={[0.07, 0.06, 0.12, 16]} />
        <meshStandardMaterial color="#f4f5f7" roughness={0.5} />
      </mesh>
      <mesh position={[0.78, 1.2, -0.05]}>
        <cylinderGeometry args={[0.07, 0.06, 0.12, 16]} />
        <meshStandardMaterial color="#f4f5f7" roughness={0.5} />
      </mesh>
    </group>
  );
}

function WaterCooler({ at }: { at: [number, number] }) {
  const [x, z] = layoutToWorld(at[0], at[1]);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.7, 0.9, 0.6]} />
        <meshStandardMaterial color="#cfd8e6" roughness={0.35} metalness={0.25} />
      </mesh>
      {/* Bottle */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.30, 0.7, 18]} />
        <meshStandardMaterial
          color="#9bcaf5"
          transparent
          opacity={0.6}
          roughness={0.1}
          metalness={0.0}
        />
      </mesh>
      {/* Spigot */}
      <mesh position={[0, 0.55, 0.32]}>
        <boxGeometry args={[0.18, 0.08, 0.08]} />
        <meshStandardMaterial color="#2a3550" roughness={0.4} metalness={0.7} />
      </mesh>
    </group>
  );
}

function Couch({ at, rotation = 0 }: { at: [number, number]; rotation?: number }) {
  const [x, z] = layoutToWorld(at[0], at[1]);
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      {/* Seat */}
      <RoundedBox args={[2.6, 0.6, 1.0]} radius={0.12} smoothness={3} position={[0, 0.35, 0]} castShadow>
        <meshStandardMaterial color="#4f5b78" roughness={0.6} metalness={0.05} />
      </RoundedBox>
      {/* Back */}
      <RoundedBox args={[2.6, 0.8, 0.3]} radius={0.1} smoothness={3} position={[0, 0.95, -0.45]} castShadow>
        <meshStandardMaterial color="#4f5b78" roughness={0.6} metalness={0.05} />
      </RoundedBox>
      {/* Cushions */}
      <RoundedBox args={[1.1, 0.18, 0.85]} radius={0.06} smoothness={3} position={[-0.65, 0.7, 0.05]}>
        <meshStandardMaterial color="#5f6e92" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[1.1, 0.18, 0.85]} radius={0.06} smoothness={3} position={[0.65, 0.7, 0.05]}>
        <meshStandardMaterial color="#5f6e92" roughness={0.7} />
      </RoundedBox>
      {/* Throw pillow */}
      <RoundedBox args={[0.35, 0.32, 0.35]} radius={0.08} smoothness={3} position={[1.05, 0.95, 0.05]}>
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.18} />
      </RoundedBox>
      {/* Side table with mug */}
      <mesh position={[1.65, 0.3, 0]} castShadow>
        <boxGeometry args={[0.5, 0.6, 0.5]} />
        <meshStandardMaterial color="#8b6c4c" roughness={0.6} />
      </mesh>
      <mesh position={[1.65, 0.68, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.13, 16]} />
        <meshStandardMaterial color="#f4f5f7" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Bookshelf({ at }: { at: [number, number] }) {
  const [x, z] = layoutToWorld(at[0], at[1]);
  const books = useMemo(() => generateBooks(), []);
  return (
    <group position={[x, 0, z]}>
      {/* Frame */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[0.4, 2.6, 1.8]} />
        <meshStandardMaterial color="#5a4426" roughness={0.7} />
      </mesh>
      {/* Shelves (visible as thin boxes) + books */}
      {[0.5, 1.1, 1.7, 2.3].map((shelfY, sIdx) => (
        <group key={sIdx} position={[0, shelfY, 0]}>
          <mesh position={[0.05, 0, 0]}>
            <boxGeometry args={[0.32, 0.04, 1.7]} />
            <meshStandardMaterial color="#3a2e1c" />
          </mesh>
          {books[sIdx].map((b, i) => (
            <mesh key={i} position={[0.05, 0.18, -0.75 + i * 0.18]}>
              <boxGeometry args={[0.18, 0.3, 0.13]} />
              <meshStandardMaterial color={b} emissive={b} emissiveIntensity={0.06} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function WallArt({ at, accent }: { at: [number, number]; accent: string }) {
  const [x, z] = layoutToWorld(at[0], at[1]);
  return (
    <group position={[x, 2.2, z]}>
      {/* Frame */}
      <mesh>
        <boxGeometry args={[1.6, 1.0, 0.08]} />
        <meshStandardMaterial color="#1a2540" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Inner glow plate */}
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[1.45, 0.85]} />
        <meshStandardMaterial
          color="#0f1c30"
          emissive={accent}
          emissiveIntensity={0.55}
          toneMapped={false}
        />
      </mesh>
      {/* Decorative stripes */}
      {[-0.25, 0, 0.25].map((dy, i) => (
        <mesh key={i} position={[0, dy, 0.048]}>
          <planeGeometry args={[1.0, 0.05]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.1}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function MonitorWall({ at }: { at: [number, number] }) {
  const [x, z] = layoutToWorld(at[0], at[1]);
  return (
    <group position={[x, 0, z]}>
      {/* Stand */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[3.0, 0.8, 0.5]} />
        <meshStandardMaterial color="#2a3550" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* 3 monitors side by side */}
      {[-1.05, 0, 1.05].map((dx, i) => (
        <group key={i} position={[dx, 1.7, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.95, 0.58, 0.08]} />
            <meshStandardMaterial color="#1a2235" roughness={0.45} metalness={0.65} />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[0.88, 0.51]} />
            <meshStandardMaterial
              color="#10283a"
              emissive={i === 1 ? "#34d399" : "#5eebff"}
              emissiveIntensity={1.0}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- helpers ----------

function generateBooks(): string[][] {
  // 4 shelves × N books, deterministic palette.
  const palette = [
    "#dc2626",
    "#fbbf24",
    "#3b82f6",
    "#10b981",
    "#a855f7",
    "#ec4899",
    "#f97316",
    "#14b8a6",
    "#84cc16",
  ];
  const shelves: string[][] = [];
  for (let s = 0; s < 4; s++) {
    const row: string[] = [];
    for (let i = 0; i < 9; i++) {
      row.push(palette[(s * 9 + i) % palette.length] ?? "#888");
    }
    shelves.push(row);
  }
  return shelves;
}
