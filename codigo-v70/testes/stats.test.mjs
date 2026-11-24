import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { world, jogador, executarAgendados, executarIntervalos } from "./simulador.mjs";

const simulador = new URL("./simulador.mjs", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@minecraft/server" || specifier === "@minecraft/server-ui") {
      return { shortCircuit: true, url: simulador };
    }
    return nextResolve(specifier, context);
  },
});

const scripts = pathToFileURL(resolve(process.env.KIMETSU_BP ?? "Kimetsu Fix Be", "scripts") + "/");
const carregar = (nome) => import(new URL(nome, scripts));
const c = await carregar("stats_config.js");
const s = await carregar("stats.js");
await carregar("menu.js");
await carregar("hud_painel.js");
const { ATR, ATRIBUTOS, PATENTES, POR_PATENTE, CUSTOS, NIVEL_MAXIMO, LIMITE_SALDO } = c;

const DADOS = "kny:stats_v70";
const up = (p, a, vezes = 1) => s.comprar(p, a, vezes, s.statusAtributo(p, a));
const reset = (p) => s.resetarAtributos(p, s.chaveRedistribuicao(p));
const dados = (p) => JSON.parse(p.getDynamicProperty(DADOS));
const rank = (p, tag) => {
  const r = POR_PATENTE[tag];
  p.tags.clear();
  if (c.ePatenteOni(r)) p.addTag("demon");
  if (!["oni", "humano"].includes(r.tag)) p.addTag(tag);
  if (r.unico) {
    const obj = c.ePatenteOni(r) ? c.OBJ_REI : c.OBJ_LIDER;
    const o = world.scoreboard.getObjective(obj) ?? world.scoreboard.addObjective(obj);
    for (const titular of o.getParticipants()) o.removeParticipant(titular);
    o.setScore(p.name, 1);
  }
};
const custeio = (n) => Array.from({ length: n }, (_, i) => c.custoMelhoria(i)).reduce((a, b) => a + b, 0);
const novo = ({ saldo, tag = "mizunoto", atributos = {}, ...outros } = {}) => {
  const p = jogador();
  rank(p, tag);
  if (saldo !== undefined) s.pontuar(p, "kny_pts", saldo);
  for (const [obj, n] of Object.entries({ ...atributos, ...outros })) s.pontuar(p, obj, n);
  s.atualizarStats(p);
  return p;
};

test("documento de custos: 18 transições obrigatórias e entradas inválidas", () => {
  const exemplos = [
    [0, 100], [4, 100], [5, 250], [9, 250], [10, 500], [15, 1000], [20, 2500],
    [25, 5000], [30, 10000], [35, 25000], [40, 50000], [45, 100000], [50, 150000],
    [55, 200000], [60, 300000], [65, 500000], [69, 500000], [70, null],
  ];
  for (const [nivel, esperado] of exemplos) assert.equal(c.custoMelhoria(nivel), esperado);
  for (const invalido of [-1, NaN, Infinity, 0.5, "5", null, 71]) assert.equal(c.custoMelhoria(invalido), null);
  assert.equal(CUSTOS.length, 14);
  for (let n = 45; n < 70; n++) assert.ok(c.custoMelhoria(n) >= 100000);
});

test("saldo inicial, saldo exato, um abaixo, um acima, zero e níveis independentes", () => {
  const p = novo();
  assert.equal(s.disponiveis(p), 500);
  assert.equal(up(p, ATR.for, 5).gasto, 500);
  assert.equal(up(p, ATR.def).motivo, "saldo");
  assert.equal(up(p, ATR.for).motivo, "limite");
  assert.equal(up(p, ATR.pod, 0).motivo, "indisponivel");
  assert.equal(up(p, ATR.pod, Infinity).motivo, "indisponivel");
  assert.equal(up(p, ATR.pod, -2).motivo, "indisponivel");
  for (const saldo of [99, 100, 101]) {
    const alvo = novo({ saldo });
    const r = up(alvo, ATR.for);
    assert.equal(r.motivo, saldo < 100 ? "saldo" : "ok");
    assert.equal(s.disponiveis(alvo), saldo < 100 ? 99 : saldo - 100);
    assert.equal(s.statusAtributo(alvo, ATR.vid).custo, 100);
  }
});

test("vinte e sete faixas, os cinco atributos, efeitos e tetos individuais", () => {
  assert.equal(PATENTES.length, 27);
  for (const r of PATENTES) {
    assert.equal(Math.max(...Object.values(r.limites)), r.geral);
    const p = novo({ tag: r.tag, saldo: 45000000 });
    assert.equal(s.patenteDe(p), r);
    for (const a of ATRIBUTOS) {
      assert.equal(s.statusAtributo(p, a).limite, r.limites[a.id]);
      assert.equal(up(p, a, 100).gasto, custeio(r.limites[a.id]));
      assert.equal(s.statusAtributo(p, a).proximo, null);
      assert.equal(s.statusAtributo(p, a).nivel, r.limites[a.id]);
      assert.equal(up(p, a).motivo, "limite");
    }
    assert.equal(p.getComponent("minecraft:health").effectiveMax, c.vidaMax(r, r.limites.vid));
    assert.equal(s.staminaDe(p).max, c.staminaMax(r.limites.sta));
    assert.equal(s.folegoDe(p).max, c.folegoMax(r.limites.pod));
    p.desconectar();
  }
});

test("legado pago e treino antigo contam para o preço; excesso é histórico", () => {
  const p = novo({ tag: "hashira", saldo: 900000, kny_mig7: 1,
    atributos: { kny_nf: 85, kny_tf: 10, kny_np: 20, kny_tp: 10, kny_nd: -3, kny_pf: 250000 } });
  const original = p.getDynamicProperty(DADOS);
  assert.equal(s.efetivo(p, ATR.for), 30);
  assert.equal(s.efetivo(p, ATR.pod), 30);
  assert.equal(s.efetivo(p, ATR.def), 0);
  assert.equal(dados(p).migracao.atributos.for.nivel, 85);
  assert.equal(reset(p).pontos, 0);
  s.atualizarStats(p);
  assert.equal(p.getDynamicProperty(DADOS), original);
  rank(p, "hashira_lider");
  s.atualizarStats(p);
  assert.equal(s.efetivo(p, ATR.for), 30);
  assert.equal(s.statusAtributo(p, ATR.pod).custo, 10000);
  assert.equal(up(p, ATR.for, 5).gasto, 50000);
  world.scoreboard.getObjective(c.OBJ_LIDER).removeParticipant(p.name);
  p.addTag("hashira");
  p.addTag("kny_muzan");
  assert.equal(s.patenteDe(p).tag, "hashira");
  s.atualizarStats(p);
  assert.equal(s.efetivo(p, ATR.for), 30);
  assert.equal(reset(p).pontos, 0);
  rank(p, "hashira_lider");
  assert.equal(s.efetivo(p, ATR.for), 35);
  assert.equal(reset(p).pontos, 50000);
  assert.equal(s.efetivo(p, ATR.for), 30);
  assert.equal(s.disponiveis(p), 900000);
});

test("redistribuição devolve compras ativas e as suspensas não ocupam suas vagas", () => {
  const p = novo({ tag: "upper1", saldo: 10000000 });
  assert.equal(up(p, ATR.for, 65).gasto, custeio(65));
  rank(p, "upper6");
  assert.equal(reset(p).pontos, custeio(40));
  assert.equal(s.efetivo(p, ATR.for), 0);
  assert.equal(up(p, ATR.for).gasto, 100);
  rank(p, "upper1");
  assert.equal(s.efetivo(p, ATR.for), 26);
  assert.equal(s.statusAtributo(p, ATR.for).custo, 5000);
  assert.equal(reset(p).pontos, custeio(65) - custeio(40) + 100);
  assert.equal(s.disponiveis(p), 10000000);
});

test("treino só dá crédito de até 40% e o reembolso é pelo preço líquido", () => {
  const p = novo({ tag: "upper4", saldo: 60000, kny_mig7: 1, atributos: { kny_nf: 45 } });
  const a = ATR.for;
  assert.equal(s.statusAtributo(p, a).custo, 100000);
  for (let n = 0; n < 5; n++) s.registrarRepeticao(p, a);
  assert.equal(s.statusAtributo(p, a).custo, 80000);
  for (let n = 0; n < 5; n++) s.registrarRepeticao(p, a);
  assert.equal(s.efetivo(p, a), 45);
  assert.equal(s.statusAtributo(p, a).custo, 60000);
  assert.equal(s.registrarRepeticao(p, a).motivo, "credito");
  assert.equal(up(p, a).gasto, 60000);
  assert.equal(s.efetivo(p, a), 46);
  assert.equal(s.statusAtributo(p, a).custo, 100000);
  assert.equal(reset(p).pontos, 60000);
  assert.equal(s.statusAtributo(p, a).custo, 100000);
});

test("ofertas antigas, repetição de confirmação e falhas não geram compra ou devolução duplicada", () => {
  const p = novo();
  const a = ATR.for;
  const antiga = s.statusAtributo(p, a);
  p.falharGravacao = DADOS;
  assert.throws(() => s.comprar(p, a, 1, antiga), /falha de gravação/);
  assert.equal(s.efetivo(p, a), 0);
  assert.equal(s.disponiveis(p), 500);
  p.falharGravacao = undefined;
  assert.equal(s.comprar(p, a, 1, antiga).motivo, "ok");
  assert.equal(s.comprar(p, a, 1, antiga).motivo, "desatualizado");
  const chave = s.chaveRedistribuicao(p);
  assert.equal(s.resetarAtributos(p, chave).pontos, 100);
  assert.equal(s.resetarAtributos(p, chave).motivo, "desatualizado");
  assert.equal(s.comprar(p, a, 1, antiga).motivo, "desatualizado");
  const tela = s.statusAtributo(p, a);
  rank(p, "mizunoe");
  assert.equal(s.comprar(p, a, 1, tela).motivo, "desatualizado");
  p.desconectar();
  assert.equal(s.comprar(p, a, 1, tela).motivo, "indisponivel");
});

test("economia e raça: maior marca por origem, sangue sem nível grátis e limite do placar", () => {
  const p = novo({ tag: "oni", saldo: 0 });
  s.pontuar(p, "updemon", 10);
  s.atualizarStats(p);
  assert.equal(s.disponiveis(p), 500);
  s.pontuar(p, "updemon", 1);
  s.atualizarStats(p);
  s.pontuar(p, "updemon", 10);
  s.atualizarStats(p);
  assert.equal(s.disponiveis(p), 500);
  s.registrarRankAdministrativo(p, "updemon", 250);
  s.pontuar(p, "updemon", 250);
  s.atualizarStats(p);
  assert.equal(s.disponiveis(p), 500);
  assert.equal(s.premiarOni(p, "kny:demon"), 250);
  assert.equal(s.premiarOni(p, "kny:rui"), 2500);
  assert.equal(s.premiarOni(p, "kny:gyokko"), 25000);
  assert.equal(s.premiarOni(p, "kny:muzan"), 75000);
  assert.equal(s.premiarOni(p, "minecraft:zombie"), 0);
  s.pontuar(p, "blood", 6);
  s.atualizarStats(p);
  assert.equal(s.statusAtributo(p, ATR.vid).custo, 60);
  assert.equal(s.efetivo(p, ATR.vid), 0);
  p.addTag("hashira_lider");
  p.addTag("upper6");
  assert.equal(s.patenteDe(p).tag, "upper6");
  p.removeTag("demon");
  p.addTag("slayer");
  assert.equal(s.patenteDe(p).tag, "mizunoto");
  const rico = novo({ saldo: LIMITE_SALDO });
  assert.equal(up(rico, ATR.for).gasto, 100);
  assert.equal(s.premiarOni(rico, "kny:muzan"), 0);
  assert.equal(reset(rico).pontos, 100);
  assert.equal(s.disponiveis(rico), LIMITE_SALDO);
});

test("reconexão e instância nova do script preservam ficha e saldo e não reexecutam a migração", async () => {
  const p = novo();
  assert.equal(up(p, ATR.pod).gasto, 100);
  const salvo = p.getDynamicProperty(DADOS);
  p.desconectar();
  const q = jogador(p.name, p.dinamicos);
  rank(q, "mizunoto");
  const novoModulo = await carregar("stats.js?restart=1");
  novoModulo.atualizarStats(q);
  assert.equal(novoModulo.efetivo(q, ATR.pod), 1);
  assert.equal(novoModulo.disponiveis(q), 400);
  assert.equal(q.getDynamicProperty(DADOS), salvo);
  q.desconectar();
});

test("registros incompatíveis não ganham saldo ou nível e são preservados", () => {
  const p = jogador();
  const original = '{"versao":99,"atributos":{}}';
  p.setDynamicProperty(DADOS, original);
  s.atualizarStats(p);
  assert.equal(s.disponiveis(p), 0);
  assert.equal(up(p, ATR.vid).motivo, "indisponivel");
  assert.equal(p.getDynamicProperty(DADOS), original);
  p.desconectar();
});

test("fluxos públicos de compra do menu clássico e do painel, cancelamento e HUD", async () => {
  const p = novo({ tag: "mizunoe", saldo: 2000 });
  p.addTag("kny_escolheu");
  p.addTag("kny_cfg_classico");
  p.escolhas.push(
    () => ({ selection: 5 }),
    (form) => {
      assert.match(form.corpo, /Mizunoe/);
      assert.match(form.corpo, /2\.000/);
      assert.match(form.corpo, /0\/6/);
      return { selection: 1 };
    },
    (form) => {
      assert.match(form.corpo, /Nível 1: 100 pts/);
      return { selection: 3 };
    },
    (form) => {
      assert.match(form.corpo, /5\/6/);
      assert.match(form.corpo, /Nível 6: 250 pts/);
      return { canceled: true };
    },
  );
  world.afterEvents.itemUse.emit({ source: p, itemStack: { typeId: "kny:menu_kimetsu" } });
  await executarAgendados();
  assert.equal(s.efetivo(p, ATR.for), 5);
  assert.equal(s.disponiveis(p), 1500);
  p.removeTag("kny_cfg_classico");
  p.escolhas.push(
    (form) => {
      assert.match(form.titulo, /^kny_painel\|/);
      const forca = form.buttons.findIndex((b) => b.texto.startsWith("L:§fForça"));
      assert.ok(forca >= 0);
      assert.match(form.buttons[forca].texto, /Nível 6: 250 pts/);
      return { selection: forca };
    },
    (form) => {
      assert.ok(form.buttons.some(({ texto }) => /6\/6 — MAX/.test(texto)));
      return { canceled: true };
    },
  );
  executarIntervalos(10);
  world.afterEvents.itemUse.emit({ source: p, itemStack: { typeId: "kny:menu_kimetsu" } });
  await executarAgendados();
  assert.equal(s.efetivo(p, ATR.for), 6);
  assert.equal(s.disponiveis(p), 1250);
  up(p, ATR.vid, 5);
  p.getComponent("minecraft:health").setCurrentValue(22);
  executarIntervalos(5);
  assert.match(p.titulos.at(-1), /^HP22 QV050F100S100/);
});

test("golpe da v69 modificado uma vez e causas de finalização preservadas", () => {
  const a = novo({ tag: "hashira", saldo: 200000 });
  const b = novo({ tag: "upper6", saldo: 200000 });
  up(a, ATR.for, 15);
  up(a, ATR.pod, 12);
  up(b, ATR.def, 18);
  a.item = { typeId: "kny:nichirin_water" };
  const normal = { damage: 20, hurtEntity: b, damageSource: { cause: "entityAttack", damagingEntity: a } };
  world.beforeEvents.entityHurt.emit(normal);
  const esperado = 20 * (1 + (c.efeitoForca(15) + c.efeitoPoder(12)) / 100) * (1 - c.reducaoDefesa(18));
  assert.equal(normal.damage, esperado);
  const queda = { ...normal, damage: 9999, damageSource: { cause: "override", damagingEntity: a } };
  world.beforeEvents.entityHurt.emit(queda);
  assert.equal(queda.damage, 9999);
});
