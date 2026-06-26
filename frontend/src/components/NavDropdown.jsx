import React from 'react';

export default function NavDropdown({ item }) {
  const hasCategories = item.categories && item.categories.length > 0;
  const hasOptions = item.options && item.options.length > 0;

  return (
    <div className="relative group py-4 -my-4 z-[60]">
      <button className="hover:text-stone-900 transition-colors font-semibold cursor-pointer">
        {item.title}
      </button>

      {/* Mega menu for categorized dropdowns */}
      {hasCategories && (
        <div className="fixed left-1/2 -translate-x-1/2 top-[36px] pt-2 w-[calc(100vw-4rem)] max-w-7xl opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto transition-all duration-300 z-50 origin-top scale-95 group-hover:scale-100">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
            
            {/* Header row */}
            <div
              className="grid border-b border-stone-200"
              style={{
                gridTemplateColumns: `repeat(${item.categories.length}, minmax(0, 1fr))`,
              }}
            >
              {item.categories.map((cat, i) => (
                <div
                  key={i}
                  className={`px-7 py-5 ${
                    i !== 0 ? 'border-l border-stone-200' : ''
                  }`}
                >
                  <h3 className="text-base font-bold text-stone-950">
                    {cat.title}
                  </h3>
                </div>
              ))}
            </div>

            {/* Options row */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${item.categories.length}, minmax(0, 1fr))`,
              }}
            >
              {item.categories.map((cat, i) => (
                <div
                  key={i}
                  className={`px-7 py-6 ${
                    i !== 0 ? 'border-l border-stone-200' : ''
                  }`}
                >
                  <div className="space-y-5">
                    {cat.options.map((opt, j) => (
                      <a
                        key={j}
                        href={opt.href}
                        className="block text-base font-medium text-stone-800 hover:text-[#E08E19] transition-colors"
                      >
                        {opt.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Small dropdown for normal options */}
      {hasOptions && !hasCategories && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 w-56 opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto transition-all duration-300 z-50 origin-top scale-95 group-hover:scale-100">
          <div className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl p-2 flex flex-col">
            {item.options.map((opt, i) => (
              <a
                key={i}
                href={opt.href}
                className="px-4 py-2 hover:bg-white/80 rounded-2xl text-stone-700 hover:text-stone-900 transition-colors text-sm font-medium"
              >
                {opt.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}