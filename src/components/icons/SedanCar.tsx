type Props = React.SVGProps<SVGSVGElement> & { size?: number };

export function SedanCar({ size = 24, ...props }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Carrocería sedán gama media: capó + techo + maletero */}
      <path d="M5 40 L11 40 L17 27 C19 24 22 22 26 22 L40 22 C44 22 47 24 49 27 L55 32 L59 34 C60 34.5 60 36 60 37 L60 40 L55 40" />
      {/* Línea inferior de la carrocería entre ruedas */}
      <path d="M23 40 L41 40" />
      {/* Techo / pilares */}
      <path d="M20 27 L28 22" />
      <path d="M44 27 L36 22" />
      <path d="M32 22 L32 27" />
      {/* División ventanas */}
      <path d="M19 28 L45 28" opacity="0.6" />
      {/* Faros */}
      <path d="M55 35 L58 35" />
      <path d="M9 35 L11 35" opacity="0.7" />
      {/* Ruedas */}
      <circle cx="18" cy="42" r="5" />
      <circle cx="46" cy="42" r="5" />
      {/* Tapacubos */}
      <circle cx="18" cy="42" r="1.5" fill="currentColor" />
      <circle cx="46" cy="42" r="1.5" fill="currentColor" />
    </svg>
  );
}
