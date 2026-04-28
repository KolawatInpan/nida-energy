import React, { useEffect, useState } from 'react';
import { Badge, Popover, List, Spin } from 'antd';
import { BellOutlined } from '@ant-design/icons';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';
const NOTIFICATION_API = `${API_BASE}/notifications`;

const NotificationBell = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const url = userId ? `${NOTIFICATION_API}?userId=${encodeURIComponent(userId)}` : NOTIFICATION_API;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      // backend returns { notifications: [...] }
      setNotifications(Array.isArray(data.notifications) ? data.notifications : (Array.isArray(data) ? data : []));
    } catch (e) {
      setNotifications([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // auto-refresh
    return () => clearInterval(interval);
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const notificationList = (
    <div style={{ minWidth: 160, maxWidth: 280, maxHeight: 360, overflowY: 'auto', wordBreak: 'break-word' }}>
      {loading ? <Spin /> : (
        <List
          dataSource={notifications}
          renderItem={item => (
            <List.Item style={{ background: item.isRead ? '#fff' : '#e0e7ff' }}>
              <div>
                <div style={{ fontWeight: item.isRead ? 400 : 700 }}>{item.message}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{new Date(item.createdAt).toLocaleString()}</div>
              </div>
            </List.Item>
          )}
        />
      )}
      {(!loading && notifications.length === 0) && <div style={{ textAlign: 'center', color: '#888', padding: 16 }}>ไม่มีการแจ้งเตือน</div>}
    </div>
  );

  return (
    <Popover
      content={notificationList}
      trigger="click"
      placement="topRight"
      getPopupContainer={(triggerNode) => triggerNode?.parentNode || document.body}
      arrowPointAtCenter
    >
      <Badge count={unreadCount} size="small">
        <BellOutlined style={{ fontSize: 22, cursor: 'pointer', color: '#1e293b' }} />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
