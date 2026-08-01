import PlaceholderPage from './PlaceholderPage'

export default function MasterData({ isDark, onToggleTheme, onBack }) {
  return (
    <PlaceholderPage
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      onBack={onBack}
      icon="🗂️"
      title="Master Data"
      description="Halaman untuk mengelola data unit dan operator. Fitur ini akan segera hadir."
    />
  )
}