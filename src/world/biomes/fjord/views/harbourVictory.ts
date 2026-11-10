/**
 * "fjord-harbour" victory (round 2: the Fjord's own script, not the Alpine beat sheet with swaps).
 *
 *  0.0  Onto the quay: a low tracking shot at ski height as the skier glides off the snow onto the
 *       granite setts of the harbour street, painted houses sliding past, and sprays to a stop.
 *  3.4  The fish racks: up at the snow line the Yeti stops at the big stockfish rack ("hjell"),
 *       sniffs, yanks a dried cod off the rail, takes a hopeful bite… gags, flings it away and
 *       stomps back up the mountain. Staged at the rack, the hanging fish framing him.
 *  7.6  The presentation: the harbourmaster in yellow oilskins, standing on the fish crates, lifts
 *       the gilded lighthouse (over the skier's shoulder, his face to camera) and tosses it across;
 *       reverse angle on the skier catching it and holding it up, the descent behind them.
 * 12.0  Après on the quay: from the water side of the bathing pier — the steaming tub with its
 *       bathers, the bonfire basket and the sauna smoking behind — a bather in a red robe runs off
 *       the pier end and cannonballs (tucked) into the fjord; cut low to the water for the splash.
 * 15.6  The reveal: from low over the sea beyond the lighthouse the camera rises and pulls back over
 *       the open fjord until it is looking up at the summit you started from, the harbour tiny at
 *       the foot of the wall. The title lands only once the move has settled (20.8 s) and the last
 *       frame holds before the results (24.4 s).
 */
import * as THREE from 'three';
import { ease, pose } from '../../../../cinematic/Timeline';
import type { Stage } from '../../../../game/Stage';
import { damp, wrapAngle } from '../../../../core/rng';
import type { FinishEnvironment, VictoryDirector, VictoryScript } from '../../../presentation/finish';
import { TrophyHandoff } from '../../../../cinematic/victory/trophy';
import type { Harbour } from './harbour';

/** the beat times (exported for tests / evidence) */
export const HARBOUR_BEATS = { quay: 0, racks: 3.4, present: 7.6, toss: 9.3, apres: 12.0, plunge: 13.0, splashCut: 13.9, reveal: 15.6, title: 20.8, revealEnd: 23.9, results: 24.4 } as const;

export class HarbourVictory implements VictoryScript {
  private trophy: TrophyHandoff;
  private yetiStop = new THREE.Vector3();
  private yetiState: 'approach' | 'sniff' | 'grab' | 'bite' | 'disgust' | 'leave' = 'approach';
  private yetiT = 0;
  private stopPoint: THREE.Vector3;
  private plungeT = -1;
  private fish: THREE.Mesh;
  private fishState: 'hidden' | 'held' | 'flying' | 'down' = 'hidden';
  private fishVel = new THREE.Vector3();
  private presentT = -1;
  private trophyFrom = new THREE.Vector3();
  private hand = new THREE.Vector3();

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
    const B = HARBOUR_BEATS;
    st.yetiManual = true;

    // a dried cod for the gag (a flattened, split fish: tail and two halves), hidden until grabbed
    {
      const g = new THREE.ConeGeometry(0.14, 0.95, 5).scale(1, 1, 0.35);
      const mtl = new THREE.MeshStandardMaterial({ color: 0xb9a172, roughness: 0.8 });
      this.fish = new THREE.Mesh(g, mtl);
      this.fish.visible = false;
      this.fish.castShadow = true;
      st.world.scene.add(this.fish);
    }

    const ya = st.yetiAI;
    if (ya.pos.distanceTo(this.yetiStop) > 70) {
      const p = this.yetiStop.clone().add(new THREE.Vector3(-26, 0, -38));
      ya.pos.set(p.x, m.heightAt(p.x, p.z), p.z);
    }
    const rack = h.rack ? h.rack.clone() : this.yetiStop.clone().add(new THREE.Vector3(3, 0, 2));
    const presentAt = h.presentAt ? h.presentAt.clone() : F.clone().add(new THREE.Vector3(-5.5, 0, 38.5));
    const presHead = () => presentAt.clone().add(new THREE.Vector3(0, 0.55 + 1.75, 0));
    const yetiHead = () => st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.5, 0));

    // 1) onto the quay: low tracking at ski height, houses sliding past, to the stop
    tl.shot({
      start: B.quay,
      end: B.racks,
      from: () => pose(sk().add(new THREE.Vector3(-3.4, 0.55, 2.2)), sk().add(new THREE.Vector3(0.4, 0.8, 9)), 52),
      to: () => pose(sk().add(new THREE.Vector3(-4.6, 1.3, 3.6)), sk().add(new THREE.Vector3(0, 1.0, 0)), 46),
      easing: ease.inOut,
    });
    // 2) the fish racks: the Yeti arrives past the end of the rack, hanging fish in the foreground
    tl.shot({
      start: B.racks,
      end: 5.3,
      from: () => pose(rack.clone().add(new THREE.Vector3(8.5, 2.5, -15.5)), yetiHead().add(new THREE.Vector3(0, -0.3, 2.0)), 42),
      to: () => pose(rack.clone().add(new THREE.Vector3(7.6, 2.3, -14.2)), yetiHead().add(new THREE.Vector3(0, -0.3, 1.5)), 38),
    });
    // 2b) closer: grab, bite, gag, fling
    tl.shot({
      start: 5.3,
      end: B.present,
      from: () => pose(this.yetiStop.clone().add(new THREE.Vector3(4.6, 2.0, -4.4)), yetiHead().add(new THREE.Vector3(0, -0.2, 0.6)), 38),
      to: () => pose(this.yetiStop.clone().add(new THREE.Vector3(5.0, 1.9, -5.0)), yetiHead().add(new THREE.Vector3(0, -0.3, 0.6)), 40),
      handheld: 0.02,
    });
    // 3) the presentation: over the skier's shoulder onto the harbourmaster's face and the trophy
    //    (framed from where the skier actually stopped: the lens tightens with the distance)
    const ots = (back: number, side: number, lift: number) => () => {
      const s = sk();
      const ph = presHead();
      const dir = ph.clone().sub(s).setY(0);
      const dist = Math.max(1, dir.length());
      dir.normalize();
      const right = new THREE.Vector3(dir.z, 0, -dir.x);
      const cam = s.clone().addScaledVector(dir, -back).addScaledVector(right, side).add(new THREE.Vector3(0, 1.75 + lift, 0));
      const fov = THREE.MathUtils.clamp(26 + 70 / dist, 24, 40);
      return pose(cam, ph.clone().add(new THREE.Vector3(0, -0.15, 0)), fov);
    };
    tl.shot({ start: B.present, end: B.toss + 0.4, from: ots(1.6, 0.75, 0.15), to: ots(1.3, 0.65, 0.1) });
    // 3b) reverse: the skier's face as the lighthouse lands in their hand; the descent behind
    const toPres = () => presentAt.clone().sub(sk()).setY(0).normalize();
    tl.shot({
      start: B.toss + 0.4,
      end: B.apres,
      from: () => {
        const d2 = toPres();
        const right = new THREE.Vector3(d2.z, 0, -d2.x);
        return pose(sk().addScaledVector(d2, 4.6).addScaledVector(right, -1.4).add(new THREE.Vector3(0, 1.45, 0)), sk().add(new THREE.Vector3(0, 1.5, 0)), 46);
      },
      to: () => {
        const d2 = toPres();
        const right = new THREE.Vector3(d2.z, 0, -d2.x);
        return pose(sk().addScaledVector(d2, 4.0).addScaledVector(right, -1.8).add(new THREE.Vector3(0, 1.3, 0)), sk().add(new THREE.Vector3(0, 1.7, 0)), 46);
      },
      easing: ease.inOut,
    });
    // 4) après: from the water side of the bathing pier (tub near, bonfire and sauna behind)
    const hb = r as Harbour;
    const from = hb.plungeFrom ?? tub;
    const to = hb.plungeTo ?? tub;
    tl.shot({
      start: B.apres,
      end: B.splashCut,
      from: () => pose(tub.clone().add(new THREE.Vector3(2.5, 3.0, 12.5)), tub.clone().add(new THREE.Vector3(-1.8, 0.8, -2.5)), 50),
      to: () => pose(tub.clone().add(new THREE.Vector3(3.3, 2.7, 12.0)), tub.clone().add(new THREE.Vector3(0.2, 0.9, -1.5)).lerp(from, 0.3), 50),
    });
    // 4b) low over the water for the cannonball and the splash
    tl.shot({
      start: B.splashCut,
      end: B.reveal,
      from: () => pose(to.clone().add(new THREE.Vector3(-4.5, 2.8, 8.0)), to.clone().add(new THREE.Vector3(-0.5, 0.9, 0)), 46),
      to: () => pose(to.clone().add(new THREE.Vector3(-5.0, 2.6, 8.6)), to.clone().add(new THREE.Vector3(-0.3, 0.5, 0)), 48),
    });
    // 5) the reveal: from low over the sea past the lighthouse, rise and pull back over the open
    //    fjord (the headland frames the right edge) until the camera looks up at the summit
    const sea = hb.seaward ? hb.seaward.clone() : F.clone().add(new THREE.Vector3(60, 5, 300));
    const xs = m.routeX(0);
    const summit = new THREE.Vector3(xs, m.heightAt(xs, 0) + 30, 0);
    const harbourLook = F.clone().add(new THREE.Vector3(0, 8, 150));
    // the camera stays out over the open fjord (−x of the harbour mouth) so the headland on +x
    // only frames the right edge of the picture (round 2: C5/A 11c)
    const endPos = sea.clone().add(new THREE.Vector3(-700, 360, 1500));
    tl.shot({
      start: B.reveal,
      end: B.revealEnd,
      from: () => pose(sea.clone().add(new THREE.Vector3(-110, -2, 40)), harbourLook.clone(), 40),
      via: () => pose(sea.clone().add(new THREE.Vector3(-430, 100, 620)), harbourLook.clone().lerp(summit, 0.5), 44),
      to: () => pose(endPos, summit.clone().lerp(harbourLook, 0.18), 46),
      easing: ease.inOutCubic,
    });
    // hold the final frame until the results
    tl.shot({ start: B.revealEnd, end: B.results + 0.2, from: () => pose(endPos, summit.clone().lerp(harbourLook, 0.18), 46), to: () => pose(endPos.clone().add(new THREE.Vector3(0, 6, 20)), summit.clone().lerp(harbourLook, 0.18), 46) });

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
    // the Yeti at the rack
    tl.at(4.3, () => ((this.yetiState = 'sniff'), (this.yetiT = 0), st.setYetiMode('stand')));
    tl.at(4.9, () => ((this.yetiState = 'grab'), (this.yetiT = 0), st.setYetiMode('grab')));
    tl.at(5.45, () => {
      this.fishState = 'held';
      this.fish.visible = true;
    });
    tl.at(5.7, () => ((this.yetiState = 'bite'), (this.yetiT = 0), st.setYetiMode('eat')));
    tl.at(6.45, () => {
      this.yetiState = 'disgust';
      this.yetiT = 0;
      st.setYetiMode('disgust');
      st.audio.playYetiGrowl(st.yetiAI.pos, false);
      st.hud.caption('[the Yeti gags on a dried cod]', 1.8);
    });
    tl.at(6.9, () => {
      // fling the fish away down the slope
      this.fishState = 'flying';
      const away = this.stopPoint.clone().sub(st.yetiAI.pos).setY(0).normalize();
      this.fishVel.set(-away.z * 3 - away.x * 2, 5.5, away.x * 3 - away.z * 2);
    });
    tl.at(7.3, () => ((this.yetiState = 'leave'), (this.yetiT = 0), st.setYetiMode('turnAway')));
    // the presentation
    tl.at(B.present, () => {
      this.presentT = 0;
      r.trophy.getWorldPosition(this.trophyFrom);
      if (r.trophy.parent !== st.world.scene) st.world.scene.attach(r.trophy);
      st.audio.playCrowdCheer(0.8);
    });
    tl.at(B.toss, () => {
      this.presentT = -1;
      this.trophy.start();
      st.audio.playCrowdCheer(1);
    });
    tl.at(B.toss + 1.4, () => (d.welcome = 1));
    tl.at(B.plunge, () => (this.plungeT = 0));
    tl.at(14.3, () => st.audio.playCrowdCheer(1));
    tl.at(B.title, () => st.hud.title('YOU REACHED THE SEA', 'Fjord Coast — from the summit to the harbour', 'victory scrim', 3.6));
    tl.at(B.results, () => {
      st.hud.letterbox(false);
      d.results();
    });
  }

  update(dt: number) {
    const st = this.st;
    const t = this.d.tl.time;
    this.d.cheer = damp(this.d.cheer, t < 0.4 ? 0.3 : 1, 2, dt);
    const h = this.r as Harbour;
    // the presentation: the trophy rises from the crates into the harbourmaster's raised hand
    if (this.presentT >= 0 && h.presenter) {
      this.presentT += dt;
      h.presenter.handWorld('R', this.hand);
      const k = Math.min(1, this.presentT / 0.7);
      this.r.trophy.position.copy(this.trophyFrom).lerp(this.hand.add(new THREE.Vector3(0, 0.12, 0)), ease.inOut(k));
      this.r.trophy.rotation.set(0, Math.PI + this.presentT * 0.6, 0);
    }
    // the plunge (Harbour.plunge drives the guest's arc, tuck and the splash)
    if (this.plungeT >= 0) {
      this.plungeT += dt;
      h.plunge = Math.min(1, this.plungeT / 1.25);
    }
    // the fish prop
    if (this.fishState === 'held') {
      st.yeti.getHandWorldPosition('right', this.hand);
      this.fish.position.copy(this.hand);
      this.fish.rotation.set(Math.PI, st.yetiAI.heading, 0.3);
    } else if (this.fishState === 'flying') {
      this.fishVel.y -= 9.81 * dt;
      this.fish.position.addScaledVector(this.fishVel, dt);
      this.fish.rotation.x += dt * 9;
      const g = st.world.mountain.heightAt(this.fish.position.x, this.fish.position.z);
      if (this.fish.position.y < g + 0.05) {
        this.fish.position.y = g + 0.05;
        this.fish.rotation.set(Math.PI / 2, 0, 0.4);
        this.fishState = 'down';
      }
    }
    const ya = st.yetiAI;
    this.yetiT += dt;
    const target = this.yetiStop;
    if (this.yetiState === 'approach') {
      const dd = Math.hypot(target.x - ya.pos.x, target.z - ya.pos.z);
      const hdg = Math.atan2(target.x - ya.pos.x, target.z - ya.pos.z);
      ya.heading = wrapAngle(ya.heading + wrapAngle(hdg - ya.heading) * Math.min(1, dt * 4));
      const sp = Math.min(Math.max(10, dd / Math.max(0.3, 4.2 - t)), dd * 2.2);
      ya.pos.x += Math.sin(ya.heading) * sp * dt;
      ya.pos.z += Math.cos(ya.heading) * sp * dt;
      st.yetiAnim.speed = sp;
      st.setYetiMode(sp > 3 ? 'run' : 'walk');
      if (dd < 0.8) {
        ya.pos.copy(target);
        st.yetiAnim.speed = 0;
        st.setYetiMode('stand');
      }
    } else if (this.yetiState !== 'leave') {
      // face the rack (the hanging fish) while he sniffs, grabs, bites and gags
      st.yetiAnim.speed = 0;
      const rack = h.rack ?? this.stopPoint;
      const hdg = Math.atan2(rack.x - ya.pos.x, rack.z - ya.pos.z);
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
    if (t >= HARBOUR_BEATS.results && this.fish.parent) {
      this.fish.removeFromParent();
      this.fish.geometry.dispose();
      (this.fish.material as THREE.Material).dispose();
    }
  }
}
