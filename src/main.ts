import './style.css';
import * as THREE from 'three';
import { OrbitControls }  from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { db, loadPrinters } from './supabase';
import { createBuilding } from './building/create';
import type { Floor, Printer, PEstado, FloorState } from './types';

declare global {
  interface Window {
    _openModal(piso: string, idx: number): void;
    _closeModal(): void;
    _saveModal(): Promise<void>;
    _deleteP(idx: number, _floorId?: string): Promise<void>;
    _renderConfigChecklist(): void;
    _toggleCheck(idx: number, key: string, floorId: string): Promise<void>;
    _selectFloor(floorId: string): void;
  }
}

// ── Data ──────────────────────────────────────────────────────
const FLOORS: Floor[] = [
  { id:'S2', p:0 }, { id:'S1', p:0 },
  { id:'1',  p:0 }, { id:'2',  p:0 },
  { id:'3',  p:0 }, { id:'4',  p:0 },
  { id:'5',  p:0 }, { id:'6',  p:0 },
  { id:'7',  p:78, yellow:true }, { id:'8',  p:0 },
  { id:'9',  p:0 }, { id:'10', p:0 },
  { id:'11', p:0 }, { id:'12', p:0 }, { id:'13', p:0 },
  { id:'14', p:0 }, { id:'15', p:0 }, { id:'16', p:0 },
  { id:'17', p:0 }, { id:'18', p:0 }, { id:'19', p:0 },
  { id:'20', p:0 }, { id:'21', p:0 }, { id:'22', p:0 },
  { id:'23', p:0 }, { id:'24', p:0 }, { id:'25', p:0 },
];

const PESTADOS: Record<string, PEstado> = {
  'En instalación':   { color:'#3b82f6', bg:'rgba(59,130,246,.14)'  },
  'En configuración': { color:'#f97316', bg:'rgba(249,115,22,.14)'  },
  'Operativa':        { color:'#22c55e', bg:'rgba(34,197,94,.14)'   },
};
const PESTADO_LIST = Object.keys(PESTADOS);
const ESTADO_PESO: Record<string, number> = {
  'En instalación':33, 'En configuración':66, 'Operativa':100,
};

const CONFIG_CHECKS: { key: string; label: string; servidorOnly?: boolean }[] = [
  { key: 'dns',      label: 'DNS' },
  { key: 'smtp',     label: 'SMTP' },
  { key: 'copia',    label: 'Configuración de copia' },
  { key: 'escaner',  label: 'Configuración de Escaner' },
  { key: 'libreta',  label: 'Carga de libreta de direcciones' },
  { key: 'papercut', label: 'Integración a Paper Cut', servidorOnly: true },
  { key: 'bandejas', label: 'Config de bandejas' },
];

let PRINTERS: Printer[] = await loadPrinters();

// ── Interaction state ─────────────────────────────────────────
let hovIdx = -1, selIdx = -1;
let _editIdx = -1;
let _modalChecklist: Record<string, boolean> = {};

// ── Scene ─────────────────────────────────────────────────────
const wrap = document.getElementById('three-wrap')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ab8d8);
scene.fog = new THREE.Fog(0x8ab8d8, 40, 90);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
wrap.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
pmrem.dispose();

scene.add(new THREE.AmbientLight(0xc8dff0, 1.4));
const sun = new THREE.DirectionalLight(0xfff5e8, 3.2);
sun.position.set(8, 18, 10);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(2048);
Object.assign(sun.shadow.camera, { near:1, far:55, left:-8, right:8, top:18, bottom:-3 });
scene.add(sun);
const skyFill = new THREE.DirectionalLight(0x88bbdd, 0.8);
skyFill.position.set(-6, 6, -10);
scene.add(skyFill);

// ── Building ──────────────────────────────────────────────────
const { floorMeshes, floorMeshesL, floorMeshesR, TOTAL_H } = createBuilding(scene, FLOORS);

const midY = TOTAL_H / 2;
camera.position.set(-6, midY + 2.5, 22);
camera.lookAt(0, midY, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, midY, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 5;
controls.maxDistance = 45;
controls.update();

// ── Floor color logic ─────────────────────────────────────────
function floorEffectiveP(floorId: string): number {
  const ps = PRINTERS.filter(p => p.piso === floorId);
  if (!ps.length) return 0;
  return Math.round(ps.reduce((s, p) => s + (ESTADO_PESO[p.estado] ?? 0), 0) / ps.length);
}

function floorPrinterMix(floorId: string): 'mixed' | 'all_op' | 'in_progress' | 'empty' {
  const ps = PRINTERS.filter(p => p.piso === floorId);
  if (!ps.length) return 'empty';
  const hasOp    = ps.some(p => p.estado === 'Operativa');
  const hasNonOp = ps.some(p => p.estado !== 'Operativa');
  return hasOp && hasNonOp ? 'mixed' : hasOp ? 'all_op' : 'in_progress';
}

function setFloorState(idx: number, state: FloorState): void {
  const mix    = floorPrinterMix(FLOORS[idx].id);
  const white  = new THREE.Color(0xffffff);
  const lerp   = state === 'sel' ? 0.30 : state === 'hov' ? 0.18 : 0;
  const emissH = state === 'sel' ? 0x003344 : 0x000000;
  const emissI = state === 'sel' ? 0.22 : 0;
  const opacity = state === 'sel' ? 1.0 : 0.92;

  const applyMat = (mat: THREE.MeshPhysicalMaterial, hex: number) => {
    mat.color.copy(new THREE.Color(hex).lerp(white, lerp));
    mat.emissive.setHex(emissH);
    mat.emissiveIntensity = emissI;
    mat.opacity = opacity;
  };

  if (mix === 'mixed') {
    floorMeshes[idx].visible  = false;
    floorMeshesL[idx].visible = true;
    floorMeshesR[idx].visible = true;
    applyMat(floorMeshesL[idx].material as THREE.MeshPhysicalMaterial, 0x00c46a);
    applyMat(floorMeshesR[idx].material as THREE.MeshPhysicalMaterial, 0xffa000);
  } else {
    floorMeshes[idx].visible  = true;
    floorMeshesL[idx].visible = false;
    floorMeshesR[idx].visible = false;
    const effP = floorEffectiveP(FLOORS[idx].id);
    const f = FLOORS[idx];
    const hex = effP > 0
      ? (effP >= 80 ? 0x00c46a : 0xffa000)
      : (f.yellow ? 0xffdd00 : !f.p ? 0x1a3060 : f.p >= 80 ? 0x00c46a : f.p >= 40 ? 0xffa000 : 0xd42020);
    applyMat(floorMeshes[idx].material as THREE.MeshPhysicalMaterial, hex);
  }
}

function refresh3DFloor(floorId: string): void {
  const i = FLOORS.findIndex(f => f.id === floorId);
  if (i < 0) return;
  setFloorState(i, i === selIdx ? 'sel' : i === hovIdx ? 'hov' : 'normal');
}

FLOORS.forEach(f => refresh3DFloor(f.id));
showDetail(null);

// ── Interaction ───────────────────────────────────────────────
const ray = new THREE.Raycaster();
const mp  = new THREE.Vector2();

function getHit(e: MouseEvent): number {
  const r = renderer.domElement.getBoundingClientRect();
  mp.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mp, camera);
  const hittable = [...floorMeshes, ...floorMeshesL, ...floorMeshesR].filter(m => m.visible);
  const hits = ray.intersectObjects(hittable);
  return hits.length ? (hits[0].object.userData['idx'] as number) : -1;
}

renderer.domElement.addEventListener('mousemove', e => {
  const idx = getHit(e);
  if (idx === hovIdx) return;
  if (hovIdx >= 0 && hovIdx !== selIdx) setFloorState(hovIdx, 'normal');
  hovIdx = idx;
  if (hovIdx >= 0 && hovIdx !== selIdx) setFloorState(hovIdx, 'hov');
  renderer.domElement.style.cursor = idx >= 0 ? 'pointer' : 'default';
});

renderer.domElement.addEventListener('click', e => {
  const idx = getHit(e);
  if (idx < 0 && selIdx < 0) return;
  if (selIdx >= 0) setFloorState(selIdx, selIdx === hovIdx ? 'hov' : 'normal');
  selIdx = selIdx === idx ? -1 : idx;
  if (selIdx >= 0) setFloorState(selIdx, 'sel');
  showDetail(selIdx >= 0 ? FLOORS[selIdx] : null);
});

// ── Resize ────────────────────────────────────────────────────
function onResize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
onResize();
new ResizeObserver(onResize).observe(wrap);

// ── Render loop ───────────────────────────────────────────────
(function loop() { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();

// ── Detail panel ──────────────────────────────────────────────
const HITOS = ['Levantamiento', 'Instalación', 'Configuración'];
const STATE_COLOR: Record<string, string> = { completado:'#00e676', en_progreso:'#ffaa00' };
const STATE_LABEL: Record<string, string> = { completado:'Completado', en_progreso:'En proceso' };
const hitoState   = (p: number, i: number) => p >= (i+1) * (100/3) ? 'completado' : 'en_progreso';
const floorColor  = (p: number) => !p ? '#8a9ab0' : p >= 80 ? '#00e676' : '#ffaa00';
const floorStatus = (p: number) => !p ? 'Sin datos' : p >= 80 ? 'Completado' : 'En proceso';

function showDetail(floor: Floor | null): void {
  const ph  = document.getElementById('placeholder')!;
  const det = document.getElementById('detail')!;
  if (!floor) {
    const activeFloors = FLOORS.filter(f => PRINTERS.some(p => p.piso === f.id));
    if (!activeFloors.length) {
      ph.classList.remove('opacity-0');
      det.classList.add('opacity-0', 'pointer-events-none');
      return;
    }
    ph.classList.add('opacity-0');
    det.classList.remove('opacity-0', 'pointer-events-none');

    const totalP       = activeFloors.reduce((s, f) => s + floorEffectiveP(f.id), 0);
    const avgP         = Math.round(totalP / activeFloors.length);
    const avgC         = floorColor(avgP);
    const totalPrinters = PRINTERS.length;

    const cards = activeFloors.map(f => {
      const effP = floorEffectiveP(f.id);
      const fc   = floorColor(effP);
      const ps   = PRINTERS.filter(p => p.piso === f.id);
      const badges = PESTADO_LIST
        .map(e => ({ e, count: ps.filter(p => p.estado === e).length, pe: PESTADOS[e] }))
        .filter(x => x.count > 0)
        .map(({ e, count, pe }) =>
          `<span style="font-size:10px;padding:1px 7px;border-radius:99px;color:${pe.color};background:${pe.bg};border:1px solid ${pe.color}33">${e} &middot; ${count}</span>`
        ).join('');
      return `<div class="d-card" style="padding:12px 14px;cursor:pointer"
          onmouseover="this.style.borderColor='#2a3a4a'"
          onmouseout="this.style.borderColor=''"
          onclick="window._selectFloor('${f.id}')">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px">
          <span style="font-size:13px;font-weight:700;color:#d8e0e8">Piso ${f.id}</span>
          <span style="font-size:13px;font-weight:800;color:${fc}">${effP}%</span>
        </div>
        <div class="d-bar" style="height:3px;margin-bottom:8px">
          <div class="d-fill" style="width:${effP}%;background:${fc}"></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${badges}</div>
      </div>`;
    }).join('');

    det.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-[22px] font-bold text-[#d8e0e8]">Avance general</h2>
          <div style="font-size:12px;color:#545e6a;margin-top:2px">${activeFloors.length} pisos &middot; ${totalPrinters} impresoras</div>
        </div>
        <span class="text-[22px] font-black" style="color:${avgC}">${avgP}%</span>
      </div>
      <div class="d-bar mb-6"><div class="d-fill" style="width:${avgP}%;background:${avgC};box-shadow:0 0 10px ${avgC}55"></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">
        ${cards}
      </div>`;
    return;
  }
  ph.classList.add('opacity-0');
  det.classList.remove('opacity-0', 'pointer-events-none');

  const effP = floorEffectiveP(floor.id);
  const c = floorColor(effP), st = floorStatus(effP);
  const printers = PRINTERS.filter(p => p.piso === floor.id);

  const printerRows = printers.map(p => {
    const pi = PRINTERS.indexOf(p);
    const pe = PESTADOS[p.estado] ?? PESTADOS['Planificada'];
    return `<tr>
      <td class="font-mono font-semibold" style="color:#c0cad4">${p.hh}</td>
      <td><div style="color:#c0cad4;font-weight:500">${p.marca}</div><div style="font-size:11px;color:#545e6a">${p.modelo}</div></td>
      <td class="font-mono" style="font-size:11px">${p.serie ?? '—'}</td>
      <td><a href="http://${p.ip}" target="_blank" class="font-mono" style="font-size:11px;color:#00d4ff;text-decoration:none" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${p.ip}</a></td>
      <td>${p.area}</td>
      <td><span style="font-size:11px;padding:2px 7px;border-radius:4px;background:#ffffff0a;color:#7a8898">${p.tipo === 'P2P' ? 'P2P' : 'Servidor'}</span></td>
      <td><span style="display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:700;color:${pe.color};background:${pe.bg};border:1px solid ${pe.color}33">
        <span style="width:5px;height:5px;border-radius:50%;background:${pe.color};display:inline-block;flex-shrink:0"></span>${p.estado}
      </span></td>
      <td style="white-space:nowrap">
        <button class="act-btn" onclick="window._openModal('${floor.id}',${pi})">✎</button>
        <button class="act-btn danger" onclick="window._deleteP(${pi},'${floor.id}')">×</button>
      </td>
    </tr>`;
  }).join('');

  det.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <h2 class="text-[22px] font-bold text-[#d8e0e8]">Piso ${floor.id}</h2>
        <span class="px-3 py-0.5 rounded-full text-[11px] font-bold border" style="color:${c};background:${c}18;border-color:${c}40">${st}</span>
      </div>
      <span class="text-[22px] font-black" style="color:${c}">${effP}%</span>
    </div>
    <div class="d-bar mb-5"><div class="d-fill" style="width:${effP}%;background:${c};box-shadow:0 0 10px ${c}55"></div></div>
    <div class="grid grid-cols-4 gap-2 mb-6">
      ${HITOS.map((h, i) => {
        const s = hitoState(effP, i), hc = STATE_COLOR[s];
        return `<div class="d-card" style="padding:10px">
          <div class="text-[10px] font-medium mb-1.5" style="color:#484f5c">${h}</div>
          <div class="flex items-center gap-1.5 text-[11px] font-semibold">
            <div class="w-1.5 h-1.5 rounded-full" style="background:${hc}"></div>
            <span style="color:${hc}">${STATE_LABEL[s]}</span>
          </div></div>`;
      }).join('')}
    </div>
    <div class="flex items-center justify-between mb-3">
      <div class="d-tag" style="margin-bottom:0">Impresoras · ${printers.length}</div>
      <button class="btn" style="padding:4px 12px;font-size:12px;color:#00d4ff;border-color:rgba(0,212,255,.25)" onclick="window._openModal('${floor.id}',-1)">+ Agregar</button>
    </div>
    ${printers.length === 0
      ? `<div style="text-align:center;padding:32px 0;color:#2a2e3c;font-size:13px">Sin impresoras registradas para este piso</div>`
      : `<div style="overflow-x:auto"><table class="p-table">
          <thead><tr>
            <th>HH</th><th>Marca / Modelo</th><th>Serie</th><th>IP</th><th>Área</th><th>Tipo</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody>${printerRows}</tbody>
        </table></div>`
    }`;
}

// ── Modal ─────────────────────────────────────────────────────
window._openModal = function(piso: string, idx: number) {
  _editIdx = idx;
  const isEdit = idx >= 0;
  const p: Partial<Printer> & { hh:string; ip:string; marca:string; modelo:string; area:string; tipo:string; estado:string; piso:string; serie:string|null } =
    isEdit ? PRINTERS[idx] : { hh:'', serie:null, marca:'', modelo:'', ip:'', piso, area:'', tipo:'P2P', estado:'En instalación' };

  document.getElementById('modal-title')!.textContent = isEdit ? 'Editar impresora' : 'Agregar impresora';
  document.getElementById('modal-form')!.innerHTML = `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Identificador HH</label>
        <input id="fi-hh" class="form-input" placeholder="HH-001" value="${p.hh}"></div>
      <div class="form-group"><label class="form-label">N° Serie <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#363d48">(opcional)</span></label>
        <input id="fi-serie" class="form-input" placeholder="SN..." value="${p.serie ?? ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Marca</label>
        <input id="fi-marca" class="form-input" placeholder="HP, Epson..." value="${p.marca}"></div>
      <div class="form-group"><label class="form-label">Modelo</label>
        <input id="fi-modelo" class="form-input" placeholder="LaserJet..." value="${p.modelo}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Dirección IP</label>
        <input id="fi-ip" class="form-input" placeholder="10.x.x.x" value="${p.ip}"></div>
      <div class="form-group"><label class="form-label">Área / Departamento</label>
        <input id="fi-area" class="form-input" placeholder="Administración..." value="${p.area}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Tipo de conexión</label>
        <select id="fi-tipo" class="form-input" onchange="window._renderConfigChecklist()">
          <option value="P2P"${p.tipo==='P2P'?' selected':''}>Punto a punto (P2P)</option>
          <option value="Servidor"${p.tipo==='Servidor'?' selected':''}>Servidor de impresión</option>
        </select></div>
      <div class="form-group"><label class="form-label">Estado</label>
        <select id="fi-estado" class="form-input" onchange="window._renderConfigChecklist()">
          ${PESTADO_LIST.map(e => `<option value="${e}"${p.estado===e?' selected':''}>${e}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-group"><label class="form-label">Piso</label>
      <select id="fi-piso" class="form-input">
        ${FLOORS.map(f => `<option value="${f.id}"${(isEdit?p.piso:piso)===f.id?' selected':''}>Piso ${f.id}</option>`).join('')}
      </select></div>
    <div id="fi-config-section" style="display:none;margin-top:16px;padding-top:14px;border-top:1px solid #1e2530">
      <div style="color:#6b7280;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px">Checklist de configuración</div>
      <div id="fi-config-checks" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px"></div>
    </div>`;
  _modalChecklist = isEdit ? { ...(PRINTERS[idx].checklist ?? {}) } : {};
  document.getElementById('modal')!.classList.remove('hidden');
  window._renderConfigChecklist();
};

window._closeModal = function() {
  document.getElementById('modal')!.classList.add('hidden');
};

window._saveModal = async function() {
  const g = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim();
  const hh = g('fi-hh'), ip = g('fi-ip');
  if (!hh || !ip) { alert('Identificador HH e IP son obligatorios.'); return; }
  const estadoVal = (document.getElementById('fi-estado') as HTMLSelectElement).value;
  const checklist: Record<string, boolean> = _editIdx >= 0 ? { ...(PRINTERS[_editIdx].checklist ?? {}) } : {};
  if (estadoVal === 'En configuración') {
    CONFIG_CHECKS.forEach(c => {
      const el = document.getElementById('fc-' + c.key) as HTMLInputElement | null;
      if (el) checklist[c.key] = el.checked;
    });
  }
  const entry = {
    hh, serie: g('fi-serie') || null, marca: g('fi-marca'), modelo: g('fi-modelo'),
    ip, piso: g('fi-piso'), area: g('fi-area'), tipo: g('fi-tipo'), estado: estadoVal, checklist,
  };

  if (_editIdx >= 0) {
    const { error } = await db.from('impresoras').update(entry).eq('id', PRINTERS[_editIdx].id!);
    if (error) { alert('Error al guardar: ' + error.message); return; }
    PRINTERS[_editIdx] = { ...PRINTERS[_editIdx], ...entry };
  } else {
    const { data, error } = await db.from('impresoras').insert(entry).select().single();
    if (error) { alert('Error al guardar: ' + error.message); return; }
    PRINTERS.push(data as Printer);
  }
  window._closeModal();
  refresh3DFloor(entry.piso);
  if (selIdx >= 0) showDetail(FLOORS[selIdx]);
};

window._selectFloor = function(floorId: string) {
  const idx = FLOORS.findIndex(f => f.id === floorId);
  if (idx < 0) return;
  if (selIdx >= 0) setFloorState(selIdx, selIdx === hovIdx ? 'hov' : 'normal');
  selIdx = idx;
  setFloorState(selIdx, 'sel');
  showDetail(FLOORS[selIdx]);
};

window._renderConfigChecklist = function() {
  const estadoEl = document.getElementById('fi-estado') as HTMLSelectElement | null;
  const tipoEl   = document.getElementById('fi-tipo')   as HTMLSelectElement | null;
  const section  = document.getElementById('fi-config-section');
  const checks   = document.getElementById('fi-config-checks');
  if (!section || !checks || !estadoEl || !tipoEl) return;

  CONFIG_CHECKS.forEach(c => {
    const el = document.getElementById('fc-' + c.key) as HTMLInputElement | null;
    if (el) _modalChecklist[c.key] = el.checked;
  });

  if (estadoEl.value !== 'En configuración') {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  const tipo = tipoEl.value;
  checks.innerHTML = CONFIG_CHECKS
    .filter(c => !c.servidorOnly || tipo === 'Servidor')
    .map(c => {
      const checked = _modalChecklist[c.key] ?? false;
      return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;padding:3px 0">
        <input type="checkbox" id="fc-${c.key}" ${checked ? 'checked' : ''}
          style="width:13px;height:13px;accent-color:#f97316;cursor:pointer;flex-shrink:0">
        <span style="font-size:12px;color:#c0cad4">${c.label}</span>
      </label>`;
    }).join('');
};

window._toggleCheck = async function(idx: number, key: string, floorId: string) {
  const printer = PRINTERS[idx];
  const checklist = { ...(printer.checklist ?? {}), [key]: !(printer.checklist?.[key] ?? false) };
  const { error } = await db.from('impresoras').update({ checklist }).eq('id', printer.id!);
  if (error) { alert('Error al guardar: ' + error.message); return; }
  PRINTERS[idx] = { ...printer, checklist };
  if (selIdx >= 0) showDetail(FLOORS[selIdx]);
  void floorId;
};

window._deleteP = async function(idx: number) {
  const pisoId = PRINTERS[idx].piso;
  if (!confirm(`¿Eliminar impresora ${PRINTERS[idx].hh}?`)) return;
  const { error } = await db.from('impresoras').delete().eq('id', PRINTERS[idx].id!);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  PRINTERS.splice(idx, 1);
  refresh3DFloor(pisoId);
  if (selIdx >= 0) showDetail(FLOORS[selIdx]);
};