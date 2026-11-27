# Manual da Staff para a oficina v76

Execute os comandos no chat, com um jogador reconhecido pelo controle administrativo existente do Kimetsu. O alvo deve estar online. Use o gamertag exato entre aspas quando houver espaços.

| Operação | Comando | Efeito |
| --- | --- | --- |
| Examinar ficha | `/scriptevent kny:aparencia consultar "Nome do Jogador"` | Mostra os perfis e as autorizações à pessoa da Staff que executou. |
| Autorizar nome de RP | `/scriptevent kny:aparencia autorizar_nome "Nome do Jogador" sim` | Libera nome e sobrenome em **Informações**. |
| Bloquear edição do nome | `/scriptevent kny:aparencia autorizar_nome "Nome do Jogador" nao` | Fecha a edição ativa e bloqueia as próximas alterações de nome. |
| Conceder cosmético reservado | `/scriptevent kny:aparencia conceder "Nome do Jogador" adorno_festival` | Libera o ornamento de festival na ficha. |
| Revogar concessão | `/scriptevent kny:aparencia revogar "Nome do Jogador" adorno_festival` | Oculta a variante no visual e impede novas seleções para esse jogador. |
| Desativar variante no mundo | `/scriptevent kny:aparencia desativar haori_ondas` | Fecha sessões abertas e atualiza a exibição das fichas. |
| Reativar variante | `/scriptevent kny:aparencia ativar haori_ondas` | Volta a oferecer a variante e reaplica as escolhas elegíveis. |
| Encerrar oficina | `/scriptevent kny:aparencia fechar "Nome do Jogador"` | Descarta o rascunho e restaura a câmera. |
| Restaurar visual padrão | `/scriptevent kny:aparencia resetar "Nome do Jogador"` | Limpa os perfis salvos e o nome de RP da ficha. Mantém autorizações e concessões existentes. |

**Exemplo de atendimento.** Se o jogador pedir o ornamento de festival, use **conceder** e peça que reabra a oficina em **Acessórios**. Se uma peça recém-publicada estiver com encaixe ruim, use **desativar** com o ID do catálogo até corrigir o modelo. A ficha conserva o ID salvo para reaplicar a variante ao reativá-la.

**Sessão interrompida.** Use **fechar** se o jogador ainda estiver com o editor ativo. A câmera também é restaurada no fechamento da tela, no dano e quando o personagem carrega novamente após uma desconexão. O modo clássico oferece os mesmos ajustes básicos se a oficina estilizada não abrir.

## Atualizar o servidor

Instale os dois pacotes 1.0.58 com os UUIDs da v75. No servidor dedicado, atualize as versões em `world_behavior_packs.json` e `world_resource_packs.json` do mundo correspondente. No Bedrock para PC, basta importar o `.mcaddon` completo e selecionar os dois pacotes nas configurações do mundo. O [relatório da v76](RELATORIO-CUSTOMIZACAO-V76.md) explica o fluxo e a interação com disfarces.
