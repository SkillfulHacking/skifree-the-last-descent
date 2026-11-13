/**
 * "fjord-harbour" victory: the Fjord's own script, not the Alpine beat sheet with swaps.
 * Round 3 (C2–C6, A8/A9/A11, F5): every beat on the quay is framed with the harbour and the sea
 * behind it.
 *
 *  0.0  Onto the quay: a low tracking shot from behind and beside the skier, down the village
 *       street to the quay, the boats and the fjord, as the skier glides onto the setts and stops.
 *  3.4  The fish rack on the quay: the Yeti (who has followed down the street) arrives at the
 *       stockfish rack by the water, sniffs, yanks a dried cod off the rail, turns to us and takes a
 *       hopeful bite… gags, flings it into the harbour and stomps off. Filmed from up the street,
 *       facing him: his face, the cod at his mouth, the rack, the boats and the islands behind.
 *  7.6  The presentation: the harbourmaster steps up face to face with the skier, holding the gilded
 *       lighthouse in both hands by its plinth (over the skier's shoulder, his face to camera, the
 *       quay and the sea behind him), lifts it, and tosses it; reverse angle on the skier catching it
 *       and holding it up, the descent behind them (the skis clear of the letterbox).
 * 12.0  Après on the pier: the steaming tub, the bonfire and the sauna; a bather in a red robe
 *       sprints across the deck, springs off the edge, balls up in a cannonball that hangs at the top
 *       of its arc and hits the fjord in a crown of spray (cut low over the water at 14.0 s).
 * 17.2  The reveal: from low over the sea beyond the lighthouse the camera rises and pulls back over
 *       the open fjord until it rests on the whole descent, the start marked by a burning beacon on
 *       its shoulder and the harbour tiny at the foot of the wall. The title lands only once the
 *       camera has settled (24.0 s) and holds 2.6 s before the results (26.6 s).
 */
import * as THREE from 'three';
import { ease, pose } from '../../../../cinematic/Timeline';
import type { Stage } from '../../../../game/Stage';
import { damp, wrapAngle } from '../../../../core/rng';
import type { FinishEnvironment, VictoryDirector, VictoryScript } from '../../../presentation/finish';
import { TrophyHandoff } from '../../../../cinematic/victory/trophy';
import { PLUNGE_TIMES, type Harbour } from './harbour';

/** the beat times (exported for tests / evidence) */
export const HARBOUR_BEATS = { quay: 0, racks: 3.4, present: 7.6, toss: 9.3, apres: 12.0, plunge: 13.1, splashCut: 14.0, reveal: 17.2, revealEnd: 23.8, title: 24.0, results: 26.6 } as const;

export class HarbourVictory implements VictoryScript {
  private trophy: TrophyHandoff;
  private yetiStop = new THREE.Vector3();
  private yetiState: 'wait' | 'approach' | 'sniff' | 'grab' | 'bite' | 'disgust' | 'leave' = 'wait';
  private yetiT = 0;
  private stopPoint: THREE.Vector3;
  private plungeT = -1;
  private fish: THREE.Mesh;
  private fishState: 'hidden' | 'held' | 'flying' | 'down' = 'hidden';
  private fishVel = new THREE.Vector3();
  private presentT = -1;
  private trophyFrom = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private hand2 = new THREE.Vector3();
  private beacon: THREE.Sprite | null = null;
  private beaconTex: THREE.Texture | null = null;
  private faceYeti = new THREE.Vector3();

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
      // a stockfish: a flat, split, headless body tapering to a forked tail (0.62 m), not a cone
      const sh = new THREE.Shape();
      sh.moveTo(-0.09, 0.31);
      sh.quadraticCurveTo(-0.12, 0.05, -0.04, -0.2);
      sh.lineTo(-0.1, -0.31);
      sh.lineTo(0.0, -0.25);
      sh.lineTo(0.1, -0.31);
      sh.lineTo(0.04, -0.2);
      sh.quadraticCurveTo(0.12, 0.05, 0.09, 0.31);
      sh.lineTo(-0.09, 0.31);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false }).translate(0, 0, -0.012);
      const mtl = new THREE.MeshStandardMaterial({ color: 0xb9a172, roughness: 0.8, side: THREE.DoubleSide });
      this.fish = new THREE.Mesh(g, mtl);
      this.fish.visible = false;
      this.fish.castShadow = true;
      st.world.scene.add(this.fish);
    }

    const ya = st.yetiAI;
    // he stays out of shot (behind the skier) until he is brought down the street at 3.3 s
    // where the harbourmaster stands for the presentation: on his crates by default; at the beat he
    // steps up face to face with the skier wherever (and however turned) the skier came to rest
    const presentAt = h.presentAt ? h.presentAt.clone() : F.clone().add(new THREE.Vector3(-5.5, 0, 38.5));
    let presTop = 0.55;
    const presHead = () => (h.presenter ? h.presenter.position.clone().add(new THREE.Vector3(0, 1.75, 0)) : presentAt.clone().add(new THREE.Vector3(0, presTop + 1.75, 0)));
    const yetiHead = () => st.yetiAI.pos.clone().add(new THREE.Vector3(0, 2.5, 0));

    // 1) onto the quay: low, behind and beside the skier, looking down the street to the water
    tl.shot({
      start: B.quay,
      end: B.racks,
      from: () => pose(sk().add(new THREE.Vector3(-3.0, 0.7, -3.2)), sk().add(new THREE.Vector3(0.6, 0.6, 14)), 50),
      to: () => pose(sk().add(new THREE.Vector3(-3.6, 1.4, -2.0)), sk().add(new THREE.Vector3(0.8, 1.0, 8)), 48),
      easing: ease.inOut,
    });
    // the gag is staged at the quay rack: the Yeti comes down the street off camera during shot 1
    tl.at(3.3, () => {
      const p = this.yetiStop.clone().add(new THREE.Vector3(-9, 0, -12));
      ya.pos.set(p.x, m.heightAt(p.x, p.z), p.z);
      ya.heading = Math.atan2(this.yetiStop.x - p.x, this.yetiStop.z - p.z);
      this.yetiState = 'approach';
      st.yeti.setVisible(true);
    });
    // 2) the Yeti arrives at the rack on the quay: from up the street, the harbour behind him
    tl.shot({
      start: B.racks,
      end: 5.3,
      from: () => pose(this.yetiStop.clone().add(new THREE.Vector3(7.5, 4.2, -13.5)), this.yetiStop.clone().add(new THREE.Vector3(-1.0, 1.6, 3.0)), 44),
      to: () => pose(this.yetiStop.clone().add(new THREE.Vector3(6.4, 3.4, -11.5)), this.yetiStop.clone().add(new THREE.Vector3(-0.6, 1.8, 2.5)), 42),
    });
    // 2b) closer, facing him: he turns from the rack to us to bite, gags, flings the cod
    tl.shot({
      start: 5.3,
      end: B.present,
      from: () => pose(this.yetiStop.clone().add(new THREE.Vector3(4.4, 2.0, -4.9)), yetiHead().add(new THREE.Vector3(-0.5, -0.4, 0)), 42),
      to: () => pose(this.yetiStop.clone().add(new THREE.Vector3(4.8, 2.1, -5.3)), yetiHead().add(new THREE.Vector3(-0.5, -0.35, 0)), 44),
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
      const fov = THREE.MathUtils.clamp(30 + 70 / dist, 28, 46);
      // aim a little above his face: the lighthouse he holds up stays inside the letterbox
      return pose(cam, ph.clone().add(new THREE.Vector3(0, 0.15, 0)), fov);
    };
    tl.shot({ start: B.present, end: B.toss + 0.4, from: ots(1.9, 1.05, 0.1), to: ots(1.6, 0.95, 0.05) });
    // 3b) the catch: from up the slope behind the skier's shoulder, looking down at the pair with the
    //    harbour and the open fjord behind the harbourmaster (the sea lies down the fall line, +z).
    //    Round 7: both profile sides framed land (C r5 #2, F r6 #2) — the sea is not to either side
    //    here, it is ahead, beyond the quay.
    const toPres = () => presentAt.clone().sub(sk()).setY(0).normalize();
    tl.shot({
      start: B.toss + 0.4,
      end: B.apres,
      from: () => {
        const mid = sk().lerp(presentAt, 0.5).add(new THREE.Vector3(0, 1.3, 0));
        return pose(sk().add(new THREE.Vector3(1.6, 2.6, -4.6)), mid.clone().add(new THREE.Vector3(0, 0.2, 6)), 46);
      },
      to: () => {
        const mid = sk().lerp(presentAt, 0.5).add(new THREE.Vector3(0, 1.3, 0));
        return pose(sk().add(new THREE.Vector3(1.9, 2.4, -4.1)), mid.clone().add(new THREE.Vector3(0, 0.2, 6)), 44);
      },
      easing: ease.inOut,
    });
    void toPres;
    // 4) après: from the water side of the bathing pier (tub near, bonfire and sauna behind); the
    //    camera drifts to keep the bather's run across the deck in frame
    const hb = r as Harbour;
    const from = hb.plungeFrom ?? tub;
    const edge = hb.plungeEdge ?? from;
    const to = hb.plungeTo ?? tub;
    tl.shot({
      start: B.apres,
      end: B.splashCut,
      from: () => pose(tub.clone().add(new THREE.Vector3(2.5, 3.0, 12.5)), tub.clone().add(new THREE.Vector3(-1.8, 0.8, -2.5)), 50),
      to: () => pose(tub.clone().add(new THREE.Vector3(4.6, 2.8, 12.4)), tub.clone().add(new THREE.Vector3(0.6, 0.9, -1.0)).lerp(edge, 0.45), 52),
    });
    // 4b) low over the water, side-on to the jump: the spring, the cannonball, the crown splash
    const mid = edge.clone().lerp(to, 0.5);
    tl.shot({
      start: B.splashCut,
      end: B.reveal,
      from: () => pose(mid.clone().add(new THREE.Vector3(-1.5, -0.6, 9.5)), mid.clone().add(new THREE.Vector3(0, 0.6, 0)), 50),
      to: () => pose(mid.clone().add(new THREE.Vector3(-2.2, -0.8, 10.4)), to.clone().add(new THREE.Vector3(-0.4, 1.0, 0)), 50),
    });
    // 5) the reveal: from low over the sea past the lighthouse, rise and pull back over the open
    //    fjord (the headland frames the right edge) and come to rest on the whole descent: the start,
    //    marked by a beacon on its shoulder, in the upper third; the harbour at the foot
    const sea = hb.seaward ? hb.seaward.clone() : F.clone().add(new THREE.Vector3(60, 5, 300));
    const xs = m.routeX(0);
    const summit = new THREE.Vector3(xs, m.heightAt(xs, 0) + 30, 0);
    const harbourLook = F.clone().add(new THREE.Vector3(0, 8, 150));
    const endPos = sea.clone().add(new THREE.Vector3(-760, 430, 1650));
    const endLook = summit.clone().lerp(harbourLook, 0.3);
    tl.shot({
      start: B.reveal,
      end: B.revealEnd,
      from: () => pose(sea.clone().add(new THREE.Vector3(-110, -2, 40)), harbourLook.clone(), 40),
      via: () => pose(sea.clone().add(new THREE.Vector3(-460, 120, 700)), harbourLook.clone().lerp(summit, 0.5), 44),
      to: () => pose(endPos, endLook, 46),
      easing: ease.inOutCubic,
    });
    // settled: hold the final frame (a slow drift, no move) through the title until the results
    tl.shot({ start: B.revealEnd, end: B.results + 0.2, from: () => pose(endPos, endLook, 46), to: () => pose(endPos.clone().add(new THREE.Vector3(0, 1.5, 4)), endLook, 46) });
    // the beacon on the start's shoulder: lit as the reveal begins, so the eye finds the summit
    {
      // round-3 C #6: additive orange over sunlit snow clipped to a white disc. A fire instead:
      // normal blending, a dark smoke plume above an opaque orange flame with a hot core and a
      // dark rim, so it reads against both snow and sky
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 128;
      const g = c.getContext('2d')!;
      // smoke plume (upper half), drifting a little to one side
      for (let i = 0; i < 7; i++) {
        const y = 66 - i * 9;
        const x = 32 + i * 1.6;
        const r = 7 + i * 1.8;
        const sg = g.createRadialGradient(x, y, 0, x, y, r);
        sg.addColorStop(0, `rgba(48,44,42,${0.55 - i * 0.06})`);
        sg.addColorStop(1, 'rgba(48,44,42,0)');
        g.fillStyle = sg;
        g.fillRect(0, 0, 64, 128);
      }
      // flame: a teardrop, dark-rimmed
      const flame = (scale: number, fill: string) => {
        g.beginPath();
        g.moveTo(32, 96 - 30 * scale);
        g.bezierCurveTo(32 + 14 * scale, 96 - 12 * scale, 32 + 13 * scale, 96 + 10 * scale, 32, 96 + 12 * scale);
        g.bezierCurveTo(32 - 13 * scale, 96 + 10 * scale, 32 - 14 * scale, 96 - 12 * scale, 32, 96 - 30 * scale);
        g.fillStyle = fill;
        g.fill();
      };
      flame(1.12, 'rgba(70,24,8,0.9)');
      flame(1, 'rgb(236,96,22)');
      flame(0.62, 'rgb(255,170,60)');
      flame(0.3, 'rgb(255,226,150)');
      this.beaconTex = new THREE.CanvasTexture(c);
      this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.beaconTex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, toneMapped: false }));
      this.beacon.position.set(xs, m.heightAt(xs, 0) + 12, 0);
      this.beacon.center.set(0.5, 0.2);
      this.beacon.scale.setScalar(0);
      this.beacon.renderOrder = 10;
      st.world.scene.add(this.beacon);
    }

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
    this.faceYeti.copy(this.yetiStop).add(new THREE.Vector3(4.4, 0, -4.9));
    tl.at(5.7, () => ((this.yetiState = 'bite'), (this.yetiT = 0), st.setYetiMode('eat')));
    tl.at(6.45, () => {
      this.yetiState = 'disgust';
      this.yetiT = 0;
      st.setYetiMode('gag');
      st.audio.playYetiGrowl(st.yetiAI.pos, false);
      st.hud.caption('[the Yeti gags on a dried cod]', 1.8);
    });
    tl.at(6.9, () => {
      // fling the fish away down the slope
      this.fishState = 'flying';
      // over his shoulder, into the harbour behind him
      this.fishVel.set(-1.2, 6.0, 5.2);
    });
    tl.at(7.3, () => ((this.yetiState = 'leave'), (this.yetiT = 0), st.setYetiMode('turnAway')));
    // the presentation
    tl.at(B.present, () => {
      if (h.presenter) {
        const s0 = sk();
        // always on the seaward side of the skier (downhill): the over-the-shoulder shot then has
        // the quay and the fjord behind him, and the reverse angle the descent behind the skier
        const at = s0.clone().add(new THREE.Vector3(0.5, 0, 3.1));
        h.presenter.place(at.x, at.z, Math.atan2(s0.x - at.x, s0.z - at.z), null);
        presTop = 0;
        presentAt.copy(h.presenter.position);
        // he holds the lighthouse in both hands by its plinth as the shot opens
        h.presenter.hold = 1;
        h.presenter.holdLift = 0;
        h.presenter.holdSide = 0;
        h.presenter.update(0, 0, 0, null, 0);
        h.presenter.handWorld('R', this.trophyFrom);
      } else r.trophy.getWorldPosition(this.trophyFrom);
      this.presentT = 0;
      if (r.trophy.parent !== st.world.scene) st.world.scene.attach(r.trophy);
      st.audio.playCrowdCheer(0.8);
    });
    tl.at(B.toss, () => {
      this.presentT = -1;
      if (h.presenter) h.presenter.hold = 0;
      this.trophy.start();
      st.audio.playCrowdCheer(1);
    });
    tl.at(B.toss + 1.4, () => (d.welcome = 1));
    tl.at(B.plunge, () => (this.plungeT = 0));
    tl.at(14.3, () => st.audio.playCrowdCheer(1));
    tl.at(B.title, () => st.hud.title('YOU REACHED THE SEA', 'Fjord Coast — from the summit to the harbour', 'victory scrim', B.results - B.title + 0.4));
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
    // the presentation: the lighthouse in his two hands, by the plinth; he lifts it toward the skier
    if (this.presentT >= 0 && h.presenter) {
      this.presentT += dt;
      // round-3 C #5: held at chest height and off to his side, so his face stays clear of the
      // lighthouse (it used to rise to head height, straight in front of his face)
      const lift = Math.min(1, Math.max(0, (this.presentT - 0.6) / 0.6));
      h.presenter.holdLift = lift * 0.12;
      h.presenter.holdSide = lift * 0.14;
      h.presenter.handWorld('R', this.hand);
      h.presenter.handWorld('L', this.hand2);
      const grip = this.hand.add(this.hand2).multiplyScalar(0.5);
      // the plinth sits in the hands (grip ≈ 0.12 m above its base)
      this.r.trophy.position.copy(grip).add(new THREE.Vector3(0, -0.14, 0));
      this.r.trophy.rotation.set(0, h.presenter.group.rotation.y + Math.PI, 0);
    }
    // the plunge (Harbour.plunge drives the run-up, the cannonball and the splash)
    if (this.plungeT >= 0) {
      this.plungeT += dt;
      h.plunge = Math.min(1, this.plungeT / PLUNGE_TIMES.total);
      if (h.splashNow) {
        h.splashNow = false;
        const p = h.plungeTo;
        // droplets thrown up and out of the crown
        st.world.particles.emit({ x: p.x, y: h.sea + 0.3, z: p.z, vx: 0, vy: 5.5, vz: 0, spread: 1.8, size: 0.16, life: 1.5, count: 110, gravity: 1, drag: 0.25, grow: 0.1, alpha: 1, color: 1 });
        st.world.particles.emit({ x: p.x, y: h.sea + 0.6, z: p.z, vx: 0, vy: 1.2, vz: 0, spread: 1.4, size: 0.9, life: 1.6, count: 14, gravity: 0.3, drag: 1.4, grow: 1.4, alpha: 0.5, color: 0.98 });
        st.audio.playCrowdCheer(1);
      }
    }
    // the beacon on the start, during the reveal
    if (this.beacon) {
      const tb = t - HARBOUR_BEATS.reveal;
      const on = Math.min(1, Math.max(0, tb / 1.5)) * (t < HARBOUR_BEATS.results ? 1 : 0);
      const flick = 0.85 + 0.15 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1);
      // constant on-screen size (sizeAttenuation off); 1:2 canvas → 1:2 sprite; only the flame flickers
      this.beacon.scale.set(0.022 * on, 0.044 * on * (0.94 + 0.4 * (flick - 0.85)), 1);
    }
    // the fish prop: in his fist; at his mouth for the bite
    if (this.fishState === 'held') {
      st.yeti.getHandWorldPosition('right', this.hand);
      const hd = st.yetiAI.heading;
      // round-3 C #4: the stockfish is a flat, split body (local XY plane, long axis local Y). In
      // the fist it hangs tail-down with its flat side to the lens (he faces the camera for the
      // gag); for the bite it is clamped crosswise between the teeth, the head end in the mouth and
      // the tail sticking out of the side of the mouth (not up the nose)
      if (this.yetiState === 'bite') {
        const mouth = new THREE.Vector3();
        st.yeti.getMouthWorldPosition(mouth);
        const k = Math.min(1, this.yetiT / 0.25);
        // fish centre: half a fish to his left of the mouth, a little in front of the lips
        const side = 0.24;
        mouth.add(new THREE.Vector3(Math.sin(hd) * 0.07 - Math.cos(hd) * side, -0.02, Math.cos(hd) * 0.07 + Math.sin(hd) * side));
        this.hand.lerp(mouth, k);
        this.fish.position.copy(this.hand);
        // long axis across the mouth (Rz first), flat side forward (yaw = heading)
        this.fish.rotation.set(0, hd, Math.PI / 2 + 0.12 * k);
      } else {
        this.fish.position.copy(this.hand).add(new THREE.Vector3(0, -0.22, 0));
        this.fish.rotation.set(0.15, hd, 0.25);
      }
    } else if (this.fishState === 'flying') {
      this.fishVel.y -= 9.81 * dt;
      this.fish.position.addScaledVector(this.fishVel, dt);
      this.fish.rotation.x += dt * 9;
      const g = Math.max(st.world.mountain.heightAt(this.fish.position.x, this.fish.position.z), h.sea ?? -Infinity);
      if (this.fish.position.y < g + 0.05) {
        this.fish.position.y = g + 0.05;
        this.fish.rotation.set(Math.PI / 2, 0, 0.4);
        this.fishState = 'down';
        if (h.sea !== undefined && Math.abs(g - h.sea) < 0.01) {
          this.fish.visible = false;
          const fp = this.fish.position;
          st.world.particles.emit({ x: fp.x, y: h.sea + 0.1, z: fp.z, vx: 0, vy: 2.5, vz: 0, spread: 0.5, size: 0.1, life: 0.8, count: 24, gravity: 1, drag: 0.3, grow: 0, alpha: 1, color: 1 });
        }
      }
    }
    const ya = st.yetiAI;
    this.yetiT += dt;
    const target = this.yetiStop;
    if (this.yetiState === 'wait') {
      st.yetiAnim.speed = 0;
      st.yeti.setVisible(false);
    } else if (this.yetiState === 'approach') {
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
      // face the rack (the hanging fish) while he sniffs and grabs; then turn to us (the camera up
      // the street) for the bite and the gag, so the joke plays on his face
      st.yetiAnim.speed = 0;
      const rk = h.quayRack && h.quayRack.lengthSq() > 0 ? h.quayRack : (h.rack ?? this.stopPoint);
      const tgt = this.yetiState === 'bite' || this.yetiState === 'disgust' ? this.faceYeti : rk;
      const hdg = Math.atan2(tgt.x - ya.pos.x, tgt.z - ya.pos.z);
      ya.heading = wrapAngle(ya.heading + wrapAngle(hdg - ya.heading) * Math.min(1, dt * 6));
    } else {
      // back up the mountain
      const away = Math.PI + 0.15;
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
    if (t >= HARBOUR_BEATS.results && this.beacon) {
      this.beacon.removeFromParent();
      this.beacon.material.dispose();
      this.beaconTex?.dispose();
      this.beacon = null;
    }
    if (t >= HARBOUR_BEATS.results && this.fish.parent) {
      this.fish.removeFromParent();
      this.fish.geometry.dispose();
      (this.fish.material as THREE.Material).dispose();
    }
  }
}
