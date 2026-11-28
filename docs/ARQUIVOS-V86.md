# Arquivos alterados na v86

A relação compara o conteúdo distribuído na v86 com o addon completo da v85.

## Behavior Pack

- `manifest.json`
- `entities/{demon,enmu,hebidemon,kamanue,mukago,rokuro,rui,tongue_demon,tsunodemon,wakuraba}.entity.json`
- `items/pergaminho_teleporte.json` e `items/talisma_eternidade.json`
- `scripts/main.js`, `scripts/menu.js` e `scripts/hud_painel.js`
- `scripts/missoes_arenas.js` e `scripts/missoes_interface.js`
- `scripts/spawn_noturno.js`, `scripts/spawn_noturno_config.js` e `scripts/regioes_v86.js`
- `scripts/talisma_eternidade.js` e `scripts/talisma_staff.js`
- `scripts/pergaminho_teleporte.js` e `scripts/pergaminho_interface.js`

O empacotador retirou estes 22 arquivos de `spawn_rules/demon/`.

```text
akaza.json
daki.json
demon.json
enmu.json
gyokko.json
hairo.json
hand_demon.json
hantengu.json
hebidemon.json
kaigaku.json
kamanue.json
kokushibo.json
mukago.json
nakime.json
rengoku_demon.json
rokuro.json
rui.json
susamaru.json
tongue_demon.json
tsunodemon.json
wakuraba.json
yahaba.json
```

## Resource Pack

- `manifest.json` e `ui/hud_screen.json`
- `textures/item_texture.json`
- `textures/icons/kny_pergaminho_teleporte.png` e `textures/icons/kny_talisma_eternidade.png`
- `textures/entity/kny_pergaminho_teleporte.png` e `textures/entity/kny_talisma_eternidade.png`
- `models/entity/kny_pergaminho_teleporte.geo.json` e `models/entity/kny_talisma_eternidade.geo.json`
- `attachables/kny_pergaminho_teleporte.json` e `attachables/kny_talisma_eternidade.json`
- `animations/kny_papeis_v86.animation.json`

## Repositório e arquivos de instalação

- `codigo-v70/testes/bedrock-spawn-noturno.js`, `bedrock-talisma.js` e `bedrock-pergaminho.js`
- `codigo-v70/testes/spawn-noturno.test.mjs`, `talisma.test.mjs`, `pergaminho.test.mjs` e `regioes-v86.test.mjs`
- `empacotar-v86.py` e `gerar-itens-v86.py`
- `docs/RELATORIO-V86.md` e `docs/ARQUIVOS-V86.md`
- `Kimetsu_Fix_v86_Completo.mcaddon`, `Kimetsu_Fix_v86_BP.mcpack` e `Kimetsu_Fix_v86_RP.mcpack`
