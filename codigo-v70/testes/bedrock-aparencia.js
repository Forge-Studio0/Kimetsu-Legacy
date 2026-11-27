import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import {
  CHAVE_VISUAL, definirVisual, iniciarEdicao, lerAparencia, rascunho, salvarEdicao, sessaoAtual,
  trocarPerfil, atualizarPersonagem,
} from "./character_system.js";
import { atualizarCamera } from "./character_camera.js";
import { codificarVisual, PROP_APARENCIA, PROP_RASCUNHO } from "./character_config.js";
import { espelharHibrido, getPublicIdentity, trocarDisfarce } from "./hybrid_system.js";
import { guardarPersonagem, identificador } from "./hybrid_records.js";
import { getScore } from "./stats.js";
import { H } from "./hybrid_config.js";

const CAM = "kny:aparencia_camera";
const CHECKPOINT = "kny:teste_v76_ficha";
const log = (s) => console.warn("KNY-TEST APARÊNCIA " + s);
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => ok(a === b, msg + " (" + a + " × " + b + ")");
const lerCanais = (p, props) => props.map((k) => p.getProperty(k)).join(",");
const wait = (n = 1) => system.waitTicks(n);
const planos = new Map();

function formularios() {
  const telas = new WeakMap();
  const title = ActionFormData.prototype.title;
  const button = ActionFormData.prototype.button;
  const show = ActionFormData.prototype.show;
  ActionFormData.prototype.title = function (t) {
    telas.set(this, { t, botoes: [] });
    return title.call(this, t);
  };
  ActionFormData.prototype.button = function (t, ...args) {
    telas.get(this)?.botoes.push(t.replace(/§./g, ""));
    return button.call(this, t, ...args);
  };
  ActionFormData.prototype.show = function (p) {
    const plano = planos.get(p.id);
    if (!plano) return show.call(this, p);
    const { t, botoes } = telas.get(this);
    plano.telas.push(t);
    const objetivo = plano.acoes.shift();
    const selection = botoes.findIndex((b) => b.includes(objetivo ?? "###"));
    if (objetivo) ok(selection >= 0, objetivo + " ausente em " + t);
    if (selection >= 0) return Promise.resolve({ canceled: false, selection });
    return Promise.resolve({ canceled: true, cancelationReason: "UserClosed" });
  };
}

async function spawn(nome, x) {
  const dimension = world.getDimension("overworld");
  const posicao = { x: x + 0.5, y: 210, z: 134.5 };
  const p = spawnSimulatedPlayer({ ...posicao, dimension }, nome, GameMode.Survival);
  p.teleport(posicao, { dimension, rotation: { x: 0, y: 0 } });
  for (let i = 0; i < 30 && !p.hasTag("start"); i++) await wait(2);
  ok(p.hasTag("start"), "jogador inicializado");
  for (let i = 0; i < 20; i++) {
    await wait(3);
    if (dimension.getBlock({ x, y: 209, z: 134 })?.typeId === "minecraft:stone") break;
    p.runCommand("fill 128 209 128 143 209 143 minecraft:stone");
  }
  eq(dimension.getBlock({ x, y: 209, z: 134 })?.typeId, "minecraft:stone", "piso carregado");
  p.teleport(posicao, { rotation: { x: 0, y: 0 } });
  await wait(6);
  ok(Math.abs(p.location.y - 210) < 0.2 && p.isOnGround, "jogador sobre o piso");
  return p;
}

async function usarMenu(p, acoes) {
  const plano = { acoes: [...acoes], telas: [] };
  planos.set(p.id, plano);
  const slot = p.selectedSlotIndex;
  p.getComponent("minecraft:inventory").container.setItem(slot, new ItemStack("kny:menu_kimetsu", 1));
  await wait(3);
  ok(p.useItemInSlot(slot), "uso nativo do Menu Kimetsu");
  await wait(4);
  p.stopUsingItem();
  await wait(18);
  eq(plano.acoes.length, 0, "ações de formulário concluídas");
  eq(p.getComponent("minecraft:inventory").container.getItem(slot)?.typeId, "kny:menu_kimetsu", "item do menu foi preservado");
  return plano.telas;
}

async function run() {
  const dim = world.getDimension("overworld");
  dim.runCommand("time set midnight");
  dim.runCommand("gamerule dodaylightcycle false");
  dim.runCommand("gamerule domobspawning false");
  dim.runCommand("gamerule naturalregeneration false");
  const checkpoint = world.getDynamicProperty(CHECKPOINT);
  if (checkpoint) {
    const p = await spawn("AparenciaReinicio", 131);
    p.setDynamicProperty(CHAVE_VISUAL, checkpoint);
    p.setDynamicProperty(CAM, true);
    atualizarPersonagem(p, true);
    await wait(3);
    eq(lerAparencia(p).perfis.base.cabelo, "corte_curto", "leitura de checkpoint após reiniciar");
    eq(lerCanais(p, PROP_APARENCIA), codificarVisual(lerAparencia(p).perfis.base).join(","), "render confirmado reaplicado");
    eq(p.getDynamicProperty(CAM), undefined, "restauração de câmera interrompida");
    eq(lerCanais(p, PROP_RASCUNHO), "-1,-1,-1", "sem rascunho após reinício");
    p.disconnect();
    log("REINÍCIO OK (checkpoint real do mundo e reaplicação da ficha)");
    return;
  }

  formularios();
  const a = await spawn("AparenciaVisita", 131);
  const b = await spawn("AparenciaHibrido", 138);
  const telas = await usarMenu(a, ["Customizar personagem", "Cabelo", "Cor principal", "Próximo", "Girar ›", "Aproximar", "Corpo", "SALVAR"]);
  ok(telas[0].startsWith("kny_ctr|") && telas[1].startsWith("kny_edit|"), "entrada pelo menu do humano");
  const salvo = a.getDynamicProperty(CHAVE_VISUAL);
  eq(lerAparencia(a).perfis.base.cabelo, "corte_curto", "modelo escolhido");
  eq(lerAparencia(a).perfis.base.corCabelo, "castanha", "cor escolhida");
  eq(a.hasTag("slayer"), false, "cosmético não muda a raça");
  eq(a.getDynamicProperty(CAM), undefined, "câmera restaurada pelo salvamento");
  eq(lerCanais(a, PROP_RASCUNHO), "-1,-1,-1", "rascunho removido pelo salvamento");
  log("item nativo, entrada sem contrato, categoria, seletor, rotação, zoom e confirmação");

  a.addTag("kny_cfg_classico");
  const classico = await usarMenu(a, ["Customizar personagem", "Vestimentas", "Próximo", "Cancelar"]);
  eq(classico[1], "§6OFICINA DE PERSONAGEM", "entrada pelo formulário clássico");
  eq(a.getDynamicProperty(CHAVE_VISUAL), salvo, "cancelar manteve a ficha");
  a.removeTag("kny_cfg_classico");
  const s1 = iniciarEdicao(a);
  ok(atualizarCamera(s1, { modo: "rosto", angulo: 120, zoom: -3 }), "API de câmera no rosto");
  ok(definirVisual(s1, { roupa: "kimono", pele: "ebano", rosto: "seria", olhos: "amplos" }), "rascunho na API");
  const d = { v: 1, id: identificador(b), estado: "ativo", raca: "hibrido", resp: "water", formas: 10, arte: "enmu", publico: "cacador" };
  guardarPersonagem(b, d);
  espelharHibrido(b, d);
  await wait(4);
  const s2 = iniciarEdicao(b);
  eq(definirVisual(s2, { demonio: "chifres" }), false, "disfarce Caçador sem chifres");
  eq(definirVisual(s2, { cabeca: "adorno_festival" }), false, "concessão obrigatória");
  ok(definirVisual(s2, { roupa: "hakama", brincos: "gotas" }), "cosméticos do disfarce Caçador");
  ok(trocarPerfil(s2, "oni"), "troca temporária para editar perfil Oni");
  ok(definirVisual(s2, { demonio: "chifres", cabeca: "faixa" }), "cosmético Oni");
  eq(rascunho(s2).cabeca, "nenhum", "colisão de acessórios resolvida");
  await wait(3);
  eq(lerCanais(b, PROP_RASCUNHO), codificarVisual(rascunho(s2)).join(","), "propriedades nativas do rascunho");
  ok(lerCanais(a, PROP_RASCUNHO) !== lerCanais(b, PROP_RASCUNHO), "rascunhos independentes");
  ok(lerCanais(a, PROP_RASCUNHO) !== lerCanais(a, PROP_APARENCIA), "rascunho e ficha separados");
  const hp = a.getComponent("minecraft:health");
  const vida = hp.currentValue;
  ok(a.applyDamage(1, { cause: "override" }), "dano no jogador em edição");
  await wait(3);
  eq(sessaoAtual(a), undefined, "dano fecha a sessão de quem recebeu");
  eq(a.getDynamicProperty(CAM), undefined, "dano restaura a câmera");
  eq(lerCanais(a, PROP_RASCUNHO), "-1,-1,-1", "dano descarta rascunho");
  eq(a.getDynamicProperty(CHAVE_VISUAL), salvo, "dano preserva ficha");
  ok(hp.currentValue < vida, "sem imunidade por editar");
  eq(sessaoAtual(b), s2, "sessão do outro jogador continua");
  eq(b.getDynamicProperty(CAM), true, "câmera do outro jogador continua");
  const pontos = getScore(b, "kny_pts");
  ok(salvarEdicao(s2), "confirmação híbrida");
  await wait(3);
  eq(getScore(b, "kny_pts"), pontos, "saldo dos Stats preservado");
  eq(getPublicIdentity(b), "cacador", "salvar perfil Oni mantém o disfarce");
  eq(lerCanais(b, PROP_APARENCIA), codificarVisual(lerAparencia(b).perfis.cacador).join(","), "perfil público restaurado depois de salvar");
  trocarDisfarce(b, "oni");
  await wait(4);
  eq(getPublicIdentity(b), "oni", "disfarce legítimo");
  eq(lerCanais(b, PROP_APARENCIA), codificarVisual(lerAparencia(b).perfis.oni).join(","), "perfil acompanha a troca legítima");
  log("dois jogadores, isolamento da sessão, danos, Stats e perfis Híbridos");

  a.addTag("kny_finalizando");
  let bloqueado = false;
  try { iniciarEdicao(a); }
  catch { bloqueado = true; }
  eq(bloqueado, true, "finalização bloqueia abertura");
  a.removeTag("kny_finalizando");
  a.runCommand('scriptevent kny:aparencia autorizar_nome "AparenciaVisita" sim');
  await wait(3);
  eq(lerAparencia(a).autorizarNome, false, "sem permissão de Staff");
  a.addTag("kny_op");
  a.runCommand('scriptevent kny:aparencia autorizar_nome "AparenciaVisita" sim');
  await wait(3);
  eq(lerAparencia(a).autorizarNome, true, "comando autorizado");

  const s3 = iniciarEdicao(b);
  definirVisual(s3, { cabelo: "coque" });
  b.teleport({ x: 141.5, y: 210, z: 134.5 });
  await wait(5);
  eq(sessaoAtual(b), undefined, "teletransporte fecha edição");
  eq(b.getDynamicProperty(CAM), undefined, "teletransporte restaura câmera");
  eq(lerAparencia(b).perfis.oni.cabelo, "nenhum", "teletransporte descarta cabelo de teste");

  const s4 = iniciarEdicao(b);
  definirVisual(s4, { cabelo: "ondas" });
  const nether = world.getDimension("nether");
  b.teleport({ x: 8, y: 115, z: 8 }, { dimension: nether });
  await wait(4);
  eq(b.dimension.id, "minecraft:nether", "teletransporte entre dimensões");
  eq(sessaoAtual(b), undefined, "troca de dimensão fecha edição");
  eq(lerCanais(b, PROP_RASCUNHO), "-1,-1,-1", "troca de dimensão descarta rascunho");
  eq(b.getDynamicProperty(CAM), undefined, "troca de dimensão restaura câmera");
  b.disconnect();
  log("permissões de Staff, teletransporte e troca de dimensão");

  await wait(Math.ceil(H.combateMs / 50) + 5);
  const nova = iniciarEdicao(a);
  definirVisual(nova, { cabelo: "longo" });
  a.disconnect();
  await wait(4);
  eq(sessaoAtual(a), undefined, "desconexão libera sessão");
  const voltou = await spawn("AparenciaVisita", 131);
  eq(lerCanais(voltou, PROP_RASCUNHO), "-1,-1,-1", "reconexão limpa rascunho");
  if (voltou.getDynamicProperty(CHAVE_VISUAL)) {
    eq(lerAparencia(voltou).perfis.base.cabelo, "corte_curto", "reconexão mantém visual confirmado");
    log("reconexão nativa com dados do mesmo jogador");
  } else log("jogador simulado recriado na reconexão");
  voltou.disconnect();
  world.setDynamicProperty(CHECKPOINT, salvo);
  log("FIM");
}

system.runTimeout(() => {
  run().catch((e) => console.error("KNY-TEST FALHA APARÊNCIA " + e + "\n" + (e.stack ?? "")));
}, 35);
