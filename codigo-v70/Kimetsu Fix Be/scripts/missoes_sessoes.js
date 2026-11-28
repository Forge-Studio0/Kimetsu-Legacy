import { system, world } from "@minecraft/server";
import { modoDeJogo } from "./compat.js";
import { ehStaff, emCombate, estadoBloqueado, getTrueRace } from "./hybrid_system.js";
import { gravarJson, idExistente, identificador, lerJson, personagem } from "./hybrid_records.js";
import { retornoPendente as retornoEstudio } from "./character_studio.js";
import { viagemEmCurso } from "./hybrid_locations.js";
import { aoReanimar, aguardaResgate, resgateEmCurso } from "./revive.js";
import { creditarMissao, patenteDe } from "./stats.js";
import {
  DIFICULDADES, MISSAO_ID, REGRAS_MISSAO, descricaoOnda, patenteMinima, patenteValida,
} from "./missoes_catalogo.js";
import {
  DIM_ARENAS, arenaCompativel, arenas, caixaCarregamento, carregarArea, coordenadaValida, descarregarArea,
  destinoSeguro, dentro, comPontoCarregado, validarPontos,
} from "./missoes_arenas.js";
import { grupoDe, grupoDeSessao, jogadoresDoGrupo, liderDoGrupo } from "./missoes_grupos.js";
import { registrarTreinoRespiracao } from "./hybrid_mastery.js";

const PREFIXO = "kny:missao_s_";
const SEQ = "kny:missao_seq";
const FICHA = "kny:missao_historico";
const AUTOR = "kny:missao_arena_oficina";
const ATOR = "kny_missao_ator";
const ORIGEM_ATOR = "kny:missao_ator";
const sessoes = new Map();
const porJogador = new Map();
const atores = new Map();
const auxiliares = new Map();
const online = new Map();
const operacoes = new Set();
const EM_CURSO = new Set(["reservada", "preparo", "andamento"]);
const ATIVOS = new Set(["presente", "ausente", "abandonando"]);
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
let pronto = false;

const chaveSessao = (id) => PREFIXO + id;
const chaveArea = (s) => "kny_missao_arena_" + s.id;
const aviso = (p, msg) => { if (p?.isValid) p.sendMessage("§6[Missões] " + msg); };
const salvar = (s) => gravarJson(world, chaveSessao(s.id), s);
const arenaDaSessao = (s) => world.getDimension(s.arena.dim);
const jogador = (id) => online.get(id) ?? world.getPlayers().find((p) => idExistente(p) === id);
const etapa = (s) => MISSAO_ID.get(s.missao);
const areaJogador = (p, s) => p?.isValid && p.dimension.id === DIM_ARENAS && dentro(s.arena, p.location);

function arquivar(s) {
  const mensal = "kny:missao_aud_" + Math.floor(s.quando / 2592000000) + "_" + (s.id % 128);
  const anterior = lerJson(world, mensal)?.registros ?? [];
  const registro = {
    id: s.id, missao: s.missao, arena: s.arena.id, quando: s.quando, fim: s.fim,
    estado: s.estado, motivo: s.motivo,
    participantes: s.pessoas.map((a) => ({ id: a.id, nome: a.nome, estado: a.estado, peso: a.peso, participacao: a.participacao, premio: a.pago })),
  };
  gravarJson(world, mensal, { v: 1, registros: [registro, ...anterior.filter((x) => x.id !== s.id)].slice(0, 8) });
  world.setDynamicProperty(chaveSessao(s.id), undefined);
  sessoes.delete(s.id);
}

export function operacaoMissao(p) {
  const s = porJogador.get(idExistente(p));
  return s ? { s, a: s.pessoas.find((a) => a.id === idExistente(p)) } : undefined;
}

export function missaoEmAndamento(p) {
  const s = operacaoMissao(p)?.s;
  return !!s && EM_CURSO.has(s.estado);
}

export function sessaoDaArena(id) {
  return [...sessoes.values()].find((s) => s.arena.id === id && !s.limpa);
}

export function consultarAuditoriaMissoes(staff) {
  if (!ehStaff(staff)) return [];
  return world.getDynamicPropertyIds().filter((chave) => chave.startsWith("kny:missao_aud_"))
    .flatMap((chave) => lerJson(world, chave)?.registros ?? [])
    .sort((a, b) => b.fim - a.fim).slice(0, 30);
}

export function fichaMissoes(p) {
  const bruto = lerJson(p, FICHA);
  return bruto === undefined ? { v: 1, marcas: {}, historico: [] } : bruto?.marcas && Array.isArray(bruto.historico) ? bruto : null;
}

function indisponivel(p) {
  return estadoBloqueado(p) || resgateEmCurso(p) || aguardaResgate(p.id) || retornoEstudio(p) || viagemEmCurso(p) ||
    personagem(p) === null || personagem(p)?.estado === "transformando" || p.getProperty("kny:h_ocupado") || ["creative", "spectator"].includes(modoDeJogo(p)) || p.dimension.id === DIM_ARENAS;
}

export function impedimentoMissao(p, m, sessao) {
  if (!p?.isValid || !m || getTrueRace(p) !== m.raca) return "A linhagem atual não pertence a esta missão.";
  if (!patenteValida(m, patenteDe(p))) return "Patente mínima: " + patenteMinima(m).nome + ".";
  if (indisponivel(p)) return "Você precisa estar em sobrevivência ou aventura, livre de viagens, resgates e ações em curso.";
  if (emCombate(p)) return "Aguarde o fim do combate antes de entrar.";
  const outra = operacaoMissao(p)?.s;
  if (outra && outra !== sessao) return "Você já tem uma sessão ou retorno pendente.";
  const f = fichaMissoes(p);
  if (!f) return "Histórico incompatível. Consulte a Staff.";
  if (m.anterior && !f.marcas[m.anterior]?.vitorias) return "Conclua " + MISSAO_ID.get(m.anterior).nome + ".";
  const marca = f.marcas[m.id];
  if (!m.cooldown && marca?.vitorias) return "Missão concluída.";
  if ((marca?.ate ?? 0) > Date.now()) return "Disponível em " + Math.ceil((marca.ate - Date.now()) / 1000) + " s.";
  return undefined;
}

export function arenasPara(m, tamanho) {
  const todas = arenas();
  return todas.filter((a) => arenaCompativel(a, m, tamanho, todas)).map((a) => ({ a, sessao: sessaoDaArena(a.id) }));
}

function criarSessao(m, a, jogadores, grupo) {
  const id = (world.getDynamicProperty(SEQ) ?? 0) + 1;
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Sequência de missões inválida.");
  const s = {
    v: 1, id, missao: m.id, arena: a, grupo: grupo?.lider, quando: Date.now(), estado: "reservada", onda: 0,
    feitos: 0, total: m.ondas.reduce((n, o) => n + descricaoOnda(o, jogadores.length).length, 0),
    pessoas: jogadores.map((p) => ({
      id: identificador(p), nome: p.name, estado: "presente", movido: false, retornou: false, peso: 0, apoio: [],
      origem: { dim: p.dimension.id, pos: p.location, rot: p.getRotation() },
    })),
  };
  world.setDynamicProperty(SEQ, id);
  salvar(s);
  sessoes.set(id, s);
  for (const membro of s.pessoas) porJogador.set(membro.id, s);
  if (grupo) grupo.sessao = id;
  return s;
}

export async function iniciarMissao(p, id, modo, listaConfirmada) {
  const m = MISSAO_ID.get(id);
  if (!pronto || !m || !p?.isValid) return "O quadro de missões está carregando.";
  const g = modo === "grupo" ? grupoDe(p) : undefined;
  if (modo === "grupo" && (!liderDoGrupo(p, g) || g.sessao || g.membros.size < 2)) return "A preparação exige um grupo com líder e pelo menos dois integrantes.";
  const jogadores = g ? jogadoresDoGrupo(g) : [p];
  if ((g && jogadores.length !== g.membros.size) || jogadores.length > m.maxGrupo ||
      (g && listaConfirmada?.join(",") !== [...g.membros.keys()].join(","))) return "A lista do grupo mudou ou excede a capacidade. Confira e confirme novamente.";
  for (const q of jogadores) {
    const erro = impedimentoMissao(q, m);
    if (erro) return q.name + " · " + erro;
  }
  const opcoes = arenasPara(m, jogadores.length);
  const escolha = opcoes.find(({ sessao }) => !sessao);
  if (!escolha) return opcoes.length ? "Todas as arenas compatíveis estão ocupadas." : "Nenhuma arena compatível foi cadastrada pela Staff.";
  if ([...sessoes.values()].filter((sessao) => !sessao.limpa).length >= REGRAS_MISSAO.sessoesMaximas) {
    return "O servidor atingiu o limite de arenas simultâneas.";
  }
  const s = criarSessao(m, escolha.a, jogadores, g);
  operacoes.add(s.id);
  try {
    await carregarArea(chaveArea(s), caixaCarregamento(s.arena));
    if (s.estado !== "reservada") return "A reserva foi cancelada.";
    if (!validarPontos(s.arena)) throw new Error("Uma entrada, objetivo ou spawn está obstruído ou inseguro.");
    const dim = arenaDaSessao(s);
    if (dim.getPlayers().some((q) => dentro(s.arena, q.location, 4))) throw new Error("Há um jogador na região da arena.");
    const { dim: dimSaida, pos: saida } = s.arena.saida;
    const saidaValida = await comPontoCarregado("kny_missao_saida_" + s.id, world.getDimension(dimSaida), saida, () =>
      destinoSeguro(world.getDimension(dimSaida), saida));
    if (!saidaValida || s.estado !== "reservada") throw new Error("A saída configurada está obstruída, insegura ou a reserva foi cancelada.");
    limparEntidades(s, false);
    for (const q of jogadores) {
      const erro = impedimentoMissao(q, m, s);
      if (erro) throw new Error(q.name + " · " + erro);
    }
    for (const [i, q] of jogadores.entries()) {
      const membro = s.pessoas[i];
      if (idExistente(q) !== membro.id) throw new Error("A identidade de um integrante mudou.");
      membro.origem = { dim: q.dimension.id, pos: q.location, rot: q.getRotation() };
      membro.movido = true;
      salvar(s);
      if (!q.tryTeleport(s.arena.entradas[i], { dimension: dim, checkForBlocks: true, keepVelocity: false })) {
        throw new Error("Falha ao posicionar " + q.name + ".");
      }
    }
    s.estado = "preparo";
    s.comeca = Date.now() + REGRAS_MISSAO.preparoMs;
    salvar(s);
    for (const q of jogadores) aviso(q, `§e${m.nome} §7· Rank ${m.dificuldade} · Prepare-se.`);
    return undefined;
  } catch (e) {
    encerrar(s, "cancelada", String(e.message ?? e).slice(0, 200));
    return s.motivo;
  } finally {
    operacoes.delete(s.id);
  }
}

function localizarSessao(pos, margem = 0) {
  for (const s of sessoes.values()) if (!s.limpa && dentro(s.arena, pos, margem)) return s;
  return undefined;
}

function registrarAtor(s, tipo, pos, protegido) {
  const evento = protegido ? "kny:missao_proteger" : "kny:missao_spawn";
  const e = arenaDaSessao(s).spawnEntity(tipo, pos, { initialPersistence: true, spawnEvent: evento });
  e.addTag(ATOR);
  if (protegido) e.addTag("kny_missao_protegido");
  auxiliares.delete(e.id);
  gravarJson(e, ORIGEM_ATOR, { v: 1, id: s.id, missao: s.missao, arena: s.arena.id, onda: s.onda, protegido });
  const vida = e.getComponent("minecraft:health")?.effectiveMax;
  if (!Number.isFinite(vida) || vida <= 0) throw new Error("Entidade sem vida válida: " + tipo);
  const ator = { e, s, tipo, protegido, pos, vida, onda: s.onda, credito: 0, dano: new Map(), ultimaAcao: 0 };
  if (!protegido) s.vidaInimigos = (s.vidaInimigos ?? 0) + vida;
  atores.set(e.id, ator);
  return ator;
}

function prepararOnda(s) {
  const m = etapa(s);
  const o = m.ondas[s.onda];
  if (!o) return;
  const tipos = descricaoOnda(o, s.pessoas.length);
  s.restantes = tipos.length;
  for (let i = 0; i < tipos.length; i++) registrarAtor(s, tipos[i], s.arena.spawns[i], false);
  for (const a of s.pessoas) aviso(jogador(a.id), `§eOnda ${s.onda + 1}/${m.ondas.length} §7· ${tipos.length} inimigos.`);
}

function ativar(s, agora) {
  const m = etapa(s);
  if (!s.pessoas.every((a) => a.estado === "presente" && areaJogador(jogador(a.id), s) && !estadoBloqueado(jogador(a.id)))) {
    encerrar(s, "cancelada", "A preparação terminou sem todos os participantes na arena.");
    return;
  }
  s.estado = "andamento";
  s.inicio = agora;
  s.prazo = agora + m.duracao * 1000;
  if (m.protegido) registrarAtor(s, m.protegido, s.arena.objetivo, true);
  prepararOnda(s);
  salvar(s);
}

function atorHabilitado(ator) {
  return ator?.s.estado === "andamento" && (ator.protegido || ator.s.onda === ator.onda);
}

function jogadorEm(p, s, lutar = true) {
  if (p?.typeId !== "minecraft:player" || !areaJogador(p, s) || getTrueRace(p) !== etapa(s).raca) return false;
  const a = s.pessoas.find((x) => x.id === idExistente(p));
  return !!a && (a.estado === "presente" || a.estado === "abandonando") && (!lutar ||
    (!estadoBloqueado(p) && !["creative", "spectator"].includes(modoDeJogo(p))));
}

function fonte(ev) {
  const { damagingEntity, damagingProjectile } = ev.damageSource ?? {};
  if (damagingEntity?.typeId === "minecraft:player") return damagingEntity;
  const alvo = damagingProjectile ?? damagingEntity;
  try { return alvo?.getComponent("minecraft:projectile")?.owner ?? damagingEntity ?? damagingProjectile; }
  catch { return damagingEntity; }
}

function protegidoPorArena(e) {
  if (!e || e.dimension.id !== DIM_ARENAS) return undefined;
  return e.typeId === "minecraft:player" ? operacaoMissao(e)?.s : atores.get(e.id)?.s ?? localizarSessao(e.location);
}

world.beforeEvents.entityHurt.subscribe((ev) => {
  const alvo = ev.hurtEntity;
  const atacante = fonte(ev);
  if (alvo.dimension.id !== DIM_ARENAS && atacante?.dimension.id !== DIM_ARENAS) {
    if (atacante?.typeId === "minecraft:player" && missaoEmAndamento(atacante)) ev.cancel = true;
    return;
  }
  const s = protegidoPorArena(alvo);
  const ator = atores.get(alvo.id);
  if (!s || s.estado !== "andamento" || !dentro(s.arena, alvo.location)) {
    if (alvo.typeId === "minecraft:player" && !s && !alvo.getDynamicProperty(AUTOR) && !localizarSessao(alvo.location, 8) &&
        atacante?.dimension.id !== DIM_ARENAS) return;
    ev.cancel = true;
    return;
  }
  const agressor = atacante && atores.get(atacante.id);
  const mesmo = atacante && atacante.dimension.id === DIM_ARENAS && dentro(s.arena, atacante.location);
  if (alvo.typeId === "minecraft:player") {
    if (!jogadorEm(alvo, s, false) || atacante && (!mesmo || atacante.typeId === "minecraft:player" || agressor?.protegido)) ev.cancel = true;
    return;
  }
  if (ator) {
    if (!mesmo) { ev.cancel = true; return; }
    if (atacante.typeId === "minecraft:player") {
      if (ator.protegido || !jogadorEm(atacante, s)) ev.cancel = true;
    } else if (agressor && (agressor.s !== s || agressor.protegido === ator.protegido)) {
      ev.cancel = true;
    } else if (!agressor && auxiliares.get(atacante.id)?.s !== s) {
      ev.cancel = true;
    }
    return;
  }
  if (!mesmo || !jogadorEm(atacante, s)) ev.cancel = true;
});

world.afterEvents.entityHurt.subscribe((ev) => {
  const alvo = ev.hurtEntity;
  if (alvo.dimension.id !== DIM_ARENAS) return;
  const atacante = fonte(ev);
  const a = atores.get(alvo.id);
  if (alvo.typeId === "minecraft:player") {
    const atual = operacaoMissao(alvo);
    if (atual && atual.s.estado === "andamento") atual.a.ultimoDano = Date.now();
    return;
  }
  if (!a || a.protegido || !atacante || !jogadorEm(atacante, a.s) || !atorHabilitado(a)) return;
  const n = Math.max(0, Math.min(a.vida - a.credito, ev.damage));
  if (!Number.isFinite(n) || n <= 0) return;
  const id = idExistente(atacante);
  const membro = a.s.pessoas.find((x) => x.id === id);
  a.credito += n;
  a.dano.set(id, (a.dano.get(id) ?? 0) + n);
  a.ultimo = id;
  a.ultimaAcao = Date.now();
  membro.ultimoAtaque = a.ultimaAcao;
  membro.peso += n;
});

world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (e.typeId === "minecraft:player") {
    const atual = operacaoMissao(e);
    if (!atual || atual.s.estado !== "andamento") return;
    if (!aguardaResgate(e.id)) {
      atual.a.estado = "eliminado";
      salvar(atual.s);
    }
    return;
  }
  const ator = atores.get(e.id);
  if (!ator) return;
  atores.delete(e.id);
  const s = ator.s;
  if (s.estado !== "andamento") return;
  if (ator.protegido) {
    encerrar(s, "fracassada", "O personagem protegido foi derrotado.");
    return;
  }
  const atacante = fonte(ev);
  const direto = jogadorEm(atacante, s) ? idExistente(atacante) : undefined;
  const ultimo = direto ?? (Date.now() - ator.ultimaAcao <= 20000 ? ator.ultimo : undefined);
  if (!ultimo && !ator.dano.size) {
    encerrar(s, "fracassada", "Um alvo caiu sem combate validado entre participantes e inimigos.");
    return;
  }
  const membro = s.pessoas.find((x) => x.id === ultimo);
  if (membro) {
    membro.abates = (membro.abates ?? 0) + 1;
    const p = jogador(ultimo);
    if (p && etapa(s).raca === "cacador" && ator.tipo !== "kny:sabito" && ator.tipo !== "kny:tomioka") {
      registrarTreinoRespiracao(p, "oni", 1);
    }
  }
  s.feitos++;
  s.restantes--;
  salvar(s);
  if (s.restantes === 0 && s.onda + 1 === etapa(s).ondas.length && etapa(s).objetivo !== "sobreviver") {
    encerrar(s, "sucesso", "Objetivos cumpridos.");
  }
});

aoReanimar((quem, alvo) => {
  const atual = quem && operacaoMissao(quem);
  if (!atual || atual.s.estado !== "andamento" || !jogadorEm(quem, atual.s) || !jogadorEm(alvo, atual.s, false)) return;
  const id = idExistente(alvo);
  if (atual.a.apoio.includes(id)) return;
  atual.a.apoio.push(id);
  salvar(atual.s);
});

export function ratear(total, pesos, percentualIgual = REGRAS_MISSAO.percentualIgual) {
  const soma = pesos.reduce((a, b) => a + b, 0);
  if (!soma) return [];
  const cotas = pesos.map((peso, i) => {
    const exato = total * (percentualIgual / 100 / pesos.length + (1 - percentualIgual / 100) * peso / soma);
    return { i, valor: Math.floor(exato), fracao: exato % 1 };
  });
  const falta = total - cotas.reduce((n, c) => n + c.valor, 0);
  const ordem = [...cotas].sort((a, b) => b.fracao - a.fracao || a.i - b.i);
  for (let i = 0; i < falta; i++) ordem[i].valor++;
  return cotas.map((c) => c.valor);
}

function definirPremios(s) {
  const m = etapa(s);
  const totalDano = s.pessoas.reduce((n, a) => n + a.peso, 0);
  const pesos = s.pessoas.map((a) => m.objetivo === "local" ? 1 : a.peso + totalDano * Math.min(0.2, a.apoio.length * 0.1));
  const totalPesos = pesos.reduce((n, peso) => n + peso, 0);
  const baseEsforco = Math.max(totalPesos, s.vidaInimigos ?? 0);
  const aptos = s.pessoas.filter((a, i) => {
    a.participacao = totalPesos ? Math.round(pesos[i] / totalPesos * 100) : 0;
    a.contribuicao = pesos[i];
    return ["presente", "ausente"].includes(a.estado) && pesos[i] > 0 &&
      pesos[i] * 100 >= baseEsforco * REGRAS_MISSAO.percentualMinimo;
  });
  const w = aptos.map((a) => a.contribuicao);
  const base = DIFICULDADES[m.dificuldade];
  for (const [tipo, total] of [["pontos", base.pontos], ["patente", base.patente], ["dinheiro", base.dinheiro]]) {
    const valores = ratear(total, w);
    aptos.forEach((a, i) => { (a.premio ??= {})[tipo] = valores[i]; });
  }
}

function encerrar(s, estado, motivo) {
  if (!EM_CURSO.has(s.estado)) return false;
  if (estado === "sucesso" && s.estado !== "andamento") return false;
  if (estado === "sucesso") definirPremios(s);
  s.estado = estado;
  s.motivo = motivo;
  s.fim = Date.now();
  salvar(s);
  for (const a of s.pessoas) {
    const p = jogador(a.id);
    if (p?.isValid) aviso(p, (estado === "sucesso" ? "§a" : "§e") + etapa(s).nome + " · " + motivo);
  }
  const g = grupoDeSessao(s.grupo);
  if (g?.sessao === s.id) delete g.sessao;
  return true;
}

export function encerrarPelaStaff(id, staff) {
  const s = sessoes.get(id);
  if (!ehStaff(staff) || !s || !EM_CURSO.has(s.estado)) return false;
  return encerrar(s, "cancelada", "Sessão encerrada pela Staff (" + staff.name + ").");
}

export function abandonarMissao(p, id) {
  const atual = operacaoMissao(p);
  if (!atual || atual.s.id !== id || !EM_CURSO.has(atual.s.estado) || atual.a.estado !== "presente") return false;
  atual.a.estado = "abandonando";
  atual.a.desde = Date.now();
  salvar(atual.s);
  aviso(p, "§eAbandono solicitado. A saída ocorre após 10 s fora de combate e quando o resgate terminar.");
  return true;
}

function limparEntidades(s, terminar) {
  const dim = arenaDaSessao(s);
  for (const e of dim.getEntities()) {
    if (!e.isValid || e.typeId === "minecraft:player") continue;
    const dono = atores.get(e.id)?.s ?? auxiliares.get(e.id)?.s;
    if (dono === s || dentro(s.arena, e.location, 8)) {
      atores.delete(e.id);
      auxiliares.delete(e.id);
      e.remove();
    }
  }
  if (terminar) {
    descarregarArea(chaveArea(s));
    s.limpa = true;
    salvar(s);
  }
}

function gravarResultado(p, s, a) {
  if (a.resultado) return;
  const ficha = fichaMissoes(p);
  if (!ficha) return;
  const m = etapa(s);
  if (ficha.marcas[m.id]?.sessao === s.id) {
    a.resultado = true;
    a.pago = ficha.historico.find((x) => x.sessao === s.id)?.premio;
    salvar(s);
    return;
  }
  if (a.premio) {
    a.pago = creditarMissao(p, s.id, a.premio, m.raca);
    if (!a.pago) return;
  }
  const anterior = ficha.marcas[m.id]?.vitorias ?? 0;
  const sucesso = s.estado === "sucesso" && !!a.pago;
  const ate = sucesso ? s.fim + m.cooldown * 1000 : s.fim + (s.inicio ? REGRAS_MISSAO.cooldownFracassoMs : 0);
  const estado = sucesso ? "concluida" : s.estado === "sucesso" ? "sem_premio" : a.estado === "abandonou" ? "abandonada" : s.estado;
  const entrada = { sessao: s.id, missao: m.id, quando: s.fim, estado, motivo: s.motivo, participacao: a.participacao, premio: a.pago };
  gravarJson(p, FICHA, {
    v: 1, marcas: { ...ficha.marcas, [m.id]: { sessao: s.id, vitorias: anterior + Number(sucesso), ate } },
    historico: [entrada, ...ficha.historico].slice(0, 30),
  });
  if (sucesso && m.legado) p.addTag(m.legado);
  a.resultado = true;
  salvar(s);
  if (sucesso) {
    const b = a.pago;
    aviso(p, `§aConcluída · ${b.pontos} pontos de Stats + ${b.bonus} pela patente · ${b.patente} de ${m.raca === "cacador" ? "honra" : "maldição"} · ${b.dinheiro} de dinheiro. Veja o recibo em Histórico.`);
  } else if (estado === "sem_premio") {
    aviso(p, "§eO grupo venceu. Você não recebeu prêmio por abandono, eliminação ou contribuição abaixo do mínimo.");
  }
}

async function retornar(p, s, a) {
  if (a.retornou || !p?.isValid || estadoBloqueado(p) || aguardaResgate(p.id) || resgateEmCurso(p)) return;
  if (operacoes.has("p" + a.id)) return;
  operacoes.add("p" + a.id);
  try {
    let ok = !a.movido || (a.estado === "eliminado" && p.dimension.id !== DIM_ARENAS);
    for (const local of ok ? [] : [a.origem, s.arena.saida]) {
      const dim = world.getDimension(local.dim);
      const pos = local.pos;
      if (await comPontoCarregado("kny_missao_volta_" + a.id, dim, pos, () =>
        p.isValid && !estadoBloqueado(p) && !resgateEmCurso(p) && destinoSeguro(dim, pos) &&
        p.tryTeleport(pos, { dimension: dim, rotation: local.rot, checkForBlocks: true, keepVelocity: false }))) {
        ok = true;
        break;
      }
    }
    if (!ok && p.isValid) {
      if (!a.alertaRetorno) {
        a.alertaRetorno = true;
        aviso(p, "§eRetorno pendente. A origem e a saída estão bloqueadas. Informe a Staff.");
        salvar(s);
      }
      return;
    }
    a.retornou = true;
    salvar(s);
    if (a.resultado && porJogador.get(a.id) === s) porJogador.delete(a.id);
  } finally {
    operacoes.delete("p" + a.id);
  }
}

async function fechar(s) {
  if (operacoes.has(s.id)) return;
  operacoes.add(s.id);
  try {
    if (!s.limpa) {
      await carregarArea(chaveArea(s), caixaCarregamento(s.arena));
      limparEntidades(s, true);
    }
    for (const a of s.pessoas) {
      const p = jogador(a.id);
      if (!p?.isValid) continue;
      gravarResultado(p, s, a);
      if (a.retornou && a.resultado && porJogador.get(a.id) === s) porJogador.delete(a.id);
      if (!a.retornou) void retornar(p, s, a).catch(log);
    }
    if (s.pessoas.every((a) => a.resultado && a.retornou)) arquivar(s);
  } finally {
    operacoes.delete(s.id);
  }
}

function atualizarPessoas(s, agora) {
  let mudou = false;
  for (const [i, a] of s.pessoas.entries()) {
    const p = jogador(a.id);
    if (a.estado === "abandonando") {
      if (p && (estadoBloqueado(p) || resgateEmCurso(p) || aguardaResgate(p.id) || emCombate(p) || agora - (a.ultimoDano ?? 0) < REGRAS_MISSAO.combateMs ||
          agora - (a.ultimoAtaque ?? 0) < REGRAS_MISSAO.combateMs)) continue;
      if (agora - a.desde >= REGRAS_MISSAO.combateMs) {
        a.estado = "abandonou";
        mudou = true;
      }
    }
    if (!ATIVOS.has(a.estado)) {
      if (p && !a.retornou) void retornar(p, s, a).catch(log);
      continue;
    }
    if (!p?.isValid) {
      if (a.estado === "presente") { a.estado = "ausente"; a.desde = agora; mudou = true; }
      if (agora - (a.desde ?? agora) >= REGRAS_MISSAO.desconexaoMs) { a.estado = "abandonou"; mudou = true; }
      continue;
    }
    if (a.estado === "ausente") {
      if (agora - a.desde >= REGRAS_MISSAO.desconexaoMs) { a.estado = "abandonou"; mudou = true; continue; }
      a.estado = "presente";
      mudou = true;
    }
    if (["creative", "spectator"].includes(modoDeJogo(p)) || getTrueRace(p) !== etapa(s).raca) {
      a.estado = "abandonou";
      mudou = true;
      continue;
    }
    if (!areaJogador(p, s) && !estadoBloqueado(p) && !aguardaResgate(p.id)) {
      const ok = p.tryTeleport(s.arena.entradas[i], { dimension: arenaDaSessao(s), checkForBlocks: true, keepVelocity: false });
      if (!ok) { a.estado = "abandonou"; mudou = true; }
    }
  }
  if (mudou) salvar(s);
  return s.pessoas.some((a) => ATIVOS.has(a.estado));
}

function vigiar(s, agora) {
  if (s.estado === "reservada") return;
  if (!atualizarPessoas(s, agora)) {
    encerrar(s, "fracassada", "Nenhum participante resta na arena.");
    return;
  }
  if (s.estado === "preparo") {
    if (agora >= s.comeca) ativar(s, agora);
    return;
  }
  const m = etapa(s);
  if (agora >= s.prazo) {
    encerrar(s, "fracassada", "O tempo acabou.");
    return;
  }
  if (m.objetivo === "local" && s.pessoas.some((a) => {
    const p = jogador(a.id);
    return jogadorEm(p, s) && distancia(p.location, s.arena.objetivo) < 2;
  })) {
    encerrar(s, "sucesso", "Localização alcançada.");
    return;
  }
  if (m.objetivo === "sobreviver" && s.feitos === s.total && agora - s.inicio >= m.sobrevida * 1000 &&
      s.pessoas.some((a) => jogadorEm(jogador(a.id), s))) {
    encerrar(s, "sucesso", "Ondas vencidas e tempo de sobrevivência cumprido.");
    return;
  }
  if (s.restantes === 0 && s.onda + 1 < m.ondas.length) {
    s.onda++;
    prepararOnda(s);
    salvar(s);
  }
  for (const { e, s: dono, pos, protegido } of atores.values()) {
    if (dono !== s) continue;
    if (!e.isValid || e.dimension.id !== DIM_ARENAS) {
      encerrar(s, "fracassada", "Uma entidade necessária desapareceu da arena.");
      return;
    }
    if (!dentro(s.arena, e.location)) e.teleport(pos, { dimension: arenaDaSessao(s), keepVelocity: false });
    if (protegido && e.location.y < pos.y - 8) e.teleport(pos, { dimension: arenaDaSessao(s), keepVelocity: false });
  }
}

function log(e) {
  console.warn("[Missões v81] " + e);
}

function poll() {
  const agora = Date.now();
  online.clear();
  for (const p of world.getPlayers()) {
    const id = idExistente(p);
    if (id) online.set(id, p);
  }
  for (const s of sessoes.values()) {
    try {
      if (!EM_CURSO.has(s.estado)) void fechar(s).catch(log);
      else vigiar(s, agora);
    } catch (e) {
      log(e);
      encerrar(s, "fracassada", "A sessão perdeu uma condição necessária.");
    }
  }
}

export const entidadeDeMissao = (e) => e?.dimension?.id === DIM_ARENAS || e?.hasTag?.(ATOR);

export function progressoSessao(s) {
  const m = etapa(s);
  const agora = Date.now();
  if (s.estado === "reservada") return "Arena reservada · carregando";
  if (s.estado === "preparo") return "Início em " + Math.max(1, Math.ceil((s.comeca - agora) / 1000)) + " s";
  if (s.estado !== "andamento") return s.motivo;
  const tempo = Math.max(0, Math.ceil((s.prazo - agora) / 1000));
  if (m.objetivo === "local") return `Alcance o ponto sinalizado §8· §e${tempo}s`;
  const sobrevida = m.sobrevida ? ` §8· §7Sobreviva ${Math.max(0, Math.ceil(m.sobrevida - (agora - s.inicio) / 1000))}s` : "";
  return `Onda ${s.onda + 1}/${m.ondas.length} §8· §f${s.feitos}/${s.total}${sobrevida} §8· §e${tempo}s`;
}

function marcarAmbiente() {
  for (const [id, { e, s }] of auxiliares) {
    if (!e.isValid) {
      auxiliares.delete(id);
      continue;
    }
    if (s.estado !== "andamento" || e.dimension.id !== DIM_ARENAS || !dentro(s.arena, e.location) || e.typeId === "minecraft:item") {
      auxiliares.delete(id);
      e.remove();
    }
  }
}

world.afterEvents.entitySpawn?.subscribe(({ entity: e }) => {
  if (!e.isValid || e.typeId === "minecraft:player" || e.dimension.id !== DIM_ARENAS || atores.has(e.id)) return;
  const s = localizarSessao(e.location);
  if (s?.estado !== "andamento") return;
  const total = [...atores.values(), ...auxiliares.values()].filter((a) => a.s === s).length;
  if (total >= REGRAS_MISSAO.tetoAtores || e.typeId === "minecraft:item") {
    e.remove();
    return;
  }
  auxiliares.set(e.id, { e, s });
  if (!e.hasTag(ATOR)) {
    e.addTag(ATOR);
    gravarJson(e, ORIGEM_ATOR, { v: 1, id: s.id, missao: s.missao, arena: s.arena.id, onda: s.onda, auxiliar: true });
  }
});

world.afterEvents.entityLoad?.subscribe(({ entity: e }) => {
  if (e.typeId === "minecraft:player" || e.dimension.id !== DIM_ARENAS || !e.hasTag(ATOR)) return;
  system.run(() => {
    if (pronto && e.isValid && !atores.has(e.id) && !auxiliares.has(e.id)) e.remove();
  });
});

function restaurar() {
  for (const chave of world.getDynamicPropertyIds()) {
    if (!chave.startsWith(PREFIXO)) continue;
    const s = lerJson(world, chave);
    if (!s?.pessoas?.length || !etapa(s) || !coordenadaValida(s.arena?.a) || s.arena.dim !== DIM_ARENAS) {
      console.warn("[Missões v81] Sessão incompatível em " + chave);
      continue;
    }
    sessoes.set(s.id, s);
    for (const a of s.pessoas) if (!a.retornou || !a.resultado) porJogador.set(a.id, s);
    if (EM_CURSO.has(s.estado)) encerrar(s, "cancelada", "Sessão interrompida pela reinicialização do servidor.");
  }
  pronto = true;
}

system.run(() => {
  try { restaurar(); } catch (e) { log(e); }
});

system.runInterval(() => {
  if (!pronto) return;
  poll();
  try { if (sessoes.size) marcarAmbiente(); }
  catch (e) { log(e); }
}, 10);

system.runInterval(() => {
  if (!pronto) return;
  for (const p of world.getPlayers()) {
    const atual = operacaoMissao(p);
    if (!atual || !EM_CURSO.has(atual.s.estado) || !ATIVOS.has(atual.a.estado) || estadoBloqueado(p) || !areaJogador(p, atual.s)) continue;
    const s = atual.s;
    const m = etapa(s);
    p.onScreenDisplay.setActionBar(`§6${m.nome} §8· §c${m.dificuldade} §8| §f${progressoSessao(s)}`);
    if (s.estado === "andamento" && m.objetivo === "local") {
      try { p.spawnParticle("minecraft:basic_flame_particle", { ...s.arena.objetivo, y: s.arena.objetivo.y + 1 }); } catch {}
    }
  }
}, 20);

export const origemOficina = (p) => lerJson(p, AUTOR);

export async function irOficina(p, pos, podeEditar) {
  if (!coordenadaValida(pos) || !podeEditar() || operacaoMissao(p) || estadoBloqueado(p) || emCombate(p)) return false;
  if ([...sessoes.values()].some((s) => !s.limpa && dentro(s.arena, pos, 16))) return false;
  const dim = world.getDimension(DIM_ARENAS);
  const id = identificador(p);
  const acao = "oficina:" + id;
  if (operacoes.has(acao)) return false;
  operacoes.add(acao);
  return comPontoCarregado("kny_missao_oficina_" + id, dim, pos, () => {
    if (!p.isValid || !podeEditar() || operacaoMissao(p) || localizarSessao(pos, 16)) return false;
    if (!origemOficina(p)) gravarJson(p, AUTOR, { v: 1, dim: p.dimension.id, pos: p.location, rot: p.getRotation() });
    return p.tryTeleport(pos, { dimension: dim, keepVelocity: false });
  }).finally(() => operacoes.delete(acao));
}

export async function sairOficina(p) {
  const antiga = origemOficina(p);
  if (!antiga || !p.isValid || estadoBloqueado(p)) return false;
  const dim = world.getDimension(antiga.dim);
  const id = identificador(p);
  const acao = "oficina:" + id;
  if (operacoes.has(acao)) return false;
  operacoes.add(acao);
  return comPontoCarregado("kny_missao_oficina_" + id, dim, antiga.pos, () => {
    if (!p.isValid || !destinoSeguro(dim, antiga.pos) ||
        !p.tryTeleport(antiga.pos, { dimension: dim, rotation: antiga.rot, checkForBlocks: true, keepVelocity: false })) return false;
    p.setDynamicProperty(AUTOR, undefined);
    return true;
  }).finally(() => operacoes.delete(acao));
}

function oficinaPermitida(p, pos) {
  const dim = p.dimension.id;
  return dim !== DIM_ARENAS || (ehStaff(p) && origemOficina(p) && !localizarSessao(pos, 4));
}

world.beforeEvents.playerBreakBlock?.subscribe((ev) => { if (!oficinaPermitida(ev.player, ev.block.location)) ev.cancel = true; });
world.beforeEvents.playerPlaceBlock?.subscribe((ev) => { if (!oficinaPermitida(ev.player, ev.block.location)) ev.cancel = true; });
world.beforeEvents.playerInteractWithBlock?.subscribe((ev) => { if (!oficinaPermitida(ev.player, ev.block.location)) ev.cancel = true; });
world.beforeEvents.explosion?.subscribe((ev) => {
  if (ev.dimension.id === DIM_ARENAS) ev.setImpactedBlocks([]);
});
world.beforeEvents.playerInteractWithEntity?.subscribe((ev) => {
  if (ev.player.dimension.id === DIM_ARENAS && ev.target.typeId !== "minecraft:player") ev.cancel = true;
});

system.runInterval(() => {
  if (!pronto) return;
  for (const p of world.getPlayers()) {
    if (p.dimension.id !== DIM_ARENAS || operacaoMissao(p)) continue;
    const s = localizarSessao(p.location, 8);
    if (ehStaff(p) && origemOficina(p) && !s) continue;
    if (origemOficina(p)) { void sairOficina(p).catch(log); continue; }
    if (estadoBloqueado(p) || operacoes.has(p.id)) continue;
    const dim = world.getDimension("overworld");
    const pos = world.getDefaultSpawnLocation();
    operacoes.add(p.id);
    void comPontoCarregado("kny_missao_visitante_" + identificador(p), dim, pos, () => {
      if (!p.isValid || p.dimension.id !== DIM_ARENAS || operacaoMissao(p)) return;
      const topo = dim.getTopmostBlock(pos);
      const ponto = topo ? { ...topo.location, x: topo.location.x + 0.5, y: topo.location.y + 1, z: topo.location.z + 0.5 } : pos;
      if (destinoSeguro(dim, ponto)) p.tryTeleport(ponto, { dimension: dim, checkForBlocks: true, keepVelocity: false });
    }).catch(log).finally(() => operacoes.delete(p.id));
  }
}, 20);
