import { BlockVolume, GameMode, ItemStack, system, world } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { carregarArea, descarregarArea } from "./missoes_arenas.js";
import { cicloSpawnNoturno } from "./spawn_noturno.js";
import { ONI_NATURAL, ONI_NATURAL_PROP } from "./spawn_noturno_config.js";
import { aprendizadoAtivo, atribuirAprendizado, progressoAprendizado } from "./hybrid_mastery.js";
import { CHAVE_ENTRADA } from "./character_system.js";
import { disponiveis, getScore, pontuar } from "./stats.js";
import { OBJ_LIDER } from "./stats_config.js";

const DIMENSAO = "minecraft:overworld";
const AREA = "kny_teste_spawn_noturno";
const log = (t) => console.warn("KNY-TEST SPAWN " + t);
const eq = (a, b, t) => { if (a !== b) throw new Error(`${t} (${a} != ${b})`); };
const assert = (ok, t) => { if (!ok) throw new Error(t); };

function rng(angulo = 0.5, sorteio = 0, raio = 0.1) {
  const fila = sorteio > 0.985 ? [0, sorteio, angulo, raio] : [0, sorteio, 0, angulo, raio];
  let i = 0;
  return () => i < fila.length ? fila[i++] : i++ % 2 ? angulo : raio;
}

function jogador(dim, nome, z) {
  const pos = { x: 512.5, y: 210, z };
  const p = spawnSimulatedPlayer({ ...pos, dimension: dim }, nome, GameMode.Survival);
  p.addTag("start");
  p.addTag("slayer");
  p.setDynamicProperty(CHAVE_ENTRADA, "v78");
  p.teleport(pos, { dimension: dim });
  return p;
}

async function testar() {
  const dim = world.getDimension(DIMENSAO);
  const from = { x: 480, y: 209, z: 508 };
  const to = { x: 548, y: 209, z: 519 };
  dim.runCommand("gamerule dodaylightcycle false");
  dim.runCommand("gamerule domobspawning false");
  dim.runCommand("difficulty normal");
  dim.runCommand("weather clear");
  await carregarArea(AREA, { dimension: dim, from, to });
  try {
    dim.fillBlocks(new BlockVolume(from, to), "minecraft:stone");
    const p = jogador(dim, "AlunoV86", 512.5);
    const q = jogador(dim, "LiderV86", 514.5);
    q.addTag("hashira_lider");
    pontuar(q, OBJ_LIDER, 1);
    p.getComponent("minecraft:inventory").container.setItem(0, new ItemStack("kny:nichirin_flame"));
    await system.waitTicks(2);
    eq(atribuirAprendizado(q, p, "flame", 1), undefined, "aprendizado de Chamas atribuído");

    const naturais = () => dim.getEntities({ tags: [ONI_NATURAL] }).filter((e) => e.isValid);
    dim.runCommand("gamerule domobspawning true");
    dim.runCommand("time set noon");
    eq(cicloSpawnNoturno(rng()), 0, "nenhum spawn expresso ao meio dia");
    dim.runCommand("time set midnight");
    eq(cicloSpawnNoturno(rng()), 1, "um surgimento para dois jogadores próximos");
    await system.waitTicks(1);
    const alvo = naturais()[0];
    eq(alvo?.typeId, "kny:demon", "tipo comum nativo");
    eq(alvo.getProperty(ONI_NATURAL_PROP), true, "propriedade natural sincronizada");
    const antes = disponiveis(p), honra = getScore(p, "upslayer"), honraLider = getScore(q, "upslayer");
    alvo.applyDamage(500, { cause: "entityAttack", damagingEntity: p });
    await system.waitTicks(4);
    eq(getScore(p, "upslayer"), honra + 1, "uma recompensa de honra");
    eq(getScore(q, "upslayer"), honraLider, "jogador próximo sem recompensa");
    eq(disponiveis(p), antes + 300, "uma recompensa de Stats mais espelho de Honra");
    const treino = progressoAprendizado(p, aprendizadoAtivo(p)).find((a) => a.tipo === "oni");
    eq(treino?.atual, 1, "uma baixa na missão de aprendizado");
    log("grupo, Stats, honra e aprendizado OK");

    eq(cicloSpawnNoturno(rng(0.5, 0.9852)), 1, "Lua Inferior sorteado");
    eq(cicloSpawnNoturno(rng(0, 0.988)), 0, "segundo Lua Inferior da mesma região bloqueado");
    const lua = naturais().find((e) => e.typeId === "kny:kamanue");
    assert(lua, "Kamanue existente");
    lua.remove();
    eq(cicloSpawnNoturno(rng()), 1, "Oni comum exposto");
    eq(cicloSpawnNoturno(rng(0)), 1, "Oni comum para o abrigo");
    const [exposto, coberto] = naturais().sort((a, b) => a.location.x - b.location.x);
    const centro = { x: 541, y: 214, z: 513 };
    dim.fillBlocks(new BlockVolume({ x: centro.x - 6, y: centro.y, z: centro.z - 5 },
      { x: centro.x + 6, y: centro.y, z: centro.z + 5 }), "minecraft:stone");
    for (const e of [exposto, coberto]) e.addEffect("slowness", 120, { amplifier: 7, showParticles: false });
    const vida = (e) => e.getComponent("minecraft:health")?.currentValue;
    const ab = vida(exposto), cb = vida(coberto);
    const pontos = disponiveis(p);
    dim.runCommand("time set noon");
    dim.runCommand("gamerule domobspawning false");
    await system.waitTicks(80);
    assert(exposto.isValid && vida(exposto) < ab, "Oni exposto perde vida ao sol sem execução instantânea");
    eq(vida(coberto), cb, "Oni protegido pelo telhado sobrevive");
    eq(disponiveis(p), pontos, "a limpeza sem abate não outorga prêmio");
    log("Lua Inferior, amanhecer e abrigo OK");
    for (const e of naturais()) e.remove();
    p.disconnect();
    q.disconnect();
  } finally {
    descarregarArea(AREA);
  }
  log("FIM");
}

system.runTimeout(() => testar().catch((e) => console.error("KNY-TEST FALHA SPAWN " + e + "\n" + e.stack)), 35);
