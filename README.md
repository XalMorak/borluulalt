# Борлуулалт (borluulalt)

Бар/рестораны борлуулалт, нөөц, илгээлт, тайлангийн веб апп.

**Live:** [borluulalt-xalmorak.vercel.app](https://borluulalt-xalmorak.vercel.app)

## Юу хийдэг вэ

- Ажилтан: өдөр, ээлж, байршил, тек сонгоод пиво эсвэл вино борлуулалт оруулна
- Ахлах: тойм, илгээлт, тайлан, нөөц, хэрэглэгч
- Пиво ба вино тусдаа. Тойм / илгээлт / тайлан дээр Пиво | Вино | Нэгдсэн
- Нөөц байршлаар: Оюут бар, Манлай бар, POWER
- Түр хадгалалт (утас, Safari)
- Үүлэн синк автомат

## Stack

JavaScript · Firebase Realtime Database · Vercel

## Гол файлууд

| Файл | Зорилго |
|------|---------|
| `index.html` | Ачаалагч |
| `ui.html` | Хуудасны HTML/CSS |
| `app.js`, `app2.js`, `app3.js` | Үндсэн логик |
| `borluulalt.js` | Модуль ачаалах орох цэг |
| `wine.js` | Вино каталог, тек, ангилал |
| `wine_stock.js` | Виноны нөөц байршлаар |
| `runtime_fix.js` | Хоосон локалаар үүлэн дата дарахгүй, график |
| `temp_save.js` | Түр хадгалалт |
| `vercel.json` | Хостинг |

## Локал

```bash
npx serve .
```

`index.html`-ийг браузераар нээнэ. Интернет хэрэгтэй (Firebase, jsDelivr).

## Deploy

GitHub `XalMorak/borluulalt` `main` → Vercel `borluulalt-xalmorak`.

## Өгөгдөл

Firebase зангилаа `borluulalt`: products, wines, submissions, users, logs.
