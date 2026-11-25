import { DOMINAVEL, RESP_H, RESP_H_ID } from "./hybrid_config.js";
import { CHAVE_DOMINIO, gravarJson, identificador, lerJson, personagem, registrarAuditoria } from "./hybrid_records.js";
import { getScore, patenteDe, pontuar } from "./stats.js";
import { ehStaff, estadoBloqueado } from "./hybrid_system.js";

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

function podeRegistrar(p) {
  if (!ehCacadorHumano(p) || estadoBloqueado(p)) return false;
  const registro = personagem(p);
  return registro === undefined || registro?.estado === "curado";
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
  if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > DISTANCIA_AULA || !possuiItemRespiracao(aluno, resp)) return false;
  const d = dominio(aluno);
  if (!d) return false;
  const aulas = d.aulas[id] ?? [];
  if (forma !== aulas.length + 1 || forma > resp.formas.length || getScore(aluno, "upslayer") < (forma - 1) * (id === "basica" ? 5 : 10)) return false;
  registrar(aluno, d, resp, [...aulas, ["humano:aula", identificador(professor), Date.now()]]);
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
