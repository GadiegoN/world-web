/**
 * VOLUME 03, 09 & 10 — PRESETS DE ATMOSFERA E TIPOS DE ESCALA DE CÂMERA
 */

import { Continent } from "@/domain/types";

export type CameraScaleMode =
  | "orbital"
  | "continental"
  | "city"
  | "drone"
  | "street"
  | "building";

export type AtmosphereTimeMode = "night" | "sunset" | "day" | "cyber";

export interface AtmospherePreset {
  bg: string;
  fogColor: string;
  fogDensity: number;
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPos: [number, number, number];
  rimColor: string;
  rimIntensity: number;
  windowBoost: number;
}

export const DEFAULT_PREVIEW_CONTINENT: Continent = {
  id: "preview_pangeia",
  planetId: "preview_planet",
  name: "Pangeia",
  seed: 20261110,
  centerCoordinates: { latitude: 12, longitude: 18, elevation: 0.35 },
  angularRadius: 64,
  coastlineComplexity: 0.95,
  palette: {
    lowland: "#1e4d3b",
    highland: "#2d6a4f",
    mountain: "#64748b",
    coast: "#d4a373",
  },
};

export const ATMOSPHERE_PRESETS: Record<AtmosphereTimeMode, AtmospherePreset> = {
  night: {
    bg: "#030712",
    fogColor: "#030712",
    fogDensity: 0.0011,
    ambientColor: "#94a3b8",
    ambientIntensity: 0.85,
    sunColor: "#e2e8f0",
    sunIntensity: 1.9,
    sunPos: [200, 320, 240],
    rimColor: "#38bdf8",
    rimIntensity: 1.0,
    windowBoost: 1.0,
  },
  sunset: {
    bg: "#1a1025",
    fogColor: "#2e1636",
    fogDensity: 0.0014,
    ambientColor: "#fda4af",
    ambientIntensity: 1.05,
    sunColor: "#fb923c",
    sunIntensity: 2.6,
    sunPos: [340, 120, 180],
    rimColor: "#c084fc",
    rimIntensity: 1.2,
    windowBoost: 0.85,
  },
  day: {
    bg: "#0c243c",
    fogColor: "#0f2e4a",
    fogDensity: 0.0009,
    ambientColor: "#f8fafc",
    ambientIntensity: 1.5,
    sunColor: "#ffffff",
    sunIntensity: 2.8,
    sunPos: [160, 420, 220],
    rimColor: "#7dd3fc",
    rimIntensity: 0.8,
    windowBoost: 0.35,
  },
  cyber: {
    bg: "#04020d",
    fogColor: "#070318",
    fogDensity: 0.0015,
    ambientColor: "#818cf8",
    ambientIntensity: 0.9,
    sunColor: "#22d3ee",
    sunIntensity: 2.3,
    sunPos: [200, 280, -200],
    rimColor: "#f43f5e",
    rimIntensity: 1.5,
    windowBoost: 1.35,
  },
};

