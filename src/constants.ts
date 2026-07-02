export const FH            = 0.28;
export const BH            = 0.20;
export const BW            = 3.6;
export const BD            = 4.0;
export const TRAP_TAPER    = 2.32;
export const OBLIQUE_CURVE = 0.3;
export const FLOOR1_EXTRA  = 0.27;
export const BD_MINOR      = BD - TRAP_TAPER; // 1.68

// ── Sitio real (contexto urbano) ────────────────────────────────
// Coordenadas del edificio: Agustinas 640, Santiago Centro, Chile.
export const SITE_ORIGIN_LAT = -33.440317662483075;
export const SITE_ORIGIN_LON = -70.64586278346404;

// Rotación (grados, sentido horario visto desde arriba) para alinear el
// norte real con el eje -Z de la escena. Con 0° se asume -Z = Norte.
// Ajustar a ojo (o a partir del rumbo real de la calle) hasta que la
// fachada frontal (+Z, donde están los letreros PDI) coincida con la
// orientación real del edificio sobre Agustinas.
export const SITE_ROTATION_DEG = 0;

// Factor de escala: unidades de escena por metro real. El edificio 3D
// actual es esquemático (no a escala real: BW=3.6 / BD=4.0 unidades),
// así que el contexto urbano también se comprime con este factor.
// 0.12 asume una planta real de ~30m de lado (3.6 / 30 ≈ 0.12). Ajustar
// si el resultado se ve demasiado grande/chico respecto al edificio.
export const SITE_METERS_TO_UNITS = 0.12;

// Radio (metros) de contexto urbano a traer alrededor del origen.
export const SITE_RADIUS_M = 200;