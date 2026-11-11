"use client";

/**
 * VOLUME 03, 06, 09 & 10 — WORLD RENDERER 3D ORQUESTRADOR (Three.js)
 * Orquestra o ciclo de vida WebGL delegando a construção das cenas e o controle de câmera
 * para os módulos dedicados em `src/rendering/`:
 * - `planetSceneBuilder.ts` (Planeta + Pangeia + Sinalizador Canônico + Portais de Seguidores)
 * - `citySceneBuilder.ts` (Quadras, Anel Viário, Árvores e Postes em `InstancedMesh`, Prédios com Cache de Textura)
 * - `cameraController.ts` (Matemática das 6 escalas de câmera)
 * - `atmospherePresets.ts` (4 presets de iluminação e neblina)
 */

import { Building, World } from "@/domain/types";
import {
  ATMOSPHERE_PRESETS,
  AtmosphereTimeMode,
  CameraScaleMode,
} from "@/rendering/atmospherePresets";
import { computeCameraPose } from "@/rendering/cameraController";
import { populateCityScene } from "@/rendering/citySceneBuilder";
import { populateOrbitalScene } from "@/rendering/planetSceneBuilder";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

export type { AtmosphereTimeMode, CameraScaleMode };

export interface WorldCanvasHandle {
  exportPostcardPng: () => void;
}

interface ProjectedLabel {
  id: string;
  name: string;
  language: string;
  stars: number;
  height: number;
  color: string;
  x: number;
  y: number;
  isSelected: boolean;
}

interface ProjectedContributorCar {
  id: string;
  login: string;
  avatarUrl: string;
  contributions: number;
  repositoryId: string;
  repositoryName: string;
  vehicleColor: string;
  x: number;
  y: number;
}

interface ProjectedFollowerPin {
  id: string;
  login: string;
  avatarUrl: string;
  color: string;
  x: number;
  y: number;
}

interface WorldCanvasProps {
  world: World | null;
  cameraMode: CameraScaleMode;
  timeMode: AtmosphereTimeMode;
  showLabels: boolean;
  highlightedLanguage?: string | null;
  selectedBuildingId: string | null;
  onSelectBuilding: (buildingId: string | null) => void;
  onCameraModeChange: (mode: CameraScaleMode) => void;
  onSelectFollower?: (username: string) => void;
}

const WorldCanvas = forwardRef<WorldCanvasHandle, WorldCanvasProps>(
  function WorldCanvas(
    {
      world,
      cameraMode,
      timeMode,
      showLabels,
      highlightedLanguage = null,
      selectedBuildingId,
      onSelectBuilding,
      onCameraModeChange,
      onSelectFollower,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    const [hoveredBuilding, setHoveredBuilding] = useState<{
      name: string;
      language: string;
      stars: number;
      height: number;
      x: number;
      y: number;
    } | null>(null);

    const [projectedLabels, setProjectedLabels] = useState<ProjectedLabel[]>(
      []
    );
    const [projectedCars, setProjectedCars] = useState<
      ProjectedContributorCar[]
    >([]);
    const [projectedFollowers, setProjectedFollowers] = useState<
      ProjectedFollowerPin[]
    >([]);
    const [radarUserPos, setRadarUserPos] = useState<{
      x: number;
      z: number;
      yaw: number;
    }>({ x: 3.1, z: 26, yaw: Math.PI });
    const [webglAvailable, setWebglAvailable] = useState(true);

    const stateRef = useRef({
      world,
      cameraMode,
      timeMode,
      showLabels,
      selectedBuildingId,
      isDragging: false,
      dragMoved: false,
      prevMouse: { x: 0, y: 0 },
      orbitYaw: 0.35,
      orbitPitch: 0.45,
      zoomDistanceMultiplier: 1.0,
      streetPos: { x: 3.1, z: 26 },
      streetYaw: Math.PI,
      streetPitch: 0.06,
    });

    const callbacksRef = useRef({
      onSelectBuilding,
      onCameraModeChange,
      onSelectFollower,
    });

    useEffect(() => {
      callbacksRef.current = {
        onSelectBuilding,
        onCameraModeChange,
        onSelectFollower,
      };
    }, [onSelectBuilding, onCameraModeChange, onSelectFollower]);

    useEffect(() => {
      stateRef.current.world = world;
    }, [world]);

    useEffect(() => {
      stateRef.current.cameraMode = cameraMode;
      stateRef.current.zoomDistanceMultiplier = 1.0;
      if (cameraMode === "street") {
        const startZ = stateRef.current.world
          ? Math.min(32, stateRef.current.world.city.urbanRadius * 0.65)
          : 26;
        stateRef.current.streetPos = { x: 3.1, z: startZ };
        stateRef.current.streetYaw = Math.PI;
        stateRef.current.streetPitch = 0.06;
      }
    }, [cameraMode]);

    useEffect(() => {
      stateRef.current.timeMode = timeMode;
    }, [timeMode]);

    useEffect(() => {
      stateRef.current.showLabels = showLabels;
    }, [showLabels]);

    useEffect(() => {
      stateRef.current.selectedBuildingId = selectedBuildingId;
    }, [selectedBuildingId]);

    useImperativeHandle(ref, () => ({
      exportPostcardPng: () => {
        const glCanvas = rendererRef.current?.domElement;
        if (!glCanvas) return;

        const outCanvas = document.createElement("canvas");
        outCanvas.width = glCanvas.width;
        outCanvas.height = glCanvas.height;
        const ctx = outCanvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(glCanvas, 0, 0);

        const barHeight = Math.max(76, Math.round(outCanvas.height * 0.095));
        const yTop = outCanvas.height - barHeight;
        ctx.fillStyle = "rgba(3, 7, 18, 0.88)";
        ctx.fillRect(0, yTop, outCanvas.width, barHeight);

        ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, yTop);
        ctx.lineTo(outCanvas.width, yTop);
        ctx.stroke();

        const activeWorld = stateRef.current.world;
        const padX = 28;
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 22px monospace";
        ctx.fillText(
          activeWorld
            ? `GITHUB WORLD • @${activeWorld.user.login}`
            : "GITHUB WORLD • PLANETARY VIEW",
          padX,
          yTop + 32
        );

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "15px monospace";
        if (activeWorld) {
          const totalStars = activeWorld.repositories.reduce(
            (acc, r) => acc + (r.stars.value ?? 0),
            0
          );
          ctx.fillText(
            `Seed: ${activeWorld.seed}  |  Pangeia: (${activeWorld.city.sphericalPosition.latitude}°, ${activeWorld.city.sphericalPosition.longitude}°)  |  Construções: ${activeWorld.buildings.length}  |  ★ ${totalStars} Stars  |  Gen v${activeWorld.generationVersion}`,
            padX,
            yTop + 58
          );
        } else {
          ctx.fillText(
            "1 Mundo, 1 Planeta, 1 Pangeia e 1 Cidade Tridimensional por Usuário",
            padX,
            yTop + 58
          );
        }

        const dataUrl = outCanvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = activeWorld
          ? `github-world-${activeWorld.user.login}.png`
          : "github-world-planet.png";
        link.href = dataUrl;
        link.click();
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const scene = new THREE.Scene();
      const initialPreset = ATMOSPHERE_PRESETS[stateRef.current.timeMode];
      scene.background = new THREE.Color(initialPreset.bg);
      scene.fog = new THREE.FogExp2(
        initialPreset.fogColor,
        initialPreset.fogDensity
      );

      const camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / Math.max(1, container.clientHeight),
        0.5,
        3500
      );
      camera.position.set(0, 90, 320);

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        });
      } catch {
        setWebglAvailable(false);
        return;
      }
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      container.innerHTML = "";
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const ambientLight = new THREE.AmbientLight(
        initialPreset.ambientColor,
        initialPreset.ambientIntensity
      );
      scene.add(ambientLight);

      const sunLight = new THREE.DirectionalLight(
        initialPreset.sunColor,
        initialPreset.sunIntensity
      );
      sunLight.position.set(...initialPreset.sunPos);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 900;
      const d = 145;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      scene.add(sunLight);

      const rimLight = new THREE.DirectionalLight(
        initialPreset.rimColor,
        initialPreset.rimIntensity
      );
      rimLight.position.set(-250, -120, -200);
      scene.add(rimLight);

      // Campo estelar
      const starsCount = 2200;
      const starPositions = new Float32Array(starsCount * 3);
      const starColors = new Float32Array(starsCount * 3);
      for (let i = 0; i < starsCount; i++) {
        const r = 700 + Math.random() * 1200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i * 3 + 2] = r * Math.cos(phi);

        const brightness = 0.6 + Math.random() * 0.4;
        starColors[i * 3] = brightness;
        starColors[i * 3 + 1] = brightness;
        starColors[i * 3 + 2] = Math.min(1, brightness + 0.15);
      }
      const starsGeo = new THREE.BufferGeometry();
      starsGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(starPositions, 3)
      );
      starsGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
      const starsMat = new THREE.PointsMaterial({
        size: 2.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
      });
      const starField = new THREE.Points(starsGeo, starsMat);
      scene.add(starField);

      const orbitalGroup = new THREE.Group();
      scene.add(orbitalGroup);

      const cityStageGroup = new THREE.Group();
      scene.add(cityStageGroup);

      const currentCamPos = new THREE.Vector3(0, 80, 320);
      const currentLookAt = new THREE.Vector3(0, 0, 0);

      let animationFrameId = 0;
      let frameCount = 0;

      const raycaster = new THREE.Raycaster();
      const mouseNdc = new THREE.Vector2();

      const handlePointerDown = (e: MouseEvent) => {
        stateRef.current.isDragging = true;
        stateRef.current.dragMoved = false;
        stateRef.current.prevMouse = { x: e.clientX, y: e.clientY };
      };

      const handlePointerMove = (e: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (stateRef.current.isDragging) {
          const dx = e.clientX - stateRef.current.prevMouse.x;
          const dy = e.clientY - stateRef.current.prevMouse.y;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            stateRef.current.dragMoved = true;
          }

          if (stateRef.current.cameraMode === "street") {
            stateRef.current.streetYaw -= dx * 0.0055;
            stateRef.current.streetPitch = Math.max(
              -0.55,
              Math.min(1.15, stateRef.current.streetPitch - dy * 0.005)
            );
          } else {
            stateRef.current.orbitYaw -= dx * 0.0065;
            stateRef.current.orbitPitch = Math.max(
              0.12,
              Math.min(1.42, stateRef.current.orbitPitch + dy * 0.0055)
            );
          }
          stateRef.current.prevMouse = { x: e.clientX, y: e.clientY };
          return;
        }

        if (cityStageGroup.visible) {
          raycaster.setFromCamera(mouseNdc, camera);
          const intersects = raycaster.intersectObjects(
            cityStageGroup.children,
            true
          );
          let found: Building | null = null;
          for (const hit of intersects) {
            let obj: THREE.Object3D | null = hit.object;
            while (obj) {
              if (obj.userData?.buildingData) {
                found = obj.userData.buildingData as Building;
                break;
              }
              obj = obj.parent;
            }
            if (found) break;
          }

          if (found) {
            renderer.domElement.style.cursor = "pointer";
            setHoveredBuilding({
              name: found.repositoryName,
              language: found.appearanceParameters.languageLabel,
              stars: Number(found.traceability[0]?.rawValue ?? 0),
              height: found.geometryParameters.height,
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          } else {
            renderer.domElement.style.cursor = "grab";
            setHoveredBuilding(null);
          }
        } else {
          renderer.domElement.style.cursor = "grab";
          setHoveredBuilding(null);
        }
      };

      const performRaycastSelection = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouseNdc, camera);

        if (orbitalGroup.visible && stateRef.current.world) {
          const orbitalHits = raycaster.intersectObjects(
            orbitalGroup.children,
            true
          );
          for (const hit of orbitalHits) {
            if (
              hit.object.userData?.followerLogin &&
              callbacksRef.current.onSelectFollower
            ) {
              callbacksRef.current.onSelectFollower(
                hit.object.userData.followerLogin as string
              );
              return;
            }
            if (hit.object.userData?.isCityBeacon) {
              callbacksRef.current.onCameraModeChange("city");
              return;
            }
          }
        }

        if (cityStageGroup.visible) {
          const hits = raycaster.intersectObjects(
            cityStageGroup.children,
            true
          );
          for (const hit of hits) {
            let obj: THREE.Object3D | null = hit.object;
            while (obj) {
              if (obj.userData?.buildingId) {
                callbacksRef.current.onSelectBuilding(
                  obj.userData.buildingId as string
                );
                callbacksRef.current.onCameraModeChange("building");
                return;
              }
              obj = obj.parent;
            }
          }
        }
      };

      const handlePointerUp = (e: MouseEvent) => {
        const wasDragMoved = stateRef.current.dragMoved;
        stateRef.current.isDragging = false;
        if (wasDragMoved) return;
        performRaycastSelection(e.clientX, e.clientY);
      };

      // Suporte a Toque Mobile / Tablet (Volume 10.6): rotação 1 dedo, tap e pinch-to-zoom 2 dedos
      let pinchStartDist = 0;
      let pinchStartZoom = 1;
      let lastTouchX = 0;
      let lastTouchY = 0;

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          stateRef.current.isDragging = true;
          stateRef.current.dragMoved = false;
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
          stateRef.current.prevMouse = { x: lastTouchX, y: lastTouchY };
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchStartDist = Math.hypot(dx, dy);
          pinchStartZoom = stateRef.current.zoomDistanceMultiplier;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && pinchStartDist > 0) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const scale = pinchStartDist / Math.max(10, dist);
          stateRef.current.zoomDistanceMultiplier = Math.max(
            0.42,
            Math.min(2.3, pinchStartZoom * scale)
          );
          stateRef.current.dragMoved = true;
          return;
        }
        if (e.touches.length === 1 && stateRef.current.isDragging) {
          const tx = e.touches[0].clientX;
          const ty = e.touches[0].clientY;
          const dx = tx - stateRef.current.prevMouse.x;
          const dy = ty - stateRef.current.prevMouse.y;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            stateRef.current.dragMoved = true;
          }
          if (stateRef.current.cameraMode === "street") {
            stateRef.current.streetYaw -= dx * 0.005;
            stateRef.current.streetPitch = Math.max(
              -0.45,
              Math.min(0.65, stateRef.current.streetPitch - dy * 0.004)
            );
          } else {
            stateRef.current.orbitYaw -= dx * 0.0065;
            stateRef.current.orbitPitch = Math.max(
              0.12,
              Math.min(1.42, stateRef.current.orbitPitch + dy * 0.0055)
            );
          }
          lastTouchX = tx;
          lastTouchY = ty;
          stateRef.current.prevMouse = { x: tx, y: ty };
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (e.touches.length === 0) {
          const wasDragMoved = stateRef.current.dragMoved;
          stateRef.current.isDragging = false;
          pinchStartDist = 0;
          if (!wasDragMoved) {
            performRaycastSelection(lastTouchX, lastTouchY);
          }
        }
      };

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        if (stateRef.current.cameraMode === "street") {
          const step = -e.deltaY * 0.025;
          const maxR = stateRef.current.world
            ? stateRef.current.world.city.urbanRadius - 2
            : 45;
          const nextX =
            stateRef.current.streetPos.x +
            Math.sin(stateRef.current.streetYaw) * step;
          const nextZ =
            stateRef.current.streetPos.z +
            Math.cos(stateRef.current.streetYaw) * step;
          stateRef.current.streetPos.x = Math.max(
            -maxR,
            Math.min(maxR, nextX)
          );
          stateRef.current.streetPos.z = Math.max(
            -maxR,
            Math.min(maxR, nextZ)
          );
          return;
        }
        const delta = e.deltaY * 0.001;
        stateRef.current.zoomDistanceMultiplier = Math.max(
          0.42,
          Math.min(2.3, stateRef.current.zoomDistanceMultiplier + delta)
        );
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          document.activeElement &&
          ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
        ) {
          return;
        }
        // Atalhos rápidos de câmera (Volume 10.6): 1..6
        if (e.key === "1") {
          callbacksRef.current.onCameraModeChange("orbital");
          return;
        }
        if (stateRef.current.world) {
          if (e.key === "2") {
            callbacksRef.current.onCameraModeChange("continental");
            return;
          } else if (e.key === "3") {
            callbacksRef.current.onCameraModeChange("city");
            return;
          } else if (e.key === "4") {
            callbacksRef.current.onCameraModeChange("drone");
            return;
          } else if (e.key === "5") {
            callbacksRef.current.onCameraModeChange("street");
            return;
          } else if (e.key === "6" && stateRef.current.selectedBuildingId) {
            callbacksRef.current.onCameraModeChange("building");
            return;
          }
        }
        if (stateRef.current.cameraMode === "street") {
          const maxR = stateRef.current.world
            ? stateRef.current.world.city.urbanRadius - 2
            : 45;
          const moveStep = 2.4;
          const yaw = stateRef.current.streetYaw;
          if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
            stateRef.current.streetPos.x = Math.max(
              -maxR,
              Math.min(maxR, stateRef.current.streetPos.x + Math.sin(yaw) * moveStep)
            );
            stateRef.current.streetPos.z = Math.max(
              -maxR,
              Math.min(maxR, stateRef.current.streetPos.z + Math.cos(yaw) * moveStep)
            );
          } else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
            stateRef.current.streetPos.x = Math.max(
              -maxR,
              Math.min(maxR, stateRef.current.streetPos.x - Math.sin(yaw) * moveStep)
            );
            stateRef.current.streetPos.z = Math.max(
              -maxR,
              Math.min(maxR, stateRef.current.streetPos.z - Math.cos(yaw) * moveStep)
            );
          } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
            stateRef.current.streetYaw += 0.09;
          } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
            stateRef.current.streetYaw -= 0.09;
          } else if (e.key === "Escape") {
            callbacksRef.current.onSelectBuilding(null);
            if (stateRef.current.world) {
              callbacksRef.current.onCameraModeChange("city");
            }
          }
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "a") {
          stateRef.current.orbitYaw += 0.08;
        } else if (e.key === "ArrowRight" || e.key === "d") {
          stateRef.current.orbitYaw -= 0.08;
        } else if (e.key === "ArrowUp" || e.key === "w") {
          stateRef.current.orbitPitch = Math.min(
            1.4,
            stateRef.current.orbitPitch + 0.06
          );
        } else if (e.key === "ArrowDown" || e.key === "s") {
          stateRef.current.orbitPitch = Math.max(
            0.15,
            stateRef.current.orbitPitch - 0.06
          );
        } else if (e.key === "Escape") {
          callbacksRef.current.onSelectBuilding(null);
          if (stateRef.current.world) {
            callbacksRef.current.onCameraModeChange("city");
          }
        }
      };

      const handleResize = () => {
        if (!container) return;
        camera.aspect =
          container.clientWidth / Math.max(1, container.clientHeight);
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };

      const domElem = renderer.domElement;
      domElem.addEventListener("mousedown", handlePointerDown);
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp);
      domElem.addEventListener("touchstart", handleTouchStart, { passive: true });
      domElem.addEventListener("touchmove", handleTouchMove, { passive: false });
      domElem.addEventListener("touchend", handleTouchEnd);
      window.addEventListener("keydown", handleKeyDown);
      domElem.addEventListener("wheel", handleWheel, { passive: false });
      window.addEventListener("resize", handleResize);

      (container as unknown as { __threeRefs: unknown }).__threeRefs = {
        scene,
        orbitalGroup,
        cityStageGroup,
        ambientLight,
        sunLight,
        rimLight,
      };

      const startTimeMs = performance.now();
      const tempProjVec = new THREE.Vector3();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const elapsed = (performance.now() - startTimeMs) * 0.001;
        frameCount++;

        const {
          world: activeWorld,
          cameraMode: mode,
          selectedBuildingId: selId,
          showLabels: labelsEnabled,
        } = stateRef.current;

        starField.rotation.y = elapsed * 0.01;

        if (!stateRef.current.isDragging && (!activeWorld || mode === "orbital")) {
          if (!activeWorld) {
            stateRef.current.orbitYaw += 0.0018;
          }
        }

        const pose = computeCameraPose(stateRef.current, elapsed);
        orbitalGroup.visible = pose.showOrbital;
        cityStageGroup.visible = pose.showCity;

        currentCamPos.lerp(pose.targetCamPos, 0.065);
        currentLookAt.lerp(pose.targetLookAt, 0.08);

        camera.position.copy(currentCamPos);
        camera.lookAt(currentLookAt);

        // LOD (Volume 09.4): só percorre orbitalGroup quando visível
        if (orbitalGroup.visible) {
          orbitalGroup.traverse((obj) => {
            if (obj.userData?.isPulseRing) {
              const s = 1 + 0.38 * Math.sin(elapsed * 3.4);
              obj.scale.set(s, s, s);
            }
            if (obj.userData?.isOrbitalRing) {
              obj.rotation.z = elapsed * 0.08;
            }
          });
        }

        // LOD (Volume 09.4): só percorre e anima malha urbana quando a cidade está visível
        if (cityStageGroup.visible) {
          const camDistToOrigin = camera.position.length();
          cityStageGroup.traverse((obj) => {
            if (obj.userData?.isSelectionHalo) {
              obj.rotation.y = elapsed * 1.6;
            }
            if (obj.userData?.isTrafficStream) {
              const points = obj as THREE.Points;
              const pos = points.geometry.attributes
                .position as THREE.BufferAttribute;
              const roadExtent = (obj.userData.roadExtent as number) || 42;
              const angles = obj.userData.ringAngles as Float32Array | undefined;

              for (let i = 0; i < pos.count; i++) {
                const modeType = i % 3;
                if (modeType === 0) {
                  const speed = (i % 5 === 0 ? 15 : 10) * (i % 2 === 0 ? 1 : -1);
                  let x = pos.getX(i) + speed * 0.016;
                  if (x > roadExtent) x = -roadExtent;
                  if (x < -roadExtent) x = roadExtent;
                  pos.setX(i, x);
                } else if (modeType === 1) {
                  const speed = (i % 5 === 0 ? 15 : 10) * (i % 2 === 0 ? 1 : -1);
                  let z = pos.getZ(i) + speed * 0.016;
                  if (z > roadExtent) z = -roadExtent;
                  if (z < -roadExtent) z = roadExtent;
                  pos.setZ(i, z);
                } else if (angles) {
                  const angularSpeed =
                    (0.22 / Math.max(30, roadExtent)) * (i % 2 === 0 ? 1 : -1);
                  angles[i] += angularSpeed;
                  const laneR = roadExtent + (i % 2 === 0 ? 0.9 : -0.9);
                  pos.setX(i, Math.cos(angles[i]) * laneR);
                  pos.setZ(i, Math.sin(angles[i]) * laneR);
                }
              }
              pos.needsUpdate = true;
            }

            if (obj.userData?.isContributorVehicle) {
              // Oculta malha de veículos individuais quando o zoom estiver muito afastado (> 150m)
              obj.visible = camDistToOrigin <= 150;
              if (!obj.visible) return;

              const c = obj.userData.contributorData as {
                routeKind: "arterial_ew" | "arterial_ns" | "ring_road";
                speed: number;
                initialPhase: number;
              };
              const roadExtent = (obj.userData.roadExtent as number) || 42;
              const idx = (obj.userData.vehicleIndex as number) || 0;
              const dirSign = idx % 2 === 0 ? 1 : -1;
              const laneOffset = dirSign * 1.15;

              if (c.routeKind === "arterial_ew") {
                const span = roadExtent * 2;
                const rawPos =
                  ((c.initialPhase * roadExtent +
                    elapsed * c.speed * dirSign) %
                    span +
                    span) %
                    span -
                  roadExtent;
                obj.position.set(rawPos, 0.32, laneOffset);
                obj.rotation.y = dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
              } else if (c.routeKind === "arterial_ns") {
                const span = roadExtent * 2;
                const rawPos =
                  ((c.initialPhase * roadExtent +
                    elapsed * c.speed * dirSign) %
                    span +
                    span) %
                    span -
                  roadExtent;
                obj.position.set(laneOffset, 0.32, rawPos);
                obj.rotation.y = dirSign > 0 ? 0 : Math.PI;
              } else {
                const angularVel = (c.speed / Math.max(28, roadExtent)) * dirSign;
                const angle = c.initialPhase * Math.PI + elapsed * angularVel;
                const laneR = roadExtent + (dirSign > 0 ? 0.95 : -0.95);
                obj.position.set(
                  Math.cos(angle) * laneR,
                  0.32,
                  Math.sin(angle) * laneR
                );
                obj.rotation.y = -angle + (dirSign > 0 ? 0 : Math.PI);
              }
            }
          });
        }

        renderer.render(scene, camera);

        if (frameCount % 2 === 0) {
          if (
            activeWorld &&
            cityStageGroup.visible &&
            labelsEnabled &&
            activeWorld.buildings.length > 0
          ) {
            const widthPx = container.clientWidth;
            const heightPx = container.clientHeight;
            const topBuildings = activeWorld.buildings.slice(0, 6);
            const selectedB = activeWorld.buildings.find((b) => b.id === selId);
            const candidates = selectedB
              ? Array.from(new Set([...topBuildings, selectedB]))
              : topBuildings;

            const nextLabels: ProjectedLabel[] = [];
            for (const b of candidates) {
              const totalH =
                b.geometryParameters.height +
                b.geometryParameters.antennaHeight +
                2.5;
              tempProjVec.set(b.position.x, totalH, b.position.z);
              tempProjVec.project(camera);

              if (tempProjVec.z >= -1 && tempProjVec.z <= 1) {
                const sx = (tempProjVec.x * 0.5 + 0.5) * widthPx;
                const sy = (-tempProjVec.y * 0.5 + 0.5) * heightPx;
                if (
                  sx > 40 &&
                  sx < widthPx - 40 &&
                  sy > 60 &&
                  sy < heightPx - 40
                ) {
                  nextLabels.push({
                    id: b.id,
                    name: b.repositoryName,
                    language: b.appearanceParameters.languageLabel,
                    stars: Number(b.traceability[0]?.rawValue ?? 0),
                    height: b.geometryParameters.height,
                    color: b.appearanceParameters.primaryColor,
                    x: sx,
                    y: sy,
                    isSelected: b.id === selId,
                  });
                }
              }
            }
            setProjectedLabels(nextLabels);

            const nextCarBadges: ProjectedContributorCar[] = [];
            cityStageGroup.traverse((obj) => {
              if (
                obj.userData?.isContributorVehicle &&
                nextCarBadges.length < 5
              ) {
                const cData = obj.userData.contributorData as {
                  id: string;
                  login: string;
                  avatarUrl: string;
                  contributions: number;
                  repositoryId: string;
                  repositoryName: string;
                  vehicleColor: string;
                };
                tempProjVec.set(
                  obj.position.x,
                  obj.position.y + 1.8,
                  obj.position.z
                );
                tempProjVec.project(camera);
                if (tempProjVec.z >= -1 && tempProjVec.z <= 0.992) {
                  const sx = (tempProjVec.x * 0.5 + 0.5) * widthPx;
                  const sy = (-tempProjVec.y * 0.5 + 0.5) * heightPx;
                  if (
                    sx > 50 &&
                    sx < widthPx - 50 &&
                    sy > 80 &&
                    sy < heightPx - 40
                  ) {
                    nextCarBadges.push({
                      id: cData.id,
                      login: cData.login,
                      avatarUrl: cData.avatarUrl,
                      contributions: cData.contributions,
                      repositoryId: cData.repositoryId,
                      repositoryName: cData.repositoryName,
                      vehicleColor: cData.vehicleColor,
                      x: sx,
                      y: sy,
                    });
                  }
                }
              }
            });
            setProjectedCars(nextCarBadges);
            setProjectedFollowers((prev) => (prev.length > 0 ? [] : prev));
            setRadarUserPos({
              x:
                mode === "street"
                  ? stateRef.current.streetPos.x
                  : camera.position.x,
              z:
                mode === "street"
                  ? stateRef.current.streetPos.z
                  : camera.position.z,
              yaw:
                mode === "street"
                  ? stateRef.current.streetYaw
                  : stateRef.current.orbitYaw,
            });
          } else if (
            activeWorld &&
            orbitalGroup.visible &&
            labelsEnabled &&
            (activeWorld.city.followerOutposts?.length ?? 0) > 0
          ) {
            setProjectedLabels((prev) => (prev.length > 0 ? [] : prev));
            setProjectedCars((prev) => (prev.length > 0 ? [] : prev));

            const widthPx = container.clientWidth;
            const heightPx = container.clientHeight;
            const camDir = camera.position.clone().normalize();
            const nextFollowers: ProjectedFollowerPin[] = [];

            for (const f of (activeWorld.city.followerOutposts ?? []).slice(
              0,
              12
            )) {
              const fVec = new THREE.Vector3(
                f.position.x,
                f.position.y,
                f.position.z
              );
              const fNormal = fVec.clone().normalize();
              if (fNormal.dot(camDir) < 0.22) continue;

              const pinTop = fVec.clone().addScaledVector(fNormal, 10.5);
              tempProjVec.copy(pinTop).project(camera);

              if (tempProjVec.z >= -1 && tempProjVec.z <= 0.995) {
                const sx = (tempProjVec.x * 0.5 + 0.5) * widthPx;
                const sy = (-tempProjVec.y * 0.5 + 0.5) * heightPx;
                if (
                  sx > 45 &&
                  sx < widthPx - 45 &&
                  sy > 75 &&
                  sy < heightPx - 45
                ) {
                  nextFollowers.push({
                    id: f.id,
                    login: f.login,
                    avatarUrl: f.avatarUrl,
                    color: f.color,
                    x: sx,
                    y: sy,
                  });
                }
              }
            }
            setProjectedFollowers(nextFollowers);
          } else {
            setProjectedLabels((prev) => (prev.length > 0 ? [] : prev));
            setProjectedCars((prev) => (prev.length > 0 ? [] : prev));
            setProjectedFollowers((prev) => (prev.length > 0 ? [] : prev));
          }
        }
      };

      animate();

      return () => {
        cancelAnimationFrame(animationFrameId);
        domElem.removeEventListener("mousedown", handlePointerDown);
        window.removeEventListener("mousemove", handlePointerMove);
        window.removeEventListener("mouseup", handlePointerUp);
        domElem.removeEventListener("touchstart", handleTouchStart);
        domElem.removeEventListener("touchmove", handleTouchMove);
        domElem.removeEventListener("touchend", handleTouchEnd);
        window.removeEventListener("keydown", handleKeyDown);
        domElem.removeEventListener("wheel", handleWheel);
        window.removeEventListener("resize", handleResize);
        renderer.dispose();
      };
    }, []);

    useEffect(() => {
      const container = containerRef.current as unknown as {
        __threeRefs?: {
          scene: THREE.Scene;
          ambientLight: THREE.AmbientLight;
          sunLight: THREE.DirectionalLight;
          rimLight: THREE.DirectionalLight;
        };
      };
      if (!container?.__threeRefs) return;

      const { scene, ambientLight, sunLight, rimLight } = container.__threeRefs;
      const preset = ATMOSPHERE_PRESETS[timeMode];

      scene.background = new THREE.Color(preset.bg);
      scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
      ambientLight.color.set(preset.ambientColor);
      ambientLight.intensity = preset.ambientIntensity;
      sunLight.color.set(preset.sunColor);
      sunLight.intensity = preset.sunIntensity;
      sunLight.position.set(...preset.sunPos);
      rimLight.color.set(preset.rimColor);
      rimLight.intensity = preset.rimIntensity;
    }, [timeMode]);

    useEffect(() => {
      const container = containerRef.current as unknown as {
        __threeRefs?: {
          orbitalGroup: THREE.Group;
          cityStageGroup: THREE.Group;
        };
      };
      if (!container?.__threeRefs) return;

      const { orbitalGroup, cityStageGroup } = container.__threeRefs;
      const preset = ATMOSPHERE_PRESETS[timeMode];

      const clearGroup = (group: THREE.Group) => {
        while (group.children.length > 0) {
          const child = group.children[0];
          group.remove(child);
          child.traverse((node) => {
            const mesh = node as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m) => m.dispose());
              } else {
                mesh.material.dispose();
              }
            }
          });
        }
      };

      clearGroup(orbitalGroup);
      clearGroup(cityStageGroup);

      const orbitalAngles = populateOrbitalScene(orbitalGroup, world);
      if (orbitalAngles) {
        stateRef.current.orbitYaw = orbitalAngles.initialYaw;
        stateRef.current.orbitPitch = orbitalAngles.initialPitch;
      }

      if (world) {
        populateCityScene(
          cityStageGroup,
          world,
          preset,
          timeMode,
          selectedBuildingId,
          highlightedLanguage
        );
      }
    }, [world, selectedBuildingId, timeMode, highlightedLanguage]);

    return (
      <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
        {!webglAvailable ? (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
            <div className="max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
              <div className="text-sm font-bold text-sky-300">
                Modo de Compatibilidade 2D Ativo (Volume 10.6 — WebGL indisponível)
              </div>
              {world ? (
                <img
                  src={`/api/badge/${encodeURIComponent(world.user.login)}`}
                  alt={`Skyline 2D de @${world.user.login}`}
                  className="w-full rounded-xl border border-slate-800"
                />
              ) : (
                <p className="text-xs text-slate-400">
                  Pesquise um username do GitHub acima para visualizar a projeção vetorial da Pangeia e do Skyline da cidade.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full" />
        )}

        {/* Portais de Seguidores na Pangeia (Modos Orbital e Pangeia) */}
        {projectedFollowers.map((fPin) => (
          <button
            key={fPin.id}
            type="button"
            onClick={() => onSelectFollower?.(fPin.login)}
            style={{
              left: `${fPin.x}px`,
              top: `${fPin.y}px`,
              transform: "translate(-50%, -100%)",
              borderColor: fPin.color,
            }}
            title={`Seguidor @${fPin.login} na Pangeia vizinha — clique para viajar até a cidade dele!`}
            className="absolute z-10 flex items-center gap-1.5 rounded-full border bg-slate-950/90 px-2.5 py-0.5 text-[11px] text-slate-100 shadow-lg backdrop-blur-md hover:scale-110 hover:bg-slate-900 transition cursor-pointer"
          >
            {fPin.avatarUrl ? (
              <img
                src={fPin.avatarUrl}
                alt={fPin.login}
                className="h-4 w-4 rounded-full border border-white/40 shrink-0"
              />
            ) : (
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: fPin.color }}
              />
            )}
            <span className="font-mono font-semibold text-emerald-300">
              @{fPin.login}
            </span>
          </button>
        ))}

        {/* Carros de Contribuidores trafegando pelas avenidas */}
        {projectedCars.map((car) => (
          <button
            key={car.id}
            type="button"
            onClick={() => {
              const targetBldg = world?.buildings.find(
                (b) => b.repositoryId === car.repositoryId
              );
              if (targetBldg) {
                onSelectBuilding(targetBldg.id);
                onCameraModeChange("building");
              }
            }}
            style={{
              left: `${car.x}px`,
              top: `${car.y}px`,
              transform: "translate(-50%, -100%)",
            }}
            title={`@${car.login} contribuiu com ${car.contributions} commits em ${car.repositoryName}. Clique para ir ao prédio!`}
            className="absolute z-10 flex items-center gap-1.5 rounded-full border border-sky-400/50 bg-slate-950/90 px-2 py-0.5 text-[10px] text-slate-100 shadow-md backdrop-blur-md hover:border-sky-300 hover:scale-105 transition cursor-pointer"
          >
            {car.avatarUrl ? (
              <img
                src={car.avatarUrl}
                alt={car.login}
                className="h-3.5 w-3.5 rounded-full border border-sky-400/60 shrink-0"
              />
            ) : (
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: car.vehicleColor }}
              />
            )}
            <span className="font-mono font-semibold text-sky-300">
              @{car.login}
            </span>
            <span className="text-slate-400 truncate max-w-[90px]">
              → {car.repositoryName}
            </span>
          </button>
        ))}

        {/* Rótulos Holográficos 3D->2D projetados nos principais edifícios */}
        {projectedLabels.map((lbl) => (
          <button
            key={lbl.id}
            type="button"
            onClick={() => {
              onSelectBuilding(lbl.id);
              onCameraModeChange("building");
            }}
            style={{
              left: `${lbl.x}px`,
              top: `${lbl.y}px`,
              transform: "translate(-50%, -100%)",
            }}
            className={`group absolute z-10 flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium shadow-lg backdrop-blur-md transition cursor-pointer ${
              lbl.isSelected
                ? "border-sky-400 bg-sky-950/95 text-white scale-110 z-20"
                : "border-slate-700/80 bg-slate-950/80 text-slate-200 hover:border-sky-400/70 hover:bg-slate-900/95"
            }`}
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: lbl.color }}
            />
            <span className="truncate max-w-[125px] font-semibold">
              {lbl.name}
            </span>
            <span className="font-mono text-[10px] text-amber-300">
              ★{lbl.stars}
            </span>
          </button>
        ))}

        {/* Radar / Minimapa Urbano 2D Interativo */}
        {world &&
          (cameraMode === "city" ||
            cameraMode === "drone" ||
            cameraMode === "street" ||
            cameraMode === "building") && (
            <div className="pointer-events-auto absolute bottom-4 right-4 z-20 flex flex-col items-center gap-1 rounded-2xl border border-slate-800/90 bg-slate-950/90 p-2.5 shadow-2xl backdrop-blur-xl">
              <div className="flex w-full items-center justify-between px-1 text-[10px] font-mono text-slate-400">
                <span>RADAR URBANO</span>
                <span className="text-sky-400">
                  {cameraMode === "street" ? "🚶 1ª PESSOA" : "CLIQUE P/ RUA"}
                </span>
              </div>
              <svg
                width={126}
                height={126}
                viewBox="-100 -100 200 200"
                className="cursor-crosshair rounded-full border border-sky-500/30 bg-slate-900/90"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const nx =
                    ((e.clientX - rect.left) / rect.width) * 200 - 100;
                  const nz =
                    ((e.clientY - rect.top) / rect.height) * 200 - 100;
                  const scale = world.city.urbanRadius / 88;
                  stateRef.current.streetPos = {
                    x: nx * scale,
                    z: nz * scale,
                  };
                  onCameraModeChange("street");
                }}
              >
                <circle
                  cx={0}
                  cy={0}
                  r={88}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth={3}
                  strokeOpacity={0.55}
                />
                <line
                  x1={-88}
                  y1={0}
                  x2={88}
                  y2={0}
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  strokeOpacity={0.5}
                />
                <line
                  x1={0}
                  y1={-88}
                  x2={0}
                  y2={88}
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  strokeOpacity={0.5}
                />
                {world.buildings.map((b) => {
                  const scale = 88 / Math.max(1, world.city.urbanRadius);
                  const bx = b.position.x * scale;
                  const bz = b.position.z * scale;
                  const isSel = b.id === selectedBuildingId;
                  return (
                    <circle
                      key={b.id}
                      cx={bx}
                      cy={bz}
                      r={isSel ? 4.2 : 2.6}
                      fill={
                        isSel ? "#38bdf8" : b.appearanceParameters.primaryColor
                      }
                      stroke={isSel ? "#ffffff" : "none"}
                      strokeWidth={1}
                    />
                  );
                })}
                {(() => {
                  const scale = 88 / Math.max(1, world.city.urbanRadius);
                  const ux = Math.max(
                    -86,
                    Math.min(86, radarUserPos.x * scale)
                  );
                  const uz = Math.max(
                    -86,
                    Math.min(86, radarUserPos.z * scale)
                  );
                  return (
                    <circle
                      cx={ux}
                      cy={uz}
                      r={4}
                      fill="#f43f5e"
                      stroke="#ffffff"
                      strokeWidth={1.2}
                    />
                  );
                })()}
              </svg>
            </div>
          )}

        {hoveredBuilding && (
          <div
            className="pointer-events-none fixed z-30 rounded-lg border border-sky-400/40 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-xl backdrop-blur-md"
            style={{
              left: Math.min(window.innerWidth - 220, hoveredBuilding.x + 16),
              top: Math.max(16, hoveredBuilding.y - 16),
            }}
          >
            <div className="font-semibold text-sky-300">
              {hoveredBuilding.name}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-300">
              <span>{hoveredBuilding.language}</span>
              <span>•</span>
              <span>★ {hoveredBuilding.stars}</span>
              <span>•</span>
              <span>{hoveredBuilding.height}m</span>
            </div>
            <div className="mt-1 text-[10px] text-sky-400/80">
              Clique para inspecionar rastreabilidade
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default WorldCanvas;
