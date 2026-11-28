// Gera os recursos originais da Oficina. Execute com Node a partir do repositório.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { CANAIS, CATEGORIAS, CORES, CORES_CABELO, IRIS, PELES_INICIAIS, TONS, PROP_APARENCIA, PROP_RASCUNHO } from "./codigo-v70/Kimetsu Fix Be/scripts/character_config.js";

const rp = resolve(dirname(fileURLToPath(import.meta.url)), "codigo-v70/Kimetsu Fix Re");
function gravar(caminho, valor) {
  const arquivo = resolve(rp, caminho);
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, valor);
}
const gravarJson = (caminho, valor) => gravar(caminho, JSON.stringify(valor, null, 2) + "\n");
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const tabelaCRC = Array.from({ length: 256 }, (_, i) => {
  for (let bit = 0; bit < 8; bit++) i = (i & 1) ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
  return i >>> 0;
});
function pedaco(tipo, dados) {
  const bloco = Buffer.concat([Buffer.from(tipo), dados]);
  let crc = 0xffffffff;
  for (const byte of bloco) crc = tabelaCRC[(crc ^ byte) & 255] ^ (crc >>> 8);
  return Buffer.concat([u32(dados.length), bloco, u32(crc ^ 0xffffffff)]);
}
const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const tom = (c, fator) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * fator))));
const ouro = rgb("#e0b363");
const creme = rgb("#f3e8d5");
const rosa = rgb("#e98c9b");
const vinho = rgb("#38090d");
const tinta = rgb("#211721");
function quadro(largura, altura) {
  const pixels = Buffer.alloc((largura * 4 + 1) * altura);
  const ponto = (x, y, cor, a = 255) => {
    if (x < 0 || y < 0 || x >= largura || y >= altura) return;
    pixels.set([...cor, a], y * (largura * 4 + 1) + 1 + x * 4);
  };
  function rect(x, y, w, h, cor, alpha) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) ponto(i, j, cor, alpha);
  }
  function linha(x, y, x2, y2, cor, esp = 1) {
    const passos = Math.max(Math.abs(x2 - x), Math.abs(y2 - y), 1);
    for (let i = 0; i <= passos; i++) rect(Math.round(x + (x2 - x) * i / passos), Math.round(y + (y2 - y) * i / passos), esp, esp, cor);
  }
  function png() {
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pedaco("IHDR", Buffer.concat([u32(largura), u32(altura), Buffer.from([8, 6, 0, 0, 0])])),
      pedaco("IDAT", deflateSync(pixels)), pedaco("IEND", Buffer.alloc(0)),
    ]);
  }
  return { ponto, rect, linha, png };
}

const TEX = "textures/entity/customizacao/";
const UI = "textures/ui/customizacao/";
const texturas = {};
const geometrias = {};
const controladores = {};
const ativacoes = {};
const modelos = [];
const SKELETON = [
  { name: "root", pivot: [0, 0, 0] },
  { name: "waist", parent: "root", pivot: [0, 12, 0] },
  { name: "body", parent: "waist", pivot: [0, 24, 0] },
  { name: "head", parent: "body", pivot: [0, 24, 0] },
  { name: "rightArm", parent: "body", pivot: [-5, 22, 0] },
  { name: "leftArm", parent: "body", pivot: [5, 22, 0] },
  { name: "rightLeg", parent: "root", pivot: [-1.9, 12, 0] },
  { name: "leftLeg", parent: "root", pivot: [1.9, 12, 0] },
];

function textura(nome, tela) {
  texturas["cc_" + nome] = TEX + nome;
  gravar(TEX + nome + ".png", tela.png());
  return "Texture.cc_" + nome;
}

function geometria(nome, partes) {
  const identifier = "geometry.kny.cc_" + nome;
  modelos.push({
    description: { identifier, texture_width: 64, texture_height: 64, visible_bounds_width: 3, visible_bounds_height: 3.5, visible_bounds_offset: [0, 1.25, 0] },
    bones: SKELETON.map((osso) => partes[osso.name] ? { ...osso, cubes: partes[osso.name] } : osso),
  });
  geometrias["cc_" + nome] = identifier;
  return "Geometry.cc_" + nome;
}

// Cada face usa um quadrado em um atlas compartilhado de 64 px.
const QUAD = ["north", "east", "south", "west", "up", "down"];
function cubo(x, y, z, w, h, d, bloco = 0, extras = {}) {
  const uv = Object.fromEntries(QUAD.map((face, i) => [
    face, { uv: [(i % 4) * 8, bloco * 16 + (i >= 4 ? 8 : 0)], uv_size: [8, 8] },
  ]));
  return { origin: [x, y, z], size: [w, h, d], uv, ...extras };
}
function placa(x, y, z, w, h) {
  return { origin: [x, y, z], size: [w, h, 0.025], uv: { north: { uv: [0, 0], uv_size: [8, 8] } } };
}
function atlas(cor, enfeitar) {
  const tela = quadro(64, 64);
  for (let bloco = 0; bloco < 4; bloco++) {
    for (let i = 0; i < 6; i++) {
      const x = (i % 4) * 8;
      const y = bloco * 16 + (i >= 4 ? 8 : 0);
      const faixa = [1.05, 0.83, 0.88, 0.94, 1.18, 0.72][i];
      tela.rect(x, y, 8, 8, tom(cor, faixa));
      for (let j = 1; j < 8; j += 2) {
        for (let k = (j + bloco) % 3; k < 8; k += 3) tela.ponto(x + k, y + j, tom(cor, faixa * 0.9));
      }
      enfeitar?.(tela, x, y, bloco, i);
    }
  }
  return tela;
}

function controlador(nome, geom, tex, condicao, visibilidade) {
  const id = "controller.render.kny.cc_" + nome;
  const d = { geometry: geom.valor, materials: [{ "*": "Material.default" }], textures: [tex.valor] };
  if (geom.array || tex.array) d.arrays = {
    ...(geom.array ? { geometries: { "Array.cc_modelos": geom.array } } : {}),
    ...(tex.array ? { textures: { "Array.cc_cores": tex.array } } : {}),
  };
  if (visibilidade) d.part_visibility = visibilidade;
  controladores[id] = d;
  ativacoes[id] = "!variable.is_first_person && !variable.map_face_icon && !query.is_invisible && query.property('kny:forms') == 0 && (" + condicao + ")";
}
const gArray = (g, campo) => ({ valor: "Array.cc_modelos[variable.cc_" + campo + "]", array: g });
const tArray = (t, campo) => ({ valor: "Array.cc_cores[variable.cc_" + campo + "]", array: t });
const fixo = (valor) => ({ valor });
const padrao = (arr) => [arr[0], ...arr];
const livre = (slot) => "!query.has_armor_slot(" + slot + ")";
const semMarca = "query.property('kny:mark') == 0 && query.property('kny:h_publico') < 2";
const cabecaLivre = livre(0);

// Frentes de rosto, olhos e detalhes compartilham o plano da cabeça.
const pele = TONS.filter((c) => c.codigo > 0).map((c) => textura("pele_" + c.id, atlas(rgb(c.hex), (t, x, y, bloco, face) => {
  if (bloco !== 0 || face !== 0) return;
  t.rect(x + 1, y + 4, 2, 1, creme);
  t.rect(x + 5, y + 4, 2, 1, creme);
  t.ponto(x + 2, y + 4, tinta);
  t.ponto(x + 5, y + 4, tinta);
  t.rect(x + 3, y + 6, 2, 1, tom(rgb(c.hex), 0.64));
})));
const geomPele = geometria("pele", { head: [cubo(-4, 24, -4, 8, 8, 8, 0, { inflate: 0.53 })] });
controlador("pele", fixo(geomPele), tArray(padrao(pele), "pele"),
  "variable.cc_peleIntegral == 0 && variable.cc_pele > 0 && " + cabecaLivre + " && (" + semMarca + ")");

const olhos = IRIS.map((c) => {
  const t = quadro(64, 64);
  t.rect(0, 1, 8, 6, creme);
  t.rect(2, 1, 4, 6, rgb(c.hex));
  t.rect(3, 2, 2, 4, tinta);
  t.rect(3, 2, 1, 1, creme);
  return textura("iris_" + c.id, t);
});
for (const [lado, campo, sinal] of [["e", "olhoE", 1], ["d", "olhoD", -1]]) {
  const variantes = [[2.25, 1.32, 27.1], [2.5, 1.25, 27.1], [2.55, 0.85, 27.3], [2.65, 1.7, 26.95]].map(([w, h, y], i) =>
    geometria("olho_" + lado + "_" + i, { head: [placa(sinal * 2.05 - w / 2, y, -4.64, w, h)] }));
  controlador("olho_" + lado, gArray(padrao(variantes), "olhos"), tArray(olhos, campo), "variable.cc_olhos > 0 && variable.cc_demonio != 4 && " + cabecaLivre);
}
const cicatrizes = [
  [[2, 2, 2, 4]], [[5, 5, 6, 6]], [[1, 4, 2, 6]], [[1, 5, 1, 5], [2, 5, 2, 5], [5, 5, 5, 5], [6, 5, 6, 5]], [[6, 6, 6, 6]],
].map((riscos, i) => {
  const t = quadro(64, 64);
  for (const risco of riscos) t.linha(...risco, i < 3 ? rgb("#a45052") : rgb("#774c3c"));
  return textura("cicatriz_" + (i + 1), t);
});
const planoCicatriz = geometria("cicatriz", { head: [placa(-4, 24, -4.67, 8, 8)] });
controlador("cicatriz", fixo(planoCicatriz), tArray(padrao(cicatrizes), "cicatriz"),
  "variable.cc_cicatriz > 0 && variable.cc_mascara == 0 && " + cabecaLivre + " && (" + semMarca + ")");

const topo = cubo(-4.65, 30.8, -4.62, 9.3, 1.9, 9.25);
const nuca = (y, h) => cubo(-4.5, y, 3.65, 9, h, 1.28);
const franja = (x, y, w, h) => cubo(x, y, -4.92, w, h, 1.05, 1);
const lateral = (x, y, h) => cubo(x, y, -2.75, 1.17, h, 7.2);
const cortes = [
  [nuca(28.25, 3.25), franja(-4.5, 30, 5.4, 1.35), franja(2.8, 30, 1.7, 1.25)],
  [nuca(27.2, 4.2), franja(-4.5, 28.85, 2.2, 2.55), franja(-2.4, 29.7, 3.5, 1.7), franja(2.9, 29.7, 1.6, 1.7)],
  [nuca(24.8, 6.8), lateral(-4.64, 26.2, 4.9), lateral(3.47, 26.2, 4.9), franja(-4.4, 29.05, 2.2, 2.3)],
  [nuca(19, 12.8), lateral(-4.64, 22.5, 8.8), lateral(3.47, 22.5, 8.8), franja(2.8, 29.4, 1.7, 2)],
  [nuca(28.4, 3.2), cubo(-2.4, 32.2, 0.4, 4.8, 2.85, 4.65), franja(-4.4, 30.05, 3.15, 1.25)],
  [nuca(27.9, 3.6), cubo(-1.85, 22.4, 4.7, 3.7, 7.5, 2.3), cubo(-2, 29.35, 4.58, 4, 0.8, 2.5, 1)],
  [nuca(28.3, 3.3), cubo(-3.9, 32.45, -3.3, 2.2, 2.25, 4.2), cubo(-1.25, 32.45, -1.7, 2.4, 3.2, 4.3), cubo(1.65, 32.45, -3.7, 2.4, 2.45, 4.3), franja(-3.8, 29.8, 2.2, 1.6)],
  [nuca(27.65, 3.8), cubo(-4.65, 21.8, 1.5, 1.65, 8.25, 2), cubo(3, 21.8, 1.5, 1.65, 8.25, 2), cubo(-4.7, 23, 1.42, 1.75, 0.85, 2.15, 1), cubo(2.95, 23, 1.42, 1.75, 0.85, 2.15, 1)],
];
const cabelos = cortes.map((c, i) => geometria("cabelo_" + (i + 1), { head: [topo, ...c] }));
const mechas = cortes.map((_, i) => geometria("mecha_" + (i + 1), { head: [
  cubo(-2.8 + i % 3 * 0.75, 32.65, -3.75, i % 2 ? 1.25 : 1.7, 0.14, 4.8, 1),
] }));
const tintas = CORES_CABELO.map((c) => textura("cabelo_" + c.id, atlas(rgb(c.hex), (t, x, y, bloco) => {
  t.rect(x + 1, y, 1, 8, tom(rgb(c.hex), bloco ? 1.25 : 1.12));
  t.rect(x + 5, y, 1, 8, tom(rgb(c.hex), 0.8));
})));
controlador("cabelo", gArray(padrao(cabelos), "cabelo"), tArray(tintas, "corCabelo"), "variable.cc_cabelo > 0 && " + cabecaLivre);
controlador("mecha", gArray(padrao(mechas), "cabelo"), tArray(padrao(tintas), "mecha"), "variable.cc_cabelo > 0 && variable.cc_mecha > 0 && " + cabecaLivre);

const tecido = CORES.map((c) => textura("tecido_" + c.id, atlas(rgb(c.hex), (t, x, y, bloco, face) => {
  const cor = rgb(c.hex);
  if (bloco === 0 && face === 0) {
    t.linha(x + 1, y, x + 4, y + 4, ouro);
    t.linha(x + 6, y, x + 4, y + 4, ouro);
    t.rect(x, y + 7, 8, 1, tom(cor, 0.68));
  } else if (bloco === 1) {
    t.linha(x, y + 5, x + 2, y + 3, tom(cor, 1.4));
    t.linha(x + 2, y + 3, x + 5, y + 5, tom(cor, 1.4));
    t.linha(x + 5, y + 5, x + 7, y + 3, tom(cor, 1.4));
    t.rect(x + 1, y + 7, 3, 1, creme);
  } else if (bloco === 2) {
    t.linha(x + 1, y + 1, x + 5, y + 6, tom(cor, 1.4));
    t.rect(x + 4, y + 1, 2, 1, creme);
    t.rect(x + 1, y + 5, 2, 1, tom(cor, 1.55));
  } else if (bloco === 3 && face === 0) {
    t.rect(x, y + 4, 8, 2, ouro);
    t.rect(x + 3, y + 4, 2, 2, creme);
  }
})));
const vestidos = [
  { bloco: 0, comprimento: 13, manga: 9, perna: 0 },
  { bloco: 1, comprimento: 12.8, manga: 9, perna: 0 },
  { bloco: 3, comprimento: 13.5, manga: 10, perna: 8.4 },
  { bloco: 2, comprimento: 12.8, manga: 5.8, perna: 0, capa: true },
  { bloco: 0, comprimento: 11.9, manga: 8.1, perna: 0 },
  { bloco: 3, comprimento: 12, manga: 6.7, perna: 11.5 },
  { bloco: 2, comprimento: 13.25, manga: 8.2, perna: 0 },
  { bloco: 0, comprimento: 11.6, manga: 4.8, perna: 9.15 },
].map(({ bloco, comprimento, manga, perna, capa }, i) => {
  const body = [cubo(-4.36, 24.25 - comprimento, -2.42, 8.72, comprimento, 4.85, bloco)];
  if (capa) body.push(cubo(-4.75, 8.75, 2.32, 9.5, 14.7, 0.57, 1));
  const partes = {
    body,
    rightArm: [cubo(-8.31, 24.08 - manga, -2.32, 4.36, manga, 4.66, bloco)],
    leftArm: [cubo(3.95, 24.08 - manga, -2.32, 4.36, manga, 4.66, bloco)],
  };
  if (perna) {
    partes.rightLeg = [cubo(-4.18, 12.2 - perna, -2.25, 4.13, perna, 4.5, i === 5 ? 1 : 0)];
    partes.leftLeg = [cubo(0.05, 12.2 - perna, -2.25, 4.13, perna, 4.5, i === 5 ? 1 : 0)];
  }
  return geometria("roupa_" + (i + 1), partes);
});
controlador("roupa", gArray(padrao(vestidos), "roupa"), tArray(tecido, "corRoupa"), "variable.cc_roupa > 0",
  ["body", "leftArm", "rightArm", "leftLeg", "rightLeg"].map((osso) => ({
    [osso]: osso.endsWith("Leg") ? livre(2) + " && " + livre(3) : livre(1),
  })));

const metal = textura("adornos", atlas(rgb("#bc9254"), (t, x, y, b) => {
  const c = [ouro, rosa, rgb("#618476"), rgb("#694435")][b];
  t.rect(x, y, 8, 8, c);
  t.rect(x, y, 8, 1, tom(c, 1.25));
  t.rect(x, y + 7, 8, 1, tom(c, 0.7));
  t.rect(x + 2, y + 3, 4, 2, tom(c, 0.85));
}));
const acessorios = {
  cabeca: [
    [cubo(-4.73, 29.18, -4.94, 9.46, 0.65, 0.46, 3)],
    [cubo(3.12, 29.9, -4.92, 1.9, 1.06, 0.55, 1), cubo(3.62, 29.45, -5.02, 0.85, 2.02, 0.45, 1)],
    [cubo(-3.95, 30.9, -5.02, 7.9, 0.56, 0.48), cubo(-0.73, 30.46, -5.16, 1.46, 1.6, 0.45, 2)],
  ],
  mascara: [
    [cubo(-3.18, 24.65, -5.1, 6.36, 2.65, 0.6, 3)],
    [cubo(-3.37, 24.5, -5.2, 6.74, 2.1, 0.82, 3), cubo(-1.4, 26.45, -5.2, 2.8, 0.65, 0.82, 0)],
  ],
  brincos: [
    [-4.9, 4.38].flatMap((x) => [cubo(x, 25, -1, 0.52, 1.2, 0.95), cubo(x, 24.92, -1.15, 0.52, 0.28, 1.25)]),
    [-4.9, 4.38].flatMap((x) => [cubo(x, 25.2, -0.9, 0.43, 1.02, 0.48), cubo(x - 0.12, 24.4, -1.02, 0.68, 0.8, 0.72, 2)]),
  ],
};
for (const [campo, variantes] of Object.entries(acessorios)) {
  const g = variantes.map((c, i) => geometria(campo + "_" + (i + 1), { head: c }));
  controlador(campo, gArray(padrao(g), campo), fixo(metal), "variable.cc_" + campo + " > 0 && " + cabecaLivre);
}
const osso = textura("tracos", atlas(rgb("#dbbd8b"), (t, x, y, b) => {
  if (b === 1) t.rect(x, y, 8, 8, rgb("#8c253b"));
  if (b === 2) t.rect(x, y, 8, 8, tinta);
}));
const tracos = [
  [cubo(-2.23, 25.1, -4.74, 0.65, 0.92, 0.38), cubo(1.58, 25.1, -4.74, 0.65, 0.92, 0.38)],
  [-3.6, 2.1].flatMap((x) => [cubo(x, 31.6, -3.4, 1.46, 1.62, 1.52), cubo(x + 0.25, 33.2, -3.35, 0.96, 1.18, 1.1)]),
  [cubo(2, 31.55, -2.8, 1.6, 2.08, 1.6), cubo(2.59, 33.62, -2.6, 1.02, 1.25, 1.1), cubo(2.97, 34.86, -2.28, 0.62, 0.83, 0.72)],
  [-2.4, 1.7].flatMap((x) => [cubo(x - 0.55, 27.1, -4.7, 1.78, 1.46, 0.09, 1), cubo(x + 0.12, 27.1, -4.81, 0.43, 1.46, 0.09, 2)]),
  [cubo(-3.25, 24.9, -4.68, 0.43, 2.2, 0.09, 1), cubo(2.88, 24.9, -4.68, 0.43, 2.2, 0.09, 1), cubo(-0.65, 29.1, -4.68, 1.3, 0.35, 0.09, 1)],
].map((c, i) => geometria("traco_" + (i + 1), { head: c }));
controlador("demonio", gArray(padrao(tracos), "demonio"), fixo(osso),
  "variable.cc_demonio > 0 && (variable.cc_demonio != 1 || variable.cc_mascara == 0) && " + cabecaLivre);

gravarJson("models/entity/customizacao/oficina.geo.json", { format_version: "1.12.0", "minecraft:geometry": modelos });

// Reutiliza a geometria do jogador e as visibilidades dos slots de equipamento.
const pelesIntegrais = PELES_INICIAIS.map(({ id, codigo }) => {
  if (codigo === 0) return "Texture.default";
  const alias = "cc_" + id;
  texturas[alias] = TEX + "peles/" + id;
  return "Texture." + alias;
});
const maoDireita = "query.get_equipped_item_name(0, 1)";
const maoEsquerda = "query.get_equipped_item_name('off_hand')";
const mostrarBracoDireito = `${maoDireita} == '' || ${maoDireita} == 'filled_map'`;
const mostrarBracoEsquerdo = `(${maoDireita} == 'filled_map' && ${maoEsquerda} != 'shield') ||
  (${maoEsquerda} == 'filled_map' && !query.item_is_charged) ||
  (!query.item_is_charged && variable.item_use_normalized > 0 && variable.item_use_normalized < 1.0)`.replace(/\s+/g, " ");
const equipamentos = {
  helmet: "variable.helmet_layer_visible",
  leftLegging: "variable.leg_layer_visible", rightLegging: "variable.leg_layer_visible",
  leftBoot: "variable.boot_layer_visible", rightBoot: "variable.boot_layer_visible",
  leftSock: "variable.boot_layer_visible && variable.leg_layer_visible",
  rightSock: "variable.boot_layer_visible && variable.leg_layer_visible",
  bodyArmor: "variable.chest_layer_visible", leftArmArmor: "variable.chest_layer_visible", rightArmArmor: "variable.chest_layer_visible",
  belt: "variable.chest_layer_visible && variable.leg_layer_visible",
};
const vistasPele = [
  ["first_person", "variable.is_first_person", {
    "*": false, rightArm: mostrarBracoDireito, rightSleeve: mostrarBracoDireito,
    leftArm: mostrarBracoEsquerdo, leftSleeve: mostrarBracoEsquerdo,
  }],
  ["third_person", "!variable.is_first_person && !variable.map_face_icon", { "*": true, ...equipamentos }],
  ["map", "variable.map_face_icon", { "*": false, head: true, hat: true, helmet: true }],
];
for (const [vista, condicao, ossos] of vistasPele) {
  const id = "controller.render.kny.pele_" + vista;
  controladores[id] = {
    arrays: { textures: { "Array.peles_kny": pelesIntegrais } },
    geometry: "Geometry.default",
    materials: [{ "*": "Material.default" }],
    textures: ["Array.peles_kny[variable.cc_peleIntegral]"],
    part_visibility: Object.entries(ossos).map(([osso, visivel]) => ({ [osso]: visivel })),
  };
  ativacoes[id] = condicao + " && query.property('kny:forms') == 0 && variable.cc_peleIntegral > 0";
}
gravarJson("render_controllers/customizacao.render_controllers.json", { format_version: "1.8.0", render_controllers: controladores });

const glyphs = {
  info: [[20, 18, 44, 46], [24, 24, 40, 24], [24, 30, 38, 30], [24, 36, 35, 36]],
  pele: [[22, 19, 42, 43], [25, 30, 28, 30], [36, 30, 39, 30], [28, 38, 36, 38]],
  cabelo: [[20, 20, 44, 30], [21, 24, 23, 42], [28, 24, 24, 33], [36, 24, 30, 39], [42, 26, 42, 42]],
  rosto: [[17, 30, 24, 24], [24, 24, 39, 24], [39, 24, 46, 30], [46, 30, 39, 36], [24, 36, 39, 36], [17, 30, 24, 36], [31, 27, 31, 34]],
  roupa: [[17, 24, 27, 18], [27, 18, 31, 27], [35, 27, 39, 18], [39, 18, 47, 24], [18, 25, 22, 39], [42, 39, 47, 25], [22, 40, 42, 40], [26, 32, 38, 32]],
  acessorio: [[31, 15, 31, 23], [31, 24, 24, 34], [31, 24, 38, 34], [24, 34, 31, 44], [38, 34, 31, 44]],
  oni: [[21, 27, 16, 17], [42, 27, 47, 17], [21, 27, 24, 40], [42, 27, 39, 40], [24, 40, 39, 40], [26, 28, 29, 30], [36, 30, 39, 28]],
  hibrido: [[32, 18, 32, 44], [22, 23, 32, 18], [32, 18, 42, 23], [42, 23, 39, 36], [22, 23, 25, 36], [25, 36, 32, 44], [39, 36, 32, 44]],
  conjunto: [[19, 23, 43, 23], [19, 23, 19, 40], [43, 23, 43, 40], [19, 40, 43, 40], [26, 17, 37, 17], [26, 17, 26, 23], [37, 17, 37, 23], [31, 31, 34, 31]],
};
for (const { icone } of CATEGORIAS) {
  const t = quadro(64, 64);
  for (let y = 4; y <= 59; y++) {
    const limite = 58 - Math.floor(Math.abs(y - 31) * 0.57);
    for (let x = 63 - limite; x <= limite; x++) {
      const borde = Math.min(x - (63 - limite), limite - x, y - 4, 59 - y);
      t.ponto(x, y, borde < 2 ? ouro : borde < 4 ? rgb("#842835") : (x + y) % 8 === 0 ? rgb("#4b141b") : vinho);
    }
  }
  for (const segmento of glyphs[icone]) t.linha(...segmento, creme, 2);
  t.rect(29, 51, 6, 2, rosa);
  gravar(UI + icone + ".png", t.png());
}
for (const hex of new Set([...CORES_CABELO, ...IRIS, ...TONS, ...PELES_INICIAIS].map((c) => c.hex).filter(Boolean))) {
  const t = quadro(24, 24);
  t.rect(1, 1, 22, 22, ouro);
  t.rect(3, 3, 18, 18, rgb(hex));
  t.rect(3, 3, 18, 3, tom(rgb(hex), 1.22));
  t.rect(3, 18, 18, 3, tom(rgb(hex), 0.78));
  gravar(UI + "cor_" + hex.slice(1) + ".png", t.png());
}
for (const [nome, cor, destaque] of [["painel", "#1d0910", "#a8793b"], ["botao", "#38090d", "#b98b32"], ["salvar", "#5d171b", "#f2ce78"]]) {
  const t = quadro(80, 48);
  t.rect(1, 1, 78, 46, rgb(destaque));
  t.rect(2, 2, 76, 44, rgb("#120507"));
  t.rect(4, 4, 72, 40, rgb(cor));
  for (let x = 5; x < 75; x += 5) for (let y = 6; y < 43; y += 5) {
    t.ponto(x, y, tom(rgb(cor), 1.38));
    t.ponto(x + 1, y + 1, tom(rgb(cor), 1.17));
  }
  t.rect(5, 5, 3, 2, rosa);
  t.rect(72, 41, 3, 2, rosa);
  gravar(UI + nome + ".png", t.png());
}

// Inserções isoladas no client_entity. Os aliases e controladores preexistentes ficam na mesma ordem.
const cliente = "entity/player.entity.json";
let arquivo = readFileSync(resolve(rp, cliente), "utf8");
const eol = arquivo.includes("\r\n") ? "\r\n" : "\n";
function inserir(id, ancora, linhas) {
  const inicio = "// Oficina " + id + " inicio";
  const fim = "// Oficina " + id + " fim";
  const novo = [inicio, ...linhas, fim].join(eol + "        ");
  if (arquivo.includes(inicio)) {
    const a = arquivo.indexOf(inicio);
    const b = arquivo.indexOf(fim, a);
    if (b < 0) throw new Error("Bloco da Oficina incompleto " + id);
    arquivo = arquivo.slice(0, a) + novo + arquivo.slice(b + fim.length);
  } else {
    const pos = arquivo.indexOf(ancora);
    if (pos < 0) throw new Error("Âncora ausente " + ancora);
    arquivo = arquivo.slice(0, pos + ancora.length) + eol + "        " + novo + arquivo.slice(pos + ancora.length);
  }
}
const pares = (d) => Object.entries(d).map(([k, v]) => JSON.stringify(k) + ": " + JSON.stringify(v) + ",");
const molang = [];
for (const [i, campos] of CANAIS.entries()) {
  const canal = "variable.cc_canal" + i;
  const vivo = "query.property('" + PROP_APARENCIA[i] + "')";
  const rascunho = "query.property('" + PROP_RASCUNHO[i] + "')";
  molang.push(canal + " = (query.is_local_player && " + rascunho + " >= 0) ? " + rascunho + " : " + vivo + ";");
  campos.forEach((campo, indice) => molang.push("variable.cc_" + campo + " = math.mod(math.floor(" + canal + " / " + 16 ** indice + "), 16);"));
}
inserir("texturas", '"textures": {', pares(texturas));
inserir("geometrias", '"geometry": {', pares(geometrias));
inserir("canais", '"pre_animation": [', molang.map((s) => JSON.stringify(s) + ","));
inserir("render", '"render_controllers":[', Object.entries(ativacoes).map(([id, cond]) => JSON.stringify({ [id]: cond }) + ","));
gravar(cliente, arquivo);
console.log("Oficina gerada com " + modelos.length + " geometrias, " + Object.keys(texturas).length + " texturas de entidade e " + Object.keys(controladores).length + " camadas.");
