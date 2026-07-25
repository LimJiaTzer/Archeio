export function AnimatedGradientBackground({ className = '' }) {
  return (
    <div
      className={`animated-gradient-background ${className}`}
      aria-hidden="true"
    >
      <div className="gradient-orb gradient-orb-sun" />
      <div className="gradient-orb gradient-orb-peach" />
      <div className="gradient-orb gradient-orb-lilac" />
      <div className="gradient-orb gradient-orb-gold" />
      <div className="gradient-soft-light" />
    </div>
  );
}
