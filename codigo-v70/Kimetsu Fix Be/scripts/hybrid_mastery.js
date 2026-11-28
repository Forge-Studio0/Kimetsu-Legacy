import { system, world } from "@minecraft/server";
import { DOMINAVEL, RESP_H, RESP_H_ID } from "./hybrid_config.js";
import { CHAVE_DOMINIO, gravarJson, idExistente, identificador, lerJson, personagem, registrarAuditoria } from "./hybrid_records.js";
import { getScore, patenteDe, pontuar } from "./stats.js";
import { ehStaff, estadoBloqueado } from "./hybrid_system.js";
import { modoDeJogo } from "./compat.js";
import { haTreinoPendente, limparTreinosDaForma, somarTreino, textoTreinoDaForma, treinosDaForma } from "./treino_respiracao.js";

const PREFIXO_APRENDIZADO = "kny:aprender_";
const SEQ_APRENDIZADO = "kny:aprender_seq";
const ORIGENS = ["humano:aula", "humano:certificado", "humano:missao"];
export const ehCacadorHumano = (p) => p?.isValid && !p.hasTag("demon") && !p.hasTag("kny_hybrid") &&
  (p.hasTag("slayer") || p.hasTag("slayer2") || p.hasTag("mizunoto"));

function dominio(p) {
  const d = lerJson(p, CHAVE_DOMINIO);
  if (d === undefined) return { v: 1, aulas: {}, original: null };
  if (!d?.aulas || typeof d.aulas !== "object" || Array.isArray(d.aulas) || (d.original !== null && !RESP_H_ID.has(d.original))) return null;
  for (const [id, aulas] of Object.entries(d.aulas)) {
    const resp = RESP_H_ID.get(id);
    if (!resp || !Array.isArray(aulas) || aulas.length > resp.formas.length ||
        aulas.some((a) => !Array.isArray(a) || !ORIGENS.includes(a[0]) ||
          typeof a[1] !== "string" || !Number.isSafeInteger(a[2]) ||
          (a[0] === "humano:missao" && (typeof a[3] !== "string" || !/^a[1-9][0-9]*$/.test(a[3]))))) return null;
  }
  return d;
}

export function dominioHumano(p, id) {
  return dominio(p)?.aulas[id]?.length ?? 0;
}

export function formasLiberadas(p, resp) {
  return Math.max(0, Math.min(resp.formas.length, getScore(p, "kf_" + resp.obj)));
}

export function progressoDominio(p) {
  const d = dominio(p);
  const lista = RESP_H.map((r) => ({
    ...r,
    elegivel: DOMINAVEL(r.obj),
    liberadas: formasLiberadas(p, r),
    aprendidas: d?.aulas[r.obj]?.length ?? 0,
  }));
  return { ...avaliarRegistro(d), lista };
}

function avaliarRegistro(d) {
  if (!d) return { invalido: true, completas: [] };
  const completas = RESP_H.filter((r) => DOMINAVEL(r.obj) && d.aulas[r.obj]?.length === r.formas.length);
  const escolhida = completas.find((r) => r.obj === d.original);
  return { resp: escolhida ?? (completas.length === 1 ? completas[0] : undefined), completas };
}

export function avaliarDominio(p) {
  const d = dominio(p);
  if (!d) return { invalido: true, completas: [] };
  return ehCacadorHumano(p) ? avaliarRegistro(d) : { completas: [] };
}

export function selecionarOriginal(p, id) {
  const d = dominio(p);
  if (!podeRegistrar(p) || !d || !DOMINAVEL(id) || d.aulas[id]?.length !== RESP_H_ID.get(id).formas.length) return false;
  gravarJson(p, CHAVE_DOMINIO, { ...d, original: id });
  return true;
}

export function possuiItemRespiracao(p, resp) {
  const itens = p.getComponent("minecraft:inventory")?.container;
  if (!itens) return false;
  for (let i = 0; i < itens.size; i++) {
    const item = itens.getItem(i);
    if (resp.itens.includes(item?.typeId) || (resp.obj === "basica" && item?.hasTag?.("nichirin_cor"))) return true;
  }
  return false;
}

function fichaHumana(p) {
  if (!ehCacadorHumano(p)) return false;
  const registro = personagem(p);
  return registro === undefined || registro?.estado === "curado";
}

const emJogo = (p) => !["creative", "spectator"].includes(modoDeJogo(p));
const podeRegistrar = (p) => fichaHumana(p) && !estadoBloqueado(p) && emJogo(p);

function formaSeguinte(p, resp, d) {
  const aprendidas = DOMINAVEL(resp.obj) ? (d.aulas[resp.obj]?.length ?? 0) : formasLiberadas(p, resp);
  return aprendidas < resp.formas.length ? aprendidas + 1 : 0;
}

function faltasAula(p, resp, forma) {
  const basica = resp.obj === "basica";
  const faltas = [];
  const minimo = (forma - 1) * (basica ? 5 : 10);
  const honra = getScore(p, "upslayer");
  if (!possuiItemRespiracao(p, resp)) {
    faltas.push(basica ? "possuir uma lâmina colorida" : `possuir uma espada da ${resp.nome}`);
  }
  if (honra < minimo) faltas.push(`${minimo} de honra (você tem ${honra})`);
  return faltas;
}

export function requisitosProximaForma(p, id) {
  const resp = RESP_H_ID.get(id);
  const d = dominio(p);
  const k = resp && d ? formaSeguinte(p, resp, d) : 0;
  return {
    k,
    faltas: k ? faltasAula(p, resp, k) : [],
    treinos: k ? treinosDaForma(p, resp.obj, k) : [],
    honra: k ? (k - 1) * (id === "basica" ? 5 : 10) : 0,
    invalido: d === null,
  };
}

const chaveAprendizado = (id) => PREFIXO_APRENDIZADO + id;

function fichaAprendizado(id) {
  if (!id) return { v: 1, historico: [] };
  const dados = lerJson(world, chaveAprendizado(id));
  if (dados === undefined) return { v: 1, historico: [] };
  if (!dados || !Array.isArray(dados.historico)) return null;
  const m = dados.ativa;
  if (m && (m.aluno !== id || !/^a[1-9][0-9]*$/.test(m.id) || !/^h[1-9][0-9]*$/.test(m.professor) ||
      !Number.isSafeInteger(m.quando) || !Number.isSafeInteger(m.forma) || m.forma < 1 ||
      m.forma > (RESP_H_ID.get(m.resp)?.formas.length ?? 0) ||
      !["andamento", "pendente", "aprovada"].includes(m.estado))) return null;
  return dados;
}

export const podeAtribuirAprendizado = (p) => podeRegistrar(p) && patenteDe(p).tag === "hashira_lider";
export const podeSerAluno = (p) => podeRegistrar(p) && !!dominio(p);
export const aprendizadoAtivo = (p) => fichaAprendizado(idExistente(p))?.ativa;
export const historicoAprendizado = (p) => fichaAprendizado(idExistente(p))?.historico ?? [];

export function registrosAprendizado() {
  return world.getDynamicPropertyIds().filter((chave) => /^kny:aprender_h[1-9][0-9]*$/.test(chave))
    .map((chave) => fichaAprendizado(chave.slice(PREFIXO_APRENDIZADO.length))).filter(Boolean);
}

export function atribuirAprendizado(professor, aluno, id, formaMostrada) {
  if (!podeAtribuirAprendizado(professor)) return "A atribuição exige o titular do cargo de Líder dos Hashiras.";
  if (!podeSerAluno(aluno)) return "O aluno precisa ser um caçador humano em estado válido.";
  const alunoId = identificador(aluno);
  const ficha = fichaAprendizado(alunoId);
  if (!ficha) return "Histórico de aprendizado incompatível. Consulte a Staff.";
  if (ficha.ativa) return "O aluno já tem uma missão de aprendizado ativa.";
  const { k, faltas } = requisitosProximaForma(aluno, id);
  if (!k || k !== formaMostrada) return "A próxima forma mudou ou a respiração já foi concluída.";
  if (faltas.length) return faltas.join(" · ");
  const n = world.getDynamicProperty(SEQ_APRENDIZADO) ?? 0;
  if (!Number.isSafeInteger(n) || n >= Number.MAX_SAFE_INTEGER - 1 || n < 0) return "Sequência de aprendizado indisponível.";
  const professorId = identificador(professor);
  const m = {
    id: "a" + (n + 1), aluno: alunoId, nome: aluno.name, professor: professorId, nomeProfessor: professor.name,
    resp: id, forma: k, quando: Date.now(), estado: "andamento",
  };
  world.setDynamicProperty(SEQ_APRENDIZADO, n + 1);
  gravarJson(world, chaveAprendizado(alunoId), { ...ficha, ativa: m });
  registrarAuditoria("aprendizado_atribuido", { ...m, autoatribuicao: professorId === alunoId });
  aluno.sendMessage("§e[Respirações] O Líder dos Hashiras atribuiu uma missão. Confira os objetivos em Missões.");
  concluirAprendizado(aluno);
  return undefined;
}

function encerrarAprendizado(ficha, m, estado, motivo) {
  const entrada = { ...m, estado, motivo, encerrado: Date.now() };
  gravarJson(world, chaveAprendizado(m.aluno), { v: 1, historico: [entrada, ...ficha.historico].slice(0, 24) });
}

export function cancelarAprendizado(autor, alunoId, missaoId, motivo) {
  if (!autor?.isValid || (!podeAtribuirAprendizado(autor) && idExistente(autor) !== alunoId)) return false;
  const ficha = fichaAprendizado(alunoId);
  const m = ficha?.ativa;
  if (!m || m.id !== missaoId || m.estado === "aprovada") return false;
  const alvo = world.getPlayers().find((p) => idExistente(p) === alunoId);
  encerrarAprendizado(ficha, m, "cancelada", motivo);
  registrarAuditoria("aprendizado_cancelado", { missao: m.id, autor: identificador(autor), aluno: alunoId, motivo });
  alvo?.sendMessage("§e[Respirações] Missão cancelada. O progresso pode ser aproveitado na mesma forma.");
  return true;
}

export function progressoAprendizado(p, m) {
  if (!m || m.aluno !== idExistente(p)) return [];
  return treinosDaForma(p, m.resp, m.forma);
}

function etapasDeTreino(p) {
  if (!fichaHumana(p) || !emJogo(p) || p.hasTag("kny_caido") || p.hasTag("kny_finalizando") || p.hasTag("kny_finalizado") ||
      (p.getComponent("minecraft:health")?.currentValue ?? 1) <= 0) return [];
  const m = aprendizadoAtivo(p);
  const resp = m && RESP_H_ID.get(m.resp);
  const d = resp && dominio(p);
  return d && m.estado === "andamento" && formaSeguinte(p, resp, d) === m.forma ? [{ resp, forma: m.forma }] : [];
}

export function podeTreinarRespiracao(p, tipo) {
  const etapas = etapasDeTreino(p);
  return etapas.length > 0 && haTreinoPendente(p, etapas, tipo);
}

export function registrarTreinoRespiracao(p, tipo, quantidade) {
  const etapas = etapasDeTreino(p);
  if (etapas.length === 0) return;
  for (const concluida of somarTreino(p, etapas, tipo, quantidade)) {
    const objetivo = treinosDaForma(p, concluida.resp.obj, concluida.forma).find((t) => t.tipo === tipo);
    p.sendMessage("§a[Respirações] Treinamento concluído: " + textoTreinoDaForma(objetivo));
    if (!p.hasTag("kny_cfg_som_off")) {
      try { p.playSound("random.levelup", { pitch: 1.4, volume: 0.5 }); } catch {}
    }
    if (concluida.completa) concluirAprendizado(p);
  }
}

function registrar(p, d, resp, aulas) {
  const id = resp.obj;
  identificador(p);
  gravarJson(p, CHAVE_DOMINIO, { ...d, aulas: { ...d.aulas, [id]: aulas } });
  espelharForma(p, id, aulas.length);
}

function espelharForma(p, id, forma) {
  const chave = "kf_" + id;
  if (getScore(p, chave) < forma) pontuar(p, chave, forma);
}

export function concluirAprendizado(p) {
  const id = idExistente(p);
  const ficha = fichaAprendizado(id);
  const m = ficha?.ativa;
  if (!m || !podeRegistrar(p)) return false;
  const resp = RESP_H_ID.get(m.resp);
  const d = dominio(p);
  if (!d) return false;
  const aulas = d.aulas[m.resp] ?? [];
  const gravada = aulas[m.forma - 1]?.[3] === m.id;
  const dominavel = DOMINAVEL(m.resp);
  if (!gravada && m.estado !== "aprovada") {
    if (formaSeguinte(p, resp, d) !== m.forma) {
      encerrarAprendizado(ficha, m, "cancelada", "A forma avançou por outro procedimento.");
      registrarAuditoria("aprendizado_cancelado", { missao: m.id, aluno: id, motivo: "Forma avançou por outro procedimento" });
      return false;
    }
    if (progressoAprendizado(p, m).some((t) => !t.concluido)) return false;
    const faltas = faltasAula(p, resp, m.forma);
    if (faltas.length) {
      if (m.estado !== "pendente") {
        gravarJson(world, chaveAprendizado(id), { ...ficha, ativa: { ...m, estado: "pendente" } });
        p.sendMessage("§e[Respirações] Objetivos cumpridos. Falta " + faltas.join(" · ") + ".");
      }
      return false;
    }
    gravarJson(world, chaveAprendizado(id), { ...ficha, ativa: { ...m, estado: "aprovada" } });
  }
  if (dominavel && !gravada) {
    if (aulas.length !== m.forma - 1) return false;
    registrar(p, d, resp, [...aulas, ["humano:missao", m.professor, Date.now(), m.id]]);
  }
  espelharForma(p, m.resp, m.forma);
  limparTreinosDaForma(p, m.resp, m.forma);
  encerrarAprendizado(ficha, m, "concluida");
  registrarAuditoria("aprendizado_concluido", { missao: m.id, aluno: id, professor: m.professor, resp: m.resp, forma: m.forma });
  p.sendMessage(`§a[Respirações] Você dominou ${m.forma}ª forma da ${resp.nome}: ${resp.formas[m.forma - 1]}!`);
  if (m.forma === resp.formas.length) {
    p.sendMessage("§aVocê dominou completamente sua respiração." +
      (DOMINAVEL(m.resp) ? " Confira a respiração original em Guia → Domínio humano." : ""));
  }
  return true;
}

system.runInterval(() => {
  for (const p of world.getPlayers()) {
    try { concluirAprendizado(p); }
    catch (e) { console.warn("[Aprendizado] " + e); }
  }
}, 40);

export function certificarHistorico(autor, aluno, id, prova) {
  return podeRegistrar(aluno) && certificarAulas(autor, aluno, id, prova, "certificar_dominio");
}

// Chamado só depois de validar a transformação da v72. O histórico confirmado
// corresponde ao período humano anterior. Um Oni segue sem acesso a aulas novas.
export function dominioParaRecuperacao(autor, aluno, id, prova) {
  if (!ehStaff(autor)) return undefined;
  const d = dominio(aluno);
  const avaliacao = avaliarRegistro(d);
  if (avaliacao.invalido || avaliacao.resp && avaliacao.resp.obj !== id) return undefined;
  if (avaliacao.completas.some((r) => r.obj === id)) return RESP_H_ID.get(id);
  if (!d.original && certificarAulas(autor, aluno, id, prova, "certificar_dominio_v72")) return RESP_H_ID.get(id);
  return undefined;
}

function certificarAulas(autor, aluno, id, prova, acao) {
  const resp = RESP_H_ID.get(id);
  const d = dominio(aluno);
  if (!ehStaff(autor) || !d || !DOMINAVEL(id) || autor.id === aluno.id || typeof prova !== "string" ||
      prova.trim().length < 12 || prova.length > 240 || formasLiberadas(aluno, resp) < resp.formas.length ||
      d.aulas[id]?.length === resp.formas.length) return false;
  const autorId = identificador(autor);
  const anteriores = d.aulas[id] ?? [];
  const quando = Date.now();
  registrarAuditoria(acao, { autor: autorId, alvo: identificador(aluno), resp: id, prova: prova.trim() });
  registrar(aluno, d, resp, [
    ...anteriores,
    ...Array.from({ length: resp.formas.length - anteriores.length }, () => ["humano:certificado", autorId, quando]),
  ]);
  return true;
}
