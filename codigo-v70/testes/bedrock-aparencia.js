import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { CHAVE_ENTRADA, CHAVE_VISUAL, iniciarEdicao, lerAparencia } from "./character_system.js";
import { codificarVisual, PROP_APARENCIA, PROP_RASCUNHO } from "./character_config.js";

const CAMERA = "kny:aparencia_camera";
const CHECKPOINT = "kny:teste_v77_ficha";
const log = (s) => console.warn("KNY-TEST ENTRADA V77 " + s);
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => ok(a === b, msg + " (" + a + " × " + b + ")");
const canais = (p, props) => props.map((k) => p.getProperty(k)).join(",");
const wait = (n = 1) => system.waitTicks(n);
const planos = new Map();

function interceptarFormularios() {
  const telas = new WeakMap();
  const title = ActionFormData.prototype.title;
  const button = ActionFormData.prototype.button;
  const show = ActionFormData.prototype.show;
  ActionFormData.prototype.title = function (texto) {
    telas.set(this, { titulo: texto, botoes: [] });
    return title.call(this, texto);
  };
  ActionFormData.prototype.button = function (texto, ...args) {
    telas.get(this)?.botoes.push(texto.replace(/§./g, ""));
    return button.call(this, texto, ...args);
  };
  ActionFormData.prototype.show = function (p) {
    const plano = planos.get(p.id);
    if (!plano) return show.call(this, p);
    const tela = telas.get(this);
    plano.telas.push(tela);
    const acao = plano.acoes.shift();
    if (!acao) return Promise.resolve({ canceled: true, cancelationReason: "UserClosed" });
    const selection = tela.botoes.findIndex((b) => b.includes(acao));
    ok(selection >= 0, acao + " ausente em " + tela.titulo + " [" + tela.botoes.join(" | ") + "]");
    return Promise.resolve({ canceled: false, selection });
  };
}

async function spawn(nome, x, acoes = [], { salvo, antigo = false } = {}) {
  const dimension = world.getDimension("overworld");
  const pos = { x: x + 0.5, y: 210, z: 134.5 };
  const p = spawnSimulatedPlayer({ ...pos, dimension }, nome, GameMode.Survival);
  const plano = { acoes, telas: [] };
  planos.set(p.id, plano);
  if (antigo) p.addTag("start");
  if (salvo) {
    p.setDynamicProperty(CHAVE_VISUAL, salvo);
    p.setDynamicProperty(CHAVE_ENTRADA, true);
    p.setDynamicProperty(CAMERA, true);
  }
  p.teleport(pos, { dimension, rotation: { x: 0, y: 0 } });
  for (let i = 0; i < 20; i++) {
    await wait(3);
    if (dimension.getBlock({ x, y: 209, z: 134 })?.typeId === "minecraft:stone") break;
    p.runCommand("fill 128 209 128 143 209 143 minecraft:stone");
  }
  eq(dimension.getBlock({ x, y: 209, z: 134 })?.typeId, "minecraft:stone", "piso carregado");
  p.teleport(pos, { rotation: { x: 0, y: 0 } });
  return { p, plano };
}

async function usarMenu(p) {
  const slot = p.selectedSlotIndex;
  p.getComponent("minecraft:inventory").container.setItem(slot, new ItemStack("kny:menu_kimetsu", 1));
  await wait(3);
  ok(p.useItemInSlot(slot), "uso nativo do Menu Kimetsu");
  await wait(4);
  p.stopUsingItem();
  await wait(18);
  eq(p.getComponent("minecraft:inventory").container.getItem(slot)?.typeId, "kny:menu_kimetsu", "item preservado");
}

async function run() {
  interceptarFormularios();
  const dim = world.getDimension("overworld");
  dim.runCommand("gamerule domobspawning false");
  dim.runCommand("time set midnight");
  const checkpoint = world.getDynamicProperty(CHECKPOINT);

  if (checkpoint) {
    const { p, plano } = await spawn("V77Reinicio", 131, [], { antigo: true, salvo: checkpoint });
    await wait(110);
    eq(lerAparencia(p).perfis.base.peleIntegral, "pele_a_c98f65", "ficha relida após reinício de servidor");
    eq(p.getDynamicProperty(CAMERA), undefined, "restauração de câmera após reinício");
    eq(canais(p, PROP_APARENCIA), codificarVisual(lerAparencia(p).perfis.base).join(","), "canais recuperados");
    eq(canais(p, PROP_RASCUNHO), "-1,-1,-1", "rascunho limpo");
    ok(plano.telas.length === 1 && plano.telas[0].titulo.startsWith("kny_ctr|"), "ficha antiga abre somente o contrato pendente");
    p.disconnect();
    log("REINÍCIO OK");
    return;
  }

  const { p: novo, plano: escolhas } = await spawn("V77Escolha", 131, [
    "Próximo", "C:Cabelo", "Cor principal", "‹ Anterior", "C:Olhos", "Íris esquerda", "‹ Anterior",
    "Girar ›", "Aproximar", "Ver corpo", "CONFIRMAR", "ASSINAR O CONTRATO",
  ]);
  const { p: visita, plano: cancelado } = await spawn("V77Visita", 138, ["Cancelar"]);
  await wait(120);

  for (const [p, plano] of [[novo, escolhas], [visita, cancelado]]) {
    eq(p.getDynamicProperty(CHAVE_ENTRADA), true, "função nativa reservou a primeira entrada");
    eq(plano.acoes.length, 0, "respostas concluídas");
    ok(plano.telas[0]?.titulo.startsWith("kny_edit|"), "editor aberto automaticamente antes do contrato");
    ok(plano.telas.at(-1)?.titulo.startsWith("kny_ctr|"), "contrato aberto ao terminar");
    eq(plano.telas[0].botoes.filter((t) => /^[CS]:/.test(t)).map((t) => t.slice(2)).join(","), "Pele,Cabelo,Olhos", "três categorias");
    eq(plano.telas.at(-1).botoes.length, 2, "contrato sem atalho para a aparência");
    eq(p.getDynamicProperty(CAMERA), undefined, "câmera voltando ao controle normal");
    eq(canais(p, PROP_RASCUNHO), "-1,-1,-1", "rascunho limpo");
  }
  const salvo = novo.getDynamicProperty(CHAVE_VISUAL);
  ok(novo.hasTag("slayer") && novo.hasTag("mizunoto") && novo.hasTag("kny_escolheu"), "contrato e patente inicial nativos");
  const visual = lerAparencia(novo).perfis.base;
  eq(visual.peleIntegral, "pele_a_c98f65", "pele selecionada");
  eq(visual.corCabelo, "amarelo", "nova cor de cabelo");
  eq(visual.olhoE, "ciano", "nova cor dos olhos");
  eq(visual.roupa, undefined, "roupa fora da ficha");
  eq(canais(novo, PROP_APARENCIA), codificarVisual(visual).join(","), "canais nativos da pele confirmada");
  eq(visita.getDynamicProperty(CHAVE_VISUAL), undefined, "cancelar manteve a pele anterior");
  eq(visita.hasTag("slayer"), false, "contrato só muda a raça se for assinado");
  log("primeiro login automático, dez peles cadastradas, seleção de cor, câmera, cancelamento e contrato");

  await usarMenu(novo);
  await usarMenu(visita);
  ok(escolhas.telas.at(-1)?.titulo.startsWith("kny_painel|"), "item abre painel normal depois do contrato");
  ok(cancelado.telas.at(-1)?.titulo.startsWith("kny_ctr|"), "item reabre apenas o contrato");
  ok(!escolhas.telas.at(-1).botoes.some((t) => /Aparência|Customizar personagem/.test(t)), "sem atalho no painel");
  let bloqueou = false;
  try { iniciarEdicao(novo); } catch { bloqueou = true; }
  eq(bloqueou, true, "sessão não pode ser aberta novamente");

  const { p: antigo, plano: migracao } = await spawn("V77Legado", 134, [], { antigo: true });
  await wait(110);
  eq(antigo.getDynamicProperty(CHAVE_ENTRADA), undefined, "jogador de mundo antigo não é marcado como novo");
  ok(migracao.telas.length === 1 && migracao.telas[0].titulo.startsWith("kny_ctr|"), "jogador antigo segue o fluxo original");
  antigo.disconnect();
  novo.disconnect();
  visita.disconnect();
  world.setDynamicProperty(CHECKPOINT, salvo);
  log("bloqueio de segunda edição e compatibilidade com mundo anterior");
  log("FIM");
}

system.runTimeout(() => run().catch((e) => console.error("KNY-TEST FALHA V77 " + e + "\n" + (e.stack ?? ""))), 35);
