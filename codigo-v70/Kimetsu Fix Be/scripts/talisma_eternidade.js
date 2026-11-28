import { ItemStack, system, world } from "@minecraft/server";
import { ehStaff, estadoBloqueado } from "./hybrid_system.js";
import { idExistente, identificador } from "./hybrid_records.js";
import { aguardaResgate, resgateEmCurso } from "./revive.js";

export const ITEM_TALISMA = "kny:talisma_eternidade";
export const LIMITE_TALISMAS = 3;
export const EFEITOS_TALISMA = Object.freeze({
  night_vision: Object.freeze({ nome: "Visão noturna", max: 1, duracao: 240, renovar: 222 }),
  water_breathing: Object.freeze({ nome: "Respiração aquática", max: 1, duracao: 100, renovar: 22 }),
  haste: Object.freeze({ nome: "Pressa", max: 2, duracao: 100, renovar: 22 }),
  jump_boost: Object.freeze({ nome: "Super salto", max: 2, duracao: 100, renovar: 22 }),
});

// A autorização vive nesta execução. O ID de personagem já existe no addon.
const concessoes = new Map();
const usando = new Set();
const renascimentos = new Map();
const selo = "kny:emissao_talisma";
const execucao = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
let sequencia = 0;

const jogador = (p) => p?.isValid && p.typeId === "minecraft:player";
const inventario = (p) => p.getComponent("minecraft:inventory")?.container;
const negar = (motivo) => ({ ok: false, motivo });
const nome = (efeito, nivel) => EFEITOS_TALISMA[efeito].nome + (nivel === 2 ? " II" : " I");
const impedido = (p) => estadoBloqueado(p) || aguardaResgate(p.id) || resgateEmCurso(p) ||
  p.getProperty("kny:h_ocupado") || p.getProperty("kny:cc_edicao") ||
  (renascimentos.get(p.id) ?? 0) > system.currentTick;

export function emitirTalisma(staff, alvo, efeito, nivel) {
  if (!ehStaff(staff)) return negar("Somente a Staff pode emitir talismãs.");
  if (!jogador(alvo)) return negar("O beneficiário precisa estar online.");
  if (!Object.hasOwn(EFEITOS_TALISMA, efeito) || !Number.isInteger(nivel) || nivel < 1 || nivel > EFEITOS_TALISMA[efeito].max) {
    return negar("Efeito ou nível indisponível.");
  }
  const id = identificador(alvo);
  const lista = concessoes.get(id) ?? new Map();
  if (lista.has(efeito)) return negar("Este efeito já está ativo ou foi emitido para o beneficiário.");
  if (lista.size >= LIMITE_TALISMAS) return negar(`O beneficiário já tem ${LIMITE_TALISMAS} efeitos ativos ou emitidos.`);
  const bolsa = inventario(alvo);
  if (!bolsa) return negar("Inventário indisponível.");
  const codigo = execucao + "_" + ++sequencia;
  const item = new ItemStack(ITEM_TALISMA);
  item.setDynamicProperty(selo, codigo);
  item.setLore(["§6" + nome(efeito, nivel), "§7Beneficiário · " + alvo.name, "§8Emissão da sessão atual"]);
  if (bolsa.addItem(item)) return negar("O inventário do beneficiário está cheio.");
  lista.set(efeito, { codigo, efeito, nivel, ativo: false, ate: 0 });
  concessoes.set(id, lista);
  return { ok: true, descricao: nome(efeito, nivel) };
}

export function consultarTalismas(staff, alvo) {
  if (!ehStaff(staff) || !jogador(alvo)) return undefined;
  return [...(concessoes.get(idExistente(alvo))?.values() ?? [])].map(({ codigo, efeito, nivel, ativo }) => ({
    codigo, efeito, nivel, ativo, descricao: nome(efeito, nivel),
  }));
}

export function removerTalismas(staff, alvo, registro) {
  if (!ehStaff(staff)) return negar("Somente a Staff pode remover talismãs.");
  if (!jogador(alvo)) return negar("O beneficiário precisa estar online.");
  const id = idExistente(alvo);
  const lista = concessoes.get(id);
  if (!lista?.size) return negar("O beneficiário não tem talismãs registrados.");
  if (registro && lista.get(registro.efeito)?.codigo !== registro.codigo) return negar("A concessão mudou. Abra a lista novamente.");
  const removidos = registro ? Number(lista.delete(registro.efeito)) : lista.size;
  if (!registro || !lista.size) concessoes.delete(id);
  // O Bedrock não informa a origem de um efeito. Parar a renovação deixa
  // os efeitos expirarem sem apagar poções ou habilidades com o mesmo ID.
  return { ok: true, removidos };
}

function aplicar(p, concessao) {
  const { duracao } = EFEITOS_TALISMA[concessao.efeito];
  p.addEffect(concessao.efeito, duracao, { amplifier: concessao.nivel - 1, showParticles: false });
  concessao.ate = system.currentTick + duracao;
}

export function usarTalisma(p, item) {
  if (item?.typeId !== ITEM_TALISMA || !jogador(p)) return negar("Talismã indisponível.");
  if (usando.has(p.id)) return negar("Aguarde a utilização atual.");
  if (impedido(p)) return negar("O talismã está indisponível durante esta ação.");
  const chave = item.getDynamicProperty(selo);
  const lista = concessoes.get(idExistente(p));
  const concessao = chave && [...(lista?.values() ?? [])].find((c) => !c.ativo && c.codigo === chave);
  if (!concessao) return negar("Talismã inválido, já utilizado ou destinado a outro jogador.");
  if (!Object.hasOwn(EFEITOS_TALISMA, concessao.efeito) || !Number.isInteger(concessao.nivel) ||
      concessao.nivel < 1 || concessao.nivel > EFEITOS_TALISMA[concessao.efeito].max) {
    return negar("Efeito ou nível indisponível.");
  }
  if ([...lista.values()].filter((c) => c.ativo).length >= LIMITE_TALISMAS) return negar("O limite de efeitos simultâneos foi atingido.");
  if (p.getEffect(concessao.efeito)) return negar("Este efeito já está presente. Aguarde o efeito atual terminar.");
  const bolsa = inventario(p);
  const slot = p.selectedSlotIndex;
  const empunhado = bolsa?.getItem(slot);
  if (empunhado?.typeId !== ITEM_TALISMA || empunhado.amount !== 1 || empunhado.getDynamicProperty(selo) !== chave) {
    return negar("Empunhe o talismã autorizado para utilizá-lo.");
  }
  usando.add(p.id);
  try {
    bolsa.setItem(slot, undefined);
    try {
      aplicar(p, concessao);
    } catch (e) {
      bolsa.setItem(slot, empunhado);
      throw e;
    }
    concessao.ativo = true;
    return { ok: true, descricao: nome(concessao.efeito, concessao.nivel) };
  } finally {
    usando.delete(p.id);
  }
}

function renovarEfeito(p, concessao) {
  if (!concessao.ativo) return;
  const atual = p.getEffect(concessao.efeito);
  const restante = concessao.ate - system.currentTick;
  if (atual && (restante <= 0 || atual.amplifier !== concessao.nivel - 1 || Math.abs(restante - atual.duration) > 2)) {
    concessao.ate = 0;
    return;
  }
  if (!atual || atual.duration <= EFEITOS_TALISMA[concessao.efeito].renovar) aplicar(p, concessao);
}

function atualizarEfeitos(p) {
  const lista = concessoes.get(idExistente(p));
  if (!lista || impedido(p)) return;
  for (const concessao of lista.values()) renovarEfeito(p, concessao);
}

function protegerExecucao(acao) {
  try { acao(); }
  catch (e) { console.warn("[Talismã da Eternidade] " + e); }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  const aoUsar = ({ source, itemStack }) => {
    if (!jogador(source)) return;
    const item = itemStack ?? inventario(source)?.getItem(source.selectedSlotIndex);
    // Deixe o motor finalizar a interação com a mão antes de consumir o item.
    system.run(() => {
      if (!jogador(source)) return;
      try {
        const resultado = usarTalisma(source, item);
        source.sendMessage(resultado.ok ? "§a[Talismã] " + resultado.descricao + " concedido."
          : "§e[Talismã] " + resultado.motivo);
      } catch (e) {
        console.warn("[Talismã da Eternidade] " + e);
        if (source.isValid) source.sendMessage("§c[Talismã] Não foi possível usar o item.");
      }
    });
  };
  itemComponentRegistry.registerCustomComponent("kny:usar_talisma_eternidade", { onUse: aoUsar, onUseOn: aoUsar });
});

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity.typeId === "minecraft:player" && concessoes.size) renascimentos.set(deadEntity.id, Infinity);
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => renascimentos.delete(playerId));

world.afterEvents.playerSpawn.subscribe(({ player }) => {
  const id = player.id;
  if (!renascimentos.has(id) && !concessoes.has(idExistente(player))) return;
  // O Reviver pode colocar o personagem no estado Caído alguns ticks depois.
  const depois = system.currentTick + 8;
  renascimentos.set(id, depois);
  system.runTimeout(() => {
    if (renascimentos.get(id) !== depois) return;
    renascimentos.delete(id);
    if (player.isValid) protegerExecucao(() => atualizarEfeitos(player));
  }, 8);
});

system.runInterval(() => {
  if (!concessoes.size) return;
  for (const p of world.getPlayers()) protegerExecucao(() => atualizarEfeitos(p));
}, 20);
