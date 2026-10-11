# Борлуулалт (borluulalt)

[![CI](https://github.com/XalMorak/borluulalt/actions/workflows/node.js.yml/badge.svg)](https://github.com/XalMorak/borluulalt/actions/workflows/node.js.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Бар/рестораны борлуулалт, нөөц, илгээлт, тайлангийн вэб апп. Ажилтан ID-аар нэвтэрнэ.

**Live:** [borluulalt-xalmorak.vercel.app](https://borluulalt-xalmorak.vercel.app)

## Юу хийдэг вэ

- **Ажилтан**: өдөр, ээлж, байршил, тек сонгоод пиво/вино борлуулалт оруулна
- **Ахлах**: илгээлт (зөвхөн өнөөдрийн), нөөц, хэрэглэгч
- **Нягтлан**: Илгээлт · Хэрэглэгч · Ростер · Тайлан. Шүүлт, Excel, төлөлт, 14 хоногийн ростер
- Пиво ба вино тусдаа. Нөөц байршлаар. Delta синк (зөвхөн өөрчлөгдсөн хэсэг)
- Түр хадгалалт (утас, Safari)

## Stack

JavaScript · Firebase Realtime Database · Vercel

## Код зохион байгуулалт

Build алхамгүй статик сайт: `index.html` нь `ui.html`-ийг ачаалаад `js/` доторх скриптүүдийг **жагсаасан дарааллаар** (`SCRIPTS` массив) оруулна. Дараа нь ачаалагдсан файл өмнөхөө өргөтгөдөг тул дараалал чухал.

| Хавтас | Агуулга |
|---|---|
| `css/app.css` | Цорын ганц stylesheet (өмнө `ui.html` + 7 скрипт runtime-д CSS оруулдаг байсан) |
| `js/core/` | Үндсэн апп (`app.js`, `app2.js`, `app3.js`), Firebase уншилтын хаалга + delta синк (`net_gate.js`, `sync_delta.js`), push/merge/tombstone (`sync_stable.js`, `sync_merge.js`, `keep_sync.js`, `guard.js` …) |
| `js/auth/` | Нэвтрэлт: legacy / transition / secure (`sec_login.js`), Firebase auth, хэрэглэгчийн кэш |
| `js/employee/` | Ажилтны маягт: огноо, талбар, түр хадгалах, илгээх, үнэ түгжих |
| `js/supervisor/` | Ахлах: өнөөдрийн самбар (илүү/дутуу), илгээлт харах/засах/устгах, давхардал |
| `js/reports/` | Тайлан, пиво/вино хуудас |
| `js/stock/` | Нөөц: байршлаар, вино, нэгдсэн нөөцийн таб, серверийн нөөц хасалтын ledger (`stock_ledger.js`) |
| `js/accountant/` | Нягтлан: бүх илгээлт, шүүлт, Excel, хэрэглэгч, ростер, төлөлт |
| `js/ui/` | Мөнгөний фонт, гар утасны UX, dark mode |
| `api/` | Vercel функц: `/api/login`, `/api/pin`, `/api/config` |
| `security/` | Database rules (transition/strict) ба тэдгээрийг үүсгэгч |
| `tests/security/` | Emulator тест: rules, login, e2e (бүх горим), flows, stock, DOM/behaviour gate |

Тест: `npm run check`; `cd tests/security && npx firebase emulators:exec --only database,auth --project demo-borluulalt "npm test && npm run e2e"`.
`tests/security/dom-baseline.json` нь цэгцлэхээс өмнөх DOM + computed style; `node e2e-dom.js` түүнтэй харьцуулна.

## Локал

```bash
npx serve .
npm run check
```

## Өгөгдөл

Firebase зангилаа `borluulalt`.

- `inbox/{id}` — ажилтны илгээлт
- `submissions` — ахлахын нэгтгэсэн жагсаалт
- `rosters/{r_YYYYMMDD}` — 14 хоногийн ростер
- `payments/{key}` — төлөлтийн тэмдэглэл
- `deleted/{t_key}` — устгасан илгээлтийн tombstone
- `_meta/{node}` — delta синкийн тэмдэг

Эрх: `employee`, `supervisor`, `accountant`. Ахлах/Нягтлан-д PIN заавал.

## Нэвтрэлт ба аюулгүй байдал

`api/` дахь Vercel function-ууд PIN-ийг серверт hash-аар шалгаж Firebase custom token өгнө.  
Дэлгэрэнгүй: [security/README.md](security/README.md).

## License

MIT — дэлгэрэх `LICENSE`.
