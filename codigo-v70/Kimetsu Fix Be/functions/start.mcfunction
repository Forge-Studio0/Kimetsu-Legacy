gamerule falldamage false
gamerule showtags false
gamerule sendcommandfeedback false

scoreboard objectives add bloodmoon dummy
scoreboard objectives add health dummy
scoreboard objectives add flame dummy
scoreboard objectives add wind dummy
scoreboard objectives add water dummy
scoreboard objectives add mist dummy
scoreboard objectives add sun dummy
scoreboard objectives add moon dummy
scoreboard objectives add thunder dummy
scoreboard objectives add rengoku dummy
scoreboard objectives add tanjiro dummy
scoreboard objectives add zenitsu dummy
scoreboard objectives add kaigaku dummy
scoreboard objectives add tomioka dummy
scoreboard objectives add sanemi dummy
scoreboard objectives add uzui dummy
scoreboard objectives add kokushibo dummy
scoreboard objectives add kokushibo2 dummy
scoreboard objectives add muichiro dummy
scoreboard objectives add mitsuri dummy
scoreboard objectives add yoriichi dummy
scoreboard objectives add shinobu dummy
scoreboard objectives add inosuke dummy
scoreboard objectives add gyomei dummy
scoreboard objectives add enmu dummy
scoreboard objectives add akaza dummy
scoreboard objectives add gyutaro dummy
scoreboard objectives add gyokko dummy
scoreboard objectives add zohakuten dummy
scoreboard objectives add yahaba dummy
scoreboard objectives add hairo dummy
scoreboard objectives add doma dummy
scoreboard objectives add obanai dummy
scoreboard objectives add demonking dummy
scoreboard objectives add skills dummy
scoreboard objectives add cooldown dummy
scoreboard objectives add upslayer dummy
scoreboard objectives add updemon dummy
scoreboard objectives add blood dummy
scoreboard objectives add damage dummy
scoreboard objectives add killer dummy
scoreboard objectives add breath dummy
scoreboard objectives add wolf_body dummy
scoreboard objectives add archieviments dummy
scoreboard objectives add death dummy
scoreboard objectives add flower dummy
scoreboard objectives add biwa dummy

# Inicialização básica

scoreboard players set @e[tag=!placa] bloodmoon 0
scoreboard players set @e[tag=!placa] flame 1
scoreboard players set @e[tag=!placa] wind 1
scoreboard players set @e[tag=!placa] water 1
scoreboard players set @e[tag=!placa] mist 1
scoreboard players set @e[tag=!placa] sun 1
scoreboard players set @e[tag=!placa] moon 1
scoreboard players set @e[tag=!placa] thunder 1
scoreboard players set @e[tag=!placa] rengoku 1
scoreboard players set @e[tag=!placa] zenitsu 1
scoreboard players set @e[tag=!placa] kaigaku 1
scoreboard players set @e[tag=!placa] tomioka 1
scoreboard players set @e[tag=!placa] sanemi 1
scoreboard players set @e[tag=!placa] uzui 1
scoreboard players set @e[tag=!placa] tanjiro 1
scoreboard players set @e[tag=!placa] kokushibo 1
scoreboard players set @e[tag=!placa] kokushibo2 1
scoreboard players set @e[tag=!placa] muichiro 1
scoreboard players set @e[tag=!placa] mitsuri 1
scoreboard players set @e[tag=!placa] yoriichi 1
scoreboard players set @e[tag=!placa] shinobu 1
scoreboard players set @e[tag=!placa] inosuke 1
scoreboard players set @e[tag=!placa] gyomei 1
scoreboard players set @e[tag=!placa] enmu 1
scoreboard players set @e[tag=!placa] gyokko 1
scoreboard players set @e[tag=!placa] akaza 1
scoreboard players set @e[tag=!placa] gyutaro 1
scoreboard players set @e[tag=!placa] zohakuten 1
scoreboard players set @e[tag=!placa] yahaba 1
scoreboard players set @e[tag=!placa] hairo 1
scoreboard players set @e[tag=!placa] doma 1
scoreboard players set @e[tag=!placa] obanai 1
scoreboard players set @e[tag=!placa] demonking 1
scoreboard players set @s[tag=!placa] cooldown 0
scoreboard players add @s[tag=!placa] upslayer 0
scoreboard players add @s[tag=!placa] updemon 0
scoreboard players add @s[tag=!placa] blood 0
scoreboard players set @s[tag=!placa] damage 0
scoreboard players set @s[tag=!placa] killer 0
scoreboard players set @s[tag=!placa] breath 0
scoreboard players set @s[tag=!placa] wolf_body 0
scoreboard players set @s[tag=!placa] archieviments 0
scoreboard players set @s[tag=!placa] death 1
scoreboard players set @s[tag=!placa] flower 1
scoreboard players set @s[tag=!placa] biwa 1

effect @s[tag=demon] night_vision 15 3 true

tag @s add placa

# Objetivos de vida
scoreboard objectives add h dummy
scoreboard objectives add hh dummy
scoreboard objectives add hmax dummy
scoreboard objectives add h80 dummy

# Atualização do HP inicial apenas se ainda não estiver setado
execute if entity @s[tag=!hp-setado] run scoreboard players operation @s hh = @s h
execute if entity @s[tag=!hp-setado] run scoreboard players operation @s hh *= @s h80
execute if entity @s[tag=!hp-setado] run scoreboard players operation @s hh /= @s hmax
execute if entity @s[tag=!hp-setado] run tag @s add hp-setado

# Inicializa
function inicio

# cooldown

execute as @s[tag=mark_active] run enchant @s sharpness 3

scoreboard players add @s[scores={cooldown=1..5}] cooldown 1
scoreboard players set @s[scores={cooldown=6}] cooldown 0
