import { system, world } from "@minecraft/server";
import * as UI from "@minecraft/server-ui";
import { CAMPOS, CAMPOS_INICIAIS, PROP_APARENCIA, PROP_RASCUNHO, VISUAL_PADRAO, codificarVisual, opcaoDe } from "./character_config.js";
import { buscarCameraInicial, cameraInicial } from "./character_camera.js";
import { emCombate, estadoBloqueado, getTrueRace, racaHibrida } from "./hybrid_system.js";
import { lerJson, gravarJson, personagem } from "./hybrid_records.js";
import { viagemEmCurso } from "./hybrid_locations.js";
import { resgateEmCurso } from "./revive.js";

export const CHAVE_VISUAL = "kny:aparencia";
export const CHAVE_CATALOGO = "kny:aparencia_catalogo";
export const CHAVE_ENTRADA = "kny:aparencia_primeiro_login";
const CHAVE_CAMERA = "kny:aparencia_camera";
const TAG_NOVO = "kny_aparencia_novo";
const MARCA_ENTRADA = "v78";
const PERFIS_H = ["cacador", "oni", "revelado"];
const sessoes = new Map();
const entradas = new Set();
const jogadorValido = (p) => p?.isValid && p.typeId === "minecraft:player";
const objeto = (d) => !!d && typeof d === "object" && !Array.isArray(d);
const racaEditavel = (raca) => raca === "humano" || raca === "cacador";

export function lerAparencia(p) {
  const d = lerJson(p, CHAVE_VISUAL);
  if (d === undefined) return { v: 1, perfis: {}, nome: "", sobrenome: "", autorizarNome: false, concessoes: [] };
  return objeto(d?.perfis) && Array.isArray(d.concessoes) ? d : null;
}

export function lerCatalogo() {
  const dado = lerJson(world, CHAVE_CATALOGO);
  return Array.isArray(dado?.bloqueados) ? dado : { v: 1, bloqueados: [] };
}

const perfisDisponiveis = (raca) => raca === "hibrido" ? PERFIS_H : raca === "oni" ? ["oni"] : ["base"];
export function perfilAtivo(p, raca = getTrueRace(p)) {
  return raca === "hibrido" ? racaHibrida(p).publico : perfisDisponiveis(raca)[0];
}

const permiteTracos = (raca, perfil) => (raca === "oni" && perfil === "oni") ||
  (raca === "hibrido" && (perfil === "oni" || perfil === "revelado"));

export function opcaoPermitida(campo, opcao, registro, raca, perfil, catalogo) {
  if (!opcao || !perfisDisponiveis(raca).includes(perfil)) return false;
  if (opcao.id === VISUAL_PADRAO[campo]) return true;
  if (campo === "demonio" && !permiteTracos(raca, perfil)) return false;
  return !catalogo.bloqueados.includes(opcao.id) && (!opcao.concessao || registro.concessoes.includes(opcao.id));
}

export function limparVisual(visual, registro, raca, perfil, catalogo = lerCatalogo()) {
  const resultado = { ...VISUAL_PADRAO };
  for (const campo of Object.keys(CAMPOS)) {
    const opcao = opcaoDe(campo, visual?.[campo]);
    if (opcaoPermitida(campo, opcao, registro, raca, perfil, catalogo)) resultado[campo] = opcao.id;
  }
  if (["chifres", "chifre_lateral"].includes(resultado.demonio)) resultado.cabeca = VISUAL_PADRAO.cabeca;
  return resultado;
}

export function visualDoPerfil(registro, raca, perfil) {
  return limparVisual(registro.perfis[perfil] ?? registro.perfis.base, registro, raca, perfil);
}

function escreverCanais(p, propriedades, valores) {
  propriedades.forEach((id, i) => p.setProperty(id, valores[i]));
}

export function aplicarVisualSalvo(p) {
  if (!jogadorValido(p)) return;
  const registro = lerAparencia(p);
  const raca = getTrueRace(p);
  const visual = registro ? visualDoPerfil(registro, raca, perfilAtivo(p, raca)) : VISUAL_PADRAO;
  escreverCanais(p, PROP_APARENCIA, codificarVisual(visual));
}

function limparCamera(p) {
  if (p.getDynamicProperty(CHAVE_CAMERA) !== true) return;
  try { p.camera.clear(); }
  catch { p.runCommand("camera @s clear"); }
  p.setDynamicProperty(CHAVE_CAMERA, undefined);
}

export function usarRetrato(sessao) {
  limparCamera(sessao.p);
  sessao.temCamera = false;
}

export function encerrarEdicao(sessao, mensagem) {
  if (sessoes.get(sessao.p.id) !== sessao) return false;
  sessoes.delete(sessao.p.id);
  const p = sessao.p;
  if (jogadorValido(p)) {
    if (sessao.formAberto) {
      try { UI.uiManager?.closeAllForms(p); } catch {}
    }
    try { limparCamera(p); }
    catch (e) { console.warn("[Aparência] Câmera: " + e); }
    try { escreverCanais(p, PROP_RASCUNHO, [-1, -1, -1]); }
    catch (e) { console.warn("[Aparência] Rascunho: " + e); }
    if (mensagem) p.sendMessage(mensagem);
  }
  return true;
}

export const sessaoAtual = (p) => sessoes.get(p.id);

function reservarEntrada(p) {
  // A marca dura no mundo. A oportunidade dura nesta conexão.
  p.setDynamicProperty(CHAVE_ENTRADA, MARCA_ENTRADA);
  entradas.add(p.id);
  return true;
}

export function prepararAparenciaInicial(p) {
  if (!jogadorValido(p) || !p.hasTag(TAG_NOVO)) return false;
  const reservada = p.getDynamicProperty(CHAVE_ENTRADA) === undefined &&
    p.getDynamicProperty(CHAVE_VISUAL) === undefined && reservarEntrada(p);
  p.removeTag(TAG_NOVO);
  return reservada;
}

export function recuperarEntradaV77(p) {
  if (!jogadorValido(p) || p.getDynamicProperty(CHAVE_ENTRADA) !== true ||
      p.getDynamicProperty(CHAVE_VISUAL) !== undefined || !racaEditavel(getTrueRace(p))) return false;
  return reservarEntrada(p);
}

export const edicaoInicialDisponivel = (p) => entradas.has(p.id);

export function indisponivel(p) {
  return !jogadorValido(p) || estadoBloqueado(p) || emCombate(p) || viagemEmCurso(p) || resgateEmCurso(p) ||
    p.getProperty("kny:h_ocupado") === true || (p.getProperty("kny:treino") ?? 0) > 0 ||
    (p.getProperty("kny:forms") ?? 0) > 0 || personagem(p)?.estado === "transformando";
}

export function sessaoSegura(sessao) {
  const p = sessao.p;
  if (sessoes.get(p.id) !== sessao || indisponivel(p) || p.dimension.id !== sessao.dim ||
      getTrueRace(p) !== sessao.raca || perfilAtivo(p, sessao.raca) !== sessao.identidade) return false;
  if (sessao.aguardandoTela) return true;
  const { x, y, z } = p.location;
  const origem = sessao.camera.origem;
  return Math.hypot(x - origem.x, y - origem.y, z - origem.z) <= (sessao.temCamera ? 0.8 : 3);
}

export function iniciarEdicao(p) {
  if (!entradas.has(p.id)) throw new Error("A aparência pode ser escolhida somente na primeira entrada.");
  if (indisponivel(p) || sessoes.has(p.id)) throw new Error("A edição foi encerrada porque o personagem está em uma ação.");
  const registro = lerAparencia(p);
  const raca = getTrueRace(p);
  if (!registro || !racaEditavel(raca) || p.getDynamicProperty(CHAVE_VISUAL) !== undefined) {
    entradas.delete(p.id);
    throw new Error("O personagem já foi iniciado.");
  }
  const catalogo = lerCatalogo();
  const inicial = {
    ...VISUAL_PADRAO,
    peleIntegral: CAMPOS.peleIntegral.opcoes.find((o) => o.codigo > 0 && opcaoPermitida("peleIntegral", o, registro, raca, "base", catalogo))?.id,
    cabelo: "corte_curto",
    olhos: "amplos",
  };
  const sessao = {
    p, raca, identidade: "base", dim: p.dimension.id, registro,
    visual: limparVisual(inicial, registro, raca, "base", catalogo),
    camera: cameraInicial(p), temCamera: false, categoria: "pele", campo: "peleIntegral", tela: "editor",
  };
  entradas.delete(p.id);
  sessoes.set(p.id, sessao);
  try {
    let camera;
    try { camera = buscarCameraInicial(p, sessao.camera); } catch {}
    if (camera) {
      sessao.camera = camera;
      sessao.anguloInicial = camera.angulo;
      sessao.temCamera = true;
      try { p.setDynamicProperty(CHAVE_CAMERA, true); }
      catch (e) { p.camera.clear(); throw e; }
    }
    previsualizar(sessao);
    return sessao;
  } catch (e) {
    encerrarEdicao(sessao);
    throw e;
  }
}

function previsualizar(sessao) {
  if (!sessaoSegura(sessao)) throw new Error("A sessão de edição foi interrompida.");
  escreverCanais(sessao.p, PROP_RASCUNHO, codificarVisual(sessao.visual));
}

export function definirVisual(sessao, alteracoes) {
  if (!sessaoSegura(sessao)) return false;
  const catalogo = lerCatalogo();
  for (const [campo, id] of Object.entries(alteracoes)) {
    if (!CAMPOS_INICIAIS.has(campo) ||
        !opcaoPermitida(campo, opcaoDe(campo, id), sessao.registro, sessao.raca, "base", catalogo)) return false;
  }
  sessao.visual = limparVisual({ ...sessao.visual, ...alteracoes }, sessao.registro, sessao.raca, "base", catalogo);
  previsualizar(sessao);
  return true;
}

export function salvarEdicao(sessao) {
  if (!sessaoSegura(sessao)) return false;
  const p = sessao.p;
  if (p.getDynamicProperty(CHAVE_VISUAL) !== undefined) return false;
  const catalogo = lerCatalogo();
  const base = {};
  for (const campo of CAMPOS_INICIAIS) {
    const id = sessao.visual[campo];
    if (!opcaoPermitida(campo, opcaoDe(campo, id), sessao.registro, sessao.raca, "base", catalogo)) return false;
    base[campo] = id;
  }
  gravarJson(p, CHAVE_VISUAL, { ...sessao.registro, perfis: { base } });
  aplicarVisualSalvo(p);
  encerrarEdicao(sessao, "§aSua aparência foi salva com sucesso.");
  return true;
}

export function atualizarPersonagem(p, restaurar = false) {
  if (!jogadorValido(p)) return;
  const atual = sessaoAtual(p);
  if (atual && (restaurar || !sessaoSegura(atual))) encerrarEdicao(atual, "§eEdição encerrada. O rascunho foi descartado.");
  if (!sessaoAtual(p)) {
    limparCamera(p);
    escreverCanais(p, PROP_RASCUNHO, [-1, -1, -1]);
  }
  aplicarVisualSalvo(p);
}

function agendarVisual(p, restaurar = false) {
  system.run(() => {
    try { atualizarPersonagem(p, restaurar); }
    catch (e) { console.warn("[Aparência] Restauração: " + e); }
  });
}

function interromper(p) {
  const sessao = p && sessoes.get(p.id);
  if (sessao) encerrarEdicao(sessao, "§eEdição interrompida. O rascunho foi descartado.");
}

world.afterEvents.playerSpawn.subscribe(({ player }) => agendarVisual(player, true));
world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
  interromper(player);
  agendarVisual(player, true);
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  entradas.delete(playerId);
  sessoes.delete(playerId);
});
world.afterEvents.entityDie.subscribe(({ deadEntity }) => interromper(deadEntity));
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource, damage }) => {
  if (damage <= 0) return;
  interromper(hurtEntity);
  interromper(damageSource?.damagingEntity);
});
world.afterEvents.dataDrivenEntityTrigger.subscribe(({ entity, eventId }) => {
  if (eventId === "kny:caido_on" || eventId === "kny:reset") interromper(entity);
  agendarVisual(entity);
}, { entityTypes: ["minecraft:player"], eventTypes: [
  "kny:reset", "kny:caido_on", "kny:demon_family", "kny:limpar_linhagem_oni",
  "kny:h_publico_cacador", "kny:h_publico_oni", "kny:h_publico_revelado",
] });
system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id === "kny:h_curado" && sourceEntity?.typeId === "minecraft:player") agendarVisual(sourceEntity);
});
system.runInterval(() => {
  for (const sessao of sessoes.values()) {
    try { if (!sessaoSegura(sessao)) interromper(sessao.p); }
    catch (e) {
      encerrarEdicao(sessao);
      console.warn("[Aparência] Sessão: " + e);
    }
  }
}, 4);
