import React, { useState } from 'react';

export default function MeterRegistration() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    contactName: '',
    contactEmail: '',
    initialPassword: '',
    confirmPassword: '',
    phoneNumber: '',
    buildingName: '',
    googleMapsUrl: '',
    fullAddress: '',
    city: '',
    postalCode: '',
    serviceType: 'consumer',
    meterSNID: '',
    expectedCapacity: '',
    installationDate: '',
    organizationSize: '',
    monthlyConsumption: '',
    additionalComments: '',
    termsAccepted: false,
    dataAccuracyAccepted: false,
    systemNotificationsAccepted: false
  });

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.contactName || !formData.contactEmail || !formData.buildingName || !formData.meterSNID) {
      alert('Please fill in all required fields');
      return;
    }
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!isSubmitted ? (
        // Registration Form
        <div className="max-w-4xl mx-auto p-6 lg:p-12">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-900">Building Registration Request</h1>
              <span className="text-right">
                <div className="text-2xl font-bold text-blue-600">50%</div>
                <div className="text-xs text-gray-600">Step 1 of 2: Building Information</div>
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '50%' }}></div>
            </div>
            <p className="text-gray-600 mt-2">Complete the form below to register your building in the LEMS network. An administrator will review and approve your request.</p>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Contact Person Information */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-lg">👤</span> Contact Person Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">👤 Contact Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.contactName}
                      onChange={e => handleFormChange('contactName', e.target.value)}
                      placeholder="Enter full name of contact person"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">This contact details will be verified for the building</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📧 Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formData.contactEmail}
                      onChange={e => handleFormChange('contactEmail', e.target.value)}
                      placeholder="contact@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">🔐 Initial Password</label>
                    <input
                      type="password"
                      value={formData.initialPassword}
                      onChange={e => handleFormChange('initialPassword', e.target.value)}
                      placeholder="Enter a secure password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <p className="text-xs text-blue-600 mt-1">Must be at least 8 characters with uppercase, numbers, and symbols</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">🔒 Confirm Password</label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={e => handleFormChange('confirmPassword', e.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📞 Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={e => handleFormChange('phoneNumber', e.target.value)}
                      placeholder="e.g. +66-X4-XXX-XXXX"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">It is easily verify a call to validate or verify</p>
                  </div>
                </div>
              </div>

              {/* Building/Organization Information */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-lg">🏢</span> Building/Organization Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">🏢 Building Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.buildingName}
                      onChange={e => handleFormChange('buildingName', e.target.value)}
                      placeholder="Enter building or organization name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📍 Google Maps URL</label>
                    <input
                      type="text"
                      value={formData.googleMapsUrl}
                      onChange={e => handleFormChange('googleMapsUrl', e.target.value)}
                      placeholder="Paste Google Maps URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <p className="text-xs text-blue-600 bg-blue-50 p-2 mt-2 rounded">ℹ️ Get the exact location on Google Maps and paste the link. This helps us locate your building correctly in our system.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📮 Full Address</label>
                    <input
                      type="text"
                      value={formData.fullAddress}
                      onChange={e => handleFormChange('fullAddress', e.target.value)}
                      placeholder="Enter complete building address including street, district, city, postal code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City/Province</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={e => handleFormChange('city', e.target.value)}
                        placeholder="Enter city or province"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={e => handleFormChange('postalCode', e.target.value)}
                        placeholder="X-XXXX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Meter Information */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-lg">🔌</span> Meter Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Service Unit Type *</label>
                    <div className="space-y-2">
                      {[
                        { value: 'producer', label: 'Producer', desc: 'An organization mainly engaged with solar panel or energy generation', icon: '🌞' },
                        { value: 'consumer', label: 'Consumer', desc: 'An organization that mainly utilizes or manages the national utilities to distribute energy production capabilities', icon: '⚡' },
                        { value: 'battery', label: 'Battery/ESS', desc: 'An organization that manages energy storage systems that can store electrical energy and distribute at set times', icon: '🔋' }
                      ].map(type => (
                        <label key={type.value} className="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                          <input
                            type="radio"
                            name="serviceType"
                            value={type.value}
                            checked={formData.serviceType === type.value}
                            onChange={e => handleFormChange('serviceType', e.target.value)}
                            className="mt-1 w-4 h-4"
                          />
                          <div className="ml-3 flex-1">
                            <div className="font-medium text-gray-900">{type.icon} {type.label}</div>
                            <div className="text-xs text-gray-600">{type.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">🔢 Meter Serial Number (SNID) *</label>
                      <input
                        type="text"
                        required
                        value={formData.meterSNID}
                        onChange={e => handleFormChange('meterSNID', e.target.value)}
                        placeholder="Enter meter serial number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">⚡ Expected Electrical Capacity</label>
                      <input
                        type="text"
                        value={formData.expectedCapacity}
                        onChange={e => handleFormChange('expectedCapacity', e.target.value)}
                        placeholder="e.g. kW"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meter Installation Date</label>
                    <input
                      type="date"
                      value={formData.installationDate}
                      onChange={e => handleFormChange('installationDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Terms & Consent */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Terms & Consent</h3>
                <div className="space-y-3">
                  <label className="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.termsAccepted}
                      onChange={() => handleCheckboxChange('termsAccepted')}
                      className="mt-1 w-4 h-4"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-medium text-gray-900">📋 I accept the Terms of Service and Privacy Policy</div>
                      <div className="text-xs text-gray-600">A registering user agree to LEMS terms of service, data processing, and data protection according to laws</div>
                    </div>
                  </label>

                  <label className="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.dataAccuracyAccepted}
                      onChange={() => handleCheckboxChange('dataAccuracyAccepted')}
                      className="mt-1 w-4 h-4"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-medium text-gray-900">✅ I confirm the accuracy of all provided information</div>
                      <div className="text-xs text-gray-600">I here-by confirm that the provided information is accurate and not incorrect</div>
                    </div>
                  </label>

                  <label className="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.systemNotificationsAccepted}
                      onChange={() => handleCheckboxChange('systemNotificationsAccepted')}
                      className="mt-1 w-4 h-4"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-medium text-gray-900">🔔 I agree to receive system notifications via LEMS</div>
                      <div className="text-xs text-gray-600">I agree to receive notification system via email, messaging, or in-system messaging via LEMS messages</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Additional Information */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Additional Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">👥 Organization Size</label>
                    <select
                      value={formData.organizationSize}
                      onChange={e => handleFormChange('organizationSize', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select organization size</option>
                      <option value="small">Small (1-50 employees)</option>
                      <option value="medium">Medium (51-200 employees)</option>
                      <option value="large">Large (200+ employees)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📊 Expected Monthly Energy Consumption</label>
                    <input
                      type="text"
                      value={formData.monthlyConsumption}
                      onChange={e => handleFormChange('monthlyConsumption', e.target.value)}
                      placeholder="e.g. kWh"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Comments or Special Requirements</label>
                    <textarea
                      value={formData.additionalComments}
                      onChange={e => handleFormChange('additionalComments', e.target.value)}
                      placeholder="Any additional information you'd like to share with us"
                      rows="4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  📌 SAVE AS DRAFT
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors ml-auto"
                >
                  ✓ SUBMIT REQUEST
                </button>
              </div>
            </form>
        </div>
      ) : (
        // Success Page
        <div className="max-w-4xl mx-auto p-6 lg:p-12">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">✅</span>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Building Registration Approved!</h1>
            <p className="text-gray-600">Your building is now ready to join the network. Please complete the final step to activate your energy Quota and access the system.</p>
          </div>

          {/* Progress Indicator */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">F</span>
                Activation Process
              </h3>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">100%</div>
                <div className="text-xs text-gray-600">Registration Complete</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: '100%' }}></div>
            </div>
            <div className="flex justify-between mt-4 text-xs">
              <span className="text-green-600 font-medium">Registration (90%)</span>
              <span className="text-green-600 font-medium">Activation (10%)</span>
            </div>
          </div>

          {/* Step 2: Activate Energy Quota */}
          <div className="bg-white rounded-lg shadow-lg border border-blue-300 border-l-4 border-l-blue-600 p-6 mb-6">
            <div className="flex items-start mb-4">
              <div className="bg-blue-100 text-blue-600 rounded-full w-10 h-10 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                📋
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Step 2: Activate Your Energy Quota</h3>
                <p className="text-sm text-gray-600 mt-1">Before accessing the Dashboard, you must exchange fiat for Token to deposit into your Digital Wallet. This initial deposit sets your Quota (right to use electricity) for the first month.</p>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm text-blue-800">
              <strong>❓ Why is this required?</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Token is the exclusive medium for all energy payments within the LEMS network</li>
                <li>Your Token balance represents your "Quota" or right to use electricity</li>
                <li>The system verifies your balance before allowing energy consumption</li>
                <li>All transactions are recorded on the blockchain for transparency</li>
              </ul>
            </div>

            <button 
              onClick={() => window.location.href = '/wallet'}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              🪙 Go to Token Top-up (เติมบัญชีฯ) →
            </button>
          </div>

          {/* Account Information */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>✅</span> Your Account Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏢</span>
                  <div>
                    <div className="text-xs text-gray-600">Building Name</div>
                    <div className="font-semibold text-gray-900">{formData.buildingName}</div>
                  </div>
                </div>
                <span className="text-green-600">✅</span>
              </div>

              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">#️⃣</span>
                  <div>
                    <div className="text-xs text-gray-600">Meter Serial Number (SNID)</div>
                    <div className="font-semibold text-gray-900">{formData.meterSNID}</div>
                  </div>
                </div>
                <span className="text-green-600">✅</span>
              </div>

              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔌</span>
                  <div>
                    <div className="text-xs text-gray-600">Smart Meter ID</div>
                    <div className="font-semibold text-gray-900">DX7A3F...C0E2</div>
                  </div>
                </div>
                <span className="text-green-600">✅</span>
              </div>

              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📡</span>
                  <div>
                    <div className="text-xs text-gray-600">Gateway ID</div>
                    <div className="font-semibold text-gray-900">DX4BBD...F1A7</div>
                  </div>
                </div>
                <span className="text-green-600">✅</span>
              </div>

              <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-sm text-green-800">
                <strong>✅ Automatic Setup Complete</strong>
                <p className="mt-1">Your Digital Wallet and Smart Contract have been automatically created and linked to your meter by our system. All connections are secured on blockchain technology.</p>
              </div>
            </div>
          </div>

          {/* What Happens Next */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              📝 What Happens Next?
            </h3>
            <div className="space-y-4">
              {[
                { step: 1, title: 'Complete Token Top-up', desc: 'Exchange fiat for Token through the secure payment gateway to establish your initial energy quota (right to use electricity)' },
                { step: 2, title: 'Quota Activation', desc: 'Your Token balance will be verified and your energy quota will be activated into-network' },
                { step: 3, title: 'Dashboard Access', desc: 'Gain full access to your energy dashboard with real-time monitoring and management features' },
                { step: 4, title: 'Start Managing Energy', desc: 'Begin monitoring consumption, viewing invoices, and managing your postpaid energy account' }
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4 pb-4 border-b border-gray-200 last:border-b-0">
                  <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 text-sm">
                    {item.step}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{item.title}</div>
                    <div className="text-sm text-gray-600">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8">
            <button
              onClick={() => setIsSubmitted(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back to Registration
            </button>
            <button
              onClick={() => window.location.href = '/wallet'}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors ml-auto"
            >
              🪙 Complete Token Top-up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}