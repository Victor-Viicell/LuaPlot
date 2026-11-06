import{Dn as e,H as t,Hn as n,Kn as r,Kt as i,Ln as a,Ot as o,Tn as s,Un as c,Ut as l,Wt as u,Xn as d,Yn as f,Zn as p,a as m,bn as h,br as g,cn as _,d as v,k as y,nr as b,nt as x,q as S,qn as C,r as w,rr as T,tn as E,vr as D}from"./router-Bt8ay14R.js";import{H as O,U as k}from"./index-jDGmfbH_.js";import{t as A}from"./Button-DeA9gI4m.js";function j(e){return x.parse(e===void 0?{ok:!0}:{ok:!0,value:e})}function M(e){return x.parse({ok:!1,reason:e})}var N={haptic:`plugin:haptics|vibrate`,clipboardWrite:`plugin:clipboard-manager|write_text`,badge:`plugin:badge|set`,pickImage:`plugin:dialog|open`},P={light:[8],medium:[16],heavy:[28],success:[10,60,16],warning:[20,70,20],error:[30,60,30]},F=[`png`,`jpg`,`jpeg`,`webp`,`gif`,`avif`],I=/^\(\d+\)\s+/;function L(){return typeof window<`u`&&`__TAURI_INTERNALS__`in window}var R=null;function z(){return L()?(R??=v(()=>import(`./core-CwBWH9_g.js`),[]).catch(()=>null),R):Promise.resolve(null)}async function B(e,t){let n=await z();if(!n)return null;try{return await n.invoke(e,t)}catch{return null}}async function V(e=`light`){let t=S.safeParse(e);if(!t.success)return M(`failed`);let n=t.data;if(await B(N.haptic,{kind:n})!==null)return j(n);if(typeof(typeof navigator>`u`?void 0:navigator.vibrate)!=`function`)return M(`unsupported`);try{return navigator.vibrate(P[n])?j(n):M(`unsupported`)}catch{return M(`failed`)}}async function ee(e){let t=o.safeParse(e);if(!t.success)return M(`failed`);let n=t.data;if(typeof navigator<`u`&&typeof navigator.share==`function`)try{return await navigator.share(n),j(`shared`)}catch(e){if(e instanceof DOMException&&e.name===`AbortError`)return M(`cancelled`)}let r=await H([n.text,n.url].filter(Boolean).join(` `)||n.title||``);return r.ok?j(`copied`):M(r.reason)}async function H(e){let n=t.safeParse(e);if(!n.success)return M(`failed`);let r=n.data;if(await B(N.clipboardWrite,{text:r})!==null)return j(r);if(typeof navigator<`u`&&typeof navigator.clipboard?.writeText==`function`)try{return await navigator.clipboard.writeText(r),j(r)}catch{}return te(r)?j(r):M(`unsupported`)}function te(e){if(typeof document>`u`||typeof document.execCommand!=`function`)return!1;let t=document.createElement(`textarea`);t.value=e,t.setAttribute(`readonly`,``),t.style.position=`fixed`,t.style.top=`-1000px`,t.style.opacity=`0`,document.body.append(t),t.select();try{return document.execCommand(`copy`)}catch{return!1}finally{t.remove()}}async function U(){let e=await B(N.pickImage,{options:{multiple:!1,directory:!1,title:`Choose an image`,filters:[{name:`Images`,extensions:F}]}});return typeof e==`string`&&e.length>0?j(e.split(/[\\/]/).pop()??e):typeof document>`u`?M(`unsupported`):ne()}function ne(){return new Promise(e=>{let t=document.createElement(`input`);t.type=`file`,t.accept=`image/*`,t.style.display=`none`,document.body.append(t);let n=!1;function r(r){n||(n=!0,window.removeEventListener(`focus`,i),t.remove(),e(r))}function i(){window.setTimeout(()=>{n||t.files&&t.files.length!==0||r(M(`cancelled`))},400)}t.addEventListener(`change`,()=>{let e=t.files?.[0];r(e?j(e.name):M(`cancelled`))},{once:!0}),t.addEventListener(`cancel`,()=>r(M(`cancelled`)),{once:!0}),window.addEventListener(`focus`,i),t.click()})}var W=null;async function G(e){let t=y.safeParse(e);if(!t.success)return M(`failed`);let n=t.data;return await B(N.badge,{count:n})===null?typeof document>`u`?M(`unsupported`):(W??=document.title.replace(I,``),document.title=n===0?W:`(${n}) ${W}`,j(n===0?`title cleared`:`(${n}) title`)):j(n===0?`cleared`:String(n))}var re=[{name:`haptic`,native:`plugin:haptics`,web:`navigator.vibrate`,miss:`unsupported`},{name:`shareText`,native:`—`,web:`navigator.share → copy()`,miss:`cancelled on dismissal`},{name:`copy`,native:`plugin:clipboard-manager`,web:`clipboard → execCommand`,miss:`unsupported`},{name:`pickImage`,native:`plugin:dialog`,web:`<input type=file>`,miss:`cancelled on dismissal`},{name:`setBadge`,native:`plugin:badge`,web:`document.title`,miss:`—`}],ie=d(`span`,null,[` · last `,[`b`,null,` `]]);function ae(e,{a:t,b:r,c:i}){var a=ie(),o=a.firstChild.nextSibling.firstChild;c(o,()=>n(t,()=>r(s(i).name)).read),C(e,a)}function K({a:e,b:t,c:r}){if(n(e,()=>t(s(r).name)))return ae}function q(t,{a:i,b:a,c:o,d:s}){e(A,t,{variant:`secondary`,disabled:a.value===`haptic`,onClick:()=>n(o,()=>s(`haptic`,()=>n(o,()=>V(`medium`)))),children:r((e,t)=>{var n=p(`Vibrate`);C(e,n)})})}function oe(t,{a:i,b:a,c:o,d:s}){e(A,t,{variant:`secondary`,disabled:a.value===`shareText`,onClick:()=>n(o,()=>s(`shareText`,()=>n(o,()=>ee({title:`LuaPlot`,text:`A character worth reading.`,url:`${location.origin}${m(`/discover/characters`)}`})))),children:r((e,t)=>{var n=p(`Share`);C(e,n)})})}function se(t,{a:i,b:a,c:o,d:s}){e(A,t,{variant:`secondary`,disabled:a.value===`copy`,onClick:()=>n(o,()=>s(`copy`,()=>n(o,()=>H(`LuaPlot · the native bridge`)))),children:r((e,t)=>{var n=p(`Copy`);C(e,n)})})}function ce(t,{a:i,b:a,c:o,d:s}){e(A,t,{variant:`secondary`,disabled:a.value===`pickImage`,onClick:()=>n(o,()=>s(`pickImage`,()=>n(o,U))),children:r((e,t)=>{var n=p(`Pick`);C(e,n)})})}function le(t,{a:i,b:a,c:o,d:s}){e(A,t,{variant:`secondary`,disabled:a.value===`setBadge`,onClick:()=>n(o,()=>s(`setBadge`,()=>n(o,()=>G(3)))),children:r((e,t)=>{var n=p(`Badge 3`);C(e,n)})})}function J({a:e,b:t,c:n,d:r}){return s(e).name===`haptic`?q:s(e).name===`shareText`?oe:s(e).name===`copy`?se:s(e).name===`pickImage`?ce:le}var ue=f(`<div class=cap><span class=cap-name> </span><span class=cap-road>shell <code> </code> · web <code> </code></span><span class=cap-action><!>`);function de(e){var t=K({a:e._a,b:e._b,c:e._c});e.a!==t&&u(e._d,e.a=t);var n=J({a:e._c,b:e._e,c:e._a,d:e._f});e.b!==n&&u(e._g,e.b=n)}var fe=d(`p`,[`class`,`empty`],`No calls yet. Every button above answers in place.`),pe=d(`div`,[`class`,`entry`],[[`div`,[`class`,`entry-head`],[[`span`,[`class`,`entry-name`]],[`span`,[`class`,`entry-verdict`],` `]]],[`span`,[`class`,`entry-read`]]]);function me(e){var t=s(e._a),n=t.capability;e.a!==n&&(E(e._b,n,e.a),e.a=n);var r=String(t.result.ok);e.b!==r&&e._c.setAttribute(`data-ok`,e.b=r);var i=t.read;e.c!==i&&(E(e._d,i,e.c),e.c=i)}var he=d(`div`,[`class`,`log`]);function ge(e,t){var n=fe();C(e,n)}function _e(e,t){var n=he();O(n,()=>t.value,(e,t)=>{var n=pe(),r=n.firstChild,i=r.firstChild,a=i.nextSibling,o=a.firstChild;c(o,()=>s(t).result.ok?`ok`:s(t).result.reason);var l=r.nextSibling;k({a:``,b:void 0,c:``,_a:t,_b:i,_c:a,_d:l}),C(e,n)},4,e=>e.id,void 0,void 0,me),C(e,n)}function Y(e){return e.value.length===0?ge:_e}var ve=f(`<style>
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
          widths`,1,2);function X(e){var t=Y(e._a);e.a!==t&&u(e._b,e.a=t);var r=n(e._c,()=>m(`/dev/data`));e.b!==r&&i(e._d,`href`,e.b=r);var a=n(e._c,()=>m(`/dev/state`));e.c!==a&&i(e._e,`href`,e.c=a);var o=n(e._c,()=>m(`/dev/primitives`));e.d!==o&&i(e._f,`href`,e.d=o)}var ye=f(`<!>`,1,1);function Z(t,i){let o=n(i,L),u=a([],i),d=a(typeof document>`u`?``:document.title,i),f=a(``,i);function m(e,t){Q+=1,u.value=n(i,()=>[{id:Q,capability:e,result:t,read:be(t)},...u.value].slice(0,6)),d.value=document.title,f.value=``}async function v(e,t){f.value=e,m(e,await n(i,t))}function y(e){return n(i,()=>u.value.find(t=>t.capability===e))}var x=ye(),S=T(x);c(S,()=>r((t,i)=>{var a=ve(),m=T(a).nextSibling.firstChild,x=m.firstChild.nextSibling.nextSibling.nextSibling.firstChild,S=x.firstChild.nextSibling;S.textContent=o?`tauri`:`browser`;var E=x.nextSibling,D=E.firstChild.nextSibling;D.textContent=o?`loaded`:`never requested`;var j=E.nextSibling.firstChild.nextSibling.firstChild;c(j,()=>d.value||`—`);var M=m.nextSibling,N=M.firstChild.nextSibling;O(N,()=>re,(e,t)=>{var n=ue(),r=n.firstChild,a=r.firstChild;c(a,()=>s(t).name);var o=r.nextSibling,u=o.firstChild.nextSibling,d=u.firstChild;c(d,()=>s(t).native);var p=u.nextSibling.nextSibling.firstChild;c(p,()=>s(t).web);var m=b(o,!0),h=l(m,K,2,{a:i,b:y,c:t}),_=o.nextSibling.firstChild,x=l(_,J,2,{a:t,b:f,c:i,d:v});k({a:g,b:g,_a:i,_b:y,_c:t,_d:h,_e:f,_f:v,_g:x}),C(e,n)},4,e=>e.name,void 0,void 0,de);var P=N.nextSibling.nextSibling,F=b(P);e(A,F,{variant:`secondary`,onClick:()=>n(i,()=>v(`setBadge`,()=>n(i,()=>G(0)))),children:r((e,t)=>{var n=p(`Clear badge`);C(e,n)})});var I=M.nextSibling,L=b(I,!0),R=l(L,Y,0,u),z=I.nextSibling.firstChild.nextSibling.firstChild;_(`Click`,z,()=>n(i,()=>w(`/dev/data`)));var B=z.nextSibling.nextSibling;_(`Click`,B,()=>n(i,()=>w(`/dev/state`)));var V=B.nextSibling.nextSibling;_(`Click`,V,()=>n(i,()=>w(`/dev/primitives`))),h(X,{a:g,b:void 0,c:void 0,d:void 0,_a:u,_b:R,_c:i,_d:z,_e:B,_f:V}),C(t,a)})),C(t,x)}$[D]=Z;function be(e){return e.ok?e.value?`ok · ${e.value}`:`ok`:e.reason===`unsupported`?`unsupported · this browser has no road`:e.reason===`cancelled`?`cancelled · the person said no`:`failed · a road existed and broke`}var Q=0;function $(){return r(Z)}export{$ as DevNative,$ as default};