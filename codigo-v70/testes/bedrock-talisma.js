import { BlockVolume, GameMode, ItemStack, system, world } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { CHAVE_ENTRADA } from "./character_system.js";
import { carregarArea, descarregarArea } from "./missoes_arenas.js";
import { ITEM_TALISMA, consultarTalismas, emitirTalisma, removerTalismas, usarTalisma } from "./talisma_eternidade.js";

const log = (mensagem) => console.warn("KNY-TEST TALISMA " + mensagem);
const assert = (condicao, mensagem) => { if (!condicao) throw new Error(mensagem); };
const bolsa = (p) => p.getComponent("minecraft:inventory").container;
const MAO = 3;
const usos = new Map();

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (itemStack.typeId === ITEM_TALISMA) usos.set(source.id, (usos.get(source.id) ?? 0) + 1);
});

async function esperar(condicao, falha, max = 100) {
  for (let i = 0; i < max; i += 2) {
    if (condicao()) return;
    await system.waitTicks(2);
  }
  throw new Error(falha);
}

function criar(dimension, nome, x) {
  const pos = { x, y: 210, z: 61.5 };
  const p = spawnSimulatedPlayer({ ...pos, dimension }, nome, GameMode.Survival);
  p.addTag("start");
  p.addTag("kny_escolheu");
  p.addTag("slayer");
  p.setDynamicProperty(CHAVE_ENTRADA, "v78");
  p.teleport(pos, { dimension });
  return p;
}

function moverParaMao(p) {
  const inv = bolsa(p);
  const slot = Array.from({ length: inv.size }, (_, i) => i).find((i) => inv.getItem(i)?.typeId === ITEM_TALISMA);
  assert(slot !== undefined, "Talismã entregue no inventário");
  const item = inv.getItem(slot);
  if (slot !== MAO) {
    const outro = inv.getItem(MAO);
    inv.setItem(MAO, item);
    inv.setItem(slot, outro);
  }
  p.selectedSlotIndex = MAO;
  return item;
}

async function usar(p) {
  p.selectedSlotIndex = MAO;
  await system.waitTicks(5);
  assert(bolsa(p).getItem(MAO)?.typeId === ITEM_TALISMA, "Talismã disponível na mão");
  const antes = usos.get(p.id) ?? 0;
  const usado = p.useItemInSlot(MAO);
  await system.waitTicks(4);
  p.stopUsingItem();
  assert(usado || (usos.get(p.id) ?? 0) > antes, "Uso nativo do talismã por " + p.name);
}

async function executar() {
  const dimension = world.getDimension("overworld");
  dimension.runCommand("gamerule doMobSpawning false");
  const from = { x: 48, y: 209, z: 57 }, to = { x: 63, y: 209, z: 74 };
  await carregarArea("kny_teste_talisma", { dimension, from, to });
  try { dimension.fillBlocks(new BlockVolume(from, to), "minecraft:stone"); }
  finally { descarregarArea("kny_teste_talisma"); }
  const alvo = criar(dimension, "AlvoTalisma86", 52.5);
  const staff = alvo;
  await system.waitTicks(10);
  staff.addTag("kny_op");
  assert(!emitirTalisma(staff, alvo, "strength", 1).ok, "Força fora da lista");
  assert(!emitirTalisma(staff, alvo, "haste", 3).ok, "Nível acima do limite");
  assert(emitirTalisma(staff, alvo, "haste", 2).ok, "Emissão da Staff");
  const original = moverParaMao(alvo);
  assert(original.getComponent("kny:usar_talisma_eternidade"), "Componente nativo registrado");
  await usar(alvo);
  assert(alvo.getEffect("haste")?.amplifier === 1, "Pressa II ativada pela ação nativa do item");

  const outro = criar(dimension, "OutroTalisma86", 58.5);
  await system.waitTicks(5);
  assert(!emitirTalisma(outro, outro, "haste", 1).ok, "Emissão pelo jogador comum deve falhar");
  assert(emitirTalisma(staff, outro, "jump_boost", 1).ok, "Emissão independente");
  const itemOutro = moverParaMao(outro);
  assert(usarTalisma(outro, itemOutro).ok, "Segundo jogador usa a própria concessão");
  assert(outro.getEffect("jump_boost")?.amplifier === 0, "Super salto I individual");
  assert(outro.getEffect("haste") === undefined && alvo.getEffect("jump_boost") === undefined, "Sem efeito cruzado");
  assert(!bolsa(alvo).getItem(MAO) && !bolsa(outro).getItem(MAO), "Consumo dos dois itens após o uso");
  assert(emitirTalisma(staff, alvo, "water_breathing", 1).ok, "Emissão para provar o vínculo com o beneficiário");
  const respira = moverParaMao(alvo);
  bolsa(outro).setItem(MAO, respira);
  assert(!usarTalisma(outro, respira).ok, "A emissão pertence ao primeiro jogador");
  assert(!outro.getEffect("water_breathing") && bolsa(outro).getItem(MAO), "Beneficiário incorreto não consome e não aplica");
  bolsa(outro).setItem(MAO, undefined);
  assert(usarTalisma(alvo, respira).ok, "Ativação de respiração aquática");
  assert(alvo.getEffect("water_breathing"), "O beneficiário correto ativa a mesma emissão");
  bolsa(alvo).setItem(MAO, original);
  assert(!usarTalisma(alvo, original).ok, "A mesma emissão não é resgatada duas vezes");
  assert(bolsa(alvo).getItem(MAO) && consultarTalismas(staff, alvo).length === 2, "Cópia com selo já resgatado");
  bolsa(alvo).setItem(MAO, new ItemStack(ITEM_TALISMA));
  assert(!usarTalisma(alvo, bolsa(alvo).getItem(MAO)).ok, "O item unsigned não é uma concessão");
  assert(bolsa(alvo).getItem(MAO), "Item sem selo recusado sem consumo");
  bolsa(alvo).setItem(MAO, undefined);

  assert(emitirTalisma(staff, alvo, "night_vision", 1).ok, "Talismã adicional de visão noturna");
  assert(usarTalisma(alvo, moverParaMao(alvo)).ok, "Ativação de visão noturna");
  assert(alvo.getEffect("night_vision"), "Benefício aplicado de visão noturna");
  assert(!emitirTalisma(staff, alvo, "jump_boost", 1).ok, "Limite de três benefícios");
  const registrados = consultarTalismas(staff, alvo);
  assert(registrados.length === 3 && registrados.every((c) => c.ativo), "Três benefícios em coexistência");
  log("Emissão, uso nativo, nível, duplicação e benefícios simultâneos concluídos");

  alvo.kill();
  await system.waitTicks(2);
  assert(alvo.respawn(), "Respawn após a primeira morte");
  await esperar(() => alvo.isValid && alvo.hasTag("kny_caido"), "Primeiro respawn deve respeitar o estado Caído");
  assert(alvo.getEffect("haste") === undefined, "Não restaurar no estado Caído");
  alvo.kill();
  await system.waitTicks(2);
  assert(alvo.respawn(), "Respawn após a morte definitiva");
  await esperar(() => alvo.isValid && !alvo.hasTag("kny_caido") && alvo.getEffect("haste")?.amplifier === 1,
    "Restaurar Pressa II após morte definitiva e respawn");
  assert(alvo.getEffect("water_breathing") && alvo.getEffect("night_vision"), "Restaurar os demais efeitos no respawn");
  log("Respawn legítimo restaurou os efeitos após a finalização, sem interferir no Reviver");

  const haste = consultarTalismas(staff, alvo).find((c) => c.efeito === "haste");
  assert(removerTalismas(staff, alvo, haste).removidos === 1, "Remoção individual");
  await esperar(() => !alvo.getEffect("haste"), "Pressa revogada deve expirar", 140);
  assert(alvo.getEffect("night_vision") && alvo.getEffect("water_breathing"), "Remoção pontual preservou os outros efeitos");
  alvo.addEffect("night_vision", 600, { amplifier: 1 });
  assert(removerTalismas(staff, alvo).removidos === 2, "Remoção total");
  assert(alvo.getEffect("night_vision")?.amplifier === 1, "Efeito externo preservado");
  log("OK");
}

system.runTimeout(() => {
  executar().catch((erro) => console.error("KNY-TEST FALHA TALISMA " + erro + "\n" + (erro.stack ?? "")));
}, 35);
