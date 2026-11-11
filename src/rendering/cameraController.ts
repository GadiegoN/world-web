/**
 * VOLUME 03.6 & 10.3 — CONTROLADOR MATEMÁTICO DE CÂMERA 3D
 * Isola o cálculo de posição e alvo (LookAt) para as 6 escalas de visualização:
 * Orbital, Pangeia (Continental), Cidade, Tour de Drone, Modo Rua (1ª pessoa) e Construção.
 */

import { World } from "@/domain/types";
import { PLANET_BASE_RADIUS } from "@/generation/geographyGenerator";
import * as THREE from "three";
import { CameraScaleMode } from "./atmospherePresets";

export interface CameraControllerState {
  world: World | null;
  cameraMode: CameraScaleMode;
  selectedBuildingId: string | null;
  orbitYaw: number;
  orbitPitch: number;
  zoomDistanceMultiplier: number;
  streetPos: { x: number; z: number };
  streetYaw: number;
  streetPitch: number;
}

export function computeCameraPose(
  state: CameraControllerState,
  elapsedSeconds: number
): {
  showOrbital: boolean;
  showCity: boolean;
  targetCamPos: THREE.Vector3;
  targetLookAt: THREE.Vector3;
} {
  const {
    world: activeWorld,
    cameraMode: mode,
    selectedBuildingId: selId,
    orbitYaw,
    orbitPitch,
    zoomDistanceMultiplier,
    streetPos,
    streetYaw,
    streetPitch,
  } = state;

  const targetCamPos = new THREE.Vector3();
  const targetLookAt = new THREE.Vector3();

  if (!activeWorld || mode === "orbital") {
    const dist = 305 * zoomDistanceMultiplier;
    targetCamPos.set(
      Math.sin(orbitYaw) * Math.cos(orbitPitch * 0.6) * dist,
      Math.sin(orbitPitch * 0.6) * dist,
      Math.cos(orbitYaw) * Math.cos(orbitPitch * 0.6) * dist
    );
    targetLookAt.set(0, 0, 0);
    return {
      showOrbital: true,
      showCity: false,
      targetCamPos,
      targetLookAt,
    };
  }

  if (mode === "continental") {
    const cityPos = new THREE.Vector3(
      activeWorld.city.position.x,
      activeWorld.city.position.y,
      activeWorld.city.position.z
    );
    const normal = cityPos.clone().normalize();
    const dist = (PLANET_BASE_RADIUS + 82) * zoomDistanceMultiplier;

    const tangentRight = new THREE.Vector3(
      activeWorld.city.tangentBasis.tangentEast.x,
      activeWorld.city.tangentBasis.tangentEast.y,
      activeWorld.city.tangentBasis.tangentEast.z
    );
    const tangentUp = new THREE.Vector3(
      activeWorld.city.tangentBasis.tangentNorth.x,
      activeWorld.city.tangentBasis.tangentNorth.y,
      activeWorld.city.tangentBasis.tangentNorth.z
    );

    targetCamPos
      .copy(normal)
      .multiplyScalar(dist)
      .addScaledVector(tangentRight, Math.sin(orbitYaw) * 28)
      .addScaledVector(tangentUp, -18 + Math.sin(orbitPitch) * 15);
    targetLookAt.copy(cityPos);

    return {
      showOrbital: true,
      showCity: false,
      targetCamPos,
      targetLookAt,
    };
  }

  if (mode === "city") {
    const cityRadius = Math.max(46, activeWorld.city.urbanRadius * 1.12);
    const dist = cityRadius * 1.3 * zoomDistanceMultiplier;
    const safePitch = Math.max(0.22, Math.min(1.35, orbitPitch));

    targetCamPos.set(
      Math.sin(orbitYaw) * Math.cos(safePitch) * dist,
      Math.max(8, Math.sin(safePitch) * dist),
      Math.cos(orbitYaw) * Math.cos(safePitch) * dist
    );
    targetLookAt.set(0, 7, 0);

    return {
      showOrbital: false,
      showCity: true,
      targetCamPos,
      targetLookAt,
    };
  }

  if (mode === "drone") {
    const droneAngle = elapsedSeconds * 0.22;
    const baseRadius =
      Math.max(34, activeWorld.city.urbanRadius * 0.72) *
      zoomDistanceMultiplier;
    const waveHeight = 18 + Math.sin(elapsedSeconds * 0.45) * 8;

    targetCamPos.set(
      Math.sin(droneAngle) * baseRadius,
      waveHeight,
      Math.cos(droneAngle) * baseRadius
    );
    targetLookAt.set(
      Math.sin(droneAngle + 0.9) * (baseRadius * 0.25),
      10 + Math.cos(elapsedSeconds * 0.35) * 4,
      Math.cos(droneAngle + 0.9) * (baseRadius * 0.25)
    );

    return {
      showOrbital: false,
      showCity: true,
      targetCamPos,
      targetLookAt,
    };
  }

  if (mode === "street") {
    const eyeX = streetPos.x;
    const eyeY = 2.1;
    const eyeZ = streetPos.z;

    const lookDirX = Math.sin(streetYaw) * Math.cos(streetPitch);
    const lookDirY = Math.sin(streetPitch);
    const lookDirZ = Math.cos(streetYaw) * Math.cos(streetPitch);

    targetCamPos.set(eyeX, eyeY, eyeZ);
    targetLookAt.set(
      eyeX + lookDirX * 25,
      eyeY + lookDirY * 25,
      eyeZ + lookDirZ * 25
    );

    return {
      showOrbital: false,
      showCity: true,
      targetCamPos,
      targetLookAt,
    };
  }

  // mode === "building"
  const targetBldg =
    activeWorld.buildings.find((b) => b.id === selId) ??
    activeWorld.buildings[0];

  if (targetBldg) {
    const bx = targetBldg.position.x;
    const bz = targetBldg.position.z;
    const bh = targetBldg.geometryParameters.height;
    const dist = Math.max(22, bh * 1.3) * zoomDistanceMultiplier;
    const safePitch = Math.max(0.18, Math.min(1.2, orbitPitch));

    targetCamPos.set(
      bx + Math.sin(orbitYaw) * Math.cos(safePitch) * dist,
      Math.max(4, bh * 0.55 + Math.sin(safePitch) * dist * 0.48),
      bz + Math.cos(orbitYaw) * Math.cos(safePitch) * dist
    );
    targetLookAt.set(bx, bh * 0.48, bz);
  } else {
    targetCamPos.set(0, 45, 85);
    targetLookAt.set(0, 0, 0);
  }

  return {
    showOrbital: false,
    showCity: true,
    targetCamPos,
    targetLookAt,
  };
}

