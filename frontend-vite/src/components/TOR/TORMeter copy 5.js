import React from 'react';
import { useTOR } from '../../global/TORContext';

export default function TORMeter() {
    const { showTOR } = useTOR();

    if (!showTOR) return null;

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                <span>📋</span> TOR Requirements — Meter
            </h2>
            <div className="space-y-4 text-sm text-blue-900">
                <div>
                    <span className="font-bold text-blue-700">3.1)</span>
                    <p className="mt-1 leading-relaxed font-semibold">ส่วนของหน่วยบริการประเภทผู้ผลิตไฟฟ้า มีคุณสมบัติอย่างน้อย ดังนี้</p>
                    <ul className="mt-2 ml-4 list-disc space-y-1 text-blue-800">
                        <li>สามารถเชื่อมโยงกับหน่วยผลิตไฟฟ้าผ่าน IOT Gateway ในโครงการ</li>
                        <li>สามารถจัดเก็บข้อมูลการผลิตไฟฟ้าในระบบได้</li>
                        <li>สามารถดูรายงานสรุปข้อมูลการผลิตไฟฟ้าแยกตาม วัน เดือน ปี ที่กำหนดได้</li>
                        <li>สามารถรับข้อมูลการผลิตไฟฟ้าจากแหล่งผลิตไฟฟ้า (Solar Cell) เพื่อใช้เป็นข้อมูลการผลิตในส่วนของกระแสไฟฟ้า</li>
                    </ul>
                </div>
                <div>
                    <span className="font-bold text-blue-700">3.2)</span>
                    <p className="mt-1 leading-relaxed font-semibold">ส่วนของหน่วยบริการประเภทผู้ใช้ไฟฟ้า มีคุณสมบัติอย่างน้อย ดังนี้</p>
                    <ul className="mt-2 ml-4 list-disc space-y-1 text-blue-800">
                        <li>สามารถดูรายงานข้อมูลการใช้ไฟฟ้าของหน่วยบริการประเภทผู้ใช้ไฟฟ้า แยกตาม ผู้ใช้ไฟฟ้า วัน เดือน ปี ที่กำหนดได้</li>
                        <li>สามารถเชื่อมโยงกับหน่วยผลิตไฟฟ้าผ่าน IOT Gateway ในโครงการ</li>
                        <li>สามารถจัดเก็บข้อมูลการให้บริการไฟฟ้าให้กับหน่วยบริการที่ใช้ไฟฟ้าได้</li>
                        <li>สามารถดูประวัติการรับปริมาณกระแสไฟฟ้าที่รับจากแบตเตอรี่กลางได้</li>
                    </ul>
                </div>
                <div>
                    <span className="font-bold text-blue-700">3.3)</span>
                    <p className="mt-1 leading-relaxed font-semibold">ส่วนของหน่วยบริการคลังแบตเตอรี่สำรองเพื่อจ่ายไฟฟ้า มีคุณสมบัติอย่างน้อย ดังนี้</p>
                    <ul className="mt-2 ml-4 list-disc space-y-1 text-blue-800">
                        <li>สามารถเชื่อมโยงกับหน่วยผลิตไฟฟ้าผ่าน IOT Gateway ในโครงการฯ ได้</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
