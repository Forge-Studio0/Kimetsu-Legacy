import { modoDeJogo } from "./compat.js";
import { world, system } from "@minecraft/server";
import { staminaDe, folegoDe, pontuar, lerBruto, getScore } from "./stats.js";

/* =====================================================================
   PAINEL DE STATUS NA TELA (ao lado esquerdo da hotbar)
   - Vida:     vida atual / vida máxima (inclui bônus de vida do addon)
   - Fôlego:   "chakra" das respirações. Cada forma gasta fôlego; zerou, não dá
               para usar respirações até agachar para recarregar.
   - Stamina:  gasta correndo e lutando (sistema do menu.js).
   O texto do painel viaja no título, após o prefixo "HP<vida>" reservado
   pelo formato do HUD. O visual está em hud_screen.json (resource pack),
   controle "kny_painel".
===================================================================== */

// ----- ajustes de equilíbrio (mexa aqui) -----
const OBJ_FOLEGO = "kny_folego";
const FOLEGO_CUSTO_FORMA = 10; // precisa ser igual ao valor usado nos animation_controllers
const FOLEGO_RECARGA_AGACHADO = 0.02; // fração do máximo recuperada a cada 5 ticks agachado (0.02 = vazio→cheio em ~12 s; 0.05 era ~5 s)
const FOLEGO_REGEN_PASSIVO = 0; // fôlego recuperado por segundo em pé (0 = só recarrega agachando)
const CICLO = 5; // ticks entre atualizações
const REENVIO = 40; // reenvia o painel a cada 2 s mesmo sem mudança (garante que continue na tela)
const VERSAO = "1.0.68";
const avisouInicio = new Set();

const ultimoTitulo = new Map(); // só para diagnóstico: /scriptevent kny:painel
const ultimoEnvio = new Map(); // playerId -> { hp, texto, tick }
const avisouSemFolego = new Set();

world.afterEvents.playerLeave.subscribe((ev) => {
  ultimoTitulo.delete(ev.playerId);
  ultimoEnvio.delete(ev.playerId);
  avisouSemFolego.delete(ev.playerId);
  avisouInicio.delete(ev.playerId);
});

const pad3 = (n) => String(Math.max(0, Math.min(999, Math.floor(n)))).padStart(3, "0");
// porcentagem em passos de 2% (o resource pack tem uma barra para cada passo)
function passo(atual, max) {
  if (atual <= 0) return 0;
  const pct = Math.round(((atual / Math.max(1, max)) * 100) / 2) * 2;
  return Math.max(2, Math.min(100, pct));
}
// Números: cada dígito vira um código "<letra><posição><dígito>" que o resource pack desenha.
// letra A = vida, B = fôlego, C = stamina. Posição 0-3 = dígitos do valor atual (0 = unidade),
// posição 4-7 = dígitos do máximo (4 = primeiro dígito).
function digitos(letra, atual, max, casas) {
  const lim = 10 ** casas - 1;
  const a = String(Math.max(0, Math.min(lim, Math.floor(Number.isFinite(atual) ? atual : 0))));
  const m = String(Math.max(0, Math.min(lim, Math.floor(Number.isFinite(max) ? max : 0))));
  let t = "";
  for (let i = 0; i < a.length; i++) t += letra + i + a[a.length - 1 - i];
  for (let j = 0; j < m.length; j++) t += letra + (4 + j) + m[j];
  return t;
}

function garantirObjetivo() {
  try {
    if (!world.scoreboard.getObjective(OBJ_FOLEGO)) world.scoreboard.addObjective(OBJ_FOLEGO, OBJ_FOLEGO);
  } catch {}
}

function cicloJogador(p) {
  if (!avisouInicio.has(p.id)) {
    avisouInicio.add(p.id);
    p.sendMessage(`§7[Kimetsu] Painel de status ${VERSAO} carregado.`);
  }
  if (p.hasTag("animacao")) return;

  const modo = modoDeJogo(p);
  const fol = folegoDe(p);
  let folego = fol.atual;

  // ---------- fôlego ----------
  if (lerBruto(p, OBJ_FOLEGO) === undefined) {
    pontuar(p, OBJ_FOLEGO, fol.max);
    folego = fol.max;
  }
  if (modo === "spectator") {
    // espectador não usa fôlego: fica sempre cheio
    if (getScore(p, OBJ_FOLEGO) !== fol.max) pontuar(p, OBJ_FOLEGO, fol.max);
    folego = fol.max;
  } else {
    let novo = folego;
    if (p.isSneaking) novo = Math.min(fol.max, folego + Math.max(2, Math.ceil(fol.max * FOLEGO_RECARGA_AGACHADO)));
    else if (FOLEGO_REGEN_PASSIVO > 0 && folego > 0) novo = Math.min(fol.max, folego + (FOLEGO_REGEN_PASSIVO * CICLO) / 20);
    novo = Math.floor(novo);
    if (novo !== getScore(p, OBJ_FOLEGO)) pontuar(p, OBJ_FOLEGO, novo);

    if (novo > folego && novo >= fol.max) {
      try {
        p.playSound("random.orb", { pitch: 1.6, volume: 0.35 });
      } catch {}
    }
    folego = novo;

    if (folego < FOLEGO_CUSTO_FORMA) {
      if (!avisouSemFolego.has(p.id)) {
        avisouSemFolego.add(p.id);
        p.sendMessage("§cVocê ficou sem fôlego! §7Agache para recarregar.");
      }
    } else {
      avisouSemFolego.delete(p.id);
    }
  }

  // ---------- dados do painel ----------
  // Formato fixo (o resource pack lê por posição):
  //   Q  V###  F###  S###  X?  Y?  W###  D?  dígitos...
  // V/F/S = porcentagem (passos de 2), W = cópia de L, X1 = exausto, Y1 = sem fôlego, D1 = modo diagnóstico (/tag @s add kny_debug)
  let corpo = "";
  if (modo !== "spectator") {
    const h = p.getComponent("minecraft:health");
    const sta = staminaDe(p);
    const exausto = getScore(p, "kny_exausto") === 1;
    let vidaAtual = h ? Math.ceil(h.currentValue) : 0;
    let vidaMax = h ? Math.ceil(h.effectiveMax) : 20;
    if (!Number.isFinite(vidaAtual)) vidaAtual = 0;
    if (!Number.isFinite(vidaMax) || vidaMax < 1) vidaMax = Math.max(1, vidaAtual);
    const pv = pad3(passo(vidaAtual, vidaMax));
    corpo =
      "Q" +
      "V" + pv +
      "F" + pad3(passo(folego, fol.max)) +
      "S" + pad3(passo(sta.atual, sta.max)) +
      "X" + (exausto ? 1 : 0) +
      "Y" + (folego < FOLEGO_CUSTO_FORMA ? 1 : 0) +
      "W" + pv + // segundo código da vida (reserva)
      (p.hasTag("kny_debug") ? "D1" : "D0") +
      digitos("A", vidaAtual, vidaMax, 4) +
      digitos("B", folego, fol.max, 3) +
      digitos("C", sta.atual, sta.max, 3);
  }
  const texto = corpo;

  // Mantém o prefixo do título com cinco caracteres.
  let hp = 0;
  const h2 = p.getComponent("minecraft:health");
  if (modo !== "creative" && h2) hp = Math.min(100, Math.floor(h2.currentValue));
  enviar(p, hp, texto);
}

function enviar(p, hp, texto) {
  const agora = system.currentTick;
  const u = ultimoEnvio.get(p.id);
  if (u && u.hp === hp && u.texto === texto && agora - u.tick < REENVIO) return;
  ultimoEnvio.set(p.id, { hp, texto, tick: agora });
  // Título = "HP<vida>" preenchido com espaços até 5 caracteres + texto do painel.
  // O painel lê os dados depois dos 5 primeiros caracteres.
  const titulo = ("HP" + hp).padEnd(5, " ") + texto;
  ultimoTitulo.set(p.id, titulo);
  try {
    p.onScreenDisplay.setTitle(titulo, { fadeInDuration: 0, stayDuration: 100, fadeOutDuration: 0 });
  } catch {
    p.onScreenDisplay.setTitle(titulo);
  }
}

system.runInterval(() => {
  garantirObjetivo();
  for (const p of world.getPlayers()) {
    try {
      cicloJogador(p);
    } catch {}
  }
}, CICLO);

// diagnóstico: digite /scriptevent kny:painel para ver no chat o texto enviado ao painel
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "kny:painel" || ev.sourceType !== "Entity" || !ev.sourceEntity) return;
  const t = ultimoTitulo.get(ev.sourceEntity.id);
  ev.sourceEntity.sendMessage(`§7[painel] §f${t === undefined ? "(nada enviado ainda)" : t.replaceAll(" ", "·")}`);
});
