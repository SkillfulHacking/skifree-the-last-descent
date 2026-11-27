/**
 * Trophy / celebration hook shared by victory scripts: the trophy flies from wherever it stands
 * (podium, table, plinth) into the skier's raised right hand, the plinth children stay behind, and
 * the skier holds it up. A finish's trophy object must keep the held part as its FIRST child.
 */
import * as THREE from 'three';
import { ease } from '../Timeline';
import type { Stage } from '../../game/Stage';

const _q = new THREE.Quaternion();

export class TrophyHandoff {
  private t = -1;
  private from = new THREE.Vector3();

  constructor(
    private st: Stage,
    private trophy: THREE.Object3D,
    private onCaught?: () => void,
    /** fly only the held part (the first child), leaving the plinth where it stands (round 3, R2 C
     * N-2: Whiteout's lantern was carried through the air on its stone plinth) */
    private heldOnly = false,
  ) {}

  /** begin the flight (call from a timeline beat) */
  start(): void {
    this.t = 0;
    if (this.heldOnly && this.trophy.children[0]) this.trophy = this.trophy.children[0];
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
      // (Round 5, review C4-5) the hand holding the trophy drops its pole
      st.skier.setPoleVisible(1, false);
      // held by the stem: the podium plinth stays behind
      if (!this.heldOnly) trophy.children.forEach((c, i) => (c.visible = i === 0));
      trophy.scale.setScalar(0.7);
      // (round 6, W-104) a trophy that hangs (the rescue lantern: userData.hangFrom = its bail's height)
      // hangs from the fist by its bail, upright; a cup is held by the stem
      const hang = trophy.userData['hangFrom'] as number | undefined;
      trophy.position.set(0, hang !== undefined ? -hang * 0.7 : -0.32, 0);
      trophy.rotation.set(0, 0, 0);
      this.onCaught?.();
    }
    if (trophy.parent === st.skier.rightHandSocket && trophy.userData['hangFrom'] !== undefined) {
      // keep it hanging plumb whatever the wrist does
      st.skier.rightHandSocket.getWorldQuaternion(_q);
      trophy.quaternion.copy(_q.invert());
    }
    st.poseOverride = { celebrate: Math.min(1, this.t / 0.8) };
  }
}
