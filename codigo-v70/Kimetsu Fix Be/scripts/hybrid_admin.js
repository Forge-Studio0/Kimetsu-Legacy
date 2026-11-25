import { system, world } from "@minecraft/server";
import { ESPECIAIS } from "./hybrid_config.js";
import { administrarPoder } from "./hybrid_abilities.js";
import { configurarLocal } from "./hybrid_locations.js";
import { certificarHistorico } from "./hybrid_mastery.js";
import { ehStaff } from "./hybrid_system.js";
import { hibridosRegistrados, personagem, proprietarios } from "./hybrid_records.js";

function executar(p, mensagem) {
  const partes = Array.from(mensagem.matchAll(/"([^"]+)"|([^\s"]+)/g), (m) => m[1] ?? m[2]);
  const [acao, alvo, id, ...resto] = partes;
  if (acao === "certificar") {
    const aluno = world.getPlayers().find((q) => q.name === alvo || personagem(q)?.id === alvo);
    return aluno && certificarHistorico(p, aluno, id, resto.join(" "))
      ? "Domínio humano certificado com registro de auditoria."
      : "Certificação recusada. Confira jogador online, formas desbloqueadas e evidência humana de pelo menos 12 caracteres.";
  }
  if (acao === "hibridos") {
    const page = Math.max(0, Math.trunc(Number(alvo) || 1) - 1);
    const hibridos = hibridosRegistrados();
    const linhas = hibridos.slice(page * 12, page * 12 + 12).map((h) => `${h.id} · ${h.nome} · ${h.resp}`);
    return linhas.length ? linhas.join("\n") : "Nenhum Híbrido nessa página.";
  }
  if (acao === "habilidades") {
    const dados = proprietarios();
    if (!dados) return "Registro de habilidades inválido.";
    return Object.entries(ESPECIAIS).map(([chave, poder]) => {
      const a = dados.atribuicoes[chave];
      return `${chave} · ${poder.nome} · ${a ? a.id + (a.ativo ? " ativa" : " desativada") : "livre"}`;
    }).join("\n");
  }
  if (["atribuir", "desativar", "reativar"].includes(acao)) return administrarPoder(p, acao, alvo, id);
  if (["castelo", "portal", "bloqueio"].includes(acao)) return configurarLocal(p, partes);
  return "Comandos da Staff — hibridos, habilidades, atribuir, desativar, reativar, certificar, castelo, portal e bloqueio.";
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity, message }) => {
  const p = sourceEntity;
  if (id !== "kny:h_staff" || !ehStaff(p)) return;
  try { p.sendMessage("§5[Staff Híbridos] §f" + executar(p, message)); }
  catch (e) {
    console.warn("[Híbridos] Administração: " + e);
    if (p.isValid) p.sendMessage("§cA operação não pôde ser concluída. Consulte o log do servidor.");
  }
});
