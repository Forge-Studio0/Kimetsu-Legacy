# Kimetsu Legacy v79 · Criação protegida

A v79 adiciona uma tela de início antes do editor de aparência e protege o personagem durante a personalização. A atualização usa os dois pacotes **1.0.61**, com os UUIDs da v78.

## Na prática

1. Importe a v79 completa e ative os dois pacotes e as APIs Beta no mundo.
2. No primeiro acesso de um personagem, o jogo mostra **Crie seu personagem**. Fechar essa tela deixa a escolha pendente para quando o jogador usar o **Menu Kimetsu** na mesma conexão.
3. Ao clicar, abre o painel de Pele, Cabelo e Olhos. O dano dirigido ao personagem é cancelado para que o painel permaneça aberto, e os controles de movimento ficam bloqueados. O modelo do jogador fica oculto para os outros clientes com o Resource Pack, enquanto o próprio jogador mantém a prévia.
4. Ao confirmar, o jogo salva a aparência, devolve os controles e abre o contrato. Cancelar a edição também devolve os controles e abre o contrato, com a aparência anterior.

## Na teoria

A primeira tela e o editor usam a sessão já existente do Menu Kimetsu. Ao exibir o editor, o servidor registra as permissões de movimento que estavam ativas, desativa essas entradas e aplica um grupo de entidade que desabilita empurrões e o deslocamento por pistão. A proteção cancela dano de entrada e de saída antes da aplicação. É a proteção durante a edição, sem mudança de modo de jogo, com a colisão de terreno do Bedrock.

Uma propriedade sincronizada permite que o Resource Pack oculte o modelo para outros jogadores sem retirar a prévia do dono. Os equipamentos exibidos separadamente e a etiqueta de nome dependem de renderizadores do cliente. Esses detalhes, assim como a moldura e a aparência da prévia, exigem conferência num cliente gráfico.

Ao encerrar, o jogo retira a proteção e reativa somente as permissões alteradas pelo editor. O registro também permite restaurar controles no próximo nascimento ou acesso se houver uma interrupção. Quando outra tela ocupa o cliente, o editor libera a proteção entre tentativas. Mudança de dimensão continua encerrando a edição, com a limpeza da câmera e dos controles.

## Validação

- **62 testes automatizados passaram.** Foram verificados o botão inicial, a sequência até o contrato, o bloqueio de dano, a preservação de permissões já desativadas, a restauração e a troca de dimensão.
- **Bedrock Dedicated Server 1.26.66.1.** O GameTest aplicou dano real de fogo e de causa `override` durante a edição. Os pontos de vida permaneceram iguais e a sessão continuou até a confirmação. Foram verificados o bloqueio e a restauração de movimento, o estado sincronizado da edição, o fluxo do contrato e o reinício. As seleções da interface foram simuladas.
