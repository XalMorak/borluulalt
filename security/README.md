# Аюулгүй байдал: сервер нэвтрэлт + role-based rules

## Юу өөрчлөгдөх вэ

| | Одоо (legacy) | Дараа (secure) |
|---|---|---|
| PIN шалгалт | Браузерт (`users/<id>/pin` plain text, хэн ч уншина) | Сервер `POST /api/login` (scrypt hash, `borluulalt_secret/pins`, клиент уншиж чадахгүй) |
| Firebase auth | Anonymous — хэн ч бүх `borluulalt`-ыг унших/бичих | Custom token (`uid` = хэрэглэгчийн ID, claims `{role, eid}`) |
| Эрх | Бүгд бүгдийг | Rules: ажилтан → зөвхөн өөрийн inbox; ахлах → submissions/products/wines/logs/_meta/deleted; нягтлан → users/rosters/payments |
| Brute force | Хязгааргүй | ID-д 15 мин-д 5 буруу → 10 мин түгжинэ; IP-д 30 → 10 мин |

## Яагаад Vercel function (Cloud Function биш)

* Cloud Functions нь Firebase **Blaze** (картаар төлбөртэй) план шаарддаг. Vercel Hobby дээрх function үнэгүй, сайт аль хэдийн Vercel дээр.
* Сул тал: service-account key Vercel env-д хадгалагдана (гараар rotate хийнэ, алдагдвал DB бүрэн эрх). Cloud Functions бол key хэрэггүй (built-in identity).
* Vercel **Hobby** нь зөвхөн арилжааны бус хэрэглээнд зориулагдсан (ToS). Бизнесийн хэрэглээнд **Pro** ($20/сар) хэрэгтэй байж болно. Blaze руу шилжвэл энэ кодыг Cloud Function болгоход амархан (`api/*.js` нь энгийн `(req,res)` handler).
* Firebase Spark (үнэгүй) план хангалттай: custom token, Admin SDK, rules бүгд үнэгүй.

## Файлууд

* `api/login.js` — `{id, pin}` → custom token. Plain PIN байгаа бол түүгээр шалгаад hash-ийг автоматаар үүсгэнэ (lazy migration).
* `api/pin.js` — нягтлан (ID token-оор) PIN тохируулах / устгах. PIN зөвхөн hash.
* `api/config.js` — `LOGIN_MODE`-ийг клиентэд өгнө. Сервер тохируулаагүй бол үргэлж `legacy`.
* `sec_login.js` — клиентийн feature flag (legacy / transition / secure).
* `security/database.rules.transition.json` — одоогийнхтой ижил эрх (anonymous ажиллана) + `borluulalt`-г бүхэлд нь `set()` хийхийг хориглоно + `borluulalt_secret` хаалттай + delta-sync index.
* `security/database.rules.strict.json` — role-based. `node security/build-rules.js`-ээр үүсгэдэг (гараар бүү засаарай).
* `scripts/merge-rules.js` — одоогийн rules-д зөвхөн `borluulalt` + `borluulalt_secret`-г солино, **`eahs` болон бусад key хэвээр**.
* `scripts/migrate-pins.js` — `status` / `copy` / `strip` / `generate-missing` (default dry-run, `--apply`-гаар бичнэ).

## Env (Vercel → Project → Settings → Environment Variables)

| Нэр | Утга |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON (бүтнээр нь эсвэл base64). **Sensitive** |
| `FIREBASE_DATABASE_URL` | `https://borluulalt-f9d70-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `PIN_PEPPER` | Санамсаргүй 32+ тэмдэгт (`openssl rand -hex 32`). **Sensitive. Дараа нь бүү өөрчил** (бүх hash хүчингүй болно) |
| `LOGIN_MODE` | `legacy` → `transition` → `secure` |
| `REQUIRE_PIN` | `staff` (default: ахлах/нягтлан заавал) эсвэл `all` (бүгдэд заавал) эсвэл `none` |
| `PIN_ADMIN_ROLES` | (заавал биш) default `accountant` |

## Нэвтрүүлэх дараалал (энэ дарааллаар!)

1. **PR merge** → Vercel deploy. Env байхгүй тул `/api/config` = `legacy`, юу ч өөрчлөгдөхгүй.
2. **Service account key**: Firebase console → ⚙ Project settings → Service accounts → *Generate new private key*. JSON-г хаана ч commit хийж, чатад бүү илгээ.
3. **Vercel env** (дээрх хүснэгт), `LOGIN_MODE=legacy`. Redeploy. `https://<site>/api/config` → `"configured":true`.
4. **Transition rules**: Firebase console → Realtime Database → Rules → бүгдийг `current.json` болгож хадгал (backup) →
   `node scripts/merge-rules.js current.json transition > publish.json` → `publish.json`-г шалгаад paste → **Publish**. Апп хэвийн ажиллаж байгааг шалга.
5. **PIN hash хуулах** (өөрийн компьютер дээр, Vercel-тэй ижил env-тэй):
   ```
   npm install
   export FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" FIREBASE_DATABASE_URL=... PIN_PEPPER=...
   node scripts/migrate-pins.js status
   node scripts/migrate-pins.js copy            # dry run
   node scripts/migrate-pins.js copy --apply
   ```
   PIN-гүй хэрэглэгчдэд: `node scripts/migrate-pins.js generate-missing --roles=staff --apply` (эсвэл `--roles=all` + `REQUIRE_PIN=all`). PIN-үүд зөвхөн `new-pins.csv`-д — тарааж өгөөд файлыг устга.
6. **`LOGIN_MODE=transition`** → Redeploy. Нэвтрэлт сервераар явна; сервер унавал / PIN тохируулаагүй бол хуучнаар нэвтэрнэ (хэн ч түгжигдэхгүй). Firebase console → Authentication → Users-д `emp001` гэх мэт uid харагдах ёстой.
7. **Бүх төхөөрөмж reload** хийтэл хүлээ (хуучин нээлттэй tab хуучин кодоор ажиллана). Ажилтнуудад нэг удаа хуудсаа refresh хийхийг хэл.
8. **`LOGIN_MODE=secure`** → Redeploy → дараа нь **strict rules**: `node scripts/merge-rules.js current.json strict > publish.json` → Publish. (Эхлээд secure, дараа нь strict — эсрэг дарааллаар бол хуучин клиентүүд түгжигдэнэ.)
9. **Plain PIN устгах**: `node scripts/migrate-pins.js strip` → `strip --apply`. Hash таарахгүй хэрэглэгчийг алгасна (exit 2) — `copy --apply` дахин ажиллуулаад давт.
10. **PIN солих**: хуучин PIN-үүд олон жил хэнд ч харагдаж байсан тул нягтлан Хэрэглэгч tab-аас шинэ PIN өгөх нь зөв.
11. (Заавал биш) Authentication → Sign-in method → **Anonymous**-г унтраах — зөвхөн `eahs` апп anonymous ашигладаггүй нь батлагдсан бол.

### Буцаах
* 6–8-р алхмын үед: `LOGIN_MODE=transition` (эсвэл `legacy`) + transition rules publish → шууд хуучин байдал.
* **9-р алхмын (strip) дараа legacy руу бүү буцаа**: plain PIN байхгүй тул хуучин клиент PIN шалгахгүй нэвтрүүлнэ. `secure`/`transition` хэвээр байлгаад серверийг засна.
* Түгжигдсэн ID: 10 минут хүлээх, эсвэл console-оос `borluulalt_secret/attempts/<id>` устгах.

## Тест (локал emulator, production-д хүрэхгүй)

```
npm ci && cd tests/security && npm ci                 # Java 11+ хэрэгтэй
npx firebase emulators:exec --only database,auth --project demo-borluulalt "npm test"
#   rules (strict + transition) + /api/login /api/pin /api/config + migrate-pins  (CI-д мөн ажиллана)
npx firebase emulators:exec --only database,auth --project demo-borluulalt "npm run e2e"
#   headless Chrome: апп + emulator + /api (127.0.0.1-ээс өөр хүсэлт бүгд хаагдана)
```

## Мэдэгдэж буй эрсдэл
* Service-account key алдагдвал DB бүрэн эрх → зөвхөн Vercel env (Sensitive), 6–12 сар тутам rotate.
* 4–6 оронтой PIN сул: rate limit тусалдаг ч IP солиод олон ID-г зэрэг оролдох боломжтой. `REQUIRE_PIN=all`, 6+ орон зөвлөнө.
* Rules нь `borluulalt/users`-ээс role уншдаг: нягтлан эрх = хамгийн өндөр эрх (role өөрчлөх). Хэрэглэгчийг устгах/идэвхгүй болгоход эрх нь шууд хаагдана (token хүчинтэй байсан ч).
* Төхөөрөмжийн IndexedDB mirror (delta-sync) өмнө нэвтэрсэн хэрэглэгчийн өгөгдлийг хадгалдаг — rules үүнийг хамгаалахгүй. Хуваалцсан төхөөрөмж дээр анхаар.
* Preview deploy нь production DB-тэй ижил env ашиглавал бодит өгөгдөл рүү бичнэ.
