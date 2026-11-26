import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { registrarAula, registrarTreinoRespiracao, requisitosProximaForma } from "./hybrid_mastery.js";
import { tarefasDaForma, treinosDaForma } from "./treino_respiracao.js";
import { comprar, disponiveis, pontuar, statusAtributo } from "./stats.js";
import { ATR, OBJ_LIDER } from "./stats_config.js";
import { RESP_H } from "./hybrid_config.js";

const wait = (ticks) => system.waitTicks(ticks);
const log = (texto) => console.warn("KNY-TEST TREINO " + texto);
const assert = (ok, mensagem) => { if (!ok) throw new Error(mensagem); };
const plano = new Map();
const botoes = new WeakMap();

function simularEscolhas() {
  const button = ActionFormData.prototype.button;
  const show = ActionFormData.prototype.show;
  ActionFormData.prototype.button = function (texto, ...args) {
    const itens = botoes.get(this) ?? [];
    itens.push(texto.replace(/§./g, ""));
    botoes.set(this, itens);
    return button.call(this, texto, ...args);
  };
  ActionFormData.prototype.show = function (p) {
    if (!plano.has(p.id)) return show.call(this, p);
    const escolha = plano.get(p.id).shift();
    if (!escolha) return Promise.resolve({ canceled: true, cancelationReason: "UserClosed" });
    const selection = botoes.get(this).findIndex((texto) => texto.includes(escolha));
    assert(selection >= 0, "Botão ausente " + escolha);
    return Promise.resolve({ canceled: false, selection });
  };
}

async function cacador(nome, pos, dimension) {
  const p = spawnSimulatedPlayer({ ...pos, dimension }, nome, GameMode.Survival);
  p.teleport(pos);
  for (let i = 0; i < 30 && !p.hasTag("start"); i++) await wait(2);
  assert(p.hasTag("start"), "Controlador de entrada incompleto");
  p.addTag("slayer");
  p.addTag("kny_escolheu");
  p.teleport(pos);
  await wait(6);
  return p;
}

const metros = (p, id, tipo) => treinosDaForma(p, id, 1).find((t) => t.tipo === tipo)?.atual ?? 0;

async function testar() {
  simularEscolhas();
  const dim = world.getDimension("overworld");
  dim.runCommand("time set midnight");
  dim.runCommand("gamerule dodaylightcycle false");
  dim.runCommand("gamerule domobspawning false");
  const pos = { x: 51.5, y: 210, z: 65.5 };
  const p = await cacador("TreinoV75", pos, dim);
  const lider = await cacador("LiderTreinoV75", { x: 52.5, y: 210, z: 62.5 }, dim);
  p.runCommand("fill 48 209 61 63 209 68 stone");
  assert(dim.getBlock({ x: 51, y: 209, z: 65 })?.isSolid, "Piso de teste indisponível");
  p.teleport(pos);
  lider.teleport({ x: 52.5, y: 210, z: 62.5 });
  await wait(6);
  lider.addTag("hashira");
  lider.addTag("hashira_lider");
  const titulares = world.scoreboard.getObjective(OBJ_LIDER) ?? world.scoreboard.addObjective(OBJ_LIDER);
  titulares.setScore(lider.name, 1);

  p.isSprinting = true;
  p.move(1, 0, 1);
  await wait(20);
  p.stopMoving();
  p.isSprinting = false;
  assert(metros(p, "thunder", "correr") > 0, "Corrida do jogador simulado sem progresso");

  p.teleport(pos);
  await wait(8);
  assert(p.isOnGround, "Base do pulo em " + JSON.stringify(p.location));
  assert(p.jump(), "O jogador simulado não conseguiu pular");
  await wait(12);
  assert(metros(p, "wind", "pular") === 1, "Pulo real sem progresso");

  dim.runCommand("fill 64 208 54 78 213 60 stone hollow");
  dim.runCommand("fill 65 209 55 77 212 59 water");
  p.teleport({ x: 66.5, y: 210, z: 57.5 });
  await wait(5);
  p.swim();
  p.isSprinting = true;
  p.move(1, 0, 1);
  await wait(20);
  p.stopMoving();
  p.isSprinting = false;
  assert(metros(p, "water", "nadar") > 0, "Natação sem progresso");
  log("corrida, pulo e natação medidos pelo motor");

  p.teleport(pos);
  await wait(6);
  const saldo = disponiveis(p);
  const oni = dim.spawnEntity("kny:demon", { x: 54.5, y: 210, z: 65.5 });
  oni.applyDamage(2000, { cause: "entityAttack", damagingEntity: p });
  await wait(4);
  assert(metros(p, "water", "oni") === 1, "Abate não entrou no treino da Água");
  assert(metros(p, "flame", "oni") === 1, "Abate não entrou em Chamas");
  assert(disponiveis(p) >= saldo + 250, "Recompensa de Stats do Oni não foi preservada");

  const dummy = dim.spawnEntity("kny:dummy_treino", { x: 53, y: 210, z: 65.5 });
  const estilo = RESP_H.find((r) => tarefasDaForma(r.obj, 1).some((t) => t.tipo === "dummy")).obj;
  assert(p.attackEntity(dummy), "O jogador simulado não golpeou o dummy");
  await wait(5);
  assert(metros(p, estilo, "dummy") === 1, "Golpe no dummy não entrou no treino");
  dummy.remove();

  pontuar(p, "upslayer", 120);
  const oferta = statusAtributo(p, ATR.def);
  assert(comprar(p, ATR.def, 10, oferta).feitas > 0, "Preparação do teto de Defesa");
  assert(statusAtributo(p, ATR.def).proximo === null, "Defesa fora do teto");
  const mochila = p.getComponent("minecraft:inventory").container;
  // Usa a entrada de menu do addon para isolar o exercício da simulação de combate.
  plano.set(p.id, ["Treinamento", "Flexão"]);
  p.runCommand("scriptevent kny:menu classico");
  await wait(49);
  assert(metros(p, "gyomei", "flexao") >= 1, "Flexão pelo menu com Defesa no teto");
  log("Oni, dummy e flexão pelo menu contados em paralelo");

  mochila.setItem(1, new ItemStack("kny:nichirin_water", 1));
  assert(!registrarAula(lider, p, "water", 1), "Aula aceitou progresso incompleto");
  for (const { tipo, meta } of tarefasDaForma("water", 1)) registrarTreinoRespiracao(p, tipo, meta);
  const antes = JSON.parse(p.getDynamicProperty("kny_req"));
  assert(registrarAula(lider, p, "water", 1), "Aula não aceitou treinos completos");
  const depois = JSON.parse(p.getDynamicProperty("kny_req"));
  assert(!depois["water:1"] && depois["flame:1"].oni === antes["flame:1"].oni, "Reset incorreto após a aula");
  assert(requisitosProximaForma(p, "water").treinos.every((t) => t.atual === 0), "A forma 2 herdou treinos da primeira");
  p.disconnect();
  lider.disconnect();
  log("FIM");
}

system.runTimeout(() => testar().catch((e) => console.error("KNY-TEST FALHA TREINO " + e + "\n" + e.stack)), 40);
