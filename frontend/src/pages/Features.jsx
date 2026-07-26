import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Layers3,
  Sparkles,
} from 'lucide-react';
import FeatureDetailGroup from '../components/features/FeatureDetailGroup';
import Layout from '../components/Layout';
import { orderedWorkspaceFeatures } from '../data/workspaceFeatures';

export default function Features() {
  return (
    <Layout>
      <main className="responsive-page features-catalog-page mx-auto max-w-7xl">
        <nav className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 font-medium text-stone-600 transition-colors hover:text-stone-950">
            <ArrowLeft className="h-5 w-5" />
            Back to Home
          </Link>
        </nav>

        <section className="features-hero-stage">
          <div className="features-hero-card">
            <div className="features-hero-copy">
              <span className="features-eyebrow">
                <Sparkles className="h-4 w-4" />
                The complete toolbox
              </span>
              <h1>Every feature, clearly mapped.</h1>
              <p>
                See exactly what each Archeío workspace can do, which formats work
                together, and where to start.
              </p>
            </div>

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
          </div>

          <nav className="features-orbit-nav" aria-label="Jump to a feature">
            {orderedWorkspaceFeatures.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <a
                  className="features-orbit-item"
                  data-tone={feature.tone}
                  href={`#${feature.id}`}
                  key={feature.id}
                  style={{
                    '--orbit-column': index % 2 === 0 ? 1 : 3,
                    '--orbit-row': Math.floor(index / 2) + 1,
                  }}
                >
                  <span className="features-orbit-icon">
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <span>{feature.kicker}</span>
                </a>
              );
            })}
          </nav>
        </section>

        <div className="features-card-list">
          {orderedWorkspaceFeatures.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <article
                className="feature-catalog-card"
                data-tone={feature.tone}
                id={feature.id}
                key={feature.id}
              >
                <header className="feature-card-header">
                  <div className="feature-card-heading">
                    <span className="feature-card-number">0{index + 1}</span>
                    <span className="feature-card-icon">
                      <Icon className="h-6 w-6" strokeWidth={1.8} />
                    </span>
                    <div>
                      <span className="feature-card-kicker">{feature.kicker}</span>
                      <h2>{feature.title}</h2>
                      <p>{feature.description}</p>
                    </div>
                  </div>

                  <Link to={feature.href} className="feature-card-action">
                    <span>{feature.action}</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </header>

                <div className="feature-badge-list">
                  {feature.badges.map((badge) => (
                    <span key={badge}>
                      <Layers3 className="h-3.5 w-3.5" />
                      {badge}
                    </span>
                  ))}
                </div>

                <div className="feature-detail-grid">
                  {feature.groups.map((group) => (
                    <FeatureDetailGroup group={group} key={group.title} />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </Layout>
  );
}
