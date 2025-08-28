import { useState, useEffect } from 'react';
import { notificationService } from '../lib/notifications';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(5);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // 从localStorage加载设置
    const savedSettings = localStorage.getItem('bus-buddy-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setNotificationEnabled(settings.notificationEnabled ?? false);
        setReminderMinutes(settings.reminderMinutes ?? 5);
        setAutoRefresh(settings.autoRefresh ?? true);
        setDarkMode(settings.darkMode ?? false);
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    }

    // 检查通知权限
    if (notificationService.isSupported()) {
      setNotificationEnabled(notificationService.getPermissionStatus() === 'granted');
    }
  }, []);

  const saveSettings = () => {
    const settings = {
      notificationEnabled,
      reminderMinutes,
      autoRefresh,
      darkMode
    };
    localStorage.setItem('bus-buddy-settings', JSON.stringify(settings));
  };

  const handleNotificationToggle = async () => {
    if (notificationEnabled) {
      setNotificationEnabled(false);
    } else {
      const granted = await notificationService.requestPermission();
      setNotificationEnabled(granted);
    }
    saveSettings();
  };

  const handleReminderChange = (value: number) => {
    setReminderMinutes(value);
    saveSettings();
  };

  const handleAutoRefreshToggle = () => {
    setAutoRefresh(!autoRefresh);
    saveSettings();
  };

  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
    saveSettings();
  };

  const testNotification = async () => {
    await notificationService.showBusReminder('F55', 'Ibn Battuta', 5);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">设置</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 通知设置 */}
          <div className="space-y-4">
            <div className="border-b pb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">通知设置</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">启用通知</span>
                  <button
                    onClick={handleNotificationToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notificationEnabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {notificationEnabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        提前提醒时间: {reminderMinutes} 分钟
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="15"
                        value={reminderMinutes}
                        onChange={(e) => handleReminderChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                    
                    <button
                      onClick={testNotification}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      测试通知
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 应用设置 */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">应用设置</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">自动刷新</span>
                  <button
                    onClick={handleAutoRefreshToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoRefresh ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoRefresh ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-700">深色模式</span>
                  <button
                    onClick={handleDarkModeToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      darkMode ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        darkMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* 关于 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">关于</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>版本: 1.0.0</p>
                <p>迪拜公交助手帮助您及时了解公交到达信息</p>
                <p className="text-xs text-gray-500">
                  支持PWA，可添加到主屏幕
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
