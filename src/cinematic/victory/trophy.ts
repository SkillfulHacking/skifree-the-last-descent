/**
 * Trophy / celebration hook shared by victory scripts: the trophy flies from wherever it stands
 * (podium, table, plinth) into the skier's raised right hand, the plinth children stay behind, and
 * the skier holds it up. A finish's trophy object must keep the held part as its FIRST child.
 */
import * as THREE from 'three';
import { ease } from '../Timeline';
import type { Stage } from '../../game/Stage';

export class TrophyHandoff {
  private t = -1;
  private from = new THREE.Vector3();

  constructor(
    private st: Stage,
    private trophy: THREE.Object3D,
    private onCaught?: () => void,
  ) {}

  /** begin the flight (call from a timeline beat) */
  start(): void {
    this.t = 0;
    this.trophy.getWorldPosition(this.from);
  }

  get started(): boolean {
    return this.t >= 0;
  }

  update(dt: number): void {
    const st = this.st;
    if (this.t < 0) return;
    this.t += dt;
    const k = Math.min(1, this.t / 1.2);
    const trophy = this.trophy;
    const handPos = new THREE.Vector3();
    st.skier.rightHandSocket.getWorldPosition(handPos);
    if (k < 1) {
      if (trophy.parent !== st.world.scene) st.world.scene.attach(trophy);
      const p = this.from.clone().lerp(handPos, ease.inOut(k));
      p.y += Math.sin(k * Math.PI) * 1.5;
      trophy.position.copy(p);
    } else if (trophy.parent !== st.skier.rightHandSocket) {
      st.skier.rightHandSocket.add(trophy);
      // held by the stem: the podium plinth stays behind
      trophy.children.forEach((c, i) => (c.visible = i === 0));
      trophy.position.set(0, -0.32, 0);
      trophy.rotation.set(0, 0, 0);
      trophy.scale.setScalar(0.7);
      this.onCaught?.();
    }
    st.poseOverride = { celebrate: Math.min(1, this.t / 0.8) };
  }
}
