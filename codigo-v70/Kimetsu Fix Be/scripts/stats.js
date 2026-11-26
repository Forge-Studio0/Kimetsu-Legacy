import { world, system } from "@minecraft/server";
import {
  ATRIBUTOS, ATR, HUMANO, ONI, HIBRIDO_SUPERIOR, REI_ONI, RANKS_CACADOR, RANKS_ONI,
  POR_PATENTE, OBJ_LIDER, OBJ_REI, ePatenteOni,
  PTS_POR_PONTO_DE_RANK, PONTOS_POR_ONI, LIMITE_SALDO, NIVEL_MAXIMO, custoMelhoria,
  SERIES_POR_MELHORIA, CREDITO_POR_SERIE, DOSES_POR_SERIE_VIDA, MAX_MOVIMENTO_SANGUE,
  vidaMax, movimentoMax, staminaMax, folegoMax,
} from "./stats_config.js";
import { OBJ_PTS, natural, tamanhoSerie, migrarLegado, lerRegistro, totalInvestido } from "./stats_migration.js";
import { hibridoAtivo } from "./hybrid_records.js";

const DADOS = "kny:stats_v70";
const BONUS_VIDA = "kny:stats_bonus_vida";
const EFEITO_VIDA = "health_boost";
const DURACAO_VIDA = 240;

const registros = new Map();
const agendados = new Set();

export const isOni = (p) => p.hasTag("demon");

export function lerBruto(p, obj) {
  try {
    return world.scoreboard.getObjective(obj)?.getScore(p.scoreboardIdentity ?? p);
  } catch {
    return undefined;
  }
}

export const getScore = (p, obj) => lerBruto(p, obj) ?? 0;

export function pontuar(p, nome, valor) {
  const o = world.scoreboard.getObjective(nome) ?? world.scoreboard.addObjective(nome, nome);
  o.setScore(p, valor);
}

export function titularDe(obj) {
  try {
    return world.scoreboard.getObjective(obj)?.getParticipants()[0]?.displayName ?? null;
  } catch {
    return null;
  }
}

export function patenteDe(p) {
  const tags = new Set(p.getTags());
  if (hibridoAtivo(p)) {
    return tags.has(REI_ONI.tag) && titularDe(OBJ_REI) === p.name ? REI_ONI : HIBRIDO_SUPERIOR;
  }
  const oni = tags.has("demon");
  const lista = oni ? RANKS_ONI : RANKS_CACADOR;
  for (let i = lista.length - 1; i >= 0; i--) {
    const rank = lista[i];
    if (tags.has(rank.tag) && (!rank.unico || titularDe(oni ? OBJ_REI : OBJ_LIDER) === p.name)) return rank;
  }
  if (oni) return ONI;
  return tags.has("slayer") || tags.has("slayer2") ? RANKS_CACADOR[0] : HUMANO;
}

function fichaAtiva(ficha, limite) {
  const treino = Math.min(ficha.legadoTreino, limite);
  let compras = Math.min(ficha.legadoCompra, limite - treino);
  let gasto = 0;
  for (let i = 0; i < limite && i < ficha.pagos.length; i++) {
    if (ficha.pagos[i] > 0) {
      compras++;
      gasto += ficha.pagos[i];
    }
  }
  return { nivel: treino + compras, treino, compras, gasto };
}

function perfil(reg, patente) {
  if (reg.perfil?.patente !== patente) {
    const ativos = Object.fromEntries(ATRIBUTOS.map((a) => [a.id, fichaAtiva(reg.dados.atributos[a.id], patente.limites[a.id])]));
    reg.perfil = { patente, ativos };
  }
  return reg.perfil.ativos;
}

function dadosAtuais(p, r) {
  let reg = registros.get(p.id);
  if (reg) return reg;
  const raw = p.getDynamicProperty(DADOS);
  const amp = p.getDynamicProperty(BONUS_VIDA);
  const migracao = raw === undefined ? migrarLegado((obj) => lerBruto(p, obj), r) : undefined;
  const dadosSalvos = migracao?.dados ?? lerRegistro(raw);
  const invalido = !dadosSalvos;
  if (invalido) console.warn("[Kimetsu Stats] Registro incompatível. Operações de pontos suspensas para " + p.name);
  reg = {
    dados: dadosSalvos ?? migrarLegado(() => undefined, r).dados,
    persistido: raw !== undefined,
    espelhoPendente: !invalido,
    invalido,
    legadoVida: amp === undefined && !!(migracao?.antigo || dadosSalvos?.migracao),
    amp,
    limparGrupos: true,
  };
  registros.set(p.id, reg);
  return reg;
}

function gravar(p, reg, dados) {
  // Saldo, gastos, progresso de treino e versão da migração são uma única gravação.
  p.setDynamicProperty(DADOS, JSON.stringify(dados));
  reg.dados = dados;
  reg.persistido = true;
  reg.espelhoPendente = true;
  reg.perfil = undefined;
}

function espelhar(p, reg, r) {
  if (!reg.espelhoPendente) return;
  const d = reg.dados;
  const placares = [[OBJ_PTS, d.saldo], ["kny_vis_s", d.honraVista], ["kny_vis_o", d.maldicaoVista]];
  const ativos = perfil(reg, r);
  for (const a of ATRIBUTOS) {
    const v = ativos[a.id];
    const credito = d.atributos[a.id].credito;
    const reps = credito.nivel === v.nivel + 1 && v.nivel < r.limites[a.id] ? credito.reps : 0;
    placares.push([a.obj, v.compras], [a.pts, v.gasto], [a.tr, v.treino], [a.rep, reps]);
  }
  for (const [obj, valor] of placares) if (lerBruto(p, obj) !== valor) pontuar(p, obj, valor);
  reg.espelhoPendente = false;
}

function creditoNoNivel(ficha, nivel) {
  return ficha.credito.nivel === nivel ? ficha.credito : { nivel, series: 0, reps: 0 };
}

function descontoMelhoria(base, series) {
  return Math.floor(base * CREDITO_POR_SERIE * series / 100);
}

function aproveitarSangue(d, r, doses) {
  const ciclos = Math.floor(doses / DOSES_POR_SERIE_VIDA) - Math.floor(d.dosesVistas / DOSES_POR_SERIE_VIDA);
  d.dosesVistas = doses;
  if (ciclos === 0) return;
  d.movimentoSangue = Math.min(MAX_MOVIMENTO_SANGUE, d.movimentoSangue + ciclos);

  const a = ATR.vid;
  const ficha = d.atributos[a.id];
  const limite = r.limites[a.id];
  const nivel = fichaAtiva(ficha, limite).nivel + 1;
  if (nivel > limite) return;
  const credito = creditoNoNivel(ficha, nivel);
  const series = Math.min(SERIES_POR_MELHORIA, credito.series + ciclos);
  const reps = series === SERIES_POR_MELHORIA ? 0 : credito.reps;
  d.atributos = { ...d.atributos, [a.id]: { ...ficha, credito: { nivel, series, reps } } };
}

function somarPontos(d, pontos) {
  const ganho = Math.min(pontos, LIMITE_SALDO - d.saldo - totalInvestido(d));
  d.saldo += ganho;
  return ganho;
}

function sincronizar(p, reg, r) {
  if (reg.invalido) return;
  const oni = ePatenteOni(r);
  const obj = oni ? "updemon" : "upslayer";
  const marca = oni ? "maldicaoVista" : "honraVista";
  const pontosRank = natural(getScore(p, obj));
  const doses = oni ? natural(getScore(p, "blood")) : 0;
  const anterior = reg.dados;
  const patenteAnterior = POR_PATENTE[anterior.patente];
  const mudou = anterior.patente !== r.tag;
  if (reg.persistido && !mudou && pontosRank <= anterior[marca] && doses <= anterior.dosesVistas) return;

  const d = { ...anterior, patente: r.tag };
  if (doses > d.dosesVistas) aproveitarSangue(d, r, doses);
  if (pontosRank > d[marca]) {
    somarPontos(d, (pontosRank - d[marca]) * PTS_POR_PONTO_DE_RANK);
    d[marca] = pontosRank;
  }
  gravar(p, reg, d);
  if (mudou) {
    if (ATRIBUTOS.some((a) => r.limites[a.id] < patenteAnterior.limites[a.id])) {
      p.sendMessage("§eSeus atributos foram ajustados de acordo com o limite da sua patente atual.");
    } else {
      p.sendMessage("§aSua nova patente desbloqueou novos limites de atributos.");
    }
  }
}

export function registrarRankAdministrativo(p, obj, valor) {
  try {
    const r = patenteDe(p);
    const reg = dadosAtuais(p, r);
    if (reg.invalido) return;
    const marca = obj === "updemon" ? "maldicaoVista" : "honraVista";
    const d = { ...reg.dados, [marca]: Math.max(reg.dados[marca], natural(getScore(p, obj)), natural(valor)) };
    gravar(p, reg, d);
  } catch (e) {
    console.warn("[Kimetsu Stats] Pontuação de patente administrativa: " + e);
  }
}

function aplicarVida(p, reg, alvo) {
  const h = p.getComponent("minecraft:health");
  if (!h || h.currentValue <= 0) return;
  const efeito = p.getEffect(EFEITO_VIDA);
  const proprio = efeito && efeito.amplifier === reg.amp;
  const legado = efeito && reg.legadoVida && efeito.duration > 0 && efeito.duration <= 100;
  // Outro pack pode fornecer um health_boost temporário. Deixe-o terminar por conta própria.
  if (efeito && !proprio && !legado) return;

  const amp = Math.max(0, Math.floor((alvo - h.defaultValue) / 4)) - 1;
  if (proprio && amp === reg.amp && efeito.duration > 50) return;
  if (!efeito && amp < 0 && reg.amp === -1) return;

  const vida = h.currentValue;
  if (efeito && efeito.amplifier !== amp) p.removeEffect(EFEITO_VIDA);
  if (amp >= 0) p.addEffect(EFEITO_VIDA, DURACAO_VIDA, { amplifier: amp, showParticles: false });
  const novo = p.getComponent("minecraft:health");
  const preservar = Math.min(vida, novo.effectiveMax);
  if (novo.currentValue > 0 && novo.currentValue !== preservar) novo.setCurrentValue(preservar);

  if (reg.amp !== amp) {
    p.setDynamicProperty(BONUS_VIDA, amp);
    reg.amp = amp;
  }
  reg.legadoVida = false;
}

function aplicarMovimento(p, alvo) {
  // O motor altera o valor atual ao trocar de efeito ou iniciar corrida. Efeitos
  // temporários da addon e do jogo têm prioridade durante sua duração.
  if (p.hasTag("animacao") || p.hasTag("kny_caido") || p.getEffect("speed") || p.getEffect("slowness")) return;
  const m = p.getComponent("minecraft:movement");
  if (!m) return;
  const movimento = alvo * (p.isSprinting ? 1.3 : 1);
  if (Math.abs(m.currentValue - movimento) > 0.0001) m.setCurrentValue(movimento);
}

function limitarMedidor(p, obj, max) {
  const bruto = lerBruto(p, obj);
  if (bruto !== undefined && bruto !== natural(bruto, max)) pontuar(p, obj, natural(bruto, max));
}

function aplicar(p, reg, r) {
  const ativos = perfil(reg, r);
  if (reg.limparGrupos) {
    p.triggerEvent("kny:stats_limpar_grupos");
    reg.limparGrupos = false;
  }
  aplicarVida(p, reg, vidaMax(r, ativos.vid.nivel));
  aplicarMovimento(p, movimentoMax(r, ePatenteOni(r) ? reg.dados.movimentoSangue : 0));
  if (reg.espelhoPendente) {
    limitarMedidor(p, "kny_stam", staminaMax(ativos.sta.nivel));
    limitarMedidor(p, "kny_folego", folegoMax(ativos.pod.nivel));
    espelhar(p, reg, r);
  }
}

function aplicarSemFalhar(p, reg, r) {
  try {
    aplicar(p, reg, r);
    reg.erro = undefined;
  } catch (e) {
    const erro = String(e);
    if (reg.erro !== erro) console.warn("[Kimetsu Stats] Atualização de efeitos e placares: " + erro);
    reg.erro = erro;
  }
}

export function atualizarStats(p) {
  const r = patenteDe(p);
  const reg = dadosAtuais(p, r);
  sincronizar(p, reg, r);
  aplicarSemFalhar(p, reg, r);
  return { reg, r };
}

export function agendarStats(p) {
  const id = p.id;
  if (agendados.has(id)) return;
  agendados.add(id);
  system.run(() => {
    agendados.delete(id);
    if (!p.isValid) return;
    try {
      atualizarStats(p);
    } catch (e) {
      console.warn("[Kimetsu Stats] Atualização: " + e);
    }
  });
}

world.afterEvents.playerSpawn.subscribe(({ player }) => {
  const reg = registros.get(player.id);
  if (reg) reg.limparGrupos = true;
  agendarStats(player);
});
world.afterEvents.playerDimensionChange.subscribe(({ player }) => agendarStats(player));
world.afterEvents.dataDrivenEntityTrigger.subscribe(({ entity }) => agendarStats(entity), {
  entityTypes: ["minecraft:player"],
  eventTypes: ["kny:reset"],
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  registros.delete(playerId);
  agendados.delete(playerId);
});
system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id === "kny:stats_atualizar" && sourceEntity?.typeId === "minecraft:player") agendarStats(sourceEntity);
});

export function statusAtributo(p, a) {
  const r = patenteDe(p);
  const reg = dadosAtuais(p, r);
  const { nivel } = perfil(reg, r)[a.id];
  const limite = r.limites[a.id];
  const custoBase = nivel < limite ? custoMelhoria(nivel) : null;
  const ficha = reg.dados.atributos[a.id];
  const credito = custoBase === null ? { series: 0, reps: 0 } : creditoNoNivel(ficha, nivel + 1);
  const desconto = descontoMelhoria(custoBase ?? 0, credito.series);
  return {
    jogador: p.id, id: a.id, patente: r.tag, revisao: ficha.revisao,
    nivel, limite, proximo: custoBase === null ? null : nivel + 1,
    custoBase, desconto, custo: custoBase === null ? null : custoBase - desconto,
    series: credito.series, reps: credito.reps, saldo: reg.invalido ? 0 : reg.dados.saldo,
  };
}

export function efetivos(p) {
  const r = patenteDe(p);
  return perfil(dadosAtuais(p, r), r);
}

export const efetivo = (p, a) => efetivos(p)[a.id].nivel;

export function disponiveis(p) {
  const reg = dadosAtuais(p, patenteDe(p));
  return reg.invalido ? 0 : reg.dados.saldo;
}

function ofertaValida(oferta, atual) {
  return oferta && oferta.jogador === atual.jogador && oferta.id === atual.id && oferta.patente === atual.patente &&
    oferta.revisao === atual.revisao && oferta.nivel === atual.nivel && oferta.custo === atual.custo;
}

export function comprar(p, a, vezes, oferta) {
  if (!p?.isValid || !a || ATR[a.id] !== a || !Number.isSafeInteger(vezes) || vezes < 1 || p.hasTag("kny_caido")) {
    return { motivo: "indisponivel", feitas: 0 };
  }
  const { reg, r } = atualizarStats(p);
  if (reg.invalido) return { motivo: "indisponivel", feitas: 0 };
  const atual = statusAtributo(p, a);
  if (atual.custo === null) return { motivo: "limite", feitas: 0 };
  if (!ofertaValida(oferta, atual)) return { motivo: "desatualizado", feitas: 0 };

  const antigo = reg.dados.atributos[a.id];
  const ficha = { ...antigo, pagos: antigo.pagos.slice() };
  const d = { ...reg.dados, atributos: { ...reg.dados.atributos, [a.id]: ficha } };
  let nivel = atual.nivel;
  let posicao = ficha.legadoCompra + ficha.legadoTreino;
  let gasto = 0;
  let feitas = 0;
  let custo = atual.custo;
  while (feitas < vezes && nivel < atual.limite && d.saldo >= custo) {
    // A posição individual é o teto mínimo para esse nível voltar após um rebaixamento.
    while (ficha.pagos[posicao] > 0) posicao++;
    ficha.pagos[posicao++] = custo;
    d.saldo -= custo;
    gasto += custo;
    feitas++;
    nivel++;
    custo = custoMelhoria(nivel);
  }
  if (feitas === 0) return { motivo: "saldo", feitas, custo, saldo: d.saldo };
  ficha.credito = { nivel: 0, series: 0, reps: 0 };
  ficha.revisao++;
  gravar(p, reg, d);
  aplicarSemFalhar(p, reg, r);
  return { motivo: "ok", feitas, gasto, nivel };
}

export function chaveRedistribuicao(p) {
  const r = patenteDe(p);
  const { dados } = dadosAtuais(p, r);
  return r.tag + ":" + ATRIBUTOS.map((a) => dados.atributos[a.id].revisao).join(",");
}

export function resetarAtributos(p, chave) {
  if (!p?.isValid || p.hasTag("kny_caido")) return { motivo: "indisponivel", pontos: 0 };
  const { reg, r } = atualizarStats(p);
  if (reg.invalido) return { motivo: "indisponivel", pontos: 0 };
  if (chave !== chaveRedistribuicao(p)) return { motivo: "desatualizado", pontos: 0 };
  const d = { ...reg.dados, atributos: { ...reg.dados.atributos } };
  let pontos = 0;
  for (const a of ATRIBUTOS) {
    const ficha = d.atributos[a.id];
    const limite = r.limites[a.id];
    const { gasto } = fichaAtiva(ficha, limite);
    if (gasto === 0) continue;
    const pagos = ficha.pagos.map((valor, i) => i < limite ? 0 : valor);
    d.atributos[a.id] = { ...ficha, pagos, revisao: ficha.revisao + 1, credito: { nivel: 0, series: 0, reps: 0 } };
    pontos += gasto;
  }
  if (pontos > 0) {
    d.saldo += pontos;
    gravar(p, reg, d);
    aplicarSemFalhar(p, reg, r);
  }
  return { motivo: "ok", pontos };
}

export function registrarRepeticao(p, a) {
  const { reg, r } = atualizarStats(p);
  if (reg.invalido || p.hasTag("kny_caido")) return { motivo: "indisponivel" };
  const atual = statusAtributo(p, a);
  if (atual.proximo === null) return { motivo: "limite" };
  if (atual.series >= SERIES_POR_MELHORIA) return { motivo: "credito" };

  const concluiu = atual.reps + 1 >= tamanhoSerie(a);
  const credito = { nivel: atual.proximo, series: atual.series + Number(concluiu), reps: concluiu ? 0 : atual.reps + 1 };
  const ficha = { ...reg.dados.atributos[a.id], credito };
  const d = { ...reg.dados, atributos: { ...reg.dados.atributos, [a.id]: ficha } };
  gravar(p, reg, d);
  aplicarSemFalhar(p, reg, r);
  return { motivo: "ok", ...credito, concluiu, desconto: descontoMelhoria(atual.custoBase, credito.series) };
}

export function premiarOni(p, tipo) {
  const pontos = PONTOS_POR_ONI.get(tipo);
  if (!pontos || !p?.isValid || p.hasTag("kny_caido")) return 0;
  const { reg, r } = atualizarStats(p);
  if (reg.invalido) return 0;
  const d = { ...reg.dados };
  const ganho = somarPontos(d, pontos);
  if (ganho > 0) {
    gravar(p, reg, d);
    aplicarSemFalhar(p, reg, r);
  }
  return ganho;
}

function medidor(p, obj, max) {
  const v = lerBruto(p, obj);
  return { max, atual: v === undefined ? max : natural(v, max) };
}

export const staminaDe = (p) => medidor(p, "kny_stam", staminaMax(efetivo(p, ATR.sta)));
export const folegoDe = (p) => medidor(p, "kny_folego", folegoMax(efetivo(p, ATR.pod)));
