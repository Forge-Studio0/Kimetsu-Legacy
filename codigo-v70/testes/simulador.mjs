const objetivos = new Map();
const jogadores = new Map();
const depois = [];
const intervalos = [];
const mundoDinamico = new Map();
const dimensoes = new Map();
export const InputPermissionCategory = { LateralMovement: 4, Sneak: 5, Jump: 6, Mount: 7, Dismount: 8 };

function sinais() {
  return new Proxy({}, {
    get(obj, nome) {
      if (!obj[nome]) {
        const callbacks = [];
        obj[nome] = {
          subscribe(fn, op) { callbacks.push([fn, op]); },
          emit(ev) {
            for (const [fn, op] of callbacks) {
              if (op?.eventTypes && !op.eventTypes.includes(ev.eventId)) continue;
              fn(ev);
            }
          },
        };
      }
      return obj[nome];
    },
  });
}
const chave = (participante) => typeof participante === "string" ? "nome:" + participante : participante.id;

export const world = {
  beforeEvents: sinais(),
  afterEvents: sinais(),
  getDynamicProperty(id) { return mundoDinamico.get(id); },
  setDynamicProperty(id, value) { mundoDinamico.set(id, value); },
  getDynamicPropertyIds() { return [...mundoDinamico.keys()]; },
  getDimension(id) {
    if (!dimensoes.has(id)) dimensoes.set(id, { id, isChunkLoaded: () => true, runCommand() {} });
    return dimensoes.get(id);
  },
  getPlayers(opts) {
    return [...jogadores.values()].filter((p) => p.isValid && (!opts?.name || p.name === opts.name));
  },
  scoreboard: {
    getObjective(nome) { return objetivos.get(nome); },
    addObjective(nome) {
      const valores = new Map();
      const objetivo = {
        getScore(p) { return valores.get(chave(p))?.valor; },
        setScore(p, valor) {
          if (!Number.isInteger(valor) || valor < -2147483648 || valor > 2147483647) throw new Error("placar fora da faixa");
          valores.set(chave(p), { nome: typeof p === "string" ? p : p.name, valor });
        },
        getParticipants() {
          return [...valores].map(([id, v]) => ({ id: id.replace(/^nome:/, ""), displayName: v.nome }));
        },
        removeParticipant(p) { valores.delete(chave(typeof p === "string" ? p : p.displayName)); },
      };
      objetivos.set(nome, objetivo);
      return objetivo;
    },
  },
};

export const system = {
  currentTick: 100,
  beforeEvents: sinais(),
  afterEvents: sinais(),
  run(fn) { return this.runTimeout(fn, 1); },
  runTimeout(fn, ticks) { const tarefa = { fn, ticks }; depois.push(tarefa); return tarefa; },
  clearRun(tarefa) {
    const i = depois.indexOf(tarefa);
    if (i >= 0) depois.splice(i, 1);
  },
  runInterval(fn, ticks) { intervalos.push([fn, ticks]); },
};

export async function executarAgendados(rodadas = 8) {
  for (let i = 0; i < rodadas; i++) {
    for (const { fn } of depois.splice(0).sort((a, b) => a.ticks - b.ticks)) fn();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

export function executarIntervalos(periodo) {
  system.currentTick += periodo;
  for (const [fn, ticks] of intervalos) if (ticks === periodo) fn();
}

export class ItemStack {
  constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; }
}

export class ActionFormData {
  buttons = [];
  title(texto) { this.titulo = texto; return this; }
  body(texto) { this.corpo = texto; return this; }
  button(texto, icone) { this.buttons.push({ texto, icone }); return this; }
  async show(p) {
    p.telas.push(this);
    const escolha = p.escolhas.shift();
    return escolha ? escolha(this) : { canceled: true, cancelationReason: "UserClosed" };
  }
}

export class ModalFormData extends ActionFormData {
  campos = [];
  textField(nome, dica, opcoes) { this.campos.push({ nome, dica, opcoes }); return this; }
  submitButton(rotulo) { this.confirmar = rotulo; return this; }
}

export const uiManager = {
  closeAllForms(p) { p.formulariosFechados++; },
};

let conta = 0;
export function jogador(nome = "Teste" + ++conta, dinamicos = new Map()) {
  const bloqueadas = new Set();
  const id = "mock:" + nome;
  const tags = new Set();
  const mensagens = [];
  const titulos = [];
  const efeitos = new Map();
  const propriedades = new Map();
  const estoque = new Map();
  const hp = {
    defaultValue: 40,
    currentValue: 40,
    get effectiveMax() { return 40 + 4 * ((p.getEffect("health_boost")?.amplifier ?? -1) + 1); },
    setCurrentValue(n) {
      if (n < 0 || n > this.effectiveMax) throw new Error("PV fora da faixa");
      this.currentValue = n;
    },
  };
  const movimento = { currentValue: 0.1, setCurrentValue(v) { this.currentValue = v; } };
  const camera = {
    atual: undefined,
    limpezas: 0,
    setCamera(preset, opcoes) { this.atual = { preset, ...opcoes }; },
    clear() { this.atual = undefined; this.limpezas++; },
  };
  const p = {
    id, name: nome, typeId: "minecraft:player", isValid: true, tags, mensagens, titulos, dinamicos, telas: [], escolhas: [],
    camera, formulariosFechados: 0, nameTag: nome,
    inputPermissions: {
      isPermissionCategoryEnabled(c) { return !bloqueadas.has(c); },
      setPermissionCategory(c, enabled) { if (enabled) bloqueadas.delete(c); else bloqueadas.add(c); },
    },
    scoreboardIdentity: { id, name: nome },
    dimension: { id: "minecraft:overworld" }, location: { x: 0, y: 70, z: 0 }, selectedSlotIndex: 0,
    isSprinting: false, isSneaking: false, isOnGround: true,
    onScreenDisplay: { setTitle(t) { titulos.push(t); }, setActionBar() {} },
    getGameMode() { return "survival"; },
    getTags() { return [...tags]; },
    hasTag(t) { return tags.has(t); },
    addTag(t) { tags.add(t); },
    removeTag(t) { tags.delete(t); },
    sendMessage(t) { mensagens.push(t); },
    playSound() {},
    getProperty(id) { return propriedades.get(id); },
    setProperty(id, value) { propriedades.set(id, value); },
    getHeadLocation() { return { ...this.location, y: this.location.y + 1.6 }; },
    getViewDirection() { return { x: 1, y: 0, z: 0 }; },
    getRotation() { return { x: 0, y: 0 }; },
    tryTeleport(pos, op) { this.location = { ...pos }; if (op.dimension) this.dimension = op.dimension; return true; },
    triggerEvent(eventId) {
      if (eventId === "kny:criacao_proteger" || eventId === "kny:criacao_liberar") {
        this.setProperty("kny:cc_edicao", eventId === "kny:criacao_proteger");
      }
      world.afterEvents.dataDrivenEntityTrigger.emit({ entity: this, eventId });
    },
    getComponent(nome) {
      if (nome === "minecraft:health") return hp;
      if (nome === "minecraft:movement") return movimento;
      if (nome === "minecraft:equippable") return { getEquipment: () => this.item };
      if (nome === "minecraft:inventory") return { container: {
        size: 36,
        getItem(i) { return estoque.get(i); },
        setItem(i, item) { estoque.set(i, item); },
        addItem(item) {
          for (let i = 0; i < 36; i++) {
            if (!estoque.get(i)) {
              estoque.set(i, item);
              return undefined;
            }
          }
          return item;
        },
      } };
    },
    getDynamicProperty(nome) { return dinamicos.get(nome); },
    setDynamicProperty(nome, valor) {
      if (this.falharGravacao === nome) throw new Error("falha de gravação simulada");
      dinamicos.set(nome, valor);
    },
    getEffect(nome) {
      const e = efeitos.get(nome);
      if (!e || e.fim <= system.currentTick) return undefined;
      return { amplifier: e.amp, duration: e.fim - system.currentTick };
    },
    addEffect(nome, ticks, op) { efeitos.set(nome, { fim: system.currentTick + ticks, amp: op.amplifier }); },
    removeEffect(nome) {
      efeitos.delete(nome);
      if (nome === "health_boost") hp.currentValue = Math.min(hp.currentValue, hp.effectiveMax);
    },
    matches() { return false; },
    applyDamage(damage, damageSource = {}) {
      const ev = { damage, damageSource, hurtEntity: this, cancel: false };
      world.beforeEvents.entityHurt.emit(ev);
      if (ev.cancel) return false;
      hp.setCurrentValue(Math.max(0, hp.currentValue - ev.damage));
      world.afterEvents.entityHurt.emit(ev);
      return true;
    },
    desconectar() {
      this.isValid = false;
      jogadores.delete(id);
      world.afterEvents.playerLeave.emit({ playerId: id });
    },
  };
  jogadores.set(id, p);
  return p;
}
