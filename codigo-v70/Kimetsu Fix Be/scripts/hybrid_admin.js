import { system, world } from "@minecraft/server";
import { ESPECIAIS } from "./hybrid_config.js";
import { administrarPoder } from "./hybrid_abilities.js";
import { configurarLocal } from "./hybrid_locations.js";
import { certificarHistorico, progressoDominio } from "./hybrid_mastery.js";
import { candidatoRecuperacaoV72, ehStaff, getTrueRace, getTrueRank, recuperarHibridoV72 } from "./hybrid_system.js";
import { hibridosRegistrados, idExistente, personagem, proprietarios } from "./hybrid_records.js";

function jogadorOnline(chave) {
  if (!chave) return undefined;
  const lista = world.getPlayers();
  return lista.find((q) => q.name === chave) ?? lista.find((q) => idExistente(q) === chave);
}

function diagnostico(p) {
  const d = progressoDominio(p);
  const registro = personagem(p);
  const linhas = d.lista.filter((r) => r.liberadas || r.aprendidas)
    .map((r) => `${r.obj} · liberadas ${r.liberadas}/${r.formas.length} · comprovadas ${r.aprendidas}/${r.formas.length}${r.elegivel ? "" : " · inelegível"}`);
  const titulo = `${p.name} · ${idExistente(p) ?? "sem ID"} · raça ${getTrueRace(p)} · patente ${getTrueRank(p).nome}`;
  const dominio = d.invalido ? "Histórico incompatível." : d.resp ? "Original disponível · " + d.resp.obj
    : d.completas.length > 1 ? "Há mais de um domínio completo. Confira a original." : "Sem domínio completo registrado.";
  const reparo = candidatoRecuperacaoV72(p, registro) ? "Ficha de transformação v72 disponível para revisão." : "";
  return [titulo, dominio, reparo, ...linhas].filter(Boolean).join("\n");
}

function executar(p, mensagem) {
  const partes = Array.from(mensagem.matchAll(/"([^"]+)"|([^\s"]+)/g), (m) => m[1] ?? m[2]);
  const [acao, alvo, id, ...resto] = partes;
  if (acao === "diagnostico" || acao === "recuperar") {
    const pAlvo = jogadorOnline(alvo);
    if (!pAlvo) return "Informe o nome exato ou o ID de um jogador online.";
    if (acao === "diagnostico") return diagnostico(pAlvo);
    const resultado = recuperarHibridoV72(p, pAlvo, id, resto.join(" "));
    return resultado.ok ? "Linhagem Híbrida recuperada para " + pAlvo.name + "." : resultado.motivo;
  }
  if (acao === "certificar") {
    const aluno = jogadorOnline(alvo);
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
  return "Comandos da Staff — diagnostico, recuperar, certificar, hibridos, habilidades, atribuir, desativar, reativar, castelo, portal e bloqueio.";
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
