/**
 * "whiteout-rescue" victory: from storm to shelter (full production, brief §7).
 *
 *  0.0  Into the light: the storm still rages (the finish holds the weather at full storm). Low,
 *       behind the skier through the driving snow; the hut's warm windows, the porch light, the red
 *       beacon and the sweeping searchlight the only colour ahead. The rescuers on the porch are
 *       already waving them in.
 *  3.4  Safety and welcome: from beside the porch, the skier glides up to the deck; the door swings
 *       open (3.8) and warm light spills over the snow; the rescuers wave.
 *  6.6  The storm lantern: the brass lantern lifts off its plinth into the skier's hand and is held
 *       up in the doorway (the lantern beat — RESCUE_BEATS.lantern), the rescuers cheer.
 *  9.4  The Yeti at the edge of the light: past the skier's shoulder, the lantern raised toward him;
 *       the searchlight swings onto him; he flinches from the light (disgust), raises an arm, and
 *       backs off into the white.
 * 12.8  The storm breaks: the wind drops, the snow thins and the cloud tears open over ~4 s (the
 *       cloud deck and its shadows break up, the sun comes out) while the camera rises and pulls back
 *       from the hut —
 * 16.8  — until the whole ridge the skier came down stands in low sun behind the station.
 * 19.6  Results.
 */
import * as THREE from 'three';
import { ease, pose } from '../../../../cinematic/Timeline';
import type { Stage } from '../../../../game/Stage';
import { damp, wrapAngle } from '../../../../core/rng';
import type { FinishEnvironment, VictoryDirector, VictoryScript } from '../../../presentation/finish';
import { TrophyHandoff } from '../../../../cinematic/victory/trophy';
import type { RescueStation } from './rescue';

export const RESCUE_BEATS = { arrive: 0, welcome: 3.4, door: 3.8, lantern: 6.6, yeti: 9.4, yetiStart: 5.2, clear: 12.8, clearEnd: 16.8, results: 19.6 } as const;

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
      end: RESCUE_BEATS.welcome,
      from: () => pose(sk().addScaledVector(faces, 9).addScaledVector(across, 2.5).add(new THREE.Vector3(0, 1.6, 0)), door.clone().add(new THREE.Vector3(0, 1.6, 0)), 50),
      to: () => pose(sk().addScaledVector(faces, 6.5).addScaledVector(across, 2.0).add(new THREE.Vector3(0, 1.5, 0)), door.clone().add(new THREE.Vector3(0, 1.8, 0)), 46),
      easing: ease.inOut,
      handheld: 0.02,
    });
    tl.at(0.8, () => (S.welcome = 1));
    // 2) safety and welcome: from beside the porch, the skier arriving, the door swinging open
    const toHut = () => door.clone().sub(sk()).setY(0).normalize();
    const side = () => new THREE.Vector3(toHut().z, 0, -toHut().x);
    tl.shot({
      start: RESCUE_BEATS.welcome,
      end: RESCUE_BEATS.lantern,
      from: () => pose(door.clone().addScaledVector(faces, 3.2).addScaledVector(across, 5.4).add(new THREE.Vector3(0, 1.5, 0)), sk().lerp(door, 0.5).add(new THREE.Vector3(0, 1.4, 0)), 48),
      to: () => pose(door.clone().addScaledVector(faces, 3.6).addScaledVector(across, 4.6).add(new THREE.Vector3(0, 1.45, 0)), sk().lerp(door, 0.6).add(new THREE.Vector3(0, 1.45, 0)), 44),
      easing: ease.inOut,
    });
    // 3) the lantern: from the storm side, low; the skier in front of the warm doorway, the lantern lifted
    tl.shot({
      start: RESCUE_BEATS.lantern,
      end: RESCUE_BEATS.yeti,
      from: () => pose(sk().addScaledVector(toHut(), -3.9).addScaledVector(side(), 1.6).add(new THREE.Vector3(0, 1.35, 0)), sk().addScaledVector(toHut(), 1.0).add(new THREE.Vector3(0, 1.75, 0)), 40),
      to: () => pose(sk().addScaledVector(toHut(), -3.1).addScaledVector(side(), 1.2).add(new THREE.Vector3(0, 1.3, 0)), sk().addScaledVector(toHut(), 0.6).add(new THREE.Vector3(0, 1.95, 0)), 36),
      easing: ease.inOut,
    });
    tl.at(RESCUE_BEATS.lantern, () => this.trophy.start());
    tl.at(RESCUE_BEATS.lantern + 1.0, () => (S.cheer = 1));
    // 4) the Yeti at the edge of the light, past the skier's shoulder and the raised lantern…
    tl.shot({
      start: RESCUE_BEATS.yeti,
      end: RESCUE_BEATS.yeti + 1.9,
      from: () => pose(sk().addScaledVector(toHut(), 1.6).addScaledVector(side(), -0.9).add(new THREE.Vector3(0, 2.0, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.0, 0)), 34),
      to: () => pose(sk().addScaledVector(toHut(), 1.4).addScaledVector(side(), -0.8).add(new THREE.Vector3(0, 1.95, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.0, 0)), 28),
      handheld: 0.015,
    });
    tl.at(RESCUE_BEATS.yeti, () => (S.searchTarget = st.yetiAI.pos.clone().add(new THREE.Vector3(0, 1.6, 0))));
    // …and close on him as the light hits him: he flinches and backs into the storm
    const toDoor = () => door.clone().sub(st.yetiAI.pos).setY(0).normalize();
    tl.shot({
      start: RESCUE_BEATS.yeti + 1.9,
      end: RESCUE_BEATS.clear,
      from: () => pose(st.yetiAI.pos.clone().addScaledVector(toDoor(), 7).add(new THREE.Vector3(0, 1.7, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.3, 0)), 36),
      to: () => pose(st.yetiAI.pos.clone().addScaledVector(toDoor(), 6).add(new THREE.Vector3(0, 1.6, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.3, 0)), 32),
      handheld: 0.02,
    });
    // 5–6) the storm breaks: rise and pull back from the hut until the ridge stands behind it
    const back = () => S.hut.clone().addScaledVector(faces, -1);
    tl.shot({
      start: RESCUE_BEATS.clear,
      end: RESCUE_BEATS.results,
      from: () => pose(back().addScaledVector(faces, -14).addScaledVector(across, 6).add(new THREE.Vector3(0, 4, 0)), S.hut.clone().addScaledVector(faces, 30).add(new THREE.Vector3(0, 10, 0)), 50),
      to: () => pose(back().addScaledVector(faces, -60).addScaledVector(across, 26).add(new THREE.Vector3(0, 38, 0)), S.hut.clone().addScaledVector(faces, 320).add(new THREE.Vector3(0, 150, 0)), 54),
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
    if (t < RESCUE_BEATS.yetiStart) {
      // waiting out in the white, unseen
      st.yetiAnim.speed = 0;
      st.setYetiMode('walk');
    } else if (this.yetiState === 'approach') {
      const to = this.yetiStop.clone().sub(ya.pos).setY(0);
      const dist = to.length();
      if (dist < 0.6 || t > RESCUE_BEATS.yeti + 1.6) {
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
