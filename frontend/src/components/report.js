import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from "react-redux";
import { validateAuth } from "../store/auth/auth.action";

// Mock data for the chart
const getMockChartData = (days) => {
    const data = [];
    for (let i = 1; i <= days; i++) {
        data.push({
            day: `Day ${i}`,
            pvProduction: 250 + Math.random() * 150,
            consumption: 300 + Math.random() * 100,
            batterySoC: 50 + Math.random() * 15
        });
    }
    return data;
};

// Export functions
const exportToExcel = () => {
    // Generate CSV data
    const csvData = [
        ['Total Energy Analytics Report', '', '', ''],
        ['Generated:', new Date().toLocaleDateString(), '', ''],
        ['', '', '', ''],
        ['Energy Summary', '', '', ''],
        ['Source', 'Value', 'Percentage', ''],
        ['Solar PV', '420 kWH', '24%', ''],
        ['Battery Storage', '280 kWH', '16%', ''],
        ['Grid Power', '1050 kWH', '60%', ''],
        ['', '', '', ''],
        ['Top Consumers', '', '', ''],
        ['Building', 'Consumption', 'Percentage', 'Status'],
        ['Ratchaphruk Building', '1,050 kWH', '20%', 'Near Limit'],
        ['Malai Building', '700 kWH', '28%', 'Optimal'],
        ['Admin Center', '525 kWH', '15%', 'Optimal'],
        ['Engineering Building', '420 kWH', '12%', 'Optimal'],
        ['', '', '', ''],
        ['Battery Assets', '', '', ''],
        ['Building', 'Battery SoC', 'Health Status', 'Status'],
        ['Ratchaphruk Building', '78%', 'Optimal', 'Active'],
        ['Admin Center', '45%', 'Good', 'Charging'],
        ['Engineering Building', '22%', 'Degraded', 'Low'],
        ['Malai Building', 'N/A', 'N/A', 'No Battery'],
    ];

    // Convert to CSV string
    const csvContent = csvData.map(row => row.join(',')).join('\\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `energy_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const exportToPDF = () => {
    // Create a simple HTML content for PDF
    const reportContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Total Energy Analytics Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; }
                h1 { color: #1f2937; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
                h2 { color: #374151; margin-top: 30px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
                th { background-color: #f3f4f6; font-weight: bold; }
                .summary { background-color: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .alert { background-color: #fff7ed; padding: 15px; border-left: 4px solid #f97316; margin: 20px 0; }
            </style>
        </head>
        <body>
            <h1>Total Energy Analytics Report</h1>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Blockchain Verified:</strong> ✓</p>
            
            <div class="summary">
                <h2>Energy Source Breakdown</h2>
                <table>
                    <tr><th>Source</th><th>Value</th><th>Percentage</th></tr>
                    <tr><td>Solar PV</td><td>420 kWH</td><td>24%</td></tr>
                    <tr><td>Battery Storage</td><td>280 kWH</td><td>16%</td></tr>
                    <tr><td>Grid Power</td><td>1,050 kWH</td><td>60%</td></tr>
                </table>
            </div>
            
            <h2>Top Consumers</h2>
            <table>
                <tr><th>Building</th><th>Consumption</th><th>Percentage</th><th>Status</th></tr>
                <tr><td>Ratchaphruk Building</td><td>1,050 kWH</td><td>20%</td><td>Near Limit</td></tr>
                <tr><td>Malai Building</td><td>700 kWH</td><td>28%</td><td>Optimal</td></tr>
                <tr><td>Admin Center</td><td>525 kWH</td><td>15%</td><td>Optimal</td></tr>
                <tr><td>Engineering Building</td><td>420 kWH</td><td>12%</td><td>Optimal</td></tr>
            </table>
            
            <h2>Battery Assets Status</h2>
            <table>
                <tr><th>Building</th><th>Battery SoC</th><th>Health Status</th><th>Status</th></tr>
                <tr><td>Ratchaphruk Building</td><td>78%</td><td>Optimal</td><td>Active</td></tr>
                <tr><td>Admin Center</td><td>45%</td><td>Good</td><td>Charging</td></tr>
                <tr><td>Engineering Building</td><td>22%</td><td>Degraded</td><td>Low</td></tr>
                <tr><td>Malai Building</td><td>N/A</td><td>N/A</td><td>No Battery</td></tr>
            </table>
            
            <div class="alert">
                <h3>⚠️ Preventive Maintenance Alert</h3>
                <p>Engineering Building battery shows degraded SoH. Recommend inspection within 30 days to prevent performance impact.</p>
            </div>
        </body>
        </html>
    `;
    
    // Create blob and download as HTML (can be printed to PDF)
    const blob = new Blob([reportContent], { type: 'text/html' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `energy_report_${new Date().toISOString().split('T')[0]}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Open in new window for printing to PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportContent);
    printWindow.document.close();
};

export default function Report() {
    const history = useHistory();
    const dispatch = useDispatch();
    const authStore = useSelector((store) => store.auth.isAuthenticate);
    const [timeRange, setTimeRange] = useState('7days');
    const [chartData, setChartData] = useState(getMockChartData(7));

    useEffect(() => {
        dispatch(validateAuth());
    }, []);

    useEffect(() => {
        // Update chart data when time range changes
        const days = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
        setChartData(getMockChartData(days));
    }, [timeRange]);

    // SVG Chart Component
    const EnergyChart = ({ data }) => {
        const width = 800;
        const height = 400;
        const padding = { top: 20, right: 60, bottom: 40, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Calculate scales
        const maxEnergy = 450;
        const minEnergy = 0;
        const maxSoC = 70;
        const minSoC = 45;

        const xScale = (index) => padding.left + (index / (data.length - 1)) * chartWidth;
        const yScaleEnergy = (value) => padding.top + chartHeight - ((value - minEnergy) / (maxEnergy - minEnergy)) * chartHeight;
        const yScaleSoC = (value) => padding.top + chartHeight - ((value - minSoC) / (maxSoC - minSoC)) * chartHeight;

        // Create path strings
        const createPath = (dataKey, scale) => {
            return data.map((d, i) => {
                const x = xScale(i);
                const y = scale(d[dataKey]);
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');
        };

        const pvPath = createPath('pvProduction', yScaleEnergy);
        const consumptionPath = createPath('consumption', yScaleEnergy);
        const batteryPath = createPath('batterySoC', yScaleSoC);

        // Create fill area for PV Production
        const pvFillPath = pvPath + ` L ${xScale(data.length - 1)} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

        return (
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map((i) => {
                    const y = padding.top + (i * chartHeight / 4);
                    return (
                        <line
                            key={`grid-${i}`}
                            x1={padding.left}
                            y1={y}
                            x2={padding.left + chartWidth}
                            y2={y}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Fill area for PV Production */}
                <path
                    d={pvFillPath}
                    fill="rgba(34, 197, 94, 0.1)"
                    stroke="none"
                />

                {/* PV Production line (green) */}
                <path
                    d={pvPath}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Consumption line (red) */}
                <path
                    d={consumptionPath}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Battery SoC line (orange dotted) */}
                <path
                    d={batteryPath}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    strokeDasharray="8,4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data points for PV Production */}
                {data.map((d, i) => (
                    <circle
                        key={`pv-${i}`}
                        cx={xScale(i)}
                        cy={yScaleEnergy(d.pvProduction)}
                        r="4"
                        fill="#22c55e"
                        stroke="white"
                        strokeWidth="2"
                    />
                ))}

                {/* Data points for Consumption */}
                {data.map((d, i) => (
                    <circle
                        key={`con-${i}`}
                        cx={xScale(i)}
                        cy={yScaleEnergy(d.consumption)}
                        r="4"
                        fill="#ef4444"
                        stroke="white"
                        strokeWidth="2"
                    />
                ))}

                {/* Data points for Battery SoC */}
                {data.map((d, i) => (
                    <circle
                        key={`bat-${i}`}
                        cx={xScale(i)}
                        cy={yScaleSoC(d.batterySoC)}
                        r="4"
                        fill="#f97316"
                        stroke="white"
                        strokeWidth="2"
                    />
                ))}

                {/* Y-axis labels (left - Energy) */}
                {[0, 100, 200, 300, 400].map((value, i) => (
                    <text
                        key={`y-energy-${i}`}
                        x={padding.left - 10}
                        y={yScaleEnergy(value)}
                        textAnchor="end"
                        fontSize="12"
                        fill="#6b7280"
                        dominantBaseline="middle"
                    >
                        {value}
                    </text>
                ))}

                {/* Y-axis labels (right - Battery SoC) */}
                {[46, 50, 55, 60, 65].map((value, i) => (
                    <text
                        key={`y-soc-${i}`}
                        x={padding.left + chartWidth + 10}
                        y={yScaleSoC(value)}
                        textAnchor="start"
                        fontSize="12"
                        fill="#6b7280"
                        dominantBaseline="middle"
                    >
                        {value}
                    </text>
                ))}

                {/* X-axis labels */}
                {data.map((d, i) => {
                    // Show fewer labels for longer time ranges
                    const showLabel = data.length <= 7 ? true : i % Math.ceil(data.length / 7) === 0;
                    if (!showLabel) return null;
                    return (
                        <text
                            key={`x-${i}`}
                            x={xScale(i)}
                            y={padding.top + chartHeight + 25}
                            textAnchor="middle"
                            fontSize="12"
                            fill="#6b7280"
                        >
                            {d.day}
                        </text>
                    );
                })}

                {/* Y-axis label (left) */}
                <text
                    x={padding.left - 45}
                    y={padding.top + chartHeight / 2}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#6b7280"
                    transform={`rotate(-90 ${padding.left - 45} ${padding.top + chartHeight / 2})`}
                >
                    Energy (kWH)
                </text>

                {/* Y-axis label (right) */}
                <text
                    x={padding.left + chartWidth + 45}
                    y={padding.top + chartHeight / 2}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#6b7280"
                    transform={`rotate(90 ${padding.left + chartWidth + 45} ${padding.top + chartHeight / 2})`}
                >
                    Battery SoC (%)
                </text>

                {/* X-axis label */}
                <text
                    x={padding.left + chartWidth / 2}
                    y={height - 5}
                    textAnchor="middle"
                    fontSize="13"
                    fill="#6b7280"
                    fontWeight="500"
                >
                    Timeline
                </text>
            </svg>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-1">Total Energy Analytics</h1>
                        <p className="text-sm text-gray-600">Comprehensive energy production, consumption & battery insights</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-lg">
                            <span className="text-purple-600 text-xl">💰</span>
                            <div>
                                <p className="text-xs text-purple-700 font-medium">Admin Wallet</p>
                                <p className="text-sm font-bold text-purple-900">12,450 <span className="text-xs font-normal">Tokens</span></p>
                            </div>
                        </div>
                        <button className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg">
                            <span>⬇️</span>
                            <span>Export Report</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-sm font-semibold text-gray-900">Alex Morgan</p>
                                <p className="text-xs text-gray-600">Admin</p>
                            </div>
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                AM
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Energy Production vs. Consumption */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-1">System Energy Production vs. Consumption</h2>
                            <p className="text-sm text-gray-600">Comparative trend analysis with Battery State of Charge (SoC)</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setTimeRange('7days')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                    timeRange === '7days'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setTimeRange('30days')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                    timeRange === '30days'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                30 Days
                            </button>
                            <button
                                onClick={() => setTimeRange('90days')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                    timeRange === '90days'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                90 Days
                            </button>
                            <button className="px-4 py-2 rounded-lg font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-2">
                                <span>📅</span>
                                <span>Custom</span>
                            </button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-6 mb-4 justify-center">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 bg-green-500 rounded"></div>
                            <span className="text-sm text-gray-700 font-medium">PV Production (kWH)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 bg-red-500 rounded"></div>
                            <span className="text-sm text-gray-700 font-medium">Consumption (kWH)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 border-2 border-dashed border-orange-500 rounded"></div>
                            <span className="text-sm text-gray-700 font-medium">Battery SoC (%)</span>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="w-full overflow-x-auto">
                        <EnergyChart data={chartData} />
                    </div>
                </div>

                {/* Energy Source Breakdown & Top Consumers */}
                <div className="flex gap-6 mb-6">
                    {/* Energy Source Breakdown - Left (narrower) */}
                    <div className="w-[42%] bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-1">Energy Source Breakdown</h2>
                                <p className="text-sm text-gray-600">Current period distribution</p>
                            </div>
                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <span className="text-gray-400">⋮</span>
                            </button>
                        </div>

                        {/* Donut Chart */}
                        <div className="flex items-center justify-center mb-6">
                            <svg width="280" height="280" viewBox="0 0 280 280">
                                <defs>
                                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1"/>
                                    </filter>
                                </defs>
                                
                                {/* Grid Power - Blue (60% = 216deg) */}
                                <path
                                    d="M 140,140 L 140,20 A 120,120 0 1,1 38.8,74.4 Z"
                                    fill="#3b82f6"
                                    filter="url(#shadow)"
                                />
                                
                                {/* Solar PV - Green (24% = 86.4deg) */}
                                <path
                                    d="M 140,140 L 38.8,74.4 A 120,120 0 0,1 90,26.4 Z"
                                    fill="#22c55e"
                                    filter="url(#shadow)"
                                />
                                
                                {/* Battery Storage - Orange (16% = 57.6deg) */}
                                <path
                                    d="M 140,140 L 90,26.4 A 120,120 0 0,1 140,20 Z"
                                    fill="#f97316"
                                    filter="url(#shadow)"
                                />
                                
                                {/* Center white circle for donut effect */}
                                <circle cx="140" cy="140" r="85" fill="white"/>
                            </svg>
                        </div>

                        {/* Breakdown List */}
                        <div className="space-y-3">
                            {/* Solar PV */}
                            <div className="bg-green-50 rounded-xl p-4 flex items-center justify-between">
                                <span className="text-gray-900 font-semibold">Solar PV</span>
                                <div className="text-right">
                                    <p className="text-gray-900 font-bold text-lg">420 kWH</p>
                                    <p className="text-green-600 text-sm font-semibold">24 %</p>
                                </div>
                            </div>

                            {/* Battery Storage */}
                            <div className="bg-orange-50 rounded-xl p-4 flex items-center justify-between">
                                <span className="text-gray-900 font-semibold">Battery Storage</span>
                                <div className="text-right">
                                    <p className="text-gray-900 font-bold text-lg">280 kWH</p>
                                    <p className="text-orange-600 text-sm font-semibold">16 %</p>
                                </div>
                            </div>

                            {/* Grid Power */}
                            <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
                                <span className="text-gray-900 font-semibold">Grid Power</span>
                                <div className="text-right">
                                    <p className="text-gray-900 font-bold text-lg">1050 kWH</p>
                                    <p className="text-blue-600 text-sm font-semibold">60 %</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Consumers - Right (wider) */}
                    <div className="w-[58%] bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-1">Top Consumers</h2>
                                <p className="text-sm text-gray-600">Building consumption ranking</p>
                            </div>
                            <button className="text-blue-600 font-semibold text-sm hover:text-blue-700 flex items-center gap-1">
                                View All Buildings →
                            </button>
                        </div>

                        {/* Consumer List */}
                        <div className="space-y-4">
                            {/* 1. Ratchaphruk Building - Near Limit */}
                            <div className="bg-red-50 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-gray-700 font-bold shadow-sm">
                                            1
                                        </div>
                                        <div>
                                            <h3 className="text-gray-900 font-bold">Ratchaphruk Building</h3>
                                            <p className="text-gray-600 text-sm">20% of total consumption</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-900 font-bold text-xl">1,050 kWH</p>
                                        <p className="text-red-600 text-sm font-semibold">Near Limit</p>
                                    </div>
                                </div>
                                <div className="w-full bg-red-200 rounded-full h-2.5">
                                    <div className="bg-red-600 h-2.5 rounded-full" style={{width: '87%'}}></div>
                                </div>
                            </div>

                            {/* 2. Malai Building - Optimal */}
                            <div className="bg-orange-50 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-gray-700 font-bold shadow-sm">
                                            2
                                        </div>
                                        <div>
                                            <h3 className="text-gray-900 font-bold">Malai Building</h3>
                                            <p className="text-gray-600 text-sm">28% of total consumption</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-900 font-bold text-xl">700 kWH</p>
                                        <p className="text-green-600 text-sm font-semibold">Optimal</p>
                                    </div>
                                </div>
                                <div className="w-full bg-orange-200 rounded-full h-2.5">
                                    <div className="bg-orange-500 h-2.5 rounded-full" style={{width: '58%'}}></div>
                                </div>
                            </div>

                            {/* 3. Admin Center - Optimal */}
                            <div className="bg-blue-50 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-gray-700 font-bold shadow-sm">
                                            3
                                        </div>
                                        <div>
                                            <h3 className="text-gray-900 font-bold">Admin Center</h3>
                                            <p className="text-gray-600 text-sm">15% of total consumption</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-900 font-bold text-xl">525 kWH</p>
                                        <p className="text-green-600 text-sm font-semibold">Optimal</p>
                                    </div>
                                </div>
                                <div className="w-full bg-blue-200 rounded-full h-2.5">
                                    <div className="bg-blue-500 h-2.5 rounded-full" style={{width: '44%'}}></div>
                                </div>
                            </div>

                            {/* 4. Engineering Building - Optimal */}
                            <div className="bg-green-50 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-gray-700 font-bold shadow-sm">
                                            4
                                        </div>
                                        <div>
                                            <h3 className="text-gray-900 font-bold">Engineering Building</h3>
                                            <p className="text-gray-600 text-sm">12% of total consumption</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-900 font-bold text-xl">420 kWH</p>
                                        <p className="text-green-600 text-sm font-semibold">Optimal</p>
                                    </div>
                                </div>
                                <div className="w-full bg-green-200 rounded-full h-2.5">
                                    <div className="bg-green-500 h-2.5 rounded-full" style={{width: '35%'}}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Building Comparison Report */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-1">Building Comparison Report</h2>
                        <p className="text-sm text-gray-600">Side-by-side energy flow analysis</p>
                    </div>

                    <div className="flex gap-6">
                        {/* Left: Ratchaphruk Building (With Battery) */}
                        <div className="flex-1 bg-gray-50 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Production vs Consumption vs Battery</h3>
                                    <p className="text-sm text-gray-600">Ratchaphruk Building (With Battery)</p>
                                </div>
                                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white">
                                    <option>Last 7 Days</option>
                                    <option>Last 30 Days</option>
                                    <option>Last 90 Days</option>
                                </select>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-4 mb-4 justify-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-1 bg-green-500 rounded"></div>
                                    <span className="text-xs text-gray-700 font-medium">PV Production</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-1 bg-red-500 rounded"></div>
                                    <span className="text-xs text-gray-700 font-medium">Consumption</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                                    <span className="text-xs text-gray-700 font-medium">Battery Discharge</span>
                                </div>
                            </div>

                            {/* Chart */}
                            <svg width="100%" height="300" viewBox="0 0 500 300" className="bg-white rounded-lg">
                                {/* Grid lines */}
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                    <line
                                        key={`grid1-${i}`}
                                        x1="50"
                                        y1={40 + i * 40}
                                        x2="480"
                                        y2={40 + i * 40}
                                        stroke="#e5e7eb"
                                        strokeWidth="1"
                                    />
                                ))}

                                {/* PV Production line (green) - peaks at midday */}
                                <path
                                    d="M 50,230 L 95,210 L 140,180 L 185,140 L 230,80 L 275,60 L 320,100 L 365,150 L 410,190 L 455,210"
                                    fill="none"
                                    stroke="#22c55e"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                
                                {/* Fill area for PV Production */}
                                <path
                                    d="M 50,230 L 95,210 L 140,180 L 185,140 L 230,80 L 275,60 L 320,100 L 365,150 L 410,190 L 455,210 L 455,240 L 50,240 Z"
                                    fill="rgba(34, 197, 94, 0.1)"
                                />

                                {/* Consumption line (red) */}
                                <path
                                    d="M 50,200 L 95,210 L 140,205 L 185,180 L 230,170 L 275,170 L 320,175 L 365,185 L 410,195 L 455,200"
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />

                                {/* Battery Discharge bars (orange) - during peak hours */}
                                <rect x="320" y="140" width="35" height="100" fill="#f97316" rx="2"/>
                                <rect x="365" y="160" width="35" height="80" fill="#f97316" rx="2"/>

                                {/* Y-axis labels */}
                                {[0, 50, 100, 150, 200, 250].map((value, i) => (
                                    <text
                                        key={`y1-${i}`}
                                        x="40"
                                        y={240 - i * 40}
                                        textAnchor="end"
                                        fontSize="11"
                                        fill="#6b7280"
                                    >
                                        {value}
                                    </text>
                                ))}

                                {/* X-axis labels */}
                                {['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map((time, i) => (
                                    <text
                                        key={`x1-${i}`}
                                        x={50 + i * 57.85}
                                        y="260"
                                        textAnchor="middle"
                                        fontSize="11"
                                        fill="#6b7280"
                                    >
                                        {time}
                                    </text>
                                ))}

                                {/* Axis label */}
                                <text x="30" y="20" fontSize="11" fill="#6b7280" fontWeight="500">kWH</text>
                            </svg>

                            {/* Insight */}
                            <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                                <div className="flex items-start gap-2">
                                    <span className="text-blue-600 text-lg">ℹ️</span>
                                    <p className="text-sm text-gray-800">
                                        Battery system reduces Grid Import by <span className="font-bold text-blue-700">42%</span> during peak hours
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Malai Building (Without Battery) */}
                        <div className="flex-1 bg-gray-50 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Production vs Consumption</h3>
                                    <p className="text-sm text-gray-600">Malai Building (Without Battery)</p>
                                </div>
                                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white">
                                    <option>Last 7 Days</option>
                                    <option>Last 30 Days</option>
                                    <option>Last 90 Days</option>
                                </select>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-4 mb-4 justify-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-1 bg-green-500 rounded"></div>
                                    <span className="text-xs text-gray-700 font-medium">PV Production</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-1 bg-red-500 rounded"></div>
                                    <span className="text-xs text-gray-700 font-medium">Consumption</span>
                                </div>
                            </div>

                            {/* Chart */}
                            <svg width="100%" height="300" viewBox="0 0 500 300" className="bg-white rounded-lg">
                                {/* Grid lines */}
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                    <line
                                        key={`grid2-${i}`}
                                        x1="50"
                                        y1={40 + i * 40}
                                        x2="480"
                                        y2={40 + i * 40}
                                        stroke="#e5e7eb"
                                        strokeWidth="1"
                                    />
                                ))}

                                {/* PV Production line (green) - similar pattern but different scale */}
                                <path
                                    d="M 50,240 L 95,240 L 140,235 L 185,210 L 230,120 L 275,80 L 320,90 L 365,140 L 410,190 L 455,220"
                                    fill="none"
                                    stroke="#22c55e"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                
                                {/* Fill area for PV Production */}
                                <path
                                    d="M 50,240 L 95,240 L 140,235 L 185,210 L 230,120 L 275,80 L 320,90 L 365,140 L 410,190 L 455,220 L 455,240 L 50,240 Z"
                                    fill="rgba(34, 197, 94, 0.1)"
                                />

                                {/* Consumption line (red) - higher than production */}
                                <path
                                    d="M 50,210 L 95,220 L 140,220 L 185,200 L 230,120 L 275,100 L 320,110 L 365,130 L 410,170 L 455,200"
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />

                                {/* Y-axis labels */}
                                {[0, 50, 100, 150, 200].map((value, i) => (
                                    <text
                                        key={`y2-${i}`}
                                        x="40"
                                        y={240 - i * 40}
                                        textAnchor="end"
                                        fontSize="11"
                                        fill="#6b7280"
                                    >
                                        {value}
                                    </text>
                                ))}

                                {/* X-axis labels */}
                                {['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map((time, i) => (
                                    <text
                                        key={`x2-${i}`}
                                        x={50 + i * 57.85}
                                        y="260"
                                        textAnchor="middle"
                                        fontSize="11"
                                        fill="#6b7280"
                                    >
                                        {time}
                                    </text>
                                ))}

                                {/* Axis label */}
                                <text x="30" y="20" fontSize="11" fill="#6b7280" fontWeight="500">kWH</text>
                            </svg>

                            {/* Warning */}
                            <div className="mt-4 bg-orange-50 border-l-4 border-orange-500 p-3 rounded">
                                <div className="flex items-start gap-2">
                                    <span className="text-orange-600 text-lg">🔥</span>
                                    <p className="text-sm text-gray-800">
                                        <span className="font-bold text-orange-700">High grid reliance</span> solar installation recommended.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid & Battery Flow and Net Grid Flow */}
                <div className="flex gap-6 mb-6">
                    {/* Left: Grid & Battery Flow */}
                    <div className="flex-1 bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-xl font-bold text-gray-900">Grid & Battery Flow</h2>
                                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-bold">
                                        Optimized
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600">Energy Arbitrage Analysis - Ratchaphruk</p>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 mb-4 justify-center">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                                <span className="text-sm text-gray-700 font-medium">Grid Import</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                                <span className="text-sm text-gray-700 font-medium">Battery Discharge</span>
                            </div>
                        </div>

                        {/* Bar Chart */}
                        <svg width="100%" height="350" viewBox="0 0 600 350">
                            {/* Grid lines */}
                            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                                <line
                                    key={`grid-line-${i}`}
                                    x1="60"
                                    y1={40 + i * 40}
                                    x2="580"
                                    y2={40 + i * 40}
                                    stroke="#e5e7eb"
                                    strokeWidth="1"
                                />
                            ))}

                            {/* Bar data points */}
                            {/* 00:00 - Grid Import 120 kWH */}
                            <rect x="65" y="80" width="50" height="200" fill="#3b82f6" rx="4"/>
                            
                            {/* 03:00 - Grid Import 100 kWH */}
                            <rect x="135" y="113" width="50" height="167" fill="#3b82f6" rx="4"/>
                            
                            {/* 06:00 - Grid Import 50 kWH */}
                            <rect x="205" y="197" width="50" height="83" fill="#3b82f6" rx="4"/>
                            
                            {/* 09:00-15:00 - No bars (solar covers consumption) */}
                            
                            {/* 18:00 - Battery Discharge 80 kWH */}
                            <rect x="415" y="147" width="50" height="133" fill="#f97316" rx="4"/>
                            
                            {/* 21:00 - Grid Import 80 kWH + Battery Discharge 60 kWH */}
                            <rect x="485" y="147" width="50" height="133" fill="#3b82f6" rx="4"/>
                            <rect x="485" y="47" width="50" height="100" fill="#f97316" rx="4"/>

                            {/* Y-axis labels */}
                            {[0, 20, 40, 60, 80, 100, 120, 140].map((value, i) => (
                                <text
                                    key={`y-label-${i}`}
                                    x="50"
                                    y={280 - i * 33.33}
                                    textAnchor="end"
                                    fontSize="12"
                                    fill="#6b7280"
                                >
                                    {value}
                                </text>
                            ))}

                            {/* X-axis labels */}
                            {['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map((time, i) => (
                                <text
                                    key={`x-label-${i}`}
                                    x={90 + i * 70}
                                    y="300"
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill="#6b7280"
                                >
                                    {time}
                                </text>
                            ))}

                            {/* Y-axis label */}
                            <text
                                x="20"
                                y="160"
                                textAnchor="middle"
                                fontSize="13"
                                fill="#6b7280"
                                fontWeight="500"
                                transform="rotate(-90 20 160)"
                            >
                                kWH
                            </text>
                        </svg>
                    </div>

                    {/* Right: Net Grid Flow */}
                    <div className="flex-1 bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-xl font-bold text-gray-900">Net Grid Flow</h2>
                                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold">
                                        High Import
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600">Grid Import Analysis - Malai Building</p>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 mb-4 justify-center">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-1 bg-blue-600 rounded"></div>
                                <span className="text-sm text-gray-700 font-medium">Net Grid Import</span>
                            </div>
                        </div>

                        {/* Line Chart */}
                        <svg width="100%" height="350" viewBox="0 0 600 350">
                            {/* Grid lines */}
                            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                                <line
                                    key={`net-grid-line-${i}`}
                                    x1="60"
                                    y1={40 + i * 40}
                                    x2="580"
                                    y2={40 + i * 40}
                                    stroke="#e5e7eb"
                                    strokeWidth="1"
                                />
                            ))}

                            {/* Data path - Net Grid Import line */}
                            <path
                                d="M 90,47 L 160,67 L 230,127 L 300,207 L 370,267 L 440,240 L 510,87 L 580,47"
                                fill="none"
                                stroke="#2563eb"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />

                            {/* Fill area under the line */}
                            <path
                                d="M 90,47 L 160,67 L 230,127 L 300,207 L 370,267 L 440,240 L 510,87 L 580,47 L 580,280 L 90,280 Z"
                                fill="rgba(37, 99, 235, 0.1)"
                            />

                            {/* Data points */}
                            {[
                                {x: 90, y: 47},
                                {x: 160, y: 67},
                                {x: 230, y: 127},
                                {x: 300, y: 207},
                                {x: 370, y: 267},
                                {x: 440, y: 240},
                                {x: 510, y: 87},
                                {x: 580, y: 47}
                            ].map((point, i) => (
                                <circle
                                    key={`point-${i}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r="4"
                                    fill="#2563eb"
                                    stroke="white"
                                    strokeWidth="2"
                                />
                            ))}

                            {/* Y-axis labels */}
                            {[0, 20, 40, 60, 80, 100, 120].map((value, i) => (
                                <text
                                    key={`net-y-label-${i}`}
                                    x="50"
                                    y={280 - i * 40}
                                    textAnchor="end"
                                    fontSize="12"
                                    fill="#6b7280"
                                >
                                    {value}
                                </text>
                            ))}

                            {/* X-axis labels */}
                            {['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map((time, i) => (
                                <text
                                    key={`net-x-label-${i}`}
                                    x={90 + i * 70}
                                    y="300"
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill="#6b7280"
                                >
                                    {time}
                                </text>
                            ))}

                            {/* Y-axis label */}
                            <text
                                x="20"
                                y="160"
                                textAnchor="middle"
                                fontSize="13"
                                fill="#6b7280"
                                fontWeight="500"
                                transform="rotate(-90 20 160)"
                            >
                                kWH
                            </text>
                        </svg>
                    </div>
                </div>

                {/* Battery Assets Report */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-1">Battery Assets Report</h2>
                        <p className="text-sm text-gray-600">Current status & health monitoring</p>
                    </div>

                    <div className="flex gap-6">
                        {/* Card 1: Ratchaphruk Building - Active/Optimal */}
                        <div className="flex-1 bg-gray-50 rounded-xl p-6 shadow-md">
                            <div className="flex flex-col items-center">
                                {/* Battery Icon - Green */}
                                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <rect x="2" y="7" width="18" height="11" rx="2" ry="2"/>
                                        <line x1="22" y1="11" x2="22" y2="14"/>
                                        <rect x="5" y="10" width="4" height="5" fill="white"/>
                                        <rect x="10" y="10" width="4" height="5" fill="white"/>
                                    </svg>
                                </div>

                                {/* Status Badge */}
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-bold mb-4">
                                    Active
                                </span>

                                {/* Building Name */}
                                <h3 className="text-gray-600 font-medium text-sm mb-2">Ratchaphruk Building</h3>

                                {/* Percentage */}
                                <p className="text-5xl font-bold text-gray-900 mb-2">78%</p>

                                {/* Label */}
                                <p className="text-gray-600 text-sm mb-4">Current Battery SoC</p>

                                {/* Progress Bar */}
                                <div className="w-full bg-gray-300 rounded-full h-2.5 mb-6">
                                    <div className="bg-green-500 h-2.5 rounded-full" style={{width: '78%'}}></div>
                                </div>

                                {/* Health Status */}
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-gray-600 text-sm">State of Health (SoH)</span>
                                    <span className="text-green-600 font-bold text-sm">Optimal</span>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Admin Center - Charging/Good */}
                        <div className="flex-1 bg-gray-50 rounded-xl p-6 shadow-md">
                            <div className="flex flex-col items-center">
                                {/* Battery Icon - Orange */}
                                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <rect x="2" y="7" width="18" height="11" rx="2" ry="2"/>
                                        <line x1="22" y1="11" x2="22" y2="14"/>
                                        <rect x="5" y="10" width="4" height="5" fill="white"/>
                                    </svg>
                                </div>

                                {/* Status Badge */}
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold mb-4">
                                    Charging
                                </span>

                                {/* Building Name */}
                                <h3 className="text-gray-600 font-medium text-sm mb-2">Admin Center</h3>

                                {/* Percentage */}
                                <p className="text-5xl font-bold text-gray-900 mb-2">45%</p>

                                {/* Label */}
                                <p className="text-gray-600 text-sm mb-4">Current Battery SoC</p>

                                {/* Progress Bar */}
                                <div className="w-full bg-gray-300 rounded-full h-2.5 mb-6">
                                    <div className="bg-orange-500 h-2.5 rounded-full" style={{width: '45%'}}></div>
                                </div>

                                {/* Health Status */}
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-gray-600 text-sm">State of Health (SoH)</span>
                                    <span className="text-green-600 font-bold text-sm">Good</span>
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Engineering Building - Low/Degraded */}
                        <div className="flex-1 bg-gray-50 rounded-xl p-6 shadow-md">
                            <div className="flex flex-col items-center">
                                {/* Battery Icon - Red */}
                                <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <rect x="2" y="7" width="18" height="11" rx="2" ry="2"/>
                                        <line x1="22" y1="11" x2="22" y2="14"/>
                                        <rect x="5" y="10" width="4" height="5" fill="white"/>
                                    </svg>
                                </div>

                                {/* Status Badge */}
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-bold mb-4">
                                    Low
                                </span>

                                {/* Building Name */}
                                <h3 className="text-gray-600 font-medium text-sm mb-2">Engineering Building</h3>

                                {/* Percentage */}
                                <p className="text-5xl font-bold text-gray-900 mb-2">22%</p>

                                {/* Label */}
                                <p className="text-gray-600 text-sm mb-4">Current Battery SoC</p>

                                {/* Progress Bar */}
                                <div className="w-full bg-gray-300 rounded-full h-2.5 mb-6">
                                    <div className="bg-red-500 h-2.5 rounded-full" style={{width: '22%'}}></div>
                                </div>

                                {/* Health Status */}
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-gray-600 text-sm">State of Health (SoH)</span>
                                    <span className="text-orange-600 font-bold text-sm">Degraded</span>
                                </div>
                            </div>
                        </div>

                        {/* Card 4: Malai Building - N/A */}
                        <div className="flex-1 bg-gray-50 rounded-xl p-6 shadow-md">
                            <div className="flex flex-col items-center">
                                {/* Battery Icon - Gray */}
                                <div className="w-16 h-16 bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <circle cx="12" cy="12" r="8"/>
                                        <line x1="8" y1="12" x2="16" y2="12"/>
                                    </svg>
                                </div>

                                {/* Status Badge */}
                                <span className="px-3 py-1 bg-gray-200 text-gray-600 rounded-lg text-sm font-bold mb-4">
                                    N/A
                                </span>

                                {/* Building Name */}
                                <h3 className="text-gray-600 font-medium text-sm mb-2">Malai Building</h3>

                                {/* Percentage */}
                                <p className="text-5xl font-bold text-gray-400 mb-2">--</p>

                                {/* Label */}
                                <p className="text-gray-600 text-sm mb-4">No Battery Installed</p>

                                {/* Progress Bar - Empty/Gray */}
                                <div className="w-full bg-gray-300 rounded-full h-2.5 mb-6">
                                    <div className="bg-gray-300 h-2.5 rounded-full" style={{width: '0%'}}></div>
                                </div>

                                {/* Health Status */}
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-gray-600 text-sm">State of Health (SoH)</span>
                                    <span className="text-gray-400 font-bold text-sm">N/A</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preventive Maintenance Alert */}
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-2xl shadow-lg p-6 border-l-4 border-orange-500 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-start gap-4">
                            {/* Wrench Icon */}
                            <div className="w-14 h-14 bg-gradient-to-br from-orange-200 to-orange-300 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                                </svg>
                            </div>

                            {/* Alert Content */}
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Preventive Maintenance Alert</h3>
                                <p className="text-gray-700 text-base">
                                    Engineering Building battery shows degraded SoH. Recommend inspection within 30 days to prevent performance impact.
                                </p>
                            </div>
                        </div>

                        {/* Schedule Service Button */}
                        <button className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl flex-shrink-0">
                            Schedule Service
                        </button>
                    </div>
                </div>

                {/* Data Export & Verification */}
                <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 rounded-2xl shadow-2xl p-8 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold text-white mb-3">Data Export & Verification</h2>
                            <p className="text-blue-100 text-base mb-6">
                                Export comprehensive energy reports with blockchain verification for official audits and budget documentation
                            </p>

                            {/* Feature Badges */}
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Weekly Summary */}
                                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-2 flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span className="text-white font-medium">Weekly Summary</span>
                                </div>

                                {/* Building-Specific Data */}
                                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-2 flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span className="text-white font-medium">Building-Specific Data</span>
                                </div>

                                {/* Battery SoC/SoH History */}
                                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-2 flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span className="text-white font-medium">Battery SoC/SoH History</span>
                                </div>

                                {/* Blockchain Hash Included */}
                                <div className="bg-purple-500/30 backdrop-blur-sm border border-purple-300/50 rounded-xl px-4 py-2 flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                        <path d="M2 17l10 5 10-5"/>
                                        <path d="M2 12l10 5 10-5"/>
                                    </svg>
                                    <span className="text-white font-medium">Blockchain Hash Included</span>
                                </div>
                            </div>
                        </div>

                        {/* Export Buttons */}
                        <div className="flex flex-col gap-4 ml-8">
                            {/* Export to Excel */}
                            <button 
                                onClick={exportToExcel}
                                className="px-8 py-4 bg-white rounded-2xl font-bold text-blue-700 hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl flex items-center gap-3 min-w-[220px]"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="#2563eb" strokeWidth="2"/>
                                    <path d="M3 9h18M9 3v18" stroke="#2563eb" strokeWidth="2"/>
                                    <rect x="10" y="10" width="4" height="4" fill="#2563eb"/>
                                </svg>
                                <span>Export to Excel</span>
                            </button>

                            {/* Export to PDF */}
                            <button 
                                onClick={exportToPDF}
                                className="px-8 py-4 bg-white rounded-2xl font-bold text-purple-700 hover:bg-purple-50 transition-all shadow-lg hover:shadow-xl flex items-center gap-3 min-w-[220px]"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span>Export to PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
