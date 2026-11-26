import { DOMINAVEL, RESP_H, RESP_H_ID } from "./hybrid_config.js";
import { CHAVE_DOMINIO, gravarJson, identificador, lerJson, personagem, registrarAuditoria } from "./hybrid_records.js";
import { getScore, patenteDe, pontuar } from "./stats.js";
import { ehStaff, estadoBloqueado } from "./hybrid_system.js";
import { modoDeJogo } from "./compat.js";
import { haTreinoPendente, limparTreinosDaForma, somarTreino, textoTreinoDaForma, treinosDaForma } from "./treino_respiracao.js";

export const DISTANCIA_AULA = 12;
export const ehCacadorHumano = (p) => p?.isValid && !p.hasTag("demon") && !p.hasTag("kny_hybrid") &&
  (p.hasTag("slayer") || p.hasTag("slayer2") || p.hasTag("mizunoto"));

function dominio(p) {
  const d = lerJson(p, CHAVE_DOMINIO);
  if (d === undefined) return { v: 1, aulas: {}, original: null };
  if (!d?.aulas || typeof d.aulas !== "object" || Array.isArray(d.aulas) || (d.original !== null && !RESP_H_ID.has(d.original))) return null;
  for (const [id, aulas] of Object.entries(d.aulas)) {
    const resp = RESP_H_ID.get(id);
    if (!resp || !Array.isArray(aulas) || aulas.length > resp.formas.length ||
        aulas.some((a) => !Array.isArray(a) || !["humano:aula", "humano:certificado"].includes(a[0]) ||
          typeof a[1] !== "string" || !Number.isSafeInteger(a[2]))) return null;
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

const podeRegistrar = (p) => fichaHumana(p) && !estadoBloqueado(p);

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

function requisitosDaForma(p, resp, forma) {
  const treinos = treinosDaForma(p, resp.obj, forma);
  const faltas = faltasAula(p, resp, forma);
  faltas.push(...treinos.filter((t) => !t.concluido).map(textoTreinoDaForma));
  return { k: forma, faltas, treinos };
}

export function requisitosProximaForma(p, id) {
  const resp = RESP_H_ID.get(id);
  const d = dominio(p);
  const k = resp && d ? formaSeguinte(p, resp, d) : 0;
  return k ? requisitosDaForma(p, resp, k) : { k: 0, faltas: [], treinos: [], invalido: d === null };
}

function etapasDeTreino(p) {
  if (!fichaHumana(p) || p.hasTag("kny_caido") || modoDeJogo(p) === "spectator" ||
      (p.getComponent("minecraft:health")?.currentValue ?? 1) <= 0) return [];
  const d = dominio(p);
  if (!d) return [];
  return RESP_H
    .map((resp) => ({ resp, forma: formaSeguinte(p, resp, d) }))
    .filter(({ forma }) => forma > 0);
}

export function podeTreinarRespiracao(p, tipo) {
  const etapas = etapasDeTreino(p);
  return etapas.length > 0 && haTreinoPendente(p, etapas, tipo);
}

export function registrarTreinoRespiracao(p, tipo, quantidade) {
  const etapas = etapasDeTreino(p);
  if (etapas.length === 0) return;
  const concluidas = somarTreino(p, etapas, tipo, quantidade);
  if (concluidas.length === 0) return;
  const onde = concluidas.length === 1 ? concluidas[0].resp.nome : `${concluidas.length} respirações`;
  p.sendMessage(`§a[Respirações] Treino cumprido: ${concluidas[0].nome} §7(${onde})`);
  if (!p.hasTag("kny_cfg_som_off")) {
    try { p.playSound("random.levelup", { pitch: 1.4, volume: 0.5 }); } catch {}
  }
  const prontas = concluidas.filter(({ completa, resp, forma }) => completa && faltasAula(p, resp, forma).length === 0);
  for (const { resp, forma } of prontas) {
    p.sendMessage(`§e[Respirações] A forma ${forma} da ${resp.nome} está pronta para a aula. Procure o Líder dos Hashiras para aprender.`);
  }
}

function registrar(p, d, resp, aulas) {
  const id = resp.obj;
  identificador(p);
  gravarJson(p, CHAVE_DOMINIO, { ...d, aulas: { ...d.aulas, [id]: aulas } });
  const chave = "kf_" + id;
  if (getScore(p, chave) < aulas.length) pontuar(p, chave, aulas.length);
}

export function registrarAula(professor, aluno, id, forma) {
  const resp = RESP_H_ID.get(id);
  if (!resp || !DOMINAVEL(id) || !podeRegistrar(professor) || !podeRegistrar(aluno)) return false;
  const cargo = patenteDe(professor).tag;
  const cargoAluno = patenteDe(aluno).tag;
  if ((cargo !== "hashira_lider" && !(cargo === "hashira" && ["hashira", "hashira_lider"].includes(cargoAluno))) ||
      professor.id === aluno.id || aluno.dimension.id !== professor.dimension.id) return false;
  const a = aluno.location;
  const b = professor.location;
  if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > DISTANCIA_AULA) return false;
  const d = dominio(aluno);
  if (!d) return false;
  const aulas = d.aulas[id] ?? [];
  if (forma !== aulas.length + 1 || forma > resp.formas.length || requisitosDaForma(aluno, resp, forma).faltas.length > 0) return false;
  registrar(aluno, d, resp, [...aulas, ["humano:aula", identificador(professor), Date.now()]]);
  limparTreinosDaForma(aluno, id, forma);
  return true;
}

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
