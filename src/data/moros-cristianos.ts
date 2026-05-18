// Moros y Cristianos — alma de los barrios populares de Alicante
// Datos generales verificados (Wikipedia, federaciones de comparsas, prensa local).
// No incluimos fechas exactas si no están confirmadas para 2026.

export type FiestaBarrio = {
  barrio: string;
  cuando: string;
  caracter: string;
  detalle: string;
};

export const MOROS_BARRIOS: FiestaBarrio[] = [
  {
    barrio: "Sant Blai (San Blas)",
    cuando: "Mayo (en torno al primer fin de semana)",
    caracter: "La más antigua y consolidada de la ciudad",
    detalle:
      "Pólvora, desfiles de gala y la famosa entrada cristiana y mora por las calles del barrio. Es la madre de las fiestas alicantinas de Moros y Cristianos.",
  },
  {
    barrio: "Altozano",
    cuando: "Junio",
    caracter: "Fiestas populares de barrio con sabor obrero",
    detalle:
      "El Altozano vive sus moros con orgullo de barrio: comparsas pequeñas pero intensas, mucha vecindad y comida en la calle.",
  },
  {
    barrio: "San Antón Alto",
    cuando: "Verano",
    caracter: "Comparsas históricas y desfiles vibrantes",
    detalle:
      "San Antón mezcla devoción y pólvora. Las bandas resuenan entre cuestas y casas bajas.",
  },
  {
    barrio: "San Gabriel",
    cuando: "Agosto",
    caracter: "Fiestas populares con guiño marinero",
    detalle:
      "Cerca del puerto y de las salinas, San Gabriel celebra sus moros con orgullo de barrio histórico.",
  },
  {
    barrio: "Villafranqueza (El Palamó)",
    cuando: "Septiembre",
    caracter: "Pueblo dentro de la ciudad",
    detalle:
      "Desfiles, bandas y un ambiente que casi parece de otra época. De las más esperadas del calendario.",
  },
];

export const MOROS_ELEMENTOS = [
  {
    titulo: "Las comparsas",
    descripcion:
      "Cada bando se divide en filaes o comparsas: moros (almorávides, abencerrajes, berberiscos…) y cristianos (caballeros, templarios, almogávares…). Pertenecer a una comparsa es cosa de familia, de toda la vida.",
  },
  {
    titulo: "Las entradas",
    descripcion:
      "Los dos grandes desfiles. La entrada cristiana suele ser solemne; la mora, exótica y con boatos espectaculares. Caballos, carrozas, danzarinas y oro a raudales.",
  },
  {
    titulo: "El alardo y los arcabuces",
    descripcion:
      "El olor a pólvora negra es la firma de la fiesta. Los arcabuceros disparan sin bala en formaciones que recuerdan las batallas del medievo.",
  },
  {
    titulo: "Las embajadas",
    descripcion:
      "Pequeñas obras de teatro a pie de calle: el embajador moro y el cristiano se desafían en verso. Acaban con la rendición del castillo… y el cambio de bando al día siguiente.",
  },
  {
    titulo: "Las kábilas y cuartelillos",
    descripcion:
      "Los cuarteles de cada comparsa donde se come, se canta y se hace pueblo. Aquí late el corazón de la fiesta, lejos del foco turístico.",
  },
];
