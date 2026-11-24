import {
  ATRIBUTOS, NIVEL_MAXIMO, CUSTOS, LIMITE_SALDO, PTS_INICIAIS, POR_PATENTE,
  REPS_POR_PONTO, TAPAS_POR_PONTO, SERIES_POR_MELHORIA, DOSES_POR_SERIE_VIDA, MAX_MOVIMENTO_SANGUE,
  CREDITO_POR_SERIE,
} from "./stats_config.js";

export const OBJ_PTS = "kny_pts";
export const VERSAO_DADOS = 2;
export const natural = (valor, maximo = LIMITE_SALDO) =>
  Number.isSafeInteger(valor) && valor >= 0 ? Math.min(valor, maximo) : 0;
export const tamanhoSerie = (a) => a.id === "for" ? TAPAS_POR_PONTO : REPS_POR_PONTO;

function fichaAtributo(legadoTreino = 0, legadoCompra = 0) {
  return { legadoTreino, legadoCompra, pagos: [], revisao: 0, credito: { nivel: 0, series: 0, reps: 0 } };
}

// O registro e a versão são gravados juntos, antes de espelhar qualquer placar.
export function migrarLegado(ler, patente) {
  const hon = natural(ler("upslayer"));
  const mal = natural(ler("updemon"));
  const inicializado = ler("kny_init");
  const mig7 = ler("kny_mig7");
  const saldoOriginal = ler(OBJ_PTS);
  const doses = natural(ler("blood"));
  const honraVista = Math.max(hon, natural(ler("kny_vis_s")));
  const maldicaoVista = Math.max(mal, natural(ler("kny_vis_o")));
  const atributos = {};
  const origem = {};
  let antigo = inicializado !== undefined || mig7 !== undefined || saldoOriginal !== undefined;

  for (const a of ATRIBUTOS) {
    const nivel = ler(a.obj);
    const pontos = ler(a.pts);
    const anterior = ler(a.antigo);
    const treino = ler(a.tr);
    const reps = ler(a.rep);
    origem[a.id] = { nivel: nivel ?? null, pontos: pontos ?? null, anterior: anterior ?? null, treino: treino ?? null, reps: reps ?? null };

    const valorPontos = natural(pontos);
    const compra = natural(nivel);
    // kny_p* e kny_for/kny_vid/... guardavam valores monetários de sistemas antigos.
    // Sem histórico de compras, esses valores ficam no registro de migração.
    antigo ||= compra > 0 || natural(treino) > 0 || valorPontos > 0 || natural(anterior) > 0;
    const limite = patente.limites[a.id];
    const legadoTreino = natural(treino, limite);
    const legadoCompra = Math.min(compra, limite - legadoTreino);
    atributos[a.id] = fichaAtributo(legadoTreino, legadoCompra);
    const desenvolvido = legadoTreino + legadoCompra;
    if (desenvolvido < limite && natural(reps) > 0) {
      atributos[a.id].credito = { nivel: desenvolvido + 1, series: 0, reps: natural(reps, tamanhoSerie(a) - 1) };
    }
  }

  return {
    dados: {
      versao: VERSAO_DADOS,
      patente: patente.tag,
      saldo: antigo ? natural(saldoOriginal) : PTS_INICIAIS,
      honraVista, maldicaoVista, dosesVistas: doses,
      movimentoSangue: Math.min(MAX_MOVIMENTO_SANGUE, Math.floor(doses / DOSES_POR_SERIE_VIDA)),
      atributos,
      migracao: antigo ? { patente: patente.tag, saldo: saldoOriginal ?? null, hon, mal, doses, atributos: origem } : null,
    },
    antigo,
  };
}

export function totalInvestido(dados) {
  let total = 0;
  for (const a of ATRIBUTOS) {
    for (const pago of dados.atributos[a.id].pagos) total += pago ?? 0;
  }
  return total;
}

export function lerRegistro(raw) {
  let origem;
  try {
    origem = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (origem?.versao !== VERSAO_DADOS || !Object.hasOwn(POR_PATENTE, origem.patente) || !origem.atributos) return undefined;

  const atributos = {};
  for (const a of ATRIBUTOS) {
    const antigo = origem.atributos[a.id];
    if (!antigo || !Array.isArray(antigo.pagos)) return undefined;
    const treino = natural(antigo.legadoTreino, NIVEL_MAXIMO);
    const compra = natural(antigo.legadoCompra, NIVEL_MAXIMO - treino);
    const item = fichaAtributo(treino, compra);
    item.revisao = natural(antigo.revisao, Number.MAX_SAFE_INTEGER);
    if (antigo.pagos.length > NIVEL_MAXIMO) return undefined;
    item.pagos = antigo.pagos.map((pago) => pago ?? 0);
    if (item.pagos.some((pago, i) => pago !== 0 && (i < treino + compra || !pagamentosValidos.has(pago)))) return undefined;
    item.credito = {
      nivel: natural(antigo.credito?.nivel, NIVEL_MAXIMO),
      series: natural(antigo.credito?.series, SERIES_POR_MELHORIA),
      reps: natural(antigo.credito?.reps, tamanhoSerie(a) - 1),
    };
    atributos[a.id] = item;
  }

  const dados = {
    versao: VERSAO_DADOS,
    patente: origem.patente,
    saldo: natural(origem.saldo),
    honraVista: natural(origem.honraVista),
    maldicaoVista: natural(origem.maldicaoVista),
    dosesVistas: natural(origem.dosesVistas),
    movimentoSangue: natural(origem.movimentoSangue, MAX_MOVIMENTO_SANGUE),
    atributos,
    migracao: origem.migracao ?? null,
  };
  dados.saldo = Math.min(dados.saldo, LIMITE_SALDO - totalInvestido(dados));
  return dados;
}

const pagamentosValidos = new Set(CUSTOS.flatMap((custo) =>
  Array.from({ length: SERIES_POR_MELHORIA + 1 }, (_, series) => custo - Math.floor(custo * CREDITO_POR_SERIE * series / 100))));
