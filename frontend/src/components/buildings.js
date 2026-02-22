import React, { useState, useEffect } from 'react';
import { getBuildings, getTotalMeters } from '../core/data_connecter/building';

const Buildings = () => {
  const [buildings, setBuildings] = useState([
    { id: 'BLD-001', name: 'Ratchaphruek Building', contact: 'Alice', totalMeter: 8, energy: 1250 },
    { id: 'BLD-002', name: 'Engineering Center', contact: 'Bob', totalMeter: 8, energy: 2150 },
    { id: 'BLD-003', name: 'Medical Center', contact: 'Carol', totalMeter: 12, energy: 1850 },
    { id: 'BLD-004', name: 'Science Building', contact: 'Dave', totalMeter: 6, energy: 950 },
    { id: 'BLD-005', name: 'Library Complex', contact: 'Eve', totalMeter: 10, energy: 1600 },
  ]);

  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    const fetch = async () => {
      try {
        const list = await getBuildings();
        const items = Array.isArray(list) ? list : (list?.buildings || list || []);
        const counts = await Promise.all(items.map(async b => {
          try { return await getTotalMeters(b.id); } catch (e) { return b.totalMeter || 0; }
        }));
        const normalized = items.map((b, i) => ({
          id: b.id || b.name,
          name: b.name,
          contact: b.owner?.name || b.email || b.contact || '',
          totalMeter: counts[i] ?? (b.meters ? b.meters.length : b.totalMeter || 0),
          energy: b.energy || 0,
        }));
        setBuildings(normalized);
      } catch (e) {
        console.error('getBuildings error', e);
      }
    };
    fetch();
  }, []);

  const handleEdit = (index) => {
    setEditingRow(index);
    setEditData({ ...buildings[index] });
  };

  const handleSave = (index) => {
    const updatedBuildings = [...buildings];
    updatedBuildings[index] = editData;
    setBuildings(updatedBuildings);
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
    if (window.confirm('Are you sure you want to delete this building?')) {
      setBuildings(buildings.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Building Management</h1>
          <p className="text-gray-600 text-lg">Manage all buildings in the LEMS system</p>
        </div>

        {/* Buildings Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">🏢</span>
              All Buildings
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
                  <th className="text-left font-bold text-gray-900 py-4 px-6">ID</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Name</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Contact</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Total Meter</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Energy (kWh)</th>
                  <th className="text-center font-bold text-gray-900 py-4 px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {buildings.map((building, index) => (
                  <tr key={building.id} className="hover:bg-green-50 transition-colors">
                    {editingRow === index ? (
                      // Editing Mode
                      <>
                        <td className="py-4 px-6">
                          <span className="font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm cursor-not-allowed">
                            {editData.id}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="text"
                            value={editData.contact}
                            onChange={(e) => handleInputChange('contact', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="number"
                            value={editData.totalMeter}
                            onChange={(e) => handleInputChange('totalMeter', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="number"
                            value={editData.energy}
                            onChange={(e) => handleInputChange('energy', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
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
                          <span className="font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm">
                            {building.id}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-900 font-medium">
                          {building.name}
                        </td>
                        <td className="py-4 px-6 text-gray-900 font-medium">
                          {building.contact}
                        </td>
                        <td className="py-4 px-6 text-gray-700">
                          <span className="text-lg font-bold">{building.totalMeter}</span>
                          <span className="text-gray-600 ml-2">units</span>
                        </td>
                        <td className="py-4 px-6 text-gray-700">
                          <span className="text-lg font-bold text-emerald-600">{building.energy}</span>
                          <span className="text-gray-600 ml-2">kWh</span>
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
              <span className="font-semibold">Total Buildings:</span> {buildings.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Buildings;