import React, { useEffect, useState } from 'react';
import {
  getBuildings,
  getUsers,
  registerBuilding,
  registerMeter,
  registerUser,
  registerWallet,
} from '../../core/data_connecter/register';
import { useTOR } from '../../global/TORContext';

const REGISTRATION_MODES = {
  USER_ONLY: 'user-only',
  BUILDING_ONLY: 'building-only',
  FULL: 'full',
  METER_ONLY: 'meter-only',
};

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
  const [registrationMode, setRegistrationMode] = useState(REGISTRATION_MODES.FULL);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [usersList, setUsersList] = useState([]);
  const [buildingsList, setBuildingsList] = useState([]);

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

  const needsBuildingSection = registrationMode === REGISTRATION_MODES.BUILDING_ONLY || registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.METER_ONLY;
  const needsUserSection = registrationMode === REGISTRATION_MODES.USER_ONLY || registrationMode === REGISTRATION_MODES.FULL;
  const needsMeterSection = registrationMode === REGISTRATION_MODES.FULL || registrationMode === REGISTRATION_MODES.METER_ONLY;

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

    if (!formData.termsAccepted || !formData.dataAccuracyAccepted) {
      alert('Please accept the required consent checkboxes');
      return;
    }

    if (registrationMode === REGISTRATION_MODES.USER_ONLY) {
      if (!formData.contactName || !formData.contactEmail) {
        alert('Please fill in all required user fields');
        return;
      }
    }

    if (registrationMode === REGISTRATION_MODES.BUILDING_ONLY) {
      if (!formData.buildingName || !formData.contactEmail) {
        alert('Please fill in all required building fields');
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
      if (!formData.selectedUserEmail || !formData.selectedBuildingId) {
        alert('Please choose an existing contact and existing building');
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

      if (registrationMode === REGISTRATION_MODES.USER_ONLY) {
        const password = formData.initialPassword || Math.random().toString(36).slice(-8);
        await registerUser(formData.contactName, formData.contactEmail, password, formData.phoneNumber);
      }

      if (registrationMode === REGISTRATION_MODES.BUILDING_ONLY) {
        await registerBuilding(
          formData.buildingName,
          formData.googleMapsUrl,
          formData.address,
          formData.city,
          formData.postalCode,
          formData.contactEmail,
        );
      }

      if (registrationMode === REGISTRATION_MODES.FULL) {
        const password = formData.initialPassword || Math.random().toString(36).slice(-8);
        await registerUser(formData.contactName, formData.contactEmail, password, formData.phoneNumber);

        const building = await registerBuilding(
          formData.buildingName,
          formData.googleMapsUrl,
          formData.address,
          formData.city,
          formData.postalCode,
          formData.contactEmail,
        );

        buildingIdToUse = building?.id || null;

        try {
          await registerWallet(buildingIdToUse, formData.contactEmail);
        } catch (error) {
          console.warn('registerWallet failed; continuing', error);
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

        <div className="mb-6 flex items-center justify-between">
          <div />
          <a href="/login" className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
            Back to Login
          </a>
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
            <SectionCard title="Existing Contact & Building" icon="🔗">
              <div>
                <label className="mb-1 block text-sm font-medium">Select Existing Contact *</label>
                <select
                  required
                  value={formData.selectedUserEmail}
                  onChange={(e) => handleFormChange('selectedUserEmail', e.target.value)}
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="">-- Choose contact --</option>
                  {usersList.map((user) => (
                    <option key={user.email || user.credId} value={user.email}>
                      {user.name} — {user.email}
                    </option>
                  ))}
                </select>
              </div>
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
                  onChange={(e) => handleFormChange('contactEmail', e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Initial Password</label>
                <input
                  type="password"
                  value={formData.initialPassword}
                  onChange={(e) => handleFormChange('initialPassword', e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
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

          {needsBuildingSection && registrationMode !== REGISTRATION_MODES.METER_ONLY ? (
            <SectionCard title="Building / Organization Information" icon="🏢">
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
                <label className="mb-1 block text-sm font-medium">Owner / Contact Email *</label>
                {registrationMode === REGISTRATION_MODES.BUILDING_ONLY ? (
                  <select
                    required
                    value={formData.contactEmail}
                    onChange={e => handleFormChange('contactEmail', e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  >
                    <option value="">-- Select user email --</option>
                    {usersList.map(user => (
                      <option key={user.email || user.credId} value={user.email}>{user.name ? `${user.name} (${user.email})` : user.email}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required={registrationMode === REGISTRATION_MODES.BUILDING_ONLY}
                    type="email"
                    list="existing-user-emails"
                    value={formData.contactEmail}
                    onChange={(e) => handleFormChange('contactEmail', e.target.value)}
                    className="w-full rounded border px-3 py-2"
                    placeholder="Type email or choose from existing users"
                  />
                )}
                {registrationMode === REGISTRATION_MODES.BUILDING_ONLY && (
                  <p className="mt-1 text-xs text-gray-500">Select user email from the system only.</p>
                )}
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
                        <label className="mb-1 block text-sm font-medium">Expected Capacity</label>
                        <input
                          type="text"
                          value={meter.capacity}
                          onChange={(e) => handleMeterChange(idx, 'capacity', e.target.value)}
                          className="w-full rounded border px-3 py-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Meter Installation Date</label>
                      <input
                        type="date"
                        value={meter.dateInstalled}
                        onChange={(e) => handleMeterChange(idx, 'dateInstalled', e.target.value)}
                        className="w-full rounded border px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={handleAddMeter} className="rounded bg-blue-100 text-blue-700 px-4 py-2 font-semibold hover:bg-blue-200">
                + เพิ่ม Meter
              </button>
            </SectionCard>
          ) : null}

          <SectionCard title="Terms & Consent" icon="✅">
            <label className="flex items-start rounded-lg border p-3 hover:bg-gray-50">
              <input type="checkbox" checked={formData.termsAccepted} onChange={() => handleCheckboxChange('termsAccepted')} className="mt-1" />
              <div className="ml-3">
                <div className="text-sm font-medium">I accept the Terms of Service and Privacy Policy</div>
              </div>
            </label>
            <label className="flex items-start rounded-lg border p-3 hover:bg-gray-50">
              <input type="checkbox" checked={formData.dataAccuracyAccepted} onChange={() => handleCheckboxChange('dataAccuracyAccepted')} className="mt-1" />
              <div className="ml-3">
                <div className="text-sm font-medium">I confirm the accuracy of all provided information</div>
              </div>
            </label>
            <label className="flex items-start rounded-lg border p-3 hover:bg-gray-50">
              <input type="checkbox" checked={formData.systemNotificationsAccepted} onChange={() => handleCheckboxChange('systemNotificationsAccepted')} className="mt-1" />
              <div className="ml-3">
                <div className="text-sm font-medium">I agree to receive system notifications</div>
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
      </div>
    </div>
  );
}

