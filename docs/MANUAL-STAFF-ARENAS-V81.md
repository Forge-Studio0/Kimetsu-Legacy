# Operação de arenas da v81

A Staff configura regiões na dimensão de missões `kny:missoes`. As permissões seguem o operador do mundo ou a tag administrativa `kny_op` usada pelo addon. A área de missões fica separada do estúdio de aparência e do mundo aberto.

## Cadastrar um palco

1. Use **Menu Kimetsu → Missões → Administração de arenas → Criar arena**. Dê um ID curto, com letras minúsculas, números ou sublinhado, e um nome.
2. Registre a **saída** em um ponto com piso firme e espaço para dois blocos no mundo principal ou em outra dimensão externa. Esse ponto é o retorno alternativo.
3. Acesse **Ir à oficina**. Digite as coordenadas escolhidas pela Staff e use voo criativo para chegar a um local sem piso. O comando equivalente é `/scriptevent kny:missoes oficina X Y Z`. Prepare a construção correspondente ao desafio.
4. Marque os **cantos A e B** nas posições que delimitam a região. A largura e o comprimento podem ir de 8 a 48 blocos. A altura vai de 4 a 48 blocos. Mantenha uma separação de pelo menos 64 blocos na horizontal em relação às outras arenas.
5. Registre uma **entrada** por vaga. Coloque os **spawns** em blocos distintos no interior da arena, com piso firme e espaço acima. O cartão de confirmação indica quantos inimigos podem estar presentes ao mesmo tempo no tamanho de grupo escolhido.
6. Para localização ou proteção, registre o **ponto do objetivo** no palco. Associe por ID cada missão que usa aquela construção. Exemplos de IDs incluem `sagiri`, `natagumo`, `rui` e `enmu`.
7. No menu **Capacidade e tipos**, defina vagas, ranks, tipos e, se quiser, a lista de missões autorizadas. Confira o resultado e selecione **Ativar arena**. Saia da oficina para liberar a região. Use **Sair da oficina** ou `/scriptevent kny:missoes sair`.

Para controlar o acesso por conteúdo, use uma arena apta a cada objetivo. Sagiri e Natagumo exigem destinos próprios conforme a construção local. Rui precisa de um posto para Tanjiro. Enmu precisa de um posto para Rengoku. O ponto de spawn de cada inimigo deve deixar espaço suficiente para o modelo e para as habilidades do NPC.

[Catálogo de IDs e requisitos](CATALOGO-MISSOES-V81.md)

## Manutenção

O quadro administrativo mostra se uma arena está desativada, disponível ou ocupada e lista os participantes de uma sessão. Para reparos, encerre a sessão pelo painel e aguarde a limpeza. O encerramento da Staff cancela o desafio e conserva o retorno dos jogadores. As funções administrativas registram a mudança e o operador.

A reserva é exclusiva. A addon verifica as posições, a capacidade e o espaço livre na entrada. Dentro de sessões ativas, a addon bloqueia alterações de blocos e a interferência de jogadores externos. Em arenas de elite, mantenha barreiras físicas, cobertura e distância de spawns adequadas ao NPC. Os grupos, convites e a arena atual podem ser consultados durante a partida pelo **Quadro de Missões**.

O servidor tenta a origem do jogador antes da saída alternativa. Se ambas ficarem obstruídas, libere o espaço para que o retorno pendente ocorra. Se a Staff alterar a configuração de uma arena fora da sessão, a edição volta a desativá-la até uma nova confirmação. Se um cliente estiver preso na oficina administrativa com o ponto de origem obstruído, libere a origem ou use as ferramentas de administração do mundo.
