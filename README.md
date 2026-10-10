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

## Гол файлууд

| Файл | Зорилго |
|------|---------|
| `index.html` | Ачаалагч — `ui.html` + JS |
| `ui.html` | Хуудасны HTML/CSS |
| `app.js`, `app2.js`, `app3.js` | Үндсэн логик |
| `compat_fix.js` | XSS-safe alert, илгээлтийн түлхүүр |
| `wine.js` | Вино каталог, тек, ангилал |
| `wine_stock.js` | Виноны нөөц байршлаар |
| `accountant.js` | Эрхийн чиглүүлэлт, Нягтлан хуудас |
| `sync_stable.js` | Тогтвортой `cloudPush`, tombstone |
| `supervisor_day.js` | Ахлахын өнөөдрийн самбар |
| `acct_users.js` | Нягтлангийн хэрэглэгч удирдлага |
| `acct_report.js` | Тайлан, хэвлэх, Excel |
| `roster_cycle.js` | 4 ростерийн 28 хоногийн мөчлөг |
| `acct_pay.js` | Төлөлтийн тэмдэглэл |
| `stock_merged.js` | Нэгдсэн нөөц |
| `net_gate.js` | Firebase уншилтын хаалга, delta синк |
| `sync_delta.js` | Нэвтрэх / шинэчлэх-д delta |
| `vercel.json` | Хостинг |

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
