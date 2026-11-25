import { RESPIRACOES, KEKKIJUTSUS } from "./menu_data.js";

export const H = Object.freeze({
  aceitarBasica: false,
  arteInicial: "enmu",
  revelarPoder: true,
  combateMs: 10000,
  disfarceMs: 30000,
  solTicks: 20,
  solInicio: 0,
  solFim: 12000,
  solDanoOni: 1,
  solResistencia: 0.5,
  solProtecaoLegitima: 0.25,
  casteloPreparacao: 100,
  casteloMs: 120000,
});

export const RESP_H = [
  ...RESPIRACOES.map((r) => ({ ...r, itens: [r.item, ...(
    r.obj === "flower" ? ["kny:nichirin_kanae"] : r.obj === "yoriichi" ? ["kny:nichirin_tanjiro2"] : []
  )] })),
  { obj: "basica", nome: "Respiração Básica", formas: ["Corte Básico", "Giro Nichirin", "Estocada Veloz"], itens: [] },
].map((r, i) => ({ ...r, codigo: i + 1 }));

export const ARTES_H = [
  ...KEKKIJUTSUS,
  { obj: "kemari", nome: "Kemari", item: "kny:kemari" },
  { obj: "nezuko", nome: "Sangue Explosivo", item: "kny:nezuko_kekkijutsu" },
].map((a, i) => ({ ...a, codigo: i + 1 }));

export const RESP_H_ID = new Map(RESP_H.map((r) => [r.obj, r]));
export const ARTE_H_ID = new Map(ARTES_H.map((a) => [a.obj, a]));
export const IDENTIDADES = Object.freeze({ cacador: 1, oni: 2, revelado: 3 });
export const ROTULOS = Object.freeze({ cacador: "Caçador", oni: "Oni", revelado: "Híbrido" });
export const DOMINAVEL = (id) => RESP_H_ID.has(id) && (id !== "basica" || H.aceitarBasica);

// Valores iniciais para teste da Staff. Todos os tempos de duração são ticks.
export const ESPECIAIS = Object.freeze({
  ruptura: { nome: "Ruptura Celestial", texto: "Um corte elétrico em linha, interrompido por paredes.", folego: 35, stamina: 16, ms: 45000, dano: 7, alcance: 8, alvos: 3, duracao: 0, particula: "kny:dark_distant_thunder", som: "thunder2" },
  dragao: { nome: "Dragão Carmesim", texto: "Uma onda larga avança em três pulsos e acerta cada alvo uma vez.", folego: 48, stamina: 24, ms: 70000, dano: 8, alcance: 9, alvos: 5, duracao: 12, particula: "kny:blood_sickles", som: "blood_blade" },
  passo: { nome: "Passo Espectral", texto: "Desloca o usuário até seis blocos em uma trajetória desimpedida.", folego: 24, stamina: 36, ms: 30000, dano: 0, alcance: 6, alvos: 0, duracao: 0, particula: "kny:thunderflash", som: "tp_mist" },
  prisao: { nome: "Prisão da Tempestade", texto: "Cria um campo elétrico curto que retarda adversários próximos.", folego: 42, stamina: 22, ms: 75000, dano: 0, alcance: 4, alvos: 5, duracao: 80, particula: "kny:dark_distant_thunder", som: "thunderstroke" },
  sombras: { nome: "Domínio das Sombras", texto: "Uma névoa à frente limita a visão de até quatro adversários.", folego: 36, stamina: 18, ms: 65000, dano: 0, alcance: 5, alvos: 4, duracao: 60, particula: "kny:layered_mist", som: "mist6" },
  carapaca: { nome: "Carapaça Rubra", texto: "Reduz em 25% o dano de ataques por quatro segundos.", folego: 30, stamina: 20, ms: 60000, dano: 0, alcance: 0, alvos: 0, duracao: 80, reducao: 0.25, particula: "kny:exploding_blood", som: "blood" },
});
