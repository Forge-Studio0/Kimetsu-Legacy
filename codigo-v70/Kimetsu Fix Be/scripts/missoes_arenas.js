import { system, world } from "@minecraft/server";
import { gravarJson, lerJson } from "./hybrid_records.js";
import { MISSAO_ID, REGRAS_MISSAO, TIPOS_OBJETIVO, picoInimigos } from "./missoes_catalogo.js";

export const DIM_ARENAS = "kny:missoes";
const PREFIXO = "kny:arena_";
const PERIGOS = new Set(["minecraft:magma", "minecraft:cactus", "minecraft:campfire", "minecraft:soul_campfire",
  "minecraft:powder_snow", "minecraft:lava", "minecraft:flowing_lava", "minecraft:fire", "minecraft:soul_fire",
  "minecraft:sweet_berry_bush", "minecraft:wither_rose", "minecraft:pointed_dripstone", "minecraft:portal",
  "minecraft:end_portal", "minecraft:end_gateway"]);
const EIXOS = ["x", "y", "z"];
const carregamentos = new Map();

system.beforeEvents.startup.subscribe(({ dimensionRegistry }) => dimensionRegistry.registerCustomDimension(DIM_ARENAS));

export const pegarArena = (id) => lerJson(world, PREFIXO + id);
export const arenas = () => world.getDynamicPropertyIds().filter((id) => id.startsWith(PREFIXO))
  .map((id) => pegarArena(id.slice(PREFIXO.length))).filter(Boolean);

export function coordenadaValida(pos) {
  return !!pos && EIXOS.every((k) => Number.isFinite(pos[k])) &&
    Math.abs(pos.x) < 29999900 && Math.abs(pos.z) < 29999900 && pos.y >= -63 && pos.y <= 318;
}

export function limites(a) {
  if (!coordenadaValida(a?.a) || !coordenadaValida(a?.b)) return undefined;
  const min = {};
  const max = {};
  for (const k of EIXOS) {
    min[k] = Math.min(a.a[k], a.b[k]);
    max[k] = Math.max(a.a[k], a.b[k]) + 1;
  }
  return { min, max };
}

export function dentro(a, pos, margem = 0) {
  const caixa = limites(a);
  return caixa && !!pos && EIXOS.every((k) => pos[k] >= caixa.min[k] - margem && pos[k] < caixa.max[k] + margem);
}

function sobrepostas(a, b, margem) {
  const x = limites(a);
  const y = limites(b);
  return !!x && !!y && ["x", "z"].every((k) => x.min[k] < y.max[k] + margem && y.min[k] < x.max[k] + margem);
}

export function novoLocal(p) {
  const { x, y, z } = p.location;
  return { x: Math.floor(x) + 0.5, y: Math.floor(y + 0.05), z: Math.floor(z) + 0.5 };
}

export function destinoSeguro(dim, pos) {
  if (!coordenadaValida(pos)) return false;
  try {
    const base = dim.getBlock({ ...pos, y: pos.y - 1 });
    const pes = dim.getBlock(pos);
    const cabeca = dim.getBlock({ ...pos, y: pos.y + 1 });
    return base?.isSolid && !PERIGOS.has(base.typeId) && [pes, cabeca].every((b) =>
      b && !b.isSolid && !b.isLiquid && !PERIGOS.has(b.typeId));
  } catch {
    return false;
  }
}

export function erroArena(a, outras = arenas()) {
  if (!a || !/^[a-z0-9_]{2,22}$/.test(a.id) || typeof a.nome !== "string" || !a.nome.trim() || a.dim !== DIM_ARENAS) {
    return "Identificação ou dimensão inválida.";
  }
  const caixa = limites(a);
  if (!caixa) return "Marque os dois cantos.";
  const [x, y, z] = EIXOS.map((k) => caixa.max[k] - caixa.min[k]);
  if (x < 8 || z < 8 || y < 4 || x > REGRAS_MISSAO.tetoDimensao || z > REGRAS_MISSAO.tetoDimensao || y > REGRAS_MISSAO.tetoAltura) {
    return "A região exige largura e comprimento de 8 a 48 blocos e altura de 4 a 48.";
  }
  if (outras.some((b) => b.id !== a.id && sobrepostas(a, b, REGRAS_MISSAO.distanciaEntreArenas))) {
    return `Separe as regiões por ${REGRAS_MISSAO.distanciaEntreArenas} blocos na horizontal.`;
  }
  if (!a.saida || a.saida.dim === DIM_ARENAS || !coordenadaValida(a.saida.pos)) return "Registre uma saída segura fora da dimensão.";
  if (!Number.isInteger(a.capacidade) || a.capacidade < 1 || a.capacidade > REGRAS_MISSAO.grupoMaximo) return "Capacidade inválida.";
  if (!Array.isArray(a.tipos) || !a.tipos.length || a.tipos.some((t) => !Object.hasOwn(TIPOS_OBJETIVO, t))) return "Selecione os tipos permitidos.";
  if (!Array.isArray(a.ranks) || !a.ranks.length || a.ranks.some((r) => !["D", "C", "B", "A", "S"].includes(r))) return "Ranks da arena inválidos.";
  if (!Array.isArray(a.missoes) || a.missoes.some((m) => !MISSAO_ID.has(m))) return "Há um ID de missão inválido.";
  if (a.tipos.some((t) => t === "local" || t === "proteger") &&
      a.tipos.filter((t) => t === "local" || t === "proteger").some((t) => !a.missoes.some((id) => MISSAO_ID.get(id).objetivo === t))) {
    return "Associe pelo menos uma missão de localização ou proteção para cada tipo correspondente.";
  }
  if (!Array.isArray(a.entradas) || a.entradas.length < a.capacidade) return "Registre uma entrada distinta para cada vaga.";
  if (!Array.isArray(a.spawns) || (a.tipos.some((t) => t !== "local") && !a.spawns.length)) return "Registre os pontos de geração.";
  const pontos = [...a.entradas, ...a.spawns];
  if (a.tipos.some((t) => t === "local" || t === "proteger") && !a.objetivo) return "Registre o ponto do objetivo.";
  if (a.objetivo) pontos.push(a.objetivo);
  if (!pontos.every((p) => coordenadaValida(p) && dentro(a, p) && dentro(a, { ...p, y: p.y + 1 }))) {
    return "Mantenha os pontos e o espaço acima deles dentro dos limites.";
  }
  if (new Set(pontos.map((p) => `${p.x},${p.y},${p.z}`)).size !== pontos.length) return "Use pontos diferentes para entradas, geração e objetivo.";
  return undefined;
}

export function criarArena(id, nome) {
  if (!/^[a-z0-9_]{2,22}$/.test(id) || !nome.trim() || nome.length > 38 || pegarArena(id)) return undefined;
  const a = { v: 1, id, nome: nome.trim(), dim: DIM_ARENAS, ativa: false, capacidade: 1,
    entradas: [], spawns: [], tipos: [], missoes: [], ranks: ["D", "C", "B", "A", "S"] };
  gravarJson(world, PREFIXO + id, a);
  return a;
}

export const gravarArena = (a) => gravarJson(world, PREFIXO + a.id, a);

export function arenaCompativel(a, m, tamanho, todas) {
  return a.ativa && !erroArena(a, todas) && tamanho <= a.capacidade && a.ranks.includes(m.dificuldade) &&
    a.tipos.includes(m.objetivo) && (!a.missoes.length || a.missoes.includes(m.id)) &&
    a.spawns.length >= picoInimigos(m, tamanho);
}

export function caixaCarregamento(a) {
  const { min, max } = limites(a);
  return { dimension: world.getDimension(DIM_ARENAS), from: min, to: { x: max.x - 1, y: max.y - 1, z: max.z - 1 } };
}

export function chavesCarregadas(area) {
  for (let x = Math.floor(area.from.x / 16); x <= Math.floor(area.to.x / 16); x++) {
    for (let z = Math.floor(area.from.z / 16); z <= Math.floor(area.to.z / 16); z++) {
      if (!area.dimension.isChunkLoaded({ x: x * 16, y: area.from.y, z: z * 16 })) return false;
    }
  }
  return true;
}

export async function carregarArea(chave, area, continuar = () => true) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    if (!continuar() || await aguardarArea(chave, area, continuar)) return;
    descarregarArea(chave);
    if (!continuar()) return;
    await system.waitTicks(24);
  }
  if (continuar()) throw new Error("Os chunks da área não carregaram a tempo.");
}

async function aguardarArea(chave, area, continuar) {
  const mgr = world.tickingAreaManager;
  let carga = carregamentos.get(chave);
  if (!carga && !mgr.hasTickingArea(chave)) {
    if (!mgr.hasCapacity(area)) throw new Error("Limite de carregamento do servidor atingido.");
    carga = { removida: false };
    carregamentos.set(chave, carga);
    void mgr.createTickingArea(chave, area).then(() => {
      if (carga.removida && mgr.hasTickingArea(chave)) mgr.removeTickingArea(chave);
    }).catch((e) => { carga.erro = e; }).finally(() => {
      if (carregamentos.get(chave) === carga) carregamentos.delete(chave);
    });
  }
  // O Bedrock pode deixar a promessa pendente ao reservar chunks já residentes.
  // Confirme o carregamento real e imponha um prazo para a reserva.
  for (let i = 0; i < 25 && !chavesCarregadas(area); i++) {
    if (!continuar()) return false;
    if (carga?.erro) throw carga.erro;
    await system.waitTicks(2);
  }
  if (carga?.erro) throw carga.erro;
  return chavesCarregadas(area);
}

export function descarregarArea(chave) {
  const mgr = world.tickingAreaManager;
  const carga = carregamentos.get(chave);
  if (carga) {
    carga.removida = true;
    carregamentos.delete(chave);
  }
  if (mgr.hasTickingArea(chave)) mgr.removeTickingArea(chave);
}

export async function comPontoCarregado(chave, dim, pos, acao, continuar = () => true) {
  if (!continuar()) return;
  if (dim.isChunkLoaded(pos)) return acao();
  try {
    await carregarArea(chave, { dimension: dim, from: pos, to: pos }, continuar);
    if (continuar()) return await acao();
  } finally {
    descarregarArea(chave);
  }
}

export function validarPontos(a) {
  const dim = world.getDimension(DIM_ARENAS);
  return [...a.entradas, ...a.spawns, ...(a.objetivo ? [a.objetivo] : [])].every((p) => destinoSeguro(dim, p));
}
