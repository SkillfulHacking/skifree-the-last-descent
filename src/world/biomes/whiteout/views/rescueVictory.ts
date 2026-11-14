/**
 * "whiteout-rescue" victory: from storm to shelter.
 *
 *  0.0  Into the light: the storm is still raging (the finish holds the weather at full storm). A
 *       low shot from behind the skier through the driving snow, the hut's warm door and the red
 *       beacon the only colour ahead, as the skier glides up to the door and stops.
 *  3.6  The Yeti at the edge of the light: up the slope, half lost in the blizzard, he lumbers to the
 *       edge of the porch light, raises an arm against the glare and the warmth, and backs off into
 *       the white (filmed past the skier's shoulder, then close on him).
 *  7.6  The door opens: warm light spills onto the snow; the brass storm lantern lifts off its plinth
 *       into the skier's hand and is held up in the doorway.
 * 11.0  The storm breaks: the wind drops, the snow thins and the cloud tears open over ~4 s while the
 *       camera rises and pulls back from the hut until the whole ridge stands in low sun behind it.
 * 17.4  Results.
 */
import * as THREE from 'three';
import { ease, pose } from '../../../../cinematic/Timeline';
import type { Stage } from '../../../../game/Stage';
import { damp, wrapAngle } from '../../../../core/rng';
import type { FinishEnvironment, VictoryDirector, VictoryScript } from '../../../presentation/finish';
import { TrophyHandoff } from '../../../../cinematic/victory/trophy';
import type { RescueStation } from './rescue';

export const RESCUE_BEATS = { arrive: 0, yeti: 3.6, door: 7.6, lantern: 8.6, clear: 11.0, clearEnd: 15.0, results: 17.4 } as const;

export class RescueVictory implements VictoryScript {
  private trophy: TrophyHandoff;
  private t = 0;
  private yetiStop = new THREE.Vector3();
  private yetiState: 'approach' | 'flinch' | 'leave' = 'approach';
  private yetiT = 0;
  private station: RescueStation;

  constructor(
    private st: Stage,
    r: FinishEnvironment,
    private d: VictoryDirector,
  ) {
    this.station = r as RescueStation;
    this.station.doorOpen = 0;
    this.trophy = new TrophyHandoff(st, r.trophy, () => st.audio.playCrowdCheer(0.4));
    r.getYetiStopPoint(this.yetiStop);
    const S = this.station;
    const door = S.door.clone();
    const faces = S.faces.clone();
    const across = new THREE.Vector3(faces.z, 0, -faces.x);
    const sk = () => st.skier.root.position.clone();
    const tl = d.tl;
    st.yetiManual = true;
    // the Yeti starts out in the white, up the slope beyond his stop point
    const ya = st.yetiAI;
    const start = this.yetiStop.clone().addScaledVector(faces, 26);
    ya.pos.set(start.x, st.world.mountain.heightAt(start.x, start.z), start.z);
    // the storm holds at full strength until the break
    st.world.weatherOverride = { visibility: 9, snowfall: 2.6, storm: 1, windX: 10 };

    // 1) into the light: low, behind and beside the skier, looking at the door
    tl.shot({
      start: 0,
      end: 3.6,
      from: () => pose(sk().addScaledVector(faces, 9).addScaledVector(across, 2.5).add(new THREE.Vector3(0, 1.6, 0)), door.clone().add(new THREE.Vector3(0, 1.6, 0)), 50),
      to: () => pose(sk().addScaledVector(faces, 6.5).addScaledVector(across, 2.0).add(new THREE.Vector3(0, 1.5, 0)), door.clone().add(new THREE.Vector3(0, 1.8, 0)), 46),
      easing: ease.inOut,
      handheld: 0.02,
    });
    // 2) the Yeti at the edge of the light, past the skier's shoulder…
    tl.shot({
      start: 3.6,
      end: 5.6,
      from: () => pose(sk().addScaledVector(faces, -2.5).addScaledVector(across, 1.2).add(new THREE.Vector3(0, 1.9, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.0, 0)), 34),
      to: () => pose(sk().addScaledVector(faces, -2.2).addScaledVector(across, 1.1).add(new THREE.Vector3(0, 1.8, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.0, 0)), 28),
      handheld: 0.015,
    });
    // …and close on him as he flinches from the light and backs into the storm
    const toDoor = () => door.clone().sub(st.yetiAI.pos).setY(0).normalize();
    tl.shot({
      start: 5.6,
      end: 7.6,
      from: () => pose(st.yetiAI.pos.clone().addScaledVector(toDoor(), 7).add(new THREE.Vector3(0, 1.7, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.3, 0)), 36),
      to: () => pose(st.yetiAI.pos.clone().addScaledVector(toDoor(), 6).add(new THREE.Vector3(0, 1.6, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.3, 0)), 32),
      handheld: 0.02,
    });
    // 3) the door and the lantern: from beside the doorway, the skier in the warm light
    tl.shot({
      start: 7.6,
      end: 11.0,
      from: () => pose(door.clone().addScaledVector(faces, 3.2).addScaledVector(across, -3.4).add(new THREE.Vector3(0, 1.7, 0)), sk().add(new THREE.Vector3(0, 1.3, 0)), 44),
      to: () => pose(door.clone().addScaledVector(faces, 3.6).addScaledVector(across, -2.8).add(new THREE.Vector3(0, 1.6, 0)), sk().add(new THREE.Vector3(0, 1.6, 0)), 40),
      easing: ease.inOut,
    });
    tl.at(RESCUE_BEATS.lantern, () => this.trophy.start());
    // 4) the storm breaks: rise and pull back from the hut to the ridge behind it
    const back = () => S.hut.clone().addScaledVector(faces, -1);
    tl.shot({
      start: 11.0,
      end: RESCUE_BEATS.results,
      from: () => pose(back().addScaledVector(faces, -14).addScaledVector(across, 6).add(new THREE.Vector3(0, 4, 0)), S.hut.clone().addScaledVector(faces, 30).add(new THREE.Vector3(0, 10, 0)), 50),
      to: () => pose(back().addScaledVector(faces, -48).addScaledVector(across, 22).add(new THREE.Vector3(0, 30, 0)), S.hut.clone().addScaledVector(faces, 260).add(new THREE.Vector3(0, 120, 0)), 52),
      easing: ease.inOut,
    });
    tl.at(RESCUE_BEATS.results, () => d.results());
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    const st = this.st;
    const d = this.d;
    d.autopilot = 1;
    // the storm: full until the break, then it clears over 4 s (the sun comes out over the ridge)
    const k = THREE.MathUtils.smoothstep(t, RESCUE_BEATS.clear, RESCUE_BEATS.clearEnd);
    const wo = st.world.weatherOverride;
    if (wo) {
      wo.storm = 1 - k;
      wo.visibility = 9 * (1 - k) + 1 * k;
      wo.snowfall = 2.6 * (1 - k) + 0.15 * k;
      wo.windX = 10 * (1 - k) + 1 * k;
    }
    this.station.doorOpen = THREE.MathUtils.smoothstep(t, RESCUE_BEATS.door, RESCUE_BEATS.door + 0.9);
    this.trophy.update(dt);
    // the Yeti: approach his stop at the edge of the light, flinch, back off into the white
    const ya = st.yetiAI;
    const m = st.world.mountain;
    this.yetiT += dt;
    if (this.yetiState === 'approach') {
      const to = this.yetiStop.clone().sub(ya.pos).setY(0);
      const dist = to.length();
      if (dist < 0.6 || t > 5.8) {
        this.yetiState = 'flinch';
        this.yetiT = 0;
        st.setYetiMode('disgust');
        st.audio.playYetiGrowl(ya.pos, false);
      } else {
        to.normalize();
        const v = Math.min(dist, 5.5 * dt);
        st.yetiAnim.speed = 5.5;
        ya.pos.addScaledVector(to, v);
        ya.heading = damp(ya.heading, ya.heading + wrapAngle(Math.atan2(to.x, to.z) - ya.heading), 8, dt);
        st.setYetiMode('walk');
      }
    } else if (this.yetiState === 'flinch') {
      st.yetiAnim.speed = 0;
      if (this.yetiT > 1.2) {
        this.yetiState = 'leave';
        this.yetiT = 0;
      }
    } else {
      const away = ya.pos.clone().sub(this.station.door).setY(0).normalize();
      ya.pos.addScaledVector(away, 2.2 * dt);
      st.yetiAnim.speed = 2.2;
      ya.heading = damp(ya.heading, ya.heading + wrapAngle(Math.atan2(away.x, away.z) - ya.heading), 4, dt);
      st.setYetiMode('turnAway');
    }
    ya.pos.y = m.heightAt(ya.pos.x, ya.pos.z);
    st.yeti.root.position.copy(ya.pos);
    st.yeti.root.rotation.y = ya.heading;
  }
}
