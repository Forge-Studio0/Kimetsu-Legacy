import { areaPermite, locais } from "./hybrid_locations.js";
import { racaHibrida } from "./hybrid_system.js";

const SOBREMUNDO = "minecraft:overworld";
const DIMENSOES_DE_JOGO = new Set([SOBREMUNDO, "minecraft:nether", "minecraft:the_end"]);
// O acesso de facção existente exige ficar até três blocos do portal.
const RAIO_DO_PORTAL = 3;

function juntoDePonto(ponto, dimensao, pos) {
  return ponto?.dim === dimensao &&
    Math.hypot(ponto.x - pos.x, ponto.y - pos.y, ponto.z - pos.z) <= RAIO_DO_PORTAL;
}

export function regiaoPermiteRecurso(jogador, dim, pos, uso) {
  const id = typeof dim === "string" ? dim : dim?.id;
  if (!pos || ![pos.x, pos.y, pos.z].every(Number.isFinite)) return false;
  if (uso === "spawn") {
    if (id !== SOBREMUNDO) return false;
  } else if (uso === "pergaminho") {
    if (!DIMENSOES_DE_JOGO.has(id) || (jogador && racaHibrida(jogador)?.noCastelo)) return false;
  } else return false;
  if (!areaPermite({ id }, pos)) return false;

  // Um pergaminho não substitui o acesso oficial, mesmo para um jogador autorizado.
  const registro = locais();
  return !!registro && ![registro.castelo, ...Object.values(registro.acessos)].some(({ entrada, saida }) =>
    juntoDePonto(entrada, id, pos) || juntoDePonto(saida, id, pos));
}
