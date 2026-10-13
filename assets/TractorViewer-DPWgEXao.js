import{c as _,r as o,u as H,D as oe,j as e,g as ne,n as re,o as se}from"./index-BT0eXFSe.js";import{S as ie,U as ae,a as le,M as K,e as ce,u as de,_ as I,B as ue,P as me,V as x,v as fe,C as B,b as he,c as xe,d as ge,T as pe,O as ve,f as J,R as we,g as je}from"./TractorModel-D5_tp4Wm.js";import{T as V}from"./tractor-model-info-BISdUZ-Y.js";/* empty css                      */import{L as be}from"./loader-circle-DSmwZjrJ.js";import{R as ye}from"./rotate-ccw-CsHSIXxm.js";const Ce=[["path",{d:"M15.033 9.44a.647.647 0 0 1 0 1.12l-4.065 2.352a.645.645 0 0 1-.968-.56V7.648a.645.645 0 0 1 .967-.56z",key:"vbtd3f"}],["path",{d:"M12 17v4",key:"1riwvh"}],["path",{d:"M8 21h8",key:"1ev6f3"}],["rect",{x:"2",y:"3",width:"20",height:"14",rx:"2",key:"x3v2xh"}]],Q=_("monitor-play",Ce);const Pe=[["rect",{x:"14",y:"3",width:"5",height:"18",rx:"1",key:"kaeet6"}],["rect",{x:"5",y:"3",width:"5",height:"18",rx:"1",key:"1wsw3u"}]],ze=_("pause",Pe);const Se=[["path",{d:"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",key:"10ikf1"}]],ke=_("play",Se);function Me(r,a,s,u){var m;return m=class extends ie{constructor(i){super({vertexShader:a,fragmentShader:s,...i});for(const n in r)this.uniforms[n]=new ae(r[n]),Object.defineProperty(this,n,{get(){return this.uniforms[n].value},set(g){this.uniforms[n].value=g}});this.uniforms=le.clone(this.uniforms)}},m.key=K.generateUUID(),m}const Re=Me({cellSize:.5,sectionSize:1,fadeDistance:100,fadeStrength:1,fadeFrom:1,cellThickness:.5,sectionThickness:1,cellColor:new B,sectionColor:new B,infiniteGrid:!1,followCamera:!1,worldCamProjPosition:new x,worldPlanePosition:new x},`
    varying vec3 localPosition;
    varying vec4 worldPosition;

    uniform vec3 worldCamProjPosition;
    uniform vec3 worldPlanePosition;
    uniform float fadeDistance;
    uniform bool infiniteGrid;
    uniform bool followCamera;

    void main() {
      localPosition = position.xzy;
      if (infiniteGrid) localPosition *= 1.0 + fadeDistance;
      
      worldPosition = modelMatrix * vec4(localPosition, 1.0);
      if (followCamera) {
        worldPosition.xyz += (worldCamProjPosition - worldPlanePosition);
        localPosition = (inverse(modelMatrix) * worldPosition).xyz;
      }

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,`
    varying vec3 localPosition;
    varying vec4 worldPosition;

    uniform vec3 worldCamProjPosition;
    uniform float cellSize;
    uniform float sectionSize;
    uniform vec3 cellColor;
    uniform vec3 sectionColor;
    uniform float fadeDistance;
    uniform float fadeStrength;
    uniform float fadeFrom;
    uniform float cellThickness;
    uniform float sectionThickness;

    float getGrid(float size, float thickness) {
      vec2 r = localPosition.xz / size;
      vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
      float line = min(grid.x, grid.y) + 1.0 - thickness;
      return 1.0 - min(line, 1.0);
    }

    void main() {
      float g1 = getGrid(cellSize, cellThickness);
      float g2 = getGrid(sectionSize, sectionThickness);

      vec3 from = worldCamProjPosition*vec3(fadeFrom);
      float dist = distance(from, worldPosition.xyz);
      float d = 1.0 - min(dist / fadeDistance, 1.0);
      vec3 color = mix(cellColor, sectionColor, min(1.0, sectionThickness * g2));

      gl_FragColor = vec4(color, (g1 + g2) * pow(d, fadeStrength));
      gl_FragColor.a = mix(0.75 * gl_FragColor.a, gl_FragColor.a, g2);
      if (gl_FragColor.a <= 0.0) discard;

      #include <tonemapping_fragment>
      #include <${fe>=154?"colorspace_fragment":"encodings_fragment"}>
    }
  `),Ne=o.forwardRef(({args:r,cellColor:a="#000000",sectionColor:s="#2080ff",cellSize:u=.5,sectionSize:m=1,followCamera:i=!1,infiniteGrid:n=!1,fadeDistance:g=100,fadeStrength:l=1,fadeFrom:z=1,cellThickness:S=.5,sectionThickness:b=1,side:y=ue,...k},C)=>{ce({GridMaterial:Re});const c=o.useRef(null);o.useImperativeHandle(C,()=>c.current,[]);const d=new me,p=new x(0,1,0),v=new x(0,0,0);de(R=>{d.setFromNormalAndCoplanarPoint(p,v).applyMatrix4(c.current.matrixWorld);const P=c.current.material,h=P.uniforms.worldCamProjPosition,N=P.uniforms.worldPlanePosition;d.projectPoint(R.camera.position,h.value),N.value.set(0,0,0).applyMatrix4(c.current.matrixWorld)});const M={cellSize:u,sectionSize:m,cellColor:a,sectionColor:s,cellThickness:S,sectionThickness:b},w={fadeDistance:g,fadeStrength:l,fadeFrom:z,infiniteGrid:n,followCamera:i};return o.createElement("mesh",I({ref:c,frustumCulled:!1},k),o.createElement("gridMaterial",I({transparent:!0,"extensions-derivatives":!0,side:y},M,w)),o.createElement("planeGeometry",{args:r}))}),Ee={position:[6.5,4,6.5],fov:40},U=.8,Te={antialias:!0,alpha:!0},_e=[1,1.5],W={dark:{fog:"#18232e",cell:"#344654",section:"#657c8b"},light:{fog:"#eef3ef",cell:"#d9e3dc",section:"#c3d2c7"}};function $({error:r}){const a=H(),s=r instanceof Error?r.message:String(r);return e.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent text-muted-foreground",children:[e.jsx(Q,{className:"size-12 opacity-50"}),e.jsx("div",{className:"text-sm",children:a==="zh"?"3D 模型加载失败":"Unable to load the 3D model"}),e.jsx("div",{className:"max-w-[80%] truncate text-xs opacity-60",children:s.slice(0,60)})]})}function De(){return e.jsxs("mesh",{children:[e.jsx("sphereGeometry",{args:[.001,8,8]}),e.jsx("meshBasicMaterial",{visible:!1})]})}function Fe(){const{scene:r,gl:a,invalidate:s}=J();return o.useEffect(()=>{const u=new je(a),m=new we,i=u.fromScene(m,.04);return r.environment=i.texture,s(),()=>{r.environment=null,i.dispose(),m.dispose(),u.dispose()}},[r,a,s]),null}const q=[{id:"isometric",zh:"总览",en:"Overview",direction:[-1,.62,1]},{id:"front",zh:"正面",en:"Front",direction:[-1,.12,0]},{id:"side",zh:"侧面",en:"Side",direction:[0,.12,1]},{id:"top",zh:"俯视",en:"Top",direction:[.01,1,.01]}];function Le({modelRef:r,fit:a}){const s=J(u=>u.size);return o.useEffect(()=>{r.current&&a(r.current)},[s.width,s.height,r,a]),null}function We({component:r="all",exploded:a=!1,modelUrl:s=V,controls:u=!1}){const m=o.useId(),i=H(),[n,g]=o.useState("isometric"),[l,z]=o.useState(()=>u&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches),[S]=o.useState(()=>{try{const t=document.createElement("canvas").getContext("webgl2");return t?.getExtension("WEBGL_lose_context")?.loseContext(),!!t}catch{return!1}}),[b,y]=o.useState(null),[k,C]=o.useState(!1),c=o.useRef(null),d=o.useRef(null),p=o.useRef(null),v=o.useRef(null);o.useEffect(()=>{C(!1),y(null)},[s]);const M=oe()==="dark",w=o.useCallback(t=>{c.current&&(c.current.autoRotate=t)},[]),R=o.useCallback(()=>{d.current&&window.clearTimeout(d.current),d.current=window.setTimeout(()=>{w(l&&n==="isometric")},3e3)},[w,l,n]),P=o.useCallback(()=>{d.current&&(window.clearTimeout(d.current),d.current=null),w(!1)},[w]),h=o.useCallback(t=>{const f=c.current;if(!f)return;const D=new he().setFromObject(t),j=D.getSize(new x),T=D.getCenter(new x),F=Math.max(j.x,j.y,j.z)||1,L=new x(T.x,T.y+j.y*.05,T.z);f.target.copy(L);const G=f.object,O=K.degToRad(G.fov),Y=2*Math.atan(Math.tan(O/2)*G.aspect),A=j.length()/2/Math.sin(Math.min(O,Y)/2)*1.13,Z=new x(...q.find(te=>te.id===n).direction).normalize(),ee=L.clone().add(Z.multiplyScalar(A));f.object.position.copy(ee),f.minDistance=F*.6,f.maxDistance=Math.max(F*4,A*1.8),f.update()},[n]);o.useEffect(()=>()=>{d.current&&window.clearTimeout(d.current)},[l,n]);const N=o.useCallback(t=>{c.current=t,t&&(t.autoRotate=l&&n==="isometric",t.autoRotateSpeed=U,p.current&&(h(p.current),p.current=null))},[h,l,n]),X=o.useCallback(t=>{C(!0),v.current=t,c.current?h(t):p.current=t},[h]);if(!S)return e.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent text-muted-foreground",children:[e.jsx(Q,{className:"size-16 opacity-40"}),e.jsx("div",{className:"text-sm font-medium",children:"3D 模型预览"}),e.jsx("div",{className:"text-xs opacity-60",children:"当前浏览器环境不支持 WebGL"}),e.jsx("div",{className:"text-xs opacity-60",children:"支持的设备上可查看可交互 3D 拖拉机模型"})]});if(b)return e.jsx($,{error:b});const E=M?W.dark:W.light;return e.jsxs("div",{className:"relative h-full w-full",children:[e.jsx(xe,{resetKeys:[s],FallbackComponent:$,onError:t=>{const f=t instanceof Error?t.message:String(t);y(f)},children:e.jsxs(ge,{frameloop:l&&n==="isometric"?"always":"demand",shadows:!0,camera:Ee,gl:Te,dpr:_e,children:[e.jsx("fog",{attach:"fog",args:[E.fog,8,20]}),e.jsx(Fe,{}),e.jsx("ambientLight",{intensity:.5}),e.jsx("hemisphereLight",{args:["#FFF8E7","#C8B89A",.6]}),e.jsx("directionalLight",{position:[5,8,5],intensity:1.2,castShadow:!0,"shadow-mapSize":[1024,1024]}),e.jsx("directionalLight",{position:[-3,4,-3],intensity:.3,color:"#E8D5B7"}),e.jsx(Ne,{args:[20,20],cellSize:1,cellThickness:.5,cellColor:E.cell,sectionSize:5,sectionThickness:1,sectionColor:E.section,fadeDistance:15,fadeStrength:1,position:[0,-.4,0]}),e.jsxs("mesh",{rotation:[-Math.PI/2,0,0],position:[0,-.401,0],receiveShadow:!0,children:[e.jsx("planeGeometry",{args:[20,20]}),e.jsx("shadowMaterial",{transparent:!0,opacity:.25})]}),e.jsxs(o.Suspense,{fallback:e.jsx(De,{}),children:[e.jsx(pe,{onLoaded:X,component:r,exploded:a,modelUrl:s}),e.jsx(Le,{modelRef:v,fit:h})]}),e.jsx(ve,{ref:N,enableDamping:l&&n==="isometric",dampingFactor:.05,minDistance:2,maxDistance:18,maxPolarAngle:Math.PI/2.2,minPolarAngle:.03,autoRotateSpeed:U,onStart:P,onEnd:R})]})}),!k&&e.jsx("div",{className:"pointer-events-none absolute inset-0 flex items-center justify-center",children:e.jsxs("div",{className:"flex items-center gap-2 rounded-full bg-card/80 px-4 py-2 text-xs text-muted-foreground backdrop-blur-sm shadow-sm",children:[e.jsx(be,{className:"size-4 animate-spin"}),i==="zh"?"模型加载中…":"Loading model…"]})}),e.jsx("div",{className:"absolute left-3 top-3 rounded-full border border-border/50 bg-card/85 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur",children:s===V?i==="zh"?"原创结构示意 · 非实机 CAD":"Original schematic · Not machine CAD":i==="zh"?"本地模型 · 尺寸待核验":"Local model · Dimensions unverified"}),u&&e.jsx("div",{className:"model-control-shell",role:"group","aria-label":i==="zh"?"模型视角与旋转控制":"Model view and rotation controls",children:e.jsxs(ne,{variant:"regular",lens:!0,displacementScale:36,className:"model-control-glass",contentClassName:"model-control-content",children:[e.jsx("button",{type:"button",onClick:()=>z(t=>!t),"aria-label":i==="zh"?l?"暂停自转":"开启自转":l?"Pause rotation":"Start rotation","aria-pressed":l,className:"model-icon-button",children:l?e.jsx(ze,{size:16}):e.jsx(ke,{size:16})}),e.jsx(re,{id:m,children:e.jsx("div",{className:"model-view-segment",role:"group","aria-label":i==="zh"?"选择模型视角":"Select model view",children:q.map(t=>e.jsxs("button",{type:"button","aria-pressed":n===t.id,onClick:()=>g(t.id),className:"model-view-button",children:[n===t.id&&e.jsx(se,{className:"model-view-indicator"}),e.jsx("span",{className:"model-view-label",children:i==="zh"?t.zh:t.en})]},t.id))})}),e.jsx("button",{type:"button","aria-label":i==="zh"?"恢复模型视角":"Reset model view",onClick:()=>{g("isometric"),v.current&&h(v.current)},className:"model-icon-button",children:e.jsx(ye,{size:16})})]})}),e.jsx("div",{className:"pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground/70",children:i==="zh"?"拖动旋转 · 滚轮缩放":"Drag to rotate · Scroll to zoom"})]})}export{We as default};
