import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { DOMINAVEL, RESP_H, RESP_H_ID } from "./hybrid_config.js";
import { ehStaff, getTrueRace } from "./hybrid_system.js";
import { idExistente, registrarAuditoria } from "./hybrid_records.js";
import {
  aprendizadoAtivo, atribuirAprendizado, cancelarAprendizado, historicoAprendizado, podeAtribuirAprendizado,
  podeSerAluno, progressoAprendizado, progressoDominio, registrosAprendizado, requisitosProximaForma,
} from "./hybrid_mastery.js";
import { textoTreinoDaForma } from "./treino_respiracao.js";
import {
  CATALOGO_MISSOES, CATEGORIAS, DIFICULDADES, MISSAO_ID, TIPOS_OBJETIVO, patenteMinima, picoInimigos,
} from "./missoes_catalogo.js";
import {
  abandonarMissao, arenasPara, consultarAuditoriaMissoes, encerrarPelaStaff, fichaMissoes, impedimentoMissao,
  iniciarMissao, irOficina, missaoEmAndamento, operacaoMissao, progressoSessao, sairOficina, sessaoDaArena,
} from "./missoes_sessoes.js";
import {
  convitePendente, convidar, criarGrupo, grupoDe, liderDoGrupo, responderConvite, sairDoGrupo,
} from "./missoes_grupos.js";
import {
  DIM_ARENAS, arenas, criarArena, destinoSeguro, erroArena, gravarArena, novoLocal, pegarArena,
} from "./missoes_arenas.js";
import { patenteDe } from "./stats.js";

const POR_PAGINA = 6;
const MARCA = "kny_miss|";
const falha = (p, t) => { if (p.isValid && t) p.sendMessage("§e[Missões] " + t); };
const linha = (titulo, detalhe, acao, tipo = acao ? "QA:" : "QI:") => ({
  texto: `§l§f${titulo}${detalhe ? "\n§r§7" + detalhe : ""}`, acao, tipo,
});

async function quadro(ctx, titulo, resumo, linhas, voltar = ctx.voltar, pagina = 0, classico = ctx.p.hasTag("kny_cfg_classico")) {
  const { p, mostrar } = ctx;
  if (!p.isValid) return;
  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  const atual = Math.max(0, Math.min(pagina, paginas - 1));
  const c = paginas > 1 ? `  §8· §7${atual + 1}/${paginas}` : "";
  const form = new ActionFormData().title((classico ? "§6" : MARCA) + "§l" + titulo).body(classico ? resumo + c : " ");
  const acoes = [];
  const add = (tipo, texto, acao) => {
    form.button((classico ? "" : tipo) + texto);
    acoes.push(acao);
  };
  add("B:", "§6§l< VOLTAR", voltar);
  if (!classico && (resumo || c)) add("H:", "§7" + resumo + c);
  const inicio = atual * POR_PAGINA;
  for (const l of linhas.slice(inicio, inicio + POR_PAGINA)) add(l.tipo, l.texto, l.acao);
  if (atual > 0) add("NP:", "§6< ANTERIOR", () => quadro(ctx, titulo, resumo, linhas, voltar, atual - 1, classico));
  if (atual < paginas - 1) add("NN:", "§6PRÓXIMA >", () => quadro(ctx, titulo, resumo, linhas, voltar, atual + 1, classico));
  const r = await mostrar(form, p);
  if (!classico && r.canceled && r.cancelationReason === undefined) return quadro(ctx, titulo, resumo, linhas, voltar, atual, true);
  if (r.canceled) return;
  const acao = acoes[r.selection];
  if (acao) return acao();
  return quadro(ctx, titulo, resumo, linhas, voltar, atual, classico);
}

const abrir = (p, mostrar, voltar) => {
  const ctx = { p, mostrar, voltar: () => voltar(p) };
  return ctx;
};

export const abrirMissoes = (p, mostrar, voltar) => inicio(abrir(p, mostrar, voltar));
export const abrirAprendizado = (p, mostrar, voltar) => painelLider(abrir(p, mostrar, voltar));

function inicio(ctx) {
  const { p } = ctx;
  const atual = operacaoMissao(p);
  const convite = convitePendente(p);
  const raca = getTrueRace(p);
  const itens = [];
  if (atual) itens.push(linha("Sessão atual", progressoSessao(atual.s), () => sessaoAtual(ctx), "Q1:"));
  const m = aprendizadoAtivo(p);
  itens.push(linha("Aprendizado de respirações", m ? `${RESP_H_ID.get(m.resp).nome} · ${m.forma}ª forma` : "Consulte suas formas e atribuições", () => aprendizadoAluno(ctx, m)));
  for (const [id, nome] of Object.entries(CATEGORIAS)) {
    const qtd = CATALOGO_MISSOES.filter((m) => m.raca === raca && m.categoria === id).length;
    if (qtd) itens.push(linha(nome, `${qtd} desafios`, () => categoria(ctx, id)));
  }
  itens.push(linha("Grupo", convite ? "Convite de " + convite.nome : "Convites e participantes", () => painelGrupo(ctx)));
  itens.push(linha("Histórico e conquistas", "Resultados, recibos e marcos", () => historico(ctx)));
  if (podeAtribuirAprendizado(p)) itens.push(linha("Painel do Líder dos Hashiras", undefined, () => painelLider(ctx, () => inicio(ctx))));
  if (ehStaff(p)) itens.push(linha("Administração de arenas", undefined, () => listarArenas(ctx)));
  return quadro(ctx, "QUADRO DE MISSÕES", patenteDe(p).nome, itens);
}

function categoria(ctx, id) {
  const { p } = ctx;
  const f = fichaMissoes(p);
  const itens = CATALOGO_MISSOES.filter((m) => m.raca === getTrueRace(p) && m.categoria === id).map((m) => {
    const salvo = f?.marcas[m.id];
    const feitas = salvo?.vitorias ?? 0;
    const erro = impedimentoMissao(p, m);
    let status = erro ?? (arenasPara(m, 1).some(({ sessao }) => !sessao) ? "Disponível" : "Arena indisponível");
    if (!m.cooldown && feitas) status = "Concluída";
    const tipo = status === "Concluída" ? "QB:" : status === "Disponível" ? "QA:" : "QI:";
    return linha(`${m.dificuldade} · ${m.nome}`, status, () => cartao(ctx, m), tipo);
  });
  return quadro(ctx, CATEGORIAS[id].toUpperCase(), "Selecione uma missão", itens, () => inicio(ctx));
}

function textoObjetivo(m) {
  if (m.objetivo === "local") return "Chegue ao marco sinalizado no interior da arena.";
  if (m.objetivo === "proteger") return `Mantenha ${m.protegido.replace("kny:", "")} vivo até derrotar os inimigos.`;
  if (m.objetivo === "sobreviver") return `Vença as ondas e sobreviva pelo menos ${m.sobrevida} segundos.`;
  if (m.objetivo === "ondas") return `Vença ${m.ondas.length} ondas na ordem.`;
  if (m.objetivo === "chefe") return "Derrote o chefe e todos os reforços da missão.";
  return "Derrote as entidades vinculadas à missão.";
}

function cartao(ctx, m) {
  const { p } = ctx;
  const g = grupoDe(p);
  const marca = fichaMissoes(p)?.marcas[m.id];
  const erro = impedimentoMissao(p, m);
  const valores = DIFICULDADES[m.dificuldade];
  const label = marca?.vitorias && m.cooldown ? "Fazer novamente" : "Fazer";
  const itens = [
    linha(TIPOS_OBJETIVO[m.objetivo], textoObjetivo(m)),
    linha("Recompensas do desafio", `${valores.pontos} Stats · ${valores.patente} ${m.raca === "cacador" ? "honra" : "maldição"} · ${valores.dinheiro} dinheiro`),
    linha("Requisitos", patenteMinima(m).nome + (m.anterior ? " · " + MISSAO_ID.get(m.anterior).nome : "")),
    linha("Duração e repetição", `${Math.ceil(m.duracao / 60)} min · ${m.cooldown ? "nova tentativa após " + m.cooldown / 60 + " min" : "conclusão única"}`),
  ];
  if (erro) itens.push(linha("Situação", erro));
  else {
    const vagas = arenasPara(m, 1);
    itens.push(linha(label + " · Individual", vagas.some(({ sessao }) => !sessao) ? "Consulte a preparação" : "Arena indisponível", () => confirmarMissao(ctx, m, "solo")));
    if (m.maxGrupo > 1 && g?.membros.size > 1 && liderDoGrupo(p, g)) itens.push(linha(label + " · Grupo", "Todos os integrantes precisam cumprir os requisitos", () => confirmarMissao(ctx, m, "grupo")));
  }
  return quadro(ctx, m.nome, `Rank ${m.dificuldade} · ${valores.nome}`, itens, () => categoria(ctx, m.categoria));
}

function confirmarMissao(ctx, m, modo) {
  const g = modo === "grupo" ? grupoDe(ctx.p) : undefined;
  const ids = g && [...g.membros.keys()];
  const nomes = g ? [...g.membros.values()].join(", ") : ctx.p.name;
  const vagas = arenasPara(m, ids?.length ?? 1);
  return quadro(ctx, "CONFIRMAR MISSÃO", `Rank ${m.dificuldade} · ${m.nome}`, [
    linha("Participantes", nomes),
    linha("Inimigos simultâneos", String(picoInimigos(m, ids?.length ?? 1))),
    linha("Arena", vagas.find(({ sessao }) => !sessao)?.a.nome ?? "Sem vaga compatível"),
    linha("Confirmar entrada", "Reserve a arena e inicie o teletransporte", async () => {
      const erro = await iniciarMissao(ctx.p, m.id, modo, ids);
      if (erro) { falha(ctx.p, erro); return cartao(ctx, m); }
    }, "Q0:"),
  ], () => cartao(ctx, m));
}

function sessaoAtual(ctx) {
  const op = operacaoMissao(ctx.p);
  if (!op) return inicio(ctx);
  const m = MISSAO_ID.get(op.s.missao);
  const itens = [
    linha("Objetivo", progressoSessao(op.s)),
    linha("Arena", op.s.arena.nome),
    linha("Sua participação", `${Math.round(op.a.peso)} de dano validado · ${op.a.apoio.length} ações de resgate`),
  ];
  if (missaoEmAndamento(ctx.p) && op.a.estado === "presente") itens.push(linha("Abandonar missão", "A saída aguarda o fim do combate", () =>
    quadro(ctx, "CONFIRMAR ABANDONO", m.nome, [
      linha("Abandonar", "Sua participação fica inelegível para recompensa", () => {
        if (!abandonarMissao(ctx.p, op.s.id)) falha(ctx.p, "A sessão mudou.");
      }),
    ], () => sessaoAtual(ctx))));
  return quadro(ctx, m.nome, `Rank ${m.dificuldade}`, itens, () => inicio(ctx));
}

const TAGS_HISTORICAS = [
  ["m1", "Montanha Sagiri"], ["m2", "Sabito"], ["m3", "Demônio das Mãos"], ["m4", "Natagumo"],
  ["m5", "Rui"], ["m6", "Enmu"], ["m7", "Akaza"],
  ...["water", "insect", "flame", "sound", "mist", "love", "serpent", "wind", "stone"]
    .map((t, i) => ["training_" + t, "Treino · " + ["Água", "Inseto", "Chamas", "Som", "Névoa", "Amor", "Serpente", "Vento", "Pedra"][i]]),
  ...["Kamanue", "Rui", "Mukago", "Wakuraba", "Rokuro", "Enmu"].map((n, i) => ["blood" + (6 - i), "Batalha · " + n]),
  ...["Gyutaro", "Gyokko", "Zohakuten", "Akaza", "Doma", "Kokushibo"].map((n, i) => ["bloodupper" + (6 - i), "Batalha · " + n]),
];

const estados = { concluida: "Concluída", sem_premio: "Encerrada sem prêmio", fracassada: "Fracassada", cancelada: "Cancelada", abandonada: "Abandonada" };

function historico(ctx) {
  const { p } = ctx;
  const ficha = fichaMissoes(p);
  const feitos = ficha?.historico ?? [];
  const itens = [
    linha("Conquistas e marcos", "Registros anteriores e marcos do personagem", () => conquistas(ctx)),
    ...feitos.map((e) => linha(MISSAO_ID.get(e.missao)?.nome ?? e.missao, estados[e.estado] + " · Sessão " + e.sessao,
      () => recibo(ctx, e), e.estado === "concluida" ? "QB:" : "QA:")),
  ];
  if (!ficha) itens.push(linha("Histórico incompatível", "Consulte a Staff"));
  return quadro(ctx, "HISTÓRICO", feitos.length ? "Resultados registrados pelo servidor" : "Nenhuma sessão registrada", itens, () => inicio(ctx));
}

function recibo(ctx, e) {
  const m = MISSAO_ID.get(e.missao);
  const itens = [linha("Resultado", e.motivo), linha("Participação", `${e.participacao ?? 0}%`)];
  if (e.premio) itens.push(
    linha("Pontos de Stats", String(e.premio.pontos)),
    linha(m.raca === "cacador" ? "Honra" : "Maldição", `+${e.premio.patente} · +${e.premio.bonus} Stats por progressão`),
    linha("Dinheiro", String(e.premio.dinheiro)),
  );
  return quadro(ctx, estados[e.estado]?.toUpperCase() ?? "RESULTADO", m?.nome ?? e.missao, itens, () => historico(ctx));
}

function conquistas(ctx) {
  const { p } = ctx;
  const ficha = fichaMissoes(p);
  const novos = new Set(CATALOGO_MISSOES.filter((m) => ficha?.marcas[m.id]?.vitorias).map((m) => m.legado));
  const normais = TAGS_HISTORICAS.filter(([tag]) => p.hasTag(tag) && !novos.has(tag)).map(([, nome]) => linha(nome, "Registro legado"));
  const marcos = [
    linha("Patente atual", patenteDe(p).nome),
    ...[["Lua Vermelha", "guerra_vermelha"], ["Transformação em Oni", "demon"],
      ["Superar o sol", "sunshield"], ["Quebra da maldição", "breakcurse"]]
      .filter(([, tag]) => p.hasTag(tag)).map(([nome]) => linha(nome, "Marco registrado", undefined, "QB:")),
  ];
  return quadro(ctx, "CONQUISTAS E MARCOS", "Histórico do personagem", [...marcos, ...normais], () => historico(ctx));
}

function painelGrupo(ctx) {
  const { p } = ctx;
  const g = grupoDe(p);
  const convite = convitePendente(p);
  const itens = [];
  if (convite) itens.push(linha("Convite de " + convite.nome, "Aceitar ou recusar", () => quadro(ctx, "CONVITE DE GRUPO", convite.nome, [
    linha("Aceitar", "", () => { falha(p, responderConvite(p, true, convite)); return painelGrupo(ctx); }),
    linha("Recusar", "", () => { falha(p, responderConvite(p, false, convite)); return painelGrupo(ctx); }),
  ], () => painelGrupo(ctx))));
  if (!g) itens.push(linha("Criar grupo", "Convide até três jogadores", () => { criarGrupo(p); return painelGrupo(ctx); }));
  else {
    const lider = liderDoGrupo(p, g);
    itens.push(linha("Integrantes", [...g.membros.values()].join(", ")));
    if (lider && !g.sessao) {
      itens.push(linha("Convidar jogador", "O jogador decide se aceita", () => convidarJogador(ctx)));
      for (const [id, nome] of g.membros) if (id !== g.lider) {
        itens.push(linha("Remover " + nome, "", () => quadro(ctx, "REMOVER INTEGRANTE", nome, [
          linha("Confirmar remoção", "", () => { sairDoGrupo(p, id); return painelGrupo(ctx); }),
        ], () => painelGrupo(ctx))));
      }
    }
    if (!g.sessao) itens.push(linha(lider ? "Dissolver grupo" : "Sair do grupo", "", () =>
      quadro(ctx, "SAIR DO GRUPO", "Ação de grupo", [
        linha("Confirmar", "", () => { sairDoGrupo(p); return painelGrupo(ctx); }),
      ], () => painelGrupo(ctx))));
  }
  return quadro(ctx, "GRUPO DE MISSÃO", g?.sessao ? "Sessão em andamento" : "Os integrantes precisam cumprir os requisitos", itens, () => inicio(ctx));
}

function convidarJogador(ctx) {
  const { p } = ctx;
  return quadro(ctx, "CONVIDAR JOGADOR", "Jogadores online",
    world.getPlayers().filter((q) => q.id !== p.id && !grupoDe(q) && !operacaoMissao(q)).map((q) =>
      linha(q.name, patenteDe(q).nome, () => { falha(p, convidar(p, q)); return painelGrupo(ctx); })), () => painelGrupo(ctx));
}

function nomeAprendizado(m) {
  const resp = RESP_H_ID.get(m.resp);
  return resp ? `${resp.nome} · ${m.forma}ª forma` : m.resp;
}

const treinoLinha = (t) => linha((t.concluido ? "§a✓ §r" : "") + textoTreinoDaForma(t), "", undefined, "QI:");

function aprendizadoAluno(ctx, m, voltar = () => inicio(ctx), aluno = ctx.p) {
  const { p } = ctx;
  if (!m) {
    return quadro(ctx, "APRENDIZADO", "Peça ao Líder dos Hashiras uma missão de aprendizado", [
      ...historicoAprendizado(p).map((h) => linha(nomeAprendizado(h), h.estado === "concluida" ? "Forma aprendida" : "Atribuição cancelada")),
    ], voltar);
  }
  const treinos = aluno?.isValid ? progressoAprendizado(aluno, m).map(treinoLinha) : [linha("Aluno offline", "O progresso volta a aparecer quando ele entrar")];
  const estado = m.estado === "pendente" ? "Aguarda requisitos finais" : "Em andamento";
  return quadro(ctx, "TREINO DE RESPIRAÇÃO", nomeAprendizado(m), [
    linha(aluno?.name ?? m.nome, `Autorizado por ${m.nomeProfessor} · ${estado}`),
    ...treinos,
    ...(m.estado === "pendente" && aluno?.isValid ? [linha("Requisitos finais", requisitosProximaForma(aluno, m.resp).faltas.join(" · "))] : []),
    linha("Cancelar atribuição", "O progresso da mesma forma é preservado", () =>
      quadro(ctx, "CANCELAR APRENDIZADO", nomeAprendizado(m), [
        linha("Confirmar cancelamento", "", () => {
          const motivo = idExistente(p) === m.aluno ? "Cancelada pelo aluno." : "Cancelada pelo Líder dos Hashiras.";
          if (!cancelarAprendizado(p, m.aluno, m.id, motivo)) falha(p, "A atribuição mudou ou sua permissão expirou.");
          return voltar();
        }),
      ], () => aprendizadoAluno(ctx, m, voltar, aluno))),
  ], voltar);
}

function painelLider(ctx, voltar = ctx.voltar) {
  if (!podeAtribuirAprendizado(ctx.p)) return;
  return quadro(ctx, "MISSÕES DE APRENDIZADO", "Líder dos Hashiras", [
    linha("Atribuir missão", "Selecione o aluno e a respiração", () => alunos(ctx, false)),
    linha("Consultar alunos", "Patente, formas e requisitos", () => alunos(ctx, true)),
    linha("Consultar missões ativas", "Progresso e cancelamento", () => listaAprendizado(ctx, true)),
    linha("Consultar histórico", "Atribuições concluídas e canceladas", () => listaAprendizado(ctx, false)),
  ], voltar);
}

function listaAprendizado(ctx, ativas) {
  if (!podeAtribuirAprendizado(ctx.p)) return;
  const lista = registrosAprendizado().flatMap((f) => ativas ? (f.ativa ? [f.ativa] : []) : f.historico)
    .sort((a, b) => b.quando - a.quando);
  const online = new Map(world.getPlayers().map((p) => [idExistente(p), p]));
  const voltar = () => listaAprendizado(ctx, ativas);
  const itens = lista.map((m) => linha(`${m.nome} · ${nomeAprendizado(m)}`,
    ativas ? "Autorizado por " + m.nomeProfessor : (m.estado === "concluida" ? "Concluída" : m.motivo),
    ativas ? () => aprendizadoAluno(ctx, m, voltar, online.get(m.aluno) ?? null) : undefined));
  return quadro(ctx, ativas ? "APRENDIZADOS ATIVOS" : "HISTÓRICO DE APRENDIZADO", `${itens.length} registros`, itens, () => painelLider(ctx));
}

function alunos(ctx, consulta) {
  if (!podeAtribuirAprendizado(ctx.p)) return;
  const itens = world.getPlayers().filter(podeSerAluno).map((q) => {
    const atual = aprendizadoAtivo(q);
    if (atual && !consulta) return null;
    const registro = progressoDominio(q);
    const principal = registro.resp?.nome ?? (registro.lista.find((r) => r.aprendidas > 0)?.nome ?? "sem respiração registrada");
    return linha(q.name, `${patenteDe(q).nome} · ${atual ? nomeAprendizado(atual) : principal}`, () => escolherResp(ctx, q, consulta));
  }).filter(Boolean);
  return quadro(ctx, consulta ? "CONSULTAR ALUNOS" : "ATRIBUIR APRENDIZADO", itens.length ? "Caçadores online elegíveis" : "Nenhum aluno disponível",
    itens, () => painelLider(ctx));
}

function escolherResp(ctx, q, consulta) {
  if (!podeAtribuirAprendizado(ctx.p) || !q.isValid) return;
  const itens = RESP_H.map((resp) => {
    const r = requisitosProximaForma(q, resp.obj);
    const progresso = r.k ? `${r.k - 1}/${resp.formas.length} · forma ${r.k} · ${r.faltas.length ? "requisito pendente" : "apta"}` : "Todas as formas";
    return linha(resp.nome, progresso, r.k ? () => confirmarAprendizado(ctx, q, resp, r, consulta) : undefined);
  });
  return quadro(ctx, "RESPIRAÇÃO DO ALUNO", q.name + " · " + patenteDe(q).nome, itens, () => alunos(ctx, consulta));
}

function confirmarAprendizado(ctx, q, resp, req, consulta) {
  const { p } = ctx;
  if (!podeAtribuirAprendizado(p) || !q.isValid) return;
  const ativa = aprendizadoAtivo(q);
  const itens = [
    linha(`${req.k}ª forma · ${resp.formas[req.k - 1]}`, "Honra mínima " + req.honra + (DOMINAVEL(resp.obj) ? " · Comprova domínio humano" : "")),
    linha("Requisitos", req.faltas.length ? req.faltas.join(" · ") : "Honra e lâmina conferidas"),
    ...req.treinos.map(treinoLinha),
  ];
  if (ativa) itens.push(linha("Atribuição ativa", nomeAprendizado(ativa)));
  else if (!req.faltas.length && !consulta) itens.push(linha("ATRIBUIR MISSÃO", p.id === q.id ? "Autoatribuição auditada" : q.name, () => {
    const erro = atribuirAprendizado(p, q, resp.obj, req.k);
    falha(p, erro ?? `Missão de ${resp.nome} atribuída a ${q.name}.`);
    return painelLider(ctx);
  }));
  return quadro(ctx, "DETALHES DO APRENDIZADO", q.name + " · " + resp.nome, itens, () => escolherResp(ctx, q, consulta));
}

function listarArenas(ctx) {
  if (!ehStaff(ctx.p)) return;
  return quadro(ctx, "ADMINISTRAÇÃO DE ARENAS", "Dimensão privada · " + DIM_ARENAS, [
    linha("Criar arena", "Informe o ID e o nome", () => criarArenaTela(ctx)),
    linha("Auditoria de sessões", "Participantes, resultados e pagamentos", () => auditoria(ctx)),
    linha("Ir à oficina", "Viaje para coordenadas definidas pela Staff", () => oficina(ctx)),
    linha("Sair da oficina", "Retorne à posição anterior", async () => {
      if (!(await sairOficina(ctx.p))) falha(ctx.p, "A origem está indisponível ou você está fora da oficina.");
    }),
    ...arenas().map((a) => {
      const s = sessaoDaArena(a.id);
      return linha(a.nome, s ? `Sessão ${s.id} · ${s.estado}` : a.ativa ? "Disponível" : "Desativada", () => editarArena(ctx, a.id));
    }),
  ], () => inicio(ctx));
}

function auditoria(ctx) {
  if (!ehStaff(ctx.p)) return;
  const registros = consultarAuditoriaMissoes(ctx.p);
  const itens = registros.map((a) => linha(
    `Sessão ${a.id} · ${MISSAO_ID.get(a.missao)?.nome ?? a.missao}`,
    a.arena + " · " + a.motivo,
    () => quadro(ctx, "AUDITORIA DA SESSÃO", a.motivo, a.participantes.map((p) => linha(p.nome,
      p.premio ? `${p.participacao}% · ${p.premio.pontos + p.premio.bonus} Stats · ${p.premio.dinheiro} dinheiro`
        : p.estado + " · sem pagamento")), () => auditoria(ctx)),
  ));
  return quadro(ctx, "AUDITORIA", registros.length ? "Sessões recentes" : "Nenhuma sessão encerrada", itens, () => listarArenas(ctx));
}

async function criarArenaTela(ctx) {
  const { p } = ctx;
  const f = new ModalFormData().title("Criar arena").textField("ID curto, letras minúsculas e números", "ex. sagiri").textField("Nome", "Montanha Sagiri");
  const r = await ctx.mostrar(f, p);
  if (r.canceled || !ehStaff(p)) return;
  const [id, nome] = r.formValues.map((v) => String(v).trim());
  const a = criarArena(id, nome);
  if (!a) { falha(p, "ID ou nome inválido. Verifique se o ID já existe."); return listarArenas(ctx); }
  registrarAuditoria("arena_criada", { staff: p.name, arena: id });
  return editarArena(ctx, id);
}

async function oficina(ctx) {
  const { p } = ctx;
  const f = new ModalFormData().title("Acessar oficina de arenas").textField("Digite X Y Z", "Três coordenadas, separadas por espaço");
  const r = await ctx.mostrar(f, p);
  if (r.canceled || !ehStaff(p)) return;
  const [x, y, z] = String(r.formValues[0]).trim().split(/\s+/).map(Number);
  if (!(await irOficina(p, { x, y, z }, () => ehStaff(p)))) falha(p, "Coordenadas inválidas, região ocupada ou personagem indisponível.");
}

function alterarArena(p, id, acao) {
  if (!ehStaff(p) || sessaoDaArena(id)) return "Finalize a sessão atual para editar a arena.";
  const arena = pegarArena(id);
  if (!arena) return "Arena indisponível.";
  const erro = acao(arena);
  if (erro) return erro;
  gravarArena(arena);
  registrarAuditoria("arena_editada", { staff: p.name, arena: id, ativa: arena.ativa });
  return undefined;
}

function editarArena(ctx, id) {
  const { p } = ctx;
  const a = pegarArena(id);
  if (!ehStaff(p) || !a) return;
  const sessao = sessaoDaArena(id);
  const voltar = () => editarArena(ctx, id);
  if (sessao) return quadro(ctx, a.nome, `Sessão ${sessao.id} · ${sessao.estado}`, [
    linha("Missão", MISSAO_ID.get(sessao.missao).nome),
    linha("Participantes", sessao.pessoas.map((x) => `${x.nome} (${x.estado})`).join(", ")),
    linha("Encerrar sessão", "Cancelamento com retorno seguro", () => quadro(ctx, "CANCELAR SESSÃO", a.nome, [
      linha("Confirmar cancelamento", "", () => { encerrarPelaStaff(sessao.id, p); return listarArenas(ctx); }),
    ], voltar)),
  ], () => listarArenas(ctx));
  const ponto = (rotulo, campo, dim = DIM_ARENAS) => linha(rotulo, mostrarPonto(a[campo]), () => {
    falha(p, alterarArena(p, id, (arena) => {
      if (dim === DIM_ARENAS ? p.dimension.id !== DIM_ARENAS : p.dimension.id === DIM_ARENAS) return "Registre este ponto na dimensão correta.";
      const pos = novoLocal(p);
      if (!["a", "b"].includes(campo) && !destinoSeguro(p.dimension, pos)) return "Escolha piso firme com espaço livre.";
      if (campo === "saida") arena.saida = { dim: p.dimension.id, pos };
      else if (Array.isArray(arena[campo])) {
        if (arena[campo].length >= 12) return "Limite de pontos atingido.";
        if (arena[campo].some((p) => mostrarPonto(p) === mostrarPonto(pos))) return "Este ponto já está registrado.";
        arena[campo].push(pos);
      } else arena[campo] = campo === "objetivo" ? pos : { x: Math.floor(pos.x), y: pos.y, z: Math.floor(pos.z) };
      arena.ativa = false;
    }));
    return voltar();
  });
  const ativar = !a.ativa;
  const resumo = a.ativa ? "Disponível" : erroArena(a) ?? "Pronta para ativar";
  return quadro(ctx, a.nome, resumo, [
    ponto("Registrar canto A", "a"),
    ponto("Registrar canto B", "b"),
    ponto("Adicionar entrada", "entradas"),
    ponto("Adicionar spawn", "spawns"),
    ponto("Registrar objetivo", "objetivo"),
    ponto("Registrar saída", "saida", "externa"),
    linha("Capacidade e tipos", a.tipos.map((t) => TIPOS_OBJETIVO[t]).join(", "), () => opcoesArena(ctx, id, a)),
    linha("Limpar entradas e spawns", "", () => quadro(ctx, "LIMPAR PONTOS", a.nome, [
      linha("Confirmar", "", () => {
        falha(p, alterarArena(p, id, (a) => { a.entradas = []; a.spawns = []; a.ativa = false; }));
        return voltar();
      }),
    ], voltar)),
    linha(ativar ? "Ativar arena" : "Desativar arena", "", () => {
      falha(p, alterarArena(p, id, (arena) => {
        const erro = ativar && erroArena(arena);
        if (erro) return erro;
        arena.ativa = ativar;
      }));
      return voltar();
    }),
  ], () => listarArenas(ctx));
}

function mostrarPonto(p) {
  if (!p) return "Pendente";
  if (Array.isArray(p)) return `${p.length} pontos registrados`;
  const { x, y, z } = p.pos ?? p;
  return `${x} ${y} ${z}`;
}

async function opcoesArena(ctx, id, a) {
  const { p } = ctx;
  const f = new ModalFormData().title("Opções da arena")
    .textField("Capacidade (1 a 4)", "4", { defaultValue: String(a.capacidade) })
    .textField("IDs de missões separados por vírgula", "Obrigatório para palco narrativo", { defaultValue: a.missoes.join(",") })
    .textField("Ranks aceitos", "D,C,B,A,S", { defaultValue: a.ranks.join(",") });
  const tipos = Object.entries(TIPOS_OBJETIVO);
  for (const [t, nome] of tipos) f.toggle(nome, { defaultValue: a.tipos.includes(t) });
  const r = await ctx.mostrar(f, p);
  if (r.canceled || !ehStaff(p)) return;
  const [cap, ids, n, ...selecoes] = r.formValues;
  const capacidade = Number(cap);
  const missoes = String(ids).split(",").map((v) => v.trim()).filter(Boolean);
  const ranks = String(n).split(",").map((v) => v.trim().toUpperCase()).filter(Boolean);
  const permitidos = tipos.filter((_, i) => selecoes[i]).map(([t]) => t);
  falha(p, alterarArena(p, id, (arena) => {
    if (!Number.isInteger(capacidade) || capacidade < 1 || capacidade > 4 || !ranks.length || ranks.some((t) => !Object.hasOwn(DIFICULDADES, t)) ||
      missoes.some((t) => !MISSAO_ID.has(t)) || !permitidos.length) return "Capacidade, dificuldade, tipo ou ID de missão inválido.";
    Object.assign(arena, { capacidade, missoes, ranks, tipos: permitidos, ativa: false });
  }));
  return editarArena(ctx, id);
}

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  const p = ev.sourceEntity;
  if (ev.id !== "kny:missoes" || !ehStaff(p)) return;
  const [acao, ...args] = ev.message.trim().split(/\s+/);
  if (acao === "oficina" && args.length === 3) {
    const [x, y, z] = args.map(Number);
    void irOficina(p, { x, y, z }, () => ehStaff(p)).then((ok) => {
      if (!ok) falha(p, "Não foi possível acessar a oficina.");
    }).catch((e) => falha(p, e.message));
  } else if (acao === "sair") {
    void sairOficina(p).then((ok) => { if (!ok) falha(p, "Não foi possível retornar."); }).catch((e) => falha(p, e.message));
  } else falha(p, "Use oficina X Y Z ou sair. As configurações ficam em Menu Kimetsu → Missões → Administração de arenas.");
});
