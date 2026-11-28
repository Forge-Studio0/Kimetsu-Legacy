# Arenas de missão do Kimetsu Legacy v84

A v84 inclui duas construções na dimensão de missões. A Staff pode instalar as duas de uma vez no mundo onde já joga. O instalador registra os cantos, as entradas, os pontos de geração dos inimigos, o objetivo do Refúgio e a saída alternativa.

## Na prática

1. Importe `Kimetsu_Fix_v84_Completo.mcaddon` e confira se **Kimetsu Survival Craft Be v84** e **Kimetsu Survival Craft Re v84** estão ativos no mundo. No servidor, atualize os dois pacotes com o mundo parado e inicie novamente.
2. Entre como operador ou Staff com a tag `kny_op`. Se estiver na oficina, use **Sair da oficina**. No mundo normal, fique sobre piso firme com dois blocos livres para registrar ali a saída alternativa.
3. Abra **Menu Kimetsu → Missões → Administração de arenas → Instalar 2 arenas prontas → Confirmar instalação**. O chat confirma os nomes das arenas ativadas.
4. Em modo Sobrevivência ou Aventura, abra uma missão para a qual seu personagem já atende aos requisitos. Para testar o Pátio com um Caçador iniciante, use **Caçadas → Ronda dos Caçadores**. Para testar o Refúgio, use **Missões principais → Montanha Sagiri**, entre individualmente e siga a trilha até o pavilhão iluminado.

## Arenas e missões

| Arena | Missões | Construção |
| --- | --- | --- |
| Pátio da Vigília | Abates, ondas, chefes e sobrevivência, como Ronda dos Caçadores e Duelo com Sabito | Pátio fechado de pedra e terracota vermelha, com lanternas, colunas laterais e centro livre para combate. |
| Refúgio das Lanternas | Localização em Sagiri e Natagumo. Proteção de Tanjiro contra Rui e de Rengoku contra Enmu. | Recinto de madeira com trilha central, passagens laterais e um pavilhão iluminado. O pavilhão é o destino das missões de localização e o ponto de chegada do aliado nas missões de proteção. |

O par cobre as 21 missões normais do catálogo. As duas fichas aceitam dificuldades D a S e têm quatro vagas. Cada missão mantém suas exigências de patente, linhagem e progresso e pode ter um limite menor de jogadores. Cada arena comporta uma sessão por vez. Uma missão de combate e uma missão de localização ou proteção podem acontecer ao mesmo tempo.

## Na teoria

O aviso sobre a largura, o comprimento e a altura é disparado quando os cantos A e B do cadastro manual abrangem uma região fora dos limites. O jogo conta os blocos entre os cantos, incluindo os dois extremos. O instalador calcula os cantos a partir da planta de cada arena, com 32 × 32 blocos de piso e 16 de altura. Cada construção tem quatro entradas e oito spawns distintos, com piso firme e espaço livre acima.

Na dimensão `kny:missoes`, o instalador procura duas áreas vazias separadas pelo afastamento exigido. Ele verifica as construções e cadastros na região antes de colocar blocos, valida os pontos no mundo e só então salva cada arena como ativa. Uma nova confirmação procura instalar somente os modelos que ainda faltarem. O ponto escolhido no mundo normal é usado como saída alternativa quando o retorno à origem do jogador está indisponível.

Os nomes dos pacotes levam o sufixo v84. A versão interna dos dois manifests, das dependências e do HUD é **1.0.66**.

## Verificação no Bedrock

O Bedrock Dedicated Server 1.26.66.1 executou a instalação pelo menu da Staff em um mundo de teste. A área de uma arena manual e um bloco colocado em outra região permaneceram intactos. Ambas as arenas ficaram ativas após reiniciar o servidor. As 21 missões encontraram um palco compatível em todos os tamanhos de grupo permitidos.

Cinco jogadores simulados concluíram **Ronda dos Caçadores** em grupo de quatro no Pátio e **Montanha Sagiri** individualmente no Refúgio, com as duas sessões ativas ao mesmo tempo. O teste conferiu a geração dos seis inimigos da Ronda, o pagamento da recompensa, a passagem livre até o pavilhão e o retorno. Ao bloquear a origem do jogador solo, o servidor usou a saída alternativa. Uma sessão adicional concluiu **Proteja Tanjiro de Rui** com Tanjiro posicionado no pavilhão.

Os 70 testes automatizados existentes passaram. O arquivo completo passou pela verificação de integridade e o servidor iniciou com o pacote de produção v84.
