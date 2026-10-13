import{r as o,D as Ie,u as xe,j as t}from"./index-C76U9twl.js";import{f as Q,u as ve,V as O,_ as ce,D as Ae,h as re,i as ge,j as Re,S as Oe,N as Le,U as W,v as Ne,W as me,H as Be,L as le,k as $e,l as He,m as Ge,n as ye,o as Ve,p as Ze,e as qe,P as Xe,q as be,r as _e,s as Ke,t as Ye,w as Je,x as Qe,y as et,c as tt,d as rt,z as st,T as ot,O as nt,R as it,g as at}from"./TractorModel-C8ZIOB7E.js";import{i as de,p as lt,W as fe,s as ct,a as ut,n as ht}from"./ExhibitionPage-DcSZHh2K.js";import{L as dt}from"./loader-circle-BaaEdVGi.js";import{T as mt}from"./tractor-B0BYF2dB.js";import{A as ft}from"./arrow-up-right-Bg-J2DL2.js";import"./tractor-model-info-rewV-tFc.js";import"./DeferredScene-Cgyt5Rkv.js";import"./useKnowledgeCatalog-Mylc44AY.js";import"./api-client-CC4IKZbm.js";import"./package-BWJAUvP7.js";import"./search-DH5561cf.js";import"./layers-_Jb4HV6T.js";import"./cpu-Cpv4rcHC.js";import"./check-D4RVpp0P.js";import"./rotate-ccw-Cqa_gE9-.js";import"./chevron-right-C9w-EmKJ.js";const ie=new O,Me=new O,pt=new O,De=new re;function xt(s,e,r){const n=ie.setFromMatrixPosition(s.matrixWorld);n.project(e);const i=r.width/2,a=r.height/2;return[n.x*i+i,-(n.y*a)+a]}function vt(s,e){const r=ie.setFromMatrixPosition(s.matrixWorld),n=Me.setFromMatrixPosition(e.matrixWorld),i=r.sub(n),a=e.getWorldDirection(pt);return i.angleTo(a)>Math.PI/2}function gt(s,e,r,n){const i=ie.setFromMatrixPosition(s.matrixWorld),a=i.clone();a.project(e),De.set(a.x,a.y),r.setFromCamera(De,e);const d=r.intersectObjects(n,!0);if(d.length){const g=d[0].distance;return i.distanceTo(r.ray.origin)<g}return!0}function Mt(s,e){if(e instanceof Re)return e.zoom;if(e instanceof ge){const r=ie.setFromMatrixPosition(s.matrixWorld),n=Me.setFromMatrixPosition(e.matrixWorld),i=e.fov*Math.PI/180,a=r.distanceTo(n);return 1/(2*Math.tan(i/2)*a)}else return 1}function wt(s,e,r){if(e instanceof ge||e instanceof Re){const n=ie.setFromMatrixPosition(s.matrixWorld),i=Me.setFromMatrixPosition(e.matrixWorld),a=n.distanceTo(i),d=(r[1]-r[0])/(e.far-e.near),g=r[1]-d*e.far;return Math.round(d*a+g)}}const pe=s=>Math.abs(s)<1e-10?0:s;function Pe(s,e,r=""){let n="matrix3d(";for(let i=0;i!==16;i++)n+=pe(e[i]*s.elements[i])+(i!==15?",":")");return r+n}const St=(s=>e=>Pe(e,s))([1,-1,1,1,1,-1,1,1,1,-1,1,1,1,-1,1,1]),jt=(s=>(e,r)=>Pe(e,s(r),"translate(-50%,-50%)"))(s=>[1/s,1/s,1/s,1,-1/s,-1/s,-1/s,-1,1/s,1/s,1/s,1,1,1,1,1]);function yt(s){return s&&typeof s=="object"&&"current"in s}const bt=o.forwardRef(({children:s,eps:e=.001,style:r,className:n,prepend:i,center:a,fullscreen:d,portal:g,distanceFactor:M,sprite:_=!1,transform:p=!1,occlude:l,onOcclude:T,castShadow:m,receiveShadow:U,material:S,geometry:L,zIndexRange:N=[16777271,0],calculatePosition:F=xt,as:G="div",wrapperClass:E,pointerEvents:I="auto",...v},w)=>{const{gl:R,camera:j,scene:A,size:c,raycaster:z,events:$,viewport:V}=Q(),[y]=o.useState(()=>document.createElement(G)),B=o.useRef(null),u=o.useRef(null),P=o.useRef(0),C=o.useRef([0,0]),X=o.useRef(null),oe=o.useRef(null),H=g?.current||$.connected||R.domElement.parentNode,f=o.useRef(null),b=o.useRef(!1),D=o.useMemo(()=>l&&l!=="blending"||Array.isArray(l)&&l.length&&yt(l[0]),[l]);o.useLayoutEffect(()=>{const k=R.domElement;l&&l==="blending"?(k.style.zIndex=`${Math.floor(N[0]/2)}`,k.style.position="absolute",k.style.pointerEvents="none"):(k.style.zIndex=null,k.style.position=null,k.style.pointerEvents=null)},[l]),o.useLayoutEffect(()=>{if(u.current){const k=B.current=Ie.createRoot(y);if(A.updateMatrixWorld(),p)y.style.cssText="position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;";else{const x=F(u.current,j,c);y.style.cssText=`position:absolute;top:0;left:0;transform:translate3d(${x[0]}px,${x[1]}px,0);transform-origin:0 0;`}return H&&(i?H.prepend(y):H.appendChild(y)),()=>{H&&H.removeChild(y),k.unmount()}}},[H,p]),o.useLayoutEffect(()=>{E&&(y.className=E)},[E]);const ee=o.useMemo(()=>p?{position:"absolute",top:0,left:0,width:c.width,height:c.height,transformStyle:"preserve-3d",pointerEvents:"none"}:{position:"absolute",transform:a?"translate3d(-50%,-50%,0)":"none",...d&&{top:-c.height/2,left:-c.width/2,width:c.width,height:c.height},...r},[r,a,d,c,p]),ue=o.useMemo(()=>({position:"absolute",pointerEvents:I}),[I]);o.useLayoutEffect(()=>{if(b.current=!1,p){var k;(k=B.current)==null||k.render(o.createElement("div",{ref:X,style:ee},o.createElement("div",{ref:oe,style:ue},o.createElement("div",{ref:w,className:n,style:r,children:s}))))}else{var x;(x=B.current)==null||x.render(o.createElement("div",{ref:w,style:ee,className:n,children:s}))}});const te=o.useRef(!0);ve(k=>{if(u.current){j.updateMatrixWorld(),u.current.updateWorldMatrix(!0,!1);const x=p?C.current:F(u.current,j,c);if(p||Math.abs(P.current-j.zoom)>e||Math.abs(C.current[0]-x[0])>e||Math.abs(C.current[1]-x[1])>e){const K=vt(u.current,j);let q=!1;D&&(Array.isArray(l)?q=l.map(Y=>Y.current):l!=="blending"&&(q=[A]));const ne=te.current;if(q){const Y=gt(u.current,j,z,q);te.current=Y&&!K}else te.current=!K;ne!==te.current&&(T?T(!te.current):y.style.display=te.current?"block":"none");const ae=Math.floor(N[0]/2),Ue=l?D?[N[0],ae]:[ae-1,0]:N;if(y.style.zIndex=`${wt(u.current,j,Ue)}`,p){const[Y,Se]=[c.width/2,c.height/2],he=j.projectionMatrix.elements[5]*Se,{isOrthographicCamera:je,top:ze,left:Ee,bottom:Fe,right:Ce}=j,ke=St(j.matrixWorldInverse),We=je?`scale(${he})translate(${pe(-(Ce+Ee)/2)}px,${pe((ze+Fe)/2)}px)`:`translateZ(${he}px)`;let J=u.current.matrixWorld;_&&(J=j.matrixWorldInverse.clone().transpose().copyPosition(J).scale(u.current.scale),J.elements[3]=J.elements[7]=J.elements[11]=0,J.elements[15]=1),y.style.width=c.width+"px",y.style.height=c.height+"px",y.style.perspective=je?"":`${he}px`,X.current&&oe.current&&(X.current.style.transform=`${We}${ke}translate(${Y}px,${Se}px)`,oe.current.style.transform=jt(J,1/((M||10)/400)))}else{const Y=M===void 0?1:Mt(u.current,j)*M;y.style.transform=`translate3d(${x[0]}px,${x[1]}px,0) scale(${Y})`}C.current=x,P.current=j.zoom}}if(!D&&f.current&&!b.current)if(p){if(X.current){const x=X.current.children[0];if(x!=null&&x.clientWidth&&x!=null&&x.clientHeight){const{isOrthographicCamera:K}=j;if(K||L)v.scale&&(Array.isArray(v.scale)?v.scale instanceof O?f.current.scale.copy(v.scale.clone().divideScalar(1)):f.current.scale.set(1/v.scale[0],1/v.scale[1],1/v.scale[2]):f.current.scale.setScalar(1/v.scale));else{const q=(M||10)/400,ne=x.clientWidth*q,ae=x.clientHeight*q;f.current.scale.set(ne,ae,1)}b.current=!0}}}else{const x=y.children[0];if(x!=null&&x.clientWidth&&x!=null&&x.clientHeight){const K=1/V.factor,q=x.clientWidth*K,ne=x.clientHeight*K;f.current.scale.set(q,ne,1),b.current=!0}f.current.lookAt(k.camera.position)}});const we=o.useMemo(()=>({vertexShader:p?void 0:`
          /*
            This shader is from the THREE's SpriteMaterial.
            We need to turn the backing plane into a Sprite
            (make it always face the camera) if "transfrom"
            is false.
          */
          #include <common>

          void main() {
            vec2 center = vec2(0., 1.);
            float rotation = 0.0;

            // This is somewhat arbitrary, but it seems to work well
            // Need to figure out how to derive this dynamically if it even matters
            float size = 0.03;

            vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
            vec2 scale;
            scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
            scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );

            bool isPerspective = isPerspectiveMatrix( projectionMatrix );
            if ( isPerspective ) scale *= - mvPosition.z;

            vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale * size;
            vec2 rotatedPosition;
            rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
            rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
            mvPosition.xy += rotatedPosition;

            gl_Position = projectionMatrix * mvPosition;
          }
      `,fragmentShader:`
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      `}),[p]);return o.createElement("group",ce({},v,{ref:u}),l&&!D&&o.createElement("mesh",{castShadow:m,receiveShadow:U,ref:f},L||o.createElement("planeGeometry",null),S||o.createElement("shaderMaterial",{side:Ae,vertexShader:we.vertexShader,fragmentShader:we.fragmentShader})))});class _t extends Oe{constructor(e=new re){super({uniforms:{inputBuffer:new W(null),depthBuffer:new W(null),resolution:new W(new re),texelSize:new W(new re),halfTexelSize:new W(new re),kernel:new W(0),scale:new W(1),cameraNear:new W(0),cameraFar:new W(1),minDepthThreshold:new W(0),maxDepthThreshold:new W(1),depthScale:new W(0),depthToBlurRatioBias:new W(.25)},fragmentShader:`#include <common>
        #include <dithering_pars_fragment>      
        uniform sampler2D inputBuffer;
        uniform sampler2D depthBuffer;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform float minDepthThreshold;
        uniform float maxDepthThreshold;
        uniform float depthScale;
        uniform float depthToBlurRatioBias;
        varying vec2 vUv;
        varying vec2 vUv0;
        varying vec2 vUv1;
        varying vec2 vUv2;
        varying vec2 vUv3;

        void main() {
          float depthFactor = 0.0;
          
          #ifdef USE_DEPTH
            vec4 depth = texture2D(depthBuffer, vUv);
            depthFactor = smoothstep(minDepthThreshold, maxDepthThreshold, 1.0-(depth.r * depth.a));
            depthFactor *= depthScale;
            depthFactor = max(0.0, min(1.0, depthFactor + 0.25));
          #endif
          
          vec4 sum = texture2D(inputBuffer, mix(vUv0, vUv, depthFactor));
          sum += texture2D(inputBuffer, mix(vUv1, vUv, depthFactor));
          sum += texture2D(inputBuffer, mix(vUv2, vUv, depthFactor));
          sum += texture2D(inputBuffer, mix(vUv3, vUv, depthFactor));
          gl_FragColor = sum * 0.25 ;

          #include <dithering_fragment>
          #include <tonemapping_fragment>
          #include <${Ne>=154?"colorspace_fragment":"encodings_fragment"}>
        }`,vertexShader:`uniform vec2 texelSize;
        uniform vec2 halfTexelSize;
        uniform float kernel;
        uniform float scale;
        varying vec2 vUv;
        varying vec2 vUv0;
        varying vec2 vUv1;
        varying vec2 vUv2;
        varying vec2 vUv3;

        void main() {
          vec2 uv = position.xy * 0.5 + 0.5;
          vUv = uv;

          vec2 dUv = (texelSize * vec2(kernel) + halfTexelSize) * scale;
          vUv0 = vec2(uv.x - dUv.x, uv.y + dUv.y);
          vUv1 = vec2(uv.x + dUv.x, uv.y + dUv.y);
          vUv2 = vec2(uv.x + dUv.x, uv.y - dUv.y);
          vUv3 = vec2(uv.x - dUv.x, uv.y - dUv.y);

          gl_Position = vec4(position.xy, 1.0, 1.0);
        }`,blending:Le,depthWrite:!1,depthTest:!1}),this.toneMapped=!1,this.setTexelSize(e.x,e.y),this.kernel=new Float32Array([0,1,2,2,3])}setTexelSize(e,r){this.uniforms.texelSize.value.set(e,r),this.uniforms.halfTexelSize.value.set(e,r).multiplyScalar(.5)}setResolution(e){this.uniforms.resolution.value.copy(e)}}class Dt{constructor({gl:e,resolution:r,width:n=500,height:i=500,minDepthThreshold:a=0,maxDepthThreshold:d=1,depthScale:g=0,depthToBlurRatioBias:M=.25}){this.renderToScreen=!1,this.renderTargetA=new me(r,r,{minFilter:le,magFilter:le,stencilBuffer:!1,depthBuffer:!1,type:Be}),this.renderTargetB=this.renderTargetA.clone(),this.convolutionMaterial=new _t,this.convolutionMaterial.setTexelSize(1/n,1/i),this.convolutionMaterial.setResolution(new re(n,i)),this.scene=new $e,this.camera=new He,this.convolutionMaterial.uniforms.minDepthThreshold.value=a,this.convolutionMaterial.uniforms.maxDepthThreshold.value=d,this.convolutionMaterial.uniforms.depthScale.value=g,this.convolutionMaterial.uniforms.depthToBlurRatioBias.value=M,this.convolutionMaterial.defines.USE_DEPTH=g>0;const _=new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),p=new Float32Array([0,0,2,0,0,2]),l=new Ge;l.setAttribute("position",new ye(_,3)),l.setAttribute("uv",new ye(p,2)),this.screen=new Ve(l,this.convolutionMaterial),this.screen.frustumCulled=!1,this.scene.add(this.screen)}render(e,r,n){const i=this.scene,a=this.camera,d=this.renderTargetA,g=this.renderTargetB;let M=this.convolutionMaterial,_=M.uniforms;_.depthBuffer.value=r.depthTexture;const p=M.kernel;let l=r,T,m,U;for(m=0,U=p.length-1;m<U;++m)T=(m&1)===0?d:g,_.kernel.value=p[m],_.inputBuffer.value=l.texture,e.setRenderTarget(T),e.render(i,a),l=T;_.kernel.value=p[m],_.inputBuffer.value=l.texture,e.setRenderTarget(this.renderToScreen?null:n),e.render(i,a)}}let Tt=class extends Ze{constructor(e={}){super(e),this._tDepth={value:null},this._distortionMap={value:null},this._tDiffuse={value:null},this._tDiffuseBlur={value:null},this._textureMatrix={value:null},this._hasBlur={value:!1},this._mirror={value:0},this._mixBlur={value:0},this._blurStrength={value:.5},this._minDepthThreshold={value:.9},this._maxDepthThreshold={value:1},this._depthScale={value:0},this._depthToBlurRatioBias={value:.25},this._distortion={value:1},this._mixContrast={value:1},this.setValues(e)}onBeforeCompile(e){var r;(r=e.defines)!=null&&r.USE_UV||(e.defines.USE_UV=""),e.uniforms.hasBlur=this._hasBlur,e.uniforms.tDiffuse=this._tDiffuse,e.uniforms.tDepth=this._tDepth,e.uniforms.distortionMap=this._distortionMap,e.uniforms.tDiffuseBlur=this._tDiffuseBlur,e.uniforms.textureMatrix=this._textureMatrix,e.uniforms.mirror=this._mirror,e.uniforms.mixBlur=this._mixBlur,e.uniforms.mixStrength=this._blurStrength,e.uniforms.minDepthThreshold=this._minDepthThreshold,e.uniforms.maxDepthThreshold=this._maxDepthThreshold,e.uniforms.depthScale=this._depthScale,e.uniforms.depthToBlurRatioBias=this._depthToBlurRatioBias,e.uniforms.distortion=this._distortion,e.uniforms.mixContrast=this._mixContrast,e.vertexShader=`
        uniform mat4 textureMatrix;
        varying vec4 my_vUv;
      ${e.vertexShader}`,e.vertexShader=e.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
        my_vUv = textureMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );`),e.fragmentShader=`
        uniform sampler2D tDiffuse;
        uniform sampler2D tDiffuseBlur;
        uniform sampler2D tDepth;
        uniform sampler2D distortionMap;
        uniform float distortion;
        uniform float cameraNear;
			  uniform float cameraFar;
        uniform bool hasBlur;
        uniform float mixBlur;
        uniform float mirror;
        uniform float mixStrength;
        uniform float minDepthThreshold;
        uniform float maxDepthThreshold;
        uniform float mixContrast;
        uniform float depthScale;
        uniform float depthToBlurRatioBias;
        varying vec4 my_vUv;
        ${e.fragmentShader}`,e.fragmentShader=e.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>

      float distortionFactor = 0.0;
      #ifdef USE_DISTORTION
        distortionFactor = texture2D(distortionMap, vUv).r * distortion;
      #endif

      vec4 new_vUv = my_vUv;
      new_vUv.x += distortionFactor;
      new_vUv.y += distortionFactor;

      vec4 base = texture2DProj(tDiffuse, new_vUv);
      vec4 blur = texture2DProj(tDiffuseBlur, new_vUv);

      vec4 merge = base;

      #ifdef USE_NORMALMAP
        vec2 normal_uv = vec2(0.0);
        vec4 normalColor = texture2D(normalMap, vUv * normalScale);
        vec3 my_normal = normalize( vec3( normalColor.r * 2.0 - 1.0, normalColor.b,  normalColor.g * 2.0 - 1.0 ) );
        vec3 coord = new_vUv.xyz / new_vUv.w;
        normal_uv = coord.xy + coord.z * my_normal.xz * 0.05;
        vec4 base_normal = texture2D(tDiffuse, normal_uv);
        vec4 blur_normal = texture2D(tDiffuseBlur, normal_uv);
        merge = base_normal;
        blur = blur_normal;
      #endif

      float depthFactor = 0.0001;
      float blurFactor = 0.0;

      #ifdef USE_DEPTH
        vec4 depth = texture2DProj(tDepth, new_vUv);
        depthFactor = smoothstep(minDepthThreshold, maxDepthThreshold, 1.0-(depth.r * depth.a));
        depthFactor *= depthScale;
        depthFactor = max(0.0001, min(1.0, depthFactor));

        #ifdef USE_BLUR
          blur = blur * min(1.0, depthFactor + depthToBlurRatioBias);
          merge = merge * min(1.0, depthFactor + 0.5);
        #else
          merge = merge * depthFactor;
        #endif

      #endif

      float reflectorRoughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        vec4 reflectorTexelRoughness = texture2D( roughnessMap, vUv );
        reflectorRoughnessFactor *= reflectorTexelRoughness.g;
      #endif

      #ifdef USE_BLUR
        blurFactor = min(1.0, mixBlur * reflectorRoughnessFactor);
        merge = mix(merge, blur, blurFactor);
      #endif

      vec4 newMerge = vec4(0.0, 0.0, 0.0, 1.0);
      newMerge.r = (merge.r - 0.5) * mixContrast + 0.5;
      newMerge.g = (merge.g - 0.5) * mixContrast + 0.5;
      newMerge.b = (merge.b - 0.5) * mixContrast + 0.5;

      diffuseColor.rgb = diffuseColor.rgb * ((1.0 - min(1.0, mirror)) + newMerge.rgb * mixStrength);
      `)}get tDiffuse(){return this._tDiffuse.value}set tDiffuse(e){this._tDiffuse.value=e}get tDepth(){return this._tDepth.value}set tDepth(e){this._tDepth.value=e}get distortionMap(){return this._distortionMap.value}set distortionMap(e){this._distortionMap.value=e}get tDiffuseBlur(){return this._tDiffuseBlur.value}set tDiffuseBlur(e){this._tDiffuseBlur.value=e}get textureMatrix(){return this._textureMatrix.value}set textureMatrix(e){this._textureMatrix.value=e}get hasBlur(){return this._hasBlur.value}set hasBlur(e){this._hasBlur.value=e}get mirror(){return this._mirror.value}set mirror(e){this._mirror.value=e}get mixBlur(){return this._mixBlur.value}set mixBlur(e){this._mixBlur.value=e}get mixStrength(){return this._blurStrength.value}set mixStrength(e){this._blurStrength.value=e}get minDepthThreshold(){return this._minDepthThreshold.value}set minDepthThreshold(e){this._minDepthThreshold.value=e}get maxDepthThreshold(){return this._maxDepthThreshold.value}set maxDepthThreshold(e){this._maxDepthThreshold.value=e}get depthScale(){return this._depthScale.value}set depthScale(e){this._depthScale.value=e}get depthToBlurRatioBias(){return this._depthToBlurRatioBias.value}set depthToBlurRatioBias(e){this._depthToBlurRatioBias.value=e}get distortion(){return this._distortion.value}set distortion(e){this._distortion.value=e}get mixContrast(){return this._mixContrast.value}set mixContrast(e){this._mixContrast.value=e}};const Rt=o.forwardRef(({mixBlur:s=0,mixStrength:e=1,resolution:r=256,blur:n=[0,0],minDepthThreshold:i=.9,maxDepthThreshold:a=1,depthScale:d=0,depthToBlurRatioBias:g=.25,mirror:M=0,distortion:_=1,mixContrast:p=1,distortionMap:l,reflectorOffset:T=0,...m},U)=>{qe({MeshReflectorMaterialImpl:Tt});const S=Q(({gl:f})=>f),L=Q(({camera:f})=>f),N=Q(({scene:f})=>f);n=Array.isArray(n)?n:[n,n];const F=n[0]+n[1]>0,G=n[0],E=n[1],I=o.useRef(null);o.useImperativeHandle(U,()=>I.current,[]);const[v]=o.useState(()=>new Xe),[w]=o.useState(()=>new O),[R]=o.useState(()=>new O),[j]=o.useState(()=>new O),[A]=o.useState(()=>new be),[c]=o.useState(()=>new O(0,0,-1)),[z]=o.useState(()=>new _e),[$]=o.useState(()=>new O),[V]=o.useState(()=>new O),[y]=o.useState(()=>new _e),[B]=o.useState(()=>new be),[u]=o.useState(()=>new ge),P=o.useCallback(()=>{var f;const b=I.current.parent||((f=I.current)==null||(f=f.__r3f.parent)==null?void 0:f.object);if(!b||(R.setFromMatrixPosition(b.matrixWorld),j.setFromMatrixPosition(L.matrixWorld),A.extractRotation(b.matrixWorld),w.set(0,0,1),w.applyMatrix4(A),R.addScaledVector(w,T),$.subVectors(R,j),$.dot(w)>0))return;$.reflect(w).negate(),$.add(R),A.extractRotation(L.matrixWorld),c.set(0,0,-1),c.applyMatrix4(A),c.add(j),V.subVectors(R,c),V.reflect(w).negate(),V.add(R),u.position.copy($),u.up.set(0,1,0),u.up.applyMatrix4(A),u.up.reflect(w),u.lookAt(V),u.far=L.far,u.updateMatrixWorld(),u.projectionMatrix.copy(L.projectionMatrix),B.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),B.multiply(u.projectionMatrix),B.multiply(u.matrixWorldInverse),B.multiply(b.matrixWorld),v.setFromNormalAndCoplanarPoint(w,R),v.applyMatrix4(u.matrixWorldInverse),z.set(v.normal.x,v.normal.y,v.normal.z,v.constant);const D=u.projectionMatrix;y.x=(Math.sign(z.x)+D.elements[8])/D.elements[0],y.y=(Math.sign(z.y)+D.elements[9])/D.elements[5],y.z=-1,y.w=(1+D.elements[10])/D.elements[14],z.multiplyScalar(2/z.dot(y)),D.elements[2]=z.x,D.elements[6]=z.y,D.elements[10]=z.z+1,D.elements[14]=z.w},[L,T]),[C,X,oe,H]=o.useMemo(()=>{const f={minFilter:le,magFilter:le,type:Be},b=new me(r,r,f);b.depthBuffer=!0,b.depthTexture=new Ke(r,r),b.depthTexture.format=Ye,b.depthTexture.type=Je;const D=new me(r,r,f),ee=new Dt({gl:S,resolution:r,width:G,height:E,minDepthThreshold:i,maxDepthThreshold:a,depthScale:d,depthToBlurRatioBias:g}),ue={mirror:M,textureMatrix:B,mixBlur:s,tDiffuse:b.texture,tDepth:b.depthTexture,tDiffuseBlur:D.texture,hasBlur:F,mixStrength:e,minDepthThreshold:i,maxDepthThreshold:a,depthScale:d,depthToBlurRatioBias:g,distortion:_,distortionMap:l,mixContrast:p,"defines-USE_BLUR":F?"":void 0,"defines-USE_DEPTH":d>0?"":void 0,"defines-USE_DISTORTION":l?"":void 0};return[b,D,ee,ue]},[S,G,E,B,r,M,F,s,e,i,a,d,g,_,l,p]);return ve(()=>{var f;const b=I.current.parent||((f=I.current)==null||(f=f.__r3f.parent)==null?void 0:f.object);if(!b)return;b.visible=!1;const D=S.xr.enabled,ee=S.shadowMap.autoUpdate;P(),S.xr.enabled=!1,S.shadowMap.autoUpdate=!1,S.setRenderTarget(C),S.state.buffers.depth.setMask(!0),S.autoClear||S.clear(),S.render(N,u),F&&oe.render(S,C,X),S.xr.enabled=D,S.shadowMap.autoUpdate=ee,b.visible=!0,S.setRenderTarget(null)}),o.createElement("meshReflectorMaterialImpl",ce({attach:"material",key:"key"+H["defines-USE_BLUR"]+H["defines-USE_DEPTH"]+H["defines-USE_DISTORTION"],ref:I},H,m))}),Z=1e-5;function Bt(s,e,r){const n=new et,i=r-Z;return n.absarc(Z,Z,Z,-Math.PI/2,-Math.PI,!0),n.absarc(Z,e-i*2,Z,Math.PI,Math.PI/2,!0),n.absarc(s-i*2,e-i*2,Z,Math.PI/2,0,!0),n.absarc(s-i*2,Z,Z,0,-Math.PI/2,!0),n}const Pt=o.forwardRef(function({args:[e=1,r=1,n=1]=[],radius:i=.05,steps:a=1,smoothness:d=4,bevelSegments:g=4,creaseAngle:M=.4,children:_,...p},l){return o.createElement("mesh",ce({ref:l},p),o.createElement(Ut,{args:[e,r,n],radius:i,steps:a,smoothness:d,bevelSegments:g,creaseAngle:M}),_)}),Ut=o.forwardRef(function({args:[e=1,r=1,n=1]=[],radius:i=.05,steps:a=1,smoothness:d=4,bevelSegments:g=4,creaseAngle:M=.4,..._},p){const l=o.useMemo(()=>Bt(e,r,i),[e,r,i]),T=o.useMemo(()=>({depth:n-i*2,bevelEnabled:!0,bevelSegments:g*2,steps:a,bevelSize:i-Z,bevelThickness:i,curveSegments:d}),[n,i,d,g,a]),m=o.useRef(null);return o.useLayoutEffect(()=>{m.current&&(m.current.center(),Qe(m.current,M))},[l,T,M]),o.useImperativeHandle(p,()=>m.current),o.createElement("extrudeGeometry",ce({ref:m,args:[l,T]},_))}),zt={alpha:!0,antialias:!0},Et={type:st},Ft={position:[23,25,29],fov:35,near:.1,far:150};function Ct(){const{gl:s,scene:e}=Q();return o.useEffect(()=>{const r=new at(s),n=new it,i=r.fromScene(n,.025);return e.environment=i.texture,e.environmentIntensity=.55,()=>{e.environment=null,i.dispose(),n.dispose(),r.dispose()}},[s,e]),null}function h({position:s,size:e,color:r="#182a3e",glow:n,rotation:i}){return Math.min(...e)<.2?t.jsxs("mesh",{position:s,rotation:i,castShadow:!0,receiveShadow:!0,children:[t.jsx("boxGeometry",{args:e}),t.jsx("meshStandardMaterial",{color:r,roughness:.33,metalness:.55,emissive:n??"#000000",emissiveIntensity:n?.65:0})]}):t.jsx(Pt,{args:e,position:s,rotation:i,radius:.055,smoothness:2,castShadow:!0,receiveShadow:!0,children:t.jsx("meshStandardMaterial",{color:r,roughness:.33,metalness:.55,emissive:n??"#000000",emissiveIntensity:n?.65:0})})}function se({position:s,radius:e,color:r,rotation:n=[-Math.PI/2,0,0],thickness:i=.025}){return t.jsxs("mesh",{position:s,rotation:n,children:[t.jsx("torusGeometry",{args:[e,i,8,80]}),t.jsx("meshStandardMaterial",{color:r,emissive:r,emissiveIntensity:1.1,roughness:.2,metalness:.65})]})}function kt({color:s}){return t.jsxs("group",{children:[[-1.1,0,1.1].map((e,r)=>t.jsxs("group",{position:[e,.4,0],rotation:[0,-.22+r*.22,-.08+r*.08],children:[t.jsx(h,{size:[.85,1.65+r*.35,.55],position:[0,1+r*.16,0],color:"#b8c9d6"}),t.jsx(h,{size:[.08,1.69+r*.35,.61],position:[-.43,1+r*.16,0],color:"#22658b",glow:s}),[.4,.75,1.1].map(n=>t.jsx(h,{size:[.48,.025,.02],position:[.03,n+r*.35,.289],color:"#3b5a6c"},n))]},e)),t.jsx(h,{size:[4.2,.09,.12],position:[0,3.35,-.9],color:s,glow:s}),[-2,2].map(e=>t.jsx(h,{size:[.1,3.1,.12],position:[e,1.8,-.9],color:"#517888"},e))]})}function Wt({color:s}){return t.jsxs("group",{children:[t.jsx(h,{size:[2.8,.3,2.2],position:[0,.45,0],color:"#273b4c"}),[-1.25,1.25].map(e=>t.jsxs("group",{children:[t.jsx(h,{size:[.16,2.7,.18],position:[e,1.95,-.7],color:"#b6c0bd"}),t.jsx(h,{size:[.035,2.3,.2],position:[e,1.95,-.6],color:s,glow:s})]},e)),t.jsx(h,{size:[2.8,.15,.5],position:[0,3.32,-.7],color:"#d1c7b7"}),t.jsxs("mesh",{position:[0,1.85,0],rotation:[.3,.6,.25],castShadow:!0,children:[t.jsx("icosahedronGeometry",{args:[.82,0]}),t.jsx("meshStandardMaterial",{color:"#a47f47",metalness:.8,roughness:.22})]}),t.jsx(se,{position:[0,1.85,0],radius:1.15,color:s,rotation:[Math.PI/2.8,.1,.2]}),[-.6,-.3,0,.3,.6].map((e,r)=>t.jsx(h,{position:[e,.73+Math.sin(r)*.08,1],size:[.11,.3+r%3*.17,.1],color:s,glow:s},e))]})}function It({color:s}){return t.jsxs("group",{children:[t.jsx(h,{size:[3.4,.25,2.2],position:[0,.48,0],color:"#3e585c"}),t.jsxs("mesh",{position:[0,1.75,0],rotation:[0,.35,.45],castShadow:!0,children:[t.jsx("torusGeometry",{args:[.85,.23,12,36]}),t.jsx("meshStandardMaterial",{color:"#aab9b8",metalness:.86,roughness:.27})]}),t.jsx(se,{position:[0,1.75,0],radius:1.35,color:s,rotation:[0,.35,.45],thickness:.018}),[-1,1].map(e=>t.jsx(h,{size:[.45,.5,.5],position:[e*1.15,1.75,0],color:"#527b76"},e)),t.jsx(h,{size:[.12,1.1,.14],position:[0,1.05,0],color:"#3b565b"}),t.jsx(h,{size:[2.7,.07,.08],position:[0,.66,1.11],color:s,glow:s})]})}function At({color:s}){return t.jsxs("group",{children:[t.jsx(h,{size:[2.7,.3,2],position:[0,.48,0],color:"#354354"}),t.jsx("group",{position:[0,1.25,.1],rotation:[-.5,0,0],children:[-1,1].map(e=>t.jsxs("group",{rotation:[0,0,e*-.3],children:[t.jsx(h,{size:[1.05,.16,1.5],position:[e*.5,.2,0],color:"#c3d0d9"}),[-.45,-.15,.15,.45].map(r=>t.jsx(h,{size:[.65,.018,.02],position:[e*.52,.29,r],color:"#5a7484"},r))]},e))}),t.jsx(se,{position:[0,2.7,-.6],radius:.85,color:s,rotation:[.2,.25,0],thickness:.022}),[0,1,2].map(e=>t.jsxs("mesh",{position:[Math.cos(e*Math.PI*2/3)*.85,2.7+Math.sin(e*Math.PI*2/3)*.85,-.6],castShadow:!0,children:[t.jsx("sphereGeometry",{args:[.13,16,12]}),t.jsx("meshStandardMaterial",{color:"#dae7ec",metalness:.7,roughness:.2})]},e))]})}function Ot({zone:s,selected:e,onSelect:r}){const n=xe(),i=s.color;return t.jsxs("group",{position:[s.x,0,s.z],children:[t.jsxs("group",{onClick:a=>{a.stopPropagation(),r(s.id)},children:[t.jsxs("mesh",{position:[0,.13,0],receiveShadow:!0,castShadow:!0,children:[t.jsx("cylinderGeometry",{args:[2.7,2.8,.25,64]}),t.jsx("meshStandardMaterial",{color:e?"#294b60":"#1a3042",metalness:.72,roughness:.35})]}),t.jsx(se,{position:[0,.27,0],radius:2.65,color:i,thickness:e?.045:.018}),s.id==="knowledge"&&t.jsx(kt,{color:i}),s.id==="diagnosis"&&t.jsx(Wt,{color:i}),s.id==="models"&&t.jsx(It,{color:i}),s.id==="research"&&t.jsx(At,{color:i})]}),t.jsx(bt,{position:[0,4,0],center:!0,zIndexRange:[8,4],className:"world-label-wrap",children:t.jsxs("button",{type:"button",className:`world-zone-label${e?" is-selected":""}`,style:{"--zone-color":i},onClick:()=>r(s.id),children:[t.jsxs("span",{children:[s.number," / ",n==="zh"?"展区":"ZONE"]}),t.jsxs("strong",{children:[n==="zh"?s.zh:s.en,t.jsx(ft,{size:13})]})]})})]})}function Lt(){const s=Q(r=>r.size.width<700),e=o.useMemo(()=>Array.from({length:12},(r,n)=>-11+n*2),[]);return t.jsxs("group",{children:[t.jsx(h,{position:[0,-.5,0],size:[29,.9,24],color:"#101c2a"}),t.jsxs("mesh",{rotation:[-Math.PI/2,0,0],position:[0,-.035,0],receiveShadow:!0,children:[t.jsx("planeGeometry",{args:[28.7,23.7]}),t.jsx(Rt,{resolution:s?128:256,blur:s?[0,0]:[40,20],mixBlur:s?0:.75,mixStrength:1.3,mirror:.3,color:"#132232",roughness:.65,metalness:.7,depthScale:.4,minDepthThreshold:.4,maxDepthThreshold:1.4})]}),[-1,1].map(r=>t.jsxs("group",{children:[t.jsx(h,{position:[0,-.02,r*11.9],size:[28.5,.025,.035],color:"#6fa8b9",glow:"#63c4d4"}),t.jsx(h,{position:[r*14.35,-.02,0],size:[.035,.025,23.6],color:"#6fa8b9",glow:"#63c4d4"}),t.jsx(h,{position:[r*2,.01,0],size:[.025,.018,22.8],color:"#668696"}),t.jsx(h,{position:[0,.01,r*1.95],size:[27,.018,.025],color:"#668696"}),e.map(n=>t.jsxs("group",{position:[n,0,r*11.35],children:[t.jsx(h,{size:[.1,.35,.1],position:[0,.18,0],color:"#283d4b"}),t.jsx(h,{size:[.14,.04,.14],position:[0,.37,0],color:"#a7d4dd",glow:"#b3e9f4"})]},n))]},r)),[-10,-7,-4,4,7,10].map(r=>t.jsxs("group",{children:[t.jsx(h,{position:[r,.012,0],size:[.6,.018,.025],color:"#94aab4"}),t.jsx(h,{position:[0,.012,r],size:[.025,.018,.6],color:"#94aab4"})]},r)),t.jsx(se,{position:[0,.025,0],radius:3.2,color:"#416978",thickness:.013}),t.jsx(se,{position:[0,.025,0],radius:2.9,color:"#254353",thickness:.014}),[-1,1].map(r=>t.jsxs("group",{position:[r*13.15,0,0],children:[t.jsx(h,{size:[.5,3.4,.6],position:[0,1.7,-1.1],color:"#283e4c"}),t.jsx(h,{size:[.5,3.4,.6],position:[0,1.7,1.1],color:"#283e4c"}),t.jsx(h,{size:[.5,.25,3],position:[0,3.5,0],color:"#617f8a"}),t.jsx(h,{size:[.03,2.7,.06],position:[-r*.26,1.8,-1.1],color:"#93ddde",glow:"#a4efed"})]},r)),fe.map(r=>t.jsxs("group",{position:[r.x*1.4,0,r.z*1.75],children:[t.jsx(h,{size:[1.7,.3,.75],position:[0,.14,0],color:"#293e48"}),[-.5,0,.5].map(n=>t.jsxs("mesh",{position:[n,.48,0],castShadow:!0,children:[t.jsx("icosahedronGeometry",{args:[.37,0]}),t.jsx("meshStandardMaterial",{color:"#3f796e",roughness:.9})]},n))]},r.id))]})}function Nt({mode:s,selected:e,focus:r,destination:n,reset:i,input:a,reducedMotion:d,onSelect:g,onPosition:M,onNearby:_,onLoaded:p}){const l=o.useRef(null),T=o.useRef(null),m=o.useRef(de()),U=o.useRef([]),S=o.useRef(null),L=o.useRef(0),N=o.useRef(de()),F=o.useRef(!0),G=o.useMemo(()=>new O,[]),E=o.useMemo(()=>new O,[]),{camera:I,size:v,invalidate:w}=Q();return o.useEffect(()=>(a.wake=w,()=>{a.wake=void 0}),[a,w]),o.useEffect(()=>{m.current=de(),N.current={...m.current},U.current=[],S.current=null,a.actions.clear(),F.current=!0,_(null),M({...m.current}),w()},[i,a,w,_,M]),o.useEffect(()=>{U.current=n?lt(m.current,n.id):[],w()},[n,w]),o.useEffect(()=>{F.current=!0,s==="overview"&&(U.current=[],a.actions.clear()),w()},[s,r,v.width,v.height,a,w]),ve((R,j)=>{const A=new Set(a.actions.values());if(A.size&&(U.current=[]),s==="drive"){let B=Math.min(j,.2);for(;B>0;){const u=Math.min(B,.05);if(U.current.length){const P=ct(m.current,U.current[0],u);m.current=P.state,P.arrived&&U.current.shift()}else m.current=ut(m.current,A,u);B-=u}}else m.current.speed=0;const c=m.current;l.current&&(l.current.position.set(c.x,.4,c.z),l.current.rotation.y=c.heading);const z=ht(c.x,c.z);z!==S.current&&(S.current=z,_(z));const $=s==="drive"&&(A.size>0||U.current.length>0||Math.abs(c.speed)>.01),V=N.current;if((c.x!==V.x||c.z!==V.z||c.heading!==V.heading)&&(R.clock.elapsedTime-L.current>.18||!$)&&(N.current={...c},M(N.current),L.current=R.clock.elapsedTime),s==="drive"||F.current){if(s==="drive")G.set(c.x,.5,c.z),E.set(c.x+8,7,c.z+10),v.width<650&&E.set(c.x+8,11,c.z+14);else if(r){const P=fe.find(C=>C.id===r);G.set(P.x,.8,P.z),E.set(P.x+9,9,P.z+12),v.width<650&&E.set(P.x+10,13,P.z+18)}else{G.set(0,0,0);const P=v.width/v.height,C=Math.max(1,1.25/P);E.set(23*C,25*C,29*C)}const B=d?1:1-Math.exp(-5*Math.min(j,.2));I.position.lerp(E,B),T.current?.target.lerp(G,B),T.current?.update(),I.position.distanceToSquared(E)>8e-4||(T.current?.target.distanceToSquared(G)??0)>8e-4||$?w():F.current=!1}$&&w()}),t.jsxs(t.Fragment,{children:[t.jsx("fog",{attach:"fog",args:["#080f1b",42,100]}),t.jsx("ambientLight",{intensity:.7,color:"#b4c9dc"}),t.jsx("directionalLight",{position:[-8,18,10],intensity:3.2,color:"#fff3db",castShadow:!0,"shadow-mapSize":v.width<700?[512,512]:[1024,1024],"shadow-camera-left":-18,"shadow-camera-right":18,"shadow-camera-top":18,"shadow-camera-bottom":-18,"shadow-camera-far":60,"shadow-bias":-15e-5,"shadow-normalBias":.025}),t.jsx("directionalLight",{position:[8,6,-12],intensity:1.8,color:"#80caff"}),t.jsx(Ct,{}),t.jsx(Lt,{}),fe.map(R=>t.jsx(Ot,{zone:R,selected:e===R.id,onSelect:g},R.id)),t.jsx(o.Suspense,{fallback:null,children:t.jsx("group",{ref:l,children:t.jsx(ot,{onLoaded:p})})}),t.jsx(nt,{ref:T,makeDefault:!0,enabled:s==="overview",enablePan:!1,enableDamping:!d,minDistance:9,maxDistance:100,minPolarAngle:.15,maxPolarAngle:Math.PI/2.4,onStart:()=>{F.current=!1}})]})}function Te(){const s=xe();return t.jsxs("div",{className:"world-fallback",children:[t.jsx(mt,{size:70,strokeWidth:1}),t.jsx("h2",{children:s==="zh"?"三维空间暂不可用":"3D space is unavailable"}),t.jsx("p",{children:s==="zh"?"通过展区导航，仍可进入知识库、诊断和模型工坊。":"Use the zone navigation to open knowledge, diagnosis and the model studio."})]})}function ar(s){const e=xe(),[r,n]=o.useState(!1),[i]=o.useState(()=>{try{const d=document.createElement("canvas").getContext("webgl2");return d?.getExtension("WEBGL_lose_context")?.loseContext(),!!d}catch{return!1}}),a=o.useCallback(()=>n(!0),[]);return i?t.jsxs(tt,{FallbackComponent:Te,children:[t.jsx(rt,{shadows:Et,camera:Ft,gl:zt,dpr:[1,1.25],frameloop:"demand",role:"group","aria-label":e==="zh"?"农机三维园区，四个展区围绕中央广场":"3D machinery campus with four pavilions around a central plaza",children:t.jsx(Nt,{...s,onLoaded:a})}),!r&&t.jsxs("div",{className:"world-loading",role:"status",children:[t.jsx(dt,{size:20}),t.jsx("span",{children:e==="zh"?"正在打开三维园区…":"Opening the 3D campus…"})]})]}):t.jsx(Te,{})}export{ar as default};
