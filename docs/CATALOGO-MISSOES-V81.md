# Catálogo de missões da v81

Rank D a S indica a escala de dificuldade do servidor. As patentes são as do addon. A coluna de recompensas mostra o total por sessão, antes de dividir pelo grupo e antes do bônus de Stats por honra ou maldição.

| Rank | Nível | Caçador mínimo | Oni mínimo | Híbrido mínimo | Stats | Honra ou maldição | Dinheiro |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| D | Iniciante | Mizunoto | Oni comum | Híbrido Superior | 500 | 5 | 100 |
| C | Intermediária | Kanoto | Lua Inferior 6 | Híbrido Superior | 1500 | 10 | 250 |
| B | Avançada | Tsuchinoe | Lua Inferior 4 | Híbrido Superior | 5000 | 20 | 500 |
| A | Elite | Hinoe | Lua Inferior 1 | Híbrido Superior | 15000 | 40 | 1500 |
| S | Especial | Hashira | Lua Superior 6 | Híbrido Superior | 50000 | 75 | 5000 |

Na configuração inicial, os desafios de Híbridos usam ranks B, A e S. As missões principais, as de elite e as caçadas são independentes, salvo quando uma etapa anterior é exigida. O prazo de 20 minutos se aplica à repetição de caçadas após uma vitória. Fracassos após o início aplicam 120 segundos de carência.

## Caçadores

| ID e missão | Categoria | Rank · antecedente | Objetivo e NPCs | Grupo máximo · spawns no máximo | Limite |
| --- | --- | --- | --- | --- | ---: |
| `sagiri` · Montanha Sagiri | Missões principais | D | Localização · marco cadastrado | 1 · 0 | 3 min |
| `sabito` · Duelo com Sabito | Missões principais | D · `sagiri` | Chefe · sabito | 1 · 1 | 6 min |
| `selecao` · Seleção Final · Demônio das Mãos | Missões principais | C · `sabito` | Chefe · hand_demon + reforços | 4 · 4 | 6 min |
| `natagumo` · Chegada à Montanha Natagumo | Missões principais | B · `selecao` | Localização · marco cadastrado | 1 · 0 | 3 min |
| `rui` · Proteja Tanjiro de Rui | Missões principais | B · `natagumo` | Proteção · rui + reforços · protege tanjiro | 4 · 4 | 6 min |
| `enmu` · Proteja Rengoku no Trem Infinito | Missões principais | A · `rui` | Proteção · hebidemon, tongue_demon / enmu + reforços · protege rengoku | 4 · 4 | 9 min |
| `akaza` · Confronto com Akaza | Missões principais | S · `enmu` | Chefe · akaza + reforços | 4 · 4 | 12 min |
| `ronda` · Ronda dos Caçadores | Caçadas | D | Abates · demon, demon, tongue_demon + reforços | 4 · 6 | 6 min |
| `selecao_noite` · Noite da Seleção | Caçadas | C | Sobrevivência · demon, tongue_demon, tsunodemon + reforços / hebidemon, tsunodemon · 75 s mínimos | 4 · 6 | 6 min |
| `patrulha_lua` · O covil de Kamanue | Caçadas | B | Ondas · hebidemon, tongue_demon + reforços / kamanue | 4 · 5 | 6 min |
| `duelo_agua` · Duelo de elite · Tomioka | Missões de elite | A | Chefe · tomioka | 1 · 1 | 6 min |
| `distrito` · Distrito do Entretenimento · Gyutaro | Missões de elite | S · `enmu` | Chefe · gyutaro + reforços | 4 · 4 | 10 min |
| `castelo_lua` · Castelo Infinito · Kokushibo | Missões de elite | S · `akaza` | Chefe · demon, hebidemon + reforços / kokushibo + reforços | 4 · 5 | 15 min |

## Onis

| ID e missão | Categoria | Rank · antecedente | Objetivo e NPCs | Grupo máximo · spawns no máximo | Limite |
| --- | --- | --- | --- | --- | ---: |
| `oni_espadachim` · Ronda do Oni | Caçadas | D | Abates · slayer, slayer + reforços | 4 · 5 | 6 min |
| `oni_emboscada` · Emboscada de Espadachins | Missões principais | C | Ondas · slayer, slayer + reforços / slayer, slayer, slayer | 4 · 5 | 6 min |
| `oni_sabito` · Desafio de Sabito | Caçadas | B | Chefe · sabito + reforços | 4 · 4 | 6 min |
| `oni_novo_hashira` · Provação · Shinobu | Missões de elite | A | Chefe · shinobu + reforços | 4 · 4 | 6 min |
| `oni_chamas` · Provação · Rengoku | Missões de elite | S · `oni_novo_hashira` | Chefe · slayer, slayer / rengoku + reforços | 4 · 4 | 10 min |

## Híbridos

| ID e missão | Categoria | Rank · antecedente | Objetivo e NPCs | Grupo máximo · spawns no máximo | Limite |
| --- | --- | --- | --- | --- | ---: |
| `hibrido_demonios` · Entre dois mundos · Caçada | Caçadas | B | Ondas · demon, tongue_demon + reforços / hebidemon, tsunodemon | 4 · 5 | 6 min |
| `hibrido_nevoa` · Entre dois mundos · Muichiro | Missões principais | A | Chefe · muichiro + reforços | 4 · 4 | 6 min |
| `hibrido_lua` · Entre dois mundos · Lua Superior 1 | Missões de elite | S · `hibrido_nevoa` | Chefe · slayer, slayer + reforços / kokushibo + reforços | 4 · 5 | 15 min |
