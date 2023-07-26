import * as THREE from 'three';
import TweenMax from 'gsap/TweenMax';

export default function (opts) {

  var vertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

  var fragment = `
varying vec2 vUv;

uniform float dispFactor;
uniform float dpr;
uniform sampler2D disp;

uniform sampler2D texture1;
uniform sampler2D texture2;
uniform float angle1;
uniform float angle2;
uniform float intensity1;
uniform float intensity2;
uniform vec4 res;
uniform vec2 parent;

mat2 getRotM(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec4 disp = texture2D(disp, vUv);
  vec2 dispVec = vec2(disp.r, disp.g);

  vec2 uv = 0.5 * gl_FragCoord.xy / (res.xy) ;
  vec2 myUV = (uv - vec2(0.5))*res.zw + vec2(0.5);


  vec2 distortedPosition1 = myUV + getRotM(angle1) * dispVec * intensity1 * dispFactor;
  vec2 distortedPosition2 = myUV + getRotM(angle2) * dispVec * intensity2 * (1.0 - dispFactor);
  vec4 _texture1 = texture2D(texture1, distortedPosition1);
  vec4 _texture2 = texture2D(texture2, distortedPosition2);
  gl_FragColor = mix(_texture1, _texture2, dispFactor);
}
`;

  function firstDefined() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] !== undefined) return arguments[i];
    }
  }

  var parent = opts.parent;
  var dispImage = opts.displacementImage;
  var images = opts.images;

  if (!(images[0] && images[1] && dispImage)) {
    console.warn('One or more images are missing');
    return;
  }

  var imagesRatio = firstDefined(opts.imagesRatio, 1.0);
  var intensity1 = firstDefined(opts.intensity1, opts.intensity, 1);
  var intensity2 = firstDefined(opts.intensity2, opts.intensity, 0,5);
  var commonAngle = firstDefined(opts.angle, Math.PI / 4); // 45 degrees by default, so grayscale images work correctly
  var angle1 = firstDefined(opts.angle1, commonAngle);
  var angle2 = firstDefined(opts.angle2, -commonAngle * 3);
  var speed = opts.speed;
  var autoplay = opts.autoplay ? opts.autoplay : false;
  var autoplaySpeed = opts.autoplaySpeed ? opts.autoplaySpeed : 5000;
  var easing = firstDefined(opts.easing, Expo.easeOut);

  if (!parent) {
    console.warn('Parent missing');
    return;
  }

  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(
    parent.offsetWidth / -2,
    parent.offsetWidth / 2,
    parent.offsetHeight / 2,
    parent.offsetHeight / -2,
    1,
    1000
  );

  camera.position.z = 1;

  var renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true
  });

  renderer.setPixelRatio(2.0);
  renderer.setClearColor(0xffffff, 0.0);
  renderer.setSize(parent.offsetWidth, parent.offsetHeight);
  parent.appendChild(renderer.domElement);

  var render = function () {
    // This will be called by the TextureLoader as well as TweenMax.
    renderer.render(scene, camera);
  };

  var loader = new THREE.TextureLoader();
  loader.crossOrigin = '';

  var disp = loader.load(dispImage, render);
  disp.magFilter = disp.minFilter = THREE.LinearFilter;

  const textures = [];
  for (let i = 0; images.length > i; i++) {
    textures[i] = loader.load(images[i], render);
    textures[i].magFilter = THREE.LinearFilter;
    textures[i].minFilter = THREE.LinearFilter;
  }

  let a1, a2;
  var imageAspect = imagesRatio;
  if (parent.offsetHeight / parent.offsetWidth < imageAspect) {
    a1 = 1;
    a2 = parent.offsetHeight / parent.offsetWidth / imageAspect;
  } else {
    a1 = (parent.offsetWidth / parent.offsetHeight) * imageAspect;
    a2 = 1;
  }

  var mat = new THREE.ShaderMaterial({
    uniforms: {
      intensity1: {
        type: 'f',
        value: intensity1
      },
      intensity2: {
        type: 'f',
        value: intensity2
      },
      dispFactor: {
        type: 'f',
        value: 0
      },
      angle1: {
        type: 'f',
        value: angle1
      },
      angle2: {
        type: 'f',
        value: angle2
      },
      texture1: {
        type: 't',
        value: textures[0]
      },
      texture2: {
        type: 't',
        value: textures[1]
      },
      disp: {
        type: 't',
        value: disp
      },
      res: {
        type: 'vec4',
        value: new THREE.Vector4(parent.offsetWidth, parent.offsetHeight, a1, a2)
      },
      dpr: {
        type: 'f',
        value: window.devicePixelRatio
      }
    },

    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    opacity: 1.0,
  });

  var geometry = new THREE.PlaneBufferGeometry(parent.offsetWidth, parent.offsetHeight, 1);
  var object = new THREE.Mesh(geometry, mat);
  scene.add(object);

  let index = 0;

  function next() {
    if (autoplayInterval) {
      clearInterval(autoplayInterval);
    }
    nextSlide();
  }

  function prev() {
    if (autoplayInterval) {
      clearInterval(autoplayInterval);
    }
    prevSlide();
  }

  function autoplay() {
    nextSlide();
  }

  function nextSlide() {

    index = index + 1;

    if (textures.length == index) {
      index = 0;
      dfValue = 0;
    }
      
    let dfValue = Math.round(mat.uniforms.dispFactor.value);
    if (dfValue == 0) {
      dfValue = 1;
      mat.uniforms.texture2.value = textures[index];
    } else {
      dfValue = 0;
      mat.uniforms.texture1.value = textures[index];
    }

    changeSlide(dfValue);
  }

  function prevSlide() {

    index = index - 1;

    if (index == -1) {
      index = textures.length - 1;
      dfValue = 0;
    }

    let dfValue = Math.round(mat.uniforms.dispFactor.value);
    if (dfValue == 0) {
      dfValue = 1;
      mat.uniforms.texture2.value = textures[index];
    } else {
      dfValue = 0;
      mat.uniforms.texture1.value = textures[index];
    }
    
    changeSlide(dfValue);
  }

  function changeSlide(dfValue) {
    TweenMax.to(mat.uniforms.dispFactor, speed, {
      value: dfValue,
      ease: easing,
      onUpdate: render,
      onComplete: render,
    });
  }

  window.addEventListener('resize', function (e) {
    if (parent.offsetHeight / parent.offsetWidth < imageAspect) {
      a1 = 1;
      a2 = parent.offsetHeight / parent.offsetWidth / imageAspect;
    } else {
      a1 = (parent.offsetWidth / parent.offsetHeight) * imageAspect;
      a2 = 1;
    }
    object.material.uniforms.res.value = new THREE.Vector4(parent.offsetWidth, parent.offsetHeight, a1, a2);
    renderer.setSize(parent.offsetWidth, parent.offsetHeight);

    render()
  });

  if (autoplay) {
    autoplayInterval = setInterval(nextSlide, autoplaySpeed);
  }

  this.next = next;
  this.prev = prev;
};
