import { useEffect, useRef, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Layers3, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import FeatureDetailGroup from './features/FeatureDetailGroup';
import { orderedWorkspaceFeatures } from '../data/workspaceFeatures';

const orbitPositions = [
  { x: '5%', y: '12%' },
  { x: '82%', y: '12%' },
  { x: '1%', y: '45%' },
  { x: '84%', y: '45%' },
  { x: '7%', y: '78%' },
  { x: '79%', y: '78%' },
];

function WorkspaceIcon({ feature, compact = false }) {
  const Icon = feature.icon;

  return (
    <>
      <span className="home-workspace-icon">
        <Icon
          className={compact ? 'h-4 w-4' : 'h-5 w-5'}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      </span>
      <span className="home-workspace-icon-label">{feature.kicker}</span>
    </>
  );
}

export default function WorkspaceStackShowcase() {
  const shouldReduceMotion = useReducedMotion();
  const sentinelsRef = useRef([]);
  const finaleRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showOrbit, setShowOrbit] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const cardObserver = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) => (
              Number(first.target.dataset.index) - Number(second.target.dataset.index)
            ),
          )
          .forEach((entry) => {
            setActiveIndex(Number(entry.target.dataset.index));
          });
      },
      {
        rootMargin: '-16% 0px -74% 0px',
        threshold: 0,
      },
    );

    const finaleObserver = new IntersectionObserver(
      ([entry]) => setShowOrbit(entry.isIntersecting),
      {
        rootMargin: '-18% 0px -18% 0px',
        threshold: 0.08,
      },
    );

    sentinelsRef.current.forEach((sentinel) => {
      if (sentinel) cardObserver.observe(sentinel);
    });

    const finale = finaleRef.current;
    if (finale) finaleObserver.observe(finale);

    return () => {
      cardObserver.disconnect();
      finaleObserver.disconnect();
    };
  }, []);

  return (
    <section
      id="tools"
      className="home-workspace-showcase"
      aria-labelledby="workspace-showcase-title"
    >
      <div className="home-workspace-intro">
        <span className="section-label">THE COMPLETE TOOLBOX</span>
        <div>
          <h2 id="workspace-showcase-title">Six workspaces. One fluid tour.</h2>
          <p>
            Scroll through every Archeío workspace, then open the one that fits
            what you need to do next.
          </p>
        </div>
      </div>

      <LayoutGroup id="home-workspace-icons">
        <div className="home-workspace-experience">
          <aside className="home-workspace-rail">
            {!showOrbit && (
              <nav className="home-workspace-rail-list" aria-label="Workspace shortcuts">
                {orderedWorkspaceFeatures.map((feature, index) => (
                  <motion.div
                    className="home-workspace-rail-motion"
                    layoutId={
                      shouldReduceMotion ? undefined : `home-workspace-icon-${feature.id}`
                    }
                    transition={{ type: 'spring', stiffness: 220, damping: 26 }}
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
                    >
                      <WorkspaceIcon feature={feature} compact />
                    </a>
                  </motion.div>
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
                      data-tone={feature.tone}
                      id={`home-${feature.id}`}
                      style={{ '--workspace-stack-index': index + 1 }}
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

            <section
              className="home-feature-map-stage"
              ref={finaleRef}
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

              {showOrbit && (
                <nav className="home-feature-orbit" aria-label="Open a workspace">
                  {orderedWorkspaceFeatures.map((feature, index) => (
                    <motion.div
                      className="home-feature-orbit-motion"
                      layoutId={
                        shouldReduceMotion ? undefined : `home-workspace-icon-${feature.id}`
                      }
                      style={{
                        '--orbit-x': orbitPositions[index].x,
                        '--orbit-y': orbitPositions[index].y,
                        '--orbit-delay': `${index * -1.15}s`,
                      }}
                      transition={{ type: 'spring', stiffness: 185, damping: 24 }}
                      key={feature.id}
                    >
                      <Link
                        to={feature.href}
                        className="home-feature-orbit-link"
                        data-tone={feature.tone}
                        aria-label={`Open ${feature.title}`}
                      >
                        <WorkspaceIcon feature={feature} />
                      </Link>
                    </motion.div>
                  ))}
                </nav>
              )}
            </section>
          </div>
        </div>
      </LayoutGroup>
    </section>
  );
}
