/**
 * "alpine-resort" victory: the original finish sequence, unchanged — the snow-spraying stop, the
 * Yeti arriving at the resort edge and recoiling in disgust, the trophy flying into the skier's
 * hand, the welcome at the hot tub and the crane up over the lodge to the whole mountain.
 * Registered with the Resort as the "alpine-resort" finish (src/world/presentation/alpine.ts).
 */
import * as THREE from 'three';
import { ease, pose } from '../Timeline';
import type { Stage } from '../../game/Stage';
import { damp, wrapAngle } from '../../core/rng';
import type { FinishEnvironment, VictoryDirector, VictoryScript } from '../../world/presentation/finish';
import { TrophyHandoff } from './trophy';

export class AlpineResortVictory implements VictoryScript {
  private trophy: TrophyHandoff;
  private yetiStop = new THREE.Vector3();
  private yetiState: 'approach' | 'pause' | 'disgust' | 'leave' = 'approach';
  private yetiT = 0;
  private stopPoint: THREE.Vector3;

  constructor(
    private st: Stage,
    r: FinishEnvironment,
    private d: VictoryDirector,
  ) {
    this.stopPoint = d.stopPoint;
    this.trophy = new TrophyHandoff(st, r.trophy, () => st.audio.playCrowdCheer(1));
    r.getYetiStopPoint(this.yetiStop);
    const fz = r.finishZ;
    const F = new THREE.Vector3(this.stopPoint.x, st.world.mountain.heightAt(this.stopPoint.x, fz), fz);
    const podium = new THREE.Vector3();
    r.getPodiumTop(podium);
    const tub = new THREE.Vector3();
    r.getCelebrationFocus(tub);
    const sk = () => st.skier.root.position.clone();
    const tl = d.tl;
    st.yetiManual = true;

    // place the yeti so he reaches the resort edge in the background a few seconds from now
    const ya = st.yetiAI;
    const toStop = new THREE.Vector3().subVectors(ya.pos, this.yetiStop);
    if (toStop.length() > 70) {
      // far behind: he arrives out of the forest uphill of the stop point
      const dir = new THREE.Vector3(this.yetiStop.x - F.x, 0, this.yetiStop.z - F.z).normalize();
      const p = this.yetiStop.clone().addScaledVector(dir, 40).add(new THREE.Vector3(0, 0, -30));
      ya.pos.set(p.x, st.world.mountain.heightAt(p.x, p.z), p.z);
    }

    // 1) wide: crossing the finish and the snow-spraying stop
    tl.shot({ start: 0, end: 3.6, from: () => pose(F.clone().add(new THREE.Vector3(-16, 4.5, 16)), sk().add(new THREE.Vector3(0, 1, 0)), 48), to: () => pose(F.clone().add(new THREE.Vector3(-14, 3.6, 26)), sk().add(new THREE.Vector3(0, 1, 0)), 44) });
    // 2) the yeti at the edge of the resort, beyond the skier
    tl.shot({
      start: 3.6,
      end: 8.2,
      from: () => {
        const s = sk();
        const away = s.clone().sub(this.yetiStop).setY(0).normalize();
        return pose(s.clone().addScaledVector(away, 5).add(new THREE.Vector3(1.6, 2.0, 0)), this.yetiStop.clone().add(new THREE.Vector3(0, 2.2, 0)), 40);
      },
      to: () => {
        const s = sk();
        const away = s.clone().sub(this.yetiStop).setY(0).normalize();
        return pose(s.clone().addScaledVector(away, 4.2).add(new THREE.Vector3(1.4, 1.9, 0)), this.yetiStop.clone().add(new THREE.Vector3(0, 2.0, 0)), 22);
      },
    });
    // 2b) close on the yeti for the joke: he stops, stares at the crowd... and is disgusted
    const toSkier = () => this.stopPoint.clone().sub(st.yetiAI.pos).setY(0).normalize();
    tl.shot({
      start: 5.0,
      end: 7.6,
      from: () => pose(st.yetiAI.pos.clone().addScaledVector(toSkier(), 7.5).add(new THREE.Vector3(0, 1.6, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 36),
      to: () => pose(st.yetiAI.pos.clone().addScaledVector(toSkier(), 6.5).add(new THREE.Vector3(0, 1.5, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 33),
    });
    // 3) trophy & welcome — orbit around the skier, guests and hot tub in frame
    // the skier in the foreground, the hot tub, lodge and welcoming guests behind
    const fromTub = () => sk().sub(tub).setY(0).normalize();
    const sideOf = () => {
      const d = fromTub();
      return new THREE.Vector3(d.z, 0, -d.x);
    };
    tl.shot({
      start: 8.2,
      end: 12.4,
      from: () => pose(sk().addScaledVector(fromTub(), 6.2).addScaledVector(sideOf(), 2.6).add(new THREE.Vector3(0, 2.0, 0)), sk().lerp(tub, 0.25).add(new THREE.Vector3(0, 1.7, 0)), 42),
      to: () => pose(sk().addScaledVector(fromTub(), 5.4).addScaledVector(sideOf(), -2.0).add(new THREE.Vector3(0, 1.9, 0)), sk().lerp(tub, 0.35).add(new THREE.Vector3(0, 1.9, 0)), 40),
      easing: ease.inOut,
    });
    // 4) crane up: the resort and the whole mountain behind it
    // 4) crane: up and over the lodge and guests, then the whole mountain behind
    tl.shot({ start: 12.4, end: 18.5, from: () => pose(sk().addScaledVector(fromTub(), 5.4).addScaledVector(sideOf(), -2.0).add(new THREE.Vector3(0, 1.9, 0)), sk().lerp(tub, 0.35).add(new THREE.Vector3(0, 1.9, 0)), 40), via: () => pose(sk().add(new THREE.Vector3(-10, 14, 24)), tub.clone().add(new THREE.Vector3(0, 2, 0)), 46), to: () => pose(sk().add(new THREE.Vector3(-20, 36, 70)), sk().add(new THREE.Vector3(0, 160, -900)), 55), easing: ease.inOutCubic });

    tl.at(0, () => {
      st.hud.gameplayWidgets(false);
      st.hud.letterbox(true);
      st.audio.setMusicMode('victory');
      st.audio.playVictoryFanfare();
      st.audio.playCrowdCheer(0.8);
    });
    tl.at(2.6, () => {
      d.autopilot = 0;
      st.audio.playCrowdCheer(1);
    });
    tl.at(8.2, () => {
      this.trophy.start();
      st.audio.playCrowdCheer(1);
    });
    tl.at(9.4, () => (d.welcome = 1));
    tl.at(13.0, () => st.hud.title('YOU SURVIVED THE MOUNTAIN', 'SkiFree — The Last Descent', 'victory', 60));
    tl.at(18.0, () => {
      st.hud.letterbox(false);
      d.results();
    });
    // the joke, on cue: arrive → stop → stare → disgust → turn away
    tl.at(4.6, () => (this.yetiState = 'pause', (this.yetiT = 0), st.setYetiMode('stand')));
    tl.at(5.6, () => ((this.yetiState = 'disgust'), (this.yetiT = 0), st.setYetiMode('disgust'), st.audio.playYetiGrowl(st.yetiAI.pos, false)));
    tl.at(7.4, () => ((this.yetiState = 'leave'), (this.yetiT = 0), st.setYetiMode('turnAway')))
  }

  update(dt: number) {
    const st = this.st;
    const t = this.d.tl.time;
    this.d.cheer = damp(this.d.cheer, t < 0.4 ? 0.3 : 1, 2, dt);
    // yeti: arrive, stop, comedic pause, disgust, turn and leave
    const ya = st.yetiAI;
    this.yetiT += dt;
    const target = this.yetiStop;
    if (this.yetiState === 'approach') {
      const d = Math.hypot(target.x - ya.pos.x, target.z - ya.pos.z);
      const h = Math.atan2(target.x - ya.pos.x, target.z - ya.pos.z);
      ya.heading = wrapAngle(ya.heading + wrapAngle(h - ya.heading) * Math.min(1, dt * 4));
      const sp = Math.min(Math.max(16, d / Math.max(0.3, 4.4 - t)), d * 2.2);
      ya.pos.x += Math.sin(ya.heading) * sp * dt;
      ya.pos.z += Math.cos(ya.heading) * sp * dt;
      st.yetiAnim.speed = sp;
      st.setYetiMode(sp > 3 ? 'run' : 'walk');
      if (d < 0.8) {
        // arrived early: wait at the edge
        ya.pos.copy(target);
        st.yetiAnim.speed = 0;
        st.setYetiMode('stand');
      }
    } else if (this.yetiState === 'pause' || this.yetiState === 'disgust') {
      st.yetiAnim.speed = 0;
      // face the crowd
      const h = Math.atan2(this.stopPoint.x - ya.pos.x, this.stopPoint.z - ya.pos.z);
      ya.heading = wrapAngle(ya.heading + wrapAngle(h - ya.heading) * Math.min(1, dt * 5));
    } else if (this.yetiState === 'leave') {
      const away = Math.atan2(ya.pos.x - this.stopPoint.x, ya.pos.z - this.stopPoint.z) + 0.6;
      ya.heading = wrapAngle(ya.heading + wrapAngle(away - ya.heading) * Math.min(1, dt * 2));
      const sp = Math.min(2.4, this.yetiT * 1.5);
      ya.pos.x += Math.sin(ya.heading) * sp * dt;
      ya.pos.z += Math.cos(ya.heading) * sp * dt;
      st.yetiAnim.speed = sp;
      if (this.yetiT > 9) st.yeti.setVisible(false);
    }
    ya.pos.y = st.world.mountain.heightAt(ya.pos.x, ya.pos.z);
    st.yeti.root.position.copy(ya.pos);
    st.yeti.root.rotation.set(0, ya.heading, 0);

    // trophy flies from the podium into the skier's raised hand
    this.trophy.update(dt);
  }
}
