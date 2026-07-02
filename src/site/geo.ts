const EARTH_R = 6371000; // metros

export interface GeoProjectOpts {
  originLat: number;
  originLon: number;
  rotationDeg: number;
  metersToUnits: number;
}

/** Distancia aproximada (metros) hacia el norte y el este desde el origen. Válido para radios de pocos km. */
function latLonToMeters(lat: number, lon: number, originLat: number, originLon: number): { north: number; east: number } {
  const latRad = (originLat * Math.PI) / 180;
  const north = ((lat - originLat) * Math.PI / 180) * EARTH_R;
  const east  = ((lon - originLon) * Math.PI / 180) * EARTH_R * Math.cos(latRad);
  return { north, east };
}

/** Convierte lat/lon reales a coordenadas locales (x, z) de la escena three.js. */
export function geoToScene(lat: number, lon: number, opts: GeoProjectOpts): { x: number; z: number } {
  const { north, east } = latLonToMeters(lat, lon, opts.originLat, opts.originLon);
  const rad = (opts.rotationDeg * Math.PI) / 180;
  const rE =  east * Math.cos(rad) + north * Math.sin(rad);
  const rN = -east * Math.sin(rad) + north * Math.cos(rad);
  return {
    x: rE * opts.metersToUnits,
    z: -rN * opts.metersToUnits, // norte real → -Z de la escena (con rotationDeg = 0)
  };
}
