// Atualiza mecanicamente os pontos de entrada das técnicas da v71.
// Execute uma vez sobre uma extração limpa com os scripts da v72 instalados.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const pack = resolve(process.argv[2]);
const { RESP_H_ID, ARTE_H_ID } = await import(pathToFileURL(join(pack, "scripts/hybrid_config.js")));
const alterados = [];
function editar(caminho, fn) {
  const path = join(pack, caminho);
  const original = readFileSync(path, "utf8");
  if (original.includes("kny:h_linhagem")) throw new Error(caminho + " já foi atualizado");
  const d = JSON.parse(original);
  fn(d);
  const final = JSON.stringify(d, null, 2) + "\n";
  if (JSON.stringify(JSON.parse(original)) === JSON.stringify(d)) return;
  alterados.push({ caminho, path, final });
}

const propriedade = (id) => `query.property('kny:h_${id}')`;
const linhagem = propriedade("linhagem");
const disponivel = `!${propriedade("ocupado")} && query.property('kny:caido') == 0`;
const regraItem = (itens) => `query.is_item_name_any('slot.weapon.mainhand', 0, ${itens.map((id) => "'"+id+"'").join(", ")})`;
function autorizado(tipo, id) {
  const definicao = tipo === "resp" ? RESP_H_ID.get(id) : ARTE_H_ID.get(id);
  const base = tipo === "resp" ? `${linhagem} == 0` : `${linhagem} < 2`;
  if (!definicao) return base;
  const itens = tipo === "resp" ? definicao.itens : [definicao.item];
  const exigeItem = itens.length ? regraItem(itens) : "query.equipped_item_any_tag('slot.weapon.mainhand','nichirin_cor')";
  const prop = propriedade(tipo === "resp" ? "resp" : "arte");
  return `(${base} || (${linhagem} == 2 && ${prop} == ${definicao.codigo} && ${disponivel} && ${exigeItem}))`;
}

function integrar(states, determinar) {
  const entradas = states.default.transitions;
  const novas = [];
  const revela = new Map();
  for (const original of entradas) {
    const [estado, cond] = Object.entries(original)[0];
    const regra = determinar(estado, cond);
    if (!regra) {
      novas.push(original);
      continue;
    }
    const { tipo, id, ativacao } = regra;
    const acesso = autorizado(tipo, id);
    const precisaRevelar = `${linhagem} == 2 && ${propriedade("revelar")} && ${propriedade("publico")} == ${tipo === "resp" ? 2 : 1}`;
    const condicao = `(${cond}) && ${acesso}`;
    novas.push({ [estado]: ativacao ? `${condicao} && !(${precisaRevelar})` : condicao });
    if (ativacao) {
      const nome = "kny_h_revela_" + tipo + "_" + id;
      const lista = revela.get(nome) ?? [];
      lista.push(condicao);
      revela.set(nome, lista);
      states[nome] = {
        on_entry: [`/scriptevent kny:h_revelar ${tipo} ${id}`],
        transitions: [{ default: "1.0" }],
      };
    }
  }
  const gatilhos = [];
  for (const [nome, lista] of revela) {
    const tipo = nome.startsWith("kny_h_revela_resp_") ? "resp" : "arte";
    gatilhos.push({ [nome]: `${linhagem} == 2 && ${propriedade("revelar")} && ${propriedade("publico")} == ${tipo === "resp" ? 2 : 1} && (${lista.join(" || ")})` });
  }
  states.default.transitions = [...gatilhos, ...novas];
}

editar("animation_controllers/main.json", (d) => {
  integrar(d.animation_controllers["controller.animation.main"].states, (nome, cond) => {
    const resp = cond.match(/scoreboard\('kf_([a-z0-9]+)'\)/)?.[1];
    if (resp) return { tipo: "resp", id: resp, ativacao: /^basica[123]$/.test(nome) };
    if (ARTE_H_ID.has(nome) || ["doma", "rokuro"].includes(nome)) return { tipo: "arte", id: nome, ativacao: false };
    // Segundo ataque das formas avançadas de Água e Névoa.
    if (nome === "mist7") return { tipo: "resp", id: "muichiro", ativacao: false };
    return undefined;
  });
  const estados = d.animation_controllers["controller.animation.main"].states;
  estados.seisei2.on_entry = [
    "/execute as @s[tag=seiseiruten,tag=!kny_hybrid] at @s run function breathings/seiseiruten",
    "/execute as @s[tag=seiseiruten,tag=kny_hybrid] at @s run scriptevent kny:h_agua golpe",
  ];
});

const alias = { kokushibo_hold2: "kokushibo2", nakime_hold: "biwa" };
for (const [pasta, tipo] of [["breathings", "resp"], ["kekkijutsu", "arte"]]) {
  for (const nome of readdirSync(join(pack, "animation_controllers", pasta)).filter((n) => n.endsWith(".json")).sort()) {
    editar(`animation_controllers/${pasta}/${nome}`, (d) => {
      for (const [nome, c] of Object.entries(d.animation_controllers)) {
        const curto = nome.replace("controller.animation.", "");
        if (curto === "mark_hold") continue;
        const id = alias[curto] ?? curto.replace(/_hold$/, "");
        if (!(tipo === "resp" ? RESP_H_ID : ARTE_H_ID).has(id)) throw new Error("Controlador sem mapeamento: " + curto);
        integrar(c.states, () => ({ tipo, id, ativacao: true }));
      }
    });
  }
}

editar("entities/player.json", (d) => {
  const e = d["minecraft:entity"];
  Object.assign(e.description.properties, {
    "kny:h_linhagem": { type: "int", range: [0, 3], default: 0 },
    "kny:h_resp": { type: "int", range: [0, 64], default: 0 },
    "kny:h_arte": { type: "int", range: [0, 64], default: 0 },
    "kny:h_publico": { type: "int", range: [0, 3], default: 0, client_sync: true },
    "kny:h_ocupado": { type: "bool", default: false },
    "kny:h_revelar": { type: "bool", default: true },
  });
  const grupos = ["kny:h_cacador", "kny:h_oni", "kny:h_revelado"];
  const familias = [["player", "slayer"], ["player_demon"], ["player_demon", "kny_hybrid"]];
  for (const [i, grupo] of grupos.entries()) {
    e.component_groups[grupo] = {
      "minecraft:type_family": { family: familias[i] },
      "minecraft:mark_variant": { value: i === 0 ? 0 : 2 },
    };
    const nome = grupo.replace("kny:h_", "kny:h_publico_");
    e.events[nome] = { sequence: [
      { remove: { component_groups: ["demon_family", "burn_daylight", ...grupos.filter((g) => g !== grupo)] } },
      { add: { component_groups: [grupo] } },
    ] };
  }
  for (const nome of ["kny:demon_family", "burn_daylight_on"]) e.events[nome].filters = {
    test: "int_property", domain: "kny:h_linhagem", operator: "<", value: 2,
  };
});
for (const { path, final } of alterados) writeFileSync(path, final);
console.log(alterados.map(({ caminho }) => caminho).join("\n"));
