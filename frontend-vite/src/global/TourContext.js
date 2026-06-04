import React, { createContext, useContext, useState, useCallback } from 'react';

const TourContext = createContext(null);

const flowSteps = [
  {
    step: 1, title: '📝 ลงทะเบียนมิเตอร์ (Register Meter)',
    subtitle: 'ลงทะเบียนมิเตอร์พลังงานเข้าไปในระบบ',
    icon: '📝', color: 'blue',
    navigateTo: '/meter-registration',
    details: ['ลงทะเบียนมิเตอร์โซลาร์ (Solar Meter) สำหรับอาคารที่ผลิตไฟฟ้า', 'ลงทะเบียนมิเตอร์แบตเตอรี่ (Battery Meter) สำหรับอาคารที่มีที่เก็บพลังงาน', 'ลงทะเบียนมิเตอร์ consumo (Consumption Meter) สำหรับอาคารทั่วไป', 'รอ Admin อนุมัติการลงทะเบียน'],
  },
  {
    step: 2, title: '🏢 ดูข้อมูลอาคาร (View Building)',
    subtitle: 'ตรวจสอบสถานะมิเตอร์และข้อมูลพื้นฐานของอาคาร',
    icon: '🏢', color: 'cyan',
    navigateTo: '/report',
    details: ['ดูภาพรวมพลังงานของอาคารทั้งหมดในระบบ', 'ตรวจสอบสถานะมิเตอร์แต่ละตัว (Solar, Battery, Consumption)', 'ดูปริมาณพลังงานที่ผลิต ใช้ และเก็บสะสม'],
  },
  {
    step: 3, title: '🎛️ ตั้งค่าโหมดการซื้อขาย (Configure Trade Mode)',
    subtitle: 'กำหนดโหมดการซื้อขายสำหรับ Solar Array และ Storage System',
    icon: '🎛️', color: 'green',
    navigateTo: '/energy-selling',
    details: ['เลือกโหมด Solar Array: Auto / Self Consume / Manual', 'เลือกโหมด Storage System: Auto / Self Consume / Manual', 'ตั้งค่า Emergency Reserve (Threshold) สำหรับแบตเตอรี่', 'ตั้งค่า Self-Consume % สำหรับ Solar (ส่วนที่ใช้เอง)', 'กด Save เพื่อบันทึกการตั้งค่า'],
    tip: '🤖 Auto = ขายพลังงานส่วนเกินอัตโนมัติ | 🏠 Self Consume = ใช้เองเท่านั้น | ✋ Manual = จัดการด้วยตนเอง',
  },
  {
    step: 4, title: '🏪 สร้าง Offer / Bid ในตลาด (Create Market Order)',
    subtitle: 'เสนอขาย (Offer) หรือเสนอซื้อ (Bid) พลังงานในตลาด',
    icon: '🏪', color: 'orange',
    navigateTo: '/market',
    details: ['เลือกประเภท: Day-Ahead (ล่วงหน้า) หรือ Intraday (เรียลไทม์)', 'กรอกราคาที่ต้องการ: Day-Ahead ≥ ฿3.50/kWh, Intraday ≥ ฿3.50/kWh', 'กรอกจำนวนพลังงาน (kWh) ที่ต้องการขายหรือซื้อ', 'สามารถยกเลิกคำสั่งซื้อขายได้ที่หน้า Market'],
  },
  {
    step: 5, title: '🔄 Day-Ahead Clearing (การจับคู่และเคลียร์ยอด)',
    subtitle: 'ระบบจับคู่ Offer/Bid และโอน Token อัตโนมัติ',
    icon: '🔄', color: 'purple',
    navigateTo: '/market',
    details: ['⏰ ระบบจะเคลียร์ยอดอัตโนมัติเวลาเที่ยงคืน (สำหรับ Day-Ahead)', '🥇 จับคู่ราคาสูงสุด → ราคาต่ำสุด (Cross-Building Matching)', '🏠 ก่อนอื่นจับคู่ภายในอาคารเดียวกันก่อน (Intra-Building) ฟรี!', '💰 โอน Token จากผู้ซื้อ → ผู้ขาย (ค่าธรรมเนียม 5%)', '⛓️ บันทึกธุรกรรมลง Blockchain อัตโนมัติ', '📊 ดูผลลัพธ์ Force Distribution Priority Table'],
    buttonLabel: 'ไปหน้าตลาด',
  },
  {
    step: 6, title: '💰 ตรวจสอบกระเป๋าเงิน (Check Wallet)',
    subtitle: 'ดูยอด Token เข้า-ออกหลังจากซื้อขาย',
    icon: '💰', color: 'gold',
    navigateTo: '/wallet',
    details: ['ดูยอด Token คงเหลือในกระเป๋า', 'เติม Token เข้ากระเป๋าเมื่อยอดไม่พอ', 'ตรวจสอบ Quota ที่ต้องรักษาไว้', 'ดูรายการเคลื่อนไหวล่าสุด (Latest Transaction)'],
  },
  {
    step: 7, title: '📋 ดูประวัติธุรกรรม (Transaction History)',
    subtitle: 'ตรวจสอบธุรกรรมทั้งหมดที่เกิดขึ้น',
    icon: '📋', color: 'blue',
    navigateTo: '/transaction',
    details: ['ดูรายการทั้งหมด: Marketplace Purchase/Sale, Top-up, Forced Distribution', 'ตรวจสอบสถานะ Verified / Not Verified', 'กด Verify Now เพื่อยืนยันธุรกรรมบน Blockchain', 'ดูรายละเอียดธุรกรรมแต่ละรายการ'],
  },
  {
    step: 8, title: '⛓️ ตรวจสอบ Blockchain (Blockchain Compare)',
    subtitle: 'เปรียบเทียบข้อมูลใน DB กับ Blockchain',
    icon: '⛓️', color: 'geekblue',
    navigateTo: '/blockchain/compare',
    details: ['เลือกธุรกรรมที่ต้องการตรวจสอบ', 'ดู Field-by-Field Comparison ระหว่าง DB กับ Blockchain', 'ตรวจสอบ Payload Hash ที่ถูกบันทึก', 'ดู Block Number, Gas Used, และ Timestamp'],
  },
  {
    step: 9, title: '📄 ตรวจสอบ Invoice และ Receipt',
    subtitle: 'ดูใบแจ้งหนี้และใบเสร็จรับเงิน',
    icon: '📄', color: 'green',
    details: ['ไปที่เมนู Invoices → ดูใบแจ้งหนี้ที่ต้องชำระ', 'กด Pay Invoice เพื่อชำระเงิน', 'ไปที่เมนู Receipts → ดูใบเสร็จรับเงินหลังจากชำระแล้ว', 'ตรวจสอบข้อมูลการซื้อขายในใบเสร็จ'],
    subItems: [{ label: 'ไปที่ Invoices', path: '/invoice' }, { label: 'ไปที่ Receipts', path: '/receipts' }],
  },
  {
    step: 10, title: '📊 ดูรายงานพลังงาน (Energy Reports)',
    subtitle: 'วิเคราะห์ข้อมูลพลังงานแบบภาพรวมและรายอาคาร',
    icon: '📊', color: 'red',
    navigateTo: '/report',
    details: ['Aggregated View — ดูข้อมูลรวมทุกอาคาร', 'Per-Building View — ดูข้อมูลแยกแต่ละอาคาร', 'ดูกราฟ Production (เขียว), Consumption (แดง), Battery SoC (ส้ม)', 'ดาวน์โหลดรายงานเป็น CSV หรือ PDF'],
  },
];

const colorMap = {
  blue: '#1677ff', cyan: '#13c2c2', green: '#52c41a', orange: '#fa8c16',
  purple: '#722ed1', gold: '#faad14', geekblue: '#2f54eb', red: '#f5222d',
};

export function TourProvider({ children }) {
  const [tourStep, setTourStep] = useState(null);

  const startTour = useCallback(() => {
    setTourStep(1);
  }, []);

  const stopTour = useCallback(() => {
    setTourStep(null);
  }, []);

  const prevStep = useCallback(() => {
    setTourStep((prev) => Math.max(1, prev - 1));
  }, []);

  const nextStep = useCallback(() => {
    setTourStep((prev) => Math.min(flowSteps.length, prev + 1));
  }, []);

  const jumpToStep = useCallback((step) => {
    setTourStep(Math.max(1, Math.min(flowSteps.length, step)));
  }, []);

  const currentFlow = tourStep ? flowSteps[tourStep - 1] : null;

  const value = { tourStep, currentFlow, startTour, stopTour, prevStep, nextStep, jumpToStep, flowSteps, colorMap };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
