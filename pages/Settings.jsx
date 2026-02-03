import React, { useState } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState({
    gymName: 'Спортивный Комплекс Pro',
    email: 'admin@sportcomplex.com',
    phone: '+7 (495) 123-45-67',
    address: 'ул. Фитнес, 10, Москва, Россия',
    currency: 'RUB',
    timezone: 'Europe/Moscow',
    language: 'ru',
    theme: 'light',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: true,
    classReminders: true,
    paymentAlerts: true,
    membershipAlerts: true,
    systemUpdates: false,
  });

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSettingChange = (key, value) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleNotificationChange = (key) => {
    setNotificationSettings({ ...notificationSettings, [key]: !notificationSettings[key] });
  };

  const handlePasswordChange = (key, value) => {
    setPasswords({ ...passwords, [key]: value });
  };

  const handleSaveSettings = () => {
    alert('Настройки сохранены успешно!');
  };

  const handleChangePassword = () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      alert('Пароли не совпадают!');
      return;
    }
    alert('Пароль изменён успешно!');
    setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Параметры</h1>
        <p className="text-gray-600 text-sm mt-2">Управление настройками клуба</p>
      </div>

      {/* General Settings */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6 pb-4 border-b border-white/10">Общие настройки</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Название клуба</label>
            <input
              type="text"
              value={settings.gymName}
              onChange={(e) => handleSettingChange('gymName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white/5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Электронная почта</label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => handleSettingChange('email', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white/5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Телефон</label>
            <input
              type="tel"
              value={settings.phone}
              onChange={(e) => handleSettingChange('phone', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white/5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Адрес</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => handleSettingChange('address', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white/5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Валюта</label>
            <select
              value={settings.currency}
              onChange={(e) => handleSettingChange('currency', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white/5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Временная зона</label>
            <select
              value={settings.timezone}
              onChange={(e) => handleSettingChange('timezone', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white/5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Europe/Moscow">Europe/Moscow</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
        >
          Сохранить настройки
        </button>
      </div>

      {/* Notification Settings */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6 pb-4 border-b border-white/10">Предпочтения уведомлений</h2>
        <div className="space-y-4">
          {[
            { key: 'emailNotifications', label: 'Уведомления по Email', description: 'Получать обновления по электронной почте' },
            { key: 'smsNotifications', label: 'SMS уведомления', description: 'Получать SMS-уведомления' },
            { key: 'classReminders', label: 'Напоминания о занятиях', description: 'Напоминать участникам о предстоящих занятиях' },
            { key: 'paymentAlerts', label: 'Оповещения о платежах', description: 'Уведомлять о неудачных или ожидающих платежах' },
            { key: 'membershipAlerts', label: 'Оповещения об абонементах', description: 'Информировать об изменениях в абонементах' },
            { key: 'systemUpdates', label: 'Обновления системы', description: 'Получать уведомления об обновлениях системы' },
          ].map((notification) => (
            <div key={notification.key} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">{notification.label}</p>
                <p className="text-sm text-slate-400">{notification.description}</p>
              </div>
              <button
                onClick={() => handleNotificationChange(notification.key)}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  notificationSettings[notification.key] ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    notificationSettings[notification.key] ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Security Settings */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6 pb-4 border-b border-white/10">Параметры безопасности</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Текущий пароль</label>
            <input
              type="password"
              value={passwords.currentPassword}
              onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
              placeholder="Введите текущий пароль"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white/5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Новый пароль</label>
            <input
              type="password"
              value={passwords.newPassword}
              onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
              placeholder="Введите новый пароль"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white/5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Подтвердите пароль</label>
            <input
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
              placeholder="Подтвердите новый пароль"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white/5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={handleChangePassword}
          className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
        >
          Изменить пароль
        </button>
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-red-600 mb-6 pb-4 border-b border-red-200/30">Опасная зона</h2>
        <p className="text-sm text-red-800 mb-4">
          Эти действия необратимы. Пожалуйста, продолжите осторожно.
        </p>
        <div className="flex gap-4">
          <button className="px-6 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
            Найти данные
          </button>
          <button className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium">
            Удалить аккаунт
          </button>
        </div>
      </div>
    </div>
  );
}
