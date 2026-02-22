import React, { useState, useEffect } from 'react';
import { getMeters } from '../core/data_connecter/meter';

const Meters = () => {
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeters = async () => {
      try {
        const data = await getMeters();
        const list = Array.isArray(data) ? data : (data?.meters || data || []);
        const normalized = list.map(m => ({
          snid: m.snid,
          buildingName: m.buildingName || m.building?.name || m.building?.owner?.name,
          type: m.produceMeter ? 'Produce' : m.consumeMeter ? 'Consume' : m.batMeter ? 'Battery' : (m.type || 'Unknown'),
          capacity: m.capacity || m.kwh || '',
          status: m.approveStatus || m.status || 'Unknown',
          raw: m
        }));
        setMeters(normalized);
      } catch (error) {
        console.error("Error fetching meters:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMeters();
  }, []);

  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});

  const handleEdit = (index) => {
    setEditingRow(index);
    setEditData({ ...meters[index] });
  };

  const handleSave = (index) => {
    const updatedMeters = [...meters];
    updatedMeters[index] = editData;
    setMeters(updatedMeters);
    setEditingRow(null);
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditData({});
  };

  const handleInputChange = (field, value) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleDelete = (index) => {
    if (window.confirm('Are you sure you want to delete this meter?')) {
      setMeters(meters.filter((_, i) => i !== index));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Produce':
        return 'bg-green-50 text-green-700';
      case 'Consume':
        return 'bg-blue-50 text-blue-700';
      case 'Battery':
        return 'bg-purple-50 text-purple-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Meter Management</h1>
          <p className="text-gray-600 text-lg">Manage all meters in the LEMS system</p>
        </div>

        {/* Meters Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              All Meters
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
                  <th className="text-left font-bold text-gray-900 py-4 px-6">SNID</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Building Name</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Type</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Capacity (kW)</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Status</th>
                  <th className="text-center font-bold text-gray-900 py-4 px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {meters.map((meter, index) => (
                  <tr key={meter.snid} className="hover:bg-purple-50 transition-colors">
                    {editingRow === index ? (
                      // Editing Mode
                      <>
                        <td className="py-4 px-6">
                          <span className="font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full text-sm cursor-not-allowed">
                            {editData.snid}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="text"
                            value={editData.buildingName}
                            onChange={(e) => handleInputChange('buildingName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <select
                            value={editData.type}
                            onChange={(e) => handleInputChange('type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option>Produce</option>
                            <option>Consume</option>
                            <option>Battery</option>
                          </select>
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="number"
                            value={editData.capacity}
                            onChange={(e) => handleInputChange('capacity', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <select
                            value={editData.status}
                            onChange={(e) => handleInputChange('status', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option>Approved</option>
                            <option>Pending</option>
                            <option>Rejected</option>
                          </select>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleSave(index)}
                              className="px-3 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancel}
                              className="px-3 py-2 bg-gray-400 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View Mode
                      <>
                        <td className="py-4 px-6">
                          <span className="font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full text-sm">
                            {meter.snid}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-900 font-medium">
                          {meter.buildingName}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${getTypeColor(meter.type)}`}>
                            {meter.type}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-700">
                          <span className="text-lg font-bold">{meter.capacity}</span>
                          <span className="text-gray-600 ml-2">kW</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(meter.status)}`}>
                            {meter.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleEdit(index)}
                              className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(index)}
                              className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Stats */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Total Meters:</span> {meters.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Meters;