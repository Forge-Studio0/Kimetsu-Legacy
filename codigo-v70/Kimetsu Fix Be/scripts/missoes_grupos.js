import { system, world } from "@minecraft/server";
import { identificador, idExistente } from "./hybrid_records.js";
import { REGRAS_MISSAO } from "./missoes_catalogo.js";

const grupos = new Map();
const porJogador = new Map();
const convites = new Map();

export function grupoDe(p) {
  return grupos.get(porJogador.get(idExistente(p)));
}

export function criarGrupo(p) {
  const atual = grupoDe(p);
  if (atual) return atual;
  const id = identificador(p);
  const g = { lider: id, membros: new Map([[id, p.name]]) };
  grupos.set(id, g);
  porJogador.set(id, id);
  return g;
}

export const liderDoGrupo = (p, g) => !!g && idExistente(p) === g.lider;
export const jogadoresDoGrupo = (g) => world.getPlayers().filter((p) => g.membros.has(idExistente(p)));

export function convitePendente(p) {
  const convite = convites.get(idExistente(p));
  const g = convite && grupos.get(convite.grupo);
  if (g && convite.ate > Date.now() && !g.sessao) return convite;
  return undefined;
}

export function convidar(p, q) {
  const g = grupoDe(p);
  if (!liderDoGrupo(p, g) || g.sessao || g.membros.size >= REGRAS_MISSAO.grupoMaximo) return "O grupo não pode receber integrantes.";
  if (!q?.isValid || p.id === q.id || grupoDe(q) || convitePendente(q)) return "O jogador está indisponível para convite.";
  const id = identificador(q);
  convites.set(id, { grupo: g.lider, nome: p.name, ate: Date.now() + REGRAS_MISSAO.conviteMs });
  q.sendMessage(`§e[Missões] ${p.name} convidou você. Responda em Missões → Grupo.`);
  return undefined;
}

export function responderConvite(p, aceitar, convite = convitePendente(p)) {
  if (!convite || convite !== convitePendente(p)) return "O convite expirou ou mudou.";
  const id = idExistente(p);
  convites.delete(id);
  if (!aceitar) return undefined;
  const g = grupos.get(convite.grupo);
  if (grupoDe(p) || g.membros.size >= REGRAS_MISSAO.grupoMaximo) return "O grupo está cheio ou você já está em outro grupo.";
  g.membros.set(id, p.name);
  porJogador.set(id, g.lider);
  for (const q of jogadoresDoGrupo(g)) q.sendMessage(`§a[Missões] ${p.name} aceitou o convite.`);
  return undefined;
}

export function sairDoGrupo(p, alvo = idExistente(p)) {
  const g = grupoDe(p);
  if (!g || g.sessao || !g.membros.has(alvo) || (alvo !== idExistente(p) && !liderDoGrupo(p, g))) return false;
  if (alvo === g.lider) {
    for (const id of g.membros.keys()) porJogador.delete(id);
    grupos.delete(g.lider);
  } else {
    g.membros.delete(alvo);
    porJogador.delete(alvo);
  }
  return true;
}

export function grupoDeSessao(membros) {
  const g = grupos.get(membros);
  return g;
}

system.runInterval(() => {
  for (const [id, c] of convites) if (c.ate <= Date.now() || !grupos.has(c.grupo)) convites.delete(id);
  const online = new Set(world.getPlayers().map(idExistente));
  for (const [id, g] of grupos) {
    if (g.sessao || online.has(id)) {
      g.ausenteDesde = undefined;
      continue;
    }
    g.ausenteDesde ??= Date.now();
    if (Date.now() - g.ausenteDesde < REGRAS_MISSAO.desconexaoMs) continue;
    for (const membro of g.membros.keys()) porJogador.delete(membro);
    grupos.delete(id);
  }
}, 100);
