# Correção da transformação em Híbrido na v73

A posição automática Híbrido Superior entrou na v74. [Relatório da nova patente](RELATORIO-PATENTE-HIBRIDA-V74.md).

Na v72, o jogador podia ver todas as formas liberadas, usar o sangue e se tornar Oni comum sem que o jogo avisasse qual seria o resultado. A v73 mostra o domínio humano real nas telas de Respirações, pede confirmação antes de uma transformação comum e oferece à Staff uma recuperação para fichas afetadas da v72.

## Causa do erro

O addon tem dois registros. O placar `kf_<respiração>` indica quantas formas o personagem pode executar. Ele pode ser preenchido por aulas, pela promoção a Hashira, pela migração de versões antigas ou por alteração administrativa. O histórico `kny:h_dominio` registra as formas aprendidas em aulas enquanto o aluno era humano ou certificadas pela Staff com evidência dessa época.

A interface da v72 chamava as formas de **aprendidas** assim que o placar de acesso estava cheio. O sangue consultava o outro registro, o das aulas. Quando faltava um domínio completo, o jogo consumia uma dose e aplicava imediatamente a transformação comum. A informação no menu e o resultado do item davam ao jogador expectativas incompatíveis.

No Bedrock Dedicated Server, a v72 reproduziu o relato com um Caçador de teste promovido a Hashira. A promoção preenchia `kf_water=10` e o histórico tinha zero aulas da Água. O uso nativo de `kny:blood` consumiu o item, elevou o placar de sangue em uma dose e registrou a raça Oni. A ficha do mundo do jogador pode ser verificada com o diagnóstico da Staff descrito abaixo.

## Falhas verificadas e correções

| Ponto | Comportamento da v72 | Correção na v73 |
| --- | --- | --- |
| Contagem no menu | As formas obtidas pela patente ou pela migração apareciam como aprendidas. | O painel, o menu clássico e os detalhes mostram **Liberadas** e **Domínio** em contadores próprios. A confirmação de cada aula informa o progresso comprovado. |
| Sangue com domínio incompleto | O primeiro uso consumia a dose e tornava o humano um Oni comum. | O jogo exibe o resultado antes de aplicar a mudança. **Continuar humano**, fechar o aviso ou cancelar conserva a dose. |
| Mais de uma respiração dominada | O sangue interrompia a tentativa e enviava uma mensagem para procurar o menu. | O próprio uso abre a escolha de original. Depois de escolhê-la, o jogador usa a dose novamente. |
| Resultado muda com um formulário aberto | Uma resposta podia executar a transformação com estado diferente daquele exibido. | A confirmação guarda o resultado apresentado. O servidor verifica novamente o alvo, o domínio, a autoridade e, na rota do sangue, o espaço e a quantidade da pilha. |
| Aulas concorrentes | Um botão aberto para uma aula antiga podia avançar a aula seguinte se o progresso mudasse antes do clique. | O servidor confere se a aula mostrada ainda é a próxima. O professor recebe uma mensagem para selecionar a aula atual. |
| Sangue empilhado e retomada | Uma retomada comparava a quantidade com `>=` e podia substituir uma pilha maior. O registro pendente ainda carregava a descrição da dose depois de descontá-la. | O débito usa a quantidade exata. A ficha registra o pagamento antes das mudanças de raça, então a retomada normal continua a partir da etapa já paga. Um erro de gravação após o débito tenta devolver a dose no mesmo espaço. |
| Antídoto em um antigo Caçador | A v72 guardava o contrato assinado, embora as tags humanas tivessem sido removidas. O personagem curado podia ficar sem acesso às aulas. | O antídoto retira os componentes ambientais Oni e restaura o acesso ao contrato de um Caçador reconhecido na ficha. O jogador já pode registrar aulas usando o mesmo personagem. |
| Oni comum já criado pela v72 | Beber de novo em linhagem Oni só somava uma dose. Faltava uma operação para rever o diagnóstico antigo. | O comando de recuperação permite à Staff aplicar a linhagem Híbrida a uma ficha v72 elegível com domínio comprovado, usando a transformação que já aconteceu. |

## Como funciona na teoria

A decisão acontece no servidor, antes de retirar as tags da patente humana. O menu só apresenta a decisão e encaminha a resposta do jogador. O Rei titular, o sangue em mãos e a rota administrativa de cargo chegam à mesma validação, cada um com sua própria checagem de autoridade.

| Estado validado no momento da transformação | Resultado do sangue |
| --- | --- |
| Um domínio elegível completo | Aplica a linhagem Híbrida com essa respiração e consome uma dose. |
| Vários domínios completos e original definida | Aplica a linhagem Híbrida com a original salva e consome uma dose. |
| Vários domínios completos e original por definir | Abre a escolha e guarda a dose para o próximo uso. |
| Nenhum domínio elegível completo | Mostra o resultado **Oni comum**. Somente a confirmação consome a dose e transforma o humano. |
| Histórico inválido, alvo incapacitado ou decisão desatualizada | Bloqueia a tentativa e informa o motivo. |
| Personagem já Oni ou Híbrido | Uma utilização válida soma uma dose à linhagem atual. A recuperação da v72 tem comando próprio. |

Um domínio exige todas as formas da **mesma** respiração. Por exemplo, nove aulas da Água e uma de Trovão ainda deixam os dois estilos incompletos. A Respiração Básica das lâminas coloridas é inelegível na configuração atual. A variante usada no aprendizado conta pelo próprio ID. Água, Água de Giyu e Água de Tanjiro têm históricos distintos.

A primeira transformação válida congela a raça, a respiração original, as formas e a arte vinculada na ficha. A patente inicial é Oni comum dentro da hierarquia demoníaca. A tela privada mostra **Híbrido** para a raça e o cargo inicial Oni para a patente. A arte vinculada é a primeira compatível no inventário durante a transformação ou Enmu como padrão. A técnica ainda exige o item apropriado e os recursos do combate. [Regras completas dos Híbridos](HIBRIDOS-V72.md).

## Como jogar no PC

### Conferir o domínio e completar as aulas

1. Abra o **Menu Kimetsu** com o botão direito. O painel mostra **Respir.** para o catálogo e **Guia** para a ficha. No clássico, entre em **Respirações** ou **Guia**.
2. Veja os números de um estilo em **Respirações**. **Liberadas 10/10 · Domínio 0/10** indica que as dez formas da Água estão disponíveis para combate e ainda faltam as dez aulas comprovadas.
3. Fique a até 12 blocos do Líder dos Hashiras, na mesma dimensão e com a Nichirin correta no inventário. No menu dele, abra **Ensinar** no painel ou **Ensinar Respiração** no clássico. Escolha a respiração e o nome do aluno.
4. Registre uma forma por vez. Para a aula de número `n`, a honra exigida para os estilos comuns é `10 × (n − 1)`. A décima aula da Água exige 90 de honra. Um Hashira pode orientar outro Hashira ou o Líder pelo acesso **Aulas** no painel ou **Aulas de domínio** no clássico.
5. Abra **Guia → Domínio humano**. Quando houver um domínio disponível para transformação, a tela mostra **Híbrido pronto** e o nome da respiração. Se houver várias completas, escolha **Definir original** para uma delas.

### Beber o sangue

1. Empunhe o Sangue de Muzan e use com o botão direito.
2. Se o jogo abrir **Domínio humano**, escolha a original e use o sangue novamente. A primeira tela deixa a dose na mão.
3. Se abrir **Transformação em Oni comum**, use **Continuar humano** para voltar às aulas ou **Beber e virar Oni comum** para aceitar a linhagem comum.
4. Se a transformação produziu um Híbrido, abra o item de menu e selecione **Híbrido** no painel ou **Personagem Híbrido** no clássico. A tela mostra a respiração original e o Kekkijutsu vinculado.

### Certificar aprendizado humano anterior

Uma pessoa da Staff pode certificar o histórico verificável de outro jogador enquanto ele estiver online e humano. A respiração deve estar integralmente liberada. Use de 12 a 240 caracteres para indicar um registro concreto, como aulas anotadas em uma temporada.

```mcfunction
/scriptevent kny:h_staff certificar "Nome do Caçador" water Registro da escola com as dez aulas humanas concluídas
```

Depois da certificação, o Caçador confere o domínio no menu e usa o fluxo normal do sangue.

## Recuperar um personagem que virou Oni na v72

Use o diagnóstico como operador do mundo ou com a autorização de Staff do addon `kny_op`, onde houver acesso ao comando `/scriptevent`. O personagem precisa estar online.

```mcfunction
/scriptevent kny:h_staff diagnostico "Nome do jogador"
```

O retorno mostra a raça, o ID do personagem, as formas liberadas, o domínio comprovado e se há uma ficha de transformação v72 para revisão. Use o código que aparece no diagnóstico. `water` é Água e `thunder` é Trovão.

Com o domínio completo já salvo, a Staff pode recuperar a transformação da v72 com o nome ou ID do personagem. Um operador pode executar esse caso para o próprio personagem quando o domínio já está registrado.

```mcfunction
/scriptevent kny:h_staff recuperar "Nome do jogador" water
```

Quando só existem formas liberadas, outra pessoa da Staff pode atestar o aprendizado ocorrido enquanto o personagem ainda era humano. Informe a evidência concreta no próprio comando. A recuperação exige que a ficha v72 registre a transformação de um Caçador por uma rota legítima e que o personagem esteja fora de combate e de ações incompatíveis.

```mcfunction
/scriptevent kny:h_staff recuperar "Nome do jogador" water Registro das dez aulas humanas conferido nos arquivos da temporada
```

A operação conserva o ID, a patente Oni atual, o sangue acumulado, a maldição, os Stats, o inventário e o saldo. A ficha passa a Híbrido com a respiração comprovada e a arte vinculada. Como a transformação já foi paga, o procedimento dispensa uma nova dose. O pedido e a certificação ficam registrados para auditoria.

Se faltar evidência do domínio humano, o caminho de jogo é usar o antídoto de Oni comum, voltar às aulas e transformar após comprovar o domínio. No mundo em que existe a ficha v72 de Caçador, o antídoto restabelece o acesso às aulas. Quando só existe o placar de versões antigas, o diagnóstico informa o limite e a Staff pode certificar o aprendizado após a volta ao estado humano.

## Instalação da v73

1. Faça uma cópia do mundo e feche-o.
2. Abra o arquivo `Kimetsu_Fix_v73_Completo.mcaddon` no Minecraft Bedrock para Windows. Ele contém o pacote de comportamento e o de recursos.
3. Ative os dois no mundo e mantenha **APIs Beta** ligadas. Os pacotes usam os UUIDs da v72. Ambos devem aparecer na versão interna **1.0.55**.
4. No Bedrock Dedicated Server, atualize a referência dos dois pacotes em `world_behavior_packs.json` e `world_resource_packs.json` para `[1, 0, 55]`, instale os pacotes correspondentes e reinicie o servidor.

[Pacote completo v73](../Kimetsu_Fix_v73_Completo.mcaddon) · [Pacote de comportamento](../Kimetsu_Fix_v73_BP.mcpack) · [Pacote de recursos](../Kimetsu_Fix_v73_RP.mcpack)

## Validação

Os 34 testes Node.js passaram. A cobertura inclui seleção da original, cancelamento do sangue, alteração da pilha ou do domínio durante a confirmação, interrupção de transformação, permissões, recuperação da v72, cura, disfarces, poderes, sol, castelo, Stats e menus. [Testes de Híbridos](../codigo-v70/testes/hibridos.test.mjs) · [Testes de Stats e menu](../codigo-v70/testes/stats.test.mjs).

No Bedrock Dedicated Server **1.26.66.1**, o cenário original da v72 foi reproduzido com o uso nativo do sangue. Na v73, o servidor confirmou o cancelamento com a pilha intacta, a confirmação de Oni comum com uma única dose consumida, a remoção da família Oni pelo antídoto, dez aulas da Água pelo menu do Líder, a transformação Híbrida após as aulas, a escolha entre duas respirações e a recuperação com preservação de patente, sangue e saldo. Os jogadores e cliques nas telas foram simulados pelo GameTest. A aparência das telas no cliente Windows e o estado do personagem no mundo real exigem a conferência no próprio mundo. [Roteiro GameTest da transformação](../codigo-v70/testes/bedrock-transformacao.js).

As regressões no Bedrock confirmaram os dois livros de menu, a transformação pelo Rei, os três disfarces, Água e Enmu autorizados, Trovão e Biwa bloqueados em um Híbrido de Água e Enmu, sol, Castelo Infinito de teste e a reserva de poder após reinício. Também passaram os cenários de Stats, morte, renascimento e reviver. Os packs extraídos do arquivo de distribuição iniciaram no Bedrock 1.26.66.1 sem GameTest. Os avisos de conteúdo herdados estão registrados na auditoria da v72. [Auditoria da v72](AUDITORIA-V72.md).

## Arquivos da correção

- [Menu, aulas e confirmações](../codigo-v70/Kimetsu%20Fix%20Be/scripts/menu.js)
- [Domínio, requisitos de aula e certificação](../codigo-v70/Kimetsu%20Fix%20Be/scripts/hybrid_mastery.js)
- [Decisão, débito da dose, transformação e recuperação](../codigo-v70/Kimetsu%20Fix%20Be/scripts/hybrid_system.js)
- [Identificadores, validação de fichas e auditoria](../codigo-v70/Kimetsu%20Fix%20Be/scripts/hybrid_records.js)
- [Comandos de diagnóstico e recuperação](../codigo-v70/Kimetsu%20Fix%20Be/scripts/hybrid_admin.js)
- [Remoção dos componentes Oni na cura](../codigo-v70/Kimetsu%20Fix%20Be/entities/player.json)
