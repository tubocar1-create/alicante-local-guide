import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Droplets, Wind, Thermometer } from "lucide-react";
import { weatherLabel } from "@/hooks/useWeather";

export const Route = createFileRoute("/clima")({
  head: () => ({
    meta: [
      { title: "Clima en Alicante — Alicante Friend" },
      {
        name: "description",
        content:
          "Tiempo actual y previsión de los próximos días en Alicante: temperatura, lluvia, viento y humedad.",
      },
      { property: "og:title", content: "Clima en Alicante — tiempo y previsión" },
      { property: "og:description", content: "Tiempo actual y previsión por días en Alicante: temperatura, lluvia, viento y humedad." },
      { property: "og:url", content: "https://vamosalicante.com/clima" }
    ],
  links: [
      { rel: "canonical", href: "https://vamosalicante.com/clima" },
    ],
  }),
  component: ClimaPage,
});

const ALICANTE = { lat: 38.3452, lon: -0.4815 };

type Forecast = {
  current: {
    tempC: number;
    apparentC: number;
    code: number;
    isDay: boolean;
    humidity: number;
    windKmh: number;
  } | null;
  daily: Array<{
    date: string;
    code: number;
    tMax: number;
    tMin: number;
    rainMm: number;
  }>;
};

function iconFor(code: number, isDay = true) {
  if ([0, 1].includes(code)) return Sun;
  if ([2, 3].includes(code)) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return isDay ? Sun : Cloud;
}

function dayName(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
}

function ClimaPage() {
  const [data, setData] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${ALICANTE.lat}&longitude=${ALICANTE.lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=auto&forecast_days=7`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("Error de red");
        return r.json();
      })
      .then((j) => {
        const c = j.current ?? {};
        const d = j.daily ?? {};
        setData({
          current: {
            tempC: Math.round(c.temperature_2m),
            apparentC: Math.round(c.apparent_temperature),
            code: Number(c.weather_code),
            isDay: c.is_day === 1,
            humidity: Math.round(c.relative_humidity_2m),
            windKmh: Math.round(c.wind_speed_10m),
          },
          daily: (d.time ?? []).map((t: string, i: number) => ({
            date: t,
            code: Number(d.weather_code?.[i] ?? 0),
            tMax: Math.round(d.temperature_2m_max?.[i] ?? 0),
            tMin: Math.round(d.temperature_2m_min?.[i] ?? 0),
            rainMm: Number(d.precipitation_sum?.[i] ?? 0),
          })),
        });
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const Icon = iconFor(data?.current?.code ?? 0, data?.current?.isDay ?? true);

  return (
    <div className="min-h-screen bg-[oklch(0.985_0.018_88)] text-foreground">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-background/40 backdrop-blur">
        <Link
          to="/"
          aria-label="Volver"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 ring-1 ring-border/60 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-bold">Clima en Alicante</h1>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        {error && (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            No se pudo cargar el clima: {error}
          </p>
        )}

        {!data && !error && (
          <div className="h-40 rounded-2xl bg-white/70 ring-1 ring-border/60 animate-pulse" />
        )}

        {data?.current && (
          <section className="rounded-2xl bg-white/80 ring-1 ring-border/60 p-5 shadow-soft">
            <div className="flex items-center gap-4">
              <Icon className="h-14 w-14 text-[oklch(0.78_0.16_70)]" />
              <div>
                <p className="text-5xl font-bold leading-none">{data.current.tempC}°</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {weatherLabel(data.current.code)}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-[oklch(0.97_0.02_85)] p-2 flex flex-col items-center">
                <Thermometer className="h-4 w-4 mb-1 text-muted-foreground" />
                <span className="font-semibold">{data.current.apparentC}°</span>
                <span className="text-muted-foreground">Sensación</span>
              </div>
              <div className="rounded-xl bg-[oklch(0.97_0.02_85)] p-2 flex flex-col items-center">
                <Droplets className="h-4 w-4 mb-1 text-muted-foreground" />
                <span className="font-semibold">{data.current.humidity}%</span>
                <span className="text-muted-foreground">Humedad</span>
              </div>
              <div className="rounded-xl bg-[oklch(0.97_0.02_85)] p-2 flex flex-col items-center">
                <Wind className="h-4 w-4 mb-1 text-muted-foreground" />
                <span className="font-semibold">{data.current.windKmh} km/h</span>
                <span className="text-muted-foreground">Viento</span>
              </div>
            </div>
          </section>
        )}

        {data?.daily && data.daily.length > 0 && (
          <section className="rounded-2xl bg-white/80 ring-1 ring-border/60 p-3 shadow-soft">
            <h2 className="px-2 py-1 text-sm font-bold">Próximos días</h2>
            <ul className="divide-y divide-border/50">
              {data.daily.map((d) => {
                const I = iconFor(d.code, true);
                return (
                  <li key={d.date} className="flex items-center gap-3 px-2 py-2">
                    <span className="w-20 text-sm capitalize">{dayName(d.date)}</span>
                    <I className="h-5 w-5 text-[oklch(0.78_0.16_70)]" />
                    <span className="flex-1 text-xs text-muted-foreground truncate">
                      {weatherLabel(d.code)}
                    </span>
                    {d.rainMm > 0 && (
                      <span className="text-[11px] text-sky-700">{d.rainMm.toFixed(1)} mm</span>
                    )}
                    <span className="text-sm font-semibold w-14 text-right">
                      {d.tMax}° <span className="text-muted-foreground font-normal">/ {d.tMin}°</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="text-[11px] text-muted-foreground text-center">
          Datos: Open-Meteo · Alicante
        </p>
      </main>
    </div>
  );
}
