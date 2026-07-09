import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Badge, List, Spin, message } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { getApiBase } from '../core/data_connecter/apiBase';

const API_BASE = getApiBase();
const NOTIFICATION_API = `${API_BASE}/notifications`;

const NotificationBell = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0 });
  const bellRef = useRef(null);
  const dropdownRef = useRef(null);
  const mountedRef = useRef(true);

  const fetchNotifications = async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      const url = userId ? `${NOTIFICATION_API}?userId=${encodeURIComponent(userId)}` : NOTIFICATION_API;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current) return;
      setNotifications(Array.isArray(data.notifications) ? data.notifications : (Array.isArray(data) ? data : []));
    } catch (e) {
      if (!mountedRef.current) return;
      setNotifications([]);
    }
    if (!mountedRef.current) return;
    setLoading(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${NOTIFICATION_API}/${notificationId}/read`, { method: 'PATCH' });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch {
      message.error('Failed to mark as read');
    }
  };

  const updatePosition = useCallback(() => {
    const bell = bellRef.current;
    if (!bell) return;

    const rect = bell.getBoundingClientRect();
    const dropdownW = 320;
    const dropdownH = 380;
    const gap = 6;

    // Default: below bell, right-aligned
    let top = rect.bottom + gap;
    let left = rect.right - dropdownW;

    // Sanity check: if rect is invalid (element not in DOM), use fallback
    if (rect.bottom === 0 && rect.top === 0) {
      top = 60;
      left = window.innerWidth - dropdownW - 16;
    }

    // Keep within viewport horizontally
    if (left < 8) left = 8;
    if (left + dropdownW > window.innerWidth - 8) {
      left = window.innerWidth - dropdownW - 8;
    }

    // If not enough space below, flip above
    if (top + dropdownH > window.innerHeight - 8) {
      top = rect.top - dropdownH - gap;
    }

    // Final sanity: never go off-screen
    if (top < 8) top = 8;

    setDropdownStyle({ position: 'fixed', top, left, zIndex: 1100 });
  }, []);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open) {
      // Small delay to ensure bell is laid out (for sticky containers)
      requestAnimationFrame(() => updatePosition());
    }
    setOpen(prev => !prev);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Recalculate on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, updatePosition]);

  return (
    <>
      <span ref={bellRef} onClick={handleToggle} style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 1 }}>
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <BellOutlined style={{ fontSize: 20, color: '#475569' }} />
        </Badge>
      </span>

      {open && (
        <div
          ref={dropdownRef}
          style={{
            ...dropdownStyle,
            width: 320,
            maxHeight: 400,
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid #f1f5f9',
            fontWeight: 700,
            fontSize: 13,
            color: '#334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <span>การแจ้งเตือน{unreadCount > 0 ? ` (${unreadCount})` : ''}</span>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>
              กดเพื่ออ่าน
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 340 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
            ) : (
              <List
                dataSource={notifications}
                locale={{ emptyText: 'ไม่มีการแจ้งเตือน' }}
                renderItem={item => (
                  <List.Item
                    onClick={() => !item.read && markAsRead(item.id)}
                    style={{
                      cursor: item.read ? 'default' : 'pointer',
                      background: item.read ? '#fff' : '#e0e7ff',
                      padding: '10px 14px',
                      borderBottom: '1px solid #f8fafc',
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{
                        fontWeight: item.read ? 400 : 700,
                        fontSize: 13,
                        color: '#1e293b',
                        marginBottom: 2,
                        lineHeight: 1.4,
                      }}>
                        {item.body || item.title || '(no message)'}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {new Date(item.createdAt).toLocaleString('th-TH')}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
