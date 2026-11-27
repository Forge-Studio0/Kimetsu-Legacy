# Kimetsu Legacy v78 · Menu Kimetsu e primeira entrada

A v78 corrige a entrega duplicada do item Menu Kimetsu e a abertura intermitente do painel de aparência. O arquivo completo contém os dois pacotes **1.0.60**, com os UUIDs usados pela v77.

## O que causava o problema

**Item em duplicidade.** A v77 dava o item no comando de inicialização do personagem e também tinha uma entrega em script. A entrega por comando dava outra cópia mesmo se o jogador já tivesse o item. O script procurava a presença de pelo menos uma cópia, então deixava a duplicata no inventário. Reproduzi esse caso no servidor com um participante que iniciou o mundo já com um Menu Kimetsu.

**Painel e câmera.** O editor da v77 tentava só o ângulo que o jogador estava olhando. Perto de uma parede, a falta de espaço fazia o editor cair no formulário simples. Reproduzi esse comportamento com o jogador em uma sala fechada. A v77 também encerrava a edição depois de oito tentativas com `UserBusy`, a resposta do Bedrock quando outra tela está ocupada. Isso podia levar ao contrato antes de o jogador ver a personalização.

## Como funciona na prática

1. Importe `Kimetsu_Fix_v78_Completo.mcaddon` e ative o Behavior Pack e o Resource Pack **1.0.60** no mundo com **APIs Beta**. Em multiplayer, use a opção do mundo que exige a aceitação dos pacotes de recursos para entrar.
2. Na próxima entrada, o inventário do jogador fica com uma cópia do **Menu Kimetsu**. O **Livro de Conquistas** é um item separado e continua abrindo o menu. Se o inventário estiver cheio, o Menu Kimetsu é entregue assim que uma vaga é liberada.
3. No primeiro login, o painel de **Pele**, **Cabelo** e **Olhos** abre antes do contrato. Em espaço aberto, ele usa a câmera livre. Em local fechado, ele usa um retrato dentro da mesma moldura. Se o chat ou outra tela estiver aberto, o editor espera para reaparecer quando a tela estiver disponível.
4. **Confirmar** grava a aparência e segue para o contrato. **Cancelar** mantém a aparência anterior e também segue para o contrato. A escolha normal continua limitada à primeira conexão do personagem.

### Recuperar a chance perdida na v77

Para um Humano ou Caçador online que passou pela primeira entrada na v77 e ficou sem ficha de aparência, a Staff pode usar:

```text
/scriptevent kny:aparencia recuperar_entrada "NomeDoJogador"
```

O comando libera a escolha uma vez, na conexão atual. Se o jogador estiver em outra tela, ele pode fechá-la e usar o **Menu Kimetsu**. Caçadores que já assinaram seguem direto ao jogo depois da escolha. A recuperação só se aplica quando a ficha de aparência está vazia e o marcador de primeira entrada veio da v77.

## Como funciona na teoria

O comando antigo de entrega foi retirado. Login, respawn, reposição pelas Configurações e mudanças relevantes no inventário passam pela mesma rotina. Ela conserva uma cópia de `kny:menu_kimetsu`, prioriza o slot selecionado quando ele tem o item e remove somente as cópias excedentes desse identificador. Uma solicitação com inventário cheio fica pendente até a próxima vaga, sem derrubar o item no chão.

O menu espera a inicialização nativa antes do contrato e lê também a marca deixada pela função de entrada. O editor tenta outros ângulos seguros quando a primeira posição da câmera está bloqueada. O Resource Pack usa o retrato do jogador dentro do painel quando a sessão fica sem câmera livre. `UserBusy` mantém a sessão aberta no servidor, limpa a câmera se ela já tiver sido aplicada e permite outra tentativa na mesma conexão.

O salvamento continua separado do rascunho. A ficha confirmada serve como fonte para a aparência após a reconexão. Marcação da primeira entrada e ficha usam propriedades separadas, de modo que reabrir o menu, trocar de dimensão ou reiniciar o mundo não repete a personalização de quem já encerrou a sua escolha.

## Testes

| Ambiente | Resultado |
| --- | --- |
| Node.js 24 | **61 de 61 passaram**, incluindo seleção de um ângulo livre, sala fechada, interface ocupada, inventário cheio, preservação do livro, recuperação com permissão e regressões. |
| Bedrock Dedicated Server 1.26.66.1 | Reproduzidos os dois sintomas na v77. A v78 passou com item pré-existente, duas cópias já no inventário, inventário cheio, mudança de inventário, câmera em campo aberto, retrato em sala fechada e dez respostas de tela ocupada. |
| Entrada e retomada | Confirmados aparência antes do contrato, cancelamento, acesso normal pelo item, recuperação administrativa restrita e releitura da ficha de um checkpoint persistente após reinício. |
| Regressões no servidor | Passaram o Menu Kimetsu e o Livro de Conquistas, Configurações, painel e clássico, contrato, treinos, Stats, transformação, patentes, disfarces, Castelo Infinito, dano e reviver. |
| Integridade | Os três arquivos foram descompactados com sucesso. O conteúdo e as versões dos packs individuais correspondem ao arquivo completo. |

O GameTest usou jogadores simulados e injetou respostas de formulário. A renderização do retrato e da moldura em um cliente gráfico permanece pendente de verificação.

| Arquivo | SHA-256 |
| --- | --- |
| `Kimetsu_Fix_v78_Completo.mcaddon` | `8da2e81c1dc9d35625dba4f9ee007c17d8f30b06491c14ae8ae5002e11d7964e` |
| `Kimetsu_Fix_v78_BP.mcpack` | `c213da0e7dc7469be44c6115f6a7bf9d7431cdf426ce821dcf56a8fc15a7a617` |
| `Kimetsu_Fix_v78_RP.mcpack` | `eed4abcfed327407693a24c591ec90231a56d713f50fabc28a3dcecae859b0b4` |
