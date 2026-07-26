import { useEffect, useRef, useState } from 'react';
import { LayoutGroup } from 'framer-motion';
import HomeToolboxGrid from './HomeToolboxGrid';
import WorkspaceStackShowcase from './WorkspaceStackShowcase';

const ICON_PHASE = {
  TOOLBOX: 'toolbox',
  ORBIT: 'orbit',
  STACK: 'stack',
};

export default function HomeFeatureJourney() {
  const overviewRef = useRef(null);
  const stackRef = useRef(null);
  const frameRef = useRef(null);
  const [iconPhase, setIconPhase] = useState(ICON_PHASE.TOOLBOX);
  const [orbitProgress, setOrbitProgress] = useState(0);

  useEffect(() => {
    const updateIconPhase = () => {
      frameRef.current = null;

      const overview = overviewRef.current;
      const stack = stackRef.current;
      if (!overview || !stack) return;

      const viewportHeight = window.innerHeight;
      const overviewStart = viewportHeight * 0.72;
      const stackStart = viewportHeight * 0.68;
      const overviewBounds = overview.getBoundingClientRect();
      const stackBounds = stack.getBoundingClientRect();
      const scrollTop = window.scrollY;
      const orbitStart = scrollTop + overviewBounds.top - overviewStart;
      const orbitEnd = scrollTop + stackBounds.top - stackStart;
      const orbitRange = Math.max(orbitEnd - orbitStart, 1);
      const nextOrbitProgress = Math.min(
        1,
        Math.max(0, (scrollTop - orbitStart) / orbitRange),
      );
      const nextPhase = stackBounds.top <= stackStart
        ? ICON_PHASE.STACK
        : overviewBounds.top <= overviewStart
          ? ICON_PHASE.ORBIT
          : ICON_PHASE.TOOLBOX;

      setIconPhase((currentPhase) => (
        currentPhase === nextPhase ? currentPhase : nextPhase
      ));
      setOrbitProgress((currentProgress) => (
        Math.abs(currentProgress - nextOrbitProgress) < 0.001
          ? currentProgress
          : nextOrbitProgress
      ));
    };

    const requestPhaseUpdate = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(updateIconPhase);
    };

    updateIconPhase();
    window.addEventListener('scroll', requestPhaseUpdate, { passive: true });
    window.addEventListener('resize', requestPhaseUpdate);

    return () => {
      window.removeEventListener('scroll', requestPhaseUpdate);
      window.removeEventListener('resize', requestPhaseUpdate);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <LayoutGroup id="home-workspace-icons">
      <div
        className="home-feature-journey"
        data-icon-phase={iconPhase}
        data-orbit-progress={orbitProgress.toFixed(3)}
      >
        <HomeToolboxGrid
          iconPhase={iconPhase}
        />
        <WorkspaceStackShowcase
          iconPhase={iconPhase}
          orbitProgress={orbitProgress}
          overviewRef={overviewRef}
          stackRef={stackRef}
        />
      </div>
    </LayoutGroup>
  );
}
