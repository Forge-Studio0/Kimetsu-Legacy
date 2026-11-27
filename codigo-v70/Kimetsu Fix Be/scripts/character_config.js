const opcao = (id, nome, codigo, extra = {}) => ({ id, nome, codigo, ...extra });
const nenhuma = opcao("nenhum", "Padrão", 0);
const modelo = (id, nome, codigo) => opcao(id, nome, codigo);
const cor = (id, nome, codigo, hex) => opcao(id, nome, codigo, { hex });

export const CORES = [
  cor("carvao", "Carvão", 0, "#292026"),
  cor("castanha", "Castanha", 1, "#5e382c"),
  cor("vinho", "Vinho", 2, "#7f283f"),
  cor("acobreada", "Cobre", 3, "#ac5536"),
  cor("dourada", "Mel", 4, "#c79a48"),
  cor("neve", "Neve", 5, "#d4c2ae"),
  cor("cinza", "Cinza", 6, "#7e7682"),
  cor("indigo", "Índigo", 7, "#34486b"),
  cor("pinho", "Pinho", 8, "#3b6659"),
  cor("ameixa", "Ameixa", 9, "#734e73"),
];
export const CORES_CABELO = [...CORES, cor("amarelo", "Amarelo sol", 10, "#f5d334")];
export const IRIS = [
  cor("castanho", "Castanho", 0, "#5d362c"),
  cor("ambar", "Âmbar", 1, "#ba873b"),
  cor("avela", "Avelã", 2, "#8c5537"),
  cor("azul", "Azul", 3, "#3c699c"),
  cor("jade", "Jade", 4, "#497960"),
  cor("cinza", "Cinza", 5, "#77828b"),
  cor("vinho", "Vinho", 6, "#863447"),
  cor("ametista", "Ametista", 7, "#75528a"),
  cor("rosa", "Rosa", 8, "#aa6178"),
  cor("turquesa", "Turquesa", 9, "#408f90"),
  cor("ciano", "Ciano vivo", 10, "#39dcea"),
];
export const TONS = [
  opcao("nenhum", "Rosto da skin", 0),
  cor("porcelana", "Porcelana", 1, "#efc8ac"),
  cor("areia", "Areia", 2, "#d9ae87"),
  cor("mel", "Mel", 3, "#b98560"),
  cor("terracota", "Terracota", 4, "#a96f56"),
  cor("bronze", "Bronze", 5, "#86543d"),
  cor("cacau", "Cacau", 6, "#614034"),
  cor("ebano", "Ébano", 7, "#4a302d"),
];
const TONS_INICIAIS = [
  ["e8b98f", "Claro"], ["c98f65", "Mel"], ["a66b45", "Cobre"], ["75452f", "Castanho"], ["4a2c20", "Escuro"],
];
export const PELES_INICIAIS = [
  opcao("nenhum", "Pele da conta", 0),
  ...["a", "b"].flatMap((base, grupo) => TONS_INICIAIS.map(([hex, nome], i) =>
    cor("pele_" + base + "_" + hex, "Base " + base.toUpperCase() + " · " + nome, grupo * TONS_INICIAIS.length + i + 1, "#" + hex)
  )),
];
const CAMPO = (nome, opcoes) => ({ nome, opcoes });
export const CAMPOS = {
  peleIntegral: CAMPO("Pele de corpo inteiro", PELES_INICIAIS),
  cabelo: CAMPO("Modelo de cabelo", [
    nenhuma, modelo("corte_curto", "Curto repartido", 1), modelo("franja", "Franja lateral", 2),
    modelo("ondas", "Ondas médias", 3), modelo("longo", "Longo aberto", 4),
    modelo("coque", "Coque alto", 5), modelo("rabo", "Rabo baixo", 6),
    modelo("espinhos", "Espetado", 7), modelo("trancas", "Duas tranças", 8),
  ]),
  corCabelo: CAMPO("Cor principal", CORES_CABELO),
  mecha: CAMPO("Cor da mecha", [opcao("nenhum", "Sem mecha", 0), ...CORES_CABELO.map((c) => ({ ...c, codigo: c.codigo + 1 }))]),
  pele: CAMPO("Tom do rosto", TONS),
  // Campo reservado para manter o código das fichas v76. A camada foi retirada.
  rosto: CAMPO("Expressão", [
    nenhuma, modelo("calma", "Serena", 1), modelo("firme", "Firme", 2),
    modelo("sorriso", "Sorriso", 3), modelo("seria", "Concentrada", 4),
  ]),
  olhos: CAMPO("Formato dos olhos", [
    nenhuma, modelo("retos", "Retos", 1), modelo("suaves", "Suaves", 2),
    modelo("finos", "Finos", 3), modelo("amplos", "Amplos", 4),
  ]),
  olhoE: CAMPO("Íris esquerda", IRIS),
  olhoD: CAMPO("Íris direita", IRIS),
  cicatriz: CAMPO("Cicatriz ou traço", [
    nenhuma, modelo("sobrancelha", "Risca na sobrancelha", 1), modelo("bochecha", "Cicatriz na bochecha", 2),
    modelo("diagonal", "Cicatriz diagonal", 3), modelo("sardas", "Sardas", 4), modelo("pingo", "Pinta", 5),
  ]),
  roupa: CAMPO("Conjunto", [
    nenhuma, modelo("haori_liso", "Haori de viagem", 1), modelo("haori_ondas", "Haori de ondas", 2),
    modelo("kimono", "Kimono de faixa", 3), modelo("manto", "Manto de inverno", 4),
    modelo("kosode", "Kosode simples", 5), modelo("hakama", "Hakama cerimonial", 6),
    modelo("haori_folhas", "Haori de folhas", 7), modelo("camisa", "Camisa de viajante", 8),
  ]),
  corRoupa: CAMPO("Cor do tecido", CORES),
  cabeca: CAMPO("Adorno de cabeça", [
    nenhuma, modelo("faixa", "Faixa de tecido", 1), modelo("presilha", "Presilha de cerejeira", 2),
    opcao("adorno_festival", "Ornamento do festival", 3, { concessao: true }),
  ]),
  mascara: CAMPO("Acessório facial", [
    nenhuma, modelo("tecido", "Máscara de pano", 1), modelo("madeira", "Máscara de madeira", 2),
  ]),
  brincos: CAMPO("Brincos", [
    nenhuma, modelo("argolas", "Argolas de latão", 1), modelo("gotas", "Brincos de jade", 2),
  ]),
  demonio: CAMPO("Traço demoníaco", [
    nenhuma, modelo("presas", "Presas", 1), modelo("chifres", "Chifres curtos", 2),
    modelo("chifre_lateral", "Chifre lateral", 3), modelo("pupilas", "Pupilas fendidas", 4),
    modelo("selo", "Traços de tinta", 5),
  ]),
};

export const CANAIS = [
  ["cabelo", "corCabelo", "mecha", "pele", "rosto", "olhos"],
  ["olhoE", "olhoD", "cicatriz", "roupa", "corRoupa", "cabeca"],
  ["mascara", "brincos", "demonio", "peleIntegral"],
];
export const PROP_APARENCIA = ["kny:cc_a", "kny:cc_b", "kny:cc_c"];
export const PROP_RASCUNHO = ["kny:cc_da", "kny:cc_db", "kny:cc_dc"];
export const VISUAL_PADRAO = Object.freeze(Object.fromEntries(
  Object.entries(CAMPOS).map(([campo, { opcoes }]) => [campo, opcoes[0].id])
));

export const CATEGORIAS = [
  { id: "pele", nome: "Pele", icone: "pele", campos: ["peleIntegral"], vista: "corpo" },
  { id: "cabelo", nome: "Cabelo", icone: "cabelo", campos: ["cabelo", "corCabelo", "mecha"], vista: "rosto" },
  { id: "olhos", nome: "Olhos", icone: "rosto", campos: ["olhos", "olhoE", "olhoD"], vista: "rosto" },
];
export const CAMPOS_INICIAIS = new Set(CATEGORIAS.flatMap(({ campos }) => campos));

export function opcaoDe(campo, id) {
  return CAMPOS[campo]?.opcoes.find((o) => o.id === id);
}

export function codificarVisual(visual) {
  return CANAIS.map((campos) => campos.reduce(
    (canal, campo, indice) => canal + (opcaoDe(campo, visual[campo])?.codigo ?? 0) * 16 ** indice, 0
  ));
}
