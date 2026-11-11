/**
 * VOLUME 09 — CACHE DE TEXTURAS DE FACHADA (OTIMIZAÇÃO DE MEMÓRIA E GPU)
 * Reutiliza texturas procedurais de janelas entre edifícios da mesma linguagem e faixa de atividade,
 * evitando recriar centenas de elementos HTML5 <canvas> em cidades com muitos repositórios.
 */

import * as THREE from "three";

const facadeTextureCache = new Map<string, THREE.CanvasTexture>();

export function getCachedBuildingFacadeTexture(
  primaryHex: string,
  secondaryHex: string,
  emissiveHex: string,
  activityGlow: number,
  windowDensity: number
): THREE.CanvasTexture {
  // Quantiza glow e densidade em passos de 0.1 para maximizar reuso de textura na GPU sem perda visual
  const qGlow = Math.round(activityGlow * 10) / 10;
  const qDensity = Math.round(windowDensity * 10) / 10;
  const cacheKey = `${primaryHex}:${secondaryHex}:${emissiveHex}:${qGlow}:${qDensity}`;

  const existing = facadeTextureCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = secondaryHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = primaryHex;
    for (let x = 0; x < canvas.width; x += 16) {
      ctx.fillRect(x, 0, 11, canvas.height);
    }

    const rows = 32;
    const cols = 8;
    const padX = 2.5;
    const padY = 2;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hash = Math.sin((r * 13 + c * 29 + 7) * 12.9898) * 43758.5453;
        const rand = hash - Math.floor(hash);
        if (rand < qDensity * (0.45 + qGlow * 0.55)) {
          ctx.fillStyle = emissiveHex;
          ctx.globalAlpha = 0.5 + qGlow * 0.5;
        } else {
          ctx.fillStyle = "#080c14";
          ctx.globalAlpha = 0.88;
        }
        ctx.fillRect(
          c * cellW + padX,
          r * cellH + padY,
          cellW - padX * 2,
          cellH - padY * 2
        );
      }
    }
    ctx.globalAlpha = 1.0;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  facadeTextureCache.set(cacheKey, texture);
  return texture;
}

