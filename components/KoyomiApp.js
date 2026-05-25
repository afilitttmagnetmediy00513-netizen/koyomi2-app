'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── utils ──────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const toMins = (h, m) => h * 60 + m
const fromMins = (mins) => ({ h: Math.floor(mins / 60), m: mins % 60 })
const dateKey = (y, mo, d) => `${y}-${pad(mo + 1)}-${pad(d)}`
const todayKey = () => {
  const t = new Date()
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate())
}
const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
const MONTHS_JA = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const getDaysInMonth = (y, mo) => new Date(y, mo + 1, 0).getDate()
const getFirstDow = (y, mo) => new Date(y, mo, 1).getDay()
const EVENT_COLORS = ['#4f8ef7','#f76b6b','#4ecb71','#f7a94f','#b57bee','#4ecbcb','#f76bab']
const HOUR_H = 64

// ── localStorage persistence ───────────────────────────────────────────────
function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    if (typeof window === 'undefined') return initial
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initial
    } catch { return initial }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
  }, [key, val])
  const setAndStore = useCallback((updater) => {
    setVal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      return next
    })
  }, [key])
  return [val, setAndStore]
}

// ── free-time detection ────────────────────────────────────────────────────
function getFreeSlots(events, dayStart = 7 * 60, dayEnd = 23 * 60, minGap = 30) {
  const sorted = [...events]
    .map(e => ({ s: toMins(e.startHour, e.startMin), e: toMins(e.endHour, e.endMin) }))
    .sort((a, b) => a.s - b.s)
  const busy = []
  for (const ev of sorted) {
    const s = Math.max(ev.s, dayStart), e = Math.min(ev.e, dayEnd)
    if (s >= e) continue
    if (busy.length && s <= busy[busy.length - 1].e)
      busy[busy.length - 1].e = Math.max(busy[busy.length - 1].e, e)
    else busy.push({ s, e })
  }
  const free = []
  let cursor = dayStart
  for (const b of busy) {
    if (b.s - cursor >= minGap) free.push({ startMins: cursor, endMins: b.s })
    cursor = Math.max(cursor, b.e)
  }
  if (dayEnd - cursor >= minGap) free.push({ startMins: cursor, endMins: dayEnd })
  return free
}

// ── init data ──────────────────────────────────────────────────────────────
const TODAY = new Date()
const TY = TODAY.getFullYear(), TM = TODAY.getMonth(), TD = TODAY.getDate()
const INIT_EVENTS = {
  [dateKey(TY, TM, TD)]: [
    { id:'e1', title:'朝ミーティング', startHour:9,  startMin:0,  endHour:10, endMin:0,  color:'#4f8ef7', notes:'', type:'event' },
    { id:'e2', title:'ランチ',         startHour:12, startMin:0,  endHour:13, endMin:0,  color:'#4ecb71', notes:'', type:'event' },
    { id:'e3', title:'夕方MTG',        startHour:17, startMin:0,  endHour:18, endMin:0,  color:'#f76b6b', notes:'', type:'event' },
  ],
  [dateKey(TY, TM, TD + 1)]: [
    { id:'e4', title:'バイト',         startHour:8,  startMin:0,  endHour:14, endMin:0,  color:'#f7a94f', notes:'', type:'event' },
  ],
}
const INIT_TEMPLATES = [
  { id:'t1', title:'バイト', startHour:8,  startMin:0,  endHour:14, endMin:0,  color:'#f7a94f' },
  { id:'t2', title:'授業',   startHour:10, startMin:40, endHour:12, endMin:10, color:'#b57bee' },
  { id:'t3', title:'ジム',   startHour:18, startMin:0,  endHour:20, endMin:0,  color:'#4ecbcb' },
]

// ── ROOT ───────────────────────────────────────────────────────────────────
export default function KoyomiApp() {
  const [view, setView] = useState('month')
  const [year, setYear] = useState(TY)
  const [month, setMonth] = useState(TM)
  const [selDate, setSelDate] = useState(todayKey())
  const [events, setEvents] = useLocalStorage('koyomi_events', INIT_EVENTS)
  const [templates, setTemplates] = useLocalStorage('koyomi_templates', INIT_TEMPLATES)
  const [todos, setTodos] = useLocalStorage('koyomi_todos', {})
  const [modal, setModal] = useState(null)
  const [activeDate, setActiveDate] = useState(todayKey())
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function shiftPeriod(dir) {
    if (view === 'month') {
      let mo = month + dir, yr = year
      if (mo < 0) { mo = 11; yr-- }
      if (mo > 11) { mo = 0; yr++ }
      setYear(yr); setMonth(mo)
    } else if (view === 'week') {
      const d = new Date(selDate); d.setDate(d.getDate() + dir * 7)
      setSelDate(dateKey(d.getFullYear(), d.getMonth(), d.getDate()))
      setYear(d.getFullYear()); setMonth(d.getMonth())
    } else {
      const d = new Date(selDate); d.setDate(d.getDate() + dir)
      setSelDate(dateKey(d.getFullYear(), d.getMonth(), d.getDate()))
      setYear(d.getFullYear()); setMonth(d.getMonth())
    }
  }

  const addEvent    = (dk, ev) => setEvents(p => ({ ...p, [dk]: [...(p[dk]||[]), {...ev, id:'e'+Date.now()}] }))
  const updateEvent = (dk, ev) => setEvents(p => ({ ...p, [dk]: (p[dk]||[]).map(e => e.id===ev.id ? ev : e) }))
  const removeEvent = (dk, id) => setEvents(p => ({ ...p, [dk]: (p[dk]||[]).filter(e => e.id!==id) }))
  const addTodo     = (dk, text, slotKey) => setTodos(p => ({ ...p, [dk]: [...(p[dk]||[]), {id:'td'+Date.now(), text, done:false, slotKey}] }))
  const toggleTodo  = (dk, id) => setTodos(p => ({ ...p, [dk]: (p[dk]||[]).map(t => t.id===id ? {...t,done:!t.done} : t) }))
  const removeTodo  = (dk, id) => setTodos(p => ({ ...p, [dk]: (p[dk]||[]).filter(t => t.id!==id) }))

  const openAdd  = (dk) => { setActiveDate(dk); setModal({ mode:'add', dKey:dk }) }
  const openEdit = (dk, ev) => { setActiveDate(dk); setModal({ mode:'edit', dKey:dk, ev }) }

  const headerTitle = () => {
    if (view === 'month') return `${year}年 ${MONTHS_JA[month]}`
    if (view === 'week') {
      const d = new Date(selDate), dow = d.getDay()
      const mo = new Date(d); mo.setDate(d.getDate() - dow)
      const su = new Date(mo); su.setDate(mo.getDate() + 6)
      return `${mo.getFullYear()}年${MONTHS_JA[mo.getMonth()]} ${mo.getDate()}〜${su.getDate()}日`
    }
    const d = new Date(selDate)
    return `${d.getFullYear()}年${MONTHS_JA[d.getMonth()]} ${d.getDate()}日（${DAYS_JA[d.getDay()]}）`
  }

  return (
    <div style={css.root}>
      {sidebarOpen && <div style={css.overlay} onClick={() => setSidebarOpen(false)} />}
      <Sidebar
        open={sidebarOpen}
        templates={templates}
        setTemplates={setTemplates}
        activeDate={activeDate}
        addEvent={addEvent}
        onClose={() => setSidebarOpen(false)}
      />

      <header style={css.header}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button style={css.iconBtn} onClick={() => setSidebarOpen(o=>!o)}>☰</button>
          <span style={css.appName}>Koyomi</span>
        </div>
        <div style={css.headerNav}>
          <button style={css.navBtn} onClick={() => shiftPeriod(-1)}>‹</button>
          <span style={css.headerTitle}>{headerTitle()}</span>
          <button style={css.navBtn} onClick={() => shiftPeriod(1)}>›</button>
        </div>
        <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
          {[['month','月'],['week','週'],['day','日']].map(([v,l]) => (
            <button key={v}
              style={{...css.viewBtn, ...(view===v ? css.viewBtnOn : {})}}
              onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
      </header>

      <main style={css.main}>
        {view==='month' && (
          <MonthView year={year} month={month} events={events} todos={todos}
            selDate={selDate}
            onSelectDate={d => { setSelDate(d); setView('day') }} />
        )}
        {view==='week' && (
          <WeekView selDate={selDate} events={events}
            onSelectDate={d => { setSelDate(d); setView('day') }}
            onEditEvent={openEdit}
            onAddEvent={openAdd} />
        )}
        {view==='day' && (
          <DayView
            dKey={selDate}
            events={events[selDate]||[]}
            todos={todos[selDate]||[]}
            onAddEvent={() => openAdd(selDate)}
            onEditEvent={ev => openEdit(selDate, ev)}
            onRemoveEvent={id => removeEvent(selDate, id)}
            onAddTodo={(text, slotKey) => addTodo(selDate, text, slotKey)}
            onToggleTodo={id => toggleTodo(selDate, id)}
            onRemoveTodo={id => removeTodo(selDate, id)}
            onOpenTemplates={() => { setActiveDate(selDate); setSidebarOpen(true) }}
          />
        )}
      </main>

      <button style={css.fab} onClick={() => openAdd(selDate)}>＋</button>

      {modal && (
        <EventModal
          dKey={modal.dKey}
          initial={modal.ev}
          onSave={(ev, newDKey) => {
            if (modal.mode === 'edit') {
              if (newDKey !== modal.dKey) {
                removeEvent(modal.dKey, modal.ev.id)
                addEvent(newDKey, ev)
              } else {
                updateEvent(modal.dKey, ev)
              }
            } else {
              addEvent(newDKey, ev)
            }
            setModal(null)
          }}
          onClose={() => setModal(null)}
          onDelete={modal.mode==='edit'
            ? () => { removeEvent(modal.dKey, modal.ev.id); setModal(null) }
            : null}
        />
      )}
    </div>
  )
}

// ── SIDEBAR ────────────────────────────────────────────────────────────────
function Sidebar({ open, templates, setTemplates, activeDate, addEvent, onClose }) {
  const [showForm, setShowForm] = useState(false)
  const [tpl, setTpl] = useState({ title:'', startHour:9, startMin:0, endHour:10, endMin:0, color:EVENT_COLORS[0] })
  const setT = (k, v) => setTpl(p => ({...p, [k]:v}))

  const apply = (t) => {
    addEvent(activeDate, { title:t.title, startHour:t.startHour, startMin:t.startMin, endHour:t.endHour, endMin:t.endMin, color:t.color, notes:'', type:'event' })
    onClose()
  }
  const save = () => {
    if (!tpl.title.trim()) return
    setTemplates(p => [...p, {...tpl, id:'t'+Date.now()}])
    setShowForm(false)
    setTpl({ title:'', startHour:9, startMin:0, endHour:10, endMin:0, color:EVENT_COLORS[0] })
  }

  return (
    <aside style={{...css.sidebar, transform: open ? 'translateX(0)' : 'translateX(-100%)'}}>
      <div style={css.sbHead}>
        <span style={css.sbTitle}>テンプレート</span>
        <button style={css.iconBtn} onClick={onClose}>✕</button>
      </div>
      <p style={css.sbSub}>📅 {activeDate} に適用</p>
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {templates.map(t => (
          <div key={t.id} style={css.tplRow}>
            <div style={{...css.tplDot, background:t.color}} />
            <div style={{flex:1,cursor:'pointer'}} onClick={() => apply(t)}>
              <span style={css.tplName}>{t.title}</span>
              <span style={css.tplTime}>{pad(t.startHour)}:{pad(t.startMin)} 〜 {pad(t.endHour)}:{pad(t.endMin)}</span>
            </div>
            <button style={css.tplDel} onClick={() => setTemplates(p => p.filter(x => x.id!==t.id))}>✕</button>
          </div>
        ))}
      </div>
      {!showForm ? (
        <button style={css.addTplBtn} onClick={() => setShowForm(true)}>＋ テンプレートを追加</button>
      ) : (
        <div style={css.tplForm}>
          <input style={{...css.fi, width:'100%'}} placeholder="タイトル" value={tpl.title} onChange={e=>setT('title',e.target.value)} />
          <TimeInputRow label="開始" h={tpl.startHour} m={tpl.startMin} onH={v=>setT('startHour',v)} onM={v=>setT('startMin',v)} />
          <TimeInputRow label="終了" h={tpl.endHour}   m={tpl.endMin}   onH={v=>setT('endHour',v)}   onM={v=>setT('endMin',v)} />
          <ColorPicker value={tpl.color} onChange={v=>setT('color',v)} />
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button style={css.saveBtn} onClick={save}>保存</button>
            <button style={css.cancelBtn} onClick={() => setShowForm(false)}>キャンセル</button>
          </div>
        </div>
      )}
    </aside>
  )
}

// ── shared sub-components ──────────────────────────────────────────────────
function TimeInputRow({ label, h, m, onH, onM }) {
  return (
    <div style={css.timeInputRow}>
      <span style={css.timeLabel}>{label}</span>
      <div style={css.timeSegment}>
        <input style={css.timeNum} type="number" min={0} max={23} value={h}
          onChange={e => onH(Math.min(23, Math.max(0, +e.target.value)))} />
        <span style={css.timeColon}>:</span>
        <input style={css.timeNum} type="number" min={0} max={59} step={5} value={m}
          onChange={e => onM(Math.min(59, Math.max(0, +e.target.value)))} />
      </div>
    </div>
  )
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{display:'flex',gap:7,flexWrap:'wrap',padding:'2px 0'}}>
      {EVENT_COLORS.map(c => (
        <div key={c} onClick={() => onChange(c)} style={{
          width:24, height:24, borderRadius:'50%', background:c, cursor:'pointer',
          border: value===c ? '2px solid #fff' : '2px solid transparent',
          boxShadow: value===c ? `0 0 0 2px ${c}` : 'none',
          transition:'all .15s'
        }} />
      ))}
    </div>
  )
}

// ── MONTH VIEW ─────────────────────────────────────────────────────────────
function MonthView({ year, month, events, todos, selDate, onSelectDate }) {
  const firstDow = getFirstDow(year, month)
  const dim = getDaysInMonth(year, month)
  const cells = [...Array(firstDow).fill(null), ...Array.from({length:dim},(_,i)=>i+1)]
  while (cells.length % 7) cells.push(null)
  const tk = todayKey()

  return (
    <div style={css.monthWrap}>
      <div style={css.monthDayHeader}>
        {DAYS_JA.map((d,i) => (
          <div key={d} style={{...css.monthDayHCell, color:i===0?'#f76b6b':i===6?'#4f8ef7':'#666'}}>{d}</div>
        ))}
      </div>
      <div style={css.monthGrid}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={css.monthEmpty} />
          const dk = dateKey(year, month, d)
          const evs = events[dk]||[], tds = todos[dk]||[]
          const isToday = dk === tk
          const dow = (firstDow + d - 1) % 7
          return (
            <div key={i} style={{...css.monthCell, ...(isToday?css.cellToday:{})}} onClick={() => onSelectDate(dk)}>
              <span style={{
                ...css.monthDNum,
                background: isToday?'#4f8ef7':'transparent',
                color: isToday?'#fff':dow===0?'#f76b6b':dow===6?'#4f8ef7':'#ccc',
                fontWeight: isToday?700:400,
              }}>{d}</span>
              {evs.slice(0,2).map(ev => (
                <div key={ev.id} style={{...css.monthChip, background:ev.color+'28', borderLeft:`2px solid ${ev.color}`}}>
                  <span style={css.monthChipText}>{ev.title}</span>
                </div>
              ))}
              {tds.slice(0,1).map(td => (
                <div key={td.id} style={{...css.monthChip, background:'#ffffff10', borderLeft:'2px solid #555', opacity:td.done?.5:1}}>
                  <span style={css.monthChipText}>✓ {td.text}</span>
                </div>
              ))}
              {evs.length+tds.length > 3 && <span style={css.monthMore}>+{evs.length+tds.length-3}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── WEEK VIEW ──────────────────────────────────────────────────────────────
function WeekView({ selDate, events, onSelectDate, onEditEvent, onAddEvent }) {
  const d = new Date(selDate), dow = d.getDay()
  const days = Array.from({length:7}, (_,i) => {
    const nd = new Date(d); nd.setDate(d.getDate() - dow + i)
    return { date:nd, key:dateKey(nd.getFullYear(), nd.getMonth(), nd.getDate()) }
  })
  const tk = todayKey()
  const scrollRef = useRef(null)
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H }, [])

  const COL_W = 52, GUTTER_W = 42
  const totalW = GUTTER_W + COL_W * 7

  return (
    <div style={css.timeViewWrap}>
      {/* day header — horizontal scroll */}
      <div style={{overflowX:'auto', overflowY:'hidden', flexShrink:0, borderBottom:'1px solid #16161e'}}>
        <div style={{display:'flex', minWidth:totalW}}>
          <div style={{width:GUTTER_W, flexShrink:0}} />
          {days.map(({date,key},i) => (
            <div key={key}
              style={{width:COL_W, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center',
                padding:'7px 0', cursor:'pointer', borderLeft:'1px solid #16161e',
                ...(key===tk ? {background:'#151525'} : {})}}
              onClick={() => onSelectDate(key)}>
              <span style={{fontSize:10, color:i===0?'#f76b6b':i===6?'#4f8ef7':'#666'}}>{DAYS_JA[i]}</span>
              <span style={{fontSize:17, fontWeight:key===tk?700:400, color:key===tk?'#fff':'#ccc'}}>{date.getDate()}</span>
            </div>
          ))}
        </div>
      </div>
      {/* time grid — vertical + horizontal scroll */}
      <div style={{flex:1, overflowY:'auto', overflowX:'auto', minHeight:0}} ref={scrollRef}>
        <div style={{display:'flex', position:'relative', minWidth:totalW}}>
          <div style={{...css.timeGutter, width:GUTTER_W}}>
            {Array.from({length:24},(_,h) => (
              <div key={h} style={{height:HOUR_H,display:'flex',alignItems:'flex-start',paddingTop:2,fontSize:9,color:'#444'}}>{pad(h)}:00</div>
            ))}
          </div>
          {days.map(({key}) => (
            <div key={key} style={{width:COL_W, flexShrink:0, position:'relative', borderLeft:'1px solid #16161e'}}>
              {Array.from({length:24},(_,h) => <div key={h} style={css.hLine} />)}
              {(events[key]||[]).map(ev => <EventBlock key={ev.id} ev={ev} onClick={() => onEditEvent(key,ev)} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── DAY VIEW ───────────────────────────────────────────────────────────────
function DayView({ dKey, events, todos, onAddEvent, onEditEvent, onRemoveEvent, onAddTodo, onToggleTodo, onRemoveTodo, onOpenTemplates }) {
  const scrollRef = useRef(null)
  const [taskOpen, setTaskOpen] = useState(false)
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H }, [dKey])

  const isToday = dKey === todayKey()
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const freeSlots = getFreeSlots(events)

  const todosBySlot = {}
  for (const td of todos) {
    const k = td.slotKey || '__global__'
    if (!todosBySlot[k]) todosBySlot[k] = []
    todosBySlot[k].push(td)
  }

  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      {/* collapsible task header */}
      <div style={css.taskPanelHeader} onClick={() => setTaskOpen(o=>!o)}>
        <span style={css.taskPanelTitle}>📋 タスク <span style={{color:'#555',fontSize:11}}>({todos.length}件)</span></span>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button style={css.tplLinkBtn} onClick={e=>{e.stopPropagation();onOpenTemplates()}}>テンプレート</button>
          <span style={{color:'#555',fontSize:13,transition:'transform .2s',display:'inline-block',transform:taskOpen?'rotate(180deg)':'rotate(0deg)'}}>▼</span>
        </div>
      </div>

      {taskOpen && (
        <div style={css.taskPanel}>
          <div style={css.slotBlock}>
            <span style={css.slotLabel}>全般タスク</span>
            <TodoInputLine onAdd={text => onAddTodo(text, '__global__')} />
            {(todosBySlot['__global__']||[]).map(td => (
              <TodoRow key={td.id} td={td} onToggle={() => onToggleTodo(td.id)} onRemove={() => onRemoveTodo(td.id)} />
            ))}
          </div>
        </div>
      )}

      {/* time grid */}
      <div style={{flex:1, overflowY:'auto', position:'relative'}} ref={scrollRef}>
        <div style={{display:'flex', position:'relative'}}>
          <div style={css.timeGutter}>
            {Array.from({length:24},(_,h) => (
              <div key={h} style={{height:HOUR_H,display:'flex',alignItems:'flex-start',paddingTop:2,fontSize:9,color:'#444'}}>{pad(h)}:00</div>
            ))}
          </div>
          <div style={{flex:1, position:'relative', minHeight:24*HOUR_H}}>
            {Array.from({length:24},(_,h) => <div key={h} style={css.hLine} />)}

            {/* now indicator */}
            {isToday && (
              <div style={{position:'absolute',left:0,right:0,top:nowMins*(HOUR_H/60),height:2,background:'#f76b6b',zIndex:6,pointerEvents:'none'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'#f76b6b',position:'absolute',left:-4,top:-3}} />
              </div>
            )}

            {/* free slot overlays */}
            {freeSlots.map((slot,i) => {
              const slotKey = `slot_${slot.startMins}_${slot.endMins}`
              const slotTodos = todosBySlot[slotKey]||[]
              const sh = fromMins(slot.startMins), eh = fromMins(slot.endMins)
              const topPx = slot.startMins * (HOUR_H / 60)
              const heightPx = (slot.endMins - slot.startMins) * (HOUR_H / 60)
              return (
                <div key={i} style={{...css.freeSlot, top:topPx, height:heightPx}}>
                  <div style={css.freeSlotInner}>
                    <span style={css.freeLabel}>{pad(sh.h)}:{pad(sh.m)} 〜 {pad(eh.h)}:{pad(eh.m)}　空き {Math.round((slot.endMins-slot.startMins)/60*10)/10}h</span>
                    {slotTodos.map(td => (
                      <TodoRow key={td.id} td={td} compact onToggle={() => onToggleTodo(td.id)} onRemove={() => onRemoveTodo(td.id)} />
                    ))}
                    <TodoInputLine compact placeholder="このスロットにタスクを追加…" onAdd={text => onAddTodo(text, slotKey)} />
                  </div>
                </div>
              )
            })}

            {/* events */}
            {events.map(ev => (
              <EventBlock key={ev.id} ev={ev} showDetail
                onClick={() => onEditEvent(ev)}
                onDelete={() => onRemoveEvent(ev.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── EVENT BLOCK ────────────────────────────────────────────────────────────
function EventBlock({ ev, onClick, onDelete, showDetail }) {
  const top = (ev.startHour + ev.startMin/60) * HOUR_H
  const height = Math.max(22, ((ev.endHour+ev.endMin/60)-(ev.startHour+ev.startMin/60)) * HOUR_H)
  return (
    <div style={{
      position:'absolute', left:showDetail?4:2, right:showDetail?6:2,
      top, height, borderRadius:7, padding:'4px 8px',
      background:ev.color+'cc', borderLeft:`3px solid ${ev.color}`,
      display:'flex', flexDirection:'column', cursor:'pointer',
      overflow:'hidden', zIndex:3, boxShadow:'0 2px 8px #00000040'
    }} onClick={onClick}>
      <span style={{fontSize:12,fontWeight:700,color:'#fff',lineHeight:1.3}}>{ev.title}</span>
      <span style={{fontSize:10,color:'#ffffffbb'}}>{pad(ev.startHour)}:{pad(ev.startMin)} 〜 {pad(ev.endHour)}:{pad(ev.endMin)}</span>
      {showDetail && ev.notes && (
        <span style={{fontSize:10,color:'#ffffffaa',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.notes}</span>
      )}
      {onDelete && (
        <button style={{position:'absolute',top:3,right:5,background:'none',border:'none',color:'#ffffff88',fontSize:11,cursor:'pointer',lineHeight:1}}
          onClick={e=>{e.stopPropagation();onDelete()}}>✕</button>
      )}
    </div>
  )
}

// ── TODO COMPONENTS ────────────────────────────────────────────────────────
function TodoInputLine({ onAdd, compact, placeholder }) {
  const [val, setVal] = useState('')
  const submit = () => { if (val.trim()) { onAdd(val.trim()); setVal('') } }
  return (
    <div style={{display:'flex',gap:5,marginTop:compact?3:6}}>
      <input
        style={{...css.todoInput, fontSize:compact?11:12, padding:compact?'4px 7px':'6px 9px'}}
        placeholder={placeholder||'タスクを追加…'} value={val}
        onChange={e=>setVal(e.target.value)}
        onKeyDown={e=>e.key==='Enter'&&submit()} />
      <button style={{...css.todoAddBtn, padding:compact?'0 8px':'0 11px'}} onClick={submit}>＋</button>
    </div>
  )
}

function TodoRow({ td, onToggle, onRemove, compact }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:7,padding:compact?'3px 0':'6px 0',borderBottom:'1px solid #1a1a2a'}}>
      <div style={{...css.todoCheck, background:td.done?'#4f8ef7':'transparent'}} onClick={onToggle}>
        {td.done && <span style={{color:'#fff',fontSize:9}}>✓</span>}
      </div>
      <span style={{flex:1,fontSize:compact?11:12,color:td.done?'#555':'#ccc',textDecoration:td.done?'line-through':'none',lineHeight:1.4}}>{td.text}</span>
      <button style={{background:'none',border:'none',color:'#444',cursor:'pointer',fontSize:10,padding:'0 2px'}} onClick={onRemove}>✕</button>
    </div>
  )
}

// ── EVENT MODAL ────────────────────────────────────────────────────────────
function EventModal({ dKey, initial, onSave, onClose, onDelete }) {
  const [form, setForm] = useState(initial || { title:'', startHour:9, startMin:0, endHour:10, endMin:0, color:EVENT_COLORS[0], notes:'', type:'event' })
  const [selectedDKey, setSelectedDKey] = useState(dKey)
  const set = (k, v) => setForm(p => ({...p, [k]:v}))

  return (
    <div style={css.modalOverlay} onClick={onClose}>
      <div style={css.modal} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <span style={{fontSize:16,fontWeight:700,color:'#fff'}}>{initial?'予定を編集':'予定を追加'}</span>
          <button style={css.iconBtn} onClick={onClose}>✕</button>
        </div>

        {/* date */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,background:'#1a1a26',borderRadius:10,padding:'10px 14px'}}>
          <span style={{fontSize:12,color:'#666',flexShrink:0}}>日付</span>
          <input type="date" value={selectedDKey} onChange={e=>setSelectedDKey(e.target.value)}
            style={{...css.fi, flex:1, padding:'6px 10px', colorScheme:'dark'}} />
        </div>

        {/* title */}
        <input style={{...css.fi, width:'100%', fontSize:15, marginBottom:14}}
          placeholder="タイトル" value={form.title} onChange={e=>set('title',e.target.value)} />

        {/* time */}
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14,background:'#1a1a26',borderRadius:10,padding:'12px 14px'}}>
          <TimeInputRow label="開始" h={form.startHour} m={form.startMin} onH={v=>set('startHour',v)} onM={v=>set('startMin',v)} />
          <div style={{height:1,background:'#2a2a3a'}} />
          <TimeInputRow label="終了" h={form.endHour}   m={form.endMin}   onH={v=>set('endHour',v)}   onM={v=>set('endMin',v)} />
        </div>

        {/* notes */}
        <textarea style={{...css.fi, width:'100%', resize:'vertical', minHeight:60, marginBottom:14, lineHeight:1.5}}
          placeholder="備考（任意）" value={form.notes||''} onChange={e=>set('notes',e.target.value)} />

        {/* color */}
        <div style={{marginBottom:16}}>
          <span style={{fontSize:11,color:'#555',display:'block',marginBottom:6}}>カラー</span>
          <ColorPicker value={form.color} onChange={v=>set('color',v)} />
        </div>

        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button style={css.saveBtn} onClick={() => { if(form.title.trim()) onSave(form, selectedDKey) }}>保存</button>
          {onDelete && <button style={{...css.cancelBtn,background:'#f76b6b22',color:'#f76b6b',border:'1px solid #f76b6b44'}} onClick={onDelete}>削除</button>}
          <button style={css.cancelBtn} onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  )
}

// ── STYLES ─────────────────────────────────────────────────────────────────
const css = {
  root: { fontFamily:"'Noto Sans JP',system-ui,sans-serif", background:'#0a0a0f', color:'#e0e0e0', height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden' },
  overlay: { position:'fixed', inset:0, background:'#00000090', zIndex:40 },
  sidebar: { position:'fixed', top:0, left:0, bottom:0, width:272, background:'#13131c', zIndex:50, transition:'transform .25s ease', padding:'18px 14px', overflowY:'auto', borderRight:'1px solid #1e1e2e' },
  sbHead: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 },
  sbTitle: { fontSize:15, fontWeight:700, color:'#fff' },
  sbSub: { color:'#444', fontSize:11, margin:'0 0 14px' },
  tplRow: { display:'flex', alignItems:'center', gap:9, padding:'9px 10px', background:'#1a1a26', borderRadius:9 },
  tplDot: { width:9, height:9, borderRadius:'50%', flexShrink:0 },
  tplName: { display:'block', fontSize:13, fontWeight:600, color:'#ddd' },
  tplTime: { display:'block', fontSize:10, color:'#666' },
  tplDel: { background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:12, padding:'2px 4px', flexShrink:0 },
  addTplBtn: { marginTop:14, width:'100%', padding:'9px 0', background:'#1a1a26', border:'1px dashed #2e2e3e', borderRadius:9, color:'#666', cursor:'pointer', fontSize:12 },
  tplForm: { marginTop:14, display:'flex', flexDirection:'column', gap:9, padding:12, background:'#1a1a26', borderRadius:10 },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 14px', background:'#0a0a0f', borderBottom:'1px solid #16161e', flexShrink:0 },
  appName: { fontSize:16, fontWeight:800, color:'#4f8ef7', letterSpacing:-0.5, flexShrink:0 },
  headerNav: { display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0, justifyContent:'center' },
  headerTitle: { fontSize:13, fontWeight:600, color:'#ddd', minWidth:0, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 },
  navBtn: { background:'none', border:'none', color:'#555', fontSize:20, cursor:'pointer', padding:'0 4px', lineHeight:1 },
  viewBtn: { background:'#16161e', border:'1px solid #222230', color:'#666', borderRadius:7, padding:'4px 8px', cursor:'pointer', fontSize:11, flexShrink:0 },
  viewBtnOn: { background:'#4f8ef7', color:'#fff', borderColor:'#4f8ef7' },
  iconBtn: { background:'none', border:'none', color:'#666', fontSize:15, cursor:'pointer', padding:'4px 7px' },
  main: { flex:1, overflow:'hidden', display:'flex', flexDirection:'column' },
  monthWrap: { flex:1, overflowY:'auto', padding:'0 6px 10px' },
  monthDayHeader: { display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', marginBottom:3 },
  monthDayHCell: { textAlign:'center', fontSize:10, fontWeight:600, padding:'7px 0' },
  monthGrid: { display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', gap:2 },
  monthCell: { minHeight:85, background:'#10101a', borderRadius:7, padding:'5px 4px', cursor:'pointer', transition:'background .15s', overflow:'hidden', minWidth:0 },
  monthEmpty: { minHeight:85 },
  cellToday: { background:'#151525', outline:'1.5px solid #4f8ef740' },
  monthDNum: { fontSize:12, display:'inline-block', width:20, height:20, lineHeight:'20px', textAlign:'center', borderRadius:'50%', marginBottom:3, flexShrink:0 },
  monthChip: { borderRadius:3, padding:'1px 4px', marginBottom:2, overflow:'hidden', minWidth:0, display:'block' },
  monthChipText: { fontSize:9, color:'#ccc', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  monthMore: { fontSize:9, color:'#444' },
  timeViewWrap: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  timeGutter: { width:42, flexShrink:0, paddingRight:4, textAlign:'right', position:'relative', zIndex:1 },
  hLine: { height:HOUR_H, borderBottom:'1px solid #141420', boxSizing:'border-box' },
  taskPanelHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 14px', background:'#0f0f18', borderBottom:'1px solid #16161e', cursor:'pointer', flexShrink:0, userSelect:'none' },
  taskPanelTitle: { fontSize:13, fontWeight:600, color:'#ccc' },
  tplLinkBtn: { background:'none', border:'1px solid #2a2a3a', borderRadius:6, color:'#4f8ef7', fontSize:10, padding:'3px 8px', cursor:'pointer' },
  taskPanel: { background:'#0d0d16', borderBottom:'1px solid #16161e', padding:'10px 14px', maxHeight:220, overflowY:'auto', flexShrink:0 },
  slotBlock: { marginBottom:6 },
  slotLabel: { fontSize:10, color:'#444', fontWeight:600, textTransform:'uppercase', letterSpacing:.5 },
  freeSlot: { position:'absolute', left:4, right:6, zIndex:1, pointerEvents:'auto' },
  freeSlotInner: { border:'1px dashed #2a2a3a', borderRadius:8, padding:'6px 10px', background:'#0d0d1688', height:'100%', boxSizing:'border-box', overflow:'hidden' },
  freeLabel: { fontSize:10, color:'#3a3a5a', fontWeight:600, display:'block', marginBottom:2 },
  todoInput: { flex:1, background:'#1a1a26', border:'1px solid #222232', borderRadius:7, color:'#ccc', outline:'none' },
  todoAddBtn: { background:'#4f8ef7', border:'none', borderRadius:7, color:'#fff', cursor:'pointer', fontSize:13 },
  todoCheck: { width:15, height:15, borderRadius:4, border:'1px solid #333', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'background .15s' },
  modalOverlay: { position:'fixed', inset:0, background:'#000000b0', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' },
  modal: { background:'#13131c', border:'1px solid #222230', borderRadius:14, padding:22, width:340, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto' },
  fi: { background:'#1a1a26', border:'1px solid #222232', borderRadius:8, padding:'8px 11px', color:'#ddd', fontSize:13, outline:'none', fontFamily:'inherit' },
  timeInputRow: { display:'flex', alignItems:'center', gap:10 },
  timeLabel: { fontSize:12, color:'#666', width:28, textAlign:'right', flexShrink:0 },
  timeSegment: { display:'flex', alignItems:'center', gap:6 },
  timeNum: { width:48, background:'#222232', border:'1px solid #2a2a3a', borderRadius:7, padding:'6px 8px', color:'#ddd', fontSize:15, fontWeight:600, textAlign:'center', outline:'none' },
  timeColon: { fontSize:16, fontWeight:700, color:'#4f8ef7' },
  saveBtn: { background:'#4f8ef7', border:'none', borderRadius:8, color:'#fff', padding:'8px 20px', cursor:'pointer', fontSize:13, fontWeight:600 },
  cancelBtn: { background:'#1a1a26', border:'1px solid #222230', borderRadius:8, color:'#777', padding:'8px 14px', cursor:'pointer', fontSize:13 },
  fab: { position:'fixed', bottom:24, right:22, width:50, height:50, borderRadius:'50%', background:'#4f8ef7', border:'none', color:'#fff', fontSize:22, cursor:'pointer', boxShadow:'0 4px 18px #4f8ef760', zIndex:20 },
}
