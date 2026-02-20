import React, { useState } from 'react';

const Users = () => {
  const [users, setUsers] = useState([
    { uid: 'USR-001', name: 'John Doe', building: 'Ratchaphruek Building', contact: '081-234-5678', role: 'Admin' },
    { uid: 'USR-002', name: 'Jane Smith', building: 'Engineering Center', contact: '082-345-6789', role: 'User' },
    { uid: 'USR-003', name: 'Mike Johnson', building: 'Medical Center', contact: '083-456-7890', role: 'User' },
    { uid: 'USR-004', name: 'Sarah Williams', building: 'Science Building', contact: '084-567-8901', role: 'Admin' },
    { uid: 'USR-005', name: 'David Brown', building: 'Library Complex', contact: '085-678-9012', role: 'User' },
  ]);

  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});

  const handleEdit = (index) => {
    setEditingRow(index);
    setEditData({ ...users[index] });
  };

  const handleSave = (index) => {
    const updatedUsers = [...users];
    updatedUsers[index] = editData;
    setUsers(updatedUsers);
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
    if (window.confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600 text-lg">Manage all users in the LEMS system</p>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">👥</span>
              All Users
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                  <th className="text-left font-bold text-gray-900 py-4 px-6">UID</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Name</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Building</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Contact (Number)</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Role</th>
                  <th className="text-center font-bold text-gray-900 py-4 px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user, index) => (
                  <tr key={user.uid} className="hover:bg-blue-50 transition-colors">
                    {editingRow === index ? (
                      // Editing Mode
                      <>
                        <td className="py-4 px-6">
                          <span className="font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-sm cursor-not-allowed">
                            {editData.uid}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="text"
                            value={editData.building}
                            onChange={(e) => handleInputChange('building', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="text"
                            value={editData.contact}
                            onChange={(e) => handleInputChange('contact', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <select
                            value={editData.role}
                            onChange={(e) => handleInputChange('role', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option>Admin</option>
                            <option>User</option>
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
                          <span className="font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-sm">
                            {user.uid}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-900 font-medium">
                          {user.name}
                        </td>
                        <td className="py-4 px-6 text-gray-700">
                          {user.building}
                        </td>
                        <td className="py-4 px-6 text-gray-700">
                          {user.contact}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
                            user.role === 'Admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.role}
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
              <span className="font-semibold">Total Users:</span> {users.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;