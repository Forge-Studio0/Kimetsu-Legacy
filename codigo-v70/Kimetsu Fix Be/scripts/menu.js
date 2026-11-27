import { kcmd, knockback } from "./compat.js";
import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { RESPIRACOES, KEKKIJUTSUS, ITEM_OBJ } from "./menu_data.js";
import { H, ARTE_H_ID, DOMINAVEL, RESP_H_ID, ROTULOS } from "./hybrid_config.js";
import {
  DISTANCIA_AULA, dominioHumano, ehCacadorHumano, formasLiberadas, podeTreinarRespiracao, progressoDominio, registrarAula,
  registrarTreinoRespiracao, requisitosProximaForma, selecionarOriginal,
} from "./hybrid_mastery.js";
import { limparTreinosDaForma, textoTreinoDaForma } from "./treino_respiracao.js";
import { abrirEditor, ICONE_EDITOR } from "./character_editor.js";
import "./character_admin.js";
import { canUseBreathing, canUseKekkijutsu, doseEmMaos, ehStaff, estadoBloqueado, isHybrid, preverTransformacao, racaHibrida, transformar, trocarDisfarce } from "./hybrid_system.js";
import { ativarHabilidade, danoEspecialEmCurso, habilidadeDe } from "./hybrid_abilities.js";
import { canAccessLocation, configurarLocal, locais, viajar } from "./hybrid_locations.js";
import {
  ATRIBUTOS, ATR, ONI, HIBRIDO_SUPERIOR, REI_ONI, RANKS_CACADOR, RANKS_ONI, OBJ_REI, OBJ_LIDER, REPS_POR_PONTO, TAPAS_POR_PONTO,
  NIVEL_MAXIMO, SERIES_POR_MELHORIA, CREDITO_POR_SERIE, PONTOS_POR_ONI,
  efeitoForca, efeitoPoder, bonusVida, reducaoDefesa, staminaMax, folegoMax,
} from "./stats_config.js";
import {
  isOni, getScore, lerBruto, pontuar, titularDe as titularStats, patenteDe, agendarStats,
  atualizarStats, registrarRankAdministrativo, efetivo, efetivos, statusAtributo,
  disponiveis, comprar, resetarAtributos, chaveRedistribuicao, registrarRepeticao, premiarOni, staminaDe, folegoDe,
} from "./stats.js";

/* =====================================================================
   MENU KIMETSU  —  tema vermelho e preto
   - Caçador de demônios: menu "Caçador"
   - Oni (tag "demon"):   menu "Oni" (visual, textos e conteúdo próprios)
   Abra com o item "Menu Kimetsu" (clique direito).
===================================================================== */

const MENU_ITEM = "kny:menu_kimetsu";
const TAG_DICA_OFF = "kny_cfg_dica_off"; // barra de ação desligada
const TAG_SOM_OFF = "kny_cfg_som_off";   // sons do menu desligados
const TAG_CLASSICO = "kny_cfg_classico";

/* ---------------------------------------------------------------------
   Utilidades
--------------------------------------------------------------------- */

const wait = (ticks) => new Promise((res) => system.runTimeout(res, ticks));

// Mostra o formulário e tenta de novo se o jogador estiver com outra tela aberta.
async function mostrar(form, player) {
  for (let i = 0; i < 12 && player.isValid; i++) {
    const r = await form.show(player);
    if (r.cancelationReason !== "UserBusy") return r;
    if (i === 11) {
      if (player.isValid) player.sendMessage("§c[Menu Kimetsu] Feche o chat ou a outra tela e use o item novamente.");
      return r;
    }
    await wait(10);
  }
  return { canceled: true, cancelationReason: "UserClosed" };
}

function som(player, id, pitch = 1, volume = 0.6) {
  if (player.hasTag(TAG_SOM_OFF)) return;
  try {
    player.playSound(id, { pitch, volume });
  } catch {}
}

function barra(atual, total, tam = 20, cor = "§c") {
  const t = Math.max(1, total);
  const cheio = Math.max(0, Math.min(tam, Math.floor((atual / t) * tam)));
  return cor + "|".repeat(cheio) + "§8" + "|".repeat(tam - cheio);
}

function itemNaMao(player) {
  try {
    const eq = player.getComponent("minecraft:equippable");
    if (eq) return eq.getEquipment("Mainhand");
  } catch {}
  try {
    return player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex);
  } catch {}
  return undefined;
}


/* ---------------------------------------------------------------------
   Quebra de linha manual: o Minecraft quebra o texto numa largura maior
   que a área visível e corta o final das linhas, então quebramos antes.
--------------------------------------------------------------------- */

const LARGURA = 27;
const visivel = (t) => t.replace(/§./g, "").length;

function ajustar(texto, largura = LARGURA) {
  const saida = [];
  let cor = "";
  let negrito = false;
  const estado = () => cor + (negrito ? "§l" : "");

  for (const linha of String(texto).split("\n")) {
    const m = linha.match(/^((?:§.)*)( *)/);
    const indent = m[2];
    const resto = linha.slice(m[0].length);
    let atual = m[1] + indent;
    let tam = indent.length;
    let temPalavra = false;

    // os códigos do início da linha também alteram o estado
    for (const c of m[1].matchAll(/§(.)/g)) aplicar(c[1]);

    function aplicar(k) {
      if (k === "r") {
        cor = "";
        negrito = false;
      } else if (k === "l") negrito = true;
      else if (/[0-9a-f]/.test(k)) {
        cor = "§" + k;
        negrito = false;
      }
    }

    for (const palavra of resto.split(" ")) {
      const v = visivel(palavra);
      if (temPalavra && tam + 1 + v > largura) {
        saida.push(atual);
        atual = estado() + indent;
        tam = indent.length;
        temPalavra = false;
      }
      if (temPalavra) {
        atual += " ";
        tam += 1;
      }
      atual += palavra;
      tam += v;
      temPalavra = true;
      for (const c of palavra.matchAll(/§(.)/g)) aplicar(c[1]);
    }
    saida.push(atual);
  }
  return saida.join("\n");
}

// Formulário com quebra automática de linha. Para caçadores, os vermelhos viram azuis (tema azul).
const paraAzul = (t) => String(t).replace(/§c/g, "§9").replace(/§4/g, "§3");

function novoForm(p) {
  const f = new ActionFormData();
  const azul = !!p && !isOni(p);
  const cor = (t) => (azul ? paraAzul(t) : String(t));
  const titulo = f.title.bind(f);
  const corpo = f.body.bind(f);
  const botao = f.button.bind(f);
  f.title = (t) => titulo(cor(t));
  f.body = (t) => corpo(ajustar(cor(t)));
  f.button = (t, icone) => botao(cor(t), icone);
  return f;
}

/* ---------------------------------------------------------------------
   Temas (vermelho e preto) — um para cada lado
--------------------------------------------------------------------- */

const TEMA_CACADOR = {
  titulo: "§l§9MENU DO CAÇADOR",
  linha: "§9==========================",
  destaque: "§9",
  texto: "§f",
  suave: "§7",
  escuro: "§8",
  icones: {
    arte: "textures/icons/menu_breath",
    config: "textures/icons/menu_config",
    personagem: "textures/icons/menu_char",
    comoJogar: "textures/icons/menu_howto",
    missoes: "textures/icons/menu_missions",
    voltar: "textures/icons/menu_back",
    status: "textures/icons/menu_status",
  },
};

const TEMA_ONI = {
  titulo: "§l§4MENU DO ONI",
  linha: "§c==========================",
  destaque: "§4",
  texto: "§c",
  suave: "§8",
  escuro: "§0",
  icones: {
    arte: "textures/icons/menu_oni_art",
    config: "textures/icons/menu_oni_config",
    personagem: "textures/icons/menu_oni_char",
    comoJogar: "textures/icons/menu_oni_howto",
    missoes: "textures/icons/menu_oni_missions",
    voltar: "textures/icons/menu_oni_back",
    status: "textures/icons/menu_oni_status",
  },
};

const tema = (p) => (isOni(p) ? TEMA_ONI : TEMA_CACADOR);

/* ---------------------------------------------------------------------
   Ranks (mesmos tags/pontuações usados em uprank.js)
--------------------------------------------------------------------- */

function infoRank(p) {
  const oni = isOni(p);
  const lista = oni ? RANKS_ONI : RANKS_CACADOR;
  const pontos = getScore(p, oni ? "updemon" : "upslayer");
  const atual = patenteDe(p);
  const prox = atual === HIBRIDO_SUPERIOR ? REI_ONI : lista[lista.indexOf(atual) + 1];
  const de = atual === HIBRIDO_SUPERIOR ? 0 : atual.min;
  const cargo = prox && cargoDoRank(prox.tag);
  const titular = cargo && titularDe(cargo);
  return {
    pontos,
    atual: atual.nome,
    prox: prox ? prox.nome : null,
    faltam: prox ? Math.max(0, prox.min - pontos) : 0,
    progresso: prox ? (pontos - de) / Math.max(1, prox.min - de) : 1,
    ocupado: !!titular && titular !== p.name,
  };
}

const MARCAS = {
  water_mark: "Água",
  wind_mark: "Vento",
  mist_mark: "Névoa",
  love_mark: "Amor",
  moon_mark: "Lua",
  sun_mark: "Sol",
};

/* ---------------------------------------------------------------------
   Item do menu
--------------------------------------------------------------------- */

function temItemMenu(player) {
  try {
    const c = player.getComponent("minecraft:inventory").container;
    for (let i = 0; i < c.size; i++) {
      if (c.getItem(i)?.typeId === MENU_ITEM) return true;
    }
  } catch {}
  return false;
}

function darItemMenu(player) {
  try {
    const item = new ItemStack(MENU_ITEM, 1);
    try {
      item.lockMode = "inventory";
      item.keepOnDeath = true;
    } catch {}
    const sobra = player.getComponent("minecraft:inventory").container.addItem(item);
    if (sobra) player.dimension.spawnItem(sobra, player.location);
    return true;
  } catch {
    return false;
  }
}

world.afterEvents.playerSpawn.subscribe(({ player: p, initialSpawn }) => {
  system.runTimeout(() => {
    if (!p.isValid) return;
    try {
      if (!temItemMenu(p)) darItemMenu(p);
      if (initialSpawn) {
        p.sendMessage("§8[Kimetsu] §cUse o item §lMenu Kimetsu§r§c ou o livro. Agache ao usar para abrir o menu clássico.");
      }
      if (jaEscolheu(p)) {
        if (!p.hasTag(TAG_ESCOLHEU)) p.addTag(TAG_ESCOLHEU); // personagens antigos não precisam escolher
      } else if (initialSpawn) {
        pedirAbertura(p);
      }
    } catch {}
  }, 100);
});

const sessoesMenu = new Map();

function reportar(p, e) {
  try {
    if (p.isValid) p.sendMessage("§c[Menu Kimetsu] Não foi possível abrir esta tela. Agache ao usar o item para tentar o menu clássico.");
  } catch {}
  console.warn("[Menu Kimetsu] " + (e?.stack ?? e));
}

// Uma sessão por jogador, do primeiro formulário até fechar o último submenu.
function abrirSessaoMenu(p, acao) {
  if (!p?.isValid || p.typeId !== "minecraft:player" || sessoesMenu.has(p.id)) return false;
  const id = p.id;
  const sessao = {};
  sessoesMenu.set(id, sessao);
  system.run(async () => {
    try {
      if (!p.isValid || p.hasTag("kny_caido")) return;
      await acao();
    } catch (e) {
      if (p.isValid) reportar(p, e);
    } finally {
      if (sessoesMenu.get(id) === sessao) sessoesMenu.delete(id);
    }
  });
  return true;
}

function pedirAbertura(p, classico = false) {
  abrirSessaoMenu(p, () => {
    if (classico) p.addTag(TAG_CLASSICO);
    return jaEscolheu(p) ? menuPrincipal(p) : escolha(p);
  });
}

// Os dois itens vinculam a própria ação de uso, inclusive no modo de toque.
system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  const aoUsar = ({ source }) => {
    if (source?.typeId === "minecraft:player") pedirAbertura(source, source.isSneaking);
  };
  itemComponentRegistry.registerCustomComponent("kny:abrir_menu", {
    onUse: aoUsar,
    onUseOn: aoUsar,
  });
});

// Diagnóstico de operador e alternativa para voltar à interface clássica.
try {
  system.afterEvents?.scriptEventReceive?.subscribe((ev) => {
    if (ev.id === "kny:menu") pedirAbertura(ev.sourceEntity, ev.message?.trim() === "classico");
    if (ev.id === "kny:h_sangue" && ev.message === "beber") {
      const p = ev.sourceEntity;
      if (!p?.isValid || p.typeId !== "minecraft:player" || sessoesMenu.has(p.id)) return;
      const dose = doseEmMaos(p);
      if (!dose) return p.sendMessage("§cEmpunhe o sangue para usá-lo.");
      abrirSessaoMenu(p, () => usarSangue(p, dose));
    }
  });
} catch (e) {
  console.warn("[Menu Kimetsu] scriptEvent indisponível: " + e);
}


/* ---------------------------------------------------------------------
   APRENDIZADO POR HABILIDADE
   - Cada respiração (e a Respiração Básica das lâminas coloridas) tem várias
     habilidades (formas). Elas são aprendidas UMA POR UMA, em ordem, com um Hashira.
   - kf_<respiração> guarda quantas habilidades estão liberadas.
   - Os controllers do addon só liberam a forma N se kf_<respiração> >= N.
   - A patente Hashira libera as formas para combate. Aulas registram o domínio humano.
   - Requisitos para aprender a habilidade K:
       respirações: espada do estilo, honra por forma anterior e a lista de treinos da próxima forma.
--------------------------------------------------------------------- */

const BASICA = {
  obj: "basica",
  nome: "Respiração Básica",
  item: null,
  basica: true,
  icon: "textures/icons/lamina_cinza",
  formas: ["Corte Básico", "Giro Nichirin", "Estocada Veloz"],
};
const TODAS_RESPIRACOES = [BASICA, ...RESPIRACOES];
const POR_OBJ = {};
for (const g of TODAS_RESPIRACOES) POR_OBJ[g.obj] = g;

const DIST_ENSINO = DISTANCIA_AULA;

const objForma = (g) => "kf_" + g.obj;
const ehHashira = (p) => p.hasTag("hashira") && !isOni(p);

function marcarForma(p, g, k) {
  const nome = objForma(g);
  const obj = world.scoreboard.getObjective(nome) ?? world.scoreboard.addObjective(nome, nome);
  obj.setScore(p, k);
}

function textoProximaAula(p, g) {
  const { k, faltas, treinos, invalido } = requisitosProximaForma(p, g.obj);
  if (invalido) return "§cHistórico de domínio incompatível. Consulte a Staff.\n";
  if (k === 0) return DOMINAVEL(g.obj) ? "§aDomínio completo. Confira a original em Guia → Domínio humano.\n" : "";
  const linhas = [`§7Próxima aula (${k})`];
  for (const falta of faltas) linhas.push("§c" + falta);
  for (const treino of treinos) if (treino.concluido) linhas.push("§a" + textoTreinoDaForma(treino));
  if (faltas.length === 0) linhas.push("§aProcure o Líder dos Hashiras.");
  return linhas.join("\n") + "\n";
}

// cria as pontuações no início do mundo
system.run(() => {
  try {
    for (const g of TODAS_RESPIRACOES) {
      const n = objForma(g);
      if (!world.scoreboard.getObjective(n)) world.scoreboard.addObjective(n, n);
    }
    if (!world.scoreboard.getObjective("kny_dinheiro")) world.scoreboard.addObjective("kny_dinheiro", "Dinheiro");
    if (!world.scoreboard.getObjective("kny_qtd")) world.scoreboard.addObjective("kny_qtd", "kny_qtd");
  } catch (e) {
    console.warn("[Menu Kimetsu] pontuações: " + e);
  }
});

// quem já tinha uma respiração inteira (sistema antigo) mantém todas as habilidades dela
const FAMILIAS_ANTIGAS = {
  agua: ["water", "tomioka", "tanjiro"], chamas: ["flame", "rengoku"], vento: ["wind", "sanemi"],
  nevoa: ["mist", "muichiro"], trovao: ["thunder", "zenitsu", "kaigaku"], sol: ["sun", "yoriichi"],
  lua: ["moon", "kokushibo", "kokushibo2"], amor: ["mitsuri"], inseto: ["shinobu"], fera: ["inosuke"],
  pedra: ["gyomei"], som: ["uzui"], serpente: ["obanai"], flor: ["flower"], morte: ["death"],
};

// Acesso por patente, migração do sistema antigo e seleção inicial da Respiração Básica.
system.runInterval(() => {
  for (const p of world.getPlayers()) {
    try {
      if (lerBruto(p, "kny_mig3") === undefined) {
        for (const [fam, objs] of Object.entries(FAMILIAS_ANTIGAS)) {
          if (getScore(p, "kl_" + fam) < 1) continue;
          for (const o of objs) {
            const g = POR_OBJ[o];
            if (g && getScore(p, objForma(g)) < g.formas.length) marcarForma(p, g, g.formas.length);
          }
        }
        pontuar(p, "kny_mig3", 1);
      }
      if (getScore(p, "kny_bas") < 1) pontuar(p, "kny_bas", 1);
      if (!ehHashira(p)) continue;
      for (const g of TODAS_RESPIRACOES) if (getScore(p, objForma(g)) < g.formas.length) marcarForma(p, g, g.formas.length);
    } catch {}
  }
}, 40);

/* ---------------------------------------------------------------------
   TELA DE ENTRADA: descrição do jogo + contrato de caçador
   (virar oni não é mais uma escolha: só sendo transformado pelo Rei dos Onis)
--------------------------------------------------------------------- */

const TAG_ESCOLHEU = "kny_escolheu"; // contrato assinado

function jaEscolheu(p) {
  return (
    p.hasTag(TAG_ESCOLHEU) ||
    p.hasTag("demon") ||
    p.hasTag("slayer") ||
    p.hasTag("slayer2") ||
    p.hasTag("mizunoto")
  );
}

function textoContrato(nome) {
  const L = "§4==========================";
  return (
    `${L}\n§l§cBEM-VINDO, CAÇADOR§r\n${L}\n` +
    "§7Os oni rondam a noite e devoram humanos. Só a Corporação de Caçadores de Demônios os enfrenta, com espadas Nichirin e as Respirações.\n\n" +
    "§fAqui você vai:\n" +
    "§c- §faprender respirações com os Hashira (Shift troca a forma, segurar usar executa);\n" +
    "§c- §fsubir de rank caçando demônios, de Mizunoto a Hashira;\n" +
    "§c- §fcumprir missões e enfrentar as Luas Inferiores e Superiores.\n\n" +
    `${L}\n§l§cCONTRATO DO CAÇADOR§r\n${L}\n` +
    `§fEu, §c§l${nome}§r§f, declaro que:\n\n` +
    "§c1. §fEmpunharei a espada Nichirin para proteger os humanos.\n" +
    "§c2. §fCaçarei demônios sem recuar diante da noite.\n" +
    "§c3. §fHonrarei a Corporação e meus companheiros.\n" +
    "§c4. §fAceito os perigos desta jornada.\n\n" +
    "§7Assine abaixo para entrar para a Corporação.\n"
  );
}

async function escolha(p) {
  let classico = p.hasTag(TAG_CLASSICO);
  for (let i = 0; i < 2 && p.isValid && !jaEscolheu(p); i++) {
    const f = classico
      ? novoForm(p)
          .title("§l§cKIMETSU NO YAIBA")
          .body(textoContrato(p.name))
          .button("§l§cAssinar o contrato\n§r§7Tornar-se Caçador", "textures/icons/menu_char")
          .button("Customizar personagem", ICONE_EDITOR)
      : new ActionFormData()
          .title(`${MARCA_CTR}§lKIMETSU NO YAIBA`)
          .body(" ")
          .button("T:" + textoContrato(p.name))
          .button("S:§l§aASSINAR O CONTRATO")
          .button("E:Customizar personagem", ICONE_EDITOR);
    const r = await mostrar(f, p);
    if (!p.isValid || jaEscolheu(p)) return;
    if (r.canceled && !classico && r.cancelationReason === undefined) {
      classico = true;
      continue;
    }
    if (!r.canceled && r.selection === (classico ? 0 : 1)) await aplicarEscolha(p);
    if (!r.canceled && r.selection === (classico ? 1 : 2)) await abrirEditor(p, classico);
    return;
  }
}

async function aplicarEscolha(p) {
  // mesmo caminho do addon ao virar caçador (uniforme, Nichirin e rank inicial)
  await kcmd(p, "function start_slayer");
  if (!p.isValid) return;
  p.addTag(TAG_ESCOLHEU);
  p.sendMessage(`§cContrato assinado! Bem-vindo à Corporação, §l${p.name}§r§c.`);
  som(p, "random.levelup", 1.2, 0.7);
}

/* ---------------------------------------------------------------------
   Barra de ação: mostra a forma selecionada (ligável nas configurações)
--------------------------------------------------------------------- */

const GRUPOS = {};
for (const g of [...RESPIRACOES, ...KEKKIJUTSUS]) GRUPOS[g.obj] = g;
GRUPOS[BASICA.obj] = BASICA;

system.runInterval(() => {
  for (const p of world.getPlayers()) {
    try {
      const oni = isOni(p);
      const c1 = oni ? "§4" : "§9";
      const partes = [];

      const it = itemNaMao(p);
      const lamina = it ? LAMINA_POR_ITEM[it.typeId] : undefined;
      const obj = lamina ? "basica" : it ? ITEM_OBJ[it.typeId] : undefined;
      const g = obj ? GRUPOS[obj] : undefined;
      if (g && g.formas.length > 0) {
        const hibrido = racaHibrida(p);
        const respiracao = RESP_H_ID.has(obj);
        if (hibrido && (respiracao ? hibrido.resp !== obj : hibrido.arte !== obj)) {
          if (!p.hasTag(TAG_DICA_OFF)) p.onScreenDisplay.setActionBar(`§c${g.nome} fora do vínculo Híbrido`);
          continue;
        }
        const aprendidas = oni ? g.formas.length : formasLiberadas(p, g);
        if (!oni && aprendidas < 1) {
          p.onScreenDisplay.setActionBar(`§c§l${g.nome} bloqueada§r §8| §7aprenda com um Hashira`);
          continue;
        }
        if (!p.hasTag(TAG_DICA_OFF)) {
          let n = getScore(p, lamina ? "kny_bas" : obj);
          if (n < 1 || n > g.formas.length) n = 1;
          const ok = n <= aprendidas;
          partes.push(`${c1}§l${n}§r§8/${c1}${g.formas.length} §8| ${ok ? (oni ? "§c" : "§f") : "§8"}${g.formas[n - 1]}${ok ? "" : " (não aprendida)"}`);
        }
      }

      if (partes.length) p.onScreenDisplay.setActionBar(partes.join("  §8|  "));
    } catch {}
  }
}, 10);

/* ---------------------------------------------------------------------
   MENU PRINCIPAL
--------------------------------------------------------------------- */

/* ---------------------------------------------------------------------
   PAINEL: menu em dois painéis, no estilo da moldura enviada (padrão)
   A tela é desenhada pelo pacote de recursos (ui/server_form.json).
   Cada botão leva um prefixo que o pacote usa para decidir em qual área aparece:
     I: informações (canto superior esquerdo)   C: texto do painel central
     R: quadrados da direita (navegação)        L: barras da esquerda (melhorar status)
--------------------------------------------------------------------- */

const MARCA_PAINEL = "kny_painel|";

async function painelPrincipal(p) {
  const t = tema(p);
  const oni = isOni(p);
  const hibrido = isHybrid(p);
  atualizarStats(p);
  const sta = staminaDe(p);
  const r = infoRank(p);
  const acoes = [];
  const f = new ActionFormData().title(`${MARCA_PAINEL}§l${hibrido ? "PAINEL DO HÍBRIDO" : oni ? "PAINEL DO ONI" : "PAINEL DO CAÇADOR"}`).body(" ");
  const add = (prefixo, texto, icone, acao) => {
    if (icone) f.button(prefixo + texto, icone);
    else f.button(prefixo + texto);
    acoes.push(acao ?? null);
  };

  // quadro de cima: informações do jogador (vida, stamina, pontos, dinheiro, rank)
  const dinheiro = Math.floor(getScore(p, "kny_dinheiro"));
  add(
    "I:",
    `§6Vida: §f${vidaTexto(p)}   §6Stamina: §f${Math.floor(sta.atual)}/${sta.max}\n` +
      `§6Pontos de atributo: §f${pontosTexto(disponiveis(p))}\n` +
      `§6Dinheiro: §f${dinheiro}\n` +
      `§6${oni ? "Posição" : "Rank"}: §f${r.atual}   §6${oni ? "Maldição" : "Honra"}: §f${r.pontos}`
  );

  // quadrados da direita: navegação
  const nav = [
    [hibrido ? "Híbrido" : oni ? "Kekki." : "Respir.", t.icones.arte, () => hibrido ? menuHibrido(p) : listaArtes(p)],
    ["Config.", t.icones.config, () => configuracoes(p)],
    ["Guia", t.icones.comoJogar, () => guiaEAcessos(p)],
    ["Missões", t.icones.missoes, () => missoes(p)],
    ["Treino", t.icones.status, () => painelTreino(p)],
  ];
  const extras = [];
  if (oni) {
    if (ehRei(p)) extras.push(["Transf.", t.icones.personagem, () => transformarMenu(p)]);
    if (ehOperador(p)) extras.push(["Cargo", t.icones.config, () => alterarCargo(p)]);
  } else {
    if (ehLider(p) || ehHashira(p)) extras.push([ehLider(p) ? "Ensinar" : "Aulas", "textures/icons/menu_teach", () => ensinar(p)]);
    if (ehOperador(p)) extras.push(["Cargo", t.icones.config, () => alterarCargo(p)]);
  }
  for (const [txt, icone, acao] of [...nav, ...extras].slice(0, 6)) add("R:", txt, icone, acao);
  add("R:", "Clássico", t.icones.voltar, () => {
    p.addTag(TAG_CLASSICO);
    return menuClassico(p);
  });

  // barras da esquerda: melhorar status (cada toque melhora 1 vez)
  const qtd = qtdCompra(p);
  for (const a of ATRIBUTOS) {
    const oferta = statusAtributo(p, a);
    add("L:", `§f${nomeAtributo(a, p)}  §6${valorAtributo(oferta)}  §7${proximaCompraTexto(oferta)}`, null, async () => {
      confirmarCompra(p, a, qtd.n, oferta);
      if (p.isValid) return painelPrincipal(p);
    });
  }
  const chave = chaveRedistribuicao(p);
  add("L:", "§fRedistribuir pontos", null, async () => {
    mensagemRedistribuicao(p, chave);
    if (p.isValid) return painelPrincipal(p);
  });
  add("L:", `§f§lComprar: §6${qtd.txt}\n§r§7Toque para mudar (x1 · x10 · x100 · máx.)`, null, async () => {
    const i = OPCOES_QTD.indexOf(qtd);
    pontuar(p, "kny_qtd", (i + 1) % OPCOES_QTD.length);
    return painelPrincipal(p);
  });
  add("X:", "§6§lX", null, "fechar"); // botão X no canto superior direito
  add("E:", "§6Aparência", ICONE_EDITOR, () => abrirEditor(p));

  const res = await mostrar(f, p);
  if (res.canceled) {
    if (res.cancelationReason === undefined) {
      // a tela nunca abriu: o pacote de interface está ausente, desativado ou com erro
      p.addTag(TAG_CLASSICO);
      p.sendMessage("§c[Painel] A tela do painel não abriu. Voltando ao menu clássico. Confira se o pacote de recursos do Kimetsu está ativo no mundo. Para tentar de novo: Configurações > Menu em painel.");
      return menuClassico(p);
    }
    return;
  }
  const acao = acoes[res.selection];
  if (acao === "fechar") return;
  if (!acao) return painelPrincipal(p); // tocou numa área só de texto
  return acao();
}

// Respeita a preferência do jogador nos submenus e na próxima abertura.
async function menuPrincipal(p) {
  if (!p.hasTag(TAG_CLASSICO)) return painelPrincipal(p);
  return menuClassico(p);
}

async function menuClassico(p) {
  const t = tema(p);
  const oni = isOni(p);
  const hibrido = isHybrid(p);
  const r = infoRank(p);
  som(p, oni ? "ambient.cave" : "random.orb", oni ? 0.6 : 1.1);

  let corpo = `${t.linha}\n`;
  if (oni) {
    corpo += hibrido ? `${t.suave}Posição: ${t.texto}${r.atual}\n`
      : `${t.texto}Oni ${t.suave}| ${t.suave}Posição: ${t.texto}${r.atual}\n`;
    corpo += `${t.suave}Maldição: ${t.texto}${r.pontos}\n`;
    corpo += r.prox ? `${t.suave}Próxima posição: ${t.texto}${r.prox} §8(faltam ${r.faltam} de maldição)${r.ocupado ? " [ocupado]" : ""}\n` : `${t.texto}Você alcançou o topo dos oni.\n`;
  } else {
    corpo += `${t.texto}Caçador de Demônios ${t.suave}| ${t.suave}Rank: ${t.texto}${r.atual}\n`;
    corpo += `${t.suave}Honra: ${t.texto}${r.pontos}\n`;
    corpo += r.prox ? `${t.suave}Próximo rank: ${t.texto}${r.prox} §8(faltam ${r.faltam} de honra)\n` : `${t.texto}Você alcançou o rank máximo.\n`;
  }
  corpo += `${t.linha}`;

  const f = novoForm(p).title(hibrido ? "§l§4MENU DO HÍBRIDO" : t.titulo).body(corpo);
  const extras = [];
  if (oni) {
    f.button(hibrido ? "§l§4Personagem Híbrido\n§r§8Poderes, disfarces e castelo" : "§l§4Kekkijutsu\n§r§8Artes demoníacas", t.icones.arte);
    f.button("§l§4Configurações\n§r§8Ajustes do menu", t.icones.config);
    f.button("§l§4Personagem\n§r§8Sua forma demoníaca", t.icones.personagem);
    f.button("§l§4Guia\n§r§8Como jogar e acessos", t.icones.comoJogar);
    f.button("§l§4Missões\n§r§8Caçadas e conquistas", t.icones.missoes);
    f.button("§l§4Status\n§r§8Atributos e stamina", t.icones.status);
    f.button("§l§4Menu em painel\n§r§8Moldura vermelha", t.icones.status);
    extras.push("painel");
    f.button("§l§4Treinamento\n§r§8Exercícios e dummy", t.icones.status);
    extras.push("treino");
    if (ehRei(p)) {
      f.button("§l§4Transformar em Oni\n§r§8Poder do Rei dos Onis", t.icones.personagem);
      extras.push("transformar");
    }
    if (ehOperador(p)) {
      f.button("§l§4Alterar meu cargo\n§r§8Somente operadores", t.icones.config);
      extras.push("cargo");
    }
  } else {
    f.button("§l§cRespirações\n§r§7Estilos e formas", t.icones.arte);
    f.button("§l§cConfigurações\n§r§7Ajustes do menu", t.icones.config);
    f.button("§l§cPersonagem\n§r§7Rank e status", t.icones.personagem);
    f.button("§l§cGuia\n§r§7Como jogar e acessos", t.icones.comoJogar);
    f.button("§l§cMissões\n§r§7Objetivos da jornada", t.icones.missoes);
    f.button("§l§cStatus\n§r§7Atributos e stamina", t.icones.status);
    f.button("§l§cMenu em painel\n§r§7Moldura vermelha", t.icones.status);
    extras.push("painel");
    f.button("§l§cTreinamento\n§r§7Exercícios e dummy", t.icones.status);
    extras.push("treino");
    if (ehLider(p) || ehHashira(p)) {
      f.button(ehLider(p) ? "§l§cEnsinar Respiração\n§r§7Líder dos Hashiras" : "§l§cAulas de domínio\n§r§7Entre Hashiras", "textures/icons/menu_teach");
      extras.push("ensinar");
    }
    if (ehOperador(p)) {
      f.button("§l§cAlterar meu cargo\n§r§7Somente operadores", t.icones.config);
      extras.push("cargo");
    }
  }

  f.button("§6Customizar personagem", ICONE_EDITOR);
  extras.push("editor");
  const res = await mostrar(f, p);
  if (res.canceled) return;
  switch (res.selection) {
    case 0: return hibrido ? menuHibrido(p) : listaArtes(p);
    case 1: return configuracoes(p);
    case 2: return personagem(p);
    case 3: return guiaEAcessos(p);
    case 4: return missoes(p);
    case 5: return statusMenu(p);
  }
  const acao = extras[res.selection - 6];
  if (acao === "painel") {
    p.removeTag(TAG_CLASSICO);
    return painelPrincipal(p);
  }
  if (acao === "treino") return painelTreino(p);
  if (acao === "ensinar") return ensinar(p);
  if (acao === "transformar") return transformarMenu(p);
  if (acao === "cargo") return alterarCargo(p);
  if (acao === "editor") return abrirEditor(p, true);
}

async function guiaEAcessos(p) {
  const f = novoForm(p).title("§lGUIA E ACESSOS").button(TXT_VOLTAR).button("Como jogar").button("Acessos de facção");
  const acoes = [() => menuPrincipal(p), () => comoJogar(p), () => menuAcessos(p)];
  if (ehCacadorHumano(p)) {
    f.button("Domínio humano");
    acoes.push(() => menuDominio(p));
  }
  if (ehStaff(p)) {
    f.button("Configurar Castelo Infinito");
    acoes.push(() => menuCasteloStaff(p));
  }
  const r = await mostrar(f, p);
  if (!r.canceled) return acoes[r.selection]?.();
}

async function menuDominio(p, peloSangue = false) {
  if (!ehCacadorHumano(p)) return;
  const d = progressoDominio(p);
  const estilos = d.lista.filter((g) => g.aprendidas > 0 || g.liberadas > 0).sort((a, b) => b.aprendidas - a.aprendidas);
  const resumo = estilos.slice(0, 5).map((g) =>
    `${g.nome}\nLiberadas ${g.liberadas}/${g.formas.length} · Domínio ${g.elegivel ? g.aprendidas + "/" + g.formas.length : "inelegível"}`).join("\n");
  const outros = estilos.length > 5 ? "\nConfira os demais estilos na tela Respirações." : "";
  const previa = preverTransformacao(p);
  const f = novoForm(p).title("§lDOMÍNIO HUMANO").body(
    (d.invalido ? "Histórico incompatível. Consulte a Staff."
      : `${previa.resp ? "Híbrido pronto · " + previa.resp.nome : previa.motivo}\n\n` +
        (resumo || "Nenhuma forma ou aula registrada. Procure o Líder dos Hashiras para iniciar o domínio.") + outros +
        (peloSangue ? "\n\nEscolha a original e use o sangue de novo." : ""))
  ).button(TXT_VOLTAR);
  for (const g of d.completas) f.button("Definir original · " + g.nome);
  const r = await mostrar(f, p);
  if (r.canceled) return;
  if (r.selection === 0) return peloSangue ? undefined : guiaEAcessos(p);
  const alvo = d.completas[r.selection - 1];
  if (alvo && selecionarOriginal(p, alvo.obj)) {
    p.sendMessage(peloSangue ? "§aRespiração original registrada. Use o sangue novamente." : "§aRespiração original registrada.");
    if (peloSangue) return;
  }
  return menuDominio(p, peloSangue);
}

async function confirmarOniComum(p, motivo, acao) {
  const f = novoForm(p).title("Transformação em Oni comum").body(motivo)
    .button("Continuar humano").button(acao);
  const r = await mostrar(f, p);
  return !r.canceled && r.selection === 1;
}

async function usarSangue(p, dose) {
  const previa = preverTransformacao(p);
  if (previa.destino === "escolher") return menuDominio(p, true);
  if (previa.destino === "oni" && !await confirmarOniComum(p, previa.motivo, "Beber e virar Oni comum")) return;
  const r = transformar(p, "sangue", p, { dose, destino: previa.resp?.obj ?? previa.destino });
  if (!r.ok) p.sendMessage("§c" + r.motivo);
}

async function menuHibrido(p) {
  const d = racaHibrida(p);
  if (!d) return;
  const resp = RESP_H_ID.get(d.resp);
  const arte = ARTE_H_ID.get(d.arte);
  const poder = habilidadeDe(p);
  const castelo = locais()?.castelo;
  const f = novoForm(p).title("§l§4KIMETSU LEGACY · HÍBRIDO").body(
    `Patente verdadeira ${patenteDe(p).nome}\nRespiração ${resp.nome} · ${d.formas}/${resp.formas.length}\n` +
    `Kekkijutsu ${arte.nome}\nHabilidade ${poder?.nome ?? "aguardando atribuição"}\n` +
    `Identidade pública ${ROTULOS[d.publico]}\nResistência solar parcial\n` +
    `Castelo ${castelo?.entrada && castelo.saida ? "configurado" : "aguardando configuração"}`
  );
  const passos = [
    [TXT_VOLTAR, () => menuPrincipal(p)],
    ["Respiração original", () => detalhesH(p, resp.nome, resp.formas.map((n, i) => `${i + 1}. ${n}`).join("\n"))],
    ["Kekkijutsu vinculado", () => detalhesH(p, arte.nome, `Use ${arte.item} para acessar esta arte. Ela é vinculada ao personagem.\n${(arte.formas ?? []).join("\n")}`)],
    ["Habilidade exclusiva", () => telaPoderH(p)],
    ["Disfarces", () => telaDisfarceH(p)],
    ["Castelo Infinito", () => telaCasteloH(p)],
    ["Status", () => statusMenu(p)],
    ["Treinamento", () => painelTreino(p)],
    ["Acessos de facção", () => menuAcessos(p)],
    ["Configurações", () => configuracoes(p)],
  ];
  for (const [nome] of passos) f.button(nome);
  const r = await mostrar(f, p);
  if (!r.canceled) return passos[r.selection]?.[1]();
}

async function detalhesH(p, titulo, corpo) {
  const r = await mostrar(novoForm(p).title(titulo).body(corpo).button(TXT_VOLTAR), p);
  if (!r.canceled) return menuHibrido(p);
}

async function telaPoderH(p) {
  const poder = habilidadeDe(p);
  const f = novoForm(p).title(poder?.nome ?? "Habilidade exclusiva").button(TXT_VOLTAR);
  f.body(poder ? `${poder.texto}\nFôlego ${poder.folego} · Stamina ${poder.stamina}\n` +
    `Recarga ${poder.ms / 1000}s · Restam ${Math.max(0, Math.ceil((poder.ate - Date.now()) / 1000))}s\n` +
    (poder.ativo ? "Aponte antes de abrir o menu e selecione Ativar." : "Desativada pela Staff.") : "Habilidade exclusiva aguardando atribuição.");
  if (poder?.ativo) f.button("Ativar");
  const r = await mostrar(f, p);
  if (r.canceled) return;
  if (r.selection === 0) return menuHibrido(p);
  if (r.selection === 1) {
    const erro = ativarHabilidade(p);
    if (erro) p.sendMessage("§e" + erro);
  }
}

async function telaDisfarceH(p) {
  const d = racaHibrida(p);
  if (!d) return;
  const identidades = Object.keys(ROTULOS);
  const falta = Math.max(0, Math.ceil(((d.disfarceAte ?? 0) - Date.now()) / 1000));
  const f = novoForm(p).title("Disfarces").body(
    `Identidade atual ${ROTULOS[d.publico]}\nRecarga ${falta}s\nAguarde o fim do combate para trocar.` +
    (H.revelarPoder ? "\nPoderes incompatíveis revelam sua forma verdadeira." : "")
  ).button(TXT_VOLTAR);
  for (const [id, nome] of Object.entries(ROTULOS)) f.button(id === d.publico ? nome + " · ativo" : nome);
  const r = await mostrar(f, p);
  if (r.canceled) return;
  if (r.selection === 0) return menuHibrido(p);
  if (identidades[r.selection - 1]) p.sendMessage("§e" + trocarDisfarce(p, identidades[r.selection - 1]));
}

async function telaCasteloH(p) {
  if (!isHybrid(p)) return;
  const cfg = locais()?.castelo;
  const pronto = cfg?.entrada && cfg.saida;
  const f = novoForm(p).title("Castelo Infinito").body(pronto
    ? `A entrada aceita a identidade Oni ou a forma verdadeira. Preparação de ${cfg.ticks / 20}s. Saia pelo ponto registrado pela Staff.`
    : "O Castelo Infinito ainda não foi configurado pela administração.").button(TXT_VOLTAR);
  if (pronto) f.button("Entrar no Castelo").button("Sair do Castelo");
  const r = await mostrar(f, p);
  if (r.canceled) return;
  if (r.selection === 0) return menuHibrido(p);
  if (pronto && [1, 2].includes(r.selection)) {
    const erro = viajar(p, "castelo", r.selection === 1 ? "entrada" : "saida");
    if (erro) p.sendMessage("§e" + erro);
  }
}

async function menuCasteloStaff(p) {
  if (!ehStaff(p)) return;
  const f = novoForm(p).title("Castelo · Staff").body("Registre sua posição atual como entrada ou saída. Os pontos precisam ter piso seguro.")
    .button(TXT_VOLTAR).button("Registrar entrada").button("Registrar saída");
  const r = await mostrar(f, p);
  if (r.canceled) return;
  if (r.selection === 0) return guiaEAcessos(p);
  if (r.selection === 1 || r.selection === 2) p.sendMessage("§e" + configurarLocal(p, ["castelo", r.selection === 1 ? "entrada" : "saida"]));
}

async function menuAcessos(p) {
  const acessos = Object.keys(locais()?.acessos ?? {}).filter((id) => canAccessLocation(p, id));
  const f = novoForm(p).title("Acessos de facção").body("Aproxime-se de um dos pontos registrados pela Staff.").button(TXT_VOLTAR);
  for (const id of acessos) f.button("Entrar · " + id).button("Sair · " + id);
  const r = await mostrar(f, p);
  if (r.canceled) return;
  if (r.selection === 0) return isHybrid(p) ? menuHibrido(p) : guiaEAcessos(p);
  const id = acessos[Math.floor((r.selection - 1) / 2)];
  if (id) {
    const erro = viajar(p, id, r.selection % 2 ? "entrada" : "saida");
    if (erro) p.sendMessage("§e" + erro);
  }
}

function resumoRespiracao(p, g) {
  const total = g.formas.length;
  const dominio = DOMINAVEL(g.obj) ? `${dominioHumano(p, g.obj)}/${total}` : "inelegível";
  return `Liberadas ${formasLiberadas(p, g)}/${total} · Domínio ${dominio}`;
}

/* ---------------------------------------------------------------------
   RESPIRAÇÕES (caçador) / KEKKIJUTSU (oni)
--------------------------------------------------------------------- */

const MARCA_ARTE = "kny_arte|";
const MARCA_CONF = "kny_conf|";
const MARCA_MISS = "kny_miss|";
const MARCA_TXT = "kny_txt|"; // guia (tela com rolagem)
const MARCA_CTR = "kny_ctr|"; // contrato do caçador (tela com rolagem)
const TXT_VOLTAR = "§b§l< VOLTAR"; // destacado (azul-claro) e sempre na direita
const ultimaPagEnsino = new Map();

// nome curto de uma forma: tira o prefixo em inglês antes de ": "
const nomeCurto = (n) => (n.includes(": ") ? n.split(": ").slice(1).join(": ") : n);

// lista de respirações / kekkijutsus no painel (moldura vermelha)
async function painelArtes(p, pagina = 0) {
  const t = tema(p);
  const oni = isOni(p);
  const lista = oni ? KEKKIJUTSUS : TODAS_RESPIRACOES;
  const naMao = itemNaMao(p);
  const objMao = naMao ? ITEM_OBJ[naMao.typeId] ?? (LAMINA_POR_ITEM[naMao.typeId] ? "basica" : undefined) : undefined;
  const ordem = [...lista].sort((a, b) => (b.obj === objMao ? 1 : 0) - (a.obj === objMao ? 1 : 0));

  const paginar = ordem.length > 6;
  const porPag = paginar ? 5 : 6;
  const total = Math.max(1, Math.ceil(ordem.length / porPag));
  pagina = ((pagina % total) + total) % total;
  const itens = ordem.slice(pagina * porPag, pagina * porPag + porPag);

  const acoes = [];
  const f = new ActionFormData().title(`${MARCA_ARTE}§l${oni ? "KEKKIJUTSU" : "RESPIRAÇÕES"}`).body(" ");
  const add = (prefixo, texto, icone, acao) => {
    if (icone) f.button(prefixo + texto, icone);
    else f.button(prefixo + texto);
    acoes.push(acao ?? null);
  };

  add("B:", TXT_VOLTAR, null, () => menuPrincipal(p));
  const destaque = ordem.find((g) => g.obj === objMao) ?? itens[0];
  if (destaque) {
    add(
      "G:",
      `§l${destaque.nome}\n§r§7Toque em ${oni ? "uma arte" : "uma respiração"} à esquerda para ver as habilidades e os requisitos.`,
      destaque.icon,
      null
    );
  }
  for (const g of itens) {
    const marca = g.obj === objMao ? "§a> §r" : "";
    const sub = oni ? `${g.formas.length} formas` : resumoRespiracao(p, g);
    add("L:", `${marca}§f§l${g.nome}\n§r§7${sub}`, null, () => painelDetalheArte(p, g, pagina));
  }
  if (paginar) add("L:", `§6§lPróxima página §7(${pagina + 1}/${total})`, null, () => painelArtes(p, pagina + 1));

  const res = await mostrar(f, p);
  if (res.canceled) {
    if (res.cancelationReason === undefined) return listaArtesClassica(p); // tela não abriu
    return;
  }
  const acao = acoes[res.selection];
  if (!acao) return painelArtes(p, pagina);
  return acao();
}

// habilidades (formas) de uma respiração / kekkijutsu, com a imagem da espada ou da arte
async function painelDetalheArte(p, g, voltarPag = 0, pagina = 0) {
  const oni = isOni(p);
  const aprendidas = oni ? g.formas.length : formasLiberadas(p, g);
  const paginar = g.formas.length > 6;
  const porPag = paginar ? 5 : 6;
  const total = Math.max(1, Math.ceil(g.formas.length / porPag));
  pagina = ((pagina % total) + total) % total;
  const ini = pagina * porPag;
  const itens = g.formas.slice(ini, ini + porPag);

  const acoes = [];
  const f = new ActionFormData().title(`${MARCA_ARTE}§l${g.nome}`).body(" ");
  const add = (prefixo, texto, icone, acao) => {
    if (icone) f.button(prefixo + texto, icone);
    else f.button(prefixo + texto);
    acoes.push(acao ?? null);
  };

  add("B:", TXT_VOLTAR, null, () => painelArtes(p, voltarPag));

  let resumo = `§l${g.nome}§r\n§7${oni ? `${g.formas.length} formas` : resumoRespiracao(p, g)}\n`;
  if (!oni) resumo += textoProximaAula(p, g);
  resumo += `§8Agache para trocar a habilidade e segure o botão de usar para executar.`;
  add("G:", resumo, g.icon, null);

  itens.forEach((nome, i) => {
    const n = ini + i + 1;
    const txt = oni
      ? `§6${n}. §f${nomeCurto(nome)}`
      : n <= aprendidas
        ? `§a[OK] §f${n}. ${nomeCurto(nome)}`
        : `§8[  ] §7${n}. ${nomeCurto(nome)}`;
    add("L:", txt, null, null);
  });
  if (paginar) add("L:", `§6§lPróxima página §7(${pagina + 1}/${total})`, null, () => painelDetalheArte(p, g, voltarPag, pagina + 1));

  const res = await mostrar(f, p);
  if (res.canceled) return;
  const acao = acoes[res.selection];
  if (!acao) return painelDetalheArte(p, g, voltarPag, pagina);
  return acao();
}

async function listaArtes(p) {
  if (!p.hasTag(TAG_CLASSICO)) return painelArtes(p, 0);
  return listaArtesClassica(p);
}

async function listaArtesClassica(p) {
  const t = tema(p);
  const oni = isOni(p);
  const lista = oni ? KEKKIJUTSUS : TODAS_RESPIRACOES;
  const naMao = itemNaMao(p);
  const objMao = naMao ? ITEM_OBJ[naMao.typeId] ?? (LAMINA_POR_ITEM[naMao.typeId] ? "basica" : undefined) : undefined;

  // o que está na mão aparece primeiro
  const ordem = [...lista].sort((a, b) => (b.obj === objMao ? 1 : 0) - (a.obj === objMao ? 1 : 0));

  const f = novoForm(p)
    .title(oni ? "§l§4KEKKIJUTSU" : "§l§cRESPIRAÇÕES")
    .body(
      `${t.linha}\n${t.suave}${oni ? "Artes Demoníacas" : "Respirações"}: ${t.texto}${lista.length}\n` +
        `${t.suave}${oni ? "Toque em uma arte para ver os golpes." : "Toque em uma respiração para ver as habilidades e os requisitos."}\n${t.linha}`
    )
    .button(`§l${t.destaque}Voltar`, t.icones.voltar);

  for (const g of ordem) {
    const marca = g.obj === objMao ? "§a> §r" : "";
    const sub = oni ? `${g.formas.length} formas` : resumoRespiracao(p, g);
    f.button(`${marca}§l${t.destaque}${g.nome}\n§r${t.suave}${sub}`, g.icon);
  }

  const res = await mostrar(f, p);
  if (res.canceled) return;
  if (res.selection === 0) return menuPrincipal(p);
  return detalheArte(p, ordem[res.selection - 1]);
}

async function detalheArte(p, g) {
  const t = tema(p);
  const oni = isOni(p);
  const aprendidas = oni ? g.formas.length : formasLiberadas(p, g);
  let corpo = `${t.linha}\n${t.texto}§l${g.nome}§r\n${t.linha}\n`;
  g.formas.forEach((nome, i) => {
    if (oni) corpo += `${t.destaque}${i + 1}. ${t.texto}${nome}\n`;
    else corpo += i < aprendidas ? `§a[OK] ${t.texto}${i + 1}. ${nome}\n` : `§8[  ] ${i + 1}. ${nome}\n`;
  });

  if (!oni) corpo += `\n${t.linha}\n${resumoRespiracao(p, g)}\n${textoProximaAula(p, g)}`;
  corpo +=
    `\n${t.linha}\n${t.suave}Como usar: empunhe ${g.basica ? "uma lâmina colorida" : "o item"}, ${t.texto}agache (Shift)${t.suave} para trocar a habilidade e ` +
    `${t.texto}segure o botão de usar${t.suave} para executá-la.\n`;

  const f = novoForm(p)
    .title(`§l${t.destaque}${g.nome}`)
    .body(corpo)
    .button(`§l${t.destaque}Voltar à lista`, t.icones.voltar)
    .button(`§l${t.destaque}Menu principal`, t.icones.arte);

  const res = await mostrar(f, p);
  if (res.canceled) return;
  if (res.selection === 0) return listaArtes(p);
  return menuPrincipal(p);
}

/* ---------------------------------------------------------------------
   CONFIGURAÇÕES
--------------------------------------------------------------------- */

// configurações no painel (moldura de 5 barras)
async function painelConfig(p) {
  const dica = !p.hasTag(TAG_DICA_OFF);
  const sons = !p.hasTag(TAG_SOM_OFF);
  const on = "§aLIGADO";
  const off = "§7DESLIGADO";
  const acoes = [];
  const f = new ActionFormData().title(`${MARCA_CONF}§lCONFIGURAÇÕES`).body(" ");
  const add = (prefixo, texto, acao) => {
    f.button(prefixo + texto);
    acoes.push(acao ?? null);
  };
  add("B:", TXT_VOLTAR, () => menuPrincipal(p));
  add("L:", `§f§lForma na barra de ação\n§r${dica ? on : off}`, () => {
    if (dica) p.addTag(TAG_DICA_OFF);
    else p.removeTag(TAG_DICA_OFF);
    return painelConfig(p);
  });
  add("L:", `§f§lSons do menu\n§r${sons ? on : off}`, () => {
    if (sons) p.addTag(TAG_SOM_OFF);
    else p.removeTag(TAG_SOM_OFF);
    return painelConfig(p);
  });
  add("L:", "§f§lReceber item do menu\n§r§7Se você perdeu o item", () => {
    if (temItemMenu(p)) p.sendMessage("§cVocê já possui o item do menu.");
    else if (darItemMenu(p)) p.sendMessage("§cItem do menu entregue.");
    return painelConfig(p);
  });
  add("L:", `§f§lMenu em painel\n§r${!p.hasTag(TAG_CLASSICO) ? on : off}`, () => {
    if (p.hasTag(TAG_CLASSICO)) p.removeTag(TAG_CLASSICO);
    else p.addTag(TAG_CLASSICO);
    return p.hasTag(TAG_CLASSICO) ? configuracoesClassica(p) : painelConfig(p);
  });

  const res = await mostrar(f, p);
  if (res.canceled) {
    if (res.cancelationReason === undefined) return configuracoesClassica(p);
    return;
  }
  const acao = acoes[res.selection];
  if (!acao) return painelConfig(p);
  return acao();
}

async function configuracoes(p) {
  if (!p.hasTag(TAG_CLASSICO)) return painelConfig(p);
  return configuracoesClassica(p);
}

async function configuracoesClassica(p) {
  const t = tema(p);
  const dica = !p.hasTag(TAG_DICA_OFF);
  const sons = !p.hasTag(TAG_SOM_OFF);
  const on = "§aLIGADO";
  const off = "§7DESLIGADO";

  const f = novoForm(p)
    .title(isOni(p) ? "§l§4CONFIGURAÇÕES" : "§l§cCONFIGURAÇÕES")
    .body(`${t.linha}\n${t.suave}Toque em uma opção para alterá-la.\n${t.linha}`)
    .button(`§l${t.destaque}Voltar`, t.icones.voltar)
    .button(`§l${t.destaque}Forma na barra de ação\n§r${dica ? on : off}`, t.icones.arte)
    .button(`§l${t.destaque}Sons do menu\n§r${sons ? on : off}`, t.icones.config)
    .button(`§l${t.destaque}Receber item do menu\n§r${t.suave}Se você perdeu o item`, t.icones.missoes)
    .button(`§l${t.destaque}Menu em painel\n§r${!p.hasTag(TAG_CLASSICO) ? on : off}`, t.icones.status);

  const res = await mostrar(f, p);
  if (res.canceled) return;
  switch (res.selection) {
    case 0:
      return menuPrincipal(p);
    case 1:
      if (dica) p.addTag(TAG_DICA_OFF);
      else p.removeTag(TAG_DICA_OFF);
      return configuracoes(p);
    case 2:
      if (sons) p.addTag(TAG_SOM_OFF);
      else p.removeTag(TAG_SOM_OFF);
      return configuracoes(p);
    case 3:
      if (temItemMenu(p)) p.sendMessage("§cVocê já possui o item do menu.");
      else if (darItemMenu(p)) p.sendMessage("§cItem do menu entregue.");
      return configuracoes(p);
    case 4:
      if (p.hasTag(TAG_CLASSICO)) p.removeTag(TAG_CLASSICO);
      else p.addTag(TAG_CLASSICO);
      return configuracoes(p);
  }
}

/* ---------------------------------------------------------------------
   PERSONAGEM
--------------------------------------------------------------------- */

function vidaTexto(p) {
  try {
    const h = p.getComponent("minecraft:health");
    return `${Math.ceil(h.currentValue)}/${Math.ceil(h.effectiveMax)}`;
  } catch {
    return "?";
  }
}

async function personagem(p) {
  const t = tema(p);
  const oni = isOni(p);
  const hibrido = isHybrid(p);
  const r = infoRank(p);
  let c = `${t.linha}\n${t.texto}§l${p.name}§r\n${t.linha}\n`;

  if (oni) {
    c += `${t.suave}Raça: ${t.texto}${hibrido ? "Híbrido" : "Oni"}\n`;
    c += `${t.suave}Posição: ${t.texto}${r.atual}\n`;
    c += `${t.suave}Vida: ${t.texto}${vidaTexto(p)}\n`;
    c += `${t.suave}Progresso: ${barra(r.progresso * 100, 100, 20, "§4")} §8${r.prox ? `> ${r.prox}` : "(máximo)"}\n`;
    c += `${t.suave}Maldição: ${t.texto}${r.pontos}\n`;
    c += `${t.suave}Doses de sangue: ${t.texto}${getScore(p, "blood")}\n`;
    c += `${t.suave}Maldição do Rei dos Onis: ${p.hasTag("muzan_curse") ? "§4ativa" : p.hasTag("breakcurse") ? "§cquebrada" : "§8inativa"}\n`;
    c += `${t.suave}Resistência ao sol: ${hibrido ? "§cparcial" : p.hasTag("sunshield") ? "§cconquistada" : "§4queima sob o sol"}\n`;
  } else {
    c += `${t.suave}Classe: ${t.texto}Caçador de Demônios\n`;
    c += `${t.suave}Rank: ${t.texto}${r.atual}\n`;
    c += `${t.suave}Vida: ${t.texto}${vidaTexto(p)}\n`;
    c += `${t.suave}Progresso: ${barra(r.progresso * 100, 100, 20, "§c")} §8${r.prox ? `> ${r.prox}` : "(máximo)"}\n`;
    c += `${t.suave}Honra: ${t.texto}${r.pontos}\n`;
    const marca = Object.keys(MARCAS).find((k) => p.hasTag(k));
    c += `${t.suave}Última respiração usada: ${t.texto}${marca ? MARCAS[marca] : "nenhuma ainda"}\n`;
    const resumo = TODAS_RESPIRACOES.filter((g) => formasLiberadas(p, g) > 0).map(
      (g) => `${g.nome.replace(/^Respiração d[aoe]s? /, "").replace(/^Respiração /, "")} ${resumoRespiracao(p, g)}`
    );
    c += `${t.suave}Respirações: ${t.texto}${ehHashira(p) ? "todas (Hashira)" : resumo.length ? resumo.join(", ") : "nenhuma ainda"}\n`;
    const lm = laminaNaMao(p);
    c += `${t.suave}Lâmina na mão: ${t.texto}${lm ? `${lm.nome} (${lm.desc})` : "nenhuma lâmina colorida"}\n`;
    const dano = getScore(p, "damage");
    c += `${t.suave}Dano sofrido: ${t.texto}${dano}§8/320 §7(Marca do Caçador)\n`;
    if (p.hasTag("hashira")) c += `${t.destaque}* Você é um Hashira\n`;
  }

  const f = novoForm(p)
    .title(oni ? "§l§4PERSONAGEM" : "§l§cPERSONAGEM")
    .body(c)
    .button(`§l${t.destaque}Voltar`, t.icones.voltar);
  const res = await mostrar(f, p);
  if (!res.canceled) return menuPrincipal(p);
}

/* ---------------------------------------------------------------------
   CARGOS ÚNICOS: REI DOS ONIS (oni) e LÍDER DOS HASHIRAS (caçador)
   - Só um jogador por vez em cada cargo (registro em pontuação).
   - Ao alcançar 10000 pontos de rank com o rank máximo comum
     (Lua Superior 1 / Hashira), o cargo é assumido se estiver livre.
   - O Rei dos Onis pode transformar qualquer jogador em oni pelo menu.
--------------------------------------------------------------------- */

const PONTOS_CARGO_MAXIMO = 10000;
const CARGO_REI = { obj: OBJ_REI, tag: REI_ONI.tag, nome: REI_ONI.nome, cor: "§4", avisados: new Set() };
const CARGO_LIDER = { obj: OBJ_LIDER, tag: "hashira_lider", nome: "Líder dos Hashiras", cor: "§9", avisados: new Set() };

const cargoDoRank = (tag) => (tag === CARGO_REI.tag ? CARGO_REI : tag === CARGO_LIDER.tag ? CARGO_LIDER : null);

const titularDe = (c) => titularStats(c.obj);

function limparTitular(c) {
  try {
    const o = world.scoreboard.getObjective(c.obj);
    if (!o) return;
    const nome = titularDe(c);
    for (const i of o.getParticipants()) o.removeParticipant(i);
    const anterior = nome && world.getPlayers({ name: nome })[0];
    if (anterior) agendarStats(anterior);
  } catch {}
}

function definirTitular(p, c) {
  limparTitular(c);
  const o = world.scoreboard.getObjective(c.obj) ?? world.scoreboard.addObjective(c.obj, c.obj);
  o.setScore(p.name, 1);
  p.addTag(c.tag);
  agendarStats(p);
}

const ehRei = (p) => isOni(p) && p.hasTag(CARGO_REI.tag) && titularDe(CARGO_REI) === p.name;
const ehLider = (p) => !isOni(p) && p.hasTag(CARGO_LIDER.tag) && titularDe(CARGO_LIDER) === p.name;

function verificarCargo(p, c, ehDoLado, tagRank, objPontos) {
  const titular = titularDe(c);

  // marca antiga de quem já não é o titular
  if (p.hasTag(c.tag) && titular !== p.name) {
    p.removeTag(c.tag);
    agendarStats(p);
  }

  if (titular === p.name) {
    if (!ehDoLado(p)) {
      limparTitular(c); // mudou de lado: o cargo fica livre
      p.removeTag(c.tag);
      p.sendMessage(`§cVocê perdeu o cargo de ${c.nome}.`);
    } else if (!p.hasTag(c.tag)) {
      p.addTag(c.tag);
      agendarStats(p);
    }
    return;
  }

  // chegou a hora de assumir o cargo?
  if (ehDoLado(p) && p.hasTag(tagRank) && getScore(p, objPontos) >= PONTOS_CARGO_MAXIMO) {
    if (!titular) {
      definirTitular(p, c);
      if (isHybrid(p)) p.sendMessage(`§4Você assumiu o cargo de ${c.nome}.`);
      else world.sendMessage(`§4[Kimetsu] §c${p.name} se tornou §l${c.nome}§r§c.`);
    } else if (!c.avisados.has(p.id)) {
      c.avisados.add(p.id);
      p.sendMessage(`§cO cargo de ${c.nome} já pertence a §l${titular}§r§c.`);
    }
  }
}

system.runInterval(() => {
  for (const p of world.getPlayers()) {
    try {
      verificarCargo(p, CARGO_REI, isOni, "upper1", "updemon");
      verificarCargo(p, CARGO_LIDER, (q) => !isOni(q), "hashira", "upslayer");
    } catch {}
  }
}, 40);

async function transformarMenu(p) {
  const t = TEMA_ONI;
  if (!ehRei(p)) {
    p.sendMessage("§cSomente o Rei dos Onis pode transformar jogadores em oni.");
    return;
  }
  const alvos = world.getPlayers().filter((q) => q.id !== p.id && !isOni(q));
  const f = novoForm(p).title("§l§4TRANSFORMAR EM ONI");
  if (alvos.length === 0) {
    f.body(`${t.linha}\n§cNenhum jogador humano online para transformar.\n${t.linha}`).button(`§l${t.destaque}Voltar`, t.icones.voltar);
    const r = await mostrar(f, p);
    if (!r.canceled) return menuPrincipal(p);
    return;
  }
  f.body(`${t.linha}\n${t.texto}Escolha quem será transformado em oni.\n${t.linha}`).button(`§l${t.destaque}Voltar`, t.icones.voltar);
  for (const q of alvos) f.button(`§l${t.destaque}${q.name}\n§r${t.suave}Humano`, t.icones.personagem);

  const res = await mostrar(f, p);
  if (res.canceled) return;
  if (res.selection === 0) return menuPrincipal(p);
  const alvo = alvos[res.selection - 1];
  if (alvo?.isValid) return confirmarTransformacao(p, alvo);
}

async function confirmarTransformacao(p, alvo) {
  const t = TEMA_ONI;
  const previa = preverTransformacao(alvo);
  if (!previa.destino || previa.destino === "escolher" || previa.destino === "dose") {
    if (previa.destino === "escolher") alvo.sendMessage("§e" + previa.motivo);
    p.sendMessage("§e" + (previa.motivo ?? "O jogador já é da linhagem Oni."));
    return menuPrincipal(p);
  }
  const resultado = previa.resp ? "Híbrido com " + previa.resp.nome : "Oni comum";
  const f = novoForm(p)
    .title("§l§4CONFIRMAR")
    .body(
      `${t.linha}\n${t.texto}${alvo.name} vai se tornar ${resultado}. A patente humana se encerra.\n\n${t.suave}${previa.motivo ?? ""}\n${t.linha}`
    )
    .button(`§l${t.destaque}Transformar em ${previa.resp ? "Híbrido" : "Oni comum"}`, t.icones.arte)
    .button(`§l${t.destaque}Cancelar`, t.icones.voltar);
  const res = await mostrar(f, p);
  if (res.canceled || res.selection !== 0) return menuPrincipal(p);
  transformarEmOni(p, alvo, previa.resp?.obj ?? "oni");
}

function transformarEmOni(p, alvo, destino) {
  try {
    const r = transformar(alvo, "rei", p, { destino });
    if (!r.ok) return p.sendMessage("§c" + r.motivo);
    p.sendMessage(`§4Você transformou §l${alvo.name}§r§4 em ${r.hibrido ? "Híbrido" : "Oni"}.`);
    som(alvo, "ambient.cave", 0.6, 0.8);
  } catch (e) {
    reportar(p, e);
  }
}

/* ---------------------------------------------------------------------
   OPERADORES: alterar o próprio cargo
--------------------------------------------------------------------- */

function ehOperador(p) {
  return ehStaff(p);
}

function definirCargoCacador(p, idx) {
  const alvo = RANKS_CACADOR[idx];
  registrarRankAdministrativo(p, "upslayer", alvo.min);
  for (const r of RANKS_CACADOR) {
    p.removeTag(r.tag);
    p.removeTag(r.tag + "2");
  }
  for (let i = 0; i <= idx; i++) {
    p.addTag(RANKS_CACADOR[i].tag);
    p.addTag(RANKS_CACADOR[i].tag + "2");
  }
  p.addTag("slayer");
  p.addTag("slayer2");
  p.addTag(TAG_ESCOLHEU);
  if (alvo.tag === CARGO_LIDER.tag) definirTitular(p, CARGO_LIDER);
  else if (titularDe(CARGO_LIDER) === p.name) limparTitular(CARGO_LIDER);
  pontuar(p, "upslayer", alvo.min);
  agendarStats(p);
}

// idx 0 = sem posição; 1..n = RANKS_ONI[idx - 1]
function definirCargoOni(p, idx) {
  const maldicao = idx === 0 ? 0 : RANKS_ONI[idx - 1].min;
  registrarRankAdministrativo(p, "updemon", maldicao);
  for (const r of RANKS_ONI) {
    p.removeTag(r.tag);
    p.removeTag(r.tag + "2");
  }
  for (let i = 0; i < idx; i++) {
    p.addTag(RANKS_ONI[i].tag);
    p.addTag(RANKS_ONI[i].tag + "2");
  }
  pontuar(p, "updemon", maldicao);
  if (idx === RANKS_ONI.length) definirTitular(p, CARGO_REI);
  else if (titularDe(CARGO_REI) === p.name) limparTitular(CARGO_REI);
  agendarStats(p);
}

function voltarCargoHibrido(p) {
  if (titularDe(CARGO_REI) !== p.name) return;
  const maldicao = Math.max(0, Math.min(getScore(p, "updemon"), REI_ONI.min - 1));
  registrarRankAdministrativo(p, "updemon", maldicao);
  pontuar(p, "updemon", maldicao);
  p.removeTag(CARGO_REI.tag);
  p.removeTag(CARGO_REI.tag + "2");
  limparTitular(CARGO_REI);
}

async function alterarCargo(p) {
  if (!ehOperador(p)) {
    p.sendMessage("§cSomente operadores podem alterar o próprio cargo.");
    return;
  }
  const t = tema(p);
  const oni = isOni(p);
  const hibrido = isHybrid(p);
  const r = infoRank(p);
  const cargos = hibrido ? [HIBRIDO_SUPERIOR, REI_ONI] : oni ? [ONI, ...RANKS_ONI] : RANKS_CACADOR;

  const f = novoForm(p)
    .title(oni ? "§l§4ALTERAR MEU CARGO" : "§l§cALTERAR MEU CARGO")
    .body(
      `${t.linha}\n${t.suave}Somente operadores.\n${t.suave}Cargo atual: ${t.texto}${r.atual}\n${t.suave}Os limites de atributos e os bônus passivos acompanham a patente.\n${t.linha}`
    )
    .button(`§l${t.destaque}Voltar`, t.icones.voltar);
  for (const cargo of cargos) {
    const regra = cargo === HIBRIDO_SUPERIOR ? "Patente da linhagem" : `${cargo.min} de ${oni ? "maldição" : "honra"}`;
    f.button(`§l${t.destaque}${cargo.nome}\n§r${t.suave}${regra}`, t.icones.personagem);
  }

  const res = await mostrar(f, p);
  if (res.canceled) return;
  if (res.selection === 0) return menuPrincipal(p);
  const idx = res.selection - 1;
  const alvo = cargos[idx];
  if (!ehOperador(p) || isOni(p) !== oni || isHybrid(p) !== hibrido || !alvo) return;
  try {
    if (alvo === HIBRIDO_SUPERIOR) voltarCargoHibrido(p);
    else if (oni) definirCargoOni(p, RANKS_ONI.indexOf(alvo) + 1);
    else definirCargoCacador(p, idx);
    p.sendMessage(`§cSeu cargo agora é §l${alvo.nome}§r§c.`);
    som(p, "random.levelup", 1.2, 0.7);
  } catch (e) {
    reportar(p, e);
  }
  await wait(10);
  return menuPrincipal(p);
}

/* ---------------------------------------------------------------------
   COMANDOS DE OPERADOR (sem menu)
   /function cargo_lider   ou   /tag @s add kny_set_lider   -> Líder dos Hashiras
   /function cargo_rei     ou   /tag @s add kny_set_rei     -> Rei dos Onis
   (só quem tem permissão de comando consegue adicionar essas tags)
--------------------------------------------------------------------- */

async function assumirRei(p) {
  if (!ehOperador(p)) return;
  if (!isOni(p)) {
    const previa = preverTransformacao(p);
    if (previa.destino === "oni" && !await confirmarOniComum(p, previa.motivo, "Virar Oni comum e assumir o cargo")) return;
    const r = transformar(p, "cargo", p, { destino: previa.resp?.obj ?? previa.destino });
    if (!r.ok) return p.sendMessage("§c" + r.motivo);
  }
  await wait(20);
  if (!ehOperador(p) || !isOni(p)) return;
  p.addTag(TAG_ESCOLHEU);
  definirCargoOni(p, RANKS_ONI.length);
  p.sendMessage("§4Cargo definido: §lRei dos Onis§r§4.");
  if (!isHybrid(p)) world.sendMessage(`§4[Kimetsu] §c${p.name} se tornou §lRei dos Onis§r§4.`);
}

system.runInterval(() => {
  for (const p of world.getPlayers()) {
    try {
      if (p.hasTag("kny_abrir_painel")) {
        p.removeTag("kny_abrir_painel");
        p.sendMessage("§8[Painel] Abrindo o painel de teste...");
        painelPrincipal(p).catch((e) => reportar(p, e));
      }
      if (p.hasTag("kny_set_lider")) {
        p.removeTag("kny_set_lider");
        if (!ehOperador(p)) continue;
        if (isOni(p)) {
          p.sendMessage("§cLíder dos Hashiras é um cargo de caçador. Você é um oni: volte a ser humano primeiro.");
        } else {
          definirCargoCacador(p, RANKS_CACADOR.findIndex((r) => r.tag === CARGO_LIDER.tag));
          p.sendMessage("§9Cargo definido: §lLíder dos Hashiras§r§9.");
          som(p, "random.levelup", 1.2, 0.7);
        }
      }

      if (p.hasTag("kny_set_rei") || p.hasTag("kny_set_muzan")) {
        p.removeTag("kny_set_rei");
        p.removeTag("kny_set_muzan");
        if (!ehOperador(p)) continue;
        if (!abrirSessaoMenu(p, () => assumirRei(p))) {
          p.sendMessage("§eFeche o Menu Kimetsu e tente o comando de cargo novamente.");
        }
      }
    } catch {}
  }
}, 10);

// Status usa a mesma distribuição no painel e no menu clássico.
const LIMITE_ATINGIDO = "Você atingiu o limite deste atributo para sua patente. Evolua de patente para aumentar seu potencial.";
const CREDITO_COMPLETO = "Crédito máximo deste nível. Compre a melhoria no menu de Status para continuar.";
const STATUS_ATUALIZADO = "Os atributos foram atualizados. Confira os valores no menu.";
const pontosTexto = (valor) => String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const nomeAtributo = (a, p) => (a.id === "pod" ? (isOni(p) ? "Poder do Kekkijutsu" : "Poder da Respiração") : a.nome);

const OPCOES_QTD = [
  { txt: "x1", n: 1 },
  { txt: "x10", n: 10 },
  { txt: "x100", n: 100 },
  { txt: "máx.", n: NIVEL_MAXIMO },
];
const qtdCompra = (p) => OPCOES_QTD[Math.max(0, Math.min(OPCOES_QTD.length - 1, getScore(p, "kny_qtd")))];

function descEfeito(a, v, p) {
  switch (a.id) {
    case "for": return `+${efeitoForca(v).toFixed(1)}% de dano em todos os ataques`;
    case "vid": return `+${bonusVida(v)} de vida máxima (4 PV a cada 5 níveis)`;
    case "def": return `-${(reducaoDefesa(v) * 100).toFixed(1)}% do dano recebido`;
    case "pod": return `+${efeitoPoder(v).toFixed(1)}% de dano com ${isOni(p) ? "o kekkijutsu" : "a espada"} e ${folegoMax(v)} de fôlego máximo`;
    default: return `${staminaMax(v)} de stamina máxima`;
  }
}

/* ---------------------------------------------------------------------
   TREINAMENTO: flexão, abdominal, meditar, agachamento e dummy
   - Cada exercício faz 1 repetição a cada 2 segundos (o personagem tem uma animação própria).
   - A cada série completa o treino reduz o custo da próxima melhoria daquele atributo.
   - O dummy registra séries de Força com 5 tapas. Ele é imortal e fixo no lugar.
--------------------------------------------------------------------- */
const TICKS_POR_REP = 40; // 2 segundos por repetição
const MAX_REPS_SESSAO = 0; // 0 = sem limite; ou o treino termina sozinho após esse número de repetições
const TREINOS = {
  flexao: { nome: "Flexão", attr: "def", anim: 1 },
  abdominal: { nome: "Abdominal", attr: "vid", anim: 2 },
  meditar: { nome: "Meditação", attr: "pod", anim: 3 },
  agachamento: { nome: "Agachamento", attr: "sta", anim: 4 },
};
const treinando = new Map(); // idJogador -> estado do treino
const movimentoTreino = new Map();
const ultimaTapa = new Map();
const ultimoAvisoDummy = new Map();

function limparTreino(id) {
  treinando.delete(id);
  movimentoTreino.delete(id);
  ultimaTapa.delete(id);
  ultimoAvisoDummy.delete(id);
}

// liga/desliga a animação do exercício no personagem (0 = nenhuma)
const animTreino = (p, n) => {
  try {
    p.triggerEvent("kny:treino_" + n);
  } catch {}
};
world.afterEvents.playerSpawn.subscribe(({ player }) => {
  limparTreino(player.id);
  animTreino(player, 0);
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  limparTreino(playerId);
  sessoesMenu.delete(playerId);
});
world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
  movimentoTreino.delete(player.id);
  if (treinando.has(player.id)) pararTreino(player, "Treino encerrado ao trocar de dimensão.");
});

const MAX_PASSO_TREINO = 2.5;
const RECARGA_PULO = 10;

function medirTreinoMovimento(p) {
  if (!ehCacadorHumano(p) || estadoBloqueado(p) || treinando.has(p.id) || p.isGliding || p.isFlying) {
    movimentoTreino.delete(p.id);
    return;
  }
  const { x, z } = p.location;
  const agora = system.currentTick;
  const noChao = p.isOnGround;
  const pulando = p.isJumping;
  const nadando = p.isSwimming;
  const anterior = movimentoTreino.get(p.id);
  if (!anterior) {
    movimentoTreino.set(p.id, { x, z, tick: agora, noChao, pulando, correr: 0, nadar: 0, ultimoPulo: -RECARGA_PULO });
    return;
  }
  const distancia = Math.hypot(x - anterior.x, z - anterior.z);
  if (agora - anterior.tick >= 2) {
    anterior.x = x;
    anterior.z = z;
    anterior.tick = agora;
    const tipo = nadando ? "nadar" : p.isSprinting ? "correr" : undefined;
    if (tipo && distancia > 0 && distancia <= MAX_PASSO_TREINO) {
      anterior[tipo] += distancia;
      const metros = Math.floor(anterior[tipo]);
      if (metros > 0) {
        anterior[tipo] -= metros;
        registrarTreinoRespiracao(p, tipo, metros);
      }
    }
  }
  // Um toque curto em Pular pode durar apenas um tick no Bedrock.
  if (pulando && !anterior.pulando && anterior.noChao && !nadando && !p.isInWater &&
      distancia <= MAX_PASSO_TREINO && agora - anterior.ultimoPulo >= RECARGA_PULO) {
    anterior.ultimoPulo = agora;
    registrarTreinoRespiracao(p, "pular", 1);
  }
  anterior.noChao = noChao;
  anterior.pulando = pulando;
}

system.runInterval(() => {
  for (const p of world.getPlayers()) {
    try { medirTreinoMovimento(p); }
    catch (e) { reportar(p, e); }
  }
}, 1);

function contarRepeticao(p, a, origem) {
  const rep = registrarRepeticao(p, a);
  if (rep.concluiu) {
    p.sendMessage(`§aCrédito de ${nomeAtributo(a, p)} para o nível ${rep.nivel}: ${pontosTexto(rep.desconto)} pontos §7(${origem}).`);
    som(p, "random.levelup", 1.2, 0.6);
  }
  return rep;
}

function iniciarTreino(p, tipo) {
  const t = TREINOS[tipo];
  if (!t || p.hasTag("kny_caido")) return;
  const a = ATR[t.attr];
  const oferta = statusAtributo(p, a);
  const limiteAtributo = oferta.proximo === null || oferta.series === SERIES_POR_MELHORIA;
  if (limiteAtributo && !podeTreinarRespiracao(p, tipo)) {
    p.sendMessage("§e" + (oferta.proximo === null ? LIMITE_ATINGIDO : CREDITO_COMPLETO));
    return;
  }
  const l = p.location;
  const h = p.getComponent("minecraft:health");
  treinando.set(p.id, { tipo, x: l.x, z: l.z, acum: 0, reps: 0, vida: h ? h.currentValue : 0 });
  animTreino(p, t.anim);
  p.sendMessage(
    `§e[Treino] §f${t.nome} §7→ ${limiteAtributo ? "meta de respiração" : nomeAtributo(a, p)}\n§7Fique parado: 1 repetição a cada 2 segundos.` +
    (limiteAtributo ? "" : ` A cada ${REPS_POR_PONTO} você ganha crédito para a próxima melhoria.`) +
    '\n§7Para parar: abra o menu > Treino > "Parar treino", ou pule / ande.'
  );
}

function pararTreino(p, motivo) {
  treinando.delete(p.id);
  animTreino(p, 0);
  if (motivo) p.sendMessage(`§e[Treino] §7${motivo}`);
}

system.runInterval(() => {
  if (treinando.size === 0) return;
  const porId = new Map(world.getPlayers().map((x) => [x.id, x]));
  for (const [id, st] of [...treinando]) {
    const p = porId.get(id);
    if (!p || p.hasTag("kny_caido")) {
      treinando.delete(id);
      if (p) animTreino(p, 0);
      continue;
    }
    const t = TREINOS[st.tipo];
    const a = ATR[t.attr];
    const l = p.location;
    if (Math.hypot(l.x - st.x, l.z - st.z) > 1.2 || p.isSprinting) {
      pararTreino(p, "Treino encerrado: você saiu do lugar.");
      continue;
    }
    let vy = 0;
    try {
      vy = p.getVelocity().y;
    } catch {}
    if (vy > 0.3) {
      pararTreino(p, "Treino encerrado: você pulou.");
      continue;
    }
    const h = p.getComponent("minecraft:health");
    if (h) {
      if (h.currentValue < st.vida - 0.01) {
        pararTreino(p, "Treino encerrado: você foi ferido.");
        continue;
      }
      st.vida = h.currentValue;
    }
    st.acum += 2;
    if (st.acum < TICKS_POR_REP) continue;
    st.acum -= TICKS_POR_REP;
    st.reps++;
    const rep = contarRepeticao(p, a, t.nome);
    registrarTreinoRespiracao(p, st.tipo, 1);
    if (rep.motivo !== "ok" || rep.series >= SERIES_POR_MELHORIA) {
      if (podeTreinarRespiracao(p, st.tipo)) {
        p.onScreenDisplay.setActionBar(`§a${t.nome} §7(Respirações) §f${st.reps} repetições nesta sessão`);
        continue;
      }
      const aviso = rep.motivo === "limite" ? LIMITE_ATINGIDO : CREDITO_COMPLETO;
      pararTreino(p, rep.motivo === "indisponivel" ? undefined : aviso);
      continue;
    }
    som(p, "random.click", 1.4, 0.4);
    p.onScreenDisplay.setActionBar(
      rep.concluiu
        ? `§aCrédito de ${nomeAtributo(a, p)}: ${pontosTexto(rep.desconto)} pontos`
        : `§e${t.nome} §7(${nomeAtributo(a, p)}) §f${rep.reps}/${REPS_POR_PONTO}  ${barra(rep.reps, REPS_POR_PONTO, 10, "§a")}`
    );
    if (MAX_REPS_SESSAO > 0 && st.reps >= MAX_REPS_SESSAO) pararTreino(p, "Treino concluído.");
  }
}, 2);

// ---------------- dummy de treino: 1 ponto de Força a cada 5 tapas ----------------
const removidos = new Set(); // dummies despawnados pelo botão (não renascem)
const posDummy = new Map(); // id -> { dim, x, y, z }
const DIMENSOES = ["overworld", "nether", "the_end"];

function fixarDummy(e) {
  const l = e.location;
  try {
    e.setDynamicProperty("kny_fx", l.x);
    e.setDynamicProperty("kny_fy", l.y);
    e.setDynamicProperty("kny_fz", l.z);
  } catch {}
  posDummy.set(e.id, { dim: e.dimension.id.replace("minecraft:", ""), x: l.x, y: l.y, z: l.z });
}

// o dummy é imortal e não sai do lugar: a cada meio segundo cura a vida e volta à posição fixa
system.runInterval(() => {
  for (const nome of DIMENSOES) {
    let lista = [];
    try {
      lista = world.getDimension(nome).getEntities({ type: "kny:dummy_treino" });
    } catch {
      continue;
    }
    for (const e of lista) {
      try {
        const h = e.getComponent("minecraft:health");
        if (h && h.currentValue < h.effectiveMax) h.resetToMaxValue();
        const fx = e.getDynamicProperty("kny_fx");
        if (fx === undefined) {
          fixarDummy(e);
          continue;
        }
        const fy = e.getDynamicProperty("kny_fy");
        const fz = e.getDynamicProperty("kny_fz");
        const l = e.location;
        if (Math.abs(l.x - fx) > 0.05 || Math.abs(l.y - fy) > 0.05 || Math.abs(l.z - fz) > 0.05) {
          e.teleport({ x: fx, y: fy, z: fz }, { keepVelocity: false });
        }
        posDummy.set(e.id, { dim: nome, x: fx, y: fy, z: fz });
      } catch {}
    }
  }
}, 10);

// se por algum motivo (/kill, vazio...) o dummy morrer, ele renasce no mesmo lugar
world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (e?.typeId !== "kny:dummy_treino") return;
  if (removidos.delete(e.id)) return;
  const r = posDummy.get(e.id);
  posDummy.delete(e.id);
  if (!r) return;
  system.runTimeout(() => {
    try {
      const novo = world.getDimension(r.dim).spawnEntity("kny:dummy_treino", { x: r.x, y: r.y, z: r.z });
      fixarDummy(novo);
    } catch {}
  }, 2);
});

// qualquer dano (inclusive dano extra do addon) é desfeito na hora
world.afterEvents.entityHurt.subscribe((ev) => {
  if (ev.hurtEntity?.typeId !== "kny:dummy_treino") return;
  try {
    ev.hurtEntity.getComponent("minecraft:health")?.resetToMaxValue();
  } catch {}
});

world.afterEvents.entityHitEntity.subscribe((ev) => {
  const alvo = ev.hitEntity;
  const p = ev.damagingEntity;
  if (alvo?.typeId !== "kny:dummy_treino" || p?.typeId !== "minecraft:player" || p.hasTag("kny_caido")) return;
  const agora = system.currentTick;
  if (agora - (ultimaTapa.get(p.id) ?? -10) < 5) return;
  ultimaTapa.set(p.id, agora);
  const a = ATR.for;
  const r = contarRepeticao(p, a, "dummy");
  registrarTreinoRespiracao(p, "dummy", 1);
  if (r.motivo !== "ok") {
    if (r.motivo !== "indisponivel" && agora - (ultimoAvisoDummy.get(p.id) ?? -100) >= 60) {
      p.sendMessage("§e" + (r.motivo === "limite" ? LIMITE_ATINGIDO : CREDITO_COMPLETO));
      ultimoAvisoDummy.set(p.id, agora);
    }
    return;
  }
  som(p, "mob.zombie.wood", 1.5, 0.5);
  p.onScreenDisplay.setActionBar(
    r.concluiu ? `§aCrédito de Força: ${pontosTexto(r.desconto)} pontos`
      : `§6Dummy §7(Força) §f${r.reps}/${TAPAS_POR_PONTO}  ${barra(r.reps, TAPAS_POR_PONTO, 10, "§6")}`
  );
});

const dummiesPerto = (p) => p.dimension.getEntities({ type: "kny:dummy_treino", location: p.location, maxDistance: 6 });

function colocarDummy(p) {
  const d = p.getViewDirection();
  const len = Math.hypot(d.x, d.z) || 1;
  const pos = { x: p.location.x + (d.x / len) * 1.6, y: p.location.y, z: p.location.z + (d.z / len) * 1.6 };
  try {
    const e = p.dimension.spawnEntity("kny:dummy_treino", pos);
    fixarDummy(e);
    p.sendMessage("§6[Dummy] §7Dummy colocado. Ele é imortal e só sai do lugar pelo botão de despawnar. A cada 5 tapas: crédito para a próxima melhoria de Força.");
  } catch {
    p.sendMessage("§cNão foi possível colocar o dummy aqui.");
  }
}

function despawnarDummies(p) {
  let n = 0;
  for (const e of dummiesPerto(p)) {
    removidos.add(e.id);
    posDummy.delete(e.id);
    try {
      e.remove();
    } catch {
      try {
        e.kill();
      } catch {}
    }
    n++;
  }
  p.sendMessage(n > 0 ? `§6[Dummy] §7${n} dummy despawnado(s).` : "§7Nenhum dummy por perto (até 6 blocos).");
}

// menu de treinamento (moldura com 6 barras e área grande de texto)
async function painelTreino(p) {
  const acoes = [];
  const f = new ActionFormData().title(`${MARCA_ARTE}§lTREINAMENTO`).body(" ");
  const add = (prefixo, texto, acao) => {
    f.button(prefixo + texto);
    acoes.push(acao ?? null);
  };
  const ativo = treinando.get(p.id);
  add("B:", TXT_VOLTAR, () => menuPrincipal(p));
  add(
    "G:",
    ativo
      ? `§l§aTreinando: ${TREINOS[ativo.tipo].nome}§r\n§7Repetições nesta sessão: §f${ativo.reps}\n§7Para parar toque em "Parar treino", ou pule / ande.`
      : `§lTreinamento§r\n§7Escolha um exercício. O personagem faz 1 repetição a cada 2 segundos; a cada ${REPS_POR_PONTO} repetições, recebe ${CREDITO_POR_SERIE}% de crédito na próxima melhoria. Até ${SERIES_POR_MELHORIA} séries por melhoria.\n§7O dummy dá crédito de Força a cada ${TAPAS_POR_PONTO} tapas.\n§8Dica: use a câmera em 3ª pessoa para ver o exercício.`
  );
  for (const tipo of ["flexao", "abdominal", "meditar", "agachamento"]) {
    const t = TREINOS[tipo];
    const a = ATR[t.attr];
    const em = ativo?.tipo === tipo;
    const oferta = statusAtributo(p, a);
    add(
      "L:",
      `${em ? "§a> " : ""}§f§l${t.nome} §7→ ${nomeAtributo(a, p)}\n§r§7${textoTreino(oferta, REPS_POR_PONTO)}`,
      () => {
        if (em) pararTreino(p, "Treino parado.");
        else iniciarTreino(p, tipo);
      }
    );
  }
  const aF = ATR.for;
  const temDummy = dummiesPerto(p).length > 0;
  const ofertaForca = statusAtributo(p, aF);
  add(
    "L:",
    `${temDummy ? "§c§lDespawnar dummy próximo" : "§f§lColocar dummy de treino"}\n§r§7Força · ${textoTreino(ofertaForca, TAPAS_POR_PONTO)}`,
    () => {
      if (temDummy) despawnarDummies(p);
      else colocarDummy(p);
      return painelTreino(p);
    }
  );
  add("L:", ativo ? "§c§lParar treino\n§r§7Encerra o exercício atual" : "§8§lParar treino\n§r§8Nenhum treino ativo", () => {
    if (ativo) pararTreino(p, "Treino parado.");
    return painelTreino(p);
  });

  const res = await mostrar(f, p);
  if (res.canceled) {
    if (res.cancelationReason === undefined) return treinoClassico(p);
    return;
  }
  const acao = acoes[res.selection];
  if (!acao) return painelTreino(p);
  return acao();
}

async function treinoClassico(p) {
  const t = tema(p);
  const f = novoForm(p)
    .title(t.titulo)
    .body(`${t.texto}Séries de ${REPS_POR_PONTO} repetições ou ${TAPAS_POR_PONTO} tapas no dummy. Cada série dá ${CREDITO_POR_SERIE}% de crédito na próxima melhoria, até ${SERIES_POR_MELHORIA} séries.`);
  const ordem = ["flexao", "abdominal", "meditar", "agachamento"];
  for (const tipo of ordem) {
    const a = ATR[TREINOS[tipo].attr];
    const texto = textoTreino(statusAtributo(p, a), REPS_POR_PONTO);
    f.button(`§l${t.destaque}${TREINOS[tipo].nome}\n§r${t.suave}${texto}`, t.icones.status);
  }
  f.button(`§l${t.destaque}Colocar dummy\n§r${t.suave}Força`, t.icones.status);
  f.button(`§l${t.destaque}Despawnar dummy\n§r${t.suave}Próximos`, t.icones.status);
  f.button(`§l${t.destaque}Parar treino`, t.icones.status);
  f.button(`§l${t.destaque}Voltar`, t.icones.voltar);
  const res = await mostrar(f, p);
  if (res.canceled) return;
  if (ordem[res.selection]) return iniciarTreino(p, ordem[res.selection]);
  if (res.selection === 4) colocarDummy(p);
  else if (res.selection === 5) despawnarDummies(p);
  else if (res.selection === 6) pararTreino(p, "Treino parado.");
  else return menuPrincipal(p);
  return treinoClassico(p);
}

// Recompensa de status pelos Onis já contabilizados na v69.
const ultimoAtacanteOni = new Map(); // idDoOni -> { id: idDoJogador, tick }

world.afterEvents.entityHurt.subscribe((ev) => {
  const alvo = ev.hurtEntity;
  if (!alvo || !PONTOS_POR_ONI.has(alvo.typeId)) return;
  const atk = ev.damageSource?.damagingEntity;
  if (atk?.typeId === "minecraft:player") {
    if (ultimoAtacanteOni.size > 300) {
      for (const [k, v] of ultimoAtacanteOni) if (system.currentTick - v.tick > 1200) ultimoAtacanteOni.delete(k);
    }
    ultimoAtacanteOni.set(alvo.id, { id: atk.id, tick: system.currentTick });
  }
});

world.afterEvents.entityDie.subscribe((ev) => {
  const morto = ev.deadEntity;
  if (!morto || !PONTOS_POR_ONI.has(morto.typeId)) return;
  let jogador = ev.damageSource?.damagingEntity;
  if (jogador?.typeId !== "minecraft:player") jogador = undefined;
  const reg = ultimoAtacanteOni.get(morto.id);
  ultimoAtacanteOni.delete(morto.id);
  if (!jogador && reg && system.currentTick - reg.tick <= 400) jogador = world.getPlayers().find((x) => x.id === reg.id);
  if (!jogador || jogador.hasTag("kny_caido")) return;
  const ganho = premiarOni(jogador, morto.typeId);
  registrarTreinoRespiracao(jogador, "oni", 1);
  if (ganho > 0) {
    jogador.sendMessage(`§a+${pontosTexto(ganho)} pontos de atributo §7(oni derrotado)`);
    som(jogador, "random.orb", 1.3, 0.5);
  }
});

/* ---------------------------------------------------------------------
   STAMINA: correr e lutar gastam; parado recupera. Zerada = exausto
   (mais lento, mais fraco e sem usar respirações até recuperar).
--------------------------------------------------------------------- */

const STAMINA_CORRIDA = 3; // gasto a cada 0,5 s correndo
const STAMINA_REGEN = 4; // recuperação a cada 0,5 s

system.runInterval(() => {
  for (const p of world.getPlayers()) {
    try {
      atualizarStats(p);
      const { max, atual } = staminaDe(p);
      let st = atual;
      if (p.isSprinting) st -= STAMINA_CORRIDA;
      else st += STAMINA_REGEN;
      st = Math.max(0, Math.min(max, st));

      let exausto = getScore(p, "kny_exausto") === 1;
      if (!exausto && st <= 0) exausto = true;
      else if (exausto && st >= max * 0.2) exausto = false;

      if (st !== lerBruto(p, "kny_stam")) pontuar(p, "kny_stam", st);
      if (exausto !== (getScore(p, "kny_exausto") === 1)) {
        pontuar(p, "kny_exausto", exausto ? 1 : 0);
        if (exausto) p.sendMessage("§cVocê está exausto! Descanse para recuperar a stamina.");
      }
      if (exausto) {
        p.addEffect("slowness", 40, { amplifier: 1, showParticles: false });
        p.addEffect("weakness", 40, { amplifier: 0, showParticles: false });
      }
    } catch {}
  }
}, 10);

// golpes comuns (no ar ou em oni) NÃO gastam fôlego: ele só é gasto ao usar habilidades (animation_controllers)

// Ajusta o mesmo golpe antes da aplicação, inclusive quando ele seria letal.
const CAUSAS_SEM_STATS = new Set(["override", "selfDestruct", "void"]);
world.beforeEvents.entityHurt.subscribe((ev) => {
  try {
    const { damageSource, hurtEntity: vitima, damage } = ev;
    if (ev.cancel || !Number.isFinite(damage) || damage <= 0 || CAUSAS_SEM_STATS.has(damageSource.cause)) return;
    if (vitima.typeId === "kny:dummy_treino") return;
    const atacante = damageSource.damagingEntity;
    if (atacante?.typeId === "minecraft:player" && atacante.hasTag("kny_caido")) return;

    let ataque = 1;
    if (atacante?.typeId === "minecraft:player" && atacante.id !== vitima.id) {
      const a = efetivos(atacante);
      const forca = efeitoForca(a.for.nivel);
      const especial = damageSource.cause === "magic" && danoEspecialEmCurso(atacante, vitima);
      const poder = (especial || ehTecnica(itemNaMao(atacante), atacante)) ? efeitoPoder(a.pod.nivel) : 0;
      ataque += (forca + poder) / 100;
    }
    const defesa = vitima.typeId === "minecraft:player" && !vitima.hasTag("kny_caido")
      ? reducaoDefesa(efetivo(vitima, ATR.def))
      : 0;
    if (ataque !== 1 || defesa !== 0) ev.damage = damage * ataque * (1 - defesa);
  } catch {}
});

/* ---------------------------------------------------------------------
   TELAS DE STATUS
--------------------------------------------------------------------- */

function valorAtributo(oferta) {
  return `${oferta.nivel}/${oferta.limite}${oferta.proximo === null ? " — MAX" : ""}`;
}

function proximaCompraTexto(oferta) {
  if (oferta.proximo === null) return "evolua de patente";
  return `Nível ${oferta.proximo}: ${pontosTexto(oferta.custo)} pts`;
}

function textoTreino(oferta, reps) {
  if (oferta.proximo === null) return valorAtributo(oferta);
  return `${oferta.reps}/${reps} · ${oferta.series * CREDITO_POR_SERIE}% de crédito`;
}

function mensagemRedistribuicao(p, chave) {
  try {
    const r = resetarAtributos(p, chave);
    if (r.motivo === "desatualizado") p.sendMessage("§e" + STATUS_ATUALIZADO);
    else if (r.motivo !== "ok") p.sendMessage("§cRedistribuição indisponível.");
    else if (r.pontos > 0) p.sendMessage(`§7Pontos de atributo devolvidos: ${pontosTexto(r.pontos)}.`);
    else p.sendMessage("§7Nenhuma compra ativa para redistribuir.");
  } catch (e) {
    reportar(p, e);
  }
}

async function statusMenu(p) {
  const t = tema(p);
  atualizarStats(p);
  const sta = staminaDe(p);
  let c = `${t.linha}\n${t.suave}Vida: ${t.texto}${vidaTexto(p)}\n`;
  c += `${t.suave}Pontos de atributo: ${t.texto}${pontosTexto(disponiveis(p))}\n`;
  c += `${t.suave}Patente: ${t.texto}${patenteDe(p).nome}\n`;
  c += `${t.suave}Stamina: ${t.texto}${Math.floor(sta.atual)}/${sta.max}\n`;
  const fol = folegoDe(p);
  c += `${t.suave}Fôlego: ${t.texto}${fol.atual}/${fol.max} §8(agache para recarregar)\n`;
  c += `${t.linha}\n`;
  const ofertas = ATRIBUTOS.map((a) => [a, statusAtributo(p, a)]);
  for (const [a, oferta] of ofertas) {
    c += `${t.destaque}${nomeAtributo(a, p)}: ${t.texto}${valorAtributo(oferta)}\n${t.suave}  ${descEfeito(a, oferta.nivel, p)}\n${t.suave}  ${proximaCompraTexto(oferta)}\n`;
  }

  const f = novoForm(p)
    .title(isOni(p) ? "§l§4STATUS" : "§l§cSTATUS")
    .body(c)
    .button(`§l${t.destaque}Voltar`, t.icones.voltar);
  for (const [a, oferta] of ofertas) {
    f.button(`§l${t.destaque}${nomeAtributo(a, p)}\n§r${t.suave}${valorAtributo(oferta)} · ${proximaCompraTexto(oferta)}`, t.icones.status);
  }
  const chave = chaveRedistribuicao(p);
  f.button(`§l${t.destaque}Redistribuir pontos\n§r${t.suave}Devolve compras ativas`, t.icones.config);

  const res = await mostrar(f, p);
  if (res.canceled) return;
  if (res.selection === 0) return menuPrincipal(p);
  if (res.selection === ATRIBUTOS.length + 1) {
    mensagemRedistribuicao(p, chave);
    if (p.isValid) return statusMenu(p);
  }
  const a = ATRIBUTOS[res.selection - 1];
  if (a) return atributoMenu(p, a);
}

function confirmarCompra(p, a, quantidade, oferta) {
  if (!p.isValid) return;
  try {
    const r = comprar(p, a, quantidade, oferta);
    switch (r.motivo) {
      case "ok":
        p.sendMessage(`§a${nomeAtributo(a, p)} evoluiu para o nível ${r.nivel}!`);
        p.sendMessage(`§7Custo ${r.feitas === 1 ? "da melhoria" : "das melhorias"}: ${pontosTexto(r.gasto)} pontos.`);
        som(p, "random.orb", 1.3, 0.5);
        break;
      case "limite":
        p.sendMessage("§c" + LIMITE_ATINGIDO);
        break;
      case "saldo":
        p.sendMessage("§cVocê não possui pontos suficientes para melhorar este atributo.");
        p.sendMessage(`§7Necessário: ${pontosTexto(r.custo)} pontos. Disponível: ${pontosTexto(r.saldo)} pontos.`);
        break;
      case "desatualizado":
        p.sendMessage("§e" + STATUS_ATUALIZADO);
        break;
      default:
        p.sendMessage("§cMelhoria indisponível.");
    }
  } catch (e) {
    reportar(p, e);
  }
}

async function atributoMenu(p, a) {
  const t = tema(p);
  atualizarStats(p);
  const oferta = statusAtributo(p, a);
  const max = oferta.proximo === null;
  const credito = oferta.desconto > 0 ? `\n${t.suave}Preço base: ${pontosTexto(oferta.custoBase)} pts\n${t.suave}Crédito de treino: ${pontosTexto(oferta.desconto)} pts` : "";
  const corpo =
    `${t.linha}\n${t.texto}§l${nomeAtributo(a, p)}§r\n${t.linha}\n` +
    `${t.suave}Pontos neste atributo: ${t.texto}${valorAtributo(oferta)}\n` +
    `${t.suave}Efeito: ${t.texto}${descEfeito(a, oferta.nivel, p)}\n` +
    `${t.suave}Pontos de atributo: ${t.texto}${pontosTexto(disponiveis(p))}\n` +
    `${t.suave}Patente: ${t.texto}${patenteDe(p).nome}\n` +
    `${t.suave}${max ? LIMITE_ATINGIDO : proximaCompraTexto(oferta)}${credito}\n` +
    t.linha;

  const passos = [1, 3, 5];
  const f = novoForm(p)
    .title(`§l${t.destaque}${nomeAtributo(a, p).toUpperCase()}`)
    .body(corpo)
    .button(`§l${t.destaque}Voltar`, t.icones.voltar);
  for (const n of passos) f.button(`§l${t.destaque}Melhorar ${n}x`, t.icones.status);
  f.button(`§l${t.destaque}Máximo possível`, t.icones.status);

  const res = await mostrar(f, p);
  if (res.canceled) return;
  if (res.selection === 0) return statusMenu(p);
  const quantidade = res.selection === passos.length + 1 ? NIVEL_MAXIMO : passos[res.selection - 1];
  if (quantidade === undefined) return;
  confirmarCompra(p, a, quantidade, oferta);
  if (p.isValid) return atributoMenu(p, a);
}

/* ---------------------------------------------------------------------
   LÂMINAS COLORIDAS (Nichirin)
   Ao usar a Nichirin Blade a lâmina muda de cor, como no anime. Cada cor dá
   bônus enquanto está na mão; quanto mais rara, mais forte (preta = a mais forte).
   Todas as cores usam a Respiração Básica (3 habilidades).
--------------------------------------------------------------------- */

// [efeito, nível]  (nível 0 = I, 1 = II)
const LAMINAS = [
  { id: "cinza", nome: "Cinza", chance: "24%", desc: "Velocidade I", efeitos: [["speed", 0]] },
  { id: "azul", nome: "Azul", chance: "20%", desc: "Velocidade I e Pulo I", efeitos: [["speed", 0], ["jump_boost", 0]] },
  { id: "verde", nome: "Verde", chance: "16%", desc: "Velocidade I e Pulo II", efeitos: [["speed", 0], ["jump_boost", 1]] },
  { id: "amarela", nome: "Amarela", chance: "12%", desc: "Velocidade II", efeitos: [["speed", 1]] },
  { id: "laranja", nome: "Laranja", chance: "9%", desc: "Velocidade I e Força I", efeitos: [["speed", 0], ["strength", 0]] },
  { id: "vermelha", nome: "Vermelha", chance: "7%", desc: "Força I e Resistência ao fogo", efeitos: [["strength", 0], ["fire_resistance", 0]] },
  { id: "rosa", nome: "Rosa", chance: "5%", desc: "Velocidade I e Regeneração I", efeitos: [["speed", 0], ["regeneration", 0]] },
  { id: "roxa", nome: "Roxa", chance: "3,5%", desc: "Velocidade II, Pulo I e Visão noturna", efeitos: [["speed", 1], ["jump_boost", 0], ["night_vision", 0]] },
  { id: "branca", nome: "Branca", chance: "2%", desc: "Velocidade II, Força II e Visão noturna", efeitos: [["speed", 1], ["strength", 1], ["night_vision", 0]] },
  {
    id: "preta", nome: "Preta", chance: "1,5%",
    desc: "Velocidade II, Força II, Pulo II, Visão noturna, Resistência I e Regeneração I",
    efeitos: [["speed", 1], ["strength", 1], ["jump_boost", 1], ["night_vision", 0], ["resistance", 0], ["regeneration", 0]],
  },
];
const LAMINA_POR_ITEM = {};
for (const l of LAMINAS) LAMINA_POR_ITEM[`kny:lamina_${l.id}`] = l;

function ehTecnica(it, p) {
  const d = racaHibrida(p);
  if (d) return canUseBreathing(p, d.resp, it, 1) || canUseKekkijutsu(p, d.arte, it);
  return !!it && !!(ITEM_OBJ[it.typeId] || LAMINA_POR_ITEM[it.typeId]);
}
const laminaNaMao = (p) => {
  const it = itemNaMao(p);
  return it ? LAMINA_POR_ITEM[it.typeId] : undefined;
};

// bônus enquanto a lâmina está na mão
system.runInterval(() => {
  for (const p of world.getPlayers()) {
    try {
      const l = laminaNaMao(p);
      if (!l) continue;
      for (const [efeito, nivel] of l.efeitos) {
        p.addEffect(efeito, efeito === "night_vision" ? 300 : 60, { amplifier: nivel, showParticles: false });
      }
    } catch {}
  }
}, 20);

/* ---------------------------------------------------------------------
   HABILIDADES DA RESPIRAÇÃO BÁSICA (animadas)
   O controller só marca uma tag (kny_bas1/2/3); aqui acontece o golpe de verdade:
   avanço do caçador, rastro de partículas na cor da lâmina e dano em área.
--------------------------------------------------------------------- */

const BASICA_RECARGA = 14; // ticks entre uma habilidade e outra
const recargaBasica = new Map();

const direcaoHorizontal = (p) => {
  const v = p.getViewDirection();
  const h = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / h, z: v.z / h };
};
const girarGraus = (d, graus) => {
  const r = (graus * Math.PI) / 180;
  return { x: d.x * Math.cos(r) - d.z * Math.sin(r), z: d.x * Math.sin(r) + d.z * Math.cos(r) };
};
const particulaDaLamina = (p) => {
  const l = laminaNaMao(p);
  return `kny:corte_${l ? l.id : "cinza"}`;
};

function brilho(p, id, x, y, z) {
  try {
    p.dimension.spawnParticle(id, { x, y, z });
  } catch {}
}

// só demônios e monstros são atingidos (aliados e jogadores não)
function alvosDaBasica(p, centro, raio) {
  const vistos = new Set();
  const lista = [];
  for (const fam of ["demon", "monster"]) {
    let es = [];
    try {
      es = p.dimension.getEntities({ location: centro, maxDistance: raio, families: [fam], excludeFamilies: ["hit"] });
    } catch {}
    for (const e of es) {
      if (e.id === p.id || e.typeId === "minecraft:player" || vistos.has(e.id)) continue;
      vistos.add(e.id);
      lista.push(e);
    }
  }
  return lista;
}

function golpeBasico(p, e, dano, dx, dz, forca) {
  try {
    e.applyDamage(dano, { cause: "entityAttack", damagingEntity: p });
  } catch {}
  try {
    knockback(e, dx, dz, forca, 0.35);
  } catch {}
  const l = e.location;
  const id = particulaDaLamina(p);
  for (let i = 0; i < 4; i++) brilho(p, id, l.x + (Math.random() - 0.5) * 0.6, l.y + 0.6 + Math.random() * 0.8, l.z + (Math.random() - 0.5) * 0.6);
}

function executarBasica(p, n) {
  const id = particulaDaLamina(p);
  const f = direcaoHorizontal(p);
  const o = { x: p.location.x, y: p.location.y, z: p.location.z };
  const altura = o.y + 1.1;

  if (n === 1) {
    // CORTE BÁSICO: avança e corta num arco à frente, da esquerda para a direita
    som(p, "item.trident.throw", 1.5, 0.9);
    try {
      knockback(p, f.x, f.z, 0.6, 0.05);
    } catch {}
    for (let t = 0; t < 6; t++) {
      system.runTimeout(() => {
        for (let k = 0; k < 3; k++) {
          const d = girarGraus(f, 75 - t * 25 - k * 8);
          for (const r of [1.6, 2.2, 2.8]) brilho(p, id, o.x + d.x * r, altura + 0.12 * k, o.z + d.z * r);
        }
      }, t);
    }
    system.runTimeout(() => {
      for (const e of alvosDaBasica(p, p.location, 3.6)) {
        const dx = e.location.x - p.location.x;
        const dz = e.location.z - p.location.z;
        const dist = Math.hypot(dx, dz) || 1;
        if ((dx * f.x + dz * f.z) / dist < 0.3) continue; // só quem está à frente
        golpeBasico(p, e, 5, dx / dist, dz / dist, 0.9);
      }
    }, 2);
    return;
  }

  if (n === 2) {
    // GIRO NICHIRIN: onda circular que se expande em volta do caçador
    som(p, "item.trident.throw", 0.8, 0.9);
    for (let t = 0; t < 8; t++) {
      system.runTimeout(() => {
        const raio = 1.2 + t * 0.4;
        for (let a = 0; a < 360; a += 30) {
          const d = girarGraus({ x: 1, z: 0 }, a + t * 22);
          brilho(p, id, o.x + d.x * raio, altura, o.z + d.z * raio);
        }
      }, t);
    }
    system.runTimeout(() => som(p, "item.trident.throw", 1.1, 0.8), 4);
    system.runTimeout(() => {
      for (const e of alvosDaBasica(p, p.location, 4.3)) {
        const dx = e.location.x - p.location.x;
        const dz = e.location.z - p.location.z;
        const dist = Math.hypot(dx, dz) || 1;
        golpeBasico(p, e, 6, dx / dist, dz / dist, 1.1);
      }
    }, 3);
    return;
  }

  // ESTOCADA VELOZ: investida em linha reta, com rastro e dano a todos no caminho
  som(p, "item.trident.throw", 1.9, 1);
  try {
    knockback(p, f.x, f.z, 1.7, 0.1);
  } catch {}
  for (let t = 0; t < 4; t++) {
    system.runTimeout(() => {
      for (let d = t * 1.8; d < (t + 1) * 1.8; d += 0.45) {
        brilho(p, id, o.x + f.x * d, altura, o.z + f.z * d);
        brilho(p, id, o.x + f.x * d - f.z * 0.35, altura + 0.1, o.z + f.z * d + f.x * 0.35);
        brilho(p, id, o.x + f.x * d + f.z * 0.35, altura - 0.1, o.z + f.z * d - f.x * 0.35);
      }
    }, t);
  }
  system.runTimeout(() => {
    for (const e of alvosDaBasica(p, o, 8)) {
      const dx = e.location.x - o.x;
      const dz = e.location.z - o.z;
      const frente = dx * f.x + dz * f.z;
      const lado = Math.abs(dx * -f.z + dz * f.x);
      if (frente < 0 || frente > 7.5 || lado > 1.7) continue;
      golpeBasico(p, e, 8, f.x, f.z, 1.2);
    }
  }, 2);
}

system.runInterval(() => {
  for (const p of world.getPlayers()) {
    try {
      for (const n of [1, 2, 3]) {
        const tag = `kny_bas${n}`;
        if (!p.hasTag(tag)) continue;
        p.removeTag(tag);
        if (system.currentTick - (recargaBasica.get(p.id) ?? -100) < BASICA_RECARGA) continue;
        if (getScore(p, "kny_exausto") === 1) continue;
        recargaBasica.set(p.id, system.currentTick);
        executarBasica(p, n);
      }
    } catch (e) {
      reportar(p, e);
    }
  }
}, 2);

/* ---------------------------------------------------------------------
   ENSINAR RESPIRAÇÃO: uma habilidade por vez
--------------------------------------------------------------------- */

function alunosPerto(p, g) {
  const lista = [];
  for (const q of world.getPlayers()) {
    try {
      if (q.id === p.id || q.dimension.id !== p.dimension.id) continue;
      if (!ehCacadorHumano(q) || estadoBloqueado(q)) continue;
      if (!ehLider(p) && (!DOMINAVEL(g.obj) || !["hashira", "hashira_lider"].includes(patenteDe(q).tag))) continue;
      const d = Math.hypot(q.location.x - p.location.x, q.location.y - p.location.y, q.location.z - p.location.z);
      if (d <= DIST_ENSINO && requisitosProximaForma(q, g.obj).k > 0) lista.push(q);
    } catch {}
  }
  return lista;
}

async function ensinarClassico(p) {
  const t = TEMA_CACADOR;
  if (!ehLider(p) && !ehHashira(p)) return;
  const f = novoForm(p)
    .title("§l§cENSINAR RESPIRAÇÃO")
    .body(
      `${t.linha}\n${t.suave}Escolha a respiração. A aula registra uma forma por vez, em ordem. O aluno precisa estar a até ${DIST_ENSINO} blocos.\n${t.linha}`
    )
    .button(`§l${t.destaque}Voltar`, t.icones.voltar);
  const acoes = ["voltar"];
  for (const g of TODAS_RESPIRACOES) {
    f.button(`§l${t.destaque}${g.nome}\n§r${t.suave}${g.formas.length} habilidades`, g.icon);
    acoes.push(g);
  }

  const res = await mostrar(f, p);
  if (res.canceled) return;
  const a = acoes[res.selection];
  if (a === "voltar") return menuPrincipal(p);
  if (a) return escolherAluno(p, a);
}

async function escolherAlunoClassico(p, g) {
  const t = TEMA_CACADOR;
  const alunos = alunosPerto(p, g).map((aluno) => ({ aluno, ...requisitosProximaForma(aluno, g.obj) }));
  const f = novoForm(p).title(`§l§c${g.nome.toUpperCase()}`);
  if (alunos.length === 0) {
    f.body(
      `${t.linha}\n§cNenhum caçador por perto para ensinar.\n${t.suave}O aluno deve estar a até ${DIST_ENSINO} blocos, ter assinado o contrato e ainda ter habilidades desta respiração para aprender.\n${t.linha}`
    ).button(`§l${t.destaque}Voltar`, t.icones.voltar);
    const r = await mostrar(f, p);
    if (!r.canceled) return ensinar(p);
    return;
  }
  f.body(`${t.linha}\n${t.suave}Quem vai aprender a próxima habilidade da ${g.nome}?\n${t.linha}`).button(`§l${t.destaque}Voltar`, t.icones.voltar);
  for (const { aluno, k, faltas } of alunos) {
    f.button(`§l${t.destaque}${aluno.name}\n§r${t.suave}aula ${k}/${g.formas.length}${faltas.length ? " · requisitos pendentes" : ""}`, t.icones.personagem);
  }

  const res = await mostrar(f, p);
  if (res.canceled) return;
  if (res.selection === 0) return ensinar(p);
  const escolhido = alunos[res.selection - 1];
  if (escolhido) return ensinarPara(p, escolhido.aluno, g, escolhido.k);
}

// Aulas no painel com as mesmas permissões da interface clássica.
async function painelEnsinar(p, pagina = 0) {
  const lista = TODAS_RESPIRACOES;
  const paginar = lista.length > 6;
  const porPag = paginar ? 5 : 6;
  const total = Math.max(1, Math.ceil(lista.length / porPag));
  pagina = ((pagina % total) + total) % total;
  const itens = lista.slice(pagina * porPag, pagina * porPag + porPag);
  const acoes = [];
  const f = new ActionFormData().title(`${MARCA_ARTE}§lENSINAR RESPIRAÇÃO`).body(" ");
  const add = (prefixo, texto, icone, acao) => {
    if (icone) f.button(prefixo + texto, icone);
    else f.button(prefixo + texto);
    acoes.push(acao ?? null);
  };
  add("B:", TXT_VOLTAR, null, () => menuPrincipal(p));
  add(
    "G:",
    `§lEnsinar respiração§r\n§7Escolha a respiração. Cada aluno aprende uma habilidade por vez, em ordem, se cumprir os requisitos. Ele precisa estar a até ${DIST_ENSINO} blocos.`,
    itens[0]?.icon,
    null
  );
  for (const g of itens) {
    add("L:", `§f§l${g.nome}\n§r§7${g.formas.length} habilidades`, null, () => {
      ultimaPagEnsino.set(p.id, pagina);
      return painelAlunos(p, g, 0);
    });
  }
  if (paginar) add("L:", `§6§lPróxima página §7(${pagina + 1}/${total})`, null, () => painelEnsinar(p, pagina + 1));

  const res = await mostrar(f, p);
  if (res.canceled) {
    if (res.cancelationReason === undefined) return ensinarClassico(p);
    return;
  }
  const acao = acoes[res.selection];
  if (!acao) return painelEnsinar(p, pagina);
  return acao();
}

async function painelAlunos(p, g, pagina = 0) {
  const alunos = alunosPerto(p, g);
  const paginar = alunos.length > 6;
  const porPag = paginar ? 5 : 6;
  const total = Math.max(1, Math.ceil(alunos.length / porPag));
  pagina = ((pagina % total) + total) % total;
  const itens = alunos.slice(pagina * porPag, pagina * porPag + porPag);
  const acoes = [];
  const f = new ActionFormData().title(`${MARCA_ARTE}§l${g.nome.toUpperCase()}`).body(" ");
  const add = (prefixo, texto, icone, acao) => {
    if (icone) f.button(prefixo + texto, icone);
    else f.button(prefixo + texto);
    acoes.push(acao ?? null);
  };
  add("B:", TXT_VOLTAR, null, () => painelEnsinar(p, ultimaPagEnsino.get(p.id) ?? 0));
  add(
    "G:",
    alunos.length === 0
      ? `§l${g.nome}§r\n§cNenhum caçador por perto para ensinar.\n§7O aluno deve estar a até ${DIST_ENSINO} blocos, ter assinado o contrato e ainda ter habilidades desta respiração para aprender.`
      : `§l${g.nome}§r\n§7Quem vai aprender a próxima habilidade?`,
    g.icon,
    null
  );
  for (const q of itens) {
    const r = requisitosProximaForma(q, g.obj);
    add("L:", `§f§l${q.name}\n§r§7aula ${r.k}/${g.formas.length}${r.faltas.length ? " · requisitos pendentes" : ""}`, null, () =>
      ensinarPara(p, q, g, r.k)
    );
  }
  if (paginar) add("L:", `§6§lPróxima página §7(${pagina + 1}/${total})`, null, () => painelAlunos(p, g, pagina + 1));

  const res = await mostrar(f, p);
  if (res.canceled) return;
  const acao = acoes[res.selection];
  if (!acao) return painelAlunos(p, g, pagina);
  return acao();
}

async function ensinar(p) {
  if (!ehLider(p) && !ehHashira(p)) {
    p.sendMessage("§cSomente Hashiras têm acesso às aulas.");
    return;
  }
  if (!p.hasTag(TAG_CLASSICO)) return painelEnsinar(p, 0);
  return ensinarClassico(p);
}

async function escolherAluno(p, g) {
  if (!p.hasTag(TAG_CLASSICO)) return painelAlunos(p, g, 0);
  return escolherAlunoClassico(p, g);
}

async function ensinarPara(p, aluno, g, formaMostrada) {
  try {
    if (!(ehLider(p) || ehHashira(p)) || !aluno?.isValid || !alunosPerto(p, g).some((q) => q.id === aluno.id)) return;
    const r = requisitosProximaForma(aluno, g.obj);
    if (r.k !== formaMostrada) {
      p.sendMessage("§eO progresso mudou. Confira a aula atual antes de ensinar.");
    } else if (r.faltas.length) {
      p.sendMessage(`§c${aluno.name} ainda não pode aprender a forma ${r.k}. Requisitos: ${r.faltas.join("; ")}.`);
      aluno.sendMessage(`§cPara aprender a forma ${r.k} da ${g.nome} você precisa de: ${r.faltas.join("; ")}.`);
    } else {
      if (DOMINAVEL(g.obj)) {
        if (!registrarAula(p, aluno, g.obj, r.k)) {
          p.sendMessage("§cA aula não pôde ser registrada. Confira a presença e o histórico do aluno.");
          return escolherAluno(p, g);
        }
      } else {
        marcarForma(aluno, g, r.k);
        limparTreinosDaForma(aluno, g.obj, r.k);
      }
      const nomeForma = g.formas[r.k - 1];
      p.sendMessage(`§cVocê ensinou a forma ${r.k} da ${g.nome} (${nomeForma}) a §l${aluno.name}§r§c.`);
      aluno.sendMessage(`§cO Hashira §l${p.name}§r§c ensinou a forma ${r.k} da ${g.nome}: ${nomeForma}.`);
      if (DOMINAVEL(g.obj)) {
        aluno.sendMessage(`§aDomínio comprovado ${r.k}/${g.formas.length}.` +
          (r.k === g.formas.length ? " Confira se esta é a sua original em Guia → Domínio humano." : ""));
      }
      som(p, "random.levelup", 1.2, 0.6);
      som(aluno, "random.levelup", 1.2, 0.8);
    }
  } catch (e) {
    reportar(p, e);
  }
  return escolherAluno(p, g);
}

/* ---------------------------------------------------------------------
   COMO JOGAR
--------------------------------------------------------------------- */

const GUIA_CACADOR = [
  {
    nome: "Primeiros passos",
    texto:
      "Você começa como caçador de demônios.\n\n" +
      "Segure o botão de usar com a Nichirin Blade: a lâmina muda de cor, como no anime. " +
      "Cada cor dá bônus diferentes, e a preta é a mais forte.\n\n" +
      "As lâminas coloridas usam a §cRespiração Básica§f, de 3 habilidades que você aprende com um Hashira. Respirações de verdade, como a do Trovão, exigem uma espada daquele estilo. Veja tudo em §cRespirações§f.\n\n" +
      "O livro de conquistas e este menu ficam sempre com você.",
  },
  {
    nome: "Aprender respirações",
    texto:
      "Ninguém nasce sabendo respirar: toda habilidade precisa ser ensinada por um §cHashira§f, uma por vez e em ordem. A Respiração do Trovão, por exemplo, tem 6 habilidades, e você aprende as 6 uma a uma.\n\n" +
      "Para aprender a próxima forma, tenha a espada da respiração, 10 de honra por forma anterior e conclua os treinos mostrados em §cRespirações§f. A Respiração Básica pede uma lâmina colorida, 5 de honra por forma anterior e metas reduzidas pela metade.\n\n" +
      "Abater onis, correr, nadar e pular contam automaticamente. Faça flexão, abdominal, meditação, agachamento e dummy no menu §cTreino§f. Cada atividade vale para a próxima forma de todas as suas respirações que pedem aquele treino. Ao aprender a forma, ela dá lugar a uma nova lista com contadores próprios.\n\n" +
      "Fique a até 12 blocos do Líder dos Hashiras. Ele abre o Menu Kimetsu, escolhe §cEnsinar Respiração§f, a respiração e o seu nome. Entre Hashiras, um colega pode usar §cAulas de domínio§f.\n\n" +
      "A patente Hashira libera formas para combate. O domínio humano avança com aulas registradas ou histórico certificado. Confira o progresso em §cGuia → Domínio humano§f.",
  },
  {
    nome: "Lâminas coloridas",
    texto:
      "Ao usar a Nichirin Blade, a lâmina muda de cor. Quanto mais rara a cor, mais forte o bônus enquanto você a segura:\n\n" +
      LAMINAS.map((l) => `§c${l.nome} §8(${l.chance})§f: ${l.desc}`).join("\n") +
      "\n\nA Lâmina Preta é a mais rara e a mais forte. Todas as cores usam a Respiração Básica (3 habilidades): agache para trocar a habilidade e segure o botão de usar para executá-la.",
  },
  {
    nome: "Status e stamina",
    texto:
      "Abra §cStatus§f no menu e melhore Força, Vida, Defesa, Poder da Respiração e Stamina.\n\n" +
      "Cada melhoria custa o custo da anterior multiplicado por 1,00075 (a primeira custa 1 ponto), mas adiciona sempre 1 ponto ao atributo.\n\n" +
      "Cada atributo tem um limite de pontos que sobe com o cargo: 20 sem rank, 100 como Mizunoto, até 10000 como Líder dos Hashiras. Você ganha pontos de status com honra, abatendo demônios.\n\n" +
      "Correr gasta stamina. Zerada, você fica exausto: mais lento, mais fraco e sem usar respirações até descansar.\n\nRespirações e golpes gastam fôlego. Zerou? Agache para recarregar.",
  },
  {
    nome: "Combate e formas",
    texto:
      "§cAgache (Shift)§f com a espada na mão para trocar a forma. O nome aparece no chat " +
      "(e na barra de ação, se estiver ligada nas configurações).\n\n" +
      "§cSegure o botão de usar§f para executar a forma selecionada.\n\n" +
      "Há um pequeno intervalo entre as trocas de forma, então agache com calma.",
  },
  {
    nome: "Rank e Marca",
    texto:
      "Cada demônio abatido rende honra (demônios comuns 1, chefes valem mais). " +
      "A cada 100 de honra você sobe de rank, de Mizunoe até Hashira (1000 de honra). Com 10000 de honra, um Hashira pode se tornar o Líder dos Hashiras, cargo de um caçador por vez.\n\n" +
      "Subir de rank aumenta sua vida e sua velocidade.\n\n" +
      "Receber dano acumula progresso: ao chegar a 320 de dano sofrido, a Marca do Caçador se revela " +
      "(o item da Marca é entregue aos Hashira).",
  },
  {
    nome: "Perigos",
    texto:
      "O §cRei dos Onis§f e o sangue podem transformar um humano. Quem completou o domínio humano torna-se Híbrido com a respiração original. " +
      "Quando a transformação produz um Oni comum, a tela exibe o resultado antes de confirmar.\n\n" +
      "O antídoto reverte a transformação de Oni comum. Tamayo quebra a maldição do Rei dos Onis.\n\n" +
      "Cuidado com os chefes: Luas Inferiores e Superiores são muito mais fortes que demônios comuns.",
  },
];

const GUIA_ONI = [
  {
    nome: "Primeiros passos",
    texto:
      "Você é um oni. A luz do sol queima você — de dia, procure sombra.\n\n" +
      "Empunhe uma arte demoníaca para usar seus golpes. Veja todas em §4Kekkijutsu§c.\n\n" +
      "Seu rank é a posição entre as Luas, de Inferior 6 até Superior 1.",
  },
  {
    nome: "Kekkijutsu",
    texto:
      "§4Agache (Shift)§c com a arte demoníaca na mão para trocar o golpe.\n\n" +
      "§4Segure o botão de usar§c para executá-lo.\n\n" +
      "Acumule maldição abatendo caçadores para subir de posição entre as Luas.",
  },
  {
    nome: "Status e stamina",
    texto:
      "Abra §4Status§c no menu e melhore Força, Vida, Defesa, Poder do Kekkijutsu e Stamina.\n\n" +
      "Cada nível custa o anterior multiplicado por 1,00075: o nível 1 custa 1 ponto e o custo sobe a cada nível (o nível 1000 custa 2, o 5000 custa 42 e o 10000 custa 1801).\n\n" +
      "Cada atributo tem um limite de pontos que sobe com o cargo: 20 sem posição, 100 como Lua Inferior 6, até 10000 como Rei dos Onis. Você ganha pontos de status com maldição, abatendo caçadores.\n\n" +
      "Correr gasta stamina. Zerada, você fica exausto: mais lento e mais fraco até descansar.\n\nKekkijutsus e golpes gastam fôlego. Zerou? Agache para recarregar.",
  },
  {
    nome: "Posição entre as Luas",
    texto:
      "Cada caçador de demônios que você abate rende 1 de maldição.\n\n" +
      "100 de maldição: Lua Inferior 6. Depois, a cada 100 você sobe uma posição, " +
      "até Lua Superior 2 (1100) e Lua Superior 1 (1200).\n\n" +
      "Com 10000 de maldição você pode se tornar o §4Rei dos Onis§c, mas só um oni por vez tem esse cargo.",
  },
  {
    nome: "Rei dos Onis",
    texto:
      "O Rei dos Onis é o cargo máximo dos oni e só existe um por vez.\n\n" +
      "O Rei dos Onis pode transformar qualquer jogador em oni: abra o Menu Kimetsu e use §4Transformar em Oni§c.\n\n" +
      "Se o Rei dos Onis voltar a ser humano, o cargo fica livre para outro oni.",
  },
  {
    nome: "Sol e maldição",
    texto:
      "Para superar o sol, use qualquer respiração do Sol: a conquista \"Overcome Sunlight\" " +
      "faz você deixar de queimar.\n\n" +
      "Para quebrar a maldição do Rei dos Onis, converse com Tamayo.\n\n" +
      "O antídoto devolve a sua forma humana.",
  },
];

// guia no painel: assuntos nas barras decoradas (esquerda) e o texto com rolagem na área grande
async function painelGuia(p, sel = 0, pagina = undefined) {
  const oni = isOni(p);
  const guia = oni ? GUIA_ONI : GUIA_CACADOR;
  sel = Math.max(0, Math.min(guia.length - 1, sel));
  const paginar = guia.length > 6;
  const porPag = paginar ? 5 : 6;
  const total = Math.max(1, Math.ceil(guia.length / porPag));
  pagina = pagina === undefined ? Math.floor(sel / porPag) : ((pagina % total) + total) % total;
  const itens = guia.slice(pagina * porPag, pagina * porPag + porPag);
  const g = guia[sel];
  const cor = oni ? "§c" : "§f";

  const acoes = [];
  const f = new ActionFormData().title(`${MARCA_TXT}§lCOMO JOGAR`).body(" ");
  const add = (prefixo, texto, acao) => {
    f.button(prefixo + texto);
    acoes.push(acao ?? null);
  };
  add("B:", TXT_VOLTAR, () => menuPrincipal(p));
  add("T:", `§l§e${g.nome}§r\n\n${cor}${g.texto}\n`);
  itens.forEach((it, i) => {
    const idx = pagina * porPag + i;
    add("L:", `${idx === sel ? "§a> " : ""}§l§f${it.nome}`, () => painelGuia(p, idx, pagina));
  });
  if (paginar) add("L:", `§6§lPróxima página §7(${pagina + 1}/${total})`, () => painelGuia(p, sel, pagina + 1));

  const res = await mostrar(f, p);
  if (res.canceled) {
    if (res.cancelationReason === undefined) return comoJogarClassico(p);
    return;
  }
  const acao = acoes[res.selection];
  if (!acao) return painelGuia(p, sel, pagina);
  return acao();
}

async function comoJogar(p) {
  if (!p.hasTag(TAG_CLASSICO)) return painelGuia(p);
  return comoJogarClassico(p);
}

async function comoJogarClassico(p) {
  const t = tema(p);
  const oni = isOni(p);
  const guia = oni ? GUIA_ONI : GUIA_CACADOR;

  const f = novoForm(p)
    .title(oni ? "§l§4COMO JOGAR · ONI" : "§l§cCOMO JOGAR")
    .body(`${t.linha}\n${t.suave}Escolha um assunto.\n${t.linha}`)
    .button(`§l${t.destaque}Voltar`, t.icones.voltar);
  for (const g of guia) f.button(`§l${t.destaque}${g.nome}`, t.icones.comoJogar);

  const res = await mostrar(f, p);
  if (res.canceled) return;
  if (res.selection === 0) return menuPrincipal(p);
  return paginaGuia(p, guia[res.selection - 1]);
}

async function paginaGuia(p, g) {
  const t = tema(p);
  const cor = isOni(p) ? "§c" : "§f";
  const f = novoForm(p)
    .title(`§l${t.destaque}${g.nome}`)
    .body(`${t.linha}\n${cor}${g.texto}\n${t.linha}`)
    .button(`§l${t.destaque}Voltar aos assuntos`, t.icones.voltar);
  const res = await mostrar(f, p);
  if (!res.canceled) return comoJogar(p);
}

/* ---------------------------------------------------------------------
   MISSÕES (tags reais do livro de conquistas)
--------------------------------------------------------------------- */

const MISSOES_CACADOR = [
  { nome: "Missão 1 · Montanha Sagiri", desc: "Entre na Montanha Sagiri.", tag: "m1", wip: true },
  { nome: "Missão 2 · Sabito", desc: "Vença Sabito.", tag: "m2" },
  { nome: "Missão 3 · Demônio das Mãos", desc: "Mate o Demônio das Mãos.", tag: "m3" },
  { nome: "Missão 4 · Montanha Natagumo", desc: "Entre na Montanha Natagumo.", tag: "m4", wip: true },
  { nome: "Missão 5 · Rui", desc: "Mate Rui (Lua Inferior 5) junto com Tanjiro.", tag: "m5" },
  { nome: "Missão 6 · Enmu", desc: "Mate Enmu (Lua Inferior 1) junto com Rengoku.", tag: "m6", wip: true },
  { nome: "Missão 7 · Akaza", desc: "Enfrente Akaza (Lua Superior 3).", tag: "m7" },
  { nome: "Treino · Água", desc: "Vença Tomioka.", tag: "training_water" },
  { nome: "Treino · Inseto", desc: "Vença Shinobu.", tag: "training_insect" },
  { nome: "Treino · Chamas", desc: "Vença Rengoku.", tag: "training_flame" },
  { nome: "Treino · Som", desc: "Vença Uzui.", tag: "training_sound" },
  { nome: "Treino · Névoa", desc: "Vença Muichiro.", tag: "training_mist" },
  { nome: "Treino · Amor", desc: "Vença Mitsuri.", tag: "training_love" },
  { nome: "Treino · Serpente", desc: "Vença Obanai.", tag: "training_serpent", wip: true },
  { nome: "Treino · Vento", desc: "Vença Sanemi.", tag: "training_wind" },
  { nome: "Treino · Pedra", desc: "Vença Gyomei.", tag: "training_stone" },
  { nome: "Batalha · Lua Inferior 6", desc: "Vença Kamanue.", tag: "blood6" },
  { nome: "Batalha · Lua Inferior 5", desc: "Vença Rui.", tag: "blood5" },
  { nome: "Batalha · Lua Inferior 4", desc: "Vença Mukago.", tag: "blood4" },
  { nome: "Batalha · Lua Inferior 3", desc: "Vença Wakuraba.", tag: "blood3" },
  { nome: "Batalha · Lua Inferior 2", desc: "Vença Rokuro.", tag: "blood2" },
  { nome: "Batalha · Lua Inferior 1", desc: "Vença Enmu.", tag: "blood1" },
  { nome: "Batalha · Lua Superior 6", desc: "Vença Gyutaro.", tag: "bloodupper6" },
  { nome: "Batalha · Lua Superior 5", desc: "Vença Gyokko.", tag: "bloodupper5" },
  { nome: "Batalha · Lua Superior 4", desc: "Vença Zohakuten.", tag: "bloodupper4" },
  { nome: "Batalha · Lua Superior 3", desc: "Vença Akaza.", tag: "bloodupper3" },
  { nome: "Batalha · Lua Superior 2", desc: "Vença Doma.", tag: "bloodupper2" },
  { nome: "Batalha · Lua Superior 1", desc: "Vença Kokushibo.", tag: "bloodupper1" },
  { nome: "Guerreiro Sangrento", desc: "Sobreviva à Lua Vermelha sem morrer.", tag: "guerra_vermelha" },
  { nome: "Líder dos Hashiras", desc: "Alcance 10000 de honra sendo Hashira. Só um caçador por vez.", tag: "hashira_lider" },
];

function missoesOni(p) {
  const r = infoRank(p);
  const hibrido = isHybrid(p);
  const lista = [
    { nome: "Tornar-se oni", desc: "Seja transformado em oni.", ok: p.hasTag("demon") },
    { nome: "Superar o sol", desc: "Use qualquer respiração do Sol.", ok: p.hasTag("sunshield") },
    { nome: "Quebrar a maldição", desc: "Fale com Tamayo.", ok: p.hasTag("breakcurse") },
  ];
  for (const rk of RANKS_ONI) {
    if (hibrido && rk === REI_ONI) {
      lista.push({ nome: HIBRIDO_SUPERIOR.nome, desc: "Conclua a transformação com uma respiração dominada.", ok: true });
    }
    lista.push({
      nome: rk.nome,
      desc: rk.unico ? `Alcance ${rk.min} de maldição. Só um oni por vez é Rei dos Onis.` : `Acumule ${rk.min} de maldição (você tem ${r.pontos}).`,
      ok: rk === REI_ONI ? ehRei(p) : p.hasTag(rk.tag),
    });
  }
  const lutas = [
    ["blood6", "Kamanue"], ["blood5", "Rui"], ["blood4", "Mukago"], ["blood3", "Wakuraba"], ["blood2", "Rokuro"],
    ["blood1", "Enmu"], ["bloodupper6", "Gyutaro"], ["bloodupper5", "Gyokko"], ["bloodupper4", "Zohakuten"],
    ["bloodupper3", "Akaza"], ["bloodupper2", "Doma"], ["bloodupper1", "Kokushibo"],
  ];
  for (const [tag, nome] of lutas) lista.push({ nome: `Batalha · ${nome}`, desc: `Vença ${nome}.`, ok: p.hasTag(tag), tag, marcavel: true });
  lista.push({ nome: "Guerreiro Sangrento", desc: "Sobreviva à Lua Vermelha sem morrer.", ok: p.hasTag("guerra_vermelha"), tag: "guerra_vermelha", marcavel: true });
  return lista;
}

// missões no painel: 6 por página, com botão para a própria pessoa marcar / desmarcar
const MISSOES_POR_PAG = 6;
async function painelMissoes(p, pagina = 0) {
  const t = tema(p);
  const oni = isOni(p);
  const lista = oni
    ? missoesOni(p)
    : MISSOES_CACADOR.map((m) => ({
        nome: m.nome,
        desc: m.desc,
        ok: p.hasTag(m.tag),
        wip: m.wip,
        tag: m.tag,
        marcavel: !m.wip && m.tag !== "hashira_lider", // o cargo de Líder é automático e único
      }));
  const feitas = lista.filter((m) => m.ok).length;
  const total = Math.max(1, Math.ceil(lista.length / MISSOES_POR_PAG));
  pagina = ((pagina % total) + total) % total;
  const itens = lista.slice(pagina * MISSOES_POR_PAG, pagina * MISSOES_POR_PAG + MISSOES_POR_PAG);

  const acoes = [];
  const f = new ActionFormData().title(`${MARCA_MISS}§l${oni ? "CAÇADAS" : "MISSÕES"}`).body(" ");
  const add = (prefixo, texto, acao) => {
    f.button(prefixo + texto);
    acoes.push(acao ?? null);
  };
  add("B:", TXT_VOLTAR, () => menuPrincipal(p));
  add(
    "H:",
    `§7${oni ? "Caçadas concluídas" : "Missões concluídas"}: §f${feitas}/${lista.length}   §8|   §7Página §f${pagina + 1}/${total}\n` +
      `${barra(feitas, lista.length, 30, t.destaque)}`
  );
  for (const m of itens) {
    const pref = m.wip ? "QW:" : m.marcavel ? (m.ok ? "Q1:" : "Q0:") : m.ok ? "QB:" : "QA:";
    const txt = `${m.ok ? "§a" : "§f"}§l${m.nome}\n§r§7${m.desc}`;
    add(
      pref,
      txt,
      m.marcavel
        ? () => {
            if (m.ok) {
              p.removeTag(m.tag);
              p.sendMessage(`§7Missão desmarcada: §f${m.nome}`);
            } else {
              p.addTag(m.tag);
              p.sendMessage(`§aMissão marcada como feita: §f${m.nome}`);
            }
            return painelMissoes(p, pagina);
          }
        : null
    );
  }
  if (total > 1) {
    add("NP:", "§e§l< ANTERIOR", () => painelMissoes(p, pagina - 1));
    add("NN:", "§e§lPRÓXIMA >", () => painelMissoes(p, pagina + 1));
  }

  const res = await mostrar(f, p);
  if (res.canceled) {
    if (res.cancelationReason === undefined) return missoesClassica(p);
    return;
  }
  const acao = acoes[res.selection];
  if (!acao) return painelMissoes(p, pagina);
  return acao();
}

async function missoes(p) {
  if (!p.hasTag(TAG_CLASSICO)) return painelMissoes(p);
  return missoesClassica(p);
}

async function missoesClassica(p) {
  const t = tema(p);
  const oni = isOni(p);
  const lista = oni
    ? missoesOni(p)
    : MISSOES_CACADOR.map((m) => ({ nome: m.nome, desc: m.desc, ok: p.hasTag(m.tag), wip: m.wip }));

  const feitas = lista.filter((m) => m.ok).length;
  let c = `${t.linha}\n${t.suave}${oni ? "Caçadas concluídas" : "Missões concluídas"}: ${t.texto}${feitas}/${lista.length}\n`;
  c += `${barra(feitas, lista.length, 24, t.destaque)}\n${t.linha}\n`;
  for (const m of lista) {
    const marca = m.ok ? "§a[OK] " : m.wip ? "§8[em breve] " : `${t.destaque}[ ] `;
    c += `${marca}${m.ok ? "§7" : t.texto}${m.nome}\n${t.suave}   ${m.desc}\n`;
  }

  const f = novoForm(p)
    .title(oni ? "§l§4MISSÕES · CAÇADAS" : "§l§cMISSÕES")
    .body(c)
    .button(`§l${t.destaque}Voltar`, t.icones.voltar);
  const res = await mostrar(f, p);
  if (!res.canceled) return menuPrincipal(p);
}

// Mantém a interface usada pelos demais scripts da addon.
export { staminaDe, folegoDe, isOni, pontuar, lerBruto, getScore };
