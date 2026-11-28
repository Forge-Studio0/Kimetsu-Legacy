# Máscaras e HUD do Kimetsu Legacy v85

A v85 coloca as máscaras equipadas à frente dos olhos do personagem e retira os corações e o indicador de armadura da tela de jogo. A vida é exibida no painel **STATUS**, junto com Fôlego e Stamina.

## Na prática

1. Importe `Kimetsu_Fix_v85_Completo.mcaddon` e confira os dois pacotes v85 nas configurações do mundo.
2. Equipe Sabito, Hyottoko, Urokodaki ou Cabeça de Javali no espaço da cabeça. Em terceira pessoa, a máscara cobre a parte correspondente do rosto. Ao tirá-la, a aparência e a íris escolhidas voltam a ser exibidas.
3. Em Sobrevivência, acompanhe a vida no painel **STATUS**. A fileira de corações e os ícones de armadura saem do HUD.

## Na teoria

As máscaras de Sabito e Hyottoko apontavam para o item de cabelo do Yoriichi. Cada modelo agora está vinculado ao próprio item. A superfície frontal dos dois modelos foi avançada para ficar diante das íris e das pupilas personalizadas, com a mesma largura e altura da face da máscara.

O renderizador consulta se existe equipamento no espaço da cabeça antes de desenhar as camadas de aparência desse local. A regra vale para as dez peles do addon e para a opção **Pele da conta**. Enquanto a máscara está equipada, o rosto base pode aparecer nas aberturas desenhadas na textura. Ao remover a máscara, a consulta volta a liberar as camadas do rosto conforme a aparência salva.

A interface do Bedrock usa os mesmos renderizadores de corações e armadura nos layouts clássico e de toque. A v85 oculta esses dois renderizadores e remove a antiga fileira de corações que o addon desenhava com suas próprias imagens. A barra de Vida do painel Kimetsu usa a vida atual e a vida máxima do jogador.

Os dois pacotes têm o sufixo v85 no nome e usam a versão interna **1.0.67**.

## Verificação

O Bedrock Dedicated Server 1.26.66.1 equipou e retirou as quatro máscaras nas dez peles do addon e na opção **Pele da conta**. O teste percorreu os quatro formatos de olhos personalizados e a opção sem olhos personalizados, em 220 combinações. Conferiu o item equipado e os dados de aparência antes e depois da retirada.

A validação dos recursos conferiu a ligação entre os itens e os modelos, a profundidade frontal das máscaras corrigidas e os controles do HUD nos arquivos de interface. A suíte passou com 72 testes automatizados. O servidor também completou os testes de personalização e iniciou com o pacote de produção v85. As 2.683 entradas do arquivo completo passaram pela verificação de integridade.
