import { useEffect, useState } from "react";

// Open-Meteo WMO weather codes -> Spanish label
const WMO_LABEL: Record<number, string> = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla con escarcha",
  51: "Llovizna ligera",
  53: "Llovizna",
  55: "Llovizna intensa",
  61: "Lluvia ligera",
  63: "Lluvia",
  65: "Lluvia intensa",
  71: "Nieve ligera",
  73: "Nieve",
  75: "Nieve intensa",
  80: "Chubascos",
  81: "Chubascos fuertes",
  82: "Chubascos violentos",
  95: "Tormenta",
  96: "Tormenta con granizo",
  99: "Tormenta fuerte",
};

export type WeatherSnapshot = {
  tempC: number;
  code: number;
  isDay: boolean;
  label: string;
};

const ALICANTE = { lat: 38.3452, lon: -0.4815 };

export function weatherLabel(code: number): string {
  return WMO_LABEL[code] ?? "—";
}

export function useWeather() {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${ALICANTE.lat}&longitude=${ALICANTE.lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((j) => {
        if (!alive) return;
        const c = j?.current;
        if (!c) throw new Error("bad payload");
        setData({
          tempC: Math.round(c.temperature_2m),
          code: Number(c.weather_code),
          isDay: c.is_day === 1,
          label: weatherLabel(Number(c.weather_code)),
        });
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading, error };
}
