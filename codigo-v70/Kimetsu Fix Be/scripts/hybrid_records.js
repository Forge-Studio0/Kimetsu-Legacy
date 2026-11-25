import { world } from "@minecraft/server";
import { ARTE_H_ID, ESPECIAIS, IDENTIDADES, RESP_H_ID } from "./hybrid_config.js";

export const CHAVE_H = "kny:h_personagem";
export const CHAVE_DOMINIO = "kny:h_dominio";
const IDENTIFICADOR = "kny:h_id";
const PREFIXO = "kny:h_reg_";
export const CHAVE_HABILIDADES = "kny:h_proprietarios";

// undefined representa ausência. null representa um registro que precisa de atenção.
export function lerJson(obj, chave) {
  const bruto = obj.getDynamicProperty(chave);
  if (bruto === undefined) return undefined;
  try {
    const dados = JSON.parse(bruto);
    return dados && typeof dados === "object" && !Array.isArray(dados) && dados.v === 1 ? dados : null;
  } catch {
    return null;
  }
}

export function gravarJson(obj, chave, dados) {
  obj.setDynamicProperty(chave, JSON.stringify(dados));
}

const idValido = (id) => typeof id === "string" && /^h[1-9][0-9]*$/.test(id);
const numeroSeguro = (v) => Number.isSafeInteger(v) && v >= 0;
export const idExistente = (p) => {
  const id = p.getDynamicProperty(IDENTIFICADOR);
  return idValido(id) ? id : undefined;
};

export function identificador(p) {
  const antigo = p.getDynamicProperty(IDENTIFICADOR);
  if (idValido(antigo)) return antigo;
  if (antigo !== undefined) throw new Error("Identificador de personagem inválido");
  const atual = world.getDynamicProperty("kny:h_sequencia") ?? 0;
  if (!numeroSeguro(atual) || atual >= Number.MAX_SAFE_INTEGER - 1) throw new Error("Sequência de personagens inválida");
  const novo = "h" + (atual + 1);
  world.setDynamicProperty("kny:h_sequencia", atual + 1);
  p.setDynamicProperty(IDENTIFICADOR, novo);
  return novo;
}

export function personagem(p) {
  const d = lerJson(p, CHAVE_H);
  if (!d) return d;
  if (!idValido(d.id) || p.getDynamicProperty(IDENTIFICADOR) !== d.id) return null;
  if (!["oni", "hibrido"].includes(d.raca) || !["transformando", "ativo", "curado"].includes(d.estado)) return null;
  if (d.raca === "hibrido" && (d.estado === "curado" || !RESP_H_ID.has(d.resp) || !ARTE_H_ID.has(d.arte) ||
      !Object.hasOwn(IDENTIDADES, d.publico) || !numeroSeguro(d.formas) || d.formas !== RESP_H_ID.get(d.resp).formas.length)) return null;
  if (d.estado === "transformando" && (!d.anterior || !numeroSeguro(d.doses))) return null;
  if (d.dose !== undefined && (d.estado !== "transformando" || !numeroSeguro(d.dose?.slot) || d.dose.slot > 8 ||
      !numeroSeguro(d.dose.quantidade) || d.dose.quantidade < 1 || d.dose.quantidade > 64)) return null;
  return d;
}

export function guardarPersonagem(p, d) {
  gravarJson(p, CHAVE_H, d);
}

export function indexarHibrido(p, dados) {
  if (dados.raca === "hibrido") gravarJson(world, PREFIXO + dados.id, {
    v: 1, id: dados.id, nome: p.name, resp: dados.resp, arte: dados.arte,
  });
}

export function hibridosRegistrados() {
  return world.getDynamicPropertyIds().filter((id) => id.startsWith(PREFIXO))
    .map((id) => lerJson(world, id)).filter((d) => d && idValido(d.id));
}

export function hibridoRegistrado(id) {
  return idValido(id) ? lerJson(world, PREFIXO + id) : undefined;
}

export function proprietarios() {
  const dados = lerJson(world, CHAVE_HABILIDADES);
  if (dados === undefined) return { v: 1, atribuicoes: {}, historico: [] };
  if (!dados?.atribuicoes || typeof dados.atribuicoes !== "object" || Array.isArray(dados.atribuicoes) || !Array.isArray(dados.historico)) return null;
  const ids = new Set();
  for (const [poder, a] of Object.entries(dados.atribuicoes)) {
    if (!Object.hasOwn(ESPECIAIS, poder) || !a || !idValido(a.id) || ids.has(a.id) || typeof a.ativo !== "boolean") return null;
    ids.add(a.id);
  }
  return dados;
}

export function registrarAuditoria(acao, detalhes) {
  const n = (world.getDynamicProperty("kny:h_auditoria_seq") ?? 0) + 1;
  if (!numeroSeguro(n)) throw new Error("Sequência de auditoria inválida");
  gravarJson(world, "kny:h_auditoria_" + n, { v: 1, quando: Date.now(), acao, ...detalhes });
  world.setDynamicProperty("kny:h_auditoria_seq", n);
}
