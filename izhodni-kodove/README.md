# HELIOS Каса — изходен код

- `src/engine.js` — цялата логика (сървър + каса без интернет)
- `src/server.gs.js` — връзка с Google Sheets; `Code.gs` = engine.js + server.gs.js (това се слага в Apps Script)
- `src/sw.js`, `src/manifest.json`, иконки — работа без интернет / инсталиране
- `index.template.html` — приложението (без адреса на сървъра)
- `src/seed.js` — примерни данни за демото
- `build.py` — сглобява dist/ и demo.html (очаква index.html до себе си)
- `test/` — тестове: `node test/engine.test.js`, `node test/gas.test.js`, e2e с `test/server.js`

Файловете в корена (index.html, engine.js, sw.js…) са живата версия на https://mkarautoltd-boop.github.io/avtomivka/
