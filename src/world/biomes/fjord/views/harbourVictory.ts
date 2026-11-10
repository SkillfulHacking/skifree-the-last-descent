/**
 * "fjord-harbour" victory. The beats:
 *  0.0  wide: the skier crosses the line under the float-hung gate and sprays to a stop on the quay;
 *  3.6  the Yeti arrives at the snow line above the harbour, sees the crowd and the sea…
 *  5.2  …close on him: he sniffs the fish racks, recoils in disgust and stomps back up the mountain;
 *  8.0  the gilded lighthouse flies off the fish-crate podium into the skier's hand (orbit, boats behind);
 * 12.0  the après: from the bathing pier, a guest in a red robe sprints off the end and cannonballs
 *       into the fjord while the tub crowd cheers;
 * 15.0  the reveal: from low over the water at the harbour mouth, the camera pulls back and rises
 *       until the whole mountain you just descended stands over the little harbour;
 * 22.5  results.
 */
import * as THREE from 'three';
import { ease, pose } from '../../../../cinematic/Timeline';
import type { Stage } from '../../../../game/Stage';
import { damp, wrapAngle } from '../../../../core/rng';
import type { FinishEnvironment, VictoryDirector, VictoryScript } from '../../../presentation/finish';
import { TrophyHandoff } from '../../../../cinematic/victory/trophy';
import type { Harbour } from './harbour';

export class HarbourVictory implements VictoryScript {
  private trophy: TrophyHandoff;
  private yetiStop = new THREE.Vector3();
  private yetiState: 'approach' | 'pause' | 'disgust' | 'leave' = 'approach';
  private yetiT = 0;
  private stopPoint: THREE.Vector3;
  private plungeT = -1;

  constructor(
    private st: Stage,
    private r: FinishEnvironment,
    private d: VictoryDirector,
  ) {
    const h = r as Harbour;
    if (typeof h.resetCelebration === 'function') h.resetCelebration();
    this.stopPoint = d.stopPoint;
    this.trophy = new TrophyHandoff(st, r.trophy, () => st.audio.playCrowdCheer(1));
    r.getYetiStopPoint(this.yetiStop);
    const m = st.world.mountain;
    const fz = r.finishZ;
    const F = new THREE.Vector3(this.stopPoint.x, m.heightAt(this.stopPoint.x, fz), fz);
    const tub = r.getCelebrationFocus(new THREE.Vector3());
    const sk = () => st.skier.root.position.clone();
    const tl = d.tl;
    st.yetiManual = true;

    const ya = st.yetiAI;
    if (ya.pos.distanceTo(this.yetiStop) > 70) {
      const p = this.yetiStop.clone().add(new THREE.Vector3(-30, 0, -40));
      ya.pos.set(p.x, m.heightAt(p.x, p.z), p.z);
    }

    // 1) crossing the line and the stop, the harbour opening up behind
    tl.shot({ start: 0, end: 3.6, from: () => pose(F.clone().add(new THREE.Vector3(-17, 4.2, 14)), sk().add(new THREE.Vector3(0, 1, 0)), 50), to: () => pose(F.clone().add(new THREE.Vector3(-13, 3.4, 24)), sk().add(new THREE.Vector3(0, 1.2, 8)), 46) });
    // 2) the Yeti above the harbour, beyond the skier
    tl.shot({
      start: 3.6,
      end: 5.2,
      from: () => {
        const s = sk();
        const away = s.clone().sub(this.yetiStop).setY(0).normalize();
        return pose(s.clone().addScaledVector(away, 5).add(new THREE.Vector3(1.6, 2.0, 0)), this.yetiStop.clone().add(new THREE.Vector3(0, 2.2, 0)), 40);
      },
      to: () => {
        const s = sk();
        const away = s.clone().sub(this.yetiStop).setY(0).normalize();
        return pose(s.clone().addScaledVector(away, 4.4).add(new THREE.Vector3(1.4, 1.9, 0)), this.yetiStop.clone().add(new THREE.Vector3(0, 2.0, 0)), 26);
      },
    });
    // 2b) close on the Yeti for the joke
    const toSkier = () => this.stopPoint.clone().sub(st.yetiAI.pos).setY(0).normalize();
    tl.shot({
      start: 5.2,
      end: 8.0,
      from: () => pose(st.yetiAI.pos.clone().addScaledVector(toSkier(), 7.5).add(new THREE.Vector3(0, 1.6, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 36),
      to: () => pose(st.yetiAI.pos.clone().addScaledVector(toSkier(), 6.4).add(new THREE.Vector3(0, 1.5, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 33),
    });
    // 3) trophy: orbit the skier with the quay, boats and sea behind
    const seaDir = new THREE.Vector3(0, 0, 1);
    const side = new THREE.Vector3(1, 0, 0);
    tl.shot({
      start: 8.0,
      end: 12.0,
      from: () => pose(sk().addScaledVector(seaDir, -6.0).addScaledVector(side, 2.8).add(new THREE.Vector3(0, 2.0, 0)), sk().add(new THREE.Vector3(0, 1.6, 6)), 44),
      to: () => pose(sk().addScaledVector(seaDir, -5.2).addScaledVector(side, -2.6).add(new THREE.Vector3(0, 1.8, 0)), sk().add(new THREE.Vector3(0, 1.8, 7)), 42),
      easing: ease.inOut,
    });
    // 4) the plunge, from the pier beside the bathing tub
    const hb = r as Harbour;
    const from = hb.plungeFrom ?? tub;
    const to = hb.plungeTo ?? tub;
    tl.shot({
      start: 12.0,
      end: 15.0,
      from: () => pose(tub.clone().add(new THREE.Vector3(-7, 2.6, -6)), from.clone().lerp(to, 0.3).add(new THREE.Vector3(0, 1.2, 0)), 46),
      to: () => pose(tub.clone().add(new THREE.Vector3(-8, 2.2, -4)), to.clone().add(new THREE.Vector3(0, 0.8, 0)), 44),
    });
    // 5) the reveal: from low over the harbour mouth, pull back and up — the whole mountain
    const sea = hb.seaward ? hb.seaward.clone() : F.clone().add(new THREE.Vector3(60, 5, 300));
    const L = fz;
    const zLook = Math.max(L * 0.42, L - 4200);
    const xLook = m.routeX(zLook);
    const peak = new THREE.Vector3(xLook, m.heightAt(xLook, zLook) + 60, zLook);
    const harbourLook = F.clone().add(new THREE.Vector3(0, 6, 120));
    tl.shot({
      start: 15.0,
      end: 22.5,
      from: () => pose(sea.clone(), harbourLook.clone(), 42),
      via: () => pose(sea.clone().add(new THREE.Vector3(80, 60, 520)), harbourLook.clone().lerp(peak, 0.45), 48),
      to: () => pose(sea.clone().add(new THREE.Vector3(160, 260, 1500)), harbourLook.clone().lerp(peak, 0.78), 52),
      easing: ease.inOutCubic,
    });

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
    tl.at(8.0, () => {
      this.trophy.start();
      st.audio.playCrowdCheer(1);
    });
    tl.at(9.2, () => (d.welcome = 1));
    tl.at(12.3, () => (this.plungeT = 0));
    tl.at(13.5, () => st.audio.playCrowdCheer(1));
    tl.at(16.5, () => st.hud.title('YOU SURVIVED THE MOUNTAIN', 'Fjord Coast — from the summit to the sea', 'victory', 60));
    tl.at(22.0, () => {
      st.hud.letterbox(false);
      d.results();
    });
    tl.at(4.4, () => ((this.yetiState = 'pause'), (this.yetiT = 0), st.setYetiMode('stand')));
    tl.at(5.6, () => ((this.yetiState = 'disgust'), (this.yetiT = 0), st.setYetiMode('disgust'), st.audio.playYetiGrowl(st.yetiAI.pos, false)));
    tl.at(7.3, () => ((this.yetiState = 'leave'), (this.yetiT = 0), st.setYetiMode('turnAway')));
  }

  update(dt: number) {
    const st = this.st;
    const t = this.d.tl.time;
    this.d.cheer = damp(this.d.cheer, t < 0.4 ? 0.3 : 1, 2, dt);
    // the plunge (Harbour.plunge drives the guest's arc and the splash)
    if (this.plungeT >= 0) {
      this.plungeT += dt;
      const h = this.r as Harbour;
      h.plunge = Math.min(1, this.plungeT / 1.25);
    }
    const ya = st.yetiAI;
    this.yetiT += dt;
    const target = this.yetiStop;
    if (this.yetiState === 'approach') {
      const dd = Math.hypot(target.x - ya.pos.x, target.z - ya.pos.z);
      const hdg = Math.atan2(target.x - ya.pos.x, target.z - ya.pos.z);
      ya.heading = wrapAngle(ya.heading + wrapAngle(hdg - ya.heading) * Math.min(1, dt * 4));
      const sp = Math.min(Math.max(14, dd / Math.max(0.3, 4.2 - t)), dd * 2.2);
      ya.pos.x += Math.sin(ya.heading) * sp * dt;
      ya.pos.z += Math.cos(ya.heading) * sp * dt;
      st.yetiAnim.speed = sp;
      st.setYetiMode(sp > 3 ? 'run' : 'walk');
      if (dd < 0.8) {
        ya.pos.copy(target);
        st.yetiAnim.speed = 0;
        st.setYetiMode('stand');
      }
    } else if (this.yetiState === 'pause' || this.yetiState === 'disgust') {
      st.yetiAnim.speed = 0;
      const hdg = Math.atan2(this.stopPoint.x - ya.pos.x, this.stopPoint.z - ya.pos.z);
      ya.heading = wrapAngle(ya.heading + wrapAngle(hdg - ya.heading) * Math.min(1, dt * 5));
    } else {
      // back up the mountain
      const away = Math.PI + 0.3;
      ya.heading = wrapAngle(ya.heading + wrapAngle(away - ya.heading) * Math.min(1, dt * 2));
      const sp = Math.min(2.6, this.yetiT * 1.5);
      ya.pos.x += Math.sin(ya.heading) * sp * dt;
      ya.pos.z += Math.cos(ya.heading) * sp * dt;
      st.yetiAnim.speed = sp;
      if (this.yetiT > 6) st.yeti.setVisible(false);
    }
    ya.pos.y = st.world.mountain.heightAt(ya.pos.x, ya.pos.z);
    st.yeti.root.position.copy(ya.pos);
    st.yeti.root.rotation.set(0, ya.heading, 0);
    this.trophy.update(dt);
  }
}
