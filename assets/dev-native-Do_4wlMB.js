import{En as e,H as t,Jn as n,Kt as r,On as i,Ot as a,Qn as o,Rn as s,Un as c,Ut as l,Wn as u,Wt as d,Xn as f,Zn as p,a as m,d as h,ir as g,k as _,ln as v,nn as y,nt as b,q as x,qn as S,r as C,rr as w,xn as ee,xr as T,yr as E}from"./router-CIx1iJKz.js";import{H as D,U as O}from"./index-90I33-RV.js";import{t as k}from"./Button-CJqwby9r.js";function A(e){return b.parse(e===void 0?{ok:!0}:{ok:!0,value:e})}function j(e){return b.parse({ok:!1,reason:e})}var M={haptic:`plugin:haptics|vibrate`,clipboardWrite:`plugin:clipboard-manager|write_text`,badge:`plugin:badge|set`,pickImage:`plugin:dialog|open`},N={light:[8],medium:[16],heavy:[28],success:[10,60,16],warning:[20,70,20],error:[30,60,30]},P=[`png`,`jpg`,`jpeg`,`webp`,`gif`,`avif`],F=/^\(\d+\)\s+/;function I(){return typeof window<`u`&&`__TAURI_INTERNALS__`in window}var L=null;function R(){return I()?(L??=h(()=>import(`./core-CwBWH9_g.js`),[]).catch(()=>null),L):Promise.resolve(null)}async function z(e,t){let n=await R();if(!n)return null;try{return await n.invoke(e,t)}catch{return null}}async function B(e=`light`){let t=x.safeParse(e);if(!t.success)return j(`failed`);let n=t.data;if(await z(M.haptic,{kind:n})!==null)return A(n);if(typeof(typeof navigator>`u`?void 0:navigator.vibrate)!=`function`)return j(`unsupported`);try{return navigator.vibrate(N[n])?A(n):j(`unsupported`)}catch{return j(`failed`)}}async function te(e){let t=a.safeParse(e);if(!t.success)return j(`failed`);let n=t.data;if(typeof navigator<`u`&&typeof navigator.share==`function`)try{return await navigator.share(n),A(`shared`)}catch(e){if(e instanceof DOMException&&e.name===`AbortError`)return j(`cancelled`)}let r=await V([n.text,n.url].filter(Boolean).join(` `)||n.title||``);return r.ok?A(`copied`):j(r.reason)}async function V(e){let n=t.safeParse(e);if(!n.success)return j(`failed`);let r=n.data;if(await z(M.clipboardWrite,{text:r})!==null)return A(r);if(typeof navigator<`u`&&typeof navigator.clipboard?.writeText==`function`)try{return await navigator.clipboard.writeText(r),A(r)}catch{}return H(r)?A(r):j(`unsupported`)}function H(e){if(typeof document>`u`||typeof document.execCommand!=`function`)return!1;let t=document.createElement(`textarea`);t.value=e,t.setAttribute(`readonly`,``),t.style.position=`fixed`,t.style.top=`-1000px`,t.style.opacity=`0`,document.body.append(t),t.select();try{return document.execCommand(`copy`)}catch{return!1}finally{t.remove()}}async function ne(){let e=await z(M.pickImage,{options:{multiple:!1,directory:!1,title:`Choose an image`,filters:[{name:`Images`,extensions:P}]}});return typeof e==`string`&&e.length>0?A(e.split(/[\\/]/).pop()??e):typeof document>`u`?j(`unsupported`):re()}function re(){return new Promise(e=>{let t=document.createElement(`input`);t.type=`file`,t.accept=`image/*`,t.style.display=`none`,document.body.append(t);let n=!1;function r(r){n||(n=!0,window.removeEventListener(`focus`,i),t.remove(),e(r))}function i(){window.setTimeout(()=>{n||t.files&&t.files.length!==0||r(j(`cancelled`))},400)}t.addEventListener(`change`,()=>{let e=t.files?.[0];r(e?A(e.name):j(`cancelled`))},{once:!0}),t.addEventListener(`cancel`,()=>r(j(`cancelled`)),{once:!0}),window.addEventListener(`focus`,i),t.click()})}var U=null;async function W(e){let t=_.safeParse(e);if(!t.success)return j(`failed`);let n=t.data;return await z(M.badge,{count:n})===null?typeof document>`u`?j(`unsupported`):(U??=document.title.replace(F,``),document.title=n===0?U:`(${n}) ${U}`,A(n===0?`title cleared`:`(${n}) title`)):A(n===0?`cleared`:String(n))}var ie=[{name:`haptic`,native:`plugin:haptics`,web:`navigator.vibrate`,miss:`unsupported`},{name:`shareText`,native:`—`,web:`navigator.share → copy()`,miss:`cancelled on dismissal`},{name:`copy`,native:`plugin:clipboard-manager`,web:`clipboard → execCommand`,miss:`unsupported`},{name:`pickImage`,native:`plugin:dialog`,web:`<input type=file>`,miss:`cancelled on dismissal`},{name:`setBadge`,native:`plugin:badge`,web:`document.title`,miss:`—`}],ae=p(`span`,null,[` · last `,[`b`,null,` `]]);function G(t,{a:r,b:i,c:a}){var o=ae(),s=o.firstChild.nextSibling.firstChild;u(s,()=>c(r,()=>i(e(a).name)).read),n(t,o)}function K({a:t,b:n,c:r}){if(c(t,()=>n(e(r).name)))return G}function q(e,{a:t,b:r,c:a,d:s}){i(k,e,{variant:`secondary`,disabled:r.value===`haptic`,onClick:()=>c(a,()=>s(`haptic`,()=>c(a,()=>B(`medium`)))),children:S((e,t)=>{var r=o(`Vibrate`);n(e,r)})})}function oe(e,{a:t,b:r,c:a,d:s}){i(k,e,{variant:`secondary`,disabled:r.value===`shareText`,onClick:()=>c(a,()=>s(`shareText`,()=>c(a,()=>te({title:`LuaPlot`,text:`A character worth reading.`,url:`${location.origin}${m(`/discover/characters`)}`})))),children:S((e,t)=>{var r=o(`Share`);n(e,r)})})}function se(e,{a:t,b:r,c:a,d:s}){i(k,e,{variant:`secondary`,disabled:r.value===`copy`,onClick:()=>c(a,()=>s(`copy`,()=>c(a,()=>V(`LuaPlot · the native bridge`)))),children:S((e,t)=>{var r=o(`Copy`);n(e,r)})})}function ce(e,{a:t,b:r,c:a,d:s}){i(k,e,{variant:`secondary`,disabled:r.value===`pickImage`,onClick:()=>c(a,()=>s(`pickImage`,()=>c(a,ne))),children:S((e,t)=>{var r=o(`Pick`);n(e,r)})})}function le(e,{a:t,b:r,c:a,d:s}){i(k,e,{variant:`secondary`,disabled:r.value===`setBadge`,onClick:()=>c(a,()=>s(`setBadge`,()=>c(a,()=>W(3)))),children:S((e,t)=>{var r=o(`Badge 3`);n(e,r)})})}function J({a:t,b:n,c:r,d:i}){return e(t).name===`haptic`?q:e(t).name===`shareText`?oe:e(t).name===`copy`?se:e(t).name===`pickImage`?ce:le}var ue=f(`<div class=cap><span class=cap-name> </span><span class=cap-road>shell <code> </code> · web <code> </code></span><span class=cap-action><!>`);function de(e){var t=K({a:e._a,b:e._b,c:e._c});e.a!==t&&d(e._d,e.a=t);var n=J({a:e._c,b:e._e,c:e._a,d:e._f});e.b!==n&&d(e._g,e.b=n)}var fe=p(`p`,[`class`,`empty`],`No calls yet. Every button above answers in place.`),pe=p(`div`,[`class`,`entry`],[[`div`,[`class`,`entry-head`],[[`span`,[`class`,`entry-name`]],[`span`,[`class`,`entry-verdict`],` `]]],[`span`,[`class`,`entry-read`]]]);function me(t){var n=e(t._a),r=n.capability;t.a!==r&&(y(t._b,r,t.a),t.a=r);var i=String(n.result.ok);t.b!==i&&t._c.setAttribute(`data-ok`,t.b=i);var a=n.read;t.c!==a&&(y(t._d,a,t.c),t.c=a)}var he=p(`div`,[`class`,`log`]);function ge(e,t){var r=fe();n(e,r)}function _e(t,r){var i=he();D(i,()=>r.value,(t,r)=>{var i=pe(),a=i.firstChild,o=a.firstChild,s=o.nextSibling,c=s.firstChild;u(c,()=>e(r).result.ok?`ok`:e(r).result.reason);var l=a.nextSibling;O({a:``,b:void 0,c:``,_a:r,_b:o,_c:s,_d:l}),n(t,i)},4,e=>e.id,void 0,void 0,me),n(t,i)}function Y(e){return e.value.length===0?ge:_e}var ve=f(`<style>
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
          widths`,1,2);function X(e){var t=Y(e._a);e.a!==t&&d(e._b,e.a=t);var n=c(e._c,()=>m(`/dev/data`));e.b!==n&&r(e._d,`href`,e.b=n);var i=c(e._c,()=>m(`/dev/state`));e.c!==i&&r(e._e,`href`,e.c=i);var a=c(e._c,()=>m(`/dev/primitives`));e.d!==a&&r(e._f,`href`,e.d=a)}var ye=f(`<!>`,1,1);function Z(t,r){let a=c(r,I),d=s([],r),f=s(typeof document>`u`?``:document.title,r),p=s(``,r);function m(e,t){Q+=1,d.value=c(r,()=>[{id:Q,capability:e,result:t,read:be(t)},...d.value].slice(0,6)),f.value=document.title,p.value=``}async function h(e,t){p.value=e,m(e,await c(r,t))}function _(e){return c(r,()=>d.value.find(t=>t.capability===e))}var y=ye(),b=g(y);u(b,()=>S((t,r)=>{var s=ve(),m=g(s).nextSibling.firstChild,y=m.firstChild.nextSibling.nextSibling.nextSibling.firstChild,b=y.firstChild.nextSibling;b.textContent=a?`tauri`:`browser`;var x=y.nextSibling,E=x.firstChild.nextSibling;E.textContent=a?`loaded`:`never requested`;var A=x.nextSibling.firstChild.nextSibling.firstChild;u(A,()=>f.value||`—`);var j=m.nextSibling,M=j.firstChild.nextSibling;D(M,()=>ie,(t,i)=>{var a=ue(),o=a.firstChild,s=o.firstChild;u(s,()=>e(i).name);var c=o.nextSibling,d=c.firstChild.nextSibling,f=d.firstChild;u(f,()=>e(i).native);var m=d.nextSibling.nextSibling.firstChild;u(m,()=>e(i).web);var g=w(c,!0),v=l(g,K,2,{a:r,b:_,c:i}),y=c.nextSibling.firstChild,b=l(y,J,2,{a:i,b:p,c:r,d:h});O({a:T,b:T,_a:r,_b:_,_c:i,_d:v,_e:p,_f:h,_g:b}),n(t,a)},4,e=>e.name,void 0,void 0,de);var N=M.nextSibling.nextSibling,P=w(N);i(k,P,{variant:`secondary`,onClick:()=>c(r,()=>h(`setBadge`,()=>c(r,()=>W(0)))),children:S((e,t)=>{var r=o(`Clear badge`);n(e,r)})});var F=j.nextSibling,I=w(F,!0),L=l(I,Y,0,d),R=F.nextSibling.firstChild.nextSibling.firstChild;v(`Click`,R,()=>c(r,()=>C(`/dev/data`)));var z=R.nextSibling.nextSibling;v(`Click`,z,()=>c(r,()=>C(`/dev/state`)));var B=z.nextSibling.nextSibling;v(`Click`,B,()=>c(r,()=>C(`/dev/primitives`))),ee(X,{a:T,b:void 0,c:void 0,d:void 0,_a:d,_b:L,_c:r,_d:R,_e:z,_f:B}),n(t,s)})),n(t,y)}$[E]=Z;function be(e){return e.ok?e.value?`ok · ${e.value}`:`ok`:e.reason===`unsupported`?`unsupported · this browser has no road`:e.reason===`cancelled`?`cancelled · the person said no`:`failed · a road existed and broke`}var Q=0;function $(){return S(Z)}export{$ as DevNative,$ as default};