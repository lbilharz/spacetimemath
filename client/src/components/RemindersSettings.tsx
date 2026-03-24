import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Reminder, ReminderPattern, syncReminders, isPushSupported } from '../utils/notifications.js';

export default function RemindersSettings() {
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user_reminders');
      if (stored) {
        setReminders(JSON.parse(stored));
      } else {
        // Default migration
        const legacy = localStorage.getItem('daily_reminders') === '1';
        if (legacy) {
          const defaultReminders: Reminder[] = [
            { id: crypto.randomUUID(), time: '07:15', pattern: 'daily', daysOfWeek: [], enabled: true },
            { id: crypto.randomUUID(), time: '19:15', pattern: 'daily', daysOfWeek: [], enabled: true },
          ];
          setReminders(defaultReminders);
          syncReminders(defaultReminders);
          localStorage.setItem('user_reminders', JSON.stringify(defaultReminders));
        }
      }
    } catch (e) {
      console.warn('Silent local-storage drop', e);
    }
  }, []);

  // Only render on native Capacitor contexts (iOS/Android) where push is free & local.
  if (!isPushSupported()) {
    return null;
  }

  const saveAndSync = (newArr: Reminder[]) => {
    setReminders(newArr);
    localStorage.setItem('user_reminders', JSON.stringify(newArr));
    syncReminders(newArr);
  };

  const addReminder = () => {
    const newR: Reminder = { id: crypto.randomUUID(), time: '07:15', pattern: 'daily', daysOfWeek: [2,3,4,5,6], enabled: true };
    saveAndSync([...reminders, newR]);
  };

  const updateReminder = (id: string, partial: Partial<Reminder>) => {
    saveAndSync(reminders.map(r => r.id === id ? { ...r, ...partial } : r));
  };

  const deleteReminder = (id: string) => {
    saveAndSync(reminders.filter(r => r.id !== id));
  };

  const toggleDay = (id: string, dayNum: number) => {
    const r = reminders.find(x => x.id === id);
    if (!r) return;
    const isSelected = r.daysOfWeek.includes(dayNum);
    const newDays = isSelected ? r.daysOfWeek.filter(d => d !== dayNum) : [...r.daysOfWeek, dayNum];
    updateReminder(id, { daysOfWeek: newDays });
  };

  // Capacitor weekday: 1=Sun, 2=Mon...
  const DAYS = [
    { label: t('days.mo', 'Mo'), val: 2 },
    { label: t('days.tu', 'Tu'), val: 3 },
    { label: t('days.we', 'We'), val: 4 },
    { label: t('days.th', 'Th'), val: 5 },
    { label: t('days.fr', 'Fr'), val: 6 },
    { label: t('days.sa', 'Sa'), val: 7 },
    { label: t('days.su', 'Su'), val: 1 },
  ];

  return (
    <div className="w-full flex flex-col gap-4 mt-8">
      <div className="flex flex-row items-center justify-between">
        <h3 className="font-bold text-slate-800 dark:text-slate-200">{t('account.remindersHeading', 'Push Reminders')}</h3>
        <button onClick={addReminder} className="text-brand-yellow font-bold text-sm pressable py-1 px-3 bg-brand-yellow/10 rounded-full">
          + {t('common.add', 'Add')}
        </button>
      </div>
      
      {reminders.length === 0 && (
        <div className="text-sm text-slate-400 dark:text-slate-500 italic p-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
          {t('account.noReminders', 'No active reminders. Add one to keep your streak alive!')}
        </div>
      )}

      {reminders.map(r => (
        <div key={r.id} className={`flex flex-col gap-3 bg-white dark:bg-slate-800 p-4 rounded-3xl border ${r.enabled ? 'border-brand-yellow/30 shadow-sm' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}>
          
          <div className="flex flex-row items-center justify-between">
            <input 
              type="time" 
              value={r.time} 
              onChange={e => updateReminder(r.id, { time: e.target.value })}
              className="text-2xl font-black bg-slate-100 dark:bg-slate-900 rounded-xl px-3 py-1 text-slate-900 dark:text-brand-yellow focus:outline-brand-yellow"
            />
            
            <div className="flex flex-row items-center gap-2">
              <button 
                onClick={() => deleteReminder(r.id)} 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-100 text-red-500 dark:bg-red-500/20 dark:text-red-400 pressable"
              >
                ✕
              </button>
              
              <div 
                className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors ${r.enabled ? 'bg-brand-yellow' : 'bg-slate-200 dark:bg-slate-700'}`}
                onClick={() => updateReminder(r.id, { enabled: !r.enabled })}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${r.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-2 flex flex-col sm:flex-row gap-2 items-center justify-between">
            <select 
              value={r.pattern} 
              onChange={e => updateReminder(r.id, { pattern: e.target.value as ReminderPattern })}
              className="text-sm font-bold bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="daily">{t('account.daily', 'Every day')}</option>
              <option value="weekly">{t('account.weekly', 'Specific days')}</option>
            </select>
            
            {r.pattern === 'weekly' && (
              <div className="flex flex-row gap-1">
                {DAYS.map(day => (
                  <button 
                    key={day.val}
                    onClick={() => toggleDay(r.id, day.val)}
                    className={`w-8 h-8 rounded-full text-[10px] font-bold pressable transition-colors ${r.daysOfWeek.includes(day.val) ? 'bg-brand-yellow text-slate-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
        </div>
      ))}
    </div>
  );
}
