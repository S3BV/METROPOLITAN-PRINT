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

// Margen (unidades de escena) alrededor de la huella del edificio
// esquemático (BW x BD) que se excluye del contexto OSM: ahí cae el
// propio edificio del sitio y los vecinos con muro medianero pegado,
// ya representados por el modelo esquemático detallado.
export const SITE_FOOTPRINT_MARGIN = 1.8;

// ── Posición del edificio en la escena ──────────────────────────────────────
// Desplazamiento para alinear el modelo 3D con su lote real en el contexto OSM.
// Ajustar a ojo: valores negativos mueven el edificio hacia la derecha/abajo
// de la pantalla (desde la posición inicial de la cámara).
//   X: negativo → derecha,  positivo → izquierda
//   Z: negativo → abajo,    positivo → arriba
export const BUILDING_OFFSET_X = -0.8;
export const BUILDING_OFFSET_Z = -3.5;
// Rotación del edificio sobre su eje vertical (grados, sentido horario visto desde arriba).
export const BUILDING_ROTATION_DEG = -7;