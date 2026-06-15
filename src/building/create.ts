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
      // Zona baja: cara derecha asimétrica — frente en (BD-TRAP)/2, trasera a profundidad plena
    const rightInFace = zone === 'low'
      ? zm >= -(BD/2 + mOff) && zm <= (BD - TRAP_TAPER)/2 + mOff
      : Math.abs(zm) <= dR/2 + mOff;
    if (rightInFace) {
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

  // ── Helipuerto elevado ────────────────────────────────────────
  const tapaTop  = roofY + 0.50;
  const helPlatW = 2.2, helPlatD = 2.2;
  const helPlatT = 0.10;
  const helBaseH = 0.32;                   // altura del pedestal rectangular
  const helPlatY = tapaTop + helBaseH + helPlatT / 2;
  const helSurfY = helPlatY + helPlatT / 2;

  const helGrayMat  = new THREE.MeshStandardMaterial({ color: 0x6A6E74, roughness: 0.85, metalness: 0.10 });
  const helMetalMat = new THREE.MeshStandardMaterial({ color: 0x26272C, roughness: 0.55, metalness: 0.90 });

  // Plataforma gris
  const helPlat = new THREE.Mesh(new THREE.BoxGeometry(helPlatW, helPlatT, helPlatD), helGrayMat);
  helPlat.position.set(0, helPlatY, 0);
  helPlat.castShadow = true; helPlat.receiveShadow = true;
  scene.add(helPlat);

  // Pedestal rectangular (reemplaza patas)
  const helPed = new THREE.Mesh(new THREE.BoxGeometry(helPlatW, helBaseH, helPlatD), helMetalMat);
  helPed.position.set(0, tapaTop + helBaseH / 2, 0);
  helPed.castShadow = true;
  scene.add(helPed);

  // Cierre perimetral acostado/horizontal (reja transitable)
  const grateW  = 0.18;   // ancho de la reja más allá del borde de la plataforma
  const grateT  = 0.035;  // espesor de la reja
  const grateY  = helSurfY + grateT / 2;
  const hw = helPlatW / 2, hd = helPlatD / 2;

  // Textura de rejilla metálica
  const grCv = document.createElement('canvas'); grCv.width = grCv.height = 128;
  const grCtx = grCv.getContext('2d')!;
  grCtx.fillStyle = '#2E3035';
  grCtx.fillRect(0, 0, 128, 128);
  grCtx.strokeStyle = '#52565C';
  grCtx.lineWidth = 2;
  for (let i = 0; i <= 128; i += 16) {
    grCtx.beginPath(); grCtx.moveTo(i, 0); grCtx.lineTo(i, 128); grCtx.stroke();
    grCtx.beginPath(); grCtx.moveTo(0, i); grCtx.lineTo(128, i); grCtx.stroke();
  }
  const grTex = new THREE.CanvasTexture(grCv);
  grTex.wrapS = grTex.wrapT = THREE.RepeatWrapping;
  const grateMat = new THREE.MeshStandardMaterial({ map: grTex, roughness: 0.7, metalness: 0.6 });

  // 4 paneles horizontales perimetrales (frente, atrás, izquierda, derecha)
  ([
    { w: helPlatW + grateW * 2, d: grateW, x: 0,          z:  hd + grateW / 2 },
    { w: helPlatW + grateW * 2, d: grateW, x: 0,          z: -hd - grateW / 2 },
    { w: grateW,  d: helPlatD,             x:  hw + grateW / 2, z: 0 },
    { w: grateW,  d: helPlatD,             x: -hw - grateW / 2, z: 0 },
  ] as { w:number; d:number; x:number; z:number }[]).forEach(({ w, d, x, z }) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, grateT, d), grateMat);
    g.position.set(x, grateY, z);
    g.castShadow = true;
    scene.add(g);
  });

  // Marcaje: círculo amarillo + H blanca
  const hcv = document.createElement('canvas'); hcv.width = hcv.height = 512;
  const hctx = hcv.getContext('2d')!;
  hctx.clearRect(0, 0, 512, 512);
  hctx.strokeStyle = '#DDCC00'; hctx.lineWidth = 22;
  hctx.beginPath(); hctx.arc(256, 256, 212, 0, Math.PI * 2); hctx.stroke();
  hctx.fillStyle = '#FFFFFF';
  hctx.font = 'bold 270px sans-serif';
  hctx.textAlign = 'center'; hctx.textBaseline = 'middle';
  hctx.fillText('H', 256, 272);

  const helDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.88, 48),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hcv), transparent: true }),
  );
  helDisc.rotation.x = -Math.PI / 2;
  helDisc.position.set(0, helSurfY + 0.002, 0);
  scene.add(helDisc);

  // ── PDI Signs — letras 3D con relieve (sin caja) ─────────────
  const signW = 1.2, signH = 0.52;
  const signY = roofY + 0.25;

  function makePdiTex(): THREE.CanvasTexture {
    const W = 600, H = 240;
    const cv2 = document.createElement('canvas');
    cv2.width = W; cv2.height = H;
    const ctx2 = cv2.getContext('2d')!;
    ctx2.clearRect(0, 0, W, H);
    ctx2.font = 'bold 170px Georgia,serif';
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    const d = 8;
    for (let i = d; i >= 0; i--) {
      const t = 1 - i / d;
      ctx2.fillStyle = `rgb(${Math.round(3 + t * 13)},${Math.round(8 + t * 35)},${Math.round(20 + t * 87)})`;
      ctx2.fillText('PDI', W / 2 + i, H / 2 + i);
    }
    ctx2.globalAlpha = 0.22;
    ctx2.fillStyle = '#7799CC';
    ctx2.fillText('PDI', W / 2 - 2, H / 2 - 3);
    ctx2.globalAlpha = 1;
    return new THREE.CanvasTexture(cv2);
  }

  const pdiPlaneMat = new THREE.MeshBasicMaterial({
    map: makePdiTex(), transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });

  const signOff  = 0.02;
  const signXF   = -(BW / 2 - signW / 2 - 0.06);
  const signZF   =  (BD + 0.08) / 2 + signOff;
  const latOff   =  (BW + 0.08) / 2 + signOff;
  const zEdge    =   BD / 2 - signW / 2 - 0.06;

  // Cara frontal (+Z)
  { const s = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), pdiPlaneMat);
    s.position.set(signXF, signY, signZF); scene.add(s); }
  // Cara trasera (-Z): upper-left desde afuera = +X
  { const s = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), pdiPlaneMat);
    s.position.set(-signXF, signY, -signZF); s.rotation.y = Math.PI; scene.add(s); }
  // Cara lateral izquierda (-X)
  { const s = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), pdiPlaneMat);
    s.position.set(-latOff, signY, -zEdge); s.rotation.y = -Math.PI / 2; scene.add(s); }
  // Cara lateral derecha (+X)
  { const s = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), pdiPlaneMat);
    s.position.set(+latOff, signY, +zEdge); s.rotation.y = +Math.PI / 2; scene.add(s); }

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