import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { RESP_H_ID } from "./hybrid_config.js";
import { dominioHumano, registrarAula } from "./hybrid_mastery.js";
import { guardarPersonagem, identificador } from "./hybrid_records.js";
import { getTrueRace, racaHibrida } from "./hybrid_system.js";
import { disponiveis, getScore, patenteDe, pontuar } from "./stats.js";
import { HIBRIDO_SUPERIOR, OBJ_LIDER, ONI } from "./stats_config.js";

const log = (text) => console.warn("[HIBRIDOS-TESTE] " + text);
const espera = (ticks) => system.waitTicks(ticks);
const eq = (a, b, msg) => { if (a !== b) throw new Error(msg + " (" + a + " != " + b + ")"); };
const forms = new WeakMap();
const planos = new Map();
const jogadores = [];
const semCor = (texto) => texto.replace(/§./g, "");

function simularCliques() {
  for (const chave of ["title", "button", "body"]) {
    const metodo = ActionFormData.prototype[chave];
    ActionFormData.prototype[chave] = function (texto, ...args) {
      const dados = forms.get(this) ?? { buttons: [] };
      forms.set(this, dados);
      if (chave === "button") dados.buttons.push(semCor(texto));
      else dados[chave] = semCor(texto);
      return metodo.call(this, texto, ...args);
    };
  }
  const show = ActionFormData.prototype.show;
  ActionFormData.prototype.show = function (p) {
    const plano = planos.get(p.id);
    if (!plano) return show.call(this, p);
    const f = forms.get(this);
    plano.abertos.push(f);
    const texto = plano.cliques.shift();
    if (texto === undefined) return Promise.resolve({ canceled: true, cancelationReason: "UserClosed" });
    const selection = f.buttons.findIndex((botao) => botao.includes(texto));
    if (selection < 0) throw new Error("Botão " + texto + " ausente em " + f.title);
    return Promise.resolve({ canceled: false, selection });
  };
}

function cacador(nome) {
  const dimension = world.getDimension("overworld");
  const pos = { x: 52.5, y: 210, z: 58.5 + jogadores.length };
  const p = spawnSimulatedPlayer({ ...pos, dimension }, nome, GameMode.Survival);
  jogadores.push(p);
  p.runCommand("fill 49 209 55 56 209 68 stone");
  p.teleport(pos);
  p.addTag("slayer");
  p.addTag("kny_escolheu");
  pontuar(p, "upslayer", 120);
  planos.set(p.id, { cliques: [], abertos: [] });
  return p;
}

const mochila = (p) => p.getComponent("minecraft:inventory").container;
const item = (p, id, slot = 0, quantidade = 1) => mochila(p).setItem(slot, new ItemStack(id, quantidade));
const dosesNaMao = (p) => mochila(p).getItem(0)?.amount ?? 0;

async function usa(p, ticks = 10) {
  await espera(2);
  eq(p.useItemInSlot(0), true, "Uso nativo do item");
  await espera(ticks);
  p.stopUsingItem();
  await espera(3);
}

function aprender(p, professor, id, slot) {
  const r = RESP_H_ID.get(id);
  item(p, r.item, slot);
  for (let i = 1; i <= r.formas.length; i++) eq(registrarAula(professor, p, id, i), true, "Aula " + id + " " + i);
}

async function testar() {
  simularCliques();
  const dim = world.getDimension("overworld");
  dim.runCommand("time set midnight");
  dim.runCommand("gamerule dodaylightcycle false");
  dim.runCommand("gamerule domobspawning false");
  const lider = cacador("LiderV73");
  lider.addTag("hashira");
  lider.addTag("hashira_lider");
  const titulares = world.scoreboard.getObjective(OBJ_LIDER) ?? world.scoreboard.addObjective(OBJ_LIDER);
  for (const anterior of titulares.getParticipants()) titulares.removeParticipant(anterior);
  titulares.setScore(lider.name, 1);

  const hashira = cacador("HashiraV73");
  hashira.addTag("hashira");
  await espera(41);
  eq(getScore(hashira, "kf_water"), 10, "Patente libera formas via script original");
  eq(dominioHumano(hashira, "water"), 0, "Patente não cria aulas");
  item(hashira, "kny:blood", 0, 3);
  await usa(hashira, 18);
  eq(planos.get(hashira.id).abertos.length, 1, "Uma tela de aviso por uso");
  eq(planos.get(hashira.id).abertos[0].title, "Transformação em Oni comum", "Previsão na tela");
  eq(getTrueRace(hashira), "cacador", "Fechar o aviso conserva raça humana");
  eq(dosesNaMao(hashira), 3, "Fechar preserva pilha");
  eq(getScore(hashira, "blood"), 0, "Fechar preserva contador");
  planos.get(hashira.id).cliques.push("Beber e virar Oni comum");
  await usa(hashira, 22);
  eq(getTrueRace(hashira), "oni", "Confirmação permite Oni comum");
  eq(patenteDe(hashira), ONI, "Oni comum recebe a patente original");
  eq(dosesNaMao(hashira), 2, "Consome uma unidade mesmo segurando");
  eq(getScore(hashira, "blood"), 1, "Pontua uma dose");
  item(hashira, "kny:cure");
  await usa(hashira);
  eq(getTrueRace(hashira), "cacador", "Antídoto restaura o contrato do Caçador");
  eq(hashira.matches({ families: ["player_demon"] }), false, "Antídoto remove família Oni");
  log("sangue nativo passou por aviso, cancelamento, confirmação, dose única e antídoto");

  const aluno = cacador("AlunoV73");
  lider.teleport({ x: 52.5, y: 210, z: 58.5 });
  item(aluno, RESP_H_ID.get("water").item, 1);
  item(lider, "kny:menu_kimetsu");
  planos.get(lider.id).cliques.push("Ensinar", "Respiração da Água", ...Array(10).fill(aluno.name));
  await usa(lider, 22);
  eq(dominioHumano(aluno, "water"), 10, "Dez aulas gravadas pela interface do Líder");
  eq(getScore(aluno, "kf_water"), 10, "Aulas também liberam o combate");
  item(aluno, "kny:blood");
  await usa(aluno);
  eq(racaHibrida(aluno)?.resp, "water", "Domínio único produz Híbrido pelo sangue sem etapa adicional");
  eq(dosesNaMao(aluno), 0, "Dose consumida pelo Híbrido");
  log("dez aulas pelo menu nativo do Líder resultaram em Híbrido da Água");

  const multi = cacador("MultiV73");
  aprender(multi, lider, "water", 1);
  aprender(multi, lider, "thunder", 2);
  item(multi, "kny:blood", 0, 2);
  planos.get(multi.id).cliques.push("Definir original · Respiração do Trovão");
  await usa(multi, 18);
  eq(planos.get(multi.id).abertos[0].title, "DOMÍNIO HUMANO", "Sangue abre seleção de original");
  eq(getTrueRace(multi), "cacador", "Escolher conserva humano até o próximo uso");
  eq(dosesNaMao(multi), 2, "Escolha conserva dose");
  await usa(multi);
  eq(racaHibrida(multi)?.resp, "thunder", "Segundo uso transforma com Trovão original");
  eq(dosesNaMao(multi), 1, "Exatamente uma dose descontada");
  log("duas respirações comprovadas abriram escolha e preservaram a dose no primeiro uso");

  const legado = cacador("OniAnteriorV72");
  const staff = cacador("StaffV73");
  staff.addTag("kny_op");
  legado.removeTag("slayer");
  legado.addTag("demon");
  legado.addTag("lower5");
  pontuar(legado, "kf_water", 10);
  pontuar(legado, "updemon", 250);
  pontuar(legado, "blood", 4);
  item(legado, "kny:enmu_hand", 1);
  item(legado, "kny:blood", 0, 3);
  const id = identificador(legado);
  guardarPersonagem(legado, { v: 1, id, estado: "ativo", raca: "oni", via: "sangue", doses: 1,
    anterior: { patente: "hashira", honra: 1000, resp: null, formas: 0 } });
  await espera(4);
  const saldo = disponiveis(legado);
  staff.runCommand("scriptevent kny:h_staff recuperar " + id + " water");
  await espera(3);
  eq(getTrueRace(legado), "oni", "Placar sem prova histórica não permite reparo");
  staff.runCommand("scriptevent kny:h_staff recuperar " + id + " water Aulas humanas verificadas nos registros da temporada");
  await espera(10);
  eq(racaHibrida(legado)?.id, id, "Correção reaproveita a ficha v72");
  eq(racaHibrida(legado)?.resp, "water", "Reparo comprovado preserva escola");
  eq(racaHibrida(legado)?.arte, "enmu", "Arte compatível é vinculada");
  eq(patenteDe(legado), HIBRIDO_SUPERIOR, "Recuperação aplica a patente Híbrida");
  eq(legado.hasTag("lower5"), true, "Recuperação preserva histórico de progressão Oni");
  eq(getScore(legado, "updemon"), 250, "Recuperação preserva maldição acumulada");
  eq(getScore(legado, "blood"), 4, "Reparo sem dose adicional");
  eq(dosesNaMao(legado), 3, "Inventário preservado");
  eq(disponiveis(legado), saldo, "Saldo preservado");
  item(legado, "kny:menu_kimetsu");
  await usa(legado);
  const painel = planos.get(legado.id).abertos.at(-1);
  eq(painel.title.includes("PAINEL DO HÍBRIDO"), true, "Painel do Híbrido via uso nativo do livro");
  eq(painel.buttons[0].includes("Posição: Híbrido Superior"), true, "Posição do painel atualizada");
  eq(painel.buttons.some((botao) => /Força\s+0\/68/.test(botao)), true, "Teto exibido no painel");
  log("ficha v72 recuperada ganhou patente e painel novos com saldo e sangue preservados");

  for (const p of jogadores) p.disconnect();
  log("FIM TRANSFORMAÇÃO V74");
}

system.runTimeout(() => testar().catch((e) => log("FALHA " + e + "\n" + (e.stack ?? ""))), 40);
