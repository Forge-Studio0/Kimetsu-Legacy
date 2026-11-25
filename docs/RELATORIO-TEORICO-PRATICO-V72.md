# Relatório teórico e prático — Sistema de Híbridos v72

## 1. Finalidade deste documento

Este relatório explica detalhadamente como o sistema de Híbridos da v72 foi projetado, como ele funciona internamente e como jogadores, líderes e Staff o utilizam no Minecraft Bedrock para Windows ou em servidor dedicado.

Ele descreve o comportamento implementado na revisão `58febe76f91ad32bcb641e5758ee28a5142856cf`. Valores de balanceamento podem ser ajustados pela Staff. Quando este documento diz **validado**, significa que a rota foi exercitada por teste automatizado ou pelo Bedrock Dedicated Server local. Quando diz **homologação pendente**, a função existe, mas ainda precisa ser conferida no mundo e nos clientes reais do servidor.

## 2. Visão geral do ciclo do personagem

O ciclo esperado de um Híbrido é:

1. O personagem começa humano e Caçador.
2. Aprende formas de uma respiração, uma por vez e em ordem.
3. O sistema registra que essas formas foram aprendidas enquanto ele ainda era humano.
4. Ao completar uma respiração elegível, o personagem possui um domínio humano válido.
5. O Rei titular, o sangue ou uma rota administrativa autorizada inicia a transformação.
6. O servidor decide se o personagem tem domínio suficiente para virar Híbrido. Caso contrário, ele vira Oni comum.
7. O Híbrido conserva somente a respiração original escolhida e recebe vínculo com uma única Arte Demoníaca.
8. Depois da transformação, ele pode alternar sua apresentação pública entre Caçador, Oni e Híbrido revelado.
9. A Staff pode atribuir uma habilidade exclusiva disponível.
10. O personagem continua vulnerável ao sol e pode acessar o Castelo Infinito quando o servidor estiver configurado.

O sistema separa quatro conceitos que antes poderiam ser confundidos:

| Conceito | O que representa | O que não representa |
| --- | --- | --- |
| Acesso antigo `kf_*` | Quantas formas o personagem pode executar | Prova de que ele aprendeu as formas humano e vivo |
| Domínio humano | Histórico cronológico de aulas ou certificação legítima | Cargo, aparência ou raça atual |
| Raça verdadeira | Estado permanente de humano, Oni ou Híbrido | Disfarce mostrado aos outros |
| Identidade pública | Aparência e família apresentada aos NPCs | Alteração dos Stats, inventário ou raça real |

## 3. Domínio humano

### 3.1 Funcionamento teórico

O domínio humano é um registro separado dos placares tradicionais. Cada aula armazena a respiração, a forma aprendida, a origem, o professor e o momento do aprendizado. A ordem é importante: a forma seguinte só pode ser registrada depois das anteriores.

Para uma aula normal, o aluno precisa atender às regras existentes de contrato, proximidade, honra, patente e Nichirin. O líder ensina Caçadores próximos. Hashiras também podem orientar outros Hashiras em formas compatíveis com a patente, inclusive o líder. Possuir uma espada ou um placar completo não cria sozinho uma prova histórica.

Uma respiração se torna elegível quando todas as formas exigidas possuem registros válidos. A Respiração Básica começa inelegível para Híbridos porque `aceitarBasica` está definido como `false`. Essa decisão impede que as três técnicas genéricas substituam o treinamento completo de uma escola real.

Se houver um único domínio completo, ele pode ser escolhido automaticamente durante a transformação. Se houver mais de um, o jogador deve definir qual será a respiração original. A escolha impede que um Híbrido use simultaneamente várias escolas completas.

### 3.2 Funcionamento prático

O jogador abre:

`Menu Kimetsu → Guia → Domínio humano`

O professor usa a área de aulas para localizar um aluno próximo e ensinar a próxima forma disponível. O aluno deve permanecer perto, estar apto pelas regras anteriores e portar a Nichirin correta quando exigida.

Exemplo prático:

1. Um Caçador assina o contrato.
2. Obtém a Nichirin da Água.
3. O professor ensina a primeira forma.
4. O registro grava a primeira aula.
5. As aulas seguintes são realizadas na ordem do catálogo.
6. Quando todas terminam, Água aparece como domínio completo.
7. Se Água for o único domínio completo, ela será a candidata automática à respiração original.

Para um histórico legítimo anterior à atualização, a Staff pode certificar manualmente:

```mcfunction
/scriptevent kny:h_staff certificar "Nome do Caçador" water Registro da Escola da Água, aulas arquivadas da temporada
```

A certificação exige jogador online, respiração reconhecida, permissão de Staff e uma descrição concreta da evidência. A ação fica registrada na auditoria. O placar, sozinho, não deve ser usado como evidência.

## 4. Transformação em Híbrido

### 4.1 Funcionamento teórico

As rotas de sangue, menu do Rei e cargo administrativo passam pela mesma decisão de transformação. Antes de alterar a raça, o servidor consulta os domínios completos e a escolha de respiração original.

Se a comprovação não existir, o personagem segue a transformação tradicional e vira Oni comum. Se existir, o servidor cria o registro Híbrido e preserva a respiração original. A hierarquia humana não é acumulada sobre a hierarquia Oni: o novo Híbrido começa no patamar Oni inicial previsto pelo sistema.

A transformação é escrita como uma operação persistente e idempotente. Isso significa que, se o processo for interrompido por desconexão ou reinício, ele pode ser retomado sem aplicar a mesma dose, recompensa ou mudança duas vezes.

O sistema também mantém separadas:

- ficha de Stats;
- inventário;
- formas aprendidas;
- raça verdadeira;
- patente Oni;
- identidade pública;
- arte vinculada;
- habilidade exclusiva.

### 4.2 Funcionamento prático

Antes de transformar, o jogador deve conferir no menu se o domínio aparece como completo e, quando houver mais de uma opção, selecionar a respiração original.

Depois, a transformação pode acontecer pela jogabilidade do Rei e do sangue já existente. Ao concluir:

- o menu particular passa a identificar o personagem como Híbrido;
- a respiração original permanece disponível;
- as outras respirações ficam bloqueadas para uso Híbrido;
- o personagem entra na linhagem e progressão Oni;
- o sistema seleciona a arte compatível já possuída ou usa Enmu como vínculo inicial;
- disfarces e exposição solar passam a ser administrados pelo módulo Híbrido.

Se o jogador tentar transformar sem domínio válido, o resultado esperado é Oni comum. Isso é uma regra do sistema, não uma falha do menu.

## 5. Respiração e Arte Demoníaca

### 5.1 Funcionamento teórico

O Híbrido possui dois códigos de autorização independentes:

- código da respiração original;
- código da Arte Demoníaca vinculada.

Os controladores das técnicas consultam esses códigos antes de iniciar a ação. Placares antigos não conseguem liberar uma segunda respiração ou arte incompatível. A técnica ainda precisa satisfazer as condições já existentes, como forma aprendida, item, fôlego, estado do personagem e recarga.

O vínculo demoníaco procura primeiro uma arte compatível no inventário durante a transformação. Se nenhuma for encontrada, o vínculo inicial configurado é Enmu. O vínculo autoriza somente uma arte e não muda ao trocar o disfarce.

Respiração e Arte Demoníaca usam o mesmo recurso de fôlego existente. O sistema de Stats continua aplicando Força, Poder e Defesa na etapa já usada pelo addon. A v72 não soma o bônus de Poder duas vezes.

### 5.2 Funcionamento prático

Um Híbrido cuja respiração original seja Água pode usar as formas de Água que dominou, desde que esteja com o item correto e tenha recursos. Mesmo que possua placar ou item de Trovão, o controlador bloqueia Trovão por não ser a respiração original.

Da mesma forma, um Híbrido vinculado a Enmu pode usar Enmu quando cumprir as condições do golpe. Carregar uma biwa no inventário não libera Biwa se o vínculo for Enmu.

Usar uma Arte Demoníaca enquanto o disfarce público é Caçador revela o personagem. Usar respiração enquanto o disfarce é Oni também provoca revelação. Essa transição ocorre antes da técnica para manter coerência entre ação e identidade pública.

## 6. Identidade pública e disfarces

### 6.1 Funcionamento teórico

A raça verdadeira nunca é substituída pelo disfarce. O sistema altera somente a camada pública usada para nome, marca visual, chat e família consultada por NPCs.

| Estado público | Apresentação | Família pública | Uso esperado |
| --- | --- | --- | --- |
| Caçador | Skin pessoal e aparência humana | `player`, `slayer` | Infiltração e convivência humana autorizada |
| Oni | Marca demoníaca sobre a skin | `player_demon` | Hierarquia Oni e acessos compatíveis |
| Revelado | Marca da forma verdadeira | `player_demon`, `kny_hybrid` | Poderes Híbridos e Castelo Infinito |

O disfarce não altera Stats, saúde máxima, inventário, maturidade, patente real ou propriedade de habilidades. Equipamentos continuam visíveis conforme o cliente e os demais pacotes.

Combate recente, derrubada e animações incompatíveis bloqueiam a troca. A janela de combate configurada é 10 segundos e a recarga de disfarce é 30 segundos. Habilidade exclusiva e usos incompatíveis de respiração ou arte podem revelar a forma verdadeira.

### 6.2 Funcionamento prático

O jogador abre:

`Menu Kimetsu → Personagem Híbrido → Disfarces`

Em situação segura, escolhe Caçador, Oni ou Revelado. Se o menu recusar a troca, deve aguardar o fim do combate, da animação ou da recarga mostrada.

Exemplo:

1. O Híbrido está com identidade de Caçador.
2. Um inimigo o ataca.
3. Durante 10 segundos após o combate, a troca fica protegida.
4. O jogador usa sua Arte Demoníaca.
5. O sistema o revela automaticamente.
6. Após sair de combate e concluir a recarga, ele pode escolher outra identidade.

## 7. Habilidades exclusivas

### 7.1 Regra de propriedade

Cada habilidade aceita um único proprietário persistente por mundo. O índice mundial guarda o ID do personagem, portanto a reserva continua existindo se ele estiver offline ou se o servidor reiniciar. Desativar uma habilidade não libera o proprietário.

Não existe comando comum de transferência ou liberação. Isso evita apropriação acidental e obriga mudanças extraordinárias a passarem por manutenção consciente dos dados e auditoria.

### 7.2 Catálogo e balanceamento inicial

| Chave | Habilidade | Efeito | Fôlego | Stamina | Recarga |
| --- | --- | --- | ---: | ---: | ---: |
| `ruptura` | Ruptura Celestial | Corte direcional, até 3 alvos, dano base 7, alcance 8 | 35 | 16 | 45s |
| `dragao` | Dragão Carmesim | Onda em três pulsos, até 5 alvos, dano base 8, alcance 9 | 48 | 24 | 70s |
| `passo` | Passo Espectral | Deslocamento seguro de até 6 blocos | 24 | 36 | 30s |
| `prisao` | Prisão da Tempestade | Área de lentidão por até 4 segundos | 42 | 22 | 75s |
| `sombras` | Domínio das Sombras | Cegueira frontal em até 4 alvos por 3 segundos | 36 | 18 | 65s |
| `carapaca` | Carapaça Rubra | Redução de 25% do dano recebido por 4 segundos | 30 | 20 | 60s |

Ruptura verifica direção e linha de visão. Dragão distribui pulsos sem acertar repetidamente o mesmo alvo na mesma ativação. Passo procura caminho e piso válidos. Prisão pulsa o controle na área. Sombras usa o efeito nativo de cegueira. Carapaça reduz dano originado por outros seres durante sua duração.

### 7.3 Uso prático pelo jogador

O jogador abre:

`Menu Kimetsu → Personagem Híbrido → Habilidade exclusiva`

Antes de abrir, deve mirar na direção ou no alvo desejado. A tela mostra propriedade, custo, duração e recarga. Ao selecionar **Ativar**, o servidor verifica:

1. se o personagem é Híbrido válido;
2. se a habilidade está atribuída e ativa;
3. se não existe bloqueio de área ou estado;
4. se fôlego e stamina são suficientes;
5. se a recarga terminou;
6. se o destino ou os alvos são válidos.

Quando uma verificação falha, o recurso não deve ser consumido como uma ativação válida. Ao iniciar uma habilidade, o personagem pode ser revelado.

### 7.4 Administração prática

Consultar Híbridos e IDs:

```mcfunction
/scriptevent kny:h_staff hibridos 1
```

Consultar habilidades e proprietários:

```mcfunction
/scriptevent kny:h_staff habilidades
```

Atribuir uma habilidade ao ID `h12`:

```mcfunction
/scriptevent kny:h_staff atribuir ruptura h12
```

Desativar e reativar globalmente uma habilidade:

```mcfunction
/scriptevent kny:h_staff desativar ruptura
/scriptevent kny:h_staff reativar ruptura
```

## 8. Fraqueza solar

### 8.1 Funcionamento teórico

O Híbrido possui avaliação solar própria. A rotina consulta dimensão principal, horário, clima, céu aberto e contato com água. Ela funciona independentemente do disfarce, portanto parecer humano não concede imunidade.

Configuração inicial:

- avaliação a cada 20 ticks;
- período diurno de 0 a 12000;
- dano de referência Oni igual a 1;
- resistência Híbrida de 50% sobre a referência;
- proteção solar legítima reduz parte da exposição, mas não zera o dano;
- regeneração recebe pulso adicional para não anular permanentemente a fraqueza.

Oni comuns continuam usando o comportamento antigo. A v72 evita aplicar simultaneamente os dois mecanismos ao Híbrido.

### 8.2 Funcionamento prático

Durante o dia e com céu aberto, o Híbrido sofre dano mesmo disfarçado de Caçador. Entrar sob teto ou na água interrompe a condição quando a próxima avaliação confirma a proteção. Chuva e dimensão também participam da decisão.

Os números são propostas de balanceamento. Antes de abrir o sistema ao elenco, a Staff deve testar sobrevivência, cura, armaduras e regeneração no servidor real.

## 9. Castelo Infinito e portais

### 9.1 Funcionamento teórico

O addon não inventa coordenadas e não constrói o Castelo Infinito. A Staff registra pontos reais do mundo. O sistema começa indisponível enquanto entrada ou saída estiverem ausentes.

A viagem tem preparação inicial de 100 ticks, equivalente a aproximadamente 5 segundos, e recarga inicial de 120 segundos. Dano, afastamento, morte, desconexão, troca de dimensão ou destino inválido cancelam a preparação. Antes do teletransporte são verificados dimensão, piso, espaço livre e regiões bloqueadas.

Híbridos entram no castelo quando sua identidade pública é Oni ou Revelado. A saída registrada fornece o retorno seguro. Destinos em chunks descarregados dependem da capacidade do servidor de carregá-los.

### 9.2 Configuração prática do castelo

Pelo menu:

1. A Staff entra no Castelo Infinito e fica sobre um ponto seguro.
2. Abre `Menu Kimetsu → Guia → Configurar Castelo Infinito`.
3. Registra **entrada**.
4. Vai ao local seguro de retorno no mundo normal.
5. Registra **saída**.
6. Confere no menu se o castelo aparece configurado.

Comandos equivalentes:

```mcfunction
/scriptevent kny:h_staff castelo entrada
/scriptevent kny:h_staff castelo saida
/scriptevent kny:h_staff castelo tempos 5 120
```

O último comando configura preparação em segundos e recarga em segundos.

### 9.3 Portais de facção

Um portal administrável usa dois pontos reais. Exemplo para uma sede:

```mcfunction
/scriptevent kny:h_staff portal sede entrada
/scriptevent kny:h_staff portal sede saida
/scriptevent kny:h_staff portal sede politica cacador 0 infiltracao
```

A política aceita `cacador`, `oni`, `revelado` ou `hibrido`. O número representa o patamar mínimo da patente verdadeira. `infiltracao` autoriza expressamente o acesso público de Caçador quando essa for a regra narrativa.

### 9.4 Regiões bloqueadas

Para impedir viagens e poderes exclusivos em uma área, a Staff marca dois cantos na mesma dimensão:

```mcfunction
/scriptevent kny:h_staff bloqueio bazar a
/scriptevent kny:h_staff bloqueio bazar b
```

A caixa entre A e B passa a ser considerada região protegida pelo sistema novo. Plugins externos e barreiras físicas ainda precisam de configuração própria.

## 10. Permissões e segurança administrativa

Os comandos usam o evento protegido `kny:h_staff` e validam se o emissor possui permissão de Staff. A conta normal de um jogador não deve conseguir certificar domínio, atribuir poder ou definir coordenadas.

As ações sensíveis registram autor, alvo, momento e dados relevantes. IDs persistentes são usados para reduzir problemas causados por troca de nome ou disfarce. A Staff deve sempre consultar o ID antes de atribuir uma habilidade.

Fluxo recomendado:

1. consultar `/scriptevent kny:h_staff hibridos 1`;
2. confirmar nome e ID do personagem;
3. consultar `/scriptevent kny:h_staff habilidades`;
4. verificar se a habilidade está livre;
5. atribuir usando o ID;
6. pedir ao jogador para conferir no menu particular;
7. guardar a evidência administrativa quando houver certificação histórica.

## 11. Persistência, morte e reconexão

O personagem recebe um ID estável e os dados Híbridos usam registros versionados `kny:h_*`. Propriedade de habilidade, respiração original, arte vinculada, identidade e recargas importantes são separadas dos Stats tradicionais.

Morrer ou reconectar não libera uma habilidade exclusiva. Troca de disfarce não recria o personagem. Uma transformação interrompida pode continuar sem duplicar a dose. O estado temporário de preparação de viagem é encerrado em reinício, enquanto reservas e recargas concluídas permanecem registradas.

Dados incompatíveis suspendem autorizações novas e exigem revisão da Staff. Essa proteção evita que um registro parcialmente corrompido conceda poderes por engano.

## 12. Compatibilidade com sistemas anteriores

A v72 conserva:

- sistema de Stats e 27 faixas da v70;
- menus e ativação dos livros da v71;
- inventários e placares já gravados;
- formas tradicionais liberadas;
- progressão Oni comum;
- antídoto de Oni comum;
- reviver, morte, respawn e troca de dimensão;
- comportamento ambiental tradicional de Onis não Híbridos;
- UUIDs dos packs, atualizando a versão interna para `1.0.54`.

Na primeira inicialização, sangue, honra e maldição usam adição de zero em vez de redefinição. Assim, valores existentes não devem ser apagados.

## 13. Instalação prática no PC

Requisitos:

- Minecraft Bedrock para Windows compatível com os packs;
- Behavior Pack e Resource Pack da mesma v72;
- APIs Beta/recursos experimentais necessários ativados;
- cópia de segurança do mundo antes da atualização.

Procedimento:

1. Feche o mundo.
2. Faça backup do mundo e dos packs atuais.
3. Remova duplicatas antigas dos mesmos packs do dispositivo, se o Minecraft mostrar mais de uma cópia.
4. Abra `Kimetsu_Fix_v72_Completo.mcaddon`.
5. Aguarde a importação do Behavior Pack e do Resource Pack.
6. Nas configurações do mundo, ative os dois packs.
7. Ative APIs Beta e opções experimentais exigidas.
8. Entre primeiro com uma conta de Staff.
9. Confira o menu, os registros Híbridos e a versão `1.0.54`.
10. Configure castelo, portais e regiões antes de liberar a atualização aos jogadores.

Em servidor dedicado, as dependências do mundo devem apontar para a versão `[1, 0, 54]` dos dois packs.

## 14. Roteiro de homologação no servidor real

### 14.1 Teste de domínio

1. Criar ou selecionar um Caçador de teste.
2. Ensinar uma respiração inteira na ordem.
3. Confirmar cada aula no menu.
4. Tentar ensinar forma fora da ordem e confirmar o bloqueio.
5. Validar a escolha da original quando houver dois domínios completos.

### 14.2 Teste de transformação

1. Fazer backup do personagem.
2. Transformá-lo pela rota oficial do servidor.
3. Confirmar raça Híbrida, patente Oni inicial e Stats preservados.
4. Reiniciar durante uma transformação controlada em mundo de teste.
5. Confirmar retomada sem dose duplicada.

### 14.3 Teste de técnicas

1. Usar a respiração original com item correto.
2. Tentar outra respiração e confirmar o bloqueio.
3. Usar a arte vinculada.
4. Tentar outra arte e confirmar o bloqueio.
5. Conferir consumo de fôlego e dano com Stats.

### 14.4 Teste de identidade

1. Alternar entre Caçador, Oni e Revelado fora de combate.
2. Conferir nome, marca e reação dos NPCs.
3. Receber dano e tentar trocar antes de 10 segundos.
4. Usar arte disfarçado de Caçador.
5. Confirmar a revelação automática.

### 14.5 Teste de sol

1. Ficar sob céu aberto durante o dia.
2. Medir dano com e sem regeneração.
3. Entrar sob teto.
4. Entrar na água.
5. Repetir durante chuva e com proteção solar legítima.
6. Ajustar os valores somente depois de registrar os resultados.

### 14.6 Teste de castelo e poderes

1. Definir entrada e saída reais.
2. Testar cancelamento por dano e afastamento.
3. Testar ida, volta, morte e reconexão.
4. Atribuir cada poder em personagens de teste diferentes.
5. Confirmar custos, recargas, paredes, alvos e regiões bloqueadas.
6. Reiniciar o servidor e confirmar que os proprietários continuam reservados.

## 15. Testes já realizados

Foram aprovados 26 testes Node.js: os 16 casos anteriores de Stats/menu e 10 casos Híbridos. Eles cobrem domínio, professor e aluno, escolha da respiração, recuperação da transformação, seis poderes, exclusividade, recargas, famílias, sol e portais simulados.

No Bedrock Dedicated Server 1.26.66.1, jogadores simulados confirmaram:

- aulas e transformação pelo sangue;
- Água autorizada e Trovão bloqueado;
- Enmu autorizado e Biwa bloqueada;
- revelação por uso incompatível;
- Carapaça;
- dano solar e proteção sob teto;
- ida e volta em castelo de teste;
- persistência do proprietário após reinício;
- regressão de Stats, menu, morte, respawn e reviver.

## 16. Limitações e pendências reais

As seguintes partes ainda precisam de homologação no ambiente final:

- castelo com a construção e coordenadas reais;
- aparência completa das marcas em clientes reais;
- perseguição de todas as variantes de NPC;
- áudio e partículas em diferentes configurações gráficas;
- matriz completa de respirações e artes;
- PvP simultâneo e várias reconexões de contas reais;
- equilíbrio definitivo de sol, cura, custos e recargas;
- comportamento em Realms, caso ele seja usado.

O log do projeto original também contém avisos herdados, como referências de animação e componentes antigos. Eles não são apresentados como correções completas da v72. A proteção solar Híbrida foi implementada em uma rotina própria para evitar dependência desses avisos anteriores.

## 17. Arquivos e parâmetros principais

Os valores ajustáveis ficam em:

`codigo-v70/Kimetsu Fix Be/scripts/hybrid_config.js`

Módulos principais:

- `hybrid_mastery.js`: aulas, domínio e certificação;
- `hybrid_system.js`: transformação, autorização e identidade;
- `hybrid_records.js`: persistência e IDs;
- `hybrid_abilities.js`: habilidades exclusivas;
- `hybrid_sun.js`: exposição solar;
- `hybrid_locations.js`: castelo, portais e bloqueios;
- `hybrid_admin.js`: comandos protegidos da Staff;
- `menu.js`: telas usadas por jogadores, líderes e Staff.

Alterar o catálogo, códigos ou ordem de técnicas exige regenerar os controladores usando o script de ajuste incluído no repositório e repetir a suíte de testes.

## 18. Resumo operacional

Na teoria, a v72 transforma o Híbrido em uma raça persistente com progressão Oni, uma respiração humana comprovada, uma Arte Demoníaca vinculada, identidade pública independente e uma habilidade exclusiva de proprietário único.

Na prática, o jogador aprende a respiração pelo menu, transforma-se pela rota oficial, usa somente a respiração e a arte autorizadas, administra o disfarce e ativa o poder exclusivo pelo menu. A Staff valida históricos, atribui poderes, configura castelo e portais e homologa o balanceamento no mundo real.

O sistema está implementado e passou pelas rotas automatizadas descritas. A publicação definitiva para o elenco deve acontecer depois da homologação visual, do teste multiplayer e da configuração das coordenadas reais do servidor.
