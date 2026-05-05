import React from 'react';
import { useTOR } from '../../global/TORContext';

export default function TORWallet() {
    const { showTOR } = useTOR();

    if (!showTOR) return null;

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                <span>📋</span> TOR Requirements — Wallet
            </h2>
            <div className="space-y-4 text-sm text-blue-900">
                <div>
                    <span className="font-bold text-blue-700">2.1)</span>
                    <p className="mt-1 leading-relaxed font-semibold">สามารถพัฒนาระบบกระเป๋าเงินดิจิทัลที่ผูกกับหน่วยบริการโดยการนำเทคโนโลยี Blackchain มาใช้</p>
                </div>
                <div>
                    <span className="font-bold text-blue-700">2.2)</span>
                    <p className="mt-1 leading-relaxed font-semibold">รองรับการเชื่อมโยงในการให้บริการกับระบบการจัดการซื้อ ขาย ไฟฟ้าในโครงการ</p>
                </div>
                <div>
                    <span className="font-bold text-blue-700">2.3)</span>
                    <p className="mt-1 leading-relaxed font-semibold">สามารถสร้างเหรียญในระบบตั้งต้นในโครงการเพื่อใช้งาน โดยเทคโนโลยี Ethereum รองรับการสร้างเหรียญ (Token) กระเป๋าเงิน (Wallet) สำหรับเก็บเหรียญ และ Smart Contract เพื่อใช้ซื้อ ขาย ไฟฟ้าในหน่วยพลังงานไฟฟ้า (KWH) รายวัน หรือ ละเอียดขึ้น ตามการตั้งค่าของมิเตอร์</p>
                </div>
                <div>
                    <span className="font-bold text-blue-700">2.4)</span>
                    <p className="mt-1 leading-relaxed font-semibold">สามารถทำการชำระเงินออนไลน์เพื่อเปลี่ยนเป็นเหรียญในกระเป๋าเงินดิจิทัลได้ตามต้องการ โดยมีอัตราแลกเปลี่ยนแปรผันรายสัปดาห์ ขึ้นกับกำลังการผลิตไฟฟ้าทางเลือก และส่งเสริมการใช้ไฟฟ้าอย่างรู้คุณค่า เช่น หากระบบสามารถผลิตไฟฟ้า เช่น โซลาร์เซลล์ได้มาก อัตราการแลกเหรียญเป็นบาทจะถูกลง เพื่อทดแทนการใช้ไฟฟ้าจากการไฟฟ้านครหลวง (Grid) แต่หากผลิตไฟฟ้าเองได้น้อย อัตราการแลกเหรียญจะสูงขึ้น เพื่อส่งเสริมการใช้ไฟฟ้าอย่างรู้คุณค่า</p>
                </div>
            </div>
        </div>
    );
}
