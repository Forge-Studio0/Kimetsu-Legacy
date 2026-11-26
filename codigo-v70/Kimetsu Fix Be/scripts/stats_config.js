export const ATRIBUTOS = [
  { id: "for", obj: "kny_nf", pts: "kny_pf", antigo: "kny_for", tr: "kny_tf", rep: "kny_rf", nome: "Força" },
  { id: "vid", obj: "kny_nv", pts: "kny_pv", antigo: "kny_vid", tr: "kny_tv", rep: "kny_rv", nome: "Vida" },
  { id: "def", obj: "kny_nd", pts: "kny_pd", antigo: "kny_def", tr: "kny_td", rep: "kny_rd", nome: "Defesa" },
  { id: "pod", obj: "kny_np", pts: "kny_pp", antigo: "kny_pod", tr: "kny_tp", rep: "kny_rp", nome: "Poder" },
  { id: "sta", obj: "kny_ns", pts: "kny_ps", antigo: "kny_sta", tr: "kny_ts", rep: "kny_rs", nome: "Stamina" },
];
export const ATR = Object.fromEntries(ATRIBUTOS.map((a) => [a.id, a]));

export const NIVEIS_POR_FAIXA = 5;
export const CUSTOS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 150000, 200000, 300000, 500000];
export const NIVEL_MAXIMO = CUSTOS.length * NIVEIS_POR_FAIXA;

// A entrada é o nível efetivo permanente, incluindo os níveis de treino legado.
export function custoMelhoria(nivelAtual) {
  if (!Number.isInteger(nivelAtual) || nivelAtual < 0 || nivelAtual >= NIVEL_MAXIMO) return null;
  return CUSTOS[Math.floor(nivelAtual / NIVEIS_POR_FAIXA)];
}

function patente(tag, nome, min, geral, limites, vidaBase, movimentoBase, unico = false) {
  return {
    tag, nome, min, geral, vidaBase, movimentoBase, unico,
    limites: Object.fromEntries(ATRIBUTOS.map((a, i) => [a.id, limites[i]])),
  };
}

// Limites de Força, Vida, Defesa, Poder e Stamina, nessa ordem.
// Vida e movimento de base incluem o bônus passivo da patente, uma única vez.
export const HUMANO = patente("humano", "Sem patente", 0, 4, [4, 4, 4, 4, 4], 40, 100);
export const RANKS_CACADOR = [
  patente("mizunoto", "Mizunoto", 0,                  5, [ 5,  5,  4,  5,  5], 40, 100),
  patente("mizunoe", "Mizunoe", 100,                  6, [ 6,  6,  5,  6,  6], 40, 101),
  patente("kanoto", "Kanoto", 200,                    8, [ 8,  7,  7,  8,  8], 40, 102),
  patente("kanoe", "Kanoe", 300,                     10, [10,  9,  8, 10, 10], 40, 103),
  patente("tsuchinoto", "Tsuchinoto", 400,           12, [12, 11, 10, 12, 11], 40, 104),
  patente("tsuchinoe", "Tsuchinoe", 500,             14, [14, 13, 12, 14, 13], 40, 105),
  patente("hinoto", "Hinoto", 600,                   16, [16, 15, 14, 16, 15], 40, 106),
  patente("hinoe", "Hinoe", 700,                     17, [17, 16, 15, 17, 16], 40, 107),
  patente("kinoto", "Kinoto", 800,                   19, [19, 18, 17, 19, 18], 44, 108),
  patente("kinoe", "Kinoe", 900,                     20, [20, 19, 18, 20, 19], 44, 109),
  patente("hashira", "Hashira", 1000,                30, [30, 28, 26, 30, 28], 44, 114),
  patente("hashira_lider", "Líder dos Hashiras", 10000, 35, [35, 33, 31, 35, 33], 44, 116, true),
];

export const ONI = patente("oni", "Oni comum", 0, 8, [8, 8, 7, 7, 8], 44, 102);
const LUAS = [
  patente("lower6", "Lua Inferior 6", 100,         15, [15, 13, 12, 14, 14], 44, 104),
  patente("lower5", "Lua Inferior 5", 200,         17, [17, 15, 14, 16, 16], 44, 105),
  patente("lower4", "Lua Inferior 4", 300,         19, [19, 17, 16, 18, 18], 44, 106),
  patente("lower3", "Lua Inferior 3", 400,         21, [21, 19, 18, 20, 20], 44, 107),
  patente("lower2", "Lua Inferior 2", 500,         23, [23, 21, 20, 22, 22], 44, 108),
  patente("lower1", "Lua Inferior 1", 600,         25, [25, 23, 22, 24, 24], 44, 109),
  patente("upper6", "Lua Superior 6", 700,         40, [40, 38, 35, 38, 37], 48, 115),
  patente("upper5", "Lua Superior 5", 800,         45, [45, 42, 40, 43, 42], 48, 116),
  patente("upper4", "Lua Superior 4", 900,         50, [50, 47, 44, 48, 46], 48, 117),
  patente("upper3", "Lua Superior 3", 1000,        55, [55, 51, 48, 53, 50], 48, 118),
  patente("upper2", "Lua Superior 2", 1100,        60, [60, 55, 52, 58, 54], 48, 119),
  patente("upper1", "Lua Superior 1", 1200,        65, [65, 60, 56, 63, 58], 48, 120),
];
// A transformação concede esta patente. O mínimo indica seu patamar nos portais.
export const HIBRIDO_SUPERIOR = patente("kny_hibrido_superior", "Híbrido Superior", 1300, 68, [68, 63, 58, 66, 61], 48, 121);
export const REI_ONI = patente("kny_muzan", "Rei dos Onis", 10000, 70, [70, 65, 60, 68, 63], 48, 122, true);
export const RANKS_ONI = [...LUAS, REI_ONI];

export const PATENTES = [HUMANO, ...RANKS_CACADOR, ONI, ...LUAS, HIBRIDO_SUPERIOR, REI_ONI];
export const POR_PATENTE = Object.fromEntries(PATENTES.map((r) => [r.tag, r]));
export const ePatenteOni = (r) => r === ONI || r === HIBRIDO_SUPERIOR || RANKS_ONI.includes(r);
export const OBJ_LIDER = "kny_lider";
export const OBJ_REI = "kny_muzan";

export const PTS_INICIAIS = 500;
export const PTS_POR_PONTO_DE_RANK = 50;
export const LIMITE_SALDO = 2147483647;

export const RECOMPENSAS_ONI = [
  { pontos: 250, tipos: [
    "kny:demon", "kny:tongue_demon", "kny:tsunodemon", "kny:hebidemon",
    "kny:yachan_brother", "kny:susamaru", "kny:yahaba", "kny:rengoku_demon",
  ] },
  { pontos: 2500, tipos: [
    "kny:rui", "kny:enmu", "kny:wakuraba", "kny:mukago", "kny:rokuro", "kny:kamanue", "kny:hairo",
  ] },
  { pontos: 25000, tipos: [
    "kny:akaza", "kny:daki", "kny:gyutaro", "kny:gyokko", "kny:hantengu",
    "kny:nakime", "kny:kaigaku", "kny:kokushibo", "kny:zohakuten",
  ] },
  // Invocações de uma luta compartilham a faixa comum de recompensa.
  { pontos: 250, tipos: ["kny:karaku", "kny:sekido", "kny:urogi", "kny:aizetsu"] },
  { pontos: 75000, tipos: ["kny:muzan"] },
];
export const PONTOS_POR_ONI = new Map(RECOMPENSAS_ONI.flatMap(({ tipos, pontos }) => tipos.map((tipo) => [tipo, pontos])));

export const REPS_POR_PONTO = 10;
export const TAPAS_POR_PONTO = 5;
export const SERIES_POR_MELHORIA = 2;
export const CREDITO_POR_SERIE = 20;
export const DOSES_POR_SERIE_VIDA = 3;
export const MAX_MOVIMENTO_SANGUE = 4;
export const PASSO_MOVIMENTO_SANGUE = 2;

export const efeitoForca = (v) => 70 * v / (60 + v);           // percentual
export const reducaoDefesa = (v) => v / (180 + v);             // fração
export const efeitoPoder = (v) => 50 * v / (65 + v);           // percentual
export const bonusVida = (v) => 4 * Math.floor(v / 5);         // PV por faixa
export const staminaMax = (v) => 100 + Math.floor(170 * v / (60 + v));
export const folegoMax = (v) => 100 + Math.floor(160 * v / (55 + v));
export const vidaMax = (r, v) => r.vidaBase + bonusVida(v);
export const movimentoMax = (r, sangue) => (r.movimentoBase + sangue * PASSO_MOVIMENTO_SANGUE) / 1000;
