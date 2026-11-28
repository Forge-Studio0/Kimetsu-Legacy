# Kimetsu Legacy v83 · Identificação dos pacotes

## Na prática

Depois de importar o addon v83, procure **Kimetsu Survival Craft Be v83** em **Pacotes de comportamento** e **Kimetsu Survival Craft Re v83** em **Pacotes de recursos** nas configurações do mundo. O sufixo identifica os dois pacotes da mesma versão.

## Na teoria

O Bedrock usa o campo `header.name` de cada manifest para exibir o nome. A versão interna **1.0.65** permite que o jogo reconheça a atualização da v82 já importada. Os UUIDs mantêm a identidade dos pacotes no mundo. As dependências dos dois manifests e a versão do HUD acompanham a atualização.

## Validação

Os **70 testes automatizados passaram**. O Bedrock Dedicated Server carregou o pacote de comportamento com o nome v83. O arquivo completo passou pela verificação de integridade. A comparação com a v82 encontrou apenas os dois manifests e as duas indicações de versão do HUD entre os arquivos alterados.
