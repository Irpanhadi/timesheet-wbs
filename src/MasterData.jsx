import MasterUnit from './MasterUnit'

// MasterData sekarang menampilkan Master Unit.
// Saat sub-halaman master data bertambah (operator, dll), halaman ini bisa
// dijadikan hub navigasi — untuk saat ini langsung render MasterUnit.
export default function MasterData({ isDark, onToggleTheme, onBack }) {
  return (
    <MasterUnit
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      onBack={onBack}
    />
  )
}