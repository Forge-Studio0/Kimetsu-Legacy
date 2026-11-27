# Kimetsu Legacy v77 · Aparência no primeiro login

A tela de **Pele**, **Cabelo** e **Olhos** abre automaticamente no primeiro login de um jogador novo no mundo. A confirmação grava a aparência e abre em seguida o contrato do Caçador. O arquivo completo reúne o Behavior Pack e o Resource Pack, ambos na versão interna **1.0.59**.

## Como funciona na prática

1. Importe `Kimetsu_Fix_v77_Completo.mcaddon` no Minecraft Bedrock. Ative os dois pacotes 1.0.59 e as **APIs Beta** no mundo.
2. Entre com um jogador que ainda não iniciou nesse mundo. Em **Pele**, use **Anterior** e **Próximo** para ver as duas bases e seus cinco tons. A lista também oferece a pele da conta como opção.
3. Em **Cabelo**, escolha o corte, a cor principal e a mecha. Entre em **Olhos** para escolher o formato e a cor de cada íris. Com a câmera disponível, os botões inferiores giram o jogador, aproximam a tela e alternam a vista entre corpo inteiro e rosto.
4. Pressione **Confirmar**. O editor aplica a aparência, restaura a câmera e abre o contrato. Assinar segue o caminho normal da Corporação, com a patente inicial e o uniforme do jogo.

Cancelar ou fechar mantém a aparência anterior e segue para o contrato. Uma desconexão durante a primeira entrada encerra o rascunho e a chance de edição. Se o contrato ainda estiver pendente, ele pode aparecer ao retornar. Jogadores que já entraram no mundo seguem o fluxo do menu que já usavam.

## Peles e opções

| Escolha | Conteúdo |
| --- | --- |
| Base A | Cinco tons dos arquivos `Pele_cor_*.bbmodel` do ZIP enviado. |
| Base B | Cinco tons dos arquivos `Pele_Masculina_*.bbmodel` do mesmo ZIP. |
| Tons | Claro `E8B98F`, Mel `C98F65`, Cobre `A66B45`, Castanho `75452F` e Escuro `4A2C20`. |
| Cabelo | Oito cortes, onze cores e mecha opcional. A paleta traz **Amarelo sol**. |
| Olhos | Quatro formatos e onze cores independentes para cada íris. A paleta traz **Ciano vivo**. |

Vestimentas, Conjuntos, Informações, Acessórios, Rosto, Traços Oni e Identidades saíram do editor. Olhos têm categoria própria. A camada de expressões faciais foi removida, inclusive para fichas antigas. As demais escolhas que já existiam nessas fichas continuam disponíveis ao personagem pelo registro original. As projeções brancas da referência do Shinobi ficaram fora dos recursos importados.

## Como funciona na teoria

### Oportunidade única e ordem das telas

A função `inicio.mcfunction` sinaliza a primeira inicialização de um jogador. É o mesmo ponto que entrega o item do menu e grava a tag `start` no fluxo existente. O servidor registra a oportunidade em `kny:aparencia_primeiro_login` e só permite abrir o editor naquela conexão. O menu usa a exclusão de sessões que já existia no Kimetsu para manter a edição e o contrato em ordem, inclusive se o jogador clicar no item enquanto a abertura automática está pendente.

O editor mantém o rascunho em memória e valida as opções novamente em **Confirmar**. A gravação em `kny:aparencia` usa IDs estáveis para pele, cabelo e olhos. A marca de primeira entrada permanece se o jogador cancelar, se desconectar ou se a Staff restaurar a ficha. O comando de restauração continua disponível à Staff e não serve para conceder uma nova edição.

### A pele no modelo do jogador

O conversor lê as texturas PNG incorporadas nos dez projetos Blockbench. Reorganiza as faces do corpo em dez atlas de **128×128** e usa o esqueleto do jogador do Bedrock. A escolha da textura muda o corpo renderizado na addon. Uniformes, armaduras, animações e transformações continuam usando os recursos do jogo. Cabelo, mecha e olhos são camadas separadas sobre a pele.

O Resource Pack usa a aparência salva para os outros clientes. Durante a edição, o cliente local usa os canais de rascunho. Após confirmação, o mesmo registro atende à mudança legítima de raça ou de disfarce, com os perfis já existentes da v76 respeitados. A pele fica associada ao mundo do Kimetsu, e a skin da conta pode ser escolhida como base.

Em locais onde a câmera livre não consegue enquadrar o personagem, a primeira escolha usa um formulário simples. Dano, queda, mudança de dimensão e outras interrupções limpam a câmera e descartam a edição. A escolha de cosméticos não muda patente, inventário ou Stats.

Para reproduzir os recursos, rode `python3 importar-peles-v77.py "/caminho/peles (1).zip"` com Pillow e depois `node gerar-aparencia-v76.mjs`. Os PNGs convertidos já acompanham o código-fonte.

## Validação

- **53 testes Node.js.** Passaram os casos de entrada, confirmação, cancelamento, isolamento entre jogadores, reconexão simulada, migração de fichas, câmera, catálogo e permissões, além dos 42 testes de regressão anteriores.
- **Bedrock Dedicated Server 1.26.66.1.** O GameTest disparou a função real de entrada e exercitou Pele, Cabelo e Olhos, câmera, confirmação, cancelamento, contrato, primeira patente e reabertura pelo item. A segunda execução releu um checkpoint persistente e verificou a reaplicação da aparência.
- **Regressões no servidor.** Passaram menu clássico e painel, treinamento das respirações, transformação, sangue e cura, Híbridos, patentes, disfarces e Castelo Infinito. Na primeira rodada de Stats, um efeito temporário de velocidade ainda estava ativo no momento da verificação. A suíte completa passou ao repetir em um mundo de teste limpo. O código de Stats permaneceu intacto.
- **Integridade.** Os três pacotes passaram na descompactação. Os dois `.mcpack` têm o mesmo conteúdo dos respectivos packs do `.mcaddon`. Os UUIDs correspondem aos da v76.

As respostas dos formulários do GameTest foram simuladas. A validação gráfica com um cliente Bedrock, incluindo os encaixes com cada uniforme, e o teste de reconexão com a mesma conta real ficaram pendentes.

| Arquivo | SHA-256 |
| --- | --- |
| `Kimetsu_Fix_v77_Completo.mcaddon` | `f48a512cb2016dcbf81ae68631eab9a77d79513572ef789cac58c11e82735a80` |
| `Kimetsu_Fix_v77_BP.mcpack` | `f4bb5c62e5c467656d4087108b540c8eaf99967e001b79126e6ea4fd97c719d7` |
| `Kimetsu_Fix_v77_RP.mcpack` | `e7504112d55695041f143a91f15c5649aa04a4800bdd8c845c752fc213d08fca` |
