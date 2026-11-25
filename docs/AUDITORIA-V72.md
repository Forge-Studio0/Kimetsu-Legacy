# Auditoria da Prioridade 05

Base do repositório `e64385ed845e7503d5b5b155657ce94489c98792`. A branch padrão apontava para esse commit. A v71 completa foi extraída e comparada com o código parcial. O inventário do arquivo tem 2.279 arquivos dos dois packs. Os recursos oficiais da temática orientaram a distinção entre as três identidades e a transição com o som de biwa já presente no projeto. [Referência temática](https://demonslayer-anime.com/infinitycastle/character/)

| Pontos da v71 auditados | Resultados e integração |
| --- | --- |
| `main.js`, `menu.js`, `menu_data.js`, itens e `kf_*` | Aulas, migração antiga e promoção escrevem dados de acesso às formas. A v72 guarda a origem humana em propriedades separadas e usa o catálogo real para saber a quantidade e os itens compatíveis. |
| `functions/blood`, controlador principal, menu do Rei e `cargo_rei` | Os três fluxos chegam a uma decisão de raça antes da limpeza de tags. A inicialização de honra, maldição e sangue passa a adicionar zero para manter valores já gravados. |
| `demon`, `slayer`, `slayer2`, `hashira`, `hashira_lider`, `kny_muzan`, `muzan_curse`, `breakcurse`, ranks e objetivos | O Híbrido mantém a linhagem Oni para os objetivos e progressão. Os disfarces trocam famílias da entidade, sem adicionar tags de patente Caçador. A Staff e o Rei continuam sujeitos às permissões e titularidade. |
| `stats.js`, `stats_config.js`, `stats_migration.js`, `hash.js`, `skills/damage`, `damage_action.js` e HUD | O módulo de Stats e os custos mantêm os mesmos bytes. A entrada de dano no menu reconhece a especial como uma técnica e aplica uma única contribuição de Poder. O HUD exibe a versão 1.0.54. |
| Controladores de respirações e Kekkijutsus, `init_skills`, armas e eventos de habilidades | Os controladores de uso exigem o código da respiração/arte autorizada para Híbridos. As condições preexistentes continuam verificando forma, recursos e item. Um estado intermediário revela o disfarce incompatível antes de permitir o início da ação. |
| `entities/player.json`, NPCs, `player.entity.json` e render controllers | NPCs consultam `slayer` e `player_demon`. As famílias públicas foram organizadas em grupos mutuamente exclusivos. O RP usa o valor sincronizado para a marca visual. Os comandos de recompensa continuam consultando a raça real. |
| Exposição solar, grupo `burn_daylight`, grupo `demon_family`, `sun_protection`, `sunshield`, cura e regeneração | Dois grupos aplicavam combustão. O Híbrido usa uma rotina própria de exposição e dano, mantendo a rota normal do fogo. O antídoto existente preserva sua rota para Onis comuns. |
| `revive.js`, dash, parry, morte, funções de teletransporte e Nakime | O arquivo de reviver foi preservado. As ações novas leem os bloqueios existentes e registram dano recente. Nakime e a biwa fornecem recursos já presentes. A base não expõe pontos configurados do castelo real. |
| Manifests e recursos | As dependências recíprocas apontam para 1.0.54, com os mesmos UUIDs. O pacote de distribuição exclui comandos de teste, mundo de teste e dependência GameTest. |

## Testes executados

Node.js 24 passou 26 testes, incluindo os 16 casos de Stats/menu v71 e dez testes do sistema novo. Os testes Híbridos cobrem comprovação de domínio, autorização, mestre e aprendiz, seleção da respiração, recuperação de transformação interrompida, seis poderes, exclusividade, recargas, troca de famílias, sol e portais em ambiente simulado.

Bedrock Dedicated Server 1.26.66.1, com GameTest e jogadores simulados, confirmou transformação humana com aulas, uso do sangue, exclusão de histórico de patente, códigos e famílias no motor, Água autorizada, Trovão bloqueado, Enmu autorizado, biwa bloqueada e revelação. Executou Carapaça, ida e volta num mundo de teste, dano solar a céu aberto e interrupção sob teto. Um reinício confirmou o índice mundial e a reserva do proprietário offline.

A suíte de regressão de Stats concluiu no mesmo servidor. Verificou 27 faixas, compras, créditos, migração, titularidade, dano, morte, respawn, reviver, recompensa e troca de dimensão. Um cenário inicial de reanimação falhou antes da preparação de piso e espaço livre. A suíte passou com esse preparo no teste, mantendo o script de reviver original.

A suíte de menu confirmou os eventos nativos dos dois itens, a tela de contrato, os painéis do Caçador e do Oni, o menu clássico e a abertura ao usar em bloco sólido. As respostas das telas foram simuladas. O servidor também iniciou com os arquivos extraídos do `.mcaddon` de distribuição.

## Limites e pendências

- O mundo do castelo real ainda exige a configuração dos pontos e um teste no servidor da Staff. As coordenadas do GameTest são de uma plataforma descartável.
- A troca de família foi verificada no motor. A perseguição completa, cada exceção de NPC, o visual do painel, as marcas, áudio e partículas precisam da rodada com clientes reais.
- O teste automatizado exercitou uma respiração e uma arte no motor, com tentativas bloqueadas de outra respiração e arte. A regra de permissão é gerada para as variantes mapeadas. A matriz completa de formas, clima, PvP simultâneo e reconexões com contas reais permanece para homologação.
- O log da base já traz avisos de animações e componentes de outros sistemas, entre eles `sun_protection` sem definição e componentes de blocos não registrados. A v72 inclui uma rotina própria apenas para a exposição Híbrida.
- A proposta solar usa um dano de referência ajustável. Calibre a diferença exata de sobrevivência sob as regras de combate e regeneração do servidor real.
