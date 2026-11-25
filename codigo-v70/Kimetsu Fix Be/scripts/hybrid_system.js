import { system, world } from "@minecraft/server";
import { H, ARTE_H_ID, ARTES_H, IDENTIDADES, RESP_H_ID, ROTULOS } from "./hybrid_config.js";
import { avaliarDominio, dominioParaRecuperacao, ehCacadorHumano } from "./hybrid_mastery.js";
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
const REVISAO_TRANSFORMACAO = 73;
const MAX_PLACAR = 2147483647;

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

export function doseEmMaos(p) {
  const slot = p.selectedSlotIndex;
  const item = p.getComponent("minecraft:inventory")?.container?.getItem(slot);
  return item?.typeId === "kny:blood" ? { slot, quantidade: item.amount } : undefined;
}

function consumirDose(p, dose) {
  const inventario = p.getComponent("minecraft:inventory")?.container;
  const item = inventario?.getItem(dose.slot);
  if (item?.typeId !== "kny:blood" || item.amount !== dose.quantidade) return undefined;
  if (dose.quantidade === 1) inventario.setItem(dose.slot, undefined);
  else {
    item.amount = dose.quantidade - 1;
    inventario.setItem(dose.slot, item);
  }
  return () => {
    item.amount = dose.quantidade;
    inventario.setItem(dose.slot, item);
  };
}

function registrarDosePaga(p, d) {
  if (!d.dose) return d;
  const estornar = consumirDose(p, d.dose);
  if (!estornar && d.revisao === REVISAO_TRANSFORMACAO) {
    throw new Error("A pilha de sangue da transformação mudou.");
  }
  const pago = { ...d };
  delete pago.dose;
  try {
    guardarPersonagem(p, pago);
  } catch (e) {
    estornar?.();
    throw e;
  }
  return pago;
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

function aplicarLinhagemOniInicial(p, d) {
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
}

function terminar(p, pendente) {
  const d = registrarDosePaga(p, pendente);
  if (!d.reparoV72) aplicarLinhagemOniInicial(p, d);
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
  guardarPersonagem(p, ativo);
  agendarStats(p);
  try {
    registrarAuditoria(d.reparoV72 ? "recuperar_v72" : "transformar", {
      alvo: d.id, autor: d.autor, via: d.via, raca: d.raca, resp: d.resp,
    });
  } catch (e) {
    console.warn("[Híbridos] Auditoria após transformação de " + d.id + ": " + e);
  }
  p.sendMessage(d.reparoV72 ? "§5A Staff recuperou sua linhagem Híbrida da v72."
    : d.raca === "hibrido" ? "§5Você preservou a respiração dominada e despertou como Híbrido."
    : "§4Você se tornou Oni comum. O sol agora é seu inimigo.");
  try { p.playSound("biwa_sound"); } catch {}
}

export function preverTransformacao(p) {
  if (estadoBloqueado(p) || emTransformacao.has(p.id)) return { motivo: "Aguarde o fim da ação atual para transformar." };
  const anterior = personagem(p);
  if (anterior === null || !anterior && p.hasTag(tagH)) return { motivo: "Registro de raça inconsistente. Consulte a Staff." };
  if (anterior?.estado === "transformando") return { motivo: "Transformação em recuperação. Reconecte para concluir." };
  if (p.hasTag("demon")) return { destino: "dose" };
  if (anterior?.estado === "ativo") return { motivo: "A linhagem em jogo diverge da ficha. Consulte a Staff." };
  const dominio = avaliarDominio(p);
  if (dominio.invalido) return { motivo: "Histórico de domínio incompatível. Consulte a Staff." };
  if (dominio.resp) return { destino: "hibrido", resp: dominio.resp };
  if (dominio.completas.length > 1) {
    return { destino: "escolher", motivo: "Escolha a respiração original em Guia → Domínio humano." };
  }
  return { destino: "oni", motivo: "Nenhuma respiração tem domínio humano completo registrado. Formas liberadas são acesso ao combate. Confira as aulas em Guia → Domínio humano." };
}

const falha = (motivo) => ({ ok: false, motivo });

export function transformar(alvo, via, autor = alvo, confirmacao = {}) {
  if (!jogador(alvo) || !jogador(autor)) return falha("Jogador indisponível.");
  const dose = via === "sangue" ? doseEmMaos(alvo) : undefined;
  const autorizado = via === "rei" ? ehReiAutor(autor) && autor.id !== alvo.id
    : via === "cargo" ? ehStaff(autor) && autor.id === alvo.id
    : via === "sangue" ? autor.id === alvo.id && !!dose : false;
  if (!autorizado) return falha("Transformação sem autoridade válida ou sangue em mãos.");
  if (confirmacao.dose && (confirmacao.dose.slot !== dose?.slot || confirmacao.dose.quantidade !== dose?.quantidade)) {
    return falha("A pilha de sangue mudou. Empunhe a dose e use o item novamente.");
  }
  const previa = preverTransformacao(alvo);
  if (!previa.destino || previa.destino === "escolher") return falha(previa.motivo);
  const destino = previa.resp?.obj ?? previa.destino;
  if (confirmacao.destino && confirmacao.destino !== destino) return falha("O resultado mudou. Confira o domínio e tente novamente.");
  if (destino === "oni" && confirmacao.destino !== "oni") return falha(previa.motivo);

  const doses = Math.max(0, getScore(alvo, "blood")) + 1;
  if (doses > MAX_PLACAR) return falha("O placar de sangue já atingiu o limite.");
  if (destino === "dose") {
    if (!dose) return falha("O jogador já pertence à linhagem Oni.");
    const estornar = consumirDose(alvo, dose);
    if (!estornar) return falha("A pilha de sangue mudou. Tente novamente.");
    try { pontuar(alvo, "blood", doses); }
    catch (e) { estornar(); throw e; }
    agendarStats(alvo);
    return { ok: true, dose: true };
  }

  // Congele o resultado antes da remoção de tags humanas. A retomada usa a mesma ficha.
  const r = previa.resp;
  const d = {
    v: 1, revisao: REVISAO_TRANSFORMACAO, id: identificador(alvo), estado: "transformando",
    raca: r ? "hibrido" : "oni", autor: identificador(autor), via, doses, dose,
    anterior: { patente: patenteDe(alvo).tag, honra: getScore(alvo, "upslayer"), resp: r?.obj ?? null, formas: r?.formas.length ?? 0 },
    ...(r ? { resp: r.obj, formas: r.formas.length, arte: escolherArte(alvo), publico: "oni", disfarceAte: 0 } : {}),
  };
  return iniciarTransformacao(alvo, d);
}

function iniciarTransformacao(p, d) {
  emTransformacao.add(p.id);
  let iniciou = false;
  try {
    guardarPersonagem(p, d);
    iniciou = true;
    terminar(p, d);
    return { ok: true, hibrido: d.raca === "hibrido" };
  } catch (e) {
    console.warn("[Híbridos] Falha ao aplicar a transformação. " + e);
    return falha(iniciou ? "Transformação em recuperação. Reconecte para concluir." : "Não foi possível gravar a transformação. Consulte a Staff.");
  } finally {
    emTransformacao.delete(p.id);
  }
}

const foiCacador = (d) => RANKS_CACADOR.some((r) => r.tag === d?.anterior?.patente);

export function candidatoRecuperacaoV72(p, d = personagem(p)) {
  return p.hasTag("demon") && !p.hasTag(tagH) && d?.estado === "ativo" && d.raca === "oni" &&
    d.revisao === undefined && ["sangue", "rei", "cargo"].includes(d.via) &&
    foiCacador(d) && d.anterior.resp === null && d.anterior.formas === 0 &&
    Number.isSafeInteger(d.doses) && d.doses > 0;
}

export function recuperarHibridoV72(autor, alvo, id, prova) {
  if (!ehStaff(autor) || !jogador(alvo)) return falha("A recuperação exige Staff e jogador online.");
  if (estadoBloqueado(alvo) || emCombate(alvo) || emTransformacao.has(alvo.id)) return falha("O jogador precisa aguardar o fim da ação ou do combate.");
  const d = personagem(alvo);
  if (!candidatoRecuperacaoV72(alvo, d)) return falha("A ficha não contém transformação ativa de Caçador em Oni comum pela v72.");
  const r = dominioParaRecuperacao(autor, alvo, id, prova);
  if (!r) return falha("Domínio humano sem comprovação para essa respiração. Confira o diagnóstico. Certificação por evidência exige outra pessoa da Staff.");
  const autorId = identificador(autor);
  registrarAuditoria("solicitar_recuperacao_v72", { autor: autorId, alvo: d.id, via: d.via, resp: r.obj });
  return iniciarTransformacao(alvo, {
    ...d, revisao: REVISAO_TRANSFORMACAO, autor: autorId, estado: "transformando", raca: "hibrido",
    reparoV72: true, resp: r.obj, formas: r.formas.length, arte: escolherArte(alvo), publico: "oni", disfarceAte: 0,
  });
}

function restaurarContratoCurado(p, d) {
  if (d?.estado !== "curado" || p.hasTag("demon")) return;
  p.triggerEvent("kny:limpar_linhagem_oni");
  if (ehCacadorHumano(p)) return;
  if (foiCacador(d)) {
    for (const tag of ["slayer", "slayer2", "mizunoto", "mizunoto2", "kny_escolheu"]) p.addTag(tag);
    p.triggerEvent("kny:damage_receive");
  } else {
    p.removeTag("kny_escolheu");
  }
  agendarStats(p);
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
    if (!estadoBloqueado(p) && !emTransformacao.has(p.id)) {
      emTransformacao.add(p.id);
      try { terminar(p, d); }
      finally { emTransformacao.delete(p.id); }
    }
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
    restaurarContratoCurado(p, d);
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
