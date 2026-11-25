import { system, world } from "@minecraft/server";
import { ESPECIAIS } from "./hybrid_config.js";
import { CHAVE_HABILIDADES, gravarJson, guardarPersonagem, hibridoRegistrado, identificador, proprietarios, registrarAuditoria } from "./hybrid_records.js";
import { ehStaff, estadoBloqueado, getPublicFaction, racaHibrida, revelar } from "./hybrid_system.js";
import { areaPermite, destinoSeguro } from "./hybrid_locations.js";
import { folegoDe, pontuar, staminaDe } from "./stats.js";

const emCurso = new Map();
const golpes = new Set();
const local = (o, v, t) => ({ x: o.x + v.x * t, y: o.y + v.y * t, z: o.z + v.z * t });
const vetor = (a, b) => ({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z });
const norma = (v) => Math.hypot(v.x, v.y, v.z);
const produto = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const chaveGolpe = (a, b) => a.id + "/" + b.id;
export const danoEspecialEmCurso = (a, b) => golpes.has(chaveGolpe(a, b));

export function habilidadeDe(p) {
  const d = racaHibrida(p);
  if (!d) return undefined;
  const dados = proprietarios();
  const id = dados && Object.keys(dados.atribuicoes).find((id) => dados.atribuicoes[id].id === d.id);
  return id ? { ...ESPECIAIS[id], id, ativo: dados.atribuicoes[id].ativo, ate: d.habilidadeAte ?? 0 } : undefined;
}

// Registro mundial é a autoridade única; a presença online não altera a reserva.
export function administrarPoder(autor, operacao, poder, alvo) {
  if (!ehStaff(autor)) return "Somente a Staff pode administrar habilidades.";
  if (!Object.hasOwn(ESPECIAIS, poder)) return "Habilidade desconhecida.";
  const d = proprietarios();
  if (!d) return "Registro de habilidades inválido. Consulte a Staff.";
  const anterior = d.atribuicoes[poder];
  if (operacao === "atribuir") {
    if (!hibridoRegistrado(alvo)) return "ID de Híbrido não encontrado.";
    if (anterior || Object.values(d.atribuicoes).some((a) => a.id === alvo)) return "Habilidade ou personagem já possui uma atribuição.";
    d.atribuicoes[poder] = { id: alvo, ativo: true, quando: Date.now() };
  } else if (["desativar", "reativar"].includes(operacao) && anterior) {
    d.atribuicoes[poder] = { ...anterior, ativo: operacao === "reativar" };
  } else {
    return "Operação indisponível para esta habilidade.";
  }
  const acao = { operacao, poder, alvo: d.atribuicoes[poder].id, autor: identificador(autor), quando: Date.now() };
  d.historico = [...d.historico.slice(-39), acao];
  gravarJson(world, CHAVE_HABILIDADES, d);
  registrarAuditoria("habilidade", acao);
  return "Alteração salva com registro de auditoria.";
}

function visivel(dim, origem, fim) {
  const d = vetor(origem, fim);
  const n = norma(d);
  if (n <= 0.1) return true;
  return !dim.getBlockFromRay(origem, { x: d.x / n, y: d.y / n, z: d.z / n }, { maxDistance: n - 0.1 });
}

function alvos(ctx, origem, raio) {
  const { p, dim } = ctx;
  return dim.getEntities({ location: origem, maxDistance: raio, closest: 32 }).filter((a) => {
    if (!a.isValid || a.id === p.id || a.hasTag("kny_caido") || !a.getComponent("minecraft:health") ||
        !areaPermite(dim, a.location)) return false;
    if (a.typeId === "minecraft:player") return getPublicFaction(a) !== "oni";
    return !a.matches({ families: ["demon"] }) && !a.matches({ families: ["player_demon"] });
  });
}

function particula(ctx, pos) {
  try { ctx.dim.spawnParticle(ctx.h.particula, pos); } catch {}
}

function golpear(ctx, alvo) {
  const chave = chaveGolpe(ctx.p, alvo);
  golpes.add(chave);
  try { alvo.applyDamage(ctx.h.dano, { cause: "magic", damagingEntity: ctx.p }); }
  finally { golpes.delete(chave); }
}

function emLinha(ctx, a, largura) {
  const cima = a.getHeadLocation();
  const delta = vetor(ctx.origem, cima);
  const dist = produto(delta, ctx.frente);
  const transversal = norma(vetor(local(ctx.origem, ctx.frente, dist), cima));
  return dist >= 0 && dist <= ctx.h.alcance && transversal <= largura && visivel(ctx.dim, ctx.origem, cima);
}

function ruptura(ctx) {
  for (let t = 1; t <= ctx.h.alcance; t += 2) {
    const pos = local(ctx.origem, ctx.frente, t);
    if (!visivel(ctx.dim, ctx.origem, pos)) break;
    particula(ctx, pos);
  }
  for (const a of alvos(ctx, ctx.origem, ctx.h.alcance).filter((a) => emLinha(ctx, a, 1.4)).slice(0, ctx.h.alvos)) golpear(ctx, a);
}

function aindaValido(ctx) {
  const { p, dim, h } = ctx;
  const atual = p.isValid ? habilidadeDe(p) : undefined;
  return atual?.ativo && atual.id === h.id && !estadoBloqueado(p) && p.dimension.id === dim.id && areaPermite(dim, p.location);
}

function encerrar(ctx) {
  if (emCurso.get(ctx.p.id) !== ctx) return;
  emCurso.delete(ctx.p.id);
  if (ctx.p.isValid) ctx.p.setProperty("kny:h_ocupado", false);
}

function agendar(ctx, fn, ticks) {
  system.runTimeout(() => {
    try {
      if (emCurso.get(ctx.p.id) !== ctx || !aindaValido(ctx)) return encerrar(ctx);
      fn();
    } catch (e) {
      encerrar(ctx);
      console.warn("[Híbridos] Técnica interrompida. " + e);
    }
  }, ticks);
}

function dragao(ctx) {
  const atingidos = new Set();
  for (const [i, t] of [3, 6, ctx.h.alcance].entries()) {
    agendar(ctx, () => {
      const pos = local(ctx.origem, ctx.frente, t);
      if (!visivel(ctx.dim, ctx.origem, pos)) return encerrar(ctx);
      particula(ctx, pos);
      for (const a of alvos(ctx, ctx.origem, ctx.h.alcance)) {
        if (atingidos.size >= ctx.h.alvos) break;
        if (atingidos.has(a.id) || !emLinha(ctx, a, 2.4) ||
            Math.abs(produto(vetor(ctx.origem, a.getHeadLocation()), ctx.frente) - t) > 2.8) continue;
        atingidos.add(a.id);
        golpear(ctx, a);
      }
    }, 1 + i * 5);
  }
}

function trajetoPasso(ctx) {
  const origem = ctx.p.location;
  const n = Math.hypot(ctx.frente.x, ctx.frente.z);
  if (n < 0.1) return undefined;
  const direcao = { x: ctx.frente.x / n, y: 0, z: ctx.frente.z / n };
  let destino;
  for (let t = 0.4; t <= ctx.h.alcance + 0.01; t += 0.4) {
    const pos = local(origem, direcao, t);
    if (!destinoSeguro(ctx.dim, pos) || !visivel(ctx.dim, ctx.origem, { ...pos, y: ctx.origem.y })) break;
    if (t >= 1.5) destino = pos;
  }
  return destino;
}

function prisao(ctx) {
  const atingidos = new Set();
  for (const atraso of [1, 25, 49]) {
    agendar(ctx, () => {
      particula(ctx, ctx.origem);
      for (const a of alvos(ctx, ctx.origem, ctx.h.alcance)) {
        if (!visivel(ctx.dim, ctx.origem, a.getHeadLocation())) continue;
        if (atingidos.size < ctx.h.alvos) atingidos.add(a.id);
        if (atingidos.has(a.id)) a.addEffect("slowness", Math.min(26, ctx.h.duracao - atraso), { amplifier: 1, showParticles: true });
      }
    }, atraso);
  }
}

function sombras(ctx) {
  const centro = local(ctx.origem, ctx.frente, 2);
  particula(ctx, visivel(ctx.dim, ctx.origem, centro) ? centro : ctx.origem);
  const afetados = alvos(ctx, ctx.origem, ctx.h.alcance).filter((a) =>
    produto(vetor(ctx.origem, a.getHeadLocation()), ctx.frente) > 0 && visivel(ctx.dim, ctx.origem, a.getHeadLocation())).slice(0, ctx.h.alvos);
  for (const a of afetados) a.addEffect("blindness", ctx.h.duracao, { amplifier: 0, showParticles: true });
}

const executar = { ruptura, dragao, prisao, sombras, carapaca: (ctx) => particula(ctx, ctx.origem) };

export function ativarHabilidade(p) {
  const d = racaHibrida(p);
  const h = habilidadeDe(p);
  if (!d || !h?.ativo || h.id === undefined) return "Habilidade exclusiva aguardando atribuição ou desativada pela Staff.";
  if (estadoBloqueado(p) || p.getProperty("kny:h_ocupado") || !areaPermite(p.dimension, p.location)) return "Você não pode usar esse poder aqui ou nesta ação.";
  const falta = Math.ceil((h.ate - Date.now()) / 1000);
  if (falta > 0) return `Habilidade em recarga por ${falta}s.`;
  const f = folegoDe(p);
  const s = staminaDe(p);
  if (f.atual < h.folego || s.atual < h.stamina || s.atual <= 0) return "Fôlego ou stamina insuficientes.";
  const ctx = { p, h, dim: p.dimension, origem: p.getHeadLocation(), frente: p.getViewDirection() };
  const destino = h.id === "passo" ? trajetoPasso(ctx) : undefined;
  if (h.id === "passo" && !destino) return "O caminho está bloqueado.";
  revelar(p);
  const atual = racaHibrida(p);
  guardarPersonagem(p, { ...atual, habilidadeAte: Date.now() + h.ms });
  pontuar(p, "kny_folego", f.atual - h.folego);
  pontuar(p, "kny_stam", s.atual - h.stamina);
  if (destino) {
    if (!p.tryTeleport(destino, { checkForBlocks: true, keepVelocity: false })) {
      guardarPersonagem(p, atual);
      pontuar(p, "kny_folego", f.atual);
      pontuar(p, "kny_stam", s.atual);
      return "O mundo bloqueou o deslocamento.";
    }
    particula(ctx, ctx.origem);
    particula(ctx, p.getHeadLocation());
  } else {
    if (h.duracao > 0) {
      emCurso.set(p.id, ctx);
      p.setProperty("kny:h_ocupado", true);
      system.runTimeout(() => encerrar(ctx), h.duracao + 1);
    }
    executar[h.id](ctx);
  }
  try { p.playSound(h.som); } catch {}
  return undefined;
}

world.beforeEvents.entityHurt.subscribe((ev) => {
  const ctx = emCurso.get(ev.hurtEntity.id);
  const atacante = ev.damageSource.damagingEntity;
  if (ctx?.h.id === "carapaca" && atacante && atacante.id !== ev.hurtEntity.id && !ev.cancel && aindaValido(ctx)) {
    ev.damage *= 1 - ctx.h.reducao;
  }
});
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  const ctx = emCurso.get(deadEntity.id);
  if (ctx) encerrar(ctx);
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => emCurso.delete(playerId));
world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
  const ctx = emCurso.get(player.id);
  if (ctx) encerrar(ctx);
});
