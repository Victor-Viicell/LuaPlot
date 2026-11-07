import{$n as e,At as t,Dn as n,Gn as r,Gt as i,Jn as a,Jt as o,Kt as s,Qn as c,Sn as l,Sr as u,W as d,Wn as f,Y as p,Yn as m,Zn as h,a as g,ar as _,br as v,d as y,ir as b,it as x,j as S,kn as C,r as w,rn as T,un as E,zn as D}from"./router-CZLcm2lr.js";import{H as O,U as k}from"./index-tOQeXckU.js";import{t as A}from"./Button-j1K3t-Vv.js";function j(e){return x.parse(e===void 0?{ok:!0}:{ok:!0,value:e})}function M(e){return x.parse({ok:!1,reason:e})}var N={haptic:`plugin:haptics|vibrate`,clipboardWrite:`plugin:clipboard-manager|write_text`,badge:`plugin:badge|set`,pickImage:`plugin:dialog|open`},P={light:[8],medium:[16],heavy:[28],success:[10,60,16],warning:[20,70,20],error:[30,60,30]},F=[`png`,`jpg`,`jpeg`,`webp`,`gif`,`avif`],I=/^\(\d+\)\s+/;function L(){return typeof window<`u`&&`__TAURI_INTERNALS__`in window}var R=null;function z(){return L()?(R??=y(()=>import(`./core-CwBWH9_g.js`),[]).catch(()=>null),R):Promise.resolve(null)}async function B(e,t){let n=await z();if(!n)return null;try{return await n.invoke(e,t)}catch{return null}}async function V(e=`light`){let t=p.safeParse(e);if(!t.success)return M(`failed`);let n=t.data;if(await B(N.haptic,{kind:n})!==null)return j(n);if(typeof(typeof navigator>`u`?void 0:navigator.vibrate)!=`function`)return M(`unsupported`);try{return navigator.vibrate(P[n])?j(n):M(`unsupported`)}catch{return M(`failed`)}}async function H(e){let n=t.safeParse(e);if(!n.success)return M(`failed`);let r=n.data;if(typeof navigator<`u`&&typeof navigator.share==`function`)try{return await navigator.share(r),j(`shared`)}catch(e){if(e instanceof DOMException&&e.name===`AbortError`)return M(`cancelled`)}let i=await U([r.text,r.url].filter(Boolean).join(` `)||r.title||``);return i.ok?j(`copied`):M(i.reason)}async function U(e){let t=d.safeParse(e);if(!t.success)return M(`failed`);let n=t.data;if(await B(N.clipboardWrite,{text:n})!==null)return j(n);if(typeof navigator<`u`&&typeof navigator.clipboard?.writeText==`function`)try{return await navigator.clipboard.writeText(n),j(n)}catch{}return ee(n)?j(n):M(`unsupported`)}function ee(e){if(typeof document>`u`||typeof document.execCommand!=`function`)return!1;let t=document.createElement(`textarea`);t.value=e,t.setAttribute(`readonly`,``),t.style.position=`fixed`,t.style.top=`-1000px`,t.style.opacity=`0`,document.body.append(t),t.select();try{return document.execCommand(`copy`)}catch{return!1}finally{t.remove()}}async function te(){let e=await B(N.pickImage,{options:{multiple:!1,directory:!1,title:`Choose an image`,filters:[{name:`Images`,extensions:F}]}});return typeof e==`string`&&e.length>0?j(e.split(/[\\/]/).pop()??e):typeof document>`u`?M(`unsupported`):ne()}function ne(){return new Promise(e=>{let t=document.createElement(`input`);t.type=`file`,t.accept=`image/*`,t.style.display=`none`,document.body.append(t);let n=!1;function r(r){n||(n=!0,window.removeEventListener(`focus`,i),t.remove(),e(r))}function i(){window.setTimeout(()=>{n||t.files&&t.files.length!==0||r(M(`cancelled`))},400)}t.addEventListener(`change`,()=>{let e=t.files?.[0];r(e?j(e.name):M(`cancelled`))},{once:!0}),t.addEventListener(`cancel`,()=>r(M(`cancelled`)),{once:!0}),window.addEventListener(`focus`,i),t.click()})}var W=null;async function G(e){let t=S.safeParse(e);if(!t.success)return M(`failed`);let n=t.data;return await B(N.badge,{count:n})===null?typeof document>`u`?M(`unsupported`):(W??=document.title.replace(I,``),document.title=n===0?W:`(${n}) ${W}`,j(n===0?`title cleared`:`(${n}) title`)):j(n===0?`cleared`:String(n))}var re=[{name:`haptic`,native:`plugin:haptics`,web:`navigator.vibrate`,miss:`unsupported`},{name:`shareText`,native:`—`,web:`navigator.share → copy()`,miss:`cancelled on dismissal`},{name:`copy`,native:`plugin:clipboard-manager`,web:`clipboard → execCommand`,miss:`unsupported`},{name:`pickImage`,native:`plugin:dialog`,web:`<input type=file>`,miss:`cancelled on dismissal`},{name:`setBadge`,native:`plugin:badge`,web:`document.title`,miss:`—`}],ie=c(`span`,null,[` · last `,[`b`,null,` `]]);function ae(e,{a:t,b:i,c:a}){var o=ie(),s=o.firstChild.nextSibling.firstChild;r(s,()=>f(t,()=>i(n(a).name)).read),m(e,o)}function K({a:e,b:t,c:r}){if(f(e,()=>t(n(r).name)))return ae}function q(t,{a:n,b:r,c:i,d:o}){C(A,t,{variant:`secondary`,disabled:r.value===`haptic`,onClick:()=>f(i,()=>o(`haptic`,()=>f(i,()=>V(`medium`)))),children:a((t,n)=>{var r=e(`Vibrate`);m(t,r)})})}function oe(t,{a:n,b:r,c:i,d:o}){C(A,t,{variant:`secondary`,disabled:r.value===`shareText`,onClick:()=>f(i,()=>o(`shareText`,()=>f(i,()=>H({title:`LuaPlot`,text:`A character worth reading.`,url:`${location.origin}${g(`/discover/characters`)}`})))),children:a((t,n)=>{var r=e(`Share`);m(t,r)})})}function se(t,{a:n,b:r,c:i,d:o}){C(A,t,{variant:`secondary`,disabled:r.value===`copy`,onClick:()=>f(i,()=>o(`copy`,()=>f(i,()=>U(`LuaPlot · the native bridge`)))),children:a((t,n)=>{var r=e(`Copy`);m(t,r)})})}function ce(t,{a:n,b:r,c:i,d:o}){C(A,t,{variant:`secondary`,disabled:r.value===`pickImage`,onClick:()=>f(i,()=>o(`pickImage`,()=>f(i,te))),children:a((t,n)=>{var r=e(`Pick`);m(t,r)})})}function le(t,{a:n,b:r,c:i,d:o}){C(A,t,{variant:`secondary`,disabled:r.value===`setBadge`,onClick:()=>f(i,()=>o(`setBadge`,()=>f(i,()=>G(3)))),children:a((t,n)=>{var r=e(`Badge 3`);m(t,r)})})}function J({a:e,b:t,c:r,d:i}){return n(e).name===`haptic`?q:n(e).name===`shareText`?oe:n(e).name===`copy`?se:n(e).name===`pickImage`?ce:le}var ue=h(`<div class=cap><span class=cap-name> </span><span class=cap-road>shell <code> </code> · web <code> </code></span><span class=cap-action><!>`);function de(e){var t=K({a:e._a,b:e._b,c:e._c});e.a!==t&&s(e._d,e.a=t);var n=J({a:e._c,b:e._e,c:e._a,d:e._f});e.b!==n&&s(e._g,e.b=n)}var fe=c(`p`,[`class`,`empty`],`No calls yet. Every button above answers in place.`),pe=c(`div`,[`class`,`entry`],[[`div`,[`class`,`entry-head`],[[`span`,[`class`,`entry-name`]],[`span`,[`class`,`entry-verdict`],` `]]],[`span`,[`class`,`entry-read`]]]);function me(e){var t=n(e._a),r=t.capability;e.a!==r&&(T(e._b,r,e.a),e.a=r);var i=String(t.result.ok);e.b!==i&&e._c.setAttribute(`data-ok`,e.b=i);var a=t.read;e.c!==a&&(T(e._d,a,e.c),e.c=a)}var he=c(`div`,[`class`,`log`]);function ge(e,t){var n=fe();m(e,n)}function _e(e,t){var i=he();O(i,()=>t.value,(e,t)=>{var i=pe(),a=i.firstChild,o=a.firstChild,s=o.nextSibling,c=s.firstChild;r(c,()=>n(t).result.ok?`ok`:n(t).result.reason);var l=a.nextSibling;k({a:``,b:void 0,c:``,_a:t,_b:o,_c:s,_d:l}),m(e,i)},4,e=>e.id,void 0,void 0,me),m(e,i)}function Y(e){return e.value.length===0?ge:_e}var ve=h(`<style>
      .native {
        display: flex;
        flex-direction: column;
        gap: 28px;
        padding-bottom: 40px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--color-border);
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        font-size: 26px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.2;
      }

      .lede {
        max-width: 74ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.6;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }

      .badge {
        padding: 4px 9px;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        color: var(--color-text-muted);
        font-size: 11px;
        letter-spacing: 0.06em;
      }

      .badge b {
        color: var(--color-text);
        font-weight: 600;
      }

      .sec {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .sec-head {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--color-border);
      }

      .sec-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .sec-note {
        max-width: 72ch;
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .caps {
        display: flex;
        flex-direction: column;
        gap: 1px;
        background-color: var(--color-border);
      }

      .cap {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 12px;
        padding: 12px;
        background-color: var(--color-bg);
      }

      .cap-name {
        font-family: var(--font-mono);
        font-size: 13px;
        font-weight: 600;
      }

      .cap-road {
        grid-column: 1;
        color: var(--color-text-subtle);
        font-size: 11px;
        line-height: 1.6;
      }

      .cap-road code {
        color: var(--color-text-muted);
        font-family: var(--font-mono);
        font-size: 11px;
      }

      .cap-action {
        grid-column: 2;
        grid-row: 1 / span 2;
        align-self: center;
      }

      .cap-miss {
        color: var(--color-warning, var(--color-text-muted));
      }

      .log {
        display: flex;
        flex-direction: column;
        gap: 1px;
        background-color: var(--color-border);
      }

      .entry {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        background-color: var(--color-bg);
      }

      .entry-head {
        display: flex;
        gap: 8px;
        align-items: baseline;
      }

      .entry-name {
        font-family: var(--font-mono);
        font-size: 12px;
        font-weight: 600;
      }

      .entry-verdict {
        margin-left: auto;
        color: var(--color-text-subtle);
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .entry-verdict[data-ok="true"] {
        color: var(--color-success, var(--color-accent-text));
      }

      .entry-read {
        color: var(--color-text-muted);
        font-size: 12px;
        line-height: 1.6;
        word-break: break-word;
      }

      .empty {
        padding: 16px 12px;
        background-color: var(--color-bg);
        color: var(--color-text-subtle);
        font-size: 12px;
      }

      .note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .tools {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .link {
        color: var(--color-text-muted);
        text-decoration: underline;
      }

      @media (min-width: 900px) {
        .cap {
          grid-template-columns: 200px minmax(0, 1fr) auto;
          align-items: center;
          padding: 14px 16px;
        }

        .cap-road {
          grid-column: 2;
        }

        .cap-action {
          grid-row: 1;
        }
      }

      @media (min-width: 1200px) {
        .native {
          gap: 36px;
        }
      }
      </style><div class=native><header class=head><p class=kicker>dev · hardware</p><h1 class=title>Native bridge</h1><p class=lede>Five capabilities, one typed answer each. Every call returns <code>{ ok }</code> or <code>{ ok: false, reason }</code>, so a page never needs a <code>try</code> to render “nothing happened”. In this build the shell registers no
          haptics, badge or clipboard plugin, so the browser road answers and the plugin rung stays
          inert.</p><div class=badges><span class=badge>shell <b></b></span><span class=badge>chunk <b></b></span><span class=badge>title <b> </b></span></div></header><section class=sec><div class=sec-head><h2 class=sec-title>Capabilities</h2><p class=sec-note>The road column is imported from <code>lib/native.ts</code>, not retyped: if the module
            changes its ladder, this page changes with it. A shell-only rung that this build does
            not compile in is named — and falling through it is the point, not a failure.</p></div><div class=caps></div><p class=note>Cancel a share or dismiss the picker on purpose: the answer must read <b>cancelled</b>, never <b>failed</b>— a toast on dismissal is a bug. Badge writes the
          title, so the tab strip shows what the shell would have badged; press it again with 0 to
          see the title come back, which is why the module remembers the unbranded one.</p><div class=tools></div></section><section class=sec><div class=sec-head><h2 class=sec-title>Last answers</h2><p class=sec-note>Newest first, six deep. The shape shown is the parsed result — the module already ran it
            through <code>nativeResultSchema</code>, so nothing here can print a reason the schema
            does not allow.</p></div></section><section class=sec><div class=sec-head><h2 class=sec-title>Elsewhere</h2><p class=sec-note>The other dev seams; none of them is in the spec index.</p></div><p class=note><a class=link>/dev/data</a>· fixtures and mutations ·<a class=link>/dev/state</a>· session and NSFW pair ·<a class=link>/dev/primitives</a>· primitives at four
          widths`,1,2);function X(e){var t=Y(e._a);e.a!==t&&s(e._b,e.a=t);var n=f(e._c,()=>g(`/dev/data`));e.b!==n&&o(e._d,`href`,e.b=n);var r=f(e._c,()=>g(`/dev/state`));e.c!==r&&o(e._e,`href`,e.c=r);var i=f(e._c,()=>g(`/dev/primitives`));e.d!==i&&o(e._f,`href`,e.d=i)}var ye=h(`<!>`,1,1);function Z(t,o){let s=f(o,L),c=D([],o),d=D(typeof document>`u`?``:document.title,o),p=D(``,o);function h(e,t){Q+=1,c.value=f(o,()=>[{id:Q,capability:e,result:t,read:be(t)},...c.value].slice(0,6)),d.value=document.title,p.value=``}async function g(e,t){p.value=e,h(e,await f(o,t))}function v(e){return f(o,()=>c.value.find(t=>t.capability===e))}var y=ye(),x=_(y);r(x,()=>a((t,o)=>{var h=ve(),y=_(h).nextSibling.firstChild,x=y.firstChild.nextSibling.nextSibling.nextSibling.firstChild,S=x.firstChild.nextSibling;S.textContent=s?`tauri`:`browser`;var T=x.nextSibling,D=T.firstChild.nextSibling;D.textContent=s?`loaded`:`never requested`;var j=T.nextSibling.firstChild.nextSibling.firstChild;r(j,()=>d.value||`—`);var M=y.nextSibling,N=M.firstChild.nextSibling;O(N,()=>re,(e,t)=>{var a=ue(),s=a.firstChild,c=s.firstChild;r(c,()=>n(t).name);var l=s.nextSibling,d=l.firstChild.nextSibling,f=d.firstChild;r(f,()=>n(t).native);var h=d.nextSibling.nextSibling.firstChild;r(h,()=>n(t).web);var _=b(l,!0),y=i(_,K,2,{a:o,b:v,c:t}),x=l.nextSibling.firstChild,S=i(x,J,2,{a:t,b:p,c:o,d:g});k({a:u,b:u,_a:o,_b:v,_c:t,_d:y,_e:p,_f:g,_g:S}),m(e,a)},4,e=>e.name,void 0,void 0,de);var P=N.nextSibling.nextSibling,F=b(P);C(A,F,{variant:`secondary`,onClick:()=>f(o,()=>g(`setBadge`,()=>f(o,()=>G(0)))),children:a((t,n)=>{var r=e(`Clear badge`);m(t,r)})});var I=M.nextSibling,L=b(I,!0),R=i(L,Y,0,c),z=I.nextSibling.firstChild.nextSibling.firstChild;E(`Click`,z,()=>f(o,()=>w(`/dev/data`)));var B=z.nextSibling.nextSibling;E(`Click`,B,()=>f(o,()=>w(`/dev/state`)));var V=B.nextSibling.nextSibling;E(`Click`,V,()=>f(o,()=>w(`/dev/primitives`))),l(X,{a:u,b:void 0,c:void 0,d:void 0,_a:c,_b:R,_c:o,_d:z,_e:B,_f:V}),m(t,h)})),m(t,y)}$[v]=Z;function be(e){return e.ok?e.value?`ok · ${e.value}`:`ok`:e.reason===`unsupported`?`unsupported · this browser has no road`:e.reason===`cancelled`?`cancelled · the person said no`:`failed · a road existed and broke`}var Q=0;function $(){return a(Z)}export{$ as DevNative,$ as default};