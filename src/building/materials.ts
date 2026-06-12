import * as THREE from 'three';

export const spandrelMat = new THREE.MeshStandardMaterial({ color: 0x4f5154, roughness: 0.90 });
export const mullionMat  = new THREE.MeshStandardMaterial({ color: 0x4f5154, roughness: 0.50, metalness: 0.9 });
export const tapaMat     = new THREE.MeshStandardMaterial({ color: 0x4f5154, roughness: 0.65, metalness: 0.6 });
export const bigaMat     = new THREE.MeshStandardMaterial({ color: 0x4f5154, roughness: 0.70, metalness: 0.5 });

export function baseHex(p: number, yellow?: boolean): number {
  if (yellow) return 0xffdd00;
  if (!p)     return 0x1a3060;
  if (p >= 80) return 0x00c46a;
  if (p >= 40) return 0xffa000;
  return 0xd42020;
}

export function mkGlass(hex: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: hex, roughness: 0.07, metalness: 0.75,
    transparent: true, opacity: 0.92, envMapIntensity: 0.9,
  });
}