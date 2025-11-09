import{l as b,P as g,U as p,S as _,F as x,y as a,Q as P,X as M,c as L,o as U,p as C,s as T,i as R,Y as Q,Z as E,q as I,E as W,R as A,_ as G,G as X,t as H,$ as j,O as q}from"./RenderPass-DpzUg9Ym.js";b();const m={uniforms:{tDiffuse:{value:null},tDisp:{value:null},byp:{value:0},amount:{value:.08},angle:{value:.02},seed:{value:.02},seed_x:{value:.02},seed_y:{value:.02},distortion_x:{value:.5},distortion_y:{value:.6},col_s:{value:.05}},vertexShader:`

		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`

		uniform int byp; //should we apply the glitch ?

		uniform sampler2D tDiffuse;
		uniform sampler2D tDisp;

		uniform float amount;
		uniform float angle;
		uniform float seed;
		uniform float seed_x;
		uniform float seed_y;
		uniform float distortion_x;
		uniform float distortion_y;
		uniform float col_s;

		varying vec2 vUv;


		float rand(vec2 co){
			return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
		}

		void main() {
			if(byp<1) {
				vec2 p = vUv;
				float xs = floor(gl_FragCoord.x / 0.5);
				float ys = floor(gl_FragCoord.y / 0.5);
				//based on staffantans glitch shader for unity https://github.com/staffantan/unityglitch
				float disp = texture2D(tDisp, p*seed*seed).r;
				if(p.y<distortion_x+col_s && p.y>distortion_x-col_s*seed) {
					if(seed_x>0.){
						p.y = 1. - (p.y + distortion_y);
					}
					else {
						p.y = distortion_y;
					}
				}
				if(p.x<distortion_y+col_s && p.x>distortion_y-col_s*seed) {
					if(seed_y>0.){
						p.x=distortion_x;
					}
					else {
						p.x = 1. - (p.x + distortion_x);
					}
				}
				p.x+=disp*seed_x*(seed/5.);
				p.y+=disp*seed_y*(seed/5.);
				//base from RGB shift shader
				vec2 offset = amount * vec2( cos(angle), sin(angle));
				vec4 cr = texture2D(tDiffuse, p + offset);
				vec4 cga = texture2D(tDiffuse, p);
				vec4 cb = texture2D(tDiffuse, p - offset);
				gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
				//add noise
				vec4 snow = 200.*amount*vec4(rand(vec2(xs * seed,ys * seed*50.))*0.2);
				gl_FragColor = gl_FragColor+ snow;
			}
			else {
				gl_FragColor=texture2D (tDiffuse, vUv);
			}
		}`};class B extends g{constructor(e=64){super(),this.uniforms=p.clone(m.uniforms),this.material=new _({uniforms:this.uniforms,vertexShader:m.vertexShader,fragmentShader:m.fragmentShader}),this.goWild=!1,this._heightMap=this._generateHeightmap(e),this.uniforms.tDisp.value=this.heightMap,this._fsQuad=new x(this.material),this._curF=0,this._randX=0,this._generateTrigger()}render(e,s,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.seed.value=Math.random(),this.uniforms.byp.value=0,this._curF%this._randX==0||this.goWild==!0?(this.uniforms.amount.value=Math.random()/30,this.uniforms.angle.value=a.randFloat(-Math.PI,Math.PI),this.uniforms.seed_x.value=a.randFloat(-1,1),this.uniforms.seed_y.value=a.randFloat(-1,1),this.uniforms.distortion_x.value=a.randFloat(0,1),this.uniforms.distortion_y.value=a.randFloat(0,1),this._curF=0,this._generateTrigger()):this._curF%this._randX<this._randX/5?(this.uniforms.amount.value=Math.random()/90,this.uniforms.angle.value=a.randFloat(-Math.PI,Math.PI),this.uniforms.distortion_x.value=a.randFloat(0,1),this.uniforms.distortion_y.value=a.randFloat(0,1),this.uniforms.seed_x.value=a.randFloat(-.3,.3),this.uniforms.seed_y.value=a.randFloat(-.3,.3)):this.goWild==!1&&(this.uniforms.byp.value=1),this._curF++,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(s),this.clear&&e.clear(),this._fsQuad.render(e))}dispose(){this.material.dispose(),this.heightMap.dispose(),this._fsQuad.dispose()}_generateTrigger(){this._randX=a.randInt(120,240)}_generateHeightmap(e){const s=new Float32Array(e*e),i=e*e;for(let c=0;c<i;c++){const S=a.randFloat(0,1);s[c]=S}const u=new P(s,e,e,M,L);return u.needsUpdate=!0,u}}const N={name:"FilmShader",uniforms:{tDiffuse:{value:null},time:{value:0},intensity:{value:.5},grayscale:{value:!1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#include <common>

		uniform float intensity;
		uniform bool grayscale;
		uniform float time;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 base = texture2D( tDiffuse, vUv );

			float noise = rand( fract( vUv + time ) );

			vec3 color = base.rgb + base.rgb * clamp( 0.1 + noise, 0.0, 1.0 );

			color = mix( base.rgb, color, intensity );

			if ( grayscale ) {

				color = vec3( luminance( color ) ); // assuming linear-srgb

			}

			gl_FragColor = vec4( color, base.a );

		}`};class O extends g{constructor(e=.5,s=!1){super();const i=N;this.uniforms=p.clone(i.uniforms),this.material=new _({name:i.name,uniforms:this.uniforms,vertexShader:i.vertexShader,fragmentShader:i.fragmentShader}),this.uniforms.intensity.value=e,this.uniforms.grayscale.value=s,this._fsQuad=new x(this.material)}render(e,s,i,u){this.uniforms.tDiffuse.value=i.texture,this.uniforms.time.value+=u,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(s),this.clear&&e.clear(),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}const V={name:"LuminosityShader",uniforms:{tDiffuse:{value:null}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#include <common>

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float l = luminance( texel.rgb );

			gl_FragColor = vec4( l, l, l, texel.w );

		}`},h=2e3,k=0,l=new U,f=new C(60,window.innerWidth/window.innerHeight,.1,1e3);f.position.set(0,17,40);const d=new T({canvas:document.getElementById("three-canvas"),antialias:!0});d.setSize(window.innerWidth,window.innerHeight);d.setPixelRatio(Math.min(window.devicePixelRatio,2));d.outputColorSpace=R;const y=new Q(16777215,4473924,.8);y.position.set(0,20,0);l.add(y);const Y=new E(16777215,.6);l.add(Y);const w=new I(16777215,1.2);w.position.set(3,10,10);l.add(w);const r=new W(d);r.addPass(new A(l,f));const J=new G(V);r.addPass(J);const F=new B;F.goWild=!1;r.addPass(F);const Z=new O(.35,.025,648,!1);r.addPass(Z);const $=new X;let n=null,o=null,v=!1;const K=new URL("/Amro-s-Final-Project/assets/helmet-model-B3J3g0P6.glb",import.meta.url).toString();$.load(K,t=>{const e=t.scene;if(l.add(e),t.animations&&t.animations.length>0){n=new H(e);const s=t.animations[Math.min(k,t.animations.length-1)];o=n.clipAction(s),o.setLoop(j,0),o.clampWhenFinished=!0,o.paused=!0,n.addEventListener("finished",()=>{o.paused=!0,o.enabled=!0,o.time=o.getClip().duration,n.update(0)}),setTimeout(()=>{if(o&&!v){v=!0,o.reset(),o.paused=!1,o.play();const i=document.querySelector(".about-overlay");i&&i.classList.add("visible")}},h)}else setTimeout(()=>{const s=document.querySelector(".about-overlay");s&&s.classList.add("visible")},h)},void 0,t=>console.error("Error loading GLTF:",t));window.addEventListener("resize",()=>{const t=window.innerWidth,e=window.innerHeight;f.aspect=t/e,f.updateProjectionMatrix(),d.setSize(t,e),r.setSize(t,e)});const z=new q;function D(){requestAnimationFrame(D);const t=z.getDelta();n&&n.update(t),r.render()}D();
