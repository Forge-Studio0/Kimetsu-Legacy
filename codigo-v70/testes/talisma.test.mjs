import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { executarAgendados, executarIntervalos, ItemStack, jogador, world } from "./simulador.mjs";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@minecraft/server" || specifier === "@minecraft/server-ui") {
      return { shortCircuit: true, url: new URL("./simulador.mjs", import.meta.url).href };
    }
    return next(specifier, context);
  },
});

const propriedades = new WeakMap();
ItemStack.prototype.setDynamicProperty = function (nome, valor) {
  if (!propriedades.has(this)) propriedades.set(this, new Map());
  propriedades.get(this).set(nome, valor);
};
ItemStack.prototype.getDynamicProperty = function (nome) {
  return propriedades.get(this)?.get(nome);
};
ItemStack.prototype.setLore = function (linhas) { this.lore = linhas; };

const bp = pathToFileURL(resolve(process.env.KIMETSU_BP ?? "Kimetsu Fix Be") + "/");
const { ITEM_TALISMA, emitirTalisma, usarTalisma, consultarTalismas, removerTalismas } =
  await import(new URL("scripts/talisma_eternidade.js", bp));
const { abrirPainelTalisma } = await import(new URL("scripts/talisma_staff.js", bp));

const bolsa = (p) => p.getComponent("minecraft:inventory").container;
const staff = jogador("StaffTalismã");
staff.addTag("kny_op");

test("só a Staff emite os níveis permitidos e pode consultar ou remover", () => {
  const alvo = jogador();
  const leigo = jogador();
  assert.equal(emitirTalisma(leigo, alvo, "haste", 2).ok, false);
  assert.equal(emitirTalisma(staff, alvo, "haste", 3).ok, false);
  assert.equal(emitirTalisma(staff, alvo, "night_vision", 2).ok, false);
  for (const desabilitado of ["instant_health", "fire_resistance", "strength", "resistance", "speed", "regeneration", "slow_falling"]) {
    assert.equal(emitirTalisma(staff, alvo, desabilitado, 1).ok, false);
  }
  assert.equal(consultarTalismas(leigo, alvo), undefined);
  assert.equal(removerTalismas(leigo, alvo).ok, false);
  const cheio = bolsa(alvo);
  for (let i = 0; i < cheio.size; i++) cheio.setItem(i, new ItemStack("minecraft:stone"));
  assert.match(emitirTalisma(staff, alvo, "haste", 2).motivo, /cheio/);
  assert.equal(consultarTalismas(staff, alvo).length, 0);
});

test("o selo vincula o efeito ao beneficiário e um item copiado só pode ser resgatado uma vez", () => {
  const alvo = jogador();
  const outro = jogador();
  assert.equal(emitirTalisma(staff, alvo, "haste", 2).ok, true);
  const inventario = bolsa(alvo);
  const item = inventario.getItem(0);
  assert.equal(item.typeId, ITEM_TALISMA);
  const falso = new ItemStack(ITEM_TALISMA);
  falso.setLore(item.lore);
  inventario.setItem(1, falso);
  alvo.selectedSlotIndex = 1;
  assert.match(usarTalisma(alvo, falso).motivo, /inválido/);
  assert.equal(inventario.getItem(1), falso);
  bolsa(outro).setItem(0, item);
  assert.match(usarTalisma(outro, item).motivo, /outro jogador/);

  alvo.selectedSlotIndex = 0;
  alvo.addEffect("haste", 50, { amplifier: 0 });
  assert.match(usarTalisma(alvo, item).motivo, /já está presente/);
  assert.equal(inventario.getItem(0), item);
  alvo.removeEffect("haste");
  assert.equal(usarTalisma(alvo, item).ok, true);
  assert.equal(alvo.getEffect("haste").amplifier, 1);
  assert.equal(inventario.getItem(0), undefined);
  inventario.setItem(0, item);
  assert.equal(usarTalisma(alvo, item).ok, false);
  assert.equal(consultarTalismas(staff, alvo).length, 1);
  assert.equal(emitirTalisma(staff, alvo, "haste", 1).ok, false);
});

test("concessões simultâneas são individuais, limitadas a três e renovadas após respawn", async () => {
  const a = jogador();
  const b = jogador();
  for (const efeito of ["haste", "water_breathing", "night_vision"]) {
    assert.equal(emitirTalisma(staff, a, efeito, 1).ok, true);
    assert.equal(usarTalisma(a, bolsa(a).getItem(0)).ok, true);
  }
  assert.equal(emitirTalisma(staff, a, "jump_boost", 1).ok, false);
  assert.equal(emitirTalisma(staff, b, "jump_boost", 2).ok, true);
  const itemB = bolsa(b).getItem(0);
  assert.equal(usarTalisma(b, itemB).ok, true);
  assert.equal(b.getEffect("jump_boost").amplifier, 1);
  assert.equal(a.getEffect("jump_boost"), undefined);
  assert.equal(b.getEffect("night_vision"), undefined);
  const inicial = a.getEffect("night_vision").duration;
  executarIntervalos(20);
  assert.equal(a.getEffect("night_vision").duration, inicial);

  // Simula o ciclo de morte e respawn enquanto o servidor permanece em execução.
  for (const efeito of ["haste", "water_breathing", "night_vision"]) a.removeEffect(efeito);
  const posicao = a.location;
  a.location = { ...posicao, y: -100 };
  world.afterEvents.entityDie.emit({ deadEntity: a });
  a.location = posicao;
  world.afterEvents.playerSpawn.emit({ player: a, initialSpawn: false });
  a.addTag("kny_caido");
  await executarAgendados();
  executarIntervalos(20);
  assert.equal(a.getEffect("haste"), undefined);
  a.removeTag("kny_caido");
  executarIntervalos(20);
  assert.ok(a.getEffect("haste"));
  assert.ok(a.getEffect("water_breathing"));
  assert.ok(a.getEffect("night_vision"));
});

test("a aplicação é protegida de reentrada e devolve o item se o motor rejeitar o efeito", () => {
  const alvo = jogador();
  assert.equal(emitirTalisma(staff, alvo, "haste", 1).ok, true);
  const inv = bolsa(alvo);
  const item = inv.getItem(0);
  const aplicar = alvo.addEffect;
  alvo.addEffect = () => {
    assert.match(usarTalisma(alvo, item).motivo, /utilização atual/);
    throw new Error("falha do motor");
  };
  assert.throws(() => usarTalisma(alvo, item), /falha do motor/);
  assert.equal(inv.getItem(0), item);
  assert.equal(consultarTalismas(staff, alvo)[0].ativo, false);
  alvo.addEffect = aplicar;
  assert.equal(usarTalisma(alvo, item).ok, true);
});

test("revogação preserva poções independentes e invalida talismãs ainda fechados", () => {
  const alvo = jogador();
  emitirTalisma(staff, alvo, "haste", 1);
  emitirTalisma(staff, alvo, "night_vision", 1);
  assert.equal(usarTalisma(alvo, bolsa(alvo).getItem(0)).ok, true);
  const pendente = bolsa(alvo).getItem(1);
  const haste = consultarTalismas(staff, alvo).find((c) => c.efeito === "haste");
  alvo.addEffect("haste", 500, { amplifier: 2 });
  executarIntervalos(20);
  assert.equal(alvo.getEffect("haste").amplifier, 2);
  assert.equal(removerTalismas(staff, alvo, haste).removidos, 1);
  assert.equal(removerTalismas(staff, alvo).removidos, 1);
  assert.equal(alvo.getEffect("haste").amplifier, 2);
  alvo.selectedSlotIndex = 1;
  assert.equal(usarTalisma(alvo, pendente).ok, false);
  assert.equal(bolsa(alvo).getItem(1), pendente);
});

test("o menu exige confirmação e revalida a permissão do emissor", async () => {
  const operador = jogador("Administrador Teste");
  operador.addTag("kny_op");
  const alvo = jogador("Alvo Confirmado");
  const mostrar = (f, p) => f.show(p);
  const selecionar = (termo) => (form) => {
    const selection = form.buttons.findIndex((b) => b.texto.includes(termo));
    assert.ok(selection >= 0, termo);
    return { canceled: false, selection };
  };
  operador.escolhas.push(selecionar(alvo.name), selecionar("Emitir talismã"), selecionar("Pressa"), selecionar("Nível II"));
  await abrirPainelTalisma(operador, mostrar, () => {});
  assert.equal(consultarTalismas(staff, alvo).length, 0);
  operador.escolhas.push(selecionar(alvo.name), selecionar("Emitir talismã"), selecionar("Pressa"), selecionar("Nível II"), (form) => {
    operador.removeTag("kny_op");
    return selecionar("Entregar talismã")(form);
  });
  await abrirPainelTalisma(operador, mostrar, () => {});
  assert.equal(consultarTalismas(staff, alvo).length, 0);
  operador.addTag("kny_op");
  operador.escolhas.push(selecionar(alvo.name), selecionar("Emitir talismã"), selecionar("Pressa"), selecionar("Nível II"),
    selecionar("Entregar talismã"), selecionar("Remover todos"), selecionar("Revogar concessão"));
  await abrirPainelTalisma(operador, mostrar, () => {});
  assert.equal(consultarTalismas(staff, alvo).length, 0);
  assert.equal(bolsa(alvo).getItem(0).typeId, ITEM_TALISMA);
  assert.equal(usarTalisma(alvo, bolsa(alvo).getItem(0)).ok, false);
});
