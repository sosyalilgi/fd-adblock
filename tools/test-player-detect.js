/* =====================================================================
   player-detect.js'i GERCEK GONDERILEN DOSYADAN test eder.
   ---------------------------------------------------------------------
   Onceki hatanin sebebi: mantik player.js icinde gomuluydu ve test
   onu kullanmadan "benzer" bir kopya uzerinde calisiyordu. Bu yuzden
   hem string/dizi hem offsetParent hatalari gecmis oldu.
   Burada require() ile AYNI dosya yukleniyor.
   ===================================================================== */
const path = require('path');
const PD = require(path.join(__dirname, '..', 'src', 'content', 'player-detect.js'));

let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

/* ---- sahte DOM ogeleri ---- */
function el({ sabit = false, w = 400, h = 250, disabled = false, adShowing = false } = {}) {
  return {
    disabled,
    adShowing,
    get offsetParent() { return sabit ? null : {}; },
    getBoundingClientRect: () => ({ width: w, height: h }),
    classList: { contains: (c) => c === 'ad-showing' && adShowing },
    click() { this.tiklandi = true; }
  };
}
const sorguIle = (harita) => (sel) => harita[sel] || null;

/* Gercek querySelector gibi davranan sahte. AD_SELECTORS virgulle
   BIRLESTIRILMIS bir liste oldugu icin parcalara bolunur ve
   parcalardan herhangi biri eslesirse oge doner. */
function sorguSinifli(oge) {
  return (sel) => {
    if (!oge) return null;
    return sel.split(',').some((parca) => {
      const p = parca.trim();
      const sinifSarti = p.match(/\.([a-z][a-z0-9-]*)$/i);
      if (sinifSarti) return oge.classList.contains(sinifSarti[1]);
      // sinif sarti olmayan parcalar (orn. ".video-ads" -> sinif var)
      if (p.startsWith('.')) return oge.classList.contains(p.slice(1));
      return false;
    }) ? oge : null;
  };
}

console.log('\n1) Seciciler DOGRU turde (bu, ilk hatanin sebebiydi)');
check('AD_SELECTORS bir string', typeof PD.AD_SELECTORS === 'string', typeof PD.AD_SELECTORS);
check('SKIP_SELECTORS bir string', typeof PD.SKIP_SELECTORS === 'string');
check('AD_SELECTORES virgulle birlestirilmis', PD.AD_SELECTORS.indexOf(',') !== -1);
check('tek bir sorgu olarak kullanilabilir',
  PD.AD_SELECTORS.split(',').every((s) => s.trim().length > 2));
check('hicbir secici tek karakter degil',
  PD.AD_SELECTORS.split(',').every((s) => s.trim().length > 3));

console.log('\n2) reklamVarMi gercekten reklam buluyor');
{
  const s = sorguIle({ [PD.AD_SELECTORS]: el() });
  check('gorsunur reklam bari -> true', PD.reklamVarMi(s) === true);
}
{
  const s = sorguIle({});
  check('reklam yok -> false', PD.reklamVarMi(s) === false);
}
{
  const s = sorguIle({ [PD.AD_SELECTORS]: el({ w: 0, h: 0, sabit: true }) });
  check('sifir olculu oge -> false', PD.reklamVarMi(s) === false);
}

console.log('\n3) position:fixed oge goruluyor mu? (ikinci hata)');
{
  // offsetParent null doner; eski kod bunu "gorunmez" sanardi
  const sabit = el({ sabit: true });
  check('test kurgusu: offsetParent null', sabit.offsetParent === null);
  check('sabit konumlu reklam yine de bulunuyor',
    PD.reklamVarMi(sorguIle({ [PD.AD_SELECTORS]: sabit })) === true);
}

console.log('\n4) gorunurMu ayri testleri');
check('null -> false', PD.gorunurMu(null) === false);
check('undefined -> false', PD.gorunurMu(undefined) === false);
check('normal konumlu -> true', PD.gorunurMu(el()) === true);
check('sabit konumlu ama boyutlu -> true', PD.gorunurMu(el({ sabit: true })) === true);
check('sabit ve boyutsuz -> false', PD.gorunurMu(el({ sabit: true, w: 0, h: 0 })) === false);
check('getBoundingClientRect hatasi yutuluyor',
  PD.gorunurMu({ offsetParent: null, getBoundingClientRect() { throw new Error('x'); } }) === false);

console.log('\n5) atlaDugmesi tiklanabilir olmali');
{
  const dugme = el();
  const s = sorguIle({ [PD.SKIP_SELECTORS]: dugme });
  const bulunan = PD.atlaDugmesi(s);
  check('dugme bulundu', bulunan === dugme);
  check('click cagrilabilir', typeof bulunan.click === 'function');

  check('disabled dugme reddedilir',
    PD.atlaDugmesi(sorguIle({ [PD.SKIP_SELECTORS]: el({ disabled: true }) })) === null);
  check('dugme yoksa null',
    PD.atlaDugmesi(sorguIle({})) === null);
  check('click metodu olmayan oge reddedilir',
    PD.atlaDugmesi(sorguIle({ [PD.SKIP_SELECTORS]: { disabled: false } })) === null);
}

console.log('\n6) Bozuk/eksik DOM cokmemeli');
{
  const patlayan = () => { throw new Error('DOM yok'); };
  check('sorgu patlayinca false', PD.reklamVarMi(patlayan) === false);
  check('sorgu patlayinca atla null', PD.atlaDugmesi(patlayan) === null);
  check('sorgu null dondurunce false', PD.reklamVarMi(() => null) === false);
}

console.log('\n7) GERCEK RAPORDAN GELEN SENARYO');
/* Kullanici raporu: ad-showing=true, hiz=1 — reklam oynuyor ama
   yedek devreye girmemis. Eski seciciler (.video-ads vb.) modern
   YouTube'da HIC YOKTUR: reklam gomulu bir web component icinde
   render edilir. Tek guvenilir sinyal YouTube'un kendi sinifi. */
{
  check('#movie_player.ad-showing secicisi VAR',
    PD.AD_SELECTORS.indexOf('#movie_player.ad-showing') !== -1);
  check('.html5-video-player.ad-showing secicisi VAR',
    PD.AD_SELECTORS.indexOf('.html5-video-player.ad-showing') !== -1);
  check('YouTube bayragi ESKI secicilerden ONCE geliyor',
    PD.AD_SELECTORS.indexOf('#movie_player.ad-showing') <
    PD.AD_SELECTORS.indexOf('.video-ads'));

  // Reklam oynuyor: sinif var
  const oynatan = el({ w: 1280, h: 720, adShowing: true });
  check('ad-showing varken reklam bulunuyor',
    PD.reklamVarMi(sorguSinifli(oynatan)) === true);

  // Reklam bitti: sinif kalkti
  const bitti = el({ w: 1280, h: 720, adShowing: false });
  check('ad-showing kalkinca false donuyor',
    PD.reklamVarMi(sorguSinifli(bitti)) === false);

  // Oynatici hic yok
  check('oynatici yoksa false', PD.reklamVarMi(sorguSinifli(null)) === false);
}

console.log('\n8) Atla düğmesi Yine de calisiyor mu?');
{
  const dugme = el();
  const s = sorguIle({ [PD.SKIP_SELECTORS]: dugme });
  check('atla düğmesi bulunuyor (yeni seciciler eklenince bozulmadi)',
    PD.atlaDugmesi(s) === dugme);
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);