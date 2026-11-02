import {
  ArcElement, BarElement, BubbleController, CategoryScale, Chart as ChartJS, Legend, LinearScale, LogarithmicScale, PointElement, Tooltip,
} from 'chart.js'
import { Bar, Bubble, Doughnut } from 'react-chartjs-2'
import { buildRanking, data, statusZespolu, topMiejscowosci, udzialElektrykow, wnioskiMiesiecznie, wnioskiPowiatu } from '../analysis.js'

ChartJS.register(ArcElement, BarElement, BubbleController, CategoryScale, Legend, LinearScale, LogarithmicScale, PointElement, Tooltip)
ChartJS.defaults.font.family = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
ChartJS.defaults.color = '#5b6472'

export const C = { staly: '#a3acb9', inny: '#f0a83a', brak: '#1f9d6b', nieznany: '#c4b5fd', main: '#2f6fdb', grid: '#e7eaef' }
const PALETA = ['#2f6fdb', '#f0a83a', '#8e5bd6', '#e0576b', '#16a3b8', '#7a8b2e', '#c46d2b', '#a3acb9']
const MIES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

const grid = { grid: { color: C.grid }, border: { display: false } }

export default function Wykresy({ ranking, wnioski, pokazPowiaty, onSelect }) {
  const top = ranking.filter((r) => r.n >= 2).slice(0, 15)
  const mies = wnioskiMiesiecznie(wnioski)
  const el = udzialElektrykow(wnioski)
  const osoby = el.filter(([k]) => !k.startsWith('brak') && !k.startsWith('nie wiadomo'))
  const elTop = osoby.slice(0, 7)
  const elReszta = osoby.slice(7).reduce((s, [, n]) => s + n, 0)
  const elNiezn = el.find(([k]) => k.startsWith('nie wiadomo'))?.[1] || 0
  const elBrak = el.find(([k]) => k.startsWith('brak'))?.[1] || 0
  const miejsc = topMiejscowosci(wnioski)
  const bubble = ranking.filter((r) => r.n >= 2)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card p-5 lg:col-span-2">
        <h3 className="h-section">15 architektów z największą szansą – kto robi elektrykę w ich projektach</h3>
        <p className="mb-3 mt-0.5 text-sm text-slate-500">Zielone i pomarańczowe = wnioski, które może dostać nowy elektryk. Kliknij słupek, żeby zobaczyć szczegóły.</p>
        <div className="relative" style={{ height: 420 }}>
          <Bar
            data={{
              labels: top.map((r) => r.name),
              datasets: [
                { label: 'bez elektryka', data: top.map((r) => r.nBrak), backgroundColor: C.brak },
                { label: 'inny elektryk', data: top.map((r) => r.nInny), backgroundColor: C.inny },
                { label: 'stały elektryk', data: top.map((r) => r.nStaly), backgroundColor: C.staly },
              ],
            }}
            options={{
              indexAxis: 'y',
              maintainAspectRatio: false,
              onClick: (_, els) => els[0] && onSelect(top[els[0].index].name),
              onHover: (e, els) => (e.native.target.style.cursor = els.length ? 'pointer' : 'default'),
              plugins: { legend: { position: 'top', align: 'start' }, tooltip: { callbacks: { afterBody: (it) => top[it[0].dataIndex].rekomendacja.tekst } } },
              scales: { x: { stacked: true, ...grid, title: { display: true, text: 'liczba wniosków' } }, y: { stacked: true, grid: { display: false } } },
            }}
          />
        </div>
      </div>

      <div className="card p-5 lg:col-span-2">
        <h3 className="h-section">Mapa okazji</h3>
        <p className="mb-3 mt-0.5 text-sm text-slate-500">
          Im bardziej w prawo, tym więcej świeżych projektów. Im wyżej, tym mniej związany ze stałym elektrykiem. Prawy górny róg = dzwoń
          najpierw. Wielkość kółka = liczba projektów. Najedź, żeby zobaczyć nazwisko.
        </p>
        <div className="relative" style={{ height: 380 }}>
          <Bubble
            data={{
              datasets: [
                {
                  label: 'architekci',
                  data: bubble.map((r) => ({ x: Math.max(0.3, r.aktywnosc), y: Math.round(r.otwartosc * 100), r: 4 + Math.sqrt(r.n) * 2.6 })),
                  backgroundColor: bubble.map((r) =>
                    r.rekomendacja.klasa === 'hot' ? 'rgba(31,157,107,.65)' : r.rekomendacja.klasa === 'warm' ? 'rgba(240,168,58,.65)' : 'rgba(163,172,185,.55)'
                  ),
                  borderColor: '#fff',
                  borderWidth: 1,
                },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              onClick: (_, els) => els[0] && onSelect(bubble[els[0].index].name),
              onHover: (e, els) => (e.native.target.style.cursor = els.length ? 'pointer' : 'default'),
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const r = bubble[ctx.dataIndex]
                      return `${r.name}: ${r.rekomendacja.tekst.toLowerCase()}, ${r.n} projektów, ${r.wolne} bez stałego elektryka`
                    },
                  },
                },
              },
              scales: {
                x: { type: 'logarithmic', ...grid, title: { display: true, text: 'ile świeżych projektów →' }, ticks: { callback: (v) => ([0.5, 1, 2, 5, 10, 20, 50].includes(v) ? v : '') } },
                y: { min: -5, max: 105, ...grid, title: { display: true, text: 'otwartość na nowego elektryka →' }, ticks: { callback: (v) => (v >= 0 && v <= 100 ? v + '%' : '') } },
              },
            }}
          />
        </div>
      </div>

      {pokazPowiaty && <PorownaniePowiatow />}

      <div className="card p-5">
        <h3 className="h-section">Wnioski miesięcznie</h3>
        <p className="mb-3 mt-0.5 text-sm text-slate-500">Ile pracy przychodzi na rynek i ile z niej trafia bez elektryka w zespole.</p>
        <div className="relative" style={{ height: 280 }}>
          <Bar
            data={{
              labels: mies.map(([k]) => `${MIES[+k.slice(5) - 1]} ${k.slice(2, 4)}`),
              datasets: [
                { label: 'bez elektryka', data: mies.map(([, v]) => v.brak), backgroundColor: C.brak },
                { label: 'z elektrykiem', data: mies.map(([, v]) => v.z), backgroundColor: C.staly },
                { label: 'nie wiadomo (zespół niewpisany)', data: mies.map(([, v]) => v.nieznany), backgroundColor: C.nieznany },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top', align: 'start' } },
              scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ...grid } },
            }}
          />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="h-section">Konkurencja: kto robi elektrykę</h3>
        <p className="mb-3 mt-0.5 text-sm text-slate-500">Udział elektryków we wszystkich wnioskach (pewni + prawdopodobni).</p>
        <div className="relative" style={{ height: 280 }}>
          <Doughnut
            data={{
              labels: [...elTop.map(([k]) => k), ...(elReszta ? ['pozostali'] : []), 'brak elektryka', ...(elNiezn ? ['nie wiadomo'] : [])],
              datasets: [
                {
                  data: [...elTop.map(([, n]) => n), ...(elReszta ? [elReszta] : []), elBrak, ...(elNiezn ? [elNiezn] : [])],
                  backgroundColor: [...PALETA.slice(0, elTop.length), ...(elReszta ? ['#cfd5dd'] : []), C.brak, ...(elNiezn ? [C.nieznany] : [])],
                  borderColor: '#fff',
                  borderWidth: 2,
                },
              ],
            }}
            options={{ maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } } }}
          />
        </div>
      </div>

      <div className="card p-5 lg:col-span-2">
        <h3 className="h-section">Gdzie się buduje – top miejscowości</h3>
        <div className="relative" style={{ height: 260 }}>
          <Bar
            data={{ labels: miejsc.map(([k]) => k), datasets: [{ label: 'wnioski', data: miejsc.map(([, n]) => n), backgroundColor: C.main, borderRadius: 4 }] }}
            options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { ...grid } } }}
          />
        </div>
      </div>
    </div>
  )
}

function PorownaniePowiatow() {
  const rows = data.powiaty.map((p) => {
    const w = wnioskiPowiatu(p.powiat)
    const r = buildRanking(w)
    return {
      powiat: p.powiat,
      bez: w.filter((x) => statusZespolu(x) === 'bez_elektryka').length,
      z: w.filter((x) => statusZespolu(x) === 'elektryk').length,
      niezn: w.filter((x) => statusZespolu(x) === 'nieznany').length,
      hot: r.filter((x) => x.rekomendacja.klasa === 'hot').length,
      warm: r.filter((x) => x.rekomendacja.klasa === 'warm').length,
    }
  })
  return (
    <div className="card p-5 lg:col-span-2">
      <h3 className="h-section">Porównanie powiatów</h3>
      <p className="mb-3 mt-0.5 text-sm text-slate-500">Gdzie jest więcej pracy bez elektryka i więcej architektów wartych telefonu.</p>
      <div className="relative" style={{ height: 60 + rows.length * 46 }}>
        <Bar
          data={{
            labels: rows.map((r) => r.powiat),
            datasets: [
              { label: 'wnioski bez elektryka', data: rows.map((r) => r.bez), backgroundColor: C.brak, stack: 'w' },
              { label: 'wnioski z elektrykiem', data: rows.map((r) => r.z), backgroundColor: C.staly, stack: 'w' },
              { label: 'wnioski – nie wiadomo', data: rows.map((r) => r.niezn), backgroundColor: C.nieznany, stack: 'w' },
              { label: 'architekci z dużą szansą', data: rows.map((r) => r.hot), backgroundColor: C.main, stack: 'a' },
              { label: 'architekci ze średnią szansą', data: rows.map((r) => r.warm), backgroundColor: C.inny, stack: 'a' },
            ],
          }}
          options={{
            indexAxis: 'y',
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', align: 'start' } },
            scales: { x: { stacked: true, ...grid }, y: { stacked: true, grid: { display: false } } },
          }}
        />
      </div>
    </div>
  )
}
