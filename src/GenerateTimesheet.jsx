/**
 * GenerateTimesheet.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Fitur Generate Timesheet untuk PT. Wahana Bara Sentosa — TJB
 *
 * ASUMSI NAMA TABEL (sesuaikan jika berbeda di Supabase Anda):
 *
 *   master_template
 *     kolom: id, nama_template, owner (default 'WBS'), location (default 'TJB')
 *
 *   template_detail
 *     kolom: id, template_id (FK→master_template.id), no_urut,
 *            activity_code, activity_desc, time_start, time_end, total_hours
 *
 *   unit_wbs
 *     kolom: no, unit_wbs, status  ← tambahkan kolom 'status' berisi 'aktif'/'nonaktif'
 *            (jika kolom belum ada, lihat komentar di fetchUnitAktif())
 *
 *   timesheet_header
 *     kolom: id, tanggal, shift, owner, location, penginput, template_id, generated
 *            (generated: boolean — tandai bahwa baris ini hasil Generate, bukan input manual)
 *
 *   timesheet_detail
 *     kolom: id, header_id (FK→timesheet_header.id), no_urut,
 *            owner, operator, equipment, number, location,
 *            activity_code, activity_desc,
 *            time_start, time_end, total_hours,
 *            hm_start, hm_finish, total_hm, remark
 *
 * VALIDASI DUPLIKAT:
 *   Cek timesheet_header di mana tanggal = X AND shift = Y AND equipment = Z.
 *   Jika sudah ada → tolak generate ulang untuk unit tersebut.
 *   (level per-unit, bukan per-generate-batch, agar generate parsial tetap bisa)
 *
 * DATABASE TRANSACTION:
 *   Supabase JS v2 tidak expose BEGIN/COMMIT langsung. Strategi yang dipakai:
 *   - Insert semua header dulu (bulk insert), ambil id-nya.
 *   - Insert semua detail sekaligus (bulk insert).
 *   - Jika detail gagal → hapus header yang baru saja dibuat (manual rollback).
 *   Untuk full atomicity, bisa pakai Supabase RPC (Postgres function) — lihat
 *   komentar di fungsi generate() di bawah.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Spinner kecil (CSS animation, tanpa dependency tambahan) — dipakai di dalam tombol
// yang sedang loading, supaya tombolnya tetap terlihat & tidak digantikan elemen lain.
const Spinner = ({ size = 14 }) => (
  <span
    style={{
      display: 'inline-block',
      width: size, height: size,
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: 'currentColor',
      borderRadius: '50%',
      animation: 'ts-spin 0.7s linear infinite',
      flexShrink: 0,
    }}
  />
)

// ── Salin dari App.jsx agar konsisten ────────────────────────────────────
const THEME = {
  dark: {
    app:        '#10151A', card: '#171D23', panelBg: '#151B21',
    cardBorder: '#262E36', headerLine: '#3C6E71',
    title: '#F2F4F5', subtitle: '#9AA5AC', label: '#8A959D',
    tagBg: '#1B3538', tagColor: '#6FB3B7', tagBorder: '#2C5254',
    inputBg: '#1D242B', inputBorder: '#2E3841', inputColor: '#EDEFF0',
    focusBorder: '#4CA3A8', focusRing: 'rgba(76,163,168,0.22)',
    selectBg: '#1B2128',
    thBg: '#1E3236', thBg2: '#264145', thColor: '#EAF3F3', thBorder: '#0E1215',
    tdBorder: '#1E252B', rowEven: '#1B2127', rowHover: '#202832',
    noColor: '#6FB3B7',
    badgeValBg: '#1B3538', badgeValColor: '#6FB3B7', badgeValBorder: '#2C5254',
    badgeNilBg: '#20272E', badgeNilColor: '#5A646C', badgeNilBorder: '#2A323A',
    btnAddBg: 'rgba(76,163,168,0.14)', btnAddColor: '#7AC6CA', btnAddBorder: 'rgba(76,163,168,0.40)',
    btnSaveBg: '#2F7A72', btnSaveBorder: '#2F7A72', btnSaveColor: '#F4FBFA',
    btnDelBg: '#20272E', btnDelBorder: '#2E3841', btnDelColor: '#8FA0A6',
    toggleBg: '#1B2128', toggleBorder: '#2E3841', toggleColor: '#B7C1C7',
    successBg: '#12241C', successBorder: '#255C42', successColor: '#5FCB8C',
    warnBg: '#221C0E', warnBorder: '#5C4A1A', warnColor: '#E9B44C',
    errorBg: '#1E0E0E', errorBorder: '#5C1A1A', errorColor: '#E97070',
    dim: '#5C666D', scrollbar: '#2E3841',
    shift1: { text: '#4ADE80', bg: 'rgba(22,163,74,0.08)', bgStrong: 'rgba(22,163,74,0.18)', border: 'rgba(22,163,74,0.35)' },
    shift2: { text: '#60A5FA', bg: 'rgba(37,99,235,0.08)', bgStrong: 'rgba(37,99,235,0.18)', border: 'rgba(37,99,235,0.35)' },
  },
  light: {
    app:        '#F4F5F6', card: '#FFFFFF', panelBg: '#FBFCFC',
    cardBorder: '#E2E6E9', headerLine: '#3C6E71',
    title: '#1B2226', subtitle: '#5C666D', label: '#8A959D',
    tagBg: '#E6F4F4', tagColor: '#2D7A7E', tagBorder: '#C3E4E5',
    inputBg: '#FFFFFF', inputBorder: '#D0D7DC', inputColor: '#1B2226',
    focusBorder: '#4CA3A8', focusRing: 'rgba(76,163,168,0.18)',
    selectBg: '#F7F9F9',
    thBg: '#3C6E71', thBg2: '#4A848A', thColor: '#FFFFFF', thBorder: '#2D5558',
    tdBorder: '#ECF0F1', rowEven: '#F7FAFA', rowHover: '#EDF5F5',
    noColor: '#2D7A7E',
    badgeValBg: '#E6F4F4', badgeValColor: '#2D7A7E', badgeValBorder: '#C3E4E5',
    badgeNilBg: '#F4F5F6', badgeNilColor: '#9AA5AC', badgeNilBorder: '#E2E6E9',
    btnAddBg: 'rgba(60,110,113,0.08)', btnAddColor: '#2D7A7E', btnAddBorder: 'rgba(60,110,113,0.30)',
    btnSaveBg: '#3C6E71', btnSaveBorder: '#3C6E71', btnSaveColor: '#FFFFFF',
    btnDelBg: '#F4F5F6', btnDelBorder: '#D0D7DC', btnDelColor: '#6B7A82',
    toggleBg: '#F0F2F3', toggleBorder: '#D0D7DC', toggleColor: '#4A5568',
    successBg: '#F0FBF5', successBorder: '#9FDCB8', successColor: '#1E6B45',
    warnBg: '#FDF9EE', warnBorder: '#E9CC7A', warnColor: '#7A5A10',
    errorBg: '#FDF0F0', errorBorder: '#E9A0A0', errorColor: '#7A1010',
    dim: '#9AA5AC', scrollbar: '#D0D7DC',
    shift1: { text: '#16A34A', bg: 'rgba(22,163,74,0.06)', bgStrong: 'rgba(22,163,74,0.13)', border: 'rgba(22,163,74,0.30)' },
    shift2: { text: '#2563EB', bg: 'rgba(37,99,235,0.06)', bgStrong: 'rgba(37,99,235,0.13)', border: 'rgba(37,99,235,0.30)' },
  },
}

// ── Step states ──────────────────────────────────────────────────────────
const STEP = { IDLE: 'idle', LOADING: 'loading', CONFIRM: 'confirm', GENERATING: 'generating', DONE: 'done', ERROR: 'error' }

// ── Helpers ──────────────────────────────────────────────────────────────
const hitungTotal = (start, end) => {
  if (!start || !end || !start.includes(':') || !end.includes(':')) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some(isNaN)) return null
  let startMin = sh * 60 + sm, endMin = eh * 60 + em
  if (endMin < startMin) endMin += 1440
  const result = (endMin - startMin) / 60
  return result >= 0 ? parseFloat(result.toFixed(2)) : null
}

// ────────────────────────────────────────────────────────────────────────
export default function GenerateTimesheet({ isDark, onToggleTheme, onBack }) {
  const t = THEME[isDark ? 'dark' : 'light']
  const shiftColors = (s) => s === '2' ? t.shift2 : t.shift1

  // ── Form state ──────────────────────────────────────────────────────
  const [templateId, setTemplateId]     = useState('')
  const [tanggal, setTanggal]           = useState('')
  const [shift, setShift]               = useState('1')
  const [penginput, setPenginput]       = useState('')

  // ── Data state ──────────────────────────────────────────────────────
  const [templates, setTemplates]           = useState([])
  const [templateDetail, setTemplateDetail] = useState([])
  const [listPenginput, setListPenginput]   = useState([])

  // ── Process state ──────────────────────────────────────────────────
  const [step, setStep]           = useState(STEP.IDLE)
  const [preview, setPreview]     = useState(null)   // { unitAktif[], skipped[], templateName, tanggal, shift }
  const [progress, setProgress]   = useState(null)   // { done, total, currentUnit }
  const [result, setResult]       = useState(null)   // { berhasil, dilewati, errors[] }
  const [errMsg, setErrMsg]       = useState('')

  // ── Load masters on mount ───────────────────────────────────────────
  useEffect(() => {
    // Fetch daftar template
    supabase
      .from('master_template')
      .select('id, nama_template, owner, location')
      .order('nama_template', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setTemplates(data)
      })

    // Fetch penginput
    supabase
      .from('nama_penginput_timesheet')
      .select('no, nama_penginput')
      .order('no', { ascending: true })
      .then(({ data }) => {
        if (data) setListPenginput(data.map(p => ({ ...p, nama_penginput: p.nama_penginput?.toUpperCase() })))
      })
  }, [])

  // ── Load template detail saat templateId berubah ────────────────────
  useEffect(() => {
    if (!templateId) { setTemplateDetail([]); return }
    supabase
      .from('template_detail')
      .select('id, no_urut, activity_code, activity_desc, time_start, time_end, total_hours')
      .eq('template_id', templateId)
      .order('no_urut', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setTemplateDetail(data)
        else setTemplateDetail([])
      })
  }, [templateId])

  // ── Fetch unit aktif ─────────────────────────────────────────────────
  const fetchUnitAktif = useCallback(async () => {
    /**
     * OPSI A (direkomendasikan): tabel unit_wbs punya kolom `status`
     *   → filter .eq('status', 'aktif')
     *
     * OPSI B: jika kolom status belum ada di unit_wbs, ambil semua unit saja.
     *   Aktifkan baris OPSI B dan nonaktifkan OPSI A.
     */

    // ── OPSI A: filter kolom status ──────────────────────────────────
    const { data, error } = await supabase
      .from('unit_wbs')
      .select('no, unit_wbs, status')
      .eq('status', 'aktif')          // ← sesuaikan nilai jika bukan 'aktif'
      .order('no', { ascending: true })

    // ── OPSI B: ambil semua (nonaktifkan jika pakai Opsi A) ──────────
    // const { data, error } = await supabase
    //   .from('unit_wbs')
    //   .select('no, unit_wbs')
    //   .order('no', { ascending: true })

    if (error) throw new Error('Gagal fetch unit: ' + error.message)
    return data || []
  }, [])

  // ── Cek duplikat: unit mana yang sudah punya timesheet (tanggal+shift+unit) ─
  const cekDuplikat = useCallback(async (units, tgl, sft) => {
    /**
     * Cek di timesheet_header: tanggal=tgl AND shift=sft
     * kemudian cek di timesheet_detail: equipment IN listUnit
     *
     * Karena satu header bisa punya banyak equipment di detail,
     * kita cek via JOIN:
     *   - Ambil header_id yang cocok tanggal+shift
     *   - Cek detail.equipment yang header_id-nya ada di list itu
     */
    const { data: headers, error: errH } = await supabase
      .from('timesheet_header')
      .select('id')
      .eq('tanggal', tgl)
      .eq('shift', parseInt(sft))

    if (errH) throw new Error('Cek duplikat gagal: ' + errH.message)
    if (!headers || headers.length === 0) return new Set()

    const headerIds = headers.map(h => h.id)
    const unitCodes = units.map(u => u.unit_wbs)

    const { data: dupRows, error: errD } = await supabase
      .from('timesheet_detail')
      .select('equipment')
      .in('header_id', headerIds)
      .in('equipment', unitCodes)

    if (errD) throw new Error('Cek duplikat detail gagal: ' + errD.message)

    return new Set((dupRows || []).map(r => r.equipment))
  }, [])

  // ── Step 1: klik tombol Preview / Generate ───────────────────────────
  const handlePreview = async () => {
    if (!templateId) return alert('Pilih Template terlebih dahulu.')
    if (!tanggal)    return alert('Pilih Tanggal terlebih dahulu.')
    if (!shift)      return alert('Pilih Shift terlebih dahulu.')
    if (templateDetail.length === 0) return alert('Template tidak memiliki baris aktivitas.')

    setStep(STEP.LOADING)
    setErrMsg('')
    try {
      const units = await fetchUnitAktif()
      if (units.length === 0) {
        setErrMsg('Tidak ada unit dengan status "aktif" di tabel unit_wbs.')
        setStep(STEP.ERROR)
        return
      }

      const dupSet = await cekDuplikat(units, tanggal, shift)
      const unitBaru    = units.filter(u => !dupSet.has(u.unit_wbs))
      const unitSkipped = units.filter(u =>  dupSet.has(u.unit_wbs))

      const tmpl = templates.find(t => String(t.id) === String(templateId))
      setPreview({ unitAktif: unitBaru, skipped: unitSkipped, templateName: tmpl?.nama_template, tanggal, shift })
      setStep(STEP.CONFIRM)
    } catch (e) {
      setErrMsg(e.message)
      setStep(STEP.ERROR)
    }
  }

  // ── Step 2: konfirmasi → jalankan generate ───────────────────────────
  const handleGenerate = async () => {
    if (!preview || preview.unitAktif.length === 0) return

    setStep(STEP.GENERATING)
    setProgress({ done: 0, total: preview.unitAktif.length, currentUnit: '' })

    const tmpl = templates.find(t => String(t.id) === String(templateId))
    const errors = []
    let berhasil = 0
    let fatalError = null   // exception tak terduga yang menghentikan loop di tengah jalan

    /**
     * Strategi transaksi:
     * Kita insert header + detail per unit dalam satu iterasi.
     * Jika detail gagal → hapus header unit tersebut (manual rollback per-unit).
     *
     * Untuk full atomic across semua unit:
     * Gunakan Supabase RPC / Postgres function. Contoh SQL function:
     *
     *   CREATE OR REPLACE FUNCTION generate_timesheet(payload jsonb)
     *   RETURNS void LANGUAGE plpgsql AS $$
     *   DECLARE h RECORD;
     *   BEGIN
     *     FOR h IN SELECT * FROM jsonb_array_elements(payload) LOOP
     *       INSERT INTO timesheet_header (...) VALUES (...) RETURNING id INTO hid;
     *       INSERT INTO timesheet_detail (...) SELECT ... FROM jsonb_array_elements(h->'details');
     *     END LOOP;
     *   END; $$;
     *
     * Kemudian panggil: supabase.rpc('generate_timesheet', { payload: [...] })
     * Jika ada error di dalam function → Postgres otomatis rollback semua.
     */

    // Seluruh loop dibungkus try/catch: jika ada exception TAK TERDUGA (network putus,
    // response berbentuk tidak terduga, dsb — bukan sekadar { error } dari Supabase yang
    // memang sudah ditangani per-unit di bawah), proses tidak boleh diam-diam macet.
    // `finally` di bawah menjamin `step` SELALU keluar dari GENERATING apa pun yang terjadi,
    // supaya tombol tidak pernah tertahan di mode loading selamanya.
    try {
      for (let i = 0; i < preview.unitAktif.length; i++) {
        const unit = preview.unitAktif[i]
        setProgress({ done: i, total: preview.unitAktif.length, currentUnit: unit.unit_wbs })

        // ── Insert header ──────────────────────────────────────────────
        const { data: header, error: errH } = await supabase
          .from('timesheet_header')
          .insert({
            tanggal,
            shift: parseInt(shift),
            owner: tmpl?.owner || 'WBS',
            location: tmpl?.location || 'TJB',
            penginput: penginput || null,
            template_id: templateId,
            generated: true,               // flag: baris ini hasil generate
          })
          .select('id')
          .single()

        if (errH) {
          console.error('[GenerateTimesheet] insert header gagal untuk unit', unit.unit_wbs, errH)
          errors.push({ unit: unit.unit_wbs, pesan: 'Header gagal: ' + errH.message })
          continue
        }

        // Supabase kadang mengembalikan data null tanpa error eksplisit (mis. RLS
        // memblokir SELECT setelah INSERT). Tangkap di sini, bukan lewat exception
        // tak terduga yang bisa lolos dari continue di bawahnya.
        if (!header) {
          console.error('[GenerateTimesheet] insert header sukses tapi response kosong untuk unit', unit.unit_wbs)
          errors.push({ unit: unit.unit_wbs, pesan: 'Header gagal: response kosong dari server (cek RLS policy SELECT pada timesheet_header)' })
          continue
        }

        // ── Siapkan baris detail dari template ────────────────────────
        const details = templateDetail.map((td, idx) => ({
          header_id:     header.id,
          no_urut:       td.no_urut ?? idx + 1,
          owner:         tmpl?.owner || 'WBS',
          operator:      null,             // ← diisi manual oleh operator
          equipment:     unit.unit_wbs,   // ← dari unit aktif
          number:        null,
          location:      tmpl?.location || 'TJB',
          activity_code: td.activity_code,
          activity_desc: td.activity_desc || td.activity_code,
          time_start:    td.time_start   || null,
          time_end:      td.time_end     || null,
          total_hours:   td.total_hours  ?? hitungTotal(td.time_start, td.time_end),
          hm_start:      null,             // ← diisi manual
          hm_finish:     null,             // ← diisi manual
          total_hm:      null,             // ← tidak dihitung pada tahap ini
          remark:        null,             // ← diisi manual
        }))

        // ── Insert detail ──────────────────────────────────────────────
        const { error: errD } = await supabase
          .from('timesheet_detail')
          .insert(details)

        if (errD) {
          console.error('[GenerateTimesheet] insert detail gagal untuk unit', unit.unit_wbs, errD)
          // Manual rollback: hapus header yang baru dibuat
          const { error: errRollback } = await supabase.from('timesheet_header').delete().eq('id', header.id)
          if (errRollback) console.error('[GenerateTimesheet] rollback header gagal untuk unit', unit.unit_wbs, errRollback)
          errors.push({ unit: unit.unit_wbs, pesan: 'Detail gagal (header di-rollback): ' + errD.message })
          continue
        }

        berhasil++
      }
    } catch (e) {
      // Exception tak terduga (network putus, dsb) — jangan biarkan lolos tanpa penanganan
      console.error('[GenerateTimesheet] exception tak terduga saat generate:', e)
      fatalError = e?.message || 'Terjadi kesalahan tak terduga saat menghubungi server.'
    } finally {
      if (fatalError) {
        // Proses berhenti di tengah jalan → tampilkan pesan error yang jelas dan
        // kembalikan UI ke state yang bisa di-retry (bukan macet di GENERATING)
        setErrMsg(
          `Generate terhenti di tengah proses (${berhasil} berhasil sebelum error terjadi): ${fatalError}`
        )
        setStep(STEP.ERROR)
      } else {
        setProgress({ done: preview.unitAktif.length, total: preview.unitAktif.length, currentUnit: '' })
        setResult({ berhasil, dilewati: preview.skipped.length, errors })
        setStep(STEP.DONE)
      }
    }
  }

  // ── Reset form ───────────────────────────────────────────────────────
  const handleReset = () => {
    setStep(STEP.IDLE)
    setPreview(null)
    setProgress(null)
    setResult(null)
    setErrMsg('')
  }

  // ── Styles (ikuti pola makeStyles di App.jsx) ────────────────────────
  const S = {
    app: {
      minHeight: '100vh', background: t.app,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '32px 16px', boxSizing: 'border-box', fontFamily: 'inherit',
    },
    card: {
      background: t.card, borderRadius: 18,
      border: `1px solid ${t.cardBorder}`,
      padding: '28px 32px', width: '100%', maxWidth: 860,
      boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${t.cardBorder}`,
    },
    title: { margin: 0, fontSize: 20, fontWeight: 800, color: t.title, letterSpacing: -0.3 },
    subtitle: { margin: '2px 0 0', fontSize: 11, color: t.subtitle, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' },
    toggleBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      background: t.toggleBg, border: `1px solid ${t.toggleBorder}`,
      color: t.toggleColor, cursor: 'pointer',
    },
    panel: {
      background: t.panelBg, border: `1px solid ${t.cardBorder}`,
      borderRadius: 12, padding: '18px 20px', marginBottom: 20,
    },
    sectionLabel: {
      fontSize: 10, fontWeight: 700, color: t.label,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
    },
    formRow: { display: 'flex', gap: 14, flexWrap: 'wrap' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
    label: { fontSize: 10.5, fontWeight: 700, color: t.label, textTransform: 'uppercase', letterSpacing: 0.7 },
    input: {
      background: t.inputBg, border: `1px solid ${t.inputBorder}`,
      borderRadius: 8, padding: '9px 12px', color: t.inputColor,
      fontSize: 13, outline: 'none', fontFamily: 'inherit',
    },
    select: {
      background: t.selectBg, border: `1px solid ${t.inputBorder}`,
      borderRadius: 8, padding: '9px 12px', color: t.inputColor,
      fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
    },
    btnGenerate: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '11px 24px', borderRadius: 10, fontWeight: 800, fontSize: 13.5,
      background: t.btnSaveBg, border: `1px solid ${t.btnSaveBorder}`,
      color: t.btnSaveColor, cursor: 'pointer', fontFamily: 'inherit',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'filter 0.15s',
      minWidth: 180,
    },
    btnSecondary: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13,
      background: t.btnAddBg, border: `1px solid ${t.btnAddBorder}`,
      color: t.btnAddColor, cursor: 'pointer', fontFamily: 'inherit',
    },
    btnDanger: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13,
      background: t.btnDelBg, border: `1px solid ${t.btnDelBorder}`,
      color: t.btnDelColor, cursor: 'pointer', fontFamily: 'inherit',
    },
    shiftChip: (active, kind) => ({
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '9px 16px 9px 14px', borderRadius: 10,
      background: active ? kind.bgStrong : 'transparent',
      border: `1px solid ${active ? kind.border : t.cardBorder}`,
      color: active ? kind.text : t.dim,
      cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none', fontFamily: 'inherit',
    }),
    table: {
      width: '100%', borderCollapse: 'separate', borderSpacing: 0,
      fontSize: 12.5, border: `1px solid ${t.cardBorder}`, borderRadius: 10, overflow: 'hidden',
    },
    th: {
      background: t.thBg, color: t.thColor, padding: '10px 12px',
      textAlign: 'left', fontWeight: 700, fontSize: 10.5, letterSpacing: 0.5,
      textTransform: 'uppercase', borderBottom: `1px solid ${t.thBorder}`,
    },
    td: {
      padding: '9px 12px', borderBottom: `1px solid ${t.tdBorder}`,
      color: t.inputColor, fontSize: 12.5,
    },
    badge: (color) => ({
      display: 'inline-block', padding: '2px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: color.bg, color: color.text, border: `1px solid ${color.border}`,
    }),
    successBox: {
      padding: '14px 18px', borderRadius: 10, marginBottom: 16,
      background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successColor,
    },
    warnBox: {
      padding: '14px 18px', borderRadius: 10, marginBottom: 16,
      background: t.warnBg, border: `1px solid ${t.warnBorder}`, color: t.warnColor,
    },
    errorBox: {
      padding: '14px 18px', borderRadius: 10, marginBottom: 16,
      background: t.errorBg, border: `1px solid ${t.errorBorder}`, color: t.errorColor,
    },
    progressBar: {
      height: 8, borderRadius: 4, background: t.cardBorder, overflow: 'hidden', marginBottom: 8,
    },
    progressFill: (pct) => ({
      height: '100%', borderRadius: 4, width: `${pct}%`,
      background: `linear-gradient(90deg, #3C6E71, #6FB3B7)`,
      transition: 'width 0.3s ease',
    }),
    divider: { borderBottom: `1px solid ${t.cardBorder}`, margin: '18px 0' },
    tag: {
      display: 'inline-block', padding: '3px 10px', borderRadius: 6,
      fontSize: 11, fontWeight: 600,
      background: t.tagBg, color: t.tagColor, border: `1px solid ${t.tagBorder}`,
    },
    dimText: { color: t.dim, fontSize: 12 },
  }

  const selectedShiftColor = shiftColors(shift)

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      <div style={S.card}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div>
            <p style={S.subtitle}>PT. Wahana Bara Sentosa &middot; TJB</p>
            <h1 style={S.title}>⚡ Generate Timesheet</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onBack && (
              <button style={S.toggleBtn} onClick={onBack}>
                ← Kembali
              </button>
            )}
            {onToggleTheme && (
              <button style={S.toggleBtn} onClick={onToggleTheme}>
                {isDark ? '☀ Terang' : '🌙 Gelap'}
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            FORM INPUT (selalu tampil, kecuali saat generating)
            ══════════════════════════════════════ */}
        {step !== STEP.GENERATING && step !== STEP.DONE && (
          <div style={S.panel}>
            <p style={S.sectionLabel}>1 · Konfigurasi Generate</p>

            <div style={S.formRow}>

              {/* Template */}
              <div style={{ ...S.formGroup, flex: '2 1 240px' }}>
                <label style={S.label}>Template</label>
                <select
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                  style={{ ...S.select, minWidth: 200 }}
                  disabled={step === STEP.LOADING || step === STEP.CONFIRM}
                >
                  <option value="">— Pilih Template —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.nama_template}</option>
                  ))}
                </select>
              </div>

              {/* Tanggal */}
              <div style={{ ...S.formGroup, flex: '1 1 160px' }}>
                <label style={S.label}>Tanggal</label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  style={S.input}
                  disabled={step === STEP.LOADING || step === STEP.CONFIRM}
                />
              </div>

              {/* Penginput */}
              <div style={{ ...S.formGroup, flex: '1 1 180px' }}>
                <label style={S.label}>Penginput</label>
                <select
                  value={penginput}
                  onChange={e => setPenginput(e.target.value)}
                  style={S.select}
                  disabled={step === STEP.LOADING || step === STEP.CONFIRM}
                >
                  <option value="">— Opsional —</option>
                  {listPenginput.map(p => (
                    <option key={p.no} value={p.nama_penginput}>{p.nama_penginput}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Shift selector */}
            <div style={{ marginTop: 16 }}>
              <label style={S.label}>Shift</label>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                {['1', '2'].map(s => {
                  const kind = shiftColors(s)
                  const active = shift === s
                  return (
                    <button
                      key={s}
                      style={S.shiftChip(active, kind)}
                      onClick={() => setShift(s)}
                      disabled={step === STEP.LOADING || step === STEP.CONFIRM}
                    >
                      <span style={{
                        width: 22, height: 22, borderRadius: 6, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: active ? kind.bg : 'transparent',
                        color: active ? kind.text : t.dim, fontSize: 14,
                      }}>
                        {s === '1' ? '☀' : '🌙'}
                      </span>
                      <span>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>Shift {s}</span>
                        <br />
                        <span style={{ fontSize: 10, opacity: 0.7 }}>{s === '1' ? '07:00 – 19:00' : '19:00 – 07:00'}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            PREVIEW TEMPLATE DETAIL (sebelum confirm)
            ══════════════════════════════════════ */}
        {templateDetail.length > 0 && step !== STEP.GENERATING && step !== STEP.DONE && (
          <div style={{ marginBottom: 20 }}>
            <p style={S.sectionLabel}>2 · Aktivitas dari Template</p>
            <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${t.cardBorder}` }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 40 }}>#</th>
                    <th style={S.th}>Kode Aktivitas</th>
                    <th style={S.th}>Deskripsi</th>
                    <th style={S.th}>Jam Mulai</th>
                    <th style={S.th}>Jam Selesai</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>Durasi (jam)</th>
                  </tr>
                </thead>
                <tbody>
                  {templateDetail.map((td, i) => (
                    <tr key={td.id} style={{ background: i % 2 === 0 ? t.rowEven : 'transparent' }}>
                      <td style={{ ...S.td, color: t.noColor, fontWeight: 700 }}>{td.no_urut ?? i + 1}</td>
                      <td style={S.td}>
                        <span style={S.tag}>{td.activity_code}</span>
                      </td>
                      <td style={{ ...S.td, color: t.subtitle }}>{td.activity_desc || '—'}</td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{td.time_start || '—'}</td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{td.time_end || '—'}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        {td.total_hours ?? hitungTotal(td.time_start, td.time_end) ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            LOADING saat cek duplikat & fetch unit
            ══════════════════════════════════════ */}
        {step === STEP.LOADING && (
          <div style={{ ...S.warnBox, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>⏳</span>
            <span>Memeriksa unit aktif dan duplikat data…</span>
          </div>
        )}

        {/* ══════════════════════════════════════
            KONFIRMASI — ringkasan sebelum generate
            ══════════════════════════════════════ */}
        {(step === STEP.CONFIRM || step === STEP.GENERATING) && preview && (
          <div>
            <p style={S.sectionLabel}>3 · Konfirmasi Generate</p>

            {/* Ringkasan */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: 12, marginBottom: 20,
            }}>
              {[
                { emoji: '📋', label: 'Template',     val: preview.templateName },
                { emoji: '📅', label: 'Tanggal',      val: preview.tanggal },
                { emoji: '🔢', label: 'Shift',        val: `Shift ${preview.shift}` },
                { emoji: '🚛', label: 'Unit diproses',val: `${preview.unitAktif.length} unit` },
                { emoji: '⚠️', label: 'Dilewati',     val: `${preview.skipped.length} unit` },
                { emoji: '📝', label: 'Aktivitas/unit',val: `${templateDetail.length} baris` },
              ].map(item => (
                <div key={item.label} style={{
                  background: t.panelBg, border: `1px solid ${t.cardBorder}`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{item.emoji}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.label, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.title }}>{item.val}</div>
                </div>
              ))}
            </div>

            {/* Unit yang akan diproses */}
            {preview.unitAktif.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ ...S.dimText, marginBottom: 8 }}>
                  ✅ <strong>{preview.unitAktif.length} unit aktif</strong> akan dibuatkan timesheet:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {preview.unitAktif.map(u => (
                    <span key={u.unit_wbs} style={S.tag}>{u.unit_wbs}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Unit yang dilewati */}
            {preview.skipped.length > 0 && (
              <div style={{ ...S.warnBox, marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
                  ⚠ {preview.skipped.length} unit dilewati — timesheet sudah ada untuk tanggal & shift ini:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {preview.skipped.map(u => (
                    <span key={u.unit_wbs} style={{
                      ...S.tag, background: t.warnBg, color: t.warnColor, borderColor: t.warnBorder,
                    }}>{u.unit_wbs}</span>
                  ))}
                </div>
              </div>
            )}

            {preview.unitAktif.length === 0 && (
              <div style={S.warnBox}>
                ⚠ Semua unit aktif sudah memiliki timesheet untuk tanggal dan shift yang dipilih.
                Tidak ada yang perlu di-generate.
              </div>
            )}

            {/* Total insert yang akan dibuat */}
            {preview.unitAktif.length > 0 && (
              <div style={{ ...S.dimText, marginBottom: 18 }}>
                Total baris detail yang akan dibuat:&nbsp;
                <strong style={{ color: t.title }}>
                  {preview.unitAktif.length} × {templateDetail.length} = {preview.unitAktif.length * templateDetail.length} baris
                </strong>
              </div>
            )}

            {/* Action buttons — TETAP TAMPIL saat generating, cukup disabled + spinner */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {preview.unitAktif.length > 0 && (
                <button
                  style={{
                    ...S.btnGenerate,
                    opacity: step === STEP.GENERATING ? 0.75 : 1,
                    cursor: step === STEP.GENERATING ? 'not-allowed' : 'pointer',
                  }}
                  onClick={handleGenerate}
                  disabled={step === STEP.GENERATING}
                >
                  {step === STEP.GENERATING
                    ? (<><Spinner /> Generating…</>)
                    : (<>⚡ Generate {preview.unitAktif.length} Timesheet</>)}
                </button>
              )}
              <button
                style={{
                  ...S.btnDanger,
                  opacity: step === STEP.GENERATING ? 0.6 : 1,
                  cursor: step === STEP.GENERATING ? 'not-allowed' : 'pointer',
                }}
                onClick={handleReset}
                disabled={step === STEP.GENERATING}
              >
                ← Batal / Ubah
              </button>
            </div>

            {/* Progress detail — tambahan info di bawah tombol, bukan pengganti tombol */}
            {step === STEP.GENERATING && progress && (
              <div style={{ marginTop: 16 }}>
                <div style={S.progressBar}>
                  <div style={S.progressFill(Math.round((progress.done / progress.total) * 100))} />
                </div>
                <p style={{ color: t.subtitle, fontSize: 13, margin: '8px 0 0' }}>
                  {progress.done} / {progress.total} unit selesai
                  {progress.currentUnit ? ` — sedang memproses ${progress.currentUnit}` : ''}
                </p>
                <p style={{ ...S.dimText, marginTop: 6 }}>
                  Jangan tutup atau refresh halaman ini.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            DONE — hasil generate
            ══════════════════════════════════════ */}
        {step === STEP.DONE && result && (
          <div>
            {result.berhasil > 0 && (
              <div style={S.successBox}>
                <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800 }}>
                  ✅ Generate selesai!
                </p>
                <p style={{ margin: 0, fontSize: 13 }}>
                  <strong>{result.berhasil}</strong> timesheet berhasil dibuat
                  {result.dilewati > 0 && `, ${result.dilewati} unit dilewati (sudah ada)`}.
                </p>
              </div>
            )}

            {result.berhasil === 0 && result.errors.length === 0 && (
              <div style={S.warnBox}>
                ⚠ Tidak ada timesheet baru yang dibuat. Semua unit sudah memiliki data untuk tanggal dan shift ini.
              </div>
            )}

            {result.errors.length > 0 && (
              <div style={S.errorBox}>
                <p style={{ margin: '0 0 10px', fontWeight: 700 }}>
                  ❌ {result.errors.length} unit gagal diproses:
                </p>
                <table style={{ ...S.table, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={S.th}>Unit</th>
                      <th style={S.th}>Pesan Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td style={{ ...S.td, fontWeight: 700 }}>{e.unit}</td>
                        <td style={{ ...S.td, color: t.errorColor || t.dim }}>{e.pesan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button style={S.btnGenerate} onClick={handleReset}>
              ↩ Generate Baru
            </button>
          </div>
        )}

        {/* ERROR state (fetch gagal sebelum konfirmasi) */}
        {step === STEP.ERROR && (
          <div style={S.errorBox}>
            <p style={{ margin: '0 0 10px', fontWeight: 700 }}>❌ Terjadi kesalahan:</p>
            <p style={{ margin: '0 0 14px', fontSize: 13 }}>{errMsg}</p>
            <button style={S.btnDanger} onClick={handleReset}>← Kembali</button>
          </div>
        )}

        {/* TOMBOL UTAMA — tetap tampil di IDLE maupun LOADING (tidak disembunyikan, hanya disabled) */}
        {(step === STEP.IDLE || step === STEP.LOADING) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              style={{
                ...S.btnGenerate,
                opacity: (!templateId || !tanggal || templateDetail.length === 0 || step === STEP.LOADING) ? 0.6 : 1,
                cursor: (!templateId || !tanggal || templateDetail.length === 0 || step === STEP.LOADING) ? 'not-allowed' : 'pointer',
              }}
              onClick={handlePreview}
              disabled={!templateId || !tanggal || templateDetail.length === 0 || step === STEP.LOADING}
            >
              {step === STEP.LOADING ? (<><Spinner /> Memeriksa…</>) : <>🔍 Cek & Preview Generate</>}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}