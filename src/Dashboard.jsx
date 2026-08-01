import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// ── Palet warna — selaras dengan tema Input Timesheet & Generate Timesheet ──
const THEME = {
  dark: {
    app:        '#10151A',
    card:       '#171D23',
    panelBg:    '#151B21',
    cardBorder: '#262E36',
    title:      '#F2F4F5',
    subtitle:   '#9AA5AC',
    dim:        '#5C666D',
    tagBg:      '#1B3538',
    tagColor:   '#6FB3B7',
    tagBorder:  '#2C5254',
    statIconBg: 'rgba(76,163,168,0.14)',
    statIconColor: '#7AC6CA',
    toggleBg:   '#1B2128',
    toggleBorder:'#2E3841',
    toggleColor:'#B7C1C7',
    menuBg:     '#1D242B',
    menuBorder: '#2E3841',
    menuHoverBorder: '#4CA3A8',
    accent:     '#3C6E71',
  },
  light: {
    app:        '#F4F5F6',
    card:       '#FFFFFF',
    panelBg:    '#FBFCFC',
    cardBorder: '#E2E6E9',
    title:      '#1B2226',
    subtitle:   '#5B6770',
    dim:        '#9AA4AA',
    tagBg:      '#E3F1F1',
    tagColor:   '#2C5254',
    tagBorder:  '#BFDEDE',
    statIconBg: 'rgba(60,110,113,0.08)',
    statIconColor: '#2C5254',
    toggleBg:   '#FFFFFF',
    toggleBorder:'#D7DCE0',
    toggleColor:'#43505A',
    menuBg:     '#FFFFFF',
    menuBorder: '#E2E6E9',
    menuHoverBorder: '#3C8C8F',
    accent:     '#3C6E71',
  },
}

// ── Menu cepat: label, deskripsi singkat, ikon, dan target halaman ──────────
const QUICK_MENU = [
  { key: 'master-data',      label: 'Master Data',        desc: 'Kelola data unit & operator',      icon: '🗂️' },
  { key: 'master-template',  label: 'Master Template',    desc: 'Kelola template timesheet',         icon: '📋' },
  { key: 'generate',         label: 'Generate Timesheet', desc: 'Buat timesheet dari template',      icon: '⚡' },
  { key: 'input',            label: 'Input Timesheet',    desc: 'Input data timesheet harian',       icon: '📝' },
  { key: 'review-timesheet', label: 'Review Timesheet',   desc: 'Tinjau & verifikasi timesheet',     icon: '✅' },
]

export default function Dashboard({ isDark, onToggleTheme, onNavigate }) {
  const t = THEME[isDark ? 'dark' : 'light']

  // Statistik ringkas — belum terhubung ke logika backend, fokus di tampilan.
  const [stats, setStats] = useState({
    unitAktif: '–',
    template: '–',
    timesheetHariIni: '–',
    operator: '–',
  })

  // Percobaan ringan mengambil jumlah baris dari Supabase bila tabelnya ada.
  // Gagal diam-diam (silent fail) karena dashboard ini masih fokus tampilan saja.
  useEffect(() => {
    let cancelled = false
    async function loadCounts() {
      const today = new Date().toISOString().slice(0, 10)
      const tryCount = async (table, filter) => {
        try {
          let q = supabase.from(table).select('*', { count: 'exact', head: true })
          if (filter) q = filter(q)
          const { count, error } = await q
          if (error || cancelled) return null
          return count
        } catch {
          return null
        }
      }
      const [unit, tmpl, tsHariIni, operator] = await Promise.all([
        tryCount('unit'),
        tryCount('template'),
        tryCount('timesheet', q => q.eq('tanggal', today)),
        tryCount('operator'),
      ])
      if (cancelled) return
      setStats({
        unitAktif: unit ?? '–',
        template: tmpl ?? '–',
        timesheetHariIni: tsHariIni ?? '–',
        operator: operator ?? '–',
      })
    }
    loadCounts()
    return () => { cancelled = true }
  }, [])

  const S = makeStyles(t)

  const statCards = [
    { label: 'Total Unit Aktif',        value: stats.unitAktif,        icon: '🚜' },
    { label: 'Total Template',          value: stats.template,         icon: '📋' },
    { label: 'Total Timesheet Hari Ini',value: stats.timesheetHariIni, icon: '🗓️' },
    { label: 'Total Operator',          value: stats.operator,         icon: '👷' },
  ]

  return (
    <div style={S.app}>
      <div style={S.card}>

        {/* Header */}
        <div style={S.header}>
          <div style={S.logoWrap}>
            <img src="/image.png" alt="Logo WBS" style={S.logoImg} />
          </div>
          <div>
            <p style={S.subtitle}>PT. Wahana Bara Sentosa</p>
            <h1 style={S.title}>Dashboard</h1>
          </div>
          <div style={S.headerRight}>
            <button className="ts-btn" style={S.toggleBtn} onClick={onToggleTheme}>
              {isDark ? '☀ Terang' : '🌙 Gelap'}
            </button>
          </div>
        </div>

        {/* Statistik ringkas */}
        <div style={S.statGrid}>
          {statCards.map(c => (
            <div key={c.label} style={S.statCard}>
              <div style={S.statIcon}>{c.icon}</div>
              <div>
                <div style={S.statValue}>{c.value}</div>
                <div style={S.statLabel}>{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Menu cepat */}
        <div style={S.sectionHeading}>Menu Cepat</div>
        <div style={S.menuGrid}>
          {QUICK_MENU.map(m => (
            <button
              key={m.key}
              className="ts-btn"
              style={S.menuCard}
              onClick={() => onNavigate?.(m.key)}
            >
              <div style={S.menuIcon}>{m.icon}</div>
              <div style={S.menuLabel}>{m.label}</div>
              <div style={S.menuDesc}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function makeStyles(t) {
  return {
    app: {
      minHeight: '100vh',
      background: t.app,
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
      color: t.title,
      transition: 'background 0.25s, color 0.25s',
      boxSizing: 'border-box',
    },
    card: {
      background: t.app,
      padding: '22px 32px 40px',
      width: '100%',
      minHeight: '100vh',
      boxSizing: 'border-box',
      maxWidth: 1200,
      margin: '0 auto',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 28,
      borderBottom: `1px solid ${t.cardBorder}`,
      paddingBottom: 14,
    },
    logoWrap: {
      width: 44, height: 44, borderRadius: 10, overflow: 'hidden',
      background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, padding: 4, boxSizing: 'border-box', border: `1px solid ${t.cardBorder}`,
    },
    logoImg: { width: '100%', height: '100%', objectFit: 'contain' },
    title: { margin: 0, fontSize: 22, fontWeight: 800, color: t.title, letterSpacing: -0.3 },
    subtitle: { margin: '0 0 2px', fontSize: 10.5, color: t.subtitle, fontWeight: 600, letterSpacing: 1.1, textTransform: 'uppercase' },
    headerRight: { marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' },
    toggleBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
      background: t.toggleBg, border: `1px solid ${t.toggleBorder}`,
      color: t.toggleColor, cursor: 'pointer', transition: 'all 0.15s',
    },

    // ── Statistik ──
    statGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 16,
      marginBottom: 34,
    },
    statCard: {
      display: 'flex', alignItems: 'center', gap: 14,
      background: t.panelBg, border: `1px solid ${t.cardBorder}`,
      borderRadius: 14, padding: '18px 20px',
    },
    statIcon: {
      width: 46, height: 46, borderRadius: 12,
      background: t.statIconBg, color: t.statIconColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 21, flexShrink: 0,
    },
    statValue: { fontSize: 24, fontWeight: 800, color: t.title, lineHeight: 1.15 },
    statLabel: { fontSize: 12, color: t.subtitle, fontWeight: 600, marginTop: 2 },

    // ── Menu cepat ──
    sectionHeading: {
      fontSize: 13, fontWeight: 700, color: t.subtitle,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14,
    },
    menuGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
      gap: 16,
    },
    menuCard: {
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
      background: t.menuBg, border: `1px solid ${t.menuBorder}`,
      borderRadius: 14, padding: '18px 18px 20px',
      cursor: 'pointer', textAlign: 'left',
      transition: 'all 0.15s',
      fontFamily: 'inherit',
    },
    menuIcon: {
      fontSize: 24, marginBottom: 4,
    },
    menuLabel: { fontSize: 14.5, fontWeight: 700, color: t.title },
    menuDesc: { fontSize: 12, color: t.dim, fontWeight: 500 },
  }
}