import { world, system } from "@minecraft/server";
import { H } from "./hybrid_config.js";
import { racaHibrida } from "./hybrid_system.js";
import { modoDeJogo } from "./compat.js";

export function expostoAoSol(p) {
  const dim = p.dimension;
  if (dim.id !== "minecraft:overworld" || p.isInWater || !["survival", "adventure"].includes(modoDeJogo(p))) return false;
  const hora = world.getTimeOfDay();
  if (hora < H.solInicio || hora >= H.solFim || dim.getWeather() !== "Clear") return false;
  const olhos = p.getHeadLocation();
  if (dim.getBlock({ ...olhos, y: Math.floor(olhos.y) })?.isLiquid) return false;
  const cobertura = dim.getTopmostBlock({ x: Math.floor(olhos.x), z: Math.floor(olhos.z) });
  return !cobertura || cobertura.y < Math.floor(olhos.y) + 1;
}

export function danoSolar(p) {
  const resistencia = Math.max(0, Math.min(0.85, H.solResistencia));
  const protecao = p.hasTag("sunshield") ? Math.min(0.5, Math.max(0, H.solProtecaoLegitima)) : 0;
  return H.solDanoOni * (1 - resistencia) * (1 - protecao);
}

system.runInterval(() => {
  for (const p of world.getPlayers({ tags: ["kny_hybrid"] })) {
    try {
      if (!racaHibrida(p) || p.hasTag("kny_caido") || !expostoAoSol(p)) continue;
      // Sem combustão. O caminho de fogo/lava/ataques do addon não é alterado.
      const h = p.getComponent("minecraft:health");
      if (!h || h.currentValue <= 0) continue;
      const reg = p.getEffect("regeneration");
      const extra = reg ? Math.min(8, 20 / Math.max(1, 50 >> reg.amplifier)) : 0;
      p.applyDamage(danoSolar(p) + extra, { cause: "magic" });
      if (system.currentTick % (H.solTicks * 3) === 0) p.sendMessage("§6A luz solar está ferindo você.");
    } catch (e) {
      console.warn("[Híbridos] Exposição solar: " + e);
    }
  }
}, H.solTicks);
