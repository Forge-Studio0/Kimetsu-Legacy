import { system, world } from "@minecraft/server";
import { modoDeJogo } from "./compat.js";
import { registrarTreinoRespiracao } from "./hybrid_mastery.js";
import { estadoBloqueado, getTrueRace } from "./hybrid_system.js";
import { entidadeDeMissao } from "./missoes_sessoes.js";
import { regiaoPermiteRecurso } from "./regioes_v86.js";
import {
  DIMENSAO_SPAWN, LUAS_INFERIORES, ONI_NATURAL, ONI_NATURAL_PROP, ONIS_COMUNS, SPAWN_NOTURNO as C,
} from "./spawn_noturno_config.js";
import { getScore, pontuar, premiarOni } from "./stats.js";
import { LIMITE_SALDO } from "./stats_config.js";

const TIPOS_COMUNS = Object.keys(ONIS_COMUNS);
const LUA = new Map(LUAS_INFERIORES.map((tipo) => [tipo.id, tipo]));
const PERIGOS = /(?:lava|fire|magma|campfire|powder_snow|cactus|sweet_berry_bush|pointed_dripstone|end_portal|nether_portal|wither_rose)/;
const ultimoCombate = new Map();
const abandonados = new Map();
const abatesRecentes = new Set();
let rotacao = 0;

const classe = (id) => Object.hasOwn(ONIS_COMUNS, id) ? "comum" : LUA.has(id) ? "inferior" : undefined;
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const natural = (e) => e?.hasTag?.(ONI_NATURAL) && !entidadeDeMissao(e);
const sobrevive = (p) => ["survival", "adventure"].includes(modoDeJogo(p));

export const horarioNoturno = (hora) => hora >= C.inicio && hora <= C.fim;

export function sortearOniNatural(aleatorio = Math.random) {
  const faixaComum = 10000 - LUAS_INFERIORES.reduce((soma, lua) => soma + lua.peso, 0);
  let sorteio = Math.floor(aleatorio() * 10000);
  if (sorteio < faixaComum) return TIPOS_COMUNS[Math.floor(aleatorio() * TIPOS_COMUNS.length)];
  sorteio -= faixaComum;
  for (const lua of LUAS_INFERIORES) {
    if (sorteio < lua.peso) return lua.id;
    sorteio -= lua.peso;
  }
}

function representantes(jogadores, inicio) {
  const escolhidos = [];
  for (let i = 0; i < jogadores.length; i++) {
    const p = jogadores[(inicio + i) % jogadores.length];
    if (escolhidos.every((q) => distancia(p.location, q.location) > C.densidade)) escolhidos.push(p);
  }
  return escolhidos;
}

function pertoDaMira(pos, p) {
  const mira = p.getViewDirection();
  const x = pos.x - p.location.x, z = pos.z - p.location.z;
  const produto = x * mira.x + z * mira.z;
  return produto > 0.75 * Math.hypot(x, z) * Math.hypot(mira.x, mira.z);
}

function espacoLivre(dim, coluna, y) {
  const pe = { ...coluna, y };
  const piso = dim.getBlock({ ...pe, y: y - 1 });
  return piso?.isSolid && !PERIGOS.test(piso.typeId) &&
    dim.getBlock(pe)?.isAir && dim.getBlock({ ...pe, y: y + 1 })?.isAir;
}

function procurarAltura(dim, x, z, inicial) {
  const coluna = { x, z };
  if (!dim.isChunkLoaded({ ...coluna, y: inicial })) return undefined;
  const limites = dim.heightRange;
  for (let delta = 0; delta <= C.alturaDeBusca; delta++) {
    const niveis = delta ? [inicial - delta, inicial + delta] : [inicial];
    for (const y of niveis) {
      if (y <= limites.min || y + 1 >= limites.max) continue;
      if (espacoLivre(dim, coluna, y)) return { x: x + 0.5, y, z: z + 0.5 };
    }
  }
}

function limiteLocalAtingido(tipo, centro, populacao) {
  let n = 0;
  return populacao.some((e) => e.classe === tipo && distancia(centro, e.pos) <= C.densidade && ++n >= C.limite[tipo].local);
}

function procurarLocal(dim, referencia, jogadores, populacao, tipo, aleatorio) {
  let aVista;
  const origem = referencia.location;
  for (let i = 0; i < C.tentativasDeLocal; i++) {
    const angulo = aleatorio() * 2 * Math.PI;
    const raio = C.minimo + 1 + aleatorio() * (C.maximo - C.minimo - 2);
    const x = Math.floor(origem.x + raio * Math.cos(angulo));
    const z = Math.floor(origem.z + raio * Math.sin(angulo));
    if (Math.abs(x) >= 29999984 || Math.abs(z) >= 29999984) continue;
    // O chunk pode descarregar entre a consulta e a leitura de um bloco.
    let pos;
    try { pos = procurarAltura(dim, x, z, Math.floor(origem.y)); } catch { continue; }
    if (!pos || distancia(origem, pos) > C.maximo ||
        jogadores.some((p) => distancia(p.location, pos) < C.minimo) ||
        !regiaoPermiteRecurso(undefined, dim.id, pos, "spawn") ||
        !regiaoPermiteRecurso(undefined, dim.id, { ...pos, y: pos.y + 1 }, "spawn") ||
        limiteLocalAtingido(tipo, pos, populacao) ||
        populacao.some((e) => distancia(e.pos, pos) < 1)) continue;
    const vizinhos = jogadores.filter((p) => distancia(p.location, pos) <= C.densidade);
    if (vizinhos.some((p) => limiteLocalAtingido(tipo, p.location, populacao))) continue;
    if (vizinhos.every((p) => !pertoDaMira(pos, p))) return pos;
    aVista ??= pos;
  }
  return aVista;
}

function limpar(jogadores, populacao, agora) {
  const carregados = new Set();
  for (const e of populacao) {
    if (!e.natural) continue;
    const mob = e.mob;
    carregados.add(mob.id);
    if (jogadores.some((p) => distancia(p.location, e.pos) <= C.distanciaLimpeza) ||
        agora - (ultimoCombate.get(mob.id) ?? -Infinity) <= C.janelaCombate) {
      abandonados.delete(mob.id);
      continue;
    }
    const desde = abandonados.get(mob.id) ?? agora;
    abandonados.set(mob.id, desde);
    if (agora - desde >= C.esperaLimpeza) {
      mob.remove(); // Sai sem acionar recompensas de morte.
      e.removido = true;
      abandonados.delete(mob.id);
    }
  }
  for (const id of abandonados.keys()) if (!carregados.has(id)) abandonados.delete(id);
  for (const [id, tick] of ultimoCombate) if (!carregados.has(id) || agora - tick > C.janelaCombate) ultimoCombate.delete(id);
}

export function cicloSpawnNoturno(aleatorio = Math.random) {
  const dim = world.getDimension(DIMENSAO_SPAWN);
  const jogadores = dim.getPlayers();
  const populacao = [];
  for (const mob of dim.getEntities({ families: ["demon"] })) {
    const tipo = classe(mob.typeId);
    if (!tipo || !mob.isValid || entidadeDeMissao(mob)) continue;
    populacao.push({ mob, pos: mob.location, classe: tipo, natural: natural(mob) });
  }
  limpar(jogadores, populacao, system.currentTick);
  abatesRecentes.clear();
  if (!horarioNoturno(world.getTimeOfDay()) || world.gameRules?.doMobSpawning === false ||
      String(world.getDifficulty?.()).toLowerCase() === "peaceful") return 0;
  const elegiveis = jogadores.filter((p) => p.isValid && sobrevive(p) && !estadoBloqueado(p));
  const referencias = representantes(elegiveis, rotacao++ % Math.max(1, elegiveis.length));
  const vivos = populacao.filter((e) => !e.removido);
  const total = { comum: 0, inferior: 0 };
  for (const e of vivos) if (e.natural) total[e.classe]++;
  let gerados = 0;
  for (const jogador of referencias) {
    if (aleatorio() >= C.tentativa) continue;
    const id = sortearOniNatural(aleatorio);
    const tipo = classe(id);
    if (!tipo || total[tipo] >= C.limite[tipo].global || limiteLocalAtingido(tipo, jogador.location, vivos)) continue;
    const pos = procurarLocal(dim, jogador, jogadores, vivos, tipo, aleatorio);
    if (!pos) continue;
    let mob;
    try {
      mob = dim.spawnEntity(id, pos, { initialPersistence: false });
      if (!mob.addTag(ONI_NATURAL)) throw new Error("Não foi possível marcar a origem do Oni.");
      mob.setProperty(ONI_NATURAL_PROP, true);
      vivos.push({ mob, pos, classe: tipo, natural: true });
      total[tipo]++;
      gerados++;
    } catch (erro) {
      if (mob?.isValid) mob.remove();
      console.warn("[Oni noturno] " + erro);
    }
  }
  return gerados;
}

function autorDoAbate(fonte) {
  const direto = fonte?.damagingEntity;
  if (!fonte || ["override", "suicide", "none", "fireTick"].includes(fonte.cause)) return undefined;
  if (direto?.typeId === "minecraft:player") return direto;
  const projetil = fonte.damagingProjectile ?? direto;
  if (!projetil?.isValid) return undefined;
  return projetil.getComponent("minecraft:projectile")?.owner;
}

function premiar(p, morto) {
  const raca = getTrueRace(p);
  const lua = LUA.get(morto.typeId);
  if (raca === "cacador") {
    const honra = ONIS_COMUNS[morto.typeId] ?? 1;
    pontuar(p, "upslayer", Math.min(LIMITE_SALDO, getScore(p, "upslayer") + honra));
    if (morto.typeId === "kny:demon" && p.hasTag("hashira")) {
      const anterior = getScore(p, "killer");
      const total = Math.min(LIMITE_SALDO, anterior + 1);
      pontuar(p, "killer", total);
      if (total === 50) p.addTag("crimson_nichirin");
      if (total !== anterior && total <= 50 && total % 10 === 0) {
        p.sendMessage("§6[Conquista] §fDemon Killer " + total);
      }
    }
  } else if (lua && (raca === "oni" || raca === "hibrido") && !p.hasTag(lua.marca)) {
    pontuar(p, "updemon", Math.max(lua.marco, getScore(p, "updemon")));
    p.addTag(lua.marca);
    p.sendMessage("§6[Conquista] §fDuelo de Sangue · Lua Inferior");
  }
  const pontos = premiarOni(p, morto.typeId);
  registrarTreinoRespiracao(p, "oni", 1);
  if (pontos > 0) p.sendMessage(`§a+${pontos} pontos de atributo §7(oni noturno derrotado)`);
}

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
  for (const e of [hurtEntity, damageSource?.damagingEntity]) {
    if (e?.isValid && natural(e) && classe(e.typeId)) ultimoCombate.set(e.id, system.currentTick);
  }
});

world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
  if (!natural(deadEntity) || !classe(deadEntity.typeId) || abatesRecentes.has(deadEntity.id)) return;
  const p = autorDoAbate(damageSource);
  if (!p?.isValid || p.typeId !== "minecraft:player" || p.dimension.id !== deadEntity.dimension.id ||
      !sobrevive(p) || estadoBloqueado(p) || entidadeDeMissao(p)) return;
  abatesRecentes.add(deadEntity.id);
  premiar(p, deadEntity);
});

system.runInterval(() => {
  try { cicloSpawnNoturno(); } catch (erro) { console.warn("[Oni noturno] " + erro); }
}, C.intervalo);
