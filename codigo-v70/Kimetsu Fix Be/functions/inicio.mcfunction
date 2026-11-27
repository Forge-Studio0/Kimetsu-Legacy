scoreboard players set @s[tag=!start] expbase 200
scoreboard players set @s[tag=!start] health 20

scoreboard players set @s[tag=!start] hmax 80
scoreboard players set @s[tag=!start] h 80
scoreboard players set @s[tag=!start] h80 80

give @s[tag=!start] kny:menu_kimetsu 1 0 {"item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}
event entity @s[tag=!start] pamobile:refresh_player

tag @s[tag=!start] add kny_aparencia_novo
execute if entity @s[tag=!start] run scriptevent kny:aparencia_inicial primeiro
tag @s[tag=!start] add start
