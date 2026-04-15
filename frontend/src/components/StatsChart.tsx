import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

export function StatsChart() {
  const { t, language } = useTranslation();

  // Mock data for demonstration - in a real app this would come from the API
  const systemStatusData = [
    { name: language === 'zh' ? '00:00' : '00:00', uptime: 99.5, projects: 2 },
    { name: language === 'zh' ? '04:00' : '04:00', uptime: 99.8, projects: 3 },
    { name: language === 'zh' ? '08:00' : '08:00', uptime: 99.2, projects: 5 },
    { name: language === 'zh' ? '12:00' : '12:00', uptime: 99.9, projects: 7 },
    { name: language === 'zh' ? '16:00' : '16:00', uptime: 99.4, projects: 8 },
    { name: language === 'zh' ? '20:00' : '20:00', uptime: 99.7, projects: 6 },
    { name: language === 'zh' ? '现在' : 'Now', uptime: 99.6, projects: 4 },
  ];

  const qualityDistributionData = [
    { name: t('charts.excellent'), value: 12, color: '#22c55e' },
    { name: t('charts.good'), value: 25, color: '#3b82f6' },
    { name: t('charts.fair'), value: 8, color: '#eab308' },
    { name: t('charts.poor'), value: 3, color: '#ef4444' },
  ];

  const statusDistributionData = [
    { name: t('charts.completed'), count: 15, color: '#22c55e' },
    { name: t('charts.inProgress'), count: 8, color: '#3b82f6' },
    { name: t('charts.pending'), count: 12, color: '#64748b' },
    { name: t('charts.failed'), count: 2, color: '#ef4444' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* System Status Trend */}
      <motion.div
        className="section col-span-1 lg:col-span-2"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-blue-500" />
            <h3 className="font-semibold">{t('charts.statusTrend')}</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={systemStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey="uptime"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#3b82f6' }}
                name={t('charts.uptime')}
              />
              <Line
                type="monotone"
                dataKey="projects"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#22c55e' }}
                name={t('charts.projects')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Quality Distribution */}
      <motion.div
        className="section"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon size={20} className="text-purple-500" />
            <h3 className="font-semibold">{t('charts.qualityDistribution')}</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={qualityDistributionData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {qualityDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '10px' }}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Status Distribution */}
      <motion.div
        className="section col-span-1 lg:col-span-3"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-green-500" />
            <h3 className="font-semibold">{t('charts.projectStatus')}</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusDistributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
              >
                {statusDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </motion.div>
  );
}
