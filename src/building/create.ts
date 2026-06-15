import * as THREE from 'three';
import { BW, BD, BH, TRAP_TAPER } from '../constants';
import { makeFloorGeo, getFloorDepths, getFH, computeFloorY } from './geo';
import { mkGlass, baseHex, spandrelMat, mullionMat, tapaMat, bigaMat } from './materials';
import type { Floor, FloorZone } from '../types';

export interface BuildingResult {
  floorMeshes: THREE.Mesh[];
  floorMeshesL: THREE.Mesh[];
  floorMeshesR: THREE.Mesh[];
  floorY: number[];
  TOTAL_H: number;
}

function makeLabel(text: string): THREE.SpriteMaterial {
  const c = document.createElement('canvas');
  c.width = 88; c.height = 44;
  const cx = c.getContext('2d')!;
  cx.fillStyle = '#ffffff';
  cx.font = 'bold 28px monospace';
  cx.textAlign = 'right';
  cx.textBaseline = 'middle';
  cx.fillText(text, 84, 22);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, sizeAttenuation: true });
}

export function createBuilding(scene: THREE.Scene, floors: Floor[]): BuildingResult {
  const N      = floors.length;
  const floorY = computeFloorY(N);
  const GROUND_Y = floorY[2];
  const TOTAL_H  = floorY[N-1] + getFH(N-1);

  const floorMeshes:  THREE.Mesh[] = [];
  const floorMeshesL: THREE.Mesh[] = [];
  const floorMeshesR: THREE.Mesh[] = [];

  // ── Floors + spandrels + labels ───────────────────────────────
  floors.forEach((f, i) => {
    const y  = floorY[i];
    const fh = getFH(i);
    const { dL, dR } = getFloorDepths(i);
    const dAvg = (dL + dR) / 2;

    const mesh = new THREE.Mesh(makeFloorGeo(dL, dR, fh), mkGlass(baseHex(f.p, f.yellow)));
    mesh.position.set(0, y + fh/2, 0);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData['idx'] = i;
    scene.add(mesh); floorMeshes.push(mesh);

    const meshL = new THREE.Mesh(new THREE.BoxGeometry(BW/2, fh, dAvg), mkGlass(0x00c46a));
    meshL.position.set(-BW/4, y + fh/2, 0);
    meshL.castShadow = true; meshL.userData['idx'] = i; meshL.visible = false;
    scene.add(meshL); floorMeshesL.push(meshL);

    const meshR = new THREE.Mesh(new THREE.BoxGeometry(BW/2, fh, dAvg), mkGlass(0xffa000));
    meshR.position.set(BW/4, y + fh/2, 0);
    meshR.castShadow = true; meshR.userData['idx'] = i; meshR.visible = false;
    scene.add(meshR); floorMeshesR.push(meshR);

    if (i < N - 1) {
      const band = new THREE.Mesh(makeFloorGeo(dL + 0.08, dR + 0.08, BH), spandrelMat);
      band.position.set(0, y + fh + BH/2, 0);
      band.castShadow = true; scene.add(band);
    }

    const sprite = new THREE.Sprite(makeLabel(f.id));
    sprite.scale.set(0.58, 0.29, 1);
    sprite.position.set(BW/2 + 0.46, y + fh/2, 0);
    scene.add(sprite);
  });

  // ── Mullions ─────────────────────────────────────────────────
  const mOff = 0.015;
  const mullZones: { y0: number; y1: number; zone: FloorZone }[] = [
    { y0: 0,          y1: floorY[2],  zone: 'rect' },
    { y0: floorY[2],  y1: floorY[7],  zone: 'low'  },
    { y0: floorY[7],  y1: floorY[23], zone: 'rect' },
    { y0: floorY[23], y1: TOTAL_H,    zone: 'high' },
  ];

  // ── Mullion overlay — cara frontal y trasera ─────────────────
  // Canvas transparente con tiras grises: el GPU hace mipmap correcto
  // y elimina el moiré que causaban los BoxGeometry de 0.045u de ancho.
  (function addMullionOverlays() {
    const W = 1024, H = 32;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#4f5154';
    for (let m = 0; m <= 13; m++) {
      const cx = Math.round(m * W / 13);
      ctx.fillRect(cx - 6, 0, 12, H);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });

    // Crea geometría de quad diagonal para las zonas oblicuas
    function diagGeo(y0: number, h: number, zL: number, zR: number, flipWinding: boolean): THREE.BufferGeometry {
      const pos = new Float32Array([
        -BW/2, y0,   zL,
         BW/2, y0,   zR,
         BW/2, y0+h, zR,
        -BW/2, y0+h, zL,
      ]);
      const uv  = new Float32Array([0,0, 1,0, 1,1, 0,1]);
      const idx = flipWinding
        ? new Uint16Array([0,2,1, 0,3,2])
        : new Uint16Array([0,1,2, 0,2,3]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv',       new THREE.BufferAttribute(uv,  2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      return g;
    }

    mullZones.forEach(({ y0, y1, zone }) => {
      const h = y1 - y0;
      if (zone === 'rect') {
        const zOvl = BD / 2 + 0.02;
        const front = new THREE.Mesh(new THREE.PlaneGeometry(BW, h), mat);
        front.position.set(0, y0 + h / 2, zOvl);
        scene.add(front);
        const back = new THREE.Mesh(new THREE.PlaneGeometry(BW, h), mat);
        back.position.set(0, y0 + h / 2, -zOvl);
        back.rotation.y = Math.PI;
        scene.add(back);
      } else if (zone === 'low') {
        // Zona baja: frente diagonal, trasera plana (rectangular)
        scene.add(new THREE.Mesh(diagGeo(y0, h, BD/2 + 0.02, (BD - TRAP_TAPER)/2 + 0.02, false), mat));
        const backOvl = new THREE.Mesh(new THREE.PlaneGeometry(BW, h), mat);
        backOvl.position.set(0, y0 + h / 2, -(BD / 2 + 0.02));
        backOvl.rotation.y = Math.PI;
        scene.add(backOvl);
      } else {
        // Zona alta: frente y trasera diagonales (comportamiento original)
        scene.add(new THREE.Mesh(diagGeo(y0, h, (BD - TRAP_TAPER)/2 + 0.02, BD/2 + 0.02, false), mat));
        scene.add(new THREE.Mesh(diagGeo(y0, h, -((BD - TRAP_TAPER)/2 + 0.02), -(BD/2 + 0.02), true), mat));
      }
    });
  })();

  const sideZs = Array.from({ length: 15 }, (_, m) => -BD/2 + m * (BD/14));
  mullZones.forEach(({ y0, y1, zone }) => {
    const h  = y1 - y0;
    const dL = zone === 'high' ? BD - TRAP_TAPER : BD;
    const dR = zone === 'low'  ? BD - TRAP_TAPER : BD;
    sideZs.forEach(zm => {
      if (Math.abs(zm) <= dL/2 + mOff) {
        const ml = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.045), mullionMat);
        ml.position.set(-(BW/2 + mOff), y0 + h/2, zm);
        scene.add(ml);
      }
      if (Math.abs(zm) <= dR/2 + mOff) {
        const ml = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.045), mullionMat);
        ml.position.set(+(BW/2 + mOff), y0 + h/2, zm);
        scene.add(ml);
      }
    });
  });

  // ── Tapa ──────────────────────────────────────────────────────
  const roofY = TOTAL_H;
  const tapa  = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.08, 0.50, BD + 0.08), tapaMat);
  tapa.position.set(0, roofY + 0.25, 0);
  tapa.castShadow = true;
  scene.add(tapa);

  // ── Helipuerto ────────────────────────────────────────────────
  const tapaH = 0.28;
  const helY  = roofY + tapaH + 0.07;

  const helBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 1.08, 0.1, 40),
    new THREE.MeshStandardMaterial({ color: 0x141c26, roughness: 0.65, metalness: 0.3 }),
  );
  helBase.position.set(0, helY + 0.05, 0);
  helBase.castShadow = true;
  scene.add(helBase);

  const helRing = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1.04, 40),
    new THREE.MeshBasicMaterial({ color: 0xddcc00, side: THREE.DoubleSide }),
  );
  helRing.rotation.x = -Math.PI / 2;
  helRing.position.set(0, helY + 0.11, 0);
  scene.add(helRing);

  const hc = document.createElement('canvas'); hc.width = hc.height = 256;
  const hx = hc.getContext('2d')!;
  hx.strokeStyle = '#ddcc00'; hx.lineWidth = 14;
  hx.beginPath(); hx.arc(128, 128, 100, 0, Math.PI * 2); hx.stroke();
  hx.fillStyle = '#ddcc00';
  hx.font = 'bold 118px sans-serif';
  hx.textAlign = 'center'; hx.textBaseline = 'middle';
  hx.fillText('H', 128, 132);

  const helDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.86, 40),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), transparent: true }),
  );
  helDisc.rotation.x = -Math.PI / 2;
  helDisc.position.set(0, helY + 0.115, 0);
  scene.add(helDisc);

  // ── PDI Sign ─────────────────────────────────────────────────
  const signW = 1.2, signH = 0.52, signD = 0.14;
  const signX = -(BW / 2 - signW / 2 - 0.06);
  const signY = roofY + 0.25;
  const signZ = (BD + 0.08) / 2 + signD / 2 + 0.015;

  const signBox = new THREE.Mesh(
    new THREE.BoxGeometry(signW, signH, signD),
    new THREE.MeshStandardMaterial({ color: 0x102B6B, roughness: 0.5, metalness: 0.85 }),
  );
  signBox.position.set(signX, signY, signZ);
  scene.add(signBox);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.4, metalness: 0.95 });
  ([
    { w: signW, rh: 0.03,   x: 0,                    ry:  signH / 2 - 0.015 },
    { w: signW, rh: 0.03,   x: 0,                    ry: -signH / 2 + 0.015 },
    { w: 0.03,  rh: signH,  x: -signW / 2 + 0.015,   ry: 0 },
    { w: 0.03,  rh: signH,  x:  signW / 2 - 0.015,   ry: 0 },
  ]).forEach(({ w, rh, x, ry }) => {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w, rh, signD + 0.01), rimMat);
    rim.position.set(signX + x, signY + ry, signZ);
    scene.add(rim);
  });

  const pdiSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="220" viewBox="0 0 600 220">
  <rect width="600" height="220" fill="#102B6B"/>
  <text x="300" y="178"
    font-family="Georgia,'Palatino Linotype',serif"
    font-size="188" font-weight="bold"
    fill="#F5C200" text-anchor="middle" letter-spacing="6">PDI</text>
</svg>`;
  const pdiUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(pdiSvg)));
  const pdiText = new THREE.Mesh(
    new THREE.PlaneGeometry(signW - 0.01, signH - 0.01),
    new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(pdiUrl) }),
  );
  pdiText.position.set(signX, signY, signZ + signD / 2 + 0.002);
  scene.add(pdiText);

  // ── PDI Signs — caras lateral izquierda, lateral derecha y trasera ──
  // Cada letrero va en la esquina superior izquierda de su cara (mirando desde afuera).
  // "Superior izquierda" se determina con cross(viewing_dir, up):
  //   cara -X (izq): LEFT = -Z  →  sign2Z = -(BD/2 - signW/2 - 0.06)
  //   cara +X (der): LEFT = +Z  →  sign3Z = +(BD/2 - signW/2 - 0.06)
  //   cara -Z (tra): LEFT = +X  →  sign4X = +(BW/2 - signW/2 - 0.06)

  const pdiMat  = new THREE.MeshStandardMaterial({ color: 0x102B6B, roughness: 0.5, metalness: 0.85 });
  const pdiLoad = () => new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(pdiUrl) });

  // Helper: letrero lateral (caja delgada en X, ancha en Z)
  function addLateralSign(cx: number, cz: number, rotY: number, textDx: number) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(signD, signH, signW), pdiMat);
    box.position.set(cx, signY, cz);
    scene.add(box);
    ([
      { rz: 0,                  ry:  signH / 2 - 0.015, isH: true  },
      { rz: 0,                  ry: -signH / 2 + 0.015, isH: true  },
      { rz: signW / 2 - 0.015,  ry: 0,                  isH: false },
      { rz: -signW / 2 + 0.015, ry: 0,                  isH: false },
    ]).forEach(({ rz, ry, isH }) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(signD + 0.01, isH ? 0.03 : signH, isH ? signW : 0.03), rimMat);
      r.position.set(cx, signY + ry, cz + rz);
      scene.add(r);
    });
    const txt = new THREE.Mesh(new THREE.PlaneGeometry(signW - 0.01, signH - 0.01), pdiLoad());
    txt.rotation.y = rotY;
    txt.position.set(cx + textDx, signY, cz);
    scene.add(txt);
  }

  // Helper: letrero frontal/trasero (caja ancha en X, delgada en Z)
  function addFrontalSign(cx: number, cz: number, rotY: number, textDz: number) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, signD), pdiMat);
    box.position.set(cx, signY, cz);
    scene.add(box);
    ([
      { w: signW, rh: 0.03,  dx: 0,                  ry:  signH / 2 - 0.015 },
      { w: signW, rh: 0.03,  dx: 0,                  ry: -signH / 2 + 0.015 },
      { w: 0.03,  rh: signH, dx: -signW / 2 + 0.015, ry: 0 },
      { w: 0.03,  rh: signH, dx:  signW / 2 - 0.015, ry: 0 },
    ]).forEach(({ w, rh, dx, ry }) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, rh, signD + 0.01), rimMat);
      r.position.set(cx + dx, signY + ry, cz);
      scene.add(r);
    });
    const txt = new THREE.Mesh(new THREE.PlaneGeometry(signW - 0.01, signH - 0.01), pdiLoad());
    txt.rotation.y = rotY;
    txt.position.set(cx, signY, cz + textDz);
    scene.add(txt);
  }

  const latOff = (BW + 0.08) / 2 + signD / 2 + 0.015; // offset X desde eje hasta cara lateral
  const zEdge  = BD / 2 - signW / 2 - 0.06;            // offset Z desde eje hasta borde del letrero

  // Cara lateral izquierda (-X): upper-left desde afuera = -Z
  addLateralSign(-latOff, -zEdge, -Math.PI / 2, -(signD / 2 + 0.002));

  // Cara lateral derecha (+X): upper-left desde afuera = +Z
  addLateralSign(+latOff, +zEdge, +Math.PI / 2, +(signD / 2 + 0.002));

  // Cara trasera (-Z): upper-left desde afuera = +X
  addFrontalSign(+(BW / 2 - signW / 2 - 0.06), -signZ, Math.PI, -(signD / 2 + 0.002));

  // ── Ground ───────────────────────────────────────────────────
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 1.0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // ── Perimeter band ───────────────────────────────────────────
  const periMat = new THREE.MeshStandardMaterial({ color: 0x1c2a3a, roughness: 0.8, metalness: 0.5 });
  const periH = 0.10, periE = 0.28;
  const periY = GROUND_Y - periH / 2;
  ([
    { w: BW + periE * 2, d: periE, x: 0,                    z:  BD / 2 + periE / 2 },
    { w: BW + periE * 2, d: periE, x: 0,                    z: -(BD / 2 + periE / 2) },
    { w: periE,          d: BD,    x:  BW / 2 + periE / 2,  z: 0 },
    { w: periE,          d: BD,    x: -(BW / 2 + periE / 2), z: 0 },
  ]).forEach(({ w, d, x, z }) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, periH, d), periMat);
    s.position.set(x, periY, z);
    s.receiveShadow = true;
    scene.add(s);
  });

  // ── Bigas ────────────────────────────────────────────────────
  const bigaSize = 0.20;

  const botSecH = floorY[7] - floorY[2];
  const botBigaX = BW/2 - bigaSize/2;
  {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bigaSize, botSecH, bigaSize), bigaMat);
    b.position.set(botBigaX, floorY[2] + botSecH / 2, +(BD/2 - bigaSize/2));
    b.castShadow = true; scene.add(b);
  }

  const topBigaY0 = floorY[23] - BH;
  const topSecH   = TOTAL_H - topBigaY0;
  const topBigaX  = -(BW/2 - bigaSize/2);
  [+(BD/2 - bigaSize/2), -(BD/2 - bigaSize/2)].forEach(cz => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bigaSize, topSecH, bigaSize), bigaMat);
    b.position.set(topBigaX, topBigaY0 + topSecH / 2, cz);
    b.castShadow = true; scene.add(b);
  });

  return { floorMeshes, floorMeshesL, floorMeshesR, floorY, TOTAL_H };
}