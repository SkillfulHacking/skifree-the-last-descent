/**
 * Defeat ("the Yeti was hungry") and victory ("you survived the mountain") sequences.
 * Both run on top of a live world; the outcome is already locked by RunState when they start.
 */
import * as THREE from 'three';
import { Timeline, ease, pose } from './Timeline';
import type { Stage } from '../game/Stage';
import type { VictoryDirector, VictoryScript } from '../world/presentation/finish';

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

/**
 * Victory shell driven by GameSession. The location-specific sequence (camera shots, Yeti exit,
 * trophy and celebration) is the finish environment's victory script (FinishDefinition.victory,
 * src/world/presentation/finish.ts); Alpine's is src/cinematic/victory/alpineResort.ts.
 */
export class VictoryCinematic implements VictoryDirector {
  readonly tl = new Timeline();
  onResults: (() => void) | null = null;
  /** 0..1 how much the game should auto-steer the skier to the stop point */
  autopilot = 1;
  cheer = 0;
  welcome = 0;
  readonly stopPoint = new THREE.Vector3();
  private script: VictoryScript;

  constructor(st: Stage) {
    const finish = st.world.finish!;
    finish.getStopPoint(this.stopPoint);
    this.script = st.world.finishDef.victory(st, finish, this);
  }

  results(): void {
    this.onResults?.();
  }

  update(dt: number) {
    this.script.update(dt);
  }
}
