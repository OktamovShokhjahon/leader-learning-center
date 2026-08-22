import Script from 'next/script'
import { ANALYTICS_IDS } from '@/lib/analytics'

/**
 * TZ §6.3 — analytics tags.
 *
 * Every tag is opt-in through an environment variable, so a checkout with no
 * ids configured (development, CI, a preview build) ships zero third-party
 * script bytes. This is what keeps the Lighthouse performance budget (≥ 90
 * mobile) reachable locally: you measure the site, not the tag manager.
 *
 * All three load with `strategy="afterInteractive"` — they must not compete with
 * the hero LCP element.
 */
export function Analytics() {
  const { ga4, metrica, metaPixel } = ANALYTICS_IDS

  return (
    <>
      {ga4 ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${ga4}', { anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}

      {metrica ? (
        <Script id="yandex-metrica" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
            (window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
            ym(${metrica}, 'init', { clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:false });
          `}
        </Script>
      ) : null}

      {metaPixel ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixel}');
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}
    </>
  )
}
