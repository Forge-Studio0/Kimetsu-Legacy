import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { system, world, jogador, executarAgendados, executarIntervalos } from "./simulador.mjs";

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
const [{ H, RESP_H_ID, ESPECIAIS }, dominio, sistema, registros, poderes, locais, sol, stats, { OBJ_LIDER, OBJ_REI, ATR }] = await Promise.all([
  carregar("hybrid_config"), carregar("hybrid_mastery"), carregar("hybrid_system"), carregar("hybrid_records"),
  carregar("hybrid_abilities"), carregar("hybrid_locations"), carregar("hybrid_sun"), carregar("stats"), carregar("stats_config"),
]);
await carregar("menu");
await carregar("hybrid_admin");
const staff = jogador("Staff");
staff.addTag("kny_op");
const lider = jogador("Professor");
for (const t of ["slayer", "hashira", "hashira_lider"]) lider.addTag(t);
world.scoreboard.addObjective(OBJ_LIDER).setScore(lider.name, 1);
const rei = jogador("Rei");
rei.addTag("demon");
rei.addTag("kny_muzan");
world.scoreboard.addObjective(OBJ_REI).setScore(rei.name, 1);
let clima = "Clear";
let hora = 6000;
let cobertura;
let parede = false;
const dim = {
  id: "minecraft:overworld",
  getWeather: () => clima,
  getTopmostBlock: () => cobertura,
  getBlock: ({ y }) => y < 70 ? { isSolid: true, typeId: "minecraft:stone" } : { isAir: true },
  getBlockFromRay: () => parede ? {} : undefined,
  isChunkLoaded: () => true,
  getEntities: () => [],
  spawnParticle() {},
};
world.getTimeOfDay = () => hora;
world.getDimension = () => dim;
staff.dimension = lider.dimension = rei.dimension = dim;
function cacador({ hashira = false, resp = "water", nome } = {}) {
  const p = jogador(nome);
  p.dimension = dim;
  p.addTag("slayer");
  if (hashira) p.addTag("hashira");
  stats.pontuar(p, "upslayer", 120);
  p.getComponent("minecraft:inventory").container.setItem(1, { typeId: RESP_H_ID.get(resp).item });
  return p;
}
function mestre(resp = "water", op = {}) {
  const p = cacador({ resp, ...op });
  const grupo = RESP_H_ID.get(resp);
  for (let k = 1; k <= grupo.formas.length; k++) assert.ok(dominio.registrarAula(lider, p, resp, k), resp + " " + k);
  return p;
}
function hibrido() {
  const p = mestre();
  assert.deepEqual(sistema.transformar(p, "rei", rei), { ok: true, hibrido: true });
  return p;
}

const sangue = (p) => system.afterEvents.scriptEventReceive.emit({ id: "kny:h_sangue", sourceEntity: p, message: "beber" });
const comandoStaff = (p, message) => system.afterEvents.scriptEventReceive.emit({ id: "kny:h_staff", sourceEntity: p, message });
const abrirMenu = (p) => system.afterEvents.scriptEventReceive.emit({ id: "kny:menu", sourceEntity: p, message: "classico" });
const selecionar = (txt) => (f) => {
  const selection = f.buttons.findIndex((b) => b.texto.replace(/§./g, "").includes(txt));
  assert.ok(selection >= 0, txt + " em " + f.titulo);
  return { selection };
};

function oniV72(p) {
  const patente = stats.patenteDe(p).tag;
  p.removeTag("slayer");
  p.removeTag("hashira");
  p.addTag("kny_escolheu");
  p.addTag("demon");
  p.addTag("muzan_curse");
  stats.pontuar(p, "blood", 1);
  registros.guardarPersonagem(p, {
    v: 1, id: registros.identificador(p), estado: "ativo", raca: "oni", via: "sangue", doses: 1,
    anterior: { patente, honra: stats.getScore(p, "upslayer"), resp: null, formas: 0 },
  });
  return p;
}

test("patente e placares antigos não são provas. Hashira pode completar aulas reais", () => {
  const p = cacador({ hashira: true });
  stats.pontuar(p, "kf_water", 10);
  assert.equal(dominio.avaliarDominio(p).resp, undefined);
  assert.equal(dominio.registrarAula(p, p, "water", 1), false);
  assert.equal(dominio.registrarAula(lider, p, "water", 2), false);
  p.location.x = 20;
  assert.equal(dominio.registrarAula(lider, p, "water", 1), false);
  p.location.x = 0;
  for (let k = 1; k <= 10; k++) assert.equal(dominio.registrarAula(lider, p, "water", k), true);
  assert.equal(dominio.avaliarDominio(p).resp.obj, "water");
  assert.equal(stats.getScore(p, "kf_water"), 10);
  assert.equal(dominio.registrarAula(lider, p, "water", 10), false);
  assert.equal(sistema.transformar(p, "rei", rei).hibrido, true);
  assert.equal(p.hasTag("hashira"), false);
  assert.equal(stats.patenteDe(p).tag, "oni");
});

test("somente o Rei titular, a Staff autorizada ou o sangue legítimo iniciam a transformação", async () => {
  const p = cacador();
  const impostor = jogador();
  impostor.addTag("demon");
  impostor.addTag("kny_muzan");
  assert.equal(sistema.transformar(p, "rei", impostor).ok, false);
  assert.equal(sistema.transformar(p, "cargo", p).ok, false);
  assert.equal(sistema.transformar(p, "sangue").ok, false);
  assert.equal(dominio.registrarAula(lider, p, "water", 1), true);
  p.getComponent("minecraft:inventory").container.setItem(0, { typeId: "kny:blood", amount: 1 });
  p.escolhas.push(selecionar("Beber e virar Oni comum"));
  sangue(p);
  await executarAgendados();
  assert.equal(sistema.getTrueRace(p), "oni");
  assert.equal(stats.getScore(p, "blood"), 1);
  assert.equal(p.getComponent("minecraft:inventory").container.getItem(0), undefined);
  assert.equal(sistema.transformar(p, "sangue").ok, false);
  assert.equal(dominio.registrarAula(lider, p, "water", 2), false);
});

test("formas liberadas sem domínio ficam explícitas. Cancelar conserva a pilha e o personagem humano", async () => {
  const p = cacador({ hashira: true });
  executarIntervalos(40);
  assert.equal(stats.getScore(p, "kf_water"), 10);
  assert.equal(dominio.dominioHumano(p, "water"), 0);
  p.escolhas.push(selecionar("Respirações"));
  abrirMenu(p);
  await executarAgendados();
  assert.ok(p.telas.at(-1).buttons.some((b) => b.texto.includes("Liberadas 10/10 · Domínio 0/10")));
  p.escolhas.push(selecionar("Guia"), selecionar("Domínio humano"));
  abrirMenu(p);
  await executarAgendados();
  assert.match(p.telas.at(-1).corpo.replace(/§./g, ""), /Liberadas 10\/10 · Domínio\s+0\/10/);

  const c = p.getComponent("minecraft:inventory").container;
  c.setItem(0, { typeId: "kny:blood", amount: 3 });
  assert.equal(sistema.transformar(p, "sangue").ok, false);
  p.escolhas.push(selecionar("Continuar humano"));
  sangue(p);
  sangue(p);
  await executarAgendados();
  assert.equal(p.telas.filter((f) => f.titulo.includes("Transformação em Oni comum")).length, 1);
  assert.equal(sistema.getTrueRace(p), "cacador");
  assert.equal(c.getItem(0).amount, 3);
  assert.equal(stats.getScore(p, "blood"), 0);
  assert.equal(registros.personagem(p), undefined);
});

test("o sangue abre a escolha entre vários domínios, e a nova tentativa preserva apenas a original", async () => {
  const p = mestre();
  const c = p.getComponent("minecraft:inventory").container;
  c.setItem(2, { typeId: "kny:nichirin_thunder" });
  for (let k = 1; k <= 6; k++) assert.ok(dominio.registrarAula(lider, p, "thunder", k));
  c.setItem(0, { typeId: "kny:blood", amount: 2 });
  p.escolhas.push(selecionar("Definir original · Respiração do Trovão"));
  sangue(p);
  await executarAgendados();
  assert.equal(p.telas.length, 1);
  assert.equal(sistema.getTrueRace(p), "cacador");
  assert.equal(c.getItem(0).amount, 2);
  assert.equal(stats.getScore(p, "blood"), 0);
  assert.equal(dominio.avaliarDominio(p).resp.obj, "thunder");
  sangue(p);
  await executarAgendados();
  assert.equal(sistema.racaHibrida(p).resp, "thunder");
  assert.equal(c.getItem(0).amount, 1);
  assert.equal(stats.getScore(p, "blood"), 1);
});

test("troca da dose, alteração do domínio e histórico inválido impedem confirmar um resultado antigo", async () => {
  const p = cacador();
  const c = p.getComponent("minecraft:inventory").container;
  c.setItem(0, { typeId: "kny:blood", amount: 2 });
  p.escolhas.push((f) => {
    c.setItem(0, { typeId: "kny:blood", amount: 3 });
    return selecionar("Beber e virar Oni comum")(f);
  });
  sangue(p);
  await executarAgendados();
  assert.match(p.mensagens.at(-1), /pilha de sangue mudou/);
  assert.equal(c.getItem(0).amount, 3);

  p.escolhas.push((f) => {
    for (let k = 1; k <= 10; k++) assert.ok(dominio.registrarAula(lider, p, "water", k));
    return selecionar("Beber e virar Oni comum")(f);
  });
  sangue(p);
  await executarAgendados();
  assert.match(p.mensagens.at(-1), /resultado mudou/);
  assert.equal(c.getItem(0).amount, 3);
  assert.equal(sistema.getTrueRace(p), "cacador");
  p.setDynamicProperty(registros.CHAVE_DOMINIO, "{");
  sangue(p);
  await executarAgendados();
  assert.match(p.mensagens.at(-1), /Histórico de domínio incompatível/);
  assert.equal(c.getItem(0).amount, 3);
  assert.equal(stats.getScore(p, "blood"), 0);
});

test("Rei titular e cargo administrativo exigem a decisão de virar Oni comum", async () => {
  const p = cacador();
  assert.equal(sistema.transformar(p, "rei", rei).ok, false);
  assert.equal(sistema.transformar(p, "rei", rei, { destino: "oni" }).ok, true);
  assert.equal(sistema.getTrueRace(p), "oni");
  const candidato = cacador();
  candidato.addTag("kny_op");
  assert.equal(sistema.transformar(candidato, "sangue").ok, false);
  candidato.addTag("kny_set_rei");
  candidato.escolhas.push(selecionar("Continuar humano"));
  executarIntervalos(10);
  await executarAgendados();
  assert.equal(sistema.getTrueRace(candidato), "cacador");
  assert.equal(stats.titularDe(OBJ_REI), rei.name);
});

test("aula selecionada antes de outro registro exige selecionar novamente a próxima forma", async () => {
  const p = cacador({ nome: "Concorrencia" });
  lider.escolhas.push(selecionar("Ensinar Respiração"), selecionar("Respiração da Água"), (f) => {
    const selecao = selecionar(p.name)(f);
    assert.ok(dominio.registrarAula(lider, p, "water", 1));
    return selecao;
  });
  abrirMenu(lider);
  await executarAgendados();
  assert.equal(dominio.dominioHumano(p, "water"), 1);
  assert.match(lider.mensagens.at(-1), /O progresso mudou/);
  p.desconectar();
});

test("diagnóstico e recuperação de Oni da v72 mantêm progressão, saldo e quantidade de sangue", () => {
  const p = oniV72(cacador({ hashira: true, nome: "Legado Teste" }));
  const id = registros.idExistente(p);
  const c = p.getComponent("minecraft:inventory").container;
  c.setItem(0, { typeId: "kny:blood", amount: 4 });
  stats.pontuar(p, "kf_water", 10);
  stats.pontuar(p, "updemon", 250);
  stats.pontuar(p, "blood", 5);
  stats.pontuar(p, "kny_dinheiro", 1234);
  p.addTag("lower5");
  p.removeTag("muzan_curse");
  p.addTag("breakcurse");
  const saldo = stats.disponiveis(p);
  comandoStaff(p, 'recuperar "Legado Teste" water Prova verificável de aprendizado humano');
  assert.equal(sistema.getTrueRace(p), "oni");
  comandoStaff(staff, "diagnostico " + id);
  assert.match(staff.mensagens.at(-1), /water · liberadas 10\/10 · comprovadas 0\/10/);
  comandoStaff(staff, 'recuperar "Legado Teste" water');
  assert.match(staff.mensagens.at(-1), /sem comprovação/);
  p.addTag("kny_op");
  comandoStaff(p, 'recuperar "Legado Teste" water Prova verificável de aprendizado humano');
  assert.match(p.mensagens.at(-1), /outra pessoa da Staff/);

  comandoStaff(staff, 'recuperar "Legado Teste" water Registro das dez aulas humanas verificado pela Staff');
  assert.equal(sistema.racaHibrida(p)?.resp, "water");
  assert.equal(registros.personagem(p).id, id);
  assert.equal(stats.getScore(p, "updemon"), 250);
  assert.equal(stats.getScore(p, "blood"), 5);
  assert.equal(stats.getScore(p, "kny_dinheiro"), 1234);
  assert.equal(stats.disponiveis(p), saldo);
  assert.equal(stats.patenteDe(p).tag, "lower5");
  assert.equal(p.hasTag("breakcurse"), true);
  assert.equal(p.hasTag("muzan_curse"), false);
  assert.equal(c.getItem(0).amount, 4);
  comandoStaff(staff, "recuperar " + id + " water");
  assert.match(staff.mensagens.at(-1), /não contém transformação ativa/);
});

test("Staff pode recuperar o próprio personagem se o domínio completo já estava comprovado", () => {
  const p = oniV72(mestre());
  p.addTag("kny_op");
  assert.equal(sistema.recuperarHibridoV72(p, p, "thunder").ok, false);
  assert.equal(sistema.recuperarHibridoV72(p, p, "water").ok, true);
  assert.equal(sistema.getTrueRace(p), "hibrido");
  const outro = cacador();
  outro.addTag("demon");
  assert.equal(sistema.recuperarHibridoV72(staff, outro, "water").ok, false);
});

test("a cura devolve acesso ao contrato anterior e às aulas, sem recriar o personagem", () => {
  const p = oniV72(cacador());
  const id = registros.idExistente(p);
  p.removeTag("demon");
  system.afterEvents.scriptEventReceive.emit({ id: "kny:h_curado", sourceEntity: p, message: "antidoto" });
  assert.equal(registros.personagem(p).estado, "curado");
  assert.equal(sistema.getTrueRace(p), "cacador");
  assert.ok(dominio.registrarAula(lider, p, "water", 1));
  assert.equal(registros.idExistente(p), id);
  assert.equal(stats.getScore(p, "blood"), 1);
});

test("múltiplas respirações são resolvidas antes de transformar. A arte fica vinculada", () => {
  const p = mestre();
  const c = p.getComponent("minecraft:inventory").container;
  c.setItem(2, { typeId: "kny:nichirin_thunder" });
  c.setItem(3, { typeId: "kny:biwa" });
  for (let k = 1; k <= 6; k++) assert.ok(dominio.registrarAula(lider, p, "thunder", k));
  assert.equal(sistema.transformar(p, "rei", rei).ok, false);
  assert.ok(dominio.selecionarOriginal(p, "thunder"));
  assert.equal(sistema.transformar(p, "rei", rei).hibrido, true);
  const d = sistema.racaHibrida(p);
  assert.equal(d.resp, "thunder");
  assert.equal(d.arte, "biwa");
  for (let k = 1; k <= 6; k++) assert.ok(sistema.canUseBreathing(p, "thunder", c.getItem(2), k));
  assert.equal(sistema.canUseBreathing(p, "thunder", c.getItem(1), 1), false);
  assert.equal(sistema.canUseBreathing(p, "water", c.getItem(1), 1), false);
  assert.equal(sistema.canUseBreathing(p, "thunder", c.getItem(2), 7), false);
  assert.ok(sistema.canUseKekkijutsu(p, "biwa", c.getItem(3)));
  assert.equal(sistema.canUseKekkijutsu(p, "enmu", { typeId: "kny:enmu_hand" }), false);
  assert.equal(dominio.selecionarOriginal(p, "water"), false);
  assert.equal(sistema.transformar(p, "rei", rei).ok, false);
});

test("certificação tem autoridade, evidência, histórico e rejeita autocertificação", () => {
  const p = cacador();
  stats.pontuar(p, "kf_water", 10);
  const prova = "Registro humano da Escola da Água, sessão 4";
  assert.equal(dominio.certificarHistorico(lider, p, "water", prova), false);
  assert.equal(dominio.certificarHistorico(staff, p, "water", "curta"), false);
  assert.equal(dominio.certificarHistorico(staff, staff, "water", prova), false);
  assert.ok(dominio.certificarHistorico(staff, p, "water", prova));
  assert.equal(dominio.avaliarDominio(p).resp.obj, "water");
  assert.ok(world.getDynamicPropertyIds().some((k) => k.startsWith("kny:h_auditoria_") && /certificar_dominio/.test(String(world.getDynamicProperty(k)))));
});

test("outro Hashira orienta o líder sem obter autoridade para ensinar iniciantes", () => {
  const orientador = cacador({ hashira: true });
  const iniciante = cacador();
  assert.equal(dominio.registrarAula(orientador, iniciante, "water", 1), false);
  assert.equal(dominio.registrarAula(lider, lider, "water", 1), false);
  lider.getComponent("minecraft:inventory").container.setItem(1, { typeId: "kny:nichirin_water" });
  stats.pontuar(lider, "upslayer", 10000);
  for (let k = 1; k <= 10; k++) assert.ok(dominio.registrarAula(orientador, lider, "water", k));
  assert.equal(dominio.avaliarDominio(lider).resp.obj, "water");
});

test("uma transformação interrompida é retomada sem duplicar dose, saldo ou identidade", () => {
  const p = mestre();
  const c = p.getComponent("minecraft:inventory").container;
  c.setItem(0, { typeId: "kny:blood", amount: 3 });
  const pre = stats.disponiveis(p);
  const originalTrigger = p.triggerEvent;
  p.triggerEvent = () => { throw new Error("interrupção de teste"); };
  assert.equal(sistema.transformar(p, "sangue").ok, false);
  const parcial = registros.personagem(p);
  assert.equal(parcial.estado, "transformando");
  assert.equal(c.getItem(0).amount, 2);
  assert.equal(parcial.dose, undefined);
  c.setItem(0, { typeId: "kny:blood", amount: 3 });
  p.triggerEvent = originalTrigger;
  sistema.restaurarRaca(p);
  assert.equal(c.getItem(0).amount, 3);
  assert.equal(stats.getScore(p, "blood"), 1);
  assert.equal(sistema.racaHibrida(p).id, parcial.id);
  assert.equal(stats.disponiveis(p), pre);
  const novo = jogador(p.name, p.dinamicos);
  novo.dimension = dim;
  sistema.restaurarRaca(novo);
  assert.equal(sistema.racaHibrida(novo).id, parcial.id);
  assert.equal(novo.hasTag("demon"), true);
});

test("os três disfarces separam identidade, NPCs, Técnicas e patente", async () => {
  const p = hibrido();
  const patente = stats.patenteDe(p);
  const pv = p.getComponent("minecraft:health").currentValue;
  assert.match(sistema.trocarDisfarce(p, "cacador"), /Caçador/);
  assert.match(sistema.nomePublico(p), /^\[Caçador\]/);
  assert.equal(sistema.getTrueRace(p), "hibrido");
  assert.equal(sistema.getPublicFaction(p), "cacador");
  assert.equal(p.hasTag("slayer"), false);
  assert.equal(stats.patenteDe(p), patente);
  assert.match(sistema.trocarDisfarce(p, "oni"), /pronto em/);
  assert.ok(sistema.revelar(p));
  assert.equal(sistema.getPublicIdentity(p), "revelado");
  assert.equal(sistema.getPublicFaction(p), "oni");
  assert.equal(p.getComponent("minecraft:health").currentValue, pv);
  p.applyDamage(0.5, { cause: "magic" });
  const outro = jogador(p.name, p.dinamicos);
  assert.ok(sistema.emCombate(outro));
  assert.match(sistema.trocarDisfarce(outro, "oni"), /combate/);
  await executarAgendados();
});

test("as seis habilidades executam efeitos distintos e reservam proprietário offline", async () => {
  for (const [id, h] of Object.entries(ESPECIAIS)) {
    const p = hibrido();
    const alvo = jogador();
    alvo.dimension = dim;
    alvo.location.x = 3;
    dim.getEntities = () => [alvo];
    const proprietario = sistema.racaHibrida(p).id;
    assert.match(poderes.administrarPoder(staff, "atribuir", id, proprietario), /salva/);
    assert.match(poderes.administrarPoder(staff, "atribuir", id, sistema.racaHibrida(hibrido()).id), /já/);
    assert.equal(poderes.habilidadeDe(p).id, id);
    stats.pontuar(p, "kny_folego", h.folego - 1);
    assert.match(poderes.ativarHabilidade(p), /insuficientes/);
    stats.pontuar(p, "kny_folego", 100);
    stats.pontuar(p, "kny_stam", 100);
    p.addTag("kny_caido");
    assert.match(poderes.ativarHabilidade(p), /não pode/);
    p.removeTag("kny_caido");
    assert.equal(poderes.ativarHabilidade(p), undefined);
    assert.equal(stats.getScore(p, "kny_folego"), 100 - h.folego);
    assert.equal(stats.getScore(p, "kny_stam"), 100 - h.stamina);
    if (id === "carapaca") {
      p.applyDamage(8, { cause: "entityAttack", damagingEntity: alvo });
      assert.equal(p.getComponent("minecraft:health").currentValue, 34);
    }
    await executarAgendados();
    if (h.dano) assert.equal(alvo.getComponent("minecraft:health").currentValue, 40 - h.dano);
    if (id === "passo") assert.ok(p.location.x > 1.5 && p.location.x <= h.alcance + 0.01);
    if (id === "prisao") assert.ok(alvo.getEffect("slowness"));
    if (id === "sombras") assert.ok(alvo.getEffect("blindness"));
    p.desconectar();
    const novo = jogador(p.name, p.dinamicos);
    assert.ok(poderes.habilidadeDe(novo).ate > Date.now());
    assert.match(poderes.administrarPoder(staff, "desativar", id), /salva/);
    assert.equal(poderes.habilidadeDe(novo).ativo, false);
  }
  assert.equal(poderes.habilidadeDe(hibrido()), undefined);
});

test("castelo exige configuração, identidade, destino e preparação válida", async () => {
  const p = hibrido();
  assert.match(locais.viajar(p), /ainda não foi configurado/);
  staff.location = { x: 25, y: 70, z: 0 };
  assert.match(locais.configurarLocal(p, ["castelo", "entrada"]), /Staff/);
  assert.match(locais.configurarLocal(staff, ["castelo", "entrada"]), /salva/);
  staff.location.x = 0;
  assert.match(locais.configurarLocal(staff, ["castelo", "saida"]), /salva/);
  assert.notEqual(locais.viajar(cacador()), undefined);
  assert.notEqual(locais.viajar(p, "castelo", "saida"), undefined);
  assert.equal(locais.viajar(p), undefined);
  p.applyDamage(1, { cause: "magic" });
  await executarAgendados();
  assert.equal(p.location.x, 0);
  assert.match(locais.viajar(p), /segurança/);
  const outro = hibrido();
  assert.equal(locais.viajar(outro), undefined);
  await executarAgendados();
  assert.equal(outro.location.x, 25);
  assert.match(locais.viajar(outro, "castelo", "saida"), /recarga/);
  registros.guardarPersonagem(outro, { ...sistema.racaHibrida(outro), casteloAte: 0 });
  assert.equal(locais.viajar(outro, "castelo", "saida"), undefined);
  await executarAgendados();
  assert.equal(outro.location.x, 0);
  const disfarce = hibrido();
  sistema.trocarDisfarce(disfarce, "cacador");
  assert.match(locais.viajar(disfarce), /não permite/);
});

test("sol depende de horário, clima, cobertura, água e dimensão, não do disfarce", () => {
  const p = hibrido();
  assert.ok(sol.expostoAoSol(p));
  assert.ok(sol.danoSolar(p) > 0 && sol.danoSolar(p) < H.solDanoOni);
  sistema.trocarDisfarce(p, "cacador");
  assert.ok(sol.expostoAoSol(p));
  p.addTag("sunshield");
  assert.ok(sol.danoSolar(p) > 0);
  clima = "Rain";
  assert.equal(sol.expostoAoSol(p), false);
  clima = "Clear";
  hora = 18000;
  assert.equal(sol.expostoAoSol(p), false);
  hora = 6500;
  cobertura = { y: 73 };
  assert.equal(sol.expostoAoSol(p), false);
  cobertura = undefined;
  p.isInWater = true;
  assert.equal(sol.expostoAoSol(p), false);
  p.isInWater = false;
  p.dimension = { id: "minecraft:nether" };
  assert.equal(sol.expostoAoSol(p), false);
  parede = true;
  assert.equal(locais.destinoSeguro(dim, { x: 0, y: -640, z: 0 }), false);
});
