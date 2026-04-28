import React from 'react';

export default function NoBuildingAssignedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-amber-200 shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">🏢</div>
          <p className="text-lg font-semibold text-amber-700">No building assigned to this user</p>
          <p className="text-sm text-gray-500 mt-2">Please assign a building first.</p>
        </div>
      </div>
    </div>
  );
}