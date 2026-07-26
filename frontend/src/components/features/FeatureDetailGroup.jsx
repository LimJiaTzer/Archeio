import { ArrowRight, Check } from 'lucide-react';

export default function FeatureDetailGroup({ group }) {
  return (
    <section className={`feature-detail-panel ${group.wide ? 'feature-detail-wide' : ''}`}>
      <h3>{group.title}</h3>
      {group.description && <p>{group.description}</p>}

      {group.pairs && (
        <div className="feature-pair-list">
          {group.pairs.map((pair) => (
            <div className="feature-pair" key={`${pair.label}-${pair.from}`}>
              <span className="feature-pair-label">{pair.label}</span>
              <strong>{pair.from}</strong>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              <span>{pair.to}</span>
            </div>
          ))}
        </div>
      )}

      {group.chips && (
        <div className="feature-chip-list">
          {group.chips.map((chip) => <span key={chip}>{chip}</span>)}
        </div>
      )}

      {group.items && (
        <ul className="feature-check-list">
          {group.items.map((item) => (
            <li key={item}>
              <span><Check className="h-3.5 w-3.5" /></span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
