import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ItemStack, system, world, jogador, executarAgendados, executarIntervalos } from "./simulador.mjs";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@minecraft/server" || specifier === "@minecraft/server-ui") {
      return { shortCircuit: true, url: new URL("./simulador.mjs", import.meta.url).href };
    }
    return next(specifier, context);
  },
});
const bp = pathToFileURL(resolve(process.env.KIMETSU_BP ?? "Kimetsu Fix Be") + "/");
const rp = process.env.KIMETSU_RP ? pathToFileURL(resolve(process.env.KIMETSU_RP) + "/") : new URL("../Kimetsu Fix Re/", import.meta.url);
const carregar = (nome) => import(new URL("scripts/" + nome + ".js", bp));
const [oficina, config, camera, registros, hibrido, { abrirEditor }] = await Promise.all([
  carregar("character_system"), carregar("character_config"), carregar("character_camera"),
  carregar("hybrid_records"), carregar("hybrid_system"), carregar("character_editor"),
]);
await carregar("menu");
const { garantirItemMenu } = await carregar("menu_item");

const { CHAVE_VISUAL, CHAVE_ENTRADA, prepararAparenciaInicial, iniciarEdicao, encerrarEdicao,
  definirVisual, salvarEdicao, lerAparencia } = oficina;
const { PROP_APARENCIA, PROP_RASCUNHO, VISUAL_PADRAO, codificarVisual } = config;
const CHAVE_CAMERA = "kny:aparencia_camera";
const canais = (p, chaves) => chaves.map((k) => p.getProperty(k));
const semCor = (s) => s.replace(/§./g, "");
const digitar = (p, id, message = "") => system.afterEvents.scriptEventReceive.emit({ id, sourceEntity: p, message });
const primeiraEntrada = (p) => {
  p.addTag("kny_aparencia_novo");
  p.addTag("start");
  digitar(p, "kny:aparencia_inicial", "primeiro");
};
const novo = () => {
  const p = jogador();
  primeiraEntrada(p);
  assert.equal(p.getDynamicProperty(CHAVE_ENTRADA), "v78");
  return p;
};
const entrar = (p, initialSpawn = true) => world.afterEvents.playerSpawn.emit({ player: p, initialSpawn });
const confirmar = (nome) => (f) => {
  const selection = f.buttons.findIndex(({ texto }) => semCor(texto).includes(nome));
  assert.ok(selection >= 0, nome + " em " + f.titulo);
  return { selection };
};
const isEditor = (f) => f.titulo && semCor(f.titulo).includes("APARÊNCIA DO PERSONAGEM");
const isContrato = (f) => f.titulo?.startsWith("kny_ctr|");
const isPainel = (f) => f.titulo?.startsWith("kny_painel|");
const fechar = () => ({ canceled: true, cancelationReason: "UserClosed" });

test("o primeiro acesso abre a aparência sozinho, guarda pele, cabelo e olhos e passa ao contrato", async () => {
  const p = novo();
  p.inputPermissions.setPermissionCategory(6, false);
  p.runCommand = (cmd) => {
    assert.equal(cmd, "function start_slayer");
    p.addTag("slayer");
    p.addTag("mizunoto");
    return { successCount: 1 };
  };
  p.escolhas.push(confirmar("Crie seu personagem"), (f) => {
    assert.ok(isEditor(f));
    const vida = p.getComponent("minecraft:health").currentValue;
    assert.equal(p.applyDamage(20), false);
    assert.equal(p.getComponent("minecraft:health").currentValue, vida);
    assert.equal(p.inputPermissions.isPermissionCategoryEnabled(4), false);
    assert.equal(p.getProperty("kny:cc_edicao"), true);
    assert.deepEqual(f.buttons.filter((b) => /^[CS]:/.test(b.texto)).map((b) => semCor(b.texto).slice(2)),
      ["Pele", "Cabelo", "Olhos"]);
    assert.ok(!f.buttons.some((b) => /Acessórios|Informações|Vestimentas|Conjuntos|Expressão/.test(b.texto)));
    return confirmar("Próximo")(f);
  }, confirmar("C:Cabelo"), confirmar("Cor principal"), confirmar("Próximo"), confirmar("Cor da mecha"), confirmar("Próximo"), confirmar("C:Olhos"),
  confirmar("Íris direita"), confirmar("Próximo"), confirmar("CONFIRMAR"), confirmar("ASSINAR O CONTRATO"));
  entrar(p);
  await executarAgendados(24);
  assert.match(p.telas[0].titulo, /^kny_criar\|/);
  assert.ok(isEditor(p.telas[1]));
  assert.ok(isContrato(p.telas.at(-1)));
  const base = lerAparencia(p).perfis.base;
  assert.equal(base.peleIntegral, "pele_a_c98f65");
  assert.equal(base.cabelo, "corte_curto");
  assert.equal(base.corCabelo, "castanha");
  assert.equal(base.mecha, "carvao");
  assert.equal(base.olhoD, "ambar");
  assert.equal(base.roupa, undefined);
  assert.equal(base.rosto, undefined);
  assert.ok(p.hasTag("kny_escolheu"));
  assert.ok(p.hasTag("mizunoto"));
  assert.equal(p.camera.atual, undefined);
  assert.equal(p.inputPermissions.isPermissionCategoryEnabled(4), true);
  assert.equal(p.inputPermissions.isPermissionCategoryEnabled(6), false);
  assert.equal(p.getProperty("kny:cc_edicao"), false);
  assert.deepEqual(canais(p, PROP_RASCUNHO), [-1, -1, -1]);
  digitar(p, "kny:menu");
  await executarAgendados();
  assert.ok(isPainel(p.telas.at(-1)));
  assert.ok(!p.telas.at(-1).buttons.some((b) => /Customizar personagem|Aparência/.test(b.texto)));
  assert.throws(() => iniciarEdicao(p), /somente na primeira entrada/);
});

test("o estúdio separa dois jogadores e recupera a origem depois de reconectar", async () => {
  const { entrarEstudio, sairEstudio } = await carregar("character_studio");
  const a = novo();
  const b = novo();
  a.location = { x: 17, y: 74, z: -35 };
  const origem = { ...a.location };
  assert.equal(await entrarEstudio(a, () => true), true);
  assert.equal(await entrarEstudio(b, () => true), true);
  assert.equal(a.dimension.id, "kny:estudio");
  assert.equal(b.dimension.id, "kny:estudio");
  assert.ok(Math.hypot(a.location.x - b.location.x, a.location.z - b.location.z) >= 4096);
  a.desconectar();
  const retorno = jogador(a.name, a.dinamicos);
  retorno.dimension = a.dimension;
  retorno.location = a.location;
  retorno.addTag("start");
  retorno.addTag("slayer");
  entrar(retorno);
  await executarAgendados();
  assert.equal(retorno.dimension.id, "minecraft:overworld");
  assert.deepEqual(retorno.location, origem);
  assert.equal(retorno.getDynamicProperty("kny:criacao_origem"), undefined);
  assert.equal(await sairEstudio(b), true);
});

test("trocar de dimensão limpa a proteção da edição e devolve os controles", async () => {
  const p = novo();
  let devolver;
  p.escolhas.push(() => new Promise((resolve) => { devolver = resolve; }));
  const edicao = abrirEditor(p);
  await executarAgendados();
  assert.equal(p.getProperty("kny:cc_edicao"), true);
  assert.equal(p.applyDamage(10), false);
  p.dimension = { id: "minecraft:nether" };
  world.afterEvents.playerDimensionChange.emit({ player: p });
  devolver(fechar());
  await edicao;
  await executarAgendados();
  assert.equal(p.getProperty("kny:cc_edicao"), false);
  assert.equal(p.inputPermissions.isPermissionCategoryEnabled(4), true);
  assert.equal(p.camera.atual, undefined);
  assert.equal(p.applyDamage(1), true);
});

test("fechar ou cancelar leva ao contrato e o item não reabre a aparência", async () => {
  for (const acao of [fechar, confirmar("Cancelar")]) {
    const p = novo();
    p.escolhas.push(confirmar("Crie seu personagem"), acao, fechar);
    // O item pode ser usado antes de o formulário automático abrir.
    entrar(p);
    digitar(p, "kny:menu");
    await executarAgendados();
    assert.match(p.telas[0].titulo, /^kny_criar\|/);
    assert.deepEqual(p.telas.slice(1).map((f) => isEditor(f) ? "editor" : "contrato"), ["editor", "contrato"]);
    assert.equal(p.getDynamicProperty(CHAVE_VISUAL), undefined);
    digitar(p, "kny:menu", "classico");
    await executarAgendados();
    assert.ok(!isEditor(p.telas.at(-1)));
    assert.equal(p.telas.at(-1).buttons.length, 1);
    assert.equal(p.camera.atual, undefined);
  }
});

test("reconexão preserva a confirmação e encerra oportunidades abandonadas", async () => {
  const p = novo();
  const sessao = iniciarEdicao(p);
  assert.ok(definirVisual(sessao, { peleIntegral: "pele_b_75452f", cabelo: "espinhos", corCabelo: "amarelo", olhoE: "ciano" }));
  assert.ok(salvarEdicao(sessao));
  const salvo = p.getDynamicProperty(CHAVE_VISUAL);
  p.desconectar();
  const voltou = jogador(p.name, p.dinamicos);
  voltou.addTag("start");
  entrar(voltou);
  await executarAgendados();
  assert.ok(isContrato(voltou.telas[0]));
  assert.equal(voltou.getDynamicProperty(CHAVE_VISUAL), salvo);
  assert.deepEqual(canais(voltou, PROP_APARENCIA), codificarVisual(lerAparencia(voltou).perfis.base));
  assert.deepEqual(canais(voltou, PROP_RASCUNHO), [-1, -1, -1]);
  primeiraEntrada(voltou);
  assert.equal(oficina.edicaoInicialDisponivel(voltou), false);

  const saiu = novo();
  saiu.desconectar();
  const semConfirmacao = jogador(saiu.name, saiu.dinamicos);
  entrouSemFicha(semConfirmacao);
  await executarAgendados();
  assert.ok(isContrato(semConfirmacao.telas[0]));
  assert.equal(semConfirmacao.getDynamicProperty(CHAVE_VISUAL), undefined);
});

function entrouSemFicha(p) {
  p.addTag("start");
  entrar(p);
}

test("jogadores antigos entram diretamente no fluxo normal e conservam as fichas anteriores", async () => {
  const humano = jogador();
  entrouSemFicha(humano);
  await executarAgendados();
  assert.ok(isContrato(humano.telas[0]));
  assert.equal(humano.getDynamicProperty(CHAVE_ENTRADA), undefined);
  const p = jogador();
  p.addTag("slayer");
  p.addTag("start");
  const visual76 = { cabelo: "coque", roupa: "haori_liso", rosto: "firme", pele: "mel" };
  const salvo = JSON.stringify({ v: 1, perfis: { base: visual76 }, nome: "Hana", concessoes: [] });
  p.setDynamicProperty(CHAVE_VISUAL, salvo);
  entrar(p);
  await executarAgendados();
  assert.equal(p.telas.length, 0);
  digitar(p, "kny:menu");
  await executarAgendados();
  assert.ok(isPainel(p.telas.at(-1)));
  assert.equal(p.getDynamicProperty(CHAVE_VISUAL), salvo);
  assert.deepEqual(canais(p, PROP_APARENCIA), codificarVisual(visual76));
});

test("formulários e comandos sem oportunidade não mudam raça, armadura, treino ou desbloqueio", async () => {
  const p = jogador();
  digitar(p, "kny:aparencia_inicial", "primeiro");
  assert.equal(oficina.edicaoInicialDisponivel(p), false);
  assert.throws(() => iniciarEdicao(p), /somente na primeira entrada/);
  primeiraEntrada(p);
  const inventario = p.getComponent("minecraft:inventory").container;
  const item = { typeId: "kny:nichirin_blue", amount: 1 };
  inventario.setItem(0, item);
  p.setDynamicProperty("kny:h_dominio", "treino");
  const sessao = iniciarEdicao(p);
  assert.throws(() => iniciarEdicao(p), /somente na primeira entrada/);
  for (const opt of [{ roupa: "hakama" }, { rosto: "firme" }, { cabeca: "faixa" }, { demonio: "chifres" }]) {
    assert.equal(definirVisual(sessao, opt), false);
  }
  assert.equal(p.getDynamicProperty(CHAVE_VISUAL), undefined);
  assert.ok(salvarEdicao(sessao));
  assert.equal(salvarEdicao(sessao), false);
  assert.equal(inventario.getItem(0), item);
  assert.equal(p.hasTag("demon"), false);
  assert.equal(p.hasTag("slayer"), false);
  assert.equal(p.getDynamicProperty("kny:h_dominio"), "treino");

  const staff = jogador("Staff Aparência");
  staff.addTag("kny_op");
  digitar(staff, "kny:aparencia", 'resetar "' + p.name + '"');
  primeiraEntrada(p);
  assert.equal(oficina.edicaoInicialDisponivel(p), false);
});

test("a pele inicial continua disponível na transformação e na troca legítima de disfarce", async () => {
  const p = novo();
  const sessao = iniciarEdicao(p);
  definirVisual(sessao, { peleIntegral: "pele_b_a66b45" });
  salvarEdicao(sessao);
  const visual = canais(p, PROP_APARENCIA);
  const d = { v: 1, id: registros.identificador(p), estado: "ativo", raca: "hibrido",
    resp: "water", formas: 10, arte: "enmu", publico: "cacador" };
  registros.guardarPersonagem(p, d);
  hibrido.espelharHibrido(p, d);
  await executarAgendados();
  assert.deepEqual(canais(p, PROP_APARENCIA), visual);
  hibrido.trocarDisfarce(p, "oni");
  await executarAgendados();
  assert.equal(hibrido.getPublicIdentity(p), "oni");
  assert.deepEqual(canais(p, PROP_APARENCIA), visual);
  assert.throws(() => iniciarEdicao(p), /somente na primeira entrada/);
});

test("retratos de reserva atualizam a pele e as camadas no visor antes da confirmação", async () => {
  const p = novo();
  p.dimension.getBlockFromRay = () => ({ block: { location: { x: 0, y: 71, z: 1 } }, faceLocation: { x: 0, y: 0, z: 0 } });
  const caminho = (f, campo) => f.buttons.find(({ texto }) => texto === campo + ":")?.icone;
  p.escolhas.push((f) => {
    assert.match(f.titulo, /^kny_edit\|R§/);
    assert.ok(!f.buttons.some((b) => b.texto.includes("Girar")));
    assert.match(caminho(f, "PV"), /pele_a_e8b98f$/);
    assert.match(caminho(f, "PC"), /1_carvao$/);
    assert.match(caminho(f, "PE"), /e_4_castanho$/);
    return confirmar("Anterior")(f);
  }, (f) => {
    assert.match(f.titulo, /^kny_edit\|RA/);
    assert.equal(caminho(f, "PV"), undefined);
    assert.equal(caminho(f, "PC"), undefined);
    return confirmar("Próximo")(f);
  }, confirmar("Próximo"), (f) => {
    assert.match(caminho(f, "PV"), /pele_a_c98f65$/);
    return confirmar("CONFIRMAR")(f);
  });
  const tarefa = abrirEditor(p);
  await executarAgendados(15);
  await tarefa;
  assert.equal(p.camera.atual, undefined);
  assert.equal(p.camera.fov, undefined);
  assert.equal(p.getDynamicProperty(CHAVE_CAMERA), undefined);
  assert.equal(lerAparencia(p).perfis.base.peleIntegral, "pele_a_c98f65");
});

test("falha na abertura da interface personalizada mantém o formulário simples como alternativa", async () => {
  const p = novo();
  p.escolhas.push(() => ({ canceled: true }), (f) => {
    assert.equal(f.titulo, "§6APARÊNCIA DO PERSONAGEM");
    assert.equal(p.camera.atual, undefined);
    assert.equal(p.camera.fov, undefined);
    return confirmar("CONFIRMAR")(f);
  });
  const tarefa = abrirEditor(p);
  await executarAgendados();
  await tarefa;
  assert.ok(isEditor(p.telas[0]));
  assert.ok(lerAparencia(p).perfis.base.peleIntegral);
});

test("uma falha do campo de visão mantém a escolha disponível na prévia frontal", async () => {
  const p = novo();
  p.camera.setFov = (opcoes) => {
    if (opcoes) throw new Error("Campo de visão indisponível no teste");
  };
  p.escolhas.push((f) => {
    assert.match(f.titulo, /^kny_edit\|R§/);
    assert.equal(p.camera.atual, undefined);
    assert.equal(p.getDynamicProperty(CHAVE_CAMERA), undefined);
    return confirmar("CONFIRMAR")(f);
  });
  await abrirEditor(p);
  assert.equal(lerAparencia(p).perfis.base.peleIntegral, "pele_a_e8b98f");
});

test("câmera começa em um ângulo livre quando o jogador nasce virado para uma parede", () => {
  const p = novo();
  p.dimension.getBlockFromRay = (_foco, direcao) => direcao.z > 0.95
    ? { block: { location: { x: 0, y: 71, z: 1 } }, faceLocation: { x: 0, y: 0, z: 0 } }
    : undefined;
  const sessao = iniciarEdicao(p);
  assert.ok(sessao.temCamera);
  assert.equal(sessao.anguloInicial, 30);
  assert.ok(p.camera.atual.location.x < -1);
  encerrarEdicao(sessao);
});

test("uma troca de pele seguida de tela ocupada preserva câmera, rascunho, livro e proteção", async () => {
  const p = novo();
  const inventario = p.getComponent("minecraft:inventory").container;
  inventario.setItem(0, new ItemStack("kny:menu_kimetsu"));
  const ocupado = () => ({ canceled: true, cancelationReason: "UserBusy" });
  let enquadramento;
  p.escolhas.push(confirmar("Crie seu personagem"), (f) => {
    assert.match(f.titulo, /^kny_edit\|§/);
    enquadramento = { ...p.camera.atual };
    return confirmar("Próximo")(f);
  }, ...Array(12).fill(ocupado), (f) => {
    assert.match(f.titulo, /^kny_edit\|§/);
    assert.deepEqual(p.camera.atual, enquadramento);
    assert.equal(p.camera.fov, camera.CAMPO_DE_VISAO_ESTUDIO);
    assert.ok(f.buttons.some((b) => /Base A · Mel/.test(b.texto)));
    assert.equal(p.inputPermissions.isPermissionCategoryEnabled(4), false);
    assert.equal(p.applyDamage(3), false);
    assert.equal(inventario.getItem(0).typeId, "kny:menu_kimetsu");
    assert.equal(p.selectedSlotIndex, 0);
    return confirmar("CONFIRMAR")(f);
  }, fechar);
  entrar(p);
  digitar(p, "kny:menu", "classico");
  await executarAgendados(40);
  assert.equal(p.telas.filter(isEditor).length, 14);
  assert.equal(semCor(p.telas.at(-1).titulo), "KIMETSU NO YAIBA");
  assert.ok(p.hasTag("kny_cfg_classico"));
  assert.equal(lerAparencia(p).perfis.base.peleIntegral, "pele_a_c98f65");
  assert.equal(p.camera.fov, undefined);
});

test("a entrada espera a inicialização nativa e reage ao sinal persistido mesmo que o evento atrase", async () => {
  const p = jogador();
  p.escolhas.push(confirmar("Crie seu personagem"), confirmar("CONFIRMAR"), fechar);
  entrar(p);
  digitar(p, "kny:menu");
  system.runTimeout(() => {
    p.addTag("start");
    p.addTag("kny_aparencia_novo");
  }, 110);
  await executarAgendados(16);
  assert.ok(isEditor(p.telas[1]));
  assert.ok(isContrato(p.telas.at(-1)));
  assert.equal(p.getDynamicProperty(CHAVE_ENTRADA), "v78");
});

test("a escolha continua reservada até o jogador sair do estado de caído", async () => {
  const p = novo();
  p.addTag("kny_caido");
  p.escolhas.push(confirmar("CONFIRMAR"));
  const abrir = abrirEditor(p);
  await executarAgendados(1);
  assert.equal(p.telas.length, 0);
  assert.ok(oficina.edicaoInicialDisponivel(p));
  p.removeTag("kny_caido");
  await executarAgendados();
  await abrir;
  assert.equal(p.telas.length, 1);
  assert.ok(lerAparencia(p).perfis.base.peleIntegral);
});

test("Staff recupera somente uma oportunidade da v77 sem ficha salva e sem reassinar o contrato", async () => {
  const staff = jogador("Staff de reparo");
  staff.addTag("kny_op");
  const p = jogador("Caçador V77");
  p.addTag("slayer");
  p.addTag("start");
  p.setDynamicProperty(CHAVE_ENTRADA, true);
  p.runCommand = (comando) => {
    assert.equal(comando, "scriptevent kny:menu");
    digitar(p, "kny:menu");
  };
  const recuperar = 'recuperar_entrada "' + p.name + '"';
  digitar(p, "kny:aparencia", recuperar);
  assert.equal(p.getDynamicProperty(CHAVE_ENTRADA), true);
  p.escolhas.push(confirmar("Crie seu personagem"), confirmar("CONFIRMAR"));
  digitar(staff, "kny:aparencia", recuperar);
  await executarAgendados();
  assert.equal(p.telas.length, 2);
  assert.ok(isEditor(p.telas[1]));
  assert.ok(p.hasTag("slayer"));
  assert.equal(p.getDynamicProperty(CHAVE_ENTRADA), "v78");
  digitar(staff, "kny:aparencia", recuperar);
  await executarAgendados();
  assert.equal(p.telas.length, 2);

  const salvo = jogador("Ficha anterior");
  salvo.setDynamicProperty(CHAVE_ENTRADA, true);
  salvo.setDynamicProperty(CHAVE_VISUAL, p.getDynamicProperty(CHAVE_VISUAL));
  digitar(staff, "kny:aparencia", 'recuperar_entrada "' + salvo.name + '"');
  assert.equal(salvo.getDynamicProperty(CHAVE_ENTRADA), true);
  assert.equal(oficina.edicaoInicialDisponivel(salvo), false);
});

test("login e reposição conservam um menu, a cópia em uso e o livro de conquistas", async () => {
  const p = jogador();
  p.addTag("start");
  p.addTag("slayer");
  p.selectedSlotIndex = 3;
  const inventario = p.getComponent("minecraft:inventory").container;
  const menu = new ItemStack("kny:menu_kimetsu");
  const livro = new ItemStack("kny:book_archievement");
  inventario.setItem(1, new ItemStack("kny:menu_kimetsu"));
  inventario.setItem(3, menu);
  inventario.setItem(9, livro);
  entrar(p);
  await executarAgendados();
  assert.equal(inventario.getItem(1), undefined);
  assert.equal(inventario.getItem(3), menu);
  assert.equal(inventario.getItem(9), livro);
  inventario.setItem(3, undefined);
  assert.equal(garantirItemMenu(p), "entregue");
  assert.equal(garantirItemMenu(p), "existente");
  assert.equal(inventario.getItem(0).lockMode, "inventory");
  assert.equal(inventario.getItem(0).keepOnDeath, true);
  const copia = new ItemStack("kny:menu_kimetsu");
  inventario.setItem(14, copia);
  world.afterEvents.playerInventoryItemChange.emit({ player: p, itemStack: copia });
  await executarAgendados();
  assert.equal(inventario.getItem(14), undefined);
});

test("inventário cheio recebe um menu assim que libera um espaço", async () => {
  const p = jogador();
  const inv = p.getComponent("minecraft:inventory").container;
  for (let i = 0; i < inv.size; i++) inv.setItem(i, new ItemStack("minecraft:dirt", 64));
  assert.equal(garantirItemMenu(p), "cheio");
  assert.equal(inv.getItem(9).typeId, "minecraft:dirt");
  inv.setItem(9, undefined);
  world.afterEvents.playerInventoryItemChange.emit({ player: p, itemStack: undefined });
  await executarAgendados();
  assert.equal(inv.getItem(9).typeId, "kny:menu_kimetsu");
  assert.equal(garantirItemMenu(p), "existente");
});

test("dois jogadores editam independentemente e dano e mudança de dimensão descartam os rascunhos", async () => {
  const a = novo();
  const b = novo();
  const sa = iniciarEdicao(a);
  const sb = iniciarEdicao(b);
  assert.ok(definirVisual(sa, { peleIntegral: "pele_b_a66b45" }));
  assert.ok(definirVisual(sb, { peleIntegral: "pele_a_4a2c20" }));
  assert.ok(camera.atualizarCamera(sa, { modo: "rosto", angulo: 90, zoom: -2 }));
  assert.notDeepEqual(canais(a, PROP_RASCUNHO), canais(b, PROP_RASCUNHO));
  a.applyDamage(1);
  assert.equal(oficina.sessaoAtual(a), undefined);
  assert.equal(a.camera.atual, undefined);
  assert.equal(oficina.sessaoAtual(b), sb);
  b.dimension = { id: "minecraft:nether" };
  world.afterEvents.playerDimensionChange.emit({ player: b });
  await executarAgendados();
  for (const p of [a, b]) {
    assert.equal(p.getDynamicProperty(CHAVE_VISUAL), undefined);
    assert.deepEqual(canais(p, PROP_RASCUNHO), [-1, -1, -1]);
    assert.equal(p.getDynamicProperty(CHAVE_CAMERA), undefined);
  }
});

test("combate, finalização e forma ativa impedem abertura e resposta atrasada após uma queda é ignorada", async () => {
  const bloqueios = [
    (p) => p.addTag("kny_finalizando"),
    (p) => p.setDynamicProperty("kny:h_combate_ate", Date.now() + 30000),
    (p) => p.setProperty("kny:forms", 3),
  ];
  for (const aplicar of bloqueios) {
    const p = novo();
    aplicar(p);
    assert.throws(() => iniciarEdicao(p), /em uma ação/);
    assert.equal(p.camera.atual, undefined);
  }
  const p = novo();
  let responder;
  p.escolhas.push((f) => new Promise((resolve) => { responder = () => resolve(confirmar("CONFIRMAR")(f)); }));
  const tela = abrirEditor(p);
  await executarAgendados();
  p.triggerEvent("kny:caido_on");
  responder();
  await tela;
  assert.equal(p.getDynamicProperty(CHAVE_VISUAL), undefined);
  assert.equal(p.camera.atual, undefined);
  assert.equal(p.formulariosFechados, 1);
});

test("o servidor rejeita catálogo alterado e falha de gravação deixa a ficha sem alteração", () => {
  const p = novo();
  const sessao = iniciarEdicao(p);
  assert.ok(definirVisual(sessao, { peleIntegral: "pele_b_4a2c20" }));
  world.setDynamicProperty(oficina.CHAVE_CATALOGO, JSON.stringify({ v: 1, bloqueados: ["pele_b_4a2c20"] }));
  assert.equal(salvarEdicao(sessao), false);
  world.setDynamicProperty(oficina.CHAVE_CATALOGO, undefined);
  p.falharGravacao = CHAVE_VISUAL;
  assert.throws(() => salvarEdicao(sessao), /falha de gravação/);
  encerrarEdicao(sessao);
  assert.equal(p.getDynamicProperty(CHAVE_VISUAL), undefined);
  assert.equal(oficina.edicaoInicialDisponivel(p), false);
  assert.deepEqual(canais(p, PROP_RASCUNHO), [-1, -1, -1]);
});

test("canais, controladores, armaduras e as dez texturas de corpo inteiro correspondem ao catálogo", () => {
  const ler = (base, nome) => readFileSync(new URL(nome, base), "utf8");
  const json = (base, nome) => JSON.parse(ler(base, nome).replace(/^\s*\/\/.*$|\/\*[^]*?\*\//gm, ""));
  const def = json(bp, "entities/player.json")["minecraft:entity"].description;
  for (const [props, valor] of [[PROP_APARENCIA, 0], [PROP_RASCUNHO, -1]]) {
    for (const prop of props) assert.deepEqual(def.properties[prop], {
      type: "int", range: [valor, 16777215], default: valor, client_sync: true,
    });
  }
  assert.match(ler(bp, "functions/inicio.mcfunction"), /tag=!start.*scriptevent kny:aparencia_inicial primeiro/);
  assert.doesNotMatch(ler(bp, "functions/inicio.mcfunction"), /give.*kny:menu_kimetsu/);
  const player = json(rp, "entity/player.entity.json")["minecraft:client_entity"].description;
  const controllers = json(rp, "render_controllers/customizacao.render_controllers.json").render_controllers;
  assert.equal(controllers["controller.render.kny.cc_rosto"], undefined);
  for (const conjunto of config.CANAIS) {
    assert.ok(conjunto.length <= 6);
    for (const campo of conjunto) {
      const codigos = config.CAMPOS[campo].opcoes.map((item) => item.codigo);
      assert.ok(codigos.every((c) => c >= 0 && c < 16));
      assert.equal(new Set(codigos).size, codigos.length);
    }
  }
  const peles = config.PELES_INICIAIS.filter(({ codigo }) => codigo > 0);
  assert.equal(peles.length, 10);
  for (const [perspectiva, base] of [["first_person", "first_person"], ["third_person", "third_person"], ["map", "map"]]) {
    const apelido = "controller.render.kny.pele_" + perspectiva;
    const controle = controllers[apelido];
    const atlas = controle.arrays.textures["Array.peles_kny"];
    assert.equal(controle.geometry, "Geometry.default");
    assert.ok(player.render_controllers.some((r) => r[apelido]?.includes("cc_peleIntegral > 0")));
    assert.ok(player.render_controllers.some((r) => r["controller.render.player." + base]?.includes("cc_peleIntegral == 0")));
    for (const { id, codigo } of peles) {
      assert.equal(atlas[codigo], "Texture.cc_" + id);
      const png = readFileSync(new URL(player.textures["cc_" + id] + ".png", rp));
      assert.equal(png.toString("ascii", 1, 4), "PNG");
      assert.equal(png.readUInt32BE(16), 128);
      assert.equal(png.readUInt32BE(20), 128);
    }
  }
  assert.ok(controllers["controller.render.kny.pele_third_person"].part_visibility.some((x) => x.bodyArmor === "variable.chest_layer_visible"));
  for (const nome of Object.keys(controllers)) assert.ok(player.render_controllers.some((r) => r[nome]));
  assert.ok(player.scripts.pre_animation.some((l) => l.includes("query.is_local_player")));
  assert.ok(player.scripts.pre_animation.some((l) => l.includes("cc_peleIntegral") && l.includes("4096")));
  assert.ok(!ler(rp, "ui/server_form.json").includes("kny_oficina.acesso"));
  assert.ok(json(rp, "ui/_ui_defs.json").ui_defs.includes("ui/character_customization.json"));
  const ui = json(rp, "ui/character_customization.json");
  const visor = ui.editor.controls.find((control) => control.visor).visor;
  assert.equal(visor.clips_children, true);
  const retrato = visor.controls.find((control) => control.retrato).retrato;
  assert.ok(retrato.bindings.some((b) => b.source_property_name?.includes("kny_edit|R")));
  assert.equal(retrato.controls.length, 5);
  assert.doesNotMatch(JSON.stringify(ui.editor), /live_player_renderer/);
  const controle = (id) => ui.editor.controls.find((c) => Object.hasOwn(c, id))[id];
  const comandos = controle("camera@kny_oficina.botoes");
  const decisoes = controle("decisoes@kny_oficina.botoes");
  const fimVisor = parseFloat(visor.offset[1]) + parseFloat(visor.size[1]);
  const fimComandos = parseFloat(comandos.offset[1]) + parseFloat(comandos.size[1]);
  const inicioDecisoes = 100 + parseFloat(decisoes.offset[1]) - parseFloat(decisoes.size[1]);
  assert.ok(fimVisor < parseFloat(comandos.offset[1]) && fimComandos < inicioDecisoes);
  assert.equal(ui["opcao@kny_oficina.botao"].clips_children, true);
  assert.ok(player.scripts.animate.some((a) => a.maos_editor === "query.is_local_player && query.property('kny:cc_edicao')"));
  const animacao = json(rp, "animations/maos_editor.animation.json").animations[player.animations.maos_editor];
  assert.deepEqual(Object.keys(animacao.bones), ["rightItem", "leftItem"]);
  const conferirMiniatura = (nome) => {
    const png = readFileSync(new URL("textures/ui/customizacao/previa/" + nome + ".png", rp));
    assert.equal(png.toString("ascii", 1, 4), "PNG");
    assert.equal(png.readUInt32BE(16), 80, nome);
    assert.equal(png.readUInt32BE(20), 156, nome);
  };
  for (const { id } of peles) conferirMiniatura("pele/" + id);
  for (const { codigo } of config.CAMPOS.cabelo.opcoes.slice(1)) {
    for (const { id } of config.CORES_CABELO) {
      conferirMiniatura(`cabelo/${codigo}_${id}`);
      conferirMiniatura(`mecha/${codigo}_${id}`);
    }
  }
  for (const { codigo } of config.CAMPOS.olhos.opcoes.slice(1)) {
    for (const { id } of config.IRIS) {
      for (const lado of ["e", "d"]) conferirMiniatura(`olho/${lado}_${codigo}_${id}`);
    }
  }
  assert.deepEqual(codificarVisual(VISUAL_PADRAO), [0, 0, 0]);
});

test("máscaras usam o item correto e as duas camadas de olhos respeitam o equipamento", () => {
  const ler = (pack, nome) => JSON.parse(readFileSync(new URL(nome, pack), "utf8").replace(/^\s*\/\/.*$/gm, ""));
  const player = ler(rp, "entity/player.entity.json")["minecraft:client_entity"].description;
  const oficina = ler(rp, "models/entity/customizacao/oficina.geo.json")["minecraft:geometry"];
  const controladores = player.render_controllers;
  for (const camada of ["olho_e", "olho_d", "demonio"]) {
    const id = "controller.render.kny.cc_" + camada;
    const condicao = controladores.find((c) => c[id])?.[id];
    assert.match(condicao, /!query\.has_head_gear\b/, camada);
    assert.doesNotMatch(condicao, /cc_peleIntegral/, camada);
  }

  const frente = (c) => c.origin[2] - (c.inflate ?? 0);
  const olhos = oficina.filter((g) => /\.cc_(olho_[ed]_\d|traco_4)$/.test(g.description.identifier));
  assert.equal(olhos.length, 9);
  const frenteOlhos = Math.min(...olhos.flatMap((g) => g.bones.find((b) => b.name === "head").cubes.map(frente)));
  for (const nome of ["sabito_mask", "hyottoko_mask", "urokodaki_mask", "boar_head"]) {
    const id = "kny:" + nome;
    const { description, components } = ler(bp, "items/armos/" + nome + ".json")["minecraft:item"];
    const render = ler(rp, "attachables/" + nome + ".json")["minecraft:attachable"].description;
    assert.equal(description.identifier, id);
    assert.equal(components["minecraft:wearable"].slot, "slot.armor.head");
    assert.equal(render.identifier, id);
    assert.deepEqual(Object.keys(render.item), [id]);
    const geo = ler(rp, "models/entity/" + nome + ".geo.json")["minecraft:geometry"][0];
    assert.equal(render.geometry.default, geo.description.identifier);
    const png = readFileSync(new URL(render.textures.default + ".png", rp));
    assert.equal(png.toString("ascii", 1, 4), "PNG");
    if (nome === "sabito_mask" || nome === "hyottoko_mask") {
      const casco = geo.bones.find((b) => b.name === "hat").cubes.find((c) => c.size[0] === 8 && c.size[1] === 8);
      assert.ok(frente(casco) < frenteOlhos, nome + " à frente das íris e pupilas");
      assert.notEqual(casco.uv.north, undefined, nome + " tem face frontal");
    }
  }
});

test("HUD oculta armadura e corações e continua a desenhar o painel Kimetsu", () => {
  const hud = JSON.parse(readFileSync(new URL("ui/hud_screen.json", rp), "utf8").replace(/\/\*[^]*?\*\//g, ""));
  assert.equal(hud.namespace, "hud");
  for (const [nome, binding] of [["heart_renderer", "#show_survival_ui"], ["armor_renderer", "#is_armor_visible"]]) {
    assert.equal(hud[nome].visible, false);
    assert.deepEqual(hud[nome].modifications, [
      { array_name: "bindings", operation: "remove", where: { binding_name: binding } },
    ]);
  }
  for (const nome of ["horse_heart_renderer", "hotbar_renderer", "bubbles_renderer", "hunger_renderer"]) {
    assert.equal(hud[nome], undefined);
  }
  const controles = hud["root_panel_bg@common.empty_panel"].controls;
  assert.equal(controles.some((c) => Object.keys(c).some((chave) => /^hp\d+$/.test(chave))), false);
  const painel = controles.find((c) => c.kny_painel)?.kny_painel;
  assert.ok(painel);
  for (const label of ["VIDA", "FÔLEGO", "STAMINA"]) assert.ok(JSON.stringify(painel).includes(label));
});
