import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { executarAgendados, executarIntervalos, ItemStack, jogador, system, world } from "./simulador.mjs";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@minecraft/server" || specifier === "@minecraft/server-ui") {
      return { shortCircuit: true, url: new URL("./simulador.mjs", import.meta.url).href };
    }
    return next(specifier, context);
  },
});

const pack = pathToFileURL(resolve(process.env.KIMETSU_BP ?? "Kimetsu Fix Be") + "/");
const tp = await import(new URL("scripts/pergaminho_teleporte.js", pack));
const dim = world.getDimension("minecraft:overworld");
const seguro = { x: 31.61, y: 70, z: 13.42 };
const origem = { x: 15.25, y: 70, z: 31.5 };
const terra = { typeId: "minecraft:stone", isSolid: true, isAir: false };
const ar = { typeId: "minecraft:air", isSolid: false, isAir: true };
dim.getBlock = ({ y }) => y === 69 ? terra : ar;
const container = (p) => p.getComponent("minecraft:inventory").container;
const pergaminho = () => new ItemStack(tp.ITEM_PERGAMINHO);
const novo = () => {
  const p = jogador();
  p.dimension = dim;
  p.location = { ...seguro };
  container(p).setItem(0, pergaminho());
  return p;
};
const tick = (n) => { for (let i = 0; i < n; i++) executarIntervalos(1); };

test("salva coordenadas pessoais reais, preserva a ficha sem item e limita a dez destinos", () => {
  const a = novo(), b = novo();
  a.getRotation = () => ({ x: 10, y: -50 });
  for (let i = 0; i < 10; i++) assert.equal(tp.salvarDestinoAtual(a, "Casa " + i), undefined);
  container(a).setItem(1, pergaminho());
  assert.equal(tp.salvarDestinoAtual(a, "Extra"), "Você atingiu o limite de dez destinos. Exclua uma localização para continuar.");
  assert.deepEqual(tp.listarDestinos(a)[0], { v: 1, id: 1, nome: "Casa 0", dim: dim.id, pos: seguro, rot: { x: 10, y: -50 } });
  assert.equal(tp.renomearDestino(a, 1, "  Casa nova "), undefined);
  assert.equal(tp.listarDestinos(a)[0].nome, "Casa nova");
  assert.match(tp.renomearDestino(a, 1, "§aInválido"), /formatação/);
  assert.equal(tp.excluirDestino(a, 2), undefined);
  assert.equal(tp.salvarDestinoAtual(a, "Uma nova"), undefined);
  assert.equal(tp.listarDestinos(a).at(-1).id, 11);
  container(a).setItem(0, undefined);
  container(a).setItem(1, undefined);
  container(b).setItem(0, pergaminho());
  assert.equal(tp.listarDestinos(b).length, 0);
  assert.equal(tp.listarDestinos(a).length, 10);
  assert.match(tp.iniciarTeleportePessoal(a, 1), /inventário/);
  world.afterEvents.playerSpawn.emit({ player: a, initialSpawn: false });
  assert.equal(tp.listarDestinos(a).length, 10);
  a.desconectar();
  assert.equal(tp.listarDestinos(jogador("Retorno", a.dinamicos)).length, 10);
});

test("rejeita dimensões, estados, registros e regiões incompatíveis", () => {
  const p = novo();
  assert.equal(tp.salvarDestinoAtual(p, "Casa"), undefined);
  p.dimension = world.getDimension("minecraft:nether");
  assert.match(tp.iniciarTeleportePessoal(p, 1), /outra dimensão/);
  assert.equal(tp.listarDestinos(p).length, 1);
  p.dimension = world.getDimension("kny:estudio");
  assert.match(tp.salvarDestinoAtual(p, "Estúdio"), /protegida/);
  p.dimension = dim;
  p.addTag("kny_finalizando");
  assert.match(tp.iniciarTeleportePessoal(p, 1), /indisponível/);
  p.removeTag("kny_finalizando");
  p.setDynamicProperty("kny:h_combate_ate", Date.now() + 4000);
  assert.match(tp.iniciarTeleportePessoal(p, 1), /combate/);
  p.setDynamicProperty("kny:h_combate_ate", undefined);
  world.setDynamicProperty("kny:h_locais", JSON.stringify({ v: 1, castelo: {}, acessos: {}, bloqueios: {
    vila: { a: { ...seguro, dim: dim.id }, b: { ...seguro, dim: dim.id } },
  } }));
  p.location = { ...origem };
  assert.match(tp.iniciarTeleportePessoal(p, 1), /protegida/);
  p.location = { ...seguro };
  assert.match(tp.salvarDestinoAtual(p, "Vila"), /protegida/);
  world.setDynamicProperty("kny:h_locais", undefined);
  p.setDynamicProperty("kny:pergaminho_destinos", "{");
  assert.match(tp.salvarDestinoAtual(p, "Outra"), /registro/);
  assert.equal(p.getDynamicProperty("kny:pergaminho_destinos"), "{");
});

test("prepara por cem ticks, protege viagens simultâneas e permite reutilizar logo após chegar", () => {
  const a = novo(), b = novo();
  const giros = [];
  const tpOriginal = a.tryTeleport;
  a.tryTeleport = function(pos, op) { giros.push(op.rotation); return tpOriginal.call(this, pos, op); };
  a.getRotation = () => ({ x: 10, y: 80 });
  assert.equal(tp.salvarDestinoAtual(a, "Duas portas"), undefined);
  b.location = { ...seguro, z: seguro.z + 20 };
  assert.equal(tp.salvarDestinoAtual(b, "Outro abrigo"), undefined);
  a.location = { ...origem };
  b.location = { ...origem };
  assert.equal(tp.iniciarTeleportePessoal(a, 1), undefined);
  assert.equal(tp.iniciarTeleportePessoal(b, 1), undefined);
  assert.match(tp.iniciarTeleportePessoal(a, 1), /término/);
  a.getRotation = () => ({ x: -30, y: 5 });
  tick(99);
  assert.deepEqual(a.location, origem);
  assert.deepEqual(b.location, origem);
  tick(1);
  assert.deepEqual(a.location, seguro);
  assert.deepEqual(b.location, { ...seguro, z: seguro.z + 20 });
  assert.deepEqual(giros, [{ x: 10, y: 80 }]);
  assert.equal(container(a).getItem(0).typeId, tp.ITEM_PERGAMINHO);
  assert.equal(tp.iniciarTeleportePessoal(a, 1), undefined);
  a.desconectar();
});

test("interrompe preparação sob dano, movimento, perda do item ou alterações do destino", () => {
  for (const [alterar, mensagem] of [
    [(p) => { p.location.x += 0.55; }, /moveu/],
    [(p) => { container(p).setItem(0, undefined); }, /inventário/],
    [(p) => world.afterEvents.entityHurt.emit({ hurtEntity: p, damage: 1, damageSource: {} }), /dano/],
    [(p) => { p.setDynamicProperty("kny:estudio_origem", JSON.stringify({ v: 1 })); p.setProperty("kny:cc_edicao", true); }, /personalização/],
    [(p) => { p.location = { ...origem }; dim.getBlock = () => ar; }, /insegura/],
    [(p) => { p.dimension = world.getDimension("minecraft:nether"); }, /dimensão/],
  ]) {
    const p = novo();
    assert.equal(tp.salvarDestinoAtual(p, "Casa"), undefined);
    p.location = { ...origem };
    assert.equal(tp.iniciarTeleportePessoal(p, 1), undefined);
    alterar(p);
    tick(100);
    assert.notDeepEqual(p.location, seguro);
    assert.match(p.mensagens.at(-1), mensagem);
    dim.getBlock = ({ y }) => y === 69 ? terra : ar;
    p.desconectar();
  }
});

test("carrega somente o ponto, libera o recurso e limpa a reserva quando o jogador se desconecta", async () => {
  const original = dim.isChunkLoaded;
  const ativos = new Map();
  const vistos = [];
  let carregar = true;
  world.tickingAreaManager = {
    hasTickingArea: (k) => ativos.has(k),
    hasCapacity: () => true,
    async createTickingArea(k, { from, to }) {
      vistos.push({ from, to });
      ativos.set(k, from);
    },
    removeTickingArea: (k) => ativos.delete(k),
  };
  system.waitTicks ??= (n) => new Promise((r) => system.runTimeout(r, n));
  try {
    for (const desconectar of [false, true]) {
      const p = novo();
      dim.isChunkLoaded = () => true;
      assert.equal(tp.salvarDestinoAtual(p, "Distante"), undefined);
      p.location = { ...origem };
      carregar = !desconectar;
      dim.isChunkLoaded = () => carregar && ativos.size > 0;
      assert.equal(tp.iniciarTeleportePessoal(p, 1), undefined);
      tick(100);
      if (desconectar) p.desconectar();
      await executarAgendados();
      assert.deepEqual(p.location, desconectar ? origem : seguro);
      assert.equal(ativos.size, 0);
    }
    assert.deepEqual(vistos, Array.from({ length: 2 }, () => ({ from: seguro, to: seguro })));
  } finally {
    dim.isChunkLoaded = original;
  }
});
