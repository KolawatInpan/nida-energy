import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Card, Space, Button, Input, Select } from "antd";
import { useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { createOffer } from '../../core/data_connecter/api_caller';
import { EnergySellingPanel } from '../../components/shared';
import { getBuildings, getMetersByBuilding } from '../../core/data_connecter/register';
import { getEnergyRates } from '../../core/data_connecter/rate';
import { getWalletByEmail } from '../../core/data_connecter/wallet';
import { useTOR } from '../../global/TORContext';
import { TradingOverlay } from './components';
import Key from '../../global/key';

export default function EnergySelling() {
    const [bid, setBID] = useState(0);
    const [selectedBuilding, setSelectedBuilding] = useState(null);
    const [realBuildings, setRealBuildings] = useState([]);
    const [destinationBuildings, setDestinationBuildings] = useState([]);
    const [energyAmount, setEnergyAmount] = useState('');
    const [energyRate, setEnergyRate] = useState('');
    const [sellSource, setSellSource] = useState('produce');
    const [showPanel, setShowPanel] = useState(false);
    const [targetBuildingForPurchase, setTargetBuildingForPurchase] = useState(null);
    const [sourceEnergyStatus, setSourceEnergyStatus] = useState(null);
    const [marketSnapshot, setMarketSnapshot] = useState(null);
    const [overviewStats, setOverviewStats] = useState({
      netGridLoad: 0,
      solarGeneration: 0,
      marketPrice: 0,
      gridDelta: 0,
      availableBuildings: [],
      totalBuildings: 0,
    });
    const history = useHistory();
    const { showTOR } = useTOR();
    const memberStore = useSelector((store) => store.member.all);
    const apiBase = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');

    const toNumber = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const parsed = Number(String(value).replace(/,/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const amountNum = toNumber(energyAmount);
    const rateNum = toNumber(energyRate);
    const totalToken = amountNum * rateNum;
    const member = useMemo(() => {
      if (Array.isArray(memberStore) && memberStore.length > 0) return memberStore[0];
      if (memberStore && typeof memberStore === 'object') return memberStore;
      return null;
    }, [memberStore]);

    const normalizeRoleName = (value) => String(value || '').trim().toUpperCase();
    const memberRoleName = normalizeRoleName(member?.role || member?.userRole || localStorage.getItem(Key.UserRole));
    const isAdmin = memberRoleName === 'ADMIN';
    const memberEmail = String(member?.email || localStorage.getItem(Key.UserEmail) || '').trim().toLowerCase();

    const isOwnedByCurrentUser = (building) => {
      if (isAdmin) return true;
      const candidateEmails = [
        building?.email,
        building?.contact,
        building?.contactEmail,
        building?.ownerEmail,
      ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);

      return Boolean(memberEmail) && candidateEmails.includes(memberEmail);
    };

    const selectedBuildingOwnedByUser = useMemo(
      () => isOwnedByCurrentUser(selectedBuilding),
      [selectedBuilding, isAdmin, memberEmail]
    );

    const availableBuildingNames = useMemo(
      () => overviewStats.availableBuildings.map((building) => String(building?.name || '')).filter(Boolean),
      [overviewStats.availableBuildings]
    );
    const ownedBuildingNames = useMemo(
      () => overviewStats.availableBuildings
        .filter((building) => isOwnedByCurrentUser(building))
        .map((building) => String(building?.name || ''))
        .filter(Boolean),
      [overviewStats.availableBuildings, isAdmin, memberEmail]
    );

    const classifyMeterType = (meter = {}) => {
      const rawType = String(meter.type || meter.meterType || '').toLowerCase();
      const rawName = String(meter.meterName || meter.name || '').toLowerCase();
      const fingerprint = `${rawType} ${rawName}`;

      if (fingerprint.includes('battery')) return 'battery';
      if (fingerprint.includes('produce') || fingerprint.includes('producer') || fingerprint.includes('solar') || fingerprint.includes('pv')) return 'produce';
      if (fingerprint.includes('consume') || fingerprint.includes('consumer') || fingerprint.includes('smart meter') || fingerprint.includes('load')) return 'consume';
      return 'other';
    };

    const getMeterCurrentKwh = (meter = {}) => {
      const candidates = [meter.value, meter.kWH, meter.kwh, meter.currentkWH, meter.currentKwh];
      const found = candidates.find((value) => value !== null && value !== undefined && value !== '');
      return toNumber(found);
    };

    const getMeterCapacityKwh = (meter = {}) => {
      const candidates = [meter.capacity, meter.capacitykWH, meter.capacityKwh];
      const found = candidates.find((value) => value !== null && value !== undefined && value !== '');
      return toNumber(found);
    };

    const getLatestRatePrice = (rows = [], fallback = 0) => {
      if (!Array.isArray(rows) || rows.length === 0) return toNumber(fallback);
      const sorted = [...rows].sort((a, b) => new Date(b?.effectiveStart || 0) - new Date(a?.effectiveStart || 0));
      const latest = sorted[0];
      return toNumber(latest?.price ?? latest?.bahtPerKwh ?? latest?.value ?? fallback);
    };

    const buildMarketSnapshot = ({ meters = [], offers = [], energyRates = [] }) => {
      const produceMeters = meters.filter((meter) => classifyMeterType(meter) === 'produce');
      const consumeMeters = meters.filter((meter) => classifyMeterType(meter) === 'consume');
      const batteryMeter = meters.find((meter) => classifyMeterType(meter) === 'battery');

      const producedKwh = produceMeters.reduce((sum, meter) => sum + getMeterCurrentKwh(meter), 0);
      const consumedKwh = consumeMeters.reduce((sum, meter) => sum + getMeterCurrentKwh(meter), 0);
      const batteryCurrentKwh = batteryMeter ? getMeterCurrentKwh(batteryMeter) : 0;
      const batteryCapacityKwh = batteryMeter ? getMeterCapacityKwh(batteryMeter) : 0;
      const netKwh = Number((producedKwh - consumedKwh).toFixed(4));

      const availableOffers = offers
        .map((offer) => {
          const totalKwh = toNumber(offer.kWH ?? offer.kwh);
          const soldKwh = toNumber(offer.kWHSold ?? offer.kwhSold);
          const remainingKwh = Math.max(0, totalKwh - soldKwh);
          const ratePerKwh = toNumber(offer.ratePerkWH ?? offer.ratePerKwh ?? offer.ratePerkwh);
          return {
            ...offer,
            remainingKwh,
            ratePerKwh,
            totalPrice: Number((remainingKwh * ratePerKwh).toFixed(2))
          };
        })
        .filter((offer) => String(offer.status || '').toUpperCase() === 'AVAILABLE' && offer.remainingKwh > 0);

      const buySide = [...availableOffers]
        .sort((a, b) => b.ratePerKwh - a.ratePerKwh)
        .slice(0, 2)
        .map((offer) => ({ side: 'buy', ...offer }));

      const sellSide = [...availableOffers]
        .sort((a, b) => a.ratePerKwh - b.ratePerKwh)
        .slice(0, 3)
        .map((offer) => ({ side: 'sell', ...offer }));

      const orderBook = [...buySide, ...sellSide];
      const topBid = buySide[0]?.ratePerKwh || 0;
      const topAsk = sellSide[0]?.ratePerKwh || 0;
      const weightedOfferRate = availableOffers.length
        ? availableOffers.reduce((sum, offer) => sum + (offer.ratePerKwh * offer.remainingKwh), 0)
          / Math.max(availableOffers.reduce((sum, offer) => sum + offer.remainingKwh, 0), 1)
        : 0;
      const gridPrice = getLatestRatePrice(energyRates, 4);
      const marketPrice = Number((topAsk || topBid || weightedOfferRate || gridPrice).toFixed(2));
      const spread = topBid && topAsk ? Math.max(0, topAsk - topBid) : 0;
      const demandLabel = consumedKwh > producedKwh * 1.1
        ? 'PEAK GRID DEMAND'
        : producedKwh > consumedKwh
          ? 'SOLAR SURPLUS'
          : 'BALANCED LOAD';

      return {
        producedKwh,
        consumedKwh,
        netKwh,
        batteryCurrentKwh,
        batteryCapacityKwh,
        marketPrice,
        gridPrice,
        priceDelta: Number((marketPrice - gridPrice).toFixed(2)),
        spread,
        demandLabel,
        orderBook
      };
    };

    useEffect(() => {
        let mounted = true;

        const loadBuildings = async () => {
            try {
                const response = await getBuildings();
                const items = Array.isArray(response) ? response : (response?.data || response?.buildings || []);
                if (mounted) setRealBuildings(items);
            } catch (error) {
                console.error('Error loading buildings for energy selling:', error);
                if (mounted) setRealBuildings([]);
            }
        };

        loadBuildings();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadOverviewStats = async () => {
            try {
                const activeBuildings = realBuildings.filter((building) => String(building?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE');
                const [energyRatesRes, offersRes, meterGroups] = await Promise.all([
                    getEnergyRates().catch(() => []),
                    axios.get(`${apiBase}/offers`).then((res) => res.data).catch(() => []),
                    Promise.all(activeBuildings.map((building) => getMetersByBuilding(building.id).catch(() => []))),
                ]);

                const energyRates = Array.isArray(energyRatesRes) ? energyRatesRes : (energyRatesRes?.data || []);
                const offers = Array.isArray(offersRes) ? offersRes : (offersRes?.data || offersRes?.offers || []);
                const allMeters = meterGroups.flatMap((entry) => Array.isArray(entry) ? entry : (entry?.data || []));
                const produceMeters = allMeters.filter((meter) => classifyMeterType(meter) === 'produce');
                const consumeMeters = allMeters.filter((meter) => classifyMeterType(meter) === 'consume');
                const solarGeneration = produceMeters.reduce((sum, meter) => sum + getMeterCurrentKwh(meter), 0);
                const totalConsumption = consumeMeters.reduce((sum, meter) => sum + getMeterCurrentKwh(meter), 0);
                const netGridLoad = Math.max(0, totalConsumption - solarGeneration);
                const availableOffers = offers.filter((offer) => String(offer?.status || '').toUpperCase() === 'AVAILABLE');
                const gridRate = getLatestRatePrice(energyRates, 4);
                const offerRateRows = availableOffers.map((offer) => toNumber(offer?.ratePerkWH ?? offer?.ratePerKwh ?? offer?.rate));
                const marketRate = offerRateRows.find((value) => value > 0) || gridRate;

                if (!mounted) return;
                setOverviewStats({
                  netGridLoad,
                  solarGeneration,
                  marketPrice: marketRate,
                  gridDelta: marketRate - gridRate,
                  availableBuildings: activeBuildings,
                  totalBuildings: activeBuildings.length,
                });
            } catch (error) {
                console.error('Error loading 3D smart grid overview stats:', error);
            }
        };

        if (realBuildings.length) {
          loadOverviewStats();
        }

        return () => { mounted = false; };
    }, [apiBase, realBuildings]);

    const openBuildingPanel = async (realBuilding, nextBid = 0) => {
        if (!realBuilding) {
            setBID(0);
            setSelectedBuilding(null);
            setShowPanel(false);
            setEnergyAmount('');
            setEnergyRate('');
            setSellSource('produce');
            setTargetBuildingForPurchase(null);
            setSourceEnergyStatus(null);
            setMarketSnapshot(null);
            return;
        }

        setBID(nextBid);
        const selected = {
            ...realBuilding,
            id: realBuilding.id,
            name: realBuilding.name,
            location: realBuilding.province || realBuilding.address || 'Unknown location',
        };
        setSelectedBuilding(selected);
        setShowPanel(true);
        setEnergyRate('');
        setTargetBuildingForPurchase(null);

        try {
            const [metersRes, offersRes, energyRatesRes] = await Promise.all([
                getMetersByBuilding(realBuilding.id),
                axios.get(`${apiBase}/offers`).then((res) => res.data).catch(() => []),
                getEnergyRates().catch(() => [])
            ]);
            const meters = Array.isArray(metersRes) ? metersRes : (metersRes?.data || []);
            const offers = Array.isArray(offersRes) ? offersRes : (offersRes?.data || offersRes?.offers || []);
            const energyRates = Array.isArray(energyRatesRes) ? energyRatesRes : (energyRatesRes?.data || energyRatesRes?.rates || []);
            const producerMeter = meters.find((m) => {
                const meterType = (m.type || '').toLowerCase();
                return meterType.includes('produce') || meterType === 'produce';
            });
            const batteryMeter = meters.find((m) => {
                const meterType = (m.type || '').toLowerCase();
                return meterType.includes('battery');
            });

            const buildMeterStatus = (meter) => {
                if (!meter) return { current: 0, capacity: 0, percentage: '0.00', available: false };
                const current = Number(meter.value || meter.kwh || meter.kWH || 0);
                const capacity = Number(meter.capacity || 0);
                const percentage = capacity > 0 ? (current / capacity * 100) : 0;
                return {
                    current,
                    capacity,
                    percentage: percentage.toFixed(2),
                    available: current > 0,
                };
            };

            const produceStatus = buildMeterStatus(producerMeter);
            const batteryStatus = buildMeterStatus(batteryMeter);
            setSourceEnergyStatus({
                produce: produceStatus,
                battery: batteryStatus,
            });
            setSellSource(produceStatus.available ? 'produce' : batteryStatus.available ? 'battery' : 'produce');
            setMarketSnapshot(buildMarketSnapshot({ meters, offers, energyRates }));
        } catch (err) {
            console.error('Error fetching producer meter status:', err);
            setSourceEnergyStatus({
                produce: { current: 0, capacity: 0, percentage: '0.00', available: false },
                battery: { current: 0, capacity: 0, percentage: '0.00', available: false },
            });
            setMarketSnapshot(null);
        }
    };

    const triggerBuildingByName = async (name) => {
      const button = document.querySelector(`.bbtn[title="${name}"]`);
      if (button) {
        await buildOn({ currentTarget: button });
        return;
      }

      const realBuilding = realBuildings.find((item) => String(item?.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase());
      if (realBuilding) {
        await openBuildingPanel(realBuilding, 0);
      }
    };

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
    }, [bid]);

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


    const buildOn = async (e) => {
        const newbid = parseInt(e.currentTarget.getAttribute('bid'));
        const buildingName = String(e.currentTarget.getAttribute('title') || '').trim();
        const realBuilding = realBuildings.find((item) => String(item?.name || '').toLowerCase() === buildingName.toLowerCase());
        
        if (newbid === 0) {
            // Reset to overview
            setBID(0);
            setSelectedBuilding(null);
            setShowPanel(false);
            setEnergyAmount('');
            setEnergyRate('');
            setSellSource('produce');
            setTargetBuildingForPurchase(null);
            setSourceEnergyStatus(null);
            setMarketSnapshot(null);
        } else if (realBuilding) {
            await openBuildingPanel(realBuilding, newbid);
        } else {
            setBID(0);
            setSelectedBuilding(null);
            setShowPanel(false);
            setEnergyAmount('');
            setEnergyRate('');
            setTargetBuildingForPurchase(null);
            setSourceEnergyStatus(null);
            setMarketSnapshot(null);
        }
    };

    const handleBuy = () => {
        if (!energyAmount) {
            alert('Please enter energy amount');
            return;
        }
        if (!targetBuildingForPurchase) {
            alert('Please select a destination building');
            return;
        }
        const targetBuildingName = destinationBuildings.find(b => Number(b.id) === Number(targetBuildingForPurchase))?.name || 'Unknown';
        alert(`📥 Purchasing ${energyAmount} kWH from ${selectedBuilding.name}\n➡️ Sending to: ${targetBuildingName}\n💰 Price: ฿${energyRate}/unit`);
        // TODO: Add API call to backend for purchase transaction
        // reset form
        setTargetBuildingForPurchase(null);
        setEnergyAmount('');
        setEnergyRate('');
    };

    const handleClosePanel = () => {
      setBID(0);
      setShowPanel(false);
      setSelectedBuilding(null);
      setEnergyAmount('');
      setEnergyRate('');
      setSellSource('produce');
      setTargetBuildingForPurchase(null);
      setSourceEnergyStatus(null);
      setMarketSnapshot(null);
    };

    const handleSell = async () => {
      if (!selectedBuildingOwnedByUser) {
            alert('⚠️ You can only post sell offers for the building linked to your contact email.');
            return;
        }

      const selectedSourceStatus = sourceEnergyStatus?.[sellSource] || { current: 0, available: false };
      const selectedSourceLabel = sellSource === 'battery' ? 'battery' : 'produce meter';

      const amount = toNumber(energyAmount);
      const rate = toNumber(energyRate);

      if (!amount || amount <= 0) {
            alert('Please enter energy amount');
            return;
        }
      if (!rate || rate <= 0) {
            alert('Please enter energy rate');
            return;
        }
      if (sourceEnergyStatus && amount > selectedSourceStatus.current) {
            alert(`⚠️ Cannot sell more energy than available in ${selectedSourceLabel}.\nAvailable: ${Math.round(selectedSourceStatus.current)} kWh\nRequested: ${energyAmount} kWh`);
            return;
        }
        if (sourceEnergyStatus && !selectedSourceStatus.available) {
            alert(`⚠️ No energy available to sell from the ${selectedSourceLabel}.`);
            return;
        }
        
        try {
            // Get the real building and wallet ID
            const buildingsRes = await getBuildings();
            const buildings = Array.isArray(buildingsRes) ? buildingsRes : (buildingsRes?.data || buildingsRes?.buildings || []);
            const realBuilding = buildings.find(b => b.name && b.name.toLowerCase().includes(selectedBuilding.name.toLowerCase()));
            
            if (!realBuilding) {
                alert('⚠️ Building not found. Please select a valid building.');
                return;
            }
            if (!isOwnedByCurrentUser(realBuilding)) {
                alert('⚠️ You can only post sell offers for the building linked to your contact email.');
                return;
            }
            
            // Get wallet by building email
            const walletRes = await getWalletByEmail(realBuilding.email);
            const sellerWalletId = walletRes?.data?.id ? String(walletRes.data.id) : '';
            
            if (!sellerWalletId) {
                alert('⚠️ Wallet not found for this building. Please contact administrator.');
                return;
            }
            
            const offer = {
                sellerWalletId,
              kwh: amount,
              ratePerKwh: rate,
              sourceType: sellSource,
            };
            
            console.log('Creating offer:', offer);
            
            const res = await createOffer(offer);
            if (res && res.status === 201) {
                console.log('Offer created successfully:', res.data);
              alert(`✅ Successfully listed ${amount} kWh at ${rate.toFixed(2)} Token/kWh from ${realBuilding.name}\n🔋 Source: ${sellSource === 'battery' ? 'Battery' : 'Produce meter'}\n💰 Total Listing Amount: ${(amount * rate).toFixed(2)} Tokens`);
                // Reset form
                setBID(0);
                setShowPanel(false);
                setSelectedBuilding(null);
                setEnergyAmount('');
                setEnergyRate('');
                setSellSource('produce');
                setTargetBuildingForPurchase(null);
                setSourceEnergyStatus(null);
                // Redirect to market
                history.push('/market');
            } else {
                console.error('Offer creation failed:', res);
                alert(`Failed to create offer: ${res?.response?.data?.error || res?.message || 'Please try again.'}`);
            }
        } catch (err) {
            console.error('Error creating offer:', err);
            alert('Error creating offer: ' + (err.response?.data?.error || err.message));
        }
    };

  // Render panel inline to avoid remounting (which can reset scroll position)
  const renderTradingPanel = () => {
    const handleClose = () => {
      setBID(0);
      setShowPanel(false);
      setSelectedBuilding(null);
            setEnergyAmount('');
            setEnergyRate('');
            setSellSource('produce');
            setTargetBuildingForPurchase(null);
            setSourceEnergyStatus(null);
            setMarketSnapshot(null);
    };

    const producedKwh = Number(marketSnapshot?.producedKwh || 0);
    const consumedKwh = Number(marketSnapshot?.consumedKwh || 0);
    const netKwh = Number(marketSnapshot?.netKwh || 0);
    const marketPrice = Number(marketSnapshot?.marketPrice || selectedBuilding?.price || 0);
    const gridPrice = Number(marketSnapshot?.gridPrice || 4);
    const priceDelta = Number(marketSnapshot?.priceDelta || 0);
    const spread = Number(marketSnapshot?.spread || 0);
    const orderBookRows = Array.isArray(marketSnapshot?.orderBook) ? marketSnapshot.orderBook : [];
    const producedRatio = Math.min(100, Math.max(0, sourceEnergyStatus?.capacity ? (producedKwh / Math.max(sourceEnergyStatus.capacity, producedKwh, 1)) * 100 : producedKwh > 0 ? 100 : 0));
    const consumedRatio = Math.min(100, Math.max(0, producedKwh > 0 ? (consumedKwh / producedKwh) * 100 : consumedKwh > 0 ? 100 : 0));
    const netLabel = netKwh >= 0 ? 'Net Surplus: Selling to Grid' : 'Net Deficit: Buying from Grid';
    const netColor = netKwh >= 0 ? '#52c41a' : '#ff4d4f';
    const netBg = netKwh >= 0 ? '#f6ffed' : '#fff1f0';
    const netBorder = netKwh >= 0 ? '#b7eb8f' : '#ffa39e';
    const deltaLabel = `${priceDelta >= 0 ? '+' : ''}${priceDelta.toFixed(2)} (Grid: ฿${gridPrice.toFixed(2)})`;

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

          {/* Battery Status Display */}
          {sourceEnergyStatus && (
            <Card className="head-bar" style={{ marginBottom: 8, backgroundColor: sourceEnergyStatus.available ? '#f6ffed' : '#fff2e8', borderColor: sourceEnergyStatus.available ? '#b7eb8f' : '#ffbb96' }}>
              <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", marginBottom: 12, color: '#333' }}>☀️ Producer Meter Status</div>
              
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Current Storage:</span>
                  <span style={{ fontSize: 14, color: '#333', fontWeight: 700 }}>{Math.round(sourceEnergyStatus.current)} kWh</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Capacity:</span>
                  <span style={{ fontSize: 14, color: '#333', fontWeight: 700 }}>{Math.round(sourceEnergyStatus.capacity)} kWh</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Battery Level:</span>
                  <span style={{ fontSize: 16, color: sourceEnergyStatus.percentage > 50 ? '#52c41a' : sourceEnergyStatus.percentage > 20 ? '#faad14' : '#ff4d4f', fontWeight: 700 }}>{sourceEnergyStatus.percentage}%</span>
                </div>
                
                {/* Progress bar */}
                <div style={{ width: '100%', height: 24, backgroundColor: '#f0f0f0', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ 
                    width: `${Math.min(100, sourceEnergyStatus.percentage)}%`, 
                    height: '100%',
                    backgroundColor: sourceEnergyStatus.percentage > 50 ? '#52c41a' : sourceEnergyStatus.percentage > 20 ? '#faad14' : '#ff4d4f',
                    transition: 'width 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                  <span style={{ fontSize: 11, color: 'white', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{sourceEnergyStatus.percentage}%</span>
                  </div>
                </div>
              </div>
              
              {!sourceEnergyStatus.available && (
                <div style={{ padding: 10, backgroundColor: '#fff1f0', borderRadius: 6, borderLeft: '4px solid #ff4d4f' }}>
                  <span style={{ fontSize: 12, color: '#cf1322', fontWeight: 600 }}>⚠️ No energy available to sell from the producer meter.</span>
                </div>
              )}
            </Card>
          )}

          {/* Configure Trade Amount */}
          <Card className="head-bar" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>⚙️ Configure Trade Amount</div>
            
            {/* Energy Amount Input */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Energy Amount (kWh)</div>
              <Input
                type="number"
                placeholder="Enter amount (kWH)"
                value={energyAmount}
                onChange={(e) => setEnergyAmount(e.target.value)}
                style={{ width: "100%" }}
                size="large"
                min={0}
                max={sourceEnergyStatus ? sourceEnergyStatus.current : undefined}
                suffix="kWh"
              />
              {sourceEnergyStatus && energyAmount && Number(energyAmount) > sourceEnergyStatus.current && (
                <div style={{ 
                  color: '#ff4d4f', 
                  fontSize: 11, 
                  marginTop: 6, 
                  padding: 8,
                  backgroundColor: '#fff2f0',
                  borderRadius: 4,
                  borderLeft: '3px solid #ff4d4f'
                }}>
                  ⚠️ Cannot sell more than available: {Math.round(sourceEnergyStatus.current)} kWh
              </div>
            )}
            </div>

            {/* Energy Rate Input */}
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Price Per Unit</div>
              <Input
                type="number"
                placeholder="Enter rate (Token/kWh)"
                value={energyRate}
                onChange={(e) => setEnergyRate(e.target.value)}
                style={{ width: "100%" }}
                size="large"
                min={0}
                step="0.01"
                suffix="Token/kWh"
              />
              {amountNum > 0 && rateNum > 0 && (
                <div style={{ fontSize: 11, color: '#52c41a', marginTop: 6, fontWeight: 600 }}>
                  💰 Total: {totalToken.toFixed(2)} Tokens
                </div>
              )}
            </div>
          </Card>

          {/* To Building Selection (for purchase) */}
          {bid > 0 && (
            <Card className="head-bar" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>🏢 To Building (Purchase Destination)</div>
              <Select
                placeholder="Select destination building"
                value={targetBuildingForPurchase}
                onChange={(value) => setTargetBuildingForPurchase(value)}
                style={{ width: "100%" }}
                size="large"
                optionLabelProp="label"
              >
                {destinationBuildings
                  .filter((building) => Number(building.id) !== Number(selectedBuilding?.id))
                  .map((building) => (
                    <Select.Option key={building.id} value={building.id}>
                      <span>{building.name}</span>
                      <span style={{ color: '#999', marginLeft: 8 }}>({building.meterName || building.snid || 'Battery-enabled'})</span>
                    </Select.Option>
                  ))}
              </Select>
            </Card>
          )}

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
          --panel-width: 360px;
          --panel-gap: 16px;
          position: relative;
          height: 100vh;
          overflow: hidden;
        }
        
        .maplayout .left-div {
          height: 100vh;
          overflow: hidden;
          width: calc(100% - var(--panel-width) - var(--panel-gap)) !important;
          position: relative;
        }
        
        .maplayout .right-div {
          position: absolute;
          top: 0;
          right: var(--panel-gap) !important;
          width: var(--panel-width);
          height: 100vh;
          margin-left: 0 !important;
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
          --ratiobtn: max(calc(100vh / 1045), calc((100% - var(--panel-width) - var(--panel-gap)) / 1920));
          margin-left: 0;
          position: relative;
          width: auto;
          height: 100%;
        }
        
        .maplayout.wide .map-bar {
          --ratiobtn: max(calc(100vh / 1045), calc((100% - var(--panel-width) - var(--panel-gap)) / 1920));
          margin-top: 0;
          margin-left: 0 !important;
        }
        
        .mapimg {
          position: absolute;
          height: 100%;
          width: 100%;
          object-fit: cover;
          top: 0;
          left: 0;
          object-position: left center;
        }
        
        .maplayout.wide .mapimg {
          width: 100%;
          height: 100%;
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
          <EnergySellingPanel
            bid={bid}
            selectedBuilding={selectedBuilding}
            destinationBuildings={destinationBuildings}
            energyAmount={energyAmount}
            setEnergyAmount={setEnergyAmount}
            energyRate={energyRate}
            setEnergyRate={setEnergyRate}
            targetBuildingForPurchase={targetBuildingForPurchase}
            setTargetBuildingForPurchase={setTargetBuildingForPurchase}
            sourceEnergyStatus={sourceEnergyStatus}
            sellSource={sellSource}
            setSellSource={setSellSource}
            marketSnapshot={marketSnapshot}
            amountNum={amountNum}
            rateNum={rateNum}
            totalToken={totalToken}
            canSellFromSelectedBuilding={selectedBuildingOwnedByUser}
            onClose={handleClosePanel}
            onSell={handleSell}
            onBuy={handleBuy}
          />
        </div>
      )}

      {/* TOR Requirements Panel */}
      {showTOR && (
        <div style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          padding: '16px 20px',
          width: '560px',
          maxWidth: 'calc(100vw - 440px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          maxHeight: '60vh',
          overflowY: 'auto',
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📋</span> TOR Requirements — Energy Selling
          </h2>
          <div style={{ fontSize: 13, color: '#1e3a8a', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span style={{ fontWeight: 700, color: '#1d4ed8' }}>7.2.1</span>
              <p style={{ marginTop: 4, lineHeight: 1.6 }}>ติดตั้งระบบเทคโนโลยี Blockchain ใช้งานกับระบบผลิตพลังงานไฟฟ้า</p>
            </div>
            <div>
              <span style={{ fontWeight: 700, color: '#1d4ed8' }}>3)</span>
              <p style={{ marginTop: 4, lineHeight: 1.6 }}>ระบบบริหารจัดการซื้อ ขาย ไฟฟ้า มีคุณสมบัติอย่างน้อย ดังนี้</p>
            </div>
          </div>
        </div>
      )}

      <div className="left-div">
        <div className="map-bar">
          {/* Header Components */}
          <TradingOverlay
            selectedBuilding={selectedBuilding}
            overviewStats={overviewStats}
            member={member}
            showPanel={showPanel}
            availableBuildingNames={availableBuildingNames}
            ownedBuildingNames={ownedBuildingNames}
            onSelectBuilding={triggerBuildingByName}
          />

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

