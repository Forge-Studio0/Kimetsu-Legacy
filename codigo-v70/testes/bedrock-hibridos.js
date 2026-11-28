import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { ESPECIAIS, RESP_H_ID } from "./hybrid_config.js";
import { atribuirAprendizado, dominioHumano, registrarTreinoRespiracao } from "./hybrid_mastery.js";
import { tarefasDaForma } from "./treino_respiracao.js";
import { getTrueRace, racaHibrida, revelar, transformar, trocarDisfarce } from "./hybrid_system.js";
import { administrarPoder, ativarHabilidade, habilidadeDe } from "./hybrid_abilities.js";
import { configurarLocal, viajar } from "./hybrid_locations.js";
import { expostoAoSol } from "./hybrid_sun.js";
import { guardarPersonagem, hibridosRegistrados } from "./hybrid_records.js";
import { getScore, patenteDe, pontuar, statusAtributo } from "./stats.js";
import { ATR, HIBRIDO_SUPERIOR, OBJ_LIDER, OBJ_REI, REI_ONI } from "./stats_config.js";

const wait = (n) => system.waitTicks(n);
const log = (msg) => console.warn("[HIBRIDOS-TESTE] " + msg);
const eq = (a, b, msg) => { if (a !== b) throw new Error(msg + " (" + a + " != " + b + ")"); };
const dim = () => world.getDimension("overworld");
const checkpoint = "kny:h_teste_prova";
let serial = 0;

function spawn(name, x = 52, z = 58) {
  const pos = { x: x + 0.5, y: 210, z: z + 0.5 };
  const p = spawnSimulatedPlayer({ ...pos, dimension: dim() }, name + (++serial), GameMode.Survival);
  p.runCommand(`fill ${x - 1} 209 ${z - 1} ${x + 1} 209 ${z + 1} stone`);
  p.teleport(pos);
  return p;
}
async function esperarInicio(p) {
  for (let i = 0; i < 30 && !p.hasTag("start"); i++) await wait(2);
  eq(p.hasTag("start"), true, "Inicialização do jogador pelo controlador");
  await wait(2);
}
function holder(p, nome) {
  const o = world.scoreboard.getObjective(nome) ?? world.scoreboard.addObjective(nome);
  for (const antigo of o.getParticipants()) o.removeParticipant(antigo);
  o.setScore(p.name, 1);
}
function item(p, id, slot = 0) {
  p.getComponent("minecraft:inventory").container.setItem(slot, id ? new ItemStack(id, 1) : undefined);
  p.selectedSlotIndex = 0;
}
function aprender(lider, p) {
  p.addTag("slayer");
  p.addTag("kny_escolheu");
  pontuar(p, "upslayer", 120);
  const agua = RESP_H_ID.get("water");
  item(p, agua.item);
  for (let i = 1; i <= agua.formas.length; i++) {
    eq(atribuirAprendizado(lider, p, agua.obj, i), undefined, "Atribuir forma " + i);
    for (const { tipo, meta } of tarefasDaForma(agua.obj, i)) registrarTreinoRespiracao(p, tipo, meta);
    eq(dominioHumano(p, agua.obj), i, "Domínio " + i);
  }
}
function ficha(p) {
  const d = racaHibrida(p);
  if (!d) throw new Error("Híbrido ativo esperado");
  return d;
}

async function uso(p, tipo, placar) {
  item(p, tipo);
  pontuar(p, placar, 1);
  pontuar(p, "kny_exausto", 0);
  pontuar(p, "kny_folego", 100);
  await wait(2);
  const iniciado = p.useItemInSlot(0);
  await wait(8);
  p.stopUsingItem();
  return { iniciado, folego: getScore(p, "kny_folego") };
}

async function executar() {
  if (world.getDynamicProperty(checkpoint)) {
    const anterior = JSON.parse(world.getDynamicProperty(checkpoint));
    const row = hibridosRegistrados().find((r) => r.id === anterior.id);
    eq(row?.resp, "water", "índice sobrevive ao reinício");
    const staff = spawn("StaffReinicio");
    staff.addTag("kny_op");
    eq(administrarPoder(staff, "atribuir", "carapaca", anterior.id).includes("já possui"), true, "exclusividade offline após reinício");
    await wait(3);
    staff.disconnect();
    log("REINICIO índice e titularidade offline persistiram");
    return;
  }
  dim().runCommand("time set midnight");
  dim().runCommand("gamerule dodaylightcycle false");
  dim().runCommand("gamerule domobspawning false");
  dim().runCommand("gamerule naturalregeneration false");
  dim().runCommand("weather clear");
  const lider = spawn("LiderH", 49, 58);
  await esperarInicio(lider);
  lider.runCommand("fill 48 209 55 62 209 62 stone");
  eq(dim().getBlock({ x: 49, y: 209, z: 58 })?.isSolid, true, "piso do Líder");
  lider.teleport({ x: 49.5, y: 210, z: 58.5 });
  lider.addTag("kny_escolheu");
  lider.addTag("slayer");
  lider.addTag("hashira");
  lider.addTag("hashira_lider");
  holder(lider, OBJ_LIDER);
  const rei = spawn("ReiH", 50, 61);
  await esperarInicio(rei);
  rei.addTag("demon");
  rei.addTag("kny_muzan");
  holder(rei, OBJ_REI);
  const p = spawn("AprendizH");
  await esperarInicio(p);
  aprender(lider, p);
  eq(transformar(p, "rei", rei).hibrido, true, "transformação legítima");
  await wait(4);
  eq(p.matches({ families: ["player_demon"] }), true, "família Oni");
  eq(p.matches({ families: ["slayer"] }), false, "sem família humana junto");
  eq(patenteDe(p), HIBRIDO_SUPERIOR, "patente Híbrido Superior ao transformar");
  eq(getScore(p, "updemon"), 0, "sem maldição exigida nem concedida");
  eq(statusAtributo(p, ATR.for).limite, 68, "novo teto de Força");
  eq(p.getComponent("minecraft:health").effectiveMax, 48, "teto de vida sem investimento");
  eq(patenteDe(rei), REI_ONI, "Rei titular conserva a maior patente");
  eq(ficha(p).resp, "water", "respiração original persistida");
  eq(ficha(p).arte, "enmu", "arte inicial");
  eq(p.getProperty("kny:h_resp"), RESP_H_ID.get("water").codigo, "código autoritativo entregue aos controladores");
  trocarDisfarce(p, "cacador");
  await wait(4);
  eq(p.matches({ families: ["slayer"] }), true, "disfarce aplica família caçador");
  eq(p.matches({ families: ["player_demon"] }), false, "família antiga removida");
  eq(patenteDe(p), HIBRIDO_SUPERIOR, "disfarce preserva Stats");
  revelar(p);
  await wait(4);
  eq(p.matches({ families: ["kny_hybrid"] }), true, "forma revelada");
  log("transformação, patente e famílias dos três disfarces");

  const aprovado = spawn("SangueH", 56, 58);
  await esperarInicio(aprovado);
  aprender(lider, aprovado);
  item(aprovado, "kny:blood");
  eq(aprovado.useItemInSlot(0), true, "item de sangue inicia uso nativo");
  await wait(8);
  aprovado.stopUsingItem();
  eq(getTrueRace(aprovado), "hibrido", "caminho de sangue");
  eq(getScore(aprovado, "blood"), 1, "dose aplicada uma vez");
  eq(aprovado.getComponent("minecraft:inventory").container.getItem(0), undefined, "sangue consumido");
  aprovado.runCommand("function blood");
  await wait(3);
  eq(getScore(aprovado, "blood"), 1, "repetição sem sangue sem recompensa");
  aprovado.teleport({ x: 78, y: 210, z: 58 });
  aprovado.runCommand("fill ~-5 ~-1 ~-5 ~5 ~-1 ~5 stone");
  pontuar(aprovado, "kf_thunder", 6);
  const outra = await uso(aprovado, "kny:nichirin_thunder", "thunder");
  eq(outra.folego, 100, "respiração não original bloqueada mesmo com placar");
  const agua = await uso(aprovado, "kny:nichirin_water", "water");
  eq(agua.iniciado, true, "ativação nativa da água");
  if (agua.folego >= 100) throw new Error("Controlador da Água não cobrou fôlego");
  eq(ficha(aprovado).publico, "revelado", "revelou antes da forma permitida");
  const biwa = await uso(aprovado, "kny:biwa", "biwa");
  eq(biwa.folego, 100, "arte fora do vínculo bloqueada");
  const enmu = await uso(aprovado, "kny:enmu_hand", "enmu");
  if (enmu.folego >= 100) throw new Error("Controlador da arte de Enmu não cobrou fôlego");
  log("controladores bloquearam Trovão e biwa, executaram Água e Enmu e revelaram a identidade");
  aprovado.disconnect();
  const comum = spawn("SangueComum");
  comum.addTag("slayer");
  comum.addTag("hashira");
  pontuar(comum, "kf_water", 10);
  item(comum, "kny:blood");
  eq(transformar(comum, "sangue", comum, { destino: "oni" }).ok, true, "Oni comum confirmado");
  await wait(4);
  eq(getTrueRace(comum), "oni", "pontuação histórica não concedeu Híbrido");
  comum.disconnect();
  log("sangue legítimo, duplicação e Hashira sem aulas");

  const staff = spawn("StaffH", 61, 58);
  await esperarInicio(staff);
  staff.addTag("kny_op");
  const id = ficha(p).id;
  eq(administrarPoder(staff, "atribuir", "carapaca", id).includes("salva"), true, "atribuição");
  pontuar(p, "kny_folego", 100);
  pontuar(p, "kny_stam", 100);
  eq(ativarHabilidade(p), undefined, "carapaça ativada");
  eq(habilidadeDe(p).id, "carapaca", "dono correto");
  eq(getScore(p, "kny_folego"), 100 - ESPECIAIS.carapaca.folego, "gasto");
  await wait(82);
  eq(p.getProperty("kny:h_ocupado"), false, "efeito termina no prazo");

  eq(viajar(p)?.includes("não foi configurado"), true, "castelo fechado sem configuração");
  eq(configurarLocal(staff, ["castelo", "entrada"]).includes("salva"), true, "entrada");
  staff.runCommand("setblock 52 209 58 stone");
  staff.runCommand("fill 52 210 58 52 211 58 air");
  staff.teleport({ x: 52.5, y: 210, z: 58.5 });
  const saida = configurarLocal(staff, ["castelo", "saida"]);
  eq(saida, "Configuração de acesso salva.", "saída em " + JSON.stringify(staff.location));
  configurarLocal(staff, ["castelo", "tempos", "1", "10"]);
  eq(viajar(p), undefined, "preparação de viagem");
  await wait(28);
  eq(ficha(p).noCastelo, true, "viagem reconhecida");
  eq(Math.floor(p.location.x), 61, "destino real do mundo de teste");
  eq(viajar(p, "castelo", "saida")?.includes("recarga"), true, "cooldown de viagem");
  guardarPersonagem(p, { ...ficha(p), casteloAte: 0 });
  eq(viajar(p, "castelo", "saida"), undefined, "retorno configurado");
  await wait(28);
  eq(Math.floor(p.location.x), 52, "saída segura");
  log("habilidade atribuída, custo, recarga e ida e volta no castelo de teste");

  dim().runCommand("time set noon");
  await wait(2);
  eq(expostoAoSol(p), true, "céu aberto no motor");
  const vida = () => p.getComponent("minecraft:health").currentValue;
  const antes = vida();
  await wait(25);
  if (vida() >= antes) throw new Error("Sol não reduziu a vida do híbrido");
  p.runCommand("fill ~-1 ~3 ~-1 ~1 ~3 ~1 stone");
  await wait(2);
  eq(expostoAoSol(p), false, "sombra de teto");
  const sombra = vida();
  await wait(24);
  eq(vida(), sombra, "sombra interrompe dano");
  log("sol e sombra com dano real");

  world.setDynamicProperty(checkpoint, JSON.stringify({ id }));
  p.disconnect();
  lider.disconnect();
  rei.disconnect();
  staff.disconnect();
  log("FIM");
}

system.runTimeout(() => executar().catch((e) => log("FALHA " + e + "\n" + (e.stack ?? ""))), 40);
