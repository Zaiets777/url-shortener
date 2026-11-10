import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// Тимчасові дані для тестування візуала
const mockData = [
  { date: '11/04', clicks: 12 },
  { date: '11/05', clicks: 19 },
  { date: '11/06', clicks: 15 },
  { date: '11/07', clicks: 25 },
  { date: '11/08', clicks: 22 },
  { date: '11/09', clicks: 35 },
  { date: '11/10', clicks: 42 },
];

// Кастомний тултіп, щоб виглядав стильно
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e2e8f0',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <p style={{ margin: 0, fontWeight: 'bold', color: '#1e293b' }}>{label}</p>
        <p style={{ margin: 0, color: '#6366f1' }}>
          Переходів: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export default function ClickStatsChart({ data = mockData }) {
  return (
    <div style={{ width: '100%', height: '300px', marginTop: '20px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="clicks" 
            stroke="#6366f1" 
            strokeWidth={3}
            dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6 }}
            animationDuration={1500}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}