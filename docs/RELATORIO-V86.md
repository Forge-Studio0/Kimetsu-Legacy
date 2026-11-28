# Kimetsu Legacy v86

A v86 reúne o spawn noturno de Onis, o Talismã da Eternidade e o Pergaminho de Teletransporte. Os pacotes de comportamento e de recursos têm **v86** no nome, usam a versão interna **1.0.68** e conservam a identidade dos pacotes anteriores.

## Instalação

No Minecraft Bedrock, importe o arquivo completo e confira os dois pacotes v86 no mundo. Os arquivos BP e RP separados servem para quem instala cada pacote manualmente. No Bedrock Dedicated Server, pare o mundo e substitua a instalação anterior do BP e do RP pela v86. A substituição integral do BP retira as regras antigas de spawn da instalação.

## Spawn noturno

Na prática, explore o Overworld em Sobrevivência ou Aventura entre os ticks 13.000 e 23.000 do dia do Minecraft. A cada dez segundos, o sistema faz uma tentativa com 25% de chance por região de jogadores próximos. A tentativa pode terminar sem gerar entidade se o terreno ou a população da área impedir o spawn.

| Resultado de um sorteio | Chance |
| --- | ---: |
| Oni comum ou variante comum | 98,50% |
| Kamanue | 0,45% |
| Rui | 0,35% |
| Mukago | 0,25% |
| Wakuraba | 0,20% |
| Rokuro | 0,15% |
| Enmu | 0,10% |
| Lua Superior | 0% |

Na teoria, o sistema procura posições carregadas a uma distância de 24 a 64 blocos e considera a população em 80 blocos ao redor. Os limites locais são quatro Onis comuns e um Lua Inferior. Em todo o Overworld carregado, os limites de entidades marcadas como naturais são 40 comuns e dois Luas Inferiores. A marca separa esses Onis dos atores de eventos e de missões. A limpeza só alcança Onis naturais carregados que passaram pelo menos 90 segundos sem jogador a até 96 blocos e sem combate recente.

Ao amanhecer as novas gerações param e os Onis ficam sujeitos ao sol. Abrigo protege da exposição. O golpe fatal ou o projétil precisa ter autoria válida para que o jogo credite o abate. Honra, maldição, conquistas, pontos e treinamento seguem a linhagem, o tipo de Oni e os requisitos de cada sistema. As missões de arena conferem as entidades de sua própria sessão.

## Talismã da Eternidade

A Staff abre **Menu Kimetsu → Guia → Talismãs da Eternidade**, escolhe o jogador, o efeito, o nível e confirma a emissão. O beneficiário usa o talismã na mão. O uso aceito consome aquela emissão. A Staff pode consultar as concessões, cancelar uma delas ou revogar todas de um beneficiário.

São oferecidos **Visão Noturna I**, **Respiração Aquática I**, **Pressa I ou II** e **Super Salto I ou II**. O limite é de três concessões de efeitos distintos por beneficiário. A autorização identifica a emissão, o efeito e o jogador nos registros de execução do servidor. Nome e descrição no item servem para leitura.

O efeito é renovado enquanto a concessão estiver ativa. O servidor aguarda o jogador terminar o fluxo de morte e reviver para restaurá-lo. Na revogação, a renovação termina e o efeito restante expira em até 12 segundos de jogo. Poções, habilidades e efeitos inatos têm prioridade quando já estão presentes com o mesmo identificador.

## Pergaminho de Teletransporte

A Staff pode entregar um pergaminho com `/give "Nome do jogador" kny:pergaminho_teleporte 1`. Use o item em mãos para abrir **Meus destinos**, **Salvar localização atual**, **Gerenciar localizações** ou **Informações**. Em um local seguro, selecione salvar e escreva o nome. Para viajar, escolha um dos destinos e aguarde a preparação de cinco segundos.

Cada jogador pode salvar até dez destinos, com nome, posição, dimensão e rotação registradas pelo servidor. Renomear preserva a posição. A exclusão pede confirmação. A gravação pertence ao personagem e acompanha morte, reconexão, reinicialização e troca ou perda do item.

A viagem é limitada à dimensão atual e valida a origem e o destino. Movimento acima de meio bloco, dano, combate, mudança de estado, mudança de dimensão, perda do pergaminho ou perda de acesso interrompem a operação. O sistema carrega temporariamente a área necessária, confere o piso e a passagem e pede ao Bedrock um teletransporte com verificação de colisão. O item pode ser usado novamente após a operação.

## Regiões e limitações

- Spawn e pergaminho usam os bloqueios de área que a Staff já cadastrou. A área imediata de um portal oficial fica reservada ao fluxo de acesso da facção. As arenas e o estúdio têm dimensões próprias. Para proteger toda uma vila ou construção no Overworld, fique em cada canto e use, respectivamente, `/scriptevent kny:h_staff bloqueio vila a` e `/scriptevent kny:h_staff bloqueio vila b`.
- A busca por abrigo depende da inteligência artificial da entidade. O sistema conta as entidades naturais que estão carregadas no Overworld.
- As emissões e os efeitos do Talismã pertencem à execução atual do servidor. Após reiniciar, a Staff precisa emitir os benefícios novamente. Velocidade, Força, Resistência, Regeneração e Queda Lenta ficam fora da lista por interagirem com outros sistemas de combate ou movimento do addon.

## Changelog v86

- Spawn programado para o Overworld com quatro variantes comuns e seis Luas Inferiores. O empacotamento substitui as 22 regras antigas da pasta `spawn_rules/demon/` pelo novo fluxo.
- Talismã de uso único por emissão, com menu de Staff para emissão, consulta e revogação.
- Pergaminho reutilizável com dez destinos por jogador e viagem sujeita a preparação, região e segurança do local.
- Ícones de inventário, modelos de mão e animações dos dois itens. [Lista de arquivos da versão](ARQUIVOS-V86.md)

## Checklist

| Pedido | Entrega |
| --- | --- |
| 03 | Onis comuns à noite, Luas Inferiores raros, exclusão de Luas Superiores, proteção de regiões, limites local e global, vulnerabilidade solar e abates ligados a Stats e treino. |
| 06 | Talismã original, emissão pela Staff, efeito e nível configuráveis, três efeitos distintos, restauração após respawn, revogação e validação de uma emissão por uso. |
| 07 | Pergaminho original reutilizável, dez destinos pessoais, cadastro, renomeação e exclusão, 100 ticks de preparação, bloqueios de dimensão e combate, validação de áreas, carregamento temporário e gravação na ficha do jogador. |
| Entrega | Testes individuais, simultâneos e de regressão, BP completo, RP completo, addon completo e documentação. |

Os parâmetros de spawn ficam no código. O registro de efeitos é da sessão atual. A integração do Talismã usa a API de efeitos e deixa as fórmulas de Stats a cargo do sistema existente. O pergaminho pode iniciar nova preparação assim que a operação anterior terminar.

## Relatório de testes

Os **90 testes automatizados** passaram. A suíte inclui as verificações de pesos de spawn, dimensões, terrenos, regiões, densidade compartilhada, limites, autoria e duplicação de recompensa. Também cobre permissões, emissões inválidas, restauração do Talismã, dez destinos, edição, isolamento entre jogadores, recarga de um destino distante e cancelamento de viagem.

O **Bedrock Dedicated Server 1.26.66.1** executou os três fluxos com jogadores simulados pelo GameTest.

| Sistema | O que o motor do Bedrock confirmou |
| --- | --- |
| Spawn | Dois jogadores próximos compartilharam um surgimento. Foram conferidos o Oni comum, o Lua Inferior, o limite local de Lua, o abate que creditou Stats, honra e treino, a ausência de geração diurna e a diferença de dano solar entre céu aberto e abrigo. |
| Talismã | A Staff emitiu o item e o uso pela mão aplicou Pressa II. Foram conferidos dois beneficiários no mesmo mundo, três efeitos coexistentes, selo inválido, tentativa de repetição, morte, estado Caído, respawn legítimo e revogação individual e geral. |
| Pergaminho | O item abriu o painel temático. Dois jogadores viajaram ao mesmo tempo para destinos diferentes após a preparação de cem ticks. Foram conferidos o carregamento do destino distante, a liberação da área temporária, a conservação do item, os cancelamentos por movimento, dano e perda do item e a conservação da ficha após morte e respawn. |

A releitura do pergaminho usou uma cópia da ficha gravada em um checkpoint do mundo. Após reiniciar o Bedrock, um ator GameTest carregou essa ficha e viajou ao destino salvo. A reconexão com a mesma identidade foi coberta no simulador de API. A tentativa com um cliente de rede local atingiu o tempo limite. A reconexão com conta autenticada e a renderização dos modelos no cliente gráfico ficam pendentes de validação.

A regressão executou as rotinas nativas de máscaras, aparência, arenas, treino, menu, Híbridos, transformação, missões e Stats. A suíte de Stats incluiu dano, morte, respawn e Reviver. O pacote de produção iniciou no Bedrock. Os três arquivos passaram na verificação de integridade. O addon completo tem 2.679 entradas, que correspondem às 679 entradas do BP e às 2.000 do RP.

## Reprodução

Execute `python empacotar-v86.py --saida ./build-v86` no repositório para montar os três arquivos. Os testes Node usam os pacotes extraídos, com `KIMETSU_BP` e `KIMETSU_RP` apontando para as respectivas pastas. Os arquivos `bedrock-*.js` de teste rodam no pacote de ensaio com `@minecraft/server-gametest`.
