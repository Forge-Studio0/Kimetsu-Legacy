import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { system, world, jogador, executarAgendados, executarIntervalos } from "./simulador.mjs";

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

const { CHAVE_VISUAL, CHAVE_CATALOGO, iniciarEdicao, encerrarEdicao, definirVisual, salvarEdicao } = oficina;
const { PROP_APARENCIA, PROP_RASCUNHO, VISUAL_PADRAO, codificarVisual } = config;
const chaveCamera = "kny:aparencia_camera";
const canais = (p, chaves) => chaves.map((k) => p.getProperty(k));
const confirmar = (nome) => (f) => {
  const selection = f.buttons.findIndex(({ texto }) => texto.replace(/§./g, "").includes(nome));
  assert.ok(selection >= 0, nome + " em " + f.titulo);
  return { selection };
};
const eventoStaff = (p, message) => system.afterEvents.scriptEventReceive.emit({ id: "kny:aparencia", sourceEntity: p, message });
const abrirMenu = (p) => system.afterEvents.scriptEventReceive.emit({ id: "kny:menu", sourceEntity: p, message: "" });

test("abre pelo contrato e pelo clássico, experimenta cabelo e cor e confirma pelo menu", async () => {
  const p = jogador();
  p.escolhas.push(confirmar("Customizar personagem"), confirmar("Cabelo"), confirmar("Cor principal"),
    confirmar("Próximo"), confirmar("Girar ›"), confirmar("SALVAR"));
  abrirMenu(p);
  await executarAgendados();
  assert.ok(p.telas[0].titulo.startsWith("kny_ctr|"));
  assert.ok(p.telas[1].titulo.startsWith("kny_edit|"));
  assert.equal(oficina.lerAparencia(p).perfis.base.cabelo, "corte_curto");
  assert.equal(oficina.lerAparencia(p).perfis.base.corCabelo, "castanha");
  assert.equal(p.hasTag("slayer"), false);
  assert.equal(p.camera.atual, undefined);
  assert.deepEqual(canais(p, PROP_RASCUNHO), [-1, -1, -1]);
  p.addTag("slayer");
  p.addTag("kny_cfg_classico");
  p.escolhas.push(confirmar("Customizar personagem"), confirmar("Cancelar"));
  abrirMenu(p);
  await executarAgendados();
  assert.match(p.telas.at(-1).titulo, /^§6OFICINA DE PERSONAGEM$/);
});

test("descarte e falha de gravação preservam o visual confirmado e os dados de jogo", () => {
  const p = jogador();
  p.addTag("slayer");
  p.addTag("kinoe");
  const inventario = p.getComponent("minecraft:inventory").container;
  const item = { typeId: "kny:nichirin_blue", amount: 1 };
  inventario.setItem(0, item);
  const tags = p.getTags();
  p.setDynamicProperty("kny:h_dominio", "dados do treino");
  const hp = p.getComponent("minecraft:health").currentValue;
  const antes = iniciarEdicao(p);
  assert.ok(definirVisual(antes, { cabelo: "coque", roupa: "haori_liso", olhoD: "ametista" }));
  assert.equal(p.getDynamicProperty(CHAVE_VISUAL), undefined);
  assert.ok(salvarEdicao(antes));
  const salvo = p.getDynamicProperty(CHAVE_VISUAL);
  const render = canais(p, PROP_APARENCIA);
  const nova = iniciarEdicao(p);
  assert.throws(() => iniciarEdicao(p), /local seguro/);
  definirVisual(nova, { cabelo: "trancas" });
  assert.deepEqual(canais(p, PROP_APARENCIA), render);
  assert.notDeepEqual(canais(p, PROP_RASCUNHO), render);
  p.falharGravacao = CHAVE_VISUAL;
  assert.throws(() => salvarEdicao(nova), /falha de gravação/);
  encerrarEdicao(nova);
  assert.equal(salvarEdicao(nova), false);
  assert.equal(p.getDynamicProperty(CHAVE_VISUAL), salvo);
  assert.deepEqual(canais(p, PROP_APARENCIA), render);
  assert.equal(inventario.getItem(0), item);
  assert.deepEqual(p.getTags(), tags);
  assert.equal(p.getDynamicProperty("kny:h_dominio"), "dados do treino");
  assert.equal(p.getComponent("minecraft:health").currentValue, hp);
});

test("rascunhos e câmera isolados, restaurados no dano e ao trocar de dimensão", async () => {
  const a = jogador();
  const b = jogador();
  const primeira = iniciarEdicao(a);
  const segunda = iniciarEdicao(b);
  definirVisual(primeira, { cabelo: "coque" });
  definirVisual(segunda, { roupa: "kosode" });
  assert.ok(camera.atualizarCamera(primeira, { modo: "rosto", angulo: 90, zoom: -2 }));
  assert.ok(a.camera.atual.location.x < b.camera.atual.location.x - 1);
  assert.notDeepEqual(canais(a, PROP_RASCUNHO), canais(b, PROP_RASCUNHO));
  a.applyDamage(1);
  assert.equal(oficina.sessaoAtual(a), undefined);
  assert.equal(a.camera.atual, undefined);
  assert.deepEqual(canais(a, PROP_RASCUNHO), [-1, -1, -1]);
  assert.equal(oficina.sessaoAtual(b), segunda);
  assert.equal(b.camera.atual.preset, "minecraft:free");
  b.dimension = { id: "minecraft:nether" };
  world.afterEvents.playerDimensionChange.emit({ player: b });
  await executarAgendados();
  for (const p of [a, b]) {
    assert.equal(p.getDynamicProperty(CHAVE_VISUAL), undefined);
    assert.equal(p.getDynamicProperty(chaveCamera), undefined);
    assert.equal(p.camera.atual, undefined);
  }
});

test("uma resposta atrasada de salvar após fechar ou morrer não grava a ficha", async () => {
  const p = jogador();
  p.escolhas.push(confirmar("Cabelo"), confirmar("Próximo"));
  let responder;
  p.escolhas.push((f) => new Promise((resolve) => {
    responder = () => resolve(confirmar("SALVAR")(f));
  }));
  const tela = abrirEditor(p);
  await executarAgendados();
  assert.equal(typeof responder, "function");
  world.afterEvents.entityDie.emit({ deadEntity: p });
  responder();
  await tela;
  assert.equal(p.getDynamicProperty(CHAVE_VISUAL), undefined);
  assert.equal(p.camera.atual, undefined);
  assert.deepEqual(canais(p, PROP_RASCUNHO), [-1, -1, -1]);
});

test("área bloqueada, animação, combate, movimentação e queda encerram ou impedem a edição", () => {
  const p = jogador();
  p.dimension.getBlockFromRay = () => ({ block: { location: { x: 0, y: 71, z: 1 } }, faceLocation: { x: 0, y: 0, z: 0 } });
  assert.throws(() => iniciarEdicao(p), /espaço/);
  assert.equal(p.camera.atual, undefined);
  delete p.dimension.getBlockFromRay;
  p.addTag("kny_finalizando");
  assert.throws(() => iniciarEdicao(p), /local seguro/);
  p.removeTag("kny_finalizando");
  p.setDynamicProperty("kny:h_combate_ate", Date.now() + 30000);
  assert.throws(() => iniciarEdicao(p), /local seguro/);
  p.setDynamicProperty("kny:h_combate_ate", undefined);
  p.setProperty("kny:forms", 3);
  assert.throws(() => iniciarEdicao(p), /local seguro/);
  p.setProperty("kny:forms", 0);
  iniciarEdicao(p);
  p.location.x += 10;
  executarIntervalos(4);
  assert.equal(p.camera.atual, undefined);
  const s = iniciarEdicao(p);
  s.formAberto = true;
  p.triggerEvent("kny:caido_on");
  assert.equal(p.formulariosFechados, 1);
  assert.equal(p.camera.atual, undefined);
});

test("ficha sobrevive ao respawn, promoção e reconexão, sem reaplicar rascunho", async () => {
  const p = jogador();
  const confirmado = iniciarEdicao(p);
  definirVisual(confirmado, { pele: "bronze", roupa: "hakama" });
  salvarEdicao(confirmado);
  const salvo = p.getDynamicProperty(CHAVE_VISUAL);
  const antigo = canais(p, PROP_APARENCIA);
  const pendente = iniciarEdicao(p);
  definirVisual(pendente, { roupa: "kimono" });
  p.desconectar();
  assert.equal(oficina.sessaoAtual(p), undefined);
  const voltou = jogador(p.name, p.dinamicos);
  world.afterEvents.playerSpawn.emit({ player: voltou, initialSpawn: true });
  await executarAgendados();
  assert.equal(voltou.getDynamicProperty(chaveCamera), undefined);
  assert.deepEqual(canais(voltou, PROP_RASCUNHO), [-1, -1, -1]);
  voltou.addTag("slayer");
  voltou.addTag("hashira");
  world.afterEvents.playerSpawn.emit({ player: voltou, initialSpawn: false });
  await executarAgendados();
  assert.deepEqual(canais(voltou, PROP_APARENCIA), antigo);
  assert.equal(voltou.getDynamicProperty(CHAVE_VISUAL), salvo);
});

test("identidades híbridas gravam perfis separados e usam o disfarce legítimo para exibição", async () => {
  const p = jogador();
  const d = { v: 1, id: registros.identificador(p), estado: "ativo", raca: "hibrido",
    resp: "water", formas: 10, arte: "enmu", publico: "cacador" };
  registros.guardarPersonagem(p, d);
  hibrido.espelharHibrido(p, d);
  const s = iniciarEdicao(p);
  assert.equal(s.perfil, "cacador");
  assert.equal(definirVisual(s, { demonio: "chifres" }), false);
  assert.ok(definirVisual(s, { roupa: "hakama", cabeca: "faixa" }));
  assert.ok(oficina.trocarPerfil(s, "oni"));
  assert.ok(definirVisual(s, { cabelo: "longo", demonio: "chifres", cabeca: "presilha" }));
  assert.equal(oficina.rascunho(s).cabeca, "nenhum");
  assert.ok(oficina.trocarPerfil(s, "revelado"));
  assert.ok(definirVisual(s, { pele: "terracota", demonio: "pupilas" }));
  assert.ok(salvarEdicao(s));
  assert.equal(hibrido.getPublicIdentity(p), "cacador");
  assert.equal(p.getProperty("kny:h_publico"), 1);
  assert.equal(oficina.lerAparencia(p).perfis.cacador.demonio, "nenhum");
  assert.deepEqual(canais(p, PROP_APARENCIA), codificarVisual(oficina.lerAparencia(p).perfis.cacador));
  hibrido.trocarDisfarce(p, "oni");
  await executarAgendados();
  assert.equal(hibrido.getPublicIdentity(p), "oni");
  assert.deepEqual(canais(p, PROP_APARENCIA), codificarVisual(oficina.lerAparencia(p).perfis.oni));
});

test("Staff autoriza nome e concessão, revoga a opção e fecha formulários antigos", async () => {
  const p = jogador("Novo Jogador");
  const staff = jogador("Editora");
  staff.addTag("kny_op");
  eventoStaff(p, 'autorizar_nome "Novo Jogador" sim');
  assert.equal(p.getDynamicProperty(CHAVE_VISUAL), undefined);
  let s = iniciarEdicao(p);
  assert.equal(definirVisual(s, { cabeca: "adorno_festival" }), false);
  eventoStaff(staff, 'conceder "Novo Jogador" adorno_festival');
  assert.equal(salvarEdicao(s), false);
  eventoStaff(staff, 'autorizar_nome "Novo Jogador" sim');
  p.escolhas.push(confirmar("Informações"), confirmar("Editar nome"), () => ({ formValues: ["Hana", "Sato"] }), confirmar("SALVAR"));
  await abrirEditor(p);
  assert.equal(oficina.lerAparencia(p).nome, "Hana");
  assert.equal(p.nameTag, p.name);
  assert.equal(oficina.validarNome("Nome §4"), undefined);
  s = iniciarEdicao(p);
  assert.ok(definirVisual(s, { cabeca: "adorno_festival" }));
  assert.ok(salvarEdicao(s));
  eventoStaff(staff, "desativar adorno_festival");
  assert.ok(oficina.lerCatalogo().bloqueados.includes("adorno_festival"));
  assert.deepEqual(canais(p, PROP_APARENCIA), codificarVisual(VISUAL_PADRAO));
  eventoStaff(staff, "ativar adorno_festival");
  assert.notDeepEqual(canais(p, PROP_APARENCIA), codificarVisual(VISUAL_PADRAO));
  eventoStaff(staff, 'revogar "Novo Jogador" adorno_festival');
  assert.deepEqual(canais(p, PROP_APARENCIA), codificarVisual(VISUAL_PADRAO));
  assert.deepEqual(JSON.parse(world.getDynamicProperty(CHAVE_CATALOGO)).bloqueados, []);
});

test("recursos ligam o catálogo, as propriedades, os modelos, as texturas e o formulário", () => {
  const ler = (base, nome) => readFileSync(new URL(nome, base), "utf8");
  const json = (base, nome) => JSON.parse(ler(base, nome).replace(/^\s*\/\/.*$|\/\*[^]*?\*\//gm, ""));
  const bpPlayer = json(bp, "entities/player.json")["minecraft:entity"].description;
  for (const [propriedades, valor] of [[PROP_APARENCIA, 0], [PROP_RASCUNHO, -1]]) {
    for (const propriedade of propriedades) assert.deepEqual(bpPlayer.properties[propriedade], {
      type: "int", range: [valor, 16777215], default: valor, client_sync: true,
    });
  }
  const codigos = new Set();
  for (const grupo of config.CANAIS) {
    assert.ok(grupo.length <= 6);
    for (const campo of grupo) {
      codigos.clear();
      for (const item of config.CAMPOS[campo].opcoes) {
        assert.match(item.id, /^[a-z0-9_]+$/);
        assert.ok(item.codigo >= 0 && item.codigo < 16 && !codigos.has(item.codigo));
        codigos.add(item.codigo);
      }
    }
  }
  const player = json(rp, "entity/player.entity.json")["minecraft:client_entity"].description;
  const modelos = json(rp, "models/entity/customizacao/oficina.geo.json")["minecraft:geometry"];
  const controllers = json(rp, "render_controllers/customizacao.render_controllers.json").render_controllers;
  for (const [alias, modelo] of Object.entries(player.geometry).filter(([id]) => id.startsWith("cc_"))) {
    const geo = modelos.find(({ description }) => description.identifier === modelo);
    assert.ok(geo, alias);
    for (const osso of geo.bones.filter((b) => b.parent)) assert.ok(geo.bones.some((b) => b.name === osso.parent), osso.name);
  }
  for (const [alias, textura] of Object.entries(player.textures).filter(([id]) => id.startsWith("cc_"))) {
    const png = readFileSync(new URL(textura + ".png", rp));
    assert.equal(png.toString("ascii", 1, 4), "PNG", alias);
    assert.equal(png.readUInt32BE(16), 64, alias);
    assert.equal(png.readUInt32BE(20), 64, alias);
  }
  for (const controller of Object.keys(controllers)) assert.ok(player.render_controllers.some((r) => r[controller]));
  assert.ok(player.scripts.pre_animation.some((line) => line.includes("query.is_local_player")));
  assert.ok(json(rp, "ui/_ui_defs.json").ui_defs.includes("ui/character_customization.json"));
  assert.match(ler(rp, "ui/server_form.json"), /kny_edit\|/);
  assert.equal(json(rp, "ui/character_customization.json").editor.controls.length, 4);
});
