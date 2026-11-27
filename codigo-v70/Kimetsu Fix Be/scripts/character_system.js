import { system, world } from "@minecraft/server";
import * as UI from "@minecraft/server-ui";
import { CAMPOS, PROP_APARENCIA, PROP_RASCUNHO, VISUAL_PADRAO, codificarVisual, opcaoDe } from "./character_config.js";
import { cameraInicial, posicionarCamera } from "./character_camera.js";
import { emCombate, estadoBloqueado, getTrueRace, racaHibrida } from "./hybrid_system.js";
import { lerJson, gravarJson, personagem } from "./hybrid_records.js";
import { viagemEmCurso } from "./hybrid_locations.js";
import { resgateEmCurso } from "./revive.js";

export const CHAVE_VISUAL = "kny:aparencia";
export const CHAVE_CATALOGO = "kny:aparencia_catalogo";
const CHAVE_CAMERA = "kny:aparencia_camera";
const PERFIS_H = ["cacador", "oni", "revelado"];
const sessoes = new Map();
const jogadorValido = (p) => p?.isValid && p.typeId === "minecraft:player";
const objeto = (d) => !!d && typeof d === "object" && !Array.isArray(d);

export function lerAparencia(p) {
  const d = lerJson(p, CHAVE_VISUAL);
  if (d === undefined) return { v: 1, perfis: {}, nome: "", sobrenome: "", autorizarNome: false, concessoes: [] };
  return objeto(d?.perfis) && Array.isArray(d.concessoes) ? d : null;
}

export function lerCatalogo() {
  const dado = lerJson(world, CHAVE_CATALOGO);
  return Array.isArray(dado?.bloqueados) ? dado : { v: 1, bloqueados: [] };
}

export const perfisDisponiveis = (raca) => raca === "hibrido" ? PERFIS_H : raca === "oni" ? ["oni"] : ["base"];
export function perfilAtivo(p, raca = getTrueRace(p)) {
  return raca === "hibrido" ? racaHibrida(p).publico : perfisDisponiveis(raca)[0];
}

export const permiteTracos = (raca, perfil) => (raca === "oni" && perfil === "oni") ||
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

export function indisponivel(p) {
  return !jogadorValido(p) || estadoBloqueado(p) || emCombate(p) || viagemEmCurso(p) || resgateEmCurso(p) ||
    p.getProperty("kny:h_ocupado") === true || (p.getProperty("kny:treino") ?? 0) > 0 ||
    (p.getProperty("kny:forms") ?? 0) > 0 || personagem(p)?.estado === "transformando";
}

export function sessaoSegura(sessao) {
  const p = sessao.p;
  if (sessoes.get(p.id) !== sessao || indisponivel(p) || p.dimension.id !== sessao.dim ||
      getTrueRace(p) !== sessao.raca || perfilAtivo(p, sessao.raca) !== sessao.identidade) return false;
  const { x, y, z } = p.location;
  const origem = sessao.camera.origem;
  return Math.hypot(x - origem.x, y - origem.y, z - origem.z) <= 0.8;
}

export function iniciarEdicao(p) {
  if (indisponivel(p) || sessoes.has(p.id)) throw new Error("Aguarde em um local seguro para personalizar.");
  const registro = lerAparencia(p);
  if (!registro) throw new Error("A ficha de aparência precisa ser revisada pela Staff.");
  const raca = getTrueRace(p);
  const perfil = perfilAtivo(p, raca);
  const sessao = {
    p, raca, perfil, identidade: perfil, dim: p.dimension.id, registro, editados: new Set(),
    rascunhos: new Map(), camera: cameraInicial(p), categoria: "base", campo: "pele", tela: "editor",
    nome: registro.nome ?? "", sobrenome: registro.sobrenome ?? "", editouNome: false,
  };
  sessoes.set(p.id, sessao);
  try {
    if (!posicionarCamera(p, sessao.camera)) throw new Error("Deixe espaço à frente do personagem para abrir o editor.");
    try { p.setDynamicProperty(CHAVE_CAMERA, true); }
    catch (e) { p.camera.clear(); throw e; }
    previsualizar(sessao);
    return sessao;
  } catch (e) {
    encerrarEdicao(sessao);
    throw e;
  }
}

export function rascunho(sessao) {
  if (!sessao.rascunhos.has(sessao.perfil)) {
    sessao.rascunhos.set(sessao.perfil, visualDoPerfil(sessao.registro, sessao.raca, sessao.perfil));
  }
  return sessao.rascunhos.get(sessao.perfil);
}

function previsualizar(sessao) {
  if (!sessaoSegura(sessao)) throw new Error("A sessão de edição foi interrompida.");
  escreverCanais(sessao.p, PROP_RASCUNHO, codificarVisual(rascunho(sessao)));
}

export function trocarPerfil(sessao, perfil) {
  if (!perfisDisponiveis(sessao.raca).includes(perfil) || !sessaoSegura(sessao)) return false;
  sessao.perfil = perfil;
  previsualizar(sessao);
  return true;
}

export function definirVisual(sessao, alteracoes) {
  if (!sessaoSegura(sessao)) return false;
  const catalogo = lerCatalogo();
  for (const [campo, id] of Object.entries(alteracoes)) {
    if (!opcaoPermitida(campo, opcaoDe(campo, id), sessao.registro, sessao.raca, sessao.perfil, catalogo)) return false;
  }
  const novo = limparVisual({ ...rascunho(sessao), ...alteracoes }, sessao.registro, sessao.raca, sessao.perfil, catalogo);
  sessao.rascunhos.set(sessao.perfil, novo);
  sessao.editados.add(sessao.perfil);
  previsualizar(sessao);
  return true;
}

export function validarNome(valor) {
  if (typeof valor !== "string") return undefined;
  const nome = valor.trim().replace(/ +/g, " ");
  return nome.length <= 24 && /^[\p{L}\p{M} '\-]*$/u.test(nome) ? nome : undefined;
}

export function salvarEdicao(sessao) {
  if (!sessaoSegura(sessao)) return false;
  const registro = lerAparencia(sessao.p);
  if (!registro) return false;
  const catalogo = lerCatalogo();
  const perfis = { ...registro.perfis };
  for (const perfil of sessao.editados) {
    const visual = sessao.rascunhos.get(perfil);
    for (const [campo, id] of Object.entries(visual)) {
      if (!opcaoPermitida(campo, opcaoDe(campo, id), registro, sessao.raca, perfil, catalogo)) return false;
    }
    perfis[perfil] = limparVisual(visual, registro, sessao.raca, perfil, catalogo);
  }
  const nome = sessao.editouNome ? validarNome(sessao.nome) : registro.nome;
  const sobrenome = sessao.editouNome ? validarNome(sessao.sobrenome) : registro.sobrenome;
  if (sessao.editouNome && (!registro.autorizarNome || nome === undefined || sobrenome === undefined)) return false;
  if (sessao.editados.size || sessao.editouNome) gravarJson(sessao.p, CHAVE_VISUAL, { ...registro, perfis, nome, sobrenome });
  aplicarVisualSalvo(sessao.p);
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
world.afterEvents.playerLeave.subscribe(({ playerId }) => sessoes.delete(playerId));
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
