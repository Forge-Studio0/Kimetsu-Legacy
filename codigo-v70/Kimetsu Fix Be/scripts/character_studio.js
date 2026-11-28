import { system, world } from "@minecraft/server";

export const DIMENSAO_ESTUDIO = "kny:estudio";
const ORIGEM = "kny:criacao_origem";
const SEQUENCIA = "kny:estudio_sequencia";
const retornos = new Map();
let serial = 0;

system.beforeEvents.startup.subscribe(({ dimensionRegistry }) => {
  dimensionRegistry.registerCustomDimension(DIMENSAO_ESTUDIO);
});

export const retornoPendente = (p) => typeof p.getDynamicProperty(ORIGEM) === "string";

async function comChunk(dim, pos, acao) {
  const gestor = world.tickingAreaManager;
  if (dim.isChunkLoaded(pos)) return acao();
  const chave = "kny_estudio_" + ++serial;
  const area = { dimension: dim, from: pos, to: pos };
  if (!gestor?.hasCapacity(area)) throw new Error("Sem espaço para carregar o estúdio.");
  try {
    await gestor.createTickingArea(chave, area);
    return await acao();
  } finally {
    if (gestor.hasTickingArea(chave)) gestor.removeTickingArea(chave);
  }
}

export async function entrarEstudio(p, podeEntrar) {
  if (retornoPendente(p) || p.dimension.id === DIMENSAO_ESTUDIO) return false;
  const dim = world.getDimension(DIMENSAO_ESTUDIO);
  const n = world.getDynamicProperty(SEQUENCIA) ?? 0;
  if (n >= 4096 ** 2) throw new Error("Limite de posições do estúdio atingido.");
  world.setDynamicProperty(SEQUENCIA, n + 1);
  const x = (n % 4096) * 4096 + 8;
  const z = Math.floor(n / 4096) * 4096 + 8;
  const pos = { x: x + 0.5, y: 80, z: z + 0.5 };
  return comChunk(dim, pos, () => {
    if (!p.isValid || !podeEntrar()) return false;
    dim.runCommand(`fill ${x - 7} 79 ${z - 7} ${x + 7} 79 ${z + 7} minecraft:polished_deepslate`);
    dim.runCommand(`fill ${x - 7} 80 ${z - 7} ${x + 7} 85 ${z + 7} minecraft:polished_deepslate outline`);
    dim.runCommand(`fill ${x - 6} 85 ${z - 6} ${x + 6} 85 ${z + 6} minecraft:air`);
    dim.runCommand(`fill ${x - 6} 80 ${z - 6} ${x + 6} 80 ${z + 6} minecraft:air`);
    p.setDynamicProperty(ORIGEM, JSON.stringify({ dim: p.dimension.id, pos: p.location, rot: p.getRotation() }));
    if (!p.tryTeleport(pos, { dimension: dim, rotation: { x: 0, y: 0 }, keepVelocity: false, checkForBlocks: true })) {
      p.setDynamicProperty(ORIGEM, undefined);
      return false;
    }
    return true;
  });
}

export function sairEstudio(p) {
  if (!p.isValid || !retornoPendente(p)) return Promise.resolve(true);
  if (retornos.has(p.id)) return retornos.get(p.id);
  const tarefa = (async () => {
    const { dim, pos, rot } = JSON.parse(p.getDynamicProperty(ORIGEM));
    while (p.isValid && p.dimension.id === DIMENSAO_ESTUDIO) {
      try {
        const destino = world.getDimension(dim);
        const voltou = await comChunk(destino, pos, () =>
          p.isValid && (p.dimension.id !== DIMENSAO_ESTUDIO || p.tryTeleport(pos, {
            dimension: destino, rotation: rot, keepVelocity: false,
          }))
        );
        if (voltou) break;
      } catch {}
      if (p.isValid) await new Promise((resolve) => system.runTimeout(resolve, 40));
    }
    if (!p.isValid) return false;
    p.setDynamicProperty(ORIGEM, undefined);
    return true;
  })().catch((e) => {
    console.warn("[Estúdio] Retorno: " + e);
    return false;
  }).finally(() => {
    if (retornos.get(p.id) === tarefa) retornos.delete(p.id);
  });
  retornos.set(p.id, tarefa);
  return tarefa;
}

world.afterEvents.playerSpawn.subscribe(({ player }) => {
  system.run(() => { if (player.isValid && retornoPendente(player)) void sairEstudio(player); });
});
