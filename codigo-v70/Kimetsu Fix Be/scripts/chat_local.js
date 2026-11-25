import { world, system } from "@minecraft/server";
import { nomePublico } from "./hybrid_system.js";

/* ---------------------------------------------------------------------
   CHAT LOCAL
   Só ouve a mensagem quem estiver a até DIST_CHAT blocos de quem falou
   (mesma dimensão). Quem falou sempre vê a própria mensagem.
--------------------------------------------------------------------- */

const CFG = {
  DIST_CHAT: 20, // distância máxima (blocos) para ouvir
  AVISAR_SOZINHO: true, // avisa quem falou quando ninguém por perto ouviu
  DEBUG: false, // true = mostra "ativo" no chat ao entrar no mundo (erros sempre aparecem)
};

function aviso(msg) {
  system.runTimeout(() => {
    try {
      world.sendMessage(msg);
    } catch {}
  }, 200);
}

function aoFalar(ev) {
  const remetente = ev.sender;
  const texto = ev.message;
  const nome = nomePublico(remetente);
  const idRem = remetente.id;

  // lê as posições agora (dentro do evento) e só envia depois
  let ouvintes = [];
  try {
    const origem = remetente.location;
    const dim = remetente.dimension.id;
    for (const p of world.getPlayers()) {
      if (p.id === idRem || p.dimension.id !== dim) continue;
      const l = p.location;
      if (Math.hypot(l.x - origem.x, l.y - origem.y, l.z - origem.z) <= CFG.DIST_CHAT) ouvintes.push(p);
    }
  } catch (e) {
    ouvintes = [];
  }

  ev.cancel = true; // cancela o chat global

  system.run(() => {
    try {
      for (const p of ouvintes) p.sendMessage(`<${nome}> ${texto}`);
      remetente.sendMessage(`<${nome}> ${texto}`);
      if (CFG.AVISAR_SOZINHO && ouvintes.length === 0) remetente.sendMessage("§8(ninguém por perto ouviu)");
    } catch (e) {
      world.sendMessage("§c[Chat local] erro ao enviar: " + e);
    }
  });
}

let ativo = false;
let erro = "";
try {
  const sinal = world.beforeEvents?.chatSend;
  if (!sinal) {
    erro = "world.beforeEvents.chatSend não existe nesta versão da API";
  } else {
    sinal.subscribe(aoFalar);
    ativo = true;
  }
} catch (e) {
  erro = String(e);
}

if (ativo) {
  if (CFG.DEBUG) aviso("§a[Chat local] ativo (alcance: " + CFG.DIST_CHAT + " blocos)");
} else {
  aviso("§c[Chat local] não foi possível ativar: " + erro);
}
