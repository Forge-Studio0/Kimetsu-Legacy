import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { jogador, system, world } from "./simulador.mjs";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@minecraft/server" || specifier === "@minecraft/server-ui") {
      return { shortCircuit: true, url: new URL("./simulador.mjs", import.meta.url).href };
    }
    return next(specifier, context);
  },
});

const dir = pathToFileURL(resolve(process.env.KIMETSU_BP ?? "Kimetsu Fix Be", "scripts") + "/");
const carregar = (n) => import(new URL(n + ".js", dir));
const [{ cicloSpawnNoturno, horarioNoturno, sortearOniNatural }, { ONI_NATURAL, ONI_NATURAL_PROP, SPAWN_NOTURNO },
  { gravarJson }, stats] = await Promise.all([
  carregar("spawn_noturno"), carregar("spawn_noturno_config"), carregar("hybrid_records"), carregar("stats"), carregar("menu"),
]);

const OW = "minecraft:overworld";
const p = jogador("Explorador");
const q = jogador("Companheiro");
const origem = { x: 0.5, y: 70, z: 0.5 };
const ar = { typeId: "minecraft:air", isAir: true, isSolid: false };
const pedra = { typeId: "minecraft:stone", isAir: false, isSolid: true };
const pisoPlano = ({ y }) => y === 69 ? pedra : ar;
const dim = world.getDimension(OW);
let hora, entidades, novoId;
let solo = 0;
const natural = (e) => e.hasTag(ONI_NATURAL);

function mob(tipo, pos, tags = []) {
  const atuais = new Set(tags);
  const props = new Map();
  return {
    id: "oni:" + ++novoId, typeId: tipo, location: pos, dimension: dim, isValid: true,
    addTag(tag) { atuais.add(tag); return true; },
    hasTag: (tag) => atuais.has(tag),
    setProperty: (prop, valor) => props.set(prop, valor),
    getProperty: (prop) => props.get(prop),
    remove() { this.isValid = false; },
  };
}

function preparar() {
  novoId = 1000 * ++solo;
  hora = 18000;
  entidades = [];
  p.dimension = dim;
  q.dimension = dim;
  p.location = origem;
  q.location = { ...origem, z: 2.5 };
  p.getViewDirection = q.getViewDirection = () => ({ x: 0, y: 0, z: 1 });
  Object.assign(dim, {
    heightRange: { min: -64, max: 320 },
    getPlayers: () => [p, q].filter((j) => j.dimension === dim),
    getEntities: () => entidades.filter((e) => e.isValid),
    getBlock: pisoPlano,
    isChunkLoaded: () => true,
    spawnEntity(tipo, pos) {
      const e = mob(tipo, pos);
      entidades.push(e);
      return e;
    },
  });
  world.gameRules = { doMobSpawning: true };
  world.getDifficulty = () => "Normal";
  world.getTimeOfDay = () => hora;
  world.setDynamicProperty("kny:h_locais", undefined);
  cicloSpawnNoturno(() => 0.99); // Libera o estado temporário entre cenários.
}

function rng({ lua, angulo = 0.5, raio = 0 } = {}) {
  const fila = lua === undefined ? [0, 0, 0, angulo, raio] : [0, lua, angulo, raio];
  let i = 0;
  return () => i < fila.length ? fila[i++] : i++ % 2 ? angulo : raio;
}

test("janela noturna e pesos exatos das seis Luas sem Superiores", () => {
  assert.deepEqual([12999, 13000, 23000, 23001].map(horarioNoturno), [false, true, true, false]);
  const contagem = {};
  for (let i = 0; i < 10000; i++) {
    const desenho = [(i + 0.5) / 10000, 0];
    const tipo = sortearOniNatural(() => desenho.shift());
    contagem[tipo] = (contagem[tipo] ?? 0) + 1;
  }
  assert.deepEqual(contagem, {
    "kny:demon": 9850, "kny:kamanue": 45, "kny:rui": 35, "kny:mukago": 25,
    "kny:wakuraba": 20, "kny:rokuro": 15, "kny:enmu": 10,
  });
  for (const [i, tipo] of ["kny:demon", "kny:tongue_demon", "kny:tsunodemon", "kny:hebidemon"].entries()) {
    const valores = [0, (i + 0.5) / 4];
    assert.equal(sortearOniNatural(() => valores.shift()), tipo);
  }
});

test("multiplayer compartilha tentativa, distâncias e limites locais", () => {
  preparar();
  for (const angulo of [0, 0.25, 0.5, 0.75]) {
    assert.equal(cicloSpawnNoturno(rng({ angulo, raio: 0.2 })), 1);
  }
  assert.equal(cicloSpawnNoturno(rng({ raio: 0.35 })), 0);
  assert.equal(entidades.length, 4);
  for (const e of entidades) {
    assert.equal(natural(e), true);
    assert.equal(e.getProperty(ONI_NATURAL_PROP), true);
    assert.ok([p, q].every((j) => Math.hypot(e.location.x - j.location.x, e.location.z - j.location.z) >= 24));
  }
  assert.equal(cicloSpawnNoturno(rng({ lua: 0.9852, raio: 0.6 })), 1);
  assert.equal(cicloSpawnNoturno(rng({ lua: 0.988, raio: 0.7 })), 0);
  assert.equal(entidades.at(-1).typeId, "kny:kamanue");
});

test("limites globais só contam atores naturais, densidade considera atores existentes", () => {
  preparar();
  for (let i = 0; i < 40; i++) entidades.push(mob("kny:demon", { ...origem, x: 500 + i * 10 }, [ONI_NATURAL]));
  assert.equal(cicloSpawnNoturno(rng()), 0);
  entidades[0].remove();
  assert.equal(cicloSpawnNoturno(rng()), 1);
  entidades.push(...[1, 2].map((i) => mob("kny:rui", { ...origem, x: 750 + i * 10 }, [ONI_NATURAL])));
  assert.equal(cicloSpawnNoturno(rng({ lua: 0.9852, raio: 0.45 })), 0);

  preparar();
  for (let i = 0; i < 4; i++) entidades.push(mob("kny:demon", { ...origem, z: 50 + i }));
  assert.equal(cicloSpawnNoturno(rng()), 0);
  entidades[0].addTag("kny_missao_ator");
  assert.equal(cicloSpawnNoturno(rng()), 1);
  assert.equal(entidades[0].isValid, true);
});

test("dia, dimensões, proteção, chunks e pisos inválidos bloqueiam o spawn", () => {
  preparar();
  hora = 12000;
  assert.equal(cicloSpawnNoturno(rng()), 0);
  hora = 18000;
  p.dimension = q.dimension = world.getDimension("minecraft:nether");
  assert.equal(cicloSpawnNoturno(rng()), 0);
  p.dimension = q.dimension = dim;
  const canto = (x, y, z) => ({ x, y, z, dim: OW });
  gravarJson(world, "kny:h_locais", { v: 1, acessos: {}, castelo: {}, bloqueios: {
    teste: { a: canto(-70, 71, -70), b: canto(70, 71, 70) },
  } });
  assert.equal(cicloSpawnNoturno(rng()), 0, "a caixa de colisão entra na região pela altura da cabeça");
  world.setDynamicProperty("kny:h_locais", undefined);
  dim.isChunkLoaded = () => false;
  assert.equal(cicloSpawnNoturno(rng()), 0);
  dim.isChunkLoaded = () => true;
  dim.getBlock = () => ar;
  assert.equal(cicloSpawnNoturno(rng()), 0);
  dim.getBlock = ({ y }) => y === 69 ? { ...pedra, typeId: "minecraft:magma" } : ar;
  assert.equal(cicloSpawnNoturno(rng()), 0);
  dim.getBlock = () => pedra;
  assert.equal(cicloSpawnNoturno(rng()), 0);
  dim.getBlock = pisoPlano;
  world.gameRules.doMobSpawning = false;
  assert.equal(cicloSpawnNoturno(rng()), 0);
  world.gameRules.doMobSpawning = true;
  world.getDifficulty = () => "Peaceful";
  assert.equal(cicloSpawnNoturno(rng()), 0);
});

test("abandono remove só naturais distantes depois da espera, sem interferir no amanhecer", () => {
  preparar();
  hora = 12000;
  const local = { ...origem, x: 130 };
  const distante = mob("kny:demon", local, [ONI_NATURAL]);
  const administrativo = mob("kny:demon", local);
  const missao = mob("kny:demon", local, [ONI_NATURAL, "kny_missao_ator"]);
  const perto = mob("kny:demon", origem, [ONI_NATURAL]);
  entidades.push(distante, administrativo, missao, perto);
  cicloSpawnNoturno(rng());
  system.currentTick += SPAWN_NOTURNO.esperaLimpeza;
  world.afterEvents.entityHurt.emit({ hurtEntity: distante, damageSource: { damagingEntity: p } });
  cicloSpawnNoturno(rng());
  assert.equal(distante.isValid, true);
  system.currentTick += SPAWN_NOTURNO.janelaCombate + 1;
  cicloSpawnNoturno(rng());
  system.currentTick += SPAWN_NOTURNO.esperaLimpeza;
  cicloSpawnNoturno(rng());
  assert.equal(distante.isValid, false);
  assert.ok([administrativo, missao, perto].every((e) => e.isValid));
});

test("apenas o autor legítimo recebe Stats, honra e marcos dos naturais", () => {
  preparar();
  p.addTag("slayer");
  p.addTag("hashira");
  const comum = mob("kny:demon", origem, [ONI_NATURAL]);
  const evento = { deadEntity: comum, damageSource: { damagingEntity: p, cause: "entityAttack" } };
  const antes = stats.disponiveis(p);
  const vizinho = stats.disponiveis(q);
  world.afterEvents.entityDie.emit(evento);
  world.afterEvents.entityDie.emit(evento);
  assert.equal(stats.getScore(p, "upslayer"), 1);
  assert.equal(stats.getScore(p, "killer"), 1);
  assert.equal(stats.disponiveis(p), antes + 250 + 50);
  assert.equal(stats.disponiveis(q), vizinho);

  const marcadoPorMissao = mob("kny:demon", origem, [ONI_NATURAL, "kny_missao_ator"]);
  const outro = mob("kny:demon", origem, [ONI_NATURAL]);
  world.afterEvents.entityDie.emit({ ...evento, deadEntity: marcadoPorMissao });
  world.afterEvents.entityHurt.emit({ hurtEntity: outro, damageSource: { damagingEntity: p } });
  world.afterEvents.entityDie.emit({ deadEntity: outro, damageSource: { cause: "override" } });
  assert.equal(stats.getScore(p, "killer"), 1);
  assert.equal(stats.disponiveis(p), antes + 300);

  q.addTag("demon");
  const lua = mob("kny:kamanue", origem, [ONI_NATURAL]);
  const projetil = { isValid: true, getComponent: () => ({ owner: q }) };
  world.afterEvents.entityDie.emit({ deadEntity: lua, damageSource: { cause: "projectile", damagingProjectile: projetil } });
  assert.equal(stats.getScore(q, "updemon"), 10);
  assert.equal(q.hasTag("blood6"), true);
});
