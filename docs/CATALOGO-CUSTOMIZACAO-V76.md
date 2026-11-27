# Catálogo de aparência do Kimetsu Legacy v76

Cada seletor oferece uma opção padrão que preserva a camada correspondente do avatar. Os totais abaixo contam as variantes próprias da oficina.

| Categoria | Variantes iniciais | Disponibilidade |
| --- | --- | --- |
| Informações | Nome e sobrenome na ficha | Edição autorizada por Staff |
| Aparência | 7 tons de rosto e 4 expressões | Todas as raças |
| Cabelo | 8 cortes, 10 cores principais e 10 cores de mecha | Todas as raças |
| Rosto | 4 formatos de olho, 10 cores por íris e 5 cicatrizes ou detalhes faciais | Todas as raças |
| Vestimentas | 8 conjuntos e 10 cores de tecido | Todas as raças |
| Acessórios | 3 adornos de cabeça, 2 máscaras e 2 tipos de brinco | Ornamento do festival por concessão |
| Traços Oni | Presas, chifres curtos, chifre lateral, pupilas fendidas e traços de tinta | Oni e perfis **Oni** ou **Forma verdadeira** de Híbridos |
| Identidades | Caçador, Oni e Forma verdadeira | Híbridos legítimos |
| Conjuntos | 6 predefinições | Oni da penumbra nos perfis aptos a traços Oni |

Modelos de cabelo incluem Curto repartido, Franja lateral, Ondas médias, Longo aberto, Coque alto, Rabo baixo, Espetado e Duas tranças. Em vestimentas há Haori de viagem, Haori de ondas, Kimono de faixa, Manto de inverno, Kosode simples, Hakama cerimonial, Haori de folhas e Camisa de viajante.

## Ampliar o catálogo

1. Abra o [catálogo do Behavior Pack](../codigo-v70/Kimetsu%20Fix%20Be/scripts/character_config.js). Em `CAMPOS`, adicione a opção ao seletor apropriado com o ID ASCII estável, o nome em português e um código livre no intervalo de 0 a 15. O código 0 corresponde ao padrão. Pelas fichas existentes, preserve o ID e o código das opções publicadas.
2. Dê à opção o recurso correspondente no [gerador](../gerar-aparencia-v76.mjs). As listas de variantes em arrays de renderização são indexadas pelos códigos. Posicione o novo modelo ou cor no índice escolhido. Modelos com opção padrão invisível reservam o índice 0 e passam a renderizar com o índice 1. Para uma cor, informe também seu valor hexadecimal para gerar a amostra. Use as variantes vizinhas do mesmo campo como referência.
3. Para acessórios de evento, adicione `concessao: true`. A Staff pode liberar a opção pelo ID. Para um novo traço Oni, use o seletor `demonio` e preserve o controle de perfis. As regras de encaixe entre chifres e adornos ficam em `limparVisual` no Behavior Pack. As prioridades de equipamento ficam nos render controllers gerados.
4. Rode `node gerar-aparencia-v76.mjs` na raiz do repositório. Confira os PNGs, o arquivo `oficina.geo.json`, os aliases do jogador e o render controller gerado. Para alterar a forma de exibição, edite [a interface da oficina](../codigo-v70/Kimetsu%20Fix%20Re/ui/character_customization.json).
5. Teste o recurso com a versão completa dos dois packs e com uma ficha antiga. Confira variantes vizinhas, equipamento, animação e os três perfis Híbridos. Escolher um cosmético, salvar e reabrir deve recuperar o mesmo ID. Troque o ângulo e o enquadramento para conferir o encaixe.

Há até seis seletores em cada propriedade compactada para respeitar a precisão de inteiros usados no cliente. Ao esgotar os 16 códigos de um campo, planeje um novo canal com compatibilidade de versão e valide o limite de propriedades do jogador. Para retirar temporariamente um cosmético carregado no catálogo, use **desativar**. Reativá-lo volta a permitir sua exibição em fichas nas quais ele já estava salvo.

Os modelos e texturas gerados estão no [Resource Pack de origem](../codigo-v70/Kimetsu%20Fix%20Re/). Os IDs, rótulos, paletas, ícones das categorias e predefinições estão no [catálogo completo](../codigo-v70/Kimetsu%20Fix%20Be/scripts/character_config.js).
