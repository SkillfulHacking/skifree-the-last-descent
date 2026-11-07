/**
 * Defeat ("the Yeti was hungry") and victory ("you survived the mountain") sequences.
 * Both run on top of a live world; the outcome is already locked by RunState when they start.
 */
import * as THREE from 'three';
import { Timeline, ease, pose } from './Timeline';
import type { Stage } from '../game/Stage';
import { damp, wrapAngle } from '../core/rng';

export class DefeatCinematic {
  readonly tl = new Timeline();
  held = false;
  swallowed = false;
  onResults: (() => void) | null = null;
  private yetiPos = new THREE.Vector3();
  private side = new THREE.Vector3();

  constructor(private st: Stage) {
    const yp = st.yetiAI.pos.clone();
    this.yetiPos.copy(yp);
    const h = st.yetiAI.heading;
    const fwd = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
    this.side.set(fwd.z, 0, -fwd.x);
    const S = this.side;
    const tl = this.tl;
    st.yetiManual = true;
    const head = new THREE.Vector3();
    tl.shot({ start: 0, end: 1.1, from: () => pose(yp.clone().addScaledVector(S, 7).addScaledVector(fwd, 5).add(new THREE.Vector3(0, 1.4, 0)), yp.clone().addScaledVector(fwd, 1.5).add(new THREE.Vector3(0, 1.6, 0)), 46), to: () => pose(yp.clone().addScaledVector(S, 6.2).addScaledVector(fwd, 4).add(new THREE.Vector3(0, 1.2, 0)), yp.clone().addScaledVector(fwd, 1.2).add(new THREE.Vector3(0, 2.0, 0)), 44) });
    tl.shot({
      start: 1.1,
      end: 4.4,
      from: () => pose(yp.clone().addScaledVector(S, 5.2).addScaledVector(fwd, 3.4).add(new THREE.Vector3(0, 2.0, 0)), yp.clone().add(new THREE.Vector3(0, 2.7, 0)), 40),
      to: () => {
        st.yeti.getHeadWorldPosition(head);
        const hand = st.yeti.getHandWorldPosition('right', new THREE.Vector3());
        return pose(yp.clone().addScaledVector(S, 5.0).addScaledVector(fwd, 2.8).add(new THREE.Vector3(0, 2.2, 0)), head.lerp(hand, 0.45), 40);
      },
      handheld: 0.03,
    });
    tl.shot({ start: 4.4, end: 9, from: () => pose(yp.clone().addScaledVector(S, 4.2).addScaledVector(fwd, 2.6).add(new THREE.Vector3(0, 2.4, 0)), yp.clone().add(new THREE.Vector3(0, 2.4, 0)), 36), to: () => pose(yp.clone().addScaledVector(S, 13).addScaledVector(fwd, 9).add(new THREE.Vector3(0, 6, 0)), yp.clone().add(new THREE.Vector3(0, 1.5, 0)), 44), easing: ease.inOut });

    tl.at(0, () => {
      st.hud.letterbox(true);
      st.hud.gameplayWidgets(false);
      st.setYetiMode('grab');
      st.audio.setMusicMode('defeat');
      st.audio.playDefeatSting();
      st.audio.playExertion('yelp');
      st.shake(0.7);
    });
    tl.at(0.55, () => {
      this.held = true;
    });
    tl.at(1.1, () => st.setYetiMode('eat'));
    tl.at(1.4, () => st.audio.playYetiGrowl(null, false));
    tl.at(2.55, () => {
      this.swallowed = true;
      st.skier.setVisible(false);
      st.audio.playGulp();
      const m = new THREE.Vector3();
      st.yeti.getMouthWorldPosition(m);
      st.world.particles.emit({ x: m.x, y: m.y, z: m.z, vx: 0, vy: 1, vz: 0, spread: 1.5, size: 0.3, life: 1, count: 30, gravity: 0.6, alpha: 0.8 });
    });
    tl.at(3.4, () => st.audio.playBurp());
    tl.at(4.6, () => {
      st.hud.title('LUNCH IS SERVED', 'The Yeti caught you.', 'defeat lower', 30);
    });
    tl.at(7.0, () => this.onResults?.());
  }

  update(_dt: number) {
    const st = this.st;
    st.yeti.root.position.copy(this.yetiPos);
    st.yeti.root.rotation.set(0, st.yetiAI.heading, 0);
    if (this.held && !this.swallowed) {
      // the skier dangles from the yeti's hand, flailing
      const hp = new THREE.Vector3();
      st.yeti.rightHandSocket.getWorldPosition(hp);
      st.skier.root.position.copy(hp).add(new THREE.Vector3(0, -1.55, 0));
      st.skier.root.rotation.set(0.25, st.yetiAI.heading + Math.PI, Math.sin(this.tl.time * 9) * 0.25);
      st.poseOverride = { airborne: true, airTime: 0.5, wobble: 1, crashed: false, lookBack: Math.sin(this.tl.time * 7) * 0.6 };
    }
  }
}

export class VictoryCinematic {
  readonly tl = new Timeline();
  onResults: (() => void) | null = null;
  /** 0..1 how much the game should auto-steer the skier to the stop point */
  autopilot = 1;
  cheer = 0;
  welcome = 0;
  private trophyT = -1;
  private trophyFrom = new THREE.Vector3();
  private yetiStop = new THREE.Vector3();
  private yetiState: 'approach' | 'pause' | 'disgust' | 'leave' = 'approach';
  private yetiT = 0;
  readonly stopPoint = new THREE.Vector3();

  constructor(private st: Stage) {
    const r = st.world.resort!;
    r.getStopPoint(this.stopPoint);
    r.getYetiStopPoint(this.yetiStop);
    const fz = r.finishZ;
    const F = new THREE.Vector3(this.stopPoint.x, st.world.mountain.heightAt(this.stopPoint.x, fz), fz);
    const podium = new THREE.Vector3();
    r.getPodiumTop(podium);
    const tub = new THREE.Vector3();
    r.getHotTubCenter(tub);
    const sk = () => st.skier.root.position.clone();
    const tl = this.tl;
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
      this.autopilot = 0;
      st.audio.playCrowdCheer(1);
    });
    tl.at(8.2, () => {
      this.trophyT = 0;
      r.trophy.getWorldPosition(this.trophyFrom);
      st.audio.playCrowdCheer(1);
    });
    tl.at(9.4, () => (this.welcome = 1));
    tl.at(13.0, () => st.hud.title('YOU SURVIVED THE MOUNTAIN', 'SkiFree — The Last Descent', 'victory', 60));
    tl.at(18.0, () => {
      st.hud.letterbox(false);
      this.onResults?.();
    });
    // the joke, on cue: arrive → stop → stare → disgust → turn away
    tl.at(4.6, () => (this.yetiState = 'pause', (this.yetiT = 0), st.setYetiMode('stand')));
    tl.at(5.6, () => ((this.yetiState = 'disgust'), (this.yetiT = 0), st.setYetiMode('disgust'), st.audio.playYetiGrowl(st.yetiAI.pos, false)));
    tl.at(7.4, () => ((this.yetiState = 'leave'), (this.yetiT = 0), st.setYetiMode('turnAway')))
  }

  update(dt: number) {
    const st = this.st;
    const t = this.tl.time;
    this.cheer = damp(this.cheer, t < 0.4 ? 0.3 : 1, 2, dt);
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
    if (this.trophyT >= 0) {
      this.trophyT += dt;
      const k = Math.min(1, this.trophyT / 1.2);
      const trophy = st.world.resort!.trophy;
      const handPos = new THREE.Vector3();
      st.skier.rightHandSocket.getWorldPosition(handPos);
      if (k < 1) {
        if (trophy.parent !== st.world.scene) st.world.scene.attach(trophy);
        const p = this.trophyFrom.clone().lerp(handPos, ease.inOut(k));
        p.y += Math.sin(k * Math.PI) * 1.5;
        trophy.position.copy(p);
      } else if (trophy.parent !== st.skier.rightHandSocket) {
        st.skier.rightHandSocket.add(trophy);
        // held by the stem: the podium plinth stays behind
        trophy.children.forEach((c, i) => (c.visible = i === 0));
        trophy.position.set(0, -0.32, 0);
        trophy.rotation.set(0, 0, 0);
        trophy.scale.setScalar(0.7);
        st.audio.playCrowdCheer(1);
      }
      st.poseOverride = { celebrate: Math.min(1, this.trophyT / 0.8) };
    }
  }
}
