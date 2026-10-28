import{S as i}from"./index-BU7_MoXw.js";import"./clipPlaneFragment-C8tsgk9Z.js";import"./logDepthDeclaration-BvaC203I.js";import"./logDepthFragment-CR6Q0Qsb.js";const e="linePixelShader",n=`#include<clipPlaneFragmentDeclaration>
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
