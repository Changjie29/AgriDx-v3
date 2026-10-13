import{r as n,E as Ae,u as xe,j as t,D as Re}from"./index-Byfxsc-z.js";import{f as Q,u as ve,V as I,_ as ce,D as Oe,h as re,i as ge,j as Be,S as Le,N as Ne,U as k,v as $e,W as me,H as Pe,L as le,k as He,l as Ge,m as Ve,n as ye,o as Ze,p as qe,e as Xe,P as Ke,q as be,r as _e,s as Ye,t as Je,w as Qe,x as et,y as tt,c as rt,d as st,z as ot,T as nt,O as it,R as at,g as lt}from"./TractorModel-DMh6UcrS.js";import{i as de,p as ct,W as fe,s as ut,a as ht,n as dt}from"./ExhibitionPage-Bd-Xuj6y.js";import{L as mt}from"./loader-circle-CzHhpisr.js";import{T as ft}from"./tractor-CZ_Vx9H0.js";import{A as pt}from"./arrow-up-right-BS95HQLs.js";import"./tractor-model-info-CTOU4snE.js";import"./DeferredScene-DmTlpGYu.js";import"./useKnowledgeCatalog-CjcTGo9u.js";import"./api-client-D1qaD6Ic.js";import"./package-CuaWbEny.js";import"./search-CEGH9j_X.js";import"./layers-BBhnao6q.js";import"./cpu-CkvCCljH.js";import"./check-1vRaudV8.js";import"./rotate-ccw-BZaN3lyw.js";import"./chevron-right-BhRlu_RR.js";const ie=new I,Me=new I,xt=new I,De=new re;function vt(r,e,o){const s=ie.setFromMatrixPosition(r.matrixWorld);s.project(e);const i=o.width/2,a=o.height/2;return[s.x*i+i,-(s.y*a)+a]}function gt(r,e){const o=ie.setFromMatrixPosition(r.matrixWorld),s=Me.setFromMatrixPosition(e.matrixWorld),i=o.sub(s),a=e.getWorldDirection(xt);return i.angleTo(a)>Math.PI/2}function Mt(r,e,o,s){const i=ie.setFromMatrixPosition(r.matrixWorld),a=i.clone();a.project(e),De.set(a.x,a.y),o.setFromCamera(De,e);const h=o.intersectObjects(s,!0);if(h.length){const S=h[0].distance;return i.distanceTo(o.ray.origin)<S}return!0}function wt(r,e){if(e instanceof Be)return e.zoom;if(e instanceof ge){const o=ie.setFromMatrixPosition(r.matrixWorld),s=Me.setFromMatrixPosition(e.matrixWorld),i=e.fov*Math.PI/180,a=o.distanceTo(s);return 1/(2*Math.tan(i/2)*a)}else return 1}function St(r,e,o){if(e instanceof ge||e instanceof Be){const s=ie.setFromMatrixPosition(r.matrixWorld),i=Me.setFromMatrixPosition(e.matrixWorld),a=s.distanceTo(i),h=(o[1]-o[0])/(e.far-e.near),S=o[1]-h*e.far;return Math.round(h*a+S)}}const pe=r=>Math.abs(r)<1e-10?0:r;function Ue(r,e,o=""){let s="matrix3d(";for(let i=0;i!==16;i++)s+=pe(e[i]*r.elements[i])+(i!==15?",":")");return o+s}const jt=(r=>e=>Ue(e,r))([1,-1,1,1,1,-1,1,1,1,-1,1,1,1,-1,1,1]),yt=(r=>(e,o)=>Ue(e,r(o),"translate(-50%,-50%)"))(r=>[1/r,1/r,1/r,1,-1/r,-1/r,-1/r,-1,1/r,1/r,1/r,1,1,1,1,1]);function bt(r){return r&&typeof r=="object"&&"current"in r}const _t=n.forwardRef(({children:r,eps:e=.001,style:o,className:s,prepend:i,center:a,fullscreen:h,portal:S,distanceFactor:j,sprite:D=!1,transform:p=!1,occlude:l,onOcclude:B,castShadow:m,receiveShadow:P,material:b,geometry:A,zIndexRange:O=[16777271,0],calculatePosition:E=vt,as:G="div",wrapperClass:U,pointerEvents:W="auto",...g},M)=>{const{gl:z,camera:x,scene:L,size:y,raycaster:d,events:N,viewport:V}=Q(),[w]=n.useState(()=>document.createElement(G)),$=n.useRef(null),c=n.useRef(null),q=n.useRef(0),R=n.useRef([0,0]),F=n.useRef(null),oe=n.useRef(null),H=S?.current||N.connected||z.domElement.parentNode,f=n.useRef(null),_=n.useRef(!1),T=n.useMemo(()=>l&&l!=="blending"||Array.isArray(l)&&l.length&&bt(l[0]),[l]);n.useLayoutEffect(()=>{const C=z.domElement;l&&l==="blending"?(C.style.zIndex=`${Math.floor(O[0]/2)}`,C.style.position="absolute",C.style.pointerEvents="none"):(C.style.zIndex=null,C.style.position=null,C.style.pointerEvents=null)},[l]),n.useLayoutEffect(()=>{if(c.current){const C=$.current=Ae.createRoot(w);if(L.updateMatrixWorld(),p)w.style.cssText="position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;";else{const v=E(c.current,x,y);w.style.cssText=`position:absolute;top:0;left:0;transform:translate3d(${v[0]}px,${v[1]}px,0);transform-origin:0 0;`}return H&&(i?H.prepend(w):H.appendChild(w)),()=>{H&&H.removeChild(w),C.unmount()}}},[H,p]),n.useLayoutEffect(()=>{U&&(w.className=U)},[U]);const ee=n.useMemo(()=>p?{position:"absolute",top:0,left:0,width:y.width,height:y.height,transformStyle:"preserve-3d",pointerEvents:"none"}:{position:"absolute",transform:a?"translate3d(-50%,-50%,0)":"none",...h&&{top:-y.height/2,left:-y.width/2,width:y.width,height:y.height},...o},[o,a,h,y,p]),ue=n.useMemo(()=>({position:"absolute",pointerEvents:W}),[W]);n.useLayoutEffect(()=>{if(_.current=!1,p){var C;(C=$.current)==null||C.render(n.createElement("div",{ref:F,style:ee},n.createElement("div",{ref:oe,style:ue},n.createElement("div",{ref:M,className:s,style:o,children:r}))))}else{var v;(v=$.current)==null||v.render(n.createElement("div",{ref:M,style:ee,className:s,children:r}))}});const te=n.useRef(!0);ve(C=>{if(c.current){x.updateMatrixWorld(),c.current.updateWorldMatrix(!0,!1);const v=p?R.current:E(c.current,x,y);if(p||Math.abs(q.current-x.zoom)>e||Math.abs(R.current[0]-v[0])>e||Math.abs(R.current[1]-v[1])>e){const K=gt(c.current,x);let X=!1;T&&(Array.isArray(l)?X=l.map(Y=>Y.current):l!=="blending"&&(X=[L]));const ne=te.current;if(X){const Y=Mt(c.current,x,d,X);te.current=Y&&!K}else te.current=!K;ne!==te.current&&(B?B(!te.current):w.style.display=te.current?"block":"none");const ae=Math.floor(O[0]/2),ze=l?T?[O[0],ae]:[ae-1,0]:O;if(w.style.zIndex=`${St(c.current,x,ze)}`,p){const[Y,Se]=[y.width/2,y.height/2],he=x.projectionMatrix.elements[5]*Se,{isOrthographicCamera:je,top:Ee,left:Fe,bottom:Ce,right:ke}=x,We=jt(x.matrixWorldInverse),Ie=je?`scale(${he})translate(${pe(-(ke+Fe)/2)}px,${pe((Ee+Ce)/2)}px)`:`translateZ(${he}px)`;let J=c.current.matrixWorld;D&&(J=x.matrixWorldInverse.clone().transpose().copyPosition(J).scale(c.current.scale),J.elements[3]=J.elements[7]=J.elements[11]=0,J.elements[15]=1),w.style.width=y.width+"px",w.style.height=y.height+"px",w.style.perspective=je?"":`${he}px`,F.current&&oe.current&&(F.current.style.transform=`${Ie}${We}translate(${Y}px,${Se}px)`,oe.current.style.transform=yt(J,1/((j||10)/400)))}else{const Y=j===void 0?1:wt(c.current,x)*j;w.style.transform=`translate3d(${v[0]}px,${v[1]}px,0) scale(${Y})`}R.current=v,q.current=x.zoom}}if(!T&&f.current&&!_.current)if(p){if(F.current){const v=F.current.children[0];if(v!=null&&v.clientWidth&&v!=null&&v.clientHeight){const{isOrthographicCamera:K}=x;if(K||A)g.scale&&(Array.isArray(g.scale)?g.scale instanceof I?f.current.scale.copy(g.scale.clone().divideScalar(1)):f.current.scale.set(1/g.scale[0],1/g.scale[1],1/g.scale[2]):f.current.scale.setScalar(1/g.scale));else{const X=(j||10)/400,ne=v.clientWidth*X,ae=v.clientHeight*X;f.current.scale.set(ne,ae,1)}_.current=!0}}}else{const v=w.children[0];if(v!=null&&v.clientWidth&&v!=null&&v.clientHeight){const K=1/V.factor,X=v.clientWidth*K,ne=v.clientHeight*K;f.current.scale.set(X,ne,1),_.current=!0}f.current.lookAt(C.camera.position)}});const we=n.useMemo(()=>({vertexShader:p?void 0:`
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
      `}),[p]);return n.createElement("group",ce({},g,{ref:c}),l&&!T&&n.createElement("mesh",{castShadow:m,receiveShadow:P,ref:f},A||n.createElement("planeGeometry",null),b||n.createElement("shaderMaterial",{side:Oe,vertexShader:we.vertexShader,fragmentShader:we.fragmentShader})))});class Dt extends Le{constructor(e=new re){super({uniforms:{inputBuffer:new k(null),depthBuffer:new k(null),resolution:new k(new re),texelSize:new k(new re),halfTexelSize:new k(new re),kernel:new k(0),scale:new k(1),cameraNear:new k(0),cameraFar:new k(1),minDepthThreshold:new k(0),maxDepthThreshold:new k(1),depthScale:new k(0),depthToBlurRatioBias:new k(.25)},fragmentShader:`#include <common>
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
          #include <${$e>=154?"colorspace_fragment":"encodings_fragment"}>
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
        }`,blending:Ne,depthWrite:!1,depthTest:!1}),this.toneMapped=!1,this.setTexelSize(e.x,e.y),this.kernel=new Float32Array([0,1,2,2,3])}setTexelSize(e,o){this.uniforms.texelSize.value.set(e,o),this.uniforms.halfTexelSize.value.set(e,o).multiplyScalar(.5)}setResolution(e){this.uniforms.resolution.value.copy(e)}}class Tt{constructor({gl:e,resolution:o,width:s=500,height:i=500,minDepthThreshold:a=0,maxDepthThreshold:h=1,depthScale:S=0,depthToBlurRatioBias:j=.25}){this.renderToScreen=!1,this.renderTargetA=new me(o,o,{minFilter:le,magFilter:le,stencilBuffer:!1,depthBuffer:!1,type:Pe}),this.renderTargetB=this.renderTargetA.clone(),this.convolutionMaterial=new Dt,this.convolutionMaterial.setTexelSize(1/s,1/i),this.convolutionMaterial.setResolution(new re(s,i)),this.scene=new He,this.camera=new Ge,this.convolutionMaterial.uniforms.minDepthThreshold.value=a,this.convolutionMaterial.uniforms.maxDepthThreshold.value=h,this.convolutionMaterial.uniforms.depthScale.value=S,this.convolutionMaterial.uniforms.depthToBlurRatioBias.value=j,this.convolutionMaterial.defines.USE_DEPTH=S>0;const D=new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),p=new Float32Array([0,0,2,0,0,2]),l=new Ve;l.setAttribute("position",new ye(D,3)),l.setAttribute("uv",new ye(p,2)),this.screen=new Ze(l,this.convolutionMaterial),this.screen.frustumCulled=!1,this.scene.add(this.screen)}render(e,o,s){const i=this.scene,a=this.camera,h=this.renderTargetA,S=this.renderTargetB;let j=this.convolutionMaterial,D=j.uniforms;D.depthBuffer.value=o.depthTexture;const p=j.kernel;let l=o,B,m,P;for(m=0,P=p.length-1;m<P;++m)B=(m&1)===0?h:S,D.kernel.value=p[m],D.inputBuffer.value=l.texture,e.setRenderTarget(B),e.render(i,a),l=B;D.kernel.value=p[m],D.inputBuffer.value=l.texture,e.setRenderTarget(this.renderToScreen?null:s),e.render(i,a)}}let Rt=class extends qe{constructor(e={}){super(e),this._tDepth={value:null},this._distortionMap={value:null},this._tDiffuse={value:null},this._tDiffuseBlur={value:null},this._textureMatrix={value:null},this._hasBlur={value:!1},this._mirror={value:0},this._mixBlur={value:0},this._blurStrength={value:.5},this._minDepthThreshold={value:.9},this._maxDepthThreshold={value:1},this._depthScale={value:0},this._depthToBlurRatioBias={value:.25},this._distortion={value:1},this._mixContrast={value:1},this.setValues(e)}onBeforeCompile(e){var o;(o=e.defines)!=null&&o.USE_UV||(e.defines.USE_UV=""),e.uniforms.hasBlur=this._hasBlur,e.uniforms.tDiffuse=this._tDiffuse,e.uniforms.tDepth=this._tDepth,e.uniforms.distortionMap=this._distortionMap,e.uniforms.tDiffuseBlur=this._tDiffuseBlur,e.uniforms.textureMatrix=this._textureMatrix,e.uniforms.mirror=this._mirror,e.uniforms.mixBlur=this._mixBlur,e.uniforms.mixStrength=this._blurStrength,e.uniforms.minDepthThreshold=this._minDepthThreshold,e.uniforms.maxDepthThreshold=this._maxDepthThreshold,e.uniforms.depthScale=this._depthScale,e.uniforms.depthToBlurRatioBias=this._depthToBlurRatioBias,e.uniforms.distortion=this._distortion,e.uniforms.mixContrast=this._mixContrast,e.vertexShader=`
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
      `)}get tDiffuse(){return this._tDiffuse.value}set tDiffuse(e){this._tDiffuse.value=e}get tDepth(){return this._tDepth.value}set tDepth(e){this._tDepth.value=e}get distortionMap(){return this._distortionMap.value}set distortionMap(e){this._distortionMap.value=e}get tDiffuseBlur(){return this._tDiffuseBlur.value}set tDiffuseBlur(e){this._tDiffuseBlur.value=e}get textureMatrix(){return this._textureMatrix.value}set textureMatrix(e){this._textureMatrix.value=e}get hasBlur(){return this._hasBlur.value}set hasBlur(e){this._hasBlur.value=e}get mirror(){return this._mirror.value}set mirror(e){this._mirror.value=e}get mixBlur(){return this._mixBlur.value}set mixBlur(e){this._mixBlur.value=e}get mixStrength(){return this._blurStrength.value}set mixStrength(e){this._blurStrength.value=e}get minDepthThreshold(){return this._minDepthThreshold.value}set minDepthThreshold(e){this._minDepthThreshold.value=e}get maxDepthThreshold(){return this._maxDepthThreshold.value}set maxDepthThreshold(e){this._maxDepthThreshold.value=e}get depthScale(){return this._depthScale.value}set depthScale(e){this._depthScale.value=e}get depthToBlurRatioBias(){return this._depthToBlurRatioBias.value}set depthToBlurRatioBias(e){this._depthToBlurRatioBias.value=e}get distortion(){return this._distortion.value}set distortion(e){this._distortion.value=e}get mixContrast(){return this._mixContrast.value}set mixContrast(e){this._mixContrast.value=e}};const Bt=n.forwardRef(({mixBlur:r=0,mixStrength:e=1,resolution:o=256,blur:s=[0,0],minDepthThreshold:i=.9,maxDepthThreshold:a=1,depthScale:h=0,depthToBlurRatioBias:S=.25,mirror:j=0,distortion:D=1,mixContrast:p=1,distortionMap:l,reflectorOffset:B=0,...m},P)=>{Xe({MeshReflectorMaterialImpl:Rt});const b=Q(({gl:f})=>f),A=Q(({camera:f})=>f),O=Q(({scene:f})=>f);s=Array.isArray(s)?s:[s,s];const E=s[0]+s[1]>0,G=s[0],U=s[1],W=n.useRef(null);n.useImperativeHandle(P,()=>W.current,[]);const[g]=n.useState(()=>new Ke),[M]=n.useState(()=>new I),[z]=n.useState(()=>new I),[x]=n.useState(()=>new I),[L]=n.useState(()=>new be),[y]=n.useState(()=>new I(0,0,-1)),[d]=n.useState(()=>new _e),[N]=n.useState(()=>new I),[V]=n.useState(()=>new I),[w]=n.useState(()=>new _e),[$]=n.useState(()=>new be),[c]=n.useState(()=>new ge),q=n.useCallback(()=>{var f;const _=W.current.parent||((f=W.current)==null||(f=f.__r3f.parent)==null?void 0:f.object);if(!_||(z.setFromMatrixPosition(_.matrixWorld),x.setFromMatrixPosition(A.matrixWorld),L.extractRotation(_.matrixWorld),M.set(0,0,1),M.applyMatrix4(L),z.addScaledVector(M,B),N.subVectors(z,x),N.dot(M)>0))return;N.reflect(M).negate(),N.add(z),L.extractRotation(A.matrixWorld),y.set(0,0,-1),y.applyMatrix4(L),y.add(x),V.subVectors(z,y),V.reflect(M).negate(),V.add(z),c.position.copy(N),c.up.set(0,1,0),c.up.applyMatrix4(L),c.up.reflect(M),c.lookAt(V),c.far=A.far,c.updateMatrixWorld(),c.projectionMatrix.copy(A.projectionMatrix),$.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),$.multiply(c.projectionMatrix),$.multiply(c.matrixWorldInverse),$.multiply(_.matrixWorld),g.setFromNormalAndCoplanarPoint(M,z),g.applyMatrix4(c.matrixWorldInverse),d.set(g.normal.x,g.normal.y,g.normal.z,g.constant);const T=c.projectionMatrix;w.x=(Math.sign(d.x)+T.elements[8])/T.elements[0],w.y=(Math.sign(d.y)+T.elements[9])/T.elements[5],w.z=-1,w.w=(1+T.elements[10])/T.elements[14],d.multiplyScalar(2/d.dot(w)),T.elements[2]=d.x,T.elements[6]=d.y,T.elements[10]=d.z+1,T.elements[14]=d.w},[A,B]),[R,F,oe,H]=n.useMemo(()=>{const f={minFilter:le,magFilter:le,type:Pe},_=new me(o,o,f);_.depthBuffer=!0,_.depthTexture=new Ye(o,o),_.depthTexture.format=Je,_.depthTexture.type=Qe;const T=new me(o,o,f),ee=new Tt({gl:b,resolution:o,width:G,height:U,minDepthThreshold:i,maxDepthThreshold:a,depthScale:h,depthToBlurRatioBias:S}),ue={mirror:j,textureMatrix:$,mixBlur:r,tDiffuse:_.texture,tDepth:_.depthTexture,tDiffuseBlur:T.texture,hasBlur:E,mixStrength:e,minDepthThreshold:i,maxDepthThreshold:a,depthScale:h,depthToBlurRatioBias:S,distortion:D,distortionMap:l,mixContrast:p,"defines-USE_BLUR":E?"":void 0,"defines-USE_DEPTH":h>0?"":void 0,"defines-USE_DISTORTION":l?"":void 0};return[_,T,ee,ue]},[b,G,U,$,o,j,E,r,e,i,a,h,S,D,l,p]);return ve(()=>{var f;const _=W.current.parent||((f=W.current)==null||(f=f.__r3f.parent)==null?void 0:f.object);if(!_)return;_.visible=!1;const T=b.xr.enabled,ee=b.shadowMap.autoUpdate;q(),b.xr.enabled=!1,b.shadowMap.autoUpdate=!1,b.setRenderTarget(R),b.state.buffers.depth.setMask(!0),b.autoClear||b.clear(),b.render(O,c),E&&oe.render(b,R,F),b.xr.enabled=T,b.shadowMap.autoUpdate=ee,_.visible=!0,b.setRenderTarget(null)}),n.createElement("meshReflectorMaterialImpl",ce({attach:"material",key:"key"+H["defines-USE_BLUR"]+H["defines-USE_DEPTH"]+H["defines-USE_DISTORTION"],ref:W},H,m))}),Z=1e-5;function Pt(r,e,o){const s=new tt,i=o-Z;return s.absarc(Z,Z,Z,-Math.PI/2,-Math.PI,!0),s.absarc(Z,e-i*2,Z,Math.PI,Math.PI/2,!0),s.absarc(r-i*2,e-i*2,Z,Math.PI/2,0,!0),s.absarc(r-i*2,Z,Z,0,-Math.PI/2,!0),s}const Ut=n.forwardRef(function({args:[e=1,o=1,s=1]=[],radius:i=.05,steps:a=1,smoothness:h=4,bevelSegments:S=4,creaseAngle:j=.4,children:D,...p},l){return n.createElement("mesh",ce({ref:l},p),n.createElement(zt,{args:[e,o,s],radius:i,steps:a,smoothness:h,bevelSegments:S,creaseAngle:j}),D)}),zt=n.forwardRef(function({args:[e=1,o=1,s=1]=[],radius:i=.05,steps:a=1,smoothness:h=4,bevelSegments:S=4,creaseAngle:j=.4,...D},p){const l=n.useMemo(()=>Pt(e,o,i),[e,o,i]),B=n.useMemo(()=>({depth:s-i*2,bevelEnabled:!0,bevelSegments:S*2,steps:a,bevelSize:i-Z,bevelThickness:i,curveSegments:h}),[s,i,h,S,a]),m=n.useRef(null);return n.useLayoutEffect(()=>{m.current&&(m.current.center(),et(m.current,j))},[l,B,j]),n.useImperativeHandle(p,()=>m.current),n.createElement("extrudeGeometry",ce({ref:m,args:[l,B]},D))}),Et={alpha:!0,antialias:!0},Ft={type:ot},Ct={position:[23,25,29],fov:35,near:.1,far:150};function kt(){const{gl:r,scene:e}=Q();return n.useEffect(()=>{const o=new lt(r),s=new at,i=o.fromScene(s,.025);return e.environment=i.texture,e.environmentIntensity=.55,()=>{e.environment=null,i.dispose(),s.dispose(),o.dispose()}},[r,e]),null}function u({position:r,size:e,color:o="#182a3e",glow:s,rotation:i}){return Math.min(...e)<.2?t.jsxs("mesh",{position:r,rotation:i,castShadow:!0,receiveShadow:!0,children:[t.jsx("boxGeometry",{args:e}),t.jsx("meshStandardMaterial",{color:o,roughness:.33,metalness:.55,emissive:s??"#000000",emissiveIntensity:s?.65:0})]}):t.jsx(Ut,{args:e,position:r,rotation:i,radius:.055,smoothness:2,castShadow:!0,receiveShadow:!0,children:t.jsx("meshStandardMaterial",{color:o,roughness:.33,metalness:.55,emissive:s??"#000000",emissiveIntensity:s?.65:0})})}function se({position:r,radius:e,color:o,rotation:s=[-Math.PI/2,0,0],thickness:i=.025}){return t.jsxs("mesh",{position:r,rotation:s,children:[t.jsx("torusGeometry",{args:[e,i,8,80]}),t.jsx("meshStandardMaterial",{color:o,emissive:o,emissiveIntensity:1.1,roughness:.2,metalness:.65})]})}function Wt({color:r}){return t.jsxs("group",{children:[[-1.1,0,1.1].map((e,o)=>t.jsxs("group",{position:[e,.4,0],rotation:[0,-.22+o*.22,-.08+o*.08],children:[t.jsx(u,{size:[.85,1.65+o*.35,.55],position:[0,1+o*.16,0],color:"#b8c9d6"}),t.jsx(u,{size:[.08,1.69+o*.35,.61],position:[-.43,1+o*.16,0],color:"#22658b",glow:r}),[.4,.75,1.1].map(s=>t.jsx(u,{size:[.48,.025,.02],position:[.03,s+o*.35,.289],color:"#3b5a6c"},s))]},e)),t.jsx(u,{size:[4.2,.09,.12],position:[0,3.35,-.9],color:r,glow:r}),[-2,2].map(e=>t.jsx(u,{size:[.1,3.1,.12],position:[e,1.8,-.9],color:"#517888"},e))]})}function It({color:r}){return t.jsxs("group",{children:[t.jsx(u,{size:[2.8,.3,2.2],position:[0,.45,0],color:"#273b4c"}),[-1.25,1.25].map(e=>t.jsxs("group",{children:[t.jsx(u,{size:[.16,2.7,.18],position:[e,1.95,-.7],color:"#b6c0bd"}),t.jsx(u,{size:[.035,2.3,.2],position:[e,1.95,-.6],color:r,glow:r})]},e)),t.jsx(u,{size:[2.8,.15,.5],position:[0,3.32,-.7],color:"#d1c7b7"}),t.jsxs("mesh",{position:[0,1.85,0],rotation:[.3,.6,.25],castShadow:!0,children:[t.jsx("icosahedronGeometry",{args:[.82,0]}),t.jsx("meshStandardMaterial",{color:"#a47f47",metalness:.8,roughness:.22})]}),t.jsx(se,{position:[0,1.85,0],radius:1.15,color:r,rotation:[Math.PI/2.8,.1,.2]}),[-.6,-.3,0,.3,.6].map((e,o)=>t.jsx(u,{position:[e,.73+Math.sin(o)*.08,1],size:[.11,.3+o%3*.17,.1],color:r,glow:r},e))]})}function At({color:r}){return t.jsxs("group",{children:[t.jsx(u,{size:[3.4,.25,2.2],position:[0,.48,0],color:"#3e585c"}),t.jsxs("mesh",{position:[0,1.75,0],rotation:[0,.35,.45],castShadow:!0,children:[t.jsx("torusGeometry",{args:[.85,.23,12,36]}),t.jsx("meshStandardMaterial",{color:"#aab9b8",metalness:.86,roughness:.27})]}),t.jsx(se,{position:[0,1.75,0],radius:1.35,color:r,rotation:[0,.35,.45],thickness:.018}),[-1,1].map(e=>t.jsx(u,{size:[.45,.5,.5],position:[e*1.15,1.75,0],color:"#527b76"},e)),t.jsx(u,{size:[.12,1.1,.14],position:[0,1.05,0],color:"#3b565b"}),t.jsx(u,{size:[2.7,.07,.08],position:[0,.66,1.11],color:r,glow:r})]})}function Ot({color:r}){return t.jsxs("group",{children:[t.jsx(u,{size:[2.7,.3,2],position:[0,.48,0],color:"#354354"}),t.jsx("group",{position:[0,1.25,.1],rotation:[-.5,0,0],children:[-1,1].map(e=>t.jsxs("group",{rotation:[0,0,e*-.3],children:[t.jsx(u,{size:[1.05,.16,1.5],position:[e*.5,.2,0],color:"#c3d0d9"}),[-.45,-.15,.15,.45].map(o=>t.jsx(u,{size:[.65,.018,.02],position:[e*.52,.29,o],color:"#5a7484"},o))]},e))}),t.jsx(se,{position:[0,2.7,-.6],radius:.85,color:r,rotation:[.2,.25,0],thickness:.022}),[0,1,2].map(e=>t.jsxs("mesh",{position:[Math.cos(e*Math.PI*2/3)*.85,2.7+Math.sin(e*Math.PI*2/3)*.85,-.6],castShadow:!0,children:[t.jsx("sphereGeometry",{args:[.13,16,12]}),t.jsx("meshStandardMaterial",{color:"#dae7ec",metalness:.7,roughness:.2})]},e))]})}function Lt({zone:r,selected:e,onSelect:o}){const s=xe(),i=r.color;return t.jsxs("group",{position:[r.x,0,r.z],children:[t.jsxs("group",{onClick:a=>{a.stopPropagation(),o(r.id)},children:[t.jsxs("mesh",{position:[0,.13,0],receiveShadow:!0,castShadow:!0,children:[t.jsx("cylinderGeometry",{args:[2.7,2.8,.25,64]}),t.jsx("meshStandardMaterial",{color:e?"#294b60":"#1a3042",metalness:.72,roughness:.35})]}),t.jsx(se,{position:[0,.27,0],radius:2.65,color:i,thickness:e?.045:.018}),r.id==="knowledge"&&t.jsx(Wt,{color:i}),r.id==="diagnosis"&&t.jsx(It,{color:i}),r.id==="models"&&t.jsx(At,{color:i}),r.id==="research"&&t.jsx(Ot,{color:i})]}),t.jsx(_t,{position:[0,4,0],center:!0,zIndexRange:[8,4],className:"world-label-wrap",children:t.jsxs("button",{type:"button",className:`world-zone-label${e?" is-selected":""}`,style:{"--zone-color":i},onClick:()=>o(r.id),children:[t.jsxs("span",{children:[r.number," / ",s==="zh"?"展区":"ZONE"]}),t.jsxs("strong",{children:[s==="zh"?r.zh:r.en,t.jsx(pt,{size:13})]})]})})]})}function Nt(){const r=Re()==="dark",e=Q(s=>s.size.width<700),o=n.useMemo(()=>Array.from({length:12},(s,i)=>-11+i*2),[]);return t.jsxs("group",{children:[t.jsx(u,{position:[0,-.5,0],size:[29,.9,24],color:r?"#202e3a":"#c4d3df"}),t.jsxs("mesh",{rotation:[-Math.PI/2,0,0],position:[0,-.035,0],receiveShadow:!0,children:[t.jsx("planeGeometry",{args:[28.7,23.7]}),t.jsx(Bt,{resolution:e?128:256,blur:e?[0,0]:[40,20],mixBlur:e?0:.75,mixStrength:1.3,mirror:.3,color:r?"#293c4b":"#b5c9d7",roughness:.65,metalness:.7,depthScale:.4,minDepthThreshold:.4,maxDepthThreshold:1.4})]}),[-1,1].map(s=>t.jsxs("group",{children:[t.jsx(u,{position:[0,-.02,s*11.9],size:[28.5,.025,.035],color:"#6fa8b9",glow:"#63c4d4"}),t.jsx(u,{position:[s*14.35,-.02,0],size:[.035,.025,23.6],color:"#6fa8b9",glow:"#63c4d4"}),t.jsx(u,{position:[s*2,.01,0],size:[.025,.018,22.8],color:"#668696"}),t.jsx(u,{position:[0,.01,s*1.95],size:[27,.018,.025],color:"#668696"}),o.map(i=>t.jsxs("group",{position:[i,0,s*11.35],children:[t.jsx(u,{size:[.1,.35,.1],position:[0,.18,0],color:"#283d4b"}),t.jsx(u,{size:[.14,.04,.14],position:[0,.37,0],color:"#a7d4dd",glow:"#b3e9f4"})]},i))]},s)),[-10,-7,-4,4,7,10].map(s=>t.jsxs("group",{children:[t.jsx(u,{position:[s,.012,0],size:[.6,.018,.025],color:"#94aab4"}),t.jsx(u,{position:[0,.012,s],size:[.025,.018,.6],color:"#94aab4"})]},s)),t.jsx(se,{position:[0,.025,0],radius:3.2,color:r?"#cfb785":"#a17c38",thickness:.013}),t.jsx(se,{position:[0,.025,0],radius:2.9,color:"#254353",thickness:.014}),[-1,1].map(s=>t.jsxs("group",{position:[s*13.15,0,0],children:[t.jsx(u,{size:[.5,3.4,.6],position:[0,1.7,-1.1],color:"#283e4c"}),t.jsx(u,{size:[.5,3.4,.6],position:[0,1.7,1.1],color:"#283e4c"}),t.jsx(u,{size:[.5,.25,3],position:[0,3.5,0],color:"#617f8a"}),t.jsx(u,{size:[.03,2.7,.06],position:[-s*.26,1.8,-1.1],color:"#93ddde",glow:"#a4efed"})]},s)),fe.map(s=>t.jsxs("group",{position:[s.x*1.4,0,s.z*1.75],children:[t.jsx(u,{size:[1.7,.3,.75],position:[0,.14,0],color:"#293e48"}),[-.5,0,.5].map(i=>t.jsxs("mesh",{position:[i,.48,0],castShadow:!0,children:[t.jsx("icosahedronGeometry",{args:[.37,0]}),t.jsx("meshStandardMaterial",{color:"#3f796e",roughness:.9})]},i))]},s.id))]})}function $t({mode:r,selected:e,focus:o,destination:s,reset:i,input:a,reducedMotion:h,onSelect:S,onPosition:j,onNearby:D,onLoaded:p}){const l=n.useRef(null),B=n.useRef(null),m=n.useRef(de()),P=n.useRef([]),b=n.useRef(null),A=n.useRef(0),O=n.useRef(de()),E=n.useRef(!0),G=n.useMemo(()=>new I,[]),U=n.useMemo(()=>new I,[]),{camera:W,size:g,invalidate:M}=Q(),z=Re();return n.useEffect(()=>{M()},[z,M]),n.useEffect(()=>(a.wake=M,()=>{a.wake=void 0}),[a,M]),n.useEffect(()=>{m.current=de(),O.current={...m.current},P.current=[],b.current=null,a.actions.clear(),E.current=!0,D(null),j({...m.current}),M()},[i,a,M,D,j]),n.useEffect(()=>{P.current=s?ct(m.current,s.id):[],M()},[s,M]),n.useEffect(()=>{E.current=!0,r==="overview"&&(P.current=[],a.actions.clear()),M()},[r,o,g.width,g.height,a,M]),ve((x,L)=>{const y=new Set(a.actions.values());if(y.size&&(P.current=[]),r==="drive"){let c=Math.min(L,.2);for(;c>0;){const q=Math.min(c,.05);if(P.current.length){const R=ut(m.current,P.current[0],q);m.current=R.state,R.arrived&&P.current.shift()}else m.current=ht(m.current,y,q);c-=q}}else m.current.speed=0;const d=m.current;l.current&&(l.current.position.set(d.x,.4,d.z),l.current.rotation.y=d.heading);const N=dt(d.x,d.z);N!==b.current&&(b.current=N,D(N));const V=r==="drive"&&(y.size>0||P.current.length>0||Math.abs(d.speed)>.01),w=O.current;if((d.x!==w.x||d.z!==w.z||d.heading!==w.heading)&&(x.clock.elapsedTime-A.current>.18||!V)&&(O.current={...d},j(O.current),A.current=x.clock.elapsedTime),r==="drive"||E.current){if(r==="drive")G.set(d.x,.5,d.z),U.set(d.x+8,7,d.z+10),g.width<650&&U.set(d.x+8,11,d.z+14);else if(o){const R=fe.find(F=>F.id===o);G.set(R.x,.8,R.z),U.set(R.x+9,9,R.z+12),g.width<650&&U.set(R.x+10,13,R.z+18)}else{G.set(0,0,0);const R=g.width/g.height,F=Math.max(1,1.25/R);U.set(23*F,25*F,29*F)}const c=h?1:1-Math.exp(-5*Math.min(L,.2));W.position.lerp(U,c),B.current?.target.lerp(G,c),B.current?.update(),W.position.distanceToSquared(U)>8e-4||(B.current?.target.distanceToSquared(G)??0)>8e-4||V?M():E.current=!1}V&&M()}),t.jsxs(t.Fragment,{children:[t.jsx("fog",{attach:"fog",args:[z==="dark"?"#18232e":"#eaf0f5",42,100]}),t.jsx("ambientLight",{intensity:z==="dark"?.85:1.15,color:"#d6e2eb"}),t.jsx("directionalLight",{position:[-8,18,10],intensity:3.2,color:"#fff3db",castShadow:!0,"shadow-mapSize":g.width<700?[512,512]:[1024,1024],"shadow-camera-left":-18,"shadow-camera-right":18,"shadow-camera-top":18,"shadow-camera-bottom":-18,"shadow-camera-far":60,"shadow-bias":-15e-5,"shadow-normalBias":.025}),t.jsx("directionalLight",{position:[8,6,-12],intensity:1.8,color:"#80caff"}),t.jsx(kt,{}),t.jsx(Nt,{}),fe.map(x=>t.jsx(Lt,{zone:x,selected:e===x.id,onSelect:S},x.id)),t.jsx(n.Suspense,{fallback:null,children:t.jsx("group",{ref:l,children:t.jsx(nt,{onLoaded:p})})}),t.jsx(it,{ref:B,makeDefault:!0,enabled:r==="overview",enablePan:!1,enableDamping:!h,minDistance:9,maxDistance:100,minPolarAngle:.15,maxPolarAngle:Math.PI/2.4,onStart:()=>{E.current=!1}})]})}function Te(){const r=xe();return t.jsxs("div",{className:"world-fallback",children:[t.jsx(ft,{size:70,strokeWidth:1}),t.jsx("h2",{children:r==="zh"?"三维空间暂不可用":"3D space is unavailable"}),t.jsx("p",{children:r==="zh"?"通过展区导航，仍可进入知识库、诊断和模型工坊。":"Use the zone navigation to open knowledge, diagnosis and the model studio."})]})}function lr(r){const e=xe(),[o,s]=n.useState(!1),[i]=n.useState(()=>{try{const h=document.createElement("canvas").getContext("webgl2");return h?.getExtension("WEBGL_lose_context")?.loseContext(),!!h}catch{return!1}}),a=n.useCallback(()=>s(!0),[]);return i?t.jsxs(rt,{FallbackComponent:Te,children:[t.jsx(st,{shadows:Ft,camera:Ct,gl:Et,dpr:[1,1.25],frameloop:"demand",role:"group","aria-label":e==="zh"?"农机三维园区，四个展区围绕中央广场":"3D machinery campus with four pavilions around a central plaza",children:t.jsx($t,{...r,onLoaded:a})}),!o&&t.jsxs("div",{className:"world-loading",role:"status",children:[t.jsx(mt,{size:20}),t.jsx("span",{children:e==="zh"?"正在打开三维园区…":"Opening the 3D campus…"})]})]}):t.jsx(Te,{})}export{lr as default};
