import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useTour } from '../../global/TourContext';

export default function TourOverlay() {
  const { tourStep, currentFlow, stopTour, prevStep, nextStep, jumpToStep, flowSteps, colorMap } = useTour();
  const history = useHistory();
  const [minimized, setMinimized] = useState(false);
  const [showStepList, setShowStepList] = useState(false);

  // Auto-navigate when tourStep changes
  useEffect(() => {
    if (currentFlow?.navigateTo) {
      history.push(currentFlow.navigateTo);
    }
  }, [tourStep]);

  if (!tourStep || !currentFlow) return null;

  const handleJumpToStep = (stepIdx) => {
    jumpToStep(stepIdx);
    setShowStepList(false);
  };

  const stepBadgeColor = (color) => colorMap[color] || '#1677ff';

  // Minimized badge
  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {showStepList && (
          <div className="mb-2 w-72 rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">📋 รายการทั้งหมด</span>
              <button onClick={() => setShowStepList(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {flowSteps.map((step, i) => (
                <button
                  key={step.step}
                  onClick={() => handleJumpToStep(i + 1)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    tourStep === i + 1 ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                    tourStep === i + 1 ? 'ring-2 ring-offset-1' : ''
                  }`}
                    style={{ background: stepBadgeColor(step.color) }}
                  >
                    {step.step}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800 truncate">{step.title}</div>
                    <div className="text-xs text-gray-400 truncate">{step.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => setShowStepList(!showStepList)}
          className="w-14 h-14 rounded-full bg-white shadow-2xl border border-gray-200 flex items-center justify-center text-2xl hover:bg-gray-50 transition-colors"
          title="ดูรายการทั้งหมด"
        >
          📋
        </button>
        <button
          onClick={() => setMinimized(false)}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white text-xl hover:opacity-90 transition-opacity"
          style={{ background: stepBadgeColor(currentFlow.color) }}
          title="เปิด Auto Guide"
        >
          <span className="font-bold">{tourStep}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 md:w-96">
      <div className="rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
          style={{ background: `linear-gradient(135deg, ${stepBadgeColor(currentFlow.color)}20, #fff)` }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-white px-2 py-1 rounded-full shrink-0"
              style={{ background: stepBadgeColor(currentFlow.color) }}>
              {tourStep}/{flowSteps.length}
            </span>
            <span className="text-xs text-gray-500 truncate">Auto Guide</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowStepList(!showStepList)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors text-xs"
              title="รายการทั้งหมด"
            >
              📋
            </button>
            <button
              onClick={() => setMinimized(true)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors text-xs"
              title="ย่อ"
            >
              —
            </button>
            <button
              onClick={stopTour}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors text-xs"
              title="ออก"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Step List Panel (collapsible) */}
        {showStepList && (
          <div className="border-b border-gray-100 max-h-60 overflow-y-auto">
            <div className="p-2">
              {flowSteps.map((step, i) => (
                <button
                  key={step.step}
                  onClick={() => handleJumpToStep(i + 1)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    tourStep === i + 1 ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                    tourStep === i + 1 ? 'ring-2 ring-offset-1' : ''
                  }`}
                    style={{ background: stepBadgeColor(step.color) }}
                  >
                    {step.step}
                  </span>
                  <span className="text-sm text-gray-700 truncate">{step.title.split('(')[0].trim()}</span>
                  {step.navigateTo && (
                    <span className="text-xs text-gray-300 ml-auto shrink-0">→</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-4">
          {/* Title */}
          <div className="mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shrink-0"
                style={{ background: stepBadgeColor(currentFlow.color) }}>
                {currentFlow.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900 leading-tight">{currentFlow.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{currentFlow.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <ul className="space-y-1.5 mb-3">
            {currentFlow.details.map((detail, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                <span className="text-gray-300 mt-0.5 shrink-0">•</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>

          {currentFlow.tip && (
            <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5 text-xs text-yellow-700">
              💡 {currentFlow.tip}
            </div>
          )}

          {currentFlow.subItems && (
            <div className="mb-3 flex gap-1.5 flex-wrap">
              {currentFlow.subItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => { history.push(item.path); stopTour(); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="flex gap-2">
              <button
                onClick={prevStep}
                disabled={tourStep <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← ย้อนกลับ
              </button>
              <button
                onClick={nextStep}
                disabled={tourStep >= flowSteps.length}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ถัดไป →
              </button>
            </div>
            <div className="flex items-center gap-1">
              {/* Step dots */}
              {flowSteps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleJumpToStep(i + 1)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    tourStep === i + 1 ? 'w-4' : ''
                  }`}
                  style={{ 
                    background: tourStep === i + 1 ? stepBadgeColor(currentFlow.color) : '#d1d5db'
                  }}
                  title={`ขั้นตอนที่ ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
