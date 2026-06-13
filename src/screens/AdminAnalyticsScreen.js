import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, Alert
} from 'react-native';
import Loading from './Loading';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { COLORS } from '../constants';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';

const { width } = Dimensions.get('window');
const BAR_MAX_W = width - 80;

// ── Donut Chart ────────────────────────────────────────────────────────────────
function DonutChart({ slices, label, total }) {
  // Simulate donut using stacked conic-like arcs via border trick
  const COLORS_LIST = slices.map(s => s.color);
  const sum = slices.reduce((a, b) => a + b.value, 0) || 1;
  let cumulative = 0;

  return (
    <View style={{ alignItems: 'center', marginVertical: 10 }}>
      <View style={dc.ring}>
        {slices.map((sl, i) => {
          const pct = sl.value / sum;
          const deg = pct * 360;
          const rotation = cumulative;
          cumulative += deg;
          return (
            <View
              key={i}
              style={[dc.slice, {
                borderTopColor: sl.color,
                borderRightColor: pct > 0.5 ? sl.color : 'transparent',
                transform: [{ rotate: `${rotation}deg` }],
                zIndex: slices.length - i,
              }]}
            />
          );
        })}
        <View style={dc.hole}>
          <Text style={dc.holeNum}>{total}</Text>
          <Text style={dc.holeLbl}>{label}</Text>
        </View>
      </View>
      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 12 }}>
        {slices.map((sl, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sl.color }} />
            <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>{sl.label}</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.text }}>
              {Math.round((sl.value / sum) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const dc = StyleSheet.create({
  ring: { width: 130, height: 130, borderRadius: 65, backgroundColor: '#f0f4ff', overflow: 'hidden', position: 'relative' },
  slice: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 30, borderTopColor: COLORS.primary, borderRightColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent' },
  hole: { position: 'absolute', top: 25, left: 25, width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  holeNum: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  holeLbl: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },
});

// ── Horizontal Bar Chart ───────────────────────────────────────────────────────
function HBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      {data.map((d, i) => (
        <View key={i}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, flex: 1 }} numberOfLines={1}>{d.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: d.color || COLORS.primary }}>{d.value}</Text>
          </View>
          <View style={{ height: 10, backgroundColor: COLORS.borderLight, borderRadius: 6, overflow: 'hidden' }}>
            <View style={{
              height: '100%',
              width: `${Math.max(3, (d.value / max) * 100)}%`,
              backgroundColor: d.color || COLORS.primary,
              borderRadius: 6,
            }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Funnel Chart ───────────────────────────────────────────────────────────────
function FunnelChart({ steps }) {
  const max = steps[0]?.value || 1;
  return (
    <View style={{ gap: 6, marginTop: 8, alignItems: 'center' }}>
      {steps.map((step, i) => {
        const pct = Math.max(20, (step.value / max) * 100);
        return (
          <View key={i} style={{ width: `${pct}%`, backgroundColor: step.color, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }} numberOfLines={1}>{step.label}</Text>
            <Text style={{ fontSize: 13, color: '#fff', fontWeight: '900' }}>{step.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Stat Big Card ──────────────────────────────────────────────────────────────
function BigStat({ value, label, icon, color, bg }) {
  return (
    <View style={[bsc.card, { backgroundColor: bg }]}>
      <View style={[bsc.iconWrap, { backgroundColor: color + '30' }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={[bsc.val, { color }]}>{value}</Text>
      <Text style={bsc.lbl}>{label}</Text>
    </View>
  );
}
const bsc = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  val: { fontSize: 24, fontWeight: '900' },
  lbl: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', textAlign: 'center' },
});

// ── Section ────────────────────────────────────────────────────────────────────
function Section({ title, icon, color, children }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={[sc.wrap, { borderTopColor: color }]}>
      <TouchableOpacity style={sc.hdr} onPress={() => setOpen(o => !o)} activeOpacity={0.75}>
        <View style={[sc.badge, { backgroundColor: color }]}>
          <Feather name={icon} size={14} color="#fff" />
        </View>
        <Text style={sc.title}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
      {open && children}
    </View>
  );
}
const sc = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: 18, marginBottom: 14, overflow: 'hidden', borderTopWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 4 },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 12 },
  badge: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text },
});

// ── Chart Label ────────────────────────────────────────────────────────────────
function CLabel({ text }) {
  return <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 4, paddingHorizontal: 16 }}>{text}</Text>;
}

function Divider() { return <View style={{ height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: 16, marginVertical: 4 }} />; }

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function AdminAnalyticsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [aSnap, uSnap] = await Promise.all([
          getDocs(query(collection(db, 'applications'), orderBy('createdAt', 'desc'))),
          getDocs(collection(db, 'users')),
        ]);
        setApps(aSnap.docs.map(d => ({ id: d.id, ...d.data(), _dt: d.data().createdAt?.toDate?.() || new Date() })));
        setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data(), _dt: d.data().createdAt?.toDate?.() || new Date() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loading text="Memuatkan analitik..." />;

  const now = new Date();
  const M = now.getMonth(), Y = now.getFullYear();

  // ── Derived Data ────────────────────────────────────────────────────────────
  const total = apps.length;
  const approved = apps.filter(a => a.status === 'approved').length;
  const rejected = apps.filter(a => a.status === 'rejected').length;
  const pending = apps.filter(a => a.status === 'pending').length;
  const active = apps.filter(a => a.status === 'approved' && a.isPublished).length;
  const avgScore = total ? Math.round(apps.reduce((s, a) => s + (a.score || 0), 0) / total) : 0;

  const totalUsers = users.length;
  const activeMonthly = users.filter(u => u._dt.getMonth() === M && u._dt.getFullYear() === Y).length;

  const CATS = ['Perubatan', 'Haiwan', 'Pendidikan', 'Bencana Alam', 'Umum', 'Permohonan Bantuan'];
  const CAT_CLR = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const catSlices = CATS.map((c, i) => ({
    label: c,
    value: apps.filter(a => (a.category || '').toLowerCase().includes(c.toLowerCase())).length,
    color: CAT_CLR[i],
  })).filter(s => s.value > 0);

  const parseAmt = s => {
    if (typeof s === 'number') return s;
    const n = parseFloat((s || '').toString().replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const totalTarget = apps.filter(a => a.status === 'approved').reduce((s, a) => s + parseAmt(a.summary?.dana), 0);

  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Y, M - (5 - i), 1);
    return {
      label: d.toLocaleString('ms-MY', { month: 'short' }),
      value: apps.filter(a => a._dt.getMonth() === d.getMonth() && a._dt.getFullYear() === d.getFullYear()).length,
      color: COLORS.primary,
    };
  });

  const highScore = apps.filter(a => a.score >= 80).length;
  const medScore = apps.filter(a => a.score >= 60 && a.score < 80).length;
  const lowScore = apps.filter(a => a.score < 60).length;
  const highRisk = apps.filter(a => a.scoreClass === 'low').length;
  const longPending = apps.filter(a => a.status === 'pending' && ((now - a._dt) / 86400000) > 7).length;

  const handlePrintAll = async () => {
    const monthRows = months6.map(m => ({ label: m.label, value: m.value, color: '#6366f1' }));
    const catRows = CATS.map((c, i) => ({ label: c, value: apps.filter(a => (a.category || '').toLowerCase().includes(c.toLowerCase())).length, color: CAT_CLR[i] }));
    const approvalRate = total ? Math.round((approved / total) * 100) : 0;

    // ── SVG Donut Chart ──────────────────────────────────────────────────────
    const svgDonut = (slices, centerVal, centerLbl, size = 180) => {
      const cx = size / 2, cy = size / 2;
      const R = size * 0.40, iR = size * 0.24;
      const sum = slices.reduce((a, b) => a + b.value, 0) || 1;
      let angle = -Math.PI / 2;
      const paths = slices.map(sl => {
        const a = (sl.value / sum) * 2 * Math.PI;
        const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
        const x2 = cx + R * Math.cos(angle + a), y2 = cy + R * Math.sin(angle + a);
        const ix1 = cx + iR * Math.cos(angle), iy1 = cy + iR * Math.sin(angle);
        const ix2 = cx + iR * Math.cos(angle + a), iy2 = cy + iR * Math.sin(angle + a);
        const large = a > Math.PI ? 1 : 0;
        const mid = angle + a / 2;
        const lR = (R + iR) / 2;
        const pct = Math.round((sl.value / sum) * 100);
        const d = `M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${iR},${iR} 0 ${large},0 ${ix1},${iy1}Z`;
        const r = { d, color: sl.color, pct, lx: cx + lR * Math.cos(mid), ly: cy + lR * Math.sin(mid) };
        angle += a;
        return r;
      });
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${paths.map(p => `<path d="${p.d}" fill="${p.color}"/>`).join('')}
        ${paths.map(p => p.pct >= 6 ? `<text x="${p.lx}" y="${p.ly}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="white" font-weight="bold">${p.pct}%</text>` : '').join('')}
        <circle cx="${cx}" cy="${cy}" r="${iR - 2}" fill="white"/>
        <text x="${cx}" y="${cy - 9}" text-anchor="middle" font-size="20" font-weight="900" fill="#1e293b">${centerVal}</text>
        <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="9" fill="#64748b">${centerLbl}</text>
      </svg>`;
    };

    // ── SVG Horizontal Bar Chart ─────────────────────────────────────────────
    const svgHBar = (data, w = 340) => {
      const bH = 20, gap = 10, lblW = 130, valW = 36;
      const barMaxW = w - lblW - valW - 10;
      const max = Math.max(...data.map(d => d.value), 1);
      const h = data.length * (bH + gap) + 4;
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        ${data.map((d, i) => {
          const y = i * (bH + gap);
          const bW = Math.max(4, (d.value / max) * barMaxW);
          return `<text x="0" y="${y + bH / 2 + 4}" font-size="10" fill="#475569">${d.label}</text>
            <rect x="${lblW}" y="${y}" width="${barMaxW}" height="${bH}" rx="4" fill="#f1f5f9"/>
            <rect x="${lblW}" y="${y}" width="${bW}" height="${bH}" rx="4" fill="${d.color || '#6366f1'}"/>
            <text x="${lblW + barMaxW + 6}" y="${y + bH / 2 + 4}" font-size="11" font-weight="700" fill="${d.color || '#6366f1'}" dominant-baseline="middle">${d.value}</text>`;
        }).join('')}
      </svg>`;
    };

    // ── SVG Legend ───────────────────────────────────────────────────────────
    const legend = (slices) => {
      const sum = slices.reduce((a, b) => a + b.value, 0) || 1;
      return slices.map(s => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
        <div style="width:11px;height:11px;border-radius:50%;background:${s.color};flex-shrink:0;"></div>
        <span style="font-size:12px;color:#475569;flex:1;">${s.label}</span>
        <span style="font-size:12px;font-weight:700;color:#1e293b;">${Math.round((s.value / sum) * 100)}%</span>
      </div>`).join('');
    };

    // ── Table HTML ───────────────────────────────────────────────────────────
    const tbl = (rows, col1 = 'Metrik', col2 = 'Nilai') => `
      <table>
        <thead><tr><th>${col1}</th><th class="right">${col2}</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${r.color || '#6366f1'};margin-right:6px;"></span>${r.label}</td><td class="right">${r.value}</td></tr>`).join('')}</tbody>
      </table>`;

    // ── Section with chart-left + table-right layout ─────────────────────────
    const secRow = (title, color, icon, leftHtml, rightHtml) => `
      <div class="section">
        <div class="sec-title" style="border-left:5px solid ${color};">${icon} ${title}</div>
        <div class="row">${leftHtml}<div class="divider"></div>${rightHtml}</div>
      </div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, Arial, sans-serif; padding: 28px; color: #1e293b; background: #f8fafc; }
      .cover { background: linear-gradient(135deg,#4f46e5,#7c3aed); border-radius: 16px; padding: 28px 32px; margin-bottom: 28px; color: white; }
      .cover h1 { font-size: 26px; font-weight: 900; margin-bottom: 6px; }
      .cover .meta { font-size: 13px; opacity: 0.85; }
      .badges { display: flex; gap: 16px; margin-top: 18px; }
      .badge { background: rgba(255,255,255,0.18); border-radius: 10px; padding: 10px 20px; text-align: center; }
      .badge-num { font-size: 28px; font-weight: 900; }
      .badge-lbl { font-size: 11px; opacity: 0.85; margin-top: 2px; }
      .section { background: white; border-radius: 14px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
      .sec-title { font-size: 15px; font-weight: 800; padding: 14px 18px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
      .row { display: flex; align-items: flex-start; padding: 16px 18px; gap: 0; }
      .chart-col { display: flex; flex-direction: column; align-items: center; min-width: 210px; }
      .chart-col .lbl { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
      .legend-col { margin-top: 12px; width: 100%; }
      .divider { width: 1px; background: #e2e8f0; margin: 0 18px; align-self: stretch; }
      .table-col { flex: 1; }
      .table-col .col-lbl { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #4f46e5; color: #fff; padding: 9px 12px; text-align: left; font-size: 12px; font-weight: 700; }
      td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
      tr:last-child td { border-bottom: none; }
      tr:nth-child(even) td { background: #f8fafc; }
      .right { text-align: right; font-weight: 700; }
      .footer { margin-top: 28px; font-size: 11px; color: #94a3b8; text-align: center; padding: 14px; background: white; border-radius: 10px; }
    </style></head>
    <body>
      <div class="cover">
        <h1>&#128202; Laporan Analitik Keseluruhan</h1>
        <div class="meta">MyDana &bull; Dijana pada: ${new Date().toLocaleString('ms-MY')}</div>
        <div class="badges">
          <div class="badge"><div class="badge-num">${total}</div><div class="badge-lbl">Permohonan</div></div>
          <div class="badge"><div class="badge-num">${totalUsers}</div><div class="badge-lbl">Pengguna</div></div>
          <div class="badge"><div class="badge-num">${avgScore}%</div><div class="badge-lbl">Purata Skor AI</div></div>
          <div class="badge"><div class="badge-num">${approvalRate}%</div><div class="badge-lbl">Kadar Lulus</div></div>
        </div>
      </div>

      ${secRow('Pengurusan Pengguna', '#6366f1', '&#128100;',
        `<div class="chart-col">
          <div class="lbl">Trend Pendaftaran</div>
          ${svgHBar(monthRows.map(m => ({ ...m, color: '#6366f1' })), 200)}
        </div>`,
        `<div class="table-col">
          <div class="col-lbl">Ringkasan Pengguna</div>
          ${tbl([
            { label: 'Jumlah Berdaftar', value: totalUsers, color: '#6366f1' },
            { label: 'Aktif Bulan Ini', value: activeMonthly, color: '#10b981' },
            { label: 'Pernah Memohon', value: apps.filter(a => a.userId || a.email).length, color: '#f59e0b' },
          ])}
        </div>`
      )}

      ${secRow('Analitik Kempen', '#3b82f6', '&#128202;',
        `<div class="chart-col">
          <div class="lbl">Pecahan Kategori</div>
          ${svgDonut(catRows.filter(c => c.value > 0).length ? catRows.filter(c => c.value > 0) : [{ label: 'Tiada', value: 1, color: '#e2e8f0' }], total, 'Kempen')}
          <div class="legend-col">${legend(catRows.filter(c => c.value > 0).length ? catRows.filter(c => c.value > 0) : [{ label: 'Tiada Data', value: 1, color: '#e2e8f0' }])}</div>
        </div>`,
        `<div class="table-col">
          <div class="col-lbl">Bilangan Per Kategori</div>
          ${tbl(catRows.map(r => ({ ...r })), 'Kategori', 'Bilangan')}
        </div>`
      )}

      ${secRow('Analitik Kewangan', '#10b981', '&#128176;',
        `<div class="chart-col">
          <div class="lbl">Status Dana</div>
          ${svgDonut([
            { label: 'Terkumpul', value: Math.round(totalTarget * 0.45), color: '#10b981' },
            { label: 'Baki', value: Math.round(totalTarget * 0.55), color: '#e2e8f0' },
          ], `RM${Math.round(totalTarget / 1000)}k`, 'Sasaran')}
          <div class="legend-col">${legend([
            { label: 'Terkumpul', value: Math.round(totalTarget * 0.45), color: '#10b981' },
            { label: 'Baki Sasaran', value: Math.round(totalTarget * 0.55), color: '#e2e8f0' },
          ])}</div>
        </div>`,
        `<div class="table-col">
          <div class="col-lbl">Maklumat Kewangan</div>
          ${tbl([
            { label: 'Jumlah Sasaran Dana', value: `RM ${Math.round(totalTarget).toLocaleString('ms-MY')}`, color: '#3b82f6' },
            { label: 'Anggaran Terkumpul', value: `RM ${Math.round(totalTarget * 0.45).toLocaleString('ms-MY')}`, color: '#10b981' },
            { label: 'Baki Sasaran', value: `RM ${Math.round(totalTarget * 0.55).toLocaleString('ms-MY')}`, color: '#ef4444' },
            { label: 'Kempen Diluluskan', value: approved, color: '#10b981' },
          ])}
        </div>`
      )}

      ${secRow('Kelulusan Permohonan', '#f59e0b', '&#9989;',
        `<div class="chart-col">
          <div class="lbl">Nisbah Keputusan</div>
          ${svgDonut([
            { label: 'Lulus', value: approved, color: '#10b981' },
            { label: 'Tolak', value: rejected, color: '#ef4444' },
            { label: 'Tunggu', value: pending, color: '#f59e0b' },
          ].filter(s => s.value > 0), total, 'Jumlah')}
          <div class="legend-col">${legend([
            { label: 'Diluluskan', value: approved, color: '#10b981' },
            { label: 'Ditolak', value: rejected, color: '#ef4444' },
            { label: 'Menunggu', value: pending, color: '#f59e0b' },
          ].filter(s => s.value > 0))}</div>
        </div>`,
        `<div class="table-col">
          <div class="col-lbl">Corong Kelulusan</div>
          ${tbl([
            { label: 'Jumlah Permohonan', value: total, color: '#6366f1' },
            { label: 'Diluluskan', value: approved, color: '#10b981' },
            { label: 'Ditolak', value: rejected, color: '#ef4444' },
            { label: 'Menunggu', value: pending, color: '#f59e0b' },
            { label: 'Aktif & Diterbit', value: active, color: '#0ea5e9' },
            { label: 'Kadar Kelulusan', value: `${approvalRate}%`, color: '#10b981' },
          ])}
        </div>`
      )}

      ${secRow('Skor Kesahihan AI', '#ec4899', '&#129521;',
        `<div class="chart-col">
          <div class="lbl">Taburan Skor</div>
          ${svgDonut([
            { label: 'Tinggi', value: highScore, color: '#10b981' },
            { label: 'Sederhana', value: medScore, color: '#f59e0b' },
            { label: 'Rendah', value: lowScore, color: '#ef4444' },
          ].filter(s => s.value > 0), `${avgScore}%`, 'Purata')}
          <div class="legend-col">${legend([
            { label: 'Skor Tinggi (≥80%)', value: highScore, color: '#10b981' },
            { label: 'Sederhana (60–79%)', value: medScore, color: '#f59e0b' },
            { label: 'Rendah (<60%)', value: lowScore, color: '#ef4444' },
          ].filter(s => s.value > 0))}</div>
        </div>`,
        `<div class="table-col">
          <div class="col-lbl">Perbandingan Skor AI</div>
          ${svgHBar([
            { label: 'Tinggi (≥80%)', value: highScore, color: '#10b981' },
            { label: 'Sederhana (60–79%)', value: medScore, color: '#f59e0b' },
            { label: 'Rendah (<60%)', value: lowScore, color: '#ef4444' },
          ], 280)}
        </div>`
      )}

      ${secRow('Keselamatan & Moderasi', '#ef4444', '&#128737;',
        `<div class="chart-col">
          <div class="lbl">Taburan Risiko</div>
          ${svgDonut([
            { label: 'Selamat', value: highScore, color: '#10b981' },
            { label: 'Sederhana', value: medScore, color: '#f59e0b' },
            { label: 'Berisiko', value: highRisk, color: '#ef4444' },
          ].filter(s => s.value > 0), total, 'Jumlah')}
          <div class="legend-col">${legend([
            { label: 'Selamat AI (≥80%)', value: highScore, color: '#10b981' },
            { label: 'Perlu Semak', value: medScore, color: '#f59e0b' },
            { label: 'Berisiko Tinggi', value: highRisk, color: '#ef4444' },
          ].filter(s => s.value > 0))}</div>
        </div>`,
        `<div class="table-col">
          <div class="col-lbl">Ringkasan Moderasi</div>
          ${tbl([
            { label: 'Disahkan AI (≥80%)', value: highScore, color: '#10b981' },
            { label: 'Perlu Semak Manual', value: medScore, color: '#f59e0b' },
            { label: 'Berisiko Tinggi (<60%)', value: highRisk, color: '#ef4444' },
            { label: 'Tunggu >7 Hari', value: longPending, color: '#64748b' },
          ])}
        </div>`
      )}

      <div class="footer">— Laporan ini dijana secara automatik oleh sistem MyDana —</div>
    </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Laporan Analitik Keseluruhan – MyDana' });
      else Alert.alert('Cetak', 'Fail PDF disimpan: ' + uri);
    } catch (e) { Alert.alert('Ralat', 'Gagal mencetak laporan.'); }
  };

  const handleExportExcel = async () => {
    try {
      const data = apps.map(app => ({
        ID: app.id,
        Nama: app.name,
        Tajuk: app.summary?.tajuk || '',
        Kategori: app.category,
        Status: app.status,
        Skor_AI: app.score,
        Dana_Sasaran: app.summary?.dana || '',
        Tarikh: app._dt.toLocaleDateString(),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Permohonan");
      const wbout = XLSX.write(wb, { type: 'base64', bookType: "xlsx" });
      const uri = FileSystem.cacheDirectory + 'Laporan_MyDana.xlsx';
      await FileSystem.writeAsStringAsync(uri, wbout, { encoding: 'base64' });
      await Sharing.shareAsync(uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Eksport Excel MyDana' });
    } catch (e) {
      Alert.alert('Ralat', 'Gagal eksport Excel: ' + e.message);
    }
  };

  return (
    <SafeAreaView style={ms.safe}>
      {/* Header */}
      <View style={ms.hdr}>
        <View style={{ width: 16 }} />
        <View style={{ flex: 1 }}>
          <Text style={ms.hdrTitle}>Analitik</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={handleExportExcel} style={[ms.printBtn, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <Feather name="file-text" size={14} color="#16a34a" />
            <Text style={[ms.printText, { color: '#16a34a' }]}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePrintAll} style={ms.printBtn}>
            <Feather name="printer" size={14} color={COLORS.primary} />
            <Text style={ms.printText}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={ms.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Summary Banner ─── */}
        <View style={ms.banner}>
          <View style={[ms.bannerStat, { borderRightWidth: 1, borderRightColor: '#4f46e5' }]}>
            <Text style={ms.bannerNum}>{total}</Text>
            <Text style={ms.bannerLbl}>Permohonan</Text>
          </View>
          <View style={[ms.bannerStat, { borderRightWidth: 1, borderRightColor: '#4f46e5' }]}>
            <Text style={ms.bannerNum}>{totalUsers}</Text>
            <Text style={ms.bannerLbl}>Pengguna</Text>
          </View>
          <View style={ms.bannerStat}>
            <Text style={ms.bannerNum}>{avgScore}%</Text>
            <Text style={ms.bannerLbl}>Purata AI</Text>
          </View>
        </View>

        {/* ── 1. Pengguna ─────────────────────────── */}
        <Section title="Pengurusan Pengguna" icon="users" color="#6366f1">
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
            <BigStat value={totalUsers} label="Berdaftar" icon="users" color="#6366f1" bg="#eef2ff" />
            <BigStat value={activeMonthly} label="Aktif Bulan Ini" icon="activity" color={COLORS.success} bg="#ecfdf5" />
            <BigStat value={apps.filter(a => a.userId || a.email).length} label="Pemohon" icon="file-text" color="#f59e0b" bg="#fffbeb" />
          </View>
          <Divider />
          <CLabel text="Pendaftaran 6 Bulan Terakhir" />
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <HBarChart data={months6} />
          </View>
        </Section>

        {/* ── 2. Kempen ───────────────────────────── */}
        <Section title="Analitik Kempen" icon="trending-up" color="#3b82f6">
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
            <BigStat value={approved} label="Diluluskan" icon="check-circle" color={COLORS.success} bg="#ecfdf5" />
            <BigStat value={rejected} label="Ditolak" icon="x-circle" color={COLORS.error} bg="#fef2f2" />
            <BigStat value={pending} label="Menunggu" icon="clock" color="#f59e0b" bg="#fffbeb" />
          </View>
          <Divider />
          <CLabel text="Pecahan Mengikut Kategori (Carta Pai)" />
          <DonutChart
            slices={catSlices.length > 0 ? catSlices : [{ label: 'Tiada Data', value: 1, color: COLORS.borderLight }]}
            label="Kempen"
            total={total}
          />
          <Divider />
          <CLabel text="Bilangan Kempen Per Kategori" />
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <HBarChart data={CATS.map((c, i) => ({
              label: c,
              value: apps.filter(a => (a.category || '').toLowerCase().includes(c.toLowerCase())).length,
              color: CAT_CLR[i],
            }))} />
          </View>
        </Section>

        {/* ── 3. Kewangan ─────────────────────────── */}
        <Section title="Analitik Kewangan" icon="dollar-sign" color="#10b981">
          <View style={ms.finBanner}>
            <View style={ms.finCard}>
              <Text style={ms.finAmt}>RM {Math.round(totalTarget).toLocaleString('ms-MY')}</Text>
              <Text style={ms.finLbl}>Jumlah Sasaran Dana</Text>
            </View>
            <View style={[ms.finCard, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
              <Text style={[ms.finAmt, { color: COLORS.success }]}>RM {Math.round(totalTarget * 0.45).toLocaleString('ms-MY')}</Text>
              <Text style={ms.finLbl}>Anggaran Terkumpul</Text>
            </View>
          </View>
          <Divider />
          <CLabel text="Status Kewangan (Carta Pai)" />
          <DonutChart
            slices={[
              { label: 'Terkumpul', value: Math.round(totalTarget * 0.45), color: COLORS.success },
              { label: 'Baki Sasaran', value: Math.round(totalTarget * 0.55), color: '#e2e8f0' },
            ]}
            label="Dana"
            total={`RM ${Math.round(totalTarget / 1000)}k`}
          />
          <Divider />
          <CLabel text="Permohonan Diluluskan (6 Bulan)" />
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <HBarChart data={months6.map(m => ({ ...m, color: COLORS.success }))} />
          </View>
        </Section>

        {/* ── 4. Kelulusan Funnel ──────────────────── */}
        <Section title="Analitik Kelulusan Permohonan" icon="filter" color="#f59e0b">
          <CLabel text="Corong Kelulusan" />
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <FunnelChart steps={[
              { label: '📋 Jumlah Permohonan', value: total, color: '#6366f1' },
              { label: '✅ Diluluskan', value: approved, color: COLORS.success },
              { label: '❌ Ditolak', value: rejected, color: COLORS.error },
              { label: '⏳ Menunggu', value: pending, color: '#f59e0b' },
              { label: '🟢 Aktif & Diterbit', value: active, color: '#0ea5e9' },
            ]} />
          </View>
          <Divider />
          <CLabel text="Nisbah Keputusan (Carta Pai)" />
          <DonutChart
            slices={[
              { label: 'Lulus', value: approved, color: COLORS.success },
              { label: 'Tolak', value: rejected, color: COLORS.error },
              { label: 'Tunggu', value: pending, color: '#f59e0b' },
            ].filter(s => s.value > 0)}
            label="Jumlah"
            total={total}
          />
        </Section>

        {/* ── 5. Tingkah Laku ──────────────────────── */}
        <Section title="Analitik Skor Kesahihan AI" icon="shield" color="#ec4899">
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
            <BigStat value={`${avgScore}%`} label="Purata Skor" icon="award" color="#8b5cf6" bg="#f5f3ff" />
            <BigStat value={highScore} label="Skor Tinggi" icon="check-circle" color={COLORS.success} bg="#ecfdf5" />
            <BigStat value={lowScore} label="Skor Rendah" icon="alert-triangle" color={COLORS.error} bg="#fef2f2" />
          </View>
          <Divider />
          <CLabel text="Taburan Skor AI (Carta Pai)" />
          <DonutChart
            slices={[
              { label: '≥80% Tinggi', value: highScore, color: COLORS.success },
              { label: '60-79% Sederhana', value: medScore, color: '#f59e0b' },
              { label: '<60% Rendah', value: lowScore, color: COLORS.error },
            ].filter(s => s.value > 0)}
            label="Skor AI"
            total={total}
          />
          <Divider />
          <CLabel text="Perbandingan Skor" />
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <HBarChart data={[
              { label: 'Skor Tinggi (≥80%)', value: highScore, color: COLORS.success },
              { label: 'Sederhana (60-79%)', value: medScore, color: '#f59e0b' },
              { label: 'Rendah (<60%)', value: lowScore, color: COLORS.error },
            ]} />
          </View>
        </Section>

        {/* ── 6. Keselamatan ───────────────────────── */}
        <Section title="Keselamatan & Moderasi" icon="shield" color="#ef4444">
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            {highRisk > 0 && (
              <View style={ms.alert}>
                <Ionicons name="warning" size={18} color={COLORS.error} />
                <Text style={ms.alertTxt}>{highRisk} permohonan berisiko tinggi (skor rendah). Semak segera.</Text>
              </View>
            )}
            {longPending > 0 && (
              <View style={[ms.alert, { backgroundColor: '#fffbeb', borderColor: '#fbbf24' }]}>
                <Ionicons name="time" size={18} color="#f59e0b" />
                <Text style={[ms.alertTxt, { color: '#92400e' }]}>{longPending} permohonan menunggu lebih 7 hari.</Text>
              </View>
            )}
          </View>
          <Divider />
          <CLabel text="Taburan Risiko (Carta Pai)" />
          <DonutChart
            slices={[
              { label: 'Selamat (AI Tinggi)', value: highScore, color: COLORS.success },
              { label: 'Sederhana', value: medScore, color: '#f59e0b' },
              { label: 'Berisiko Tinggi', value: highRisk, color: COLORS.error },
            ].filter(s => s.value > 0)}
            label="Risiko"
            total={total}
          />
          <Divider />
          <CLabel text="Ringkasan Moderasi" />
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <HBarChart data={[
              { label: '🟢 Disahkan AI (≥80%)', value: highScore, color: COLORS.success },
              { label: '🟡 Perlu Semak Manual', value: medScore, color: '#f59e0b' },
              { label: '🔴 Berisiko Tinggi', value: highRisk, color: COLORS.error },
              { label: '⏳ Tunggu >7 Hari', value: longPending, color: '#64748b' },
            ]} />
          </View>
        </Section>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const ms = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hdr: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center' },
  hdrTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  hdrSub: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  printBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eef2ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e0e7ff' },
  printText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  scroll: { padding: 14 },
  banner: {
    flexDirection: 'row', backgroundColor: '#4f46e5', borderRadius: 18,
    marginBottom: 14, overflow: 'hidden',
    shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  bannerStat: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  bannerNum: { fontSize: 28, fontWeight: '900', color: '#fff' },
  bannerLbl: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '600' },
  finBanner: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  finCard: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' },
  finAmt: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  finLbl: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, textAlign: 'center', fontWeight: '600' },
  alert: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  alertTxt: { flex: 1, fontSize: 13, color: COLORS.error, fontWeight: '600', lineHeight: 18 },
});
