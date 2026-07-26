import { motion } from 'framer-motion';

export default function WorkspaceJourneyIcon({
  className = '',
  compact = false,
  feature,
  layoutId,
}) {
  const Icon = feature.icon;

  return (
    <motion.span
      className={`workspace-journey-icon ${className}`.trim()}
      data-tone={feature.tone}
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 210, damping: 27 }}
    >
      <Icon
        className={compact ? 'h-4 w-4' : 'h-5 w-5'}
        strokeWidth={compact ? 1.9 : 1.8}
        aria-hidden="true"
      />
    </motion.span>
  );
}
