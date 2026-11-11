/**
 * VOLUME 06 & 09 — CONSTRUTOR DE CENA DA CIDADE 3D (OTIMIZADO COM INSTANCED MESH)
 * - Utiliza `THREE.InstancedMesh` para árvores dos parques e postes de iluminação urbana
 *   (reduzindo centenas de draw calls individuais para 4 chamadas instanciadas na GPU).
 * - Utiliza cache compartilhado de texturas de fachada (`getCachedBuildingFacadeTexture`).
 * - Renderiza a vegetação sazonal por recência de atualização (`pushed_at` -> ADR-017).
 */

import { Building, World } from "@/domain/types";
import * as THREE from "three";
import { AtmospherePreset, AtmosphereTimeMode } from "./atmospherePresets";
import { getCachedBuildingFacadeTexture } from "./facadeMaterialCache";

export function populateCityScene(
  cityStageGroup: THREE.Group,
  world: World,
  preset: AtmospherePreset,
  timeMode: AtmosphereTimeMode,
  selectedBuildingId: string | null,
  highlightedLanguage: string | null
): void {
  const ringRadius = world.city.urbanRadius;
  const padRadius = ringRadius + 5.5;
  const groundRadius = Math.max(115, ringRadius * 1.95);

  const groundGeo = new THREE.CylinderGeometry(
    groundRadius,
    groundRadius * 0.92,
    6,
    64
  );
  groundGeo.translate(0, -3.05, 0);
  const groundMat = new THREE.MeshStandardMaterial({
    color: world.continent.palette.lowland,
    roughness: 0.9,
    metalness: 0.08,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.receiveShadow = true;
  cityStageGroup.add(groundMesh);

  const urbanPadGeo = new THREE.CylinderGeometry(
    padRadius,
    padRadius + 1.5,
    0.5,
    72
  );
  urbanPadGeo.translate(0, -0.25, 0);
  const urbanPadMat = new THREE.MeshStandardMaterial({
    color: "#0f172a",
    roughness: 0.85,
    metalness: 0.15,
  });
  const urbanPad = new THREE.Mesh(urbanPadGeo, urbanPadMat);
  urbanPad.receiveShadow = true;
  cityStageGroup.add(urbanPad);

  // Anel Viário Perimetral
  const ringRoadGeo = new THREE.RingGeometry(
    ringRadius - 2.4,
    ringRadius + 2.4,
    96
  );
  ringRoadGeo.rotateX(-Math.PI / 2);
  ringRoadGeo.translate(0, 0.06, 0);
  const ringRoadMat = new THREE.MeshStandardMaterial({
    color: "#1e293b",
    roughness: 0.68,
    emissive: "#0ea5e9",
    emissiveIntensity: 0.16 * preset.windowBoost,
    side: THREE.DoubleSide,
  });
  const ringRoadMesh = new THREE.Mesh(ringRoadGeo, ringRoadMat);
  ringRoadMesh.receiveShadow = true;
  cityStageGroup.add(ringRoadMesh);

  // Borda luminosa externa da plataforma urbana
  const cityBorderGeo = new THREE.RingGeometry(
    padRadius - 0.6,
    padRadius,
    96
  );
  cityBorderGeo.rotateX(-Math.PI / 2);
  cityBorderGeo.translate(0, 0.08, 0);
  const cityBorderMat = new THREE.MeshBasicMaterial({
    color: "#38bdf8",
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45,
  });
  cityStageGroup.add(new THREE.Mesh(cityBorderGeo, cityBorderMat));

  // Malha viária interna conectada exatamente ao Anel Viário Perimetral
  for (const road of world.city.roads) {
    const dx = road.end.x - road.start.x;
    const dz = road.end.z - road.start.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const cx = (road.start.x + road.end.x) / 2;
    const cz = (road.start.z + road.end.z) / 2;
    const angle = Math.atan2(dx, dz);

    const roadGeo = new THREE.PlaneGeometry(road.width, length);
    roadGeo.rotateX(-Math.PI / 2);
    roadGeo.rotateY(angle);
    roadGeo.translate(cx, road.kind === "arterial" ? 0.055 : 0.035, cz);

    const roadMat = new THREE.MeshStandardMaterial({
      color: road.kind === "arterial" ? "#1e293b" : "#111827",
      roughness: 0.68,
      emissive: road.kind === "arterial" ? "#0ea5e9" : "#000000",
      emissiveIntensity:
        road.kind === "arterial" ? 0.16 * preset.windowBoost : 0,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    cityStageGroup.add(roadMesh);
  }

  // Sistema de Tráfego Urbano contido nas Avenidas e no Anel Viário Perimetral
  const trafficCount = Math.min(
    150,
    Math.max(36, world.buildings.length * 5)
  );
  const trafficPositions = new Float32Array(trafficCount * 3);
  const trafficColors = new Float32Array(trafficCount * 3);
  const ringAngles = new Float32Array(trafficCount);
  const roadExtent = ringRadius - 0.8;

  for (let i = 0; i < trafficCount; i++) {
    const modeType = i % 3;
    const laneOffset = i % 2 === 0 ? 1.1 : -1.1;
    const posAlong = (Math.random() * 2 - 1) * roadExtent;
    const angle = Math.random() * Math.PI * 2;
    ringAngles[i] = angle;

    if (modeType === 0) {
      trafficPositions[i * 3] = posAlong;
      trafficPositions[i * 3 + 1] = 0.35;
      trafficPositions[i * 3 + 2] = laneOffset;
    } else if (modeType === 1) {
      trafficPositions[i * 3] = laneOffset;
      trafficPositions[i * 3 + 1] = 0.35;
      trafficPositions[i * 3 + 2] = posAlong;
    } else {
      const laneR = ringRadius + (i % 2 === 0 ? 0.9 : -0.9);
      trafficPositions[i * 3] = Math.cos(angle) * laneR;
      trafficPositions[i * 3 + 1] = 0.35;
      trafficPositions[i * 3 + 2] = Math.sin(angle) * laneR;
    }

    const isForward = i % 2 === 0;
    trafficColors[i * 3] = isForward ? 0.35 : 0.98;
    trafficColors[i * 3 + 1] = isForward ? 0.85 : 0.35;
    trafficColors[i * 3 + 2] = isForward ? 1.0 : 0.25;
  }

  const trafficGeo = new THREE.BufferGeometry();
  trafficGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(trafficPositions, 3)
  );
  trafficGeo.setAttribute(
    "color",
    new THREE.BufferAttribute(trafficColors, 3)
  );
  const trafficMat = new THREE.PointsMaterial({
    size: 1.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
  });
  const trafficPoints = new THREE.Points(trafficGeo, trafficMat);
  trafficPoints.userData = {
    isTrafficStream: true,
    roadExtent,
    ringAngles,
  };
  cityStageGroup.add(trafficPoints);

  // Veículos 3D dedicados aos Contribuidores reais dos repositórios
  const cityContributors = world.city.contributors ?? [];
  for (let idx = 0; idx < cityContributors.length; idx++) {
    const contrib = cityContributors[idx];
    const carGroup = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.95, 0.42, 1.95);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: contrib.vehicleColor,
      emissive: contrib.vehicleColor,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.6,
    });
    carGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

    const cabinGeo = new THREE.BoxGeometry(0.75, 0.28, 1.05);
    cabinGeo.translate(0, 0.3, -0.1);
    const cabinMat = new THREE.MeshBasicMaterial({
      color: "#e0f2fe",
    });
    carGroup.add(new THREE.Mesh(cabinGeo, cabinMat));

    carGroup.userData = {
      isContributorVehicle: true,
      contributorData: contrib,
      roadExtent,
      vehicleIndex: idx,
    };
    cityStageGroup.add(carGroup);
  }

  // Praça Marco Zero no centro da cidade com obelisco luminoso
  const plazaGeo = new THREE.CylinderGeometry(3.6, 4.2, 0.45, 24);
  plazaGeo.translate(0, 0.22, 0);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: "#1e293b",
    emissive: "#38bdf8",
    emissiveIntensity: 0.35,
  });
  cityStageGroup.add(new THREE.Mesh(plazaGeo, plazaMat));

  const obeliskGeo = new THREE.ConeGeometry(0.65, 4.5, 6);
  obeliskGeo.translate(0, 2.45, 0);
  const obeliskMat = new THREE.MeshStandardMaterial({
    color: "#38bdf8",
    emissive: "#0284c7",
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.8,
  });
  cityStageGroup.add(new THREE.Mesh(obeliskGeo, obeliskMat));

  // Estação Ecológica da Vegetação (ADR-017)
  const nowMs = new Date(
    world.metadata.dataCollectedAt || world.generatedAt
  ).getTime();
  let minDaysSincePush = 9999;
  for (const r of world.repositories) {
    if (r.pushedAt) {
      const pMs = new Date(r.pushedAt).getTime();
      if (!Number.isNaN(pMs) && !Number.isNaN(nowMs)) {
        const d = Math.max(
          0,
          Math.round((nowMs - pMs) / (1000 * 60 * 60 * 24))
        );
        if (d < minDaysSincePush) minDaysSincePush = d;
      }
    }
  }
  const cityGrassColor =
    minDaysSincePush <= 30
      ? "#14532d"
      : minDaysSincePush <= 180
        ? "#365314"
        : minDaysSincePush <= 365
          ? "#713f12"
          : "#44403c";
  const cityCrownColor =
    minDaysSincePush <= 30
      ? "#22c55e"
      : minDaysSincePush <= 180
        ? "#65a30d"
        : minDaysSincePush <= 365
          ? "#eab308"
          : "#a8a29e";

  const occupiedBlockKeys = new Set(
    world.buildings.map(
      (b) => `${Math.round(b.position.x)}:${Math.round(b.position.z)}`
    )
  );
  const blockPitch = 18.0;
  const maxBlockIdx = Math.floor((ringRadius - 9) / blockPitch);

  const parkCenters: [number, number][] = [];
  for (let gx = -maxBlockIdx; gx < maxBlockIdx; gx++) {
    for (let gz = -maxBlockIdx; gz < maxBlockIdx; gz++) {
      const cx = (gx + 0.5) * blockPitch;
      const cz = (gz + 0.5) * blockPitch;
      if (Math.sqrt(cx * cx + cz * cz) > ringRadius - 8) continue;
      const key = `${Math.round(cx)}:${Math.round(cz)}`;
      if (occupiedBlockKeys.has(key)) continue;
      parkCenters.push([cx, cz]);
    }
  }

  const treeTrunkMat = new THREE.MeshStandardMaterial({
    color: "#78350f",
    roughness: 0.9,
  });

  // Renderiza Gramados e Árvores dos Parques usando InstancedMesh (Volume 09 — Otimização GPU)
  if (parkCenters.length > 0) {
    const parkGrassMat = new THREE.MeshStandardMaterial({
      color: cityGrassColor,
      roughness: 0.9,
    });
    const treeCrownMat = new THREE.MeshStandardMaterial({
      color: cityCrownColor,
      roughness: 0.75,
    });

    const parkBaseGeo = new THREE.BoxGeometry(8.2, 0.28, 8.2);
    const parkInstanced = new THREE.InstancedMesh(
      parkBaseGeo,
      parkGrassMat,
      parkCenters.length
    );
    parkInstanced.receiveShadow = true;

    const totalParkTrees = parkCenters.length * 3;
    const trunkBaseGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.1, 6);
    const crownBaseGeo = new THREE.ConeGeometry(0.95, 2.2, 7);
    const trunkInstanced = new THREE.InstancedMesh(
      trunkBaseGeo,
      treeTrunkMat,
      totalParkTrees
    );
    const crownInstanced = new THREE.InstancedMesh(
      crownBaseGeo,
      treeCrownMat,
      totalParkTrees
    );
    crownInstanced.castShadow = true;

    const dummy = new THREE.Object3D();
    const treeOffsets: [number, number][] = [
      [-2.1, -1.8],
      [2.0, -1.5],
      [0.2, 2.1],
    ];

    let treeIdx = 0;
    for (let i = 0; i < parkCenters.length; i++) {
      const [cx, cz] = parkCenters[i];
      dummy.position.set(cx, 0.14, cz);
      dummy.updateMatrix();
      parkInstanced.setMatrixAt(i, dummy.matrix);

      for (const [ox, oz] of treeOffsets) {
        dummy.position.set(cx + ox, 0.7, cz + oz);
        dummy.updateMatrix();
        trunkInstanced.setMatrixAt(treeIdx, dummy.matrix);

        dummy.position.set(cx + ox, 2.1, cz + oz);
        dummy.updateMatrix();
        crownInstanced.setMatrixAt(treeIdx, dummy.matrix);
        treeIdx++;
      }
    }

    parkInstanced.instanceMatrix.needsUpdate = true;
    trunkInstanced.instanceMatrix.needsUpdate = true;
    crownInstanced.instanceMatrix.needsUpdate = true;

    cityStageGroup.add(parkInstanced);
    cityStageGroup.add(trunkInstanced);
    cityStageGroup.add(crownInstanced);
  }

  // Postes de Iluminação Urbana ao longo das Avenidas Arteriais usando InstancedMesh
  const lampPositions: [number, number][] = [];
  for (let k = -maxBlockIdx; k < maxBlockIdx; k++) {
    const offset = (k + 0.5) * blockPitch;
    if (Math.abs(offset) > ringRadius - 5) continue;
    lampPositions.push(
      [2.75, offset],
      [-2.75, offset],
      [offset, 2.75],
      [offset, -2.75]
    );
  }

  if (lampPositions.length > 0) {
    const poleMat = new THREE.MeshStandardMaterial({
      color: "#475569",
      metalness: 0.7,
      roughness: 0.4,
    });
    const lampMat = new THREE.MeshBasicMaterial({
      color: timeMode === "cyber" ? "#22d3ee" : "#fde047",
    });

    const poleBaseGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.8, 6);
    const bulbBaseGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const poleInstanced = new THREE.InstancedMesh(
      poleBaseGeo,
      poleMat,
      lampPositions.length
    );
    const bulbInstanced = new THREE.InstancedMesh(
      bulbBaseGeo,
      lampMat,
      lampPositions.length
    );

    const dummy = new THREE.Object3D();
    for (let i = 0; i < lampPositions.length; i++) {
      const [lx, lz] = lampPositions[i];
      dummy.position.set(lx, 1.4, lz);
      dummy.updateMatrix();
      poleInstanced.setMatrixAt(i, dummy.matrix);

      dummy.position.set(lx, 2.85, lz);
      dummy.updateMatrix();
      bulbInstanced.setMatrixAt(i, dummy.matrix);
    }

    poleInstanced.instanceMatrix.needsUpdate = true;
    bulbInstanced.instanceMatrix.needsUpdate = true;
    cityStageGroup.add(poleInstanced);
    cityStageGroup.add(bulbInstanced);
  }

  // Construções 3D com texturas de fachada cacheadas e árvores sazonais por repositório
  for (const bldg of world.buildings) {
    const bGroup = new THREE.Group();
    bGroup.position.set(bldg.position.x, 0, bldg.position.z);
    bGroup.rotation.y = bldg.position.rotationY;
    bGroup.userData = {
      buildingId: bldg.id,
      buildingData: bldg,
    };

    const { width, depth, height, tierCount, roofStyle, antennaHeight } =
      bldg.geometryParameters;
    const {
      primaryColor,
      secondaryColor,
      emissiveColor,
      activityGlow,
      windowDensity,
    } = bldg.appearanceParameters;

    const isSelected = bldg.id === selectedBuildingId;
    const isLangHighlighted =
      Boolean(highlightedLanguage) &&
      bldg.appearanceParameters.languageLabel.toLowerCase() ===
        highlightedLanguage?.toLowerCase();

    const facadeTex = getCachedBuildingFacadeTexture(
      primaryColor,
      secondaryColor,
      emissiveColor,
      activityGlow,
      windowDensity
    );

    const facadeMat = new THREE.MeshStandardMaterial({
      map: facadeTex,
      roughness: 0.32,
      metalness: 0.45,
      emissive: new THREE.Color(isSelected ? "#38bdf8" : emissiveColor),
      emissiveMap: facadeTex,
      emissiveIntensity:
        (isSelected ? 0.75 : 0.28 + activityGlow * 0.42) *
        preset.windowBoost,
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: isSelected ? "#38bdf8" : secondaryColor,
      roughness: 0.45,
      metalness: 0.55,
    });

    const isArchived = Boolean(bldg.appearanceParameters.isArchived);
    const isFork = Boolean(bldg.appearanceParameters.isFork);

    const plinthGeo = new THREE.BoxGeometry(width + 1.8, 0.5, depth + 1.8);
    plinthGeo.translate(0, 0.25, 0);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: isSelected
        ? "#0284c7"
        : isArchived
          ? "#78350f"
          : "#1e293b",
      roughness: 0.8,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.receiveShadow = true;
    bGroup.add(plinthMesh);

    // Árvores Sazonais no lote de cada edifício (ADR-017)
    const bldgFoliageColor =
      bldg.appearanceParameters.foliageColor ??
      (activityGlow >= 0.84
        ? "#22c55e"
        : activityGlow >= 0.36
          ? "#65a30d"
          : activityGlow >= 0.16
            ? "#eab308"
            : "#a8a29e");
    const bldgCrownMat = new THREE.MeshStandardMaterial({
      color: bldgFoliageColor,
      roughness: 0.72,
    });
    const lotTreeCoords: [number, number][] = [
      [width / 2 + 0.55, depth / 2 + 0.55],
      [-width / 2 - 0.55, -depth / 2 - 0.55],
    ];
    for (const [tx, tz] of lotTreeCoords) {
      const lTrunkGeo = new THREE.CylinderGeometry(0.11, 0.15, 0.9, 6);
      lTrunkGeo.translate(tx, 0.95, tz);
      bGroup.add(new THREE.Mesh(lTrunkGeo, treeTrunkMat));

      const lCrownGeo = new THREE.ConeGeometry(0.65, 1.55, 7);
      lCrownGeo.translate(tx, 1.95, tz);
      const lCrownMesh = new THREE.Mesh(lCrownGeo, bldgCrownMat);
      lCrownMesh.castShadow = true;
      bGroup.add(lCrownMesh);
    }

    let currentY = 0.5;
    const tierHeight = height / tierCount;

    for (let t = 0; t < tierCount; t++) {
      const scaleFactor = Math.pow(0.82, t);
      const tw = width * scaleFactor;
      const td = depth * scaleFactor;

      const boxGeo = new THREE.BoxGeometry(tw, tierHeight, td);
      boxGeo.translate(0, currentY + tierHeight / 2, 0);

      const tierMesh = new THREE.Mesh(boxGeo, [
        facadeMat,
        facadeMat,
        roofMat,
        roofMat,
        facadeMat,
        facadeMat,
      ]);
      tierMesh.castShadow = true;
      tierMesh.receiveShadow = true;
      bGroup.add(tierMesh);

      currentY += tierHeight;
    }

    const topWidth = width * Math.pow(0.82, tierCount - 1);
    const topDepth = depth * Math.pow(0.82, tierCount - 1);

    if (roofStyle === "spire" || roofStyle === "crown") {
      const spireH = Math.max(2.2, height * 0.12);
      const spireGeo = new THREE.ConeGeometry(
        Math.min(topWidth, topDepth) * 0.45,
        spireH,
        4
      );
      spireGeo.rotateY(Math.PI / 4);
      spireGeo.translate(0, currentY + spireH / 2, 0);
      bGroup.add(new THREE.Mesh(spireGeo, roofMat));
      currentY += spireH;
    } else if (roofStyle === "dome") {
      const domeGeo = new THREE.SphereGeometry(
        Math.min(topWidth, topDepth) * 0.42,
        16,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
      );
      domeGeo.translate(0, currentY, 0);
      bGroup.add(new THREE.Mesh(domeGeo, roofMat));
    }

    if (antennaHeight > 0) {
      const antGeo = new THREE.CylinderGeometry(
        0.08,
        0.14,
        antennaHeight,
        8
      );
      antGeo.translate(0, currentY + antennaHeight / 2, 0);
      const antMat = new THREE.MeshStandardMaterial({
        color: "#cbd5e1",
        metalness: 0.8,
      });
      bGroup.add(new THREE.Mesh(antGeo, antMat));

      const beaconTopGeo = new THREE.SphereGeometry(0.28, 10, 10);
      beaconTopGeo.translate(0, currentY + antennaHeight, 0);
      const beaconTopMat = new THREE.MeshBasicMaterial({
        color: "#f43f5e",
      });
      bGroup.add(new THREE.Mesh(beaconTopGeo, beaconTopMat));
    }

    if (isFork && !isArchived) {
      // Emblema bifurcado de topo para repositórios que são Forks
      const forkOrbMat = new THREE.MeshBasicMaterial({ color: "#38bdf8" });
      const leftForkGeo = new THREE.SphereGeometry(0.24, 8, 8);
      leftForkGeo.translate(-0.45, currentY + 0.55, 0);
      const rightForkGeo = new THREE.SphereGeometry(0.24, 8, 8);
      rightForkGeo.translate(0.45, currentY + 0.55, 0);
      bGroup.add(new THREE.Mesh(leftForkGeo, forkOrbMat));
      bGroup.add(new THREE.Mesh(rightForkGeo, forkOrbMat));
    }

    if (isSelected || isLangHighlighted) {
      const haloRadius = Math.max(width, depth) * 0.88;
      const haloGeo = new THREE.RingGeometry(
        haloRadius,
        haloRadius + 0.65,
        32
      );
      haloGeo.rotateX(-Math.PI / 2);
      haloGeo.translate(0, 0.15, 0);
      const haloMat = new THREE.MeshBasicMaterial({
        color: isSelected ? "#38bdf8" : primaryColor,
        side: THREE.DoubleSide,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.userData = { isSelectionHalo: true };
      bGroup.add(haloMesh);
    }

    if (isLangHighlighted) {
      const beamGeo = new THREE.CylinderGeometry(0.18, 0.45, 35, 12);
      beamGeo.translate(0, currentY + 17.5, 0);
      const beamMat = new THREE.MeshBasicMaterial({
        color: primaryColor,
        transparent: true,
        opacity: 0.35,
      });
      bGroup.add(new THREE.Mesh(beamGeo, beamMat));
    }

    cityStageGroup.add(bGroup);
  }

  // Arcos Luminosos de Conexão Tecnológica entre prédios da mesma linguagem
  const byLang = new Map<string, Building[]>();
  for (const b of world.buildings) {
    const lang = b.appearanceParameters.languageLabel;
    if (lang === "Não especificada") continue;
    const arr = byLang.get(lang) ?? [];
    arr.push(b);
    byLang.set(lang, arr);
  }

  for (const [lang, group] of byLang.entries()) {
    if (group.length < 2) continue;
    const isHighlighted =
      Boolean(highlightedLanguage) &&
      highlightedLanguage?.toLowerCase() === lang.toLowerCase();
    const maxLinks = isHighlighted
      ? Math.min(group.length - 1, 10)
      : Math.min(group.length - 1, 3);

    for (let i = 0; i < maxLinks; i++) {
      const bA = group[i];
      const bB = group[i + 1];
      const startVec = new THREE.Vector3(
        bA.position.x,
        bA.geometryParameters.height + 1.2,
        bA.position.z
      );
      const endVec = new THREE.Vector3(
        bB.position.x,
        bB.geometryParameters.height + 1.2,
        bB.position.z
      );
      const midHeight =
        Math.max(
          bA.geometryParameters.height,
          bB.geometryParameters.height
        ) +
        8 +
        startVec.distanceTo(endVec) * 0.18;
      const midVec = new THREE.Vector3(
        (bA.position.x + bB.position.x) / 2,
        midHeight,
        (bA.position.z + bB.position.z) / 2
      );

      const curve = new THREE.QuadraticBezierCurve3(
        startVec,
        midVec,
        endVec
      );
      const points = curve.getPoints(24);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: bA.appearanceParameters.primaryColor,
        transparent: true,
        opacity: isHighlighted ? 0.85 : 0.28,
      });
      cityStageGroup.add(new THREE.Line(arcGeo, arcMat));
    }
  }
}

