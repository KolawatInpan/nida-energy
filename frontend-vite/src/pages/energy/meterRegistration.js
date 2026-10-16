import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  getBuildings,
  getUsers,
  registerBuilding,
  registerMeter,
  registerUser,
  registerWallet,
  requestOtpEmail,
} from '../../core/data_connecter/register';
import { assignUserToBuilding } from '../../core/data_connecter/building';
import { useTOR } from '../../global/TORContext';
import TORRegister from '../../components/TOR/TORRegister';
import { getStoredDataMode, DEMO_MODE, REAL_MODE } from '../../core/dataMode';

const REGISTRATION_MODES = {
  USER_ONLY: 'user-only',
  BUILDING_ONLY: 'building-only',
  FULL: 'full',
  METER_ONLY: 'meter-only',
};

const REGISTRATION_MODE_TABS = [
  { id: REGISTRATION_MODES.FULL, label: '🧩 Full', desc: 'Building + User + Meters' },
  { id: REGISTRATION_MODES.USER_ONLY, label: '👤 User', desc: 'Register user only' },
  { id: REGISTRATION_MODES.BUILDING_ONLY, label: '🏢 Building', desc: 'Register building only' },
  { id: REGISTRATION_MODES.METER_ONLY, label: '🔌 Meter', desc: 'Add meters to existing building' },
];

const SERVICE_TYPE_CONFIG = {
  producer: { icon: '⚡', label: 'Producer', color: 'amber', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-700' },
  consumer: { icon: '🔌', label: 'Consumer', color: 'emerald', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', textColor: 'text-emerald-700' },
  battery: { icon: '🔋', label: 'Battery', color: 'blue', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700' },
};

function PasswordRule({ met, label }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
      <span>{met ? '✅' : '⬜'}</span>
      <span>{label}</span>
    </div>
  );
}

const BUILDING_PRESETS = [
  { id: 'ratchaphruek', label: '🏢 Ratchaphruek', name: 'Ratchaphruek', role: 'producer', roleLabel: '⚡ Producer + Battery + Consume', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/TGTXyK34yCovJinC7' },
  { id: 'malai', label: '🏢 Malai', name: 'Malai', role: 'producer', roleLabel: '☀️ Producer (Produce + Consume)', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/Z18Qw8KoDC6rZNcV6' },
  { id: 'auditorium', label: '🏢 Auditorium', name: 'Auditorium', role: 'producer', roleLabel: '🌓 Producer (demo) / Consumer (real)', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.google.com/?q=13.771579509456485,100.65443996963269' },
  { id: 'nidasumpan', label: '🏢 Nida Sumpan', name: 'Nidasumpan', role: 'consumer', roleLabel: '🔌 Consumer only', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/Fhtz7rWTBYtvmqZN9' },
  { id: 'bunchana', label: '🏢 Bunchana', name: 'Bunchana', role: 'consumer', roleLabel: '🔌 Consumer only', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/x2F8LynSaXAy31Jt7' },
  { id: 'chup', label: '🏢 Chup', name: 'Chup', role: 'consumer', roleLabel: '🔌 Consumer only', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/giR2p4fUSkdVC3vaA' },
  { id: 'narathip', label: '🏢 Narathip', name: 'Narathip', role: 'consumer', roleLabel: '🔌 Consumer only', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/Sz4gkVap4b37AujM8' },
  { id: 'navamin', label: '🏢 Navamin', name: 'Navamin', role: 'consumer', roleLabel: '🔌 Consumer only', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/tV3JPGpz8qNTM4d18' },
  { id: 'nidahouse', label: '🏢 Nida House', name: 'Nida house', role: 'consumer', roleLabel: '🔌 Consumer only', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/1YVnyjcwWCA3zgvK8' },
  { id: 'serithai', label: '🏢 Serithai', name: 'Serithai', role: 'consumer', roleLabel: '🔌 Consumer only', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.google.com/?q=Serithai+NIDA+Bangkok' },
  { id: 'siam', label: '🏢 Siam', name: 'Siam', role: 'consumer', roleLabel: '🔌 Consumer only', address: '148 Serithai Road, Klong-Chan, Bangkapi, Bangkok Thailand 10240', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.google.com/?q=Siam+NIDA+Bangkok' },
];
// Shared user email — every user has the same address and is told apart by password.
// Keep in sync with backend USER_EMAIL (.env); VITE_USER_EMAIL takes precedence when set.
const SHARED_USER_EMAIL = import.meta.env?.VITE_USER_EMAIL || 'nida_blockchain.user@nida.ac.th';
// `building` must match a BUILDING_PRESETS `name` — creating a user is only half the
// job, because the wallet and the building pages key off BuildingAssignment.
const USER_PRESETS = [
  { id: 'user-ratcha', name: 'Ratchaphruek User', building: 'Ratchaphruek', password: 'nidauser1' },
  { id: 'user-malai', name: 'Malai User', building: 'Malai', password: 'nidauser2' },
  { id: 'user-audi', name: 'Auditorium User', building: 'Auditorium', password: 'nidauser3' },
  { id: 'user-nidas', name: 'Nidasumpan User', building: 'Nidasumpan', password: 'nidauser4' },
  { id: 'user-buncha', name: 'Bunchana User', building: 'Bunchana', password: 'nidauser5' },
  { id: 'user-chup', name: 'Chup User', building: 'Chup', password: 'nidauser6' },
  { id: 'user-nara', name: 'Narathip User', building: 'Narathip', password: 'nidauser7' },
  { id: 'user-nava', name: 'Navamin User', building: 'Navamin', password: 'nidauser8' },
  { id: 'user-nidah', name: 'Nida House User', building: 'Nida house', password: 'nidauser9' },
  { id: 'user-seri', name: 'Serithai User', building: 'Serithai', password: 'nidauser10' },
  { id: 'user-siam', name: 'Siam User', building: 'Siam', password: 'nidauser11' },
];
const INITIAL_FORM = {
  contactName: '',
  contactEmail: '',
  initialPassword: '',
  phoneNumber: '',
  buildingName: '',
  googleMapsUrl: '',
  address: '',
  city: '',
  postalCode: '',
  meters: [
    {
      serviceType: 'consumer',
      meterSNID: '',
      capacity: '',
      dateInstalled: '',
    },
  ],
  organizationSize: '',
  monthlyConsumption: '',
  additionalComments: '',
  termsAccepted: false,
  dataAccuracyAccepted: false,
  systemNotificationsAccepted: false,
  selectedUserEmail: '',
  selectedBuildingId: '',
};

/* ══════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* ─── Collapsible Section ─── */
function CollapsibleSection({ title, icon, children, badge, defaultOpen = true, required = false, completed = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-all ${completed ? 'border-green-200' : 'border-gray-200'}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {completed ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 text-sm">✓</span>
          ) : (
            <span className="text-lg">{icon}</span>
          )}
          <span className={`text-sm font-bold ${completed ? 'text-green-700' : 'text-gray-800'}`}>{title}</span>
          {required && !completed && <span className="text-xs text-red-500 font-semibold">* required</span>}
          {badge != null && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}
      >
        <div className="px-6 pb-6 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Registration Mode Tabs ─── */
function ModeTabs({ value, onChange }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {REGISTRATION_MODE_TABS.map((tab) => {
          const isActive = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center justify-center rounded-lg px-4 py-3 text-center transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              <span className="text-base font-bold">{tab.label}</span>
              <span className={`text-[10px] mt-0.5 ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
                {tab.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Progress Indicator ─── */
function ProgressIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center justify-between mb-6 px-4">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;
        const isLast = idx === steps.length - 1;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-gray-200 text-gray-500'
              }`}>
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span className={`mt-1.5 text-[10px] font-medium ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── Meter Card (improved visual hierarchy) ─── */
function MeterCard({ meter, idx, onChange, onRemove, canRemove }) {
  const config = SERVICE_TYPE_CONFIG[meter.serviceType] || SERVICE_TYPE_CONFIG.consumer;
  const serviceTypes = [
    { value: 'producer', icon: '⚡', label: 'Producer' },
    { value: 'consumer', icon: '🔌', label: 'Consumer' },
    { value: 'battery', icon: '🔋', label: 'Battery' },
  ];

  return (
    <div className={`rounded-xl border-2 ${config.borderColor} bg-white overflow-hidden transition-all hover:shadow-md`}>
      {/* Header */}
      <div className={`${config.bgColor} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <div className="text-sm font-bold text-gray-800">Meter #{idx + 1}</div>
            <div className={`text-xs font-medium ${config.textColor}`}>{config.label}</div>
          </div>
        </div>
        {canRemove && (
          <button type="button" onClick={() => onRemove(idx)}
            className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors shadow-sm">
            ✕ Remove
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Service Type Selector */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">Service Type</label>
          <div className="grid grid-cols-3 gap-2">
            {serviceTypes.map((type) => {
              const isActive = meter.serviceType === type.value;
              const typeConfig = SERVICE_TYPE_CONFIG[type.value];
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => onChange(idx, 'serviceType', type.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all ${
                    isActive
                      ? `${typeConfig.borderColor} ${typeConfig.bgColor} shadow-sm`
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{type.icon}</span>
                  <span className={`text-xs font-medium ${isActive ? typeConfig.textColor : 'text-gray-500'}`}>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SN + Capacity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Serial Number (SNID) *</label>
            <input required type="text" value={meter.meterSNID} onChange={(e) => onChange(idx, 'meterSNID', e.target.value)}
              placeholder="e.g. RAT-PRD-001"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Capacity (kWh)</label>
            <input type="text" value={meter.capacity} onChange={(e) => onChange(idx, 'capacity', e.target.value)}
              placeholder="e.g. 5"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
          </div>
        </div>

        {/* Installation Date */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Installation Date</label>
          <DatePicker
            selected={meter.dateInstalled ? new Date(meter.dateInstalled + 'T00:00:00') : null}
            onChange={(date) => onChange(idx, 'dateInstalled', date ? date.toISOString().slice(0, 10) : '')}
            dateFormat="dd-MM-yyyy"
            placeholderText="dd-mm-yyyy"
            maxDate={new Date()}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Preview Modal ─── */
function PreviewModal({ formData, registrationMode, onConfirm, onCancel, submitting }) {
  const modeLabels = {
    [REGISTRATION_MODES.FULL]: '🧩 Full Registration',
    [REGISTRATION_MODES.USER_ONLY]: '👤 User Registration',
    [REGISTRATION_MODES.BUILDING_ONLY]: '🏢 Building Registration',
    [REGISTRATION_MODES.METER_ONLY]: '🔌 Meter Registration',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Preview Registration</h2>
              <p className="text-sm text-blue-100">Review your data before submitting</p>
            </div>
            <span className="text-2xl">📋</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          {/* Mode */}
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-400 uppercase">Registration Type</div>
            <div className="text-sm font-bold text-gray-800">{modeLabels[registrationMode]}</div>
          </div>

          {/* Building Info */}
          {(registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.BUILDING_ONLY) && formData.buildingName && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <div className="text-xs font-semibold text-amber-600 uppercase mb-2">🏢 Building</div>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-500">Name:</span> <span className="font-medium">{formData.buildingName}</span></div>
                {formData.address && <div><span className="text-gray-500">Address:</span> <span className="font-medium">{formData.address}</span></div>}
                {formData.city && <div><span className="text-gray-500">City:</span> <span className="font-medium">{formData.city}</span></div>}
              </div>
            </div>
          )}

          {/* User Info */}
          {(registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.USER_ONLY) && formData.contactName && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <div className="text-xs font-semibold text-blue-600 uppercase mb-2">👤 Contact Person</div>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-500">Name:</span> <span className="font-medium">{formData.contactName}</span></div>
                <div><span className="text-gray-500">Email:</span> <span className="font-medium">{formData.contactEmail}</span></div>
                {formData.phoneNumber && <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{formData.phoneNumber}</span></div>}
              </div>
            </div>
          )}

          {/* Meters */}
          {(registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.METER_ONLY) && formData.meters.length > 0 && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <div className="text-xs font-semibold text-emerald-600 uppercase mb-2">🔌 Meters ({formData.meters.length})</div>
              <div className="space-y-2">
                {formData.meters.map((meter, idx) => {
                  const config = SERVICE_TYPE_CONFIG[meter.serviceType] || SERVICE_TYPE_CONFIG.consumer;
                  return (
                    <div key={idx} className="flex items-center gap-3 bg-white rounded-lg p-2">
                      <span className="text-lg">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{meter.meterSNID || 'No SN'}</div>
                        <div className="text-xs text-gray-500">{config.label} {meter.capacity ? `• ${meter.capacity} kWh` : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            ← Edit
          </button>
          <button type="button" onClick={onConfirm} disabled={submitting}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-colors ${
              submitting ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
            }`}>
            {submitting ? 'Submitting...' : '✓ Confirm & Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Progress bar for bulk buttons ─── */
function ProgressBar({ current, total, color }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{current}/{total} done</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function MeterRegistration() {
  const { showTOR } = useTOR();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [registrationMode, setRegistrationMode] = useState(REGISTRATION_MODES.FULL);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [usersList, setUsersList] = useState([]);
  const [buildingsList, setBuildingsList] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(null);
  const [popupResult, setPopupResult] = useState(null);
  const [databaseMode, setDatabaseMode] = useState(() => getStoredDataMode());
  const [bulkResult, setBulkResult] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  /* ─── Count helpers ─── */
  const existingBuildingCount = buildingsList.filter(b =>
    BUILDING_PRESETS.some(p => p.name.toLowerCase() === String(b?.name || '').toLowerCase())
  ).length;
  const existingMeterCount = buildingsList.filter(b =>
    Array.isArray(b?.meters) && b.meters.length > 0
  ).length;
  const existingUserCount = usersList.filter(u =>
    USER_PRESETS.some(p => p.name.toLowerCase() === String(u?.name || '').toLowerCase())
  ).length;

  /* ─── Progress steps ─── */
  const progressSteps = (() => {
    const steps = [];
    if (registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.BUILDING_ONLY) {
      steps.push({ id: 'building', label: 'Building' });
    }
    if (registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.USER_ONLY) {
      steps.push({ id: 'user', label: 'Contact' });
    }
    if (registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.METER_ONLY) {
      steps.push({ id: 'meter', label: 'Meters' });
    }
    steps.push({ id: 'terms', label: 'Terms' });
    return steps;
  })();

  const currentStepIdx = (() => {
    const hasBuilding = formData.buildingName.trim() !== '';
    const hasUser = formData.contactName.trim() !== '' && formData.contactEmail.trim() !== '';
    const hasMeters = formData.meters.some(m => m.meterSNID.trim() !== '');
    const hasTerms = formData.termsAccepted;

    let completed = 0;
    if (registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.BUILDING_ONLY) {
      if (hasBuilding) completed++;
    }
    if (registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.USER_ONLY) {
      if (hasUser) completed++;
    }
    if (registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.METER_ONLY) {
      if (hasMeters) completed++;
    }
    return completed;
  })();

  /* ─── Form handlers ─── */
  const handleFormChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));
  const handleMeterChange = (idx, field, value) => {
    setFormData((prev) => {
      const meters = [...prev.meters];
      meters[idx][field] = value;
      return { ...prev, meters };
    });
  };
  const handleAddMeter = () => {
    setFormData((prev) => ({
      ...prev,
      meters: [
        ...prev.meters,
        { serviceType: 'consumer', meterSNID: '', capacity: '', dateInstalled: '' },
      ],
    }));
  };
  const handleRemoveMeter = (idx) => {
    setFormData((prev) => ({
      ...prev,
      meters: prev.meters.filter((_, i) => i !== idx),
    }));
  };
  const handleCheckboxChange = (field) => setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
  const handleApplyPreset = (preset) => {
    setFormData((prev) => ({
      ...prev,
      buildingName: preset.name,
      address: preset.address,
      city: preset.city,
      postalCode: preset.postalCode,
      googleMapsUrl: preset.mapUrl,
    }));
  };
  const handleAddStandardMeters = () => {
    const today = new Date().toISOString().split('T')[0];
    const prefix = formData.buildingName ? formData.buildingName.replace(/ /g, '').substring(0, 3).toUpperCase() : 'MTR';
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    setFormData((prev) => ({
      ...prev,
      meters: [
        { serviceType: 'producer', meterSNID: `${prefix}-PRD-${rand}`, capacity: '5', dateInstalled: today },
        { serviceType: 'consumer', meterSNID: `${prefix}-CON-${rand}`, capacity: '', dateInstalled: today },
        { serviceType: 'battery', meterSNID: `${prefix}-BAT-${rand}`, capacity: '20', dateInstalled: today },
      ],
    }));
  };

  /* ══════════════════════════════════════════════════════════════
     BULK CREATE HANDLERS
     ══════════════════════════════════════════════════════════════ */

  const handleBulkCreateBuildings = async () => {
    setBulkLoading('bulk-buildings');
    const created = [], skipped = [], errors = [];
    try {
      const existingBuildings = await getBuildings();
      const existList = Array.isArray(existingBuildings) ? existingBuildings : [];
      for (let idx = 0; idx < BUILDING_PRESETS.length; idx++) {
        const preset = BUILDING_PRESETS[idx];
        const exists = existList.some(b => String(b?.name || '').toLowerCase() === preset.name.toLowerCase());
        if (exists) { skipped.push(preset.name); continue; }
        try {
          const b = await registerBuilding(preset.name, preset.mapUrl, preset.address, preset.city, preset.postalCode, null, databaseMode);
          const buildingId = b?.id || b?.data?.id;
          const today = new Date().toISOString().split('T')[0];
          const meterSNs = [];
          const prefix = preset.name.substring(0, 3).toUpperCase();
          if (preset.role === 'producer') {
            const isRatchaphruek = preset.id === 'ratchaphruek';
            try { await registerMeter(buildingId, 'produce', `${prefix}-PRD-${String(idx + 1).padStart(3, '0')}`, 5, today, databaseMode); meterSNs.push('produce'); } catch (e) { console.warn('produce meter failed', e); }
            try { await registerMeter(buildingId, 'consume', `${prefix}-CON-${String(idx + 1).padStart(3, '0')}`, null, today, databaseMode); meterSNs.push('consume'); } catch (e) { console.warn('consume meter failed', e); }
            if (isRatchaphruek) { try { await registerMeter(buildingId, 'battery', `${prefix}-BAT-${String(idx + 1).padStart(3, '0')}`, 20, today, databaseMode); meterSNs.push('battery'); } catch (e) { console.warn('battery meter failed', e); } }
          } else {
            try { await registerMeter(buildingId, 'consume', `${prefix}-CON-${String(idx + 1).padStart(3, '0')}`, null, today, databaseMode); meterSNs.push('consume'); } catch (e) { console.warn('consume meter failed', e); }
          }
          created.push({ name: preset.name, meters: meterSNs.length });
        } catch (e) {
          errors.push({ name: preset.name, error: e?.response?.data?.error || e.message });
        }
      }
      const r = await getBuildings(); setBuildingsList(Array.isArray(r) ? r : []);
      setBulkResult({ type: 'buildings', created, skipped, errors, mode: databaseMode });
    } catch (err) {
      setBulkResult({ type: 'buildings', created, skipped, errors: [...errors, { name: 'System', error: err.message }], mode: databaseMode });
    } finally { setBulkLoading(null); }
  };

  const handleBulkCreateMeters = async () => {
    setBulkLoading('bulk-meters');
    const created = [], skipped = [], errors = [];
    try {
      const existingBuildings = await getBuildings();
      const existList = Array.isArray(existingBuildings) ? existingBuildings : [];
      const today = new Date().toISOString().split('T')[0];
      for (let idx = 0; idx < BUILDING_PRESETS.length; idx++) {
        const preset = BUILDING_PRESETS[idx];
        const building = existList.find(b => String(b?.name || '').toLowerCase() === preset.name.toLowerCase());
        if (!building) { skipped.push(`${preset.name} (building not found)`); continue; }
        if (Array.isArray(building.meters) && building.meters.length > 0) { skipped.push(`${preset.name} (${building.meters.length} meter(s) exist)`); continue; }
        const buildingId = building.id;
        const meterSNs = [];
        const failedForBuilding = [];
        const num = String(idx + 1).padStart(3, '0');
        const prefix = preset.name.substring(0, 3).toUpperCase();

        // Each meter is attempted on its own, but a failure must reach `errors`. These
        // used to be swallowed into console.warn, so the result popup reported a
        // "created" building with 0 meters and the real cause stayed invisible.
        const attemptMeter = async (type, snid, capacity) => {
          try {
            await registerMeter(buildingId, type, snid, capacity, today, databaseMode);
            meterSNs.push(type);
          } catch (e) {
            const raw = e?.response?.data?.error || e.message || 'unknown error';
            // Prisma echoes the entire failing query — keep the first line so the popup stays readable.
            const msg = String(raw).split('\n').map(s => s.trim()).filter(Boolean)[0] || 'unknown error';
            failedForBuilding.push({ name: `${preset.name} · ${snid}`, error: msg });
          }
        };

        if (preset.role === 'producer') {
          await attemptMeter('produce', `${prefix}-PRD-${num}`, 5);
          await attemptMeter('consume', `${prefix}-CON-${num}`, null);
          if (preset.id === 'ratchaphruek') await attemptMeter('battery', `${prefix}-BAT-${num}`, 20);
        } else {
          await attemptMeter('consume', `${prefix}-CON-${num}`, null);
        }

        errors.push(...failedForBuilding);
        // Only report a building as created when at least one meter landed — otherwise the
        // summary claims success for a building that produced nothing.
        if (meterSNs.length > 0) created.push({ name: preset.name, meters: meterSNs.length });
      }
      const r = await getBuildings(); setBuildingsList(Array.isArray(r) ? r : []);
      setBulkResult({ type: 'meters', created, skipped, errors, mode: databaseMode });
    } catch (err) {
      setBulkResult({ type: 'meters', created, skipped, errors: [...errors, { name: 'System', error: err.message }], mode: databaseMode });
    } finally { setBulkLoading(null); }
  };

  const handleBulkCreateUsers = async () => {
    setBulkLoading('bulk-users');
    const created = [], skipped = [], linked = [], errors = [];
    try {
      const [usersRes, buildingsRes] = await Promise.all([getUsers(), getBuildings()]);
      const existList = Array.isArray(usersRes) ? usersRes : [];
      const buildingList = Array.isArray(buildingsRes) ? buildingsRes : [];

      for (const preset of USER_PRESETS) {
        const existing = existList.find(u => String(u?.name || '').toLowerCase() === preset.name.toLowerCase());
        let credId = existing?.credId || null;

        if (existing) {
          skipped.push(preset.name);
        } else {
          try {
            const res = await registerUser(preset.name, SHARED_USER_EMAIL, preset.password, null, null, databaseMode, true);
            credId = res?.credId || res?.user?.credId || res?.data?.credId || null;
            created.push({ name: preset.name, password: preset.password });
          } catch (e) {
            const msg = e?.response?.data?.error || e.message || 'unknown error';
            if (String(msg).includes('already exists')) skipped.push(preset.name);
            else errors.push({ name: preset.name, error: msg });
            continue;
          }
        }

        // Creating a user alone leaves them with no building, so the whole app shows
        // "No building assigned" and no wallet exists. Link the pair here.
        const building = buildingList.find(b => String(b?.name || '').toLowerCase() === preset.building.toLowerCase());
        if (!building) {
          errors.push({ name: `${preset.name} → ${preset.building}`, error: 'building not found — run "Create All Buildings" first' });
          continue;
        }
        if (!credId) {
          errors.push({ name: `${preset.name} → ${preset.building}`, error: 'could not resolve user id for assignment' });
          continue;
        }
        const alreadyLinked = Array.isArray(building.assignedUsers)
          && building.assignedUsers.some(au => String(au?.user?.credId || au?.userId) === String(credId));
        if (alreadyLinked) continue;
        try {
          await assignUserToBuilding(building.id, credId, 'owner');
          linked.push(`${preset.name} → ${building.name}`);
        } catch (e) {
          const msg = e?.response?.data?.error || e.message || 'unknown error';
          errors.push({ name: `${preset.name} → ${building.name}`, error: String(msg).split('\n')[0] });
        }
      }
      const [u, b] = await Promise.all([getUsers(), getBuildings()]);
      setUsersList(Array.isArray(u) ? u : []);
      setBuildingsList(Array.isArray(b) ? b : []);
      setBulkResult({ type: 'users', created, skipped, linked, errors, mode: databaseMode });
    } catch (err) {
      setBulkResult({ type: 'users', created, skipped, linked, errors: [...errors, { name: 'System', error: err.message }], mode: databaseMode });
    } finally { setBulkLoading(null); }
  };

  /* ─── Visibility helpers ─── */
  const needsBuildingSection = registrationMode === REGISTRATION_MODES.BUILDING_ONLY || registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.METER_ONLY;
  const needsUserSection = registrationMode === REGISTRATION_MODES.USER_ONLY || registrationMode === REGISTRATION_MODES.FULL;
  const needsMeterSection = registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.METER_ONLY;

  /* ─── Section completion ─── */
  const buildingCompleted = formData.buildingName.trim() !== '';
  const userCompleted = formData.contactName.trim() !== '' && formData.contactEmail.trim() !== '';
  const meterCompleted = formData.meters.some(m => m.meterSNID.trim() !== '');

  /* ─── Fetch data ─── */
  useEffect(() => {
    getBuildings().then(b => setBuildingsList(Array.isArray(b) ? b : [])).catch(() => {});
    getUsers().then(u => setUsersList(Array.isArray(u) ? u : [])).catch(() => {});
  }, [databaseMode]);

  useEffect(() => {
    if (registrationMode !== REGISTRATION_MODES.METER_ONLY && registrationMode !== REGISTRATION_MODES.BUILDING_ONLY) return;
    let mounted = true;
    (async () => {
      try {
        const results = await Promise.allSettled([getUsers(), getBuildings()]);
        if (!mounted) return;
        const users = results[0].status === 'fulfilled' ? results[0].value : [];
        const buildings = results[1].status === 'fulfilled' ? results[1].value : [];
        const normalizedBuildings = Array.isArray(buildings) ? buildings : [];
        const normalizedUsers = Array.isArray(users) ? users : [];
        const usersByEmail = new Map();
        normalizedUsers.forEach((user) => {
          const email = String(user?.email || '').trim();
          if (!email) return;
          usersByEmail.set(email.toLowerCase(), user);
        });
        normalizedBuildings.forEach((building) => {
          if (Array.isArray(building.assignedUsers)) {
            building.assignedUsers.forEach((au) => {
              const user = au.user;
              if (user?.credId && !usersByEmail.has(user.credId)) {
                usersByEmail.set(user.credId, { credId: user.credId, email: user.email || '', name: user.name || building.name || '' });
              }
            });
          }
        });
        setUsersList(Array.from(usersByEmail.values()));
        setBuildingsList(normalizedBuildings);
      } catch (error) {
        console.error('Failed to load existing users/buildings', error);
        if (!mounted) return;
        setUsersList([]);
        setBuildingsList([]);
      }
    })();
    return () => { mounted = false; };
  }, [registrationMode]);

  /* ─── Submit handler ─── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const needsUser = registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.USER_ONLY;
    if (needsUser && formData.initialPassword) {
      const pw = formData.initialPassword;
      if (pw.length < 8 || !/[0-9]/.test(pw)) {
        message.warning('Password must be at least 8 characters with at least 1 number.');
        return;
      }
    }
    if (!formData.termsAccepted) { alert('Please accept the Terms of Service and Privacy Policy'); return; }
    const needsOtp = registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.USER_ONLY;
    if (needsOtp && !showOtpStep) {
      if (!formData.contactEmail) { alert('Please enter your email first'); return; }
      setSendingOtp(true);
      try { await requestOtpEmail(formData.contactEmail, formData.contactName); setShowOtpStep(true); }
      catch (e) { alert(e?.response?.data?.error || 'Failed to send OTP'); }
      finally { setSendingOtp(false); }
      return;
    }
    if (needsOtp && !otpCode) { alert('Please enter OTP code'); return; }
    if (registrationMode === REGISTRATION_MODES.USER_ONLY && (!formData.contactName || !formData.contactEmail)) { alert('Please fill in all required user fields'); return; }
    if (registrationMode === REGISTRATION_MODES.BUILDING_ONLY && !formData.buildingName) { alert('Please enter a building name'); return; }
    if (registrationMode === REGISTRATION_MODES.FULL) {
      if (!formData.contactName || !formData.contactEmail || !formData.buildingName) { alert('Please fill in all required fields for full registration'); return; }
      for (const meter of formData.meters) { if (!meter.meterSNID) { alert('Please fill in all required meter serial numbers'); return; } }
    }
    if (registrationMode === REGISTRATION_MODES.METER_ONLY) {
      if (!formData.selectedBuildingId) { alert('Please choose an existing building'); return; }
      for (const meter of formData.meters) { if (!meter.meterSNID) { alert('Please fill in all required meter serial numbers'); return; } }
    }

    // Show preview modal
    setShowPreview(true);
  };

  const handleConfirmSubmit = async () => {
    setShowPreview(false);
    setSubmitting(true);
    try {
      let buildingIdToUse = null;
      const otp = otpCode;
      const genPw = () => { const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let p = ''; p += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; p += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; p += '0123456789'[Math.floor(Math.random() * 10)]; for (let i = 0; i < 5; i++) p += c[Math.floor(Math.random() * c.length)]; return p; };

      if (registrationMode === REGISTRATION_MODES.USER_ONLY) {
        const password = formData.initialPassword || genPw();
        await registerUser(formData.contactName, formData.contactEmail, password, formData.phoneNumber, otp, databaseMode);
      }
      if (registrationMode === REGISTRATION_MODES.BUILDING_ONLY) {
        await registerBuilding(formData.buildingName, formData.googleMapsUrl, formData.address, formData.city, formData.postalCode, null, databaseMode);
      }
      if (registrationMode === REGISTRATION_MODES.FULL) {
        const building = await registerBuilding(formData.buildingName, formData.googleMapsUrl, formData.address, formData.city, formData.postalCode, null, databaseMode);
        buildingIdToUse = building?.id || null;
        const password = formData.initialPassword || genPw();
        await registerUser(formData.contactName, formData.contactEmail, password, formData.phoneNumber, otp, databaseMode);
        if (buildingIdToUse) { try { await registerWallet(buildingIdToUse, formData.contactEmail, databaseMode); } catch (error) { console.warn('registerWallet failed', error); } }
      }
      if (registrationMode === REGISTRATION_MODES.METER_ONLY) { buildingIdToUse = formData.selectedBuildingId; }
      if (needsMeterSection) {
        for (const meter of formData.meters) {
          await registerMeter(buildingIdToUse || formData.buildingName, meter.serviceType, meter.meterSNID, meter.capacity, meter.dateInstalled, databaseMode);
        }
      }
      setIsSubmitted(true);
    } catch (error) {
      console.error('Registration error', error);
      alert(error?.response?.data?.error || error.message || 'Registration failed');
    } finally { setSubmitting(false); }
  };

  /* ══════════════════════════════════════════════════════════════
     SUBMITTED SCREEN
     ══════════════════════════════════════════════════════════════ */
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl p-6 lg:p-12">
          <div className="mb-8 text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <span className="text-3xl">✓</span>
              </div>
            </div>
            <h1 className="mb-2 text-4xl font-bold text-gray-900">Registration Submitted</h1>
            <p className="text-gray-600">Your request has been submitted successfully.</p>
          </div>
          <div className="mt-8 flex gap-3 justify-center">
            <button type="button" onClick={() => { setFormData(INITIAL_FORM); setIsSubmitted(false); }} className="rounded-lg border px-6 py-2 font-semibold text-gray-700 hover:bg-gray-50">
              Back to Registration
            </button>
            <button type="button" onClick={() => { window.location.href = '/login'; }} className="rounded-lg bg-green-600 px-6 py-2 font-semibold text-white hover:bg-green-700">
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN RENDER
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50">
      <TORRegister />
      <div className="mx-auto max-w-5xl p-6 lg:p-10">

        {/* ─── HEADER ─── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Registration Portal</h1>
            <p className="mt-1 text-sm text-gray-500">
              Register preset buildings, meters and users in bulk, or register individual items manually below.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* DB Toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
              <span className="pl-2 text-xs font-semibold text-gray-400">DB</span>
              <button
                type="button"
                onClick={() => setDatabaseMode(REAL_MODE)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${databaseMode === REAL_MODE ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                REAL
              </button>
              <button
                type="button"
                onClick={() => setDatabaseMode(DEMO_MODE)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${databaseMode === DEMO_MODE ? 'bg-amber-500 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                DEMO
              </button>
            </div>
            <a href="/login" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50 transition-colors">
              ← Back to Login
            </a>
          </div>
        </div>

        {/* ─── TOR notice ─── */}
        {showTOR && (
          <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-800">
              <span>📋</span> TOR Requirements — Registration
            </h2>
            <p className="text-sm leading-relaxed text-blue-900">
              This page supports user, building, and meter registration flows so the organization can onboard service units and connect them to the smart energy trading system.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════
           SECTION 1 — BULK REGISTRATION (3 big cards)
           ══════════════════════════════════════════════ */}
        <div className="mb-2">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">📋 Bulk Registration</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            {/* ── Buildings ── */}
            <button
              type="button"
              onClick={handleBulkCreateBuildings}
              disabled={!!bulkLoading}
              className="group relative rounded-xl border-2 border-amber-200 bg-white p-5 text-left shadow-sm transition-all hover:border-amber-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-xl">
                  🏢
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${existingBuildingCount === BUILDING_PRESETS.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {existingBuildingCount}/{BUILDING_PRESETS.length}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-900">Create All Buildings</div>
              <div className="mt-1 text-xs text-gray-500">
                {bulkLoading === 'bulk-buildings'
                  ? <span className="text-amber-600 font-semibold">⏳ Creating...</span>
                  : `${BUILDING_PRESETS.length} buildings + auto meters`
                }
              </div>
              <ProgressBar current={existingBuildingCount} total={BUILDING_PRESETS.length} color="bg-amber-400" />
            </button>

            {/* ── Meters ── */}
            <button
              type="button"
              onClick={handleBulkCreateMeters}
              disabled={!!bulkLoading}
              className="group relative rounded-xl border-2 border-emerald-200 bg-white p-5 text-left shadow-sm transition-all hover:border-emerald-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-xl">
                  🔌
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${existingMeterCount === BUILDING_PRESETS.length ? 'bg-green-100 text-green-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {existingMeterCount}/{BUILDING_PRESETS.length}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-900">Create All Meters</div>
              <div className="mt-1 text-xs text-gray-500">
                {bulkLoading === 'bulk-meters'
                  ? <span className="text-emerald-600 font-semibold">⏳ Creating...</span>
                  : 'Add meters to buildings without them'
                }
              </div>
              <ProgressBar current={existingMeterCount} total={BUILDING_PRESETS.length} color="bg-emerald-400" />
            </button>

            {/* ── Users ── */}
            <button
              type="button"
              onClick={handleBulkCreateUsers}
              disabled={!!bulkLoading}
              className="group relative rounded-xl border-2 border-blue-200 bg-white p-5 text-left shadow-sm transition-all hover:border-blue-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-xl">
                  👤
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${existingUserCount === USER_PRESETS.length ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {existingUserCount}/{USER_PRESETS.length}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-900">Create All Users</div>
              <div className="mt-1 text-xs text-gray-500">
                {bulkLoading === 'bulk-users'
                  ? <span className="text-blue-600 font-semibold">⏳ Creating...</span>
                  : `${USER_PRESETS.length} users (shared email) + link to building`
                }
              </div>
              <ProgressBar current={existingUserCount} total={USER_PRESETS.length} color="bg-blue-400" />
            </button>
          </div>
        </div>

        {/* ─── Divider ─── */}
        <div className="my-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Manual Registration</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* ══════════════════════════════════════════════
           SECTION 2 — MANUAL FORM
           ══════════════════════════════════════════════ */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Progress Indicator ── */}
          {progressSteps.length > 1 && (
            <ProgressIndicator steps={progressSteps} currentStep={currentStepIdx} />
          )}

          {/* ── Mode selector — TABS ── */}
          <ModeTabs value={registrationMode} onChange={setRegistrationMode} />

          {/* ── Meter Only: pick building ── */}
          {registrationMode === REGISTRATION_MODES.METER_ONLY && (
            <CollapsibleSection title="Select Existing Building" icon="🔗" defaultOpen={true}>
              <select
                required
                value={formData.selectedBuildingId}
                onChange={(e) => handleFormChange('selectedBuildingId', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              >
                <option value="">— Choose a building —</option>
                {buildingsList.map((building) => (
                  <option key={building.id} value={building.id}>{building.name}</option>
                ))}
              </select>
            </CollapsibleSection>
          )}

          {/* ── Building section (collapsible) ── */}
          {needsBuildingSection && registrationMode !== REGISTRATION_MODES.METER_ONLY && (
            <CollapsibleSection
              title="Building Information"
              icon="🏢"
              badge={`${existingBuildingCount}/${BUILDING_PRESETS.length} exist`}
              defaultOpen={registrationMode === REGISTRATION_MODES.BUILDING_ONLY}
              required={registrationMode === REGISTRATION_MODES.BUILDING_ONLY || registrationMode === REGISTRATION_MODES.FULL}
              completed={buildingCompleted}
            >
              {/* Preset fill buttons */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">Auto-fill from preset</label>
                <div className="flex flex-wrap gap-1.5">
                  {BUILDING_PRESETS.map((preset) => (
                    <button key={preset.id} type="button" onClick={() => handleApplyPreset(preset)}
                      className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors">
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Building Name *</label>
                <input required={registrationMode === REGISTRATION_MODES.BUILDING_ONLY || registrationMode === REGISTRATION_MODES.FULL} type="text" value={formData.buildingName} onChange={(e) => handleFormChange('buildingName', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Google Maps URL</label>
                <input type="text" value={formData.googleMapsUrl} onChange={(e) => handleFormChange('googleMapsUrl', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Full Address</label>
                <input type="text" value={formData.address} onChange={(e) => handleFormChange('address', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">City / Province</label>
                  <input type="text" value={formData.city} onChange={(e) => handleFormChange('city', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Postal Code</label>
                  <input type="text" value={formData.postalCode} onChange={(e) => handleFormChange('postalCode', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* ── User section (collapsible) ── */}
          {needsUserSection && (
            <CollapsibleSection
              title="Contact Person"
              icon="👤"
              defaultOpen={registrationMode === REGISTRATION_MODES.USER_ONLY}
              required={registrationMode === REGISTRATION_MODES.USER_ONLY || registrationMode === REGISTRATION_MODES.FULL}
              completed={userCompleted}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Contact Name *</label>
                  <input required type="text" value={formData.contactName} onChange={(e) => handleFormChange('contactName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                  <input type="tel" value={formData.phoneNumber} onChange={(e) => handleFormChange('phoneNumber', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
                <input required type="email" value={formData.contactEmail} onChange={(e) => { handleFormChange('contactEmail', e.target.value); setShowOtpStep(false); }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Initial Password</label>
                <input type="password" value={formData.initialPassword} onChange={(e) => handleFormChange('initialPassword', e.target.value)}
                  placeholder="Min 8 chars, include 1 number" className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
                {formData.initialPassword && (
                  <div className="mt-1.5 flex gap-3">
                    <PasswordRule met={formData.initialPassword.length >= 8} label="8+ chars" />
                    <PasswordRule met={/[0-9]/.test(formData.initialPassword)} label="1 number" />
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* ── Meter section (collapsible) ── */}
          {needsMeterSection && (
            <CollapsibleSection
              title="Meter Information"
              icon="🔌"
              badge={`${formData.meters.length} meter(s)`}
              defaultOpen={registrationMode === REGISTRATION_MODES.METER_ONLY}
              required={registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.METER_ONLY}
              completed={meterCompleted}
            >
              <div className="grid grid-cols-1 gap-4">
                {formData.meters.map((meter, idx) => (
                  <MeterCard
                    key={idx}
                    meter={meter}
                    idx={idx}
                    onChange={handleMeterChange}
                    onRemove={handleRemoveMeter}
                    canRemove={formData.meters.length > 1}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={handleAddMeter}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  + Add Meter
                </button>
                <button type="button" onClick={handleAddStandardMeters}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
                  ⚡ Auto-fill 3 Standard Meters
                </button>
              </div>
            </CollapsibleSection>
          )}

          {/* ── Terms (collapsible, collapsed by default) ── */}
          <CollapsibleSection title="Terms & Consent" icon="✅" defaultOpen={false}>
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 cursor-pointer transition-colors">
              <input type="checkbox" checked={formData.termsAccepted} onChange={() => handleCheckboxChange('termsAccepted')} className="mt-0.5 accent-green-600" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  I accept the <a href="/policy" target="_blank" className="text-blue-600 underline hover:text-blue-800" onClick={e => e.stopPropagation()}>Terms of Service</a>
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  By checking this box, you agree to all terms and policies of the NIDA Energy Trading Platform.
                </div>
              </div>
            </label>
          </CollapsibleSection>

          {/* ── Additional Info (collapsible, collapsed by default) ── */}
          <CollapsibleSection title="Additional Information" icon="📝" defaultOpen={false}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Organization Size</label>
              <select value={formData.organizationSize} onChange={(e) => handleFormChange('organizationSize', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none">
                <option value="">Select organization size</option>
                <option value="small">Small (1–50 employees)</option>
                <option value="medium">Medium (51–200 employees)</option>
                <option value="large">Large (200+ employees)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Expected Monthly Energy Consumption</label>
              <input type="text" value={formData.monthlyConsumption} onChange={(e) => handleFormChange('monthlyConsumption', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Additional Comments</label>
              <textarea rows="3" value={formData.additionalComments} onChange={(e) => handleFormChange('additionalComments', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
            </div>
          </CollapsibleSection>

          {/* ── Submit bar ── */}
          <div className="flex items-center gap-3 border-t border-gray-200 pt-5">
            <button type="button" className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`ml-auto rounded-lg px-6 py-2.5 text-sm font-bold text-white transition-colors ${submitting ? 'cursor-not-allowed bg-green-400' : 'bg-green-600 hover:bg-green-700 shadow-sm'}`}
            >
              {submitting
                ? 'Submitting...'
                : !showOtpStep
                  ? 'Preview →'
                  : registrationMode === REGISTRATION_MODES.USER_ONLY ? 'Register User'
                    : registrationMode === REGISTRATION_MODES.BUILDING_ONLY ? 'Register Building'
                      : registrationMode === REGISTRATION_MODES.METER_ONLY ? 'Register Meter'
                        : 'Submit Full Registration'}
            </button>
          </div>
        </form>

        {/* ══════════════════════════════════════════════════════════════
           MODALS
           ══════════════════════════════════════════════════════════════ */}

        {/* ── Preview Modal ── */}
        {showPreview && (
          <PreviewModal
            formData={formData}
            registrationMode={registrationMode}
            onConfirm={handleConfirmSubmit}
            onCancel={() => setShowPreview(false)}
            submitting={submitting}
          />
        )}

        {/* ── OTP Modal ── */}
        {showOtpStep && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">📧</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
                <p className="text-sm text-gray-600">
                  We sent a 6-digit code to <strong>{formData.contactEmail}</strong>.<br />
                  Enter it below to continue.
                </p>
              </div>
              <input
                type="text" maxLength={6} value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\s/g, ''))}
                placeholder="000000"
                className="w-full text-center text-2xl tracking-[0.5em] font-bold rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none mb-5"
                autoFocus
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowOtpStep(false); setOtpCode(''); }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" disabled={!otpCode || submitting}
                  onClick={() => handleConfirmSubmit()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Verifying...' : 'Verify & Submit'}
                </button>
              </div>
              <button type="button" disabled={sendingOtp}
                onClick={async () => { setSendingOtp(true); try { await requestOtpEmail(formData.contactEmail, formData.contactName); alert('OTP resent!'); } catch (e) { alert('Failed to resend OTP'); } finally { setSendingOtp(false); } }}
                className="mt-3 w-full text-sm text-blue-600 hover:text-blue-800 font-medium">
                {sendingOtp ? 'Resending...' : 'Resend OTP'}
              </button>
            </div>
          </div>
        )}

        {/* ── Bulk Result Popup ── */}
        {bulkResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setBulkResult(null)}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}
              style={{ borderTop: bulkResult.errors.length === 0 ? '4px solid #16a34a' : '4px solid #f59e0b' }}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">{bulkResult.errors.length === 0 ? '✅' : '⚠️'}</div>
                <h2 className="text-lg font-bold text-gray-900">
                  {bulkResult.type === 'buildings' && '🏢 Buildings Created'}
                  {bulkResult.type === 'meters' && '🔌 Meters Created'}
                  {bulkResult.type === 'users' && '👤 Users Created'}
                </h2>
                <p className="text-xs text-gray-400 mt-1 font-mono">[{bulkResult.mode?.toUpperCase() || '?'}]</p>
              </div>

              {/* Stats row */}
              <div className="flex gap-3 mb-5">
                <div className="flex-1 rounded-lg bg-green-50 border border-green-100 p-3 text-center">
                  <div className="text-xl font-bold text-green-700">{bulkResult.created.length}</div>
                  <div className="text-xs font-medium text-green-600">Created</div>
                </div>
                <div className="flex-1 rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                  <div className="text-xl font-bold text-gray-500">{bulkResult.skipped.length}</div>
                  <div className="text-xs font-medium text-gray-500">Skipped</div>
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="flex-1 rounded-lg bg-red-50 border border-red-100 p-3 text-center">
                    <div className="text-xl font-bold text-red-600">{bulkResult.errors.length}</div>
                    <div className="text-xs font-medium text-red-500">Errors</div>
                  </div>
                )}
              </div>

              {/* Detail lists */}
              {bulkResult.created.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-bold text-green-700 mb-1.5">✅ Created</div>
                  <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800 space-y-1 max-h-40 overflow-y-auto">
                    {bulkResult.created.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-green-400">•</span>
                        <span className="font-medium">{item.name}</span>
                        {item.meters ? <span className="text-green-600">({item.meters}m)</span> : null}
                        {item.password ? <span className="ml-auto text-green-600 font-mono">pw: {item.password}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(bulkResult.linked) && bulkResult.linked.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-bold text-blue-700 mb-1.5">🏢 Linked to building</div>
                  <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800 space-y-1 max-h-40 overflow-y-auto">
                    {bulkResult.linked.map((name, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-blue-400">•</span>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {bulkResult.skipped.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-bold text-gray-500 mb-1.5">⏭️ Skipped (already exists)</div>
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                    {bulkResult.skipped.map((name, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-gray-400">•</span>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {bulkResult.errors.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-bold text-red-600 mb-1.5">❌ Errors</div>
                  <div className="bg-red-50 rounded-lg p-3 text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
                    {bulkResult.errors.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span><strong>{item.name}</strong>: {item.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setBulkResult(null)}
                className={`w-full py-3 rounded-xl text-sm font-bold text-white transition-colors ${bulkResult.errors.length === 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── Single Result Popup (backward compat) ── */}
        {popupResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPopupResult(null)}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}
              style={{ borderTop: popupResult.ok ? '4px solid #16a34a' : '4px solid #dc2626' }}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">{popupResult.ok ? '✅' : '❌'}</div>
                <h2 className="text-lg font-bold text-gray-900">{popupResult.ok ? 'Success' : 'Failed'}</h2>
                <p className="text-xs text-gray-400 mt-1 font-mono">[{popupResult.mode?.toUpperCase() || '?'}]</p>
              </div>
              {popupResult.ok ? (
                <div className="text-sm text-gray-700 space-y-1.5 bg-gray-50 rounded-xl p-4 mb-4">
                  <div>🏢 <strong>{popupResult.preset?.name}</strong></div>
                  {popupResult.userOnly && <div className="text-xs text-amber-600 mt-2">👤 User created — assign to building later</div>}
                  {popupResult.buildingOnly && <div className="text-xs text-amber-600 mt-2">⚠️ Building + {popupResult.meters?.length || 0} meter(s) — assign user later</div>}
                </div>
              ) : (
                <div className="text-sm text-red-700 bg-red-50 rounded-xl p-4 mb-4">{popupResult.error}</div>
              )}
              <button onClick={() => setPopupResult(null)}
                className={`w-full py-2.5 rounded-xl text-sm font-bold text-white ${popupResult.ok ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                OK
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
