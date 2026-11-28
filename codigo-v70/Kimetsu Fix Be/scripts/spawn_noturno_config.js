export const ONI_NATURAL = "kny_oni_natural";
export const ONI_NATURAL_PROP = "kny:oni_natural";
export const DIMENSAO_SPAWN = "minecraft:overworld";

export const SPAWN_NOTURNO = Object.freeze({
  inicio: 13000, fim: 23000, intervalo: 200, tentativa: 0.25,
  minimo: 24, maximo: 64, densidade: 80, tentativasDeLocal: 8, alturaDeBusca: 8,
  limite: { comum: { local: 4, global: 40 }, inferior: { local: 1, global: 2 } },
  distanciaLimpeza: 96, esperaLimpeza: 1800, janelaCombate: 600,
});

// Pesos em centésimos de ponto percentual. O bloco comum soma 98,50%.
export const ONIS_COMUNS = Object.freeze({
  "kny:demon": 1, "kny:tongue_demon": 2, "kny:tsunodemon": 2, "kny:hebidemon": 3,
});

export const LUAS_INFERIORES = Object.freeze([
  { id: "kny:kamanue", peso: 45, marca: "blood6", marco: 10 },
  { id: "kny:rui", peso: 35, marca: "blood5", marco: 20 },
  { id: "kny:mukago", peso: 25, marca: "blood4", marco: 30 },
  { id: "kny:wakuraba", peso: 20, marca: "blood3", marco: 40 },
  { id: "kny:rokuro", peso: 15, marca: "blood2", marco: 50 },
  { id: "kny:enmu", peso: 10, marca: "blood1", marco: 60 },
]);
