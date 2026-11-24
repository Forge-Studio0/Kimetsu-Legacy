import { Direction, GameMode, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";

const log = (message) => console.warn("[MENU-TESTE] " + message);
const assert = (cond, message) => { if (!cond) throw new Error(message); };
const title = ActionFormData.prototype.title;
const show = ActionFormData.prototype.show;
const titles = new WeakMap();
const plans = new Map();
const events = new Map();
let next = 0;

function mockForms() {
  // O jogador simulado exercita os eventos de item. As respostas dos formulários
  // substituem o clique que seria feito pelo cliente Bedrock.
  ActionFormData.prototype.title = function (text) {
    titles.set(this, text);
    return title.call(this, text);
  };
  ActionFormData.prototype.show = function (player) {
    const plan = plans.get(player.id);
    if (!plan) return show.call(this, player);
    const name = titles.get(this);
    plan.titles.push(name);
    log(player.name + " formulário " + name);
    return Promise.resolve(plan.choices.shift() ?? { canceled: true, cancelationReason: "UserClosed" });
  };
}

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (plans.has(source.id)) events.set(source.id, itemStack.typeId);
});

function simulate(choices, tag) {
  const index = ++next;
  const p = spawnSimulatedPlayer({ x: 60 + index * 3, y: 114, z: 66, dimension: world.getDimension("overworld") }, "MenuTeste" + index, GameMode.Survival);
  p.runCommand("setblock ~ ~-1 ~ stone");
  if (tag) p.addTag(tag);
  const plan = { titles: [], choices };
  plans.set(p.id, plan);
  return { p, plan };
}

async function use(p, item, block) {
  const slot = p.selectedSlotIndex;
  p.getComponent("minecraft:inventory").container.setItem(slot, item);
  await system.waitTicks(2);
  const used = block ? p.useItemOnBlock(item, block, Direction.Up) : p.useItemInSlot(slot);
  await system.waitTicks(4);
  p.stopUsingItem();
  await system.waitTicks(12);
  log(p.name + " usou " + item.typeId + " resultado=" + used);
  assert(p.getComponent("minecraft:inventory").container.getItem(slot)?.typeId === item.typeId, "O uso consumiu ou trocou " + item.typeId);
  return used;
}

system.runTimeout(async () => {
  try {
    mockForms();
    const menu = new ItemStack("kny:menu_kimetsu", 1);
    const livro = new ItemStack("kny:book_archievement", 1);
    assert(menu.getComponent("kny:abrir_menu"), "Item principal sem componente");
    assert(livro.getComponent("kny:abrir_menu"), "Livro sem componente");
    const caçador = simulate([{ selection: 2 }], "slayer");
    assert(await use(caçador.p, menu), "Menu não foi usado em sobrevivência");
    assert(events.get(caçador.p.id) === menu.typeId, "Evento nativo de uso do item principal ausente");
    assert(caçador.plan.titles[0]?.startsWith("kny_painel|"), "Painel de caçador não abriu");
    assert(caçador.plan.titles[1]?.startsWith("kny_conf|"), "Configurações do painel não abriram");
    assert(caçador.plan.titles.length === 2, "Um uso abriu formulários duplicados");
    assert(await use(caçador.p, menu), "Motor não registrou o segundo uso do item");
    assert(caçador.plan.titles.length === 3, "Não reabriu depois de fechar");
    caçador.p.disconnect();
    const oni = simulate([], "demon");
    assert(await use(oni.p, livro), "Livro não foi usado em sobrevivência");
    assert(events.get(oni.p.id) === livro.typeId, "Evento nativo do livro ausente");
    assert(oni.plan.titles.length === 1 && oni.plan.titles[0].includes("PAINEL DO ONI"), "Menu do Oni não abriu");
    oni.p.addTag("kny_cfg_classico");
    await use(oni.p, livro);
    assert(oni.plan.titles.length === 2 && oni.plan.titles[1].includes("MENU DO ONI"), "Menu clássico do Oni não abriu");
    oni.p.disconnect();
    const novo = simulate([{ selection: 1 }]);
    assert(await use(novo.p, menu), "Item não abriu para personagem novo");
    assert(novo.plan.titles[0]?.startsWith("kny_ctr|"), "Contrato inicial não apareceu");
    assert(novo.p.hasTag("kny_escolheu") && novo.p.hasTag("mizunoto"), "Contrato não promoveu ao cargo inicial");
    await use(novo.p, menu);
    assert(novo.plan.titles[1]?.startsWith("kny_painel|"), "Menu após contrato não abriu");
    novo.p.disconnect();
    const alvo = simulate([], "slayer");
    const { x, y, z } = alvo.p.location;
    const block = { x: Math.floor(x), y: Math.floor(y) - 1, z: Math.floor(z) };
    assert(await use(alvo.p, menu, block), "O motor não usou o item no bloco sólido");
    assert(alvo.plan.titles.length === 1, "O uso no bloco deve abrir um formulário");
    alvo.p.disconnect();
    log("FIM");
  } catch (e) {
    log("FALHA " + e + "\n" + (e.stack ?? ""));
  }
}, 40);
