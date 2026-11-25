import { kcmd } from "./compat.js";
import * as mc from "@minecraft/server";
import * as hash from "./hash.js";
import { agendarStats } from "./stats.js";

// Rank 1 — Mizunoe (100)
mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("mizunoe")) continue;
    if (player.hasTag("demon")) continue;

    const up = hash.getScore(player, "upslayer");

    if (up >= 100) {
      kcmd(player, `say atingiu a meta §2[Mizunoe]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.003.slideshow_0.textures/icons/nichirin_water"}]}`);
      player.addTag("mizunoe");
      player.addTag("mizunoe2");
      agendarStats(player);
    }
  }
}, 5);

// Rank 2 — Kanoto (200)
mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("kanoto")) continue;
    if (player.hasTag("demon")) continue;

    const up = hash.getScore(player, "upslayer");

    if (up >= 200) {
      kcmd(player, `say atingiu a meta §2[Kanoto]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.004.slideshow_0.textures/icons/nichirin_thunder"}]}`);
      kcmd(player, `playsound challenge_complete @s`);
      player.addTag("kanoto");
      player.addTag("kanoto2");
      agendarStats(player);
    }
  }
}, 5);

// Rank 3 — Kanoe (300)
mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("kanoe")) continue;
    if (player.hasTag("demon")) continue;

    const up = hash.getScore(player, "upslayer");

    if (up >= 300) {
      kcmd(player, `say atingiu a meta §2[Kanoe]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.005.slideshow_0.textures/icons/nichirin_thunder"}]}`);
      kcmd(player, `playsound challenge_complete @s`);
      player.addTag("kanoe");
      player.addTag("kanoe2");
      agendarStats(player);
    }
  }
}, 5);

// Rank 4 — Tsuchinoto (400)
mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("tsuchinoto")) continue;
    if (player.hasTag("demon")) continue;

    const up = hash.getScore(player, "upslayer");

    if (up >= 400) {
      kcmd(player, `say atingiu a meta §2[Tsuchinoto]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.006.slideshow_0.textures/icons/nichirin_mist"}]}`);
      kcmd(player, `playsound challenge_complete @s`);
      player.addTag("tsuchinoto");
      player.addTag("tsuchinoto2");
      agendarStats(player);
    }
  }
}, 5);

// Rank 5 — Tsuchinone (500)
mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("tsuchinoe")) continue;
    if (player.hasTag("demon")) continue;

    const up = hash.getScore(player, "upslayer");

    if (up >= 500) {
      kcmd(player, `say atingiu a meta §2[Tsuchinone]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.007.slideshow_0.textures/icons/nichirin_mist"}]}`);
      kcmd(player, `playsound challenge_complete @s`);
      player.addTag("tsuchinoe");
      player.addTag("tsuchinoe2");
      agendarStats(player);
    }
  }
}, 5);

// Rank 6 — Hinoto (600)
mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("hinoto")) continue;
    if (player.hasTag("demon")) continue;

    const up = hash.getScore(player, "upslayer");

    if (up >= 600) {
      kcmd(player, `say atingiu a meta §2[Hinoto]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.008.slideshow_0.textures/icons/nichirin_fire"}]}`);
      kcmd(player, `playsound challenge_complete @s`);
      player.addTag("hinoto");
      player.addTag("hinoto2");
      agendarStats(player);
    }
  }
}, 5);

// Rank 7 — Hinoe (700)
mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("hinoe")) continue;
    if (player.hasTag("demon")) continue;

    const up = hash.getScore(player, "upslayer");

    if (up >= 700) {
      kcmd(player, `say atingiu a meta §2[Hinoe]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.009.slideshow_0.textures/icons/nichirin_fire"}]}`);
      kcmd(player, `playsound challenge_complete @s`);
      player.addTag("hinoe");
      player.addTag("hinoe2");
      agendarStats(player);
    }
  }
}, 5);

// Rank 8 — Kinoto (800)
mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("kinoto")) continue;
    if (player.hasTag("demon")) continue;

    const up = hash.getScore(player, "upslayer");

    if (up >= 800) {
      kcmd(player, `say atingiu a meta §2[Kinoto]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.010.slideshow_0.textures/icons/nichirin_sun"}]}`);
      kcmd(player, `playsound challenge_complete @s`);
      player.addTag("kinoto");
      player.addTag("kinoto2");
      agendarStats(player);
    }
  }
}, 5);

// Rank 9 — Kinoe (900) — o maior antes de Hashira
mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("kinoe")) continue;
    if (player.hasTag("demon")) continue;

    const up = hash.getScore(player, "upslayer");

    if (up >= 900) {
      kcmd(player, `say atingiu a meta §2[Kinoe]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.011.slideshow_0.textures/icons/nichirin_sun"}]}`);
      kcmd(player, `playsound challenge_complete @s`);
      player.addTag("kinoe");
      player.addTag("kinoe2");
      agendarStats(player);
    }
  }
}, 5);

// Rank 10 — Kinoe (1000) — o maior antes de Hashira
mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("hashira")) continue;
    if (player.hasTag("demon")) continue;

    const up = hash.getScore(player, "upslayer");

    if (up >= 1000) {
      kcmd(player, `say atingiu a meta §5§l[Hashira]`);
      kcmd(player, `say atingiu a meta §5§l[Strongest]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.02.body.012.slideshow_0.textures/icons/nichirin_tomioka"}]}`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.02.body.014.slideshow_0.textures/icons/demon"}]}`);
      kcmd(player, `playsound challenge_complete2 @s`);
      player.addTag("hashira");
      player.addTag("hashira2");
      agendarStats(player);
    }
  }
}, 5);

// Rank Demon

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("lower6")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 100) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Lower Rank 6]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.015.slideshow_0.textures/icons/kamanue_hand"}]}`);
      player.addTag("lower6");
      player.addTag("lower62");
      agendarStats(player);
    }
  }
}, 5);

// Lower Rank 5

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("lower5")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 200) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Lower Rank 5]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.016.slideshow_0.textures/icons/rui_kekkijutsu"}]}`);
      player.addTag("lower5");
      player.addTag("lower52");
      agendarStats(player);
    }
  }
}, 5);

// Lower Rank 4

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("lower4")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 300) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Lower Rank 4]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.017.slideshow_0.textures/icons/blood"}]}`);
      player.addTag("lower4");
      player.addTag("lower42");
      agendarStats(player);
    }
  }
}, 5);

// Lower Rank 3

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("lower3")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 400) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Lower Rank 3]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.018.slideshow_0.textures/icons/blood"}]}`);
      player.addTag("lower3");
      player.addTag("lower32");
      agendarStats(player);
    }
  }
}, 5);

// Lower Rank 2

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("lower2")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 500) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Lower Rank 2]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.019.slideshow_0.textures/icons/blooddemonart_rokuro"}]}`);
      player.addTag("lower2");
      player.addTag("lower22");
      agendarStats(player);
    }
  }
}, 5);

// Lower Rank 1

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("lower1")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 600) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Lower Rank 1]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.020.slideshow_0.textures/icons/enmu_hand"}]}`);
      player.addTag("lower1");
      player.addTag("lower12");
      agendarStats(player);
    }
  }
}, 5);

// Upper Rank 6

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("upper6")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 700) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Upper Rank 6]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.021.slideshow_0.textures/icons/chigama"}]}`);
      player.addTag("upper6");
      player.addTag("upper62");
      agendarStats(player);
    }
  }
}, 5);

// Upper Rank 5

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("upper5")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 800) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Upper Rank 5]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.022.slideshow_0.textures/icons/blooddemonart_gyokko"}]}`);
      player.addTag("upper5");
      player.addTag("upper52");
      agendarStats(player);
    }
  }
}, 5);

// Upper Rank 4

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("upper4")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 900) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Upper Rank 4]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.023.slideshow_0.textures/icons/demonart_zohakuten"}]}`);
      player.addTag("upper4");
      player.addTag("upper42");
      agendarStats(player);
    }
  }
}, 5);

// Upper Rank 3

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("upper3")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 1000) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Upper Rank 3]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.024.slideshow_0.textures/icons/compass_needle"}]}`);
      player.addTag("upper3");
      player.addTag("upper32");
      agendarStats(player);
    }
  }
}, 5);

// Upper Rank 2

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("upper2")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 1100) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §2[Upper Rank 2]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.01.body.024.slideshow_0.textures/icons/blooddemonart_doma"}]}`);
      player.addTag("upper2");
      player.addTag("upper22");
      agendarStats(player);
    }
  }
}, 5);

// Upper Rank 1

mc.system.runInterval(() => {
  for (const player of mc.world.getPlayers()) {
    if (player.hasTag("upper1")) continue;
    if (player.hasTag("slayer")) continue;

    const up = hash.getScore(player, "updemon");

    if (up >= 1200) {
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §5§l[Upper Rank 1]`);
      if (!player.hasTag("kny_hybrid")) kcmd(player, `say atingiu a meta §5§l[Strongest]`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.02.body.025.slideshow_0.textures/icons/nichirin_kokushibo"}]}`);
      kcmd(player, `tellraw @s{"rawtext":[{"text":"_r4ui:toast_0.header.02.body.014.slideshow_0.textures/icons/demon"}]}`);
      kcmd(player, `playsound challenge_complete2 @s`);
      player.addTag("upper1");
      player.addTag("upper12");
      agendarStats(player);
    }
  }
}, 5);
