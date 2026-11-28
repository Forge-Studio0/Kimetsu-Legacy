import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { jogador, world } from "./simulador.mjs";

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
const [cat, arena, grupo, sessoes, stats, rank, aprendizado, records] = await Promise.all([
  carregar("missoes_catalogo"), carregar("missoes_arenas"), carregar("missoes_grupos"), carregar("missoes_sessoes"),
  carregar("stats"), carregar("stats_config"), carregar("hybrid_mastery"), carregar("hybrid_records"),
]);

test("catálogo usa patentes verdadeiras e configuração de dificuldade por facção", () => {
  assert.equal(cat.CATALOGO_MISSOES.length, 21);
  for (const m of cat.CATALOGO_MISSOES) {
    assert.ok(cat.patenteMinima(m), m.id);
    assert.ok(cat.patenteValida(m, cat.patenteMinima(m)));
    assert.equal(cat.patenteValida(m, rank.HUMANO), false);
    assert.ok(!m.anterior || cat.MISSAO_ID.has(m.anterior));
  }
  assert.equal(cat.patenteValida(cat.MISSAO_ID.get("akaza"), rank.RANKS_CACADOR[0]), false);
  assert.equal(cat.patenteValida(cat.MISSAO_ID.get("hibrido_lua"), rank.HIBRIDO_SUPERIOR), true);
  assert.equal(cat.patenteValida(cat.MISSAO_ID.get("hibrido_lua"), rank.RANKS_ONI.at(-2)), false);
  const p = jogador("OniPatentes");
  p.addTag("demon");
  p.addTag("kny_hibrido_superior");
  assert.match(sessoes.impedimentoMissao(p, cat.MISSAO_ID.get("hibrido_nevoa")), /linhagem/);
  assert.match(sessoes.impedimentoMissao(p, cat.MISSAO_ID.get("oni_chamas")), /Patente/);
});

test("arena confere região, pontos, dificuldade, capacidade e reforços", () => {
  const ponto = (x, z) => ({ x, y: 70, z });
  const m = cat.MISSAO_ID.get("ronda");
  const a = {
    id: "inferior", nome: "Arena de teste", dim: arena.DIM_ARENAS, ativa: true, capacidade: 3,
    a: ponto(0, 0), b: { x: 15, y: 80, z: 15 }, saida: { dim: "minecraft:overworld", pos: ponto(80, 80) },
    entradas: [ponto(1, 1), ponto(2, 1), ponto(3, 1)],
    spawns: [ponto(1, 7), ponto(2, 7), ponto(3, 7), ponto(4, 7), ponto(5, 7)],
    tipos: ["abates"], ranks: ["D", "C"], missoes: [],
  };
  assert.equal(arena.erroArena(a, []), undefined);
  assert.equal(arena.arenaCompativel(a, m, 3, []), true);
  assert.equal(arena.arenaCompativel(a, m, 4, []), false);
  assert.equal(arena.arenaCompativel({ ...a, ativa: false }, m, 1, []), false);
  assert.equal(arena.arenaCompativel({ ...a, ranks: ["S"] }, m, 1, []), false);
  assert.equal(arena.arenaCompativel({ ...a, spawns: a.spawns.slice(1) }, m, 3, []), false);
  assert.match(arena.erroArena({ ...a, a: ponto(1000, 1) }, []), /48/);
  assert.match(arena.erroArena({ ...a, objetivo: a.spawns[0] }, []), /diferentes/);
  assert.match(arena.erroArena(a, [{ ...a, id: "contigua" }]), /Separe/);
  assert.match(arena.erroArena({ ...a, tipos: ["local"] }, []), /Associe/);
});

test("convite é explícito, expira e a lista fica fechada durante uma sessão", () => {
  const p = jogador("ConviteA");
  const q = jogador("ConviteB");
  const g = grupo.criarGrupo(p);
  assert.equal(grupo.convidar(p, q), undefined);
  assert.equal(grupo.grupoDe(q), undefined);
  assert.equal(grupo.responderConvite(q, false), undefined);
  assert.equal(g.membros.size, 1);
  assert.equal(grupo.convidar(p, q), undefined);
  const convite = grupo.convitePendente(q);
  convite.ate = 0;
  assert.match(grupo.responderConvite(q, true, convite), /expirou/);
  assert.equal(grupo.convidar(p, q), undefined);
  assert.equal(grupo.responderConvite(q, true), undefined);
  assert.equal(g.membros.size, 2);
  g.sessao = 1;
  assert.equal(grupo.sairDoGrupo(q), false);
  assert.match(grupo.convidar(p, jogador("ConviteC")), /não pode/);
});

test("distribuição executa a proporção 40/60 com preservação dos inteiros", () => {
  assert.deepEqual(sessoes.ratear(10000, [70, 30]), [6200, 3800]);
  assert.deepEqual(sessoes.ratear(5, [1, 1, 1, 1]), [2, 1, 1, 1]);
  assert.deepEqual(sessoes.ratear(500, [1]), [500]);
  assert.deepEqual(sessoes.ratear(500, []), []);
});

test("repetição do pagamento e falha de placar não duplicam saldo nem maldição", () => {
  const p = jogador("Tesouraria");
  p.addTag("demon");
  const antes = stats.disponiveis(p);
  stats.pontuar(p, "kny_dinheiro", 25);
  const placar = world.scoreboard.getObjective("kny_dinheiro");
  const set = placar.setScore;
  placar.setScore = () => { throw new Error("Falha no espelho"); };
  const valores = { pontos: 500, patente: 5, dinheiro: 100 };
  assert.throws(() => stats.creditarMissao(p, 15, valores, "oni"), /Falha no espelho/);
  placar.setScore = set;
  p.desconectar();
  const q = jogador(p.name, p.dinamicos);
  q.addTag("demon");
  const pago = stats.creditarMissao(q, 15, valores, "oni");
  assert.deepEqual(pago, { pontos: 500, bonus: 250, patente: 5, dinheiro: 100 });
  assert.deepEqual(stats.creditarMissao(q, 15, valores, "oni"), pago);
  assert.equal(stats.getScore(q, "upslayer"), 0);
  assert.equal(stats.getScore(q, "updemon"), 5);
  assert.equal(stats.getScore(q, "kny_dinheiro"), 125);
  assert.equal(stats.disponiveis(q), antes + 750);
});

test("título muda após a atribuição e o progresso antigo espera uma autorização", () => {
  const lider = jogador("Anterior");
  const aluno = jogador("Aprendiz");
  const novo = jogador("Novo");
  for (const p of [lider, aluno, novo]) p.addTag("slayer");
  lider.addTag("hashira_lider");
  novo.addTag("hashira_lider");
  const placar = world.scoreboard.addObjective(rank.OBJ_LIDER);
  placar.setScore(lider.name, 1);
  aluno.setDynamicProperty("kny_req", JSON.stringify({ "water:1": { nadar: 50, oni: 2 } }));
  assert.match(aprendizado.atribuirAprendizado(lider, aluno, "sun", 1), /espada/);
  assert.match(aprendizado.atribuirAprendizado(lider, aluno, "water", 1), /espada/);
  aluno.getComponent("minecraft:inventory").container.setItem(1, { typeId: "kny:nichirin_water" });
  assert.equal(aprendizado.atribuirAprendizado(lider, aluno, "water", 1), undefined);
  const m = aprendizado.aprendizadoAtivo(aluno);
  assert.equal(aprendizado.cancelarAprendizado(novo, m.aluno, m.id, "sem permissão"), false);
  placar.removeParticipant(lider.name);
  placar.setScore(novo.name, 1);
  assert.equal(aprendizado.cancelarAprendizado(aluno, m.aluno, m.id, "cancelada"), true);
  aprendizado.registrarTreinoRespiracao(aluno, "oni", 1);
  assert.equal(aprendizado.dominioHumano(aluno, "water"), 0);
  assert.equal(aprendizado.atribuirAprendizado(novo, aluno, "water", 1), undefined);
  aprendizado.registrarTreinoRespiracao(aluno, "oni", 1);
  assert.equal(aprendizado.dominioHumano(aluno, "water"), 1);
  assert.match(aprendizado.atribuirAprendizado(novo, aluno, "water", 2), /10 de honra/);
  assert.equal(records.lerJson(aluno, records.CHAVE_DOMINIO).aulas.water[0][0], "humano:missao");
});
