import React from 'react';
import { useHistory } from 'react-router-dom';
import {
  ThunderboltOutlined,
  WalletOutlined,
  SwapOutlined,
  ShoppingCartOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  FileDoneOutlined,
  FormOutlined,
  HomeOutlined,
  RightCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { useTour } from '../../global/TourContext';

const colorMap = {
  blue: '#1677ff',
  cyan: '#13c2c2',
  green: '#52c41a',
  orange: '#fa8c16',
  purple: '#722ed1',
  gold: '#faad14',
  geekblue: '#2f54eb',
  red: '#f5222d',
};

const flowSteps = [
  {
    step: 1,
    title: '📝 ลงทะเบียนมิเตอร์ (Register Meter)',
    subtitle: 'ลงทะเบียนมิเตอร์พลังงานเข้าไปในระบบ',
    icon: <FormOutlined className="text-2xl" />,
    color: 'blue',
    navigateTo: ROUTE_PATHS.meterRegistration,
    details: [
      'ลงทะเบียนมิเตอร์โซลาร์ (Solar Meter) สำหรับอาคารที่ผลิตไฟฟ้า',
      'ลงทะเบียนมิเตอร์แบตเตอรี่ (Battery Meter) สำหรับอาคารที่มีที่เก็บพลังงาน',
      'ลงทะเบียนมิเตอร์ consumo (Consumption Meter) สำหรับอาคารทั่วไป',
      'รอ Admin อนุมัติการลงทะเบียน',
    ],
  },
  {
    step: 2,
    title: '🏢 ดูข้อมูลอาคาร (View Building)',
    subtitle: 'ตรวจสอบสถานะมิเตอร์และข้อมูลพื้นฐานของอาคาร',
    icon: <HomeOutlined className="text-2xl" />,
    color: 'cyan',
    navigateTo: ROUTE_PATHS.report,
    details: [
      'ดูภาพรวมพลังงานของอาคารทั้งหมดในระบบ',
      'ตรวจสอบสถานะมิเตอร์แต่ละตัว (Solar, Battery, Consumption)',
      'ดูปริมาณพลังงานที่ผลิต ใช้ และเก็บสะสม',
    ],
  },
  {
    step: 3,
    title: '🎛️ ตั้งค่าโหมดการซื้อขาย (Configure Trade Mode)',
    subtitle: 'กำหนดโหมดการซื้อขายสำหรับ Solar Array และ Storage System',
    icon: <ThunderboltOutlined className="text-2xl" />,
    color: 'green',
    navigateTo: ROUTE_PATHS.energySelling,
    details: [
      'เลือกโหมด Solar Array: Auto / Self Consume / Manual',
      'เลือกโหมด Storage System: Auto / Self Consume / Manual',
      'ตั้งค่า Emergency Reserve (Threshold) สำหรับแบตเตอรี่',
      'ตั้งค่า Self-Consume % สำหรับ Solar (ส่วนที่ใช้เอง)',
      'กด Save เพื่อบันทึกการตั้งค่า',
    ],
    tip: '🤖 Auto = ขายพลังงานส่วนเกินอัตโนมัติ | 🏠 Self Consume = ใช้เองเท่านั้น | ✋ Manual = จัดการด้วยตนเอง',
  },
  {
    step: 4,
    title: '🏪 สร้าง Offer / Bid ในตลาด (Create Market Order)',
    subtitle: 'เสนอขาย (Offer) หรือเสนอซื้อ (Bid) พลังงานในตลาด',
    icon: <ShoppingCartOutlined className="text-2xl" />,
    color: 'orange',
    navigateTo: ROUTE_PATHS.market,
    details: [
      'เลือกประเภท: Day-Ahead (ล่วงหน้า) หรือ Intraday (เรียลไทม์)',
      'กรอกราคาที่ต้องการ: Day-Ahead ≥ ฿3.50/kWh, Intraday ≥ ฿3.50/kWh',
      'กรอกจำนวนพลังงาน (kWh) ที่ต้องการขายหรือซื้อ',
      'สามารถยกเลิกคำสั่งซื้อขายได้ที่หน้า Market',
    ],
  },
  {
    step: 5,
    title: '🔄 Day-Ahead Clearing (การจับคู่และเคลียร์ยอด)',
    subtitle: 'ระบบจับคู่ Offer/Bid และโอน Token อัตโนมัติ',
    icon: <SwapOutlined className="text-2xl" />,
    color: 'purple',
    navigateTo: ROUTE_PATHS.market,
    details: [
      '⏰ ระบบจะเคลียร์ยอดอัตโนมัติเวลาเที่ยงคืน (สำหรับ Day-Ahead)',
      '🥇 จับคู่ราคาสูงสุด → ราคาต่ำสุด (Cross-Building Matching)',
      '🏠 ก่อนอื่นจับคู่ภายในอาคารเดียวกันก่อน (Intra-Building) ฟรี!',
      '💰 โอน Token จากผู้ซื้อ → ผู้ขาย (ค่าธรรมเนียม 5%)',
      '⛓️ บันทึกธุรกรรมลง Blockchain อัตโนมัติ',
      '📊 ดูผลลัพธ์ Force Distribution Priority Table',
    ],
    buttonLabel: 'ไปหน้าตลาด',
  },
  {
    step: 6,
    title: '💰 ตรวจสอบกระเป๋าเงิน (Check Wallet)',
    subtitle: 'ดูยอด Token เข้า-ออกหลังจากซื้อขาย',
    icon: <WalletOutlined className="text-2xl" />,
    color: 'gold',
    navigateTo: ROUTE_PATHS.wallet,
    details: [
      'ดูยอด Token คงเหลือในกระเป๋า',
      'เติม Token เข้ากระเป๋าเมื่อยอดไม่พอ',
      'ตรวจสอบ Quota ที่ต้องรักษาไว้',
      'ดูรายการเคลื่อนไหวล่าสุด (Latest Transaction)',
    ],
  },
  {
    step: 7,
    title: '📋 ดูประวัติธุรกรรม (Transaction History)',
    subtitle: 'ตรวจสอบธุรกรรมทั้งหมดที่เกิดขึ้น',
    icon: <SwapOutlined className="text-2xl" />,
    color: 'blue',
    navigateTo: ROUTE_PATHS.transaction,
    details: [
      'ดูรายการทั้งหมด: Marketplace Purchase/Sale, Top-up, Forced Distribution',
      'ตรวจสอบสถานะ Verified / Not Verified',
      'กด Verify Now เพื่อยืนยันธุรกรรมบน Blockchain',
      'ดูรายละเอียดธุรกรรมแต่ละรายการ',
    ],
  },
  {
    step: 8,
    title: '⛓️ ตรวจสอบ Blockchain (Blockchain Compare)',
    subtitle: 'เปรียบเทียบข้อมูลใน DB กับ Blockchain',
    icon: <CheckCircleOutlined className="text-2xl" />,
    color: 'geekblue',
    navigateTo: ROUTE_PATHS.blockchainCompare,
    details: [
      'เลือกธุรกรรมที่ต้องการตรวจสอบ',
      'ดู Field-by-Field Comparison ระหว่าง DB กับ Blockchain',
      'ตรวจสอบ Payload Hash ที่ถูกบันทึก',
      'ดู Block Number, Gas Used, และ Timestamp',
    ],
  },
  {
    step: 9,
    title: '📄 ตรวจสอบ Invoice และ Receipt',
    subtitle: 'ดูใบแจ้งหนี้และใบเสร็จรับเงิน',
    icon: <FileDoneOutlined className="text-2xl" />,
    color: 'green',
    details: [
      'ไปที่เมนู Invoices → ดูใบแจ้งหนี้ที่ต้องชำระ',
      'กด Pay Invoice เพื่อชำระเงิน',
      'ไปที่เมนู Receipts → ดูใบเสร็จรับเงินหลังจากชำระแล้ว',
      'ตรวจสอบข้อมูลการซื้อขายในใบเสร็จ',
    ],
    subItems: [
      { label: 'ไปที่ Invoices', path: ROUTE_PATHS.invoice, icon: <FileDoneOutlined /> },
      { label: 'ไปที่ Receipts', path: ROUTE_PATHS.receipts, icon: <FileTextOutlined /> },
    ],
  },
  {
    step: 10,
    title: '📊 ดูรายงานพลังงาน (Energy Reports)',
    subtitle: 'วิเคราะห์ข้อมูลพลังงานแบบภาพรวมและรายอาคาร',
    icon: <BarChartOutlined className="text-2xl" />,
    color: 'red',
    navigateTo: ROUTE_PATHS.report,
    details: [
      'Aggregated View — ดูข้อมูลรวมทุกอาคาร',
      'Per-Building View — ดูข้อมูลแยกแต่ละอาคาร',
      'ดูกราฟ Production (เขียว), Consumption (แดง), Battery SoC (ส้ม)',
      'ดาวน์โหลดรายงานเป็น CSV หรือ PDF',
    ],
  },
];

export default function UserGuide() {
  const history = useHistory();
  const { startTour } = useTour();

  const handleNavigate = (path) => {
    if (path) history.push(path);
  };

  const handleStartTour = () => {
    startTour();
    const first = flowSteps[0];
    if (first?.navigateTo) handleNavigate(first.navigateTo);
  };

  const stepBg = (color) => {
    const map = { blue: '#eff6ff', cyan: '#ecfeff', green: '#f0fdf4', orange: '#fff7ed', purple: '#faf5ff', gold: '#fefce8', geekblue: '#eef2ff', red: '#fef2f2' };
    return map[color] || '#f9fafb';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3">📖</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          NIDA Smart Grid — คู่มือการใช้งาน
        </h1>
        <p className="text-gray-500 text-base max-w-2xl mx-auto">
          คำแนะนำทีละขั้นตอน ตั้งแต่ลงทะเบียนมิเตอร์ ตั้งค่าโหมดการซื้อขาย 
          สร้างคำสั่งซื้อขาย จนถึงตรวจสอบ Invoice และ Blockchain
        </p>
      </div>

      {/* Quick Start & Auto Guide Buttons */}
      <div className="mb-8 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <RocketOutlined className="text-4xl shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white mb-1">เริ่มต้นใช้งาน</h2>
            <p className="text-blue-100 mb-3 text-sm">
              ทำตามขั้นตอนด้านล่างตามลำดับ ตั้งแต่ขั้นตอนที่ 1 ถึง 10
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleNavigate(ROUTE_PATHS.meterRegistration)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-blue-600 font-medium text-sm shadow-lg hover:bg-blue-50 transition-colors"
              >
                <RightCircleOutlined /> เริ่มที่ขั้นตอนที่ 1
              </button>
              <button
                onClick={startTour}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white font-medium text-sm shadow-lg hover:bg-blue-800 transition-colors border border-blue-400"
              >
                🚀 Auto Guide
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Flow Steps (existing) */}
      <div className="space-y-4">
        {flowSteps.map((step, idx) => (
          <div key={step.step} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Left: Step Number + Icon */}
              <div 
                className="flex items-center justify-center p-5 md:w-28 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ background: stepBg(step.color) }}
                onClick={() => handleNavigate(step.navigateTo)}
              >
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1.5 text-white font-bold text-base"
                    style={{ background: colorMap[step.color] || '#1677ff' }}
                  >
                    {step.step}
                  </div>
                  <div className="text-gray-500" style={{ color: colorMap[step.color] }}>
                    {step.icon}
                  </div>
                </div>
              </div>

              {/* Right: Content */}
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-gray-900 mb-0.5">
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-500">{step.subtitle}</p>
                  </div>
                  {step.navigateTo && (
                    <button
                      onClick={() => handleNavigate(step.navigateTo)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-medium shrink-0 hover:opacity-90 transition-opacity"
                      style={{ background: colorMap[step.color] || '#1677ff' }}
                    >
                      <RightCircleOutlined className="text-xs" />
                      {step.buttonLabel || 'ไปหน้านี้'}
                    </button>
                  )}
                </div>

                <ul className="space-y-1 text-sm text-gray-600">
                  {step.details.map((detail, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-gray-300 mt-0.5 shrink-0">•</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>

                {step.tip && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-700">
                    💡 {step.tip}
                  </div>
                )}

                {step.subItems && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {step.subItems.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => handleNavigate(item.path)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
                      >
                        {item.icon} {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-2">✅ ครบทุกขั้นตอนแล้ว!</h3>
        <p className="text-gray-500 text-sm mb-4">
          หลังจากทำครบ 10 ขั้นตอน คุณจะสามารถใช้งานระบบซื้อขายพลังงาน NIDA Smart Grid ได้อย่างเต็มประสิทธิภาพ
        </p>
        <button
          onClick={() => handleNavigate(ROUTE_PATHS.energySelling)}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm shadow hover:bg-blue-700 transition-colors"
        >
          <RocketOutlined /> เริ่มต้นตั้งค่าโหมดการซื้อขาย
        </button>
      </div>

      {/* Footer */}
      <hr className="my-8 border-gray-200" />
      <div className="text-center text-gray-400 text-sm pb-8">
        NIDA Smart Grid v1.0 — พัฒนาเพื่อการจัดการพลังงานภายใน Microgrid<br />
        ระบบ Blockchain: Hardhat (Local) | Database: PostgreSQL 16
      </div>
    </div>
  );
}
