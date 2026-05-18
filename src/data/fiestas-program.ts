// Programa oficial de las Hogueras de Alicante 2026
// Datos verificados a partir de fuentes públicas (lapetarderia.es, elespanol.com,
// hogueras.es, Wikipedia). NO inventar — si algo no está aquí, es que no se sabe aún.
// Última revisión de fuente: 28 de abril de 2026.

export type Acto = {
  hora: string;
  titulo: string;
  lugar?: string;
  detalle?: string;
  tipo?: "dia" | "noche" | "pirotecnia" | "desfile" | "ofrenda" | "crema";
};

export type Jornada = {
  fecha: string;       // ISO yyyy-mm-dd
  etiqueta: string;    // "Sábado 20 de junio"
  titular?: string;    // "Plantà grande"
  actos: Acto[];
};

export const PREVIA_2026 = [
  "Elección de la Bellea del Foc (primavera)",
  "Exposición del Ninot en la Antigua Lonja del Pescado",
  "Mascletàs en los barrios",
  "Actos internos de las comisiones (foguerers y barraquers)",
];

export const PROGRAMA_2026: Jornada[] = [
  {
    fecha: "2026-06-05",
    etiqueta: "Viernes 5 de junio",
    titular: "El Pregón — Alicante cambia el chip",
    actos: [
      { hora: "18:30", titulo: "Música per a una Festa", lugar: "Parking del ADDA", tipo: "dia" },
      { hora: "19:00", titulo: "Homenaje a foguerers y barraquers fallecidos", lugar: "Plaza de España", tipo: "dia" },
      { hora: "19:30", titulo: "Desfile del Pregón", lugar: "San Vicente → Rambla → Altamira → Ayuntamiento", tipo: "desfile" },
      { hora: "21:00", titulo: "Pregón oficial de las Hogueras 2026", lugar: "Plaza del Ayuntamiento", tipo: "noche" },
      { hora: "23:00", titulo: "Fiesta del Pregón", lugar: "Zona Volvo Ocean Race", tipo: "noche" },
    ],
  },
  {
    fecha: "2026-06-06",
    etiqueta: "Sábado 6 de junio",
    titular: "Cabalgata del Ninot",
    actos: [
      { hora: "19:00", titulo: "Cabalgata del Ninot (sátira en la calle)", lugar: "Alfonso X → Rambla → Altamira → Ayuntamiento", tipo: "desfile" },
    ],
  },
  {
    fecha: "2026-06-07",
    etiqueta: "Domingo 7 de junio",
    actos: [
      { hora: "14:00", titulo: "Primera mascletà de aviso", tipo: "pirotecnia" },
    ],
  },
  {
    fecha: "2026-06-13",
    etiqueta: "Sábado 13 de junio",
    titular: "Música y pólvora",
    actos: [
      { hora: "14:00", titulo: "Mascletà", lugar: "Centro Comercial Gran Vía", tipo: "pirotecnia" },
      { hora: "18:30", titulo: "Entrada de Bandas", lugar: "Luceros → Alfonso X → Rambla → Ayuntamiento", tipo: "desfile" },
    ],
  },
  {
    fecha: "2026-06-14",
    etiqueta: "Domingo 14 de junio",
    actos: [
      { hora: "17:00", titulo: "Clausura Exposición del Ninot (se decide el Ninot Indultat)", lugar: "Antigua Lonja del Pescado", tipo: "dia" },
    ],
  },
  {
    fecha: "2026-06-16",
    etiqueta: "Martes 16 de junio",
    titular: "Arribada del Foc",
    actos: [
      { hora: "23:00", titulo: "Arribada del Foc — luz, sonido y pirotecnia", lugar: "Zona El Corte Inglés", tipo: "noche" },
    ],
  },
  {
    fecha: "2026-06-18",
    etiqueta: "Jueves 18 de junio",
    titular: "Empieza la semana grande",
    actos: [
      { hora: "14:00", titulo: "I Mascletà — Pirotecnia Mediterráneo (fuera de concurso)", lugar: "Plaza de los Luceros", tipo: "pirotecnia" },
      { hora: "21:00", titulo: "Inauguración del Mercadito de Fogueres", lugar: "Paseo Federico Soto", tipo: "noche" },
    ],
  },
  {
    fecha: "2026-06-19",
    etiqueta: "Viernes 19 de junio",
    titular: "Plantà infantil",
    actos: [
      { hora: "14:00", titulo: "II Mascletà — Pirotecnia Crespo", lugar: "Luceros", tipo: "pirotecnia" },
      { hora: "00:00", titulo: "Plantà oficial de hogueras infantiles", tipo: "noche" },
    ],
  },
  {
    fecha: "2026-06-20",
    etiqueta: "Sábado 20 de junio",
    titular: "Plantà grande — la ciudad se transforma",
    actos: [
      { hora: "09:00", titulo: "Visita del jurado", tipo: "dia" },
      { hora: "14:00", titulo: "III Mascletà — Pirotecnia Turís", lugar: "Luceros", tipo: "pirotecnia" },
      { hora: "17:00", titulo: "Entrega de premios infantiles", tipo: "dia" },
      { hora: "20:30", titulo: "Apertura de barracas y racós", tipo: "noche" },
      { hora: "00:00", titulo: "Plantà oficial de hogueras adultas", tipo: "noche" },
    ],
  },
  {
    fecha: "2026-06-21",
    etiqueta: "Domingo 21 de junio",
    titular: "Ofrenda de Flores — 1ª jornada",
    actos: [
      { hora: "09:00", titulo: "Visita del jurado", tipo: "dia" },
      { hora: "14:00", titulo: "IV Mascletà — Pirotecnia Mediterráneo", lugar: "Luceros", tipo: "pirotecnia" },
      { hora: "17:00", titulo: "Lectura de premios", tipo: "dia" },
      { hora: "18:00", titulo: "Ofrenda de Flores (1ª jornada)", lugar: "Alfonso X → Rambla → Concatedral → Ayuntamiento", tipo: "ofrenda" },
      { hora: "22:00", titulo: "Verbenas en las barracas", tipo: "noche" },
    ],
  },
  {
    fecha: "2026-06-22",
    etiqueta: "Lunes 22 de junio",
    titular: "Premios y Ofrenda — 2ª jornada",
    actos: [
      { hora: "11:00", titulo: "Desfile de entrega de premios", tipo: "desfile" },
      { hora: "13:00", titulo: "Nanos i Gegants", tipo: "dia" },
      { hora: "14:00", titulo: "V Mascletà — Pirotecnia Pibierzo", lugar: "Luceros", tipo: "pirotecnia" },
      { hora: "18:00", titulo: "Ofrenda de Flores (2ª jornada)", tipo: "ofrenda" },
      { hora: "22:00", titulo: "Verbenas en las barracas", tipo: "noche" },
    ],
  },
  {
    fecha: "2026-06-23",
    etiqueta: "Martes 23 de junio",
    titular: "La gran noche — víspera de San Juan",
    actos: [
      { hora: "12:00", titulo: "Entrega de premios de la Ofrenda", tipo: "dia" },
      { hora: "14:00", titulo: "VI Mascletà — Pirotecnia Ferrández", lugar: "Luceros", tipo: "pirotecnia" },
      { hora: "19:00", titulo: "Dansà d’Alacant", tipo: "desfile" },
      { hora: "20:00", titulo: "Desfile folclórico internacional", tipo: "desfile" },
      { hora: "22:00", titulo: "Verbenas hasta el amanecer", tipo: "noche" },
    ],
  },
  {
    fecha: "2026-06-24",
    etiqueta: "Miércoles 24 de junio",
    titular: "Nit de la Cremà — todo arde",
    actos: [
      { hora: "14:00", titulo: "VII Mascletà — Pirotecnia Alta Palancia", lugar: "Luceros", tipo: "pirotecnia" },
      { hora: "20:00", titulo: "Misa oficial", tipo: "dia" },
      { hora: "00:00", titulo: "Palmera desde el Castillo de Santa Bárbara", tipo: "crema" },
      { hora: "00:15", titulo: "🔥 Cremà de todas las hogueras", tipo: "crema" },
    ],
  },
];

export const MASCLETAS_2026 = [
  { dia: "18 jun", pirotecnico: "Mediterráneo", nota: "fuera de concurso" },
  { dia: "19 jun", pirotecnico: "Crespo" },
  { dia: "20 jun", pirotecnico: "Turís" },
  { dia: "21 jun", pirotecnico: "Mediterráneo" },
  { dia: "22 jun", pirotecnico: "Pibierzo" },
  { dia: "23 jun", pirotecnico: "Ferrández" },
  { dia: "24 jun", pirotecnico: "Alta Palancia" },
];

// Fuegos artificiales en la playa del Postiguet / Cocó — siempre a medianoche (00:00 h)
export const FUEGOS_2026 = [
  { dia: "25 jun", pirotecnico: "Pirotecnia Zaragozana" },
  { dia: "26 jun", pirotecnico: "Pirotecnia Pibierzo" },
  { dia: "27 jun", pirotecnico: "Hermanos Ferrández" },
  { dia: "28 jun", pirotecnico: "Pirotecnia Alta Palancia" },
  { dia: "29 jun", pirotecnico: "Fuegos Artificiales del Mediterráneo" },
];

export const COSO_MULTICOLOR_2026 = {
  fecha: "2026-06-28",
  etiqueta: "Domingo 28 de junio",
  hora: "20:00",
  recorrido: "Plaza de los Luceros → Alfonso X",
  descripcion: "Desfile final con confeti, música y el mejor humor — el adiós oficial.",
};

export type Fase = "previa" | "semana-grande" | "fuegos-postiguet" | "nostalgia";

// Devuelve la fase según la fecha actual (siempre relativa a 2026).
export function calcularFase(hoy: Date = new Date()): Fase {
  const y = hoy.getFullYear();
  const m = hoy.getMonth(); // 0-indexed
  const d = hoy.getDate();
  // Antes de junio o año anterior → previa
  if (y < 2026) return "previa";
  if (y === 2026) {
    if (m < 5) return "previa";                       // antes de junio
    if (m === 5 && d < 18) return "previa";           // 1-17 jun
    if (m === 5 && d <= 24) return "semana-grande";   // 18-24 jun
    if (m === 5 && d <= 29) return "fuegos-postiguet"; // 25-29 jun
    return "nostalgia";                                // resto del año
  }
  // Año 2027+ → nostalgia hasta que se publique 2027
  return "nostalgia";
}
