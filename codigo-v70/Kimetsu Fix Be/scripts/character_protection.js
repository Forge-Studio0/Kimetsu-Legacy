import { InputPermissionCategory, world } from "@minecraft/server";

const ESTADO = "kny:criacao_controles";
const CATEGORIAS = [
  InputPermissionCategory.LateralMovement, InputPermissionCategory.Jump,
  InputPermissionCategory.Sneak, InputPermissionCategory.Mount, InputPermissionCategory.Dismount,
];
const protegidos = new Set();

export function protegerCriacao(p) {
  if (protegidos.has(p.id)) return;
  const entrada = p.inputPermissions;
  const alteradas = CATEGORIAS.filter((c) => entrada.isPermissionCategoryEnabled(c));
  p.setDynamicProperty(ESTADO, JSON.stringify(alteradas));
  protegidos.add(p.id);
  for (const c of alteradas) entrada.setPermissionCategory(c, false);
  p.triggerEvent("kny:criacao_proteger");
}

export function liberarCriacao(p) {
  protegidos.delete(p.id);
  const salvo = p.getDynamicProperty(ESTADO);
  if (typeof salvo !== "string") return;
  p.triggerEvent("kny:criacao_liberar");
  for (const c of JSON.parse(salvo)) {
    if (CATEGORIAS.includes(c)) p.inputPermissions.setPermissionCategory(c, true);
  }
  p.setDynamicProperty(ESTADO, undefined);
}

world.beforeEvents.entityHurt.subscribe((ev) => {
  if (protegidos.has(ev.hurtEntity.id) || protegidos.has(ev.damageSource.damagingEntity?.id)) ev.cancel = true;
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => protegidos.delete(playerId));
