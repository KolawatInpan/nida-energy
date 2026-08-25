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
import { useTOR } from '../../global/TORContext';
import TORRegister from '../../components/TOR/TORRegister';
import { getStoredDataMode, DEMO_MODE, REAL_MODE } from '../../core/dataMode';

const REGISTRATION_MODES = {
  USER_ONLY: 'user-only',
  BUILDING_ONLY: 'building-only',
  FULL: 'full',
  METER_ONLY: 'meter-only',
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
const USER_PRESETS = [
  { id: 'user-ratcha', name: 'Ratchaphruek User', email: 'nida.ratcha@nida.com', password: 'nida123' },
  { id: 'user-malai', name: 'Malai User', email: 'nida.malai@nida.com', password: 'nida123' },
  { id: 'user-audi', name: 'Auditorium User', email: 'nida.audi@nida.com', password: 'nida123' },
  { id: 'user-nidas', name: 'Nidasumpan User', email: 'nida.nidas@nida.com', password: 'nida123' },
  { id: 'user-buncha', name: 'Bunchana User', email: 'nida.buncha@nida.com', password: 'nida123' },
  { id: 'user-chup', name: 'Chup User', email: 'nida.chup@nida.com', password: 'nida123' },
  { id: 'user-nara', name: 'Narathip User', email: 'nida.nara@nida.com', password: 'nida123' },
  { id: 'user-nava', name: 'Navamin User', email: 'nida.nava@nida.com', password: 'nida123' },
  { id: 'user-nidah', name: 'Nida House User', email: 'nida.nidah@nida.com', password: 'nida123' },
  { id: 'user-seri', name: 'Serithai User', email: 'nida.seri@nida.com', password: 'nida123' },
  { id: 'user-siam', name: 'Siam User', email: 'nida.siam@nida.com', password: 'nida123' },
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

function SectionCard({ title, icon, children }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
        <span>{icon}</span>
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ModeRadio({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2">
      <input type="radio" checked={checked} onChange={onChange} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
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
  const [adminQuickLoading, setAdminQuickLoading] = useState(null);
  const [popupResult, setPopupResult] = useState(null); // { ok, preset, email, password, meters, mode, error }
  const [databaseMode, setDatabaseMode] = useState(() => getStoredDataMode());

  const handleFormChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));
  // Meter dynamic form handlers
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
    setFormData((prev) => {
      const meters = prev.meters.filter((_, i) => i !== idx);
      return { ...prev, meters };
    });
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

  const handleAdminQuickCreate = async (preset, idx) => {
    setAdminQuickLoading(preset.id);
    try {
      // Step 1: Create Building only (no user)
      const b = await registerBuilding(preset.name, preset.mapUrl, preset.address, preset.city, preset.postalCode, null, databaseMode);
      const buildingId = b?.id || b?.data?.id;
      const today = new Date().toISOString().split('T')[0];

      // Step 2: Create Meters based on building role
      const meterSNs = [];
      if (preset.role === 'producer') {
        // Producer: produce + consume meters (battery only for Ratchaphruek)
        const isRatchaphruek = preset.id === 'ratchaphruek';
        try { await registerMeter(buildingId, 'produce', `${preset.name.substring(0,3).toUpperCase()}-PRD-${String(idx+1).padStart(3,'0')}`, 5, today, databaseMode); meterSNs.push('produce'); } catch(e) { console.warn('produce meter failed', e); }
        try { await registerMeter(buildingId, 'consume', `${preset.name.substring(0,3).toUpperCase()}-CON-${String(idx+1).padStart(3,'0')}`, null, today, databaseMode); meterSNs.push('consume'); } catch(e) { console.warn('consume meter failed', e); }
        if (isRatchaphruek) { try { await registerMeter(buildingId, 'battery', `${preset.name.substring(0,3).toUpperCase()}-BAT-${String(idx+1).padStart(3,'0')}`, 20, today, databaseMode); meterSNs.push('battery'); } catch(e) { console.warn('battery meter failed', e); } }
      } else {
        // Consumer only
        try { await registerMeter(buildingId, 'consume', `${preset.name.substring(0,3).toUpperCase()}-CON-${String(idx+1).padStart(3,'0')}`, null, today, databaseMode); meterSNs.push('consume'); } catch(e) { console.warn('consume meter failed', e); }
      }

      message.success(`${preset.name}: building + ${meterSNs.length} meter(s) created`);
      getBuildings().then(r => setBuildingsList(Array.isArray(r) ? r : [])).catch(() => {});
      setPopupResult({ ok: true, preset, email: null, password: null, meters: meterSNs, mode: databaseMode, buildingOnly: true });
    } catch (err) {
      setPopupResult({ ok: false, error: err?.response?.data?.error || err.message, mode: databaseMode });
    } finally { setAdminQuickLoading(null); }
  };

  const handleUserQuickCreate = async (preset, idx) => {
    setAdminQuickLoading(preset.id);
    try {
      await registerUser(preset.name, preset.email, preset.password, null, null, databaseMode, true);
      message.success(`User ${preset.email} created`);
      getUsers().then(u => setUsersList(Array.isArray(u) ? u : [])).catch(() => {});
      setPopupResult({ ok: true, preset: { name: preset.email }, email: preset.email, password: preset.password, meters: [], mode: databaseMode, userOnly: true });
    } catch (err) {
      // User already exists — treat as success
      if (err?.response?.data?.error?.includes('already exists')) {
        message.info(`User ${preset.email} already exists`);
        setPopupResult({ ok: true, preset: { name: preset.email }, email: preset.email, password: preset.password, meters: [], mode: databaseMode, userOnly: true });
      } else {
        setPopupResult({ ok: false, error: err?.response?.data?.error || err.message, mode: databaseMode });
      }
    } finally { setAdminQuickLoading(null); }
  };

  const needsBuildingSection = registrationMode === REGISTRATION_MODES.BUILDING_ONLY || registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.METER_ONLY;
  const needsUserSection = registrationMode === REGISTRATION_MODES.USER_ONLY || registrationMode === REGISTRATION_MODES.FULL;
  const needsMeterSection = registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.METER_ONLY;

  // Always fetch buildings & users for quick-create "exists" summary
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
          const email = String(building?.email || '').trim();
          if (!email || usersByEmail.has(email.toLowerCase())) return;
          usersByEmail.set(email.toLowerCase(), {
            email,
            name: String(building?.name || '').trim(),
            credId: `building:${building.id}`,
          });
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Password validation for FULL and USER_ONLY modes
    const needsUser = registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.USER_ONLY;
    if (needsUser && formData.initialPassword) {
      const pw = formData.initialPassword;
      if (pw.length < 8 || !/[0-9]/.test(pw)) {
        message.warning('Password must be at least 8 characters with at least 1 number.');
        return;
      }
    }

    if (!formData.termsAccepted) {
      alert('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    // OTP only needed for FULL and USER_ONLY modes
    const needsOtp = registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.USER_ONLY;

    // First click: send OTP and show modal
    if (needsOtp && !showOtpStep) {
      if (!formData.contactEmail) {
        alert('Please enter your email first');
        return;
      }
      setSendingOtp(true);
      try {
        await requestOtpEmail(formData.contactEmail);
        setShowOtpStep(true);
      } catch (e) {
        alert(e?.response?.data?.error || 'Failed to send OTP');
      } finally {
        setSendingOtp(false);
      }
      return;
    }

    // Second click: validate & submit (OTP check only for modes that need it)
    if (needsOtp && !otpCode) {
      alert('Please enter OTP code');
      return;
    }

    if (registrationMode === REGISTRATION_MODES.USER_ONLY) {
      if (!formData.contactName || !formData.contactEmail) {
        alert('Please fill in all required user fields');
        return;
      }
    }

    if (registrationMode === REGISTRATION_MODES.BUILDING_ONLY) {
      if (!formData.buildingName) {
        alert('Please enter a building name');
        return;
      }
    }

    if (registrationMode === REGISTRATION_MODES.FULL) {
      if (!formData.contactName || !formData.contactEmail || !formData.buildingName) {
        alert('Please fill in all required fields for full registration');
        return;
      }
      for (const meter of formData.meters) {
        if (!meter.meterSNID) {
          alert('Please fill in all required meter serial numbers');
          return;
        }
      }
    }

    if (registrationMode === REGISTRATION_MODES.METER_ONLY) {
      if (!formData.selectedBuildingId) {
        alert('Please choose an existing building');
        return;
      }
      for (const meter of formData.meters) {
        if (!meter.meterSNID) {
          alert('Please fill in all required meter serial numbers');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      let buildingIdToUse = null;
      const otp = otpCode;

      if (registrationMode === REGISTRATION_MODES.USER_ONLY) {
        const password = formData.initialPassword || (() => { const c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let p=''; p+='ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random()*26)]; p+='abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)]; p+='0123456789'[Math.floor(Math.random()*10)]; for(let i=0;i<5;i++)p+=c[Math.floor(Math.random()*c.length)]; return p; })();
        await registerUser(formData.contactName, formData.contactEmail, password, formData.phoneNumber, otp, databaseMode);
      }

      if (registrationMode === REGISTRATION_MODES.BUILDING_ONLY) {
        await registerBuilding(
          formData.buildingName,
          formData.googleMapsUrl,
          formData.address,
          formData.city,
          formData.postalCode,
          null,
          databaseMode,
        );
      }

      if (registrationMode === REGISTRATION_MODES.FULL) {
        // Building-first: create building, then user, then wallet, then meters
        const building = await registerBuilding(
          formData.buildingName,
          formData.googleMapsUrl,
          formData.address,
          formData.city,
          formData.postalCode,
          null,
          databaseMode,
        );

        buildingIdToUse = building?.id || null;

        const password = formData.initialPassword || (() => { const c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let p=''; p+='ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random()*26)]; p+='abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)]; p+='0123456789'[Math.floor(Math.random()*10)]; for(let i=0;i<5;i++)p+=c[Math.floor(Math.random()*c.length)]; return p; })();
        await registerUser(formData.contactName, formData.contactEmail, password, formData.phoneNumber, otp, databaseMode);

        if (buildingIdToUse) {
          try {
            await registerWallet(buildingIdToUse, formData.contactEmail, databaseMode);
          } catch (error) {
            console.warn('registerWallet failed; continuing', error);
          }
        }
      }

      if (registrationMode === REGISTRATION_MODES.METER_ONLY) {
        buildingIdToUse = formData.selectedBuildingId;
      }

      if (needsMeterSection) {
        for (const meter of formData.meters) {
          await registerMeter(
            buildingIdToUse || formData.buildingName,
            meter.serviceType,
            meter.meterSNID,
            meter.capacity,
            meter.dateInstalled,
            databaseMode,
          );
        }
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error('Registration error', error);
      alert(error?.response?.data?.error || error.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

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

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setFormData(INITIAL_FORM);
                setIsSubmitted(false);
              }}
              className="rounded-lg border px-6 py-2 font-semibold text-gray-700"
            >
              Back to Registration
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/login'; }}
              className="ml-auto rounded-lg bg-green-600 px-6 py-2 font-semibold text-white hover:bg-green-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <TORRegister />
      <div className="mx-auto max-w-4xl p-6 lg:p-12">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Registration Portal</h1>
          <p className="text-sm text-gray-600">
            Choose a registration mode that matches what you want to create in the system.
          </p>
          {/* data mode selector removed - controlled via navbar toggle */}
        </div>

        {showTOR && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-blue-800">
              <span>📋</span>
              TOR Requirements — Registration
            </h2>
            <p className="text-sm leading-relaxed text-blue-900">
              This page supports user, building, and meter registration flows so the organization can onboard service units and connect them to the smart energy trading system.
            </p>
          </div>
        )}

        <div className="mb-4">
          {/* Admin Quick Create - wrapped grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {BUILDING_PRESETS.map((preset, idx) => {
              const exists = buildingsList.some(b => String(b?.name || '').toLowerCase() === preset.name.toLowerCase());
              return (
              <div key={preset.id} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 600, marginBottom: 2, minHeight: 13 }}>
                  {exists ? 'exists' : '\u00A0'}
                </div>
                <button
                  type="button"
                  onClick={() => handleAdminQuickCreate(preset, idx)}
                  disabled={adminQuickLoading === preset.id}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: '1px solid #f59e0b',
                    background: adminQuickLoading === preset.id ? '#fde68a' : '#fef3c7',
                    color: '#92400e',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: adminQuickLoading ? 0.6 : 1,
                  }}
                >
                  {adminQuickLoading === preset.id ? '⏳' : '⚡'} {preset.name}
                </button>
              </div>
            )})}
          </div>

          {/* User Quick Create */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {USER_PRESETS.map((preset, idx) => {
              const exists = usersList.some(u => String(u?.email || '').toLowerCase() === preset.email.toLowerCase());
              return (
              <div key={preset.id} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 600, marginBottom: 2, minHeight: 13 }}>
                  {exists ? 'User exists' : '\u00A0'}
                </div>
                <button
                  type="button"
                  onClick={() => handleUserQuickCreate(preset, idx)}
                  disabled={adminQuickLoading === preset.id}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: '1px solid #3b82f6',
                    background: adminQuickLoading === preset.id ? '#bfdbfe' : '#dbeafe',
                    color: '#1e40af',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: adminQuickLoading ? 0.6 : 1,
                  }}
                >
                  {adminQuickLoading === preset.id ? '⏳' : '👤'} {preset.name}
                </button>
              </div>
            )})}
          </div>

          {/* Toolbar: DB selector + Back to Login */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, border: `1.5px solid ${databaseMode === DEMO_MODE ? '#f59e0b' : '#3b82f6'}`, background: databaseMode === DEMO_MODE ? '#fffbeb' : '#eff6ff' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>DB:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                <input type="radio" name="dbMode" value={REAL_MODE} checked={databaseMode === REAL_MODE} onChange={() => setDatabaseMode(REAL_MODE)} style={{ accentColor: '#3b82f6', margin: 0 }} />
                <span style={{ fontSize: 11, fontWeight: databaseMode === REAL_MODE ? 700 : 400, color: databaseMode === REAL_MODE ? '#1d4ed8' : '#94a3b8' }}>REAL</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                <input type="radio" name="dbMode" value={DEMO_MODE} checked={databaseMode === DEMO_MODE} onChange={() => setDatabaseMode(DEMO_MODE)} style={{ accentColor: '#f59e0b', margin: 0 }} />
                <span style={{ fontSize: 11, fontWeight: databaseMode === DEMO_MODE ? 700 : 400, color: databaseMode === DEMO_MODE ? '#b45309' : '#94a3b8' }}>DEMO</span>
              </label>
            </div>
            <a href="/login" className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 text-sm">
              ← Back to Login
            </a>
          </div>
        </div>


        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-wrap items-center gap-6">
            <ModeRadio
              checked={registrationMode === REGISTRATION_MODES.FULL}
              onChange={() => setRegistrationMode(REGISTRATION_MODES.FULL)}
              label={<span><span role="img" aria-label="full">🧩</span> Full registration</span>}
            />
            <ModeRadio
              checked={registrationMode === REGISTRATION_MODES.USER_ONLY}
              onChange={() => setRegistrationMode(REGISTRATION_MODES.USER_ONLY)}
              label={<span><span role="img" aria-label="user">👤</span> Register User only</span>}
            />
            <ModeRadio
              checked={registrationMode === REGISTRATION_MODES.BUILDING_ONLY}
              onChange={() => setRegistrationMode(REGISTRATION_MODES.BUILDING_ONLY)}
              label={<span><span role="img" aria-label="building">🏢</span> Register Building only</span>}
            />
            <ModeRadio
              checked={registrationMode === REGISTRATION_MODES.METER_ONLY}
              onChange={() => setRegistrationMode(REGISTRATION_MODES.METER_ONLY)}
              label={<span><span role="img" aria-label="meter">🔌</span> Register Meter only</span>}
            />
          </div>

          {registrationMode === REGISTRATION_MODES.METER_ONLY ? (
            <SectionCard title="Existing Building" icon="🔗">
              <div>
                <label className="mb-1 block text-sm font-medium">Select Existing Building *</label>
                <select
                  required
                  value={formData.selectedBuildingId}
                  onChange={(e) => handleFormChange('selectedBuildingId', e.target.value)}
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="">-- Choose building --</option>
                  {buildingsList.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name} {building.address ? `— ${building.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </SectionCard>
          ) : null}

          {needsBuildingSection && registrationMode !== REGISTRATION_MODES.METER_ONLY ? (
            <SectionCard title="Building / Organization Information" icon="🏢">
              <div className="mb-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">Quick Create Building (No User — assign later)</label>
                <div className="flex flex-wrap gap-2">
                  {BUILDING_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Building Name *</label>
                <input
                  required={registrationMode === REGISTRATION_MODES.BUILDING_ONLY || registrationMode === REGISTRATION_MODES.FULL}
                  type="text"
                  value={formData.buildingName}
                  onChange={(e) => handleFormChange('buildingName', e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Google Maps URL</label>
                <input
                  type="text"
                  value={formData.googleMapsUrl}
                  onChange={(e) => handleFormChange('googleMapsUrl', e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Full Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleFormChange('address', e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">City / Province</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleFormChange('city', e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Postal Code</label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => handleFormChange('postalCode', e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
              </div>
            </SectionCard>
          ) : null}

          {needsUserSection ? (
            <SectionCard title="Contact Person Information" icon="👤">
              <div>
                <label className="mb-1 block text-sm font-medium">Contact Name *</label>
                <input
                  required
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => handleFormChange('contactName', e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email *</label>
                <input
                  required
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => { handleFormChange('contactEmail', e.target.value); setShowOtpStep(false); }}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Initial Password</label>
                <input
                  type="password"
                  value={formData.initialPassword}
                  onChange={(e) => handleFormChange('initialPassword', e.target.value)}
                  placeholder="Min. 8 characters, A-Z, a-z, 0-9"
                  className="w-full rounded border px-3 py-2"
                />
                {formData.initialPassword && (
                  <div className="mt-1 space-y-0.5">
                    <PasswordRule met={formData.initialPassword.length >= 8} label="At least 8 characters" />
                    <PasswordRule met={/[0-9]/.test(formData.initialPassword)} label="At least 1 number" />
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleFormChange('phoneNumber', e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
            </SectionCard>
          ) : null}

          {needsMeterSection ? (
            <SectionCard title="Meter Information" icon="🔌">
              {formData.meters.map((meter, idx) => (
                <div key={idx} className="border rounded-lg p-4 mb-4 relative bg-gray-50">
                  <div className="flex gap-2 items-center mb-2">
                    <span className="font-bold">Meter #{idx + 1}</span>
                    {formData.meters.length > 1 && (
                      <button type="button" onClick={() => handleRemoveMeter(idx)} className="ml-auto text-red-500 hover:underline text-xs">ลบ</button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Service Unit Type *</label>
                      <div className="space-x-2">
                        {[
                          { value: 'producer', label: 'Producer' },
                          { value: 'consumer', label: 'Consumer' },
                          { value: 'battery', label: 'Battery / ESS' },
                        ].map((type) => (
                          <label key={type.value} className="inline-flex items-center gap-1">
                            <input
                              type="radio"
                              name={`serviceType_${idx}`}
                              value={type.value}
                              checked={meter.serviceType === type.value}
                              onChange={(e) => handleMeterChange(idx, 'serviceType', e.target.value)}
                            />
                            <span className="text-xs">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium">Meter Serial Number (SNID) *</label>
                        <input
                          required
                          type="text"
                          value={meter.meterSNID}
                          onChange={(e) => handleMeterChange(idx, 'meterSNID', e.target.value)}
                          className="w-full rounded border px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium">Expected Capacity (kWh)</label>
                        <input
                          type="text"
                          value={meter.capacity}
                          onChange={(e) => handleMeterChange(idx, 'capacity', e.target.value)}
                          placeholder="e.g. 5"
                          className="w-full rounded border px-3 py-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Meter Installation Date (dd-mm-yyyy)</label>
                      <DatePicker
                        selected={meter.dateInstalled ? new Date(meter.dateInstalled + 'T00:00:00') : null}
                        onChange={(date) => handleMeterChange(idx, 'dateInstalled', date ? date.toISOString().slice(0, 10) : '')}
                        dateFormat="dd-MM-yyyy"
                        placeholderText="dd-mm-yyyy"
                        maxDate={new Date()}
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 mt-2">
                <button type="button" onClick={handleAddMeter} className="rounded bg-blue-100 text-blue-700 px-4 py-2 text-sm font-semibold hover:bg-blue-200 transition-colors">
                  + Add Single Meter
                </button>
                <button type="button" onClick={handleAddStandardMeters} className="rounded border border-green-200 bg-green-50 text-green-700 px-4 py-2 text-sm font-semibold hover:bg-green-100 flex items-center gap-1 transition-colors">
                  <span>⚡</span> Auto-fill Standard 3 Meters (Produce, Consume, Battery)
                </button>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Terms & Consent" icon="✅">
            <label className="flex items-start rounded-lg border p-4 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={formData.termsAccepted} onChange={() => handleCheckboxChange('termsAccepted')} className="mt-0.5" />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">
                  I accept the{' '}
                  <a href="/policy" target="_blank" className="text-blue-600 underline hover:text-blue-800" onClick={e => e.stopPropagation()}>
                    Terms of Service
                  </a>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  By checking this box, you agree to all terms and policies of the NIDA Energy Trading Platform.
                </div>
              </div>
            </label>
          </SectionCard>

          <SectionCard title="Additional Information" icon="📝">
            <div>
              <label className="mb-1 block text-sm font-medium">Organization Size</label>
              <select
                value={formData.organizationSize}
                onChange={(e) => handleFormChange('organizationSize', e.target.value)}
                className="w-full rounded border px-3 py-2"
              >
                <option value="">Select organization size</option>
                <option value="small">Small (1-50 employees)</option>
                <option value="medium">Medium (51-200 employees)</option>
                <option value="large">Large (200+ employees)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Expected Monthly Energy Consumption</label>
              <input
                type="text"
                value={formData.monthlyConsumption}
                onChange={(e) => handleFormChange('monthlyConsumption', e.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Additional Comments</label>
              <textarea
                rows="4"
                value={formData.additionalComments}
                onChange={(e) => handleFormChange('additionalComments', e.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>
          </SectionCard>

          <div className="flex gap-3 border-t border-gray-200 pt-4">
            <button type="button" className="rounded-lg border px-6 py-2 font-semibold text-gray-700">
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`ml-auto rounded-lg px-6 py-2 font-semibold text-white ${
                submitting ? 'cursor-not-allowed bg-green-400' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {submitting
                ? 'Submitting...'
                : !showOtpStep
                ? 'Continue →'
                : registrationMode === REGISTRATION_MODES.USER_ONLY
                ? 'Register User'
                : registrationMode === REGISTRATION_MODES.BUILDING_ONLY
                ? 'Register Building'
                : registrationMode === REGISTRATION_MODES.METER_ONLY
                ? 'Register Meter'
                : 'Submit Full Registration'}
            </button>
          </div>
        </form>

        {/* OTP Modal */}
        {showOtpStep && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">📧</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
                <p className="text-sm text-gray-600">
                  We have sent a 6-digit OTP to <strong>{formData.contactEmail}</strong>.<br />
                  Please enter it below to complete registration.
                </p>
              </div>
              <div className="mb-6">
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\s/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-2xl tracking-[0.5em] font-bold rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowOtpStep(false); setOtpCode(''); }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!otpCode || submitting}
                  onClick={() => handleSubmit({ preventDefault: () => {} })}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Verifying...' : 'Verify & Submit'}
                </button>
              </div>
              <button
                type="button"
                disabled={sendingOtp}
                onClick={async () => {
                  setSendingOtp(true);
                  try {
                    await requestOtpEmail(formData.contactEmail);
                    alert('OTP resent!');
                  } catch (e) {
                    alert('Failed to resend OTP');
                  } finally {
                    setSendingOtp(false);
                  }
                }}
                className="mt-3 w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {sendingOtp ? 'Resending...' : 'Resend OTP'}
              </button>
            </div>
          </div>
        )}

        {/* Quick Create Result Popup */}
        {popupResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPopupResult(null)}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()} style={{ borderTop: popupResult.ok ? '4px solid #16a34a' : '4px solid #dc2626' }}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">{popupResult.ok ? '✅' : '❌'}</div>
                <h2 className="text-lg font-bold text-gray-900">
                  {popupResult.ok ? 'Quick Create Success' : 'Quick Create Failed'}
                </h2>
                <p className="text-xs text-gray-500 mt-1">[{popupResult.mode?.toUpperCase() || '?'}]</p>
              </div>
              {popupResult.ok ? (
                <div className="text-sm text-gray-700 space-y-1.5 bg-gray-50 rounded-xl p-4 mb-4">
                  <div>🏢 <strong>{popupResult.preset?.name}</strong></div>
                  <div>📋 <span style={{ color: '#6b7280' }}>{popupResult.preset?.roleLabel}</span></div>
                  {popupResult.userOnly ? (
                    <div className="text-xs text-amber-600 mt-2">👤 User created — assign to building later in Admin</div>
                  ) : popupResult.buildingOnly ? (
                    <div className="text-xs text-amber-600 mt-2">⚠️ Building + {popupResult.meters?.length || 0} meter(s) created — assign user later in Admin</div>
                  ) : (
                    <>
                      <div>📧 {popupResult.email}</div>
                      <div>🔑 {popupResult.password}</div>
                      <div>📟 {(popupResult.meters || []).join(', ') || 'none'}</div>
                      <div>💰 10,000 tokens</div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-sm text-red-700 bg-red-50 rounded-xl p-4 mb-4">
                  {popupResult.error}
                </div>
              )}
              <button
                onClick={() => setPopupResult(null)}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: popupResult.ok ? '#16a34a' : '#dc2626' }}
              >
                OK
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
