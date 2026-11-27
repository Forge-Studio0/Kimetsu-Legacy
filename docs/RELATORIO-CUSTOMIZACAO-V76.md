# Oficina de personagem do Kimetsu Legacy v76

A v76 adiciona um editor de aparência ao Minecraft Bedrock. O jogador vê o próprio personagem no mundo, cria um rascunho e escolhe quando gravá-lo. A oficina usa molduras vinho e dourado, ícones hexagonais e detalhes de cerejeira. As categorias ficam à esquerda, a câmera ocupa o centro e as opções ficam à direita.

A base é a v75 de treinamento das respirações, na revisão [ffd2255](https://github.com/Forge-Studio0/Kimetsu-Legacy/commit/ffd2255c44bcd38cca0f0559fd44cb80e7d80635). O Behavior Pack e o Resource Pack usam a versão interna **1.0.58** e os mesmos UUIDs da v75. A instalação continua usando as APIs Beta do mundo.

## Como funciona na prática

1. Importe `Kimetsu_Fix_v76_Completo.mcaddon` no Minecraft Bedrock. Ative os dois pacotes 1.0.58 no mundo e habilite **APIs Beta**. Em servidor dedicado, aponte as listas do mundo para a versão 1.0.58 dos dois UUIDs.
2. Fique em uma área com espaço à frente e use o **Menu Kimetsu** ou o livro da addon. Escolha **Aparência** no painel. O menu clássico e o contrato inicial oferecem **Customizar personagem**. Um Humano pode abrir a oficina antes de assinar.
3. Selecione **Cabelo**, escolha **Modelo de cabelo** e avance com **Próximo**. Selecione **Cor principal** para aplicar uma das amostras. **Cor da mecha** controla a segunda cor. No menu **Rosto**, cada íris tem seu próprio seletor.
4. Use **Girar** para os dois lados em passos de 30°. **Aproximar** e **Afastar** ajustam a distância. **Rosto** e **Corpo** trocam o enquadramento. **Restaurar** volta à vista inicial.
5. Pressione **SALVAR** para confirmar e fechar. **Cancelar**, o fechamento do formulário e as interrupções descartam a edição. Em um local apertado, o jogo pede espaço para abrir a câmera ou mantém o último ângulo válido.

O Híbrido pode alternar o perfil em **Identidades**. Por exemplo, edite o tecido do perfil **Caçador**, depois mude para **Oni** e escolha chifres. Salvar confirma os dois rascunhos. O perfil que aparece para os outros jogadores continua sendo o da identidade pública ativa. Troque de disfarce pelo menu de Híbridos para ativar outro perfil segundo as regras da v75.

Em **Informações**, a Staff pode autorizar nome e sobrenome de RP. A ficha armazena esses campos junto com a aparência. O jogo continua identificando contas e permissões pelo gamertag.

## Como funciona na teoria

### Abertura e câmera

O Behavior Pack verifica o estado do personagem antes de abrir uma sessão. Reutiliza as verificações de combate, queda, finalização, animações, transformação, resgate e viagem. Se a área estiver livre, coloca a câmera do próprio jogador em `minecraft:free`, apontada para um ponto entre a cabeça e os pés, ou para a altura do rosto. A posição depende da orientação inicial e do ângulo escolhido. Um raio limita o enquadramento quando há parede entre o jogador e a câmera.

Cada sessão tem seu próprio rascunho, perfil selecionado, categoria, ângulo e distância. A oficina deixa o jogador exposto ao dano normal. Se a posição, a dimensão, o estado de combate ou a identidade pública mudarem, o servidor encerra a sessão e limpa a câmera que a oficina configurou. Um marcador persistente permite concluir essa limpeza ao carregar o jogador novamente.

### Rascunho e visual confirmado

O jogador real aparece na prévia. O Behavior Pack transmite os códigos do rascunho e os códigos da aparência confirmada em seis propriedades cosméticas. O Resource Pack usa o rascunho na renderização do cliente local e a aparência confirmada na renderização dos demais jogadores. A seleção de um visual em edição muda somente o rascunho.

Ao salvar, o servidor verifica novamente a sessão, a raça verdadeira, as compatibilidades e as permissões do catálogo. Grava um registro pequeno por jogador em `kny:aparencia`, com IDs estáveis, perfis e as autorizações de RP. Os modelos e as texturas ficam no Resource Pack. Humanos e Caçadores compartilham o perfil base, Onis usam um perfil próprio e Híbridos têm três perfis. Perfis ainda sem personalização começam com o visual base disponível, filtrado para a identidade correspondente.

### Camadas de renderização

Cabelo, olhos, expressão, roupas e acessórios usam geometrias com os ossos do jogador. Os render controllers selecionam a malha e a textura da variante. Capacetes ocultam os cosméticos de cabeça, peitorais ocultam busto e mangas, e calças ou botas ocultam as camadas cosméticas de perna. Máscaras cobrem a expressão e podem cobrir as presas. Chifres ocupam o espaço do adorno de cabeça. As formas especiais, a invisibilidade e as marcas funcionais têm prioridade nas regiões que afetam.

A oficina adiciona 47 geometrias e 12 camadas de renderização. As texturas de entidade usam atlas de 64 px. As propriedades do visual são atualizadas ao iniciar, mudar ou encerrar a edição, ao salvar e nos eventos relevantes de personagem e catálogo. A verificação periódica percorre as sessões abertas. A prévia usa o personagem existente e dispensa entidades temporárias.

## Alterações da v76

| Área | Alteração |
| --- | --- |
| Menu | Acesso no painel, no menu clássico e no contrato inicial. |
| Oficina | Nove categorias, câmera de corpo e rosto, amostras de cor e seis conjuntos iniciais. |
| Personagem | Visual persistente por jogador, com perfis de disfarce para Híbridos e validação de traços Oni. |
| Staff | Consulta, restauração, fechamento de sessão, autorização de nome e controle de cosméticos. |
| Compatibilidade | Propriedades e render controllers adicionais, com prioridade para equipamento e modelos funcionais. |
| Desenvolvimento | Gerador dos recursos originais e testes de sessão, câmera, perfis, catálogo e interface. |

O primeiro teste de inicialização no Bedrock detectou uma dependência circular ao ligar o editor à recuperação de jogadores caídos. O módulo de reviver passou a importar as mesmas funções de `stats.js`, onde elas são definidas. A regressão de morte, respawn e reviver passou com a mudança.

## Limitações técnicas

- A seleção é feita com botões de rotação e de escolha incremental. O catálogo oferece modelos e cores definidos, com ajuste visual de rosto sobre o avatar do Bedrock.
- **Tom do rosto** é uma camada sobre a cabeça. As regiões expostas do corpo seguem a skin da conta. Capacetes, máscaras, marcas e certas formas podem ocultar as escolhas correspondentes até que a condição visual termine.
- O modo clássico mantém as ações da oficina pelo formulário nativo do Bedrock. A moldura e as amostras de cor dependem do Resource Pack.
- A edição de nomes se aplica à ficha de RP da oficina. O catálogo inicial de roupas reúne peças temáticas originais, com modelos funcionais e peças exclusivas de patentes ainda controlados pelo jogo.
- O servidor dedicado executou a lógica e as chamadas da câmera. A renderização da interface, os encaixes com cada skin e armadura, o controle e as escalas de GUI exigem um cliente gráfico Bedrock. As capturas e a matriz de resoluções gráfico-visuais ficaram pendentes.

## Documentação da entrega

- [Catálogo e manutenção](CATALOGO-CUSTOMIZACAO-V76.md)
- [Manual da Staff](MANUAL-STAFF-CUSTOMIZACAO-V76.md)
- [Relatório de testes](TESTES-CUSTOMIZACAO-V76.md)
- [Comportamento e recursos no código-fonte](../codigo-v70/)

## Referências

- Uso e restauração da câmera. [Camera na Script API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/camera?view=minecraft-bedrock-stable) · [Sistema de câmera](https://learn.microsoft.com/en-us/minecraft/creator/documents/CameraSystem/CameraCommandIntroduction?view=minecraft-bedrock-stable)
- Sincronização e seleção de geometrias e texturas. [Propriedades de entidade](https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontoentityproperties?view=minecraft-bedrock-stable) · [Render controllers](https://learn.microsoft.com/en-us/minecraft/creator/documents/behaviorrendercontrollers?view=minecraft-bedrock-stable) · [Funções de consulta Molang](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions?view=minecraft-bedrock-stable)
- Cabelos, uniformes e haoris como referências de estilo. [Personagens de Kimetsu no Yaiba](https://demonslayer-anime.com/mugentrain/character/)
- Vestuário Taishō, desenho têxtil de kosode e motivos índigo. [Kimono Taishō no Met](https://www.metmuseum.org/art/collection/search/49810) · [Kosode com folhas e samambaias no Met](https://www.metmuseum.org/art/collection/search/61838)
