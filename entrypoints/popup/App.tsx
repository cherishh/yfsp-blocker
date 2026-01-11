import { useEffect, useState } from 'react';
import { storage } from '@wxt-dev/storage';
import './App.css';
import logo from '/yf_logo.webp';

const blockedCountStorage = storage.defineItem<number>('local:blockedCount', {
  fallback: 0,
});

function App() {
  const [blockedCount, setBlockedCount] = useState(0);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    blockedCountStorage.getValue().then(setBlockedCount);

    const unwatch = blockedCountStorage.watch((newValue) => {
      setBlockedCount(newValue ?? 0);
    });

    return () => unwatch();
  }, []);

  const handleReset = () => {
    blockedCountStorage.setValue(0);
    setBlockedCount(0);
  };

  return (
    <div className="popup-container">
      <div className="header">
        <img src={logo} alt="YFSP Blocker" className="logo" />
        <h1 className="title">YFSP Ad Blocker</h1>
      </div>

      <div className="status-section">
        <div className={`status-indicator ${enabled ? 'active' : 'inactive'}`} />
        <span className="status-text">{enabled ? '运行中' : '已停止'}</span>
      </div>

      <div className="stats-section">
        <div className="stat-card">
          <span className="stat-number">{blockedCount}</span>
          <span className="stat-label">已拦截广告</span>
        </div>
      </div>

      <div className="actions">
        <button type="button" onClick={handleReset} className="reset-btn">
          重置计数
        </button>
      </div>

      <p className="footer">自动跳过 yfsp.tv 视频广告</p>
    </div>
  );
}

export default App;
