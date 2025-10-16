// Renders the standalone design.html inside the app via iframe srcDoc.
// This integrates all UI and JS without rewriting to React.
import React, { useEffect, useMemo, useRef } from 'react'
import { beginNeynarLogin, pollNeynarLogin } from '@/auth/neynar'
// Vite supports importing arbitrary files as strings with ?raw
// We import the root design.html and inject as srcDoc
// @ts-ignore - type provided by *?raw module declaration
import designHtml from '../../design.html?raw'

export default function DesignEmbed() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Inject a small bridge script that intercepts the profile button click
  // and asks the parent to perform Farcaster login.
  const htmlWithBridge = useMemo(() => {
    const bridge = `\n<script>(function(){\n  function onReady(fn){ if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', fn); } else { fn(); } }\n  onReady(function(){\n    var btn = document.getElementById('btnProfile');\n    if(!btn) return;\n    try {\n      // Capture-phase handler to prevent the original alert from firing\n      btn.addEventListener('click', function(e){\n        try{ e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault(); }catch(_){}\n        try{ parent.postMessage({ type: 'REQUEST_FARCASTER_LOGIN' }, '*'); }catch(_){}\n      }, true);\n    } catch(_) {}\n  });\n})();</script>`
    if (designHtml.includes('</body>')) {
      return designHtml.replace('</body>', bridge + '\n</body>')
    }
    return designHtml + bridge
  }, [])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // Ensure the message is from our iframe
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return
      const data: any = e.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'REQUEST_FARCASTER_LOGIN') {
        ;(async () => {
          try {
            const init = await beginNeynarLogin()
            if (init.approvalUrl) window.open(init.approvalUrl, '_blank')
            await pollNeynarLogin(init.token)
            // Optionally notify iframe of success
            try { iframeRef.current?.contentWindow?.postMessage({ type: 'LOGIN_STATUS', ok: true }, '*') } catch {}
          } catch (err) {
            console.error('Farcaster login failed', err)
            try { iframeRef.current?.contentWindow?.postMessage({ type: 'LOGIN_STATUS', ok: false, error: (err as any)?.message }, '*') } catch {}
          }
        })()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <div style={{height:'100dvh', width:'100%', margin:0, padding:0}}>
      <iframe
        ref={iframeRef}
        title="Design UI"
        // Use srcDoc so the HTML runs in its own document context
        srcDoc={htmlWithBridge}
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
          background: 'transparent',
        }}
      />
    </div>
  )
}
