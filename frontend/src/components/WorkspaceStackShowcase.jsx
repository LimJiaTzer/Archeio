import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Layers3, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import FeatureDetailGroup from './features/FeatureDetailGroup';
import WorkspaceJourneyToken from './WorkspaceJourneyToken';
import { orderedWorkspaceFeatures } from '../data/workspaceFeatures';

const orbitPositions = [
  { x: '5%', y: '12%' },
  { x: '82%', y: '12%' },
  { x: '1%', y: '45%' },
  { x: '84%', y: '45%' },
  { x: '7%', y: '78%' },
  { x: '79%', y: '78%' },
];

const getStackOffset = (index) => {
  if (index === 0) return '0rem';

  return `clamp(${index * 3}rem, calc(${index * 20}dvh - ${index * 9}rem), ${index * 4.5}rem)`;
};

export default function WorkspaceStackShowcase({
  iconPhase,
  overviewRef,
  stackRef,
}) {
  const shouldReduceMotion = useReducedMotion();
  const sentinelsRef = useRef([]);
  const activeFrameRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const handleWorkspaceJump = (event, index) => {
    const sentinel = sentinelsRef.current[index];
    if (!sentinel) return;

    event.preventDefault();
    const card = document.getElementById(`home-${orderedWorkspaceFeatures[index].id}`);
    const stickyTop = card ? Number.parseFloat(getComputedStyle(card).top) || 0 : 0;
    const targetTop = window.scrollY + sentinel.getBoundingClientRect().top - stickyTop;

    window.scrollTo({
      top: targetTop,
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    });
    window.history.replaceState(
      null,
      '',
      `#home-${orderedWorkspaceFeatures[index].id}`,
    );
  };

  useEffect(() => {
    const updateActiveIndex = () => {
      activeFrameRef.current = null;
      let nextActiveIndex = -1;

      sentinelsRef.current.forEach((sentinel, index) => {
        if (!sentinel) return;

        const card = document.getElementById(
          `home-${orderedWorkspaceFeatures[index].id}`,
        );
        if (!card) return;

        const cardStyles = getComputedStyle(card);
        const stickyTop = Number.parseFloat(cardStyles.top);
        const rail = document.querySelector('.home-workspace-rail');
        const mobileActivationTop = rail
          ? rail.getBoundingClientRect().bottom + 12
          : Math.min(window.innerHeight * 0.3, 180);
        const activationTop = cardStyles.position === 'sticky'
          ? stickyTop
          : mobileActivationTop;

        if (sentinel.getBoundingClientRect().top <= activationTop + 1) {
          nextActiveIndex = index;
        }
      });

      setActiveIndex((currentIndex) => (
        currentIndex === nextActiveIndex ? currentIndex : nextActiveIndex
      ));
    };

    const requestActiveIndexUpdate = () => {
      if (activeFrameRef.current !== null) return;
      activeFrameRef.current = window.requestAnimationFrame(updateActiveIndex);
    };

    updateActiveIndex();
    window.addEventListener('scroll', requestActiveIndexUpdate, { passive: true });
    window.addEventListener('resize', requestActiveIndexUpdate);

    return () => {
      window.removeEventListener('scroll', requestActiveIndexUpdate);
      window.removeEventListener('resize', requestActiveIndexUpdate);
      if (activeFrameRef.current !== null) {
        window.cancelAnimationFrame(activeFrameRef.current);
      }
    };
  }, []);

  return (
    <section
      id="workspace-tour"
      className="home-workspace-showcase"
      aria-labelledby="workspace-showcase-title"
    >
      <section
        className="home-feature-map-stage"
        id="home-feature-map"
        ref={overviewRef}
        aria-labelledby="home-feature-map-title"
      >
        <motion.div
          className="home-feature-map-card"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 34, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="features-eyebrow">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            The complete toolbox
          </span>
          <h2 id="home-feature-map-title">Every feature, clearly mapped.</h2>
          <p>
            See exactly what each Archeío workspace can do, which formats
            work together, and where to start.
          </p>

          <div className="features-stats" aria-label="Product overview">
            <div>
              <strong>6</strong>
              <span>focused workspaces</span>
            </div>
            <div>
              <strong>30+</strong>
              <span>supported formats</span>
            </div>
            <div>
              <strong>0</strong>
              <span>ads in your workflow</span>
            </div>
          </div>
        </motion.div>

        {iconPhase === 'orbit' && (
          <nav className="home-feature-orbit" aria-label="Jump to a workspace">
            {orderedWorkspaceFeatures.map((feature, index) => (
              <div
                className="home-feature-orbit-motion"
                style={{
                  '--orbit-x': orbitPositions[index].x,
                  '--orbit-y': orbitPositions[index].y,
                  '--orbit-delay': `${index * -1.15}s`,
                }}
                key={feature.id}
              >
                <a
                  href={`#home-${feature.id}`}
                  className="home-feature-orbit-link"
                  data-tone={feature.tone}
                  aria-label={`Jump to ${feature.title}`}
                  onClick={(event) => handleWorkspaceJump(event, index)}
                >
                  <WorkspaceJourneyToken
                    feature={feature}
                    layoutId={
                      shouldReduceMotion ? undefined : `home-workspace-token-${feature.id}`
                    }
                    phase="orbit"
                    reducedMotion={shouldReduceMotion}
                  />
                </a>
              </div>
            ))}
          </nav>
        )}
      </section>

      <div className="home-workspace-intro">
        <span className="section-label">A CLOSER LOOK</span>
        <div>
          <h2
            id="workspace-showcase-title"
            aria-label="Six workspaces. One Tool"
          >
            <span>Six workspaces.</span>
            <span>One Tool</span>
          </h2>
          <p>
            Scroll through every Archeío workspace, then open the one that fits
            what you need to do next.
          </p>
        </div>
      </div>

      <div className="home-workspace-experience" ref={stackRef}>
        <aside className="home-workspace-rail">
          {iconPhase === 'stack' && (
            <nav className="home-workspace-rail-list" aria-label="Workspace shortcuts">
              {orderedWorkspaceFeatures.map((feature, index) => (
                <div
                  className="home-workspace-rail-motion"
                  key={feature.id}
                >
                  <a
                    href={`#home-${feature.id}`}
                    className="home-workspace-rail-link"
                    data-active={activeIndex === index}
                    data-reached={index <= activeIndex}
                    data-tone={feature.tone}
                    aria-current={activeIndex === index ? 'step' : undefined}
                    aria-label={`Jump to ${feature.title}`}
                    onClick={(event) => handleWorkspaceJump(event, index)}
                  >
                    <WorkspaceJourneyToken
                      feature={feature}
                      layoutId={
                        shouldReduceMotion ? undefined : `home-workspace-token-${feature.id}`
                      }
                      phase="rail"
                      reducedMotion={shouldReduceMotion}
                    />
                  </a>
                </div>
              ))}
            </nav>
          )}
        </aside>

        <div className="home-workspace-content">
          <div className="home-workspace-list">
            {orderedWorkspaceFeatures.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <div className="home-workspace-stack-entry" key={feature.id}>
                  <span
                    className="home-workspace-sentinel"
                    data-index={index}
                    ref={(node) => {
                      sentinelsRef.current[index] = node;
                    }}
                    aria-hidden="true"
                  />

                  <article
                    className="home-workspace-card"
                    data-active={activeIndex === index}
                    data-passed={index < activeIndex}
                    data-tone={feature.tone}
                    data-workspace={feature.id}
                    id={`home-${feature.id}`}
                    style={{
                      '--workspace-stack-index': index + 1,
                      '--workspace-stack-offset': getStackOffset(index),
                    }}
                  >
                    <header className="feature-card-header">
                      <div className="feature-card-heading">
                        <span className="feature-card-number">0{index + 1}</span>
                        <span className="feature-card-icon">
                          <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <div>
                          <span className="feature-card-kicker">{feature.kicker}</span>
                          <h2>{feature.title}</h2>
                          <p>{feature.description}</p>
                        </div>
                      </div>

                      <Link to={feature.href} className="feature-card-action">
                        <span>{feature.action}</span>
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </header>

                    <div className="home-workspace-card-scroll">
                      <div className="feature-badge-list">
                        {feature.badges.map((badge) => (
                          <span key={badge}>
                            <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
                            {badge}
                          </span>
                        ))}
                      </div>

                      <div className="feature-detail-grid">
                        {feature.groups.map((group) => (
                          <FeatureDetailGroup group={group} key={group.title} />
                        ))}
                      </div>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
