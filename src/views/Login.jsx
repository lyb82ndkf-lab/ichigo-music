import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { QrCode, RefreshCw, CheckCircle, Smartphone } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const { checkUserLogin } = useApp();
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [unikey, setUnikey] = useState('');
  const [status, setStatus] = useState('loading'); // 'loading', 'active', 'scanned', 'expired', 'success'
  const [statusText, setStatusText] = useState('生成二维码中...');
  const pollTimerRef = useRef(null);

  useEffect(() => {
    generateQRCode();
    return () => stopPolling();
  }, []);

  const generateQRCode = async () => {
    stopPolling();
    setStatus('loading');
    setStatusText('生成二维码中...');
    
    try {
      const keyRes = await api.getQRKey();
      const key = keyRes.data.unikey;
      setUnikey(key);

      const qrRes = await api.createQRImage(key);
      setQrCodeUrl(qrRes.data.qrimg || qrRes.data.qrurl);
      
      setStatus('active');
      setStatusText('请使用网易云音乐 App 扫码登录');
      startPolling(key);
    } catch (err) {
      console.error(err);
      setStatus('expired');
      setStatusText('生成二维码失败，请重试');
    }
  };

  const startPolling = (key) => {
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await api.checkQRStatus(key);
        const code = res.code;

        if (code === 800) {
          // Expired
          setStatus('expired');
          setStatusText('二维码已失效，请点击刷新');
          stopPolling();
        } else if (code === 801) {
          // Waiting scan
          setStatus('active');
          setStatusText('请使用网易云音乐 App 扫码登录');
        } else if (code === 802) {
          // Scanned, waiting confirm
          setStatus('scanned');
          setStatusText('扫码成功，请在手机上点击确认');
        } else if (code === 803) {
          // Success
          setStatus('success');
          setStatusText('登录成功！同步数据中...');
          stopPolling();
          
          // Re-fetch login state in global context
          await checkUserLogin();
          
          if (onLoginSuccess) {
            onLoginSuccess();
          }
        }
      } catch (err) {
        console.error('Error checking QR status:', err);
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
      <div 
        style={{ 
          position: 'relative', 
          width: '180px', 
          height: '180px', 
          background: 'var(--surface-bg)', 
          border: '1px solid var(--card-border)', 
          borderRadius: 'var(--border-radius-lg)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          overflow: 'hidden',
          marginBottom: '20px'
        }}
      >
        {status === 'loading' ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <RefreshCw className="spinning" size={24} style={{ animation: 'rotate 1.5s linear infinite' }} />
            <span>载入中...</span>
          </div>
        ) : (
          <img 
            src={qrCodeUrl} 
            alt="NetEase QR Login" 
            style={{ 
              width: '90%', 
              height: '90%', 
              objectFit: 'contain',
              filter: (status === 'expired' || status === 'scanned') ? 'blur(4px) brightness(0.4)' : 'none' 
            }}
          />
        )}

        {/* Status Overlays */}
        {status === 'expired' && (
          <div 
            onClick={generateQRCode}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(0,0,0,0.6)' }}
          >
            <RefreshCw size={24} color="var(--text-active)" />
            <span style={{ fontSize: '11px', color: 'var(--text-active)', fontWeight: 600 }}>点击刷新二维码</span>
          </div>
        )}

        {status === 'scanned' && (
          <div 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)' }}
          >
            <Smartphone size={28} color="var(--primary)" />
            <span style={{ fontSize: '11px', color: 'var(--text-active)', fontWeight: 600 }}>手机端确认中...</span>
          </div>
        )}

        {status === 'success' && (
          <div 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(0,0,0,0.85)' }}
          >
            <CheckCircle size={32} color="#10b981" />
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>登录成功</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-main)', fontWeight: 500, textAlign: 'center' }}>
        <QrCode size={16} color="var(--primary)" />
        <span>{statusText}</span>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
        扫码登录后，将为您同步歌单与收藏的歌曲
      </div>
    </div>
  );
}
