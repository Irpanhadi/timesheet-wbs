import PlaceholderPage from './PlaceholderPage'

export default function ReviewTimesheet({ isDark, onToggleTheme, onBack }) {
  return (
    <PlaceholderPage
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      onBack={onBack}
      icon="✅"
      title="Review Timesheet"
      description="Halaman untuk meninjau dan memverifikasi timesheet yang sudah diinput. Fitur ini akan segera hadir."
    />
  )
}