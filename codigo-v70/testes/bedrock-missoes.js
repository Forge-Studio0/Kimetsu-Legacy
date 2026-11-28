import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { DIM_ARENAS, carregarArea, caixaCarregamento, gravarArena, descarregarArea } from "./missoes_arenas.js";
import { ATORES_MISSAO, MISSAO_ID, REGRAS_MISSAO } from "./missoes_catalogo.js";
import { iniciarMissao, operacaoMissao, sessaoDaArena, fichaMissoes } from "./missoes_sessoes.js";
import { criarGrupo, convidar, responderConvite } from "./missoes_grupos.js";
import { aprendizadoAtivo, atribuirAprendizado, dominioHumano, registrarTreinoRespiracao } from "./hybrid_mastery.js";
import { disponiveis, getScore, pontuar } from "./stats.js";
import { gravarJson, guardarPersonagem, identificador } from "./hybrid_records.js";
import { OBJ_LIDER } from "./stats_config.js";

const marca = "kny:test_v81_reinicio";
const d = () => world.getDimension("overworld");
const dim = () => world.getDimension(DIM_ARENAS);
const wait = (t) => system.waitTicks(t);
const log = (msg) => console.warn("KNY-TEST MISSOES " + msg);
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg} (${a} != ${b})`); };
const assert = (v, msg) => { if (!v) throw new Error(msg); };
const base = { x: 52.5, y: 210, z: 61.5 };

async function ate(condicao, descricao, n = 100) {
  for (let i = 0; i < n; i += 2) {
    if (condicao()) return;
    await wait(2);
  }
  throw new Error(descricao);
}

let jogadores = [];
async function player(nome) {
  const pos = { ...base, z: base.z + jogadores.length };
  const p = spawnSimulatedPlayer({ ...pos, dimension: d() }, nome, GameMode.Survival);
  jogadores.push(p);
  d().runCommand("fill 48 209 57 58 209 75 stone");
  p.teleport(pos);
  await ate(() => p.hasTag("start"), "inicialização de " + nome);
  p.addTag("slayer");
  p.addTag("kny_escolheu");
  p.teleport(pos);
  return p;
}

async function chao(a) {
  await carregarArea("kny_teste_" + a.id, caixaCarregamento(a));
  dim().runCommand(`fill ${a.a.x} 209 ${a.a.z} ${a.b.x} 209 ${a.b.z} stone`);
  descarregarArea("kny_teste_" + a.id);
  gravarArena(a);
}

function arena(x, id, tipos, missoes, capacidade) {
  const pos = (dx, dz) => ({ x: x + dx + 0.5, y: 210, z: 200 + dz + 0.5 });
  return {
    v: 1, id, nome: id, dim: DIM_ARENAS, ativa: true, capacidade, tipos, missoes, ranks: ["D", "C", "B", "A", "S"],
    a: { x, y: 210, z: 200 }, b: { x: x + 15, y: 218, z: 215 },
    entradas: Array.from({ length: capacidade }, (_, i) => pos(i + 1, 1)),
    spawns: Array.from({ length: 6 }, (_, i) => pos(i + 1, 8)),
    objetivo: pos(6, 13), saida: { dim: d().id, pos: base },
  };
}

const inimigos = () => dim().getEntities().filter((e) => e.hasTag("kny_missao_ator") && e.typeId !== "minecraft:player");

async function combate(p, m, modo, ids) {
  eq(await iniciarMissao(p, m, modo, ids), undefined, "Preparação de " + m);
  const atual = operacaoMissao(p);
  assert(atual, "sessão persistida");
  await ate(() => atual.s.estado === "andamento", "início do combate");
  return atual.s;
}

function nocautearTodos(p) {
  for (const e of inimigos().filter((e) => !e.hasTag("kny_missao_protegido"))) {
    assert(e.applyDamage(2000, { cause: "entityAttack", damagingEntity: p }), `Combate contra ${e.typeId}`);
  }
}

async function testarFaccoes() {
  const oni = await player("OniV81");
  const h = await player("HibridoV81");
  const aprendiz = await player("ProtecaoV81");
  for (const p of [oni, h]) {
    p.removeTag("slayer");
    p.removeTag("slayer2");
    p.addTag("demon");
  }
  oni.addTag("lower6");
  pontuar(oni, "updemon", 100);
  guardarPersonagem(h, { v: 1, id: identificador(h), raca: "hibrido", estado: "ativo", resp: "water", arte: "enmu", publico: "cacador", formas: 10 });
  assert((await iniciarMissao(oni, "ronda", "solo")).includes("linhagem"), "raça incompatível");
  assert((await iniciarMissao(h, "ronda", "solo")).includes("linhagem"), "disfarce não altera elegibilidade");
  assert((await iniciarMissao(oni, "oni_emboscada", "solo")).includes("Nenhuma arena"), "inicio sem arena impedido");
  const ondas = arena(208, "arena_faccoes", ["ondas"], ["oni_emboscada", "hibrido_demonios"], 4);
  const protecao = arena(336, "arena_proteger", ["proteger"], ["rui"], 4);
  await chao(ondas);
  await chao(protecao);
  await carregarArea("kny_teste_npcs", caixaCarregamento(ondas));
  for (const id of ATORES_MISSAO) {
    const ator = dim().spawnEntity(id, ondas.spawns[0], { spawnEvent: "kny:missao_spawn" });
    await wait(1);
    eq(ator.getProperty("kny:em_missao"), true, "perfil de missão " + id);
    assert(ator.getComponent("minecraft:health")?.effectiveMax > 0, "vida inicial de " + id);
    ator.remove();
  }
  descarregarArea("kny_teste_npcs");
  const antesOni = getScore(oni, "updemon");
  const s = await combate(oni, "oni_emboscada", "solo");
  assert(inimigos().every((e) => e.typeId === "kny:slayer"), "Oni enfrenta espadachins");
  nocautearTodos(oni);
  await ate(() => s.onda === 1 && inimigos().length >= 3, "segunda onda Oni");
  nocautearTodos(oni);
  await ate(() => !operacaoMissao(oni), "pagamento para Oni");
  eq(getScore(oni, "updemon"), antesOni + 10, "maldição Oni");
  eq(getScore(oni, "upslayer"), 0, "honra Oni");
  log("todos os tipos de atores, combate Oni e segunda onda OK");

  const anterior = getScore(h, "updemon");
  const sh = await combate(h, "hibrido_demonios", "solo");
  assert(inimigos().every((e) => e.typeId !== "kny:slayer"), "Híbrido enfrenta Onis na sua caçada");
  nocautearTodos(h);
  await ate(() => sh.onda === 1 && inimigos().length >= 2, "segunda onda Híbrida");
  nocautearTodos(h);
  await ate(() => !operacaoMissao(h), "pagamento para Híbrido");
  eq(getScore(h, "updemon"), anterior + 20, "maldição Híbrida");
  eq(getScore(h, "upslayer"), 0, "honra Híbrida");
  log("linhagem Híbrida disfarçada, combate e prêmio exclusivo OK");

  aprendiz.addTag("tsuchinoe");
  pontuar(aprendiz, "upslayer", 500);
  gravarJson(aprendiz, "kny:missao_historico", { v: 1, marcas: { natagumo: { vitorias: 1 } }, historico: [] });
  const sp = await combate(aprendiz, "rui", "solo");
  const aliado = inimigos().find((e) => e.hasTag("kny_missao_protegido"));
  const rui = inimigos().find((e) => e.typeId === "kny:rui");
  eq(aliado.typeId, "kny:tanjiro", "aliado correto");
  const honra = getScore(aprendiz, "upslayer");
  aliado.applyDamage(2000, { cause: "entityAttack", damagingEntity: rui });
  await ate(() => !operacaoMissao(aprendiz), "retorno após perda de Tanjiro");
  eq(sp.estado, "fracassada", "fracasso ao perder o protegido");
  eq(getScore(aprendiz, "upslayer"), honra, "fracasso sem recompensa");
  log("proteção, fracasso, limpeza e retorno OK");
  const sobrevivente = await player("SobrevidaV81");
  sobrevivente.addTag("kanoto");
  pontuar(sobrevivente, "upslayer", 200);
  const noite = MISSAO_ID.get("selecao_noite");
  noite.sobrevida = 3;
  const palco = arena(464, "arena_noite", ["sobreviver"], [noite.id], 4);
  await chao(palco);
  const ss = await combate(sobrevivente, noite.id, "solo");
  nocautearTodos(sobrevivente);
  await ate(() => ss.onda === 1 && inimigos().length >= 2, "segunda onda de sobrevivência");
  nocautearTodos(sobrevivente);
  eq(ss.estado, "andamento", "conclusão espera o tempo mínimo");
  await ate(() => !operacaoMissao(sobrevivente), "vitória de sobrevivência", 150);
  eq(ss.estado, "sucesso", "ondas e tempo de sobrevivência");
  log("sobrevivência com ondas e tempo mínimo OK");
  log("FACCOES OK");
}

async function testar() {
  if (world.getDynamicProperty(marca)) {
    const anterior = JSON.parse(String(world.getDynamicProperty(marca)));
    await ate(() => !sessaoDaArena("arena_ronda"), "limpeza e liberação após reiniciar");
    const s = JSON.parse(String(world.getDynamicProperty("kny:missao_s_" + anterior.id)));
    eq(s.estado, "cancelada", "sessão incompleta cancelada após reiniciar");
    assert(s.limpa && s.pessoas.every((a) => !a.premio && !a.retornou), "saída pendente armazenada sem prêmio");
    world.setDynamicProperty(marca, undefined);
    log("REINICIO OK");
    return;
  }
  REGRAS_MISSAO.preparoMs = 250;
  d().runCommand("time set midnight");
  d().runCommand("gamerule dodaylightcycle false");
  d().runCommand("gamerule domobspawning false");
  d().runCommand("difficulty normal");
  if (world.getDynamicProperty("kny:test_v81_faccoes")) return testarFaccoes();
  log("criando jogadores");
  const p = await player("AprendizV81");
  const lider = await player("LiderV81");
  const b = await player("GrupoB81");
  const c = await player("GrupoC81");
  const dps = await player("GrupoD81");
  log("jogadores prontos");
  lider.addTag("hashira");
  lider.addTag("hashira_lider");
  pontuar(lider, "upslayer", 10000);
  const objetivo = world.scoreboard.getObjective(OBJ_LIDER) ?? world.scoreboard.addObjective(OBJ_LIDER);
  for (const antigo of objetivo.getParticipants()) objetivo.removeParticipant(antigo);
  objetivo.setScore(lider.name, 1);
  p.getComponent("minecraft:inventory").container.setItem(2, new ItemStack("kny:nichirin_water"));
  assert(atribuirAprendizado(b, p, "water", 1), "falso Líder recusado");
  eq(atribuirAprendizado(lider, p, "water", 1), undefined, "atribuição real");
  lider.disconnect();
  log("atribuição salva");
  registrarTreinoRespiracao(p, "nadar", 50);
  eq(dominioHumano(p, "water"), 0, "forma só após todos os objetivos");

  const ronda = arena(208, "arena_ronda", ["abates"], ["ronda"], 4);
  const sagiri = arena(336, "arena_sagiri", ["local"], ["sagiri"], 1);
  log("carregando arena Ronda");
  await chao(ronda);
  log("carregando arena Sagiri");
  await chao(sagiri);
  log("arenas prontas");

  let saldo = disponiveis(p);
  let honra = getScore(p, "upslayer");
  let grana = getScore(p, "kny_dinheiro");
  const s = await combate(p, "ronda", "solo");
  eq(inimigos().length, 3, "spawn dos três Onis após preparação");
  eq(inimigos()[0].getProperty("kny:em_missao"), true, "personalização de economia ativada");
  assert((await iniciarMissao(b, "ronda", "solo")).includes("ocupadas"), "reserva concorrente bloqueada");
  const fora = inimigos()[0];
  const vida = (e) => e.getComponent("minecraft:health")?.currentValue;
  const antes = vida(fora);
  fora.applyDamage(20, { cause: "entityAttack", damagingEntity: b });
  await wait(3);
  eq(vida(fora), antes, "dano externo bloqueado");
  for (const e of inimigos()) assert(e.applyDamage(2000, { cause: "entityAttack", damagingEntity: p }), "participante pode derrotar o Oni");
  await ate(() => !operacaoMissao(p), "pagamento e retorno da missão solo");
  eq(s.estado, "sucesso", "missão solo efetivamente concluída");
  eq(p.dimension.id, d().id, "participante retornou ao mundo");
  eq(inimigos().length, 0, "arena limpa");
  eq(getScore(p, "upslayer"), honra + 5, "somente a honra da missão");
  eq(getScore(p, "kny_dinheiro"), grana + 100, "dinheiro pago uma vez");
  eq(disponiveis(p), saldo + 750, "Stats diretos e por honra");
  eq(dominioHumano(p, "water"), 1, "abates finalizam aprendizado sem Líder");
  eq(aprendizadoAtivo(p), undefined, "aprendizado encerrado");
  assert((await iniciarMissao(p, "ronda", "solo")).length, "repetição imediata bloqueada");
  log("solo, domínio automático, isolamento e economia OK");

  const g = criarGrupo(b);
  eq(convidar(b, c), undefined, "convite à integrante ativo");
  eq(convidar(b, dps), undefined, "convite ao terceiro");
  eq(g.membros.size, 1, "convites não adicionam participantes");
  eq(responderConvite(c, true), undefined, "consentimento de C");
  eq(responderConvite(dps, true), undefined, "consentimento de D");
  const ids = [...g.membros.keys()];
  const sg = await combate(b, "ronda", "grupo", ids);
  const alvos = inimigos();
  eq(alvos.length, 5, "escalonamento com dois reforços");
  for (let i = 0; i < alvos.length; i++) {
    const q = i < 3 ? b : c;
    assert(alvos[i].applyDamage(2000, { cause: "entityAttack", damagingEntity: q }), "combate de integrante " + q.name);
  }
  await ate(() => !operacaoMissao(b) && !operacaoMissao(c) && !operacaoMissao(dps), "retorno de todos do grupo");
  eq(sg.estado, "sucesso", "missão em grupo concluída");
  const pb = fichaMissoes(b).historico[0].premio;
  const pc = fichaMissoes(c).historico[0].premio;
  eq(pb.pontos + pc.pontos, 500, "pool fixo entre participantes aptos");
  assert(pb.pontos > pc.pontos, "proporção acompanha contribuição");
  eq(fichaMissoes(dps).historico[0].estado, "sem_premio", "AFK não recebe");
  log("consentimento, grupo, reforços, divisão e AFK OK");

  const sl = await combate(dps, "sagiri", "solo");
  dps.teleport(sagiri.objetivo);
  await ate(() => !operacaoMissao(dps), "conclusão de localização");
  eq(sl.estado, "sucesso", "objetivo de localização atingido");
  assert((await iniciarMissao(dps, "sagiri", "solo")).includes("Missão concluída."), "principal bloqueada após primeira vitória");
  log("localização e missão principal única OK");

  const reinicio = await player("SessaoReinicioV81");
  const sr = await combate(reinicio, "ronda", "solo");
  assert(inimigos().length === 3, "NPCs presentes antes do reinício");
  world.setDynamicProperty(marca, JSON.stringify({ id: sr.id }));
  log("FIM");
}

system.runTimeout(() => testar().catch((e) => console.error("KNY-TEST FALHA MISSOES " + e + "\n" + e.stack)), 35);
