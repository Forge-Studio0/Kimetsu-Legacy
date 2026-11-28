# Kimetsu Legacy v82 · Painel de aparência

A v82 corrige o editor de primeira entrada a partir da v81, no commit `07e5fab302535c91eb0bba6e47066f447b436aa5`. O pacote completo reúne Comportamento e Recursos **1.0.64**.

## Diagnóstico

| Problema | Causa | Correção |
| --- | --- | --- |
| A troca de pele podia mudar repentinamente o visual da tela. | Ao responder que a tela ainda estava ocupada, o Bedrock fazia o editor liberar a proteção e desligar a câmera. Essa resposta pode ocorrer enquanto o formulário anterior termina de fechar. | O editor mantém a sessão, o enquadramento e a proteção. Antes de reabrir a tela para mostrar a nova escolha, aguarda dois ticks. |
| O personagem e o livro cobriam a área de confirmação. | A prévia alternativa usava o renderizador 3D do jogador com equipamento e sem recorte de desenho. O mundo e o item da primeira pessoa também apareciam nas margens. | A prévia alternativa usa uma imagem de corpo inteiro recortada dentro do visor, sobre fundo opaco. O estúdio 3D usa uma animação local que reduz visualmente os encaixes dos itens das mãos durante a edição. |
| O nome da pele quebrava em várias linhas e encostava na moldura. | O rótulo longo e o nome da opção dividiam um cartão baixo. | O campo se chama **Base de pele**. Os cartões ganharam altura, margens e recorte próprios. A amostra de cor fica separada à direita. |
| A mecha quase desaparecia na vista frontal. | A geometria da mecha ficava atrás da face frontal do cabelo e era fina demais para a projeção em pixels. | A mecha acompanha a frente do cabelo no modelo e na prévia alternativa, com a mesma opção de cor. |

## Na prática

1. Importe o `Kimetsu_Fix_v82_Completo.mcaddon` e selecione os dois pacotes **1.0.64** no mundo com **APIs Beta**. Reabra o mundo para carregar os recursos atualizados.
2. Na primeira entrada, abra **Crie seu personagem**. À esquerda ficam **Pele**, **Cabelo** e **Olhos**. No centro fica a prévia. À direita ficam o campo selecionado, o valor atual, a amostra de cor quando disponível e **Anterior/Próximo**.
3. Use **Próximo** em **Base de pele** para trocar de **Base A · Claro** para **Base A · Mel**. O novo tom aparece na prévia antes de gravar. Em **Cabelo** e **Olhos**, selecione um campo e use os mesmos botões para mudar a opção.
4. Com a câmera disponível, use os controles abaixo do visor para girar, ajustar a distância, alternar entre rosto e corpo e restaurar o enquadramento. **Confirmar** e **Cancelar** ficam em uma faixa separada.
5. **Confirmar** grava a escolha. **Cancelar** mantém a aparência anterior. Ao sair do estúdio, o personagem volta ao ponto de origem e segue para o contrato.

A opção **Pele da conta** continua selecionável. Com a câmera do estúdio, ela usa a pele do próprio avatar. Se a câmera estiver indisponível, o visor explica que a pele da conta aparecerá no jogo. As dez peles do Kimetsu continuam com prévia frontal nessa situação.

## Na teoria

O Behavior Pack mantém um único rascunho de aparência durante a sessão. Cada ação atualiza os canais cosméticos temporários. Uma resposta de tela ocupada agenda uma nova tentativa mantendo aquele rascunho. A ficha persistente só é gravada na confirmação, após uma nova conferência das opções. Morte, desconexão ou troca de dimensão encerram a edição e o mecanismo de recuperação restaura a origem quando necessário.

A câmera de corpo inteiro agora tem distância mínima e campo de visão definidos pelo estúdio. As vistas de rosto e corpo usam enquadramentos próprios. O servidor restaura a câmera e o campo de visão ao sair. A posição, o inventário e o slot do livro ficam preservados na edição. A animação dos encaixes das mãos é aplicada no Resource Pack somente para o jogador local com a propriedade de edição ativa.

Se a câmera não puder ser usada, a interface recebe as camadas da pele, dos olhos, do cabelo e da mecha a partir do mesmo rascunho. Os recursos são projeções dos atlas e da geometria do próprio addon. As camadas usam um quadro de 80 × 156 com margens e desenho recortado no visor. `gerar-previas-v82.py` regenera os arquivos com Pillow e rejeita camadas vazias ou fora das margens.

## Validação

- Os **70 testes de Node.js** passaram a partir do pacote completo extraído. A suíte cobre a troca de pele após tela ocupada, o retrato alternativo, a pele da conta, a falha do campo de visão, a confirmação e o cancelamento. Também valida as referências a todas as 274 camadas e a separação do visor e do rodapé.
- O **Bedrock Dedicated Server 1.26.66.1** executou a primeira entrada com dois jogadores em estúdios separados. Verificou a câmera ativa após trocar a pele, o mesmo slot do livro, o cancelamento de dano, o retorno e o contrato. A prévia alternativa foi acionada em um espaço fechado. Uma segunda execução releu a ficha salva.
- A geometria do visor foi conferida em **1920 × 1080**, **1280 × 720**, **1024 × 768** e **2560 × 1080**. As respostas de formulário dos testes foram simuladas. A renderização final no cliente gráfico Bedrock, incluindo a escala da GUI, ainda está pendente.

## Arquivos

- `character_editor.js`, `character_camera.js`, `character_system.js`, `character_studio.js` e `character_config.js` tratam o fluxo da tela, o enquadramento e os seletores.
- `ui/character_customization.json`, `animations/maos_editor.animation.json`, `entity/player.entity.json` e `models/entity/customizacao/oficina.geo.json` tratam o visor, a animação local das mãos e a mecha.
- `textures/ui/customizacao/previa/` contém as projeções geradas. Os manifests e o HUD indicam a versão interna **1.0.64**.

## Integridade dos downloads

Os dois pacotes separados têm os mesmos arquivos que suas pastas no addon completo. Os UUIDs e os arquivos da v81 fora desta revisão foram conferidos.

```text
5c0c4cd2f91619a0dc1b855ce206cd9eab55c0c2532541271cd09610d4e0bca5  Kimetsu_Fix_v82_Completo.mcaddon
a5f7d5eac02b2f6e57c665faeba4d22d16975d5d621332908020c0ad8df1917a  Kimetsu_Fix_v82_BP.mcpack
59fd46a876cd595b9dc146a325a46cb6cf077f1016fd02beefb88ac520d53d21  Kimetsu_Fix_v82_RP.mcpack
```
