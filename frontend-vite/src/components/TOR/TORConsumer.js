import React from 'react';
import { useTOR } from '../../global/TORContext';

export default function TORConsumer() {
    const { showTOR } = useTOR();

    if (!showTOR) return null;

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                <span>📋</span> TOR Requirements — Consumer
            </h2>
            <div className="space-y-4 text-sm text-blue-900">
                <div>
                    <span className="font-bold text-blue-700">3.1)</span>
                    <p className="mt-1 leading-relaxed font-semibold">ส่วนของหน่วยบริการประเภทผู้ใช้ไฟฟ้า มีคุณสมบัติ ดังนี้</p>
                    <ul className="mt-2 ml-4 list-disc space-y-1 text-blue-800">
                        <li>สามารถเชื่อมโยงกับหน่วยผลิตไฟฟ้าผ่าน IOT Gateway ในโครงการ</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
