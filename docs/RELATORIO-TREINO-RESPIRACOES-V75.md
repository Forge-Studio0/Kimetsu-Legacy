# Treino por forma de respiração na v75

A v75 incorpora o treino do cliente no pacote de comportamento da v74. Cada forma tem uma lista fixa de atividades. O Caçador pode acompanhar as metas em **Respirações** e fazer a próxima aula ao concluir os treinos e cumprir os requisitos de espada e honra.

## Como as metas funcionam

O jogo sorteia a lista pela combinação da respiração com o número da forma. Por isso, dois jogadores que estejam preparando a mesma forma da mesma respiração recebem a mesma lista. O primeiro treino das escolas com tema alterna entre as atividades da casa. Água alterna entre natação e flexão, Trovão entre corrida e agachamento, Chamas entre abates e dummy, Vento entre pulos e corrida, e Névoa entre meditação e corrida. O sorteio preenche as demais vagas com atividades distintas.

As respirações regulares pedem duas atividades nas formas 1 e 2 e três a partir da 3. A dificuldade de cada atividade cresce com o número da forma. A Básica segue a exceção do pacote do cliente, com uma atividade na forma 1 e duas nas formas 2 e 3. Suas metas usam metade das quantidades, com o arredondamento do original. [Listas e metas](../codigo-v70/Kimetsu%20Fix%20Be/scripts/treino_respiracao.js).

| Respiração | Forma | Atividades |
| --- | ---: | --- |
| Água | 1 | Nadar 50 m e matar 3 onis |
| Água | 3 | Nadar 100 m, fazer 20 agachamentos e matar 7 onis |
| Básica | 1 | Pular 20 vezes |
| Básica | 2 | Fazer 8 abdominais e nadar 40 m |
| Básica | 3 | Nadar 50 m e correr 75 m |

## Como o jogo conta

Corrida, natação, pulos e abates de onis são registrados durante o jogo. A corrida usa a distância horizontal no sprint, e a natação usa a distância enquanto o personagem nada. O pulo conta na saída do chão a partir de um novo acionamento. O abate usa o mesmo evento que atribui a recompensa de Stats ao jogador.

O pulo passou a ser lido a cada tick. No Bedrock, um toque curto pode durar apenas um tick e passar entre as leituras do contador original, que eram feitas a cada dois.

Flexão, abdominal, meditação e agachamento contam por repetição na sessão aberta em **Treino**. Cada golpe aceito no dummy também vale. Um exercício ainda pode cumprir uma meta de respiração mesmo quando o atributo correspondente já chegou ao teto ou ao máximo de crédito de treino.

O ganho é aplicado em paralelo à próxima forma de cada respiração que pede aquela atividade. Se a sua próxima forma da Água e a de Chamas pedirem abates, o mesmo Oni conta nas duas listas. Cada contador para na própria meta. O progresso inteiro, em metros, repetições, golpes ou abates, é gravado na ficha do jogador à medida que muda.

## Como ensinar e concluir uma forma

1. Como Caçador, abra o livro do **Menu Kimetsu**, escolha **Respirações** e entre na respiração. A tela mostra a próxima aula. Uma linha como **Nadar 12/50 m** indica o que falta, e as metas completas aparecem em verde.
2. Faça as atividades que faltam. O chat avisa quando uma meta termina. Se você já tiver a espada e a honra exigidas ao completar a lista, o chat também indica que a forma está pronta para a aula.
3. Fique a até 12 blocos do Líder dos Hashiras. Pelo menu **Ensinar Respiração**, ele escolhe o estilo e o seu nome. Entre Hashiras vale a permissão de **Aulas de domínio** da v74. A aula exige a espada daquele estilo e 10 de honra por forma anterior. Para a Básica, vale a lâmina colorida e 5 de honra por forma anterior.
4. Depois que a aula é registrada, o jogo apaga apenas os contadores da forma ensinada. A próxima forma começa com a própria lista e as demais respirações conservam seus contadores.

Nas respirações que contam para o domínio humano, a próxima aula vem do histórico de aulas, mesmo quando o cargo já liberou formas para combate. A Básica continua acompanhando a progressão da lâmina colorida. Fichas vindas da v74 aproveitam suas aulas já registradas e começam o novo treino na próxima forma pendente. [Validação da aula](../codigo-v70/Kimetsu%20Fix%20Be/scripts/hybrid_mastery.js).

## Instalação no Bedrock

Importe o arquivo completo e ative os pacotes de comportamento e de recursos **1.0.57** no mesmo mundo, com **APIs Beta**. O pacote parte da v74 e usa seus UUIDs. O recurso visual usa os arquivos da v74, com a identificação de versão atualizada. [Add-on completo v75](../Kimetsu_Fix_v75_Completo.mcaddon).

## Verificação do port

As **163 listas das 26 respirações** foram comparadas com o código do cliente. Elas coincidiram na ordem, no tipo de atividade e na quantidade. Os **42 testes em Node.js** validaram as metas, a contagem em paralelo, a reconexão, o aviso e a cor de conclusão, os exercícios no teto de Stats, a aula da Básica e as regressões do sistema Híbrido e de patentes. [Casos do treino e do domínio](../codigo-v70/testes/hibridos.test.mjs).

No Bedrock Dedicated Server **1.26.66.1**, o motor confirmou corrida, natação, pulo curto, abate e ataque ao dummy. O teste também abriu o menu de treinamento e registrou flexão com a Defesa no teto. Uma aula só avançou com as metas completas, apagou o contador da forma ensinada e deixou intacto o progresso de Chamas. [Cenário de treino no Bedrock](../codigo-v70/testes/bedrock-treino-respiracao.js).

No cenário de transformação, o livro abriu o menu do Líder, uma tentativa com metas incompletas manteve a primeira aula pendente e as dez aulas de Água com preparação produziram uma transformação Híbrida. O cenário também testou dose única de sangue, antídoto, escolha de respiração original e recuperação de ficha antiga. As escolhas na interface foram simuladas pelo GameTest. [Cenário de transformação](../codigo-v70/testes/bedrock-transformacao.js).

O pacote de distribuição iniciou no Bedrock com os manifests pareados em **1.0.57**. Os pacotes separados contêm os mesmos arquivos do add-on completo. [Pacote de comportamento](../Kimetsu_Fix_v75_BP.mcpack) · [Pacote de recursos](../Kimetsu_Fix_v75_RP.mcpack).

SHA-256 do arquivo completo `5fc1d7dccc268ae913bcf80cd2549949e69962f993d27dc2bac6e3e5ace67b8b`.
