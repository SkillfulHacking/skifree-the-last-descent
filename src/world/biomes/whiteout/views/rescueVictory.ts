/**
 * "whiteout-rescue" victory: from storm to shelter (round 2, W-042 — full production treatment).
 *
 *  0.0  Into the light: letterbox, the gameplay HUD away, the chase music hands over to the victory
 *       theme. The storm still rages (held at full storm, as thick as the run's). Low behind the
 *       skier through the driving snow toward the hut: the warm windows, the porch light, the red
 *       beacon and the sweeping searchlight the only colour; the rescuers wave them in.
 *  3.4  Safety and welcome: from the snow in front of the porch, looking at the door — the skier
 *       glides into frame and up to the deck as the door swings open (3.8) and warm light spills out.
 *  6.6  The storm lantern: from the storm side, low; the skier in the warm doorway lifts the brass
 *       lantern off its plinth and holds it up (it swells: halo and light), the rescuers cheer.
 *  9.4  Out in the white, past the skier's shoulder and the raised lantern: a shape comes in from
 *       the storm — the Yeti (hidden until 8.8, so he is first seen here).
 * 11.0  The searchlight swings onto him; close on his face as the light hits him — he flinches
 *       (11.4), throws an arm up, and at 13.0 turns and lumbers back into the white.
 * 13.6  The storm breaks over ~5 s (the fanfare): the wind drops, the snow thins, the cloud tears
 *       open while the camera rises and pulls back over the station —
 * 18.6  — and settles: the station in the lower third, the whole ridge the skier came down behind it
 *       in low sun; the title (19.2) and a hold before the results (23.6).
 */
import * as THREE from 'three';
import { ease, pose } from '../../../../cinematic/Timeline';
import type { Stage } from '../../../../game/Stage';
import { damp, wrapAngle } from '../../../../core/rng';
import type { FinishEnvironment, VictoryDirector, VictoryScript } from '../../../presentation/finish';
import { TrophyHandoff } from '../../../../cinematic/victory/trophy';
import type { RescueStation } from './rescue';

/** (round 6, W-104) the welcome shot's camera: 13 m out from the door, low and to one side (see the shot) */
export function welcomePoses(door: THREE.Vector3, faces: THREE.Vector3, across: THREE.Vector3) {
  const at = (out: number, side: number, up: number) => door.clone().addScaledVector(faces, out).addScaledVector(across, side).add(new THREE.Vector3(0, up, 0));
  return {
    from: pose(at(13.5, -2.8, 1.9), at(2.2, 0, 1.2), 46),
    to: pose(at(12.2, -2.4, 1.8), at(1.8, 0, 1.25), 42),
  };
}

/** the Yeti walks in from this far beyond his stop (m) */
const YETI_IN = 14;

export const RESCUE_BEATS = { arrive: 0, welcome: 3.4, door: 3.8, lantern: 6.6, yetiShow: 8.8, yeti: 9.4, light: 11.0, flinch: 11.4, leave: 13.0, clear: 13.6, clearEnd: 18.6, title: 19.2, results: 23.6 } as const;
/** the storm the finish holds until the break (as thick as the run's full storm: storm.ts STORM_FOG) */
export const RESCUE_STORM = { visibility: 20, snowfall: 2.6, storm: 1, windX: 10 } as const;

export class RescueVictory implements VictoryScript {
  private trophy: TrophyHandoff;
  private frustum = new THREE.Frustum();
  private pv = new THREE.Matrix4();
  private tmpV = new THREE.Vector3();
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
    // (round 3, R2 C N-2) only the lantern flies; the plinth stays by the door
    this.trophy = new TrophyHandoff(st, r.trophy, () => st.audio.playCrowdCheer(0.4), true);
    // (round 3, R2 C N-1) the skier stops on the porch mark, not ~20 m short of it
    d.stopOnMark = true;
    r.getYetiStopPoint(this.yetiStop);
    const S = this.station;
    const door = S.door.clone();
    const faces = S.faces.clone();
    const across = new THREE.Vector3(faces.z, 0, -faces.x);
    const sk = () => st.skier.root.position.clone();
    const tl = d.tl;
    st.yetiManual = true;
    const B = RESCUE_BEATS;
    // the Yeti waits out in the white, hidden until his beat (round 1: visible at 5 s)
    const ya = st.yetiAI;
    // (round 3, R2 C N-4) he starts 14 m out and walks in at a walk's pace (was 38 m at ~16 m/s)
    const start = this.yetiStop.clone().addScaledVector(faces, YETI_IN);
    ya.pos.set(start.x, st.world.mountain.heightAt(start.x, start.z), start.z);
    st.yeti.root.visible = false;
    // the storm holds at full strength until the break
    st.world.weatherOverride = { ...RESCUE_STORM };

    tl.at(0, () => {
      // (W-042) the cinematic frame: letterbox, gameplay HUD away, the victory theme
      st.hud.gameplayWidgets(false);
      st.hud.letterbox(true);
      st.audio.setMusicMode('victory');
    });

    // 1) into the light: low, behind and beside the skier, looking at the door
    tl.shot({
      start: 0,
      end: B.welcome,
      from: () => pose(sk().addScaledVector(faces, 9).addScaledVector(across, 2.5).add(new THREE.Vector3(0, 1.6, 0)), door.clone().add(new THREE.Vector3(0, 1.6, 0)), 50),
      to: () => pose(sk().addScaledVector(faces, 6.5).addScaledVector(across, 2.0).add(new THREE.Vector3(0, 1.5, 0)), door.clone().add(new THREE.Vector3(0, 1.8, 0)), 46),
      easing: ease.inOut,
      handheld: 0.02,
    });
    tl.at(0.8, () => (S.welcome = 1));
    // 2) safety and welcome: from the snow in front of the porch, looking at the door (it opens in
    //    frame), the skier gliding in from the slope side
    tl.shot({
      start: B.welcome,
      end: B.lantern,
      // (round-2 check: from 7 m and 1.7 m up the camera sat among the sled and the searchlight housing)
      // (round 6, W-104 / review C5-1: from 9.4–10.5 m out and 2.4 m up, behind and above the skier's
      // 8 m mark, the shot looked down past him: the rescuers waved at an empty frame) now 13 m out, low
      // and to one side, the skier's mark (4.6 m out) between the lens and the door: he glides up the
      // frame to the deck as the door opens and the rescuers welcome him
      from: () => welcomePoses(door, faces, across).from,
      to: () => welcomePoses(door, faces, across).to,
      easing: ease.inOut,
    });
    // 3) the lantern: from the storm side, low; the skier in the warm doorway, the lantern lifted
    const toHut = () => door.clone().sub(sk()).setY(0).normalize();
    const side = () => new THREE.Vector3(toHut().z, 0, -toHut().x);
    const fromYeti = () => sk().sub(this.yetiStop).setY(0).normalize();
    const sideY = () => new THREE.Vector3(fromYeti().z, 0, -fromYeti().x);
    tl.shot({
      start: B.lantern,
      end: B.yeti,
      from: () => pose(sk().addScaledVector(toHut(), -3.9).addScaledVector(side(), 1.6).add(new THREE.Vector3(0, 1.35, 0)), sk().addScaledVector(toHut(), 1.0).add(new THREE.Vector3(0, 1.75, 0)), 40),
      to: () => pose(sk().addScaledVector(toHut(), -3.1).addScaledVector(side(), 1.2).add(new THREE.Vector3(0, 1.3, 0)), sk().addScaledVector(toHut(), 0.6).add(new THREE.Vector3(0, 1.95, 0)), 36),
      easing: ease.inOut,
    });
    tl.at(B.lantern, () => this.trophy.start());
    tl.at(B.lantern + 1.0, () => (S.cheer = 1));
    tl.at(B.yetiShow, () => (st.yeti.root.visible = true));
    // 4) a shape in the white, past the skier's shoulder and the raised lantern
    tl.shot({
      start: B.yeti,
      end: B.light,
      // (Round 5, review C/F: from 1.6 m the skier was behind the camera) over his shoulder from 3 m back:
      // the skier and the raised lantern in the near corner, the shape in the white beyond
      // (the camera on the line from the Yeti through the skier, behind him: the skier at the door is
      // always between the lens and the shape in the white)
      from: () => pose(sk().addScaledVector(fromYeti(), 3.2).addScaledVector(sideY(), 1.2).add(new THREE.Vector3(0, 1.85, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 1.0, 0)), 38),
      to: () => pose(sk().addScaledVector(fromYeti(), 3.0).addScaledVector(sideY(), 1.1).add(new THREE.Vector3(0, 1.8, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), 34),
      handheld: 0.015,
    });
    // 5) the searchlight swings onto him. (Round 5, W-083: three rounds of an unreadable beat.) Re-staged
    //    in two shots, and the storm darkens for the beat (update(): gloom), so the light carves through:
    //    a) the hit — from behind him and to one side, looking back at the station: the lamp blazing on
    //       its mast, the shaft reaching across the frame to him, the pool of light at his feet;
    //    b) the recoil — close, a front three-quarter on him, lit, flinching behind a raised forearm.
    tl.at(B.light - 0.6, () => (S.searchTarget = this.yetiStop.clone().add(new THREE.Vector3(0, 1.8, 0))));
    const toDoor = () => door.clone().sub(this.yetiStop).setY(0).normalize();
    const flank = () => new THREE.Vector3(toDoor().z, 0, -toDoor().x);
    const lamp = () => S.lampWorld(new THREE.Vector3());
    tl.shot({
      start: B.light,
      end: B.flinch + 0.6,
      from: () => pose(this.yetiStop.clone().addScaledVector(toDoor(), -7.5).addScaledVector(flank(), 3.6).add(new THREE.Vector3(0, 2.2, 0)), this.yetiStop.clone().lerp(lamp(), 0.55).add(new THREE.Vector3(0, 0.6, 0)), 52),
      to: () => pose(this.yetiStop.clone().addScaledVector(toDoor(), -7.0).addScaledVector(flank(), 3.3).add(new THREE.Vector3(0, 2.1, 0)), this.yetiStop.clone().lerp(lamp(), 0.5).add(new THREE.Vector3(0, 0.6, 0)), 50),
    });
    tl.shot({
      start: B.flinch + 0.6,
      end: B.clear,
      from: () => pose(this.yetiStop.clone().addScaledVector(toDoor(), 5.2).addScaledVector(flank(), 2.2).add(new THREE.Vector3(0, 1.7, 0)), st.yetiAI.pos.clone().add(new THREE.Vector3(0, 1.9, 0)), 40),
      to: () => pose(this.yetiStop.clone().addScaledVector(toDoor(), 4.9).addScaledVector(flank(), 2.0).add(new THREE.Vector3(0, 1.7, 0)), st.yetiAI.pos.clone().addScaledVector(toDoor(), -0.8).add(new THREE.Vector3(0, 1.9, 0)), 38),
    });
    // 6) the storm breaks (fanfare): rise and pull back over the station…
    tl.at(B.clear + 0.4, () => {
      st.audio.playVictoryFanfare();
      st.audio.playCrowdCheer(0.8);
    });
    // …and settle. (Round 4, W-083: round 3 opened the rise on a bare roof corner and ended behind the
    // station, with nobody in it.) The rise starts on the skier and the raised lantern at the porch and
    // pulls up and out to the side: the porch with the skier and the rescuers in the lower third, side on,
    // the slope the skier came down rising beyond it in the sun
    const endPos = () => S.hut.clone().addScaledVector(across, 38).addScaledVector(faces, 16).add(new THREE.Vector3(0, 13, 0));
    const endLook = () => S.hut.clone().addScaledVector(faces, 14).add(new THREE.Vector3(0, 6, 0));
    tl.shot({
      start: B.clear,
      end: B.clearEnd,
      from: () => pose(sk().addScaledVector(toHut(), -4.5).addScaledVector(side(), 2.2).add(new THREE.Vector3(0, 1.8, 0)), sk().add(new THREE.Vector3(0, 1.8, 0)), 46),
      to: () => pose(endPos(), endLook(), 54),
      easing: ease.inOut,
    });
    tl.shot({
      start: B.clearEnd,
      end: B.results + 0.2,
      from: () => pose(endPos(), endLook(), 54),
      to: () => pose(endPos().addScaledVector(faces, 3).add(new THREE.Vector3(0, 1.2, 0)), endLook(), 53),
    });
    tl.at(B.title, () => st.hud.title('RESCUED', 'Whiteout Ridge — through the storm to the rescue station', 'victory scrim', B.results - B.title + 0.4));
    tl.at(B.results, () => {
      st.hud.letterbox(false);
      d.results();
    });
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    const st = this.st;
    const d = this.d;
    const B = RESCUE_BEATS;
    d.autopilot = 1;
    // the storm: full until the break, then it clears over 5 s (the sun comes out over the ridge)
    const k = THREE.MathUtils.smoothstep(t, B.clear, B.clearEnd);
    const wo = st.world.weatherOverride;
    if (wo) {
      wo.storm = 1 - k;
      wo.visibility = RESCUE_STORM.visibility * (1 - k) + 1 * k;
      wo.snowfall = RESCUE_STORM.snowfall * (1 - k) + 0.15 * k;
      wo.windX = RESCUE_STORM.windX * (1 - k) + 1 * k;
    }
    // (Round 5, W-083) the searchlight beat: the storm closes in dark (dusk-grey air, the ambient and sun
    // light down) as the light swings round, so the shaft and its pool carve through it; it lifts again
    // before the storm breaks. Presentation only.
    const gloom = THREE.MathUtils.smoothstep(t, B.light - 1.6, B.light - 0.2) * (1 - THREE.MathUtils.smoothstep(t, B.leave + 0.2, B.clear + 0.6));
    st.world.env.setGloom(gloom);
    st.world.env.setAmbientScale(1 - 0.6 * gloom);
    st.world.env.setSunScale(1 - 0.7 * gloom);
    this.station.doorOpen = THREE.MathUtils.smoothstep(t, B.door, B.door + 0.9);
    // the lantern swells as it is raised (and stays up)
    this.station.lanternUp = THREE.MathUtils.smoothstep(t, B.lantern + 0.6, B.lantern + 1.8);
    this.trophy.update(dt);
    // the Yeti: out of sight until his beat; walks in to the edge of the light, flinches when the
    // searchlight hits him, then turns and lumbers back into the white
    const ya = st.yetiAI;
    const m = st.world.mountain;
    this.yetiT += dt;
    if (t < B.yetiShow) {
      st.yetiAnim.speed = 0;
      st.setYetiMode('walk');
    } else if (this.yetiState === 'approach') {
      const to = this.yetiStop.clone().sub(ya.pos).setY(0);
      const dist = to.length();
      if (t >= B.flinch) {
        this.yetiState = 'flinch';
        this.yetiT = 0;
        // (Round 5, W-083) blinded by the light: he recoils behind a raised forearm (not the 'disgust'
        // shoo, which read as a snarl)
        st.setYetiMode('recoil');
        st.audio.playYetiGrowl(ya.pos, false);
      } else if (dist > 0.4) {
        to.normalize();
        // reach the stop just before the light hits him, slowing into it; the gait follows the root
        // speed (no foot-slide)
        const sp = Math.min(6.5, Math.max(1.2, dist / Math.max(0.3, B.flinch - 0.3 - t)), dist * 2.2);
        const v = Math.min(dist, sp * dt);
        st.yetiAnim.speed = sp;
        ya.pos.addScaledVector(to, v);
        ya.heading = damp(ya.heading, ya.heading + wrapAngle(Math.atan2(to.x, to.z) - ya.heading), 8, dt);
        st.setYetiMode('walk');
      } else {
        st.yetiAnim.speed = 0;
        const face = this.station.door.clone().sub(ya.pos).setY(0);
        ya.heading = damp(ya.heading, ya.heading + wrapAngle(Math.atan2(face.x, face.z) - ya.heading), 6, dt);
      }
    } else if (this.yetiState === 'flinch') {
      st.yetiAnim.speed = 0;
      if (t >= B.leave) {
        this.yetiState = 'leave';
        this.yetiT = 0;
        this.station.searchTarget = null;
      }
    } else {
      const away = ya.pos.clone().sub(this.station.door).setY(0).normalize();
      // (round 3, R2 C N-7) he lumbers off faster and is hidden only once he is out of the camera's
      // view (or 10 s on) — never popping out in frame
      ya.pos.addScaledVector(away, 4 * dt);
      st.yetiAnim.speed = 4;
      ya.heading = damp(ya.heading, ya.heading + wrapAngle(Math.atan2(away.x, away.z) - ya.heading), 4, dt);
      st.setYetiMode('turnAway');
      // gone into the white (and out of the reveal)
      if (st.yeti.root.visible && this.yetiT > 1.5) {
        this.frustum.setFromProjectionMatrix(this.pv.multiplyMatrices(st.camera.projectionMatrix, st.camera.matrixWorldInverse));
        const seen = this.frustum.containsPoint(this.tmpV.copy(ya.pos).setY(ya.pos.y + 1.5));
        if (!seen || this.yetiT > 10) st.yeti.root.visible = false;
      }
    }
    ya.pos.y = m.heightAt(ya.pos.x, ya.pos.z);
    st.yeti.root.position.copy(ya.pos);
    st.yeti.root.rotation.y = ya.heading;
  }
}
