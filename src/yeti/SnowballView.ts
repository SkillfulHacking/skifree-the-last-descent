/**
 * Rendering for the Hard-mode snowballs: the ball in flight and a landing marker on the snow.
 *
 * The marker appears the moment the ball is thrown, laid flat on the slope at the landing point:
 * an outer warning ring at the hit radius, and an inner disc that fills as impact approaches, so
 * the player can read both where and when.
 */
import * as THREE from 'three';
import { ballPosition, SNOWBALL, type Snowball, type SnowballBarrage, type Vec3 } from './Snowballs';

interface Slot {
  ball: THREE.Mesh;
  marker: THREE.Group;
  ring: THREE.Mesh;
  fill: THREE.Mesh;
  beam: THREE.Mesh;
  used: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);

export class SnowballView {
  readonly group = new THREE.Group();
  private slots: Slot[] = [];
  private ballGeo = new THREE.IcosahedronGeometry(0.42, 2);
  private ballMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.85, metalness: 0 });
  private ringGeo = new THREE.RingGeometry(SNOWBALL.hitRadius - 0.5, SNOWBALL.hitRadius, 48);
  private fillGeo = new THREE.CircleGeometry(SNOWBALL.hitRadius - 0.5, 40);
  // a light column over the zone: a flat mark on the slope is nearly edge-on from the chase camera
  private beamGeo = new THREE.CylinderGeometry(SNOWBALL.hitRadius * 0.55, SNOWBALL.hitRadius * 0.85, 9, 24, 1, true).translate(0, 4.5, 0);
  private beamTex = beamTexture();
  private beamMat = new THREE.MeshBasicMaterial({ color: 0xff4a24, transparent: true, opacity: 0.55, alphaMap: this.beamTex, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
  private ringMat = new THREE.MeshBasicMaterial({ color: 0xff3b1f, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
  private fillMat = new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
  private p: Vec3 = { x: 0, y: 0, z: 0 };
  private n = new THREE.Vector3();

  constructor(private readonly normalAt: (x: number, z: number, out: Vec3) => void) {
    this.group.name = 'snowballs';
  }

  private slot(): Slot {
    for (const s of this.slots) if (!s.used) return s;
    const ball = new THREE.Mesh(this.ballGeo, this.ballMat);
    ball.castShadow = true;
    const ring = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
    const fill = new THREE.Mesh(this.fillGeo, this.fillMat.clone());
    ring.rotation.x = fill.rotation.x = -Math.PI / 2;
    ring.renderOrder = fill.renderOrder = 5;
    const beam = new THREE.Mesh(this.beamGeo, this.beamMat.clone());
    beam.renderOrder = 6;
    const marker = new THREE.Group();
    marker.add(ring, fill);
    this.group.add(ball, marker, beam);
    const s: Slot = { ball, marker, ring, fill, beam, used: false };
    this.slots.push(s);
    return s;
  }

  private cam = new THREE.Vector3();

  update(barrage: SnowballBarrage | null, time: number, camera: THREE.Vector3) {
    this.cam.copy(camera);
    for (const s of this.slots) s.used = false;
    if (barrage) for (const b of barrage.balls) this.draw(this.slot(), b, time);
    for (const s of this.slots) {
      s.ball.visible = s.used;
      s.marker.visible = s.used;
      s.beam.visible = s.used;
    }
  }

  private draw(s: Slot, b: Snowball, time: number) {
    s.used = true;
    const u = Math.min(1, b.t / b.flight);
    ballPosition(b, this.p);
    s.ball.position.set(this.p.x, this.p.y, this.p.z);
    s.ball.rotation.set(time * 7, time * 5, 0);
    // marker: flat on the slope at the landing point
    this.normalAt(b.to.x, b.to.z, this.n);
    s.marker.position.set(b.to.x, b.to.y + 0.06, b.to.z);
    s.marker.quaternion.setFromUnitVectors(UP, this.n.normalize());
    // the ring pulses faster as impact nears; the disc fills in
    const pulse = 0.5 + 0.5 * Math.sin(time * (8 + 18 * u));
    (s.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * pulse;
    s.fill.scale.setScalar(0.15 + 0.85 * u);
    (s.fill.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.32 * u;
    s.marker.scale.setScalar(1 + 0.25 * (1 - u));
    // the column stands upright over the zone and brightens towards impact
    s.beam.position.set(b.to.x, b.to.y, b.to.z);
    // …and gets out of the way once the camera is nearly on top of it
    const near = THREE.MathUtils.smoothstep(this.cam.distanceTo(s.beam.position), 6, 22);
    (s.beam.material as THREE.MeshBasicMaterial).opacity = (0.3 + 0.45 * u) * (0.75 + 0.25 * pulse) * near;
  }

  dispose() {
    this.group.removeFromParent();
    this.ballGeo.dispose();
    this.ballMat.dispose();
    this.ringGeo.dispose();
    this.fillGeo.dispose();
    for (const s of this.slots) {
      (s.ring.material as THREE.Material).dispose();
      (s.fill.material as THREE.Material).dispose();
      (s.beam.material as THREE.Material).dispose();
    }
    this.beamGeo.dispose();
    this.beamTex.dispose();
    this.beamMat.dispose();
    this.ringMat.dispose();
    this.fillMat.dispose();
  }
}

/** vertical fade for the light column: solid at the snow, gone at the top */
function beamTexture(): THREE.Texture {
  const h = 64;
  const data = new Uint8Array(4 * h);
  for (let i = 0; i < h; i++) {
    const v = Math.round(255 * Math.pow(1 - i / (h - 1), 1.6));
    data.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, 1, h);
  t.needsUpdate = true;
  return t;
}
