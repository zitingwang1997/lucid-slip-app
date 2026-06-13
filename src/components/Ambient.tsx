import { useMemo } from "react";

interface AmbientProps {
  intensity?: number; // 0–1 affects particle density
  showParticles?: boolean;
}

export function Ambient({ intensity = 0.6, showParticles = true }: AmbientProps) {
  const particles = useMemo(() => {
    const count = Math.round(18 * intensity);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 14,
      duration: 18 + Math.random() * 16,
      size: 1 + Math.random() * 2.5,
      opacity: 0.2 + Math.random() * 0.4,
    }));
  }, [intensity]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden max-w-full">
      <div className="ambient-smoke" />
      {showParticles &&
        particles.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              bottom: "-10px",
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: `oklch(0.78 0.13 55 / ${p.opacity})`,
              boxShadow: `0 0 ${p.size * 4}px oklch(0.74 0.13 55 / ${p.opacity * 0.6})`,
              animation: `float-particle ${p.duration}s linear ${p.delay}s infinite`,
            }}
          />
        ))}
    </div>
  );
}
