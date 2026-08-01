import PlaceholderPage from './PlaceholderPage'

export default function MasterTemplate({ isDark, onToggleTheme, onBack }) {
  return (
    <PlaceholderPage
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      onBack={onBack}
      icon="📋"
      title="Master Template"
      description="Halaman untuk mengelola template timesheet. Fitur ini akan segera hadir."
    />
  )
}