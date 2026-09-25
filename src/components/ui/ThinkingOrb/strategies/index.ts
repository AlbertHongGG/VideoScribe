import { OrbState, IOrbStrategy } from "../types";
import { RibbonStrategy } from "./RibbonStrategy";
import { GlobeStrategy } from "./GlobeStrategy";
import { OrbitsStrategy } from "./OrbitsStrategy";

const ribbonStrategy = new RibbonStrategy();
const globeStrategy = new GlobeStrategy();
const orbitsStrategy = new OrbitsStrategy();

export function getOrbStrategy(state: OrbState): IOrbStrategy {
  switch (state) {
    case "composing":
      return ribbonStrategy;
    case "searching":
      return globeStrategy;
    case "working":
    case "listening":
    case "solving":
    case "shaping":
    default:
      return orbitsStrategy;
  }
}
