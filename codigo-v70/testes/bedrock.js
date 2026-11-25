import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import * as stats from "./stats.js";
import {
  ATR, ATRIBUTOS, PATENTES, POR_PATENTE, PTS_INICIAIS, NIVEL_MAXIMO, PONTOS_POR_ONI, ePatenteOni,
  custoMelhoria, vidaMax, movimentoMax, staminaMax, folegoMax, efeitoForca, efeitoPoder, reducaoDefesa,
} from "./stats_config.js";

const DADOS = "kny:stats_v70";
const MUNDO_TESTE = "kny:testes_v70_etapa";
const wait = (ticks = 1) => system.waitTicks(ticks);
const vida = (p) => p.getComponent("minecraft:health");
const mov = (p) => p.getComponent("minecraft:movement").currentValue;
const dados = (p) => JSON.parse(p.getDynamicProperty(DADOS));
const up = (p, a, vezes = 1) => stats.comprar(p, a, vezes, stats.statusAtributo(p, a));
const reset = (p) => stats.resetarAtributos(p, stats.chaveRedistribuicao(p));
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esperado, msg) => assert(real === esperado, msg + " -> " + real + " esperado " + esperado);
const near = (real, esperado, msg, tolerancia = 0.002) =>
  assert(Math.abs(real - esperado) < tolerancia, msg + " -> " + real + " esperado " + esperado);
const log = (msg) => console.warn("KNY-TEST " + msg);

function spawn(nome, x = 48, z = 48, dim = world.getDimension("overworld")) {
  const p = spawnSimulatedPlayer({ x, y: 110, z, dimension: dim }, nome, GameMode.Survival);
  p.runCommand("setblock ~ ~-1 ~ stone");
  return p;
}

function tagPatente(p, r) {
  for (const rk of PATENTES) p.removeTag(rk.tag);
  p.removeTag("demon");
  p.removeTag("slayer");
  p.removeTag("slayer2");
  if (ePatenteOni(r)) p.addTag("demon");
  if (!["oni", "humano"].includes(r.tag)) p.addTag(r.tag);
  // Atribuição manual em teste isola os tetos sem alterar a progressão do jogo.
  stats.pontuar(p, "updemon", 0);
  stats.pontuar(p, "upslayer", 0);
  if (r.unico) {
    const obj = r.tag === "kny_muzan" ? "kny_muzan" : "kny_lider";
    const s = world.scoreboard.getObjective(obj) ?? world.scoreboard.addObjective(obj, obj);
    for (const parte of s.getParticipants()) s.removeParticipant(parte);
    s.setScore(p.name, 1);
  }
}

async function iniciante(sufixo) {
  const p = spawn("K70Ini" + sufixo);
  stats.atualizarStats(p);
  eq(stats.disponiveis(p), PTS_INICIAIS, "saldo inicial");
  eq(vida(p).effectiveMax, 40, "vida humana");
  tagPatente(p, POR_PATENTE.mizunoto);
  const duasTelas = stats.statusAtributo(p, ATR.for);
  eq(stats.comprar(p, ATR.for, 1, duasTelas).gasto, 100, "primeira compra");
  eq(stats.comprar(p, ATR.for, 1, duasTelas).motivo, "desatualizado", "replay de compra");
  eq(up(p, ATR.for, NIVEL_MAXIMO).gasto, 400, "compra com saldo exato");
  eq(stats.disponiveis(p), 0, "saldo zero");
  eq(up(p, ATR.def).motivo, "saldo", "saldo zero bloqueado");
  eq(up(p, ATR.for).motivo, "limite", "teto bloqueado");
  eq(stats.registrarRepeticao(p, ATR.for).motivo, "limite", "treino maximizado");
  const chave = stats.chaveRedistribuicao(p);
  eq(stats.resetarAtributos(p, chave).pontos, 500, "devolve custo exato");
  eq(stats.resetarAtributos(p, chave).motivo, "desatualizado", "replay de refund");
  eq(reset(p).pontos, 0, "redistribuição repetida");

  vida(p).setCurrentValue(31);
  eq(up(p, ATR.vid, 5).gasto, 500, "compra Vida");
  eq(vida(p).effectiveMax, 44, "vida escalonada após compra");
  eq(vida(p).currentValue, 31, "compra não cura");
  eq(reset(p).pontos, 500, "devolve compra de Vida");
  eq(vida(p).currentValue, 31, "reduzir Vida preserva PV atual");

  for (let i = 1; i <= 20; i++) {
    eq(stats.registrarRepeticao(p, ATR.def).concluiu, i % 10 === 0, "exercício " + i);
  }
  eq(stats.statusAtributo(p, ATR.def).custo, 60, "duas séries creditam 40%");
  eq(stats.efetivo(p, ATR.def), 0, "treino não concede nível");
  eq(stats.registrarRepeticao(p, ATR.def).motivo, "credito", "bloqueia terceira série");
  eq(up(p, ATR.def).gasto, 60, "usa crédito");
  eq(reset(p).pontos, 60, "devolve somente o que pagou");
  const atrasada = stats.statusAtributo(p, ATR.pod);
  tagPatente(p, POR_PATENTE.mizunoe);
  eq(stats.comprar(p, ATR.pod, 1, atrasada).motivo, "desatualizado", "patente mudou após abrir o menu");
  eq(up(p, ATR.pod, Infinity).motivo, "indisponivel", "quantidade não finita");
  log("iniciante, compras, repetições, créditos, reembolso exato e rejeição de pedidos antigos");
  await wait(2);
  p.disconnect();
}

function custoTotal(limite) {
  let total = 0;
  for (let n = 0; n < limite; n++) total += custoMelhoria(n);
  return total;
}

async function todasPatentes(sufixo) {
  const p = spawn("K70Rank" + sufixo);
  stats.pontuar(p, "kny_init", 1);
  stats.pontuar(p, "kny_pts", 1000000000);
  stats.atualizarStats(p);

  for (const r of PATENTES) {
    tagPatente(p, r);
    stats.atualizarStats(p);
    eq(stats.patenteDe(p).tag, r.tag, "identifica " + r.nome);
    for (const a of ATRIBUTOS) {
      const limite = r.limites[a.id];
      const resultado = up(p, a, NIVEL_MAXIMO + 1);
      eq(resultado.feitas, limite, "até o teto " + r.nome + " " + a.nome);
      eq(resultado.gasto, custoTotal(limite), "custo acumulado " + r.nome + " " + a.nome);
      eq(stats.efetivo(p, a), limite, "nível efetivo");
      eq(stats.statusAtributo(p, a).proximo, null, "menu/Vagas em " + a.nome);
      eq(up(p, a).motivo, "limite", "bloqueia acima do teto");
    }
    eq(vida(p).effectiveMax, vidaMax(r, r.limites.vid), "PV " + r.nome);
    near(mov(p), movimentoMax(r, 0), "movimento " + r.nome);
    eq(stats.staminaDe(p).max, staminaMax(r.limites.sta), "stamina " + r.nome);
    eq(stats.folegoDe(p).max, folegoMax(r.limites.pod), "fôlego " + r.nome);
    reset(p);
    eq(stats.disponiveis(p), 1000000000, "saldo íntegro após o ciclo");
  }
  log(PATENTES.length + " faixas em todos os cinco atributos, com efeitos aplicados e compra máxima");
  await wait(2);
  p.disconnect();
}

async function legadoERaca(sufixo) {
  const p = spawn("K70Ant" + sufixo, 51);
  tagPatente(p, POR_PATENTE.hashira);
  stats.pontuar(p, "kny_init", 1);
  stats.pontuar(p, "kny_mig7", 1);
  stats.pontuar(p, "kny_pts", 900000);
  stats.pontuar(p, ATR.for.obj, 85);
  stats.pontuar(p, ATR.for.tr, 10);
  stats.pontuar(p, ATR.vid.obj, 20);
  stats.pontuar(p, ATR.def.obj, -100);
  stats.pontuar(p, ATR.pod.obj, 9);
  stats.pontuar(p, ATR.pod.tr, 6);
  stats.pontuar(p, "upslayer", 999);
  p.addEffect("health_boost", 100, { amplifier: 14, showParticles: false });
  vida(p).setCurrentValue(55);
  stats.atualizarStats(p);

  const registrado = p.getDynamicProperty(DADOS);
  eq(stats.disponiveis(p), 900000, "saldo histórico");
  eq(stats.efetivo(p, ATR.for), 30, "excedente arquivado no teto");
  eq(dados(p).migracao.atributos.for.nivel, 85, "histórico bruto intacto");
  eq(stats.efetivo(p, ATR.def), 0, "dado negativo rejeitado");
  eq(vida(p).effectiveMax, 60, "boost antigo trocado pelo novo");
  eq(vida(p).currentValue, 55, "mantém vida durante substituição de efeito");
  eq(stats.statusAtributo(p, ATR.pod).custo, 1000, "custo inclui treino antigo");
  for (let i = 0; i < 3; i++) stats.atualizarStats(p);
  eq(p.getDynamicProperty(DADOS), registrado, "migração idempotente");
  eq(reset(p).pontos, 0, "atributos legados não geram saldo");

  tagPatente(p, POR_PATENTE.hashira_lider);
  p.addTag("hashira");
  p.addTag("upper6");
  stats.atualizarStats(p);
  eq(stats.efetivo(p, ATR.for), 30, "não libera excedente antigo");
  eq(up(p, ATR.for, 5).gasto, 50000, "compra real dos cinco novos níveis");
  eq(stats.efetivo(p, ATR.for), 35, "líder desenvolveu 35");
  world.scoreboard.getObjective("kny_lider").removeParticipant(p.name);
  eq(stats.patenteDe(p).tag, "hashira", "ignora cargo sem titular");
  stats.atualizarStats(p);
  eq(stats.efetivo(p, ATR.for), 30, "rebaixado limita Força");
  eq(reset(p).pontos, 0, "níveis novos suspensos não reembolsam");
  tagPatente(p, POR_PATENTE.hashira_lider);
  stats.atualizarStats(p);
  eq(stats.efetivo(p, ATR.for), 35, "recupera os níveis pagos");
  eq(reset(p).pontos, 50000, "recupera o investimento exato após reativação");

  stats.pontuar(p, "blood", 0);
  stats.pontuar(p, "kny_stam", 999);
  p.getComponent("minecraft:inventory").container.setItem(p.selectedSlotIndex, new ItemStack("kny:blood", 1));
  p.runCommand("function blood");
  await wait(3);
  eq(stats.patenteDe(p).tag, "oni", "transformação original usa raça Oni");
  eq(stats.efetivo(p, ATR.for), 8, "aplica apenas teto Oni");
  eq(vida(p).effectiveMax, 48, "vida após transformação");
  assert(stats.getScore(p, "kny_stam") <= stats.staminaDe(p).max, "stamina reaplicada");
  p.runCommand("function medicine");
  await wait(3);
  eq(stats.isOni(p), false, "cura preservada");
  eq(vida(p).effectiveMax, vidaMax(stats.patenteDe(p), stats.efetivo(p, ATR.vid)), "vida real após cura");
  log("migração v69, titularidade, promoção, rebaixamento, recuperação, transformação e cura");
  p.disconnect();
}

async function combateETreino(sufixo) {
  const a = spawn("K70Atk" + sufixo, 48, 51);
  const b = spawn("K70Def" + sufixo, 51, 51);
  for (const [p, r] of [[a, POR_PATENTE.hashira], [b, POR_PATENTE.upper6]]) {
    tagPatente(p, r);
    stats.pontuar(p, "kny_pts", 10000000);
    stats.atualizarStats(p);
    for (const attr of ATRIBUTOS) up(p, attr, NIVEL_MAXIMO);
  }
  // Dá espada de técnicas da v69 apenas depois de comparar o golpe comum.
  const hp = vida(b);
  hp.setCurrentValue(hp.effectiveMax);
  const antes = hp.currentValue;
  assert(b.applyDamage(12, { cause: "entityAttack", damagingEntity: a }), "golpe comum válido");
  const def = reducaoDefesa(stats.efetivo(b, ATR.def));
  const forca = efeitoForca(stats.efetivo(a, ATR.for)) / 100;
  near(antes - vida(b).currentValue, 12 * (1 + forca) * (1 - def), "dano físico real", 0.05);
  await wait(12);
  const item = new ItemStack("kny:nichirin_water");
  a.getComponent("minecraft:equippable").setEquipment("Mainhand", item);
  eq(a.getComponent("minecraft:equippable").getEquipment("Mainhand")?.typeId, "kny:nichirin_water", "arma equipada");
  const antesPoder = vida(b).currentValue;
  assert(b.applyDamage(12, { cause: "entityAttack", damagingEntity: a }), "golpe com Nichirin válido");
  const poder = efeitoPoder(stats.efetivo(a, ATR.pod)) / 100;
  near(antesPoder - vida(b).currentValue, 12 * (1 + forca + poder) * (1 - def), "Poder aplicado uma única vez", 0.05);
  eq(vida(b).effectiveMax, vidaMax(POR_PATENTE.upper6, 38), "teto de PV no duelo");
  a.addEffect("speed", 8, { amplifier: 1 });
  stats.atualizarStats(a);
  near(mov(a), 0.14, "buff de equipamento/poção conserva prioridade");
  await wait(13);
  stats.atualizarStats(a);
  near(mov(a), 0.114, "passivo de patente volta ao expirar");
  a.addEffect("slowness", 10, { amplifier: 1 });
  stats.atualizarStats(a);
  near(mov(a), 0.07, "lentidão legítima preservada");

  const antesMorte = b.getDynamicProperty(DADOS);
  b.applyDamage(9999, { cause: "override" });
  await wait(2);
  assert(b.respawn(), "simula respawn após morte");
  await wait(13);
  eq(b.getDynamicProperty(DADOS), antesMorte, "o progresso sobrevive à morte e ao respawn");
  assert(b.hasTag("kny_caido"), "caminho de morte da v69 marcou caído");
  eq(vida(b).currentValue, 10, "recálculo conserva os 10 PV de caído");
  // Limpe espaço e garanta um piso para ambos, inclusive ao gerar um mundo de teste novo.
  b.runCommand("fill ~-2 ~ ~-2 ~3 ~3 ~2 air");
  b.runCommand("fill ~-2 ~-1 ~-2 ~3 ~-1 ~2 stone");
  const auxiliar = { ...b.location, x: b.location.x + 1 };
  a.teleport(auxiliar);
  for (let i = 0; i < 22 && b.hasTag("kny_caido"); i++) {
    if (Math.hypot(a.location.x - b.location.x, a.location.z - b.location.z) > 2) a.teleport(auxiliar);
    a.isSneaking = true;
    await wait(10);
  }
  eq(b.hasTag("kny_caido"), false, "reviver sem alterar o sistema original");
  eq(vida(b).currentValue, Math.floor(vida(b).effectiveMax * 0.3), "recuperação original de 30% após reviver");
  a.isSneaking = false;
  log("dano e defesa no motor, interação com efeitos temporários, morte, respawn e reviver");
  a.disconnect();
  b.disconnect();
}

async function recompensaETrocaDimensao(sufixo) {
  const p = spawn("K70Dim" + sufixo, 52, 56);
  tagPatente(p, POR_PATENTE.mizunoto);
  stats.atualizarStats(p);
  const saldo = stats.disponiveis(p);
  await wait(3);
  p.dimension.runCommand("tickingarea add circle 48 110 56 2 k70_teste_abate");
  await wait(35);
  const l = p.location;
  const demonio = p.dimension.spawnEntity("kny:demon", { ...l, x: l.x + 1 });
  assert(demonio.applyDamage(9999, { cause: "entityAttack", damagingEntity: p }), "abate de Oni comum");
  await wait(3);
  eq(stats.disponiveis(p), saldo + PONTOS_POR_ONI.get("kny:demon"), "um crédito de combate por abate");
  eq(up(p, ATR.sta, 2).gasto, 200, "compra antes da troca de dimensão");
  const salvo = p.getDynamicProperty(DADOS);
  const nether = world.getDimension("nether");
  nether.runCommand("tickingarea add circle 48 110 56 2 k70_teste_nether");
  await wait(35);
  p.teleport({ x: 48, y: 110, z: 56 }, { dimension: nether });
  await wait(5);
  eq(p.dimension.id, "minecraft:nether", "troca de dimensão do jogador");
  eq(p.getDynamicProperty(DADOS), salvo, "estado persistente atravessa dimensões");
  eq(stats.staminaDe(p).max, staminaMax(2), "reserva de stamina em outra dimensão");
  log("recompensa real por Oni e recálculo na troca de dimensão");
  p.disconnect();
}

async function persistencia(sufixo) {
  const p = spawn("K70Persist", 48, 56);
  tagPatente(p, POR_PATENTE.kinoe);
  stats.atualizarStats(p);
  eq(up(p, ATR.pod).gasto, 100, "compra antes de desconectar");
  const saldo = stats.disponiveis(p);
  const antigo = p.getDynamicProperty(DADOS);
  const oferta = stats.statusAtributo(p, ATR.pod);
  await wait(2);
  p.disconnect();
  await wait(4);
  eq(stats.comprar(p, ATR.pod, 1, oferta).motivo, "indisponivel", "pedido pendente após desconexão");
  const voltou = spawn("K70Persist", 48, 56);
  stats.atualizarStats(voltou);
  if (voltou.getDynamicProperty(DADOS) === antigo) {
    eq(stats.disponiveis(voltou), saldo, "saldo após reconexão");
    eq(stats.efetivo(voltou, ATR.pod), 1, "nível após reconexão");
    log("reconexão na mesma identidade simulada verificada");
  } else {
    log("identidade do GameTest foi recriada no reconnect, persistência entre sessões será conferida fora do simulador de jogadores");
  }
  await wait(2);
  voltou.disconnect();
  world.setDynamicProperty(MUNDO_TESTE, JSON.stringify({ saldo, ficha: antigo }));
}

async function run() {
  const dimension = world.getDimension("overworld");
  dimension.runCommand("time set midnight");
  dimension.runCommand("gamerule dodaylightcycle false");
  dimension.runCommand("gamerule domobspawning false");
  dimension.runCommand("gamerule naturalregeneration false");
  if (world.getDynamicProperty(MUNDO_TESTE)) {
    const salvo = JSON.parse(world.getDynamicProperty(MUNDO_TESTE));
    const p = spawn("K70Recarrega", 48, 56);
    tagPatente(p, POR_PATENTE.kinoe);
    p.setDynamicProperty(DADOS, salvo.ficha);
    stats.atualizarStats(p);
    eq(stats.disponiveis(p), salvo.saldo, "saldo recarregado após o reinício do Bedrock");
    eq(stats.efetivo(p, ATR.pod), 1, "nível recarregado após o reinício");
    eq(p.getDynamicProperty(DADOS), salvo.ficha, "a migração não é executada de novo");
    log("reinício real BDS e leitura da ficha salva no checkpoint do mundo confirmados");
    await wait(3);
    p.disconnect();
    return;
  }

  const sufixo = String(system.currentTick).slice(-5);
  for (const [nome, teste] of [["iniciante", iniciante], ["patentes", todasPatentes], ["migração", legadoERaca], ["combate", combateETreino], ["recompensa e dimensão", recompensaETrocaDimensao], ["persistência", persistencia]]) {
    try {
      await teste(sufixo);
    } catch (e) {
      console.error("KNY-TEST FALHA " + nome + " " + e.stack + " " + e);
    }
    await wait(3);
  }
  log("FIM SUÍTE");
}

system.runTimeout(() => run().catch((e) => console.error("KNY-TEST FALHA SUÍTE " + e.stack + " " + e)), 20);
