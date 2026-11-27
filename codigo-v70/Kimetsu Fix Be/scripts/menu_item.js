import { ItemStack, system, world } from "@minecraft/server";

const MENU_ITEM = "kny:menu_kimetsu";
const semEspaco = new Set();
const pendentes = new Map();

// A mesma rotina atende o login, o respawn e a entrega pedida no menu.
export function garantirItemMenu(p) {
  const inventario = p.getComponent("minecraft:inventory")?.container;
  if (!inventario) return "indisponivel";

  let manter = -1;
  for (let slot = 0; slot < inventario.size; slot++) {
    if (inventario.getItem(slot)?.typeId !== MENU_ITEM) continue;
    if (manter < 0 || slot === p.selectedSlotIndex) {
      if (manter >= 0) inventario.setItem(manter, undefined);
      manter = slot;
    } else {
      inventario.setItem(slot, undefined);
    }
  }
  if (manter >= 0) {
    const item = inventario.getItem(manter);
    if (item.amount > 1) {
      item.amount = 1;
      inventario.setItem(manter, item);
    }
    semEspaco.delete(p.id);
    return "existente";
  }

  const item = new ItemStack(MENU_ITEM);
  item.lockMode = "inventory";
  item.keepOnDeath = true;
  if (inventario.addItem(item)) {
    semEspaco.add(p.id);
    return "cheio";
  }
  semEspaco.delete(p.id);
  return "entregue";
}

world.afterEvents.playerInventoryItemChange.subscribe(({ player, itemStack }) => {
  if (itemStack?.typeId !== MENU_ITEM && (itemStack || !semEspaco.has(player.id))) return;
  const id = player.id;
  if (pendentes.has(id)) return;
  const tarefa = system.run(() => {
    if (pendentes.get(id) !== tarefa) return;
    pendentes.delete(id);
    if (!player.isValid) return;
    try { garantirItemMenu(player); }
    catch (e) { console.warn("[Menu Kimetsu] Inventário: " + e); }
  });
  pendentes.set(id, tarefa);
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  semEspaco.delete(playerId);
  pendentes.delete(playerId);
});
