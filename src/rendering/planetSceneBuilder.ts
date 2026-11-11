/**
 * VOLUME 03 & 04 — CONSTRUTOR DE CENA PLANETÁRIA E PANGEIA
 * Constrói a malha esférica com relevo harmônico da Pangeia única, halo atmosférico,
 * o Sinalizador Canônico da Cidade Única do Usuário e os Portais de Conexão de Seguidores.
 */

import { Continent, World } from "@/domain/types";
import {
  evaluatePangeiaElevation,
  PLANET_BASE_RADIUS,
} from "@/generation/geographyGenerator";
import * as THREE from "three";
import { DEFAULT_PREVIEW_CONTINENT } from "./atmospherePresets";

export function buildPlanetMesh(
  continent: Continent,
  oceanColorHex: string
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(PLANET_BASE_RADIUS, 104, 78);
  const posAttr = geometry.attributes.position;
  const vertexCount = posAttr.count;
  const colors = new Float32Array(vertexCount * 3);

  const colorOceanDeep = new THREE.Color(oceanColorHex).multiplyScalar(0.7);
  const colorOceanShallow = new THREE.Color(oceanColorHex).lerp(
    new THREE.Color("#0284c7"),
    0.38
  );
  const colorCoast = new THREE.Color(continent.palette.coast);
  const colorLowland = new THREE.Color(continent.palette.lowland);
  const colorHighland = new THREE.Color(continent.palette.highland);
  const colorMountain = new THREE.Color(continent.palette.mountain);
  const tempColor = new THREE.Color();

  for (let i = 0; i < vertexCount; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);

    const r = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const latDeg = (Math.asin(vy / r) * 180) / Math.PI;
    const lonDeg = (Math.atan2(vx, vz) * 180) / Math.PI;

    const elev = evaluatePangeiaElevation(latDeg, lonDeg, continent);

    if (elev > 0) {
      const displacement = 1 + elev * 0.048;
      posAttr.setXYZ(
        i,
        vx * displacement,
        vy * displacement,
        vz * displacement
      );

      if (elev < 0.06) {
        tempColor.copy(colorCoast).lerp(colorLowland, elev / 0.06);
      } else if (elev < 0.38) {
        tempColor.copy(colorLowland).lerp(colorHighland, (elev - 0.06) / 0.32);
      } else {
        tempColor
          .copy(colorHighland)
          .lerp(colorMountain, Math.min(1, (elev - 0.38) / 0.45));
      }
    } else {
      const depthFactor = Math.min(1, Math.abs(elev) / 0.65);
      tempColor.copy(colorOceanShallow).lerp(colorOceanDeep, depthFactor);
    }

    colors[i * 3] = tempColor.r;
    colors[i * 3 + 1] = tempColor.g;
    colors[i * 3 + 2] = tempColor.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.76,
    metalness: 0.14,
  });

  return new THREE.Mesh(geometry, material);
}

export function populateOrbitalScene(
  orbitalGroup: THREE.Group,
  world: World | null
): { initialYaw: number; initialPitch: number } | null {
  const continent = world ? world.continent : DEFAULT_PREVIEW_CONTINENT;
  const oceanColor = world ? world.planet.oceanColor : "#082f49";
  const atmosphereColor = world ? world.planet.atmosphereColor : "#38bdf8";

  const planetMesh = buildPlanetMesh(continent, oceanColor);
  orbitalGroup.add(planetMesh);

  const atmosGeo = new THREE.SphereGeometry(
    PLANET_BASE_RADIUS * 1.068,
    64,
    48
  );
  const atmosMat = new THREE.MeshBasicMaterial({
    color: atmosphereColor,
    transparent: true,
    opacity: 0.14,
    side: THREE.BackSide,
  });
  orbitalGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

  // Anel de telemetria orbital ao redor do planeta
  const orbitRingGeo = new THREE.RingGeometry(
    PLANET_BASE_RADIUS * 1.24,
    PLANET_BASE_RADIUS * 1.255,
    96
  );
  orbitRingGeo.rotateX(Math.PI / 2.3);
  const orbitRingMat = new THREE.MeshBasicMaterial({
    color: atmosphereColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.22,
  });
  const orbitRingMesh = new THREE.Mesh(orbitRingGeo, orbitRingMat);
  orbitRingMesh.userData = { isOrbitalRing: true };
  orbitalGroup.add(orbitRingMesh);

  if (!world) return null;

  const cityVec = new THREE.Vector3(
    world.city.position.x,
    world.city.position.y,
    world.city.position.z
  );
  const normalVec = cityVec.clone().normalize();

  // Marco Luminoso da Cidade Única do Usuário na Pangeia (Volume 00.2 & ADR-004)
  const beaconGroup = new THREE.Group();
  beaconGroup.position.copy(cityVec);
  beaconGroup.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normalVec
  );

  const pinGeo = new THREE.CylinderGeometry(0.6, 2.2, 16, 16);
  pinGeo.translate(0, 8, 0);
  const pinMat = new THREE.MeshBasicMaterial({ color: "#38bdf8" });
  const pinMesh = new THREE.Mesh(pinGeo, pinMat);
  pinMesh.userData = { isCityBeacon: true };
  beaconGroup.add(pinMesh);

  const orbGeo = new THREE.SphereGeometry(2.8, 16, 16);
  orbGeo.translate(0, 17, 0);
  const orbMat = new THREE.MeshBasicMaterial({ color: "#f8fafc" });
  const orbMesh = new THREE.Mesh(orbGeo, orbMat);
  orbMesh.userData = { isCityBeacon: true };
  beaconGroup.add(orbMesh);

  const ringGeo = new THREE.RingGeometry(3.4, 5.6, 32);
  ringGeo.rotateX(-Math.PI / 2);
  ringGeo.translate(0, 0.5, 0);
  const ringMat = new THREE.MeshBasicMaterial({
    color: "#38bdf8",
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.userData = { isPulseRing: true, isCityBeacon: true };
  beaconGroup.add(ringMesh);

  orbitalGroup.add(beaconGroup);

  // Portais/Antenas de Conexão dos Seguidores na Pangeia ao redor da Cidade Principal (ADR-018)
  const followerOutposts = world.city.followerOutposts ?? [];
  for (const f of followerOutposts) {
    const fVec = new THREE.Vector3(f.position.x, f.position.y, f.position.z);
    const fNormal = fVec.clone().normalize();

    const fGroup = new THREE.Group();
    fGroup.position.copy(fVec);
    fGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      fNormal
    );

    const domeGeo = new THREE.SphereGeometry(
      1.6,
      12,
      10,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    const domeMat = new THREE.MeshStandardMaterial({
      color: f.color,
      emissive: f.color,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.userData = { isFollowerBeacon: true, followerLogin: f.login };
    fGroup.add(domeMesh);

    const fPinGeo = new THREE.CylinderGeometry(0.28, 0.95, 8.5, 10);
    fPinGeo.translate(0, 4.25, 0);
    const fPinMat = new THREE.MeshBasicMaterial({ color: f.color });
    const fPinMesh = new THREE.Mesh(fPinGeo, fPinMat);
    fPinMesh.userData = { isFollowerBeacon: true, followerLogin: f.login };
    fGroup.add(fPinMesh);

    const fOrbGeo = new THREE.SphereGeometry(1.25, 12, 12);
    fOrbGeo.translate(0, 9.2, 0);
    const fOrbMat = new THREE.MeshBasicMaterial({ color: "#f8fafc" });
    const fOrbMesh = new THREE.Mesh(fOrbGeo, fOrbMat);
    fOrbMesh.userData = { isFollowerBeacon: true, followerLogin: f.login };
    fGroup.add(fOrbMesh);

    const fRingGeo = new THREE.RingGeometry(1.9, 2.9, 24);
    fRingGeo.rotateX(-Math.PI / 2);
    fRingGeo.translate(0, 0.35, 0);
    const fRingMat = new THREE.MeshBasicMaterial({
      color: f.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    });
    const fRingMesh = new THREE.Mesh(fRingGeo, fRingMat);
    fRingMesh.userData = {
      isPulseRing: true,
      isFollowerBeacon: true,
      followerLogin: f.login,
    };
    fGroup.add(fRingMesh);

    orbitalGroup.add(fGroup);

    const midVec = cityVec
      .clone()
      .add(fVec)
      .multiplyScalar(0.5)
      .normalize()
      .multiplyScalar(
        PLANET_BASE_RADIUS + 14 + cityVec.distanceTo(fVec) * 0.22
      );
    const arcCurve = new THREE.QuadraticBezierCurve3(
      cityVec.clone().addScaledVector(normalVec, 2),
      midVec,
      fVec.clone().addScaledVector(fNormal, 2)
    );
    const arcGeo = new THREE.BufferGeometry().setFromPoints(
      arcCurve.getPoints(24)
    );
    const arcMat = new THREE.LineBasicMaterial({
      color: f.color,
      transparent: true,
      opacity: 0.38,
    });
    orbitalGroup.add(new THREE.Line(arcGeo, arcMat));
  }

  const initialYaw = Math.atan2(cityVec.x, cityVec.z);
  const initialPitch = Math.max(
    0.25,
    Math.min(1.1, Math.asin(cityVec.y / cityVec.length()) + 0.35)
  );
  return { initialYaw, initialPitch };
}

