execute if entity @s[tag=kny_hybrid] run tellraw @s {"rawtext":[{"text":"§cEste antídoto não altera a linhagem Híbrida."}]}
execute if entity @s[tag=!kny_hybrid] run playsound drink @a[r=5]
execute as @s[tag=demon,tag=!kny_hybrid] at @s run event entity @s kny:reset
execute as @s[tag=demon,tag=!kny_hybrid] at @s run event entity @s burn_daylight_off
tag @s[tag=demon,tag=!kny_hybrid] remove muzan_curse
tag @s[tag=demon,tag=!kny_hybrid] remove demon
execute if entity @s[tag=!kny_hybrid] run scriptevent kny:h_curado antidoto

clear @s[tag=!kny_hybrid] kny:cure 0 1
