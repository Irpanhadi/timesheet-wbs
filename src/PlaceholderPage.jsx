const THEME = {
  dark: {
    app: '#10151A', panelBg: '#151B21', cardBorder: '#262E36',
    title: '#F2F4F5', subtitle: '#9AA5AC', dim: '#5C666D',
    statIconBg: 'rgba(76,163,168,0.14)', statIconColor: '#7AC6CA',
    toggleBg: '#1B2128', toggleBorder: '#2E3841', toggleColor: '#B7C1C7',
  },
  light: {
    app: '#F4F5F6', panelBg: '#FBFCFC', cardBorder: '#E2E6E9',
    title: '#1B2226', subtitle: '#5B6770', dim: '#9AA4AA',
    statIconBg: 'rgba(60,110,113,0.08)', statIconColor: '#2C5254',
    toggleBg: '#FFFFFF', toggleBorder: '#D7DCE0', toggleColor: '#43505A',
  },
}

// Halaman generik untuk fitur yang belum dibangun — hanya tampilan,
// tidak ada logika backend. Dipakai oleh Master Data, Master Template,
// dan Review Timesheet sampai halaman aslinya dibuat.
export default function PlaceholderPage({ isDark, onToggleTheme, onBack, icon, title, description }) {
  const t = THEME[isDark ? 'dark' : 'light']

  return (
    <div style={{
      minHeight: '100vh', background: t.app,
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
      color: t.title, boxSizing: 'border-box',
    }}>
      <div style={{ padding: '22px 32px 40px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28,
          borderBottom: `1px solid ${t.cardBorder}`, paddingBottom: 14,
        }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 10.5, color: t.subtitle, fontWeight: 600, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              PT. Wahana Bara Sentosa
            </p>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.title, letterSpacing: -0.3 }}>{title}</h1>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {onBack && (
              <button
                className="ts-btn"
                onClick={onBack}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                  background: t.toggleBg, border: `1px solid ${t.toggleBorder}`,
                  color: t.toggleColor, cursor: 'pointer',
                }}
              >
                ← Dashboard
              </button>
            )}
            {onToggleTheme && (
              <button
                className="ts-btn"
                onClick={onToggleTheme}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                  background: t.toggleBg, border: `1px solid ${t.toggleBorder}`,
                  color: t.toggleColor, cursor: 'pointer',
                }}
              >
                {isDark ? '☀ Terang' : '🌙 Gelap'}
              </button>
            )}
          </div>
        </div>

        {/* Isi placeholder */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', gap: 10,
          background: t.panelBg, border: `1px solid ${t.cardBorder}`,
          borderRadius: 16, padding: '60px 24px',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: t.statIconBg, color: t.statIconColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, marginBottom: 6,
          }}>{icon}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: t.title }}>{title}</div>
          <div style={{ fontSize: 13, color: t.dim, maxWidth: 380, lineHeight: 1.6 }}>{description}</div>
        </div>
      </div>
    </div>
  )
}