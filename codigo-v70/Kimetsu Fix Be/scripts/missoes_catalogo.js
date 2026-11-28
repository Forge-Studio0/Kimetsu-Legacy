import { HIBRIDO_SUPERIOR, ONI, RANKS_CACADOR, RANKS_ONI, REI_ONI } from "./stats_config.js";

export const DIFICULDADES = Object.freeze({
  D: { nome: "Iniciante", cacador: "mizunoto", oni: "oni", pontos: 500, patente: 5, dinheiro: 100 },
  C: { nome: "Intermediária", cacador: "kanoto", oni: "lower6", pontos: 1500, patente: 10, dinheiro: 250 },
  B: { nome: "Avançada", cacador: "tsuchinoe", oni: "lower4", pontos: 5000, patente: 20, dinheiro: 500 },
  A: { nome: "Elite", cacador: "hinoe", oni: "lower1", pontos: 15000, patente: 40, dinheiro: 1500 },
  S: { nome: "Especial", cacador: "hashira", oni: "upper6", pontos: 50000, patente: 75, dinheiro: 5000 },
});

export const CATEGORIAS = { principal: "Missões principais", cacada: "Caçadas", elite: "Missões de elite" };
export const TIPOS_OBJETIVO = {
  local: "Localização", abates: "Abates", ondas: "Ondas", chefe: "Chefe", sobreviver: "Sobrevivência", proteger: "Proteção",
};
export const REGRAS_MISSAO = {
  grupoMaximo: 4, conviteMs: 60000, desconexaoMs: 120000, preparoMs: 3000,
  cooldownFracassoMs: 120000, combateMs: 10000, percentualIgual: 40, percentualMinimo: 10,
  tetoAtores: 40, sessoesMaximas: 8, distanciaEntreArenas: 64, tetoDimensao: 48, tetoAltura: 48,
};

const demonio = "kny:demon";
const lingua = "kny:tongue_demon";
const chifres = "kny:tsunodemon";
const cobra = "kny:hebidemon";
const espadachim = "kny:slayer";
const inimigos = (...tipos) => ({ tipos });
const chefe = (tipo, reforco) => ({ tipos: [tipo], reforco });

function missao(id, nome, raca, categoria, dificuldade, objetivo, detalhes = {}) {
  return {
    id, nome, raca, categoria, dificuldade, objetivo, ondas: [],
    maxGrupo: REGRAS_MISSAO.grupoMaximo, duracao: 360, cooldown: categoria === "cacada" ? 1200 : 0,
    ...detalhes,
  };
}

export const CATALOGO_MISSOES = [
  missao("sagiri", "Montanha Sagiri", "cacador", "principal", "D", "local", { maxGrupo: 1, duracao: 180, legado: "m1" }),
  missao("sabito", "Duelo com Sabito", "cacador", "principal", "D", "chefe", {
    maxGrupo: 1, anterior: "sagiri", ondas: [chefe("kny:sabito")], legado: "m2",
  }),
  missao("selecao", "Seleção Final · Demônio das Mãos", "cacador", "principal", "C", "chefe", {
    anterior: "sabito", ondas: [chefe("kny:hand_demon", demonio)], legado: "m3",
  }),
  missao("natagumo", "Chegada à Montanha Natagumo", "cacador", "principal", "B", "local", {
    anterior: "selecao", maxGrupo: 1, duracao: 180, legado: "m4",
  }),
  missao("rui", "Proteja Tanjiro de Rui", "cacador", "principal", "B", "proteger", {
    anterior: "natagumo", protegido: "kny:tanjiro", ondas: [chefe("kny:rui", cobra)], legado: "m5",
  }),
  missao("enmu", "Proteja Rengoku no Trem Infinito", "cacador", "principal", "A", "proteger", {
    anterior: "rui", protegido: "kny:rengoku", ondas: [inimigos(cobra, lingua), chefe("kny:enmu", cobra)], duracao: 540, legado: "m6",
  }),
  missao("akaza", "Confronto com Akaza", "cacador", "principal", "S", "chefe", {
    anterior: "enmu", ondas: [chefe("kny:akaza", cobra)], duracao: 720, legado: "m7",
  }),
  missao("ronda", "Ronda dos Caçadores", "cacador", "cacada", "D", "abates", {
    ondas: [{ tipos: [demonio, demonio, lingua], reforco: demonio }],
  }),
  missao("selecao_noite", "Noite da Seleção", "cacador", "cacada", "C", "sobreviver", {
    ondas: [{ tipos: [demonio, lingua, chifres], reforco: demonio }, inimigos(cobra, chifres)], sobrevida: 75,
  }),
  missao("patrulha_lua", "O covil de Kamanue", "cacador", "cacada", "B", "ondas", {
    ondas: [{ tipos: [cobra, lingua], reforco: demonio }, chefe("kny:kamanue")],
  }),
  missao("duelo_agua", "Duelo de elite · Tomioka", "cacador", "elite", "A", "chefe", {
    maxGrupo: 1, ondas: [chefe("kny:tomioka")], legado: "training_water",
  }),
  missao("distrito", "Distrito do Entretenimento · Gyutaro", "cacador", "elite", "S", "chefe", {
    anterior: "enmu", ondas: [chefe("kny:gyutaro", cobra)], duracao: 600, legado: "bloodupper6",
  }),
  missao("castelo_lua", "Castelo Infinito · Kokushibo", "cacador", "elite", "S", "chefe", {
    anterior: "akaza", ondas: [{ tipos: [demonio, cobra], reforco: chifres }, chefe("kny:kokushibo", cobra)],
    duracao: 900, legado: "bloodupper1",
  }),
  missao("oni_espadachim", "Ronda do Oni", "oni", "cacada", "D", "abates", {
    ondas: [{ tipos: [espadachim, espadachim], reforco: espadachim }],
  }),
  missao("oni_emboscada", "Emboscada de Espadachins", "oni", "principal", "C", "ondas", {
    ondas: [{ tipos: [espadachim, espadachim], reforco: espadachim }, inimigos(espadachim, espadachim, espadachim)],
  }),
  missao("oni_sabito", "Desafio de Sabito", "oni", "cacada", "B", "chefe", {
    ondas: [chefe("kny:sabito", espadachim)],
  }),
  missao("oni_novo_hashira", "Provação · Shinobu", "oni", "elite", "A", "chefe", {
    ondas: [chefe("kny:shinobu", espadachim)],
  }),
  missao("oni_chamas", "Provação · Rengoku", "oni", "elite", "S", "chefe", {
    anterior: "oni_novo_hashira", ondas: [inimigos(espadachim, espadachim), chefe("kny:rengoku", espadachim)], duracao: 600,
  }),
  missao("hibrido_demonios", "Entre dois mundos · Caçada", "hibrido", "cacada", "B", "ondas", {
    ondas: [{ tipos: [demonio, lingua], reforco: chifres }, inimigos(cobra, chifres)],
  }),
  missao("hibrido_nevoa", "Entre dois mundos · Muichiro", "hibrido", "principal", "A", "chefe", {
    ondas: [chefe("kny:muichiro", espadachim)],
  }),
  missao("hibrido_lua", "Entre dois mundos · Lua Superior 1", "hibrido", "elite", "S", "chefe", {
    anterior: "hibrido_nevoa", ondas: [{ tipos: [espadachim, espadachim], reforco: espadachim }, chefe("kny:kokushibo", cobra)],
    duracao: 900,
  }),
];

export const MISSAO_ID = new Map(CATALOGO_MISSOES.map((m) => [m.id, m]));
export const ATORES_MISSAO = new Set(CATALOGO_MISSOES.flatMap((m) => [
  ...m.ondas.flatMap((o) => o.reforco ? [...o.tipos, o.reforco] : o.tipos), ...(m.protegido ? [m.protegido] : []),
]));

const PATENTES = {
  cacador: RANKS_CACADOR,
  oni: [ONI, ...RANKS_ONI],
  hibrido: [HIBRIDO_SUPERIOR, REI_ONI],
};

export function patenteMinima(m) {
  const id = m.raca === "hibrido" ? HIBRIDO_SUPERIOR.tag : DIFICULDADES[m.dificuldade][m.raca];
  return PATENTES[m.raca].find((p) => p.tag === id);
}

export function patenteValida(m, atual) {
  const lista = PATENTES[m.raca];
  return lista.indexOf(atual) >= lista.indexOf(patenteMinima(m));
}

export const descricaoOnda = (onda, tamanho) => onda.tipos.concat(onda.reforco ? Array(tamanho - 1).fill(onda.reforco) : []);
export const picoInimigos = (m, tamanho) => Math.max(0, ...m.ondas.map((o) => descricaoOnda(o, tamanho).length));
