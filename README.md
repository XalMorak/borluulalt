# Борлуулалт (borluulalt)

[![CI](https://github.com/XalMorak/borluulalt/actions/workflows/node.js.yml/badge.svg)](https://github.com/XalMorak/borluulalt/actions/workflows/node.js.yml)

Бар/рестораны борлуулалт, нөөц, илгээлт, тайлангийн веб апп.

**Live:** [borluulalt-xalmorak.vercel.app](https://borluulalt-xalmorak.vercel.app)

## Юу хийдэг вэ

- Ажилтан: өдөр, ээлж, байршил, тек сонгоод пиво эсвэл вино борлуулалт оруулна
- Ахлах: тойм, илгээлт, тайлан, нөөц, хэрэглэгч, түүх
- Пиво ба вино тусдаа. Тойм / илгээлт / тайлан дээр Пиво | Вино | Нэгдсэн
- Нөөц байршлаар: Оюут бар, Манлай бар, VIP, POWER
- Түр хадгалалт (утас, Safari)
- Үүлэн синк автомат

## Stack

JavaScript · Firebase Realtime Database · Vercel

## Гол файлууд

| Файл | Зорилго |
|------|---------|
| `index.html` | Ачаалагч — иж хостын `ui.html` + JS |
| `ui.html` | Хуудасны HTML/CSS |
| `app.js`, `app2.js`, `app3.js` | Үндсэн логик |
| `compat_fix.js` | XSS-safe alert, илгээлтийн түлхүүр (байршил орно) |
| `wine.js` | Вино каталог, тек, ангилал |
| `wine_stock.js` | Виноны нөөц байршлаар |
| `vercel.json` | Хостинг |

Скриптүүдийг `index.html` иж домейнаас ачаална (jsDelivr SHA pin байхгүй).

## Локал

```bash
npx serve .
npm run check
```

## Өгөгдөл

Firebase зангилаа `borluulalt`. Илгээлт: ажилтан + огноо + ээлж + **байршил**.

## License

MIT — дэлгэрэх `LICENSE`.
