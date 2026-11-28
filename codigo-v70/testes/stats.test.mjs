import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { system, world, jogador, executarAgendados, executarIntervalos } from "./simulador.mjs";

const simulador = new URL("./simulador.mjs", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@minecraft/server" || specifier === "@minecraft/server-ui") {
      return { shortCircuit: true, url: simulador };
    }
    return nextResolve(specifier, context);
  },
});

const pack = resolve(process.env.KIMETSU_BP ?? "Kimetsu Fix Be");
const scripts = pathToFileURL(resolve(pack, "scripts") + "/");
const carregar = (nome) => import(new URL(nome, scripts));
const c = await carregar("stats_config.js");
const s = await carregar("stats.js");
const { guardarPersonagem, identificador } = await carregar("hybrid_records.js");
await carregar("menu.js");
await carregar("hud_painel.js");
const { ATR, ATRIBUTOS, HIBRIDO_SUPERIOR, REI_ONI, PATENTES, POR_PATENTE, CUSTOS, NIVEL_MAXIMO, LIMITE_SALDO } = c;

const componentesMenu = new Map();
system.beforeEvents.startup.emit({ dimensionRegistry: { registerCustomDimension() {} },
  itemComponentRegistry: {
    registerCustomComponent(id, component) { componentesMenu.set(id, component); },
  },
});
function usarMenu(p, nome = "menu_kimetsu", evento = "onUse") {
  const item = JSON.parse(readFileSync(resolve(pack, "items", nome + ".json"), "utf8"))["minecraft:item"];
  assert.equal(item.components["minecraft:interact_button"], "Abrir menu");
  const id = Object.keys(item.components).find((id) => componentesMenu.has(id));
  assert.ok(id, nome + " precisa da ação de uso registrada");
  componentesMenu.get(id)[evento]({ source: p, itemStack: { typeId: item.description.identifier } });
}

const DADOS = "kny:stats_v70";
const up = (p, a, vezes = 1) => s.comprar(p, a, vezes, s.statusAtributo(p, a));
const reset = (p) => s.resetarAtributos(p, s.chaveRedistribuicao(p));
const dados = (p) => JSON.parse(p.getDynamicProperty(DADOS));
const rank = (p, tag) => {
  const r = POR_PATENTE[tag];
  p.tags.clear();
  if (c.ePatenteOni(r)) p.addTag("demon");
  if (r === HIBRIDO_SUPERIOR) {
    guardarPersonagem(p, { v: 1, id: identificador(p), estado: "ativo", raca: "hibrido",
      resp: "water", formas: 10, arte: "enmu", publico: "oni" });
  } else if (!["oni", "humano"].includes(r.tag)) p.addTag(tag);
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

test("vinte e oito faixas, os cinco atributos, efeitos e tetos individuais", () => {
  assert.equal(PATENTES.length, 28);
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

test("a patente Híbrido Superior tem potencial intermediário entre Lua Superior 1 e Rei", () => {
  const lua = POR_PATENTE.upper1;
  for (const a of ATRIBUTOS) {
    assert.ok(lua.limites[a.id] < HIBRIDO_SUPERIOR.limites[a.id]);
    assert.ok(HIBRIDO_SUPERIOR.limites[a.id] < REI_ONI.limites[a.id]);
  }
  for (let sangue = 0; sangue <= c.MAX_MOVIMENTO_SANGUE; sangue++) {
    assert.ok(c.movimentoMax(lua, sangue) < c.movimentoMax(HIBRIDO_SUPERIOR, sangue));
    assert.ok(c.movimentoMax(HIBRIDO_SUPERIOR, sangue) < c.movimentoMax(REI_ONI, sangue));
  }
  assert.equal(c.vidaMax(HIBRIDO_SUPERIOR, HIBRIDO_SUPERIOR.limites.vid), 96);
  assert.equal(c.vidaMax(REI_ONI, REI_ONI.limites.vid), 100);
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
  usarMenu(p);
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
  usarMenu(p);
  await executarAgendados();
  assert.equal(s.efetivo(p, ATR.for), 6);
  assert.equal(s.disponiveis(p), 1250);
  up(p, ATR.vid, 5);
  p.getComponent("minecraft:health").setCurrentValue(22);
  executarIntervalos(5);
  assert.match(p.titulos.at(-1), /^HP22 QV050F100S100/);
});

test("os dois itens abrem uma sessão de menu e agachado abre o modo clássico", async () => {
  const p = novo({ tag: "upper6" });
  let responder;
  p.escolhas.push(() => new Promise((resolve) => { responder = resolve; }));
  usarMenu(p);
  usarMenu(p, "book_archievement", "onUseOn");
  await executarAgendados();
  assert.equal(p.telas.length, 1);
  assert.match(p.telas[0].titulo, /^kny_painel\|.*PAINEL DO ONI/);
  usarMenu(p);
  await executarAgendados();
  assert.equal(p.telas.length, 1);
  responder({ canceled: true, cancelationReason: "UserClosed" });
  await executarAgendados();
  p.isSneaking = true;
  usarMenu(p, "book_archievement");
  await executarAgendados();
  assert.equal(p.telas.length, 2);
  assert.match(p.telas[1].titulo, /MENU DO ONI/);
  assert.ok(p.hasTag("kny_cfg_classico"));
  assert.ok(!p.telas[1].buttons.some(({ texto }) => texto.includes("Alterar meu cargo")));
  p.desconectar();
});

test("outra tela aberta dá um aviso e a próxima tentativa de uso continua disponível", async () => {
  const p = novo();
  p.addTag("kny_escolheu");
  for (let i = 0; i < 12; i++) {
    p.escolhas.push(() => ({ canceled: true, cancelationReason: "UserBusy" }));
  }
  usarMenu(p);
  await executarAgendados();
  await executarAgendados();
  assert.equal(p.telas.length, 12);
  assert.equal(p.mensagens.filter((t) => /Feche o chat/.test(t)).length, 1);
  assert.ok(!p.hasTag("kny_cfg_classico"));
  usarMenu(p);
  await executarAgendados();
  assert.equal(p.telas.length, 13);
  assert.match(p.telas[12].titulo, /^kny_painel\|/);
  p.desconectar();
});

test("a troca entre painel e clássico vale também nos submenus e na próxima abertura", async () => {
  const p = novo();
  p.addTag("slayer");
  p.escolhas.push(
    (f) => ({ selection: f.buttons.findIndex(({ texto }) => texto === "R:Clássico") }),
    () => ({ selection: 1 }),
    (f) => {
      assert.doesNotMatch(f.titulo, /^kny_conf\|/);
      return { canceled: true, cancelationReason: "UserClosed" };
    },
  );
  usarMenu(p);
  await executarAgendados();
  assert.equal(p.telas.length, 3);
  assert.ok(p.hasTag("kny_cfg_classico"));
  p.escolhas.push(
    (f) => ({ selection: f.buttons.findIndex(({ texto }) => texto.includes("Menu em painel")) }),
  );
  usarMenu(p);
  await executarAgendados();
  assert.match(p.telas.at(-1).titulo, /^kny_painel\|/);
  assert.ok(!p.hasTag("kny_cfg_classico"));
  p.desconectar();
});

test("fechar o contrato libera o item e apenas o botão de assinar cria o Caçador", async () => {
  const p = jogador();
  p.addTag("start"); // personagem já inicializado, com contrato pendente
  const comandos = [];
  p.runCommand = (cmd) => { comandos.push(cmd); };
  p.escolhas.push(
    () => ({ canceled: true, cancelationReason: "UserClosed" }),
    () => ({ canceled: false, selection: 0 }),
    () => ({ canceled: false, selection: 1 }),
  );
  world.afterEvents.playerSpawn.emit({ player: p, initialSpawn: true });
  for (let i = 1; i <= 3; i++) {
    usarMenu(p);
    await executarAgendados();
    assert.equal(p.telas.length, i);
    assert.match(p.telas[i - 1].titulo, /^kny_ctr\|/);
    assert.equal(p.hasTag("kny_escolheu"), i === 3);
  }
  assert.deepEqual(comandos, ["function start_slayer"]);
  usarMenu(p);
  await executarAgendados();
  assert.match(p.telas.at(-1).titulo, /^kny_painel\|/);
  p.desconectar();
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
