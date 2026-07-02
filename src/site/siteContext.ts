import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { geoToScene, type GeoProjectOpts } from './geo';

// ── Opción A: contexto urbano generado desde OpenStreetMap (GeoJSON) ──

export interface SiteContextOptions extends GeoProjectOpts {
  defaultLevels?: number; // pisos asumidos si el edificio OSM no trae altura
  levelHeightM?: number;  // metros por piso asumidos
}

interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: { type: string; coordinates: any };
}

interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

const buildingMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.92, metalness: 0.04 });
const roadMat     = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 1.0 });

function tagsOf(props: Record<string, any>): Record<string, any> {
  // El export de Overpass Turbo anida los tags en `properties.tags`; otros export los dejan planos.
  return props?.tags ?? props ?? {};
}

function buildingHeightM(tags: Record<string, any>, opts: Required<Pick<SiteContextOptions, 'defaultLevels' | 'levelHeightM'>>): number {
  const h = parseFloat(tags?.height);
  if (!isNaN(h)) return h;
  const levels = parseFloat(tags?.['building:levels']);
  const lvl = !isNaN(levels) ? levels : opts.defaultLevels;
  return lvl * opts.levelHeightM;
}

function ringToShape(ring: [number, number][], opts: SiteContextOptions): THREE.Shape {
  const shape = new THREE.Shape();
  ring.forEach(([lon, lat], i) => {
    const { x, z } = geoToScene(lat, lon, opts);
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  });
  return shape;
}

function buildRoadRibbon(points: { x: number; z: number }[], widthUnits: number): THREE.Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  let vi = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const nx = (-dz / len) * (widthUnits / 2);
    const nz = ( dx / len) * (widthUnits / 2);
    positions.push(
      a.x + nx, 0.012, a.z + nz,
      a.x - nx, 0.012, a.z - nz,
      b.x - nx, 0.012, b.z - nz,
      b.x + nx, 0.012, b.z + nz,
    );
    indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, roadMat);
}

const ROAD_WIDTH_M: Record<string, number> = {
  motorway: 14, trunk: 12, primary: 11, secondary: 10, tertiary: 9,
  residential: 8, service: 4, pedestrian: 5, footway: 2.5, path: 1.5,
};

/** Construye un THREE.Group con los edificios y calles reales alrededor del origen configurado. */
export function buildSiteContext(geojson: GeoJSONCollection, options: SiteContextOptions): THREE.Group {
  const opts = { defaultLevels: 4, levelHeightM: 3.2, ...options };
  const group = new THREE.Group();
  group.name = 'site-context';

  for (const feature of geojson.features ?? []) {
    const tags = tagsOf(feature.properties);
    const geom = feature.geometry;
    if (!geom) continue;

    if (geom.type === 'Polygon' && tags.building) {
      const heightUnits = buildingHeightM(tags, opts) * opts.metersToUnits;
      if (heightUnits <= 0) continue;
      const [outer, ...holes] = geom.coordinates as [number, number][][];
      const shape = ringToShape(outer, opts);
      holes.forEach(h => shape.holes.push(ringToShape(h, opts)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: heightUnits, bevelEnabled: false, curveSegments: 4 });
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, buildingMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    } else if (geom.type === 'LineString' && tags.highway) {
      const pts = (geom.coordinates as [number, number][]).map(([lon, lat]) => geoToScene(lat, lon, opts));
      const widthM = ROAD_WIDTH_M[tags.highway] ?? 6;
      group.add(buildRoadRibbon(pts, widthM * opts.metersToUnits));
    }
  }

  return group;
}

// ── Opción B: contexto urbano ya modelado, importado como .glb ────────

export interface SiteGLBOptions {
  position?: THREE.Vector3;
  rotationYDeg?: number;
  scale?: number;
}

/** Carga un .glb (ej. terreno/manzana modelada a mano) y lo agrega a la escena en la posición/rotación dadas. */
export function loadSiteGLB(scene: THREE.Scene, url: string, opts: SiteGLBOptions = {}): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      gltf => {
        const root = gltf.scene;
        root.name = 'site-context-glb';
        if (opts.position) root.position.copy(opts.position);
        if (opts.rotationYDeg !== undefined) root.rotation.y = THREE.MathUtils.degToRad(opts.rotationYDeg);
        if (opts.scale !== undefined) root.scale.setScalar(opts.scale);
        root.traverse(o => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
        });
        scene.add(root);
        resolve(root);
      },
      undefined,
      reject,
    );
  });
}
