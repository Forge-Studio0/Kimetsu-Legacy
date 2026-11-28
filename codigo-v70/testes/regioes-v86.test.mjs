import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { jogador, world } from "./simulador.mjs";

registerHooks({
  resolve(specifier, context, next) {
    if (["@minecraft/server", "@minecraft/server-ui"].includes(specifier)) {
      return { shortCircuit: true, url: new URL("./simulador.mjs", import.meta.url).href };
    }
    return next(specifier, context);
  },
});
const dir = pathToFileURL(resolve(process.env.KIMETSU_BP ?? "Kimetsu Fix Be", "scripts") + "/");
const { regiaoPermiteRecurso } = await import(new URL("regioes_v86.js", dir));
const { guardarPersonagem, identificador, gravarJson } = await import(new URL("hybrid_records.js", dir));
const OW = "minecraft:overworld";
const PONTO = { x: 30, y: 80, z: 30 };
const CHAVE = "kny:h_locais";

test("spawn e pergaminho respeitam dimensões, bloqueios e portais registrados", () => {
  const p = jogador("RegiaoV86");
  const pode = (uso, dim = OW, pos = PONTO) => regiaoPermiteRecurso(p, dim, pos, uso);
  assert.equal(pode("spawn"), true);
  assert.equal(pode("spawn", "minecraft:nether"), false);
  assert.equal(pode("pergaminho", "minecraft:nether"), true);
  assert.equal(pode("pergaminho", "minecraft:the_end"), true);
  for (const dim of ["kny:missoes", "kny:estudio", "kny:administracao"]) {
    assert.equal(pode("spawn", dim), false);
    assert.equal(pode("pergaminho", dim), false);
  }
  const config = {
    v: 1, castelo: { entrada: { dim: OW, x: 50, y: 80, z: 30 } },
    acessos: { vila: { saida: { dim: OW, x: 80, y: 80, z: 30 } } },
    bloqueios: { treino: {
      a: { dim: OW, x: 20, y: 70, z: 20 }, b: { dim: OW, x: 40, y: 85, z: 40 },
    } },
  };
  gravarJson(world, CHAVE, config);
  for (const uso of ["spawn", "pergaminho"]) {
    assert.equal(pode(uso), false);
    assert.equal(pode(uso, OW, { ...PONTO, x: 52 }), false);
    assert.equal(pode(uso, OW, { ...PONTO, x: 83 }), false);
    assert.equal(pode(uso, OW, { ...PONTO, x: 84 }), true);
  }
  p.addTag("demon");
  guardarPersonagem(p, {
    v: 1, id: identificador(p), raca: "hibrido", estado: "ativo",
    resp: "water", arte: "enmu", publico: "oni", formas: 10, noCastelo: true,
  });
  assert.equal(pode("pergaminho", OW, { ...PONTO, x: 84 }), false);
  world.setDynamicProperty(CHAVE, "registro inválido");
  assert.equal(pode("spawn"), false);
  world.setDynamicProperty(CHAVE, undefined);
});
