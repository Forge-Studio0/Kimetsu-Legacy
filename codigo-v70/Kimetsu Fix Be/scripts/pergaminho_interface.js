import { system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { mostrar } from "./menu.js";
import { linha, quadro } from "./missoes_interface.js";
import {
  MAX_DESTINOS, excluirDestino, impedimentoPergaminho, iniciarTeleportePessoal, listarDestinos,
  renomearDestino, salvarDestinoAtual,
} from "./pergaminho_teleporte.js";

const MENUS = new Map();
const TITULO = "PERGAMINHO DE TELETRANSPORTE";
const DIMENSOES = {
  "minecraft:overworld": "Mundo normal",
  "minecraft:nether": "Nether",
  "minecraft:the_end": "End",
};
const quantia = (lista) => `Destinos: ${lista.length}/${MAX_DESTINOS}`;
const informar = (p, texto, cor = "§e") => {
  if (p.isValid) p.sendMessage("§6[Pergaminho] " + cor + texto);
};

function permitido(p) {
  if (!p.isValid) return false;
  const erro = impedimentoPergaminho(p);
  if (erro) informar(p, erro);
  return !erro;
}

function listaValida(p) {
  const lista = listarDestinos(p);
  if (!lista) informar(p, "O registro de destinos está inválido. Consulte a Staff.");
  return lista;
}

function dados(d) {
  const { x, y, z } = d.pos;
  return `${DIMENSOES[d.dim] ?? d.dim} · ${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)}`;
}

function inicio(ctx) {
  const lista = listaValida(ctx.p);
  if (!lista) return;
  return quadro(ctx, TITULO, quantia(lista), [
    linha("Meus destinos", undefined, () => destinos(ctx, false)),
    linha("Salvar localização atual", undefined, () => pedirNome(ctx)),
    linha("Gerenciar localizações", undefined, () => destinos(ctx, true)),
    linha("Informações", undefined, () => informacoes(ctx)),
    linha("Fechar", undefined, () => {}),
  ], null);
}

function destinos(ctx, gerenciar) {
  const lista = listaValida(ctx.p);
  if (!lista) return;
  const titulo = gerenciar ? "GERENCIAR LOCALIZAÇÕES" : "MEUS DESTINOS";
  const itens = lista.map((d) => linha(d.nome, dados(d), () => gerenciar ? editar(ctx, d.id) : viajar(ctx, d.id)));
  if (!itens.length) itens.push(linha("Você ainda não tem destinos", "Use Salvar localização atual"));
  return quadro(ctx, titulo, quantia(lista), itens, () => inicio(ctx));
}

function viajar(ctx, id) {
  const erro = iniciarTeleportePessoal(ctx.p, id);
  if (erro) {
    informar(ctx.p, erro);
    return destinos(ctx, false);
  }
}

function editar(ctx, id) {
  const lista = listaValida(ctx.p);
  if (!lista) return;
  const d = lista.find((destino) => destino.id === id);
  if (!d) return destinos(ctx, true);
  return quadro(ctx, "LOCALIZAÇÃO", d.nome + " · " + dados(d), [
    linha("Viajar", "Iniciar preparação de cinco segundos", () => viajar(ctx, id)),
    linha("Renomear", undefined, () => pedirNome(ctx, d)),
    linha("Excluir", undefined, () => confirmarExclusao(ctx, d)),
  ], () => destinos(ctx, true));
}

function confirmarExclusao(ctx, d) {
  return quadro(ctx, "EXCLUIR LOCALIZAÇÃO", d.nome, [
    linha("Confirmar exclusão", undefined, () => {
      const erro = excluirDestino(ctx.p, d.id);
      informar(ctx.p, erro ?? "Localização excluída.", erro ? "§e" : "§a");
      return destinos(ctx, true);
    }),
    linha("Cancelar", undefined, () => editar(ctx, d.id)),
  ], () => editar(ctx, d.id));
}

async function pedirNome(ctx, d) {
  const form = new ModalFormData().title(d ? "Renomear localização" : "Salvar localização atual")
    .textField("Nome da localização", "Minha residência", { defaultValue: d?.nome ?? "" })
    .submitButton(d ? "Renomear" : "Salvar");
  const r = await ctx.mostrar(form, ctx.p);
  if (r.canceled) return;
  const nome = r.formValues?.[0];
  const erro = d ? renomearDestino(ctx.p, d.id, nome) : salvarDestinoAtual(ctx.p, nome);
  informar(ctx.p, erro ?? (d ? "Nome atualizado." : "Localização atual salva."), erro ? "§e" : "§a");
  return d ? editar(ctx, d.id) : inicio(ctx);
}

function informacoes(ctx) {
  return quadro(ctx, "INFORMAÇÕES", "Destinos pessoais · item reutilizável", [
    linha("Salve uma posição segura", "O pergaminho registra blocos e dimensão da sua posição atual"),
    linha("Viaje na mesma dimensão", "Regiões protegidas e combate bloqueiam o uso"),
    linha("Fique no mesmo lugar", "A preparação leva cinco segundos e o dano cancela"),
  ], () => inicio(ctx));
}

function abrir(p) {
  if (p?.typeId !== "minecraft:player" || !p.isValid || MENUS.has(p.id)) return;
  const token = {};
  MENUS.set(p.id, token);
  const ativo = () => MENUS.get(p.id) === token;
  system.run(async () => {
    try {
      if (!ativo() || !permitido(p)) return;
      await inicio({
        p,
        async mostrar(form) {
          if (!ativo() || !permitido(p)) return { canceled: true, cancelationReason: "UserClosed" };
          const r = await mostrar(form, p);
          if (!r.canceled && (!ativo() || !permitido(p))) return { canceled: true, cancelationReason: "UserClosed" };
          return r;
        },
      });
    } catch (erro) {
      informar(p, "Não foi possível abrir o pergaminho.");
      console.warn("[Pergaminho] " + (erro.stack ?? erro));
    } finally {
      if (ativo()) MENUS.delete(p.id);
    }
  });
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  const usar = ({ source }) => abrir(source);
  itemComponentRegistry.registerCustomComponent("kny:abrir_pergaminho", { onUse: usar, onUseOn: usar });
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => MENUS.delete(playerId));
world.afterEvents.playerDimensionChange.subscribe(({ player }) => MENUS.delete(player.id));
world.afterEvents.entityDie.subscribe(({ deadEntity }) => MENUS.delete(deadEntity.id));
