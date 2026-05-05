import React from 'react';
import { useTOR } from '../../global/TORContext';

export default function TORRegister() {
    const { showTOR } = useTOR();

    if (!showTOR) return null;

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                <span>📋</span> TOR Requirements — Registration
            </h2>
            <div className="space-y-4 text-sm text-blue-900">
                <div>
                    <span className="font-bold text-blue-700">7.2.2)</span>
                    <p className="mt-1 leading-relaxed font-semibold">สามารถกำหนดกระบวนการทำงานภายใน การบริหารสิทธิในการเข้าถึงและใช้งานข้อมูลตามที่กำหนด โดยมิเตอร์แต่ละตัวจะเปรียบเหมือนผู้ใช้หนึ่งคนในระบบ Blockchain ซึ่งสามารถกำหนดสิทธิ์ได้ตามเทคโนโลยี Ethereum ผ่าน Ethereum Client ทำงานร่วมกับฐานข้อมูลชนิดโลคอล </p>
                </div>
                <div>
                    <span className="font-bold text-blue-700">7.2.3)</span>
                    <p className="mt-1 leading-relaxed font-semibold">สามารถยืนยันตัวตนผู้ใช้งานและองค์กรผู้ใช้งานโดยถูกควบคุมการใช้งานผ่านระบบ authentication กลางในการเชื่อมโยงตามที่กำหนด สามารถลงทะเบียนผู้ใช้งานและองค์กรผู้ใช้งานกับฐานข้อมูลชนิดโลคอลก่อน ตามนโยบายความปลอดภัยด้านเทคโนโลยีสารสนเทศของสถาบันฯ  เช่น ระบบสามารถลงทะเบียนผู้ใช้และยืนยันตัวตนผ่านทาง gmail หรือ อีเมลของสถาบันฯ ได้ แล้วจึงนำไปสร้างเพิ่มเติมในระบบบล็อกเชน</p>
                </div>
                <div>
                    <span className="font-bold text-blue-700">7.2.4)</span>
                    <p className="mt-1 leading-relaxed font-semibold">สามารถกำหนดหน่วยบริการ ให้กับหน่วยงานที่เกี่ยวข้อง โดยมีการต่อเชื่อมโยงไปยังระบบการซื้อขายไฟฟ้าผ่านช่องทาง API จากระบบ IOT gateway ภายในโครงการ</p>
                </div>
                <div>
                    <span className="font-bold text-blue-700">7.2.5)</span>
                    <p className="mt-1 leading-relaxed font-semibold">ระบบการจัดการทะเบียนหน่วยบริการ มีคุณสมบัติอย่างน้อย ดังนี้</p>
                    <ul className="mt-2 ml-4 list-disc space-y-1 text-blue-800">
                        <li>หน่วยบริการประเภทผู้ผลิตไฟฟ้า ได้แก่ สมาร์ตมิเตอร์ของหน่วยผลิตไฟฟ้าจากโซลาร์เซลล์ หรือ เทคโนโลยีอื่นๆ</li>
                        <li>หน่วยบริการประเภทผู้ใช้ไฟฟ้า ได้แก่ สมาร์ตมิเตอร์ของอาคารต่างๆ</li>
                        <li>หน่วยบริการประเภทคลังแบตเตอรี่สำรองเพื่อจ่ายไฟฟ้า หมายถึง สมาร์ตมิเตอร์ที่บันทึกการจ่ายไฟฟ้า</li>
                    </ul>
                </div>
                <div>
                    <span className="font-bold text-blue-700">1.3)</span>
                    <p className="mt-1 leading-relaxed font-semibold">สามารถกำหนดข้อมูลพื้นฐานสำหรับหน่วยบริการได้ ดังนี้</p>
                    <ul className="mt-2 ml-4 list-disc space-y-1 text-blue-800">
                        <li>มีหน้าเว็บสำหรับลงทะเบียน</li>
                        <li>ชื่อผู้ใช้ พาสเวิร์ด หมายเลขโทรศัพท์</li>
                        <li>จัดเก็บข้อมูล Smart Contract ID แยกตามมิเตอร์สำหรับหน่วยรับบริการและประเภทหน่วยรับบริการย่อยได้</li>
                        <li>ชื่ออาคาร และ URL ตำแหน่งใน Google Maps</li>
                        <li>หมายเลขมิเตอร์ อัตราพิกัดของกำลังไฟฟ้า และข้อมูลที่จำเป็น รายละเอียดตำแหน่งที่ตั้งหน่วยบริการ</li>
                        <li>ชื่อหน่วยงาน และ URL ตำแหน่งใน Google Maps</li>
                        <li>จำนวนสิทธิของหน่วยไฟฟ้าเริ่มต้น  โดยสิทธิจะเพิ่มขึ้นเมื่อมีจำนวนเหรียญในกระเป๋าดิจิทัลมากขึ้น</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
