import{S as i}from"./index-CTpkvEmL.js";import"./clipPlaneFragment-C4Ju6WAT.js";import"./logDepthDeclaration-Bsmc3zVG.js";import"./logDepthFragment-EpsfN_WK.js";const e="linePixelShader",n=`#include<clipPlaneFragmentDeclaration>
uniform vec4 color;
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<logDepthFragment>
#include<clipPlaneFragment>
gl_FragColor=color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;i.ShadersStore[e]||(i.ShadersStore[e]=n);const t={name:e,shader:n};export{t as linePixelShader};
