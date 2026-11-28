import { world } from "@minecraft/server";
import { ehStaff } from "./hybrid_system.js";
import { linha, quadro } from "./missoes_interface.js";
import { consultarTalismas, EFEITOS_TALISMA, emitirTalisma, LIMITE_TALISMAS, removerTalismas } from "./talisma_eternidade.js";

export function abrirPainelTalisma(p, mostrar, voltar) {
  return escolherBeneficiario({ p, mostrar, voltar });
}

function escolherBeneficiario(ctx) {
  if (!ehStaff(ctx.p)) return;
  const jogadores = [...world.getPlayers()].sort((a, b) => a.name.localeCompare(b.name));
  return quadro(ctx, "TALISMÃS DA ETERNIDADE", "Selecione um beneficiário online", jogadores.map((alvo) =>
    linha(alvo.name, "", () => ficha(ctx, alvo))));
}

function ficha(ctx, alvo) {
  const registros = consultarTalismas(ctx.p, alvo);
  if (!registros) {
    if (ehStaff(ctx.p)) ctx.p.sendMessage("§e[Talismã] O beneficiário precisa estar online.");
    return escolherBeneficiario(ctx);
  }
  const itens = [
    linha("Emitir talismã", "", () => escolherEfeito(ctx, alvo)),
    ...registros.map((registro) => linha(registro.descricao, registro.ativo ? "Ativo" : "Aguardando uso",
      () => confirmarRemocao(ctx, alvo, registro))),
  ];
  if (registros.length) itens.push(linha("Remover todos", "", () => confirmarRemocao(ctx, alvo)));
  return quadro(ctx, "BENEFÍCIOS", `${alvo.name} · ${registros.length}/${LIMITE_TALISMAS} concessões`, itens, () => escolherBeneficiario(ctx));
}

function escolherEfeito(ctx, alvo) {
  if (!ehStaff(ctx.p) || !alvo.isValid) return escolherBeneficiario(ctx);
  const efeitos = Object.entries(EFEITOS_TALISMA).map(([efeito, { nome, max }]) =>
    linha(nome, max === 2 ? "Nível máximo II" : "Nível máximo I", () => escolherNivel(ctx, alvo, efeito)));
  return quadro(ctx, "EFEITO DO TALISMÃ", alvo.name, efeitos, () => ficha(ctx, alvo));
}

function escolherNivel(ctx, alvo, efeito) {
  if (!ehStaff(ctx.p) || !alvo.isValid) return escolherBeneficiario(ctx);
  const definicao = EFEITOS_TALISMA[efeito];
  const niveis = Array.from({ length: definicao.max }, (_, i) => linha(i ? "Nível II" : "Nível I", "",
    () => confirmarEmissao(ctx, alvo, efeito, i + 1)));
  return quadro(ctx, "NÍVEL DO EFEITO", definicao.nome, niveis, () => escolherEfeito(ctx, alvo));
}

function confirmarEmissao(ctx, alvo, efeito, nivel) {
  if (!ehStaff(ctx.p) || !alvo.isValid) return escolherBeneficiario(ctx);
  const descricao = EFEITOS_TALISMA[efeito].nome + (nivel === 2 ? " II" : " I");
  return quadro(ctx, "CONFIRMAR EMISSÃO", alvo.name + " · " + descricao, [linha("Entregar talismã", "", () => {
    const resultado = emitirTalisma(ctx.p, alvo, efeito, nivel);
    if (ctx.p.isValid) ctx.p.sendMessage(resultado.ok ? "§a[Talismã] " + descricao + " entregue a " + alvo.name + "."
      : "§e[Talismã] " + resultado.motivo);
    if (resultado.ok && alvo.isValid && alvo.id !== ctx.p.id) {
      alvo.sendMessage("§a[Talismã] Você recebeu " + descricao + ". Empunhe e use o item para ativar.");
    }
    return ficha(ctx, alvo);
  })], () => escolherNivel(ctx, alvo, efeito));
}

function confirmarRemocao(ctx, alvo, registro) {
  if (!ehStaff(ctx.p) || !alvo.isValid) return escolherBeneficiario(ctx);
  return quadro(ctx, "CONFIRMAR REMOÇÃO", alvo.name + " · " + (registro?.descricao ?? "Todos os talismãs"), [
    linha("Revogar concessão", "Efeitos já aplicados expiram em até 12 s de jogo", () => {
      const resultado = removerTalismas(ctx.p, alvo, registro);
      if (ctx.p.isValid) ctx.p.sendMessage(resultado.ok ? "§a[Talismã] Concessões revogadas: " + resultado.removidos + "."
        : "§e[Talismã] " + resultado.motivo);
      return ficha(ctx, alvo);
    }),
  ], () => ficha(ctx, alvo));
}
