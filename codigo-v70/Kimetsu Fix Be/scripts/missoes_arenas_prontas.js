import { BlockPermutation, BlockVolume } from "@minecraft/server";
import { registrarAuditoria } from "./hybrid_records.js";
import { ehStaff } from "./hybrid_system.js";
import { DIFICULDADES, REGRAS_MISSAO } from "./missoes_catalogo.js";
import {
  DIM_ARENAS, arenas, caixaCarregamento, carregarArea, descarregarArea, destinoSeguro, dentro,
  erroArena, gravarArena, novoLocal, pegarArena, validarPontos,
} from "./missoes_arenas.js";

const LADO = 32;
const ALTURA = 16;
const PISO = 1;
const ENTRADAS = [[10, 4], [13, 4], [18, 4], [21, 4]];
const FILTRO_OCUPADO = { excludeTypes: ["minecraft:air"] };
const MODELOS = [
  {
    id: "patio_da_vigilia", nome: "Pátio da Vigília",
    tipos: ["abates", "ondas", "chefe", "sobreviver"], missoes: [],
    spawns: [[15, 23], [11, 22], [20, 22], [7, 25], [24, 25], [15, 28], [10, 27], [21, 27]],
    desenhar: patio,
  },
  {
    id: "refugio_das_lanternas", nome: "Refúgio das Lanternas",
    tipos: ["local", "proteger"], missoes: ["sagiri", "natagumo", "rui", "enmu"],
    objetivo: [15, 23],
    spawns: [[15, 13], [8, 11], [23, 11], [6, 18], [25, 18], [8, 25], [23, 25], [15, 28]],
    desenhar: refugio,
  },
];

let instalando = false;

function contorno(preencher, baixo, alto, bloco) {
  const borda = LADO - 1;
  preencher(bloco, [0, baixo, 0], [borda, alto, 0]);
  preencher(bloco, [0, baixo, borda], [borda, alto, borda]);
  preencher(bloco, [0, baixo, 1], [0, alto, borda - 1]);
  preencher(bloco, [borda, baixo, 1], [borda, alto, borda - 1]);
}

function casca(preencher, piso, parede, viga) {
  preencher("deepslate_tiles", [0, 0, 0], [31, 0, 31]);
  preencher(piso, [0, PISO, 0], [31, PISO, 31]);
  contorno(preencher, 2, 3, "polished_deepslate");
  contorno(preencher, 4, 6, parede);
  contorno(preencher, 7, 7, viga);
  contorno(preencher, 8, 14, "barrier");
  preencher("tinted_glass", [0, 15, 0], [31, 15, 31]);
  for (const pos of [0, 8, 16, 23, 31]) {
    preencher(viga, [pos, 15, 0], [pos, 15, 31]);
    preencher(viga, [0, 15, pos], [31, 15, pos]);
  }
}

function patio(preencher) {
  const pedra = "polished_deepslate";
  const cinza = "polished_andesite";
  const vermelho = "red_terracotta";
  casca(preencher, cinza, vermelho, pedra);
  // Faixas do piso e área livre ao centro para chefes e ondas.
  preencher(pedra, [3, PISO, 3], [28, PISO, 28]);
  preencher(cinza, [5, PISO, 5], [26, PISO, 26]);
  preencher("smooth_stone", [10, PISO, 10], [21, PISO, 21]);
  preencher(vermelho, [13, PISO, 13], [18, PISO, 18]);
  preencher(pedra, [15, PISO, 14], [16, PISO, 17]);
  for (const x of [5, 26]) {
    for (const z of [7, 15, 24]) {
      preencher(pedra, [x, 2, z], [x, 4, z]);
      preencher(vermelho, [x, 5, z]);
      preencher("lantern", [x, 6, z]);
    }
  }
  for (const x of [8, 23]) {
    preencher(vermelho, [x, 2, 2], [x, 7, 2]);
    preencher(pedra, [x - 1, 2, 2], [x + 1, 2, 2]);
  }
  preencher(vermelho, [8, 7, 2], [23, 7, 2]);
  preencher(pedra, [7, 8, 2], [24, 8, 2]);
  for (const x of [8, 12, 19, 23]) {
    for (const z of [6, 17, 27]) preencher("shroomlight", [x, PISO, z]);
  }
}

function refugio(preencher) {
  const madeira = "spruce_planks";
  const pilar = "dark_oak_log";
  const verde = "green_terracotta";
  casca(preencher, madeira, verde, pilar);
  // O caminho claro liga as entradas ao pavilhão, com rotas livres pelos lados.
  preencher("smooth_stone", [13, PISO, 5], [18, PISO, 27]);
  preencher("polished_andesite", [4, PISO, 14], [27, PISO, 17]);
  preencher(pilar, [11, PISO, 20], [20, PISO, 26]);
  preencher("smooth_stone", [12, PISO, 21], [19, PISO, 25]);
  preencher("orange_terracotta", [14, PISO, 22], [17, PISO, 24]);
  preencher("shroomlight", [15, PISO, 23]);
  for (const x of [11, 20]) {
    for (const z of [20, 26]) {
      preencher(pilar, [x, 2, z], [x, 6, z]);
      preencher("shroomlight", [x, 6, z + (z === 20 ? 1 : -1)]);
    }
  }
  preencher(pilar, [10, 7, 19], [21, 7, 27]);
  preencher("orange_terracotta", [11, 8, 20], [20, 8, 26]);
  preencher(pilar, [12, 9, 21], [19, 9, 25]);
  for (const x of [4, 25]) {
    for (const z of [6, 20]) {
      preencher("polished_deepslate", [x, 2, z], [x + 1, 2, z + 2]);
      preencher(verde, [x, 3, z + 1], [x + 1, 3, z + 1]);
    }
  }
  for (const x of [9, 12, 19, 22]) {
    for (const z of [7, 12, 18, 28]) preencher("shroomlight", [x, PISO, z]);
  }
}

function ficha(modelo, x, saida) {
  const a = { x, y: 96, z: 512 };
  const b = { x: x + LADO - 1, y: a.y + ALTURA - 1, z: a.z + LADO - 1 };
  const ponto = ([dx, dz]) => ({ x: a.x + dx + 0.5, y: a.y + PISO + 1, z: a.z + dz + 0.5 });
  return {
    v: 1, id: modelo.id, nome: modelo.nome, dim: DIM_ARENAS, modelo: modelo.id, ativa: true, a, b, saida,
    capacidade: REGRAS_MISSAO.grupoMaximo, ranks: Object.keys(DIFICULDADES), tipos: modelo.tipos, missoes: modelo.missoes,
    entradas: ENTRADAS.map(ponto), spawns: modelo.spawns.map(ponto),
    objetivo: modelo.objetivo ? ponto(modelo.objetivo) : undefined,
  };
}

function prepararConstrucao(modelo, arena) {
  const base = arena.a;
  const pos = ([x, y, z]) => ({ x: base.x + x, y: base.y + y, z: base.z + z });
  const passos = [];
  modelo.desenhar((bloco, inicio, fim = inicio) => {
    const de = pos(inicio), ate = pos(fim);
    if (!dentro(arena, de) || !dentro(arena, ate)) throw new Error("Um bloco do modelo está fora dos limites.");
    passos.push([new BlockVolume(de, ate), BlockPermutation.resolve("minecraft:" + bloco)]);
  });
  return passos;
}

function espacoOcupado(arena, dim, volume) {
  return dim.getEntities().some((e) => dentro(arena, e.location, 8)) ||
    dim.containsBlock(volume, FILTRO_OCUPADO);
}

async function reservarLocal(modelo, saida, reservas) {
  for (let x = 512; x <= 1920; x += 128) {
    const chave = "kny_instalacao_" + modelo.id + "_" + x;
    const arena = ficha(modelo, x, saida);
    if (erroArena(arena, [...arenas(), ...reservas.map((local) => local.arena)])) continue;
    const area = caixaCarregamento(arena);
    const volume = new BlockVolume(area.from, area.to);
    let reservar = false;
    try {
      await carregarArea(chave, area);
      if (espacoOcupado(arena, area.dimension, volume)) continue;
      reservas.push({ chave, arena, dim: area.dimension, volume, passos: prepararConstrucao(modelo, arena) });
      reservar = true;
      return;
    } finally {
      if (!reservar) descarregarArea(chave);
    }
  }
  throw new Error("Não encontrei espaço livre para " + modelo.nome + ".");
}

function construir({ arena, dim, volume, passos }) {
  try {
    for (const [caixa, bloco] of passos) dim.fillBlocks(caixa, bloco);
    if (!validarPontos(arena)) throw new Error("Os pontos de " + arena.nome + " não passaram na validação.");
    gravarArena(arena);
  } catch (erro) {
    // A caixa foi confirmada vazia no mesmo tick, antes de qualquer preenchimento.
    dim.fillBlocks(volume, "minecraft:air");
    throw erro;
  }
}

export async function instalarArenasProntas(p) {
  const criadas = [];
  if (!ehStaff(p)) return { criadas, erro: "A instalação exige permissão de Staff." };
  if (instalando) return { criadas, erro: "Já há uma instalação em andamento." };
  const pendentes = [];
  for (const modelo of MODELOS) {
    const existente = pegarArena(modelo.id);
    if (existente === undefined) pendentes.push(modelo);
    else if (existente?.modelo !== modelo.id) {
      return { criadas, erro: "Já existe outro cadastro com o ID " + modelo.id + "." };
    }
  }
  if (!pendentes.length) return { criadas };
  const dimSaida = p.dimension;
  const saida = { dim: dimSaida.id, pos: novoLocal(p) };
  if (saida.dim === DIM_ARENAS || !destinoSeguro(dimSaida, saida.pos)) {
    return { criadas, erro: "Fique sobre piso firme no mundo normal para usar sua posição como saída." };
  }
  instalando = true;
  const reservas = [];
  try {
    for (const modelo of pendentes) await reservarLocal(modelo, saida, reservas);
    if (!p.isValid || !ehStaff(p) || p.dimension.id !== saida.dim || !destinoSeguro(dimSaida, saida.pos)) {
      throw new Error("A saída ou a permissão mudou. Confirme a instalação novamente de um ponto seguro.");
    }
    const todas = [...arenas(), ...reservas.map(({ arena }) => arena)];
    for (const { arena, dim, volume } of reservas) {
      if (pegarArena(arena.id) !== undefined || erroArena(arena, todas) || espacoOcupado(arena, dim, volume)) {
        throw new Error("Uma região mudou durante a instalação. Tente novamente para procurar um espaço livre.");
      }
    }
    for (const local of reservas) {
      construir(local);
      criadas.push(local.arena);
      registrarAuditoria("arena_instalada", { staff: p.name, arena: local.arena.id });
    }
    return { criadas };
  } catch (erro) {
    console.warn("[Instalação de arenas] " + erro);
    return { criadas, erro: erro.message };
  } finally {
    for (const { chave } of reservas) descarregarArea(chave);
    instalando = false;
  }
}
