import React, { useState, useRef } from 'react'

// point to FastAPI (change if needed)
const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8000'
const reportUrl = (p = '') => `${API_URL}${p || ''}`

// ---------- styles ----------
const theme = {
  bg: '#0f172a',
  panel: '#0b1220',
  border: '#1f2a44',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  primary: '#2563eb',
  primaryBorder: '#1d4ed8',
  ok: '#22c55e',
  warn: '#f59e0b',
  bad: '#ef4444',
}

const s = {
  page: { background: theme.bg, color: theme.text, padding: 24, fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' },
  container: { maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, fontSize: 20 },
  badge: { fontSize: 12, padding: '4px 8px', border: `1px solid ${theme.border}`, borderRadius: 999, color: theme.textDim },
  layout: { display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 16 },
  card: { background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18, boxShadow: '0 10px 20px rgba(0,0,0,0.25)' },
  // stepper
  stepper: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 },
  step: (active, done) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
    background: active ? '#0c1a33' : '#0a1222', border: `1px solid ${active ? '#24427a' : theme.border}`,
    color: done ? theme.ok : active ? theme.text : theme.textDim, fontWeight: 700, fontSize: 13,
  }),
  // form
  label: { fontSize: 12, color: '#93c5fd', fontWeight: 700, marginBottom: 6, letterSpacing: 0.2 },
  input: { background: '#0a0f1d', border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', color: theme.text, outline: 'none' },
  textarea: { background: '#0a0f1d', border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, minHeight: 200, resize: 'vertical', color: theme.text, outline: 'none' },
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  // dropzone
  drop: (drag) => ({
    border: `2px dashed ${drag ? '#60a5fa' : theme.border}`,
    background: drag ? '#0c1a33' : '#0a0f1d',
    color: theme.textDim,
    borderRadius: 14, padding: 18, textAlign: 'center', transition: '0.15s',
  }),
  // actions
  btn: { background: theme.primary, border: `1px solid ${theme.primaryBorder}`, borderRadius: 10, padding: '10px 16px', color: 'white', fontWeight: 800, cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 16px', color: theme.textDim, cursor: 'pointer' },
  helper: { fontSize: 12, color: theme.textDim },
  // right panel
  rightTitle: { fontWeight: 800, marginBottom: 8 },
  error: { marginTop: 10, color: '#fecaca', background: '#7f1d1d', border: `1px solid ${theme.bad}`, padding: '10px 12px', borderRadius: 10 },
  // result
  resultHeader: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 },
  ringWrap: { width: 120, height: 120, position: 'relative' },
  ringTrack: { position: 'absolute', inset: 0, borderRadius: '50%', background: '#0b162b' },
  ringLabel: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 20 },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 },
  kpiCard: { background: '#0a0f1d', border: `1px solid ${theme.border}`, borderRadius: 12, padding: 10, textAlign: 'center' },
  kpiLabel: { fontSize: 12, color: theme.textDim },
  kpiVal: { fontSize: 18, fontWeight: 900 },
  list: { margin: 0, paddingLeft: 18 },
  link: { color: '#93c5fd', textDecoration: 'underline' },
  footer: { marginTop: 14, textAlign: 'center', color: theme.textDim, fontSize: 12 },
}

// ring style based on score
const ringStyle = (score = 0) => ({
  background: `conic-gradient(${score >= 80 ? '#22c55e' : score >= 60 ? '#60a5fa' : '#f87171'} ${score * 3.6}deg, #13203d 0)`,
  borderRadius: '50%', width: '100%', height: '100%',
})

export default function App() {
  // form state
  const [cvFile, setCvFile] = useState(null)
  const [jdText, setJdText] = useState('')
  const [email, setEmail] = useState('')
  const [sendEmail, setSendEmail] = useState(false)

  // ui state
  const [drag, setDrag] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)

  // stepper derived
  const step1Done = !!cvFile
  const step2Done = jdText.trim().length > 0

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    setCvFile(f); setResult(null); setError(null)
  }

  const onBrowse = (e) => {
    const f = e.target.files?.[0]
    setCvFile(f || null); setResult(null); setError(null)
  }

  const analyze = async () => {
    setError(null); setResult(null)
    if (!cvFile) return setError('Upload a CV (PDF or DOCX).')
    if (!jdText.trim()) return setError('Paste the Job Description.')
    if (sendEmail && !email.trim()) return setError('Enter an email to receive the PDF.')

    try {
      setLoading(true)
      const fd = new FormData()
      fd.append('cv', cvFile)
      fd.append('jdText', jdText)
      if (email) fd.append('email', email)
      fd.append('sendEmail', String(sendEmail))

      const resp = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: fd })
      let data
      try {
        data = await resp.json()
      } catch {
        const t = await resp.text()
        if (!resp.ok) throw new Error(t || 'Analysis failed')
        throw new Error('Unexpected response')
      }
      if (!resp.ok) {
        throw new Error(data?.message || data?.detail || 'Analysis failed')
      }
      setResult(data)
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const advice = (score=0) => score >= 80
    ? 'Strong fit — Apply now ✅'
    : score >= 60
      ? 'Decent — Tweak CV with suggestions, then apply 👍'
      : 'Weak — Improve CV or try a closer role ⚠️'

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* header */}
        <div style={s.header}>
          <div style={s.brand}>
            <span role="img" aria-label="spark">⚡</span> CV-Checker
          </div>
        </div>

        {/* stepper */}
        <div style={s.card}>
          <div style={s.stepper}>
            <div style={s.step(!step1Done || (step1Done && !step2Done), step1Done)}>1. Upload CV</div>
            <div style={s.step(step1Done && !step2Done, step2Done)}>2. Paste JD</div>
            <div style={s.step(step1Done && step2Done, !!result)}>3. Analyze</div>
          </div>

          {/* layout: left form, right info */}
          <div style={s.layout}>
            {/* LEFT */}
            <div>
              {/* CV dropzone */}
              <div style={{ marginBottom: 14 }}>
                <div style={s.label}>CV (PDF or DOCX)</div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={onDrop}
                  style={s.drop(drag)}
                >
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    {cvFile ? `Selected: ${cvFile.name}` : 'Drag & drop your CV here'}
                  </div>
                  <div style={s.helper}>or</div>
                  <div style={{ marginTop: 10 }}>
                    <button
                      style={s.btnGhost}
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      Browse file
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      onChange={onBrowse}
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>
                <div style={s.helper}>&nbsp;Max ~3MB. Avoid images/tables for ATS.</div>
              </div>

              {/* JD textarea */}
              <div style={{ marginBottom: 14 }}>
                <div style={s.label}>Job Description (paste text)</div>
                <textarea
                  style={s.textarea}
                  placeholder="Paste the JD here… Include required skills and years of experience."
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
              </div>

              {/* email + actions */}
              <div style={{ ...s.row, justifyContent: 'space-between' }}>
                <div style={s.row}>
                  <input id="sendEmail" type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                  <label htmlFor="sendEmail" style={s.helper}>Email me the PDF</label>
                  <input
                    style={{ ...s.input, width: 240 }}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!sendEmail}
                  />
                </div>

                <div style={s.row}>
                  <button style={s.btn} onClick={analyze} disabled={loading}>
                    {loading ? 'Analyzing…' : 'Analyze'}
                  </button>
                  <button
                    style={s.btnGhost}
                    onClick={() => { setCvFile(null); setJdText(''); setEmail(''); setSendEmail(false); setResult(null); setError(null) }}
                    disabled={loading}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {error && <div style={s.error}>{error}</div>}
            </div>

            {/* RIGHT */}
            <div>
              {!result ? (
                <div style={s.card}>
                  <div style={s.rightTitle}>Status</div>
                  <div style={s.helper}>
                    Step-1: Upload your CV. Step-2: Paste JD. Step-3: Click <b>Analyze</b> to see your match score,
                    breakdown, suggestions, and a downloadable PDF report.
                  </div>
                  <ul style={{ ...s.list, marginTop: 10 }}>
                    <li>ATS-friendly tips: avoid tables & images</li>
                    <li>Use clear section headings (Summary, Experience, Education, Skills)</li>
                    <li>Quantify impact (e.g., “cut load time by 30%”)</li>
                  </ul>
                </div>
              ) : (
                <div style={s.card}>
                  <div style={s.resultHeader}>
                    <div style={s.ringWrap}>
                      <div style={s.ringTrack}></div>
                      <div style={ringStyle(result.score)} />
                      <div style={s.ringLabel}>{result.score}%</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>Overall Match</div>
                      <div style={s.helper}>{advice(result.score)}</div>
                      {result.pdfPath && (
                        <div style={{ marginTop: 6 }}>
                          <a href={reportUrl(result.pdfPath)} target="_blank" rel="noreferrer" style={s.link}>
                            Download PDF Report
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={s.kpis}>
                    <div style={s.kpiCard}>
                      <div style={s.kpiLabel}>Skills</div>
                      <div style={s.kpiVal}>{result.breakdown?.skills ?? 0}%</div>
                    </div>
                    <div style={s.kpiCard}>
                      <div style={s.kpiLabel}>Experience</div>
                      <div style={s.kpiVal}>{result.breakdown?.experience ?? 0}%</div>
                    </div>
                    <div style={s.kpiCard}>
                      <div style={s.kpiLabel}>Education</div>
                      <div style={s.kpiVal}>{result.breakdown?.education ?? 0}%</div>
                    </div>
                    <div style={s.kpiCard}>
                      <div style={s.kpiLabel}>Extras</div>
                      <div style={s.kpiVal}>{result.breakdown?.extras ?? 0}%</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Top Suggestions</div>
                    <ul style={s.list}>
                      {result.suggestions?.map((it, idx) => <li key={idx}>{it}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={s.footer}>Built with ❤ — CV-Checker</div>
      </div>
    </div>
  )
}
