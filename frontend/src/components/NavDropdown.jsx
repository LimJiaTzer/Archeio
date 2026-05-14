import React from 'react';

export default function NavDropdown({ item }) {
  return (
    <div className="relative group py-4 -my-4">
      <button className="hover:text-stone-900 transition-colors font-semibold">{item.title}</button>
      
      {/* Dropdown panel */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 transform origin-top scale-95 group-hover:scale-100">
        <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl p-2 flex flex-col">
          {item.options && item.options.map((opt, i) => (
            <a key={i} href={opt.href} className="px-4 py-2 hover:bg-white/80 rounded-2xl text-stone-700 hover:text-stone-900 transition-colors text-sm font-medium">
              {opt.label}
            </a>
          ))}
          
          {item.categories && item.categories.map((cat, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <div className="px-4 py-2 text-xs font-bold text-stone-400 uppercase tracking-widest">{cat.title}</div>
              {cat.options.map((opt, j) => (
                <a key={j} href={opt.href} className="block px-4 py-2 flex-1 mx-1 hover:bg-white/80 rounded-2xl text-stone-700 hover:text-stone-900 transition-colors text-sm font-medium">
                  {opt.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
