import { system, world } from "@minecraft/server";
import { H, ARTE_H_ID, ARTES_H, IDENTIDADES, RESP_H_ID, ROTULOS } from "./hybrid_config.js";
import { avaliarDominio, ehCacadorHumano } from "./hybrid_mastery.js";
import { guardarPersonagem, identificador, indexarHibrido, personagem, registrarAuditoria } from "./hybrid_records.js";
import { agendarStats, getScore, patenteDe, pontuar, titularDe } from "./stats.js";
import { OBJ_REI, OBJ_LIDER, RANKS_CACADOR, RANKS_ONI } from "./stats_config.js";
import { modoDeJogo } from "./compat.js";

const emTransformacao = new Set();
const combate = new Map();
const tagH = "kny_hybrid";
const jogador = (p) => p?.isValid && p.typeId === "minecraft:player";
const ligado = (d) => d?.estado === "ativo";
const bloqueios = ["kny_caido", "animacao", "kny_finalizando", "kny_finalizado"];

export function ehStaff(p) {
  if (!jogador(p)) return false;
  try {
    if (p.playerPermissionLevel === 2 || p.isOp?.()) return true;
  } catch {}
  return p.hasTag("kny_op");
}

export const ehReiAutor = (p) => jogador(p) && p.hasTag("demon") && p.hasTag("kny_muzan") && titularDe(OBJ_REI) === p.name;
export const racaHibrida = (p) => {
  const d = personagem(p);
  return ligado(d) && d.raca === "hibrido" ? d : undefined;
};
export const isHybrid = (p) => !!racaHibrida(p);
export const isDemonLineage = (p) => !!racaHibrida(p) || p.hasTag("demon");
export const getTrueRace = (p) => isHybrid(p) ? "hibrido" : p.hasTag("demon") ? "oni" : ehCacadorHumano(p) ? "cacador" : "humano";
export const getTrueRank = patenteDe;

export function getPublicIdentity(p) {
  return racaHibrida(p)?.publico ?? getTrueRace(p);
}
export function getPublicFaction(p) {
  const identidade = getPublicIdentity(p);
  return identidade === "revelado" ? "oni" : identidade;
}
export function nomePublico(p) {
  const d = racaHibrida(p);
  return d ? `[${ROTULOS[d.publico]}] ${p.name}` : p.name;
}

export function canUseBreathing(p, id, item, forma) {
  const d = racaHibrida(p);
  const r = d && RESP_H_ID.get(d.resp);
  const itemValido = r?.obj === "basica" ? item?.hasTag?.("nichirin_cor") : r?.itens.includes(item?.typeId);
  return !!r && r.obj === id && !!itemValido && Number.isInteger(forma) && forma >= 1 && forma <= d.formas;
}

export function canUseKekkijutsu(p, id, item) {
  const d = racaHibrida(p);
  return d?.arte === id && ARTE_H_ID.get(id)?.item === item?.typeId &&
    (id !== "demonking" || ehReiAutor(p));
}

export function estadoBloqueado(p) {
  return !jogador(p) || bloqueios.some((t) => p.hasTag(t)) ||
    (p.getComponent("minecraft:health")?.currentValue ?? 1) <= 0 ||
    modoDeJogo(p) === "spectator";
}
export const emCombate = (p) => Math.max(combate.get(p.id) ?? 0, Number(p.getDynamicProperty("kny:h_combate_ate")) || 0) > Date.now();

export function mao(p) {
  return p.getComponent("minecraft:equippable")?.getEquipment("Mainhand") ??
    p.getComponent("minecraft:inventory")?.container?.getItem(p.selectedSlotIndex);
}

function prop(p, id, valor) {
  if (p.getProperty(id) !== valor) p.setProperty(id, valor);
}

export function espelharHibrido(p, d, forcar = false) {
  const estado = IDENTIDADES[d.publico];
  const arte = d.arte === "demonking" && !ehReiAutor(p) ? 0 : ARTE_H_ID.get(d.arte).codigo;
  const mudou = p.getProperty("kny:h_publico") !== estado;
  p.addTag("demon");
  p.addTag(tagH);
  if (p.hasTag("slayer")) p.removeTag("slayer");
  if (p.hasTag("slayer2")) p.removeTag("slayer2");
  prop(p, "kny:h_linhagem", 2);
  prop(p, "kny:h_resp", RESP_H_ID.get(d.resp).codigo);
  prop(p, "kny:h_arte", arte);
  prop(p, "kny:h_revelar", H.revelarPoder);
  prop(p, "kny:h_publico", estado);
  if (mudou || forcar) p.triggerEvent("kny:h_publico_" + d.publico);
  const nome = `[${ROTULOS[d.publico]}] ${p.name}`;
  if (p.nameTag !== nome) p.nameTag = nome;
}

export function revelar(p) {
  const d = racaHibrida(p);
  if (!H.revelarPoder || !d || d.publico === "revelado") return false;
  const novo = { ...d, publico: "revelado", disfarceAte: Math.max(d.disfarceAte ?? 0, Date.now() + H.disfarceMs) };
  guardarPersonagem(p, novo);
  espelharHibrido(p, novo);
  p.sendMessage("§cSeu poder revelou a sua natureza híbrida.");
  return true;
}

export function trocarDisfarce(p, publico) {
  const d = racaHibrida(p);
  if (!d || !Object.hasOwn(IDENTIDADES, publico)) return "Identidade indisponível.";
  if (d.publico === publico) return "Essa identidade já está ativa.";
  if (estadoBloqueado(p) || emCombate(p) || p.getProperty("kny:h_ocupado")) return "Aguarde o fim do combate ou da ação atual.";
  const falta = Math.ceil(((d.disfarceAte ?? 0) - Date.now()) / 1000);
  if (falta > 0) return `O disfarce estará pronto em ${falta}s.`;
  const novo = { ...d, publico, disfarceAte: Date.now() + H.disfarceMs };
  guardarPersonagem(p, novo);
  espelharHibrido(p, novo);
  return `Identidade pública agora é ${ROTULOS[publico]}.`;
}

function doseEmMaos(p) {
  const slot = p.selectedSlotIndex;
  const item = p.getComponent("minecraft:inventory")?.container?.getItem(slot);
  return item?.typeId === "kny:blood" ? { slot, quantidade: item.amount } : undefined;
}

function consumirDose(p, dose) {
  if (!dose) return;
  const inventario = p.getComponent("minecraft:inventory")?.container;
  const item = inventario?.getItem(dose.slot);
  if (item?.typeId !== "kny:blood" || item.amount < dose.quantidade) return;
  if (dose.quantidade === 1) inventario.setItem(dose.slot, undefined);
  else {
    item.amount = dose.quantidade - 1;
    inventario.setItem(dose.slot, item);
  }
}

function escolherArte(p) {
  const inventario = p.getComponent("minecraft:inventory")?.container;
  for (let slot = 0; inventario && slot < inventario.size; slot++) {
    const id = inventario.getItem(slot)?.typeId;
    const arte = ARTES_H.find((a) => a.item === id && a.obj !== "demonking");
    if (arte) return arte.obj;
  }
  return H.arteInicial;
}

function limparPatentes(p, lista) {
  for (const { tag } of lista) {
    if (p.hasTag(tag)) p.removeTag(tag);
    if (p.hasTag(tag + "2")) p.removeTag(tag + "2");
  }
}

function terminar(p, d) {
  consumirDose(p, d.dose);
  const lider = world.scoreboard.getObjective(OBJ_LIDER);
  if (titularDe(OBJ_LIDER) === p.name) {
    for (const tit of lider.getParticipants()) if (tit.displayName === p.name) lider.removeParticipant(tit);
  }
  limparPatentes(p, RANKS_CACADOR);
  limparPatentes(p, RANKS_ONI);
  for (const tag of ["slayer", "slayer2"]) if (p.hasTag(tag)) p.removeTag(tag);
  p.addTag("demon");
  p.addTag("muzan_curse");
  p.addTag("kny_escolheu");
  p.triggerEvent("kny:reset");
  pontuar(p, "updemon", 0);
  pontuar(p, "blood", Math.max(getScore(p, "blood"), d.doses));
  if (d.raca === "hibrido") {
    const chave = "kf_" + d.resp;
    if (getScore(p, chave) < d.formas) pontuar(p, chave, d.formas);
    espelharHibrido(p, d, true);
    indexarHibrido(p, d);
  } else {
    prop(p, "kny:h_linhagem", 1);
    p.triggerEvent("kny:demon_family");
    p.triggerEvent("burn_daylight_on");
  }
  const ativo = { ...d, estado: "ativo" };
  delete ativo.dose;
  guardarPersonagem(p, ativo);
  agendarStats(p);
  return ativo;
}

export function transformar(alvo, via, autor = alvo) {
  const falha = (motivo) => ({ ok: false, motivo });
  if (!jogador(alvo) || !jogador(autor)) return falha("Jogador indisponível.");
  const dose = via === "sangue" ? doseEmMaos(alvo) : undefined;
  const autorizado = via === "rei" ? ehReiAutor(autor) && autor.id !== alvo.id
    : via === "cargo" ? ehStaff(autor) && autor.id === alvo.id
    : via === "sangue" ? autor.id === alvo.id && (!!dose || ehStaff(autor)) : false;
  if (!autorizado) return falha("Transformação sem autoridade válida ou sangue em mãos.");
  if (estadoBloqueado(alvo) || emTransformacao.has(alvo.id)) return falha("Aguarde o fim da ação atual para transformar.");
  const anterior = personagem(alvo);
  if (anterior === null || !anterior && alvo.hasTag(tagH)) return falha("Registro de raça inconsistente. Consulte a Staff.");

  if (anterior?.estado === "transformando") {
    return falha("Transformação em recuperação. Reconecte para concluir.");
  }
  if (isDemonLineage(alvo)) {
    if (!dose) return falha("O jogador já pertence à linhagem Oni.");
    consumirDose(alvo, dose);
    pontuar(alvo, "blood", getScore(alvo, "blood") + 1);
    agendarStats(alvo);
    return { ok: true, dose: true };
  }

  const dominio = avaliarDominio(alvo);
  if (dominio.invalido || anterior?.raca === "hibrido") return falha("Histórico conflitante. Consulte a Staff.");
  if (!dominio.resp && dominio.completas?.length > 1) {
    alvo.sendMessage("§eEscolha a respiração original entre as dominadas no menu Domínio.");
    return falha("O caçador precisa escolher a respiração original.");
  }
  // Congele o resultado antes da remoção de tags humanas. A retomada usa a mesma ficha.
  const r = dominio.resp;
  const d = {
    v: 1, id: identificador(alvo), estado: "transformando", raca: r ? "hibrido" : "oni",
    via, doses: Math.max(0, getScore(alvo, "blood")) + 1, dose,
    anterior: { patente: patenteDe(alvo).tag, honra: getScore(alvo, "upslayer"), resp: r?.obj ?? null, formas: r?.formas.length ?? 0 },
    ...(r ? { resp: r.obj, formas: r.formas.length, arte: escolherArte(alvo), publico: "oni", disfarceAte: 0 } : {}),
  };
  emTransformacao.add(alvo.id);
  try {
    guardarPersonagem(alvo, d);
    const ativo = terminar(alvo, d);
    registrarAuditoria("transformar", { alvo: d.id, autor: identificador(autor), via, raca: ativo.raca, resp: ativo.resp });
    alvo.sendMessage(r ? "§5Você preservou a respiração dominada e despertou como Híbrido." : "§4Você se tornou Oni. O sol agora é seu inimigo.");
    try { alvo.playSound("biwa_sound"); } catch {}
    return { ok: true, hibrido: !!r };
  } catch (e) {
    console.warn("[Híbridos] Transformação em recuperação. " + e);
    return falha("Transformação em recuperação. Reconecte para concluir.");
  } finally {
    emTransformacao.delete(alvo.id);
  }
}

export function restaurarRaca(p, reaplicar = true, renasceu = true) {
  if (!jogador(p)) return;
  const d = personagem(p);
  if (d === null || d === undefined && p.hasTag(tagH)) {
    prop(p, "kny:h_linhagem", 3);
    if (reaplicar) console.warn("[Híbridos] Registro incompatível para " + p.name);
    return;
  }
  if (d?.estado === "transformando") {
    if (!estadoBloqueado(p) && !emTransformacao.has(p.id)) terminar(p, d);
    return;
  }
  if (d?.raca === "hibrido") {
    espelharHibrido(p, d, reaplicar);
    if (renasceu) {
      prop(p, "kny:h_ocupado", false);
      indexarHibrido(p, d);
    }
  } else {
    prop(p, "kny:h_linhagem", d?.raca === "oni" && p.hasTag("demon") ? 1 : 0);
  }
}

function restaurar(p, reaplicar = true, renasceu = true) {
  system.run(() => {
    try { restaurarRaca(p, reaplicar, renasceu); }
    catch (e) { console.warn("[Híbridos] Restauração de personagem. " + e); }
  });
}

world.afterEvents.playerSpawn.subscribe(({ player }) => restaurar(player));
world.afterEvents.playerDimensionChange.subscribe(({ player }) => restaurar(player, true, false));
world.afterEvents.dataDrivenEntityTrigger.subscribe(({ entity }) => {
  if (entity.hasTag(tagH) && !emTransformacao.has(entity.id)) restaurar(entity, true, false);
}, { entityTypes: ["minecraft:player"], eventTypes: ["kny:reset", "pamobile:refresh_player", "mha:test", "kny:demon_family"] });
world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  combate.delete(playerId);
  emTransformacao.delete(playerId);
});
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource, damage }) => {
  if (damage <= 0) return;
  const ate = Date.now() + H.combateMs;
  for (const p of new Set([hurtEntity, damageSource.damagingEntity])) {
    if (!jogador(p)) continue;
    combate.set(p.id, ate);
    const salvo = Number(p.getDynamicProperty("kny:h_combate_ate")) || 0;
    if (ate > salvo + 500) p.setDynamicProperty("kny:h_combate_ate", ate);
  }
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity: p, message }) => {
  if (!jogador(p)) return;
  if (id === "kny:h_sangue") {
    const r = transformar(p, "sangue");
    if (!r.ok) p.sendMessage("§c" + r.motivo);
  }
  if (id === "kny:h_curado" && !p.hasTag("demon")) {
    const d = personagem(p);
    if (d?.raca === "oni" && d.estado === "ativo") guardarPersonagem(p, { ...d, estado: "curado" });
    restaurarRaca(p, false, false);
  }
  if (id === "kny:h_agua" && p.hasTag("seiseiruten")) {
    const d = racaHibrida(p);
    if (d && ["water", "tomioka", "tanjiro"].includes(d.resp) && canUseBreathing(p, d.resp, mao(p), 10)) {
      p.runCommand("function breathings/seiseiruten");
    }
  }
  if (id === "kny:h_revelar") {
    const [tipo, grupo] = message.split(" ");
    const d = racaHibrida(p);
    if (!d || estadoBloqueado(p)) return;
    const item = mao(p);
    if ((tipo === "resp" && d.publico === "oni" && canUseBreathing(p, grupo, item, 1)) ||
        (tipo === "arte" && d.publico === "cacador" && canUseKekkijutsu(p, grupo, item))) revelar(p);
  }
});
