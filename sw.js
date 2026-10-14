// =====================================================
// Yakıt Takip — çevrimdışı çalışma (service worker)
// Uygulama dosyalarını telefonda saklar; internet yokken de açılır.
//
// - Uygulama sayfası: önce internetten (en güncel sürüm gelsin), internet yoksa
//   ya da 4 sn içinde cevap gelmezse telefondaki kopyadan.
// - Fiş okuma aracı (cdn.jsdelivr.net): ilk kullanımda saklanır, sonra telefondan.
// Kayıtlar bu dosyayla ilgili değildir; onlar localStorage'da durur.
// =====================================================
const ONBELLEK = "yakit-v1";
const UYGULAMA_DOSYALARI = ["./", "./index.html", "./icon.png"];

// Kurulum: uygulama dosyalarını sakla
self.addEventListener("install", olay => {
  olay.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(UYGULAMA_DOSYALARI)));
  self.skipWaiting();
});

// Etkinleşme: eski sürüm önbelleklerini sil
self.addEventListener("activate", olay => {
  olay.waitUntil(
    caches.keys()
      .then(adlar => Promise.all(adlar.filter(a => a !== ONBELLEK).map(a => caches.delete(a))))
      .then(() => self.clients.claim())
  );
});

// İnternetten dene; süre dolarsa ya da hata olursa saklanan kopyayı ver
function oncelikInternet(istek) {
  return new Promise(tamam => {
    let bitti = false;
    const yedeğeDon = () => {
      if (bitti) return;
      caches.match(istek, { ignoreSearch: true }).then(kopya => {
        if (kopya && !bitti) { bitti = true; tamam(kopya); }
      });
    };
    const zamanlayici = setTimeout(yedeğeDon, 4000);

    fetch(istek).then(cevap => {
      clearTimeout(zamanlayici);
      if (cevap && cevap.ok) {
        const kopya = cevap.clone();
        caches.open(ONBELLEK).then(c => c.put(istek, kopya));
      }
      if (!bitti) { bitti = true; tamam(cevap); }
    }).catch(() => {
      clearTimeout(zamanlayici);
      caches.match(istek, { ignoreSearch: true }).then(kopya => {
        if (!bitti) { bitti = true; tamam(kopya || Response.error()); }
      });
    });
  });
}

// Önce telefondaki kopya; yoksa internetten al ve sakla
function oncelikOnbellek(istek) {
  return caches.match(istek).then(kopya => kopya || fetch(istek).then(cevap => {
    if (cevap && cevap.ok) {
      const saklanacak = cevap.clone();
      caches.open(ONBELLEK).then(c => c.put(istek, saklanacak));
    }
    return cevap;
  }));
}

self.addEventListener("fetch", olay => {
  const istek = olay.request;
  if (istek.method !== "GET") return;
  const adres = new URL(istek.url);

  if (adres.origin === self.location.origin) {
    olay.respondWith(oncelikInternet(istek));
  } else if (adres.hostname === "cdn.jsdelivr.net") {
    olay.respondWith(oncelikOnbellek(istek));
  }
});
