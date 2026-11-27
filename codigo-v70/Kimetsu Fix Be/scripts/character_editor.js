import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CAMPOS, CATEGORIAS, VISUAL_PADRAO, opcaoDe } from "./character_config.js";
import { atualizarCamera } from "./character_camera.js";
import {
  definirVisual, edicaoInicialDisponivel, encerrarEdicao, indisponivel, iniciarEdicao, lerCatalogo,
  opcaoPermitida, salvarEdicao, sessaoAtual, sessaoSegura, usarRetrato,
} from "./character_system.js";

const ICONE = "textures/ui/customizacao/";
const MARCA = "kny_edit|";
const espera = (ticks) => new Promise((ok) => system.runTimeout(ok, ticks));
const MODELO_DA_COR = {
  corCabelo: "cabelo", mecha: "cabelo", olhoE: "olhos", olhoD: "olhos",
};

async function mostrar(form, sessao) {
  sessao.formAberto = true;
  try { return await form.show(sessao.p); }
  finally { sessao.formAberto = false; }
}

function ajustarCamera(sessao, ajuste) {
  if (sessao.temCamera && !atualizarCamera(sessao, ajuste)) sessao.p.sendMessage("§eSem espaço para esse enquadramento.");
}

function descricao(sessao) {
  const grupo = CATEGORIAS.find((c) => c.id === sessao.categoria);
  const vista = sessao.camera.modo === "rosto" ? "Rosto" : "Corpo inteiro";
  return `§6§l${grupo.nome}§r\n§fEscolha única\n§7${sessao.temCamera ? vista : "Prévia no painel"}`;
}

function disponiveis(sessao, campo, catalogo) {
  return CAMPOS[campo].opcoes.filter((opcao) =>
    opcaoPermitida(campo, opcao, sessao.registro, sessao.raca, "base", catalogo)
  );
}

function editarCampo(sessao, campo, delta) {
  const catalogo = lerCatalogo();
  const opcoes = disponiveis(sessao, campo, catalogo);
  const visual = sessao.visual;
  const atual = opcoes.findIndex((item) => item.id === visual[campo]);
  const proxima = opcoes[(atual + delta + opcoes.length) % opcoes.length];
  if (!proxima) return;
  const alteracoes = { [campo]: proxima.id };
  const modelo = MODELO_DA_COR[campo];
  if (modelo && visual[modelo] === VISUAL_PADRAO[modelo]) {
    const primeiro = disponiveis(sessao, modelo, catalogo).find((opcao) => opcao.codigo > 0);
    if (primeiro) alteracoes[modelo] = primeiro.id;
  }
  definirVisual(sessao, alteracoes);
}

function painel(sessao) {
  const p = sessao.p;
  const estilizado = sessao.tela === "editor";
  const titulo = "APARÊNCIA DO PERSONAGEM";
  const marca = sessao.temCamera ? MARCA : MARCA + "R";
  const f = new ActionFormData().title(estilizado ? marca + "§6§l" + titulo : "§6" + titulo)
    .body(estilizado ? " " : descricao(sessao));
  const acoes = [];
  const add = (prefixo, texto, acao, icone) => {
    if (!estilizado && !acao) return;
    const label = (estilizado ? prefixo + ":" : "") + texto;
    if (icone) f.button(label, icone);
    else f.button(label);
    acoes.push(acao);
  };
  const visual = sessao.visual;
  const categoria = CATEGORIAS.find((c) => c.id === sessao.categoria);
  const catalogo = lerCatalogo();
  for (const c of CATEGORIAS) {
    const selecionada = c.id === categoria.id;
    add(selecionada ? "S" : "C", (selecionada ? "§6" : "§f") + c.nome, () => {
      sessao.categoria = c.id;
      sessao.campo = c.campos[0];
      ajustarCamera(sessao, { modo: c.vista, zoom: 0 });
    }, ICONE + c.icone);
  }

  add("T", descricao(sessao));
  for (const campo of categoria.campos) {
    const { nome } = CAMPOS[campo];
    const atual = opcaoDe(campo, visual[campo]);
    add("O", `${campo === sessao.campo ? "§6" : "§f"}${nome}\n§7${atual.nome}`, () => {
      sessao.campo = campo;
    }, atual.hex ? ICONE + "cor_" + atual.hex.slice(1) : undefined);
  }
  const opcoes = disponiveis(sessao, sessao.campo, catalogo);
  const restritas = CAMPOS[sessao.campo].opcoes.length - opcoes.length;
  if (restritas) add("H", `§8${restritas} opção(ões) bloqueada(s)`);
  if (opcoes.length > 1) {
    add("P", "‹ Anterior", () => editarCampo(sessao, sessao.campo, -1));
    add("N", "Próximo ›", () => editarCampo(sessao, sessao.campo, 1));
  }

  if (sessao.temCamera) {
    add("K", "Girar ‹", () => ajustarCamera(sessao, { angulo: (sessao.camera.angulo + 330) % 360 }));
    add("K", "Girar ›", () => ajustarCamera(sessao, { angulo: (sessao.camera.angulo + 30) % 360 }));
    add("K", "Aproximar", () => ajustarCamera(sessao, { zoom: Math.max(-3, sessao.camera.zoom - 1) }));
    add("K", "Afastar", () => ajustarCamera(sessao, { zoom: Math.min(4, sessao.camera.zoom + 1) }));
    add("K", sessao.camera.modo === "corpo" ? "Ver rosto" : "Ver corpo", () => ajustarCamera(sessao, {
      modo: sessao.camera.modo === "corpo" ? "rosto" : "corpo", zoom: 0,
    }));
    add("K", "Restaurar", () => ajustarCamera(sessao, { modo: "corpo", angulo: sessao.anguloInicial, zoom: 0 }));
  }
  add("V", "§6§lCONFIRMAR", () => {
    if (!salvarEdicao(sessao)) p.sendMessage("§eConfira os cosméticos liberados antes de salvar.");
  });
  add("K", "Cancelar", () => encerrarEdicao(sessao, "§7Sua aparência anterior foi mantida."));
  return { f, acoes };
}

export async function abrirEditor(p) {
  let sessao;
  try {
    while (p.isValid && edicaoInicialDisponivel(p) && indisponivel(p)) await espera(20);
    if (!p.isValid || !edicaoInicialDisponivel(p)) return;
    sessao = iniciarEdicao(p);
    while (sessaoSegura(sessao)) {
      const { f, acoes } = painel(sessao);
      const resposta = await mostrar(f, sessao);
      if (resposta.cancelationReason === "UserBusy" && sessaoAtual(p) === sessao) {
        sessao.aguardandoTela = true;
        if (!sessaoSegura(sessao)) return;
        usarRetrato(sessao);
        await espera(20);
        if (!sessaoSegura(sessao)) return;
        sessao.camera.origem = { ...p.location };
        sessao.aguardandoTela = false;
        continue;
      }
      if (!sessaoSegura(sessao)) return;
      if (resposta.canceled) {
        if (resposta.cancelationReason === undefined && sessao.tela === "editor") {
          usarRetrato(sessao);
          sessao.tela = "simples";
          continue;
        }
        return;
      }
      const acao = acoes[resposta.selection];
      if (!acao) return;
      await acao();
    }
  } catch (e) {
    if (p.isValid) p.sendMessage("§e[Aparência] " + (e.message ?? e));
  } finally {
    if (sessao && sessaoAtual(p) === sessao) encerrarEdicao(sessao);
  }
}
