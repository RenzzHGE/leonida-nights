# LEONIDA NIGHTS

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/RenzzHGE/leonida-nights/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/RenzzHGE/leonida-nights/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for [make.fun/bounty/gta6-01](https://make.fun/bounty/gta6-01). Drive the neon streets of Leonida at 2 AM: take jobs, outrun the Leonida PD, buy faster cars, and climb from Street Rookie to Leonida Legend.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with any static server). No network, no build step — every file is local.

- **WASD / arrows** — drive and walk (Shift to run on foot)
- **SPACE** — handbrake drift
- **E** — steal a car, start a job
- **F** — get in and out of your car
- **R** — repair a stalled car ($200)
- **G** — garage: buy cars and upgrades
- **ESC** — pause

## The game

- **A living night city** — a 7×7 road grid of neon towers, a beach boulevard with palms and an ocean, traffic and pedestrians, streetlights, stars and a moon.
- **On foot and by car** — walk the sidewalks, steal any traffic car, or drive your own ride.
- **Wanted system** — 1–5 stars. Steal cars, hit pedestrians, drive recklessly and the Leonida PD sends cruisers to chase and ram you. Break line of sight to cool off, or get busted and pay the fine.
- **Jobs** — Deliveries, Getaways and Street Races against rival drivers, each paying cash and rep.
- **Progression** — cash buys three cars (Sunset Sedan → Neon GT → Vice Supercar) and engine, tire and armor upgrades; rep climbs the rank ladder to Leonida Legend.
- **HUD** — cash, rep, wanted stars, speed, a live minimap, job timer and objective.
- **Sound** — engine, sirens, cash and crashes, all synthesized with WebAudio.
- **Save** — progress is kept in localStorage.

## Structure

```
game/
  index.html            page, HUD and menus
  style.css             neon HUD and menu styling
  vendor/three.module.min.js   three.js r160 (vendored)
  src/
    main.js             boot, game loop, camera, garage, on-foot + driving
    config.js           tuning, cars, ranks, jobs
    world.js            the city: roads, towers, beach, palms, lights
    car.js              car meshes and arcade driving physics
    traffic.js          traffic cars and pedestrians
    police.js           wanted level and police pursuit
    jobs.js             deliveries, getaways, street races
    hud.js              HUD and live minimap
    audio.js            synthesized WebAudio sound
    input.js            keyboard input
    save.js             localStorage saves
```

## License

MIT. An original game: its city, characters, vehicles, names, story, art and sounds are its own. Nothing from Rockstar Games' Grand Theft Auto series or any other commercial game.
