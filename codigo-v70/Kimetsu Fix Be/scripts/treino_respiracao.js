import { RESP_H_ID } from "./hybrid_config.js";

const CHAVE_TREINOS = "kny_req";
const TAREFAS = {
  oni: { nome: "Matar onis", un: "onis", base: 3, passo: 2 },
  correr: { nome: "Correr", un: "m", base: 50, passo: 50 },
  nadar: { nome: "Nadar", un: "m", base: 50, passo: 25 },
  pular: { nome: "Pular", un: "vezes", base: 40, passo: 20 },
  flexao: { nome: "Fazer flexões", un: "repetições", base: 10, passo: 5 },
  abdominal: { nome: "Fazer abdominais", un: "repetições", base: 10, passo: 5 },
  meditar: { nome: "Meditar", un: "repetições", base: 5, passo: 3 },
  agachamento: { nome: "Fazer agachamentos", un: "repetições", base: 10, passo: 5 },
  dummy: { nome: "Golpear o dummy", un: "golpes", base: 15, passo: 10 },
};

const TEMA_TAREFAS = {
  water: ["nadar", "flexao"], tomioka: ["nadar", "flexao"], tanjiro: ["nadar", "flexao"],
  flame: ["oni", "dummy"], rengoku: ["oni", "dummy"],
  wind: ["pular", "correr"], sanemi: ["pular", "correr"],
  mist: ["meditar", "correr"], muichiro: ["meditar", "correr"],
  thunder: ["correr", "agachamento"], zenitsu: ["correr", "agachamento"], kaigaku: ["correr", "agachamento"],
  sun: ["meditar", "oni"], yoriichi: ["meditar", "oni"],
  moon: ["oni", "meditar"], kokushibo: ["oni", "meditar"], kokushibo2: ["oni", "meditar"],
  mitsuri: ["abdominal", "flexao"], shinobu: ["pular", "agachamento"], inosuke: ["pular", "dummy"],
  gyomei: ["flexao", "dummy"], uzui: ["abdominal", "correr"], obanai: ["agachamento", "pular"],
  flower: ["meditar", "abdominal"], death: ["oni", "dummy"],
};

function hashTexto(texto) {
  let hash = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function geradorDaSemente(semente) {
  return () => {
    semente = (semente + 0x6d2b79f5) | 0;
    let valor = Math.imul(semente ^ (semente >>> 15), 1 | semente);
    valor = (valor + Math.imul(valor ^ (valor >>> 7), 61 | valor)) ^ valor;
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
  };
}

const chaveDaForma = (id, forma) => id + ":" + forma;
const listas = new Map();

// A ordem dos tipos e a semente preservam as listas da versão do cliente.
export function tarefasDaForma(id, forma) {
  const resp = RESP_H_ID.get(id);
  if (!resp || !Number.isInteger(forma) || forma < 1 || forma > resp.formas.length) return [];
  const chave = chaveDaForma(id, forma);
  if (listas.has(chave)) return listas.get(chave);
  const basica = id === "basica";
  const total = basica ? Math.min(2, forma) : Math.min(3, 1 + Math.ceil(forma / 2));
  const tema = TEMA_TAREFAS[id];
  const tipos = tema ? [tema[(forma - 1) % tema.length]] : [];
  const resto = Object.keys(TAREFAS).filter((tipo) => !tipos.includes(tipo));
  const sortear = geradorDaSemente(hashTexto(chave));
  for (let i = resto.length - 1; i > 0; i--) {
    const j = Math.floor(sortear() * (i + 1));
    [resto[i], resto[j]] = [resto[j], resto[i]];
  }
  tipos.push(...resto.slice(0, total - tipos.length));
  const tarefas = tipos.map((tipo) => {
    const { base, passo, un } = TAREFAS[tipo];
    const valor = (base + passo * (forma - 1)) * (basica ? 0.5 : 1);
    const meta = un === "m" ? Math.max(5, Math.round(valor / 5) * 5) : Math.max(1, Math.round(valor));
    return { tipo, meta };
  });
  listas.set(chave, tarefas);
  return tarefas;
}

function lerTreinos(p) {
  const bruto = p.getDynamicProperty(CHAVE_TREINOS);
  if (bruto === undefined) return {};
  if (typeof bruto !== "string") return null;
  try {
    const dados = JSON.parse(bruto);
    return dados && typeof dados === "object" && !Array.isArray(dados) ? dados : null;
  } catch {
    return null;
  }
}

function salvarTreinos(p, dados) {
  try {
    p.setDynamicProperty(CHAVE_TREINOS, JSON.stringify(dados));
    return true;
  } catch (erro) {
    console.warn("[Respirações] Progresso de treino não salvo. " + erro);
    return false;
  }
}

function progressoDaTarefa(salvos, tarefa) {
  const atual = salvos?.[tarefa.tipo];
  return Number.isSafeInteger(atual) && atual > 0 ? Math.min(atual, tarefa.meta) : 0;
}

export function treinosDaForma(p, id, forma) {
  const salvos = lerTreinos(p)?.[chaveDaForma(id, forma)];
  return tarefasDaForma(id, forma).map((tarefa) => {
    const { nome, un } = TAREFAS[tarefa.tipo];
    const atual = progressoDaTarefa(salvos, tarefa);
    return { ...tarefa, nome, un, atual, concluido: atual === tarefa.meta };
  });
}

export const textoTreinoDaForma = ({ nome, atual, meta, un }) => `${nome}: ${atual}/${meta} ${un}`;

export function haTreinoPendente(p, etapas, tipo) {
  const salvos = lerTreinos(p);
  return !!salvos && etapas.some(({ resp, forma }) => {
    const tarefa = tarefasDaForma(resp.obj, forma).find((t) => t.tipo === tipo);
    return tarefa && progressoDaTarefa(salvos[chaveDaForma(resp.obj, forma)], tarefa) < tarefa.meta;
  });
}

export function somarTreino(p, etapas, tipo, quantidade) {
  if (!Object.hasOwn(TAREFAS, tipo) || !Number.isSafeInteger(quantidade) || quantidade < 1) return [];
  const salvos = lerTreinos(p);
  if (!salvos) return [];
  const concluidas = [];
  let mudou = false;
  for (const etapa of etapas) {
    const { resp, forma } = etapa;
    const tarefas = tarefasDaForma(resp.obj, forma);
    const tarefa = tarefas.find((t) => t.tipo === tipo);
    if (!tarefa) continue;
    const chave = chaveDaForma(resp.obj, forma);
    const antes = progressoDaTarefa(salvos[chave], tarefa);
    if (antes >= tarefa.meta) continue;
    const atual = Math.min(tarefa.meta, antes + quantidade);
    const contadores = { ...salvos[chave], [tipo]: atual };
    salvos[chave] = contadores;
    mudou = true;
    if (atual === tarefa.meta) {
      const completa = tarefas.every((t) => progressoDaTarefa(contadores, t) === t.meta);
      concluidas.push({ ...etapa, completa, nome: TAREFAS[tipo].nome });
    }
  }
  if (mudou && !salvarTreinos(p, salvos)) return [];
  return concluidas;
}

export function limparTreinosDaForma(p, id, forma) {
  const salvos = lerTreinos(p);
  const chave = chaveDaForma(id, forma);
  if (!salvos || !Object.hasOwn(salvos, chave)) return;
  delete salvos[chave];
  salvarTreinos(p, salvos);
}
