import { GameMode, InputPermissionCategory, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { CHAVE_ENTRADA, CHAVE_VISUAL, iniciarEdicao, lerAparencia, prepararAparenciaInicial } from "./character_system.js";
import { codificarVisual, PROP_APARENCIA, PROP_RASCUNHO } from "./character_config.js";

import { abrirEditor } from "./character_editor.js";

const CAMERA = "kny:aparencia_camera";
const CHECKPOINT = "kny:teste_v78_ficha";
const MENU = "kny:menu_kimetsu";
const LIVRO = "kny:book_archievement";
const log = (s) => console.warn("KNY-TEST APARENCIA V82 " + s);
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => ok(a === b, msg + " (" + a + " × " + b + ")");
const canais = (p, props) => props.map((k) => p.getProperty(k)).join(",");
const wait = (n = 1) => system.waitTicks(n);
const planos = new Map();
const inv = (p) => p.getComponent("minecraft:inventory").container;

function slotsMenu(p) {
  const c = inv(p);
  const slots = [];
  for (let i = 0; i < c.size; i++) if (c.getItem(i)?.typeId === MENU) slots.push(i);
  return slots;
}

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
    if (plano.ocuparAoTrocar && tela.botoes.some((b) => b.includes("Base A · Mel"))) {
      plano.ocuparAoTrocar = false;
      eq(p.getDynamicProperty(CAMERA), true, "câmera de estúdio depois de trocar a pele");
      eq(p.getProperty("kny:cc_edicao"), true, "proteção depois de trocar a pele");
      eq(p.selectedSlotIndex, 1, "slot do livro preservado enquanto troca de pele");
      eq(inv(p).getItem(1)?.typeId, MENU, "livro preservado no inventário durante a edição");
      return Promise.resolve({ canceled: true, cancelationReason: "UserBusy" });
    }
    if (tela.titulo.startsWith("kny_edit|") && plano.ocupado > 0) {
      plano.ocupado--;
      return Promise.resolve({ canceled: true, cancelationReason: "UserBusy" });
    }
    if (tela.titulo.startsWith("kny_edit|§") && plano.testarProtecao) {
      plano.testarProtecao = false;
      return testarProtecao(p).then(() => selecionar(plano, tela)).catch((erro) => {
        console.error("KNY-TEST FALHA ISOLAMENTO " + erro);
        throw erro;
      });
    }
    return selecionar(plano, tela);
  };
}

function selecionar(plano, tela) {
    const acao = plano.acoes.shift();
    if (!acao) return Promise.resolve({ canceled: true, cancelationReason: "UserClosed" });
    const selection = tela.botoes.findIndex((b) => b.includes(acao));
    ok(selection >= 0, acao + " ausente em " + tela.titulo + " [" + tela.botoes.join(" | ") + "]");
    return Promise.resolve({ canceled: false, selection });
}

async function testarProtecao(p) {
  eq(p.dimension.id, "kny:estudio", "a edição ocorre fora do mundo público");
  const participantes = () => p.dimension.getPlayers().filter((j) => j.id !== p.id);
  for (let i = 0; i < 15 && participantes().length === 0; i++) await wait(3);
  const outros = participantes();
  ok(outros.length > 0 && outros.every((j) => Math.hypot(j.location.x - p.location.x, j.location.z - p.location.z) >= 4000),
    "personalizações simultâneas estão em plataformas separadas");
  ok(world.getDimension("overworld").getPlayers().length > 0, "há observadores no mundo público");
  ok(!p.dimension.getPlayers({ location: p.location, maxDistance: 768 }).some((j) => j.id !== p.id),
    "nenhum outro jogador próximo do estúdio");
  await wait(2);
  const movimento = InputPermissionCategory.LateralMovement;
  eq(p.inputPermissions.isPermissionCategoryEnabled(movimento), false, "movimento bloqueado durante o painel");
  eq(p.getProperty("kny:cc_edicao"), true, "propriedade do retrato durante o painel");
  const vida = p.getComponent("minecraft:health");
  const antes = vida.currentValue;
  p.applyDamage(30, { cause: "override" });
  p.applyDamage(2, { cause: "fire" });
  await wait(3);
  eq(vida.currentValue, antes, "dano real cancelado durante a edição");
}

async function spawn(nome, x, acoes = [], { antigo = false, salvo, caixa = false, ocupado = 0, preparar } = {}) {
  const dimension = world.getDimension("overworld");
  const pos = { x: x + 0.5, y: 210, z: 134.5 };
  const p = spawnSimulatedPlayer({ ...pos, dimension }, nome, GameMode.Survival);
  const plano = { acoes, ocupado, telas: [] };
  planos.set(p.id, plano);
  if (antigo) p.addTag("start");
  if (salvo) {
    p.setDynamicProperty(CHAVE_VISUAL, salvo);
    p.setDynamicProperty(CHAVE_ENTRADA, "v78");
    p.setDynamicProperty(CAMERA, true);
  }
  preparar?.(p);
  p.teleport(pos, { dimension, rotation: { x: 0, y: 0 } });
  for (let i = 0; i < 20; i++) {
    await wait(3);
    if (dimension.getBlock({ x, y: 209, z: 134 })?.typeId === "minecraft:stone") break;
    p.runCommand("fill 128 209 128 143 209 143 stone");
  }
  eq(dimension.getBlock({ x, y: 209, z: 134 })?.typeId, "minecraft:stone", "piso carregado");
  if (caixa) {
    p.runCommand(`fill ${x - 1} 210 133 ${x + 1} 212 135 stone`);
    p.runCommand(`fill ${x} 210 134 ${x} 212 134 air`);
  }
  p.teleport(pos, { rotation: { x: 0, y: 0 } });
  return { p, plano };
}

async function usarMenu(p) {
  const slot = slotsMenu(p)[0];
  ok(slot >= 0 && slot < 9, "Menu na barra");
  p.selectedSlotIndex = slot;
  await wait(2);
  ok(p.useItemInSlot(slot), "uso nativo do Menu Kimetsu");
  await wait(4);
  p.stopUsingItem();
  await wait(18);
  eq(slotsMenu(p).length, 1, "item único preservado após usar");
}

async function run() {
  interceptarFormularios();
  const dim = world.getDimension("overworld");
  dim.runCommand("gamerule domobspawning false");
  dim.runCommand("time set midnight");
  const checkpoint = world.getDynamicProperty(CHECKPOINT);

  if (checkpoint) {
    const { p, plano } = await spawn("V78Reinicio", 131, [], { antigo: true, salvo: checkpoint });
    await wait(110);
    eq(lerAparencia(p).perfis.base.peleIntegral, "pele_a_c98f65", "ficha relida após reinício de servidor");
    eq(p.getDynamicProperty(CAMERA), undefined, "restauração de câmera após reinício");
    eq(canais(p, PROP_APARENCIA), codificarVisual(lerAparencia(p).perfis.base).join(","), "canais recuperados");
    eq(canais(p, PROP_RASCUNHO), "-1,-1,-1", "rascunho limpo");
    eq(slotsMenu(p).length, 1, "jogador antigo recebe um menu");
    ok(plano.telas.length === 1 && plano.telas[0].titulo.startsWith("kny_ctr|"), "ficha antiga abre somente o contrato pendente");
    p.disconnect();
    log("REINÍCIO OK");
    return;
  }

  const { p: novo, plano: escolhas } = await spawn("V78Escolha", 131, [
    "Crie seu personagem", "Próximo", "C:Cabelo", "Cor principal", "‹ Anterior", "C:Olhos", "Íris esquerda", "‹ Anterior",
    "Girar ›", "Aproximar", "Ver corpo", "CONFIRMAR", "ASSINAR O CONTRATO",
  ], { preparar: (p) => {
    inv(p).setItem(1, new ItemStack(MENU));
    p.selectedSlotIndex = 1;
    inv(p).setItem(9, new ItemStack(LIVRO));
  } });
  const { p: visita, plano: fechado } = await spawn("V78Caixa", 138, ["Crie seu personagem", "Cancelar"], { caixa: true, ocupado: 20,
    preparar: (p) => {
      inv(p).setItem(0, new ItemStack(MENU));
      inv(p).setItem(3, new ItemStack(MENU));
    },
  });
  const { p: cheio } = await spawn("V78Cheio", 134, [], { antigo: true, preparar: (p) => {
    p.addTag("slayer");
    const c = inv(p);
    for (let i = 0; i < c.size; i++) c.setItem(i, new ItemStack("minecraft:stone", 64));
  } });
  const { p: legado, plano: recuperacao } = await spawn("V78Legado", 135, [], {
    antigo: true, preparar: (p) => {
      p.addTag("slayer");
      p.addTag("kny_escolheu");
      p.setDynamicProperty(CHAVE_ENTRADA, true);
    },
  });
  escolhas.testarProtecao = true;
  escolhas.ocuparAoTrocar = true;
  await wait(165);

  eq(novo.getDynamicProperty(CHAVE_ENTRADA), "v78", "função nativa reservou a primeira entrada");
  eq(escolhas.acoes.length, 0, "ações de edição e contrato executadas");
  ok(escolhas.telas[0]?.titulo.startsWith("kny_criar|"), "tela de criação abre primeiro");
  ok(escolhas.telas[1]?.titulo.startsWith("kny_edit|§"), "editor com câmera abre antes do contrato");
  ok(escolhas.telas.at(-1)?.titulo.startsWith("kny_ctr|"), "confirmação abre o contrato");
  eq(escolhas.telas[1].botoes.filter((t) => /^[CS]:/.test(t)).map((t) => t.slice(2)).join(","), "Pele,Cabelo,Olhos", "três categorias");
  eq(slotsMenu(novo).join(","), "1", "login com item já presente mantém uma cópia no mesmo slot");
  eq(inv(novo).getItem(9)?.typeId, LIVRO, "livro preservado");
  const salvo = novo.getDynamicProperty(CHAVE_VISUAL);
  ok(novo.hasTag("slayer") && novo.hasTag("mizunoto") && novo.hasTag("kny_escolheu"), "contrato e patente inicial nativos");
  const visual = lerAparencia(novo).perfis.base;
  eq(visual.peleIntegral, "pele_a_c98f65", "pele escolhida");
  eq(visual.corCabelo, "amarelo", "cor de cabelo");
  eq(visual.olhoE, "ciano", "cor dos olhos");
  eq(canais(novo, PROP_APARENCIA), codificarVisual(visual).join(","), "canais nativos do visual confirmado");
  eq(novo.getDynamicProperty(CAMERA), undefined, "câmera restaurada ao confirmar");
  eq(novo.dimension.id, "minecraft:overworld", "voltou ao mundo antes do contrato");
  eq(novo.getProperty("kny:cc_edicao"), false, "visibilidade restaurada");
  eq(novo.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.LateralMovement), true, "controle restaurado");
  eq(slotsMenu(visita).length, 1, "duas cópias preexistentes viraram uma");
  ok(fechado.telas.filter((tela) => tela.titulo.startsWith("kny_edit|")).every((tela) =>
    tela.titulo.startsWith("kny_edit|§")), "a espera mantém a câmera privada");
  ok(escolhas.telas.filter((tela) => tela.titulo.startsWith("kny_edit|")).every((tela) =>
    tela.titulo.startsWith("kny_edit|§")), "a mudança de pele e a tela ocupada conservam o mesmo visor");
  ok(!fechado.telas.some((tela) => tela.titulo.startsWith("kny_ctr|")), "contrato aguardando durante a tela ocupada");
  log("estúdios privados, troca de pele com a câmera estável, retorno e livro no slot de origem");

  eq(slotsMenu(cheio).length, 0, "inventário cheio sem item");
  eq(cheio.dimension.getEntities({ type: "minecraft:item", location: cheio.location, maxDistance: 2 }).length, 0, "sem item largado no chão");
  inv(cheio).setItem(4, undefined);
  await wait(7);
  eq(slotsMenu(cheio).join(","), "4", "liberar espaço entrega o item");
  eq(inv(cheio).getItem(4)?.keepOnDeath, true, "menu entregue permanece ao morrer");
  inv(novo).setItem(16, new ItemStack(MENU));
  await wait(7);
  eq(slotsMenu(novo).length, 1, "cópia recebida depois do login removida");
  log("inventário cheio, entrega após liberar espaço e deduplicação depois do login");

  eq(recuperacao.telas.length, 0, "personagem da v77 em andamento não recebe editor automático");
  novo.runCommand("scriptevent kny:aparencia recuperar_entrada V78Legado");
  await wait(5);
  eq(recuperacao.telas.length, 0, "jogador comum não recupera uma entrada");
  novo.addTag("kny_op");
  recuperacao.acoes.push("Crie seu personagem", "CONFIRMAR");
  novo.runCommand("scriptevent kny:aparencia recuperar_entrada V78Legado");
  await wait(8);
  ok(recuperacao.telas[1]?.titulo.startsWith("kny_edit|"), "Staff abriu a recuperação da v77");
  eq(recuperacao.telas.length, 2, "Caçador de recuperação não reassina o contrato");
  eq(legado.getDynamicProperty(CHAVE_ENTRADA), "v78", "recuperação registrada uma vez");
  ok(lerAparencia(legado).perfis.base.peleIntegral, "ficha recuperada salva");

  for (let i = 0; i < 16 && !fechado.telas.at(-1)?.titulo.startsWith("kny_ctr|"); i++) await wait(12);
  eq(fechado.telas.filter((t) => t.titulo.startsWith("kny_edit|")).length, 21, "vinte bloqueios e exibição do editor");
  ok(fechado.telas.at(-1)?.titulo.startsWith("kny_ctr|"), "só abriu contrato quando a escolha terminou");
  eq(visita.dimension.id, "minecraft:overworld", "voltou ao mundo ao cancelar");
  eq(visita.getDynamicProperty(CHAVE_VISUAL), undefined, "cancelamento preservou a ficha");
  eq(canais(visita, PROP_RASCUNHO), "-1,-1,-1", "rascunho descartado");
  log("vinte tentativas com tela ocupada mantiveram a câmera e a recuperação da v77 funcionou");

  escolhas.acoes.push("Guia");
  await usarMenu(novo);
  await usarMenu(visita);
  ok(escolhas.telas.some((tela) => tela.titulo.startsWith("kny_painel|")), "item abre painel normal depois do contrato");
  eq(escolhas.telas.at(-1)?.titulo, "kny_conf|§lGUIA E ACESSOS", "Guia usa a moldura do Kimetsu");
  ok(escolhas.telas.at(-1)?.botoes.includes("L:Acessos de facção"), "Guia mantém os acessos");
  ok(fechado.telas.at(-1)?.titulo.startsWith("kny_ctr|"), "item reabre apenas o contrato");
  let bloqueou = false;
  try { iniciarEdicao(novo); } catch { bloqueou = true; }
  eq(bloqueou, true, "sessão confirmada não reabre");
  const { p: prensa, plano: retrato } = await spawn("V82Retrato", 142, ["Anterior", "Próximo", "Próximo", "CONFIRMAR"],
    { antigo: true, caixa: true });
  prensa.addTag("kny_aparencia_novo");
  ok(prepararAparenciaInicial(prensa), "sessão para provar a reserva do visor");
  await abrirEditor(prensa);
  ok(retrato.telas[0]?.titulo.startsWith("kny_edit|R§") && retrato.telas[0].botoes.includes("PV:"), "sala apertada usa uma imagem de corpo inteiro");
  ok(retrato.telas[1]?.titulo.startsWith("kny_edit|RA"), "modalidade alternativa para a pele da conta");
  eq(lerAparencia(prensa).perfis.base.peleIntegral, "pele_a_c98f65", "troca de pele pelo retrato");
  ok(retrato.telas.every((t) => !t.botoes.some((b) => b.includes("Girar"))), "reserva exibe apenas ações funcionais");
  eq(prensa.getDynamicProperty(CAMERA), undefined, "reserva não reteve câmera ativa");
  prensa.disconnect();
  log("prévia alternativa, pele da conta e aplicação da pele da addon");
  for (const p of [cheio, legado, visita, novo]) p.disconnect();
  world.setDynamicProperty(CHECKPOINT, salvo);
  log("FIM");
}

system.runTimeout(() => run().catch((e) => console.error("KNY-TEST FALHA APARENCIA V82 " + e + "\n" + (e.stack ?? ""))), 35);
