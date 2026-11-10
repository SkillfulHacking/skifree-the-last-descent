/** Fjord Coast presentation (three.js), registered under the ids the biome's capabilities name. */
import './scenery';
// TEMP (dev): placeholders until the harbour, shelter and cave dressing exist
import { registerFinish, registerRefuge, registerCavePresentation, registerHazardView } from '../../../presentation';
import { ALPINE_RESORT_FINISH, SKI_PATROL_CABIN } from '../../../presentation/alpine';
import * as THREE from 'three';
registerFinish({ ...ALPINE_RESORT_FINISH, id: 'fjord-harbour' });
registerRefuge({ ...SKI_PATROL_CABIN, id: 'coastal-shelter' });
registerCavePresentation({ id: 'fjord-sea-cave' });
registerHazardView('sea-gust', () => ({ object: new THREE.Group(), dispose() {} }));
registerHazardView('scoured-rock', () => ({ object: new THREE.Group(), dispose() {} }));
