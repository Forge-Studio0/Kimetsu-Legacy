playsound drink @a[r=5]
execute as @s[tag=!demon] at @s run say atingiu a meta §2[Demon]
execute as @s[tag=!demon] at @s run playsound challenge_complete @s
execute as @s[tag=!demon] at @s run event entity @s kny:reset
execute as @s[tag=!demon] at @s run event entity @s kny:demon_family
execute as @s[tag=!demon] at @s run event entity @s burn_daylight_on
tag @s[tag=!demon] remove slayer
tag @s[tag=!demon] remove mizunoto
tag @s[tag=!demon] remove mizunoe
tag @s[tag=!demon] remove kanoto
tag @s[tag=!demon] remove kanoe
tag @s[tag=!demon] remove tsuchinoto
tag @s[tag=!demon] remove tsuchinoe
tag @s[tag=!demon] remove hinoto
tag @s[tag=!demon] remove hinoe
tag @s[tag=!demon] remove kinoto
tag @s[tag=!demon] remove kinoe
tag @s[tag=!demon] remove hashira
tag @s[tag=!demon] remove hashira_lider
tag @s[tag=!demon] add muzan_curse
tag @s[tag=!demon] add demon

scoreboard players add @s[tag=demon] blood 1
scriptevent kny:stats_atualizar sangue

clear @s kny:blood 0 1