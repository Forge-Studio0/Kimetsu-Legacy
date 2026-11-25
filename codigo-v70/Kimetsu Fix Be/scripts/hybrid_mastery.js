import { DOMINAVEL, RESP_H, RESP_H_ID } from "./hybrid_config.js";
import { CHAVE_DOMINIO, gravarJson, identificador, lerJson, personagem, registrarAuditoria } from "./hybrid_records.js";
import { getScore, patenteDe, pontuar } from "./stats.js";
import { ehStaff } from "./hybrid_system.js";

export const DISTANCIA_AULA = 12;
const DESCANSANDO = ["kny_caido", "animacao"];
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

export function progressoDominio(p) {
  const d = dominio(p);
  const lista = RESP_H.filter((r) => DOMINAVEL(r.obj)).map((r) => ({
    ...r, aprendidas: d?.aulas[r.obj]?.length ?? 0,
  }));
  return { valido: d !== null, original: d?.original, lista };
}

export function avaliarDominio(p, escolha) {
  const d = dominio(p);
  if (!d) return { invalido: true };
  if (!ehCacadorHumano(p)) return {};
  const completas = RESP_H.filter((r) => DOMINAVEL(r.obj) && d.aulas[r.obj]?.length === r.formas.length);
  const id = d.original ?? escolha;
  if (id) return { resp: completas.find((r) => r.obj === id), completas, original: id };
  return completas.length === 1 ? { resp: completas[0], completas } : { completas };
}

export function selecionarOriginal(p, id) {
  const d = dominio(p);
  if (!ehCacadorHumano(p) || !d || !DOMINAVEL(id) || d.aulas[id]?.length !== RESP_H_ID.get(id).formas.length) return false;
  gravarJson(p, CHAVE_DOMINIO, { ...d, original: id });
  return true;
}

function possuiItem(p, resp) {
  const itens = p.getComponent("minecraft:inventory")?.container;
  if (!itens) return false;
  for (let i = 0; i < itens.size; i++) {
    const item = itens.getItem(i);
    if (resp.itens.includes(item?.typeId) || (resp.obj === "basica" && item?.hasTag?.("nichirin_cor"))) return true;
  }
  return false;
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
  if (!resp || !DOMINAVEL(id) || !ehCacadorHumano(professor) || !ehCacadorHumano(aluno)) return false;
  const cargo = patenteDe(professor).tag;
  const cargoAluno = patenteDe(aluno).tag;
  if ((cargo !== "hashira_lider" && !(cargo === "hashira" && ["hashira", "hashira_lider"].includes(cargoAluno))) ||
      professor.id === aluno.id || aluno.dimension.id !== professor.dimension.id ||
      DESCANSANDO.some((tag) => professor.hasTag(tag) || aluno.hasTag(tag))) return false;
  const a = aluno.location;
  const b = professor.location;
  if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > DISTANCIA_AULA || !possuiItem(aluno, resp)) return false;
  const d = dominio(aluno);
  if (!d || personagem(aluno)?.estado === "transformando") return false;
  const aulas = d.aulas[id] ?? [];
  if (forma !== aulas.length + 1 || forma > resp.formas.length || getScore(aluno, "upslayer") < (forma - 1) * (id === "basica" ? 5 : 10)) return false;
  registrar(aluno, d, resp, [...aulas, ["humano:aula", identificador(professor), Date.now()]]);
  return true;
}

export function certificarHistorico(autor, aluno, id, prova) {
  const resp = RESP_H_ID.get(id);
  const d = dominio(aluno);
  if (!ehStaff(autor) || !ehCacadorHumano(aluno) || !d || !DOMINAVEL(id) || autor.id === aluno.id || prova.trim().length < 12 ||
      prova.length > 240 || getScore(aluno, "kf_" + id) < resp.formas.length || d.aulas[id]?.length === resp.formas.length) return false;
  const autorId = identificador(autor);
  const anteriores = d.aulas[id] ?? [];
  const quando = Date.now();
  registrarAuditoria("certificar_dominio", { autor: autorId, alvo: identificador(aluno), resp: id, prova });
  registrar(aluno, d, resp, [
    ...anteriores,
    ...Array.from({ length: resp.formas.length - anteriores.length }, () => ["humano:certificado", autorId, quando]),
  ]);
  return true;
}
