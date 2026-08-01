/**
 * MasterUnit.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Halaman CRUD untuk tabel unit_wbs di Supabase.
 * Data dari halaman ini langsung dipakai oleh GenerateTimesheet.jsx:
 *   → hanya unit dengan status = 'aktif' yang akan di-generate.
 *
 * SCHEMA tabel unit_wbs yang dibutuhkan:
 *   no          serial primary key
 *   unit_wbs    text not null unique   ← Nomor Unit (kode equipment)
 *   tipe_unit   text                   ← FD, HD, EX, dll.
 *   status      text default 'aktif'   ← 'aktif' | 'nonaktif'
 *   keterangan  text                   ← opsional
 *
 * SQL untuk menambah kolom yang belum ada (jalankan di Supabase SQL Editor):
 *   ALTER TABLE unit_wbs ADD COLUMN IF NOT EXISTS tipe_unit  text;
 *   ALTER TABLE unit_wbs ADD COLUMN IF NOT EXISTS keterangan text;
 *   ALTER TABLE unit_wbs ADD COLUMN IF NOT EXISTS status     text DEFAULT 'aktif';
 *   ALTER TABLE unit_wbs ADD CONSTRAINT unit_wbs_unit_wbs_key UNIQUE (unit_wbs);
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ── Palet warna — identik dengan Dashboard.jsx ─────────────────────────────
const THEME = {
  dark: {
    app:          '#10151A',
    panelBg:      '#151B21',
    cardBorder:   '#262E36',
    title:        '#F2F4F5',
    subtitle:     '#9AA5AC',
    dim:          '#5C666D',
    tagBg:        '#1B3538',
    tagColor:     '#6FB3B7',
    tagBorder:    '#2C5254',
    inputBg:      '#1D242B',
    inputBorder:  '#2E3841',
    inputColor:   '#EDEFF0',
    focusBorder:  '#4CA3A8',
    toggleBg:     '#1B2128',
    toggleBorder: '#2E3841',
    toggleColor:  '#B7C1C7',
    btnSaveBg:    '#2F7A72',
    btnSaveBorder:'#2F7A72',
    btnSaveColor: '#F4FBFA',
    btnDelBg:     '#2A1A1A',
    btnDelBorder: '#5C2C2C',
    btnDelColor:  '#E87070',
    rowEven:      '#151B21',
    rowOdd:       '#10151A',
    rowHover:     '#1A2430',
    thBg:         '#1E3236',
    thColor:      '#EAF3F3',
    thBorder:     '#0E1215',
    tdBorder:     '#1E252B',
    modalBg:      '#171D23',
    modalOverlay: 'rgba(0,0,0,0.65)',
    successBg:    '#12241C',
    successBorder:'#255C42',
    successColor: '#5FCB8C',
    errBg:        '#241212',
    errBorder:    '#5C2525',
    errColor:     '#E87070',
    badgeAktif:   { bg: 'rgba(22,163,74,0.15)',  color: '#4ADE80', border: 'rgba(22,163,74,0.35)' },
    badgeNon:     { bg: 'rgba(100,100,100,0.15)', color: '#9AA5AC', border: 'rgba(100,100,100,0.30)' },
  },
  light: {
    app:          '#F4F5F6',
    panelBg:      '#FBFCFC',
    cardBorder:   '#E2E6E9',
    title:        '#1B2226',
    subtitle:     '#5B6770',
    dim:          '#9AA4AA',
    tagBg:        '#E3F1F1',
    tagColor:     '#2C5254',
    tagBorder:    '#BFDEDE',
    inputBg:      '#FFFFFF',
    inputBorder:  '#D7DCE0',
    inputColor:   '#1B2226',
    focusBorder:  '#3C8C8F',
    toggleBg:     '#FFFFFF',
    toggleBorder: '#D7DCE0',
    toggleColor:  '#43505A',
    btnSaveBg:    '#2C5254',
    btnSaveBorder:'#2C5254',
    btnSaveColor: '#FFFFFF',
    btnDelBg:     '#FEF2F2',
    btnDelBorder: '#FCA5A5',
    btnDelColor:  '#B91C1C',
    rowEven:      '#F7F9FA',
    rowOdd:       '#FFFFFF',
    rowHover:     '#EFF4F4',
    thBg:         '#3C6E71',
    thColor:      '#FFFFFF',
    thBorder:     '#2C5254',
    tdBorder:     '#EDEFF1',
    modalBg:      '#FFFFFF',
    modalOverlay: 'rgba(0,0,0,0.35)',
    successBg:    '#EAF7EE',
    successBorder:'#A9DBB6',
    successColor: '#227C43',
    errBg:        '#FEF2F2',
    errBorder:    '#FCA5A5',
    errColor:     '#B91C1C',
    badgeAktif:   { bg: 'rgba(22,163,74,0.08)',  color: '#16A34A', border: 'rgba(22,163,74,0.30)' },
    badgeNon:     { bg: 'rgba(100,100,100,0.08)', color: '#6B7280', border: 'rgba(100,100,100,0.25)' },
  },
}

// ── Form kosong untuk tambah / reset ───────────────────────────────────────
const emptyForm = () => ({ unit_wbs: '', tipe_unit: '', status: 'aktif', keterangan: '' })

// ── Badge status ────────────────────────────────────────────────────────────
function BadgeStatus({ status, t }) {
  const b = status === 'aktif' ? t.badgeAktif : t.badgeNon
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3,
      background: b.bg, color: b.color, border: `1px solid ${b.border}`,
    }}>
      {status === 'aktif' ? 'Aktif' : 'Nonaktif'}
    </span>
  )
}

// ── Modal Tambah / Edit ─────────────────────────────────────────────────────
function UnitModal({ t, mode, initialData, existingNomors, onSave, onClose, saving, errMsg }) {
  const [form, setForm] = useState(initialData ?? emptyForm())
  const firstRef = useRef(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Validasi sisi client sebelum kirim ke parent
  const [localErr, setLocalErr] = useState('')
  const handleSubmit = () => {
    const nomor = form.unit_wbs.trim()
    if (!nomor) { setLocalErr('Nomor Unit wajib diisi.'); return }
    if (!form.status) { setLocalErr('Status wajib dipilih.'); return }
    // Cek duplikat — kecualikan diri sendiri saat edit
    const isDup = existingNomors.some(
      n => n.toLowerCase() === nomor.toLowerCase() &&
           (mode === 'tambah' || n.toLowerCase() !== (initialData?.unit_wbs ?? '').toLowerCase())
    )
    if (isDup) { setLocalErr(`Nomor Unit "${nomor}" sudah ada.`); return }
    setLocalErr('')
    onSave({ ...form, unit_wbs: nomor })
  }

  // Tutup saat klik overlay
  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose() }

  const displayErr = localErr || errMsg

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: t.inputBg, border: `1px solid ${t.inputBorder}`,
    color: t.inputColor, borderRadius: 8, padding: '8px 11px', fontSize: 13,
    outline: 'none', fontFamily: 'inherit',
  }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: t.subtitle, marginBottom: 5, display: 'block' }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: t.modalOverlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: t.modalBg, border: `1px solid ${t.cardBorder}`,
        borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 440,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
      }}>
        {/* Judul modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.title }}>
            {mode === 'tambah' ? '➕ Tambah Unit' : '✏️ Edit Unit'}
          </h2>
          <button
            className="ts-btn"
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', fontSize: 18,
              color: t.dim, cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
            }}
          >✕</button>
        </div>

        {/* Pesan error */}
        {displayErr && (
          <div style={{
            background: t.errBg, border: `1px solid ${t.errBorder}`,
            color: t.errColor, borderRadius: 8, padding: '9px 13px',
            fontSize: 12.5, marginBottom: 16,
          }}>⚠ {displayErr}</div>
        )}

        {/* Form fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Nomor Unit <span style={{ color: t.errColor }}>*</span></label>
            <input
              ref={firstRef}
              value={form.unit_wbs}
              onChange={e => set('unit_wbs', e.target.value)}
              placeholder="Contoh: HD-001"
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label style={labelStyle}>Tipe Unit</label>
            <input
              value={form.tipe_unit}
              onChange={e => set('tipe_unit', e.target.value)}
              placeholder="Contoh: HD, FD, EX, ..."
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label style={labelStyle}>Status <span style={{ color: t.errColor }}>*</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['aktif', 'nonaktif'].map(s => {
                const active = form.status === s
                const b = s === 'aktif' ? t.badgeAktif : t.badgeNon
                return (
                  <button
                    key={s}
                    className="ts-btn"
                    onClick={() => set('status', s)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontWeight: 700,
                      fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${active ? b.border : t.inputBorder}`,
                      background: active ? b.bg : 'transparent',
                      color: active ? b.color : t.dim,
                      transition: 'all 0.15s',
                    }}
                  >
                    {s === 'aktif' ? '✓ Aktif' : '✗ Nonaktif'}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Keterangan</label>
            <textarea
              value={form.keterangan}
              onChange={e => set('keterangan', e.target.value)}
              placeholder="Opsional — catatan singkat mengenai unit ini"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
            />
          </div>
        </div>

        {/* Tombol aksi */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button
            className="ts-btn"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'transparent', border: `1px solid ${t.inputBorder}`,
              color: t.subtitle, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Batal</button>
          <button
            className="ts-btn"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: t.btnSaveBg, border: `1px solid ${t.btnSaveBorder}`,
              color: t.btnSaveColor, cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.75 : 1, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            {saving ? '⏳ Menyimpan…' : (mode === 'tambah' ? '➕ Simpan' : '✏️ Perbarui')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Konfirmasi Hapus ──────────────────────────────────────────────────
function DeleteModal({ t, unit, onConfirm, onClose, deleting, errMsg }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: t.modalOverlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
      }}
    >
      <div style={{
        background: t.modalBg, border: `1px solid ${t.cardBorder}`,
        borderRadius: 16, padding: '28px', width: '100%', maxWidth: 380,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
      }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800, color: t.title }}>🗑 Hapus Unit</h2>
        <p style={{ margin: '0 0 6px', fontSize: 13, color: t.subtitle }}>
          Yakin ingin menghapus unit berikut?
        </p>
        <div style={{
          background: t.panelBg, border: `1px solid ${t.cardBorder}`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          fontSize: 13, color: t.title, fontWeight: 600,
        }}>
          {unit.unit_wbs}
          {unit.tipe_unit ? <span style={{ color: t.dim, fontWeight: 400 }}> — {unit.tipe_unit}</span> : ''}
        </div>
        {errMsg && (
          <div style={{
            background: t.errBg, border: `1px solid ${t.errBorder}`,
            color: t.errColor, borderRadius: 8, padding: '9px 13px',
            fontSize: 12.5, marginBottom: 14,
          }}>⚠ {errMsg}</div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            className="ts-btn"
            onClick={onClose}
            disabled={deleting}
            style={{
              padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'transparent', border: `1px solid ${t.inputBorder}`,
              color: t.subtitle, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Batal</button>
          <button
            className="ts-btn"
            onClick={onConfirm}
            disabled={deleting}
            style={{
              padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: t.btnDelBg, border: `1px solid ${t.btnDelBorder}`,
              color: t.btnDelColor, cursor: deleting ? 'default' : 'pointer',
              opacity: deleting ? 0.75 : 1, fontFamily: 'inherit',
            }}
          >
            {deleting ? '⏳ Menghapus…' : '🗑 Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Komponen utama ──────────────────────────────────────────────────────────
export default function MasterUnit({ isDark, onToggleTheme, onBack }) {
  const t = THEME[isDark ? 'dark' : 'light']

  const [units, setUnits]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState(null) // { type: 'ok'|'err', msg }

  // Filter & pencarian (client-side)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilter] = useState('semua') // 'semua' | 'aktif' | 'nonaktif'

  // Modal state
  const [modal, setModal]         = useState(null) // null | { mode: 'tambah'|'edit', data? }
  const [delTarget, setDelTarget] = useState(null) // unit object yang akan dihapus
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [modalErr, setModalErr]   = useState('')
  const [delErr, setDelErr]       = useState('')

  // ── Fetch semua unit ──────────────────────────────────────────────────────
  const fetchUnits = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('unit_wbs')
      .select('no, unit_wbs, tipe_unit, status, keterangan')
      .order('no', { ascending: true })
    if (error) {
      showToast('err', 'Gagal memuat data: ' + error.message)
    } else {
      setUnits(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchUnits() }, [])

  // ── Toast notifikasi ──────────────────────────────────────────────────────
  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Simpan (Tambah / Edit) ────────────────────────────────────────────────
  const handleSave = async (formData) => {
    setSaving(true)
    setModalErr('')
    const payload = {
      unit_wbs:   formData.unit_wbs.trim(),
      tipe_unit:  formData.tipe_unit.trim() || null,
      status:     formData.status,
      keterangan: formData.keterangan.trim() || null,
    }

    if (modal.mode === 'tambah') {
      const { error } = await supabase.from('unit_wbs').insert(payload)
      if (error) {
        // Tangkap unique violation dari Postgres
        const msg = error.code === '23505'
          ? `Nomor Unit "${payload.unit_wbs}" sudah ada di database.`
          : 'Gagal menyimpan: ' + error.message
        setModalErr(msg)
        setSaving(false)
        return
      }
      showToast('ok', `Unit "${payload.unit_wbs}" berhasil ditambahkan.`)
    } else {
      // Edit: update berdasarkan primary key `no`
      const { error } = await supabase
        .from('unit_wbs')
        .update(payload)
        .eq('no', modal.data.no)
      if (error) {
        const msg = error.code === '23505'
          ? `Nomor Unit "${payload.unit_wbs}" sudah dipakai unit lain.`
          : 'Gagal memperbarui: ' + error.message
        setModalErr(msg)
        setSaving(false)
        return
      }
      showToast('ok', `Unit "${payload.unit_wbs}" berhasil diperbarui.`)
    }

    setSaving(false)
    setModal(null)
    await fetchUnits()
  }

  // ── Hapus ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true)
    setDelErr('')
    const { error } = await supabase
      .from('unit_wbs')
      .delete()
      .eq('no', delTarget.no)
    if (error) {
      setDelErr('Gagal menghapus: ' + error.message)
      setDeleting(false)
      return
    }
    showToast('ok', `Unit "${delTarget.unit_wbs}" berhasil dihapus.`)
    setDeleting(false)
    setDelTarget(null)
    await fetchUnits()
  }

  // ── Filter + pencarian (client-side) ──────────────────────────────────────
  const filtered = units.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      u.unit_wbs?.toLowerCase().includes(q) ||
      u.tipe_unit?.toLowerCase().includes(q) ||
      u.keterangan?.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'semua' || u.status === filterStatus
    return matchSearch && matchStatus
  })

  // Kumpulan nomor existing (untuk validasi duplikat di modal)
  const existingNomors = units.map(u => u.unit_wbs)

  // ── Styles ─────────────────────────────────────────────────────────────────
  const ff = "'Inter','Segoe UI',Arial,sans-serif"
  const S = {
    app: {
      minHeight: '100vh', background: t.app, fontFamily: ff,
      color: t.title, boxSizing: 'border-box',
      transition: 'background 0.25s, color 0.25s',
    },
    inner: { padding: '22px 32px 40px', maxWidth: 1200, margin: '0 auto', boxSizing: 'border-box' },
    header: {
      display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
      borderBottom: `1px solid ${t.cardBorder}`, paddingBottom: 14,
    },
    logoWrap: {
      width: 44, height: 44, borderRadius: 10, overflow: 'hidden',
      background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, padding: 4, boxSizing: 'border-box', border: `1px solid ${t.cardBorder}`,
    },
    logoImg: { width: '100%', height: '100%', objectFit: 'contain' },
    headerRight: { marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' },
    toggleBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
      background: t.toggleBg, border: `1px solid ${t.toggleBorder}`,
      color: t.toggleColor, cursor: 'pointer', fontFamily: ff,
    },
    saveBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
      background: t.btnSaveBg, border: `1px solid ${t.btnSaveBorder}`,
      color: t.btnSaveColor, cursor: 'pointer', fontFamily: ff,
    },
    toolbar: {
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      marginBottom: 16,
    },
    searchInput: {
      flex: '1 1 200px', minWidth: 160, padding: '8px 12px', borderRadius: 8,
      background: t.inputBg, border: `1px solid ${t.inputBorder}`,
      color: t.inputColor, fontSize: 13, outline: 'none', fontFamily: ff,
    },
    filterBtn: (active) => ({
      padding: '7px 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
      cursor: 'pointer', fontFamily: ff, transition: 'all 0.15s',
      border: `1.5px solid ${active ? t.focusBorder : t.inputBorder}`,
      background: active ? `${t.focusBorder}22` : 'transparent',
      color: active ? t.focusBorder : t.dim,
    }),
    tableWrap: {
      background: t.panelBg, border: `1px solid ${t.cardBorder}`,
      borderRadius: 12, overflow: 'hidden',
    },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: {
      background: t.thBg, color: t.thColor, padding: '11px 14px',
      fontWeight: 700, fontSize: 11.5, textAlign: 'left',
      letterSpacing: 0.5, textTransform: 'uppercase',
      borderBottom: `2px solid ${t.thBorder}`,
    },
    td: (i) => ({
      padding: '11px 14px', borderBottom: `1px solid ${t.tdBorder}`,
      background: i % 2 === 0 ? t.rowOdd : t.rowEven, verticalAlign: 'middle',
    }),
    actionBtn: (variant) => ({
      padding: '5px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600,
      cursor: 'pointer', fontFamily: ff,
      ...(variant === 'edit' ? {
        background: 'transparent', border: `1px solid ${t.toggleBorder}`,
        color: t.toggleColor,
      } : {
        background: t.btnDelBg, border: `1px solid ${t.btnDelBorder}`,
        color: t.btnDelColor,
      }),
    }),
    emptyRow: { textAlign: 'center', padding: 40, color: t.dim, fontSize: 13 },
    toast: (type) => ({
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
      boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
      background: type === 'ok' ? t.successBg : t.errBg,
      border: `1px solid ${type === 'ok' ? t.successBorder : t.errBorder}`,
      color: type === 'ok' ? t.successColor : t.errColor,
    }),
    countBadge: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: t.tagBg, border: `1px solid ${t.tagBorder}`,
      color: t.tagColor, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700,
    },
  }

  return (
    <div style={S.app}>
      <div style={S.inner}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div style={S.logoWrap}>
            <img src="/image.png" alt="Logo WBS" style={S.logoImg} />
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 10.5, color: t.subtitle, fontWeight: 600, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              PT. Wahana Bara Sentosa
            </p>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.title, letterSpacing: -0.3 }}>
              🚜 Master Unit
            </h1>
          </div>
          <div style={S.headerRight}>
            {onBack && (
              <button className="ts-btn" style={S.toggleBtn} onClick={onBack}>
                ← Dashboard
              </button>
            )}
            <button className="ts-btn" style={S.toggleBtn} onClick={onToggleTheme}>
              {isDark ? '☀ Terang' : '🌙 Gelap'}
            </button>
          </div>
        </div>

        {/* ── Toolbar: search + filter status + tombol tambah ── */}
        <div style={S.toolbar}>
          <input
            style={S.searchInput}
            placeholder="🔍  Cari nomor unit, tipe, keterangan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {['semua', 'aktif', 'nonaktif'].map(s => (
            <button
              key={s}
              className="ts-btn"
              style={S.filterBtn(filterStatus === s)}
              onClick={() => setFilter(s)}
            >
              {s === 'semua' ? 'Semua' : s === 'aktif' ? '✓ Aktif' : '✗ Nonaktif'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto' }}>
            <span style={S.countBadge}>{filtered.length} unit</span>
          </span>
          <button
            className="ts-btn"
            style={S.saveBtn}
            onClick={() => { setModalErr(''); setModal({ mode: 'tambah' }) }}
          >
            + Tambah Unit
          </button>
        </div>

        {/* ── Tabel ── */}
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 48 }}>No</th>
                <th style={S.th}>Nomor Unit</th>
                <th style={S.th}>Tipe Unit</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Keterangan</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={S.emptyRow}>⏳ Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={S.emptyRow}>
                  {units.length === 0 ? 'Belum ada data unit. Klik "+ Tambah Unit" untuk mulai.' : 'Tidak ada unit yang sesuai filter.'}
                </td></tr>
              ) : (
                filtered.map((u, i) => (
                  <tr
                    key={u.no}
                    style={{ cursor: 'default' }}
                    onMouseEnter={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = t.rowHover) }}
                    onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = i % 2 === 0 ? t.rowOdd : t.rowEven) }}
                  >
                    <td style={{ ...S.td(i), color: t.dim, textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ ...S.td(i), fontWeight: 700, color: t.title }}>{u.unit_wbs}</td>
                    <td style={{ ...S.td(i), color: t.subtitle }}>
                      {u.tipe_unit
                        ? <span style={{ background: t.tagBg, border: `1px solid ${t.tagBorder}`, color: t.tagColor, borderRadius: 6, padding: '2px 9px', fontSize: 11.5, fontWeight: 600 }}>{u.tipe_unit}</span>
                        : <span style={{ color: t.dim }}>—</span>}
                    </td>
                    <td style={S.td(i)}><BadgeStatus status={u.status} t={t} /></td>
                    <td style={{ ...S.td(i), color: t.subtitle, fontSize: 12 }}>{u.keterangan || <span style={{ color: t.dim }}>—</span>}</td>
                    <td style={{ ...S.td(i), textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="ts-btn"
                        style={{ ...S.actionBtn('edit'), marginRight: 6 }}
                        onClick={() => { setModalErr(''); setModal({ mode: 'edit', data: u }) }}
                      >✏ Edit</button>
                      <button
                        className="ts-btn"
                        style={S.actionBtn('del')}
                        onClick={() => { setDelErr(''); setDelTarget(u) }}
                      >🗑 Hapus</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Tambah / Edit ── */}
      {modal && (
        <UnitModal
          t={t}
          mode={modal.mode}
          initialData={modal.mode === 'edit' ? { ...modal.data } : undefined}
          existingNomors={existingNomors}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
          errMsg={modalErr}
        />
      )}

      {/* ── Modal Hapus ── */}
      {delTarget && (
        <DeleteModal
          t={t}
          unit={delTarget}
          onConfirm={handleDelete}
          onClose={() => setDelTarget(null)}
          deleting={deleting}
          errMsg={delErr}
        />
      )}

      {/* ── Toast notifikasi ── */}
      {toast && <div style={S.toast(toast.type)}>{toast.type === 'ok' ? '✅' : '⚠'} {toast.msg}</div>}
    </div>
  )
}