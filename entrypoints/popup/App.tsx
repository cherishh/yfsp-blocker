import { useEffect, useState } from 'react';
import { storage } from '@wxt-dev/storage';
import './App.css';
import logo from '/yf_logo.webp';

const blockedCountStorage = storage.defineItem<number>('local:blockedCount', {
  fallback: 0,
});

const enabledStorage = storage.defineItem<boolean>('local:enabled', {
  fallback: true,
});

function App() {
  const [blockedCount, setBlockedCount] = useState(0);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // 初始化状态
    blockedCountStorage.getValue().then(setBlockedCount);
    enabledStorage.getValue().then(setEnabled);

    // 监听变化
    const unwatchCount = blockedCountStorage.watch((newValue) => {
      setBlockedCount(newValue ?? 0);
    });

    const unwatchEnabled = enabledStorage.watch((newValue) => {
      setEnabled(newValue ?? true);
    });

    return () => {
      unwatchCount();
      unwatchEnabled();
    };
  }, []);

  const handleReset = () => {
    blockedCountStorage.setValue(0);
    setBlockedCount(0);
  };

  const handleToggle = () => {
    const newValue = !enabled;
    enabledStorage.setValue(newValue);
    setEnabled(newValue);
  };

  return (
    <div className="popup-container">
      {/* 头部 */}
      <div className="header">
        <img src={logo} alt="YFSP Blocker" className="logo" />
        <span className="title">YFSP Ad Blocker</span>
      </div>

      {/* 核心：运行状态 - 可点击切换 */}
      <button type="button" className="status-hero" onClick={handleToggle}>
        <div className={`status-orb ${enabled ? 'active' : 'inactive'}`}>
          <div className="orb-core" />
        </div>
        <div className={`status-label ${enabled ? '' : 'inactive'}`}>
          {enabled ? '防护运行中' : '已停止'}
        </div>
        <div className="status-hint">点击{enabled ? '关闭' : '开启'}</div>
      </button>

      {/* 拦截统计 - 次要信息 */}
      <div className="stats-row">
        <span className="stats-count">{blockedCount}</span>
        <span className="stats-label">已拦截广告</span>
        <button type="button" onClick={handleReset} className="reset-btn" title="重置计数">
          ↺
        </button>
      </div>

      {/* 底部说明 */}
      <div className="footer">
        <p className="footer-desc">自动跳过 yfsp.tv 视频广告</p>
        <p className="footer-author">
          <span className="author-text">by Tuxi · <a href="mailto:one77r@gmail.com">one77r@gmail.com</a></span>
        </p>
      </div>
    </div>
  );
}

export default App;
