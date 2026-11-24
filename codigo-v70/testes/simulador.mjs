const objetivos = new Map();
const jogadores = new Map();
const depois = [];
const intervalos = [];

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
  afterEvents: sinais(),
  run(fn) { depois.push(fn); },
  runTimeout(fn, ticks) { depois.push(fn); },
  runInterval(fn, ticks) { intervalos.push([fn, ticks]); },
};

export async function executarAgendados() {
  for (let i = 0; i < 8; i++) {
    for (const fn of depois.splice(0)) fn();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

export function executarIntervalos(periodo) {
  system.currentTick += periodo;
  for (const [fn, ticks] of intervalos) if (ticks === periodo) fn();
}

export class ItemStack {
  constructor(typeId) { this.typeId = typeId; }
}

export class ActionFormData {
  buttons = [];
  title(texto) { this.titulo = texto; return this; }
  body(texto) { this.corpo = texto; return this; }
  button(texto, icone) { this.buttons.push({ texto, icone }); return this; }
  async show(p) {
    p.telas.push(this);
    const escolha = p.escolhas.shift();
    return escolha ? escolha(this) : { canceled: true };
  }
}

let conta = 0;
export function jogador(nome = "Teste" + ++conta, dinamicos = new Map()) {
  const id = "mock:" + nome;
  const tags = new Set();
  const mensagens = [];
  const titulos = [];
  const efeitos = new Map();
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
  const p = {
    id, name: nome, typeId: "minecraft:player", isValid: true, tags, mensagens, titulos, dinamicos, telas: [], escolhas: [],
    scoreboardIdentity: { id, name: nome },
    isSprinting: false, isSneaking: false, isOnGround: true,
    onScreenDisplay: { setTitle(t) { titulos.push(t); }, setActionBar() {} },
    getGameMode() { return "survival"; },
    getTags() { return [...tags]; },
    hasTag(t) { return tags.has(t); },
    addTag(t) { tags.add(t); },
    removeTag(t) { tags.delete(t); },
    sendMessage(t) { mensagens.push(t); },
    playSound() {},
    triggerEvent(eventId) { world.afterEvents.dataDrivenEntityTrigger.emit({ entity: this, eventId }); },
    getComponent(nome) {
      if (nome === "minecraft:health") return hp;
      if (nome === "minecraft:movement") return movimento;
      if (nome === "minecraft:equippable") return { getEquipment: () => this.item };
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
    desconectar() {
      this.isValid = false;
      jogadores.delete(id);
      world.afterEvents.playerLeave.emit({ playerId: id });
    },
  };
  jogadores.set(id, p);
  return p;
}
