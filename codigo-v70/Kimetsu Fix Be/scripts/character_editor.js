import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CAMPOS, CATEGORIAS, VISUAL_PADRAO, opcaoDe } from "./character_config.js";
import { atualizarCamera } from "./character_camera.js";
import { protegerCriacao } from "./character_protection.js";
import { entrarEstudio, sairEstudio } from "./character_studio.js";
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
  return `§6§l${grupo.nome}§r\n§7${sessao.temCamera ? vista : "Prévia frontal"}`;
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

function camadasDoRetrato(visual) {
  const pele = opcaoDe("peleIntegral", visual.peleIntegral);
  if (!pele.codigo) return [];
  const camadas = [["PV", "pele/" + pele.id]];
  const olhos = opcaoDe("olhos", visual.olhos).codigo;
  if (olhos) {
    camadas.push(["PE", `olho/e_${olhos}_${visual.olhoE}`], ["PD", `olho/d_${olhos}_${visual.olhoD}`]);
  }
  const cabelo = opcaoDe("cabelo", visual.cabelo).codigo;
  if (cabelo) {
    camadas.push(["PC", `cabelo/${cabelo}_${visual.corCabelo}`]);
    if (visual.mecha !== "nenhum") camadas.push(["PM", `mecha/${cabelo}_${visual.mecha}`]);
  }
  return camadas;
}

function painel(sessao) {
  const p = sessao.p;
  const estilizado = sessao.tela === "editor";
  const titulo = "APARÊNCIA DO PERSONAGEM";
  const visual = sessao.visual;
  const marca = sessao.temCamera ? MARCA : MARCA + (opcaoDe("peleIntegral", visual.peleIntegral).codigo ? "R" : "RA");
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
    const ativo = campo === sessao.campo;
    add(ativo ? "A" : "O", `${ativo ? "§6" : "§f"}${nome}\n§7${atual.nome}`, () => {
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
  add("X", "Cancelar", () => encerrarEdicao(sessao, "§7Sua aparência anterior foi mantida."));
  if (estilizado && !sessao.temCamera) {
    for (const [prefixo, imagem] of camadasDoRetrato(visual)) {
      add(prefixo, "", undefined, ICONE + "previa/" + imagem);
    }
  }
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
      protegerCriacao(p);
      const resposta = await mostrar(f, sessao);
      if (resposta.cancelationReason === "UserBusy" && sessaoAtual(p) === sessao) {
        await espera(10);
        continue;
      }
      if (!sessaoSegura(sessao)) return;
      if (resposta.canceled) {
        if (resposta.cancelationReason === undefined && sessao.tela === "editor") {
          usarRetrato(sessao);
          sessao.tela = "simples";
          await espera(2);
          continue;
        }
        return;
      }
      const acao = acoes[resposta.selection];
      if (acao) await acao();
      if (sessaoAtual(p) === sessao) await espera(2);
    }
  } catch (e) {
    if (p.isValid) p.sendMessage("§e[Aparência] " + (e.message ?? e));
  } finally {
    if (sessao && sessaoAtual(p) === sessao) encerrarEdicao(sessao);
  }
}

export async function apresentarEditor(p) {
  let estilizada = true;
  while (p.isValid && edicaoInicialDisponivel(p)) {
    const form = new ActionFormData()
      .title(estilizada ? "kny_criar|§6KIMETSU LEGACY" : "§6KIMETSU LEGACY")
      .button("Crie seu personagem");
    const resposta = await form.show(p);
    if (resposta.cancelationReason === "UserBusy") {
      await espera(20);
      continue;
    }
    if (estilizada && resposta.canceled && resposta.cancelationReason === undefined) {
      estilizada = false;
      continue;
    }
    if (!resposta.canceled && resposta.selection === 0) {
      while (p.isValid && edicaoInicialDisponivel(p) && indisponivel(p)) await espera(20);
      if (!p.isValid || !edicaoInicialDisponivel(p)) return;
      try {
        const entrou = await entrarEstudio(p, () => edicaoInicialDisponivel(p) && !indisponivel(p));
        if (entrou) {
          await espera(3);
          await abrirEditor(p);
        } else if (p.isValid) p.sendMessage("§eO estúdio está indisponível. Use o Menu Kimetsu para tentar novamente.");
      } catch (e) {
        console.warn("[Estúdio] Entrada: " + e);
        if (p.isValid) p.sendMessage("§eO estúdio está indisponível. Use o Menu Kimetsu para tentar novamente.");
      } finally {
        await sairEstudio(p);
      }
    }
    return;
  }
}
