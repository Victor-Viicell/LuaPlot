import{An as e,Cr as t,Hn as n,Jn as r,Jt as i,K as a,Mn as o,Mt as s,N as c,Qn as l,Tn as u,Tr as d,Yt as f,Z as p,Zn as m,Zt as h,a as g,cr as _,d as v,er as y,nr as b,on as x,ot as S,pn as C,qn as w,r as T,sr as E,tr as D}from"./router-DlgP2H6H.js";import{H as O,U as k}from"./index-CN7tdrjB.js";import{t as A}from"./Button-Cj7jMMtf.js";function j(e){return S.parse(e===void 0?{ok:!0}:{ok:!0,value:e})}function M(e){return S.parse({ok:!1,reason:e})}var N={haptic:`plugin:haptics|vibrate`,clipboardWrite:`plugin:clipboard-manager|write_text`,badge:`plugin:badge|set`,pickImage:`plugin:dialog|open`},P={light:[8],medium:[16],heavy:[28],success:[10,60,16],warning:[20,70,20],error:[30,60,30]},F=[`png`,`jpg`,`jpeg`,`webp`,`gif`,`avif`],I=/^\(\d+\)\s+/;function L(){return typeof window<`u`&&`__TAURI_INTERNALS__`in window}var R=null;function z(){return L()?(R??=v(()=>import(`./core-CwBWH9_g.js`),[]).catch(()=>null),R):Promise.resolve(null)}async function B(e,t){let n=await z();if(!n)return null;try{return await n.invoke(e,t)}catch{return null}}async function V(e=`light`){let t=p.safeParse(e);if(!t.success)return M(`failed`);let n=t.data;if(await B(N.haptic,{kind:n})!==null)return j(n);if(typeof(typeof navigator>`u`?void 0:navigator.vibrate)!=`function`)return M(`unsupported`);try{return navigator.vibrate(P[n])?j(n):M(`unsupported`)}catch{return M(`failed`)}}async function ee(e){let t=s.safeParse(e);if(!t.success)return M(`failed`);let n=t.data;if(typeof navigator<`u`&&typeof navigator.share==`function`)try{return await navigator.share(n),j(`shared`)}catch(e){if(e instanceof DOMException&&e.name===`AbortError`)return M(`cancelled`)}let r=await H([n.text,n.url].filter(Boolean).join(` `)||n.title||``);return r.ok?j(`copied`):M(r.reason)}async function H(e){let t=a.safeParse(e);if(!t.success)return M(`failed`);let n=t.data;if(await B(N.clipboardWrite,{text:n})!==null)return j(n);if(typeof navigator<`u`&&typeof navigator.clipboard?.writeText==`function`)try{return await navigator.clipboard.writeText(n),j(n)}catch{}return te(n)?j(n):M(`unsupported`)}function te(e){if(typeof document>`u`||typeof document.execCommand!=`function`)return!1;let t=document.createElement(`textarea`);t.value=e,t.setAttribute(`readonly`,``),t.style.position=`fixed`,t.style.top=`-1000px`,t.style.opacity=`0`,document.body.append(t),t.select();try{return document.execCommand(`copy`)}catch{return!1}finally{t.remove()}}async function U(){let e=await B(N.pickImage,{options:{multiple:!1,directory:!1,title:`Choose an image`,filters:[{name:`Images`,extensions:F}]}});return typeof e==`string`&&e.length>0?j(e.split(/[\\/]/).pop()??e):typeof document>`u`?M(`unsupported`):ne()}function ne(){return new Promise(e=>{let t=document.createElement(`input`);t.type=`file`,t.accept=`image/*`,t.style.display=`none`,document.body.append(t);let n=!1;function r(r){n||(n=!0,window.removeEventListener(`focus`,i),t.remove(),e(r))}function i(){window.setTimeout(()=>{n||t.files&&t.files.length!==0||r(M(`cancelled`))},400)}t.addEventListener(`change`,()=>{let e=t.files?.[0];r(e?j(e.name):M(`cancelled`))},{once:!0}),t.addEventListener(`cancel`,()=>r(M(`cancelled`)),{once:!0}),window.addEventListener(`focus`,i),t.click()})}var W=null;async function G(e){let t=c.safeParse(e);if(!t.success)return M(`failed`);let n=t.data;return await B(N.badge,{count:n})===null?typeof document>`u`?M(`unsupported`):(W??=document.title.replace(I,``),document.title=n===0?W:`(${n}) ${W}`,j(n===0?`title cleared`:`(${n}) title`)):j(n===0?`cleared`:String(n))}var re=[{name:`haptic`,native:`plugin:haptics`,web:`navigator.vibrate`,miss:`unsupported`},{name:`shareText`,native:`—`,web:`navigator.share → copy()`,miss:`cancelled on dismissal`},{name:`copy`,native:`plugin:clipboard-manager`,web:`clipboard → execCommand`,miss:`unsupported`},{name:`pickImage`,native:`plugin:dialog`,web:`<input type=file>`,miss:`cancelled on dismissal`},{name:`setBadge`,native:`plugin:badge`,web:`document.title`,miss:`—`}],ie=D(`span`,null,[` · last `,[`b`,null,` `]]);function ae(t,{a:n,b:i,c:a}){var o=ie(),s=o.firstChild.nextSibling.firstChild;r(s,()=>w(n,()=>i(e(a).name)).read),l(t,o)}function K({a:t,b:n,c:r}){if(w(t,()=>n(e(r).name)))return ae}function q(e,{a:t,b:n,c:r,d:i}){o(A,e,{variant:`secondary`,disabled:n.value===`haptic`,onClick:()=>w(r,()=>i(`haptic`,()=>w(r,()=>V(`medium`)))),children:m((e,t)=>{var n=b(`Vibrate`);l(e,n)})})}function oe(e,{a:t,b:n,c:r,d:i}){o(A,e,{variant:`secondary`,disabled:n.value===`shareText`,onClick:()=>w(r,()=>i(`shareText`,()=>w(r,()=>ee({title:`LuaPlot`,text:`A character worth reading.`,url:`${location.origin}${g(`/discover/characters`)}`})))),children:m((e,t)=>{var n=b(`Share`);l(e,n)})})}function se(e,{a:t,b:n,c:r,d:i}){o(A,e,{variant:`secondary`,disabled:n.value===`copy`,onClick:()=>w(r,()=>i(`copy`,()=>w(r,()=>H(`LuaPlot · the native bridge`)))),children:m((e,t)=>{var n=b(`Copy`);l(e,n)})})}function ce(e,{a:t,b:n,c:r,d:i}){o(A,e,{variant:`secondary`,disabled:n.value===`pickImage`,onClick:()=>w(r,()=>i(`pickImage`,()=>w(r,U))),children:m((e,t)=>{var n=b(`Pick`);l(e,n)})})}function le(e,{a:t,b:n,c:r,d:i}){o(A,e,{variant:`secondary`,disabled:n.value===`setBadge`,onClick:()=>w(r,()=>i(`setBadge`,()=>w(r,()=>G(3)))),children:m((e,t)=>{var n=b(`Badge 3`);l(e,n)})})}function J({a:t,b:n,c:r,d:i}){return e(t).name===`haptic`?q:e(t).name===`shareText`?oe:e(t).name===`copy`?se:e(t).name===`pickImage`?ce:le}var ue=y(`<div class=cap><span class=cap-name> </span><span class=cap-road>shell <code> </code> · web <code> </code></span><span class=cap-action><!>`);function de(e){var t=K({a:e._a,b:e._b,c:e._c});e.a!==t&&f(e._d,e.a=t);var n=J({a:e._c,b:e._e,c:e._a,d:e._f});e.b!==n&&f(e._g,e.b=n)}var fe=D(`p`,[`class`,`empty`],`No calls yet. Every button above answers in place.`),pe=D(`div`,[`class`,`entry`],[[`div`,[`class`,`entry-head`],[[`span`,[`class`,`entry-name`]],[`span`,[`class`,`entry-verdict`],` `]]],[`span`,[`class`,`entry-read`]]]);function me(t){var n=e(t._a),r=n.capability;t.a!==r&&(x(t._b,r,t.a),t.a=r);var i=String(n.result.ok);t.b!==i&&t._c.setAttribute(`data-ok`,t.b=i);var a=n.read;t.c!==a&&(x(t._d,a,t.c),t.c=a)}var Y=D(`div`,[`class`,`log`]);function he(e,t){var n=fe();l(e,n)}function ge(t,n){var i=Y();O(i,()=>n.value,(t,n)=>{var i=pe(),a=i.firstChild,o=a.firstChild,s=o.nextSibling,c=s.firstChild;r(c,()=>e(n).result.ok?`ok`:e(n).result.reason);var u=a.nextSibling;k({a:``,b:void 0,c:``,_a:n,_b:o,_c:s,_d:u}),l(t,i)},4,e=>e.id,void 0,void 0,me),l(t,i)}function X(e){return e.value.length===0?he:ge}var _e=y(`<style>
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
          widths`,1,2);function ve(e){var t=X(e._a);e.a!==t&&f(e._b,e.a=t);var n=w(e._c,()=>g(`/dev/data`));e.b!==n&&h(e._d,`href`,e.b=n);var r=w(e._c,()=>g(`/dev/state`));e.c!==r&&h(e._e,`href`,e.c=r);var i=w(e._c,()=>g(`/dev/primitives`));e.d!==i&&h(e._f,`href`,e.d=i)}var ye=y(`<!>`,1,1);function Z(t,a){let s=w(a,L),c=n([],a),f=n(typeof document>`u`?``:document.title,a),p=n(``,a);function h(e,t){Q+=1,c.value=w(a,()=>[{id:Q,capability:e,result:t,read:be(t)},...c.value].slice(0,6)),f.value=document.title,p.value=``}async function g(e,t){p.value=e,h(e,await w(a,t))}function v(e){return w(a,()=>c.value.find(t=>t.capability===e))}var y=ye(),x=_(y);r(x,()=>m((t,n)=>{var a=_e(),h=_(a).nextSibling.firstChild,y=h.firstChild.nextSibling.nextSibling.nextSibling.firstChild,x=y.firstChild.nextSibling;x.textContent=s?`tauri`:`browser`;var S=y.nextSibling,D=S.firstChild.nextSibling;D.textContent=s?`loaded`:`never requested`;var j=S.nextSibling.firstChild.nextSibling.firstChild;r(j,()=>f.value||`—`);var M=h.nextSibling,N=M.firstChild.nextSibling;O(N,()=>re,(t,a)=>{var o=ue(),s=o.firstChild,c=s.firstChild;r(c,()=>e(a).name);var u=s.nextSibling,f=u.firstChild.nextSibling,m=f.firstChild;r(m,()=>e(a).native);var h=f.nextSibling.nextSibling.firstChild;r(h,()=>e(a).web);var _=E(u,!0),y=i(_,K,2,{a:n,b:v,c:a}),b=u.nextSibling.firstChild,x=i(b,J,2,{a,b:p,c:n,d:g});k({a:d,b:d,_a:n,_b:v,_c:a,_d:y,_e:p,_f:g,_g:x}),l(t,o)},4,e=>e.name,void 0,void 0,de);var P=N.nextSibling.nextSibling,F=E(P);o(A,F,{variant:`secondary`,onClick:()=>w(n,()=>g(`setBadge`,()=>w(n,()=>G(0)))),children:m((e,t)=>{var n=b(`Clear badge`);l(e,n)})});var I=M.nextSibling,L=E(I,!0),R=i(L,X,0,c),z=I.nextSibling.firstChild.nextSibling.firstChild;C(`Click`,z,()=>w(n,()=>T(`/dev/data`)));var B=z.nextSibling.nextSibling;C(`Click`,B,()=>w(n,()=>T(`/dev/state`)));var V=B.nextSibling.nextSibling;C(`Click`,V,()=>w(n,()=>T(`/dev/primitives`))),u(ve,{a:d,b:void 0,c:void 0,d:void 0,_a:c,_b:R,_c:n,_d:z,_e:B,_f:V}),l(t,a)})),l(t,y)}$[t]=Z;function be(e){return e.ok?e.value?`ok · ${e.value}`:`ok`:e.reason===`unsupported`?`unsupported · this browser has no road`:e.reason===`cancelled`?`cancelled · the person said no`:`failed · a road existed and broke`}var Q=0;function $(){return m(Z)}export{$ as DevNative,$ as default};