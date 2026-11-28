import { EquipmentSlot, GameMode, ItemStack, system, world } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
import { CAMPOS, PELES_INICIAIS, PROP_APARENCIA, VISUAL_PADRAO, codificarVisual } from "./character_config.js";
import { CHAVE_ENTRADA, CHAVE_VISUAL, aplicarVisualSalvo, lerAparencia } from "./character_system.js";
import { comPontoCarregado } from "./missoes_arenas.js";

const MASCARAS = ["sabito_mask", "hyottoko_mask", "urokodaki_mask", "boar_head"].map((id) => "kny:" + id);
const log = (mensagem) => console.warn("KNY-TEST MASCARAS " + mensagem);

function eq(atual, esperado, descricao) {
  if (atual !== esperado) throw new Error(`${descricao} (${atual} em vez de ${esperado})`);
}

async function testar() {
  const dimension = world.getDimension("overworld");
  const base = { x: 52, y: 209, z: 61 };
  await comPontoCarregado("kny_teste_mascaras", dimension, base, () =>
    dimension.getBlock(base).setType("minecraft:stone"));
  const pos = { x: base.x + 0.5, y: base.y + 1, z: base.z + 0.5 };
  const p = spawnSimulatedPlayer({ ...pos, dimension }, "MascarasV85", GameMode.Survival);
  p.addTag("start");
  p.setDynamicProperty(CHAVE_ENTRADA, "v78");
  p.teleport(pos, { dimension });
  const equipamento = p.getComponent("minecraft:equippable");
  let verificacoes = 0;
  for (const pele of PELES_INICIAIS) {
    for (const olhos of CAMPOS.olhos.opcoes) {
      const visual = { ...VISUAL_PADRAO, peleIntegral: pele.id, olhos: olhos.id, olhoE: "azul", olhoD: "vinho" };
      const registro = { v: 1, perfis: { base: visual }, nome: "", sobrenome: "", autorizarNome: false, concessoes: [] };
      p.setDynamicProperty(CHAVE_VISUAL, JSON.stringify(registro));
      aplicarVisualSalvo(p);
      const canais = codificarVisual(visual).join(",");
      for (const item of MASCARAS) {
        eq(equipamento.setEquipment(EquipmentSlot.Head, new ItemStack(item)), true, "equipar " + item);
        await system.waitTicks(1);
        eq(equipamento.getEquipment(EquipmentSlot.Head)?.typeId, item, "item na cabeça");
        eq(PROP_APARENCIA.map((chave) => p.getProperty(chave)).join(","), canais, "aparência com máscara");
        verificacoes++;
      }
      equipamento.setEquipment(EquipmentSlot.Head, undefined);
      await system.waitTicks(1);
      eq(equipamento.getEquipment(EquipmentSlot.Head), undefined, "ao tirar a máscara");
      eq(PROP_APARENCIA.map((chave) => p.getProperty(chave)).join(","), canais, "canais após tirar a máscara");
      eq(lerAparencia(p).perfis.base.peleIntegral, pele.id, "pele salva");
    }
  }
  p.disconnect();
  log(`OK ${verificacoes} combinações de pele, formato dos olhos e máscara`);
}

system.runTimeout(() => testar().catch((erro) => console.error("KNY-TEST FALHA MASCARAS " + erro + "\n" + erro.stack)), 35);
