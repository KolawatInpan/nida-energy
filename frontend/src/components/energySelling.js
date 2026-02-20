import React, { useState, useEffect } from 'react';
import { Card, Space, Button, Input } from "antd";

// Mock buildings data with energy info
const mockBuildings = [
    { id: 0, name: 'Campus Overview', location: 'All Buildings', capacity: 0, currentEnergy: 0, price: 0 },
    { id: 1, name: 'Auditorium', location: 'Building A', capacity: 250, currentEnergy: 125, price: 3.5 },
    { id: 2, name: 'Bunchana', location: 'Building B', capacity: 180, currentEnergy: 90, price: 3.2 },
    { id: 3, name: 'Chup', location: 'Building C', capacity: 500, currentEnergy: 350, price: 3.4 },
    { id: 4, name: 'Malai', location: 'Building D', capacity: 320, currentEnergy: 180, price: 3.3 },
    { id: 5, name: 'Narathip', location: 'Building E', capacity: 150, currentEnergy: 75, price: 3.6 },
    { id: 6, name: 'Navamin', location: 'Building F', capacity: 280, currentEnergy: 140, price: 3.5 },
    { id: 7, name: 'Nida House', location: 'Building G', capacity: 200, currentEnergy: 100, price: 3.4 },
    { id: 8, name: 'Nida Sumpan', location: 'Building H', capacity: 350, currentEnergy: 200, price: 3.3 },
    { id: 9, name: 'Ratchaphruek', location: 'Building I', capacity: 250, currentEnergy: 150, price: 3.5 },
    { id: 10, name: 'Serithai', location: 'Building J', capacity: 180, currentEnergy: 95, price: 3.2 },
    { id: 11, name: 'Siam', location: 'Building K', capacity: 220, currentEnergy: 110, price: 3.4 },
];

export default function EnergySelling() {
    const [bid, setBID] = useState(0);
    const [selectedBuilding, setSelectedBuilding] = useState(null);
    const [energyAmount, setEnergyAmount] = useState('');
    const [energyRate, setEnergyRate] = useState('');
    const [showPanel, setShowPanel] = useState(false);

    useEffect(() => {
        const leftDiv = document.getElementsByClassName("left-div")[0];
        if (leftDiv) {
            const boundLeft = leftDiv.getBoundingClientRect();
            const maplayout = document.getElementsByClassName("maplayout")[0];
            if (maplayout && boundLeft.width / boundLeft.height > 1920 / 1045) {
                maplayout.classList.add("wide");
            }
        }
    }, []);

    useEffect(() => {
        const boundLeft = document.getElementsByClassName("left-div")[0]?.getBoundingClientRect();
        if (!boundLeft) return;
        
        if (boundLeft.width / boundLeft.height > 1920 / 1045) {
            const maplayout = document.getElementsByClassName("maplayout")[0];
            if (maplayout && !maplayout.classList.contains("wide")) {
                maplayout.classList.add("wide");
            }
        }

        // Remove active/current from all buttons/images
        document.querySelectorAll('.bbtn, .bgbtn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (bid > 0) {
            const activebtn = document.getElementsByClassName("btn" + bid)[0];
            if (activebtn) {
                activebtn.classList.add("active");
            }
            const activetool = document.getElementsByClassName("currentTooltip")[0];
            if (activetool && activebtn) {
                activetool.style.display = "block";
                activetool.innerHTML = activebtn.getAttribute("title");
                const bound = activebtn.getBoundingClientRect();
                const parent_bound = activebtn.parentNode.getBoundingClientRect();
                const widthdif = (bound.width - activetool.getBoundingClientRect().width) / 2;
                activetool.style.marginTop = (bound.top - parent_bound.top - 56) + 'px';
                activetool.style.marginLeft = (bound.left - parent_bound.left + widthdif) + 'px';
            }
        } else {
            // Background active
            const bgBtn = document.querySelector('.bgbtn.btn0');
            if (bgBtn) {
                bgBtn.classList.add('active');
            }
            const activetool = document.getElementsByClassName("currentTooltip")[0];
            if (activetool) {
                activetool.style.display = "none";
            }
        }
    });

    // Handle hover tooltips
    useEffect(() => {
        const buttons = document.querySelectorAll('.bbtn, .bgbtn');
        const tooltip = document.getElementsByClassName("currentTooltip")[0];

        const handleMouseEnter = (e) => {
            const hoveredBid = parseInt(e.currentTarget.getAttribute('bid'));
            // Only show hover tooltip if this is NOT the active building
            if (bid !== hoveredBid && tooltip) {
                tooltip.style.display = "block";
                tooltip.innerHTML = e.currentTarget.getAttribute("title");
                const bound = e.currentTarget.getBoundingClientRect();
                const parent_bound = e.currentTarget.parentNode.getBoundingClientRect();
                const widthdif = (bound.width - tooltip.getBoundingClientRect().width) / 2;
                tooltip.style.marginTop = (bound.top - parent_bound.top - 56) + 'px';
                tooltip.style.marginLeft = (bound.left - parent_bound.left + widthdif) + 'px';
            }
        };

        const handleMouseLeave = () => {
            // Hide hover tooltip (but keep active tooltip if there's an active building)
            if (bid === 0 && tooltip) {
                tooltip.style.display = "none";
            }
        };

        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', handleMouseEnter);
            btn.addEventListener('mouseleave', handleMouseLeave);
        });

        return () => {
            buttons.forEach(btn => {
                btn.removeEventListener('mouseenter', handleMouseEnter);
                btn.removeEventListener('mouseleave', handleMouseLeave);
            });
        };
    }, [bid]);


    const buildOn = (e) => {
        const newbid = parseInt(e.currentTarget.getAttribute('bid'));
        const building = mockBuildings.find(b => b.id === newbid);
        
        if (newbid === 0) {
            // Reset to overview
            setBID(0);
            setSelectedBuilding(null);
            setShowPanel(false);
            setEnergyAmount('');
            setEnergyRate('');
        } else if (building) {
            // Select building and show panel
            setBID(newbid);
            setSelectedBuilding(building);
            setShowPanel(true);
            // Set default rate from building
            setEnergyRate(building.price ? building.price.toString() : '');
        }
    };

    const handleBuy = () => {
        if (!energyAmount) {
            alert('Please enter energy amount');
            return;
        }
        alert(`Buying ${energyAmount} kWH from ${selectedBuilding.name} at ${energyRate} Token/kWH`);
        // Add your buy logic here
    };

    const handleSell = () => {
        if (!energyAmount) {
            alert('Please enter energy amount');
            return;
        }
        alert(`Selling ${energyAmount} kWH to ${selectedBuilding.name} at ${energyRate} Token/kWH`);
        // Add your sell logic here
    };

  // Trading Panel Component
  const TradingPanel = () => {
    const handleClose = () => {
      setBID(0);
      setShowPanel(false);
      setSelectedBuilding(null);
      setEnergyAmount('');
      setEnergyRate('');
    };

    return (
      <div style={{ padding: "20px", height: "100%" }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          {/* Building Header with Close Button */}
          <Card className="head-bar" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  🏢 {selectedBuilding?.name || ''}
                </div>
                <div style={{ 
                  display: "inline-block",
                  background: "#52c41a",
                  color: "white",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  marginRight: 8
                }}>
                  CONNECTED
                </div>
                <span style={{ fontSize: 13, color: "#666" }}>
                  {selectedBuilding?.location}
                </span>
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 28,
                  cursor: "pointer",
                  color: "#999",
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
          </Card>

          {/* Real-time Energy Flow */}
          <Card className="head-bar" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase" }}>⚡ Real-Time Energy Flow</span>
              <span style={{ fontSize: 11, color: "#1890ff" }}>⚡ Live API</span>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {/* Produced */}
              <div style={{ border: "2px solid #52c41a", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>☀️ PRODUCED (Solar 30kWH)</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>24.5 <span style={{ fontSize: 14 }}>kWH</span></div>
                <div style={{ width: "100%", height: 4, background: "#f0f0f0", borderRadius: 2, marginTop: 8 }}>
                  <div style={{ width: "82%", height: "100%", background: "#52c41a", borderRadius: 2 }}></div>
                </div>
              </div>
              
              {/* Consumed */}
              <div style={{ border: "2px solid #ff4d4f", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>💡 CONSUMED (Smart Meter)</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>18.2 <span style={{ fontSize: 14 }}>kWH</span></div>
                <div style={{ width: "100%", height: 4, background: "#f0f0f0", borderRadius: 2, marginTop: 8 }}>
                  <div style={{ width: "61%", height: "100%", background: "#ff4d4f", borderRadius: 2 }}></div>
                </div>
              </div>
            </div>

            {/* Net Surplus */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              background: "#f6ffed",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #b7eb8f"
            }}>
              <span style={{ fontSize: 13, color: "#52c41a", fontWeight: 600 }}>✅ Net Surplus: Selling to Grid</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>+6.3 kWH</span>
            </div>
          </Card>

          {/* Market Intelligence */}
          <Card className="head-bar" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase" }}>📊 Market Intelligence</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={{ padding: "4px 12px", fontSize: 11, border: "1px solid #d9d9d9", background: "white", borderRadius: 4, cursor: "pointer" }}>15m</button>
                <button style={{ padding: "4px 12px", fontSize: 11, border: "1px solid #1890ff", background: "#e6f7ff", color: "#1890ff", borderRadius: 4, cursor: "pointer" }}>1H</button>
                <button style={{ padding: "4px 12px", fontSize: 11, border: "1px solid #d9d9d9", background: "white", borderRadius: 4, cursor: "pointer" }}>4H</button>
              </div>
            </div>

            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: "#666" }}>💰 Market Clearing Price (MCP)</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 32, fontWeight: 700 }}>฿3.85</span>
                <span style={{ fontSize: 14, color: "#666" }}>/unit</span>
                <span style={{ 
                  fontSize: 11, 
                  color: "#52c41a",
                  background: "#f6ffed",
                  padding: "2px 6px",
                  borderRadius: 3
                }}>-0.15 (Grid: ฿4.00)</span>
              </div>
            </div>

            {/* Price Chart */}
            <div style={{ position: "relative", height: 120, background: "#f5f7fa", borderRadius: 6, marginTop: 12 }}>
              <div style={{ 
                position: "absolute",
                top: 8,
                right: 8,
                background: "#fff2e8",
                color: "#ff4d4f",
                padding: "2px 8px",
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 600
              }}>⬆ PEAK DEMAND</div>
              <svg width="100%" height="120" style={{ padding: "20px 10px" }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: "#1890ff", stopOpacity: 0.3 }} />
                    <stop offset="100%" style={{ stopColor: "#1890ff", stopOpacity: 0.05 }} />
                  </linearGradient>
                </defs>
                <path d="M 10,60 Q 40,55 60,50 T 100,45 T 140,48 T 180,42 T 220,38 T 260,45 T 300,35" 
                      fill="url(#priceGradient)" stroke="none"/>
                <path d="M 10,60 Q 40,55 60,50 T 100,45 T 140,48 T 180,42 T 220,38 T 260,45 T 300,35" 
                      fill="none" stroke="#1890ff" strokeWidth="2"/>
              </svg>
            </div>
          </Card>

          {/* Order Book */}
          <Card className="head-bar" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>📋 Order Book</div>
            
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f0f0f0", backgroundColor: "#fafafa" }}>
                  <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 11, color: "#333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>PRICE (THB)</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 11, color: "#333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>VOL (kWH)</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 11, color: "#333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: "#ffe7e7", borderBottom: "1px solid #ffccc7", borderLeft: "4px solid #ff4d4f" }}>
                  <td style={{ padding: "12px 8px", color: "#ff4d4f", fontWeight: 700, fontSize: 14 }}>3.92</td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#333", fontWeight: 600 }}>45.0</td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#666", fontWeight: 600 }}>176.4</td>
                </tr>
                <tr style={{ backgroundColor: "#ffd6d6", borderBottom: "1px solid #ffccc7", borderLeft: "4px solid #ff4d4f" }}>
                  <td style={{ padding: "12px 8px", color: "#ff4d4f", fontWeight: 700, fontSize: 14 }}>3.89</td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#333", fontWeight: 600 }}>12.5</td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#666", fontWeight: 600 }}>48.6</td>
                </tr>
                <tr>
                  <td colSpan="3" style={{ textAlign: "center", padding: "14px 8px", fontSize: 12, color: "#666", fontWeight: 700, backgroundColor: "#f5f5f5", borderTop: "2px solid #e0e0e0", borderBottom: "2px solid #e0e0e0" }}>
                    📊 Spread: 0.04 THB
                  </td>
                </tr>
                <tr style={{ backgroundColor: "#d6f5d6", borderBottom: "1px solid #b3e5fc", borderLeft: "4px solid #52c41a" }}>
                  <td style={{ padding: "12px 8px", color: "#52c41a", fontWeight: 700, fontSize: 14 }}>3.85</td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#333", fontWeight: 600 }}>28.0</td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#666", fontWeight: 600 }}>107.8</td>
                </tr>
                <tr style={{ backgroundColor: "#e6f7e6", borderBottom: "1px solid #b3e5fc", borderLeft: "4px solid #52c41a" }}>
                  <td style={{ padding: "12px 8px", color: "#52c41a", fontWeight: 700, fontSize: 14 }}>3.82</td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#333", fontWeight: 600 }}>50.0</td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#666", fontWeight: 600 }}>191.0</td>
                </tr>
                <tr style={{ backgroundColor: "#d6f5d6", borderBottom: "1px solid #b3e5fc", borderLeft: "4px solid #52c41a" }}>
                  <td style={{ padding: "12px 8px", color: "#52c41a", fontWeight: 700, fontSize: 14 }}>3.80</td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#333", fontWeight: 600 }}>100.0</td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#666", fontWeight: 600 }}>380.0</td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Configure Trade Amount */}
          <Card className="head-bar" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>⚙️ Configure Trade Amount</div>
            <Input
              type="number"
              placeholder="Enter amount (kWH)"
              value={energyAmount}
              onChange={(e) => setEnergyAmount(e.target.value)}
              style={{ width: "100%" }}
              size="large"
            />
          </Card>

          {/* Action Buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Button
              type="primary"
              size="large"
              style={{ 
                height: 56, 
                fontSize: 14, 
                fontWeight: 700,
                background: "#ff4d4f",
                borderColor: "#ff4d4f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              onClick={handleSell}
            >
              ⚡ SELL ENERGY
            </Button>
            
            <div style={{ position: "relative" }}>
              <div style={{ 
                position: "absolute",
                top: -8,
                right: -8,
                background: "#fadb14",
                color: "#000",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                zIndex: 1
              }}>Best Price</div>
              <Button
                type="primary"
                size="large"
                style={{ 
                  width: "100%",
                  height: 56, 
                  fontSize: 14, 
                  fontWeight: 700,
                  background: "#52c41a",
                  borderColor: "#52c41a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                onClick={handleBuy}
              >
                🛒 BUY ENERGY
              </Button>
            </div>
          </div>

          {/* Blockchain Security */}
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#999" }}>
            🔒 Secured by Ethereum Blockchain
          </div>
        </Space>
      </div>
    );
  };

  return (
    <div className="home-div maplayout" style={{ maxWidth: "100%" }}>
      <style>{`
        .maplayout {
          position: relative;
          height: 100vh;
          overflow: hidden;
        }
        
        .maplayout .left-div {
          height: 100vh;
          overflow: hidden;
          width: calc(100vw - 400px);
          position: relative;
        }
        
        .maplayout .right-div {
          position: absolute;
          width: 400px;
          height: 100vh;
          margin-left: calc(100vw - 400px);
          margin-top: 0;
          overflow-x: hidden;
          overflow-y: auto;
          padding: 10px;
          z-index: 100;
          background: white;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        .maplayout .right-div::-webkit-scrollbar {
          display: none;
        }
        
        .map-bar {
          --ratiobtn: calc(0.09569vh - 0.16555px);
          margin-left: calc(50vw - 200px - var(--ratiobtn) * 1920 / 2);
          position: relative;
          width: auto;
          height: 100%;
        }
        
        .maplayout.wide .map-bar {
          --ratiobtn: calc(0.05208vw - 0.20833px);
          margin-top: calc(50vh - var(--ratiobtn) * 1045 / 2);
          margin-left: 0;
        }
        
        .mapimg {
          position: absolute;
          height: 100vh;
          width: auto;
          object-fit: cover;
          top: 0;
          left: 0;
        }
        
        .maplayout.wide .mapimg {
          height: auto;
          width: calc(100vw - 400px);
        }

        .img0 {
          opacity: 1;
          z-index: 1;
          display: block;
        }
        
        .img1, .img2, .img3, .img4, .img5, .img6,
        .img7, .img8, .img9, .img10, .img11 {
          display: none;
          z-index: 2;
        }
        
        .maplayout .btn1:hover ~ .img1, .maplayout .btn1.active ~ .img1,
        .maplayout .btn2:hover ~ .img2, .maplayout .btn2.active ~ .img2,
        .maplayout .btn3:hover ~ .img3, .maplayout .btn3.active ~ .img3,
        .maplayout .btn4:hover ~ .img4, .maplayout .btn4.active ~ .img4,
        .maplayout .btn5:hover ~ .img5, .maplayout .btn5.active ~ .img5,
        .maplayout .btn6:hover ~ .img6, .maplayout .btn6.active ~ .img6,
        .maplayout .btn7:hover ~ .img7, .maplayout .btn7.active ~ .img7,
        .maplayout .btn8:hover ~ .img8, .maplayout .btn8.active ~ .img8,
        .maplayout .btn9:hover ~ .img9, .maplayout .btn9.active ~ .img9,
        .maplayout .btn10:hover ~ .img10, .maplayout .btn10.active ~ .img10,
        .maplayout .btn11:hover ~ .img11, .maplayout .btn11.active ~ .img11 {
          display: block;
          z-index: 80;
        }
        
        .maplayout .bbtn:hover ~ .img0,
        .maplayout .bbtn.active ~ .img0 {
          display: none;
        }
        
        .bbtn, .bgbtn {
          position: absolute;
          cursor: pointer;
          z-index: 90;
          background-color: transparent;
          border: none;
        }
        
        .btn0 { height: calc(var(--ratiobtn) * 1045); margin-left: calc(var(--ratiobtn) * 0); margin-top: calc(var(--ratiobtn) * 0); width: calc(var(--ratiobtn) * 1920); }
        .btn1 { height: calc(var(--ratiobtn) * 145); margin-left: calc(var(--ratiobtn) * 1163); margin-top: calc(var(--ratiobtn) * 552); width: calc(var(--ratiobtn) * 241); }
        .btn2 { height: calc(var(--ratiobtn) * 140); margin-left: calc(var(--ratiobtn) * 448); margin-top: calc(var(--ratiobtn) * 159); width: calc(var(--ratiobtn) * 195); }
        .btn3 { height: calc(var(--ratiobtn) * 91); margin-left: calc(var(--ratiobtn) * 609); margin-top: calc(var(--ratiobtn) * 458); width: calc(var(--ratiobtn) * 106); }
        .btn4 { height: calc(var(--ratiobtn) * 121); margin-left: calc(var(--ratiobtn) * 509); margin-top: calc(var(--ratiobtn) * 322); width: calc(var(--ratiobtn) * 174); }
        .btn5 { height: calc(var(--ratiobtn) * 220); margin-left: calc(var(--ratiobtn) * 931); margin-top: calc(var(--ratiobtn) * 551); width: calc(var(--ratiobtn) * 172); }
        .btn6 { height: calc(var(--ratiobtn) * 301); margin-left: calc(var(--ratiobtn) * 889); margin-top: calc(var(--ratiobtn) * 252); width: calc(var(--ratiobtn) * 194); }
        .btn7 { height: calc(var(--ratiobtn) * 113); margin-left: calc(var(--ratiobtn) * 438); margin-top: calc(var(--ratiobtn) * 269); width: calc(var(--ratiobtn) * 89); }
        .btn8 { height: calc(var(--ratiobtn) * 188); margin-left: calc(var(--ratiobtn) * 675); margin-top: calc(var(--ratiobtn) * 512); width: calc(var(--ratiobtn) * 224); }
        .btn9 { height: calc(var(--ratiobtn) * 174); margin-left: calc(var(--ratiobtn) * 1081); margin-top: calc(var(--ratiobtn) * 682); width: calc(var(--ratiobtn) * 309); }
        .btn10 { height: calc(var(--ratiobtn) * 96); margin-left: calc(var(--ratiobtn) * 1419); margin-top: calc(var(--ratiobtn) * 660); width: calc(var(--ratiobtn) * 145); }
        .btn11 { height: calc(var(--ratiobtn) * 237); margin-left: calc(var(--ratiobtn) * 703); margin-top: calc(var(--ratiobtn) * 287); width: calc(var(--ratiobtn) * 186); }
        
        .currentTooltip {
          position: absolute;
          z-index: 95;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 14px;
          pointer-events: none;
        }
      `}</style>
      
      {showPanel && selectedBuilding && (
        <div className="right-div">
          <TradingPanel />
        </div>
      )}
      
      <div className="left-div">
        <div className="map-bar">
            {/* Header Components - 3 Position Layout */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              display: 'flex',
              gap: '85px',
              zIndex: 100,
              alignItems: 'center',
              // justifyContent: 'space-between'
            }}>
              {/* LEFT: NIDA SMART GRID Box with Location */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(12px)',
                borderRadius: '12px',
                padding: '12px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '1px solid rgba(255,255,255,0.6)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  boxShadow: '0 2px 8px rgba(24,144,255,0.3)',
                  flexShrink: 0
                }}>
                  ⚡
                </div>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#000', letterSpacing: '-0.3px', lineHeight: '1.2', marginBottom: '4px' }}>
                    NIDA SMART GRID
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#ff4d4f' }}>📍</span>
                    <span>Bang Kapi District</span>
                    <span style={{ color: '#d9d9d9', margin: '0 2px' }}>{'>'}</span>
                    <span>Main Campus View</span>
                  </div>
                </div>
              </div>

              {/* MIDDLE: Metrics Group */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* NET GRID LOAD Box */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '9px', color: '#999', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px' }}>NET GRID LOAD</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#000', lineHeight: '1' }}>4.2 <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>MW</span></div>
                  <div style={{ fontSize: '10px', color: '#52c41a', fontWeight: 600, marginTop: '2px' }}>↓ 2.4%</div>
                </div>

                {/* SOLAR GEN Box */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '9px', color: '#999', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px' }}>SOLAR GEN</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#000', lineHeight: '1' }}>850 <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>kW</span></div>
                  <div style={{ fontSize: '10px', color: '#666', fontWeight: 600, marginTop: '2px' }}>Peak Efficiency</div>
                </div>

                {/* TOKEN PRICE Box */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '9px', color: '#999', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px' }}>TOKEN PRICE</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#000', lineHeight: '1' }}>฿3.85</div>
                  <div style={{ fontSize: '10px', color: '#52c41a', fontWeight: 600, marginTop: '2px' }}>+0.12 (24h)</div>
                </div>
              </div>
              {/* RIGHT: Admin Profile Box */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(12px)',
                borderRadius: '12px',
                padding: '12px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '1px solid rgba(255,255,255,0.6)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#000', lineHeight: '1.2' }}>Executive Admin</div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Dr. Udon, Jee</div>
                </div>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'white',
                  border: '3px solid #fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  flexShrink: 0
                }}>
                  UJ
                </div>
                <button style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  color: '#999',
                  cursor: 'pointer',
                  padding: '6px',
                  transition: 'color 0.2s',
                  flexShrink: 0
                }}>
                  ⚙️
                </button>
                <button style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  color: '#faad14',
                  cursor: 'pointer',
                  padding: '6px',
                  transition: 'color 0.2s',
                  flexShrink: 0
                }}>
                  🔔
                </button>
              </div>
            </div>

            <div className="bgbtn btn0" bid="0" onClick={buildOn}></div>
            <div className="bbtn btn1" bid="1" title="Auditorium" onClick={buildOn}></div>
            <div className="bbtn btn2" bid="2" title="Bunchana" onClick={buildOn}></div>
            <div className="bbtn btn3" bid="3" title="Chup" onClick={buildOn}></div>
            <div className="bbtn btn4" bid="4" title="Malai" onClick={buildOn}></div>
            <div className="bbtn btn5" bid="5" title="Narathip" onClick={buildOn}></div>
            <div className="bbtn btn6" bid="6" title="Navamin" onClick={buildOn}></div>
            <div className="bbtn btn7" bid="7" title="Nida House" onClick={buildOn}></div>
            <div className="bbtn btn8" bid="8" title="Nida Sumpan" onClick={buildOn}></div>
            <div className="bbtn btn9" bid="9" title="Ratchaphruek" onClick={buildOn}></div>
            <div className="bbtn btn10" bid="10" title="Serithai" onClick={buildOn}></div>
            <div className="bbtn btn11" bid="11" title="Siam" onClick={buildOn}></div>
            <div className="currentTooltip">TOOLTIP</div>
            <img className="img0 mapimg" src="/assets/img/bg.jpg" alt="" />
            <img className="img1 mapimg" src="/assets/img/b_auditorium.jpg" alt="Auditorium building" />
            <img className="img2 mapimg" src="/assets/img/b_bunchana.jpg" alt="Bunchana building" />
            <img className="img3 mapimg" src="/assets/img/b_chup.jpg" alt="Chup building" />
            <img className="img4 mapimg" src="/assets/img/b_malai.jpg" alt="Malai building" />
            <img className="img5 mapimg" src="/assets/img/b_narathip.jpg" alt="Narathip building" />
            <img className="img6 mapimg" src="/assets/img/b_navamin.jpg" alt="Navamin building" />
            <img className="img7 mapimg" src="/assets/img/b_nidahouse.jpg" alt="Nida House building" />
            <img className="img8 mapimg" src="/assets/img/b_nidasumpan.jpg" alt="Nida Sumpan building" />
            <img className="img9 mapimg" src="/assets/img/b_ratchaphruek.jpg" alt="Ratchaphruek building" />
            <img className="img10 mapimg" src="/assets/img/b_serithai.jpg" alt="Serithai building" />
            <img className="img11 mapimg" src="/assets/img/b_siam.jpg" alt="Siam building" />
        </div>
      </div>
    </div>
  );
}