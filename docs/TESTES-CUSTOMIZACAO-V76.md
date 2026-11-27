# Testes da oficina de personagem v76

A validação usou Node.js 24 e Minecraft Bedrock Dedicated Server **1.26.66.1**. Os testes de servidor usaram mundos separados. O servidor executou as propriedades do jogador, a câmera, os eventos e o uso dos itens. No GameTest, os jogadores eram simulados e as respostas aos formulários foram injetadas pelo script de teste.

## Resultados

| Cenário | Resultado |
| --- | --- |
| Suíte Node.js | **51 de 51 passaram**, com 42 testes anteriores e nove da oficina. |
| Instalação dos packs empacotados | Os dois packs 1.0.58 foram carregados pelo Bedrock Dedicated Server, com a dependência cruzada e os UUIDs de atualização. A inicialização dos scripts passou. |
| Menu, edição e câmera | O uso nativo do item abriu a oficina pelo contrato e pelo menu clássico. Foram executados seleção de categoria, mudança de cor e modelo, rotação, zoom, enquadramento e confirmação. |
| Cancelamento e restauração | Confirmados cancelamento, descarte por dano, teletransporte, troca de dimensão e desconexão no servidor. A simulação Node cobriu morte, queda, respostas atrasadas, falha de gravação e abertura bloqueada por combate ou finalização. |
| Multiplayer | Dois participantes editaram simultaneamente no GameTest. O dano de um encerrou só a sessão dele. O outro confirmou os próprios cosméticos. |
| Perfis e permissões | Testados perfis híbridos separados, troca legítima de disfarce, bloqueio de traços e concessões, autorização da Staff e restauro do catálogo. O menu preservou o item, a raça e o saldo de atributos nos cenários exercitados. |
| Localidade das camadas | A validação estática confirmou que o Molang escolhe rascunhos apenas para o jogador local. A exibição em dois clientes gráficos ficou pendente. |
| Persistência | Verificada a leitura dos dados gravados no personagem e a persistência em troca de dimensão. No reinício do servidor, o teste recuperou a ficha de um checkpoint persistente do mundo, reaplicou ao jogador e limpou a câmera e o rascunho. O GameTest criou uma nova identidade na reconexão. A mesma identidade foi exercitada na simulação Node. |
| Modelos, texturas e HUD | Validados aliases, ossos, PNGs, registro da interface, rotas de formulário e versão do HUD nos arquivos. A sobreposição visual em diferentes skins, os encaixes durante animações e o HUD renderizado ficaram pendentes no cliente. |
| Escalas de interface | O layout foi conferido nos arquivos, com colunas de 16% e 26%, 55% entre elas e controles dentro da borda. A renderização em 1920×1080, 1366×768, 1280×720 e outras proporções ficou pendente, assim como toque e controle. |

## Regressões da v75 no Bedrock

- **Menu e itens.** Painel de Caçador e Oni, clássico, Configurações, contrato, item principal, livro e uso sobre bloco sólido.
- **Treinos de respiração.** Corrida, pulo e natação pelo motor. Oni, dummy e flexão contados em paralelo pelo fluxo existente.
- **Transformação.** Sangue, confirmação, cancelamento, dose única, antídoto, escolha entre respirações dominadas, transformação válida e recuperação de ficha antiga.
- **Híbridos.** Patente, famílias dos disfarces, ativas legítimas de Água e Enmu, bloqueio de arte incompatível, revelação, habilidade exclusiva, Castelo Infinito, sol e sombra.
- **Stats, dano e recuperação.** Compras e custos progressivos, reembolso, exercício, patentes, migração, dano com defesa, equipamento e efeitos temporários, morte, reaparecimento, reviver, recompensa de Oni e passagem de dimensão. O checkpoint dos Stats foi relido em um segundo processo do servidor.

A inicialização ainda registra avisos e diagnósticos do conteúdo legado presentes na v75. Os arquivos de treino, combate, patente e inventário correspondentes continuaram nos pacotes. A nova importação das rotinas de Stats é usada pelo mesmo módulo de reviver.

## Reproduzir a validação

Extraia a v76 completa. Na raiz do repositório, aponte para os diretórios extraídos.

```bash
KIMETSU_BP="/caminho/Kimetsu Fix Be" \
KIMETSU_RP="/caminho/Kimetsu Fix Re" \
node --test codigo-v70/testes/*.test.mjs
```

Para executar a oficina no GameTest, use um mundo de teste com APIs Beta. Copie `codigo-v70/testes/bedrock-aparencia.js` para `scripts/validacao_v76.js` no Behavior Pack de teste. Importe `./validacao_v76.js` no fim de `scripts/main.js` e adicione `@minecraft/server-gametest` **1.0.0-beta** às dependências dessa cópia. A primeira execução termina com `KNY-TEST APARÊNCIA FIM`. Desligue o servidor normalmente e reinicie o mesmo mundo para obter `KNY-TEST APARÊNCIA REINÍCIO OK`. As demais suítes ficam no [diretório de testes](../codigo-v70/testes/).

## Arquivos da entrega

| Arquivo | SHA-256 |
| --- | --- |
| `Kimetsu_Fix_v76_Completo.mcaddon` | `6cd80e77ea3f453a29936494bb0b62d9350bb32db9d6b4086da29a0fed59bf35` |
| `Kimetsu_Fix_v76_BP.mcpack` | `096d58476c4e914dbbccc204aae95f4359582daa4b5db5e2f64c41ebaf81c08a` |
| `Kimetsu_Fix_v76_RP.mcpack` | `7c08e2a004d9505197f1742f59a398557117f3b922d550083d217e009acedce4` |

O teste de integridade descompactou os três arquivos e comparou os 682 arquivos do Behavior Pack e os 1.701 do Resource Pack com o conteúdo do pacote completo. Os 2.288 caminhos da v75 estão presentes na v76.

O ambiente de validação tinha servidor dedicado. Capturas da abertura, cabelo, rosto, vestimentas, corpo inteiro, rotação e resultado final dependem da execução em um cliente gráfico do Minecraft Bedrock.
