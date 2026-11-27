import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { CAMPOS, CATEGORIAS, CONJUNTOS, PERFIS, VISUAL_PADRAO, opcaoDe } from "./character_config.js";
import { atualizarCamera } from "./character_camera.js";
import {
  definirVisual, encerrarEdicao, iniciarEdicao, lerAparencia, lerCatalogo, opcaoPermitida, permiteTracos,
  perfisDisponiveis, rascunho, salvarEdicao, sessaoAtual, sessaoSegura, trocarPerfil, validarNome,
} from "./character_system.js";

export const ICONE_EDITOR = "textures/ui/customizacao/pele";
const ICONE = "textures/ui/customizacao/";
const MARCA = "kny_edit|";
const espera = (ticks) => new Promise((ok) => system.runTimeout(ok, ticks));
const MODELO_DA_COR = {
  corCabelo: "cabelo", mecha: "cabelo", olhoE: "olhos", olhoD: "olhos", corRoupa: "roupa",
};

async function mostrar(form, sessao) {
  for (let i = 0; i < 8 && sessaoSegura(sessao); i++) {
    sessao.formAberto = true;
    try {
      const resposta = await form.show(sessao.p);
      if (resposta.cancelationReason !== "UserBusy") return resposta;
    } finally { sessao.formAberto = false; }
    await espera(5);
  }
  return { canceled: true, cancelationReason: "UserBusy" };
}

function ajustarCamera(sessao, ajuste) {
  if (!atualizarCamera(sessao, ajuste)) sessao.p.sendMessage("§eSem espaço para esse enquadramento.");
}

function descricao(sessao) {
  const grupo = CATEGORIAS.find((c) => c.id === sessao.categoria);
  const vista = sessao.camera.modo === "rosto" ? "Rosto" : "Corpo inteiro";
  return `§6§l${grupo.nome}§r\n§f${PERFIS[sessao.perfil]}\n§7${vista}`;
}

function editarCampo(sessao, campo, delta) {
  const catalogo = lerCatalogo();
  const opcoes = CAMPOS[campo].opcoes.filter((opcao) =>
    opcaoPermitida(campo, opcao, sessao.registro, sessao.raca, sessao.perfil, catalogo)
  );
  const visual = rascunho(sessao);
  const atual = opcoes.findIndex((item) => item.id === visual[campo]);
  const proxima = opcoes[(atual + delta + opcoes.length) % opcoes.length];
  if (!proxima) return;
  const alteracoes = { [campo]: proxima.id };
  const modelo = MODELO_DA_COR[campo];
  if (modelo && visual[modelo] === VISUAL_PADRAO[modelo]) {
    const primeiro = CAMPOS[modelo].opcoes.find((opcao) => opcao.codigo > 0 &&
      opcaoPermitida(modelo, opcao, sessao.registro, sessao.raca, sessao.perfil, catalogo)
    );
    if (primeiro) alteracoes[modelo] = primeiro.id;
  }
  definirVisual(sessao, alteracoes);
}

async function nomeDoPersonagem(sessao) {
  if (!lerAparencia(sessao.p)?.autorizarNome) return;
  const f = new ModalFormData().title("Nome do personagem")
    .textField("Nome", "Até 24 caracteres", { defaultValue: sessao.nome })
    .textField("Sobrenome", "Opcional", { defaultValue: sessao.sobrenome })
    .submitButton("Aplicar ao rascunho");
  const r = await mostrar(f, sessao);
  if (r.canceled || !sessaoSegura(sessao)) return encerrarEdicao(sessao);
  const nome = validarNome(r.formValues[0]);
  const sobrenome = validarNome(r.formValues[1]);
  if (nome === undefined || sobrenome === undefined) {
    sessao.p.sendMessage("§eUse letras, espaços, apóstrofos ou hífens para o nome.");
    return;
  }
  sessao.nome = nome;
  sessao.sobrenome = sobrenome;
  sessao.editouNome = true;
}

function painel(sessao) {
  const p = sessao.p;
  const estilizado = sessao.tela === "editor";
  const f = new ActionFormData().title(estilizado ? MARCA + "§6§lOFICINA DE PERSONAGEM" : "§6OFICINA DE PERSONAGEM")
    .body(estilizado ? " " : descricao(sessao));
  const acoes = [];
  const add = (prefixo, texto, acao, icone) => {
    if (!estilizado && !acao) return;
    const label = (estilizado ? prefixo + ":" : "") + texto;
    if (icone) f.button(label, icone);
    else f.button(label);
    acoes.push(acao);
  };
  const campoAtivo = CAMPOS[sessao.campo];
  const visual = rascunho(sessao);
  const categoria = CATEGORIAS.find((c) => c.id === sessao.categoria);
  const temTracos = permiteTracos(sessao.raca, sessao.perfil);
  const bloqueados = lerCatalogo();
  for (const c of CATEGORIAS) {
    if (c.id === "identidades" && sessao.raca !== "hibrido") continue;
    if (c.id === "demonio" && !temTracos) continue;
    const selecionada = c.id === categoria.id;
    add(selecionada ? "S" : "C", (selecionada ? "§6" : "§f") + c.nome, () => {
      sessao.categoria = c.id;
      sessao.campo = c.campos?.[0];
      ajustarCamera(sessao, { modo: c.rosto ? "rosto" : "corpo", zoom: 0 });
    }, ICONE + c.icone);
  }

  add("T", descricao(sessao));
  if (categoria.campos) {
    for (const campo of categoria.campos) {
      const { nome } = CAMPOS[campo];
      const atual = opcaoDe(campo, visual[campo]);
      add("O", `${campo === sessao.campo ? "§6" : "§f"}${nome}\n§7${atual.nome}`, () => {
        sessao.campo = campo;
      }, atual.hex ? ICONE + "cor_" + atual.hex.slice(1) : undefined);
    }
    const disponiveis = campoAtivo.opcoes.filter((o) => opcaoPermitida(sessao.campo, o, sessao.registro, sessao.raca, sessao.perfil, bloqueados));
    const restritas = campoAtivo.opcoes.length - disponiveis.length;
    if (restritas) add("H", `§8${restritas} opção(ões) bloqueada(s)`);
    if (disponiveis.length > 1) {
      add("P", "‹ Anterior", () => editarCampo(sessao, sessao.campo, -1));
      add("N", "Próximo ›", () => editarCampo(sessao, sessao.campo, 1));
    }
  } else if (categoria.id === "info") {
    const nome = [sessao.nome, sessao.sobrenome].filter(Boolean).join(" ");
    add("H", nome || "§7Ficha de apresentação");
    if (sessao.registro.autorizarNome) add("O", "Editar nome de RP", () => nomeDoPersonagem(sessao));
    else add("O", "§8Nome de RP bloqueado", () => p.sendMessage("§eA Staff autoriza a edição do nome de RP."));
  } else if (categoria.id === "identidades") {
    for (const perfil of perfisDisponiveis(sessao.raca)) {
      add("O", `${perfil === sessao.perfil ? "§6" : "§f"}${PERFIS[perfil]}`, () => trocarPerfil(sessao, perfil));
    }
    add("H", "§7Perfil do rascunho");
  } else if (categoria.id === "conjuntos") {
    const opcoes = CONJUNTOS.filter((c) => !c.oni || temTracos);
    sessao.conjunto = (sessao.conjunto ?? 0) % opcoes.length;
    const atual = opcoes[sessao.conjunto];
    add("O", "Experimentar " + atual.nome, () => {
      if (!definirVisual(sessao, { ...VISUAL_PADRAO, ...atual.visual })) p.sendMessage("§eEste conjunto contém uma opção bloqueada.");
    });
    add("O", "Aparência padrão", () => definirVisual(sessao, VISUAL_PADRAO));
    add("P", "‹ Anterior", () => { sessao.conjunto = (sessao.conjunto + opcoes.length - 1) % opcoes.length; });
    add("N", "Próximo ›", () => { sessao.conjunto = (sessao.conjunto + 1) % opcoes.length; });
  }

  add("K", "Girar ‹", () => ajustarCamera(sessao, { angulo: (sessao.camera.angulo + 330) % 360 }));
  add("K", "Girar ›", () => ajustarCamera(sessao, { angulo: (sessao.camera.angulo + 30) % 360 }));
  add("K", "Aproximar", () => ajustarCamera(sessao, { zoom: Math.max(-3, sessao.camera.zoom - 1) }));
  add("K", "Afastar", () => ajustarCamera(sessao, { zoom: Math.min(4, sessao.camera.zoom + 1) }));
  add("K", sessao.camera.modo === "corpo" ? "Rosto" : "Corpo", () => ajustarCamera(sessao, {
    modo: sessao.camera.modo === "corpo" ? "rosto" : "corpo", zoom: 0,
  }));
  add("K", "Restaurar", () => ajustarCamera(sessao, { modo: "corpo", angulo: 0, zoom: 0 }));
  add("V", "§6§lSALVAR", () => {
    if (!salvarEdicao(sessao)) p.sendMessage("§eConfira os cosméticos liberados antes de salvar.");
  });
  add("K", "Cancelar", () => encerrarEdicao(sessao, "§7Alterações descartadas."));
  return { f, acoes };
}

export async function abrirEditor(p, modoSimples = false) {
  let sessao;
  try {
    sessao = iniciarEdicao(p);
    if (modoSimples) sessao.tela = "simples";
    while (sessaoSegura(sessao)) {
      const { f, acoes } = painel(sessao);
      const resposta = await mostrar(f, sessao);
      if (!sessaoSegura(sessao)) return;
      if (resposta.canceled) {
        if (resposta.cancelationReason === undefined && sessao.tela === "editor") {
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
