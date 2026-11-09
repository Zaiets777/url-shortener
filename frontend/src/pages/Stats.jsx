import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clipboard,
  ExternalLink,
  Link2,
  MousePointerClick,
  Clock3,
  BarChart3
} from 'lucide-react';
import { DashboardLayout, Spinner } from '../components/UI';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { dateLabel, isExpired, shortUrl } from '../utils/links';

// Імпортуємо наш новий красивий графік! 
// (якщо ти створив його в іншій папці, підправ шлях, наприклад на '../components/UI/ClickStatsChart')
import ClickStatsChart from '../components/ClickStatsChart'; 

export default function Stats() {
  const { shortCode } = useParams();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    let mounted = true;
    api.stats(shortCode)
      .then(data => {
        if (mounted) setLink(data.link || data);
      })
      .catch(e => {
        if (mounted) setError(e.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false };
  }, [shortCode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl(link));
      setCopied(true);
      notify('Short link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Copy failed', 'error');
    }
  };

  return (
    <DashboardLayout>
      <Link className="back-link stats-back" to="/dashboard">
        <ArrowLeft size={17} /> Back to Dashboard
      </Link>
      
      {loading ? (
        <div className="center-pad"><Spinner /></div>
      ) : error ? (
        <div className="empty-state">
          <h2>Link unavailable</h2>
          <p>{error}</p>
          <Link className="btn btn-primary" to="/dashboard">Back to dashboard</Link>
        </div>
      ) : (
        <>
          <div className="stats-title-row">
            <div>
              <span className="eyebrow">LINK ANALYTICS</span>
              <h1>Link Statistics</h1>
              <p>Detailed insights into your link's performance.</p>
            </div>
            <span className={`status ${isExpired(link) ? 'expired' : 'active'}`}>
              <i />{isExpired(link) ? 'Expired' : 'Active'}
            </span>
          </div>

          <div className="panel stats-link-panel">
            <div className="stats-link-heading">
              <span className="summary-icon purple"><Link2 size={22} /></span>
              <div>
                <span>YOUR SHORT LINK</span>
                <div className="stats-short-row">
                  <strong>{shortUrl(link).replace(/^https?:\/\//, '')}</strong>
                  <button title="Copy link" onClick={copy}>
                    {copied ? <Check size={18} /> : <Clipboard size={18} />}
                  </button>
                  <a href={shortUrl(link)} title="Open short link" target="_blank" rel="noreferrer">
                    <ExternalLink size={18} />
                  </a>
                </div>
              </div>
            </div>
            <div className="stats-original">
              <span>Original URL</span>
              <a href={link.originalUrl} target="_blank" rel="noreferrer">
                {link.originalUrl} <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <div className="summary-grid stats-metrics">
            <article className="summary-card">
              <span className="summary-icon purple"><MousePointerClick size={22} /></span>
              <div>
                <span>Total clicks</span>
                <strong>{Number(link.clicks || 0).toLocaleString()}</strong>
              </div>
            </article>
            <article className="summary-card">
              <span className="summary-icon green"><CalendarDays size={22} /></span>
              <div>
                <span>Created on</span>
                <strong className="date-metric">{dateLabel(link.createdAt)}</strong>
              </div>
            </article>
            <article className="summary-card">
              <span className="summary-icon orange"><Clock3 size={22} /></span>
              <div>
                <span>Expires on</span>
                <strong className="date-metric">{dateLabel(link.expiresAt)}</strong>
              </div>
            </article>
          </div>

          <section className="panel chart-panel">
            <div className="chart-title">
              <div>
                <h2><BarChart3 size={21} /> Clicks over time</h2>
                <p>Daily clicks during the last 7 days</p>
              </div>
              <span className="period-tag">Last 7 days</span>
            </div>
            
            {/* Виводимо наш новий графік. Поки бекенд не готовий, він сам підтягне тестові дані */}
            <ClickStatsChart />
            
          </section>
        </>
      )}
    </DashboardLayout>
  );
}