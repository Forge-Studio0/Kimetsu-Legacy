# Kimetsu Legacy v81 · Treinamento e missões

A v81 parte da v80, commit `9e99e6809bc90be9932583dd8e2cae43e63f24ea`. Os dois pacotes usam a versão interna **1.0.63** e conservam os UUIDs da atualização anterior. A entrega inclui o addon completo, os pacotes de comportamento e recursos, o código e este relatório.

## O que mudou

| Na v80 | Na v81 |
| --- | --- |
| Uma atividade podia avançar a próxima forma de várias respirações em paralelo. | Cada jogador tem uma única missão de aprendizado. O servidor usa os contadores da respiração e da forma autorizadas. |
| O jogador completava os treinos e voltava para uma aula presencial. Hashiras também podiam dar aulas entre si. | O titular do cargo de Líder confirma a missão no começo. A forma é liberada assim que o servidor verifica todas as metas e os requisitos finais. |
| O quadro permitia marcar e desmarcar conclusões por tag. | O botão **Fazer** inicia a preparação. A conclusão exige atingir o objetivo na sessão reservada, com recompensas parceladas por participação. |
| Recompensas de combate vinham do mundo aberto e de rotinas próprias de NPCs. | As sessões usam NPCs do addon em arenas da Staff. A missão tem seu próprio prêmio e registra um recibo recuperável. |

## Aprendizado na prática

**Líder dos Hashiras.** Abra **Menu Kimetsu → Aprendizado** ou **Missões → Painel do Líder dos Hashiras**. Selecione **Atribuir missão**, o caçador e a respiração. Confira a forma, a honra, a lâmina e as atividades. Clique **Atribuir missão**. O mesmo painel permite consultar alunos, missões ativas e histórico. O Líder pode escolher a si próprio e cumprir os mesmos requisitos. A autoatribuição fica na auditoria.

**Aluno.** Consulte **Menu Kimetsu → Respirações → sua arte** ou **Missões → Aprendizado de respirações**. Corrida, natação, saltos e abates válidos contam pelo jogo. Flexão, abdominal, agachamento, meditação e dummy usam as atividades do menu **Treinamento**. Linhas verdes indicam metas cumpridas. Quando concluir a última meta, a forma fica disponível. Se a espada estiver fora do inventário ou outro requisito estiver pendente, recuperá-lo permite a conclusão automática.

**Exemplo da Água.** A primeira forma pede 50 m de natação e três Onis. Após a atribuição, nadar 12 m deixa o contador em **12/50 m**. A terceira forma exige 100 m, 20 agachamentos e sete Onis. Cada forma tem seu próprio contador. Se cancelar e receber novamente a mesma forma, o progresso compatível volta. Os exercícios de atributos seguem disponíveis mesmo quando a ficha atingiu o teto, quando a atividade atende a uma meta ativa da respiração.

## Aprendizado na teoria

O servidor usa a titularidade do cargo junto da patente e da condição humana. A atribuição fixa ID do aluno, ID do professor, respiração, forma, estado e data. A lista vem das 163 combinações da v75. A missão fica vinculada à respiração e forma escolhidas mesmo se o Líder sair do servidor ou mudar de cargo.

A honra mínima segue a regra original de 10 por forma anterior, com 5 na Básica. A lâmina colorida dá acesso à Básica. Nas outras respirações é exigido o item correspondente. Sol, Lua e suas variantes usam os próprios itens cadastrados. Os controles de aquisição e uso anteriores continuam determinando o acesso a essas lâminas.

O histórico de domínio aceita aulas humanas antigas, certificações de Staff e a procedência nova `humano:missao`. As formas automáticas da patente Hashira ainda servem para combate. Completar as formas por missão grava prova individual de domínio. As respirações válidas para a transformação Híbrida seguem a configuração anterior, incluindo a exclusão atual da Básica. Quem dominou mais de uma pode escolher a original em **Guia → Domínio humano**. A transformação continua dependendo das condições já exigidas pelo sistema Híbrido.

## Missões normais na prática

1. Abra **Menu Kimetsu → Missões**. Escolha **Missões principais**, **Caçadas** ou **Missões de elite**.
2. Abra um cartão e confira a patente mínima, o objetivo, o tempo e o prêmio. Nas missões em sequência, conclua a anterior pelo novo quadro.
3. Escolha **Fazer · Individual** ou **Fazer · Grupo**. Confira a lista de participantes e confirme em **Fazer**. A reserva precisa de uma arena compatível e livre.
4. Aguarde a contagem regressiva. A barra de ação mostra o objetivo, os abates ou ondas e o tempo. Em uma missão de localização, siga até o marco sinalizado.
5. Confira o recibo em **Missões → Histórico e conquistas**. O recibo mostra a parcela entregue, a participação e os ganhos de patente.

Uma missão normal pode ocorrer ao mesmo tempo que um aprendizado. Abates elegíveis de Onis na missão atual contam para o treino ativo do caçador. Os estados de cooldown, bloqueio, arena indisponível, em curso e concluída ficam no quadro. Principais têm uma vitória premiável. A caçada pode ser feita de novo após 20 minutos. Na configuração inicial, as missões de elite também têm conclusão única.

[Catálogo de missões e tabelas da v81](CATALOGO-MISSOES-V81.md)

## Grupos e participação

No quadro, abra **Grupo → Criar grupo → Convidar jogador**. Cada convidado decide em **Missões → Grupo** em até 60 segundos. O líder pode remover integrantes antes do início. A lista é congelada quando ele confirma a preparação. O limite inicial é de quatro jogadores, com exceções individuais no catálogo. A patente e a linhagem são verificadas para todos. O líder do grupo e o Líder dos Hashiras são funções independentes.

A contribuição mede o dano válido até a vida máxima de cada alvo, somado a ações de reanimação verificadas. Cada parceiro reanimado vale até 10% do dano total do grupo, com bônus de suporte limitado a 20%. A cota mínima inicial é de 10% do maior valor entre os pesos registrados e a vida total dos inimigos. A localização individual exige chegar ao ponto do mapa. A assistência relevante pode valer mesmo sem o golpe final. Jogadores eliminados, ausentes após a tolerância e quem confirmou abandono ficam sem cota.

O prêmio é um total fixo por sessão. Distribuem-se 40% igualmente entre quem cumpriu a cota e 60% proporcionalmente. Com 10.000 pontos e pesos elegíveis de 70% e 30%, as parcelas são 6.200 e 3.800. O arredondamento distribui as sobras pelas maiores frações. A escala de grupo acrescenta reforços nas ondas configuradas. Vida base, dano e habilidades do NPC continuam vindos de sua definição.

Um caçador recebe honra. Oni e Híbrido recebem maldição. O sistema de Stats credita adicionalmente 50 pontos por novo ponto de patente que ultrapassa a marca histórica da mesma origem, nos limites existentes. O saldo direto, o adicional, a honra ou maldição e o dinheiro ficam no recibo.

## Fracasso, retorno e migração

A sessão termina por objetivos satisfeitos, tempo esgotado, perda do protegido, eliminação dos participantes, cancelamento da Staff ou perda de um requisito operacional. Um jogador derrubado continua sujeito às regras de resgate. A tolerância de desconexão é de 120 segundos. O abandono confirmado espera pelo fim do combate e do resgate, com carência de 10 segundos. O personagem volta à origem segura ou à saída cadastrada. O retorno aguarda se a origem e a saída estiverem bloqueadas ou se o jogador ainda estiver em resgate.

Ao reiniciar, o servidor cancela sessões que ficaram sem resultado, limpa a arena e conserva a saída pendente. Um resultado já validado mantém o prêmio registrado para pagamento. A ficha de Stats guarda os pontos e o último recibo na mesma gravação. Os placares pendentes são conciliados por valores absolutos para evitar repetir a adição. Se ferramentas externas mudarem esses valores durante a recuperação, o espelho conserva o valor maior.

A v81 lê as aulas e contadores anteriores no mesmo formato. O tempo de treino acumulado só pode ser usado na respiração e na forma compatíveis, depois de uma atribuição. Tags antigas do quadro ficam em **Conquistas e marcos** como legado. Elas não liberam etapas da campanha v81 nem concedem dinheiro, honra, maldição ou Stats retroativamente. O avanço de campanha usa o registro de vitória da nova sessão.

## Operação da Staff

Os desafios de combate e de localização ficam bloqueados até a Staff cadastrar os palcos reais. [Manual de arenas da v81](MANUAL-STAFF-ARENAS-V81.md)

## Changelog e arquivos

- `hybrid_mastery.js` passou das aulas presenciais para uma atribuição persistente, com cancelamento, conclusão pendente e procedência para domínio humano.
- `menu.js` liga Respirações, Treinamento e Missões aos registros atuais. `missoes_interface.js` monta o quadro, a tela de conclusão, o painel do Líder e as ferramentas de Staff.
- `missoes_catalogo.js`, `missoes_arenas.js`, `missoes_grupos.js` e `missoes_sessoes.js` definem desafios, reservas, convites, combate, encerramento e recuperação.
- `stats.js` e `stats_migration.js` integraram o recibo com a ficha existente. `revive.js` oferece observação de reanimações. `hybrid_locations.js` impede que os acessos de facção retirem participantes da dimensão de arenas.
- As entidades usadas no catálogo receberam componentes de combate e economia para a sessão. O Behavior Pack preserva os identificadores originais e inclui uma tabela vazia para os drops de missão. A auditoria do motor mostrou duas definições com o ID de Rengoku. Jigoro voltou a usar `kny:jigoro`, o ID que seus recursos e regras de geração já esperavam.
- `server_form.json` reutiliza a moldura do quadro e troca os estados de marcação por navegação e **Fazer**. Os dois manifests e a indicação do HUD foram atualizados.

[Testes e limitações da v81](TESTES-MISSOES-V81.md)
