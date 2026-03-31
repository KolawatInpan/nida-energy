import React from 'react';

function Card({ children, className = '' }) {
  return <div className={`bg-white border border-gray-200 rounded-xl ${className}`}>{children}</div>;
}

export default function AdminKpiSection({ title, items, variant = 'financial', onNavigate }) {
  if (variant === 'status') {
    return (
      <section className="mb-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">{title}</h2>
        <div className="flex gap-3">
          {items.map((item) => (
            <Card key={item.title} className="p-4 flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-lg text-slate-600">
                    <span>{item.icon}</span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">{item.title}</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">{item.value}</div>
                    <div className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full ${item.tone}`}>{item.note}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => item.route && onNavigate(item.route)}
                  className="text-gray-300 text-xl transition hover:text-blue-500"
                  aria-label={`Go to ${item.title}`}
                >
                  &#8594;
                </button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  const iconTone = variant === 'energy' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600';

  return (
    <section className="mb-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="flex gap-3">
        {items.map((item) => (
          <Card key={item.title} className="p-4 flex-1 min-w-0">
            <div className={variant === 'energy' ? 'flex items-start gap-3' : 'mb-3 flex items-start justify-between gap-3'}>
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${iconTone}`}>
                  <span>{item.icon}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">{item.title}</div>
                  {variant === 'financial' ? <div className="mt-1 text-[10px] text-gray-400">{item.delta}</div> : null}
                </div>
              </div>
              {variant === 'financial' ? (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.good ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {item.good ? 'Live' : 'Alert'}
                </span>
              ) : null}
            </div>
            <div className={`${variant === 'energy' ? 'text-3xl mt-2' : 'text-2xl'} font-bold text-gray-900 leading-tight`}>{item.value}</div>
            <div className="text-xs text-gray-500 mt-1">{item.unit}</div>
            {variant === 'energy' ? (
              <div className="h-2 rounded-full bg-gray-100 mt-4 overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${item.pct}%` }} />
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </section>
  );
}
