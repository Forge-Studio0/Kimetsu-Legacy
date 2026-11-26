# Patente Híbrido Superior na v74

Todo personagem com uma ficha Híbrida ativa recebe a posição **Híbrido Superior** ao concluir a transformação. A v74 também aplica a posição às fichas Híbridas existentes. Na hierarquia demoníaca, a Lua Superior 1 tem teto geral 65, o Híbrido Superior tem 68 e o Rei dos Onis tem 70.

## Por que o painel mostrava Oni comum

A v73 usava a ficha Híbrida para definir o título **Painel do Híbrido**, a respiração original, o Kekkijutsu e o disfarce. Para calcular atributos e exibir a posição, o jogo consultava a lista de patentes Oni. Como nessa lista ainda faltava uma posição para o Híbrido, quem acabava de se transformar recebia os tetos de Oni comum. As duas informações da tela representavam regras distintas do mesmo personagem. [Transformação na v73](RELATORIO-TRANSFORMACAO-V73.md).

A v74 faz a leitura da posição a partir da ficha ativa de raça no servidor. O painel, o menu clássico, a página do personagem e o diagnóstico da Staff usam a mesma função que define os limites reais de Stats. [Leitura da ficha](../codigo-v70/Kimetsu%20Fix%20Be/scripts/hybrid_records.js) · [Identificação da patente](../codigo-v70/Kimetsu%20Fix%20Be/scripts/stats.js).

## Como a patente funciona na teoria

A transformação continua exigindo um Caçador humano que comprovou o domínio de todas as formas da respiração original elegível. Quando a rota de transformação grava a ficha Híbrida ativa, a posição já vale com **0 de maldição**. A escolha de respiração original segue a regra da v73 quando houver mais de um domínio completo.

O jogo aplica uma única patente de cada vez. O Rei titular usa a ficha de Stats do Rei. Os demais Híbridos ativos usam a de Híbrido Superior, independentemente do disfarce. A linhagem pode ter vários Híbridos Superiores ao mesmo tempo. Cada ficha mantém seu próprio Kekkijutsu, sua respiração original e a habilidade exclusiva que estiver atribuída a ela.

A ascensão natural ao cargo único de **Rei dos Onis** ainda exige a progressão correspondente à Lua Superior 1, 10.000 de maldição e uma vaga livre. Um Híbrido que se torne o titular usa a posição Rei dos Onis durante o reinado. Substituído no cargo, volta à posição Híbrido Superior. A autoridade de transformar outros jogadores continua vinculada ao titular do Rei.

### Tetos e efeitos permanentes

| Atributo ou efeito | Oni comum | Lua Superior 1 | Híbrido Superior | Rei dos Onis |
| --- | ---: | ---: | ---: | ---: |
| Força, nível máximo | 8 | 65 | **68** | 70 |
| Vida, nível máximo | 8 | 60 | **63** | 65 |
| Defesa, nível máximo | 7 | 56 | **58** | 60 |
| Poder, nível máximo | 7 | 63 | **66** | 68 |
| Stamina, nível máximo | 8 | 58 | **61** | 63 |
| PV de base | 44 | 48 | **48** | 48 |
| PV com Vida no teto | 48 | 96 | **96** | 100 |
| Stamina com investimento máximo | 120 | 183 | **185** | 187 |
| Fôlego com Poder no teto | 118 | 185 | **187** | 188 |
| Movimento de base no Bedrock | 0,102 | 0,120 | **0,121** | 0,122 |

O limite de cada atributo do Híbrido Superior fica acima do limite da Lua Superior 1 e abaixo do limite do Rei. A fórmula de Vida dá 4 PV por faixa de cinco níveis. Por isso, Vida 60 e Vida 63 chegam aos mesmos 96 PV, e o Rei alcança 100 PV no nível 65. Os 48 PV de base são 24 corações. A velocidade usa o mesmo escalonamento de sangue da linhagem Oni. Com o bônus de sangue no máximo, os valores de movimento são 0,128, 0,129 e 0,130 para Lua Superior 1, Híbrido Superior e Rei respectivamente. [Valores e fórmulas](../codigo-v70/Kimetsu%20Fix%20Be/scripts/stats_config.js).

Nos tetos de Força, o bônus de dano do Híbrido chega a 37,19%, entre 36,40% da Lua Superior 1 e 37,69% do Rei. A redução de Defesa fica em 24,37%, entre 23,73% e 25%. A vantagem da patente mede o potencial permanente. Em combate, equipamento, formas, habilidade exclusiva, fôlego e investimento de pontos também pesam.

O jogo mantém um saldo e cinco trilhas de atributo por personagem. Os custos começam em 100 pontos e sobem a cada cinco níveis. Treino e sangue seguem as regras de desconto e movimento existentes. A promoção abre limite de compra e aplica a vida e a movimentação de base. Pontos acumulados, compras, histórico de treino e vida atual são reaproveitados.

### Identidade, acessos e autoridade

O disfarce continua definindo como outros jogadores e NPCs reconhecem o personagem. O menu particular conserva a patente verdadeira e o chat local usa a identidade pública. O Híbrido segue com resistência solar parcial.

Portais configurados com patente mínima comparam a patente verdadeira com o patamar exigido. Híbrido Superior tem patamar **1.300** para essa comparação. O placar de maldição continua mostrando o número que o jogador acumulou. Cada portal ainda verifica sua política de identidade, e o Castelo Infinito usa as regras próprias de disfarce e configuração. [Regras de acesso](../codigo-v70/Kimetsu%20Fix%20Be/scripts/hybrid_locations.js).

Em **Alterar meu cargo**, um operador Híbrido pode selecionar Híbrido Superior ou assumir o cargo único do Rei pela rota administrativa existente. Ao voltar de Rei para Híbrido Superior por esse menu, a vaga é liberada e a maldição fica em até 9.999, deixando a próxima promoção para quando o jogador voltar ao requisito. O histórico de recompensa conserva a maior marca atingida. Quem joga como Oni comum continua vendo os cargos Oni originais no menu administrativo.

## Como usar na prática no PC

1. Faça uma cópia do mundo e importe o arquivo `.mcaddon`. Nas configurações do mundo, ative o pacote de comportamento e o pacote de recursos na versão **1.0.56**. Mantenha as **APIs Beta** habilitadas. [Add-on completo v74](../Kimetsu_Fix_v74_Completo.mcaddon).
2. Entre com seu personagem. Se ele já era Híbrido na v73, a posição é carregada ao entrar. Se ainda é Caçador, confira **Guia → Domínio humano** no livro vermelho e use o sangue quando a tela indicar que está pronto.
3. Empunhe o **Menu Kimetsu** e clique com o botão direito. Procure **Posição: Híbrido Superior** e os novos tetos de atributos. Agache enquanto usa o livro para abrir a versão clássica.
4. Para gastar pontos, selecione o atributo e a quantidade de níveis. Se o personagem tiver 32.800 pontos e Força 0, por exemplo, investir apenas em Força sem desconto permite chegar ao nível 27 por 31.750 pontos, com 1.050 de saldo.
5. Para conferir a ficha pela Staff, execute `/scriptevent kny:h_staff diagnostico "<nome do jogador>"` com as permissões de comando e de Staff. Um Híbrido fora do cargo real aparece com **raça hibrido · patente Híbrido Superior**.

Os dois pacotes mantêm os UUIDs da v73 para continuar lendo as fichas do mesmo mundo. Para restaurar uma instalação v73, use a cópia do mundo feita antes da atualização, pois a v74 grava o identificador da nova patente no registro de Stats.

## Verificação da atualização

Os **37 testes em Node.js** passaram nos arquivos extraídos do pacote de distribuição. A suíte verificou as 28 faixas, compras nos cinco atributos, tetos entre Lua Superior 1 e Rei, identificação pela ficha ativa, reconexão a partir dos dados da v73, exibição privada da posição e titularidade única do Rei. [Testes de Stats](../codigo-v70/testes/stats.test.mjs) · [Testes dos Híbridos](../codigo-v70/testes/hibridos.test.mjs).

O **Bedrock Dedicated Server 1.26.66.1** confirmou a patente com 0 de maldição, 48 PV de base, os novos limites, o painel aberto pelo livro e a recuperação de uma ficha da v72 com saldo e sangue preservados. Também passaram os cenários de uso de sangue, domínio humano, transformação comum, disfarces, técnicas permitidas, sol, ida e volta no Castelo de teste e persistência após reinício. As respostas aos formulários foram simuladas pelo GameTest. A renderização do painel em Windows e os duelos no mundo do servidor ficam fora dessa validação. [Roteiro da transformação](../codigo-v70/testes/bedrock-transformacao.js) · [Roteiro do sistema Híbrido](../codigo-v70/testes/bedrock-hibridos.js) · [Roteiro de Stats no Bedrock](../codigo-v70/testes/bedrock.js).

O pacote de distribuição iniciou no Bedrock com os dois manifests pareados em **1.0.56**. Os pacotes separados contêm os mesmos arquivos do add-on completo. [Pacote de comportamento](../Kimetsu_Fix_v74_BP.mcpack) · [Pacote de recursos](../Kimetsu_Fix_v74_RP.mcpack).

SHA-256 do arquivo completo `d48831d2744beb6883fd84a6a465a7354b00eb93121f78c3c3a6c16c8f44c7c4`.
