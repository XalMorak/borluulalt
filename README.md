# Борлуулалт (borluulalt)

Бар/рестораны борлуулалт, нөөц, илгээлт, тайлангийн веб апп.

- Амьд сайт: https://borluulalt-xalmorak.vercel.app
- Эх код: https://github.com/XalMorak/borluulalt
- Өгөгдөл: Firebase Realtime Database `borluulalt-f9d70`

## Юу хийдэг вэ

- Ажилтан: өдөр, ээлж, байршил, тек сонгоод пиво эсвэл вино борлуулалт оруулна
- Ахлах: тойм, илгээлт, тайлан, нөөц, хэрэглэгч
- Пиво ба вино тусдаа. Тойм / илгээлт / тайлан дээр Пиво | Вино | Нэгдсэн
- Нөөц байршлаар: Оюут бар, Манлай бар, POWER
- Түр хадгалалт (утас, Safari)
- Үүлэн синк автомат

## Гол файлууд

| Файл | Зорилго |
|------|---------|
| index.html | Ачаалагч |
| ui.html | Хуудасны HTML/CSS |
| app.js, app2.js, app3.js | Үндсэн логик |
| borluulalt.js | Модуль ачаалах орох цэг |
| wine.js | Вино каталог, тек, ангилал |
| wine_stock.js | Виноны нөөц байршлаар |
| wine_split.js | Бусад бараа / улаан / цагаан |
| runtime_fix.js | Хоосон локалаар үүлэн дата дарахгүй, график |
| print_purge.js | Амьд сайт дээр нэмэлт скрипт |
| stock_fix.js, bugfix.js, merge_fix.js | Нөөц, тооцоо |
| temp_save.js | Түр хадгалалт |
| vercel.json | Хостинг |

## Локал нээх

`index.html`-ийг браузераар нээнэ. Интернет хэрэгтэй (Firebase, jsDelivr).

```
npx serve .
```

## Deploy

GitHub `XalMorak/borluulalt` main → Vercel `borluulalt-xalmorak`.
Free план өдөрт ~100 deploy.

## Өгөгдөл

Firebase зангилаа `borluulalt`: products, wines, submissions, users, logs.
Эх код GitHub дээр. Амьд илгээлт/нөөц үүлэнд.

Шинэчилсэн: 2026-09-08
