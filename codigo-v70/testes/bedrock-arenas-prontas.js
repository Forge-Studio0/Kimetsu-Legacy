import { BlockVolume, GameMode, system, world } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import {
  DIM_ARENAS, arenas, caixaCarregamento, carregarArea, comPontoCarregado, criarArena,
  descarregarArea, destinoSeguro, erroArena, gravarArena, pegarArena, validarPontos,
} from "./missoes_arenas.js";
import { instalarArenasProntas } from "./missoes_arenas_prontas.js";
import { CATALOGO_MISSOES, REGRAS_MISSAO } from "./missoes_catalogo.js";
import { criarGrupo, convidar, responderConvite } from "./missoes_grupos.js";
import { abrirMissoes } from "./missoes_interface.js";
import { arenasPara, iniciarMissao, operacaoMissao } from "./missoes_sessoes.js";
import { gravarJson } from "./hybrid_records.js";
import { CHAVE_ENTRADA } from "./character_system.js";
import { getScore, pontuar } from "./stats.js";

const PATIO = "patio_da_vigilia";
const REFUGIO = "refugio_das_lanternas";
const REINICIO = "kny:test_v84_arenas";
const MANUAL = { x: 646, y: 98, z: 520 };
const mundo = () => world.getDimension("overworld");
const missao = () => world.getDimension(DIM_ARENAS);
const log = (t) => console.warn("KNY-TEST ARENAS " + t);
function assert(ok, t) { if (!ok) throw new Error(t); }
function eq(a, b, t) { assert(a === b, `${t} (${a} != ${b})`); }

async function aguardar(condicao, descricao, ticks = 100) {
  for (let i = 0; i < ticks; i += 2) {
    if (condicao()) return;
    await system.waitTicks(2);
  }
  throw new Error(descricao);
}

async function jogador(i) {
  const pos = { x: 52.5, y: 210, z: 61.5 + i };
  const p = spawnSimulatedPlayer({ ...pos, dimension: mundo() }, "ArenaV84_" + i, GameMode.Survival);
  p.setDynamicProperty(CHAVE_ENTRADA, "v78");
  p.teleport(pos);
  await aguardar(() => p.hasTag("start"), "inicialização de " + p.name);
  p.addTag("slayer");
  p.addTag("kny_escolheu");
  p.teleport(pos);
  return p;
}

async function verificarArenas() {
  const todas = arenas();
  const patio = pegarArena(PATIO);
  const refugio = pegarArena(REFUGIO);
  assert(patio?.ativa && refugio?.ativa, "dois modelos ativos");
  eq(patio.a.x, 768, "instalador pulou palco anterior e construção sem cadastro");
  eq(refugio.a.x, 896, "segundo palco em região separada");
  eq(pegarArena("arena_01")?.nome, "Arena de Missões 01", "cadastro manual preservado");
  const dim = missao();
  await comPontoCarregado("kny_teste_bloco_manual", dim, MANUAL, () =>
    eq(dim.getBlock(MANUAL).typeId, "minecraft:gold_block", "bloco de construção manual intacto"));

  for (const a of [patio, refugio]) {
    const area = caixaCarregamento(a);
    eq(erroArena(a, todas), undefined, "validação da ficha " + a.nome);
    eq(a.b.x - a.a.x + 1, 32, "largura");
    eq(a.b.z - a.a.z + 1, 32, "comprimento");
    eq(a.b.y - a.a.y + 1, 16, "altura");
    eq(a.entradas.length, 4, "quatro vagas");
    eq(a.spawns.length, 8, "oito spawns");
    const chave = "kny_teste_" + a.id;
    try {
      await carregarArea(chave, area);
      assert(validarPontos(a), "piso e espaço livres em todos os pontos");
      eq(dim.getBlock({ ...a.a, y: a.a.y + 10 }).typeId, "minecraft:barrier", "parede superior");
      eq(dim.getBlock({ x: a.a.x + 15, y: a.b.y, z: a.a.z + 15 }).typeId, "minecraft:tinted_glass", "teto contínuo");
      if (a.objetivo) {
        const caminho = { ...a.objetivo };
        for (let z = a.a.z + 5.5; z <= a.objetivo.z; z++) {
          assert(destinoSeguro(dim, { ...caminho, z }), "caminho para o objetivo em " + z);
        }
      }
    } finally {
      descarregarArea(chave);
    }
    eq(world.tickingAreaManager.hasTickingArea("kny_instalacao_" + a.id + "_" + a.a.x), false, "carregamento temporário liberado");
  }
  for (const m of CATALOGO_MISSOES) {
    const palco = ["local", "proteger"].includes(m.objetivo) ? REFUGIO : PATIO;
    for (let tamanho = 1; tamanho <= m.maxGrupo; tamanho++) {
      eq(arenasPara(m, tamanho).map(({ a }) => a.id).join(","), palco, `${m.id} com ${tamanho} pessoas`);
    }
  }
  return { patio, refugio };
}

const inimigos = () => missao().getEntities({ tags: ["kny_missao_ator"], excludeTags: ["kny_missao_protegido"] });
function vencerOnda(p) {
  for (const e of inimigos()) {
    assert(e.applyDamage(2000, { cause: "entityAttack", damagingEntity: p }), "dano de combate em " + e.typeId);
  }
}

async function testar() {
  if (world.getDynamicProperty(REINICIO)) {
    await verificarArenas();
    log("REINÍCIO OK");
    return;
  }
  REGRAS_MISSAO.preparoMs = 250;
  mundo().runCommand("time set noon");
  mundo().runCommand("gamerule dodaylightcycle false");
  mundo().runCommand("gamerule domobspawning false");
  mundo().runCommand("difficulty normal");
  const from = { x: 48, y: 209, z: 57 }, to = { x: 58, y: 209, z: 75 };
  await carregarArea("kny_teste_saida", { dimension: mundo(), from, to });
  mundo().fillBlocks(new BlockVolume(from, to), "minecraft:stone");
  descarregarArea("kny_teste_saida");
  const staff = await jogador(0);
  assert((await instalarArenasProntas(staff)).erro?.includes("Staff"), "permissão exigida");
  staff.addTag("kny_op");
  const origem = staff.location;
  staff.teleport({ ...origem, y: origem.y + 4 }, { dimension: mundo() });
  assert((await instalarArenasProntas(staff)).erro?.includes("piso firme"), "saída sem piso recusada");
  staff.teleport(origem, { dimension: mundo() });
  const anterior = criarArena("arena_01", "Arena de Missões 01");
  gravarArena({ ...anterior, a: { x: 512, y: 98, z: 512 }, b: { x: 520, y: 105, z: 520 } });
  const dim = missao();
  await comPontoCarregado("kny_teste_preparo", dim, MANUAL, () => dim.getBlock(MANUAL).setType("minecraft:gold_block"));
  assert(destinoSeguro(mundo(), origem), "saída de testes preparada");
  const selecoes = [8, 2, 2, 4];
  await abrirMissoes(staff, async () => selecoes.length ? { canceled: false, selection: selecoes.shift() }
    : { canceled: true, cancelationReason: "UserClosed" }, () => {});
  eq(selecoes.length, 0, "seleções de Administração de arenas, Instalar e Confirmar");
  const { patio, refugio } = await verificarArenas();
  const repetida = await instalarArenasProntas(staff);
  assert(!repetida.erro && !repetida.criadas.length, "nova confirmação é idempotente");
  log("menu, permissões, saída, registro, duas construções e 21 missões compatíveis OK");

  const grupo = criarGrupo(staff);
  const jogadores = [staff];
  for (let i = 1; i <= 3; i++) {
    const p = await jogador(i);
    eq(convidar(staff, p), undefined, "convite");
    eq(responderConvite(p, true), undefined, "aceitação de convite");
    jogadores.push(p);
  }
  const solo = await jogador(4);
  const [erroGrupo, erroSolo] = await Promise.all([
    iniciarMissao(staff, "ronda", "grupo", [...grupo.membros.keys()]),
    iniciarMissao(solo, "sagiri", "solo"),
  ]);
  eq(erroGrupo, undefined, "reserva da Ronda dos Caçadores");
  eq(erroSolo, undefined, "reserva da Montanha Sagiri");
  const r = operacaoMissao(staff).s;
  const s = operacaoMissao(solo).s;
  eq(r.arena.id, patio.id, "Ronda no Pátio da Vigília");
  eq(s.arena.id, refugio.id, "Sagiri no Refúgio das Lanternas");
  for (const p of [...jogadores, solo]) eq(p.dimension.id, DIM_ARENAS, "teletransporte " + p.name);
  await aguardar(() => r.estado === "andamento" && s.estado === "andamento", "duas missões em paralelo");
  eq(inimigos().length, 6, "seis adversários na Ronda para quatro jogadores");
  const dinheiro = getScore(staff, "kny_dinheiro");
  const origemSolo = s.pessoas[0].origem.pos;
  await comPontoCarregado("kny_teste_bloqueio_saida", mundo(), origemSolo, () =>
    mundo().getBlock(origemSolo).setType("minecraft:stone"));
  vencerOnda(staff);
  const opcoes = { dimension: dim, checkForBlocks: true };
  const entrada = refugio.entradas[0], alvo = refugio.objetivo;
  for (let x = entrada.x + 1; x <= alvo.x; x++) {
    assert(solo.tryTeleport({ ...entrada, x }, opcoes), "passagem livre entre a entrada e a trilha");
  }
  for (let z = entrada.z + 1; z <= alvo.z; z++) {
    assert(solo.tryTeleport({ ...alvo, z }, opcoes), "passagem livre até o pavilhão");
  }
  await aguardar(() => !operacaoMissao(solo) && jogadores.every((p) => !operacaoMissao(p)), "grupo e solo concluíram e retornaram");
  eq(r.estado, "sucesso", "resultado da Ronda");
  eq(s.estado, "sucesso", "resultado de Sagiri");
  eq(getScore(staff, "kny_dinheiro"), dinheiro + 100, "recompensa da Ronda");
  for (const p of [...jogadores, solo]) eq(p.dimension.id, mundo().id, "retorno " + p.name);
  eq(Math.floor(solo.location.z), Math.floor(refugio.saida.pos.z), "saída alternativa usada com a origem bloqueada");
  eq(inimigos().length, 0, "limpeza após a missão");
  log("Ronda com quatro jogadores e Sagiri individual concluídas em paralelo");

  solo.addTag("tsuchinoe");
  pontuar(solo, "upslayer", 500);
  gravarJson(solo, "kny:missao_historico", { v: 1, marcas: { natagumo: { vitorias: 1 } }, historico: [] });
  eq(await iniciarMissao(solo, "rui", "solo"), undefined, "entrada na proteção do Tanjiro");
  const rui = operacaoMissao(solo).s;
  await aguardar(() => rui.estado === "andamento", "geração do protegido");
  const aliado = dim.getEntities({ tags: ["kny_missao_protegido"] })[0];
  eq(aliado?.typeId, "kny:tanjiro", "NPC protegido no Refúgio");
  eq(Math.floor(aliado.location.x), Math.floor(refugio.objetivo.x), "posição do pavilhão");
  vencerOnda(solo);
  await aguardar(() => !operacaoMissao(solo), "retorno ao concluir a proteção");
  eq(rui.estado, "sucesso", "resultado da proteção");
  log("Proteja Tanjiro de Rui concluída no Refúgio");
  world.setDynamicProperty(REINICIO, true);
  log("FIM");
}

system.runTimeout(() => testar().catch((e) => console.error("KNY-TEST FALHA ARENAS " + e + "\n" + e.stack)), 35);
