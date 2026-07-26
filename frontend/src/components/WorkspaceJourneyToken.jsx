import { motion } from 'framer-motion';

export default function WorkspaceJourneyToken({
  className = '',
  feature,
  layoutId,
  phase,
  reducedMotion = false,
}) {
  const Icon = feature.icon;

  return (
    <motion.span
      className={`workspace-journey-token ${className}`.trim()}
      data-phase={phase}
      data-tone={feature.tone}
      layoutId={layoutId}
      transition={{
        layout: {
          type: 'spring',
          stiffness: 150,
          damping: 24,
          mass: 0.9,
        },
      }}
    >
      <span className="workspace-journey-token-icon">
        <Icon aria-hidden="true" />
      </span>
      {phase === 'orbit' && (
        <motion.span
          className="workspace-journey-token-label"
          initial={reducedMotion ? false : { opacity: 0, x: -7 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, delay: 0.18 }}
        >
          {feature.kicker}
        </motion.span>
      )}
    </motion.span>
  );
}
