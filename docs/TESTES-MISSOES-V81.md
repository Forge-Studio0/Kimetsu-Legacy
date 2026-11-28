# Validação da v81

## Testes automatizados

Os **69 testes de Node.js passaram**. A suíte inclui regressões de Stats, habilidades, transformação, aparência, estúdio, Guia e menus. Os testes novos cobrem patente por facção, titularidade do Líder, cancelamento, reaproveitamento de progresso, validação de arena, convites, divisão de prêmios e recuperação de um placar que falhou durante o pagamento. Os testes que exercitavam aulas presenciais foram ajustados para seguir a atribuição e o desbloqueio automático.

Para executar a suíte a partir do repositório, extraia o addon v81 e informe as pastas dos dois pacotes.

```bash
destino="$(mktemp -d)"
unzip -q Kimetsu_Fix_v81_Completo.mcaddon -d "$destino"
KIMETSU_BP="$destino/Kimetsu Fix Be" KIMETSU_RP="$destino/Kimetsu Fix Re" \
  node --test codigo-v70/testes/*.test.mjs
```

## Validação no Bedrock

O Behavior Pack e o Resource Pack 1.0.63 foram carregados em **Bedrock Dedicated Server 1.26.66.1**. Os cenários de teste usam jogadores simulados do GameTest em mundos locais. As dependências do GameTest e as arenas temporárias ficaram fora dos pacotes de entrega.

| Cenário | Resultado observado |
| --- | --- |
| Caçador individual | Três Onis da Ronda gerados depois da preparação. Uma tentativa concorrente recebeu ocupado. Dano de fora deixou a vida do NPC igual. Prêmio, limpeza e retorno conferidos. |
| Aprendizado em paralelo | Com a Água ativa e o Líder offline, três abates na arena completaram a primeira forma. |
| Grupo | Três jogadores aceitaram participar, o grupo enfrentou dois reforços, os dois combatentes dividiram um prêmio fixo e o integrante inativo ficou sem prêmio. |
| Localização | Sagiri completou ao alcançar o ponto. O novo início da campanha foi bloqueado após a vitória registrada. |
| NPCs do catálogo | Todas as entidades configuradas foram geradas com vida e perfil de missão. O teste encontrou a duplicação do ID de Rengoku com Jigoro, corrigida e revalidada. |
| Ondas e facções | Oni derrotou espadachins em duas ondas. Híbrido disfarçado de Caçador recebeu acesso ao catálogo Híbrido. Ambos receberam maldição. |
| Proteção e sobrevivência | A perda de Tanjiro encerrou o desafio sem pagamento. O cenário de sobrevivência exigiu duas ondas e o tempo mínimo. |
| Reinício | Sessão em combate foi cancelada após reiniciar o servidor. A arena foi limpa e o retorno do jogador offline permaneceu pendente sem prêmio. |
| Treinamento | O motor mediu corrida, pulo e natação. O teste usou abate, dummy e flexão pelo menu com Defesa no teto, em missões distintas. |
| Transformação Híbrida | Dez atribuições pelo menu do Líder liberaram a Água e produziram um Híbrido com uma dose. Também passaram escolha entre domínios, antídoto e recuperação de ficha antiga. |
| Entrada e estúdio | Retorno da dimensão de estúdio, inventário cheio, item de menu único e aparências de jogadores simulados passaram. |

Os cenários ficam em `codigo-v70/testes`. Para preparar uma cópia de teste, use um mundo GameTest com Beta APIs, adicione `@minecraft/server-gametest` versão `1.0.0-beta` ao manifest **da cópia**, ponha o cenário em `scripts` e importe-o no fim de `main.js`. `bedrock-missoes.js` deixa um ponto de controle para executar a fase de reinício no mesmo mundo. A fase adicional de facções usa um mundo novo e a propriedade de teste `kny:test_v81_faccoes` ativada.

## Limites da validação

- A renderização no cliente de PC, os tamanhos de fonte em telas menores e as capturas reais das interfaces ficam pendentes. As ações de menu foram exercitadas pelo código de formulário e pelos botões do servidor.
- Os testes de combate usam dano controlado. As fases dos chefes, as técnicas de cada respiração ou Kekkijutsu em todos os palcos, as desconexões nos diferentes momentos do resgate e o balanceamento com grupos reais ainda precisam de partidas nas construções da Staff.
- O Content Log ainda contém mensagens legadas do addon, como referências a animações antigas. A repetição do teste de facções após limpar dashes de entidades removidas terminou sem a exceção reproduzida nesse fluxo.
- O histórico de aprendizado de quem está offline mostra a atribuição e o estado. Os contadores completos podem ser consultados quando o personagem voltar. A seção de recuperação de pagamento foi simulada com falha entre gravações de placar. O teste de reinicialização real cobriu a sessão interrompida em combate.
- As proteções operam sobre o código do addon e a dimensão reservada. Outras extensões com permissão para mover jogadores, criar entidades ou editar diretamente placares precisam respeitar as reservas do servidor.

## Integridade dos downloads

Os três arquivos passaram pela verificação de ZIP. Os dois pacotes separados têm o mesmo conteúdo que as respectivas pastas do addon completo. Os conteúdos da v80 fora dos arquivos modificados foram comparados byte a byte. Os UUIDs de ambos os pacotes foram conferidos junto das dependências internas.

`SHA-256`

```text
2a31c9c18546032b5290fddb95c09e8088e67fe232943de7fd25fc44dead18b7  Kimetsu_Fix_v81_Completo.mcaddon
943f68ae3fa46742c38d9c509c88deb65c3560a0a0e69a85d876ce14f5d951f9  Kimetsu_Fix_v81_BP.mcpack
17f64c76f3e6c6b7bb00053b60addc6089df962a1d369df8fb76b819ed91ec5a  Kimetsu_Fix_v81_RP.mcpack
```
