import { kcmd } from "./compat.js";
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { pontuar, staminaDe } from "./stats.js";

/* ---------------------------------------------------------------------
   SISTEMA DE CAÍDO / REVIVER / CARREGAR

   - Ao "morrer", o jogador volta no mesmo lugar, deitado no chão (caído).
   - Caído: não anda, não ataca e não usa itens. Se levar dano suficiente, morre de verdade.
   - Reviver: outro jogador fica AGACHADO perto do corpo por 10 s.
   - Carregar: clicar (botão de ação) no jogador caído -> menu -> Carregar.
     Quem carrega solta segurando agachado por 3 s (ou pelo menu "Soltar").
   - Desistir: o caído segura agachado por 5 s (ou usa qualquer item e escolhe "Desistir").
--------------------------------------------------------------------- */

const CFG = {
  TEMPO_REVIVER: 10, // segundos agachado perto do corpo
  DIST_REVIVER: 2.5, // distância máxima (blocos) para reviver
  VIDA_CAIDO: 10, // vida (pontos) com que o jogador fica caído; ao chegar a 0 ele morre de verdade
  VIDA_REVIVIDO: 0.3, // fração da vida máxima ao ser revivido
  STAMINA_REVIVIDO: 0.5, // fração da stamina máxima ao ser revivido
  TEMPO_DESISTIR: 5, // segundos agachado (caído) para morrer de verdade
  TEMPO_SOLTAR: 3, // segundos agachado (carregando) para soltar
  PERMITIR_FINALIZAR: true, // botão "Finalizar" no menu: outro jogador mata o caído de vez
  DIST_MENU: 6, // distância máxima para confirmar "Carregar" no menu
  DEBUG: false, // mostra no chat avisos de diagnóstico ([caido] ...). Ponha false quando tudo estiver ok
  AJUSTAR_GAMERULES: true, // keepinventory + respawn imediato + sem mensagem de morte
};

const TAG = "kny_caido";
const EVENTO_ON = "kny:caido_on";
const EVENTO_OFF = "kny:caido_off";

const caidos = new Map(); // idCaido -> { anchor, por, desistir, prog, reviver, desde, livre }
const carregando = new Map(); // idQuemCarrega -> idCaido
const soltando = new Map(); // idQuemCarrega -> ticks agachado
const pendentes = new Map(); // idMorto -> { loc, dim }
const morteReal = new Set(); // ids que morreram de verdade estando caídos
const ultimaPos = new Map(); // id -> { loc, dim }
const cooldownMenu = new Map();
const ouvintesReanimacao = new Set();

export const aguardaResgate = (id) => pendentes.has(id) || caidos.has(id);
export const aoReanimar = (ouvir) => ouvintesReanimacao.add(ouvir);

export function resgateEmCurso(p) {
  if (caidos.has(p.id) || carregando.has(p.id)) return true;
  for (const estado of caidos.values()) if (estado.reviver === p.id && estado.prog > 0) return true;
  return false;
}

const EFEITOS_CAIDO = ["resistance", "slowness", "weakness", "mining_fatigue", "water_breathing", "fire_resistance"];

const jaVisto = new Set();
function dbg(msg, repetir = false) {
  if (!CFG.DEBUG) return;
  if (!repetir) {
    if (jaVisto.has(msg)) return;
    jaVisto.add(msg);
  }
  try {
    world.sendMessage("§8[caido] " + msg);
  } catch {}
}

const tentar = (fn) => {
  try {
    return fn();
  } catch (e) {
    dbg("erro: " + e);
    return undefined;
  }
};

const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function aplicarEfeitos(p) {
  tentar(() => p.addEffect("slowness", 40, { amplifier: 10, showParticles: false }));
  tentar(() => p.addEffect("weakness", 40, { amplifier: 255, showParticles: false }));
  tentar(() => p.addEffect("mining_fatigue", 40, { amplifier: 10, showParticles: false }));
}

function limparEfeitos(p) {
  for (const e of EFEITOS_CAIDO) tentar(() => p.removeEffect(e));
}

function barra(frac, tam = 20) {
  const cheio = Math.max(0, Math.min(tam, Math.round(frac * tam)));
  return "§a" + "█".repeat(cheio) + "§8" + "█".repeat(tam - cheio);
}

function barraAcao(p, texto) {
  tentar(() => p.onScreenDisplay.setActionBar(texto));
}

/* ------------------------------ ENTRAR / SAIR ------------------------------ */

function entrarCaido(p) {
  if (!caidos.has(p.id)) {
    caidos.set(p.id, { anchor: null, por: null, desistir: 0, prog: 0, reviver: null, desde: system.currentTick, livre: 0 });
    world.sendMessage(`§c${p.name} caiu! §7Agache perto dele por ${CFG.TEMPO_REVIVER}s para reanimar.`);
  }
  if (!p.hasTag(TAG)) p.addTag(TAG);
  tentar(() => p.triggerEvent(EVENTO_ON));
  const h = tentar(() => p.getComponent("minecraft:health"));
  if (h) tentar(() => h.setCurrentValue(Math.max(1, Math.min(CFG.VIDA_CAIDO, h.effectiveMax))));
  tentar(() => pontuar(p, "kny_stam", 0));
  tentar(() => pontuar(p, "kny_folego", 0));
  tentar(() => pontuar(p, "kny_exausto", 1));
  aplicarEfeitos(p);
}

function limparEstado(p) {
  tentar(() => p.removeTag(TAG));
  tentar(() => p.triggerEvent(EVENTO_OFF));
  limparEfeitos(p);
}

function soltarCarregado(idQuemCarrega, aviso = true) {
  const idCaido = carregando.get(idQuemCarrega);
  carregando.delete(idQuemCarrega);
  soltando.delete(idQuemCarrega);
  const c = caidos.get(idCaido);
  if (c) {
    c.por = null;
    c.anchor = null; // volta a fixar no chão quando aterrissar
    c.livre = 0;
  }
  if (aviso) {
    const carrier = jogador(idQuemCarrega);
    if (carrier) tentar(() => carrier.sendMessage("§7Você soltou o jogador."));
  }
}

function reviver(p, quem) {
  caidos.delete(p.id);
  for (const [cid, tid] of [...carregando]) if (tid === p.id) soltarCarregado(cid, false);
  limparEstado(p);
  const h = tentar(() => p.getComponent("minecraft:health"));
  if (h) tentar(() => h.setCurrentValue(Math.max(4, Math.floor(h.effectiveMax * CFG.VIDA_REVIVIDO))));
  tentar(() => pontuar(p, "kny_stam", Math.floor(staminaDe(p).max * CFG.STAMINA_REVIVIDO)));
  tentar(() => pontuar(p, "kny_exausto", 0));
  tentar(() => kcmd(p, "playsound random.levelup @s"));
  barraAcao(p, "§aVocê foi reanimado!");
  if (quem) barraAcao(quem, `§aVocê reanimou ${p.name}!`);
  for (const ouvir of ouvintesReanimacao) {
    try { ouvir(quem, p); }
    catch (e) { console.warn("[Reviver] Observador: " + e); }
  }
  world.sendMessage(`§a${p.name} foi reanimado${quem ? ` por ${quem.name}` : ""}!`);
}

function jogador(id) {
  return world.getPlayers().find((x) => x.id === id);
}

/* ------------------------------ MORTE -> CAÍDO ------------------------------ */

world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (!e || e.typeId !== "minecraft:player") return;
  const id = e.id;

  // morreu estando caído (vazio, /kill ou desistiu): morte de verdade
  if (caidos.has(id)) {
    caidos.delete(id);
    morteReal.add(id);
    for (const [cid, tid] of [...carregando]) if (tid === id) soltarCarregado(cid, false);
    return;
  }

  // estava carregando alguém: solta
  if (carregando.has(id)) soltarCarregado(id, false);

  let loc = tentar(() => e.location);
  let dim = tentar(() => e.dimension);
  const u = ultimaPos.get(id);
  if (!loc && u) loc = u.loc;
  if (!dim && u) dim = u.dim;
  if (!loc || !dim || loc.y < -60) return; // caiu no vazio: morte normal
  pendentes.set(id, { loc: { x: loc.x, y: loc.y, z: loc.z }, dim });
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  const p = ev.player;
  const pend = pendentes.get(p.id);
  if (pend) {
    pendentes.delete(p.id);
    system.runTimeout(() => {
      tentar(() => p.teleport(pend.loc, { dimension: pend.dim, keepVelocity: false }));
      entrarCaido(p);
    }, 5);
    return;
  }
  if (morteReal.has(p.id)) {
    morteReal.delete(p.id);
    limparEstado(p);
    return;
  }
  // voltou ao mundo ainda caído
  if (p.hasTag(TAG)) {
    if (ev.initialSpawn) system.runTimeout(() => entrarCaido(p), 20);
    else {
      // renasceu sem estar "pendente": foi uma morte de verdade
      caidos.delete(p.id);
      limparEstado(p);
    }
  }
});

world.afterEvents.playerLeave.subscribe((ev) => {
  const id = ev.playerId;
  if (carregando.has(id)) soltarCarregado(id, false);
  ultimaPos.delete(id);
  soltando.delete(id);
});

/* ------------------------------ BLOQUEIOS ------------------------------ */

// procura um jogador caído na mira (até 4 blocos)
function caidoNaMira(p) {
  let achado = null;
  tentar(() => {
    for (const r of p.getEntitiesFromViewDirection({ maxDistance: 4 })) {
      if (r.entity && caidos.has(r.entity.id)) {
        achado = r.entity;
        break;
      }
    }
  });
  return achado;
}

world.beforeEvents.itemUse?.subscribe((ev) => {
  const p = ev.source;
  // quem não está caído usa um item olhando para um caído: abre o menu de carregar
  if (p && !caidos.has(p.id)) {
    const alvo = caidoNaMira(p);
    if (alvo) {
      ev.cancel = true;
      aoInteragir(p, alvo);
    }
    return;
  }
  if (!caidos.has(p?.id)) return;
  ev.cancel = true;
  const agora = system.currentTick;
  if (agora - (cooldownMenu.get(p.id) ?? -100) < 20) return;
  cooldownMenu.set(p.id, agora);
  system.run(() => tentar(() => abrirMenuCaido(p)));
});
world.beforeEvents.playerInteractWithBlock?.subscribe((ev) => {
  if (caidos.has(ev.player?.id)) ev.cancel = true;
});
world.beforeEvents.playerBreakBlock?.subscribe((ev) => {
  if (caidos.has(ev.player?.id)) ev.cancel = true;
});
world.beforeEvents.playerPlaceBlock?.subscribe((ev) => {
  if (caidos.has(ev.player?.id)) ev.cancel = true;
});

// quem está caído não causa dano (devolve a vida da vítima)
world.afterEvents.entityHurt.subscribe((ev) => {
  const a = ev.damageSource?.damagingEntity;
  if (!a || !caidos.has(a.id)) return;
  const h = tentar(() => ev.hurtEntity.getComponent("minecraft:health"));
  if (h && h.currentValue > 0) tentar(() => h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + ev.damage)));
});

/* ------------------------------ MENU: CARREGAR ------------------------------ */

function mostrar(p, form, fn, tentativa = 0) {
  form
    .show(p)
    .then((r) => {
      if (r.canceled) {
        dbg("formulário cancelado: " + r.cancelationReason, true);
        if (r.cancelationReason === "UserBusy" && tentativa < 10) system.runTimeout(() => mostrar(p, form, fn, tentativa + 1), 10);
        return;
      }
      fn(r.selection);
    })
    .catch((e) => dbg("erro no formulário: " + e));
}

function abrirMenu(p, alvo) {
  dbg("abrindo menu de " + p.name + " para " + alvo.name, true);
  const c = caidos.get(alvo.id);
  if (!c) return;
  const form = new ActionFormData().title("§cJogador caído");

  if (c.por === p.id) {
    form.body(`§f${alvo.name} §7está sendo carregado por você.`);
    form.button("§eSoltar");
    form.button("§7Fechar");
    mostrar(p, form, (sel) => {
      if (sel === 0 && carregando.get(p.id) === alvo.id) soltarCarregado(p.id);
    });
    return;
  }
  if (c.por) {
    form.body(`§f${alvo.name} §7já está sendo carregado por outro jogador.`);
    form.button("§7Fechar");
    mostrar(p, form, () => {});
    return;
  }
  if (carregando.has(p.id)) {
    form.body("§7Você já está carregando alguém.");
    form.button("§7Fechar");
    mostrar(p, form, () => {});
    return;
  }

  form.body(
    `§f${alvo.name} §7está caído.\n\n§7Para reanimar: fique §fagachado§7 perto dele por §f${CFG.TEMPO_REVIVER}s§7.\nOu carregue-o até um lugar seguro.`
  );
  form.button("§aCarregar");
  if (CFG.PERMITIR_FINALIZAR) form.button("§cFinalizar");
  form.button("§7Fechar");
  mostrar(p, form, (sel) => {
    if (CFG.PERMITIR_FINALIZAR && sel === 1) {
      const cf = caidos.get(alvo.id);
      if (!cf || caidos.has(p.id)) return;
      if (p.dimension.id !== alvo.dimension.id || dist2d(p.location, alvo.location) > CFG.DIST_MENU) {
        tentar(() => p.sendMessage("§cVocê está longe demais."));
        return;
      }
      world.sendMessage(`§c${p.name} finalizou ${alvo.name}.`);
      matar(alvo);
      return;
    }
    if (sel !== 0) return;
    const cc = caidos.get(alvo.id);
    if (!cc || cc.por || caidos.has(p.id) || carregando.has(p.id)) return;
    if (p.dimension.id !== alvo.dimension.id || dist2d(p.location, alvo.location) > CFG.DIST_MENU) {
      tentar(() => p.sendMessage("§cVocê está longe demais."));
      return;
    }
    carregando.set(p.id, alvo.id);
    cc.por = p.id;
    cc.prog = 0;
    tentar(() => p.sendMessage(`§eVocê está carregando ${alvo.name}. §7Segure agachado ${CFG.TEMPO_SOLTAR}s para soltar.`));
    tentar(() => alvo.sendMessage(`§e${p.name} está te carregando.`));
  });
}

// mata de verdade (tenta vários métodos até o jogador realmente morrer)
function matar(p) {
  tentar(() => p.kill());
  system.runTimeout(() => {
    if (caidos.has(p.id)) tentar(() => p.applyDamage(9999, { cause: "override" }));
  }, 3);
  system.runTimeout(() => {
    if (caidos.has(p.id)) tentar(() => kcmd(p, "kill @s"));
  }, 8);
  system.runTimeout(() => {
    if (!caidos.has(p.id)) return;
    const h = tentar(() => p.getComponent("minecraft:health"));
    if (h) tentar(() => h.setCurrentValue(0));
  }, 14);
}

function desistir(p) {
  dbg("desistir: " + p.name, true);
  matar(p);
}

function abrirMenuCaido(p) {
  if (!caidos.has(p.id)) return;
  const form = new ActionFormData()
    .title("§cVocê está caído")
    .body("§7Aguarde um aliado te reanimar.\nOu desista para morrer de verdade.")
    .button("§cDesistir (morrer)")
    .button("§7Continuar caído");
  mostrar(p, form, (sel) => {
    if (sel === 0 && caidos.has(p.id)) desistir(p);
  });
}

// descobre quem interagiu com o caído (quem está olhando para ele; senão, o mais perto)
function acharInteragente(alvo) {
  let melhor = null;
  let menor = 99;
  for (const q of world.getPlayers()) {
    if (q.id === alvo.id || caidos.has(q.id) || q.dimension.id !== alvo.dimension.id) continue;
    const d = Math.hypot(q.location.x - alvo.location.x, q.location.y - alvo.location.y, q.location.z - alvo.location.z);
    if (d > 6) continue;
    let olha = false;
    tentar(() => {
      olha = q.getEntitiesFromViewDirection({ maxDistance: 7 }).some((r) => r.entity?.id === alvo.id);
    });
    const pontos = d - (olha ? 10 : 0);
    if (pontos < menor) {
      menor = pontos;
      melhor = q;
    }
  }
  return melhor;
}

function aoInteragir(p, alvo) {
  dbg("interação: " + (p?.name ?? "?") + " -> " + (alvo?.name ?? "?"), true);
  if (!p || !alvo || alvo.typeId !== "minecraft:player") return;
  if (!caidos.has(alvo.id) || caidos.has(p.id) || alvo.id === p.id) return;
  const agora = system.currentTick;
  if (agora - (cooldownMenu.get(p.id) ?? -100) < 20) return;
  cooldownMenu.set(p.id, agora);
  system.runTimeout(() => tentar(() => abrirMenu(p, alvo)), 2);
}

// 1) botão de ação nativo (minecraft:interact no player.json enquanto está caído)
world.afterEvents.dataDrivenEntityTrigger?.subscribe((ev) => {
  if (ev.eventId !== "kny:caido_interagido") return;
  dbg("botão de ação nativo detectado", true);
  const alvo = ev.entity;
  if (!alvo || alvo.typeId !== "minecraft:player") return;
  aoInteragir(acharInteragente(alvo), alvo);
});

// 2) evento de interação da Script API (se existir nesta versão)
world.afterEvents.playerInteractWithEntity?.subscribe((ev) => aoInteragir(ev.player, ev.target));

// 3) plano B: bater (atacar) no caído também abre o menu
world.afterEvents.entityHitEntity.subscribe((ev) => {
  if (ev.damagingEntity?.typeId === "minecraft:player") aoInteragir(ev.damagingEntity, ev.hitEntity);
});

/* ------------------------------ LOOP PRINCIPAL ------------------------------ */

let n = 0;
system.runInterval(() => {
  n++;
  const players = world.getPlayers();
  const porId = new Map(players.map((x) => [x.id, x]));

  // seguir quem carrega (todo tick, para ficar suave)
  for (const [cid, tid] of [...carregando]) {
    const carrier = porId.get(cid);
    const alvo = porId.get(tid);
    if (!carrier || !alvo || !caidos.has(tid) || caidos.has(cid)) {
      soltarCarregado(cid, false);
      continue;
    }
    tentar(() => {
      const l = carrier.location;
      const d = carrier.getViewDirection();
      const len = Math.hypot(d.x, d.z) || 1;
      alvo.teleport(
        { x: l.x - (d.x / len) * 0.5, y: l.y + 0.8, z: l.z - (d.z / len) * 0.5 },
        { dimension: carrier.dimension, rotation: { x: 0, y: carrier.getRotation().y }, keepVelocity: false }
      );
    });
  }

  if (n % 5 !== 0) return;

  for (const p of players) {
    if (!caidos.has(p.id)) ultimaPos.set(p.id, { loc: p.location, dim: p.dimension });
  }

  // quem carrega: lentidão e soltar agachado
  for (const [cid, tid] of [...carregando]) {
    const carrier = porId.get(cid);
    const alvo = porId.get(tid);
    if (!carrier || !alvo) continue;
    tentar(() => carrier.addEffect("slowness", 20, { amplifier: 0, showParticles: false }));
    if (carrier.isSneaking) {
      const t = (soltando.get(cid) ?? 0) + 5;
      soltando.set(cid, t);
      if (t >= CFG.TEMPO_SOLTAR * 20) {
        soltarCarregado(cid);
        continue;
      }
      barraAcao(carrier, `§eSoltando ${alvo.name}...\n${barra(t / (CFG.TEMPO_SOLTAR * 20))}`);
    } else {
      soltando.set(cid, 0);
      barraAcao(carrier, `§eCarregando §f${alvo.name} §7(segure agachado ${CFG.TEMPO_SOLTAR}s para soltar)`);
    }
  }

  // quem está caído
  for (const [id, c] of [...caidos]) {
    const p = porId.get(id);
    if (!p) continue;

    aplicarEfeitos(p);
    if (n % 10 === 0) {
      tentar(() => pontuar(p, "kny_stam", 0));
      tentar(() => pontuar(p, "kny_exausto", 1));
      tentar(() => pontuar(p, "kny_folego", 0));
    }
    const h = tentar(() => p.getComponent("minecraft:health"));
    if (h && h.currentValue > CFG.VIDA_CAIDO) tentar(() => h.setCurrentValue(CFG.VIDA_CAIDO));

    // manter parado no lugar (quando não está sendo carregado)
    if (!c.por) {
      c.livre += 5;
      if (!c.anchor) {
        if (p.isOnGround !== false || c.livre > 60) c.anchor = { x: p.location.x, y: p.location.y, z: p.location.z };
      } else {
        const l = p.location;
        if (Math.hypot(l.x - c.anchor.x, l.z - c.anchor.z) > 0.3 || Math.abs(l.y - c.anchor.y) > 0.3) {
          tentar(() => p.teleport(c.anchor, { dimension: p.dimension, keepVelocity: false }));
        }
      }
    }

    // procurar quem está reanimando (agachado e perto)
    let r = null;
    for (const q of players) {
      if (q.id === id || caidos.has(q.id) || carregando.has(q.id) || !q.isSneaking) continue;
      if (q.dimension.id !== p.dimension.id) continue;
      if (dist2d(q.location, p.location) <= CFG.DIST_REVIVER && Math.abs(q.location.y - p.location.y) <= 2.5) {
        r = q;
        break;
      }
    }

    if (r) {
      c.prog += 5;
      c.reviver = r.id;
      const frac = c.prog / (CFG.TEMPO_REVIVER * 20);
      if (frac >= 1) {
        reviver(p, r);
        continue;
      }
      barraAcao(r, `§aReanimando ${p.name}...\n${barra(frac)} §f${Math.floor(frac * 100)}%`);
      barraAcao(p, `§a${r.name} está te reanimando...\n${barra(frac)} §f${Math.floor(frac * 100)}%`);
      c.desistir = 0;
      continue;
    }
    c.prog = 0;
    c.reviver = null;

    // desistir (agachado)
    if (p.isSneaking) {
      c.desistir += 5;
      if (c.desistir >= CFG.TEMPO_DESISTIR * 20) {
        c.desistir = 0;
        desistir(p);
        continue;
      }
      barraAcao(p, `§7Desistindo...\n${barra(c.desistir / (CFG.TEMPO_DESISTIR * 20))}`);
    } else {
      c.desistir = 0;
      barraAcao(p, `§cVocê está caído. §7Aguarde um aliado te reanimar.\n§8(segure agachado ${CFG.TEMPO_DESISTIR}s para desistir)`);
    }
  }
}, 1);

/* ------------------------------ GAMERULES ------------------------------ */

if (CFG.AJUSTAR_GAMERULES) {
  system.runTimeout(() => {
    const dim = tentar(() => world.getDimension("overworld"));
    if (!dim) return;
    for (const cmd of ["gamerule keepinventory true", "gamerule doimmediaterespawn true", "gamerule showdeathmessages false"]) {
      tentar(() => kcmd(dim, cmd).catch(() => {}));
    }
  }, 60);
}
