import { BlockVolume, GameMode, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { CHAVE_ENTRADA } from "./character_system.js";
import { carregarArea, comPontoCarregado, descarregarArea } from "./missoes_arenas.js";
import {
  ITEM_PERGAMINHO, TICKS_PREPARACAO, iniciarTeleportePessoal, listarDestinos, salvarDestinoAtual,
} from "./pergaminho_teleporte.js";

const log = (msg) => console.warn("KNY-TEST PERGAMINHO " + msg);
const espera = (n) => system.waitTicks(n);
const DESTINOS = "kny:pergaminho_destinos";
const CHECKPOINT = "kny:teste_v86_ficha_pergaminho";
const localA = { x: 52.5, y: 210, z: 62.5 };
const localB = { x: 56.5, y: 210, z: 62.5 };
const perto = { x: 54.5, y: 210, z: 70.5 };
const distante = { x: 4096.5, y: 210, z: 64.5 };
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { assert(a === b, `${msg} (${a} em vez de ${b})`); }
async function ate(cond, msg, ticks = 100) {
  for (let i = 0; i < ticks; i++) {
    if (cond()) return;
    await espera(1);
  }
  throw new Error(msg);
}

const estoque = (p) => p.getComponent("minecraft:inventory").container;
function jogador(dim, nome, pos) {
  const p = spawnSimulatedPlayer({ ...pos, dimension: dim }, nome, GameMode.Survival);
  p.addTag("start");
  p.addTag("slayer");
  p.addTag("kny_escolheu");
  p.setDynamicProperty(CHAVE_ENTRADA, "v78");
  p.teleport(pos, { dimension: dim, keepVelocity: false });
  p.selectedSlotIndex = 0;
  estoque(p).setItem(0, new ItemStack(ITEM_PERGAMINHO));
  return p;
}

function capturarMenu(p) {
  const telas = new WeakMap();
  const visto = [];
  const title = ActionFormData.prototype.title;
  const button = ActionFormData.prototype.button;
  const show = ActionFormData.prototype.show;
  ActionFormData.prototype.title = function (titulo) {
    telas.set(this, { titulo, botoes: [] });
    return title.call(this, titulo);
  };
  ActionFormData.prototype.button = function (rotulo, ...args) {
    telas.get(this)?.botoes.push(rotulo.replace(/§./g, ""));
    return button.call(this, rotulo, ...args);
  };
  ActionFormData.prototype.show = function (q) {
    if (q.id !== p.id) return show.call(this, q);
    visto.push(telas.get(this));
    return Promise.resolve({ canceled: true, cancelationReason: "UserClosed" });
  };
  return visto;
}

async function testar() {
  const dimension = world.getDimension("overworld");
  dimension.runCommand("time set day");
  dimension.runCommand("gamerule doDaylightCycle false");
  dimension.runCommand("gamerule doMobSpawning false");
  const piso = new BlockVolume({ x: 48, y: 209, z: 56 }, { x: 63, y: 209, z: 75 });
  await carregarArea("kny_teste_pergaminho", { dimension, from: piso.from, to: piso.to });
  try { dimension.fillBlocks(piso, "minecraft:stone"); }
  finally { descarregarArea("kny_teste_pergaminho"); }
  const fichaSalva = world.getDynamicProperty(CHECKPOINT);
  if (typeof fichaSalva === "string") {
    // O GameTest cria outro perfil ao iniciar. A cópia de ensaio veio do disco do mundo anterior.
    const p = jogador(dimension, "PergaminhoReinicio", localB);
    p.setDynamicProperty(DESTINOS, fichaSalva);
    await espera(5);
    eq(listarDestinos(p)?.[0]?.nome, "Estação longe", "leitura da ficha gravada antes do reinício");
    eq(iniciarTeleportePessoal(p, 1), undefined, "uso do destino recarregado");
    await ate(() => distancia(p.location, distante) < 0.5, "chegada ao destino gravado antes do reinício", 175);
    log("REINICIO OK");
    return;
  }
  const a = jogador(dimension, "PergaminhoA", localA);
  const b = jogador(dimension, "PergaminhoB", localB);
  await espera(5);
  const telas = capturarMenu(a);
  assert(a.useItemInSlot(0), "uso nativo do item do pergaminho");
  await ate(() => telas.length > 0, "o item abre o formulário");
  a.stopUsingItem();
  assert(telas[0].titulo.startsWith("kny_miss|"), "o formulário reutiliza o tema Kimetsu");
  for (const nome of ["Destinos: 0/10", "Meus destinos", "Salvar localização atual", "Gerenciar localizações", "Informações", "Fechar"]) {
    assert(telas[0].botoes.some((x) => x.includes(nome)), "formulário com " + nome);
  }
  a.teleport(perto, { dimension, rotation: { x: 10, y: 45 } });
  eq(salvarDestinoAtual(a, "Estação perto"), undefined, "salva posição próxima");
  eq(await comPontoCarregado("kny_teste_ponto_distante", dimension, distante, () => {
    dimension.getBlock({ ...distante, y: distante.y - 1 }).setType("minecraft:stone");
    b.teleport(distante, { dimension });
    return salvarDestinoAtual(b, "Estação longe");
  }), undefined, "salva posição distante");
  a.teleport(localA, { dimension });
  b.teleport(localB, { dimension });
  await espera(10);
  eq(listarDestinos(a)[0].nome, "Estação perto", "destino individual A");
  eq(listarDestinos(b)[0].nome, "Estação longe", "destino individual B");
  const inicio = system.currentTick;
  eq(iniciarTeleportePessoal(a, 1), undefined, "iniciar A");
  eq(iniciarTeleportePessoal(b, 1), undefined, "iniciar B simultaneamente");
  a.setRotation({ x: 0, y: 90 });
  await espera(TICKS_PREPARACAO - 2);
  assert(distancia(a.location, localA) < 0.4 && distancia(b.location, localB) < 0.4, "sem viagem antecipada no tick " + (system.currentTick - inicio));
  await ate(() => distancia(a.location, perto) < 0.5 && distancia(b.location, distante) < 0.5, "os dois jogadores chegaram aos próprios destinos", 75);
  eq(estoque(a).getItem(0)?.typeId, ITEM_PERGAMINHO, "pergaminho A reutilizável");
  eq(estoque(b).getItem(0)?.typeId, ITEM_PERGAMINHO, "pergaminho B reutilizável");
  assert(!world.tickingAreaManager.hasTickingArea("kny_pergaminho_2"), "a reserva distante foi liberada");
  log("item nativo, contagem de cem ticks, uso simultâneo, destinos pessoais e chegada OK");

  a.teleport(localA, { dimension });
  eq(iniciarTeleportePessoal(a, 1), undefined, "nova preparação sem recarga");
  a.teleport({ ...localA, x: localA.x + 1 }, { dimension });
  await espera(4);
  eq(iniciarTeleportePessoal(a, 1), undefined, "movimento cancelou a viagem anterior");
  estoque(a).setItem(0, undefined);
  await espera(3);
  estoque(a).setItem(0, new ItemStack(ITEM_PERGAMINHO));
  eq(iniciarTeleportePessoal(a, 1), undefined, "perda do item cancelou a preparação anterior");
  a.applyDamage(1, { cause: "override" });
  await espera(4);
  assert(iniciarTeleportePessoal(a, 1)?.includes("combate"), "dano cancelou a preparação e bloqueia reentrada em combate");
  const salvo = b.getDynamicProperty(DESTINOS);
  b.applyDamage(9999, { cause: "override" });
  await espera(2);
  assert(b.respawn(), "respawn real após a morte simulada");
  await espera(12);
  eq(b.getDynamicProperty(DESTINOS), salvo, "destino mantido após respawn");
  eq(listarDestinos(b)[0].nome, "Estação longe", "destino validado após respawn");
  world.setDynamicProperty(CHECKPOINT, salvo);
  log("cancelamentos por movimento, dano e perda do item, bloqueio em combate e persistência após morte OK");
  log("FIM");
}

system.runTimeout(() => testar().catch((erro) => console.error("KNY-TEST FALHA PERGAMINHO " + erro + "\n" + erro.stack)), 35);
