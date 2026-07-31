import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'

// ── Icon set kecil (inline SVG, tanpa dependency tambahan) ───────────────
const IconPlus = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const IconSave = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 3.5h11.5L19 6v14.5H5z" />
    <path d="M8 3.5V9h8V3.5M8 20.5V14h8v6.5" />
  </svg>
)

// ── AutocompleteInput: input teks bebas + dropdown saran ─────────────────
// Nilai bisa diketik, dihapus, di-blok, di-copy/paste seperti kolom jam & HM.
// Dropdown muncul otomatis saat focus/mengetik; pilih dengan ↑↓+Enter atau klik.
function AutocompleteInput({
  value, onChange, options, placeholder, inputStyle, selected,
  // Props navigasi sel (dari cell() atau manual)
  inputRef: inputRefProp,   // callback ref → cellRefs.current[key] = el
  tabIndex,
  onCellKeyDown,            // handleCellKey dari parent
  onCellFocus,              // setSel dari parent
  onPaste: onPasteProp,     // pasteToSel dari parent
}) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef(null)
  const dropRef  = useRef(null)
  const listRef  = useRef(null)

  // Daftarkan input ke cellRefs parent supaya focusCell() bisa memanggil .focus()/.select()
  useEffect(() => {
    if (inputRefProp && inputRef.current) inputRefProp(inputRef.current)
  }, [inputRefProp])

  // Filter saran: cocokkan value saat ini terhadap options
  const filtered = options.filter(o => !value || o.toLowerCase().includes(value.toLowerCase()))

  const openDrop = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: Math.max(rect.width, 200) })
    }
    setOpen(true)
  }
  const closeDrop = () => { setOpen(false); setActiveIdx(-1) }
  const selectItem = (item) => { onChange(item); closeDrop() }

  // Tutup saat klik di luar
  useEffect(() => {
    const h = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target) &&
          dropRef.current  && !dropRef.current.contains(e.target)) closeDrop()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Scroll item aktif ke view
  useEffect(() => {
    if (!listRef.current || activeIdx < 0) return
    listRef.current.querySelectorAll('[data-item]')[activeIdx]?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const handleKeyDown = (e) => {
    if (open) {
      // Navigasi di dalam dropdown
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp')   {
        e.preventDefault()
        if (activeIdx <= 0) { closeDrop(); return }
        setActiveIdx(i => Math.max(i - 1, 0)); return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (activeIdx >= 0 && filtered[activeIdx]) selectItem(filtered[activeIdx])
        else if (filtered.length === 1) selectItem(filtered[0])
        else closeDrop()
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); closeDrop(); return }
      // Tab, ArrowLeft, ArrowRight saat dropdown buka → dropdown TIDAK sedang dipakai
      // untuk memilih option (itu tugas ArrowUp/ArrowDown/Enter), jadi tutup dropdown
      // dan tetap pindah sel seperti biasa. Ini yang bikin navigasi Excel-style macet
      // sebelumnya karena dropdown hampir selalu dalam keadaan terbuka.
      if (e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        closeDrop()
        onCellKeyDown?.(e)
        return
      }
      // Key lain (mengetik huruf/angka, dst) → biarkan native
      return
    }
    // Dropdown tertutup → teruskan ke handleCellKey (navigasi antar sel, Ctrl+D, Shift+Arrow, dll)
    onCellKeyDown?.(e)
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); openDrop() }}
        onFocus={e => { onCellFocus?.(e); openDrop() }}
        onKeyDown={handleKeyDown}
        onPaste={e => {
          e.preventDefault()
          const v = e.clipboardData.getData('text').trim()
          // Coba paste ke blok seleksi via parent; jika sel tunggal → set langsung
          if (!onPasteProp?.(v)) { onChange(v); closeDrop() }
        }}
        placeholder={placeholder}
        tabIndex={tabIndex ?? 0}
        style={{
          ...inputStyle,
          // Highlight biru saat sel masuk dalam blok seleksi (sama persis kolom jam/HM)
          ...(selected ? { background: '#2C7A7B44', outline: '2px solid #3C6E71' } : {}),
        }}
      />
      {open && filtered.length > 0 && createPortal(
        <div ref={dropRef} style={{
          position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width,
          zIndex: 9999, background: '#1C1C1C', border: '1px solid #4a9aa0',
          borderRadius: 7, boxShadow: '0 6px 24px rgba(0,0,0,0.45)', overflow: 'hidden',
        }}>
          <div ref={listRef} style={{ maxHeight: 220, overflowY: 'auto' }}>
            {/* Tombol kosongkan */}
            <div onMouseDown={e => { e.preventDefault(); onChange(''); closeDrop() }}
              style={{ padding: '6px 10px', fontSize: 11, color: '#888', cursor: 'pointer', borderBottom: '1px solid #333' }}>
              — Kosongkan —
            </div>
            {filtered.slice(0, 30).map((item, idx) => {
              const isActive   = idx === activeIdx
              const isSelected = item === value || item.startsWith(value + ' —')
              return (
                <div
                  key={idx} data-item
                  onMouseDown={e => { e.preventDefault(); selectItem(item) }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    padding: '7px 10px', fontSize: 12, cursor: 'pointer',
                    color: isSelected ? '#3ac4cc' : '#F0F0F0',
                    background: isActive ? 'rgba(58,196,204,0.2)' : isSelected ? 'rgba(58,196,204,0.1)' : 'transparent',
                    fontWeight: isSelected ? 600 : 400,
                    borderLeft: isActive ? '2px solid #3ac4cc' : '2px solid transparent',
                  }}
                >{item}</div>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const ACTIVITY_CODES = [
  { kode: 'P5M', desc: 'P5M' },
  { kode: 'P2H', desc: 'Pemeriksaan Harian' },
  { kode: 'TRA', desc: 'Travel From Parking' },
  { kode: 'BREAK', desc: 'Rest Time' },
  { kode: 'WET', desc: 'Rain' },
  { kode: 'WAB', desc: 'Waiting Bongkaran' },
  { kode: 'CHS', desc: 'Change Shift' },
  { kode: 'WAC', desc: 'Waiting Stock Cargo' },
  { kode: 'FUELL', desc: 'Refueling' },
  { kode: 'NOPR', desc: 'No Operator' },
  { kode: 'USC', desc: 'Breakdown Unschedule' },
  { kode: 'SCH', desc: 'Breakdown Schedule' },
  { kode: 'BRW', desc: 'Loading To Barge' },
  { kode: 'HDW', desc: 'Handling To Stockpile' },
  { kode: 'RMW', desc: 'Road Maintenance' },
  { kode: 'GEW', desc: 'General Support' },
  { kode: 'MTW', desc: 'Moving Cargo' },
  { kode: 'HAW', desc: 'Coal Hauling' },
  { kode: 'ULW', desc: 'Unloading CY' },
  { kode: 'PRW', desc: 'Project' },
  { kode: 'NOJA', desc: 'Standby' },
  { kode: 'WBG', desc: 'Waiting Barge' },
]

function hitungTotal(start, end) {
  if (!start || !end || !start.includes(':') || !end.includes(':')) return '-'
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '-'
  let startMin = sh * 60 + sm
  let endMin = eh * 60 + em
  if (endMin < startMin) endMin += 24 * 60
  const result = (endMin - startMin) / 60
  return result >= 0 ? result.toFixed(2) : '-'
}

let rowIdSeq = 0
const newRowId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `row-${Date.now()}-${++rowIdSeq}`

const emptyRow = () => ({
  id: newRowId(),
  no_urut: 1,
  owner: 'WBS',
  operator: '',
  equipment: '',
  number: '',
  location: 'TJB',
  activity_code: 'P5M',
  activity_desc: 'P5M',
  time_start: '',
  time_end: '',
  hm_start: '',
  hm_finish: '',
  remark: '',
})

const THEME = {
  dark: {
    app:        '#10151A',
    card:       '#171D23',
    panelBg:    '#151B21',
    cardBorder: '#262E36',
    headerLine: '#3C6E71',
    title:      '#F2F4F5',
    subtitle:   '#9AA5AC',
    label:      '#8A959D',
    tagBg:      '#1B3538',
    tagColor:   '#6FB3B7',
    tagBorder:  '#2C5254',
    inputBg:    '#1D242B',
    inputBorder:'#2E3841',
    inputColor: '#EDEFF0',
    focusBorder:'#4CA3A8',
    focusRing:  'rgba(76,163,168,0.22)',
    selectBg:   '#1B2128',
    thBg:       '#1E3236',
    thBg2:      '#264145',
    thColor:    '#EAF3F3',
    thBorder:   '#0E1215',
    tdBorder:   '#1E252B',
    rowEven:    '#1B2127',
    rowHover:   '#202832',
    noColor:    '#6FB3B7',
    badgeValBg: '#1B3538',
    badgeValColor:'#6FB3B7',
    badgeValBorder:'#2C5254',
    badgeNilBg: '#20272E',
    badgeNilColor:'#5A646C',
    badgeNilBorder:'#2A323A',
    btnAddBg:   'rgba(76,163,168,0.14)',
    btnAddColor:'#7AC6CA',
    btnAddBorder:'rgba(76,163,168,0.40)',
    btnSaveBg:  '#2F7A72',
    btnSaveBorder:'#2F7A72',
    btnSaveColor:'#F4FBFA',
    btnDelBg:   '#20272E',
    btnDelBorder:'#2E3841',
    btnDelColor:'#8FA0A6',
    toggleBg:   '#1B2128',
    toggleBorder:'#2E3841',
    toggleColor:'#B7C1C7',
    successBg:  '#12241C',
    successBorder:'#255C42',
    successColor:'#5FCB8C',
    dim:        '#5C666D',
    scrollbar:  '#2E3841',
    shift1: { text: '#4ADE80', bg: 'rgba(22,163,74,0.08)', bgStrong: 'rgba(22,163,74,0.18)', border: 'rgba(22,163,74,0.35)' },
    shift2: { text: '#60A5FA', bg: 'rgba(37,99,235,0.08)', bgStrong: 'rgba(37,99,235,0.18)', border: 'rgba(37,99,235,0.35)' },
  },
  light: {
    app:        '#F4F5F6',
    card:       '#FFFFFF',
    panelBg:    '#FBFCFC',
    cardBorder: '#E2E6E9',
    headerLine: '#3C6E71',
    title:      '#1B2226',
    subtitle:   '#5B6770',
    label:      '#66727A',
    tagBg:      '#E3F1F1',
    tagColor:   '#2C5254',
    tagBorder:  '#BFDEDE',
    inputBg:    '#FFFFFF',
    inputBorder:'#D7DCE0',
    inputColor: '#1B2226',
    focusBorder:'#3C8C8F',
    focusRing:  'rgba(60,140,143,0.15)',
    selectBg:   '#FFFFFF',
    thBg:       '#3C6E71',
    thBg2:      '#335D60',
    thColor:    '#FFFFFF',
    thBorder:   '#2C5254',
    tdBorder:   '#EDEFF1',
    rowEven:    '#F7F9FA',
    rowHover:   '#EFF4F4',
    noColor:    '#2C5254',
    badgeValBg: '#E3F1F1',
    badgeValColor:'#2C5254',
    badgeValBorder:'#BFDEDE',
    badgeNilBg: '#F1F2F3',
    badgeNilColor:'#9AA4AA',
    badgeNilBorder:'#E2E6E9',
    btnAddBg:   'rgba(60,110,113,0.08)',
    btnAddColor:'#2C5254',
    btnAddBorder:'rgba(60,110,113,0.35)',
    btnSaveBg:  '#2C5254',
    btnSaveBorder:'#2C5254',
    btnSaveColor:'#FFFFFF',
    btnDelBg:   '#F1F2F3',
    btnDelBorder:'#E2E6E9',
    btnDelColor:'#5B6770',
    toggleBg:   '#FFFFFF',
    toggleBorder:'#D7DCE0',
    toggleColor:'#43505A',
    successBg:  '#EAF7EE',
    successBorder:'#A9DBB6',
    successColor:'#227C43',
    dim:        '#9AA4AA',
    scrollbar:  '#D7DCE0',
    shift1: { text: '#16A34A', bg: 'rgba(22,163,74,0.06)', bgStrong: 'rgba(22,163,74,0.13)', border: 'rgba(22,163,74,0.30)' },
    shift2: { text: '#2563EB', bg: 'rgba(37,99,235,0.06)', bgStrong: 'rgba(37,99,235,0.13)', border: 'rgba(37,99,235,0.30)' },
  },
}

function makeStyles(t) {
  return {
    app: {
      minHeight: '100vh',
      background: t.app,
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
      padding: 0,
      color: t.title,
      transition: 'background 0.25s, color 0.25s',
      boxSizing: 'border-box',
      '--focus-border': t.focusBorder,
      '--focus-ring': t.focusRing,
      '--scrollbar': t.scrollbar,
    },
    card: {
      background: t.app,
      borderRadius: 0,
      border: 'none',
      padding: '22px 32px 32px',
      width: '100%',
      minHeight: '100vh',
      boxSizing: 'border-box',
      transition: 'background 0.25s, border-color 0.25s',
    },

    // ── Header ──────────────────────────────────────────
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 20,
      borderBottom: `1px solid ${t.cardBorder}`,
      paddingBottom: 14,
    },
    logoWrap: {
      width: 44,
      height: 44,
      borderRadius: 10,
      overflow: 'hidden',
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      padding: 4,
      boxSizing: 'border-box',
      border: `1px solid ${t.cardBorder}`,
    },
    logoImg: { width: '100%', height: '100%', objectFit: 'contain' },
    title: { margin: 0, fontSize: 21, fontWeight: 800, color: t.title, letterSpacing: -0.3 },
    subtitle: { margin: '0 0 2px', fontSize: 10.5, color: t.subtitle, fontWeight: 600, letterSpacing: 1.1, textTransform: 'uppercase' },
    headerRight: { marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' },
    tag: {
      display: 'inline-block', padding: '4px 11px', borderRadius: 6,
      fontSize: 11, fontWeight: 600,
      background: t.tagBg, color: t.tagColor, border: `1px solid ${t.tagBorder}`,
    },
    toggleBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
      background: t.toggleBg, border: `1px solid ${t.toggleBorder}`,
      color: t.toggleColor, cursor: 'pointer', transition: 'all 0.15s',
    },

    // ── Control panel (filter area) ─────────────────────
    panel: {
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 18, flexWrap: 'wrap',
      background: t.panelBg, border: `1px solid ${t.cardBorder}`,
      borderRadius: 12, padding: '16px 20px', marginBottom: 20,
    },
    formRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
    label: { fontSize: 10.5, fontWeight: 700, color: t.label, textTransform: 'uppercase', letterSpacing: 0.7 },
    input: {
      background: t.inputBg, border: `1px solid ${t.inputBorder}`,
      borderRadius: 8, padding: '8px 12px', color: t.inputColor,
      fontSize: 13, outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
      fontFamily: 'inherit',
    },
    select: {
      background: t.selectBg, border: `1px solid ${t.inputBorder}`,
      borderRadius: 8, padding: '8px 12px', color: t.inputColor,
      fontSize: 13, outline: 'none', cursor: 'pointer', transition: 'border-color 0.15s',
      fontFamily: 'inherit',
    },

    // ── Shift legend / selector chips ───────────────────
    legendRow: { display: 'flex', gap: 10, alignItems: 'center' },
    legendChip: (active, kind) => ({
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '7px 14px 7px 12px', borderRadius: 10,
      background: active ? kind.bgStrong : 'transparent',
      border: `1px solid ${active ? kind.border : t.cardBorder}`,
      color: active ? kind.text : t.dim,
      cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
    }),
    legendIconWrap: (active, kind) => ({
      width: 26, height: 26, borderRadius: 7, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? kind.bg : 'transparent',
      color: active ? kind.text : t.dim,
    }),
    legendLabel: { fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.3 },
    legendTime: { fontSize: 10, fontWeight: 500, opacity: 0.75, letterSpacing: 0.2 },

    // ── Table ────────────────────────────────────────────
    tableWrapper: {
      overflowX: 'auto', overflowY: 'visible', borderRadius: 12,
      border: `1px solid ${t.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
    },
    table: { width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 },
    th: {
      position: 'sticky', top: 0, zIndex: 2,
      background: t.thBg, color: t.thColor,
      padding: '11px 7px', textAlign: 'center', fontWeight: 700,
      fontSize: 10, lineHeight: 1.3, letterSpacing: 0.6, textTransform: 'uppercase',
      borderBottom: `1px solid ${t.thBorder}`,
      borderRight: `1px solid rgba(255,255,255,0.10)`,
      whiteSpace: 'normal', wordBreak: 'break-word',
    },
    thSub: {
      position: 'sticky', top: 36, zIndex: 2,
      background: t.thBg2, color: t.thColor,
      padding: '7px 7px', textAlign: 'center', fontWeight: 600,
      fontSize: 9.5, lineHeight: 1.3, letterSpacing: 0.5, textTransform: 'uppercase',
      borderBottom: `1px solid ${t.thBorder}`,
      borderRight: `1px solid rgba(255,255,255,0.10)`,
    },
    td: {
      padding: '8px 5px',
      borderBottom: `1px solid ${t.tdBorder}`,
      borderRight: `1px solid ${t.tdBorder}`,
      textAlign: 'center', verticalAlign: 'middle',
    },
    tdNum: { fontVariantNumeric: 'tabular-nums' },
    tdInput: {
      background: t.inputBg, border: `1px solid ${t.inputBorder}`,
      borderRadius: 6, padding: '6px 8px', color: t.inputColor,
      fontSize: 12.5, width: '100%', outline: 'none', boxSizing: 'border-box',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
    },
    tdSelect: {
      background: t.selectBg, border: `1px solid ${t.inputBorder}`,
      borderRadius: 6, padding: '6px 4px', color: t.inputColor,
      fontSize: 11, width: '100%', outline: 'none', cursor: 'pointer',
      transition: 'border-color 0.15s', fontFamily: 'inherit',
    },
    focusGlow: { borderColor: t.focusBorder, boxShadow: `0 0 0 3px ${t.focusRing}` },

    // ── Buttons ──────────────────────────────────────────
    btnAdd: {
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: t.btnAddBg, border: `1px solid ${t.btnAddBorder}`, borderRadius: 8,
      padding: '9px 16px', color: t.btnAddColor, fontWeight: 700, fontSize: 12.5,
      cursor: 'pointer', transition: 'filter 0.15s, transform 0.05s', fontFamily: 'inherit',
    },
    btnSave: {
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: t.btnSaveBg, border: `1px solid ${t.btnSaveBorder}`,
      borderRadius: 8, padding: '9px 18px', color: t.btnSaveColor,
      fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
      transition: 'filter 0.15s, transform 0.05s', fontFamily: 'inherit',
      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
    },
    btnDel: {
      background: t.btnDelBg, border: `1px solid ${t.btnDelBorder}`,
      borderRadius: 6, padding: '4px 8px', color: t.btnDelColor,
      cursor: 'pointer', fontSize: 13, transition: 'filter 0.15s',
    },
    badge: (val) => ({
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
      background: val === '-' ? t.badgeNilBg : t.badgeValBg,
      color: val === '-' ? t.badgeNilColor : t.badgeValColor,
      border: `1px solid ${val === '-' ? t.badgeNilBorder : t.badgeValBorder}`,
    }),
    shiftBadge: (kind) => ({
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px 3px 6px', borderRadius: 20,
      fontSize: 10.5, fontWeight: 700,
      background: kind.bg, color: kind.text, border: `1px solid ${kind.border}`,
      whiteSpace: 'nowrap',
    }),
    successBanner: {
      marginTop: 16, padding: '12px 16px',
      background: t.successBg, border: `1px solid ${t.successBorder}`,
      borderRadius: 10, color: t.successColor, fontWeight: 600, fontSize: 13,
    },
    rowEven: (kind) => ({ background: kind ? kind.bg : t.rowEven }),
    rowOdd:  { background: 'transparent' },
    rowAccent: (kind) => ({ boxShadow: `inset 3px 0 0 0 ${kind.border}` }),
    noColor: { color: t.noColor, fontWeight: 700 },
    dim:     { fontSize: 12, color: t.dim, marginLeft: 'auto' },
  }
}

export default function App() {
  const [isDark, setIsDark] = useState(true)
  const [tanggal, setTanggal] = useState('')
  const [shift, setShift] = useState('1')
  const [rows, setRows] = useState([emptyRow()])
  const [loading, setLoading] = useState(false)
  const [sukses, setSukses] = useState(false)
  const [penginput, setPenginput] = useState('')
  const [listPenginput, setListPenginput] = useState([])
  const [listUnit, setListUnit] = useState([])
  const [operatorMap, setOperatorMap] = useState({})
  // Seleksi 2D seperti Excel: { rowAnchor, rowEnd, colAnchor, colEnd }
  const [sel, setSel] = useState(null)
  const cellRefs = useRef({})
  const dragRef  = useRef(null) // { active: bool, startRow, startCol }

  // ── Undo / Redo history ───────────────────────────────────────────────────
  const historyRef = useRef([])   // stack of rows snapshots
  const futureRef  = useRef([])   // stack for redo
  const MAX_HISTORY = 50

  // Wrap setRows agar setiap perubahan tersimpan ke history
  const setRowsWithHistory = (updater) => {
    setRows(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (JSON.stringify(next) === JSON.stringify(prev)) return prev // no-op
      historyRef.current = [...historyRef.current.slice(-MAX_HISTORY), prev]
      futureRef.current = []
      return next
    })
  }

  const undo = () => {
    if (historyRef.current.length === 0) return
    const prev = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    setRows(cur => { futureRef.current = [...futureRef.current, cur]; return prev })
  }

  const redo = () => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    setRows(cur => { historyRef.current = [...historyRef.current, cur]; return next })
  }

  // ── Mouse drag selection (Excel-like) ──────────────────────────────────────
  const onCellMouseDown = (e, rowIdx, colName) => {
    if (e.button !== 0) return // left click only
    const ci = NAV_COLS.indexOf(colName)
    if (ci < 0) return
    dragRef.current = { active: true, startRow: rowIdx, startCol: ci }
    setSel({ rA: rowIdx, rE: rowIdx, cA: ci, cE: ci })
    // Focus the cell
    const el = cellRefs.current[`${rowIdx}-${colName}`]
    if (el) { el.focus(); el.select?.() }
  }

  const onCellMouseEnter = (e, rowIdx, colName) => {
    if (!dragRef.current?.active) return
    const ci = NAV_COLS.indexOf(colName)
    if (ci < 0) return
    setSel({
      rA: dragRef.current.startRow,
      rE: rowIdx,
      cA: dragRef.current.startCol,
      cE: ci,
    })
  }

  const onCellMouseUp = () => {
    if (dragRef.current) dragRef.current.active = false
  }

  // Kolom yang bisa diblok/paste/hapus/fill-down (operator, equipment, activity ikut serta)
  const FILL_COLS = ['operator','equipment','activity_code','time_start','time_end','hm_start','hm_finish']
  const COL_ORDER = ['owner','operator','equipment','number','activity_code','location','time_start','time_end','hm_start','hm_finish','remark']
  const NAV_COLS = ['owner','operator','equipment','number','activity_code','location','time_start','time_end','hm_start','hm_finish','remark']

  const focusCell = (rowIdx, colName) => {
    const el = cellRefs.current[`${rowIdx}-${colName}`]
    if (el) {
      el.focus()
      el.select?.()
    } else {
      // Coba kolom terdekat yang ada jika tidak ditemukan
      const cols = NAV_COLS
      const ci = cols.indexOf(colName)
      if (ci < 0) return
      // cari ke kanan
      for (let j = ci + 1; j < cols.length; j++) {
        const fallback = cellRefs.current[`${rowIdx}-${cols[j]}`]
        if (fallback) { fallback.focus(); fallback.select?.(); return }
      }
      // cari ke kiri
      for (let j = ci - 1; j >= 0; j--) {
        const fallback = cellRefs.current[`${rowIdx}-${cols[j]}`]
        if (fallback) { fallback.focus(); fallback.select?.(); return }
      }
    }
  }

  // Apakah cell ini dalam seleksi 2D?
  const isSel = (rowIdx, colName) => {
    if (!sel) return false
    const rLo = Math.min(sel.rA, sel.rE)
    const rHi = Math.max(sel.rA, sel.rE)
    const cLo = Math.min(sel.cA, sel.cE)
    const cHi = Math.max(sel.cA, sel.cE)
    const ci = NAV_COLS.indexOf(colName)
    return rowIdx >= rLo && rowIdx <= rHi && ci >= cLo && ci <= cHi
  }

  // Hapus isi semua sel dalam seleksi (Delete/Backspace saat blok > 1 sel)
  const clearSel = () => {
    if (!sel) return
    const rLo = Math.min(sel.rA, sel.rE)
    const rHi = Math.max(sel.rA, sel.rE)
    const cLo = Math.min(sel.cA, sel.cE)
    const cHi = Math.max(sel.cA, sel.cE)
    if (rHi === rLo && cHi === cLo) return // hanya 1 sel, biarkan native
    setRowsWithHistory(prev => prev.map((r, ri) => {
      if (ri < rLo || ri > rHi) return r
      const updated = { ...r }
      for (let ci = cLo; ci <= cHi; ci++) {
        const f = COL_ORDER[ci]
        if (FILL_COLS.includes(f)) updated[f] = ""
      }
      return updated
    }))
  }

  // Format jam: hanya konversi jika sudah lengkap (paste), biarkan typing bebas
  const fmtTime = (v) => {
    const s = String(v).trim()
    if (s.length === 4 && !s.includes(':')) return s.slice(0,2)+':'+s.slice(2)
    if (s.includes(':')) return s.slice(0,5)
    return s
  }

  // Normalisasi angka: ganti koma dengan titik
  const fmtNum = (v) => String(v).trim().replace(',', '.')

  // Paste nilai ke semua sel dalam seleksi 2D
  const pasteToSel = (rowIdx, colName, value) => {
    if (!sel) return false
    const rLo = Math.min(sel.rA, sel.rE)
    const rHi = Math.max(sel.rA, sel.rE)
    const cLo = Math.min(sel.cA, sel.cE)
    const cHi = Math.max(sel.cA, sel.cE)
    const ci = COL_ORDER.indexOf(colName)
    // Hanya paste jika multi-sel (lebih dari 1 sel)
    const isMulti = (rHi > rLo) || (cHi > cLo)
    if (!isMulti) return false
    // Jika cell ini ada dalam seleksi, paste ke semua sel seleksi
    if (rowIdx >= rLo && rowIdx <= rHi && ci >= cLo && ci <= cHi) {
      setRowsWithHistory(prev => prev.map((r, ri) => {
        if (ri < rLo || ri > rHi) return r
        const updated = { ...r }
        for (let ci2 = cLo; ci2 <= cHi; ci2++) {
          const f = COL_ORDER[ci2]
          if (!FILL_COLS.includes(f)) continue
          if (f === 'time_start' || f === 'time_end') updated[f] = fmtTime(value)
          else if (f === 'operator' || f === 'equipment') updated[f] = value
          else if (f === 'activity_code') {
            // Terima kode langsung ("P2H") atau format panjang ("P2H — Pemeriksaan Harian")
            const kode = value.includes(' — ') ? value.split(' — ')[0] : value
            updated['activity_code'] = kode
            const found = ACTIVITY_CODES.find(a => a.kode === kode)
            if (found) updated['activity_desc'] = found.desc
          }
          else updated[f] = fmtNum(value)
        }
        return updated
      }))
      return true
    }
    return false
  }

  const handleCellKey = (e, rowIdx, colName) => {
    const colIdx = COL_ORDER.indexOf(colName)


    // Delete/Backspace → hapus semua sel dalam blok seleksi
    if ((e.key === "Delete" || e.key === "Backspace") && FILL_COLS.includes(colName)) {
      if (sel && (Math.abs(sel.rA - sel.rE) > 0 || Math.abs(sel.cA - sel.cE) > 0)) {
        e.preventDefault()
        clearSel()
        return
      }
    }
    // Ctrl+D → fill down SEMUA kolom dari baris anchor ke seluruh baris dalam seleksi (Excel-like)
    if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault()
      // Tentukan range: gunakan seleksi jika ada, atau dari rowIdx ke rowIdx+1
      const rLo = sel ? Math.min(sel.rA, sel.rE) : rowIdx
      const rHi = sel ? Math.max(sel.rA, sel.rE) : Math.min(rows.length - 1, rowIdx + 1)
      const srcRow = rows[rLo] // baris paling atas sebagai sumber
      if (rHi <= rLo) return   // tidak ada baris tujuan
      setRowsWithHistory(prev => prev.map((r, idx) => {
        if (idx <= rLo || idx > rHi) return r // skip baris sumber & di luar range
        const updated = { ...r }
        FILL_COLS.forEach(f => {
          if (f === 'time_start' || f === 'time_end') updated[f] = srcRow[f]
          else if (f === 'activity_code') {
            updated.activity_code = srcRow.activity_code
            updated.activity_desc = srcRow.activity_desc
          } else {
            updated[f] = srcRow[f]
          }
        })
        return updated
      }))
      return
    }

    // Shift+Arrow → extend seleksi 2D
    if (e.shiftKey && ['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault()
      const navIdx2 = NAV_COLS.indexOf(colName)
      setSel(prev => {
        const base = prev ?? { rA: rowIdx, rE: rowIdx, cA: navIdx2, cE: navIdx2 }
        let { rA, rE, cA, cE } = base
        if (e.key === 'ArrowDown')  rE = Math.min(rows.length - 1, rE + 1)
        if (e.key === 'ArrowUp')    rE = Math.max(0, rE - 1)
        if (e.key === 'ArrowRight') cE = Math.min(NAV_COLS.length - 1, cE + 1)
        if (e.key === 'ArrowLeft')  cE = Math.max(0, cE - 1)
        return { rA, rE, cA, cE }
      })
      return
    }

    const navIdx = NAV_COLS.indexOf(colName)
    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      if (navIdx < NAV_COLS.length - 1) {
        focusCell(rowIdx, NAV_COLS[navIdx + 1])
      } else if (rowIdx < rows.length - 1) {
        // ujung kanan → pindah ke baris berikut, kolom paling kiri
        focusCell(rowIdx + 1, NAV_COLS[0])
      }
    } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault()
      if (navIdx > 0) {
        focusCell(rowIdx, NAV_COLS[navIdx - 1])
      } else if (rowIdx > 0) {
        // ujung kiri → pindah ke baris sebelumnya, kolom paling kanan
        focusCell(rowIdx - 1, NAV_COLS[NAV_COLS.length - 1])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); if (rowIdx < rows.length - 1) focusCell(rowIdx + 1, colName)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); if (rowIdx > 0) focusCell(rowIdx - 1, colName)
    } else if (e.key === 'Enter') {
      e.preventDefault(); if (rowIdx < rows.length - 1) focusCell(rowIdx + 1, colName)
    }
  }

  // Mapping kode unit prefix → {tabel, kolom}
  const UNIT_TABLE_MAP = [
    { prefix: ['fd'],          tabel: 'daftar_nama_driver_fd',         kolom: 'nama_driver_fd' },
    { prefix: ['dt'],          tabel: 'daftar_nama_driver_dt',         kolom: 'nama_driver_dt' },
    { prefix: ['wt'],          tabel: 'daftar_nama_driver_wt',         kolom: 'nama_driver_wt' },
    { prefix: ['blc','ogf'],   tabel: 'daftar_nama_operator_blc_ogf',  kolom: 'nama_operator_blc_ogf' },
    { prefix: ['dz'],          tabel: 'daftar_nama_operator_dz',       kolom: 'nama_operator_dz' },
    { prefix: ['ex'],          tabel: 'daftar_nama_operator_exa',      kolom: 'nama_operator_exa' },
    { prefix: ['rs','fl'],     tabel: 'daftar_nama_operator_rs_fl',    kolom: 'nama_operator_rs_fl' },
    { prefix: ['mg','vc'],     tabel: 'daftar_nama_operator_vc_mg',    kolom: 'nama_operator_vc_mg' },
    { prefix: ['wl'],          tabel: 'daftar_nama_operator_wl',       kolom: 'nama_operator_wl' },
  ]

  const getUnitGroup = (unitCode) => {
    if (!unitCode) return null
    const code = unitCode.toLowerCase()
    return UNIT_TABLE_MAP.find(m => m.prefix.some(p => code.startsWith(p))) || null
  }

  const getOperatorList = (unitCode) => {
    const group = getUnitGroup(unitCode)
    if (!group) return []
    return operatorMap[group.tabel] || []
  }

  // ── Global keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo) ─────────────
  useEffect(() => {
    const handler = (e) => {
      // Ctrl+Z → undo row state (selalu aktif, override native browser undo)
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        undo()
        return
      }
      // Ctrl+Y atau Ctrl+Shift+Z → redo
      if ((e.ctrlKey && (e.key === 'y' || e.key === 'Y')) ||
          (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
        e.preventDefault()
        e.stopPropagation()
        redo()
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    // Fetch penginput
    supabase.from('nama_penginput_timesheet').select('no, nama_penginput').order('no', { ascending: true })
      .then(({ data }) => { if (data) setListPenginput(data.map(p => ({ ...p, nama_penginput: p.nama_penginput?.toUpperCase() }))) })

    // Fetch unit list
    supabase.from('unit_wbs').select('no, unit_wbs').order('no', { ascending: true })
      .then(({ data }) => { if (data) setListUnit(data) })

    // Fetch semua tabel operator sekaligus
    const fetchAll = UNIT_TABLE_MAP.map(({ tabel, kolom }) =>
      supabase.from(tabel).select(`no, ${kolom}`).order('no', { ascending: true })
        .then(({ data }) => ({ tabel, kolom, data: data || [] }))
    )
    Promise.all(fetchAll).then(results => {
      const map = {}
      results.forEach(({ tabel, kolom, data }) => {
        map[tabel] = data.map(d => d[kolom]?.toUpperCase()).filter(Boolean)
      })
      setOperatorMap(map)
    })
  }, [])

  const t = THEME[isDark ? 'dark' : 'light']
  const S = makeStyles(t)
  // Kind warna aktif berdasarkan Shift yang dipilih (dipakai untuk badge, accent border kiri, dan tint row)
  const shiftKind = shift === '2' ? t.shift2 : t.shift1

  const updateRow = (i, field, value) => {
    // Functional update: selalu berdasarkan state TERBARU (prev), bukan closure `rows`
    // yang bisa basi. Setiap row di-spread jadi object baru (immutable), jadi field lain
    // pada row yang sama (mis. operator) tidak pernah ikut ter-reset saat field lain diubah.
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r

      if (field === 'activity_code') {
        // value bisa "P5M — P5M" atau cukup "P5M"
        const kode = value.includes(' — ') ? value.split(' — ')[0] : value
        const found = ACTIVITY_CODES.find(a => a.kode === kode)
        return { ...r, activity_code: kode, activity_desc: found ? found.desc : '' }
      }

      if (field === 'equipment') {
        // Reset operator HANYA jika unit berpindah ke grup operator yang berbeda
        // (mis. dari DZ ke EX). Mengetik ulang/koreksi typo pada unit dengan prefix
        // yang sama tidak lagi menghapus operator yang sudah dipilih.
        const oldGroup = getUnitGroup(r.equipment)
        const newGroup = getUnitGroup(value)
        const sameGroup = oldGroup && newGroup && oldGroup.tabel === newGroup.tabel
        return { ...r, equipment: value, operator: sameGroup ? r.operator : '' }
      }

      return { ...r, [field]: value }
    }))
  }

  const tambahRow = () => {
    const last = rows[rows.length - 1]
    setRowsWithHistory([...rows, {
      ...emptyRow(),
      no_urut: rows.length + 1,
      owner: last.owner,
      operator: last.operator,
      equipment: last.equipment,
      location: last.location,
    }])
  }

  const hapusRow = (i) => {
    if (rows.length === 1) return
    const updated = rows.filter((_, idx) => idx !== i)
    setRowsWithHistory(updated.map((r, idx) => ({ ...r, no_urut: idx + 1 })))
  }

  // Sisip baris kosong di bawah baris i, copy owner/equipment/location/operator
  const sisipRow = (i) => {
    const src = rows[i]
    const baru = {
      ...emptyRow(),
      owner: src.owner,
      operator: src.operator,
      equipment: src.equipment,
      location: src.location,
    }
    const updated = [...rows.slice(0, i + 1), baru, ...rows.slice(i + 1)]
    setRowsWithHistory(updated.map((r, idx) => ({ ...r, no_urut: idx + 1 })))
  }

  // Fill-down: isi baris bawah dengan nilai baris i pada field tertentu
  const fillDown = (i, field, value) => {
    setRows(prev => prev.map((r, idx) => {
      if (idx <= i) return r
      if (field === 'time_start' || field === 'time_end') {
        const fmt = value.includes(':') ? value.slice(0,5) : value.length===4 ? value.slice(0,2)+':'+value.slice(2) : value
        return { ...r, [field]: fmt }
      }
      return { ...r, [field]: value }
    }))
  }

  const simpan = async () => {
    if (!tanggal) return alert('Isi tanggal dulu!')
    setLoading(true)
    const { data: header, error: errHeader } = await supabase
      .from('timesheet_header')
      .insert({ tanggal, shift: parseInt(shift), owner: rows[0]?.owner || 'WBS', location: rows[0]?.location || 'TJB', penginput })
      .select()
      .single()
    if (errHeader) { alert('Error: ' + errHeader.message); setLoading(false); return }
    const details = rows.map(r => ({
      header_id: header.id,
      no_urut: r.no_urut,
      owner: r.owner,
      operator: r.operator,
      equipment: r.equipment,
      number: r.number ? parseInt(r.number) : null,
      location: r.location,
      activity_code: r.activity_code,
      activity_desc: r.activity_desc,
      time_start: r.time_start || null,
      time_end: r.time_end || null,
      total_hours: r.time_start && r.time_end ? parseFloat(hitungTotal(r.time_start, r.time_end)) : null,
      hm_start: r.hm_start ? parseFloat(r.hm_start) : null,
      hm_finish: r.hm_finish ? parseFloat(r.hm_finish) : null,
      total_hm: r.hm_start && r.hm_finish ? parseFloat(r.hm_finish) - parseFloat(r.hm_start) : null,
      remark: r.remark,
    }))
    const { error: errDetail } = await supabase.from('timesheet_detail').insert(details)
    if (errDetail) { alert('Error detail: ' + errDetail.message) }
    else { setSukses(true); historyRef.current = []; futureRef.current = []; setRows([emptyRow()]); setTimeout(() => setSukses(false), 4000) }
    setLoading(false)
  }

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
            <h1 style={S.title}>Input Timesheet</h1>
          </div>
          <div style={S.headerRight}>
            <button className="ts-btn" style={S.toggleBtn} onClick={() => setIsDark(!isDark)}>
              {isDark ? 'Siang' : 'Malam'}
            </button>
          </div>
        </div>

        {/* Control panel: filter + shift selector */}
        <div style={S.panel}>
          <div style={S.formRow}>
            <div style={S.formGroup}>
              <label style={S.label}>Tanggal</label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} style={S.input} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Penginput</label>
              <select value={penginput} onChange={e => setPenginput(e.target.value)} style={{ ...S.select, minWidth: 200 }}>
                <option value="">— Pilih Penginput —</option>
                {listPenginput.map(p => (
                  <option key={p.no} value={p.nama_penginput}>{p.nama_penginput}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Shift selector — clean minimal toggle */}
          <div style={S.formGroup}>
            <label style={S.label}>Shift</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['1','2'].map(s => {
                const k = s === '2' ? t.shift2 : t.shift1
                const active = shift === s
                return (
                  <button key={s} className="ts-btn"
                    onClick={() => setShift(s)}
                    style={{
                      padding: '7px 22px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                      border: `1.5px solid ${active ? k.text : k.border}`,
                      background: active ? k.bgStrong : 'transparent',
                      color: active ? k.text : t.subtitle,
                      cursor: 'pointer', letterSpacing: 0.3, transition: 'all 0.15s',
                    }}
                  >
                    Shift {s}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={S.tableWrapper}>
          <table style={S.table}>
            <colgroup>
              <col style={{ width: '5%' }} />  {/* Date */}
              <col style={{ width: '4%' }} />  {/* Shift */}
              <col style={{ width: '4%' }} />  {/* Owner */}
              <col style={{ width: '10%' }} /> {/* Operator */}
              <col style={{ width: '7%' }} />  {/* Equipment */}
              <col style={{ width: '4%' }} />  {/* Number */}
              <col style={{ width: '5%' }} />  {/* Activity code */}
              <col style={{ width: '5%' }} />  {/* Location */}
              <col style={{ width: '5%' }} />  {/* Start */}
              <col style={{ width: '5%' }} />  {/* End */}
              <col style={{ width: '4%' }} />  {/* Total */}
              <col style={{ width: '6%' }} />  {/* KWH/HM Start */}
              <col style={{ width: '6%' }} />  {/* KWH/HM Finish */}
              <col style={{ width: '5%' }} />  {/* Total KWH/HM */}
              <col style={{ width: '12%' }} /> {/* Activity desc */}
              <col style={{ width: '10%' }} /> {/* Remark */}
              <col style={{ width: '5%' }} />  {/* Aksi */}
            </colgroup>
            <thead>
              <tr>
                <th style={S.th} rowSpan={2}>Date</th>
                <th style={S.th} rowSpan={2}>Shift</th>
                <th style={S.th} rowSpan={2}>Owner</th>
                <th style={S.th} rowSpan={2}>Operator</th>
                <th style={S.th} rowSpan={2}>Equipment</th>
                <th style={{ ...S.th, whiteSpace: 'nowrap' }} rowSpan={2}>Number</th>
                <th style={S.th} rowSpan={2}>Activity</th>
                <th style={S.th} rowSpan={2}>Location</th>
                <th style={{ ...S.th, letterSpacing: 1.2, background: t.thBg }} colSpan={3}>Time Operation</th>
                <th style={S.th} rowSpan={2}>KWH/HM Start</th>
                <th style={S.th} rowSpan={2}>KWH/HM Finish</th>
                <th style={S.th} rowSpan={2}>Total KWH/HM</th>
                <th style={S.th} rowSpan={2}>Activity</th>
                <th style={S.th} rowSpan={2}>Remark</th>
                <th style={S.th} rowSpan={2}></th>
              </tr>
              <tr>
                <th style={S.thSub}>Start</th>
                <th style={S.thSub}>End</th>
                <th style={S.thSub}>Total</th>
              </tr>
            </thead>
            <tbody onMouseLeave={onCellMouseUp}>
              {rows.map((row, i) => {
                const total = hitungTotal(row.time_start, row.time_end)
                const totalHM = row.hm_start && row.hm_finish
                  ? (parseFloat(row.hm_finish) - parseFloat(row.hm_start)).toFixed(1)
                  : '-'
                const cell = (col) => ({
                  ref: el => { if (el) cellRefs.current[`${i}-${col}`] = el },
                  tabIndex: 0,
                  onKeyDown: e => handleCellKey(e, i, col),
                  onFocus: e => {
                    if (!e.shiftKey) {
                      setSel({ rA: i, rE: i, cA: NAV_COLS.indexOf(col), cE: NAV_COLS.indexOf(col) })
                    }
                  },
                })
                return (
                  <tr key={row.id} style={i % 2 === 0 ? S.rowEven(shiftKind) : S.rowOdd} onMouseUp={onCellMouseUp}>
                    {/* Date — readonly dari form header. Accent bar kiri menandakan Shift aktif */}
                    <td style={{ ...S.td, ...S.rowAccent(shiftKind), fontSize: 11, color: t.subtitle }}>{tanggal || '—'}</td>
                    {/* Shift — readonly dari form header, ditampilkan sebagai badge */}
                    <td style={S.td}>
                      <span style={S.shiftBadge(shiftKind)}>
                        {shift}
                      </span>
                    </td>
                    <td style={S.td}>
                      <input
                        value={row.owner}
                        onChange={e => updateRow(i, 'owner', e.target.value)}
                        style={S.tdInput}
                        placeholder="WBS"
                        {...cell('owner')}
                      />
                    </td>
                    <td style={S.td}>
                      <AutocompleteInput
                        value={row.operator}
                        onChange={val => updateRow(i, 'operator', val)}
                        options={getOperatorList(row.equipment)}
                        placeholder={row.equipment ? 'Nama operator' : '← Pilih unit dulu'}
                        inputStyle={S.tdInput}
                        selected={isSel(i, 'operator')}
                        inputRef={el => { if (el) cellRefs.current[`${i}-operator`] = el }}
                        tabIndex={0}
                        onCellKeyDown={e => handleCellKey(e, i, 'operator')}
                        onCellFocus={e => { if (!e.shiftKey) setSel({ rA: i, rE: i, cA: NAV_COLS.indexOf('operator'), cE: NAV_COLS.indexOf('operator') }) }}
                        onPaste={v => pasteToSel(i, 'operator', v)}
                      />
                    </td>
                    <td style={S.td}>
                      <AutocompleteInput
                        value={row.equipment}
                        onChange={val => updateRow(i, 'equipment', val)}
                        options={listUnit.map(u => u.unit_wbs)}
                        placeholder="Kode unit"
                        inputStyle={S.tdInput}
                        selected={isSel(i, 'equipment')}
                        inputRef={el => { if (el) cellRefs.current[`${i}-equipment`] = el }}
                        tabIndex={0}
                        onCellKeyDown={e => handleCellKey(e, i, 'equipment')}
                        onCellFocus={e => { if (!e.shiftKey) setSel({ rA: i, rE: i, cA: NAV_COLS.indexOf('equipment'), cE: NAV_COLS.indexOf('equipment') }) }}
                        onPaste={v => pasteToSel(i, 'equipment', v)}
                      />
                    </td>
                    <td style={S.td}>
                      <input
                        type="number"
                        value={row.number}
                        onChange={e => updateRow(i, 'number', e.target.value)}
                        style={{ ...S.tdInput, textAlign: 'center' }}
                        placeholder="—"
                        {...cell('number')}
                      />
                    </td>
                    <td style={S.td}>
                      <AutocompleteInput
                        value={row.activity_code}
                        onChange={val => updateRow(i, 'activity_code', val)}
                        options={ACTIVITY_CODES.map(a => a.kode + ' — ' + a.desc)}
                        placeholder="Kode aktivitas"
                        inputStyle={S.tdInput}
                        selected={isSel(i, 'activity_code')}
                        inputRef={el => { if (el) cellRefs.current[`${i}-activity_code`] = el }}
                        tabIndex={0}
                        onCellKeyDown={e => handleCellKey(e, i, 'activity_code')}
                        onCellFocus={e => { if (!e.shiftKey) setSel({ rA: i, rE: i, cA: NAV_COLS.indexOf('activity_code'), cE: NAV_COLS.indexOf('activity_code') }) }}
                        onPaste={v => pasteToSel(i, 'activity_code', v)}
                      />
                    </td>
                    <td style={S.td}>
                      <input
                        value={row.location}
                        onChange={e => updateRow(i, 'location', e.target.value)}
                        style={S.tdInput}
                        placeholder="TJB"
                        {...cell('location')}
                      />
                    </td>
                    <td style={S.td}>
                      <input
                        type="text"
                        value={row.time_start}
                        onChange={e => updateRow(i, 'time_start', fmtTime(e.target.value))}
                        style={{ ...S.tdInput, ...(isSel(i,'time_start') ? { background:'#2C7A7B44', outline:'2px solid #3C6E71' } : {}) }}
                        placeholder="--:--"
                        maxLength={5}
                        title="Shift+↑↓←→ blok | Ctrl+D isi bawah | Ctrl+Z undo | Ctrl+Y redo"
                        {...cell('time_start')}
                        onKeyDown={e => {
                          if (e.key === 'F2') { e.preventDefault(); const el = e.target; el.setSelectionRange(el.value.length, el.value.length) }
                          else handleCellKey(e, i, 'time_start')
                        }}
                        onFocus={e => { if (!e.shiftKey) setSel({ rA: i, rE: i, cA: COL_ORDER.indexOf('time_start'), cE: COL_ORDER.indexOf('time_start') }) }}
                        onPaste={e => {
                          e.preventDefault()
                          const v = e.clipboardData.getData('text').trim()
                          if (!pasteToSel(i, 'time_start', v)) updateRow(i, 'time_start', fmtTime(v))
                        }}
                      />
                    </td>
                    <td style={S.td}>
                      <input
                        type="text"
                        value={row.time_end}
                        onChange={e => updateRow(i, 'time_end', fmtTime(e.target.value))}
                        style={{ ...S.tdInput, ...(isSel(i,'time_end') ? { background:'#2C7A7B44', outline:'2px solid #3C6E71' } : {}) }}
                        placeholder="--:--"
                        maxLength={5}
                        title="Shift+↑↓←→ blok | Ctrl+D isi bawah | Ctrl+Z undo | Ctrl+Y redo"
                        {...cell('time_end')}
                        onKeyDown={e => {
                          if (e.key === 'F2') { e.preventDefault(); const el = e.target; el.setSelectionRange(el.value.length, el.value.length) }
                          else handleCellKey(e, i, 'time_end')
                        }}
                        onFocus={e => { if (!e.shiftKey) setSel({ rA: i, rE: i, cA: COL_ORDER.indexOf('time_end'), cE: COL_ORDER.indexOf('time_end') }) }}
                        onPaste={e => {
                          e.preventDefault()
                          const v = e.clipboardData.getData('text').trim()
                          if (!pasteToSel(i, 'time_end', v)) updateRow(i, 'time_end', fmtTime(v))
                        }}
                      />
                    </td>
                    <td style={S.td}><span style={S.badge(total)}>{total}</span></td>
                    <td style={S.td}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.hm_start}
                        onChange={e => updateRow(i, 'hm_start', fmtNum(e.target.value))}
                        style={{ ...S.tdInput, ...(isSel(i,'hm_start') ? { background:'#2C7A7B44', outline:'2px solid #3C6E71' } : {}) }}
                        placeholder="0"
                        title="Shift+↑↓←→ blok | Ctrl+D isi bawah | Ctrl+Z undo | Ctrl+Y redo"
                        {...cell('hm_start')}
                        onKeyDown={e => {
                          if (e.key === 'F2') { e.preventDefault(); const el = e.target; el.setSelectionRange(el.value.length, el.value.length) }
                          else handleCellKey(e, i, 'hm_start')
                        }}
                        onFocus={e => { if (!e.shiftKey) setSel({ rA: i, rE: i, cA: COL_ORDER.indexOf('hm_start'), cE: COL_ORDER.indexOf('hm_start') }) }}
                        onPaste={e => {
                          e.preventDefault()
                          const v = fmtNum(e.clipboardData.getData('text').trim())
                          if (!pasteToSel(i, 'hm_start', v)) updateRow(i, 'hm_start', v)
                        }}
                      />
                    </td>
                    <td style={S.td}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.hm_finish}
                        onChange={e => updateRow(i, 'hm_finish', fmtNum(e.target.value))}
                        style={{ ...S.tdInput, ...(isSel(i,'hm_finish') ? { background:'#2C7A7B44', outline:'2px solid #3C6E71' } : {}) }}
                        placeholder="0"
                        title="Shift+↑↓←→ blok | Ctrl+D isi bawah | Ctrl+Z undo | Ctrl+Y redo"
                        {...cell('hm_finish')}
                        onKeyDown={e => {
                          if (e.key === 'F2') { e.preventDefault(); const el = e.target; el.setSelectionRange(el.value.length, el.value.length) }
                          else handleCellKey(e, i, 'hm_finish')
                        }}
                        onFocus={e => { if (!e.shiftKey) setSel({ rA: i, rE: i, cA: COL_ORDER.indexOf('hm_finish'), cE: COL_ORDER.indexOf('hm_finish') }) }}
                        onPaste={e => {
                          e.preventDefault()
                          const v = fmtNum(e.clipboardData.getData('text').trim())
                          if (!pasteToSel(i, 'hm_finish', v)) updateRow(i, 'hm_finish', v)
                        }}
                      />
                    </td>
                    <td style={S.td}><span style={S.badge(totalHM)}>{totalHM}</span></td>
                    {/* Activity description — readonly, otomatis dari activity_code */}
                    <td style={{ ...S.td, fontSize: 11, color: t.subtitle }}>{row.activity_desc || '—'}</td>
                    <td style={S.td}>
                      <input
                        value={row.remark}
                        onChange={e => updateRow(i, 'remark', e.target.value)}
                        style={S.tdInput}
                        placeholder="Keterangan"
                        {...cell('remark')}
                      />
                    </td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      <button
                        className="ts-btn"
                        onClick={() => sisipRow(i)}
                        title="Sisip baris di bawah"
                        style={{ ...S.btnDel, background: t.btnAddBg, color: t.btnAddColor, border: `1px solid ${t.btnAddBorder}`, marginRight: 3, fontSize: 13, padding: '3px 7px' }}
                      >+</button>
                      <button
                        className="ts-btn"
                        onClick={() => hapusRow(i)}
                        title="Hapus baris"
                        style={S.btnDel}
                      >✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="ts-btn" onClick={tambahRow} style={S.btnAdd}><IconPlus /> Tambah Baris</button>
          <button className="ts-btn" onClick={simpan} disabled={loading} style={{ ...S.btnSave, opacity: loading ? 0.75 : 1, cursor: loading ? 'default' : 'pointer' }}>
            <IconSave /> {loading ? 'Menyimpan…' : 'Simpan Data'}
          </button>
          <span style={S.dim}>{rows.length} baris aktivitas</span>

          {/* Status bar: sum otomatis dari semua baris (seperti Excel status bar) */}
          {(() => {
            const allTotalJam = rows.map(r => {
              const v = parseFloat(hitungTotal(r.time_start, r.time_end))
              return isNaN(v) ? 0 : v
            })
            const allTotalHM = rows.map(r => {
              const v = r.hm_start && r.hm_finish ? parseFloat(r.hm_finish) - parseFloat(r.hm_start) : null
              return isNaN(v) || v === null ? 0 : v
            })

            // Hanya tampil saat ada blok > 1 baris
            if (!sel || Math.abs(sel.rA - sel.rE) === 0) return null
            const rLo = Math.min(sel.rA, sel.rE)
            const rHi = Math.max(sel.rA, sel.rE)
            const sumJam = allTotalJam.slice(rLo, rHi + 1).reduce((a, b) => a + b, 0)
            const sumHM  = allTotalHM.slice(rLo, rHi + 1).reduce((a, b) => a + b, 0)
            const label  = `Baris ${rLo + 1}–${rHi + 1} (${rHi - rLo + 1} baris)`

            const chip = (icon, val, hint) => (
              <div title={hint} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: t.badgeValBg, border: `1px solid ${t.badgeValBorder}`,
                borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600,
              }}>
                <span style={{ color: t.dim, fontWeight: 400, fontSize: 11 }}>{icon}</span>
                <span style={{ color: t.badgeValColor }}>{val}</span>
              </div>
            )

            return (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: t.dim }}>{label}:</span>
                {chip('⏱ Total Jam', sumJam.toFixed(2), 'Jumlah total jam operasi')}
                {chip('⚙️ Total KWH/HM', sumHM.toFixed(1), 'Jumlah total KWH/HM')}
              </div>
            )
          })()}
        </div>

        {sukses && <div style={S.successBanner}>✅ Data berhasil disimpan ke database!</div>}
      </div>
    </div>
  )
}