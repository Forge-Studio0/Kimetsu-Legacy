import { system, world } from "@minecraft/server";
import { H } from "./hybrid_config.js";
import { gravarJson, guardarPersonagem, identificador, lerJson, registrarAuditoria } from "./hybrid_records.js";
import { ehStaff, emCombate, estadoBloqueado, getPublicFaction, getPublicIdentity, getTrueRank, racaHibrida } from "./hybrid_system.js";

const CHAVE = "kny:h_locais";
const viagens = new Map();
export const viagemEmCurso = (p) => viagens.has(p.id);
const IDS = /^[a-z][a-z0-9_-]{0,23}$/;
const idValido = (id) => IDS.test(id) && id !== "castelo" && id !== "constructor";
const POLITICAS = ["cacador", "oni", "revelado", "hibrido"];
const PERIGO = /(?:lava|fire|magma|campfire|powder_snow|cactus|sweet_berry_bush|pointed_dripstone|end_portal|nether_portal|wither_rose)/;
const pontoValido = (p) => p && typeof p.dim === "string" &&
  [p.x, p.y, p.z].every((v) => Number.isFinite(v) && Math.abs(v) < 29999984);
const ponto = (p) => ({ dim: p.dimension.id, ...p.location, rot: p.getRotation() });
const contido = (a, b, dim, pos) => a.dim === dim && b.dim === dim &&
  ["x", "y", "z"].every((axis) => pos[axis] >= Math.floor(Math.min(a[axis], b[axis])) &&
    pos[axis] < Math.floor(Math.max(a[axis], b[axis])) + 1);

export function locais() {
  const d = lerJson(world, CHAVE);
  if (d === undefined) return { v: 1, castelo: { ms: H.casteloMs, ticks: H.casteloPreparacao }, acessos: {}, bloqueios: {} };
  if (!d?.castelo || !d.acessos || !d.bloqueios) return null;
  for (const x of [d.castelo, ...Object.values(d.acessos)]) {
    if ((x.entrada && !pontoValido(x.entrada)) || (x.saida && !pontoValido(x.saida))) return null;
  }
  for (const x of Object.values(d.bloqueios)) {
    if ((x.a && !pontoValido(x.a)) || (x.b && !pontoValido(x.b))) return null;
  }
  return d;
}

export function areaPermite(dim, pos) {
  const d = locais();
  return !!d && !Object.values(d.bloqueios).some(({ a, b }) => a && b && contido(a, b, dim.id, pos));
}

export function destinoSeguro(dim, pos) {
  if (!areaPermite(dim, pos)) return false;
  try {
    const base = { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) };
    const piso = dim.getBlock({ ...base, y: base.y - 1 });
    const pes = dim.getBlock(base);
    const cabeca = dim.getBlock({ ...base, y: base.y + 1 });
    return !!piso?.isSolid && !PERIGO.test(piso.typeId) && !!pes?.isAir && !!cabeca?.isAir;
  } catch {
    return false;
  }
}

export function canAccessLocation(p, id, direcao = "entrada") {
  const d = racaHibrida(p);
  if (id === "castelo") return !!d && (direcao === "saida"
    ? !!d.noCastelo && p.dimension.id === locais()?.castelo.entrada?.dim
    : !d.noCastelo && d.publico !== "cacador");
  const reg = locais()?.acessos[id];
  if (!reg?.politica) return false;
  if (reg.minimo > 0 && getTrueRank(p).min < reg.minimo) return false;
  if (reg.politica === "hibrido") return !!d;
  if (reg.politica === "revelado") return d?.publico === "revelado";
  if (d && reg.politica === "cacador" && (!reg.infiltracao || reg.minimo > 0)) return false;
  return getPublicFaction(p) === reg.politica;
}

// Localização e regiões são propriedades do mundo. Nunca são definidas por coordenadas do cliente.
export function configurarLocal(p, partes) {
  if (!ehStaff(p)) return "Somente a Staff pode configurar acessos.";
  const d = locais();
  if (!d) return "Configuração inválida. Consulte o log do servidor.";
  const [tipo, id, campo, politica, minimo] = partes;
  const aqui = ponto(p);
  if (tipo === "castelo" && ["entrada", "saida"].includes(id)) {
    if (!destinoSeguro(p.dimension, aqui)) return "Use um local seguro com piso sólido e dois blocos de ar.";
    d.castelo[id] = aqui;
  } else if (tipo === "castelo" && id === "tempos") {
    const preparo = Number(campo);
    const recarga = Number(politica);
    if (!Number.isInteger(preparo) || preparo < 1 || preparo > 30 ||
        !Number.isInteger(recarga) || recarga < 10 || recarga > 600) return "Informe preparação de 1 a 30s e recarga de 10 a 600s.";
    d.castelo.ticks = preparo * 20;
    d.castelo.ms = recarga * 1000;
  } else if (tipo === "portal" && idValido(id) && ["entrada", "saida", "politica"].includes(campo)) {
    const acesso = d.acessos[id] ?? {};
    if (campo === "politica") {
      const rank = Number(minimo ?? 0);
      if (!POLITICAS.includes(politica) || !Number.isInteger(rank) || rank < 0 || rank > 10000) return "Política ou patente mínima inválida.";
      Object.assign(acesso, { politica, minimo: rank, infiltracao: partes[5] === "infiltracao" });
    } else {
      if (!destinoSeguro(p.dimension, aqui)) return "Ponto inseguro.";
      acesso[campo] = aqui;
    }
    d.acessos[id] = acesso;
  } else if (tipo === "bloqueio" && idValido(id) && ["a", "b"].includes(campo)) {
    const box = d.bloqueios[id] ?? {};
    if (box[campo === "a" ? "b" : "a"] && box[campo === "a" ? "b" : "a"].dim !== aqui.dim) return "Use dois cantos na mesma dimensão.";
    box[campo] = aqui;
    d.bloqueios[id] = box;
  } else {
    return "Use castelo entrada/saida, castelo tempos, portal ID entrada/saida/politica ou bloqueio ID a/b.";
  }
  gravarJson(world, CHAVE, d);
  registrarAuditoria("configurar_local", { autor: identificador(p), tipo, id, campo, politica });
  return "Configuração de acesso salva.";
}

function parar(id, mensagem) {
  const v = viagens.get(id);
  if (!v) return;
  viagens.delete(id);
  if (v.timer !== undefined) system.clearRun(v.timer);
  if (v.p.isValid) {
    if (v.hibrido) v.p.setProperty("kny:h_ocupado", false);
    if (mensagem) v.p.sendMessage("§e" + mensagem);
  }
}

function pronto(v) {
  const p = v.p;
  if (viagens.get(p.id) !== v || estadoBloqueado(p) || emCombate(p) || p.dimension.id !== v.origem.dim ||
      Math.hypot(p.location.x - v.origem.x, p.location.y - v.origem.y, p.location.z - v.origem.z) > 1.5) return false;
  const local = locais()?.[v.castelo ? "castelo" : "acessos"];
  const cfg = v.castelo ? local : local?.[v.id];
  return JSON.stringify(cfg?.[v.direcao]) === JSON.stringify(v.destino) &&
    canAccessLocation(p, v.id, v.direcao) && areaPermite(p.dimension, p.location);
}

async function concluir(v) {
  const p = v.p;
  const chave = "kny_h_viagem_" + v.serial;
  let area;
  try {
    if (!pronto(v)) return parar(p.id, "Preparação interrompida.");
    const dim = world.getDimension(v.destino.dim);
    const { x, y, z } = v.destino;
    if (!dim.isChunkLoaded({ x, y, z }) && world.tickingAreaManager) {
      const op = { dimension: dim, from: { x, y, z }, to: { x, y, z } };
      area = world.tickingAreaManager;
      if (!area.hasCapacity(op)) return parar(p.id, "Destino sem capacidade de carregamento.");
      await area.createTickingArea(chave, op);
    }
    if (!pronto(v) || !destinoSeguro(dim, v.destino)) return parar(p.id, "Destino indisponível ou inseguro.");
    try { p.camera.fade({ fadeTime: { fadeInTime: 0.2, holdTime: 0.3, fadeOutTime: 0.3 }, fadeColor: { red: 0, green: 0, blue: 0 } }); } catch {}
    const d = racaHibrida(p);
    if (d && v.castelo) guardarPersonagem(p, { ...d, casteloAte: Date.now() + v.ms, noCastelo: v.direcao === "entrada" });
    if (!p.tryTeleport({ x, y, z }, { dimension: dim, rotation: v.destino.rot, checkForBlocks: true, keepVelocity: false })) {
      if (d && v.castelo) guardarPersonagem(p, d);
      return parar(p.id, "O teletransporte foi bloqueado pelo mundo.");
    }
    parar(p.id, v.castelo ? (v.direcao === "entrada" ? "Você entrou no Castelo Infinito." : "Você saiu do Castelo Infinito.") : "Acesso autorizado.");
    try { p.playSound("biwa_sound"); } catch {}
  } catch (e) {
    parar(p.id, "O destino não pôde ser carregado com segurança.");
    console.warn("[Híbridos] Acesso: " + e);
  } finally {
    if (area?.hasTickingArea(chave)) area.removeTickingArea(chave);
  }
}

let serial = 0;
export function viajar(p, id = "castelo", direcao = "entrada") {
  if (!["entrada", "saida"].includes(direcao)) return "Sentido inválido.";
  const castelo = id === "castelo";
  const d = locais();
  const cfg = castelo ? d?.castelo : d?.acessos[id];
  if (!cfg?.entrada || !cfg.saida) return castelo ? "O Castelo Infinito ainda não foi configurado pela administração." : "Acesso ainda não configurado.";
  if (!canAccessLocation(p, id, direcao)) return "Sua identidade ou patente não permite este acesso.";
  if (estadoBloqueado(p) || emCombate(p) || viagens.has(p.id) || p.getProperty("kny:h_ocupado") || !areaPermite(p.dimension, p.location)) return "Aguarde em segurança antes de viajar.";
  const h = racaHibrida(p);
  if (castelo && (h.casteloAte ?? 0) > Date.now()) return `Castelo em recarga por ${Math.ceil((h.casteloAte - Date.now()) / 1000)}s.`;
  const destino = cfg[direcao];
  if (!pontoValido(destino)) return "Destino inválido.";
  // Um portal comum só funciona junto ao ponto oposto configurado.
  if (!castelo) {
    const origem = cfg[direcao === "entrada" ? "saida" : "entrada"];
    if (origem.dim !== p.dimension.id || Math.hypot(origem.x - p.location.x, origem.y - p.location.y, origem.z - p.location.z) > 3) return "Aproxime-se do portal configurado.";
  }
  const ticks = castelo ? cfg.ticks : H.casteloPreparacao;
  const v = { p, id, direcao, destino, origem: ponto(p), castelo, hibrido: !!h, ms: cfg.ms, serial: ++serial };
  viagens.set(p.id, v);
  if (h) p.setProperty("kny:h_ocupado", true);
  v.timer = system.runTimeout(() => concluir(v), ticks);
  p.sendMessage(`§5Preparando o acesso. Permaneça no local por ${ticks / 20}s.`);
  return undefined;
}

world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
  if (viagens.has(hurtEntity.id)) parar(hurtEntity.id, "Viagem cancelada pelo dano recebido.");
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => parar(playerId));
world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
  if (viagens.has(player.id)) parar(player.id);
  const d = racaHibrida(player);
  if (d?.noCastelo && player.dimension.id !== locais()?.castelo.entrada?.dim) guardarPersonagem(player, { ...d, noCastelo: false });
});
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  parar(deadEntity.id);
  if (deadEntity.typeId !== "minecraft:player" || !deadEntity.isValid) return;
  const d = racaHibrida(deadEntity);
  if (d?.noCastelo) guardarPersonagem(deadEntity, { ...d, noCastelo: false });
});
