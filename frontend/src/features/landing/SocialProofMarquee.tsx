import React from 'react';

export const SocialProofMarquee: React.FC = () => {
  const creators = [
    { name: 'Alex Hormozi', stat: '100M+ Views', tag: 'Acquisition.com', initial: 'AH', color: 'from-amber-400 to-yellow-600' },
    { name: 'Marques B.', stat: '18M Subscribers', tag: 'MKBHD Tech', initial: 'MB', color: 'from-blue-500 to-cyan-600' },
    { name: 'Ali Abdaal', stat: '5M Subscribers', tag: 'Productivity', initial: 'AA', color: 'from-emerald-400 to-teal-600' },
    { name: 'MrBeast Shorts', stat: '200M+ Reach', tag: 'Entertainment', initial: 'MB', color: 'from-pink-500 to-rose-600' },
    { name: 'Huberman Lab', stat: '4M Followers', tag: 'Science & Health', initial: 'HL', color: 'from-purple-500 to-indigo-600' },
  ];

  return (
    <section className="w-full py-12 bg-surface-0 border-y border-border-subtle overflow-hidden relative">
      <p className="text-center text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">
        Powering Automated Short-Form Production For 16,000+ Creators
      </p>

      <div className="w-full flex overflow-hidden">
        <div className="flex animate-marquee gap-6 items-center px-4">
          {[...creators, ...creators].map((creator, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3.5 bg-surface-1 rounded-2xl px-5 py-3 border border-border-subtle shadow-md min-w-[260px] shrink-0"
            >
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-tr ${creator.color} flex items-center justify-center font-black text-black text-xs shadow-md`}
              >
                {creator.initial}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{creator.name}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-primary font-mono font-semibold">{creator.stat}</span>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="text-muted-foreground text-[11px]">{creator.tag}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
