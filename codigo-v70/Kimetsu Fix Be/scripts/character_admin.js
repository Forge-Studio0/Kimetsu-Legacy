import { system, world } from "@minecraft/server";
import { CAMPOS, VISUAL_PADRAO } from "./character_config.js";
import {
  CHAVE_CATALOGO, CHAVE_VISUAL, atualizarPersonagem, encerrarEdicao, lerAparencia, lerCatalogo, sessaoAtual,
} from "./character_system.js";
import { gravarJson } from "./hybrid_records.js";
import { ehStaff } from "./hybrid_system.js";

const autorizaveis = new Set(Object.values(CAMPOS).flatMap(({ opcoes }) => opcoes.filter((o) => o.concessao).map((o) => o.id)));
const bloqueaveis = new Set(Object.entries(CAMPOS).flatMap(([campo, { opcoes }]) =>
  opcoes.filter((o) => o.id !== VISUAL_PADRAO[campo]).map((o) => o.id)));

function executar(mensagem) {
  const partes = Array.from(mensagem.matchAll(/"([^"]+)"|([^\s"]+)/g), (m) => m[1] ?? m[2]);
  const [acao, alvo, opcao] = partes;
  if (acao === "fechar" || acao === "consultar" || acao === "resetar" ||
      acao === "autorizar_nome" || acao === "conceder" || acao === "revogar") {
    const p = world.getPlayers().find((j) => j.name === alvo);
    if (!p) return "Informe o nome de um jogador online.";
    const sessao = sessaoAtual(p);
    if (acao === "fechar") {
      if (sessao) encerrarEdicao(sessao, "§eEdição encerrada pela Staff.");
      return sessao ? "Sessão encerrada." : "O jogador está fora do editor.";
    }
    const d = lerAparencia(p);
    if (acao === "consultar") return d ? JSON.stringify(d) : "Ficha de aparência incompatível.";
    if (acao === "resetar") {
      gravarJson(p, CHAVE_VISUAL, { ...(d ?? { v: 1, autorizarNome: false, concessoes: [] }), perfis: {}, nome: "", sobrenome: "" });
    } else {
      if (!d) return "Ficha incompatível. Revise antes de escrever.";
      if (acao === "autorizar_nome") {
        if (!["sim", "nao"].includes(opcao)) return "Use sim ou nao.";
        d.autorizarNome = opcao === "sim";
      } else {
        if (!autorizaveis.has(opcao)) return "Cosmético de concessão desconhecido.";
        const ids = new Set(d.concessoes);
        if (acao === "conceder") ids.add(opcao);
        else ids.delete(opcao);
        d.concessoes = [...ids];
      }
      gravarJson(p, CHAVE_VISUAL, d);
    }
    atualizarPersonagem(p, true);
    return "Ficha atualizada para " + p.name + ".";
  }
  if (acao === "desativar" || acao === "ativar") {
    if (!bloqueaveis.has(alvo)) return "Informe um identificador de cosmético.";
    const d = lerCatalogo();
    const ids = new Set(d.bloqueados);
    if (acao === "desativar") ids.add(alvo);
    else ids.delete(alvo);
    gravarJson(world, CHAVE_CATALOGO, { ...d, bloqueados: [...ids] });
    for (const p of world.getPlayers()) atualizarPersonagem(p, true);
    return "Catálogo atualizado para " + alvo + ".";
  }
  return "Use consultar, resetar, fechar, autorizar_nome, conceder, revogar, desativar ou ativar.";
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity, message }) => {
  if (id !== "kny:aparencia" || !ehStaff(sourceEntity)) return;
  try { sourceEntity.sendMessage("§6[Staff Aparência] §f" + executar(message)); }
  catch (e) {
    console.warn("[Aparência] Staff: " + e);
    if (sourceEntity.isValid) sourceEntity.sendMessage("§cNão foi possível aplicar a operação.");
  }
});
