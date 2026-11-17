// Rewarded ads for Flapurr's "Continue" offer, behind one small interface so a real
// ad network can be switched on without touching the game.
//
//   offer()  -> Promise<null | show>   null: no ad to offer right now (hide Continue)
//   show()   -> Promise<'rewarded' | 'dismissed' | 'unavailable'>
//
// To turn on real ads, set provider to 'adsense' and fill in adsenseClient (see
// README → "Monetization"). 'placeholder' shows a short stand-in countdown so the
// flow can be tried today; 'none' hides the Continue offer entirely.
export const AD_CONFIG = { provider:'placeholder', adsenseClient:'', testMode:true, placeholderSeconds:5 };

// ---------- Stand-in ad: a countdown card inside the play area ----------
export function placeholderProvider({ seconds = 5, root = () => document.querySelector('.stage') } = {}) {
  const show = () => new Promise(resolve => {
    const host = root() || document.body, overlay = document.createElement('div');
    overlay.className = 'ad-overlay'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Sponsored message');
    overlay.innerHTML = `<div class="ad-box"><span class="ad-tag">AD</span><strong>Your ad could be here</strong>
      <p>A stand-in for a real video ad. Watch it to keep flying.</p><div class="ad-count" aria-live="polite"><span>${seconds}</span>s</div>
      <div class="ad-actions"><button type="button" class="btnGhost" data-ad-skip>No thanks</button><button type="button" class="btnPrimary" data-ad-done disabled>Continue flying</button></div></div>`;
    host.append(overlay);
    const done = overlay.querySelector('[data-ad-done]'), count = overlay.querySelector('.ad-count span');
    let left = seconds;
    const timer = setInterval(() => { left -= 1; count.textContent = String(Math.max(0, left)); if (left <= 0) { clearInterval(timer); done.disabled = false; done.focus(); overlay.querySelector('.ad-count').textContent = 'Thanks for watching'; } }, 1000);
    const finish = result => { clearInterval(timer); document.removeEventListener('keydown', key, true); overlay.remove(); resolve(result); };
    const key = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish('dismissed'); } else if (event.code === 'Space') { event.stopPropagation(); } };
    document.addEventListener('keydown', key, true);
    overlay.querySelector('[data-ad-skip]').addEventListener('click', () => finish('dismissed'));
    done.addEventListener('click', () => finish('rewarded'));
    overlay.querySelector('[data-ad-skip]').focus();
  });
  return { name:'placeholder', offer:async () => show };
}

// ---------- Google AdSense H5 Games Ads (rewarded) ----------
// Uses Google's Ad Placement API: adConfig() once, then adBreak({type:'reward'}).
// beforeReward() is only called when an ad is ready; that's when Continue appears.
export function adsenseProvider({ client, testMode = true, win = globalThis, doc = globalThis.document, waitMs = 3000 } = {}) {
  if (!/^ca-pub-\d{10,20}$/.test(client || '')) return noneProvider();
  let loaded = false;
  const load = () => {
    if (loaded) return; loaded = true;
    const script = doc.createElement('script');
    script.async = true; script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    script.dataset.adClient = client; if (testMode) script.dataset.adbreakTest = 'on';
    doc.head.append(script);
    win.adsbygoogle = win.adsbygoogle || [];
    win.adBreak = win.adConfig = options => win.adsbygoogle.push(options);
    win.adConfig({ preloadAdBreaks:'on', sound:'on' });
  };
  load();
  const offer = () => new Promise(resolve => {
    let settle = null, offered = false;
    const timer = setTimeout(() => { if (!offered) resolve(null); }, waitMs);
    win.adBreak({ type:'reward', name:'continue-run',
      beforeReward:showAdFn => { offered = true; clearTimeout(timer); resolve(() => new Promise(done => { settle = done; showAdFn(); })); },
      adDismissed:() => settle?.('dismissed'), adViewed:() => settle?.('rewarded'),
      adBreakDone:info => { if (!offered) { clearTimeout(timer); resolve(null); } else if (!['viewed', 'dismissed'].includes(info?.breakStatus)) settle?.('unavailable'); } });
  });
  return { name:'adsense', offer };
}
export const noneProvider = () => ({ name:'none', offer:async () => null });

export function createAdProvider(config = AD_CONFIG, search = globalThis.location?.search || '') {
  const override = new URLSearchParams(search).get('ads'); // ?ads=none or ?ads=placeholder for testing
  const provider = ['none', 'placeholder'].includes(override) ? override : config.provider;
  if (provider === 'adsense') return adsenseProvider({ client:config.adsenseClient, testMode:config.testMode });
  if (provider === 'placeholder') return placeholderProvider({ seconds:config.placeholderSeconds });
  return noneProvider();
}
