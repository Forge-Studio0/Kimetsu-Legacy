import { system, world } from "@minecraft/server";
import { sessaoAtual as sessaoDeAparencia } from "./character_system.js";
import { retornoPendente } from "./character_studio.js";
import { destinoSeguro, viagemEmCurso } from "./hybrid_locations.js";
import { gravarJson, lerJson, personagem } from "./hybrid_records.js";
import { emCombate, estadoBloqueado } from "./hybrid_system.js";
import { comPontoCarregado, coordenadaValida } from "./missoes_arenas.js";
import { operacaoMissao } from "./missoes_sessoes.js";
import { regiaoPermiteRecurso } from "./regioes_v86.js";
import { aguardaResgate, resgateEmCurso } from "./revive.js";

export const ITEM_PERGAMINHO = "kny:pergaminho_teleporte";
export const MAX_DESTINOS = 10;
export const TICKS_PREPARACAO = 100;
const CHAVE = "kny:pergaminho_destinos";
const DISTANCIA_MOVIMENTO = 0.5;
const MAX_CARREGAMENTOS = 4;
const LIMITE = "Você atingiu o limite de dez destinos. Exclua uma localização para continuar.";
const FICHA_INVALIDA = "O registro de destinos está inválido. Consulte a Staff.";
const SEM_ITEM = "Você precisa ter um Pergaminho de Teletransporte no inventário.";
const REGIAO = "A região é protegida para o pergaminho.";
const NOME_INVALIDO = "Use um nome de 1 a 24 caracteres, sem formatação.";
const sessoes = new Map();
let carregamentos = 0;
let serial = 0;

const eJogador = (p) => p?.isValid && p.typeId === "minecraft:player";
const avisar = (p, mensagem, cor = "§e") => {
  if (eJogador(p)) p.sendMessage("§6[Pergaminho] " + cor + mensagem);
};
const inventario = (p) => p.getComponent("minecraft:inventory")?.container;
const rotacaoValida = (r) => Number.isFinite(r?.x) && Number.isFinite(r?.y) && Math.abs(r.x) <= 90 && Math.abs(r.y) <= 360;
const dimValida = (dim) => typeof dim === "string" && dim.length <= 64 && /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(dim);
function nomeValido(valor) {
  if (typeof valor !== "string") return;
  const nome = valor.normalize("NFC").trim();
  if (nome && [...nome].length <= 24 && !/[§\p{Cc}\p{Cf}]/u.test(nome)) return nome;
}

// Usa um slot conhecido nas verificações frequentes da preparação.
function localizarItem(p, sugestao) {
  const c = inventario(p);
  const temNoSlot = (slot) => Number.isInteger(slot) && slot >= 0 && slot < c.size && c.getItem(slot)?.typeId === ITEM_PERGAMINHO;
  if (c) {
    if (temNoSlot(sugestao)) return sugestao;
    if (temNoSlot(p.selectedSlotIndex)) return p.selectedSlotIndex;
    for (let i = 0; i < c.size; i++) if (temNoSlot(i)) return i;
  }
  if (p.getComponent("minecraft:equippable")?.getEquipment("Offhand")?.typeId === ITEM_PERGAMINHO) return "offhand";
}

export function possuiPergaminho(p) {
  return eJogador(p) && localizarItem(p) !== undefined;
}

function ficha(p) {
  const f = lerJson(p, CHAVE);
  if (f === undefined) return { v: 1, proximo: 1, destinos: [] };
  if (!Number.isSafeInteger(f?.proximo) || f.proximo < 1 || !Array.isArray(f.destinos) || f.destinos.length > MAX_DESTINOS) return null;
  const ids = new Set();
  for (const d of f.destinos) {
    const nome = nomeValido(d?.nome);
    if (d?.v !== 1 || !Number.isSafeInteger(d.id) || d.id < 1 || d.id >= f.proximo || ids.has(d.id) ||
        !nome || d.nome !== nome || !dimValida(d.dim) ||
        !coordenadaValida(d.pos) || !rotacaoValida(d.rot)) return null;
    ids.add(d.id);
  }
  return f;
}

export function listarDestinos(p) {
  return eJogador(p) ? ficha(p)?.destinos : undefined;
}

function estado(p) {
  if (estadoBloqueado(p)) return "Seu personagem está derrubado, morto ou indisponível.";
  if (emCombate(p)) return "Aguarde o fim do combate.";
  if (operacaoMissao(p)) return "Saia da sessão de missão antes de usar o pergaminho.";
  if (sessaoDeAparencia(p) || retornoPendente(p) || p.getProperty("kny:cc_edicao")) return "Conclua a personalização antes de viajar.";
  if (resgateEmCurso(p) || aguardaResgate(p.id)) return "Aguarde o fim do resgate.";
  const registro = personagem(p);
  if (viagemEmCurso(p) || registro === null || registro?.estado === "transformando" ||
      p.getProperty("kny:h_ocupado") || p.getProperty("kny:forms") > 0 || p.getProperty("kny:treino") > 0) {
    return "Aguarde o fim da ação ou viagem em andamento.";
  }
}

function impedimentoEdicao(p) {
  if (!possuiPergaminho(p)) return SEM_ITEM;
  if (sessoes.has(p.id)) return "Aguarde o término da preparação.";
}

export function impedimentoPergaminho(p) {
  const erro = impedimentoEdicao(p) ?? estado(p);
  if (erro) return erro;
  if (!regiaoPermiteRecurso(p, p.dimension.id, p.location, "pergaminho")) return REGIAO;
}

export function salvarDestinoAtual(p, texto) {
  const erro = impedimentoPergaminho(p);
  if (erro) return erro;
  const f = ficha(p);
  if (!f || f.proximo === Number.MAX_SAFE_INTEGER) return FICHA_INVALIDA;
  if (f.destinos.length >= MAX_DESTINOS) return LIMITE;
  const nome = nomeValido(texto);
  if (!nome) return NOME_INVALIDO;
  const pos = { ...p.location };
  const rot = p.getRotation();
  const dim = p.dimension;
  if (!coordenadaValida(pos) || !rotacaoValida(rot) || !dim.isChunkLoaded(pos) || !destinoSeguro(dim, pos)) {
    return "Use uma posição segura com piso firme e espaço para o personagem.";
  }
  f.destinos.push({ v: 1, id: f.proximo++, nome, dim: dim.id, pos, rot });
  gravarJson(p, CHAVE, f);
}

function editarDestino(p, id, acao) {
  const erro = impedimentoPergaminho(p);
  if (erro) return erro;
  const f = ficha(p);
  if (!f) return FICHA_INVALIDA;
  const i = f.destinos.findIndex((d) => d.id === id);
  if (i < 0) return "Localização não encontrada.";
  acao(f.destinos, i);
  gravarJson(p, CHAVE, f);
}

export function renomearDestino(p, id, texto) {
  const nome = nomeValido(texto);
  if (!nome) return NOME_INVALIDO;
  return editarDestino(p, id, (lista, i) => { lista[i].nome = nome; });
}

export function excluirDestino(p, id) {
  return editarDestino(p, id, (lista, i) => lista.splice(i, 1));
}

function permissoes(p, destino) {
  if (p.dimension.id !== destino.dim) return "O destino está em outra dimensão.";
  if (!regiaoPermiteRecurso(p, p.dimension.id, p.location, "pergaminho") ||
      !regiaoPermiteRecurso(p, destino.dim, destino.pos, "pergaminho")) return REGIAO;
}

export function iniciarTeleportePessoal(p, id) {
  const erro = impedimentoEdicao(p) ?? estado(p);
  if (erro) return erro;
  const f = ficha(p);
  if (!f) return FICHA_INVALIDA;
  const destino = f.destinos.find((d) => d.id === id);
  if (!destino) return "Localização não encontrada.";
  const impedimentoRegiao = permissoes(p, destino);
  if (impedimentoRegiao) return impedimentoRegiao;
  const preparo = {
    p, destino, origem: { ...p.location }, prazo: system.currentTick + TICKS_PREPARACAO,
    item: localizarItem(p), restante: 5, carregando: false,
  };
  sessoes.set(p.id, preparo);
  p.onScreenDisplay.setActionBar(`§6Teletransportando para ${destino.nome}… §e5`);
}

function cancelar(id, motivo) {
  const preparo = sessoes.get(id);
  if (!preparo) return;
  sessoes.delete(id);
  if (motivo) avisar(preparo.p, "Viagem cancelada. " + motivo);
}

function interrupcao(preparo, conferirRegiao) {
  const { p, origem, destino } = preparo;
  if (!eJogador(p)) return "Jogador desconectado.";
  const erro = estado(p);
  if (erro) return erro;
  if (p.dimension.id !== destino.dim) return "Você mudou de dimensão.";
  const { x, y, z } = p.location;
  if (Math.hypot(x - origem.x, y - origem.y, z - origem.z) > DISTANCIA_MOVIMENTO) return "Você se moveu.";
  preparo.item = localizarItem(p, preparo.item);
  if (preparo.item === undefined) return SEM_ITEM;
  if (!conferirRegiao) return;
  const atual = ficha(p)?.destinos.find((d) => d.id === destino.id);
  if (JSON.stringify(atual) !== JSON.stringify(destino)) return "A localização foi alterada ou deixou de estar disponível.";
  return permissoes(p, destino);
}

async function concluir(preparo) {
  const { p, destino } = preparo;
  const id = p.id;
  const continua = () => sessoes.get(id) === preparo;
  let reservouCarregamento = false;
  try {
    const dim = p.dimension;
    if (!dim.isChunkLoaded(destino.pos)) {
      if (carregamentos >= MAX_CARREGAMENTOS) {
        cancelar(id, "Limite de carregamentos simultâneos. Tente novamente.");
        return;
      }
      reservouCarregamento = true;
      carregamentos++;
    }
    preparo.carregando = true;
    await comPontoCarregado("kny_pergaminho_" + ++serial, dim, destino.pos, () => {
      const erro = interrupcao(preparo, true);
      if (erro) return cancelar(id, erro);
      if (!destinoSeguro(dim, destino.pos)) return cancelar(id, "A localização está insegura.");
      if (!p.tryTeleport(destino.pos, { dimension: dim, rotation: destino.rot, keepVelocity: false, checkForBlocks: true })) {
        return cancelar(id, "O mundo bloqueou o teletransporte.");
      }
      sessoes.delete(id);
      avisar(p, "Você chegou a " + destino.nome + ".", "§a");
    }, continua);
  } catch (erro) {
    if (continua()) cancelar(id, "O destino não pôde ser carregado com segurança.");
    console.warn("[Pergaminho] " + erro);
  } finally {
    if (reservouCarregamento) carregamentos--;
  }
}

system.runInterval(() => {
  const agora = system.currentTick;
  for (const [id, preparo] of sessoes) {
    const ticks = preparo.prazo - agora;
    try {
      const motivo = interrupcao(preparo, agora % 5 === 0 || ticks <= 0);
      if (motivo) cancelar(id, motivo);
      else if (!preparo.carregando && ticks <= 0) void concluir(preparo);
      else if (ticks > 0) {
        const restante = Math.ceil(ticks / 20);
        if (restante === preparo.restante) continue;
        preparo.restante = restante;
        preparo.p.onScreenDisplay.setActionBar(`§6Teletransportando para ${preparo.destino.nome}… §e${restante}`);
      }
    } catch (erro) {
      cancelar(id, "O destino deixou de estar disponível.");
      console.warn("[Pergaminho] " + erro);
    }
  }
}, 1);

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
  if (damage > 0) {
    cancelar(hurtEntity.id, "Você recebeu dano.");
    const atacante = damageSource?.damagingEntity;
    if (atacante && atacante.id !== hurtEntity.id) cancelar(atacante.id, "Você entrou em combate.");
  }
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => cancelar(playerId));
world.afterEvents.entityDie.subscribe(({ deadEntity }) => cancelar(deadEntity.id, "Seu personagem morreu."));
world.afterEvents.playerSpawn.subscribe(({ player }) => cancelar(player.id, "O personagem reapareceu."));
world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
  const preparo = sessoes.get(player.id);
  if (preparo && player.dimension.id !== preparo.destino.dim) cancelar(player.id, "Você mudou de dimensão.");
});
