import { ArrowRight, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NavDropdown({ item }) {
  const hasLinks = Boolean(item.links?.length);

  return (
    <div className="group relative -my-3 py-3">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 font-semibold transition-colors hover:text-stone-950"
        aria-haspopup="true"
      >
        {item.title}
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-180" />
      </button>

      <div
        className={`invisible absolute left-1/2 top-full z-[70] -translate-x-1/2 translate-y-1 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 ${
          hasLinks ? 'w-[22rem]' : 'w-[19rem]'
        }`}
      >
        <div className="compact-nav-popover rounded-2xl p-3">
          {hasLinks ? (
            <div className="grid gap-1">
              {item.links.map((link) => (
                <Link to={link.href} className="compact-nav-link group/link" key={link.href}>
                  <span>
                    <strong>{link.label}</strong>
                    <small>{link.description}</small>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover/link:translate-x-0.5" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-2">
              <span className="compact-nav-eyebrow">{item.eyebrow}</span>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {item.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.highlights.map((highlight) => (
                  <span className="compact-nav-chip" key={highlight}>
                    {highlight}
                  </span>
                ))}
              </div>
              <Link to={item.href} className="compact-nav-cta">
                Open {item.title}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
