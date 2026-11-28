# Kimetsu Legacy v80 · Estúdio privado e Guia

Na v79, a ocultação dependia do renderizador do cliente. As imagens do teste multiplayer mostraram que um observador ainda via corpo, nome e item na mão. A v80 tira a edição do mundo público usando um estúdio privado por participante. A tela **Guia e Acessos** voltou a usar a moldura e os botões do Kimetsu.

## Na prática

1. Importe a v80 e ative os dois pacotes **1.0.62** com **APIs Beta**. Feche e reabra o mundo para registrar a dimensão do estúdio.
2. Ao escolher **Crie seu personagem**, o jogador entra no estúdio e vê a prévia do próprio personagem. Dois jogadores podem editar ao mesmo tempo em plataformas separadas.
3. Confirmar ou cancelar encerra o editor e leva o jogador de volta ao ponto de entrada antes de abrir o contrato. Se houver uma desconexão no estúdio, a próxima entrada restaura o ponto de origem.
4. Abra **Menu Kimetsu → Guia** para ver **Guia e Acessos** com o visual do painel. A tela mantém as opções existentes e as permissões de cada cargo. O menu clássico continua disponível para quem o escolheu.

## Na teoria

O servidor registra uma dimensão vazia para a criação. Cada edição recebe uma plataforma própria, afastada das demais. Dessa forma, o mundo público e as outras sessões ficam fora do alcance da prévia, inclusive quando o jogador está com um item na mão. A ficha, inventário e posição de retorno permanecem associados ao personagem.

A dimensão, a posição e a rotação de origem são gravadas antes do teletransporte. A sessão devolve o personagem ao ponto registrado e limpa esse registro após o retorno. Se o local ainda estiver carregando, o servidor tenta novamente. A proteção contra dano e o bloqueio de movimento continuam ativos durante a edição.

O Guia usava o formulário padrão. A entrada pelo painel agora usa a mesma moldura de Configurações, com título e ações do Guia. As opções de Domínio humano e Castelo Infinito continuam condicionadas a função e permissões.

## Validação

- **63 testes automatizados** passaram, incluindo a separação do estúdio, a recuperação da origem após reconexão simulada e a proteção durante o editor.
- No **Bedrock Dedicated Server 1.26.66.1**, duas sessões simultâneas ficaram distantes uma da outra e fora da dimensão dos observadores. O teste confirmou o retorno após confirmar e cancelar, a proteção, o contrato e a rota do Guia com a moldura do painel. As respostas dos formulários foram simuladas. O layout do Guia e a prévia ainda precisam de conferência no cliente gráfico.
