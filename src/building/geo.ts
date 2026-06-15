import * as THREE from 'three';
import { BW, BD, OBLIQUE_CURVE, TRAP_TAPER, FLOOR1_EXTRA, FH, BH } from '../constants';
import type { FloorZone } from '../types';

export function getFH(i: number): number {
  return i === 2 ? FH + FLOOR1_EXTRA : FH;
}

export function computeFloorY(n: number): number[] {
  const ys: number[] = [];
  let cy = 0;
  for (let i = 0; i < n; i++) {
    ys.push(cy);
    cy += getFH(i) + BH;
  }
  return ys;
}

export function getFloorDepths(i: number): { dL: number; dR: number } {
  if (i >= 2 && i <= 6) return { dL: BD, dR: BD - TRAP_TAPER };
  if (i >= 23)          return { dL: BD - TRAP_TAPER, dR: BD };
  return { dL: BD, dR: BD };
}

export function makeFloorGeo(dL: number, dR: number, fh: number): THREE.BufferGeometry {
  if (Math.abs(dL - dR) < 0.001) return new THREE.BoxGeometry(BW, fh, dL);
  const cv = OBLIQUE_CURVE;
  const s  = new THREE.Shape();
  s.moveTo(-BW/2, -dL/2);
  s.quadraticCurveTo(0, -(dL+dR)/4 + cv, +BW/2, -dR/2); // cara frontal oblicua
  if (dL > dR) {
    // Zona baja (pisos 1-5): cara trasera rectangular a la profundidad máxima
    s.lineTo(+BW/2, +dL/2);
    s.lineTo(-BW/2, +dL/2);
  } else {
    // Zona alta (pisos 22-25): cara trasera oblicua (comportamiento original)
    s.lineTo(+BW/2, +dR/2);
    s.quadraticCurveTo(0, (dL+dR)/4 - cv, -BW/2, +dL/2);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: fh, bevelEnabled: false, curveSegments: 16 });
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  geo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -fh/2, 0));
  return geo;
}

export function zFrontal(xm: number, zone: FloorZone): number {
  const t  = (xm + BW/2) / BW;
  const Pm = (BD/2 + (BD-TRAP_TAPER)/2) / 2 - OBLIQUE_CURVE;
  if (zone === 'low')  return (1-t)*(1-t)*(BD/2) + 2*t*(1-t)*Pm + t*t*((BD-TRAP_TAPER)/2);
  if (zone === 'high') return (1-t)*(1-t)*((BD-TRAP_TAPER)/2) + 2*t*(1-t)*Pm + t*t*(BD/2);
  return BD/2;
}