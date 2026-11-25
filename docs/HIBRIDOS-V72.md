# Kimetsu Legacy v72 — Sistema de Híbridos

Use o `Kimetsu_Fix_v72_Completo.mcaddon` no Minecraft Bedrock. O arquivo contém o Behavior Pack e o Resource Pack completos, ambos na versão interna `1.0.54`. Os UUIDs são os mesmos da v71. Ative os dois pacotes e mantenha **APIs Beta** habilitadas. No servidor dedicado, atualize para `[1, 0, 54]` as versões dos dois pacotes na configuração do mundo.

Para a instalação com packs separados, importe `Kimetsu_Fix_v72_BP.mcpack` e `Kimetsu_Fix_v72_RP.mcpack`.

## Domínio humano e transformação

Abra **Menu Kimetsu → Guia → Domínio humano**. As aulas registram cada forma, a origem, o professor e o momento em que o aluno a aprendeu vivo e humano. Continue as aulas da mesma respiração, em sequência, com a Nichirin correspondente no inventário e a honra exigida pelo sistema anterior. O líder pode ensinar caçadores próximos. Em **Aulas de domínio**, um Hashira também pode orientar outro Hashira, inclusive o líder, em formas já liberadas pela patente.

Placar `kf_*`, posse da Nichirin e promoção continuam registrando acesso às formas. A elegibilidade consulta os registros de aulas e as certificações. Se houver vários domínios completos, defina a respiração original no menu antes de transformar. Um domínio completo único é escolhido na transformação quando o jogador ainda não definiu uma original.

A transformação passa pela mesma validação no menu do Rei titular, pelo sangue usado e pela rota administrativa de cargo. Um humano sem domínio completo vira Oni comum. O Híbrido começa na posição Oni sem acúmulo da hierarquia humana. O registro da transformação permite retomar uma operação interrompida e aplicar a dose uma vez.

O Híbrido mantém a respiração original e suas formas, respeitando item, fôlego e limites existentes. O vínculo demoníaco usa a primeira arte compatível que já estiver no inventário, ou a arte inicial de Enmu. Obtenha o item da arte pela jogabilidade existente. O vínculo só autoriza uma arte e continua o mesmo depois da transformação. O item de sangue continua utilizável para doses por Onis e Híbridos. O antídoto convencional continua disponível para Onis comuns.

## Habilidade exclusiva

No menu **Híbrido → Habilidade exclusiva**, confira custo, recarga e estado da atribuição. Mire antes de abrir o menu e escolha **Ativar**. A Staff faz a atribuição. Cada registro aceita um único proprietário persistente; basta ele ter sido registrado no mundo, inclusive offline. Esgotado o catálogo, o Híbrido aguarda uma habilidade nova. Desativar uma habilidade conserva a reserva.

| Chave e habilidade | Função | Dano base | Fôlego | Stamina | Alcance | Alvos | Duração | Recarga |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ruptura · Ruptura Celestial | Corte direcional com linha de visão | 7 | 35 | 16 | 8 blocos | 3 | Imediata | 45s |
| dragao · Dragão Carmesim | Onda em três pulsos, um acerto por alvo | 8 | 48 | 24 | 9 blocos | 5 | 0,6s | 70s |
| passo · Passo Espectral | Deslocamento curto com checagem do piso e do caminho | 0 | 24 | 36 | 6 blocos | — | Imediata | 30s |
| prisao · Prisão da Tempestade | Pulsa lentidão em uma área | 0 | 42 | 22 | 4 blocos | 5 | Até 4s | 75s |
| sombras · Domínio das Sombras | Aplica cegueira à frente | 0 | 36 | 18 | 5 blocos | 4 | 3s | 65s |
| carapaca · Carapaça Rubra | Reduz dano de ataques de outros seres em 25% | 0 | 30 | 20 | Pessoal | — | 4s | 60s |

Os dois ataques usam a mesma etapa de Stats que aplica Força e Poder aos golpes e Defesa a quem recebe. O dano da técnica recebe Poder nessa etapa uma vez. As técnicas reutilizam partículas e sons do Resource Pack. Parede, saída da dimensão, morte, derrubada ou desativação interrompem os efeitos novos que ainda dependem do jogador. A cegueira usa o efeito nativo, cuja apresentação depende do cliente.

## Disfarces e sol

| Identidade pública | Visual do addon | Família para os NPCs | Acessos |
| --- | --- | --- | --- |
| Caçador | Skin pessoal e aparência humana | player, slayer | Portais comuns de Caçador que a Staff habilitou para infiltração |
| Oni | Marca demoníaca sobre a skin pessoal | player_demon | Portais Oni compatíveis com a patente e entrada do castelo |
| Revelado | Marca da forma verdadeira sobre a skin pessoal | player_demon, kny_hybrid | Portais próprios da forma verdadeira e entrada do castelo |

O nome acima do personagem e o chat local usam a identidade pública. O menu privado mostra a raça, a patente real e os poderes. A identidade da conta, o equipamento visível e as interfaces de outros pacotes seguem os controles do Minecraft ou do pacote correspondente.

Troque pelo menu **Híbrido → Disfarces**. Combate recente, derrubada e animações incompatíveis bloqueiam a troca. A recarga inicial é de 30 segundos. Usar arte demoníaca vestido de Caçador, usar respiração vestido de Oni ou iniciar a habilidade exclusiva revela a forma verdadeira. O jogador mantém o mesmo saldo, mesma patente, mesma saúde e mesmos recursos durante a troca.

A exposição Híbrida considera céu aberto, dia, clima limpo e ausência de água na dimensão principal. O pulso de dano continua em qualquer disfarce. Os parâmetros iniciais usam 50% da referência configurável e mantêm dano positivo com proteção solar legítima. O pulso adicional durante regeneração evita que ela anule permanentemente a fraqueza. A queima de Onis convencionais e as rotas normais de lava e fogo seguem o motor da v71.

Os parâmetros de custo, catálogo, recarga, sol, disfarce e revelação são propostas para validação da Staff em `scripts/hybrid_config.js`. A Respiração Básica vem desativada como requisito de domínio Híbrido. Após ajustes ao catálogo ou à ordem das famílias de técnicas, regenere os controladores a partir da base v71 usando o script do repositório.

## Staff

O menu **Guia → Configurar Castelo Infinito** usa a posição atual da Staff. Em pé em um ponto seguro, registre a entrada dentro do castelo existente. Faça o mesmo na saída. Apenas depois dos dois registros o acesso fica disponível. Sem o mundo real, o addon começa com ambos os pontos vazios.

Comandos equivalentes para a Staff autorizada no chat do jogo.

```mcfunction
/scriptevent kny:h_staff castelo entrada
/scriptevent kny:h_staff castelo saida
/scriptevent kny:h_staff castelo tempos 5 120
```

O Híbrido pode entrar como Oni ou revelado. A volta usa a saída definida pela Staff. A preparação cancela com dano, afastamento, troca de dimensão, desconexão e morte. O servidor verifica piso, espaço vazio, dimensão e regiões antes do teletransporte. Destinos descarregados dependem da capacidade de carregamento de chunks do servidor. O estado de preparação encerra no reinício e recargas concluídas são preservadas.

Para adicionar um acesso de facção, registre dois pontos reais. A entrada é o destino ao entrar. A saída é o destino ao sair. O jogador seleciona o acesso próximo ao ponto oposto.

```mcfunction
/scriptevent kny:h_staff portal sede entrada
/scriptevent kny:h_staff portal sede saida
/scriptevent kny:h_staff portal sede politica cacador 0 infiltracao
```

A política aceita `cacador`, `oni`, `revelado` ou `hibrido`. A patente mínima usa o patamar da patente verdadeira da facção. Para infiltração de Caçador, configure patamar zero e autorize-a expressamente. Esses acessos controlam os teletransportes registrados. Barreiras físicas e plugins de região precisam ser configurados no servidor que os utiliza.

Para bloquear viagens ou poderes exclusivos em uma área, marque os cantos A e B na mesma dimensão. A região cobre os blocos entre os dois pontos.

```mcfunction
/scriptevent kny:h_staff bloqueio bazar a
/scriptevent kny:h_staff bloqueio bazar b
```

Para consultar, atribuir ou desativar habilidades, use o ID fornecido pelo comando de consulta. A atribuição e as alterações são auditadas. A Staff não transfere nem libera uma reserva por esses comandos.

```mcfunction
/scriptevent kny:h_staff hibridos 1
/scriptevent kny:h_staff habilidades
/scriptevent kny:h_staff atribuir ruptura h12
/scriptevent kny:h_staff desativar ruptura
/scriptevent kny:h_staff reativar ruptura
```

Uma certificação histórica exige verificação da Staff, um caçador online e uma referência concreta de aprendizado humano. O placar sozinho não serve como evidência. Use o nome exato em aspas ou o ID de personagem disponível e descreva a evidência para a auditoria.

```mcfunction
/scriptevent kny:h_staff certificar "Nome do Caçador" water Registro da Escola da Água, aulas arquivadas da temporada
```

## Migração

Os dados `kny:h_*` são novos e versionados, separados dos Stats da v70/v71. O addon cria registros de domínio e identidade conforme o uso, sem conversão em massa. Inventários, placares de formas liberadas e fichas de atributos continuam no mundo. A sessão de combate é anotada quando houver dano para preservar o bloqueio curto após reconexão. Dado incompatível exige revisão da Staff, pois esse estado suspende a autorização de poderes novos.

## Changelog

- Registro legítimo de domínio humano, certificação e escolha da respiração original.
- Transformação unificada com recuperação, linhagem Oni, respiração e arte vinculadas.
- Seis habilidades com exclusividade persistente e custos em fôlego e stamina.
- Três identidades com famílias de NPC, apresentação e permissões independentes dos Stats.
- Exposição solar própria e acesso administrável ao Castelo Infinito e portais.
- Menus de Híbrido, domínio humano e Staff sobre a abertura da v71.

## Validação no servidor real

Antes de distribuir ao elenco, a Staff deve registrar entrada, saída e regiões reais, revisar o catálogo e escolher as atribuições. Confira o visual do painel, das marcas e dos poderes com o cliente. A auditoria do repositório e os testes registrados descrevem as rotas verificadas localmente.
