(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))s(o);new MutationObserver(o=>{for(const l of o)if(l.type==="childList")for(const u of l.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&s(u)}).observe(document,{childList:!0,subtree:!0});function t(o){const l={};return o.integrity&&(l.integrity=o.integrity),o.referrerPolicy&&(l.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?l.credentials="include":o.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function s(o){if(o.ep)return;o.ep=!0;const l=t(o);fetch(o.href,l)}})();function n_(n){return n&&n.__esModule&&Object.prototype.hasOwnProperty.call(n,"default")?n.default:n}var Fd={exports:{}},ha={},kd={exports:{}},pt={};/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Ev;function DE(){if(Ev)return pt;Ev=1;var n=Symbol.for("react.element"),e=Symbol.for("react.portal"),t=Symbol.for("react.fragment"),s=Symbol.for("react.strict_mode"),o=Symbol.for("react.profiler"),l=Symbol.for("react.provider"),u=Symbol.for("react.context"),d=Symbol.for("react.forward_ref"),f=Symbol.for("react.suspense"),p=Symbol.for("react.memo"),v=Symbol.for("react.lazy"),g=Symbol.iterator;function y(U){return U===null||typeof U!="object"?null:(U=g&&U[g]||U["@@iterator"],typeof U=="function"?U:null)}var x={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},w=Object.assign,A={};function E(U,J,Oe){this.props=U,this.context=J,this.refs=A,this.updater=Oe||x}E.prototype.isReactComponent={},E.prototype.setState=function(U,J){if(typeof U!="object"&&typeof U!="function"&&U!=null)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,U,J,"setState")},E.prototype.forceUpdate=function(U){this.updater.enqueueForceUpdate(this,U,"forceUpdate")};function _(){}_.prototype=E.prototype;function N(U,J,Oe){this.props=U,this.context=J,this.refs=A,this.updater=Oe||x}var I=N.prototype=new _;I.constructor=N,w(I,E.prototype),I.isPureReactComponent=!0;var R=Array.isArray,k=Object.prototype.hasOwnProperty,B={current:null},H={key:!0,ref:!0,__self:!0,__source:!0};function Y(U,J,Oe){var Fe,V={},re=null,ne=null;if(J!=null)for(Fe in J.ref!==void 0&&(ne=J.ref),J.key!==void 0&&(re=""+J.key),J)k.call(J,Fe)&&!H.hasOwnProperty(Fe)&&(V[Fe]=J[Fe]);var _e=arguments.length-2;if(_e===1)V.children=Oe;else if(1<_e){for(var Ae=Array(_e),Ie=0;Ie<_e;Ie++)Ae[Ie]=arguments[Ie+2];V.children=Ae}if(U&&U.defaultProps)for(Fe in _e=U.defaultProps,_e)V[Fe]===void 0&&(V[Fe]=_e[Fe]);return{$$typeof:n,type:U,key:re,ref:ne,props:V,_owner:B.current}}function b(U,J){return{$$typeof:n,type:U.type,key:J,ref:U.ref,props:U.props,_owner:U._owner}}function C(U){return typeof U=="object"&&U!==null&&U.$$typeof===n}function D(U){var J={"=":"=0",":":"=2"};return"$"+U.replace(/[=:]/g,function(Oe){return J[Oe]})}var de=/\/+/g;function ie(U,J){return typeof U=="object"&&U!==null&&U.key!=null?D(""+U.key):J.toString(36)}function le(U,J,Oe,Fe,V){var re=typeof U;(re==="undefined"||re==="boolean")&&(U=null);var ne=!1;if(U===null)ne=!0;else switch(re){case"string":case"number":ne=!0;break;case"object":switch(U.$$typeof){case n:case e:ne=!0}}if(ne)return ne=U,V=V(ne),U=Fe===""?"."+ie(ne,0):Fe,R(V)?(Oe="",U!=null&&(Oe=U.replace(de,"$&/")+"/"),le(V,J,Oe,"",function(Ie){return Ie})):V!=null&&(C(V)&&(V=b(V,Oe+(!V.key||ne&&ne.key===V.key?"":(""+V.key).replace(de,"$&/")+"/")+U)),J.push(V)),1;if(ne=0,Fe=Fe===""?".":Fe+":",R(U))for(var _e=0;_e<U.length;_e++){re=U[_e];var Ae=Fe+ie(re,_e);ne+=le(re,J,Oe,Ae,V)}else if(Ae=y(U),typeof Ae=="function")for(U=Ae.call(U),_e=0;!(re=U.next()).done;)re=re.value,Ae=Fe+ie(re,_e++),ne+=le(re,J,Oe,Ae,V);else if(re==="object")throw J=String(U),Error("Objects are not valid as a React child (found: "+(J==="[object Object]"?"object with keys {"+Object.keys(U).join(", ")+"}":J)+"). If you meant to render a collection of children, use an array instead.");return ne}function fe(U,J,Oe){if(U==null)return U;var Fe=[],V=0;return le(U,Fe,"","",function(re){return J.call(Oe,re,V++)}),Fe}function ce(U){if(U._status===-1){var J=U._result;J=J(),J.then(function(Oe){(U._status===0||U._status===-1)&&(U._status=1,U._result=Oe)},function(Oe){(U._status===0||U._status===-1)&&(U._status=2,U._result=Oe)}),U._status===-1&&(U._status=0,U._result=J)}if(U._status===1)return U._result.default;throw U._result}var oe={current:null},O={transition:null},ae={ReactCurrentDispatcher:oe,ReactCurrentBatchConfig:O,ReactCurrentOwner:B};function se(){throw Error("act(...) is not supported in production builds of React.")}return pt.Children={map:fe,forEach:function(U,J,Oe){fe(U,function(){J.apply(this,arguments)},Oe)},count:function(U){var J=0;return fe(U,function(){J++}),J},toArray:function(U){return fe(U,function(J){return J})||[]},only:function(U){if(!C(U))throw Error("React.Children.only expected to receive a single React element child.");return U}},pt.Component=E,pt.Fragment=t,pt.Profiler=o,pt.PureComponent=N,pt.StrictMode=s,pt.Suspense=f,pt.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=ae,pt.act=se,pt.cloneElement=function(U,J,Oe){if(U==null)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+U+".");var Fe=w({},U.props),V=U.key,re=U.ref,ne=U._owner;if(J!=null){if(J.ref!==void 0&&(re=J.ref,ne=B.current),J.key!==void 0&&(V=""+J.key),U.type&&U.type.defaultProps)var _e=U.type.defaultProps;for(Ae in J)k.call(J,Ae)&&!H.hasOwnProperty(Ae)&&(Fe[Ae]=J[Ae]===void 0&&_e!==void 0?_e[Ae]:J[Ae])}var Ae=arguments.length-2;if(Ae===1)Fe.children=Oe;else if(1<Ae){_e=Array(Ae);for(var Ie=0;Ie<Ae;Ie++)_e[Ie]=arguments[Ie+2];Fe.children=_e}return{$$typeof:n,type:U.type,key:V,ref:re,props:Fe,_owner:ne}},pt.createContext=function(U){return U={$$typeof:u,_currentValue:U,_currentValue2:U,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null},U.Provider={$$typeof:l,_context:U},U.Consumer=U},pt.createElement=Y,pt.createFactory=function(U){var J=Y.bind(null,U);return J.type=U,J},pt.createRef=function(){return{current:null}},pt.forwardRef=function(U){return{$$typeof:d,render:U}},pt.isValidElement=C,pt.lazy=function(U){return{$$typeof:v,_payload:{_status:-1,_result:U},_init:ce}},pt.memo=function(U,J){return{$$typeof:p,type:U,compare:J===void 0?null:J}},pt.startTransition=function(U){var J=O.transition;O.transition={};try{U()}finally{O.transition=J}},pt.unstable_act=se,pt.useCallback=function(U,J){return oe.current.useCallback(U,J)},pt.useContext=function(U){return oe.current.useContext(U)},pt.useDebugValue=function(){},pt.useDeferredValue=function(U){return oe.current.useDeferredValue(U)},pt.useEffect=function(U,J){return oe.current.useEffect(U,J)},pt.useId=function(){return oe.current.useId()},pt.useImperativeHandle=function(U,J,Oe){return oe.current.useImperativeHandle(U,J,Oe)},pt.useInsertionEffect=function(U,J){return oe.current.useInsertionEffect(U,J)},pt.useLayoutEffect=function(U,J){return oe.current.useLayoutEffect(U,J)},pt.useMemo=function(U,J){return oe.current.useMemo(U,J)},pt.useReducer=function(U,J,Oe){return oe.current.useReducer(U,J,Oe)},pt.useRef=function(U){return oe.current.useRef(U)},pt.useState=function(U){return oe.current.useState(U)},pt.useSyncExternalStore=function(U,J,Oe){return oe.current.useSyncExternalStore(U,J,Oe)},pt.useTransition=function(){return oe.current.useTransition()},pt.version="18.3.1",pt}var Sv;function Tf(){return Sv||(Sv=1,kd.exports=DE()),kd.exports}/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Mv;function NE(){if(Mv)return ha;Mv=1;var n=Tf(),e=Symbol.for("react.element"),t=Symbol.for("react.fragment"),s=Object.prototype.hasOwnProperty,o=n.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,l={key:!0,ref:!0,__self:!0,__source:!0};function u(d,f,p){var v,g={},y=null,x=null;p!==void 0&&(y=""+p),f.key!==void 0&&(y=""+f.key),f.ref!==void 0&&(x=f.ref);for(v in f)s.call(f,v)&&!l.hasOwnProperty(v)&&(g[v]=f[v]);if(d&&d.defaultProps)for(v in f=d.defaultProps,f)g[v]===void 0&&(g[v]=f[v]);return{$$typeof:e,type:d,key:y,ref:x,props:g,_owner:o.current}}return ha.Fragment=t,ha.jsx=u,ha.jsxs=u,ha}var wv;function OE(){return wv||(wv=1,Fd.exports=NE()),Fd.exports}var Qe=OE(),ht=Tf();const FE=n_(ht);var Ql={},zd={exports:{}},Bn={},Bd={exports:{}},Hd={};/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Tv;function kE(){return Tv||(Tv=1,(function(n){function e(O,ae){var se=O.length;O.push(ae);e:for(;0<se;){var U=se-1>>>1,J=O[U];if(0<o(J,ae))O[U]=ae,O[se]=J,se=U;else break e}}function t(O){return O.length===0?null:O[0]}function s(O){if(O.length===0)return null;var ae=O[0],se=O.pop();if(se!==ae){O[0]=se;e:for(var U=0,J=O.length,Oe=J>>>1;U<Oe;){var Fe=2*(U+1)-1,V=O[Fe],re=Fe+1,ne=O[re];if(0>o(V,se))re<J&&0>o(ne,V)?(O[U]=ne,O[re]=se,U=re):(O[U]=V,O[Fe]=se,U=Fe);else if(re<J&&0>o(ne,se))O[U]=ne,O[re]=se,U=re;else break e}}return ae}function o(O,ae){var se=O.sortIndex-ae.sortIndex;return se!==0?se:O.id-ae.id}if(typeof performance=="object"&&typeof performance.now=="function"){var l=performance;n.unstable_now=function(){return l.now()}}else{var u=Date,d=u.now();n.unstable_now=function(){return u.now()-d}}var f=[],p=[],v=1,g=null,y=3,x=!1,w=!1,A=!1,E=typeof setTimeout=="function"?setTimeout:null,_=typeof clearTimeout=="function"?clearTimeout:null,N=typeof setImmediate<"u"?setImmediate:null;typeof navigator<"u"&&navigator.scheduling!==void 0&&navigator.scheduling.isInputPending!==void 0&&navigator.scheduling.isInputPending.bind(navigator.scheduling);function I(O){for(var ae=t(p);ae!==null;){if(ae.callback===null)s(p);else if(ae.startTime<=O)s(p),ae.sortIndex=ae.expirationTime,e(f,ae);else break;ae=t(p)}}function R(O){if(A=!1,I(O),!w)if(t(f)!==null)w=!0,ce(k);else{var ae=t(p);ae!==null&&oe(R,ae.startTime-O)}}function k(O,ae){w=!1,A&&(A=!1,_(Y),Y=-1),x=!0;var se=y;try{for(I(ae),g=t(f);g!==null&&(!(g.expirationTime>ae)||O&&!D());){var U=g.callback;if(typeof U=="function"){g.callback=null,y=g.priorityLevel;var J=U(g.expirationTime<=ae);ae=n.unstable_now(),typeof J=="function"?g.callback=J:g===t(f)&&s(f),I(ae)}else s(f);g=t(f)}if(g!==null)var Oe=!0;else{var Fe=t(p);Fe!==null&&oe(R,Fe.startTime-ae),Oe=!1}return Oe}finally{g=null,y=se,x=!1}}var B=!1,H=null,Y=-1,b=5,C=-1;function D(){return!(n.unstable_now()-C<b)}function de(){if(H!==null){var O=n.unstable_now();C=O;var ae=!0;try{ae=H(!0,O)}finally{ae?ie():(B=!1,H=null)}}else B=!1}var ie;if(typeof N=="function")ie=function(){N(de)};else if(typeof MessageChannel<"u"){var le=new MessageChannel,fe=le.port2;le.port1.onmessage=de,ie=function(){fe.postMessage(null)}}else ie=function(){E(de,0)};function ce(O){H=O,B||(B=!0,ie())}function oe(O,ae){Y=E(function(){O(n.unstable_now())},ae)}n.unstable_IdlePriority=5,n.unstable_ImmediatePriority=1,n.unstable_LowPriority=4,n.unstable_NormalPriority=3,n.unstable_Profiling=null,n.unstable_UserBlockingPriority=2,n.unstable_cancelCallback=function(O){O.callback=null},n.unstable_continueExecution=function(){w||x||(w=!0,ce(k))},n.unstable_forceFrameRate=function(O){0>O||125<O?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):b=0<O?Math.floor(1e3/O):5},n.unstable_getCurrentPriorityLevel=function(){return y},n.unstable_getFirstCallbackNode=function(){return t(f)},n.unstable_next=function(O){switch(y){case 1:case 2:case 3:var ae=3;break;default:ae=y}var se=y;y=ae;try{return O()}finally{y=se}},n.unstable_pauseExecution=function(){},n.unstable_requestPaint=function(){},n.unstable_runWithPriority=function(O,ae){switch(O){case 1:case 2:case 3:case 4:case 5:break;default:O=3}var se=y;y=O;try{return ae()}finally{y=se}},n.unstable_scheduleCallback=function(O,ae,se){var U=n.unstable_now();switch(typeof se=="object"&&se!==null?(se=se.delay,se=typeof se=="number"&&0<se?U+se:U):se=U,O){case 1:var J=-1;break;case 2:J=250;break;case 5:J=1073741823;break;case 4:J=1e4;break;default:J=5e3}return J=se+J,O={id:v++,callback:ae,priorityLevel:O,startTime:se,expirationTime:J,sortIndex:-1},se>U?(O.sortIndex=se,e(p,O),t(f)===null&&O===t(p)&&(A?(_(Y),Y=-1):A=!0,oe(R,se-U))):(O.sortIndex=J,e(f,O),w||x||(w=!0,ce(k))),O},n.unstable_shouldYield=D,n.unstable_wrapCallback=function(O){var ae=y;return function(){var se=y;y=ae;try{return O.apply(this,arguments)}finally{y=se}}}})(Hd)),Hd}var Av;function zE(){return Av||(Av=1,Bd.exports=kE()),Bd.exports}/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Cv;function BE(){if(Cv)return Bn;Cv=1;var n=Tf(),e=zE();function t(i){for(var r="https://reactjs.org/docs/error-decoder.html?invariant="+i,a=1;a<arguments.length;a++)r+="&args[]="+encodeURIComponent(arguments[a]);return"Minified React error #"+i+"; visit "+r+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var s=new Set,o={};function l(i,r){u(i,r),u(i+"Capture",r)}function u(i,r){for(o[i]=r,i=0;i<r.length;i++)s.add(r[i])}var d=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),f=Object.prototype.hasOwnProperty,p=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,v={},g={};function y(i){return f.call(g,i)?!0:f.call(v,i)?!1:p.test(i)?g[i]=!0:(v[i]=!0,!1)}function x(i,r,a,c){if(a!==null&&a.type===0)return!1;switch(typeof r){case"function":case"symbol":return!0;case"boolean":return c?!1:a!==null?!a.acceptsBooleans:(i=i.toLowerCase().slice(0,5),i!=="data-"&&i!=="aria-");default:return!1}}function w(i,r,a,c){if(r===null||typeof r>"u"||x(i,r,a,c))return!0;if(c)return!1;if(a!==null)switch(a.type){case 3:return!r;case 4:return r===!1;case 5:return isNaN(r);case 6:return isNaN(r)||1>r}return!1}function A(i,r,a,c,h,m,S){this.acceptsBooleans=r===2||r===3||r===4,this.attributeName=c,this.attributeNamespace=h,this.mustUseProperty=a,this.propertyName=i,this.type=r,this.sanitizeURL=m,this.removeEmptyString=S}var E={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(i){E[i]=new A(i,0,!1,i,null,!1,!1)}),[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach(function(i){var r=i[0];E[r]=new A(r,1,!1,i[1],null,!1,!1)}),["contentEditable","draggable","spellCheck","value"].forEach(function(i){E[i]=new A(i,2,!1,i.toLowerCase(),null,!1,!1)}),["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach(function(i){E[i]=new A(i,2,!1,i,null,!1,!1)}),"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(i){E[i]=new A(i,3,!1,i.toLowerCase(),null,!1,!1)}),["checked","multiple","muted","selected"].forEach(function(i){E[i]=new A(i,3,!0,i,null,!1,!1)}),["capture","download"].forEach(function(i){E[i]=new A(i,4,!1,i,null,!1,!1)}),["cols","rows","size","span"].forEach(function(i){E[i]=new A(i,6,!1,i,null,!1,!1)}),["rowSpan","start"].forEach(function(i){E[i]=new A(i,5,!1,i.toLowerCase(),null,!1,!1)});var _=/[\-:]([a-z])/g;function N(i){return i[1].toUpperCase()}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(i){var r=i.replace(_,N);E[r]=new A(r,1,!1,i,null,!1,!1)}),"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(i){var r=i.replace(_,N);E[r]=new A(r,1,!1,i,"http://www.w3.org/1999/xlink",!1,!1)}),["xml:base","xml:lang","xml:space"].forEach(function(i){var r=i.replace(_,N);E[r]=new A(r,1,!1,i,"http://www.w3.org/XML/1998/namespace",!1,!1)}),["tabIndex","crossOrigin"].forEach(function(i){E[i]=new A(i,1,!1,i.toLowerCase(),null,!1,!1)}),E.xlinkHref=new A("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1),["src","href","action","formAction"].forEach(function(i){E[i]=new A(i,1,!1,i.toLowerCase(),null,!0,!0)});function I(i,r,a,c){var h=E.hasOwnProperty(r)?E[r]:null;(h!==null?h.type!==0:c||!(2<r.length)||r[0]!=="o"&&r[0]!=="O"||r[1]!=="n"&&r[1]!=="N")&&(w(r,a,h,c)&&(a=null),c||h===null?y(r)&&(a===null?i.removeAttribute(r):i.setAttribute(r,""+a)):h.mustUseProperty?i[h.propertyName]=a===null?h.type===3?!1:"":a:(r=h.attributeName,c=h.attributeNamespace,a===null?i.removeAttribute(r):(h=h.type,a=h===3||h===4&&a===!0?"":""+a,c?i.setAttributeNS(c,r,a):i.setAttribute(r,a))))}var R=n.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,k=Symbol.for("react.element"),B=Symbol.for("react.portal"),H=Symbol.for("react.fragment"),Y=Symbol.for("react.strict_mode"),b=Symbol.for("react.profiler"),C=Symbol.for("react.provider"),D=Symbol.for("react.context"),de=Symbol.for("react.forward_ref"),ie=Symbol.for("react.suspense"),le=Symbol.for("react.suspense_list"),fe=Symbol.for("react.memo"),ce=Symbol.for("react.lazy"),oe=Symbol.for("react.offscreen"),O=Symbol.iterator;function ae(i){return i===null||typeof i!="object"?null:(i=O&&i[O]||i["@@iterator"],typeof i=="function"?i:null)}var se=Object.assign,U;function J(i){if(U===void 0)try{throw Error()}catch(a){var r=a.stack.trim().match(/\n( *(at )?)/);U=r&&r[1]||""}return`
`+U+i}var Oe=!1;function Fe(i,r){if(!i||Oe)return"";Oe=!0;var a=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(r)if(r=function(){throw Error()},Object.defineProperty(r.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(r,[])}catch(Q){var c=Q}Reflect.construct(i,[],r)}else{try{r.call()}catch(Q){c=Q}i.call(r.prototype)}else{try{throw Error()}catch(Q){c=Q}i()}}catch(Q){if(Q&&c&&typeof Q.stack=="string"){for(var h=Q.stack.split(`
`),m=c.stack.split(`
`),S=h.length-1,L=m.length-1;1<=S&&0<=L&&h[S]!==m[L];)L--;for(;1<=S&&0<=L;S--,L--)if(h[S]!==m[L]){if(S!==1||L!==1)do if(S--,L--,0>L||h[S]!==m[L]){var z=`
`+h[S].replace(" at new "," at ");return i.displayName&&z.includes("<anonymous>")&&(z=z.replace("<anonymous>",i.displayName)),z}while(1<=S&&0<=L);break}}}finally{Oe=!1,Error.prepareStackTrace=a}return(i=i?i.displayName||i.name:"")?J(i):""}function V(i){switch(i.tag){case 5:return J(i.type);case 16:return J("Lazy");case 13:return J("Suspense");case 19:return J("SuspenseList");case 0:case 2:case 15:return i=Fe(i.type,!1),i;case 11:return i=Fe(i.type.render,!1),i;case 1:return i=Fe(i.type,!0),i;default:return""}}function re(i){if(i==null)return null;if(typeof i=="function")return i.displayName||i.name||null;if(typeof i=="string")return i;switch(i){case H:return"Fragment";case B:return"Portal";case b:return"Profiler";case Y:return"StrictMode";case ie:return"Suspense";case le:return"SuspenseList"}if(typeof i=="object")switch(i.$$typeof){case D:return(i.displayName||"Context")+".Consumer";case C:return(i._context.displayName||"Context")+".Provider";case de:var r=i.render;return i=i.displayName,i||(i=r.displayName||r.name||"",i=i!==""?"ForwardRef("+i+")":"ForwardRef"),i;case fe:return r=i.displayName||null,r!==null?r:re(i.type)||"Memo";case ce:r=i._payload,i=i._init;try{return re(i(r))}catch{}}return null}function ne(i){var r=i.type;switch(i.tag){case 24:return"Cache";case 9:return(r.displayName||"Context")+".Consumer";case 10:return(r._context.displayName||"Context")+".Provider";case 18:return"DehydratedFragment";case 11:return i=r.render,i=i.displayName||i.name||"",r.displayName||(i!==""?"ForwardRef("+i+")":"ForwardRef");case 7:return"Fragment";case 5:return r;case 4:return"Portal";case 3:return"Root";case 6:return"Text";case 16:return re(r);case 8:return r===Y?"StrictMode":"Mode";case 22:return"Offscreen";case 12:return"Profiler";case 21:return"Scope";case 13:return"Suspense";case 19:return"SuspenseList";case 25:return"TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if(typeof r=="function")return r.displayName||r.name||null;if(typeof r=="string")return r}return null}function _e(i){switch(typeof i){case"boolean":case"number":case"string":case"undefined":return i;case"object":return i;default:return""}}function Ae(i){var r=i.type;return(i=i.nodeName)&&i.toLowerCase()==="input"&&(r==="checkbox"||r==="radio")}function Ie(i){var r=Ae(i)?"checked":"value",a=Object.getOwnPropertyDescriptor(i.constructor.prototype,r),c=""+i[r];if(!i.hasOwnProperty(r)&&typeof a<"u"&&typeof a.get=="function"&&typeof a.set=="function"){var h=a.get,m=a.set;return Object.defineProperty(i,r,{configurable:!0,get:function(){return h.call(this)},set:function(S){c=""+S,m.call(this,S)}}),Object.defineProperty(i,r,{enumerable:a.enumerable}),{getValue:function(){return c},setValue:function(S){c=""+S},stopTracking:function(){i._valueTracker=null,delete i[r]}}}}function Nt(i){i._valueTracker||(i._valueTracker=Ie(i))}function ft(i){if(!i)return!1;var r=i._valueTracker;if(!r)return!0;var a=r.getValue(),c="";return i&&(c=Ae(i)?i.checked?"true":"false":i.value),i=c,i!==a?(r.setValue(i),!0):!1}function F(i){if(i=i||(typeof document<"u"?document:void 0),typeof i>"u")return null;try{return i.activeElement||i.body}catch{return i.body}}function Et(i,r){var a=r.checked;return se({},r,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:a??i._wrapperState.initialChecked})}function Xe(i,r){var a=r.defaultValue==null?"":r.defaultValue,c=r.checked!=null?r.checked:r.defaultChecked;a=_e(r.value!=null?r.value:a),i._wrapperState={initialChecked:c,initialValue:a,controlled:r.type==="checkbox"||r.type==="radio"?r.checked!=null:r.value!=null}}function gt(i,r){r=r.checked,r!=null&&I(i,"checked",r,!1)}function Ke(i,r){gt(i,r);var a=_e(r.value),c=r.type;if(a!=null)c==="number"?(a===0&&i.value===""||i.value!=a)&&(i.value=""+a):i.value!==""+a&&(i.value=""+a);else if(c==="submit"||c==="reset"){i.removeAttribute("value");return}r.hasOwnProperty("value")?ke(i,r.type,a):r.hasOwnProperty("defaultValue")&&ke(i,r.type,_e(r.defaultValue)),r.checked==null&&r.defaultChecked!=null&&(i.defaultChecked=!!r.defaultChecked)}function Ot(i,r,a){if(r.hasOwnProperty("value")||r.hasOwnProperty("defaultValue")){var c=r.type;if(!(c!=="submit"&&c!=="reset"||r.value!==void 0&&r.value!==null))return;r=""+i._wrapperState.initialValue,a||r===i.value||(i.value=r),i.defaultValue=r}a=i.name,a!==""&&(i.name=""),i.defaultChecked=!!i._wrapperState.initialChecked,a!==""&&(i.name=a)}function ke(i,r,a){(r!=="number"||F(i.ownerDocument)!==i)&&(a==null?i.defaultValue=""+i._wrapperState.initialValue:i.defaultValue!==""+a&&(i.defaultValue=""+a))}var lt=Array.isArray;function Bt(i,r,a,c){if(i=i.options,r){r={};for(var h=0;h<a.length;h++)r["$"+a[h]]=!0;for(a=0;a<i.length;a++)h=r.hasOwnProperty("$"+i[a].value),i[a].selected!==h&&(i[a].selected=h),h&&c&&(i[a].defaultSelected=!0)}else{for(a=""+_e(a),r=null,h=0;h<i.length;h++){if(i[h].value===a){i[h].selected=!0,c&&(i[h].defaultSelected=!0);return}r!==null||i[h].disabled||(r=i[h])}r!==null&&(r.selected=!0)}}function Ht(i,r){if(r.dangerouslySetInnerHTML!=null)throw Error(t(91));return se({},r,{value:void 0,defaultValue:void 0,children:""+i._wrapperState.initialValue})}function P(i,r){var a=r.value;if(a==null){if(a=r.children,r=r.defaultValue,a!=null){if(r!=null)throw Error(t(92));if(lt(a)){if(1<a.length)throw Error(t(93));a=a[0]}r=a}r==null&&(r=""),a=r}i._wrapperState={initialValue:_e(a)}}function M(i,r){var a=_e(r.value),c=_e(r.defaultValue);a!=null&&(a=""+a,a!==i.value&&(i.value=a),r.defaultValue==null&&i.defaultValue!==a&&(i.defaultValue=a)),c!=null&&(i.defaultValue=""+c)}function q(i){var r=i.textContent;r===i._wrapperState.initialValue&&r!==""&&r!==null&&(i.value=r)}function he(i){switch(i){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function ge(i,r){return i==null||i==="http://www.w3.org/1999/xhtml"?he(r):i==="http://www.w3.org/2000/svg"&&r==="foreignObject"?"http://www.w3.org/1999/xhtml":i}var ue,$e=(function(i){return typeof MSApp<"u"&&MSApp.execUnsafeLocalFunction?function(r,a,c,h){MSApp.execUnsafeLocalFunction(function(){return i(r,a,c,h)})}:i})(function(i,r){if(i.namespaceURI!=="http://www.w3.org/2000/svg"||"innerHTML"in i)i.innerHTML=r;else{for(ue=ue||document.createElement("div"),ue.innerHTML="<svg>"+r.valueOf().toString()+"</svg>",r=ue.firstChild;i.firstChild;)i.removeChild(i.firstChild);for(;r.firstChild;)i.appendChild(r.firstChild)}});function Te(i,r){if(r){var a=i.firstChild;if(a&&a===i.lastChild&&a.nodeType===3){a.nodeValue=r;return}}i.textContent=r}var Be={animationIterationCount:!0,aspectRatio:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},qe=["Webkit","ms","Moz","O"];Object.keys(Be).forEach(function(i){qe.forEach(function(r){r=r+i.charAt(0).toUpperCase()+i.substring(1),Be[r]=Be[i]})});function Me(i,r,a){return r==null||typeof r=="boolean"||r===""?"":a||typeof r!="number"||r===0||Be.hasOwnProperty(i)&&Be[i]?(""+r).trim():r+"px"}function Le(i,r){i=i.style;for(var a in r)if(r.hasOwnProperty(a)){var c=a.indexOf("--")===0,h=Me(a,r[a],c);a==="float"&&(a="cssFloat"),c?i.setProperty(a,h):i[a]=h}}var it=se({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function je(i,r){if(r){if(it[i]&&(r.children!=null||r.dangerouslySetInnerHTML!=null))throw Error(t(137,i));if(r.dangerouslySetInnerHTML!=null){if(r.children!=null)throw Error(t(60));if(typeof r.dangerouslySetInnerHTML!="object"||!("__html"in r.dangerouslySetInnerHTML))throw Error(t(61))}if(r.style!=null&&typeof r.style!="object")throw Error(t(62))}}function Re(i,r){if(i.indexOf("-")===-1)return typeof r.is=="string";switch(i){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var ct=null;function G(i){return i=i.target||i.srcElement||window,i.correspondingUseElement&&(i=i.correspondingUseElement),i.nodeType===3?i.parentNode:i}var Ee=null,Ce=null,Ue=null;function xe(i){if(i=Zo(i)){if(typeof Ee!="function")throw Error(t(280));var r=i.stateNode;r&&(r=fl(r),Ee(i.stateNode,i.type,r))}}function pe(i){Ce?Ue?Ue.push(i):Ue=[i]:Ce=i}function Ge(){if(Ce){var i=Ce,r=Ue;if(Ue=Ce=null,xe(i),r)for(i=0;i<r.length;i++)xe(r[i])}}function at(i,r){return i(r)}function Rt(){}var yt=!1;function ei(i,r,a){if(yt)return i(r,a);yt=!0;try{return at(i,r,a)}finally{yt=!1,(Ce!==null||Ue!==null)&&(Rt(),Ge())}}function _n(i,r){var a=i.stateNode;if(a===null)return null;var c=fl(a);if(c===null)return null;a=c[r];e:switch(r){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(c=!c.disabled)||(i=i.type,c=!(i==="button"||i==="input"||i==="select"||i==="textarea")),i=!c;break e;default:i=!1}if(i)return null;if(a&&typeof a!="function")throw Error(t(231,r,typeof a));return a}var Rs=!1;if(d)try{var Wn={};Object.defineProperty(Wn,"passive",{get:function(){Rs=!0}}),window.addEventListener("test",Wn,Wn),window.removeEventListener("test",Wn,Wn)}catch{Rs=!1}function Do(i,r,a,c,h,m,S,L,z){var Q=Array.prototype.slice.call(arguments,3);try{r.apply(a,Q)}catch(ve){this.onError(ve)}}var lr=!1,qr=null,Bi=!1,bs=null,Ps={onError:function(i){lr=!0,qr=i}};function ja(i,r,a,c,h,m,S,L,z){lr=!1,qr=null,Do.apply(Ps,arguments)}function Ya(i,r,a,c,h,m,S,L,z){if(ja.apply(this,arguments),lr){if(lr){var Q=qr;lr=!1,qr=null}else throw Error(t(198));Bi||(Bi=!0,bs=Q)}}function Hi(i){var r=i,a=i;if(i.alternate)for(;r.return;)r=r.return;else{i=r;do r=i,(r.flags&4098)!==0&&(a=r.return),i=r.return;while(i)}return r.tag===3?a:null}function $a(i){if(i.tag===13){var r=i.memoizedState;if(r===null&&(i=i.alternate,i!==null&&(r=i.memoizedState)),r!==null)return r.dehydrated}return null}function qa(i){if(Hi(i)!==i)throw Error(t(188))}function ou(i){var r=i.alternate;if(!r){if(r=Hi(i),r===null)throw Error(t(188));return r!==i?null:i}for(var a=i,c=r;;){var h=a.return;if(h===null)break;var m=h.alternate;if(m===null){if(c=h.return,c!==null){a=c;continue}break}if(h.child===m.child){for(m=h.child;m;){if(m===a)return qa(h),i;if(m===c)return qa(h),r;m=m.sibling}throw Error(t(188))}if(a.return!==c.return)a=h,c=m;else{for(var S=!1,L=h.child;L;){if(L===a){S=!0,a=h,c=m;break}if(L===c){S=!0,c=h,a=m;break}L=L.sibling}if(!S){for(L=m.child;L;){if(L===a){S=!0,a=m,c=h;break}if(L===c){S=!0,c=m,a=h;break}L=L.sibling}if(!S)throw Error(t(189))}}if(a.alternate!==c)throw Error(t(190))}if(a.tag!==3)throw Error(t(188));return a.stateNode.current===a?i:r}function Ka(i){return i=ou(i),i!==null?Za(i):null}function Za(i){if(i.tag===5||i.tag===6)return i;for(i=i.child;i!==null;){var r=Za(i);if(r!==null)return r;i=i.sibling}return null}var T=e.unstable_scheduleCallback,j=e.unstable_cancelCallback,ee=e.unstable_shouldYield,te=e.unstable_requestPaint,W=e.unstable_now,Se=e.unstable_getCurrentPriorityLevel,be=e.unstable_ImmediatePriority,He=e.unstable_UserBlockingPriority,De=e.unstable_NormalPriority,nt=e.unstable_LowPriority,rt=e.unstable_IdlePriority,Ze=null,st=null;function Tt(i){if(st&&typeof st.onCommitFiberRoot=="function")try{st.onCommitFiberRoot(Ze,i,void 0,(i.current.flags&128)===128)}catch{}}var xt=Math.clz32?Math.clz32:Je,Ft=Math.log,bt=Math.LN2;function Je(i){return i>>>=0,i===0?32:31-(Ft(i)/bt|0)|0}var It=64,mt=4194304;function tn(i){switch(i&-i){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return i&4194240;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return i&130023424;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;default:return i}}function hi(i,r){var a=i.pendingLanes;if(a===0)return 0;var c=0,h=i.suspendedLanes,m=i.pingedLanes,S=a&268435455;if(S!==0){var L=S&~h;L!==0?c=tn(L):(m&=S,m!==0&&(c=tn(m)))}else S=a&~h,S!==0?c=tn(S):m!==0&&(c=tn(m));if(c===0)return 0;if(r!==0&&r!==c&&(r&h)===0&&(h=c&-c,m=r&-r,h>=m||h===16&&(m&4194240)!==0))return r;if((c&4)!==0&&(c|=a&16),r=i.entangledLanes,r!==0)for(i=i.entanglements,r&=c;0<r;)a=31-xt(r),h=1<<a,c|=i[a],r&=~h;return c}function Cn(i,r){switch(i){case 1:case 2:case 4:return r+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return r+5e3;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return-1;case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Kr(i,r){for(var a=i.suspendedLanes,c=i.pingedLanes,h=i.expirationTimes,m=i.pendingLanes;0<m;){var S=31-xt(m),L=1<<S,z=h[S];z===-1?((L&a)===0||(L&c)!==0)&&(h[S]=Cn(L,r)):z<=r&&(i.expiredLanes|=L),m&=~L}}function kt(i){return i=i.pendingLanes&-1073741825,i!==0?i:i&1073741824?1073741824:0}function Rn(){var i=It;return It<<=1,(It&4194240)===0&&(It=64),i}function yn(i){for(var r=[],a=0;31>a;a++)r.push(i);return r}function $t(i,r,a){i.pendingLanes|=r,r!==536870912&&(i.suspendedLanes=0,i.pingedLanes=0),i=i.eventTimes,r=31-xt(r),i[r]=a}function xn(i,r){var a=i.pendingLanes&~r;i.pendingLanes=r,i.suspendedLanes=0,i.pingedLanes=0,i.expiredLanes&=r,i.mutableReadLanes&=r,i.entangledLanes&=r,r=i.entanglements;var c=i.eventTimes;for(i=i.expirationTimes;0<a;){var h=31-xt(a),m=1<<h;r[h]=0,c[h]=-1,i[h]=-1,a&=~m}}function Zr(i,r){var a=i.entangledLanes|=r;for(i=i.entanglements;a;){var c=31-xt(a),h=1<<c;h&r|i[c]&r&&(i[c]|=r),a&=~h}}var vt=0;function Jf(i){return i&=-i,1<i?4<i?(i&268435455)!==0?16:536870912:4:1}var ep,au,tp,np,ip,lu=!1,Qa=[],cr=null,ur=null,dr=null,No=new Map,Oo=new Map,hr=[],nx="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function rp(i,r){switch(i){case"focusin":case"focusout":cr=null;break;case"dragenter":case"dragleave":ur=null;break;case"mouseover":case"mouseout":dr=null;break;case"pointerover":case"pointerout":No.delete(r.pointerId);break;case"gotpointercapture":case"lostpointercapture":Oo.delete(r.pointerId)}}function Fo(i,r,a,c,h,m){return i===null||i.nativeEvent!==m?(i={blockedOn:r,domEventName:a,eventSystemFlags:c,nativeEvent:m,targetContainers:[h]},r!==null&&(r=Zo(r),r!==null&&au(r)),i):(i.eventSystemFlags|=c,r=i.targetContainers,h!==null&&r.indexOf(h)===-1&&r.push(h),i)}function ix(i,r,a,c,h){switch(r){case"focusin":return cr=Fo(cr,i,r,a,c,h),!0;case"dragenter":return ur=Fo(ur,i,r,a,c,h),!0;case"mouseover":return dr=Fo(dr,i,r,a,c,h),!0;case"pointerover":var m=h.pointerId;return No.set(m,Fo(No.get(m)||null,i,r,a,c,h)),!0;case"gotpointercapture":return m=h.pointerId,Oo.set(m,Fo(Oo.get(m)||null,i,r,a,c,h)),!0}return!1}function sp(i){var r=Qr(i.target);if(r!==null){var a=Hi(r);if(a!==null){if(r=a.tag,r===13){if(r=$a(a),r!==null){i.blockedOn=r,ip(i.priority,function(){tp(a)});return}}else if(r===3&&a.stateNode.current.memoizedState.isDehydrated){i.blockedOn=a.tag===3?a.stateNode.containerInfo:null;return}}}i.blockedOn=null}function Ja(i){if(i.blockedOn!==null)return!1;for(var r=i.targetContainers;0<r.length;){var a=uu(i.domEventName,i.eventSystemFlags,r[0],i.nativeEvent);if(a===null){a=i.nativeEvent;var c=new a.constructor(a.type,a);ct=c,a.target.dispatchEvent(c),ct=null}else return r=Zo(a),r!==null&&au(r),i.blockedOn=a,!1;r.shift()}return!0}function op(i,r,a){Ja(i)&&a.delete(r)}function rx(){lu=!1,cr!==null&&Ja(cr)&&(cr=null),ur!==null&&Ja(ur)&&(ur=null),dr!==null&&Ja(dr)&&(dr=null),No.forEach(op),Oo.forEach(op)}function ko(i,r){i.blockedOn===r&&(i.blockedOn=null,lu||(lu=!0,e.unstable_scheduleCallback(e.unstable_NormalPriority,rx)))}function zo(i){function r(h){return ko(h,i)}if(0<Qa.length){ko(Qa[0],i);for(var a=1;a<Qa.length;a++){var c=Qa[a];c.blockedOn===i&&(c.blockedOn=null)}}for(cr!==null&&ko(cr,i),ur!==null&&ko(ur,i),dr!==null&&ko(dr,i),No.forEach(r),Oo.forEach(r),a=0;a<hr.length;a++)c=hr[a],c.blockedOn===i&&(c.blockedOn=null);for(;0<hr.length&&(a=hr[0],a.blockedOn===null);)sp(a),a.blockedOn===null&&hr.shift()}var Ls=R.ReactCurrentBatchConfig,el=!0;function sx(i,r,a,c){var h=vt,m=Ls.transition;Ls.transition=null;try{vt=1,cu(i,r,a,c)}finally{vt=h,Ls.transition=m}}function ox(i,r,a,c){var h=vt,m=Ls.transition;Ls.transition=null;try{vt=4,cu(i,r,a,c)}finally{vt=h,Ls.transition=m}}function cu(i,r,a,c){if(el){var h=uu(i,r,a,c);if(h===null)Cu(i,r,c,tl,a),rp(i,c);else if(ix(h,i,r,a,c))c.stopPropagation();else if(rp(i,c),r&4&&-1<nx.indexOf(i)){for(;h!==null;){var m=Zo(h);if(m!==null&&ep(m),m=uu(i,r,a,c),m===null&&Cu(i,r,c,tl,a),m===h)break;h=m}h!==null&&c.stopPropagation()}else Cu(i,r,c,null,a)}}var tl=null;function uu(i,r,a,c){if(tl=null,i=G(c),i=Qr(i),i!==null)if(r=Hi(i),r===null)i=null;else if(a=r.tag,a===13){if(i=$a(r),i!==null)return i;i=null}else if(a===3){if(r.stateNode.current.memoizedState.isDehydrated)return r.tag===3?r.stateNode.containerInfo:null;i=null}else r!==i&&(i=null);return tl=i,null}function ap(i){switch(i){case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 1;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"toggle":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 4;case"message":switch(Se()){case be:return 1;case He:return 4;case De:case nt:return 16;case rt:return 536870912;default:return 16}default:return 16}}var fr=null,du=null,nl=null;function lp(){if(nl)return nl;var i,r=du,a=r.length,c,h="value"in fr?fr.value:fr.textContent,m=h.length;for(i=0;i<a&&r[i]===h[i];i++);var S=a-i;for(c=1;c<=S&&r[a-c]===h[m-c];c++);return nl=h.slice(i,1<c?1-c:void 0)}function il(i){var r=i.keyCode;return"charCode"in i?(i=i.charCode,i===0&&r===13&&(i=13)):i=r,i===10&&(i=13),32<=i||i===13?i:0}function rl(){return!0}function cp(){return!1}function Xn(i){function r(a,c,h,m,S){this._reactName=a,this._targetInst=h,this.type=c,this.nativeEvent=m,this.target=S,this.currentTarget=null;for(var L in i)i.hasOwnProperty(L)&&(a=i[L],this[L]=a?a(m):m[L]);return this.isDefaultPrevented=(m.defaultPrevented!=null?m.defaultPrevented:m.returnValue===!1)?rl:cp,this.isPropagationStopped=cp,this}return se(r.prototype,{preventDefault:function(){this.defaultPrevented=!0;var a=this.nativeEvent;a&&(a.preventDefault?a.preventDefault():typeof a.returnValue!="unknown"&&(a.returnValue=!1),this.isDefaultPrevented=rl)},stopPropagation:function(){var a=this.nativeEvent;a&&(a.stopPropagation?a.stopPropagation():typeof a.cancelBubble!="unknown"&&(a.cancelBubble=!0),this.isPropagationStopped=rl)},persist:function(){},isPersistent:rl}),r}var Is={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(i){return i.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},hu=Xn(Is),Bo=se({},Is,{view:0,detail:0}),ax=Xn(Bo),fu,pu,Ho,sl=se({},Bo,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:vu,button:0,buttons:0,relatedTarget:function(i){return i.relatedTarget===void 0?i.fromElement===i.srcElement?i.toElement:i.fromElement:i.relatedTarget},movementX:function(i){return"movementX"in i?i.movementX:(i!==Ho&&(Ho&&i.type==="mousemove"?(fu=i.screenX-Ho.screenX,pu=i.screenY-Ho.screenY):pu=fu=0,Ho=i),fu)},movementY:function(i){return"movementY"in i?i.movementY:pu}}),up=Xn(sl),lx=se({},sl,{dataTransfer:0}),cx=Xn(lx),ux=se({},Bo,{relatedTarget:0}),mu=Xn(ux),dx=se({},Is,{animationName:0,elapsedTime:0,pseudoElement:0}),hx=Xn(dx),fx=se({},Is,{clipboardData:function(i){return"clipboardData"in i?i.clipboardData:window.clipboardData}}),px=Xn(fx),mx=se({},Is,{data:0}),dp=Xn(mx),vx={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},gx={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},_x={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function yx(i){var r=this.nativeEvent;return r.getModifierState?r.getModifierState(i):(i=_x[i])?!!r[i]:!1}function vu(){return yx}var xx=se({},Bo,{key:function(i){if(i.key){var r=vx[i.key]||i.key;if(r!=="Unidentified")return r}return i.type==="keypress"?(i=il(i),i===13?"Enter":String.fromCharCode(i)):i.type==="keydown"||i.type==="keyup"?gx[i.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:vu,charCode:function(i){return i.type==="keypress"?il(i):0},keyCode:function(i){return i.type==="keydown"||i.type==="keyup"?i.keyCode:0},which:function(i){return i.type==="keypress"?il(i):i.type==="keydown"||i.type==="keyup"?i.keyCode:0}}),Ex=Xn(xx),Sx=se({},sl,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),hp=Xn(Sx),Mx=se({},Bo,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:vu}),wx=Xn(Mx),Tx=se({},Is,{propertyName:0,elapsedTime:0,pseudoElement:0}),Ax=Xn(Tx),Cx=se({},sl,{deltaX:function(i){return"deltaX"in i?i.deltaX:"wheelDeltaX"in i?-i.wheelDeltaX:0},deltaY:function(i){return"deltaY"in i?i.deltaY:"wheelDeltaY"in i?-i.wheelDeltaY:"wheelDelta"in i?-i.wheelDelta:0},deltaZ:0,deltaMode:0}),Rx=Xn(Cx),bx=[9,13,27,32],gu=d&&"CompositionEvent"in window,Vo=null;d&&"documentMode"in document&&(Vo=document.documentMode);var Px=d&&"TextEvent"in window&&!Vo,fp=d&&(!gu||Vo&&8<Vo&&11>=Vo),pp=" ",mp=!1;function vp(i,r){switch(i){case"keyup":return bx.indexOf(r.keyCode)!==-1;case"keydown":return r.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function gp(i){return i=i.detail,typeof i=="object"&&"data"in i?i.data:null}var Us=!1;function Lx(i,r){switch(i){case"compositionend":return gp(r);case"keypress":return r.which!==32?null:(mp=!0,pp);case"textInput":return i=r.data,i===pp&&mp?null:i;default:return null}}function Ix(i,r){if(Us)return i==="compositionend"||!gu&&vp(i,r)?(i=lp(),nl=du=fr=null,Us=!1,i):null;switch(i){case"paste":return null;case"keypress":if(!(r.ctrlKey||r.altKey||r.metaKey)||r.ctrlKey&&r.altKey){if(r.char&&1<r.char.length)return r.char;if(r.which)return String.fromCharCode(r.which)}return null;case"compositionend":return fp&&r.locale!=="ko"?null:r.data;default:return null}}var Ux={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function _p(i){var r=i&&i.nodeName&&i.nodeName.toLowerCase();return r==="input"?!!Ux[i.type]:r==="textarea"}function yp(i,r,a,c){pe(c),r=ul(r,"onChange"),0<r.length&&(a=new hu("onChange","change",null,a,c),i.push({event:a,listeners:r}))}var Go=null,Wo=null;function Dx(i){Fp(i,0)}function ol(i){var r=ks(i);if(ft(r))return i}function Nx(i,r){if(i==="change")return r}var xp=!1;if(d){var _u;if(d){var yu="oninput"in document;if(!yu){var Ep=document.createElement("div");Ep.setAttribute("oninput","return;"),yu=typeof Ep.oninput=="function"}_u=yu}else _u=!1;xp=_u&&(!document.documentMode||9<document.documentMode)}function Sp(){Go&&(Go.detachEvent("onpropertychange",Mp),Wo=Go=null)}function Mp(i){if(i.propertyName==="value"&&ol(Wo)){var r=[];yp(r,Wo,i,G(i)),ei(Dx,r)}}function Ox(i,r,a){i==="focusin"?(Sp(),Go=r,Wo=a,Go.attachEvent("onpropertychange",Mp)):i==="focusout"&&Sp()}function Fx(i){if(i==="selectionchange"||i==="keyup"||i==="keydown")return ol(Wo)}function kx(i,r){if(i==="click")return ol(r)}function zx(i,r){if(i==="input"||i==="change")return ol(r)}function Bx(i,r){return i===r&&(i!==0||1/i===1/r)||i!==i&&r!==r}var fi=typeof Object.is=="function"?Object.is:Bx;function Xo(i,r){if(fi(i,r))return!0;if(typeof i!="object"||i===null||typeof r!="object"||r===null)return!1;var a=Object.keys(i),c=Object.keys(r);if(a.length!==c.length)return!1;for(c=0;c<a.length;c++){var h=a[c];if(!f.call(r,h)||!fi(i[h],r[h]))return!1}return!0}function wp(i){for(;i&&i.firstChild;)i=i.firstChild;return i}function Tp(i,r){var a=wp(i);i=0;for(var c;a;){if(a.nodeType===3){if(c=i+a.textContent.length,i<=r&&c>=r)return{node:a,offset:r-i};i=c}e:{for(;a;){if(a.nextSibling){a=a.nextSibling;break e}a=a.parentNode}a=void 0}a=wp(a)}}function Ap(i,r){return i&&r?i===r?!0:i&&i.nodeType===3?!1:r&&r.nodeType===3?Ap(i,r.parentNode):"contains"in i?i.contains(r):i.compareDocumentPosition?!!(i.compareDocumentPosition(r)&16):!1:!1}function Cp(){for(var i=window,r=F();r instanceof i.HTMLIFrameElement;){try{var a=typeof r.contentWindow.location.href=="string"}catch{a=!1}if(a)i=r.contentWindow;else break;r=F(i.document)}return r}function xu(i){var r=i&&i.nodeName&&i.nodeName.toLowerCase();return r&&(r==="input"&&(i.type==="text"||i.type==="search"||i.type==="tel"||i.type==="url"||i.type==="password")||r==="textarea"||i.contentEditable==="true")}function Hx(i){var r=Cp(),a=i.focusedElem,c=i.selectionRange;if(r!==a&&a&&a.ownerDocument&&Ap(a.ownerDocument.documentElement,a)){if(c!==null&&xu(a)){if(r=c.start,i=c.end,i===void 0&&(i=r),"selectionStart"in a)a.selectionStart=r,a.selectionEnd=Math.min(i,a.value.length);else if(i=(r=a.ownerDocument||document)&&r.defaultView||window,i.getSelection){i=i.getSelection();var h=a.textContent.length,m=Math.min(c.start,h);c=c.end===void 0?m:Math.min(c.end,h),!i.extend&&m>c&&(h=c,c=m,m=h),h=Tp(a,m);var S=Tp(a,c);h&&S&&(i.rangeCount!==1||i.anchorNode!==h.node||i.anchorOffset!==h.offset||i.focusNode!==S.node||i.focusOffset!==S.offset)&&(r=r.createRange(),r.setStart(h.node,h.offset),i.removeAllRanges(),m>c?(i.addRange(r),i.extend(S.node,S.offset)):(r.setEnd(S.node,S.offset),i.addRange(r)))}}for(r=[],i=a;i=i.parentNode;)i.nodeType===1&&r.push({element:i,left:i.scrollLeft,top:i.scrollTop});for(typeof a.focus=="function"&&a.focus(),a=0;a<r.length;a++)i=r[a],i.element.scrollLeft=i.left,i.element.scrollTop=i.top}}var Vx=d&&"documentMode"in document&&11>=document.documentMode,Ds=null,Eu=null,jo=null,Su=!1;function Rp(i,r,a){var c=a.window===a?a.document:a.nodeType===9?a:a.ownerDocument;Su||Ds==null||Ds!==F(c)||(c=Ds,"selectionStart"in c&&xu(c)?c={start:c.selectionStart,end:c.selectionEnd}:(c=(c.ownerDocument&&c.ownerDocument.defaultView||window).getSelection(),c={anchorNode:c.anchorNode,anchorOffset:c.anchorOffset,focusNode:c.focusNode,focusOffset:c.focusOffset}),jo&&Xo(jo,c)||(jo=c,c=ul(Eu,"onSelect"),0<c.length&&(r=new hu("onSelect","select",null,r,a),i.push({event:r,listeners:c}),r.target=Ds)))}function al(i,r){var a={};return a[i.toLowerCase()]=r.toLowerCase(),a["Webkit"+i]="webkit"+r,a["Moz"+i]="moz"+r,a}var Ns={animationend:al("Animation","AnimationEnd"),animationiteration:al("Animation","AnimationIteration"),animationstart:al("Animation","AnimationStart"),transitionend:al("Transition","TransitionEnd")},Mu={},bp={};d&&(bp=document.createElement("div").style,"AnimationEvent"in window||(delete Ns.animationend.animation,delete Ns.animationiteration.animation,delete Ns.animationstart.animation),"TransitionEvent"in window||delete Ns.transitionend.transition);function ll(i){if(Mu[i])return Mu[i];if(!Ns[i])return i;var r=Ns[i],a;for(a in r)if(r.hasOwnProperty(a)&&a in bp)return Mu[i]=r[a];return i}var Pp=ll("animationend"),Lp=ll("animationiteration"),Ip=ll("animationstart"),Up=ll("transitionend"),Dp=new Map,Np="abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");function pr(i,r){Dp.set(i,r),l(r,[i])}for(var wu=0;wu<Np.length;wu++){var Tu=Np[wu],Gx=Tu.toLowerCase(),Wx=Tu[0].toUpperCase()+Tu.slice(1);pr(Gx,"on"+Wx)}pr(Pp,"onAnimationEnd"),pr(Lp,"onAnimationIteration"),pr(Ip,"onAnimationStart"),pr("dblclick","onDoubleClick"),pr("focusin","onFocus"),pr("focusout","onBlur"),pr(Up,"onTransitionEnd"),u("onMouseEnter",["mouseout","mouseover"]),u("onMouseLeave",["mouseout","mouseover"]),u("onPointerEnter",["pointerout","pointerover"]),u("onPointerLeave",["pointerout","pointerover"]),l("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),l("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),l("onBeforeInput",["compositionend","keypress","textInput","paste"]),l("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),l("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),l("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Yo="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),Xx=new Set("cancel close invalid load scroll toggle".split(" ").concat(Yo));function Op(i,r,a){var c=i.type||"unknown-event";i.currentTarget=a,Ya(c,r,void 0,i),i.currentTarget=null}function Fp(i,r){r=(r&4)!==0;for(var a=0;a<i.length;a++){var c=i[a],h=c.event;c=c.listeners;e:{var m=void 0;if(r)for(var S=c.length-1;0<=S;S--){var L=c[S],z=L.instance,Q=L.currentTarget;if(L=L.listener,z!==m&&h.isPropagationStopped())break e;Op(h,L,Q),m=z}else for(S=0;S<c.length;S++){if(L=c[S],z=L.instance,Q=L.currentTarget,L=L.listener,z!==m&&h.isPropagationStopped())break e;Op(h,L,Q),m=z}}}if(Bi)throw i=bs,Bi=!1,bs=null,i}function Vt(i,r){var a=r[Uu];a===void 0&&(a=r[Uu]=new Set);var c=i+"__bubble";a.has(c)||(kp(r,i,2,!1),a.add(c))}function Au(i,r,a){var c=0;r&&(c|=4),kp(a,i,c,r)}var cl="_reactListening"+Math.random().toString(36).slice(2);function $o(i){if(!i[cl]){i[cl]=!0,s.forEach(function(a){a!=="selectionchange"&&(Xx.has(a)||Au(a,!1,i),Au(a,!0,i))});var r=i.nodeType===9?i:i.ownerDocument;r===null||r[cl]||(r[cl]=!0,Au("selectionchange",!1,r))}}function kp(i,r,a,c){switch(ap(r)){case 1:var h=sx;break;case 4:h=ox;break;default:h=cu}a=h.bind(null,r,a,i),h=void 0,!Rs||r!=="touchstart"&&r!=="touchmove"&&r!=="wheel"||(h=!0),c?h!==void 0?i.addEventListener(r,a,{capture:!0,passive:h}):i.addEventListener(r,a,!0):h!==void 0?i.addEventListener(r,a,{passive:h}):i.addEventListener(r,a,!1)}function Cu(i,r,a,c,h){var m=c;if((r&1)===0&&(r&2)===0&&c!==null)e:for(;;){if(c===null)return;var S=c.tag;if(S===3||S===4){var L=c.stateNode.containerInfo;if(L===h||L.nodeType===8&&L.parentNode===h)break;if(S===4)for(S=c.return;S!==null;){var z=S.tag;if((z===3||z===4)&&(z=S.stateNode.containerInfo,z===h||z.nodeType===8&&z.parentNode===h))return;S=S.return}for(;L!==null;){if(S=Qr(L),S===null)return;if(z=S.tag,z===5||z===6){c=m=S;continue e}L=L.parentNode}}c=c.return}ei(function(){var Q=m,ve=G(a),ye=[];e:{var me=Dp.get(i);if(me!==void 0){var Ne=hu,Ve=i;switch(i){case"keypress":if(il(a)===0)break e;case"keydown":case"keyup":Ne=Ex;break;case"focusin":Ve="focus",Ne=mu;break;case"focusout":Ve="blur",Ne=mu;break;case"beforeblur":case"afterblur":Ne=mu;break;case"click":if(a.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":Ne=up;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":Ne=cx;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":Ne=wx;break;case Pp:case Lp:case Ip:Ne=hx;break;case Up:Ne=Ax;break;case"scroll":Ne=ax;break;case"wheel":Ne=Rx;break;case"copy":case"cut":case"paste":Ne=px;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":Ne=hp}var We=(r&4)!==0,qt=!We&&i==="scroll",$=We?me!==null?me+"Capture":null:me;We=[];for(var X=Q,K;X!==null;){K=X;var we=K.stateNode;if(K.tag===5&&we!==null&&(K=we,$!==null&&(we=_n(X,$),we!=null&&We.push(qo(X,we,K)))),qt)break;X=X.return}0<We.length&&(me=new Ne(me,Ve,null,a,ve),ye.push({event:me,listeners:We}))}}if((r&7)===0){e:{if(me=i==="mouseover"||i==="pointerover",Ne=i==="mouseout"||i==="pointerout",me&&a!==ct&&(Ve=a.relatedTarget||a.fromElement)&&(Qr(Ve)||Ve[Vi]))break e;if((Ne||me)&&(me=ve.window===ve?ve:(me=ve.ownerDocument)?me.defaultView||me.parentWindow:window,Ne?(Ve=a.relatedTarget||a.toElement,Ne=Q,Ve=Ve?Qr(Ve):null,Ve!==null&&(qt=Hi(Ve),Ve!==qt||Ve.tag!==5&&Ve.tag!==6)&&(Ve=null)):(Ne=null,Ve=Q),Ne!==Ve)){if(We=up,we="onMouseLeave",$="onMouseEnter",X="mouse",(i==="pointerout"||i==="pointerover")&&(We=hp,we="onPointerLeave",$="onPointerEnter",X="pointer"),qt=Ne==null?me:ks(Ne),K=Ve==null?me:ks(Ve),me=new We(we,X+"leave",Ne,a,ve),me.target=qt,me.relatedTarget=K,we=null,Qr(ve)===Q&&(We=new We($,X+"enter",Ve,a,ve),We.target=K,We.relatedTarget=qt,we=We),qt=we,Ne&&Ve)t:{for(We=Ne,$=Ve,X=0,K=We;K;K=Os(K))X++;for(K=0,we=$;we;we=Os(we))K++;for(;0<X-K;)We=Os(We),X--;for(;0<K-X;)$=Os($),K--;for(;X--;){if(We===$||$!==null&&We===$.alternate)break t;We=Os(We),$=Os($)}We=null}else We=null;Ne!==null&&zp(ye,me,Ne,We,!1),Ve!==null&&qt!==null&&zp(ye,qt,Ve,We,!0)}}e:{if(me=Q?ks(Q):window,Ne=me.nodeName&&me.nodeName.toLowerCase(),Ne==="select"||Ne==="input"&&me.type==="file")var Ye=Nx;else if(_p(me))if(xp)Ye=zx;else{Ye=Fx;var et=Ox}else(Ne=me.nodeName)&&Ne.toLowerCase()==="input"&&(me.type==="checkbox"||me.type==="radio")&&(Ye=kx);if(Ye&&(Ye=Ye(i,Q))){yp(ye,Ye,a,ve);break e}et&&et(i,me,Q),i==="focusout"&&(et=me._wrapperState)&&et.controlled&&me.type==="number"&&ke(me,"number",me.value)}switch(et=Q?ks(Q):window,i){case"focusin":(_p(et)||et.contentEditable==="true")&&(Ds=et,Eu=Q,jo=null);break;case"focusout":jo=Eu=Ds=null;break;case"mousedown":Su=!0;break;case"contextmenu":case"mouseup":case"dragend":Su=!1,Rp(ye,a,ve);break;case"selectionchange":if(Vx)break;case"keydown":case"keyup":Rp(ye,a,ve)}var tt;if(gu)e:{switch(i){case"compositionstart":var ot="onCompositionStart";break e;case"compositionend":ot="onCompositionEnd";break e;case"compositionupdate":ot="onCompositionUpdate";break e}ot=void 0}else Us?vp(i,a)&&(ot="onCompositionEnd"):i==="keydown"&&a.keyCode===229&&(ot="onCompositionStart");ot&&(fp&&a.locale!=="ko"&&(Us||ot!=="onCompositionStart"?ot==="onCompositionEnd"&&Us&&(tt=lp()):(fr=ve,du="value"in fr?fr.value:fr.textContent,Us=!0)),et=ul(Q,ot),0<et.length&&(ot=new dp(ot,i,null,a,ve),ye.push({event:ot,listeners:et}),tt?ot.data=tt:(tt=gp(a),tt!==null&&(ot.data=tt)))),(tt=Px?Lx(i,a):Ix(i,a))&&(Q=ul(Q,"onBeforeInput"),0<Q.length&&(ve=new dp("onBeforeInput","beforeinput",null,a,ve),ye.push({event:ve,listeners:Q}),ve.data=tt))}Fp(ye,r)})}function qo(i,r,a){return{instance:i,listener:r,currentTarget:a}}function ul(i,r){for(var a=r+"Capture",c=[];i!==null;){var h=i,m=h.stateNode;h.tag===5&&m!==null&&(h=m,m=_n(i,a),m!=null&&c.unshift(qo(i,m,h)),m=_n(i,r),m!=null&&c.push(qo(i,m,h))),i=i.return}return c}function Os(i){if(i===null)return null;do i=i.return;while(i&&i.tag!==5);return i||null}function zp(i,r,a,c,h){for(var m=r._reactName,S=[];a!==null&&a!==c;){var L=a,z=L.alternate,Q=L.stateNode;if(z!==null&&z===c)break;L.tag===5&&Q!==null&&(L=Q,h?(z=_n(a,m),z!=null&&S.unshift(qo(a,z,L))):h||(z=_n(a,m),z!=null&&S.push(qo(a,z,L)))),a=a.return}S.length!==0&&i.push({event:r,listeners:S})}var jx=/\r\n?/g,Yx=/\u0000|\uFFFD/g;function Bp(i){return(typeof i=="string"?i:""+i).replace(jx,`
`).replace(Yx,"")}function dl(i,r,a){if(r=Bp(r),Bp(i)!==r&&a)throw Error(t(425))}function hl(){}var Ru=null,bu=null;function Pu(i,r){return i==="textarea"||i==="noscript"||typeof r.children=="string"||typeof r.children=="number"||typeof r.dangerouslySetInnerHTML=="object"&&r.dangerouslySetInnerHTML!==null&&r.dangerouslySetInnerHTML.__html!=null}var Lu=typeof setTimeout=="function"?setTimeout:void 0,$x=typeof clearTimeout=="function"?clearTimeout:void 0,Hp=typeof Promise=="function"?Promise:void 0,qx=typeof queueMicrotask=="function"?queueMicrotask:typeof Hp<"u"?function(i){return Hp.resolve(null).then(i).catch(Kx)}:Lu;function Kx(i){setTimeout(function(){throw i})}function Iu(i,r){var a=r,c=0;do{var h=a.nextSibling;if(i.removeChild(a),h&&h.nodeType===8)if(a=h.data,a==="/$"){if(c===0){i.removeChild(h),zo(r);return}c--}else a!=="$"&&a!=="$?"&&a!=="$!"||c++;a=h}while(a);zo(r)}function mr(i){for(;i!=null;i=i.nextSibling){var r=i.nodeType;if(r===1||r===3)break;if(r===8){if(r=i.data,r==="$"||r==="$!"||r==="$?")break;if(r==="/$")return null}}return i}function Vp(i){i=i.previousSibling;for(var r=0;i;){if(i.nodeType===8){var a=i.data;if(a==="$"||a==="$!"||a==="$?"){if(r===0)return i;r--}else a==="/$"&&r++}i=i.previousSibling}return null}var Fs=Math.random().toString(36).slice(2),Ri="__reactFiber$"+Fs,Ko="__reactProps$"+Fs,Vi="__reactContainer$"+Fs,Uu="__reactEvents$"+Fs,Zx="__reactListeners$"+Fs,Qx="__reactHandles$"+Fs;function Qr(i){var r=i[Ri];if(r)return r;for(var a=i.parentNode;a;){if(r=a[Vi]||a[Ri]){if(a=r.alternate,r.child!==null||a!==null&&a.child!==null)for(i=Vp(i);i!==null;){if(a=i[Ri])return a;i=Vp(i)}return r}i=a,a=i.parentNode}return null}function Zo(i){return i=i[Ri]||i[Vi],!i||i.tag!==5&&i.tag!==6&&i.tag!==13&&i.tag!==3?null:i}function ks(i){if(i.tag===5||i.tag===6)return i.stateNode;throw Error(t(33))}function fl(i){return i[Ko]||null}var Du=[],zs=-1;function vr(i){return{current:i}}function Gt(i){0>zs||(i.current=Du[zs],Du[zs]=null,zs--)}function zt(i,r){zs++,Du[zs]=i.current,i.current=r}var gr={},En=vr(gr),Nn=vr(!1),Jr=gr;function Bs(i,r){var a=i.type.contextTypes;if(!a)return gr;var c=i.stateNode;if(c&&c.__reactInternalMemoizedUnmaskedChildContext===r)return c.__reactInternalMemoizedMaskedChildContext;var h={},m;for(m in a)h[m]=r[m];return c&&(i=i.stateNode,i.__reactInternalMemoizedUnmaskedChildContext=r,i.__reactInternalMemoizedMaskedChildContext=h),h}function On(i){return i=i.childContextTypes,i!=null}function pl(){Gt(Nn),Gt(En)}function Gp(i,r,a){if(En.current!==gr)throw Error(t(168));zt(En,r),zt(Nn,a)}function Wp(i,r,a){var c=i.stateNode;if(r=r.childContextTypes,typeof c.getChildContext!="function")return a;c=c.getChildContext();for(var h in c)if(!(h in r))throw Error(t(108,ne(i)||"Unknown",h));return se({},a,c)}function ml(i){return i=(i=i.stateNode)&&i.__reactInternalMemoizedMergedChildContext||gr,Jr=En.current,zt(En,i),zt(Nn,Nn.current),!0}function Xp(i,r,a){var c=i.stateNode;if(!c)throw Error(t(169));a?(i=Wp(i,r,Jr),c.__reactInternalMemoizedMergedChildContext=i,Gt(Nn),Gt(En),zt(En,i)):Gt(Nn),zt(Nn,a)}var Gi=null,vl=!1,Nu=!1;function jp(i){Gi===null?Gi=[i]:Gi.push(i)}function Jx(i){vl=!0,jp(i)}function _r(){if(!Nu&&Gi!==null){Nu=!0;var i=0,r=vt;try{var a=Gi;for(vt=1;i<a.length;i++){var c=a[i];do c=c(!0);while(c!==null)}Gi=null,vl=!1}catch(h){throw Gi!==null&&(Gi=Gi.slice(i+1)),T(be,_r),h}finally{vt=r,Nu=!1}}return null}var Hs=[],Vs=0,gl=null,_l=0,ti=[],ni=0,es=null,Wi=1,Xi="";function ts(i,r){Hs[Vs++]=_l,Hs[Vs++]=gl,gl=i,_l=r}function Yp(i,r,a){ti[ni++]=Wi,ti[ni++]=Xi,ti[ni++]=es,es=i;var c=Wi;i=Xi;var h=32-xt(c)-1;c&=~(1<<h),a+=1;var m=32-xt(r)+h;if(30<m){var S=h-h%5;m=(c&(1<<S)-1).toString(32),c>>=S,h-=S,Wi=1<<32-xt(r)+h|a<<h|c,Xi=m+i}else Wi=1<<m|a<<h|c,Xi=i}function Ou(i){i.return!==null&&(ts(i,1),Yp(i,1,0))}function Fu(i){for(;i===gl;)gl=Hs[--Vs],Hs[Vs]=null,_l=Hs[--Vs],Hs[Vs]=null;for(;i===es;)es=ti[--ni],ti[ni]=null,Xi=ti[--ni],ti[ni]=null,Wi=ti[--ni],ti[ni]=null}var jn=null,Yn=null,Wt=!1,pi=null;function $p(i,r){var a=oi(5,null,null,0);a.elementType="DELETED",a.stateNode=r,a.return=i,r=i.deletions,r===null?(i.deletions=[a],i.flags|=16):r.push(a)}function qp(i,r){switch(i.tag){case 5:var a=i.type;return r=r.nodeType!==1||a.toLowerCase()!==r.nodeName.toLowerCase()?null:r,r!==null?(i.stateNode=r,jn=i,Yn=mr(r.firstChild),!0):!1;case 6:return r=i.pendingProps===""||r.nodeType!==3?null:r,r!==null?(i.stateNode=r,jn=i,Yn=null,!0):!1;case 13:return r=r.nodeType!==8?null:r,r!==null?(a=es!==null?{id:Wi,overflow:Xi}:null,i.memoizedState={dehydrated:r,treeContext:a,retryLane:1073741824},a=oi(18,null,null,0),a.stateNode=r,a.return=i,i.child=a,jn=i,Yn=null,!0):!1;default:return!1}}function ku(i){return(i.mode&1)!==0&&(i.flags&128)===0}function zu(i){if(Wt){var r=Yn;if(r){var a=r;if(!qp(i,r)){if(ku(i))throw Error(t(418));r=mr(a.nextSibling);var c=jn;r&&qp(i,r)?$p(c,a):(i.flags=i.flags&-4097|2,Wt=!1,jn=i)}}else{if(ku(i))throw Error(t(418));i.flags=i.flags&-4097|2,Wt=!1,jn=i}}}function Kp(i){for(i=i.return;i!==null&&i.tag!==5&&i.tag!==3&&i.tag!==13;)i=i.return;jn=i}function yl(i){if(i!==jn)return!1;if(!Wt)return Kp(i),Wt=!0,!1;var r;if((r=i.tag!==3)&&!(r=i.tag!==5)&&(r=i.type,r=r!=="head"&&r!=="body"&&!Pu(i.type,i.memoizedProps)),r&&(r=Yn)){if(ku(i))throw Zp(),Error(t(418));for(;r;)$p(i,r),r=mr(r.nextSibling)}if(Kp(i),i.tag===13){if(i=i.memoizedState,i=i!==null?i.dehydrated:null,!i)throw Error(t(317));e:{for(i=i.nextSibling,r=0;i;){if(i.nodeType===8){var a=i.data;if(a==="/$"){if(r===0){Yn=mr(i.nextSibling);break e}r--}else a!=="$"&&a!=="$!"&&a!=="$?"||r++}i=i.nextSibling}Yn=null}}else Yn=jn?mr(i.stateNode.nextSibling):null;return!0}function Zp(){for(var i=Yn;i;)i=mr(i.nextSibling)}function Gs(){Yn=jn=null,Wt=!1}function Bu(i){pi===null?pi=[i]:pi.push(i)}var eE=R.ReactCurrentBatchConfig;function Qo(i,r,a){if(i=a.ref,i!==null&&typeof i!="function"&&typeof i!="object"){if(a._owner){if(a=a._owner,a){if(a.tag!==1)throw Error(t(309));var c=a.stateNode}if(!c)throw Error(t(147,i));var h=c,m=""+i;return r!==null&&r.ref!==null&&typeof r.ref=="function"&&r.ref._stringRef===m?r.ref:(r=function(S){var L=h.refs;S===null?delete L[m]:L[m]=S},r._stringRef=m,r)}if(typeof i!="string")throw Error(t(284));if(!a._owner)throw Error(t(290,i))}return i}function xl(i,r){throw i=Object.prototype.toString.call(r),Error(t(31,i==="[object Object]"?"object with keys {"+Object.keys(r).join(", ")+"}":i))}function Qp(i){var r=i._init;return r(i._payload)}function Jp(i){function r($,X){if(i){var K=$.deletions;K===null?($.deletions=[X],$.flags|=16):K.push(X)}}function a($,X){if(!i)return null;for(;X!==null;)r($,X),X=X.sibling;return null}function c($,X){for($=new Map;X!==null;)X.key!==null?$.set(X.key,X):$.set(X.index,X),X=X.sibling;return $}function h($,X){return $=Ar($,X),$.index=0,$.sibling=null,$}function m($,X,K){return $.index=K,i?(K=$.alternate,K!==null?(K=K.index,K<X?($.flags|=2,X):K):($.flags|=2,X)):($.flags|=1048576,X)}function S($){return i&&$.alternate===null&&($.flags|=2),$}function L($,X,K,we){return X===null||X.tag!==6?(X=Ld(K,$.mode,we),X.return=$,X):(X=h(X,K),X.return=$,X)}function z($,X,K,we){var Ye=K.type;return Ye===H?ve($,X,K.props.children,we,K.key):X!==null&&(X.elementType===Ye||typeof Ye=="object"&&Ye!==null&&Ye.$$typeof===ce&&Qp(Ye)===X.type)?(we=h(X,K.props),we.ref=Qo($,X,K),we.return=$,we):(we=Wl(K.type,K.key,K.props,null,$.mode,we),we.ref=Qo($,X,K),we.return=$,we)}function Q($,X,K,we){return X===null||X.tag!==4||X.stateNode.containerInfo!==K.containerInfo||X.stateNode.implementation!==K.implementation?(X=Id(K,$.mode,we),X.return=$,X):(X=h(X,K.children||[]),X.return=$,X)}function ve($,X,K,we,Ye){return X===null||X.tag!==7?(X=cs(K,$.mode,we,Ye),X.return=$,X):(X=h(X,K),X.return=$,X)}function ye($,X,K){if(typeof X=="string"&&X!==""||typeof X=="number")return X=Ld(""+X,$.mode,K),X.return=$,X;if(typeof X=="object"&&X!==null){switch(X.$$typeof){case k:return K=Wl(X.type,X.key,X.props,null,$.mode,K),K.ref=Qo($,null,X),K.return=$,K;case B:return X=Id(X,$.mode,K),X.return=$,X;case ce:var we=X._init;return ye($,we(X._payload),K)}if(lt(X)||ae(X))return X=cs(X,$.mode,K,null),X.return=$,X;xl($,X)}return null}function me($,X,K,we){var Ye=X!==null?X.key:null;if(typeof K=="string"&&K!==""||typeof K=="number")return Ye!==null?null:L($,X,""+K,we);if(typeof K=="object"&&K!==null){switch(K.$$typeof){case k:return K.key===Ye?z($,X,K,we):null;case B:return K.key===Ye?Q($,X,K,we):null;case ce:return Ye=K._init,me($,X,Ye(K._payload),we)}if(lt(K)||ae(K))return Ye!==null?null:ve($,X,K,we,null);xl($,K)}return null}function Ne($,X,K,we,Ye){if(typeof we=="string"&&we!==""||typeof we=="number")return $=$.get(K)||null,L(X,$,""+we,Ye);if(typeof we=="object"&&we!==null){switch(we.$$typeof){case k:return $=$.get(we.key===null?K:we.key)||null,z(X,$,we,Ye);case B:return $=$.get(we.key===null?K:we.key)||null,Q(X,$,we,Ye);case ce:var et=we._init;return Ne($,X,K,et(we._payload),Ye)}if(lt(we)||ae(we))return $=$.get(K)||null,ve(X,$,we,Ye,null);xl(X,we)}return null}function Ve($,X,K,we){for(var Ye=null,et=null,tt=X,ot=X=0,cn=null;tt!==null&&ot<K.length;ot++){tt.index>ot?(cn=tt,tt=null):cn=tt.sibling;var wt=me($,tt,K[ot],we);if(wt===null){tt===null&&(tt=cn);break}i&&tt&&wt.alternate===null&&r($,tt),X=m(wt,X,ot),et===null?Ye=wt:et.sibling=wt,et=wt,tt=cn}if(ot===K.length)return a($,tt),Wt&&ts($,ot),Ye;if(tt===null){for(;ot<K.length;ot++)tt=ye($,K[ot],we),tt!==null&&(X=m(tt,X,ot),et===null?Ye=tt:et.sibling=tt,et=tt);return Wt&&ts($,ot),Ye}for(tt=c($,tt);ot<K.length;ot++)cn=Ne(tt,$,ot,K[ot],we),cn!==null&&(i&&cn.alternate!==null&&tt.delete(cn.key===null?ot:cn.key),X=m(cn,X,ot),et===null?Ye=cn:et.sibling=cn,et=cn);return i&&tt.forEach(function(Cr){return r($,Cr)}),Wt&&ts($,ot),Ye}function We($,X,K,we){var Ye=ae(K);if(typeof Ye!="function")throw Error(t(150));if(K=Ye.call(K),K==null)throw Error(t(151));for(var et=Ye=null,tt=X,ot=X=0,cn=null,wt=K.next();tt!==null&&!wt.done;ot++,wt=K.next()){tt.index>ot?(cn=tt,tt=null):cn=tt.sibling;var Cr=me($,tt,wt.value,we);if(Cr===null){tt===null&&(tt=cn);break}i&&tt&&Cr.alternate===null&&r($,tt),X=m(Cr,X,ot),et===null?Ye=Cr:et.sibling=Cr,et=Cr,tt=cn}if(wt.done)return a($,tt),Wt&&ts($,ot),Ye;if(tt===null){for(;!wt.done;ot++,wt=K.next())wt=ye($,wt.value,we),wt!==null&&(X=m(wt,X,ot),et===null?Ye=wt:et.sibling=wt,et=wt);return Wt&&ts($,ot),Ye}for(tt=c($,tt);!wt.done;ot++,wt=K.next())wt=Ne(tt,$,ot,wt.value,we),wt!==null&&(i&&wt.alternate!==null&&tt.delete(wt.key===null?ot:wt.key),X=m(wt,X,ot),et===null?Ye=wt:et.sibling=wt,et=wt);return i&&tt.forEach(function(UE){return r($,UE)}),Wt&&ts($,ot),Ye}function qt($,X,K,we){if(typeof K=="object"&&K!==null&&K.type===H&&K.key===null&&(K=K.props.children),typeof K=="object"&&K!==null){switch(K.$$typeof){case k:e:{for(var Ye=K.key,et=X;et!==null;){if(et.key===Ye){if(Ye=K.type,Ye===H){if(et.tag===7){a($,et.sibling),X=h(et,K.props.children),X.return=$,$=X;break e}}else if(et.elementType===Ye||typeof Ye=="object"&&Ye!==null&&Ye.$$typeof===ce&&Qp(Ye)===et.type){a($,et.sibling),X=h(et,K.props),X.ref=Qo($,et,K),X.return=$,$=X;break e}a($,et);break}else r($,et);et=et.sibling}K.type===H?(X=cs(K.props.children,$.mode,we,K.key),X.return=$,$=X):(we=Wl(K.type,K.key,K.props,null,$.mode,we),we.ref=Qo($,X,K),we.return=$,$=we)}return S($);case B:e:{for(et=K.key;X!==null;){if(X.key===et)if(X.tag===4&&X.stateNode.containerInfo===K.containerInfo&&X.stateNode.implementation===K.implementation){a($,X.sibling),X=h(X,K.children||[]),X.return=$,$=X;break e}else{a($,X);break}else r($,X);X=X.sibling}X=Id(K,$.mode,we),X.return=$,$=X}return S($);case ce:return et=K._init,qt($,X,et(K._payload),we)}if(lt(K))return Ve($,X,K,we);if(ae(K))return We($,X,K,we);xl($,K)}return typeof K=="string"&&K!==""||typeof K=="number"?(K=""+K,X!==null&&X.tag===6?(a($,X.sibling),X=h(X,K),X.return=$,$=X):(a($,X),X=Ld(K,$.mode,we),X.return=$,$=X),S($)):a($,X)}return qt}var Ws=Jp(!0),em=Jp(!1),El=vr(null),Sl=null,Xs=null,Hu=null;function Vu(){Hu=Xs=Sl=null}function Gu(i){var r=El.current;Gt(El),i._currentValue=r}function Wu(i,r,a){for(;i!==null;){var c=i.alternate;if((i.childLanes&r)!==r?(i.childLanes|=r,c!==null&&(c.childLanes|=r)):c!==null&&(c.childLanes&r)!==r&&(c.childLanes|=r),i===a)break;i=i.return}}function js(i,r){Sl=i,Hu=Xs=null,i=i.dependencies,i!==null&&i.firstContext!==null&&((i.lanes&r)!==0&&(Fn=!0),i.firstContext=null)}function ii(i){var r=i._currentValue;if(Hu!==i)if(i={context:i,memoizedValue:r,next:null},Xs===null){if(Sl===null)throw Error(t(308));Xs=i,Sl.dependencies={lanes:0,firstContext:i}}else Xs=Xs.next=i;return r}var ns=null;function Xu(i){ns===null?ns=[i]:ns.push(i)}function tm(i,r,a,c){var h=r.interleaved;return h===null?(a.next=a,Xu(r)):(a.next=h.next,h.next=a),r.interleaved=a,ji(i,c)}function ji(i,r){i.lanes|=r;var a=i.alternate;for(a!==null&&(a.lanes|=r),a=i,i=i.return;i!==null;)i.childLanes|=r,a=i.alternate,a!==null&&(a.childLanes|=r),a=i,i=i.return;return a.tag===3?a.stateNode:null}var yr=!1;function ju(i){i.updateQueue={baseState:i.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null}}function nm(i,r){i=i.updateQueue,r.updateQueue===i&&(r.updateQueue={baseState:i.baseState,firstBaseUpdate:i.firstBaseUpdate,lastBaseUpdate:i.lastBaseUpdate,shared:i.shared,effects:i.effects})}function Yi(i,r){return{eventTime:i,lane:r,tag:0,payload:null,callback:null,next:null}}function xr(i,r,a){var c=i.updateQueue;if(c===null)return null;if(c=c.shared,(St&2)!==0){var h=c.pending;return h===null?r.next=r:(r.next=h.next,h.next=r),c.pending=r,ji(i,a)}return h=c.interleaved,h===null?(r.next=r,Xu(c)):(r.next=h.next,h.next=r),c.interleaved=r,ji(i,a)}function Ml(i,r,a){if(r=r.updateQueue,r!==null&&(r=r.shared,(a&4194240)!==0)){var c=r.lanes;c&=i.pendingLanes,a|=c,r.lanes=a,Zr(i,a)}}function im(i,r){var a=i.updateQueue,c=i.alternate;if(c!==null&&(c=c.updateQueue,a===c)){var h=null,m=null;if(a=a.firstBaseUpdate,a!==null){do{var S={eventTime:a.eventTime,lane:a.lane,tag:a.tag,payload:a.payload,callback:a.callback,next:null};m===null?h=m=S:m=m.next=S,a=a.next}while(a!==null);m===null?h=m=r:m=m.next=r}else h=m=r;a={baseState:c.baseState,firstBaseUpdate:h,lastBaseUpdate:m,shared:c.shared,effects:c.effects},i.updateQueue=a;return}i=a.lastBaseUpdate,i===null?a.firstBaseUpdate=r:i.next=r,a.lastBaseUpdate=r}function wl(i,r,a,c){var h=i.updateQueue;yr=!1;var m=h.firstBaseUpdate,S=h.lastBaseUpdate,L=h.shared.pending;if(L!==null){h.shared.pending=null;var z=L,Q=z.next;z.next=null,S===null?m=Q:S.next=Q,S=z;var ve=i.alternate;ve!==null&&(ve=ve.updateQueue,L=ve.lastBaseUpdate,L!==S&&(L===null?ve.firstBaseUpdate=Q:L.next=Q,ve.lastBaseUpdate=z))}if(m!==null){var ye=h.baseState;S=0,ve=Q=z=null,L=m;do{var me=L.lane,Ne=L.eventTime;if((c&me)===me){ve!==null&&(ve=ve.next={eventTime:Ne,lane:0,tag:L.tag,payload:L.payload,callback:L.callback,next:null});e:{var Ve=i,We=L;switch(me=r,Ne=a,We.tag){case 1:if(Ve=We.payload,typeof Ve=="function"){ye=Ve.call(Ne,ye,me);break e}ye=Ve;break e;case 3:Ve.flags=Ve.flags&-65537|128;case 0:if(Ve=We.payload,me=typeof Ve=="function"?Ve.call(Ne,ye,me):Ve,me==null)break e;ye=se({},ye,me);break e;case 2:yr=!0}}L.callback!==null&&L.lane!==0&&(i.flags|=64,me=h.effects,me===null?h.effects=[L]:me.push(L))}else Ne={eventTime:Ne,lane:me,tag:L.tag,payload:L.payload,callback:L.callback,next:null},ve===null?(Q=ve=Ne,z=ye):ve=ve.next=Ne,S|=me;if(L=L.next,L===null){if(L=h.shared.pending,L===null)break;me=L,L=me.next,me.next=null,h.lastBaseUpdate=me,h.shared.pending=null}}while(!0);if(ve===null&&(z=ye),h.baseState=z,h.firstBaseUpdate=Q,h.lastBaseUpdate=ve,r=h.shared.interleaved,r!==null){h=r;do S|=h.lane,h=h.next;while(h!==r)}else m===null&&(h.shared.lanes=0);ss|=S,i.lanes=S,i.memoizedState=ye}}function rm(i,r,a){if(i=r.effects,r.effects=null,i!==null)for(r=0;r<i.length;r++){var c=i[r],h=c.callback;if(h!==null){if(c.callback=null,c=a,typeof h!="function")throw Error(t(191,h));h.call(c)}}}var Jo={},bi=vr(Jo),ea=vr(Jo),ta=vr(Jo);function is(i){if(i===Jo)throw Error(t(174));return i}function Yu(i,r){switch(zt(ta,r),zt(ea,i),zt(bi,Jo),i=r.nodeType,i){case 9:case 11:r=(r=r.documentElement)?r.namespaceURI:ge(null,"");break;default:i=i===8?r.parentNode:r,r=i.namespaceURI||null,i=i.tagName,r=ge(r,i)}Gt(bi),zt(bi,r)}function Ys(){Gt(bi),Gt(ea),Gt(ta)}function sm(i){is(ta.current);var r=is(bi.current),a=ge(r,i.type);r!==a&&(zt(ea,i),zt(bi,a))}function $u(i){ea.current===i&&(Gt(bi),Gt(ea))}var Xt=vr(0);function Tl(i){for(var r=i;r!==null;){if(r.tag===13){var a=r.memoizedState;if(a!==null&&(a=a.dehydrated,a===null||a.data==="$?"||a.data==="$!"))return r}else if(r.tag===19&&r.memoizedProps.revealOrder!==void 0){if((r.flags&128)!==0)return r}else if(r.child!==null){r.child.return=r,r=r.child;continue}if(r===i)break;for(;r.sibling===null;){if(r.return===null||r.return===i)return null;r=r.return}r.sibling.return=r.return,r=r.sibling}return null}var qu=[];function Ku(){for(var i=0;i<qu.length;i++)qu[i]._workInProgressVersionPrimary=null;qu.length=0}var Al=R.ReactCurrentDispatcher,Zu=R.ReactCurrentBatchConfig,rs=0,jt=null,nn=null,an=null,Cl=!1,na=!1,ia=0,tE=0;function Sn(){throw Error(t(321))}function Qu(i,r){if(r===null)return!1;for(var a=0;a<r.length&&a<i.length;a++)if(!fi(i[a],r[a]))return!1;return!0}function Ju(i,r,a,c,h,m){if(rs=m,jt=r,r.memoizedState=null,r.updateQueue=null,r.lanes=0,Al.current=i===null||i.memoizedState===null?sE:oE,i=a(c,h),na){m=0;do{if(na=!1,ia=0,25<=m)throw Error(t(301));m+=1,an=nn=null,r.updateQueue=null,Al.current=aE,i=a(c,h)}while(na)}if(Al.current=Pl,r=nn!==null&&nn.next!==null,rs=0,an=nn=jt=null,Cl=!1,r)throw Error(t(300));return i}function ed(){var i=ia!==0;return ia=0,i}function Pi(){var i={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return an===null?jt.memoizedState=an=i:an=an.next=i,an}function ri(){if(nn===null){var i=jt.alternate;i=i!==null?i.memoizedState:null}else i=nn.next;var r=an===null?jt.memoizedState:an.next;if(r!==null)an=r,nn=i;else{if(i===null)throw Error(t(310));nn=i,i={memoizedState:nn.memoizedState,baseState:nn.baseState,baseQueue:nn.baseQueue,queue:nn.queue,next:null},an===null?jt.memoizedState=an=i:an=an.next=i}return an}function ra(i,r){return typeof r=="function"?r(i):r}function td(i){var r=ri(),a=r.queue;if(a===null)throw Error(t(311));a.lastRenderedReducer=i;var c=nn,h=c.baseQueue,m=a.pending;if(m!==null){if(h!==null){var S=h.next;h.next=m.next,m.next=S}c.baseQueue=h=m,a.pending=null}if(h!==null){m=h.next,c=c.baseState;var L=S=null,z=null,Q=m;do{var ve=Q.lane;if((rs&ve)===ve)z!==null&&(z=z.next={lane:0,action:Q.action,hasEagerState:Q.hasEagerState,eagerState:Q.eagerState,next:null}),c=Q.hasEagerState?Q.eagerState:i(c,Q.action);else{var ye={lane:ve,action:Q.action,hasEagerState:Q.hasEagerState,eagerState:Q.eagerState,next:null};z===null?(L=z=ye,S=c):z=z.next=ye,jt.lanes|=ve,ss|=ve}Q=Q.next}while(Q!==null&&Q!==m);z===null?S=c:z.next=L,fi(c,r.memoizedState)||(Fn=!0),r.memoizedState=c,r.baseState=S,r.baseQueue=z,a.lastRenderedState=c}if(i=a.interleaved,i!==null){h=i;do m=h.lane,jt.lanes|=m,ss|=m,h=h.next;while(h!==i)}else h===null&&(a.lanes=0);return[r.memoizedState,a.dispatch]}function nd(i){var r=ri(),a=r.queue;if(a===null)throw Error(t(311));a.lastRenderedReducer=i;var c=a.dispatch,h=a.pending,m=r.memoizedState;if(h!==null){a.pending=null;var S=h=h.next;do m=i(m,S.action),S=S.next;while(S!==h);fi(m,r.memoizedState)||(Fn=!0),r.memoizedState=m,r.baseQueue===null&&(r.baseState=m),a.lastRenderedState=m}return[m,c]}function om(){}function am(i,r){var a=jt,c=ri(),h=r(),m=!fi(c.memoizedState,h);if(m&&(c.memoizedState=h,Fn=!0),c=c.queue,id(um.bind(null,a,c,i),[i]),c.getSnapshot!==r||m||an!==null&&an.memoizedState.tag&1){if(a.flags|=2048,sa(9,cm.bind(null,a,c,h,r),void 0,null),ln===null)throw Error(t(349));(rs&30)!==0||lm(a,r,h)}return h}function lm(i,r,a){i.flags|=16384,i={getSnapshot:r,value:a},r=jt.updateQueue,r===null?(r={lastEffect:null,stores:null},jt.updateQueue=r,r.stores=[i]):(a=r.stores,a===null?r.stores=[i]:a.push(i))}function cm(i,r,a,c){r.value=a,r.getSnapshot=c,dm(r)&&hm(i)}function um(i,r,a){return a(function(){dm(r)&&hm(i)})}function dm(i){var r=i.getSnapshot;i=i.value;try{var a=r();return!fi(i,a)}catch{return!0}}function hm(i){var r=ji(i,1);r!==null&&_i(r,i,1,-1)}function fm(i){var r=Pi();return typeof i=="function"&&(i=i()),r.memoizedState=r.baseState=i,i={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:ra,lastRenderedState:i},r.queue=i,i=i.dispatch=rE.bind(null,jt,i),[r.memoizedState,i]}function sa(i,r,a,c){return i={tag:i,create:r,destroy:a,deps:c,next:null},r=jt.updateQueue,r===null?(r={lastEffect:null,stores:null},jt.updateQueue=r,r.lastEffect=i.next=i):(a=r.lastEffect,a===null?r.lastEffect=i.next=i:(c=a.next,a.next=i,i.next=c,r.lastEffect=i)),i}function pm(){return ri().memoizedState}function Rl(i,r,a,c){var h=Pi();jt.flags|=i,h.memoizedState=sa(1|r,a,void 0,c===void 0?null:c)}function bl(i,r,a,c){var h=ri();c=c===void 0?null:c;var m=void 0;if(nn!==null){var S=nn.memoizedState;if(m=S.destroy,c!==null&&Qu(c,S.deps)){h.memoizedState=sa(r,a,m,c);return}}jt.flags|=i,h.memoizedState=sa(1|r,a,m,c)}function mm(i,r){return Rl(8390656,8,i,r)}function id(i,r){return bl(2048,8,i,r)}function vm(i,r){return bl(4,2,i,r)}function gm(i,r){return bl(4,4,i,r)}function _m(i,r){if(typeof r=="function")return i=i(),r(i),function(){r(null)};if(r!=null)return i=i(),r.current=i,function(){r.current=null}}function ym(i,r,a){return a=a!=null?a.concat([i]):null,bl(4,4,_m.bind(null,r,i),a)}function rd(){}function xm(i,r){var a=ri();r=r===void 0?null:r;var c=a.memoizedState;return c!==null&&r!==null&&Qu(r,c[1])?c[0]:(a.memoizedState=[i,r],i)}function Em(i,r){var a=ri();r=r===void 0?null:r;var c=a.memoizedState;return c!==null&&r!==null&&Qu(r,c[1])?c[0]:(i=i(),a.memoizedState=[i,r],i)}function Sm(i,r,a){return(rs&21)===0?(i.baseState&&(i.baseState=!1,Fn=!0),i.memoizedState=a):(fi(a,r)||(a=Rn(),jt.lanes|=a,ss|=a,i.baseState=!0),r)}function nE(i,r){var a=vt;vt=a!==0&&4>a?a:4,i(!0);var c=Zu.transition;Zu.transition={};try{i(!1),r()}finally{vt=a,Zu.transition=c}}function Mm(){return ri().memoizedState}function iE(i,r,a){var c=wr(i);if(a={lane:c,action:a,hasEagerState:!1,eagerState:null,next:null},wm(i))Tm(r,a);else if(a=tm(i,r,a,c),a!==null){var h=Pn();_i(a,i,c,h),Am(a,r,c)}}function rE(i,r,a){var c=wr(i),h={lane:c,action:a,hasEagerState:!1,eagerState:null,next:null};if(wm(i))Tm(r,h);else{var m=i.alternate;if(i.lanes===0&&(m===null||m.lanes===0)&&(m=r.lastRenderedReducer,m!==null))try{var S=r.lastRenderedState,L=m(S,a);if(h.hasEagerState=!0,h.eagerState=L,fi(L,S)){var z=r.interleaved;z===null?(h.next=h,Xu(r)):(h.next=z.next,z.next=h),r.interleaved=h;return}}catch{}finally{}a=tm(i,r,h,c),a!==null&&(h=Pn(),_i(a,i,c,h),Am(a,r,c))}}function wm(i){var r=i.alternate;return i===jt||r!==null&&r===jt}function Tm(i,r){na=Cl=!0;var a=i.pending;a===null?r.next=r:(r.next=a.next,a.next=r),i.pending=r}function Am(i,r,a){if((a&4194240)!==0){var c=r.lanes;c&=i.pendingLanes,a|=c,r.lanes=a,Zr(i,a)}}var Pl={readContext:ii,useCallback:Sn,useContext:Sn,useEffect:Sn,useImperativeHandle:Sn,useInsertionEffect:Sn,useLayoutEffect:Sn,useMemo:Sn,useReducer:Sn,useRef:Sn,useState:Sn,useDebugValue:Sn,useDeferredValue:Sn,useTransition:Sn,useMutableSource:Sn,useSyncExternalStore:Sn,useId:Sn,unstable_isNewReconciler:!1},sE={readContext:ii,useCallback:function(i,r){return Pi().memoizedState=[i,r===void 0?null:r],i},useContext:ii,useEffect:mm,useImperativeHandle:function(i,r,a){return a=a!=null?a.concat([i]):null,Rl(4194308,4,_m.bind(null,r,i),a)},useLayoutEffect:function(i,r){return Rl(4194308,4,i,r)},useInsertionEffect:function(i,r){return Rl(4,2,i,r)},useMemo:function(i,r){var a=Pi();return r=r===void 0?null:r,i=i(),a.memoizedState=[i,r],i},useReducer:function(i,r,a){var c=Pi();return r=a!==void 0?a(r):r,c.memoizedState=c.baseState=r,i={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:i,lastRenderedState:r},c.queue=i,i=i.dispatch=iE.bind(null,jt,i),[c.memoizedState,i]},useRef:function(i){var r=Pi();return i={current:i},r.memoizedState=i},useState:fm,useDebugValue:rd,useDeferredValue:function(i){return Pi().memoizedState=i},useTransition:function(){var i=fm(!1),r=i[0];return i=nE.bind(null,i[1]),Pi().memoizedState=i,[r,i]},useMutableSource:function(){},useSyncExternalStore:function(i,r,a){var c=jt,h=Pi();if(Wt){if(a===void 0)throw Error(t(407));a=a()}else{if(a=r(),ln===null)throw Error(t(349));(rs&30)!==0||lm(c,r,a)}h.memoizedState=a;var m={value:a,getSnapshot:r};return h.queue=m,mm(um.bind(null,c,m,i),[i]),c.flags|=2048,sa(9,cm.bind(null,c,m,a,r),void 0,null),a},useId:function(){var i=Pi(),r=ln.identifierPrefix;if(Wt){var a=Xi,c=Wi;a=(c&~(1<<32-xt(c)-1)).toString(32)+a,r=":"+r+"R"+a,a=ia++,0<a&&(r+="H"+a.toString(32)),r+=":"}else a=tE++,r=":"+r+"r"+a.toString(32)+":";return i.memoizedState=r},unstable_isNewReconciler:!1},oE={readContext:ii,useCallback:xm,useContext:ii,useEffect:id,useImperativeHandle:ym,useInsertionEffect:vm,useLayoutEffect:gm,useMemo:Em,useReducer:td,useRef:pm,useState:function(){return td(ra)},useDebugValue:rd,useDeferredValue:function(i){var r=ri();return Sm(r,nn.memoizedState,i)},useTransition:function(){var i=td(ra)[0],r=ri().memoizedState;return[i,r]},useMutableSource:om,useSyncExternalStore:am,useId:Mm,unstable_isNewReconciler:!1},aE={readContext:ii,useCallback:xm,useContext:ii,useEffect:id,useImperativeHandle:ym,useInsertionEffect:vm,useLayoutEffect:gm,useMemo:Em,useReducer:nd,useRef:pm,useState:function(){return nd(ra)},useDebugValue:rd,useDeferredValue:function(i){var r=ri();return nn===null?r.memoizedState=i:Sm(r,nn.memoizedState,i)},useTransition:function(){var i=nd(ra)[0],r=ri().memoizedState;return[i,r]},useMutableSource:om,useSyncExternalStore:am,useId:Mm,unstable_isNewReconciler:!1};function mi(i,r){if(i&&i.defaultProps){r=se({},r),i=i.defaultProps;for(var a in i)r[a]===void 0&&(r[a]=i[a]);return r}return r}function sd(i,r,a,c){r=i.memoizedState,a=a(c,r),a=a==null?r:se({},r,a),i.memoizedState=a,i.lanes===0&&(i.updateQueue.baseState=a)}var Ll={isMounted:function(i){return(i=i._reactInternals)?Hi(i)===i:!1},enqueueSetState:function(i,r,a){i=i._reactInternals;var c=Pn(),h=wr(i),m=Yi(c,h);m.payload=r,a!=null&&(m.callback=a),r=xr(i,m,h),r!==null&&(_i(r,i,h,c),Ml(r,i,h))},enqueueReplaceState:function(i,r,a){i=i._reactInternals;var c=Pn(),h=wr(i),m=Yi(c,h);m.tag=1,m.payload=r,a!=null&&(m.callback=a),r=xr(i,m,h),r!==null&&(_i(r,i,h,c),Ml(r,i,h))},enqueueForceUpdate:function(i,r){i=i._reactInternals;var a=Pn(),c=wr(i),h=Yi(a,c);h.tag=2,r!=null&&(h.callback=r),r=xr(i,h,c),r!==null&&(_i(r,i,c,a),Ml(r,i,c))}};function Cm(i,r,a,c,h,m,S){return i=i.stateNode,typeof i.shouldComponentUpdate=="function"?i.shouldComponentUpdate(c,m,S):r.prototype&&r.prototype.isPureReactComponent?!Xo(a,c)||!Xo(h,m):!0}function Rm(i,r,a){var c=!1,h=gr,m=r.contextType;return typeof m=="object"&&m!==null?m=ii(m):(h=On(r)?Jr:En.current,c=r.contextTypes,m=(c=c!=null)?Bs(i,h):gr),r=new r(a,m),i.memoizedState=r.state!==null&&r.state!==void 0?r.state:null,r.updater=Ll,i.stateNode=r,r._reactInternals=i,c&&(i=i.stateNode,i.__reactInternalMemoizedUnmaskedChildContext=h,i.__reactInternalMemoizedMaskedChildContext=m),r}function bm(i,r,a,c){i=r.state,typeof r.componentWillReceiveProps=="function"&&r.componentWillReceiveProps(a,c),typeof r.UNSAFE_componentWillReceiveProps=="function"&&r.UNSAFE_componentWillReceiveProps(a,c),r.state!==i&&Ll.enqueueReplaceState(r,r.state,null)}function od(i,r,a,c){var h=i.stateNode;h.props=a,h.state=i.memoizedState,h.refs={},ju(i);var m=r.contextType;typeof m=="object"&&m!==null?h.context=ii(m):(m=On(r)?Jr:En.current,h.context=Bs(i,m)),h.state=i.memoizedState,m=r.getDerivedStateFromProps,typeof m=="function"&&(sd(i,r,m,a),h.state=i.memoizedState),typeof r.getDerivedStateFromProps=="function"||typeof h.getSnapshotBeforeUpdate=="function"||typeof h.UNSAFE_componentWillMount!="function"&&typeof h.componentWillMount!="function"||(r=h.state,typeof h.componentWillMount=="function"&&h.componentWillMount(),typeof h.UNSAFE_componentWillMount=="function"&&h.UNSAFE_componentWillMount(),r!==h.state&&Ll.enqueueReplaceState(h,h.state,null),wl(i,a,h,c),h.state=i.memoizedState),typeof h.componentDidMount=="function"&&(i.flags|=4194308)}function $s(i,r){try{var a="",c=r;do a+=V(c),c=c.return;while(c);var h=a}catch(m){h=`
Error generating stack: `+m.message+`
`+m.stack}return{value:i,source:r,stack:h,digest:null}}function ad(i,r,a){return{value:i,source:null,stack:a??null,digest:r??null}}function ld(i,r){try{console.error(r.value)}catch(a){setTimeout(function(){throw a})}}var lE=typeof WeakMap=="function"?WeakMap:Map;function Pm(i,r,a){a=Yi(-1,a),a.tag=3,a.payload={element:null};var c=r.value;return a.callback=function(){kl||(kl=!0,Md=c),ld(i,r)},a}function Lm(i,r,a){a=Yi(-1,a),a.tag=3;var c=i.type.getDerivedStateFromError;if(typeof c=="function"){var h=r.value;a.payload=function(){return c(h)},a.callback=function(){ld(i,r)}}var m=i.stateNode;return m!==null&&typeof m.componentDidCatch=="function"&&(a.callback=function(){ld(i,r),typeof c!="function"&&(Sr===null?Sr=new Set([this]):Sr.add(this));var S=r.stack;this.componentDidCatch(r.value,{componentStack:S!==null?S:""})}),a}function Im(i,r,a){var c=i.pingCache;if(c===null){c=i.pingCache=new lE;var h=new Set;c.set(r,h)}else h=c.get(r),h===void 0&&(h=new Set,c.set(r,h));h.has(a)||(h.add(a),i=SE.bind(null,i,r,a),r.then(i,i))}function Um(i){do{var r;if((r=i.tag===13)&&(r=i.memoizedState,r=r!==null?r.dehydrated!==null:!0),r)return i;i=i.return}while(i!==null);return null}function Dm(i,r,a,c,h){return(i.mode&1)===0?(i===r?i.flags|=65536:(i.flags|=128,a.flags|=131072,a.flags&=-52805,a.tag===1&&(a.alternate===null?a.tag=17:(r=Yi(-1,1),r.tag=2,xr(a,r,1))),a.lanes|=1),i):(i.flags|=65536,i.lanes=h,i)}var cE=R.ReactCurrentOwner,Fn=!1;function bn(i,r,a,c){r.child=i===null?em(r,null,a,c):Ws(r,i.child,a,c)}function Nm(i,r,a,c,h){a=a.render;var m=r.ref;return js(r,h),c=Ju(i,r,a,c,m,h),a=ed(),i!==null&&!Fn?(r.updateQueue=i.updateQueue,r.flags&=-2053,i.lanes&=~h,$i(i,r,h)):(Wt&&a&&Ou(r),r.flags|=1,bn(i,r,c,h),r.child)}function Om(i,r,a,c,h){if(i===null){var m=a.type;return typeof m=="function"&&!Pd(m)&&m.defaultProps===void 0&&a.compare===null&&a.defaultProps===void 0?(r.tag=15,r.type=m,Fm(i,r,m,c,h)):(i=Wl(a.type,null,c,r,r.mode,h),i.ref=r.ref,i.return=r,r.child=i)}if(m=i.child,(i.lanes&h)===0){var S=m.memoizedProps;if(a=a.compare,a=a!==null?a:Xo,a(S,c)&&i.ref===r.ref)return $i(i,r,h)}return r.flags|=1,i=Ar(m,c),i.ref=r.ref,i.return=r,r.child=i}function Fm(i,r,a,c,h){if(i!==null){var m=i.memoizedProps;if(Xo(m,c)&&i.ref===r.ref)if(Fn=!1,r.pendingProps=c=m,(i.lanes&h)!==0)(i.flags&131072)!==0&&(Fn=!0);else return r.lanes=i.lanes,$i(i,r,h)}return cd(i,r,a,c,h)}function km(i,r,a){var c=r.pendingProps,h=c.children,m=i!==null?i.memoizedState:null;if(c.mode==="hidden")if((r.mode&1)===0)r.memoizedState={baseLanes:0,cachePool:null,transitions:null},zt(Ks,$n),$n|=a;else{if((a&1073741824)===0)return i=m!==null?m.baseLanes|a:a,r.lanes=r.childLanes=1073741824,r.memoizedState={baseLanes:i,cachePool:null,transitions:null},r.updateQueue=null,zt(Ks,$n),$n|=i,null;r.memoizedState={baseLanes:0,cachePool:null,transitions:null},c=m!==null?m.baseLanes:a,zt(Ks,$n),$n|=c}else m!==null?(c=m.baseLanes|a,r.memoizedState=null):c=a,zt(Ks,$n),$n|=c;return bn(i,r,h,a),r.child}function zm(i,r){var a=r.ref;(i===null&&a!==null||i!==null&&i.ref!==a)&&(r.flags|=512,r.flags|=2097152)}function cd(i,r,a,c,h){var m=On(a)?Jr:En.current;return m=Bs(r,m),js(r,h),a=Ju(i,r,a,c,m,h),c=ed(),i!==null&&!Fn?(r.updateQueue=i.updateQueue,r.flags&=-2053,i.lanes&=~h,$i(i,r,h)):(Wt&&c&&Ou(r),r.flags|=1,bn(i,r,a,h),r.child)}function Bm(i,r,a,c,h){if(On(a)){var m=!0;ml(r)}else m=!1;if(js(r,h),r.stateNode===null)Ul(i,r),Rm(r,a,c),od(r,a,c,h),c=!0;else if(i===null){var S=r.stateNode,L=r.memoizedProps;S.props=L;var z=S.context,Q=a.contextType;typeof Q=="object"&&Q!==null?Q=ii(Q):(Q=On(a)?Jr:En.current,Q=Bs(r,Q));var ve=a.getDerivedStateFromProps,ye=typeof ve=="function"||typeof S.getSnapshotBeforeUpdate=="function";ye||typeof S.UNSAFE_componentWillReceiveProps!="function"&&typeof S.componentWillReceiveProps!="function"||(L!==c||z!==Q)&&bm(r,S,c,Q),yr=!1;var me=r.memoizedState;S.state=me,wl(r,c,S,h),z=r.memoizedState,L!==c||me!==z||Nn.current||yr?(typeof ve=="function"&&(sd(r,a,ve,c),z=r.memoizedState),(L=yr||Cm(r,a,L,c,me,z,Q))?(ye||typeof S.UNSAFE_componentWillMount!="function"&&typeof S.componentWillMount!="function"||(typeof S.componentWillMount=="function"&&S.componentWillMount(),typeof S.UNSAFE_componentWillMount=="function"&&S.UNSAFE_componentWillMount()),typeof S.componentDidMount=="function"&&(r.flags|=4194308)):(typeof S.componentDidMount=="function"&&(r.flags|=4194308),r.memoizedProps=c,r.memoizedState=z),S.props=c,S.state=z,S.context=Q,c=L):(typeof S.componentDidMount=="function"&&(r.flags|=4194308),c=!1)}else{S=r.stateNode,nm(i,r),L=r.memoizedProps,Q=r.type===r.elementType?L:mi(r.type,L),S.props=Q,ye=r.pendingProps,me=S.context,z=a.contextType,typeof z=="object"&&z!==null?z=ii(z):(z=On(a)?Jr:En.current,z=Bs(r,z));var Ne=a.getDerivedStateFromProps;(ve=typeof Ne=="function"||typeof S.getSnapshotBeforeUpdate=="function")||typeof S.UNSAFE_componentWillReceiveProps!="function"&&typeof S.componentWillReceiveProps!="function"||(L!==ye||me!==z)&&bm(r,S,c,z),yr=!1,me=r.memoizedState,S.state=me,wl(r,c,S,h);var Ve=r.memoizedState;L!==ye||me!==Ve||Nn.current||yr?(typeof Ne=="function"&&(sd(r,a,Ne,c),Ve=r.memoizedState),(Q=yr||Cm(r,a,Q,c,me,Ve,z)||!1)?(ve||typeof S.UNSAFE_componentWillUpdate!="function"&&typeof S.componentWillUpdate!="function"||(typeof S.componentWillUpdate=="function"&&S.componentWillUpdate(c,Ve,z),typeof S.UNSAFE_componentWillUpdate=="function"&&S.UNSAFE_componentWillUpdate(c,Ve,z)),typeof S.componentDidUpdate=="function"&&(r.flags|=4),typeof S.getSnapshotBeforeUpdate=="function"&&(r.flags|=1024)):(typeof S.componentDidUpdate!="function"||L===i.memoizedProps&&me===i.memoizedState||(r.flags|=4),typeof S.getSnapshotBeforeUpdate!="function"||L===i.memoizedProps&&me===i.memoizedState||(r.flags|=1024),r.memoizedProps=c,r.memoizedState=Ve),S.props=c,S.state=Ve,S.context=z,c=Q):(typeof S.componentDidUpdate!="function"||L===i.memoizedProps&&me===i.memoizedState||(r.flags|=4),typeof S.getSnapshotBeforeUpdate!="function"||L===i.memoizedProps&&me===i.memoizedState||(r.flags|=1024),c=!1)}return ud(i,r,a,c,m,h)}function ud(i,r,a,c,h,m){zm(i,r);var S=(r.flags&128)!==0;if(!c&&!S)return h&&Xp(r,a,!1),$i(i,r,m);c=r.stateNode,cE.current=r;var L=S&&typeof a.getDerivedStateFromError!="function"?null:c.render();return r.flags|=1,i!==null&&S?(r.child=Ws(r,i.child,null,m),r.child=Ws(r,null,L,m)):bn(i,r,L,m),r.memoizedState=c.state,h&&Xp(r,a,!0),r.child}function Hm(i){var r=i.stateNode;r.pendingContext?Gp(i,r.pendingContext,r.pendingContext!==r.context):r.context&&Gp(i,r.context,!1),Yu(i,r.containerInfo)}function Vm(i,r,a,c,h){return Gs(),Bu(h),r.flags|=256,bn(i,r,a,c),r.child}var dd={dehydrated:null,treeContext:null,retryLane:0};function hd(i){return{baseLanes:i,cachePool:null,transitions:null}}function Gm(i,r,a){var c=r.pendingProps,h=Xt.current,m=!1,S=(r.flags&128)!==0,L;if((L=S)||(L=i!==null&&i.memoizedState===null?!1:(h&2)!==0),L?(m=!0,r.flags&=-129):(i===null||i.memoizedState!==null)&&(h|=1),zt(Xt,h&1),i===null)return zu(r),i=r.memoizedState,i!==null&&(i=i.dehydrated,i!==null)?((r.mode&1)===0?r.lanes=1:i.data==="$!"?r.lanes=8:r.lanes=1073741824,null):(S=c.children,i=c.fallback,m?(c=r.mode,m=r.child,S={mode:"hidden",children:S},(c&1)===0&&m!==null?(m.childLanes=0,m.pendingProps=S):m=Xl(S,c,0,null),i=cs(i,c,a,null),m.return=r,i.return=r,m.sibling=i,r.child=m,r.child.memoizedState=hd(a),r.memoizedState=dd,i):fd(r,S));if(h=i.memoizedState,h!==null&&(L=h.dehydrated,L!==null))return uE(i,r,S,c,L,h,a);if(m){m=c.fallback,S=r.mode,h=i.child,L=h.sibling;var z={mode:"hidden",children:c.children};return(S&1)===0&&r.child!==h?(c=r.child,c.childLanes=0,c.pendingProps=z,r.deletions=null):(c=Ar(h,z),c.subtreeFlags=h.subtreeFlags&14680064),L!==null?m=Ar(L,m):(m=cs(m,S,a,null),m.flags|=2),m.return=r,c.return=r,c.sibling=m,r.child=c,c=m,m=r.child,S=i.child.memoizedState,S=S===null?hd(a):{baseLanes:S.baseLanes|a,cachePool:null,transitions:S.transitions},m.memoizedState=S,m.childLanes=i.childLanes&~a,r.memoizedState=dd,c}return m=i.child,i=m.sibling,c=Ar(m,{mode:"visible",children:c.children}),(r.mode&1)===0&&(c.lanes=a),c.return=r,c.sibling=null,i!==null&&(a=r.deletions,a===null?(r.deletions=[i],r.flags|=16):a.push(i)),r.child=c,r.memoizedState=null,c}function fd(i,r){return r=Xl({mode:"visible",children:r},i.mode,0,null),r.return=i,i.child=r}function Il(i,r,a,c){return c!==null&&Bu(c),Ws(r,i.child,null,a),i=fd(r,r.pendingProps.children),i.flags|=2,r.memoizedState=null,i}function uE(i,r,a,c,h,m,S){if(a)return r.flags&256?(r.flags&=-257,c=ad(Error(t(422))),Il(i,r,S,c)):r.memoizedState!==null?(r.child=i.child,r.flags|=128,null):(m=c.fallback,h=r.mode,c=Xl({mode:"visible",children:c.children},h,0,null),m=cs(m,h,S,null),m.flags|=2,c.return=r,m.return=r,c.sibling=m,r.child=c,(r.mode&1)!==0&&Ws(r,i.child,null,S),r.child.memoizedState=hd(S),r.memoizedState=dd,m);if((r.mode&1)===0)return Il(i,r,S,null);if(h.data==="$!"){if(c=h.nextSibling&&h.nextSibling.dataset,c)var L=c.dgst;return c=L,m=Error(t(419)),c=ad(m,c,void 0),Il(i,r,S,c)}if(L=(S&i.childLanes)!==0,Fn||L){if(c=ln,c!==null){switch(S&-S){case 4:h=2;break;case 16:h=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:h=32;break;case 536870912:h=268435456;break;default:h=0}h=(h&(c.suspendedLanes|S))!==0?0:h,h!==0&&h!==m.retryLane&&(m.retryLane=h,ji(i,h),_i(c,i,h,-1))}return bd(),c=ad(Error(t(421))),Il(i,r,S,c)}return h.data==="$?"?(r.flags|=128,r.child=i.child,r=ME.bind(null,i),h._reactRetry=r,null):(i=m.treeContext,Yn=mr(h.nextSibling),jn=r,Wt=!0,pi=null,i!==null&&(ti[ni++]=Wi,ti[ni++]=Xi,ti[ni++]=es,Wi=i.id,Xi=i.overflow,es=r),r=fd(r,c.children),r.flags|=4096,r)}function Wm(i,r,a){i.lanes|=r;var c=i.alternate;c!==null&&(c.lanes|=r),Wu(i.return,r,a)}function pd(i,r,a,c,h){var m=i.memoizedState;m===null?i.memoizedState={isBackwards:r,rendering:null,renderingStartTime:0,last:c,tail:a,tailMode:h}:(m.isBackwards=r,m.rendering=null,m.renderingStartTime=0,m.last=c,m.tail=a,m.tailMode=h)}function Xm(i,r,a){var c=r.pendingProps,h=c.revealOrder,m=c.tail;if(bn(i,r,c.children,a),c=Xt.current,(c&2)!==0)c=c&1|2,r.flags|=128;else{if(i!==null&&(i.flags&128)!==0)e:for(i=r.child;i!==null;){if(i.tag===13)i.memoizedState!==null&&Wm(i,a,r);else if(i.tag===19)Wm(i,a,r);else if(i.child!==null){i.child.return=i,i=i.child;continue}if(i===r)break e;for(;i.sibling===null;){if(i.return===null||i.return===r)break e;i=i.return}i.sibling.return=i.return,i=i.sibling}c&=1}if(zt(Xt,c),(r.mode&1)===0)r.memoizedState=null;else switch(h){case"forwards":for(a=r.child,h=null;a!==null;)i=a.alternate,i!==null&&Tl(i)===null&&(h=a),a=a.sibling;a=h,a===null?(h=r.child,r.child=null):(h=a.sibling,a.sibling=null),pd(r,!1,h,a,m);break;case"backwards":for(a=null,h=r.child,r.child=null;h!==null;){if(i=h.alternate,i!==null&&Tl(i)===null){r.child=h;break}i=h.sibling,h.sibling=a,a=h,h=i}pd(r,!0,a,null,m);break;case"together":pd(r,!1,null,null,void 0);break;default:r.memoizedState=null}return r.child}function Ul(i,r){(r.mode&1)===0&&i!==null&&(i.alternate=null,r.alternate=null,r.flags|=2)}function $i(i,r,a){if(i!==null&&(r.dependencies=i.dependencies),ss|=r.lanes,(a&r.childLanes)===0)return null;if(i!==null&&r.child!==i.child)throw Error(t(153));if(r.child!==null){for(i=r.child,a=Ar(i,i.pendingProps),r.child=a,a.return=r;i.sibling!==null;)i=i.sibling,a=a.sibling=Ar(i,i.pendingProps),a.return=r;a.sibling=null}return r.child}function dE(i,r,a){switch(r.tag){case 3:Hm(r),Gs();break;case 5:sm(r);break;case 1:On(r.type)&&ml(r);break;case 4:Yu(r,r.stateNode.containerInfo);break;case 10:var c=r.type._context,h=r.memoizedProps.value;zt(El,c._currentValue),c._currentValue=h;break;case 13:if(c=r.memoizedState,c!==null)return c.dehydrated!==null?(zt(Xt,Xt.current&1),r.flags|=128,null):(a&r.child.childLanes)!==0?Gm(i,r,a):(zt(Xt,Xt.current&1),i=$i(i,r,a),i!==null?i.sibling:null);zt(Xt,Xt.current&1);break;case 19:if(c=(a&r.childLanes)!==0,(i.flags&128)!==0){if(c)return Xm(i,r,a);r.flags|=128}if(h=r.memoizedState,h!==null&&(h.rendering=null,h.tail=null,h.lastEffect=null),zt(Xt,Xt.current),c)break;return null;case 22:case 23:return r.lanes=0,km(i,r,a)}return $i(i,r,a)}var jm,md,Ym,$m;jm=function(i,r){for(var a=r.child;a!==null;){if(a.tag===5||a.tag===6)i.appendChild(a.stateNode);else if(a.tag!==4&&a.child!==null){a.child.return=a,a=a.child;continue}if(a===r)break;for(;a.sibling===null;){if(a.return===null||a.return===r)return;a=a.return}a.sibling.return=a.return,a=a.sibling}},md=function(){},Ym=function(i,r,a,c){var h=i.memoizedProps;if(h!==c){i=r.stateNode,is(bi.current);var m=null;switch(a){case"input":h=Et(i,h),c=Et(i,c),m=[];break;case"select":h=se({},h,{value:void 0}),c=se({},c,{value:void 0}),m=[];break;case"textarea":h=Ht(i,h),c=Ht(i,c),m=[];break;default:typeof h.onClick!="function"&&typeof c.onClick=="function"&&(i.onclick=hl)}je(a,c);var S;a=null;for(Q in h)if(!c.hasOwnProperty(Q)&&h.hasOwnProperty(Q)&&h[Q]!=null)if(Q==="style"){var L=h[Q];for(S in L)L.hasOwnProperty(S)&&(a||(a={}),a[S]="")}else Q!=="dangerouslySetInnerHTML"&&Q!=="children"&&Q!=="suppressContentEditableWarning"&&Q!=="suppressHydrationWarning"&&Q!=="autoFocus"&&(o.hasOwnProperty(Q)?m||(m=[]):(m=m||[]).push(Q,null));for(Q in c){var z=c[Q];if(L=h!=null?h[Q]:void 0,c.hasOwnProperty(Q)&&z!==L&&(z!=null||L!=null))if(Q==="style")if(L){for(S in L)!L.hasOwnProperty(S)||z&&z.hasOwnProperty(S)||(a||(a={}),a[S]="");for(S in z)z.hasOwnProperty(S)&&L[S]!==z[S]&&(a||(a={}),a[S]=z[S])}else a||(m||(m=[]),m.push(Q,a)),a=z;else Q==="dangerouslySetInnerHTML"?(z=z?z.__html:void 0,L=L?L.__html:void 0,z!=null&&L!==z&&(m=m||[]).push(Q,z)):Q==="children"?typeof z!="string"&&typeof z!="number"||(m=m||[]).push(Q,""+z):Q!=="suppressContentEditableWarning"&&Q!=="suppressHydrationWarning"&&(o.hasOwnProperty(Q)?(z!=null&&Q==="onScroll"&&Vt("scroll",i),m||L===z||(m=[])):(m=m||[]).push(Q,z))}a&&(m=m||[]).push("style",a);var Q=m;(r.updateQueue=Q)&&(r.flags|=4)}},$m=function(i,r,a,c){a!==c&&(r.flags|=4)};function oa(i,r){if(!Wt)switch(i.tailMode){case"hidden":r=i.tail;for(var a=null;r!==null;)r.alternate!==null&&(a=r),r=r.sibling;a===null?i.tail=null:a.sibling=null;break;case"collapsed":a=i.tail;for(var c=null;a!==null;)a.alternate!==null&&(c=a),a=a.sibling;c===null?r||i.tail===null?i.tail=null:i.tail.sibling=null:c.sibling=null}}function Mn(i){var r=i.alternate!==null&&i.alternate.child===i.child,a=0,c=0;if(r)for(var h=i.child;h!==null;)a|=h.lanes|h.childLanes,c|=h.subtreeFlags&14680064,c|=h.flags&14680064,h.return=i,h=h.sibling;else for(h=i.child;h!==null;)a|=h.lanes|h.childLanes,c|=h.subtreeFlags,c|=h.flags,h.return=i,h=h.sibling;return i.subtreeFlags|=c,i.childLanes=a,r}function hE(i,r,a){var c=r.pendingProps;switch(Fu(r),r.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Mn(r),null;case 1:return On(r.type)&&pl(),Mn(r),null;case 3:return c=r.stateNode,Ys(),Gt(Nn),Gt(En),Ku(),c.pendingContext&&(c.context=c.pendingContext,c.pendingContext=null),(i===null||i.child===null)&&(yl(r)?r.flags|=4:i===null||i.memoizedState.isDehydrated&&(r.flags&256)===0||(r.flags|=1024,pi!==null&&(Ad(pi),pi=null))),md(i,r),Mn(r),null;case 5:$u(r);var h=is(ta.current);if(a=r.type,i!==null&&r.stateNode!=null)Ym(i,r,a,c,h),i.ref!==r.ref&&(r.flags|=512,r.flags|=2097152);else{if(!c){if(r.stateNode===null)throw Error(t(166));return Mn(r),null}if(i=is(bi.current),yl(r)){c=r.stateNode,a=r.type;var m=r.memoizedProps;switch(c[Ri]=r,c[Ko]=m,i=(r.mode&1)!==0,a){case"dialog":Vt("cancel",c),Vt("close",c);break;case"iframe":case"object":case"embed":Vt("load",c);break;case"video":case"audio":for(h=0;h<Yo.length;h++)Vt(Yo[h],c);break;case"source":Vt("error",c);break;case"img":case"image":case"link":Vt("error",c),Vt("load",c);break;case"details":Vt("toggle",c);break;case"input":Xe(c,m),Vt("invalid",c);break;case"select":c._wrapperState={wasMultiple:!!m.multiple},Vt("invalid",c);break;case"textarea":P(c,m),Vt("invalid",c)}je(a,m),h=null;for(var S in m)if(m.hasOwnProperty(S)){var L=m[S];S==="children"?typeof L=="string"?c.textContent!==L&&(m.suppressHydrationWarning!==!0&&dl(c.textContent,L,i),h=["children",L]):typeof L=="number"&&c.textContent!==""+L&&(m.suppressHydrationWarning!==!0&&dl(c.textContent,L,i),h=["children",""+L]):o.hasOwnProperty(S)&&L!=null&&S==="onScroll"&&Vt("scroll",c)}switch(a){case"input":Nt(c),Ot(c,m,!0);break;case"textarea":Nt(c),q(c);break;case"select":case"option":break;default:typeof m.onClick=="function"&&(c.onclick=hl)}c=h,r.updateQueue=c,c!==null&&(r.flags|=4)}else{S=h.nodeType===9?h:h.ownerDocument,i==="http://www.w3.org/1999/xhtml"&&(i=he(a)),i==="http://www.w3.org/1999/xhtml"?a==="script"?(i=S.createElement("div"),i.innerHTML="<script><\/script>",i=i.removeChild(i.firstChild)):typeof c.is=="string"?i=S.createElement(a,{is:c.is}):(i=S.createElement(a),a==="select"&&(S=i,c.multiple?S.multiple=!0:c.size&&(S.size=c.size))):i=S.createElementNS(i,a),i[Ri]=r,i[Ko]=c,jm(i,r,!1,!1),r.stateNode=i;e:{switch(S=Re(a,c),a){case"dialog":Vt("cancel",i),Vt("close",i),h=c;break;case"iframe":case"object":case"embed":Vt("load",i),h=c;break;case"video":case"audio":for(h=0;h<Yo.length;h++)Vt(Yo[h],i);h=c;break;case"source":Vt("error",i),h=c;break;case"img":case"image":case"link":Vt("error",i),Vt("load",i),h=c;break;case"details":Vt("toggle",i),h=c;break;case"input":Xe(i,c),h=Et(i,c),Vt("invalid",i);break;case"option":h=c;break;case"select":i._wrapperState={wasMultiple:!!c.multiple},h=se({},c,{value:void 0}),Vt("invalid",i);break;case"textarea":P(i,c),h=Ht(i,c),Vt("invalid",i);break;default:h=c}je(a,h),L=h;for(m in L)if(L.hasOwnProperty(m)){var z=L[m];m==="style"?Le(i,z):m==="dangerouslySetInnerHTML"?(z=z?z.__html:void 0,z!=null&&$e(i,z)):m==="children"?typeof z=="string"?(a!=="textarea"||z!=="")&&Te(i,z):typeof z=="number"&&Te(i,""+z):m!=="suppressContentEditableWarning"&&m!=="suppressHydrationWarning"&&m!=="autoFocus"&&(o.hasOwnProperty(m)?z!=null&&m==="onScroll"&&Vt("scroll",i):z!=null&&I(i,m,z,S))}switch(a){case"input":Nt(i),Ot(i,c,!1);break;case"textarea":Nt(i),q(i);break;case"option":c.value!=null&&i.setAttribute("value",""+_e(c.value));break;case"select":i.multiple=!!c.multiple,m=c.value,m!=null?Bt(i,!!c.multiple,m,!1):c.defaultValue!=null&&Bt(i,!!c.multiple,c.defaultValue,!0);break;default:typeof h.onClick=="function"&&(i.onclick=hl)}switch(a){case"button":case"input":case"select":case"textarea":c=!!c.autoFocus;break e;case"img":c=!0;break e;default:c=!1}}c&&(r.flags|=4)}r.ref!==null&&(r.flags|=512,r.flags|=2097152)}return Mn(r),null;case 6:if(i&&r.stateNode!=null)$m(i,r,i.memoizedProps,c);else{if(typeof c!="string"&&r.stateNode===null)throw Error(t(166));if(a=is(ta.current),is(bi.current),yl(r)){if(c=r.stateNode,a=r.memoizedProps,c[Ri]=r,(m=c.nodeValue!==a)&&(i=jn,i!==null))switch(i.tag){case 3:dl(c.nodeValue,a,(i.mode&1)!==0);break;case 5:i.memoizedProps.suppressHydrationWarning!==!0&&dl(c.nodeValue,a,(i.mode&1)!==0)}m&&(r.flags|=4)}else c=(a.nodeType===9?a:a.ownerDocument).createTextNode(c),c[Ri]=r,r.stateNode=c}return Mn(r),null;case 13:if(Gt(Xt),c=r.memoizedState,i===null||i.memoizedState!==null&&i.memoizedState.dehydrated!==null){if(Wt&&Yn!==null&&(r.mode&1)!==0&&(r.flags&128)===0)Zp(),Gs(),r.flags|=98560,m=!1;else if(m=yl(r),c!==null&&c.dehydrated!==null){if(i===null){if(!m)throw Error(t(318));if(m=r.memoizedState,m=m!==null?m.dehydrated:null,!m)throw Error(t(317));m[Ri]=r}else Gs(),(r.flags&128)===0&&(r.memoizedState=null),r.flags|=4;Mn(r),m=!1}else pi!==null&&(Ad(pi),pi=null),m=!0;if(!m)return r.flags&65536?r:null}return(r.flags&128)!==0?(r.lanes=a,r):(c=c!==null,c!==(i!==null&&i.memoizedState!==null)&&c&&(r.child.flags|=8192,(r.mode&1)!==0&&(i===null||(Xt.current&1)!==0?rn===0&&(rn=3):bd())),r.updateQueue!==null&&(r.flags|=4),Mn(r),null);case 4:return Ys(),md(i,r),i===null&&$o(r.stateNode.containerInfo),Mn(r),null;case 10:return Gu(r.type._context),Mn(r),null;case 17:return On(r.type)&&pl(),Mn(r),null;case 19:if(Gt(Xt),m=r.memoizedState,m===null)return Mn(r),null;if(c=(r.flags&128)!==0,S=m.rendering,S===null)if(c)oa(m,!1);else{if(rn!==0||i!==null&&(i.flags&128)!==0)for(i=r.child;i!==null;){if(S=Tl(i),S!==null){for(r.flags|=128,oa(m,!1),c=S.updateQueue,c!==null&&(r.updateQueue=c,r.flags|=4),r.subtreeFlags=0,c=a,a=r.child;a!==null;)m=a,i=c,m.flags&=14680066,S=m.alternate,S===null?(m.childLanes=0,m.lanes=i,m.child=null,m.subtreeFlags=0,m.memoizedProps=null,m.memoizedState=null,m.updateQueue=null,m.dependencies=null,m.stateNode=null):(m.childLanes=S.childLanes,m.lanes=S.lanes,m.child=S.child,m.subtreeFlags=0,m.deletions=null,m.memoizedProps=S.memoizedProps,m.memoizedState=S.memoizedState,m.updateQueue=S.updateQueue,m.type=S.type,i=S.dependencies,m.dependencies=i===null?null:{lanes:i.lanes,firstContext:i.firstContext}),a=a.sibling;return zt(Xt,Xt.current&1|2),r.child}i=i.sibling}m.tail!==null&&W()>Zs&&(r.flags|=128,c=!0,oa(m,!1),r.lanes=4194304)}else{if(!c)if(i=Tl(S),i!==null){if(r.flags|=128,c=!0,a=i.updateQueue,a!==null&&(r.updateQueue=a,r.flags|=4),oa(m,!0),m.tail===null&&m.tailMode==="hidden"&&!S.alternate&&!Wt)return Mn(r),null}else 2*W()-m.renderingStartTime>Zs&&a!==1073741824&&(r.flags|=128,c=!0,oa(m,!1),r.lanes=4194304);m.isBackwards?(S.sibling=r.child,r.child=S):(a=m.last,a!==null?a.sibling=S:r.child=S,m.last=S)}return m.tail!==null?(r=m.tail,m.rendering=r,m.tail=r.sibling,m.renderingStartTime=W(),r.sibling=null,a=Xt.current,zt(Xt,c?a&1|2:a&1),r):(Mn(r),null);case 22:case 23:return Rd(),c=r.memoizedState!==null,i!==null&&i.memoizedState!==null!==c&&(r.flags|=8192),c&&(r.mode&1)!==0?($n&1073741824)!==0&&(Mn(r),r.subtreeFlags&6&&(r.flags|=8192)):Mn(r),null;case 24:return null;case 25:return null}throw Error(t(156,r.tag))}function fE(i,r){switch(Fu(r),r.tag){case 1:return On(r.type)&&pl(),i=r.flags,i&65536?(r.flags=i&-65537|128,r):null;case 3:return Ys(),Gt(Nn),Gt(En),Ku(),i=r.flags,(i&65536)!==0&&(i&128)===0?(r.flags=i&-65537|128,r):null;case 5:return $u(r),null;case 13:if(Gt(Xt),i=r.memoizedState,i!==null&&i.dehydrated!==null){if(r.alternate===null)throw Error(t(340));Gs()}return i=r.flags,i&65536?(r.flags=i&-65537|128,r):null;case 19:return Gt(Xt),null;case 4:return Ys(),null;case 10:return Gu(r.type._context),null;case 22:case 23:return Rd(),null;case 24:return null;default:return null}}var Dl=!1,wn=!1,pE=typeof WeakSet=="function"?WeakSet:Set,ze=null;function qs(i,r){var a=i.ref;if(a!==null)if(typeof a=="function")try{a(null)}catch(c){Yt(i,r,c)}else a.current=null}function vd(i,r,a){try{a()}catch(c){Yt(i,r,c)}}var qm=!1;function mE(i,r){if(Ru=el,i=Cp(),xu(i)){if("selectionStart"in i)var a={start:i.selectionStart,end:i.selectionEnd};else e:{a=(a=i.ownerDocument)&&a.defaultView||window;var c=a.getSelection&&a.getSelection();if(c&&c.rangeCount!==0){a=c.anchorNode;var h=c.anchorOffset,m=c.focusNode;c=c.focusOffset;try{a.nodeType,m.nodeType}catch{a=null;break e}var S=0,L=-1,z=-1,Q=0,ve=0,ye=i,me=null;t:for(;;){for(var Ne;ye!==a||h!==0&&ye.nodeType!==3||(L=S+h),ye!==m||c!==0&&ye.nodeType!==3||(z=S+c),ye.nodeType===3&&(S+=ye.nodeValue.length),(Ne=ye.firstChild)!==null;)me=ye,ye=Ne;for(;;){if(ye===i)break t;if(me===a&&++Q===h&&(L=S),me===m&&++ve===c&&(z=S),(Ne=ye.nextSibling)!==null)break;ye=me,me=ye.parentNode}ye=Ne}a=L===-1||z===-1?null:{start:L,end:z}}else a=null}a=a||{start:0,end:0}}else a=null;for(bu={focusedElem:i,selectionRange:a},el=!1,ze=r;ze!==null;)if(r=ze,i=r.child,(r.subtreeFlags&1028)!==0&&i!==null)i.return=r,ze=i;else for(;ze!==null;){r=ze;try{var Ve=r.alternate;if((r.flags&1024)!==0)switch(r.tag){case 0:case 11:case 15:break;case 1:if(Ve!==null){var We=Ve.memoizedProps,qt=Ve.memoizedState,$=r.stateNode,X=$.getSnapshotBeforeUpdate(r.elementType===r.type?We:mi(r.type,We),qt);$.__reactInternalSnapshotBeforeUpdate=X}break;case 3:var K=r.stateNode.containerInfo;K.nodeType===1?K.textContent="":K.nodeType===9&&K.documentElement&&K.removeChild(K.documentElement);break;case 5:case 6:case 4:case 17:break;default:throw Error(t(163))}}catch(we){Yt(r,r.return,we)}if(i=r.sibling,i!==null){i.return=r.return,ze=i;break}ze=r.return}return Ve=qm,qm=!1,Ve}function aa(i,r,a){var c=r.updateQueue;if(c=c!==null?c.lastEffect:null,c!==null){var h=c=c.next;do{if((h.tag&i)===i){var m=h.destroy;h.destroy=void 0,m!==void 0&&vd(r,a,m)}h=h.next}while(h!==c)}}function Nl(i,r){if(r=r.updateQueue,r=r!==null?r.lastEffect:null,r!==null){var a=r=r.next;do{if((a.tag&i)===i){var c=a.create;a.destroy=c()}a=a.next}while(a!==r)}}function gd(i){var r=i.ref;if(r!==null){var a=i.stateNode;switch(i.tag){case 5:i=a;break;default:i=a}typeof r=="function"?r(i):r.current=i}}function Km(i){var r=i.alternate;r!==null&&(i.alternate=null,Km(r)),i.child=null,i.deletions=null,i.sibling=null,i.tag===5&&(r=i.stateNode,r!==null&&(delete r[Ri],delete r[Ko],delete r[Uu],delete r[Zx],delete r[Qx])),i.stateNode=null,i.return=null,i.dependencies=null,i.memoizedProps=null,i.memoizedState=null,i.pendingProps=null,i.stateNode=null,i.updateQueue=null}function Zm(i){return i.tag===5||i.tag===3||i.tag===4}function Qm(i){e:for(;;){for(;i.sibling===null;){if(i.return===null||Zm(i.return))return null;i=i.return}for(i.sibling.return=i.return,i=i.sibling;i.tag!==5&&i.tag!==6&&i.tag!==18;){if(i.flags&2||i.child===null||i.tag===4)continue e;i.child.return=i,i=i.child}if(!(i.flags&2))return i.stateNode}}function _d(i,r,a){var c=i.tag;if(c===5||c===6)i=i.stateNode,r?a.nodeType===8?a.parentNode.insertBefore(i,r):a.insertBefore(i,r):(a.nodeType===8?(r=a.parentNode,r.insertBefore(i,a)):(r=a,r.appendChild(i)),a=a._reactRootContainer,a!=null||r.onclick!==null||(r.onclick=hl));else if(c!==4&&(i=i.child,i!==null))for(_d(i,r,a),i=i.sibling;i!==null;)_d(i,r,a),i=i.sibling}function yd(i,r,a){var c=i.tag;if(c===5||c===6)i=i.stateNode,r?a.insertBefore(i,r):a.appendChild(i);else if(c!==4&&(i=i.child,i!==null))for(yd(i,r,a),i=i.sibling;i!==null;)yd(i,r,a),i=i.sibling}var fn=null,vi=!1;function Er(i,r,a){for(a=a.child;a!==null;)Jm(i,r,a),a=a.sibling}function Jm(i,r,a){if(st&&typeof st.onCommitFiberUnmount=="function")try{st.onCommitFiberUnmount(Ze,a)}catch{}switch(a.tag){case 5:wn||qs(a,r);case 6:var c=fn,h=vi;fn=null,Er(i,r,a),fn=c,vi=h,fn!==null&&(vi?(i=fn,a=a.stateNode,i.nodeType===8?i.parentNode.removeChild(a):i.removeChild(a)):fn.removeChild(a.stateNode));break;case 18:fn!==null&&(vi?(i=fn,a=a.stateNode,i.nodeType===8?Iu(i.parentNode,a):i.nodeType===1&&Iu(i,a),zo(i)):Iu(fn,a.stateNode));break;case 4:c=fn,h=vi,fn=a.stateNode.containerInfo,vi=!0,Er(i,r,a),fn=c,vi=h;break;case 0:case 11:case 14:case 15:if(!wn&&(c=a.updateQueue,c!==null&&(c=c.lastEffect,c!==null))){h=c=c.next;do{var m=h,S=m.destroy;m=m.tag,S!==void 0&&((m&2)!==0||(m&4)!==0)&&vd(a,r,S),h=h.next}while(h!==c)}Er(i,r,a);break;case 1:if(!wn&&(qs(a,r),c=a.stateNode,typeof c.componentWillUnmount=="function"))try{c.props=a.memoizedProps,c.state=a.memoizedState,c.componentWillUnmount()}catch(L){Yt(a,r,L)}Er(i,r,a);break;case 21:Er(i,r,a);break;case 22:a.mode&1?(wn=(c=wn)||a.memoizedState!==null,Er(i,r,a),wn=c):Er(i,r,a);break;default:Er(i,r,a)}}function ev(i){var r=i.updateQueue;if(r!==null){i.updateQueue=null;var a=i.stateNode;a===null&&(a=i.stateNode=new pE),r.forEach(function(c){var h=wE.bind(null,i,c);a.has(c)||(a.add(c),c.then(h,h))})}}function gi(i,r){var a=r.deletions;if(a!==null)for(var c=0;c<a.length;c++){var h=a[c];try{var m=i,S=r,L=S;e:for(;L!==null;){switch(L.tag){case 5:fn=L.stateNode,vi=!1;break e;case 3:fn=L.stateNode.containerInfo,vi=!0;break e;case 4:fn=L.stateNode.containerInfo,vi=!0;break e}L=L.return}if(fn===null)throw Error(t(160));Jm(m,S,h),fn=null,vi=!1;var z=h.alternate;z!==null&&(z.return=null),h.return=null}catch(Q){Yt(h,r,Q)}}if(r.subtreeFlags&12854)for(r=r.child;r!==null;)tv(r,i),r=r.sibling}function tv(i,r){var a=i.alternate,c=i.flags;switch(i.tag){case 0:case 11:case 14:case 15:if(gi(r,i),Li(i),c&4){try{aa(3,i,i.return),Nl(3,i)}catch(We){Yt(i,i.return,We)}try{aa(5,i,i.return)}catch(We){Yt(i,i.return,We)}}break;case 1:gi(r,i),Li(i),c&512&&a!==null&&qs(a,a.return);break;case 5:if(gi(r,i),Li(i),c&512&&a!==null&&qs(a,a.return),i.flags&32){var h=i.stateNode;try{Te(h,"")}catch(We){Yt(i,i.return,We)}}if(c&4&&(h=i.stateNode,h!=null)){var m=i.memoizedProps,S=a!==null?a.memoizedProps:m,L=i.type,z=i.updateQueue;if(i.updateQueue=null,z!==null)try{L==="input"&&m.type==="radio"&&m.name!=null&&gt(h,m),Re(L,S);var Q=Re(L,m);for(S=0;S<z.length;S+=2){var ve=z[S],ye=z[S+1];ve==="style"?Le(h,ye):ve==="dangerouslySetInnerHTML"?$e(h,ye):ve==="children"?Te(h,ye):I(h,ve,ye,Q)}switch(L){case"input":Ke(h,m);break;case"textarea":M(h,m);break;case"select":var me=h._wrapperState.wasMultiple;h._wrapperState.wasMultiple=!!m.multiple;var Ne=m.value;Ne!=null?Bt(h,!!m.multiple,Ne,!1):me!==!!m.multiple&&(m.defaultValue!=null?Bt(h,!!m.multiple,m.defaultValue,!0):Bt(h,!!m.multiple,m.multiple?[]:"",!1))}h[Ko]=m}catch(We){Yt(i,i.return,We)}}break;case 6:if(gi(r,i),Li(i),c&4){if(i.stateNode===null)throw Error(t(162));h=i.stateNode,m=i.memoizedProps;try{h.nodeValue=m}catch(We){Yt(i,i.return,We)}}break;case 3:if(gi(r,i),Li(i),c&4&&a!==null&&a.memoizedState.isDehydrated)try{zo(r.containerInfo)}catch(We){Yt(i,i.return,We)}break;case 4:gi(r,i),Li(i);break;case 13:gi(r,i),Li(i),h=i.child,h.flags&8192&&(m=h.memoizedState!==null,h.stateNode.isHidden=m,!m||h.alternate!==null&&h.alternate.memoizedState!==null||(Sd=W())),c&4&&ev(i);break;case 22:if(ve=a!==null&&a.memoizedState!==null,i.mode&1?(wn=(Q=wn)||ve,gi(r,i),wn=Q):gi(r,i),Li(i),c&8192){if(Q=i.memoizedState!==null,(i.stateNode.isHidden=Q)&&!ve&&(i.mode&1)!==0)for(ze=i,ve=i.child;ve!==null;){for(ye=ze=ve;ze!==null;){switch(me=ze,Ne=me.child,me.tag){case 0:case 11:case 14:case 15:aa(4,me,me.return);break;case 1:qs(me,me.return);var Ve=me.stateNode;if(typeof Ve.componentWillUnmount=="function"){c=me,a=me.return;try{r=c,Ve.props=r.memoizedProps,Ve.state=r.memoizedState,Ve.componentWillUnmount()}catch(We){Yt(c,a,We)}}break;case 5:qs(me,me.return);break;case 22:if(me.memoizedState!==null){rv(ye);continue}}Ne!==null?(Ne.return=me,ze=Ne):rv(ye)}ve=ve.sibling}e:for(ve=null,ye=i;;){if(ye.tag===5){if(ve===null){ve=ye;try{h=ye.stateNode,Q?(m=h.style,typeof m.setProperty=="function"?m.setProperty("display","none","important"):m.display="none"):(L=ye.stateNode,z=ye.memoizedProps.style,S=z!=null&&z.hasOwnProperty("display")?z.display:null,L.style.display=Me("display",S))}catch(We){Yt(i,i.return,We)}}}else if(ye.tag===6){if(ve===null)try{ye.stateNode.nodeValue=Q?"":ye.memoizedProps}catch(We){Yt(i,i.return,We)}}else if((ye.tag!==22&&ye.tag!==23||ye.memoizedState===null||ye===i)&&ye.child!==null){ye.child.return=ye,ye=ye.child;continue}if(ye===i)break e;for(;ye.sibling===null;){if(ye.return===null||ye.return===i)break e;ve===ye&&(ve=null),ye=ye.return}ve===ye&&(ve=null),ye.sibling.return=ye.return,ye=ye.sibling}}break;case 19:gi(r,i),Li(i),c&4&&ev(i);break;case 21:break;default:gi(r,i),Li(i)}}function Li(i){var r=i.flags;if(r&2){try{e:{for(var a=i.return;a!==null;){if(Zm(a)){var c=a;break e}a=a.return}throw Error(t(160))}switch(c.tag){case 5:var h=c.stateNode;c.flags&32&&(Te(h,""),c.flags&=-33);var m=Qm(i);yd(i,m,h);break;case 3:case 4:var S=c.stateNode.containerInfo,L=Qm(i);_d(i,L,S);break;default:throw Error(t(161))}}catch(z){Yt(i,i.return,z)}i.flags&=-3}r&4096&&(i.flags&=-4097)}function vE(i,r,a){ze=i,nv(i)}function nv(i,r,a){for(var c=(i.mode&1)!==0;ze!==null;){var h=ze,m=h.child;if(h.tag===22&&c){var S=h.memoizedState!==null||Dl;if(!S){var L=h.alternate,z=L!==null&&L.memoizedState!==null||wn;L=Dl;var Q=wn;if(Dl=S,(wn=z)&&!Q)for(ze=h;ze!==null;)S=ze,z=S.child,S.tag===22&&S.memoizedState!==null?sv(h):z!==null?(z.return=S,ze=z):sv(h);for(;m!==null;)ze=m,nv(m),m=m.sibling;ze=h,Dl=L,wn=Q}iv(i)}else(h.subtreeFlags&8772)!==0&&m!==null?(m.return=h,ze=m):iv(i)}}function iv(i){for(;ze!==null;){var r=ze;if((r.flags&8772)!==0){var a=r.alternate;try{if((r.flags&8772)!==0)switch(r.tag){case 0:case 11:case 15:wn||Nl(5,r);break;case 1:var c=r.stateNode;if(r.flags&4&&!wn)if(a===null)c.componentDidMount();else{var h=r.elementType===r.type?a.memoizedProps:mi(r.type,a.memoizedProps);c.componentDidUpdate(h,a.memoizedState,c.__reactInternalSnapshotBeforeUpdate)}var m=r.updateQueue;m!==null&&rm(r,m,c);break;case 3:var S=r.updateQueue;if(S!==null){if(a=null,r.child!==null)switch(r.child.tag){case 5:a=r.child.stateNode;break;case 1:a=r.child.stateNode}rm(r,S,a)}break;case 5:var L=r.stateNode;if(a===null&&r.flags&4){a=L;var z=r.memoizedProps;switch(r.type){case"button":case"input":case"select":case"textarea":z.autoFocus&&a.focus();break;case"img":z.src&&(a.src=z.src)}}break;case 6:break;case 4:break;case 12:break;case 13:if(r.memoizedState===null){var Q=r.alternate;if(Q!==null){var ve=Q.memoizedState;if(ve!==null){var ye=ve.dehydrated;ye!==null&&zo(ye)}}}break;case 19:case 17:case 21:case 22:case 23:case 25:break;default:throw Error(t(163))}wn||r.flags&512&&gd(r)}catch(me){Yt(r,r.return,me)}}if(r===i){ze=null;break}if(a=r.sibling,a!==null){a.return=r.return,ze=a;break}ze=r.return}}function rv(i){for(;ze!==null;){var r=ze;if(r===i){ze=null;break}var a=r.sibling;if(a!==null){a.return=r.return,ze=a;break}ze=r.return}}function sv(i){for(;ze!==null;){var r=ze;try{switch(r.tag){case 0:case 11:case 15:var a=r.return;try{Nl(4,r)}catch(z){Yt(r,a,z)}break;case 1:var c=r.stateNode;if(typeof c.componentDidMount=="function"){var h=r.return;try{c.componentDidMount()}catch(z){Yt(r,h,z)}}var m=r.return;try{gd(r)}catch(z){Yt(r,m,z)}break;case 5:var S=r.return;try{gd(r)}catch(z){Yt(r,S,z)}}}catch(z){Yt(r,r.return,z)}if(r===i){ze=null;break}var L=r.sibling;if(L!==null){L.return=r.return,ze=L;break}ze=r.return}}var gE=Math.ceil,Ol=R.ReactCurrentDispatcher,xd=R.ReactCurrentOwner,si=R.ReactCurrentBatchConfig,St=0,ln=null,Qt=null,pn=0,$n=0,Ks=vr(0),rn=0,la=null,ss=0,Fl=0,Ed=0,ca=null,kn=null,Sd=0,Zs=1/0,qi=null,kl=!1,Md=null,Sr=null,zl=!1,Mr=null,Bl=0,ua=0,wd=null,Hl=-1,Vl=0;function Pn(){return(St&6)!==0?W():Hl!==-1?Hl:Hl=W()}function wr(i){return(i.mode&1)===0?1:(St&2)!==0&&pn!==0?pn&-pn:eE.transition!==null?(Vl===0&&(Vl=Rn()),Vl):(i=vt,i!==0||(i=window.event,i=i===void 0?16:ap(i.type)),i)}function _i(i,r,a,c){if(50<ua)throw ua=0,wd=null,Error(t(185));$t(i,a,c),((St&2)===0||i!==ln)&&(i===ln&&((St&2)===0&&(Fl|=a),rn===4&&Tr(i,pn)),zn(i,c),a===1&&St===0&&(r.mode&1)===0&&(Zs=W()+500,vl&&_r()))}function zn(i,r){var a=i.callbackNode;Kr(i,r);var c=hi(i,i===ln?pn:0);if(c===0)a!==null&&j(a),i.callbackNode=null,i.callbackPriority=0;else if(r=c&-c,i.callbackPriority!==r){if(a!=null&&j(a),r===1)i.tag===0?Jx(av.bind(null,i)):jp(av.bind(null,i)),qx(function(){(St&6)===0&&_r()}),a=null;else{switch(Jf(c)){case 1:a=be;break;case 4:a=He;break;case 16:a=De;break;case 536870912:a=rt;break;default:a=De}a=mv(a,ov.bind(null,i))}i.callbackPriority=r,i.callbackNode=a}}function ov(i,r){if(Hl=-1,Vl=0,(St&6)!==0)throw Error(t(327));var a=i.callbackNode;if(Qs()&&i.callbackNode!==a)return null;var c=hi(i,i===ln?pn:0);if(c===0)return null;if((c&30)!==0||(c&i.expiredLanes)!==0||r)r=Gl(i,c);else{r=c;var h=St;St|=2;var m=cv();(ln!==i||pn!==r)&&(qi=null,Zs=W()+500,as(i,r));do try{xE();break}catch(L){lv(i,L)}while(!0);Vu(),Ol.current=m,St=h,Qt!==null?r=0:(ln=null,pn=0,r=rn)}if(r!==0){if(r===2&&(h=kt(i),h!==0&&(c=h,r=Td(i,h))),r===1)throw a=la,as(i,0),Tr(i,c),zn(i,W()),a;if(r===6)Tr(i,c);else{if(h=i.current.alternate,(c&30)===0&&!_E(h)&&(r=Gl(i,c),r===2&&(m=kt(i),m!==0&&(c=m,r=Td(i,m))),r===1))throw a=la,as(i,0),Tr(i,c),zn(i,W()),a;switch(i.finishedWork=h,i.finishedLanes=c,r){case 0:case 1:throw Error(t(345));case 2:ls(i,kn,qi);break;case 3:if(Tr(i,c),(c&130023424)===c&&(r=Sd+500-W(),10<r)){if(hi(i,0)!==0)break;if(h=i.suspendedLanes,(h&c)!==c){Pn(),i.pingedLanes|=i.suspendedLanes&h;break}i.timeoutHandle=Lu(ls.bind(null,i,kn,qi),r);break}ls(i,kn,qi);break;case 4:if(Tr(i,c),(c&4194240)===c)break;for(r=i.eventTimes,h=-1;0<c;){var S=31-xt(c);m=1<<S,S=r[S],S>h&&(h=S),c&=~m}if(c=h,c=W()-c,c=(120>c?120:480>c?480:1080>c?1080:1920>c?1920:3e3>c?3e3:4320>c?4320:1960*gE(c/1960))-c,10<c){i.timeoutHandle=Lu(ls.bind(null,i,kn,qi),c);break}ls(i,kn,qi);break;case 5:ls(i,kn,qi);break;default:throw Error(t(329))}}}return zn(i,W()),i.callbackNode===a?ov.bind(null,i):null}function Td(i,r){var a=ca;return i.current.memoizedState.isDehydrated&&(as(i,r).flags|=256),i=Gl(i,r),i!==2&&(r=kn,kn=a,r!==null&&Ad(r)),i}function Ad(i){kn===null?kn=i:kn.push.apply(kn,i)}function _E(i){for(var r=i;;){if(r.flags&16384){var a=r.updateQueue;if(a!==null&&(a=a.stores,a!==null))for(var c=0;c<a.length;c++){var h=a[c],m=h.getSnapshot;h=h.value;try{if(!fi(m(),h))return!1}catch{return!1}}}if(a=r.child,r.subtreeFlags&16384&&a!==null)a.return=r,r=a;else{if(r===i)break;for(;r.sibling===null;){if(r.return===null||r.return===i)return!0;r=r.return}r.sibling.return=r.return,r=r.sibling}}return!0}function Tr(i,r){for(r&=~Ed,r&=~Fl,i.suspendedLanes|=r,i.pingedLanes&=~r,i=i.expirationTimes;0<r;){var a=31-xt(r),c=1<<a;i[a]=-1,r&=~c}}function av(i){if((St&6)!==0)throw Error(t(327));Qs();var r=hi(i,0);if((r&1)===0)return zn(i,W()),null;var a=Gl(i,r);if(i.tag!==0&&a===2){var c=kt(i);c!==0&&(r=c,a=Td(i,c))}if(a===1)throw a=la,as(i,0),Tr(i,r),zn(i,W()),a;if(a===6)throw Error(t(345));return i.finishedWork=i.current.alternate,i.finishedLanes=r,ls(i,kn,qi),zn(i,W()),null}function Cd(i,r){var a=St;St|=1;try{return i(r)}finally{St=a,St===0&&(Zs=W()+500,vl&&_r())}}function os(i){Mr!==null&&Mr.tag===0&&(St&6)===0&&Qs();var r=St;St|=1;var a=si.transition,c=vt;try{if(si.transition=null,vt=1,i)return i()}finally{vt=c,si.transition=a,St=r,(St&6)===0&&_r()}}function Rd(){$n=Ks.current,Gt(Ks)}function as(i,r){i.finishedWork=null,i.finishedLanes=0;var a=i.timeoutHandle;if(a!==-1&&(i.timeoutHandle=-1,$x(a)),Qt!==null)for(a=Qt.return;a!==null;){var c=a;switch(Fu(c),c.tag){case 1:c=c.type.childContextTypes,c!=null&&pl();break;case 3:Ys(),Gt(Nn),Gt(En),Ku();break;case 5:$u(c);break;case 4:Ys();break;case 13:Gt(Xt);break;case 19:Gt(Xt);break;case 10:Gu(c.type._context);break;case 22:case 23:Rd()}a=a.return}if(ln=i,Qt=i=Ar(i.current,null),pn=$n=r,rn=0,la=null,Ed=Fl=ss=0,kn=ca=null,ns!==null){for(r=0;r<ns.length;r++)if(a=ns[r],c=a.interleaved,c!==null){a.interleaved=null;var h=c.next,m=a.pending;if(m!==null){var S=m.next;m.next=h,c.next=S}a.pending=c}ns=null}return i}function lv(i,r){do{var a=Qt;try{if(Vu(),Al.current=Pl,Cl){for(var c=jt.memoizedState;c!==null;){var h=c.queue;h!==null&&(h.pending=null),c=c.next}Cl=!1}if(rs=0,an=nn=jt=null,na=!1,ia=0,xd.current=null,a===null||a.return===null){rn=1,la=r,Qt=null;break}e:{var m=i,S=a.return,L=a,z=r;if(r=pn,L.flags|=32768,z!==null&&typeof z=="object"&&typeof z.then=="function"){var Q=z,ve=L,ye=ve.tag;if((ve.mode&1)===0&&(ye===0||ye===11||ye===15)){var me=ve.alternate;me?(ve.updateQueue=me.updateQueue,ve.memoizedState=me.memoizedState,ve.lanes=me.lanes):(ve.updateQueue=null,ve.memoizedState=null)}var Ne=Um(S);if(Ne!==null){Ne.flags&=-257,Dm(Ne,S,L,m,r),Ne.mode&1&&Im(m,Q,r),r=Ne,z=Q;var Ve=r.updateQueue;if(Ve===null){var We=new Set;We.add(z),r.updateQueue=We}else Ve.add(z);break e}else{if((r&1)===0){Im(m,Q,r),bd();break e}z=Error(t(426))}}else if(Wt&&L.mode&1){var qt=Um(S);if(qt!==null){(qt.flags&65536)===0&&(qt.flags|=256),Dm(qt,S,L,m,r),Bu($s(z,L));break e}}m=z=$s(z,L),rn!==4&&(rn=2),ca===null?ca=[m]:ca.push(m),m=S;do{switch(m.tag){case 3:m.flags|=65536,r&=-r,m.lanes|=r;var $=Pm(m,z,r);im(m,$);break e;case 1:L=z;var X=m.type,K=m.stateNode;if((m.flags&128)===0&&(typeof X.getDerivedStateFromError=="function"||K!==null&&typeof K.componentDidCatch=="function"&&(Sr===null||!Sr.has(K)))){m.flags|=65536,r&=-r,m.lanes|=r;var we=Lm(m,L,r);im(m,we);break e}}m=m.return}while(m!==null)}dv(a)}catch(Ye){r=Ye,Qt===a&&a!==null&&(Qt=a=a.return);continue}break}while(!0)}function cv(){var i=Ol.current;return Ol.current=Pl,i===null?Pl:i}function bd(){(rn===0||rn===3||rn===2)&&(rn=4),ln===null||(ss&268435455)===0&&(Fl&268435455)===0||Tr(ln,pn)}function Gl(i,r){var a=St;St|=2;var c=cv();(ln!==i||pn!==r)&&(qi=null,as(i,r));do try{yE();break}catch(h){lv(i,h)}while(!0);if(Vu(),St=a,Ol.current=c,Qt!==null)throw Error(t(261));return ln=null,pn=0,rn}function yE(){for(;Qt!==null;)uv(Qt)}function xE(){for(;Qt!==null&&!ee();)uv(Qt)}function uv(i){var r=pv(i.alternate,i,$n);i.memoizedProps=i.pendingProps,r===null?dv(i):Qt=r,xd.current=null}function dv(i){var r=i;do{var a=r.alternate;if(i=r.return,(r.flags&32768)===0){if(a=hE(a,r,$n),a!==null){Qt=a;return}}else{if(a=fE(a,r),a!==null){a.flags&=32767,Qt=a;return}if(i!==null)i.flags|=32768,i.subtreeFlags=0,i.deletions=null;else{rn=6,Qt=null;return}}if(r=r.sibling,r!==null){Qt=r;return}Qt=r=i}while(r!==null);rn===0&&(rn=5)}function ls(i,r,a){var c=vt,h=si.transition;try{si.transition=null,vt=1,EE(i,r,a,c)}finally{si.transition=h,vt=c}return null}function EE(i,r,a,c){do Qs();while(Mr!==null);if((St&6)!==0)throw Error(t(327));a=i.finishedWork;var h=i.finishedLanes;if(a===null)return null;if(i.finishedWork=null,i.finishedLanes=0,a===i.current)throw Error(t(177));i.callbackNode=null,i.callbackPriority=0;var m=a.lanes|a.childLanes;if(xn(i,m),i===ln&&(Qt=ln=null,pn=0),(a.subtreeFlags&2064)===0&&(a.flags&2064)===0||zl||(zl=!0,mv(De,function(){return Qs(),null})),m=(a.flags&15990)!==0,(a.subtreeFlags&15990)!==0||m){m=si.transition,si.transition=null;var S=vt;vt=1;var L=St;St|=4,xd.current=null,mE(i,a),tv(a,i),Hx(bu),el=!!Ru,bu=Ru=null,i.current=a,vE(a),te(),St=L,vt=S,si.transition=m}else i.current=a;if(zl&&(zl=!1,Mr=i,Bl=h),m=i.pendingLanes,m===0&&(Sr=null),Tt(a.stateNode),zn(i,W()),r!==null)for(c=i.onRecoverableError,a=0;a<r.length;a++)h=r[a],c(h.value,{componentStack:h.stack,digest:h.digest});if(kl)throw kl=!1,i=Md,Md=null,i;return(Bl&1)!==0&&i.tag!==0&&Qs(),m=i.pendingLanes,(m&1)!==0?i===wd?ua++:(ua=0,wd=i):ua=0,_r(),null}function Qs(){if(Mr!==null){var i=Jf(Bl),r=si.transition,a=vt;try{if(si.transition=null,vt=16>i?16:i,Mr===null)var c=!1;else{if(i=Mr,Mr=null,Bl=0,(St&6)!==0)throw Error(t(331));var h=St;for(St|=4,ze=i.current;ze!==null;){var m=ze,S=m.child;if((ze.flags&16)!==0){var L=m.deletions;if(L!==null){for(var z=0;z<L.length;z++){var Q=L[z];for(ze=Q;ze!==null;){var ve=ze;switch(ve.tag){case 0:case 11:case 15:aa(8,ve,m)}var ye=ve.child;if(ye!==null)ye.return=ve,ze=ye;else for(;ze!==null;){ve=ze;var me=ve.sibling,Ne=ve.return;if(Km(ve),ve===Q){ze=null;break}if(me!==null){me.return=Ne,ze=me;break}ze=Ne}}}var Ve=m.alternate;if(Ve!==null){var We=Ve.child;if(We!==null){Ve.child=null;do{var qt=We.sibling;We.sibling=null,We=qt}while(We!==null)}}ze=m}}if((m.subtreeFlags&2064)!==0&&S!==null)S.return=m,ze=S;else e:for(;ze!==null;){if(m=ze,(m.flags&2048)!==0)switch(m.tag){case 0:case 11:case 15:aa(9,m,m.return)}var $=m.sibling;if($!==null){$.return=m.return,ze=$;break e}ze=m.return}}var X=i.current;for(ze=X;ze!==null;){S=ze;var K=S.child;if((S.subtreeFlags&2064)!==0&&K!==null)K.return=S,ze=K;else e:for(S=X;ze!==null;){if(L=ze,(L.flags&2048)!==0)try{switch(L.tag){case 0:case 11:case 15:Nl(9,L)}}catch(Ye){Yt(L,L.return,Ye)}if(L===S){ze=null;break e}var we=L.sibling;if(we!==null){we.return=L.return,ze=we;break e}ze=L.return}}if(St=h,_r(),st&&typeof st.onPostCommitFiberRoot=="function")try{st.onPostCommitFiberRoot(Ze,i)}catch{}c=!0}return c}finally{vt=a,si.transition=r}}return!1}function hv(i,r,a){r=$s(a,r),r=Pm(i,r,1),i=xr(i,r,1),r=Pn(),i!==null&&($t(i,1,r),zn(i,r))}function Yt(i,r,a){if(i.tag===3)hv(i,i,a);else for(;r!==null;){if(r.tag===3){hv(r,i,a);break}else if(r.tag===1){var c=r.stateNode;if(typeof r.type.getDerivedStateFromError=="function"||typeof c.componentDidCatch=="function"&&(Sr===null||!Sr.has(c))){i=$s(a,i),i=Lm(r,i,1),r=xr(r,i,1),i=Pn(),r!==null&&($t(r,1,i),zn(r,i));break}}r=r.return}}function SE(i,r,a){var c=i.pingCache;c!==null&&c.delete(r),r=Pn(),i.pingedLanes|=i.suspendedLanes&a,ln===i&&(pn&a)===a&&(rn===4||rn===3&&(pn&130023424)===pn&&500>W()-Sd?as(i,0):Ed|=a),zn(i,r)}function fv(i,r){r===0&&((i.mode&1)===0?r=1:(r=mt,mt<<=1,(mt&130023424)===0&&(mt=4194304)));var a=Pn();i=ji(i,r),i!==null&&($t(i,r,a),zn(i,a))}function ME(i){var r=i.memoizedState,a=0;r!==null&&(a=r.retryLane),fv(i,a)}function wE(i,r){var a=0;switch(i.tag){case 13:var c=i.stateNode,h=i.memoizedState;h!==null&&(a=h.retryLane);break;case 19:c=i.stateNode;break;default:throw Error(t(314))}c!==null&&c.delete(r),fv(i,a)}var pv;pv=function(i,r,a){if(i!==null)if(i.memoizedProps!==r.pendingProps||Nn.current)Fn=!0;else{if((i.lanes&a)===0&&(r.flags&128)===0)return Fn=!1,dE(i,r,a);Fn=(i.flags&131072)!==0}else Fn=!1,Wt&&(r.flags&1048576)!==0&&Yp(r,_l,r.index);switch(r.lanes=0,r.tag){case 2:var c=r.type;Ul(i,r),i=r.pendingProps;var h=Bs(r,En.current);js(r,a),h=Ju(null,r,c,i,h,a);var m=ed();return r.flags|=1,typeof h=="object"&&h!==null&&typeof h.render=="function"&&h.$$typeof===void 0?(r.tag=1,r.memoizedState=null,r.updateQueue=null,On(c)?(m=!0,ml(r)):m=!1,r.memoizedState=h.state!==null&&h.state!==void 0?h.state:null,ju(r),h.updater=Ll,r.stateNode=h,h._reactInternals=r,od(r,c,i,a),r=ud(null,r,c,!0,m,a)):(r.tag=0,Wt&&m&&Ou(r),bn(null,r,h,a),r=r.child),r;case 16:c=r.elementType;e:{switch(Ul(i,r),i=r.pendingProps,h=c._init,c=h(c._payload),r.type=c,h=r.tag=AE(c),i=mi(c,i),h){case 0:r=cd(null,r,c,i,a);break e;case 1:r=Bm(null,r,c,i,a);break e;case 11:r=Nm(null,r,c,i,a);break e;case 14:r=Om(null,r,c,mi(c.type,i),a);break e}throw Error(t(306,c,""))}return r;case 0:return c=r.type,h=r.pendingProps,h=r.elementType===c?h:mi(c,h),cd(i,r,c,h,a);case 1:return c=r.type,h=r.pendingProps,h=r.elementType===c?h:mi(c,h),Bm(i,r,c,h,a);case 3:e:{if(Hm(r),i===null)throw Error(t(387));c=r.pendingProps,m=r.memoizedState,h=m.element,nm(i,r),wl(r,c,null,a);var S=r.memoizedState;if(c=S.element,m.isDehydrated)if(m={element:c,isDehydrated:!1,cache:S.cache,pendingSuspenseBoundaries:S.pendingSuspenseBoundaries,transitions:S.transitions},r.updateQueue.baseState=m,r.memoizedState=m,r.flags&256){h=$s(Error(t(423)),r),r=Vm(i,r,c,a,h);break e}else if(c!==h){h=$s(Error(t(424)),r),r=Vm(i,r,c,a,h);break e}else for(Yn=mr(r.stateNode.containerInfo.firstChild),jn=r,Wt=!0,pi=null,a=em(r,null,c,a),r.child=a;a;)a.flags=a.flags&-3|4096,a=a.sibling;else{if(Gs(),c===h){r=$i(i,r,a);break e}bn(i,r,c,a)}r=r.child}return r;case 5:return sm(r),i===null&&zu(r),c=r.type,h=r.pendingProps,m=i!==null?i.memoizedProps:null,S=h.children,Pu(c,h)?S=null:m!==null&&Pu(c,m)&&(r.flags|=32),zm(i,r),bn(i,r,S,a),r.child;case 6:return i===null&&zu(r),null;case 13:return Gm(i,r,a);case 4:return Yu(r,r.stateNode.containerInfo),c=r.pendingProps,i===null?r.child=Ws(r,null,c,a):bn(i,r,c,a),r.child;case 11:return c=r.type,h=r.pendingProps,h=r.elementType===c?h:mi(c,h),Nm(i,r,c,h,a);case 7:return bn(i,r,r.pendingProps,a),r.child;case 8:return bn(i,r,r.pendingProps.children,a),r.child;case 12:return bn(i,r,r.pendingProps.children,a),r.child;case 10:e:{if(c=r.type._context,h=r.pendingProps,m=r.memoizedProps,S=h.value,zt(El,c._currentValue),c._currentValue=S,m!==null)if(fi(m.value,S)){if(m.children===h.children&&!Nn.current){r=$i(i,r,a);break e}}else for(m=r.child,m!==null&&(m.return=r);m!==null;){var L=m.dependencies;if(L!==null){S=m.child;for(var z=L.firstContext;z!==null;){if(z.context===c){if(m.tag===1){z=Yi(-1,a&-a),z.tag=2;var Q=m.updateQueue;if(Q!==null){Q=Q.shared;var ve=Q.pending;ve===null?z.next=z:(z.next=ve.next,ve.next=z),Q.pending=z}}m.lanes|=a,z=m.alternate,z!==null&&(z.lanes|=a),Wu(m.return,a,r),L.lanes|=a;break}z=z.next}}else if(m.tag===10)S=m.type===r.type?null:m.child;else if(m.tag===18){if(S=m.return,S===null)throw Error(t(341));S.lanes|=a,L=S.alternate,L!==null&&(L.lanes|=a),Wu(S,a,r),S=m.sibling}else S=m.child;if(S!==null)S.return=m;else for(S=m;S!==null;){if(S===r){S=null;break}if(m=S.sibling,m!==null){m.return=S.return,S=m;break}S=S.return}m=S}bn(i,r,h.children,a),r=r.child}return r;case 9:return h=r.type,c=r.pendingProps.children,js(r,a),h=ii(h),c=c(h),r.flags|=1,bn(i,r,c,a),r.child;case 14:return c=r.type,h=mi(c,r.pendingProps),h=mi(c.type,h),Om(i,r,c,h,a);case 15:return Fm(i,r,r.type,r.pendingProps,a);case 17:return c=r.type,h=r.pendingProps,h=r.elementType===c?h:mi(c,h),Ul(i,r),r.tag=1,On(c)?(i=!0,ml(r)):i=!1,js(r,a),Rm(r,c,h),od(r,c,h,a),ud(null,r,c,!0,i,a);case 19:return Xm(i,r,a);case 22:return km(i,r,a)}throw Error(t(156,r.tag))};function mv(i,r){return T(i,r)}function TE(i,r,a,c){this.tag=i,this.key=a,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.ref=null,this.pendingProps=r,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=c,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function oi(i,r,a,c){return new TE(i,r,a,c)}function Pd(i){return i=i.prototype,!(!i||!i.isReactComponent)}function AE(i){if(typeof i=="function")return Pd(i)?1:0;if(i!=null){if(i=i.$$typeof,i===de)return 11;if(i===fe)return 14}return 2}function Ar(i,r){var a=i.alternate;return a===null?(a=oi(i.tag,r,i.key,i.mode),a.elementType=i.elementType,a.type=i.type,a.stateNode=i.stateNode,a.alternate=i,i.alternate=a):(a.pendingProps=r,a.type=i.type,a.flags=0,a.subtreeFlags=0,a.deletions=null),a.flags=i.flags&14680064,a.childLanes=i.childLanes,a.lanes=i.lanes,a.child=i.child,a.memoizedProps=i.memoizedProps,a.memoizedState=i.memoizedState,a.updateQueue=i.updateQueue,r=i.dependencies,a.dependencies=r===null?null:{lanes:r.lanes,firstContext:r.firstContext},a.sibling=i.sibling,a.index=i.index,a.ref=i.ref,a}function Wl(i,r,a,c,h,m){var S=2;if(c=i,typeof i=="function")Pd(i)&&(S=1);else if(typeof i=="string")S=5;else e:switch(i){case H:return cs(a.children,h,m,r);case Y:S=8,h|=8;break;case b:return i=oi(12,a,r,h|2),i.elementType=b,i.lanes=m,i;case ie:return i=oi(13,a,r,h),i.elementType=ie,i.lanes=m,i;case le:return i=oi(19,a,r,h),i.elementType=le,i.lanes=m,i;case oe:return Xl(a,h,m,r);default:if(typeof i=="object"&&i!==null)switch(i.$$typeof){case C:S=10;break e;case D:S=9;break e;case de:S=11;break e;case fe:S=14;break e;case ce:S=16,c=null;break e}throw Error(t(130,i==null?i:typeof i,""))}return r=oi(S,a,r,h),r.elementType=i,r.type=c,r.lanes=m,r}function cs(i,r,a,c){return i=oi(7,i,c,r),i.lanes=a,i}function Xl(i,r,a,c){return i=oi(22,i,c,r),i.elementType=oe,i.lanes=a,i.stateNode={isHidden:!1},i}function Ld(i,r,a){return i=oi(6,i,null,r),i.lanes=a,i}function Id(i,r,a){return r=oi(4,i.children!==null?i.children:[],i.key,r),r.lanes=a,r.stateNode={containerInfo:i.containerInfo,pendingChildren:null,implementation:i.implementation},r}function CE(i,r,a,c,h){this.tag=r,this.containerInfo=i,this.finishedWork=this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.pendingContext=this.context=null,this.callbackPriority=0,this.eventTimes=yn(0),this.expirationTimes=yn(-1),this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=yn(0),this.identifierPrefix=c,this.onRecoverableError=h,this.mutableSourceEagerHydrationData=null}function Ud(i,r,a,c,h,m,S,L,z){return i=new CE(i,r,a,L,z),r===1?(r=1,m===!0&&(r|=8)):r=0,m=oi(3,null,null,r),i.current=m,m.stateNode=i,m.memoizedState={element:c,isDehydrated:a,cache:null,transitions:null,pendingSuspenseBoundaries:null},ju(m),i}function RE(i,r,a){var c=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:B,key:c==null?null:""+c,children:i,containerInfo:r,implementation:a}}function vv(i){if(!i)return gr;i=i._reactInternals;e:{if(Hi(i)!==i||i.tag!==1)throw Error(t(170));var r=i;do{switch(r.tag){case 3:r=r.stateNode.context;break e;case 1:if(On(r.type)){r=r.stateNode.__reactInternalMemoizedMergedChildContext;break e}}r=r.return}while(r!==null);throw Error(t(171))}if(i.tag===1){var a=i.type;if(On(a))return Wp(i,a,r)}return r}function gv(i,r,a,c,h,m,S,L,z){return i=Ud(a,c,!0,i,h,m,S,L,z),i.context=vv(null),a=i.current,c=Pn(),h=wr(a),m=Yi(c,h),m.callback=r??null,xr(a,m,h),i.current.lanes=h,$t(i,h,c),zn(i,c),i}function jl(i,r,a,c){var h=r.current,m=Pn(),S=wr(h);return a=vv(a),r.context===null?r.context=a:r.pendingContext=a,r=Yi(m,S),r.payload={element:i},c=c===void 0?null:c,c!==null&&(r.callback=c),i=xr(h,r,S),i!==null&&(_i(i,h,S,m),Ml(i,h,S)),S}function Yl(i){if(i=i.current,!i.child)return null;switch(i.child.tag){case 5:return i.child.stateNode;default:return i.child.stateNode}}function _v(i,r){if(i=i.memoizedState,i!==null&&i.dehydrated!==null){var a=i.retryLane;i.retryLane=a!==0&&a<r?a:r}}function Dd(i,r){_v(i,r),(i=i.alternate)&&_v(i,r)}function bE(){return null}var yv=typeof reportError=="function"?reportError:function(i){console.error(i)};function Nd(i){this._internalRoot=i}$l.prototype.render=Nd.prototype.render=function(i){var r=this._internalRoot;if(r===null)throw Error(t(409));jl(i,r,null,null)},$l.prototype.unmount=Nd.prototype.unmount=function(){var i=this._internalRoot;if(i!==null){this._internalRoot=null;var r=i.containerInfo;os(function(){jl(null,i,null,null)}),r[Vi]=null}};function $l(i){this._internalRoot=i}$l.prototype.unstable_scheduleHydration=function(i){if(i){var r=np();i={blockedOn:null,target:i,priority:r};for(var a=0;a<hr.length&&r!==0&&r<hr[a].priority;a++);hr.splice(a,0,i),a===0&&sp(i)}};function Od(i){return!(!i||i.nodeType!==1&&i.nodeType!==9&&i.nodeType!==11)}function ql(i){return!(!i||i.nodeType!==1&&i.nodeType!==9&&i.nodeType!==11&&(i.nodeType!==8||i.nodeValue!==" react-mount-point-unstable "))}function xv(){}function PE(i,r,a,c,h){if(h){if(typeof c=="function"){var m=c;c=function(){var Q=Yl(S);m.call(Q)}}var S=gv(r,c,i,0,null,!1,!1,"",xv);return i._reactRootContainer=S,i[Vi]=S.current,$o(i.nodeType===8?i.parentNode:i),os(),S}for(;h=i.lastChild;)i.removeChild(h);if(typeof c=="function"){var L=c;c=function(){var Q=Yl(z);L.call(Q)}}var z=Ud(i,0,!1,null,null,!1,!1,"",xv);return i._reactRootContainer=z,i[Vi]=z.current,$o(i.nodeType===8?i.parentNode:i),os(function(){jl(r,z,a,c)}),z}function Kl(i,r,a,c,h){var m=a._reactRootContainer;if(m){var S=m;if(typeof h=="function"){var L=h;h=function(){var z=Yl(S);L.call(z)}}jl(r,S,i,h)}else S=PE(a,r,i,h,c);return Yl(S)}ep=function(i){switch(i.tag){case 3:var r=i.stateNode;if(r.current.memoizedState.isDehydrated){var a=tn(r.pendingLanes);a!==0&&(Zr(r,a|1),zn(r,W()),(St&6)===0&&(Zs=W()+500,_r()))}break;case 13:os(function(){var c=ji(i,1);if(c!==null){var h=Pn();_i(c,i,1,h)}}),Dd(i,1)}},au=function(i){if(i.tag===13){var r=ji(i,134217728);if(r!==null){var a=Pn();_i(r,i,134217728,a)}Dd(i,134217728)}},tp=function(i){if(i.tag===13){var r=wr(i),a=ji(i,r);if(a!==null){var c=Pn();_i(a,i,r,c)}Dd(i,r)}},np=function(){return vt},ip=function(i,r){var a=vt;try{return vt=i,r()}finally{vt=a}},Ee=function(i,r,a){switch(r){case"input":if(Ke(i,a),r=a.name,a.type==="radio"&&r!=null){for(a=i;a.parentNode;)a=a.parentNode;for(a=a.querySelectorAll("input[name="+JSON.stringify(""+r)+'][type="radio"]'),r=0;r<a.length;r++){var c=a[r];if(c!==i&&c.form===i.form){var h=fl(c);if(!h)throw Error(t(90));ft(c),Ke(c,h)}}}break;case"textarea":M(i,a);break;case"select":r=a.value,r!=null&&Bt(i,!!a.multiple,r,!1)}},at=Cd,Rt=os;var LE={usingClientEntryPoint:!1,Events:[Zo,ks,fl,pe,Ge,Cd]},da={findFiberByHostInstance:Qr,bundleType:0,version:"18.3.1",rendererPackageName:"react-dom"},IE={bundleType:da.bundleType,version:da.version,rendererPackageName:da.rendererPackageName,rendererConfig:da.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:R.ReactCurrentDispatcher,findHostInstanceByFiber:function(i){return i=Ka(i),i===null?null:i.stateNode},findFiberByHostInstance:da.findFiberByHostInstance||bE,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.3.1-next-f1338f8080-20240426"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var Zl=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Zl.isDisabled&&Zl.supportsFiber)try{Ze=Zl.inject(IE),st=Zl}catch{}}return Bn.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=LE,Bn.createPortal=function(i,r){var a=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!Od(r))throw Error(t(200));return RE(i,r,null,a)},Bn.createRoot=function(i,r){if(!Od(i))throw Error(t(299));var a=!1,c="",h=yv;return r!=null&&(r.unstable_strictMode===!0&&(a=!0),r.identifierPrefix!==void 0&&(c=r.identifierPrefix),r.onRecoverableError!==void 0&&(h=r.onRecoverableError)),r=Ud(i,1,!1,null,null,a,!1,c,h),i[Vi]=r.current,$o(i.nodeType===8?i.parentNode:i),new Nd(r)},Bn.findDOMNode=function(i){if(i==null)return null;if(i.nodeType===1)return i;var r=i._reactInternals;if(r===void 0)throw typeof i.render=="function"?Error(t(188)):(i=Object.keys(i).join(","),Error(t(268,i)));return i=Ka(r),i=i===null?null:i.stateNode,i},Bn.flushSync=function(i){return os(i)},Bn.hydrate=function(i,r,a){if(!ql(r))throw Error(t(200));return Kl(null,i,r,!0,a)},Bn.hydrateRoot=function(i,r,a){if(!Od(i))throw Error(t(405));var c=a!=null&&a.hydratedSources||null,h=!1,m="",S=yv;if(a!=null&&(a.unstable_strictMode===!0&&(h=!0),a.identifierPrefix!==void 0&&(m=a.identifierPrefix),a.onRecoverableError!==void 0&&(S=a.onRecoverableError)),r=gv(r,null,i,1,a??null,h,!1,m,S),i[Vi]=r.current,$o(i),c)for(i=0;i<c.length;i++)a=c[i],h=a._getVersion,h=h(a._source),r.mutableSourceEagerHydrationData==null?r.mutableSourceEagerHydrationData=[a,h]:r.mutableSourceEagerHydrationData.push(a,h);return new $l(r)},Bn.render=function(i,r,a){if(!ql(r))throw Error(t(200));return Kl(null,i,r,!1,a)},Bn.unmountComponentAtNode=function(i){if(!ql(i))throw Error(t(40));return i._reactRootContainer?(os(function(){Kl(null,null,i,!1,function(){i._reactRootContainer=null,i[Vi]=null})}),!0):!1},Bn.unstable_batchedUpdates=Cd,Bn.unstable_renderSubtreeIntoContainer=function(i,r,a,c){if(!ql(a))throw Error(t(200));if(i==null||i._reactInternals===void 0)throw Error(t(38));return Kl(i,r,a,!1,c)},Bn.version="18.3.1-next-f1338f8080-20240426",Bn}var Rv;function HE(){if(Rv)return zd.exports;Rv=1;function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(e){console.error(e)}}return n(),zd.exports=BE(),zd.exports}var bv;function VE(){if(bv)return Ql;bv=1;var n=HE();return Ql.createRoot=n.createRoot,Ql.hydrateRoot=n.hydrateRoot,Ql}var GE=VE();const WE=n_(GE);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const XE=n=>n.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),i_=(...n)=>n.filter((e,t,s)=>!!e&&e.trim()!==""&&s.indexOf(e)===t).join(" ").trim();/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var jE={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const YE=ht.forwardRef(({color:n="currentColor",size:e=24,strokeWidth:t=2,absoluteStrokeWidth:s,className:o="",children:l,iconNode:u,...d},f)=>ht.createElement("svg",{ref:f,...jE,width:e,height:e,stroke:n,strokeWidth:s?Number(t)*24/Number(e):t,className:i_("lucide",o),...d},[...u.map(([p,v])=>ht.createElement(p,v)),...Array.isArray(l)?l:[l]]));/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yc=(n,e)=>{const t=ht.forwardRef(({className:s,...o},l)=>ht.createElement(YE,{ref:l,iconNode:e,className:i_(`lucide-${XE(n)}`,s),...o}));return t.displayName=`${n}`,t};/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $E=Yc("Download",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vd=Yc("LoaderCircle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qE=Yc("RefreshCw",[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pv=Yc("RotateCcw",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]]),KE={BASE_URL:"./",DEV:!1,MODE:"production",PROD:!0,SSR:!1};function Dr(n){return String(KE[n]??"").trim()}function Lv(n){const e=Dr(n).toLowerCase();return e==="1"||e==="true"||e==="yes"||e==="on"}function ys(n,e=""){return typeof n!="string"?e:n.trim()||e}function Gd(n,e=!1){if(typeof n=="boolean")return n;if(typeof n=="number")return n!==0;if(typeof n=="string"){const t=n.trim().toLowerCase();if(["1","true","yes","on"].includes(t))return!0;if(["0","false","no","off"].includes(t))return!1}return e}function Iv(n,e){const t=Number(n);return Number.isFinite(t)&&t>0?Math.round(t):e}function ZE(n,e){const s=(Array.isArray(n)?n:typeof n=="string"?n.split(","):[]).map(o=>String(o).trim()).filter(Boolean);return s.length?Array.from(new Set(s)):e}function r_(n){const e=n.trim().replace(/\/+$/,"");try{const t=new URL(e);if(t.protocol==="http:"&&t.hostname.toLowerCase().endsWith(".proxy.runpod.net"))return t.protocol="https:",t.port==="80"&&(t.port=""),t.toString().replace(/\/+$/,"")}catch{return e}return e}const Hn=typeof window<"u"?window.__SEMANTIC_MAP_RUNTIME_CONFIG__??{}:{},QE=Dr("VITE_EXHIBIT_RUNPOD_URL"),Uv=ys(Hn.defaultDatasetId,"london_224_8_45"),Dv=r_(ys(Hn.runpodUrl,QE)),gn={mode:Hn.mode==="demo"?"demo":Hn.mode==="screensaver"?"screensaver":"full",runpodUrl:Dv,runpodToken:ys(Hn.runpodToken,Dr("VITE_EXHIBIT_RUNPOD_TOKEN")),lockRunpodUrl:Gd(Hn.lockRunpodUrl,Lv("VITE_EXHIBIT_LOCK_RUNPOD_URL")),idleResetEnabled:Gd(Hn.idleResetEnabled,Lv("VITE_EXHIBIT_IDLE_RESET")),idleMs:Iv(Hn.idleMs,Iv(Dr("VITE_EXHIBIT_IDLE_MS"),18e4)),defaultDatasetId:Uv,defaultDatasetIds:ZE(Hn.defaultDatasetIds??Dr("VITE_DEFAULT_DATASET_IDS"),[Uv,"shanghai_224_8_45_2B"]),defaultDatasetGroupId:ys(Hn.defaultDatasetGroupId,Dr("VITE_DEFAULT_DATASET_GROUP_ID")||"london_shanghai"),defaultRemoteBackendUrl:r_(ys(Hn.defaultRemoteBackendUrl,Dv)),remoteBackendEnabled:Gd(Hn.remoteBackendEnabled,!0),staticFallbackDataBaseUrl:ys(Hn.staticFallbackDataBaseUrl,Dr("VITE_STATIC_FALLBACK_DATA_BASE_URL")||"https://ticoch1.github.io/semanticmapdemo/static-data").replace(/\/+$/,""),demoWatchdogUrl:ys(Hn.demoWatchdogUrl,Dr("VITE_DEMO_WATCHDOG_URL"))},JE=5e3,Nv="semantic-map-demo-monitor-session-id";let eS=0,tS=0,Wd=0;function nS(n){if(gn.mode!=="demo"||!gn.runpodUrl)return;const e=iS(n);rS("/api/demo/monitor/events",e),sS("/frontend/events",e)}function iS(n){return{source:"frontend",session_id:lS(),observed_at:cS(),...n,details:{...aS(),...n.details??{}}}}async function rS(n,e){await s_(`${gn.runpodUrl.replace(/\/+$/,"")}${n}`,oS(),e)}async function sS(n,e,t={}){gn.demoWatchdogUrl&&await s_(`${gn.demoWatchdogUrl.replace(/\/+$/,"")}${n}`,{"Content-Type":"text/plain;charset=UTF-8"},e,t)}async function s_(n,e,t,s={}){if(Wd>4)return;Wd+=1;const o=new AbortController,l=s.keepaliveOnly?0:window.setTimeout(()=>o.abort(),JE);try{const u=JSON.stringify(t);await fetch(n,{method:"POST",headers:e,body:u,cache:"no-store",keepalive:u.length<6e4,signal:s.keepaliveOnly?void 0:o.signal})}catch{}finally{l&&window.clearTimeout(l),Wd-=1}}function oS(){const n={"Content-Type":"application/json"};return gn.runpodToken&&(n.Authorization=`Bearer ${gn.runpodToken}`),n}function aS(){const n=performance.memory;return{href:window.location.href,visibility_state:document.visibilityState,online:navigator.onLine,user_agent:navigator.userAgent,viewport:`${window.innerWidth}x${window.innerHeight}`,main_thread_last_lag_ms:eS,main_thread_max_lag_ms:tS,used_js_heap_mb:n!=null&&n.usedJSHeapSize?Math.round(n.usedJSHeapSize/1024/1024):null,js_heap_limit_mb:n!=null&&n.jsHeapSizeLimit?Math.round(n.jsHeapSizeLimit/1024/1024):null}}function lS(){const n=window.sessionStorage.getItem(Nv);if(n)return n;const e=`frontend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;return window.sessionStorage.setItem(Nv,e),e}function cS(){return new Date().toISOString().replace(/\.\d{3}Z$/,"Z")}const Ov=gn.runpodUrl,Mc={lockedRunpodUrl:Ov,lockedRunpodToken:gn.runpodToken,lockRunpodUrl:!!Ov&&gn.lockRunpodUrl};function us(n){const e=Number(n);return Number.isFinite(e)?e:null}function uS(n){if(!n||typeof n!="object")return null;const e=n,t=String(e.id??"").trim(),s=String(e.name??t).trim(),o=String(e.datasetId??e.dataset_id??"").trim(),l=e.center,u=e.bounds;if(!t||!s||!o||!Array.isArray(l)||l.length!==2||!u||typeof u!="object")return null;const d=us(l[0]),f=us(l[1]),p=u,v=us(p.west),g=us(p.east),y=us(p.south),x=us(p.north),w=us(e.initialZoom??e.initial_zoom)??10.45;return[d,f,v,g,y,x].some(A=>A===null)?null:{id:t,name:s,datasetId:o,center:[d,f],initialZoom:w,bounds:{west:v,east:g,south:y,north:x},liveDemo:!!(e.liveDemo??e.live_demo)}}function Th(n){if(!Array.isArray(n))return[];const e=new Set;return n.flatMap(t=>{const s=uS(t);return!s||e.has(s.id)?[]:(e.add(s.id),[s])})}const dS="new_york_224_8_45",Oc="new_york_manhattan_224_8_45",Fc="new_york_outside_manhattan_224_8_45",hS=[[[[-74.0436327,40.688777],[-74.043465,40.6896421],[-74.0438883,40.6901864],[-74.0460174,40.6911182],[-74.0472041,40.6909398],[-74.0471981,40.6904236],[-74.0462749,40.6893396],[-74.0447779,40.6885981],[-74.0436327,40.688777]]],[[[-74.0407303,40.7001925],[-74.0397962,40.6989767],[-74.0402387,40.6988362],[-74.0399309,40.6985897],[-74.0383723,40.6986686],[-74.0389358,40.6996549],[-74.0407303,40.7001925]]],[[[-74.035443,40.685125],[-74.019577,40.679654],[-74.0082907,40.6864417],[-74.0074623,40.6886621],[-74.0002365,40.6994949],[-73.9959947,40.7037725],[-73.9935158,40.7046716],[-73.97912,40.706065],[-73.977116,40.706533],[-73.97226,40.709102],[-73.970159,40.706916],[-73.970129,40.705383],[-73.969312,40.705475],[-73.9692715,40.7070286],[-73.9704007,40.7086318],[-73.9700064,40.7105491],[-73.969061,40.711744],[-73.9689119,40.7131879],[-73.9673055,40.7170152],[-73.9679043,40.7173184],[-73.966666,40.7194968],[-73.9649308,40.7214952],[-73.9633389,40.7218977],[-73.961722,40.72487],[-73.9621293,40.7251589],[-73.961758,40.725784],[-73.9619238,40.7275427],[-73.9613803,40.729069],[-73.961465,40.730764],[-73.962406,40.732926],[-73.962112,40.734528],[-73.962978,40.738393],[-73.9621661,40.7413534],[-73.9607468,40.7441711],[-73.957853,40.7483993],[-73.9572708,40.7491674],[-73.9547578,40.7507797],[-73.952027,40.75383],[-73.941379,40.767089],[-73.935226,40.770609],[-73.935045,40.7711861],[-73.9375174,40.7725227],[-73.9378787,40.773831],[-73.937838,40.774832],[-73.936347,40.777138],[-73.934558,40.77825],[-73.933803,40.778272],[-73.931708,40.777998],[-73.930038,40.776398],[-73.928695,40.776757],[-73.922345,40.780811],[-73.9126153,40.7894243],[-73.9098375,40.7909643],[-73.912528,40.796118],[-73.919896,40.799392],[-73.921413,40.801369],[-73.922663,40.802119],[-73.927663,40.802399],[-73.930526,40.806614],[-73.932364,40.808519],[-73.932857,40.810327],[-73.932556,40.810886],[-73.932828,40.811948],[-73.932532,40.816053],[-73.932828,40.823366],[-73.933796,40.832958],[-73.93287,40.836453],[-73.930104,40.841494],[-73.929128,40.844264],[-73.927091,40.847353],[-73.920076,40.856589],[-73.913396,40.863342],[-73.910336,40.867669],[-73.909337,40.870314],[-73.909332,40.87254],[-73.908902,40.873034],[-73.908412,40.872698],[-73.907451,40.873398],[-73.906769,40.87598],[-73.908183,40.877538],[-73.908941,40.877642],[-73.909616,40.878754],[-73.911584,40.87914],[-73.912693,40.877768],[-73.914773,40.876719],[-73.915336,40.875808],[-73.917767,40.875669],[-73.919642,40.876327],[-73.921873,40.878372],[-73.924928,40.878899],[-73.933907,40.882012],[-73.9502981,40.8586258],[-73.9547924,40.8512835],[-73.9561557,40.8481811],[-73.9587238,40.8376892],[-73.963577,40.826642],[-74.014028,40.757551],[-74.023637,40.718068],[-74.02639,40.700102],[-74.035443,40.685125]]]];function fS(n,e,t){return n===Oc||n===Fc||n!==dS||!Number.isFinite(e)||!Number.isFinite(t)||e<-74.45||e>-73.45||t<40.45||t>41.05?n:mS(e,t,hS)?Oc:Fc}function pS(n){return n===Oc?Fc:n===Fc?Oc:null}function mS(n,e,t){return t.some(s=>{const o=s[0];return!o||!Fv(n,e,o)?!1:!s.slice(1).some(l=>Fv(n,e,l))})}function Fv(n,e,t){let s=!1;for(let o=0,l=t.length-1;o<t.length;l=o,o+=1){const u=t[o],d=t[l];if(!u||!d)continue;const[f,p]=u,[v,g]=d;if(!(p>e!=g>e))continue;const x=(v-f)*(e-p)/(g-p)+f;n<x&&(s=!s)}return s}const vS="shengtao.steven.xia@gmail.com",gS=`Dynamic search is unavailable due to static deployment. For more details or fully functional webapp, contact the author at ${vS}`,o_="semantic-map-runpod-backend-v1",_S="semantic-map-runpod-capabilities-v1",yS=gn.defaultRemoteBackendUrl,wc=gn.defaultDatasetId,Tc=Ss(gn.defaultDatasetIds),Ac=gn.defaultDatasetGroupId,kv=-1,zv=3,xS=[{datasetId:"london_224_8_45",cityId:"london",panoId:"126048",file:"london-126048.jpg"},{datasetId:"shanghai_224_8_45_2B",cityId:"shanghai",panoId:"103110",file:"shanghai-103110.jpg"}],ES=[{id:"default_heat",name:"Default heat",stops:[{value:0,color:"#2c7bb6"},{value:.5,color:"#ffffbf"},{value:1,color:"#d7191c"}],opacity:.75,score_min:0,score_max:1,updated_at:"2026-04-27T00:00:00Z",is_default:!0},{id:"viridis",name:"Viridis",stops:[{value:0,color:"#440154"},{value:.25,color:"#3b528b"},{value:.5,color:"#21918c"},{value:.75,color:"#5ec962"},{value:1,color:"#fde725"}],opacity:.75,score_min:0,score_max:1,updated_at:"2026-04-27T00:00:00Z",is_default:!0},{id:"turbo",name:"Turbo",stops:[{value:0,color:"#30123b"},{value:.125,color:"#4663d7"},{value:.25,color:"#37a9e6"},{value:.375,color:"#1ae4b6"},{value:.5,color:"#71fe5f"},{value:.625,color:"#c8ef34"},{value:.75,color:"#faba39"},{value:.875,color:"#ef5a11"},{value:1,color:"#a71401"}],opacity:.75,score_min:0,score_max:1,updated_at:"2026-04-27T00:00:00Z",is_default:!0},{id:"magma",name:"Magma",stops:[{value:0,color:"#000004"},{value:.2,color:"#3b0f70"},{value:.4,color:"#8c2981"},{value:.6,color:"#de4968"},{value:.8,color:"#fe9f6d"},{value:1,color:"#fcfdbf"}],opacity:.75,score_min:0,score_max:1,updated_at:"2026-04-27T00:00:00Z",is_default:!0},{id:"spectral",name:"Spectral",stops:[{value:0,color:"#9e0142"},{value:.125,color:"#d53e4f"},{value:.25,color:"#f46d43"},{value:.375,color:"#fdae61"},{value:.5,color:"#ffffbf"},{value:.625,color:"#abdda4"},{value:.75,color:"#66c2a5"},{value:.875,color:"#3288bd"},{value:1,color:"#5e4fa2"}],opacity:.75,score_min:0,score_max:1,updated_at:"2026-04-27T00:00:00Z",is_default:!0},{id:"red",name:"Red",stops:[{value:0,color:"#000000"},{value:1,color:"#ff0000"}],opacity:.75,score_min:0,score_max:1,updated_at:"2026-04-27T00:00:00Z",is_default:!0},{id:"green",name:"Green",stops:[{value:0,color:"#000000"},{value:1,color:"#00ff00"}],opacity:.75,score_min:0,score_max:1,updated_at:"2026-04-27T00:00:00Z",is_default:!0},{id:"vegetation",name:"Vegetation",stops:[{value:0,color:"#582e1d"},{value:.5,color:"#000000"},{value:1,color:"#50ff00"}],opacity:.75,score_min:-2.5,score_max:1.5,updated_at:"2026-04-29T00:00:00Z",is_default:!0},{id:"blue",name:"Blue",stops:[{value:0,color:"#000000"},{value:1,color:"#0000ff"}],opacity:.75,score_min:0,score_max:1,updated_at:"2026-04-27T00:00:00Z",is_default:!0},{id:"white",name:"White",stops:[{value:0,color:"#000000"},{value:1,color:"#ffffff"}],opacity:.75,score_min:0,score_max:1,updated_at:"2026-04-27T00:00:00Z",is_default:!0},{id:"violet_gold",name:"Violet gold",stops:[{value:0,color:"#2d3142"},{value:.45,color:"#8d99ae"},{value:1,color:"#f6c85f"}],opacity:.7,score_min:0,score_max:1,updated_at:"2026-04-27T00:00:00Z",is_default:!1}];new Set(ES.filter(n=>n.is_default).map(n=>n.id));const SS=[{prompt:"the scene contains brick facade",name:"the scene contains brick facade",staticDataKey:"text-the-scene-contains-brick-facade",gradientId:"magma",scoreMin:kv,scoreMax:zv},{prompt:"the scene contains abundant vegetation",name:"the scene contains abundant vegetation",staticDataKey:"text-the-scene-contains-abundant-vegetation",gradientId:"vegetation",scoreMin:-2.5,scoreMax:1.5},{prompt:"the scene shows people interacting",name:"the scene shows people interacting",staticDataKey:"text-the-scene-contains-social-interaction",gradientId:"turbo",scoreMin:kv,scoreMax:zv}];new Set(SS.map(n=>n.prompt));function a_(n){const e=window.localStorage.getItem(n);if(!e)return null;try{return JSON.parse(e)}catch{return null}}function MS(n,e){window.localStorage.setItem(n,JSON.stringify(e))}function Gr(n){const e=n.trim().replace(/\/+$/,"");if(/^[a-z0-9-]+-\d+\.proxy\.runpod\.net$/i.test(e))return`https://${e}`;try{const t=new URL(e);if(t.protocol==="http:"&&t.hostname.toLowerCase().endsWith(".proxy.runpod.net"))return t.protocol="https:",t.port==="80"&&(t.port=""),t.toString().replace(/\/+$/,"")}catch{return e}return e}function l_(n){const e=Gr(String(n??""));if(!e)return!1;try{const t=new URL(e);return t.protocol==="http:"||t.protocol==="https:"}catch{return!1}}function Xd(n){return typeof window>"u"?"":(new URLSearchParams(window.location.search).get(n)??"").trim()}function c_(){const n=Xd("backend")||Xd("runpod")||Xd("runpodUrl");return n?Gr(n):""}function wS(n){if(typeof window>"u"||!c_())return;const e=new URL(window.location.href);e.searchParams.delete("runpod"),e.searchParams.delete("runpodUrl"),n.enabled&&n.baseUrl.trim()?e.searchParams.set("backend",Gr(n.baseUrl)):e.searchParams.delete("backend"),window.history.replaceState(window.history.state,"",e)}function Ss(n){const t=(Array.isArray(n)?n:typeof n=="string"?n.split(","):[]).map(s=>String(s).trim()).filter(Boolean);return Array.from(new Set(t))}function TS(n){const e=a_(_S);return(e==null?void 0:e[Gr(n)])??null}function jd(n){var t,s;const e=TS(n.baseUrl);return!((t=e==null?void 0:e.datasetIds)!=null&&t.length)||!((s=e.cities)!=null&&s.length)?n:{...n,datasetId:e.datasetId||e.datasetIds[0]||n.datasetId,datasetIds:e.datasetIds,datasetGroupId:e.datasetGroupId||n.datasetGroupId,cities:e.cities}}function Bv(n){var t;const e={};return(t=n.token)!=null&&t.trim()&&(e.Authorization=`Bearer ${n.token.trim()}`),Object.keys(e).length?e:void 0}function Jl(n,e,t={}){nS({severity:"warning",code:n,message:e,details:t})}function Hv(n,e){return/^https?:\/\//i.test(e)?e:`${Gr(n.baseUrl)}${e.startsWith("/")?e:`/${e}`}`}function AS(){return gn.staticFallbackDataBaseUrl.replace(/\/+$/,"")}function CS(n,e){const t=String(n||"").trim(),s=String(e||"").trim(),o=xS.find(l=>l.panoId!==t?!1:!s||l.datasetId===s||l.cityId===s);return o?`${AS()}/panos/${o.file}`:null}function kc(){const n=a_(o_),e=c_();if(e)return jd({baseUrl:e,token:typeof(n==null?void 0:n.token)=="string"?n.token:gn.runpodToken,datasetId:String((n==null?void 0:n.datasetId)||wc),datasetIds:Ss(n==null?void 0:n.datasetIds).length?Ss(n==null?void 0:n.datasetIds):Tc,datasetGroupId:typeof(n==null?void 0:n.datasetGroupId)=="string"?n.datasetGroupId:Ac,cities:Th(n==null?void 0:n.cities),enabled:!0});if(Mc.lockRunpodUrl)return jd({baseUrl:Gr(Mc.lockedRunpodUrl),token:Mc.lockedRunpodToken,datasetId:wc,datasetIds:Tc,datasetGroupId:Ac,cities:[],enabled:!0});const t=Gr(String((n==null?void 0:n.baseUrl)??yS)),s=String((n==null?void 0:n.datasetId)||wc),o=Ss(n==null?void 0:n.datasetIds).length?Ss(n==null?void 0:n.datasetIds):Tc;return jd({baseUrl:t,token:typeof(n==null?void 0:n.token)=="string"?n.token:"",datasetId:s,datasetIds:o,datasetGroupId:typeof(n==null?void 0:n.datasetGroupId)=="string"?n.datasetGroupId:Ac,cities:Th(n==null?void 0:n.cities),enabled:(n==null?void 0:n.enabled)??gn.remoteBackendEnabled})}function RS(n){var t;if(Mc.lockRunpodUrl)return kc();const e={baseUrl:Gr(n.baseUrl),token:n.token??"",datasetId:n.datasetId.trim()||wc,datasetIds:Ss(n.datasetIds).length?Ss(n.datasetIds):Tc,datasetGroupId:((t=n.datasetGroupId)==null?void 0:t.trim())||Ac,cities:Th(n.cities),enabled:n.enabled};return MS(o_,e),wS(e),kc()}async function Yd(){return kc()}async function u_(n){return RS(n)}async function bS(n,e,t){const s=kc();if(!s.enabled||!l_(s.baseUrl)){const x=CS(n,e);if(x)return{pano_id:n,status:"ready",image_url:x,object_url:x,member_name:null,tar_id:null,message:"Loaded from packaged static fallback pano dataset."};const w=gS;throw Jl("static_pano_unavailable",w,{pano_id:n,dataset_id:e??null,backend_enabled:s.enabled,backend_base_url:s.baseUrl||null}),new Error(w)}const l=typeof(t==null?void 0:t.lon)=="number"&&Number.isFinite(t.lon)&&typeof(t==null?void 0:t.lat)=="number"&&Number.isFinite(t.lat)?pS(e):null,u=l!==null,d=[e??null,...l?[l]:[]];let f=null,p=e??null,v=null;for(let x=0;x<d.length;x+=1){const w=d[x],A=new URLSearchParams;if(u&&t&&(A.set("lon",String(t.lon)),A.set("lat",String(t.lat)),t.date!==null&&t.date!==void 0&&String(t.date).trim()!=="")){const R=Number(t.date);Number.isInteger(R)&&A.set("date",String(R))}const _=`${w?`/api/datasets/${encodeURIComponent(w)}/panos/${encodeURIComponent(n)}`:`/api/panos/${encodeURIComponent(n)}`}${A.toString()?`?${A.toString()}`:""}`;let N=null,I=!1;for(let R=0;R<30;R+=1){const k=await fetch(Hv(s,_),{headers:Bv(s)});if(!k.ok){v=k.status;const B=x+1<d.length;if(k.status===409&&B){I=!0;break}throw Jl("remote_pano_metadata_failed",`Pano request failed (${k.status})`,{status:k.status,pano_id:n,dataset_id:w}),new Error(`Pano request failed (${k.status})`)}if(N=await k.json(),N.status!=="unavailable")break;await PS(2e3)}if(!I&&!((N==null?void 0:N.status)==="missing"&&x+1<d.length)){f=N,p=w;break}}if(!f||f.status!=="ready"||!f.image_url){const x=(f==null?void 0:f.message)||(v===409?"Pano ID did not match the selected map point in either New York pano dataset.":"Pano image is unavailable");throw Jl("remote_pano_unavailable",x,{pano_id:n,dataset_id:p,status:(f==null?void 0:f.status)??null}),new Error(x)}const g=await fetch(Hv(s,f.image_url),{headers:Bv(s),cache:"force-cache"});if(!g.ok)throw Jl("remote_pano_download_failed",`Pano image download failed (${g.status})`,{status:g.status,pano_id:n,dataset_id:p,image_url:f.image_url}),new Error(`Pano image download failed (${g.status})`);const y=await g.blob();return{...f,pano_dataset_id:f.pano_dataset_id??p,object_url:URL.createObjectURL(y)}}function PS(n){return new Promise(e=>window.setTimeout(e,n))}/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Af="179",LS=0,Vv=1,IS=2,d_=1,US=2,nr=3,Wr=0,Vn=1,ir=2,Fr=0,xo=1,Gv=2,Wv=3,Xv=4,DS=5,xs=100,NS=101,OS=102,FS=103,kS=104,zS=200,BS=201,HS=202,VS=203,Ah=204,Ch=205,GS=206,WS=207,XS=208,jS=209,YS=210,$S=211,qS=212,KS=213,ZS=214,Rh=0,bh=1,Ph=2,wo=3,Lh=4,Ih=5,Uh=6,Dh=7,h_=0,QS=1,JS=2,kr=0,f_=1,eM=2,tM=3,nM=4,iM=5,rM=6,sM=7,p_=300,To=301,Ao=302,Nh=303,Oh=304,$c=306,Fh=1e3,Ms=1001,kh=1002,Ai=1003,oM=1004,ec=1005,wi=1006,$d=1007,Or=1008,ar=1009,m_=1010,v_=1011,Ia=1012,Cf=1013,ws=1014,rr=1015,za=1016,Rf=1017,bf=1018,Ua=1020,g_=35902,__=1021,y_=1022,Ti=1023,Da=1026,Na=1027,x_=1028,Pf=1029,E_=1030,Lf=1031,If=1033,Cc=33776,Rc=33777,bc=33778,Pc=33779,zh=35840,Bh=35841,Hh=35842,Vh=35843,Gh=36196,Wh=37492,Xh=37496,jh=37808,Yh=37809,$h=37810,qh=37811,Kh=37812,Zh=37813,Qh=37814,Jh=37815,ef=37816,tf=37817,nf=37818,rf=37819,sf=37820,of=37821,Lc=36492,af=36494,lf=36495,S_=36283,cf=36284,uf=36285,df=36286,aM=3200,lM=3201,cM=0,uM=1,Nr="",ci="srgb",Ts="srgb-linear",zc="linear",Ut="srgb",Js=7680,jv=519,dM=512,hM=513,fM=514,M_=515,pM=516,mM=517,vM=518,gM=519,Yv=35044,$v="300 es",Ni=2e3,Bc=2001;class bo{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const s=this._listeners;s[e]===void 0&&(s[e]=[]),s[e].indexOf(t)===-1&&s[e].push(t)}hasEventListener(e,t){const s=this._listeners;return s===void 0?!1:s[e]!==void 0&&s[e].indexOf(t)!==-1}removeEventListener(e,t){const s=this._listeners;if(s===void 0)return;const o=s[e];if(o!==void 0){const l=o.indexOf(t);l!==-1&&o.splice(l,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const s=t[e.type];if(s!==void 0){e.target=this;const o=s.slice(0);for(let l=0,u=o.length;l<u;l++)o[l].call(this,e);e.target=null}}}const Tn=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let qv=1234567;const xa=Math.PI/180,Oa=180/Math.PI;function Po(){const n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,s=Math.random()*4294967295|0;return(Tn[n&255]+Tn[n>>8&255]+Tn[n>>16&255]+Tn[n>>24&255]+"-"+Tn[e&255]+Tn[e>>8&255]+"-"+Tn[e>>16&15|64]+Tn[e>>24&255]+"-"+Tn[t&63|128]+Tn[t>>8&255]+"-"+Tn[t>>16&255]+Tn[t>>24&255]+Tn[s&255]+Tn[s>>8&255]+Tn[s>>16&255]+Tn[s>>24&255]).toLowerCase()}function _t(n,e,t){return Math.max(e,Math.min(t,n))}function Uf(n,e){return(n%e+e)%e}function _M(n,e,t,s,o){return s+(n-e)*(o-s)/(t-e)}function yM(n,e,t){return n!==e?(t-n)/(e-n):0}function Ea(n,e,t){return(1-t)*n+t*e}function xM(n,e,t,s){return Ea(n,e,1-Math.exp(-t*s))}function EM(n,e=1){return e-Math.abs(Uf(n,e*2)-e)}function SM(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function MM(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function wM(n,e){return n+Math.floor(Math.random()*(e-n+1))}function TM(n,e){return n+Math.random()*(e-n)}function AM(n){return n*(.5-Math.random())}function CM(n){n!==void 0&&(qv=n);let e=qv+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function RM(n){return n*xa}function bM(n){return n*Oa}function PM(n){return(n&n-1)===0&&n!==0}function LM(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function IM(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function UM(n,e,t,s,o){const l=Math.cos,u=Math.sin,d=l(t/2),f=u(t/2),p=l((e+s)/2),v=u((e+s)/2),g=l((e-s)/2),y=u((e-s)/2),x=l((s-e)/2),w=u((s-e)/2);switch(o){case"XYX":n.set(d*v,f*g,f*y,d*p);break;case"YZY":n.set(f*y,d*v,f*g,d*p);break;case"ZXZ":n.set(f*g,f*y,d*v,d*p);break;case"XZX":n.set(d*v,f*w,f*x,d*p);break;case"YXY":n.set(f*x,d*v,f*w,d*p);break;case"ZYZ":n.set(f*w,f*x,d*v,d*p);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+o)}}function mo(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("Invalid component type.")}}function Ln(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("Invalid component type.")}}const Pt={DEG2RAD:xa,RAD2DEG:Oa,generateUUID:Po,clamp:_t,euclideanModulo:Uf,mapLinear:_M,inverseLerp:yM,lerp:Ea,damp:xM,pingpong:EM,smoothstep:SM,smootherstep:MM,randInt:wM,randFloat:TM,randFloatSpread:AM,seededRandom:CM,degToRad:RM,radToDeg:bM,isPowerOfTwo:PM,ceilPowerOfTwo:LM,floorPowerOfTwo:IM,setQuaternionFromProperEuler:UM,normalize:Ln,denormalize:mo};class Lt{constructor(e=0,t=0){Lt.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,s=this.y,o=e.elements;return this.x=o[0]*t+o[3]*s+o[6],this.y=o[1]*t+o[4]*s+o[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=_t(this.x,e.x,t.x),this.y=_t(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=_t(this.x,e,t),this.y=_t(this.y,e,t),this}clampLength(e,t){const s=this.length();return this.divideScalar(s||1).multiplyScalar(_t(s,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const s=this.dot(e)/t;return Math.acos(_t(s,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,s=this.y-e.y;return t*t+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,s){return this.x=e.x+(t.x-e.x)*s,this.y=e.y+(t.y-e.y)*s,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const s=Math.cos(t),o=Math.sin(t),l=this.x-e.x,u=this.y-e.y;return this.x=l*s-u*o+e.x,this.y=l*o+u*s+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Lo{constructor(e=0,t=0,s=0,o=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=s,this._w=o}static slerpFlat(e,t,s,o,l,u,d){let f=s[o+0],p=s[o+1],v=s[o+2],g=s[o+3];const y=l[u+0],x=l[u+1],w=l[u+2],A=l[u+3];if(d===0){e[t+0]=f,e[t+1]=p,e[t+2]=v,e[t+3]=g;return}if(d===1){e[t+0]=y,e[t+1]=x,e[t+2]=w,e[t+3]=A;return}if(g!==A||f!==y||p!==x||v!==w){let E=1-d;const _=f*y+p*x+v*w+g*A,N=_>=0?1:-1,I=1-_*_;if(I>Number.EPSILON){const k=Math.sqrt(I),B=Math.atan2(k,_*N);E=Math.sin(E*B)/k,d=Math.sin(d*B)/k}const R=d*N;if(f=f*E+y*R,p=p*E+x*R,v=v*E+w*R,g=g*E+A*R,E===1-d){const k=1/Math.sqrt(f*f+p*p+v*v+g*g);f*=k,p*=k,v*=k,g*=k}}e[t]=f,e[t+1]=p,e[t+2]=v,e[t+3]=g}static multiplyQuaternionsFlat(e,t,s,o,l,u){const d=s[o],f=s[o+1],p=s[o+2],v=s[o+3],g=l[u],y=l[u+1],x=l[u+2],w=l[u+3];return e[t]=d*w+v*g+f*x-p*y,e[t+1]=f*w+v*y+p*g-d*x,e[t+2]=p*w+v*x+d*y-f*g,e[t+3]=v*w-d*g-f*y-p*x,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,s,o){return this._x=e,this._y=t,this._z=s,this._w=o,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const s=e._x,o=e._y,l=e._z,u=e._order,d=Math.cos,f=Math.sin,p=d(s/2),v=d(o/2),g=d(l/2),y=f(s/2),x=f(o/2),w=f(l/2);switch(u){case"XYZ":this._x=y*v*g+p*x*w,this._y=p*x*g-y*v*w,this._z=p*v*w+y*x*g,this._w=p*v*g-y*x*w;break;case"YXZ":this._x=y*v*g+p*x*w,this._y=p*x*g-y*v*w,this._z=p*v*w-y*x*g,this._w=p*v*g+y*x*w;break;case"ZXY":this._x=y*v*g-p*x*w,this._y=p*x*g+y*v*w,this._z=p*v*w+y*x*g,this._w=p*v*g-y*x*w;break;case"ZYX":this._x=y*v*g-p*x*w,this._y=p*x*g+y*v*w,this._z=p*v*w-y*x*g,this._w=p*v*g+y*x*w;break;case"YZX":this._x=y*v*g+p*x*w,this._y=p*x*g+y*v*w,this._z=p*v*w-y*x*g,this._w=p*v*g-y*x*w;break;case"XZY":this._x=y*v*g-p*x*w,this._y=p*x*g-y*v*w,this._z=p*v*w+y*x*g,this._w=p*v*g+y*x*w;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+u)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const s=t/2,o=Math.sin(s);return this._x=e.x*o,this._y=e.y*o,this._z=e.z*o,this._w=Math.cos(s),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,s=t[0],o=t[4],l=t[8],u=t[1],d=t[5],f=t[9],p=t[2],v=t[6],g=t[10],y=s+d+g;if(y>0){const x=.5/Math.sqrt(y+1);this._w=.25/x,this._x=(v-f)*x,this._y=(l-p)*x,this._z=(u-o)*x}else if(s>d&&s>g){const x=2*Math.sqrt(1+s-d-g);this._w=(v-f)/x,this._x=.25*x,this._y=(o+u)/x,this._z=(l+p)/x}else if(d>g){const x=2*Math.sqrt(1+d-s-g);this._w=(l-p)/x,this._x=(o+u)/x,this._y=.25*x,this._z=(f+v)/x}else{const x=2*Math.sqrt(1+g-s-d);this._w=(u-o)/x,this._x=(l+p)/x,this._y=(f+v)/x,this._z=.25*x}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let s=e.dot(t)+1;return s<1e-8?(s=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=s):(this._x=0,this._y=-e.z,this._z=e.y,this._w=s)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=s),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(_t(this.dot(e),-1,1)))}rotateTowards(e,t){const s=this.angleTo(e);if(s===0)return this;const o=Math.min(1,t/s);return this.slerp(e,o),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const s=e._x,o=e._y,l=e._z,u=e._w,d=t._x,f=t._y,p=t._z,v=t._w;return this._x=s*v+u*d+o*p-l*f,this._y=o*v+u*f+l*d-s*p,this._z=l*v+u*p+s*f-o*d,this._w=u*v-s*d-o*f-l*p,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const s=this._x,o=this._y,l=this._z,u=this._w;let d=u*e._w+s*e._x+o*e._y+l*e._z;if(d<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,d=-d):this.copy(e),d>=1)return this._w=u,this._x=s,this._y=o,this._z=l,this;const f=1-d*d;if(f<=Number.EPSILON){const x=1-t;return this._w=x*u+t*this._w,this._x=x*s+t*this._x,this._y=x*o+t*this._y,this._z=x*l+t*this._z,this.normalize(),this}const p=Math.sqrt(f),v=Math.atan2(p,d),g=Math.sin((1-t)*v)/p,y=Math.sin(t*v)/p;return this._w=u*g+this._w*y,this._x=s*g+this._x*y,this._y=o*g+this._y*y,this._z=l*g+this._z*y,this._onChangeCallback(),this}slerpQuaternions(e,t,s){return this.copy(e).slerp(t,s)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),s=Math.random(),o=Math.sqrt(1-s),l=Math.sqrt(s);return this.set(o*Math.sin(e),o*Math.cos(e),l*Math.sin(t),l*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class Z{constructor(e=0,t=0,s=0){Z.prototype.isVector3=!0,this.x=e,this.y=t,this.z=s}set(e,t,s){return s===void 0&&(s=this.z),this.x=e,this.y=t,this.z=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Kv.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Kv.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,s=this.y,o=this.z,l=e.elements;return this.x=l[0]*t+l[3]*s+l[6]*o,this.y=l[1]*t+l[4]*s+l[7]*o,this.z=l[2]*t+l[5]*s+l[8]*o,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,s=this.y,o=this.z,l=e.elements,u=1/(l[3]*t+l[7]*s+l[11]*o+l[15]);return this.x=(l[0]*t+l[4]*s+l[8]*o+l[12])*u,this.y=(l[1]*t+l[5]*s+l[9]*o+l[13])*u,this.z=(l[2]*t+l[6]*s+l[10]*o+l[14])*u,this}applyQuaternion(e){const t=this.x,s=this.y,o=this.z,l=e.x,u=e.y,d=e.z,f=e.w,p=2*(u*o-d*s),v=2*(d*t-l*o),g=2*(l*s-u*t);return this.x=t+f*p+u*g-d*v,this.y=s+f*v+d*p-l*g,this.z=o+f*g+l*v-u*p,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,s=this.y,o=this.z,l=e.elements;return this.x=l[0]*t+l[4]*s+l[8]*o,this.y=l[1]*t+l[5]*s+l[9]*o,this.z=l[2]*t+l[6]*s+l[10]*o,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=_t(this.x,e.x,t.x),this.y=_t(this.y,e.y,t.y),this.z=_t(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=_t(this.x,e,t),this.y=_t(this.y,e,t),this.z=_t(this.z,e,t),this}clampLength(e,t){const s=this.length();return this.divideScalar(s||1).multiplyScalar(_t(s,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,s){return this.x=e.x+(t.x-e.x)*s,this.y=e.y+(t.y-e.y)*s,this.z=e.z+(t.z-e.z)*s,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const s=e.x,o=e.y,l=e.z,u=t.x,d=t.y,f=t.z;return this.x=o*f-l*d,this.y=l*u-s*f,this.z=s*d-o*u,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const s=e.dot(this)/t;return this.copy(e).multiplyScalar(s)}projectOnPlane(e){return qd.copy(this).projectOnVector(e),this.sub(qd)}reflect(e){return this.sub(qd.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const s=this.dot(e)/t;return Math.acos(_t(s,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,s=this.y-e.y,o=this.z-e.z;return t*t+s*s+o*o}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,s){const o=Math.sin(t)*e;return this.x=o*Math.sin(s),this.y=Math.cos(t)*e,this.z=o*Math.cos(s),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,s){return this.x=e*Math.sin(t),this.y=s,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),s=this.setFromMatrixColumn(e,1).length(),o=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=s,this.z=o,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,s=Math.sqrt(1-t*t);return this.x=s*Math.cos(e),this.y=t,this.z=s*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const qd=new Z,Kv=new Lo;class ut{constructor(e,t,s,o,l,u,d,f,p){ut.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,s,o,l,u,d,f,p)}set(e,t,s,o,l,u,d,f,p){const v=this.elements;return v[0]=e,v[1]=o,v[2]=d,v[3]=t,v[4]=l,v[5]=f,v[6]=s,v[7]=u,v[8]=p,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,s=e.elements;return t[0]=s[0],t[1]=s[1],t[2]=s[2],t[3]=s[3],t[4]=s[4],t[5]=s[5],t[6]=s[6],t[7]=s[7],t[8]=s[8],this}extractBasis(e,t,s){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),s.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const s=e.elements,o=t.elements,l=this.elements,u=s[0],d=s[3],f=s[6],p=s[1],v=s[4],g=s[7],y=s[2],x=s[5],w=s[8],A=o[0],E=o[3],_=o[6],N=o[1],I=o[4],R=o[7],k=o[2],B=o[5],H=o[8];return l[0]=u*A+d*N+f*k,l[3]=u*E+d*I+f*B,l[6]=u*_+d*R+f*H,l[1]=p*A+v*N+g*k,l[4]=p*E+v*I+g*B,l[7]=p*_+v*R+g*H,l[2]=y*A+x*N+w*k,l[5]=y*E+x*I+w*B,l[8]=y*_+x*R+w*H,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],s=e[1],o=e[2],l=e[3],u=e[4],d=e[5],f=e[6],p=e[7],v=e[8];return t*u*v-t*d*p-s*l*v+s*d*f+o*l*p-o*u*f}invert(){const e=this.elements,t=e[0],s=e[1],o=e[2],l=e[3],u=e[4],d=e[5],f=e[6],p=e[7],v=e[8],g=v*u-d*p,y=d*f-v*l,x=p*l-u*f,w=t*g+s*y+o*x;if(w===0)return this.set(0,0,0,0,0,0,0,0,0);const A=1/w;return e[0]=g*A,e[1]=(o*p-v*s)*A,e[2]=(d*s-o*u)*A,e[3]=y*A,e[4]=(v*t-o*f)*A,e[5]=(o*l-d*t)*A,e[6]=x*A,e[7]=(s*f-p*t)*A,e[8]=(u*t-s*l)*A,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,s,o,l,u,d){const f=Math.cos(l),p=Math.sin(l);return this.set(s*f,s*p,-s*(f*u+p*d)+u+e,-o*p,o*f,-o*(-p*u+f*d)+d+t,0,0,1),this}scale(e,t){return this.premultiply(Kd.makeScale(e,t)),this}rotate(e){return this.premultiply(Kd.makeRotation(-e)),this}translate(e,t){return this.premultiply(Kd.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),s=Math.sin(e);return this.set(t,-s,0,s,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,s=e.elements;for(let o=0;o<9;o++)if(t[o]!==s[o])return!1;return!0}fromArray(e,t=0){for(let s=0;s<9;s++)this.elements[s]=e[s+t];return this}toArray(e=[],t=0){const s=this.elements;return e[t]=s[0],e[t+1]=s[1],e[t+2]=s[2],e[t+3]=s[3],e[t+4]=s[4],e[t+5]=s[5],e[t+6]=s[6],e[t+7]=s[7],e[t+8]=s[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const Kd=new ut;function w_(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Fa(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function DM(){const n=Fa("canvas");return n.style.display="block",n}const Zv={};function Eo(n){n in Zv||(Zv[n]=!0,console.warn(n))}function NM(n,e,t){return new Promise(function(s,o){function l(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:o();break;case n.TIMEOUT_EXPIRED:setTimeout(l,t);break;default:s()}}setTimeout(l,t)})}const Qv=new ut().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Jv=new ut().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function OM(){const n={enabled:!0,workingColorSpace:Ts,spaces:{},convert:function(o,l,u){return this.enabled===!1||l===u||!l||!u||(this.spaces[l].transfer===Ut&&(o.r=sr(o.r),o.g=sr(o.g),o.b=sr(o.b)),this.spaces[l].primaries!==this.spaces[u].primaries&&(o.applyMatrix3(this.spaces[l].toXYZ),o.applyMatrix3(this.spaces[u].fromXYZ)),this.spaces[u].transfer===Ut&&(o.r=So(o.r),o.g=So(o.g),o.b=So(o.b))),o},workingToColorSpace:function(o,l){return this.convert(o,this.workingColorSpace,l)},colorSpaceToWorking:function(o,l){return this.convert(o,l,this.workingColorSpace)},getPrimaries:function(o){return this.spaces[o].primaries},getTransfer:function(o){return o===Nr?zc:this.spaces[o].transfer},getLuminanceCoefficients:function(o,l=this.workingColorSpace){return o.fromArray(this.spaces[l].luminanceCoefficients)},define:function(o){Object.assign(this.spaces,o)},_getMatrix:function(o,l,u){return o.copy(this.spaces[l].toXYZ).multiply(this.spaces[u].fromXYZ)},_getDrawingBufferColorSpace:function(o){return this.spaces[o].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(o=this.workingColorSpace){return this.spaces[o].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(o,l){return Eo("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(o,l)},toWorkingColorSpace:function(o,l){return Eo("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(o,l)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],s=[.3127,.329];return n.define({[Ts]:{primaries:e,whitePoint:s,transfer:zc,toXYZ:Qv,fromXYZ:Jv,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:ci},outputColorSpaceConfig:{drawingBufferColorSpace:ci}},[ci]:{primaries:e,whitePoint:s,transfer:Ut,toXYZ:Qv,fromXYZ:Jv,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:ci}}}),n}const Mt=OM();function sr(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function So(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}let eo;class FM{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let s;if(e instanceof HTMLCanvasElement)s=e;else{eo===void 0&&(eo=Fa("canvas")),eo.width=e.width,eo.height=e.height;const o=eo.getContext("2d");e instanceof ImageData?o.putImageData(e,0,0):o.drawImage(e,0,0,e.width,e.height),s=eo}return s.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Fa("canvas");t.width=e.width,t.height=e.height;const s=t.getContext("2d");s.drawImage(e,0,0,e.width,e.height);const o=s.getImageData(0,0,e.width,e.height),l=o.data;for(let u=0;u<l.length;u++)l[u]=sr(l[u]/255)*255;return s.putImageData(o,0,0),t}else if(e.data){const t=e.data.slice(0);for(let s=0;s<t.length;s++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[s]=Math.floor(sr(t[s]/255)*255):t[s]=sr(t[s]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let kM=0;class Df{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:kM++}),this.uuid=Po(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const s={uuid:this.uuid,url:""},o=this.data;if(o!==null){let l;if(Array.isArray(o)){l=[];for(let u=0,d=o.length;u<d;u++)o[u].isDataTexture?l.push(Zd(o[u].image)):l.push(Zd(o[u]))}else l=Zd(o);s.url=l}return t||(e.images[this.uuid]=s),s}}function Zd(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?FM.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let zM=0;const Qd=new Z;class Dn extends bo{constructor(e=Dn.DEFAULT_IMAGE,t=Dn.DEFAULT_MAPPING,s=Ms,o=Ms,l=wi,u=Or,d=Ti,f=ar,p=Dn.DEFAULT_ANISOTROPY,v=Nr){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:zM++}),this.uuid=Po(),this.name="",this.source=new Df(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=s,this.wrapT=o,this.magFilter=l,this.minFilter=u,this.anisotropy=p,this.format=d,this.internalFormat=null,this.type=f,this.offset=new Lt(0,0),this.repeat=new Lt(1,1),this.center=new Lt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new ut,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=v,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(Qd).x}get height(){return this.source.getSize(Qd).y}get depth(){return this.source.getSize(Qd).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const s=e[t];if(s===void 0){console.warn(`THREE.Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const o=this[t];if(o===void 0){console.warn(`THREE.Texture.setValues(): property '${t}' does not exist.`);continue}o&&s&&o.isVector2&&s.isVector2||o&&s&&o.isVector3&&s.isVector3||o&&s&&o.isMatrix3&&s.isMatrix3?o.copy(s):this[t]=s}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const s={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(s.userData=this.userData),t||(e.textures[this.uuid]=s),s}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==p_)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Fh:e.x=e.x-Math.floor(e.x);break;case Ms:e.x=e.x<0?0:1;break;case kh:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Fh:e.y=e.y-Math.floor(e.y);break;case Ms:e.y=e.y<0?0:1;break;case kh:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Dn.DEFAULT_IMAGE=null;Dn.DEFAULT_MAPPING=p_;Dn.DEFAULT_ANISOTROPY=1;class Kt{constructor(e=0,t=0,s=0,o=1){Kt.prototype.isVector4=!0,this.x=e,this.y=t,this.z=s,this.w=o}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,s,o){return this.x=e,this.y=t,this.z=s,this.w=o,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,s=this.y,o=this.z,l=this.w,u=e.elements;return this.x=u[0]*t+u[4]*s+u[8]*o+u[12]*l,this.y=u[1]*t+u[5]*s+u[9]*o+u[13]*l,this.z=u[2]*t+u[6]*s+u[10]*o+u[14]*l,this.w=u[3]*t+u[7]*s+u[11]*o+u[15]*l,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,s,o,l;const f=e.elements,p=f[0],v=f[4],g=f[8],y=f[1],x=f[5],w=f[9],A=f[2],E=f[6],_=f[10];if(Math.abs(v-y)<.01&&Math.abs(g-A)<.01&&Math.abs(w-E)<.01){if(Math.abs(v+y)<.1&&Math.abs(g+A)<.1&&Math.abs(w+E)<.1&&Math.abs(p+x+_-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const I=(p+1)/2,R=(x+1)/2,k=(_+1)/2,B=(v+y)/4,H=(g+A)/4,Y=(w+E)/4;return I>R&&I>k?I<.01?(s=0,o=.707106781,l=.707106781):(s=Math.sqrt(I),o=B/s,l=H/s):R>k?R<.01?(s=.707106781,o=0,l=.707106781):(o=Math.sqrt(R),s=B/o,l=Y/o):k<.01?(s=.707106781,o=.707106781,l=0):(l=Math.sqrt(k),s=H/l,o=Y/l),this.set(s,o,l,t),this}let N=Math.sqrt((E-w)*(E-w)+(g-A)*(g-A)+(y-v)*(y-v));return Math.abs(N)<.001&&(N=1),this.x=(E-w)/N,this.y=(g-A)/N,this.z=(y-v)/N,this.w=Math.acos((p+x+_-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=_t(this.x,e.x,t.x),this.y=_t(this.y,e.y,t.y),this.z=_t(this.z,e.z,t.z),this.w=_t(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=_t(this.x,e,t),this.y=_t(this.y,e,t),this.z=_t(this.z,e,t),this.w=_t(this.w,e,t),this}clampLength(e,t){const s=this.length();return this.divideScalar(s||1).multiplyScalar(_t(s,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,s){return this.x=e.x+(t.x-e.x)*s,this.y=e.y+(t.y-e.y)*s,this.z=e.z+(t.z-e.z)*s,this.w=e.w+(t.w-e.w)*s,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class BM extends bo{constructor(e=1,t=1,s={}){super(),s=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:wi,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},s),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=s.depth,this.scissor=new Kt(0,0,e,t),this.scissorTest=!1,this.viewport=new Kt(0,0,e,t);const o={width:e,height:t,depth:s.depth},l=new Dn(o);this.textures=[];const u=s.count;for(let d=0;d<u;d++)this.textures[d]=l.clone(),this.textures[d].isRenderTargetTexture=!0,this.textures[d].renderTarget=this;this._setTextureOptions(s),this.depthBuffer=s.depthBuffer,this.stencilBuffer=s.stencilBuffer,this.resolveDepthBuffer=s.resolveDepthBuffer,this.resolveStencilBuffer=s.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=s.depthTexture,this.samples=s.samples,this.multiview=s.multiview}_setTextureOptions(e={}){const t={minFilter:wi,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let s=0;s<this.textures.length;s++)this.textures[s].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,s=1){if(this.width!==e||this.height!==t||this.depth!==s){this.width=e,this.height=t,this.depth=s;for(let o=0,l=this.textures.length;o<l;o++)this.textures[o].image.width=e,this.textures[o].image.height=t,this.textures[o].image.depth=s,this.textures[o].isArrayTexture=this.textures[o].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,s=e.textures.length;t<s;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const o=Object.assign({},e.textures[t].image);this.textures[t].source=new Df(o)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Xr extends BM{constructor(e=1,t=1,s={}){super(e,t,s),this.isWebGLRenderTarget=!0}}class T_ extends Dn{constructor(e=null,t=1,s=1,o=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:s,depth:o},this.magFilter=Ai,this.minFilter=Ai,this.wrapR=Ms,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class HM extends Dn{constructor(e=null,t=1,s=1,o=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:s,depth:o},this.magFilter=Ai,this.minFilter=Ai,this.wrapR=Ms,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Io{constructor(e=new Z(1/0,1/0,1/0),t=new Z(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,s=e.length;t<s;t+=3)this.expandByPoint(yi.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,s=e.count;t<s;t++)this.expandByPoint(yi.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,s=e.length;t<s;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const s=yi.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(s),this.max.copy(e).add(s),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const s=e.geometry;if(s!==void 0){const l=s.getAttribute("position");if(t===!0&&l!==void 0&&e.isInstancedMesh!==!0)for(let u=0,d=l.count;u<d;u++)e.isMesh===!0?e.getVertexPosition(u,yi):yi.fromBufferAttribute(l,u),yi.applyMatrix4(e.matrixWorld),this.expandByPoint(yi);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),tc.copy(e.boundingBox)):(s.boundingBox===null&&s.computeBoundingBox(),tc.copy(s.boundingBox)),tc.applyMatrix4(e.matrixWorld),this.union(tc)}const o=e.children;for(let l=0,u=o.length;l<u;l++)this.expandByObject(o[l],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,yi),yi.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,s;return e.normal.x>0?(t=e.normal.x*this.min.x,s=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,s=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,s+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,s+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,s+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,s+=e.normal.z*this.min.z),t<=-e.constant&&s>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(fa),nc.subVectors(this.max,fa),to.subVectors(e.a,fa),no.subVectors(e.b,fa),io.subVectors(e.c,fa),Rr.subVectors(no,to),br.subVectors(io,no),ds.subVectors(to,io);let t=[0,-Rr.z,Rr.y,0,-br.z,br.y,0,-ds.z,ds.y,Rr.z,0,-Rr.x,br.z,0,-br.x,ds.z,0,-ds.x,-Rr.y,Rr.x,0,-br.y,br.x,0,-ds.y,ds.x,0];return!Jd(t,to,no,io,nc)||(t=[1,0,0,0,1,0,0,0,1],!Jd(t,to,no,io,nc))?!1:(ic.crossVectors(Rr,br),t=[ic.x,ic.y,ic.z],Jd(t,to,no,io,nc))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,yi).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(yi).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Ki[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Ki[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Ki[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Ki[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Ki[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Ki[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Ki[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Ki[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Ki),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const Ki=[new Z,new Z,new Z,new Z,new Z,new Z,new Z,new Z],yi=new Z,tc=new Io,to=new Z,no=new Z,io=new Z,Rr=new Z,br=new Z,ds=new Z,fa=new Z,nc=new Z,ic=new Z,hs=new Z;function Jd(n,e,t,s,o){for(let l=0,u=n.length-3;l<=u;l+=3){hs.fromArray(n,l);const d=o.x*Math.abs(hs.x)+o.y*Math.abs(hs.y)+o.z*Math.abs(hs.z),f=e.dot(hs),p=t.dot(hs),v=s.dot(hs);if(Math.max(-Math.max(f,p,v),Math.min(f,p,v))>d)return!1}return!0}const VM=new Io,pa=new Z,eh=new Z;class Nf{constructor(e=new Z,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const s=this.center;t!==void 0?s.copy(t):VM.setFromPoints(e).getCenter(s);let o=0;for(let l=0,u=e.length;l<u;l++)o=Math.max(o,s.distanceToSquared(e[l]));return this.radius=Math.sqrt(o),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const s=this.center.distanceToSquared(e);return t.copy(e),s>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;pa.subVectors(e,this.center);const t=pa.lengthSq();if(t>this.radius*this.radius){const s=Math.sqrt(t),o=(s-this.radius)*.5;this.center.addScaledVector(pa,o/s),this.radius+=o}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(eh.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(pa.copy(e.center).add(eh)),this.expandByPoint(pa.copy(e.center).sub(eh))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}const Zi=new Z,th=new Z,rc=new Z,Pr=new Z,nh=new Z,sc=new Z,ih=new Z;class A_{constructor(e=new Z,t=new Z(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Zi)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const s=t.dot(this.direction);return s<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,s)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Zi.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Zi.copy(this.origin).addScaledVector(this.direction,t),Zi.distanceToSquared(e))}distanceSqToSegment(e,t,s,o){th.copy(e).add(t).multiplyScalar(.5),rc.copy(t).sub(e).normalize(),Pr.copy(this.origin).sub(th);const l=e.distanceTo(t)*.5,u=-this.direction.dot(rc),d=Pr.dot(this.direction),f=-Pr.dot(rc),p=Pr.lengthSq(),v=Math.abs(1-u*u);let g,y,x,w;if(v>0)if(g=u*f-d,y=u*d-f,w=l*v,g>=0)if(y>=-w)if(y<=w){const A=1/v;g*=A,y*=A,x=g*(g+u*y+2*d)+y*(u*g+y+2*f)+p}else y=l,g=Math.max(0,-(u*y+d)),x=-g*g+y*(y+2*f)+p;else y=-l,g=Math.max(0,-(u*y+d)),x=-g*g+y*(y+2*f)+p;else y<=-w?(g=Math.max(0,-(-u*l+d)),y=g>0?-l:Math.min(Math.max(-l,-f),l),x=-g*g+y*(y+2*f)+p):y<=w?(g=0,y=Math.min(Math.max(-l,-f),l),x=y*(y+2*f)+p):(g=Math.max(0,-(u*l+d)),y=g>0?l:Math.min(Math.max(-l,-f),l),x=-g*g+y*(y+2*f)+p);else y=u>0?-l:l,g=Math.max(0,-(u*y+d)),x=-g*g+y*(y+2*f)+p;return s&&s.copy(this.origin).addScaledVector(this.direction,g),o&&o.copy(th).addScaledVector(rc,y),x}intersectSphere(e,t){Zi.subVectors(e.center,this.origin);const s=Zi.dot(this.direction),o=Zi.dot(Zi)-s*s,l=e.radius*e.radius;if(o>l)return null;const u=Math.sqrt(l-o),d=s-u,f=s+u;return f<0?null:d<0?this.at(f,t):this.at(d,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const s=-(this.origin.dot(e.normal)+e.constant)/t;return s>=0?s:null}intersectPlane(e,t){const s=this.distanceToPlane(e);return s===null?null:this.at(s,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let s,o,l,u,d,f;const p=1/this.direction.x,v=1/this.direction.y,g=1/this.direction.z,y=this.origin;return p>=0?(s=(e.min.x-y.x)*p,o=(e.max.x-y.x)*p):(s=(e.max.x-y.x)*p,o=(e.min.x-y.x)*p),v>=0?(l=(e.min.y-y.y)*v,u=(e.max.y-y.y)*v):(l=(e.max.y-y.y)*v,u=(e.min.y-y.y)*v),s>u||l>o||((l>s||isNaN(s))&&(s=l),(u<o||isNaN(o))&&(o=u),g>=0?(d=(e.min.z-y.z)*g,f=(e.max.z-y.z)*g):(d=(e.max.z-y.z)*g,f=(e.min.z-y.z)*g),s>f||d>o)||((d>s||s!==s)&&(s=d),(f<o||o!==o)&&(o=f),o<0)?null:this.at(s>=0?s:o,t)}intersectsBox(e){return this.intersectBox(e,Zi)!==null}intersectTriangle(e,t,s,o,l){nh.subVectors(t,e),sc.subVectors(s,e),ih.crossVectors(nh,sc);let u=this.direction.dot(ih),d;if(u>0){if(o)return null;d=1}else if(u<0)d=-1,u=-u;else return null;Pr.subVectors(this.origin,e);const f=d*this.direction.dot(sc.crossVectors(Pr,sc));if(f<0)return null;const p=d*this.direction.dot(nh.cross(Pr));if(p<0||f+p>u)return null;const v=-d*Pr.dot(ih);return v<0?null:this.at(v/u,l)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Zt{constructor(e,t,s,o,l,u,d,f,p,v,g,y,x,w,A,E){Zt.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,s,o,l,u,d,f,p,v,g,y,x,w,A,E)}set(e,t,s,o,l,u,d,f,p,v,g,y,x,w,A,E){const _=this.elements;return _[0]=e,_[4]=t,_[8]=s,_[12]=o,_[1]=l,_[5]=u,_[9]=d,_[13]=f,_[2]=p,_[6]=v,_[10]=g,_[14]=y,_[3]=x,_[7]=w,_[11]=A,_[15]=E,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Zt().fromArray(this.elements)}copy(e){const t=this.elements,s=e.elements;return t[0]=s[0],t[1]=s[1],t[2]=s[2],t[3]=s[3],t[4]=s[4],t[5]=s[5],t[6]=s[6],t[7]=s[7],t[8]=s[8],t[9]=s[9],t[10]=s[10],t[11]=s[11],t[12]=s[12],t[13]=s[13],t[14]=s[14],t[15]=s[15],this}copyPosition(e){const t=this.elements,s=e.elements;return t[12]=s[12],t[13]=s[13],t[14]=s[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,s){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),s.setFromMatrixColumn(this,2),this}makeBasis(e,t,s){return this.set(e.x,t.x,s.x,0,e.y,t.y,s.y,0,e.z,t.z,s.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,s=e.elements,o=1/ro.setFromMatrixColumn(e,0).length(),l=1/ro.setFromMatrixColumn(e,1).length(),u=1/ro.setFromMatrixColumn(e,2).length();return t[0]=s[0]*o,t[1]=s[1]*o,t[2]=s[2]*o,t[3]=0,t[4]=s[4]*l,t[5]=s[5]*l,t[6]=s[6]*l,t[7]=0,t[8]=s[8]*u,t[9]=s[9]*u,t[10]=s[10]*u,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,s=e.x,o=e.y,l=e.z,u=Math.cos(s),d=Math.sin(s),f=Math.cos(o),p=Math.sin(o),v=Math.cos(l),g=Math.sin(l);if(e.order==="XYZ"){const y=u*v,x=u*g,w=d*v,A=d*g;t[0]=f*v,t[4]=-f*g,t[8]=p,t[1]=x+w*p,t[5]=y-A*p,t[9]=-d*f,t[2]=A-y*p,t[6]=w+x*p,t[10]=u*f}else if(e.order==="YXZ"){const y=f*v,x=f*g,w=p*v,A=p*g;t[0]=y+A*d,t[4]=w*d-x,t[8]=u*p,t[1]=u*g,t[5]=u*v,t[9]=-d,t[2]=x*d-w,t[6]=A+y*d,t[10]=u*f}else if(e.order==="ZXY"){const y=f*v,x=f*g,w=p*v,A=p*g;t[0]=y-A*d,t[4]=-u*g,t[8]=w+x*d,t[1]=x+w*d,t[5]=u*v,t[9]=A-y*d,t[2]=-u*p,t[6]=d,t[10]=u*f}else if(e.order==="ZYX"){const y=u*v,x=u*g,w=d*v,A=d*g;t[0]=f*v,t[4]=w*p-x,t[8]=y*p+A,t[1]=f*g,t[5]=A*p+y,t[9]=x*p-w,t[2]=-p,t[6]=d*f,t[10]=u*f}else if(e.order==="YZX"){const y=u*f,x=u*p,w=d*f,A=d*p;t[0]=f*v,t[4]=A-y*g,t[8]=w*g+x,t[1]=g,t[5]=u*v,t[9]=-d*v,t[2]=-p*v,t[6]=x*g+w,t[10]=y-A*g}else if(e.order==="XZY"){const y=u*f,x=u*p,w=d*f,A=d*p;t[0]=f*v,t[4]=-g,t[8]=p*v,t[1]=y*g+A,t[5]=u*v,t[9]=x*g-w,t[2]=w*g-x,t[6]=d*v,t[10]=A*g+y}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(GM,e,WM)}lookAt(e,t,s){const o=this.elements;return qn.subVectors(e,t),qn.lengthSq()===0&&(qn.z=1),qn.normalize(),Lr.crossVectors(s,qn),Lr.lengthSq()===0&&(Math.abs(s.z)===1?qn.x+=1e-4:qn.z+=1e-4,qn.normalize(),Lr.crossVectors(s,qn)),Lr.normalize(),oc.crossVectors(qn,Lr),o[0]=Lr.x,o[4]=oc.x,o[8]=qn.x,o[1]=Lr.y,o[5]=oc.y,o[9]=qn.y,o[2]=Lr.z,o[6]=oc.z,o[10]=qn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const s=e.elements,o=t.elements,l=this.elements,u=s[0],d=s[4],f=s[8],p=s[12],v=s[1],g=s[5],y=s[9],x=s[13],w=s[2],A=s[6],E=s[10],_=s[14],N=s[3],I=s[7],R=s[11],k=s[15],B=o[0],H=o[4],Y=o[8],b=o[12],C=o[1],D=o[5],de=o[9],ie=o[13],le=o[2],fe=o[6],ce=o[10],oe=o[14],O=o[3],ae=o[7],se=o[11],U=o[15];return l[0]=u*B+d*C+f*le+p*O,l[4]=u*H+d*D+f*fe+p*ae,l[8]=u*Y+d*de+f*ce+p*se,l[12]=u*b+d*ie+f*oe+p*U,l[1]=v*B+g*C+y*le+x*O,l[5]=v*H+g*D+y*fe+x*ae,l[9]=v*Y+g*de+y*ce+x*se,l[13]=v*b+g*ie+y*oe+x*U,l[2]=w*B+A*C+E*le+_*O,l[6]=w*H+A*D+E*fe+_*ae,l[10]=w*Y+A*de+E*ce+_*se,l[14]=w*b+A*ie+E*oe+_*U,l[3]=N*B+I*C+R*le+k*O,l[7]=N*H+I*D+R*fe+k*ae,l[11]=N*Y+I*de+R*ce+k*se,l[15]=N*b+I*ie+R*oe+k*U,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],s=e[4],o=e[8],l=e[12],u=e[1],d=e[5],f=e[9],p=e[13],v=e[2],g=e[6],y=e[10],x=e[14],w=e[3],A=e[7],E=e[11],_=e[15];return w*(+l*f*g-o*p*g-l*d*y+s*p*y+o*d*x-s*f*x)+A*(+t*f*x-t*p*y+l*u*y-o*u*x+o*p*v-l*f*v)+E*(+t*p*g-t*d*x-l*u*g+s*u*x+l*d*v-s*p*v)+_*(-o*d*v-t*f*g+t*d*y+o*u*g-s*u*y+s*f*v)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,s){const o=this.elements;return e.isVector3?(o[12]=e.x,o[13]=e.y,o[14]=e.z):(o[12]=e,o[13]=t,o[14]=s),this}invert(){const e=this.elements,t=e[0],s=e[1],o=e[2],l=e[3],u=e[4],d=e[5],f=e[6],p=e[7],v=e[8],g=e[9],y=e[10],x=e[11],w=e[12],A=e[13],E=e[14],_=e[15],N=g*E*p-A*y*p+A*f*x-d*E*x-g*f*_+d*y*_,I=w*y*p-v*E*p-w*f*x+u*E*x+v*f*_-u*y*_,R=v*A*p-w*g*p+w*d*x-u*A*x-v*d*_+u*g*_,k=w*g*f-v*A*f-w*d*y+u*A*y+v*d*E-u*g*E,B=t*N+s*I+o*R+l*k;if(B===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const H=1/B;return e[0]=N*H,e[1]=(A*y*l-g*E*l-A*o*x+s*E*x+g*o*_-s*y*_)*H,e[2]=(d*E*l-A*f*l+A*o*p-s*E*p-d*o*_+s*f*_)*H,e[3]=(g*f*l-d*y*l-g*o*p+s*y*p+d*o*x-s*f*x)*H,e[4]=I*H,e[5]=(v*E*l-w*y*l+w*o*x-t*E*x-v*o*_+t*y*_)*H,e[6]=(w*f*l-u*E*l-w*o*p+t*E*p+u*o*_-t*f*_)*H,e[7]=(u*y*l-v*f*l+v*o*p-t*y*p-u*o*x+t*f*x)*H,e[8]=R*H,e[9]=(w*g*l-v*A*l-w*s*x+t*A*x+v*s*_-t*g*_)*H,e[10]=(u*A*l-w*d*l+w*s*p-t*A*p-u*s*_+t*d*_)*H,e[11]=(v*d*l-u*g*l-v*s*p+t*g*p+u*s*x-t*d*x)*H,e[12]=k*H,e[13]=(v*A*o-w*g*o+w*s*y-t*A*y-v*s*E+t*g*E)*H,e[14]=(w*d*o-u*A*o-w*s*f+t*A*f+u*s*E-t*d*E)*H,e[15]=(u*g*o-v*d*o+v*s*f-t*g*f-u*s*y+t*d*y)*H,this}scale(e){const t=this.elements,s=e.x,o=e.y,l=e.z;return t[0]*=s,t[4]*=o,t[8]*=l,t[1]*=s,t[5]*=o,t[9]*=l,t[2]*=s,t[6]*=o,t[10]*=l,t[3]*=s,t[7]*=o,t[11]*=l,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],s=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],o=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,s,o))}makeTranslation(e,t,s){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,s,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),s=Math.sin(e);return this.set(1,0,0,0,0,t,-s,0,0,s,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),s=Math.sin(e);return this.set(t,0,s,0,0,1,0,0,-s,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),s=Math.sin(e);return this.set(t,-s,0,0,s,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const s=Math.cos(t),o=Math.sin(t),l=1-s,u=e.x,d=e.y,f=e.z,p=l*u,v=l*d;return this.set(p*u+s,p*d-o*f,p*f+o*d,0,p*d+o*f,v*d+s,v*f-o*u,0,p*f-o*d,v*f+o*u,l*f*f+s,0,0,0,0,1),this}makeScale(e,t,s){return this.set(e,0,0,0,0,t,0,0,0,0,s,0,0,0,0,1),this}makeShear(e,t,s,o,l,u){return this.set(1,s,l,0,e,1,u,0,t,o,1,0,0,0,0,1),this}compose(e,t,s){const o=this.elements,l=t._x,u=t._y,d=t._z,f=t._w,p=l+l,v=u+u,g=d+d,y=l*p,x=l*v,w=l*g,A=u*v,E=u*g,_=d*g,N=f*p,I=f*v,R=f*g,k=s.x,B=s.y,H=s.z;return o[0]=(1-(A+_))*k,o[1]=(x+R)*k,o[2]=(w-I)*k,o[3]=0,o[4]=(x-R)*B,o[5]=(1-(y+_))*B,o[6]=(E+N)*B,o[7]=0,o[8]=(w+I)*H,o[9]=(E-N)*H,o[10]=(1-(y+A))*H,o[11]=0,o[12]=e.x,o[13]=e.y,o[14]=e.z,o[15]=1,this}decompose(e,t,s){const o=this.elements;let l=ro.set(o[0],o[1],o[2]).length();const u=ro.set(o[4],o[5],o[6]).length(),d=ro.set(o[8],o[9],o[10]).length();this.determinant()<0&&(l=-l),e.x=o[12],e.y=o[13],e.z=o[14],xi.copy(this);const p=1/l,v=1/u,g=1/d;return xi.elements[0]*=p,xi.elements[1]*=p,xi.elements[2]*=p,xi.elements[4]*=v,xi.elements[5]*=v,xi.elements[6]*=v,xi.elements[8]*=g,xi.elements[9]*=g,xi.elements[10]*=g,t.setFromRotationMatrix(xi),s.x=l,s.y=u,s.z=d,this}makePerspective(e,t,s,o,l,u,d=Ni,f=!1){const p=this.elements,v=2*l/(t-e),g=2*l/(s-o),y=(t+e)/(t-e),x=(s+o)/(s-o);let w,A;if(f)w=l/(u-l),A=u*l/(u-l);else if(d===Ni)w=-(u+l)/(u-l),A=-2*u*l/(u-l);else if(d===Bc)w=-u/(u-l),A=-u*l/(u-l);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+d);return p[0]=v,p[4]=0,p[8]=y,p[12]=0,p[1]=0,p[5]=g,p[9]=x,p[13]=0,p[2]=0,p[6]=0,p[10]=w,p[14]=A,p[3]=0,p[7]=0,p[11]=-1,p[15]=0,this}makeOrthographic(e,t,s,o,l,u,d=Ni,f=!1){const p=this.elements,v=2/(t-e),g=2/(s-o),y=-(t+e)/(t-e),x=-(s+o)/(s-o);let w,A;if(f)w=1/(u-l),A=u/(u-l);else if(d===Ni)w=-2/(u-l),A=-(u+l)/(u-l);else if(d===Bc)w=-1/(u-l),A=-l/(u-l);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+d);return p[0]=v,p[4]=0,p[8]=0,p[12]=y,p[1]=0,p[5]=g,p[9]=0,p[13]=x,p[2]=0,p[6]=0,p[10]=w,p[14]=A,p[3]=0,p[7]=0,p[11]=0,p[15]=1,this}equals(e){const t=this.elements,s=e.elements;for(let o=0;o<16;o++)if(t[o]!==s[o])return!1;return!0}fromArray(e,t=0){for(let s=0;s<16;s++)this.elements[s]=e[s+t];return this}toArray(e=[],t=0){const s=this.elements;return e[t]=s[0],e[t+1]=s[1],e[t+2]=s[2],e[t+3]=s[3],e[t+4]=s[4],e[t+5]=s[5],e[t+6]=s[6],e[t+7]=s[7],e[t+8]=s[8],e[t+9]=s[9],e[t+10]=s[10],e[t+11]=s[11],e[t+12]=s[12],e[t+13]=s[13],e[t+14]=s[14],e[t+15]=s[15],e}}const ro=new Z,xi=new Zt,GM=new Z(0,0,0),WM=new Z(1,1,1),Lr=new Z,oc=new Z,qn=new Z,eg=new Zt,tg=new Lo;class zi{constructor(e=0,t=0,s=0,o=zi.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=s,this._order=o}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,s,o=this._order){return this._x=e,this._y=t,this._z=s,this._order=o,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,s=!0){const o=e.elements,l=o[0],u=o[4],d=o[8],f=o[1],p=o[5],v=o[9],g=o[2],y=o[6],x=o[10];switch(t){case"XYZ":this._y=Math.asin(_t(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(-v,x),this._z=Math.atan2(-u,l)):(this._x=Math.atan2(y,p),this._z=0);break;case"YXZ":this._x=Math.asin(-_t(v,-1,1)),Math.abs(v)<.9999999?(this._y=Math.atan2(d,x),this._z=Math.atan2(f,p)):(this._y=Math.atan2(-g,l),this._z=0);break;case"ZXY":this._x=Math.asin(_t(y,-1,1)),Math.abs(y)<.9999999?(this._y=Math.atan2(-g,x),this._z=Math.atan2(-u,p)):(this._y=0,this._z=Math.atan2(f,l));break;case"ZYX":this._y=Math.asin(-_t(g,-1,1)),Math.abs(g)<.9999999?(this._x=Math.atan2(y,x),this._z=Math.atan2(f,l)):(this._x=0,this._z=Math.atan2(-u,p));break;case"YZX":this._z=Math.asin(_t(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(-v,p),this._y=Math.atan2(-g,l)):(this._x=0,this._y=Math.atan2(d,x));break;case"XZY":this._z=Math.asin(-_t(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(y,p),this._y=Math.atan2(d,l)):(this._x=Math.atan2(-v,x),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,s===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,s){return eg.makeRotationFromQuaternion(e),this.setFromRotationMatrix(eg,t,s)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return tg.setFromEuler(this),this.setFromQuaternion(tg,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}zi.DEFAULT_ORDER="XYZ";class Of{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let XM=0;const ng=new Z,so=new Lo,Qi=new Zt,ac=new Z,ma=new Z,jM=new Z,YM=new Lo,ig=new Z(1,0,0),rg=new Z(0,1,0),sg=new Z(0,0,1),og={type:"added"},$M={type:"removed"},oo={type:"childadded",child:null},rh={type:"childremoved",child:null};class Jn extends bo{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:XM++}),this.uuid=Po(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Jn.DEFAULT_UP.clone();const e=new Z,t=new zi,s=new Lo,o=new Z(1,1,1);function l(){s.setFromEuler(t,!1)}function u(){t.setFromQuaternion(s,void 0,!1)}t._onChange(l),s._onChange(u),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:s},scale:{configurable:!0,enumerable:!0,value:o},modelViewMatrix:{value:new Zt},normalMatrix:{value:new ut}}),this.matrix=new Zt,this.matrixWorld=new Zt,this.matrixAutoUpdate=Jn.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Jn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Of,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return so.setFromAxisAngle(e,t),this.quaternion.multiply(so),this}rotateOnWorldAxis(e,t){return so.setFromAxisAngle(e,t),this.quaternion.premultiply(so),this}rotateX(e){return this.rotateOnAxis(ig,e)}rotateY(e){return this.rotateOnAxis(rg,e)}rotateZ(e){return this.rotateOnAxis(sg,e)}translateOnAxis(e,t){return ng.copy(e).applyQuaternion(this.quaternion),this.position.add(ng.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(ig,e)}translateY(e){return this.translateOnAxis(rg,e)}translateZ(e){return this.translateOnAxis(sg,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Qi.copy(this.matrixWorld).invert())}lookAt(e,t,s){e.isVector3?ac.copy(e):ac.set(e,t,s);const o=this.parent;this.updateWorldMatrix(!0,!1),ma.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Qi.lookAt(ma,ac,this.up):Qi.lookAt(ac,ma,this.up),this.quaternion.setFromRotationMatrix(Qi),o&&(Qi.extractRotation(o.matrixWorld),so.setFromRotationMatrix(Qi),this.quaternion.premultiply(so.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(og),oo.child=e,this.dispatchEvent(oo),oo.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let s=0;s<arguments.length;s++)this.remove(arguments[s]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent($M),rh.child=e,this.dispatchEvent(rh),rh.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Qi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Qi.multiply(e.parent.matrixWorld)),e.applyMatrix4(Qi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(og),oo.child=e,this.dispatchEvent(oo),oo.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let s=0,o=this.children.length;s<o;s++){const u=this.children[s].getObjectByProperty(e,t);if(u!==void 0)return u}}getObjectsByProperty(e,t,s=[]){this[e]===t&&s.push(this);const o=this.children;for(let l=0,u=o.length;l<u;l++)o[l].getObjectsByProperty(e,t,s);return s}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ma,e,jM),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ma,YM,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let s=0,o=t.length;s<o;s++)t[s].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let s=0,o=t.length;s<o;s++)t[s].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let s=0,o=t.length;s<o;s++)t[s].updateMatrixWorld(e)}updateWorldMatrix(e,t){const s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const o=this.children;for(let l=0,u=o.length;l<u;l++)o[l].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",s={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},s.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const o={};o.uuid=this.uuid,o.type=this.type,this.name!==""&&(o.name=this.name),this.castShadow===!0&&(o.castShadow=!0),this.receiveShadow===!0&&(o.receiveShadow=!0),this.visible===!1&&(o.visible=!1),this.frustumCulled===!1&&(o.frustumCulled=!1),this.renderOrder!==0&&(o.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(o.userData=this.userData),o.layers=this.layers.mask,o.matrix=this.matrix.toArray(),o.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(o.matrixAutoUpdate=!1),this.isInstancedMesh&&(o.type="InstancedMesh",o.count=this.count,o.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(o.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(o.type="BatchedMesh",o.perObjectFrustumCulled=this.perObjectFrustumCulled,o.sortObjects=this.sortObjects,o.drawRanges=this._drawRanges,o.reservedRanges=this._reservedRanges,o.geometryInfo=this._geometryInfo.map(d=>({...d,boundingBox:d.boundingBox?d.boundingBox.toJSON():void 0,boundingSphere:d.boundingSphere?d.boundingSphere.toJSON():void 0})),o.instanceInfo=this._instanceInfo.map(d=>({...d})),o.availableInstanceIds=this._availableInstanceIds.slice(),o.availableGeometryIds=this._availableGeometryIds.slice(),o.nextIndexStart=this._nextIndexStart,o.nextVertexStart=this._nextVertexStart,o.geometryCount=this._geometryCount,o.maxInstanceCount=this._maxInstanceCount,o.maxVertexCount=this._maxVertexCount,o.maxIndexCount=this._maxIndexCount,o.geometryInitialized=this._geometryInitialized,o.matricesTexture=this._matricesTexture.toJSON(e),o.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(o.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(o.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(o.boundingBox=this.boundingBox.toJSON()));function l(d,f){return d[f.uuid]===void 0&&(d[f.uuid]=f.toJSON(e)),f.uuid}if(this.isScene)this.background&&(this.background.isColor?o.background=this.background.toJSON():this.background.isTexture&&(o.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(o.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){o.geometry=l(e.geometries,this.geometry);const d=this.geometry.parameters;if(d!==void 0&&d.shapes!==void 0){const f=d.shapes;if(Array.isArray(f))for(let p=0,v=f.length;p<v;p++){const g=f[p];l(e.shapes,g)}else l(e.shapes,f)}}if(this.isSkinnedMesh&&(o.bindMode=this.bindMode,o.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(l(e.skeletons,this.skeleton),o.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const d=[];for(let f=0,p=this.material.length;f<p;f++)d.push(l(e.materials,this.material[f]));o.material=d}else o.material=l(e.materials,this.material);if(this.children.length>0){o.children=[];for(let d=0;d<this.children.length;d++)o.children.push(this.children[d].toJSON(e).object)}if(this.animations.length>0){o.animations=[];for(let d=0;d<this.animations.length;d++){const f=this.animations[d];o.animations.push(l(e.animations,f))}}if(t){const d=u(e.geometries),f=u(e.materials),p=u(e.textures),v=u(e.images),g=u(e.shapes),y=u(e.skeletons),x=u(e.animations),w=u(e.nodes);d.length>0&&(s.geometries=d),f.length>0&&(s.materials=f),p.length>0&&(s.textures=p),v.length>0&&(s.images=v),g.length>0&&(s.shapes=g),y.length>0&&(s.skeletons=y),x.length>0&&(s.animations=x),w.length>0&&(s.nodes=w)}return s.object=o,s;function u(d){const f=[];for(const p in d){const v=d[p];delete v.metadata,f.push(v)}return f}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let s=0;s<e.children.length;s++){const o=e.children[s];this.add(o.clone())}return this}}Jn.DEFAULT_UP=new Z(0,1,0);Jn.DEFAULT_MATRIX_AUTO_UPDATE=!0;Jn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Ei=new Z,Ji=new Z,sh=new Z,er=new Z,ao=new Z,lo=new Z,ag=new Z,oh=new Z,ah=new Z,lh=new Z,ch=new Kt,uh=new Kt,dh=new Kt;class Mi{constructor(e=new Z,t=new Z,s=new Z){this.a=e,this.b=t,this.c=s}static getNormal(e,t,s,o){o.subVectors(s,t),Ei.subVectors(e,t),o.cross(Ei);const l=o.lengthSq();return l>0?o.multiplyScalar(1/Math.sqrt(l)):o.set(0,0,0)}static getBarycoord(e,t,s,o,l){Ei.subVectors(o,t),Ji.subVectors(s,t),sh.subVectors(e,t);const u=Ei.dot(Ei),d=Ei.dot(Ji),f=Ei.dot(sh),p=Ji.dot(Ji),v=Ji.dot(sh),g=u*p-d*d;if(g===0)return l.set(0,0,0),null;const y=1/g,x=(p*f-d*v)*y,w=(u*v-d*f)*y;return l.set(1-x-w,w,x)}static containsPoint(e,t,s,o){return this.getBarycoord(e,t,s,o,er)===null?!1:er.x>=0&&er.y>=0&&er.x+er.y<=1}static getInterpolation(e,t,s,o,l,u,d,f){return this.getBarycoord(e,t,s,o,er)===null?(f.x=0,f.y=0,"z"in f&&(f.z=0),"w"in f&&(f.w=0),null):(f.setScalar(0),f.addScaledVector(l,er.x),f.addScaledVector(u,er.y),f.addScaledVector(d,er.z),f)}static getInterpolatedAttribute(e,t,s,o,l,u){return ch.setScalar(0),uh.setScalar(0),dh.setScalar(0),ch.fromBufferAttribute(e,t),uh.fromBufferAttribute(e,s),dh.fromBufferAttribute(e,o),u.setScalar(0),u.addScaledVector(ch,l.x),u.addScaledVector(uh,l.y),u.addScaledVector(dh,l.z),u}static isFrontFacing(e,t,s,o){return Ei.subVectors(s,t),Ji.subVectors(e,t),Ei.cross(Ji).dot(o)<0}set(e,t,s){return this.a.copy(e),this.b.copy(t),this.c.copy(s),this}setFromPointsAndIndices(e,t,s,o){return this.a.copy(e[t]),this.b.copy(e[s]),this.c.copy(e[o]),this}setFromAttributeAndIndices(e,t,s,o){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,s),this.c.fromBufferAttribute(e,o),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Ei.subVectors(this.c,this.b),Ji.subVectors(this.a,this.b),Ei.cross(Ji).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Mi.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return Mi.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,s,o,l){return Mi.getInterpolation(e,this.a,this.b,this.c,t,s,o,l)}containsPoint(e){return Mi.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Mi.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const s=this.a,o=this.b,l=this.c;let u,d;ao.subVectors(o,s),lo.subVectors(l,s),oh.subVectors(e,s);const f=ao.dot(oh),p=lo.dot(oh);if(f<=0&&p<=0)return t.copy(s);ah.subVectors(e,o);const v=ao.dot(ah),g=lo.dot(ah);if(v>=0&&g<=v)return t.copy(o);const y=f*g-v*p;if(y<=0&&f>=0&&v<=0)return u=f/(f-v),t.copy(s).addScaledVector(ao,u);lh.subVectors(e,l);const x=ao.dot(lh),w=lo.dot(lh);if(w>=0&&x<=w)return t.copy(l);const A=x*p-f*w;if(A<=0&&p>=0&&w<=0)return d=p/(p-w),t.copy(s).addScaledVector(lo,d);const E=v*w-x*g;if(E<=0&&g-v>=0&&x-w>=0)return ag.subVectors(l,o),d=(g-v)/(g-v+(x-w)),t.copy(o).addScaledVector(ag,d);const _=1/(E+A+y);return u=A*_,d=y*_,t.copy(s).addScaledVector(ao,u).addScaledVector(lo,d)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const C_={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ir={h:0,s:0,l:0},lc={h:0,s:0,l:0};function hh(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}class Dt{constructor(e,t,s){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,s)}set(e,t,s){if(t===void 0&&s===void 0){const o=e;o&&o.isColor?this.copy(o):typeof o=="number"?this.setHex(o):typeof o=="string"&&this.setStyle(o)}else this.setRGB(e,t,s);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=ci){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Mt.colorSpaceToWorking(this,t),this}setRGB(e,t,s,o=Mt.workingColorSpace){return this.r=e,this.g=t,this.b=s,Mt.colorSpaceToWorking(this,o),this}setHSL(e,t,s,o=Mt.workingColorSpace){if(e=Uf(e,1),t=_t(t,0,1),s=_t(s,0,1),t===0)this.r=this.g=this.b=s;else{const l=s<=.5?s*(1+t):s+t-s*t,u=2*s-l;this.r=hh(u,l,e+1/3),this.g=hh(u,l,e),this.b=hh(u,l,e-1/3)}return Mt.colorSpaceToWorking(this,o),this}setStyle(e,t=ci){function s(l){l!==void 0&&parseFloat(l)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let o;if(o=/^(\w+)\(([^\)]*)\)/.exec(e)){let l;const u=o[1],d=o[2];switch(u){case"rgb":case"rgba":if(l=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(d))return s(l[4]),this.setRGB(Math.min(255,parseInt(l[1],10))/255,Math.min(255,parseInt(l[2],10))/255,Math.min(255,parseInt(l[3],10))/255,t);if(l=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(d))return s(l[4]),this.setRGB(Math.min(100,parseInt(l[1],10))/100,Math.min(100,parseInt(l[2],10))/100,Math.min(100,parseInt(l[3],10))/100,t);break;case"hsl":case"hsla":if(l=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(d))return s(l[4]),this.setHSL(parseFloat(l[1])/360,parseFloat(l[2])/100,parseFloat(l[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(o=/^\#([A-Fa-f\d]+)$/.exec(e)){const l=o[1],u=l.length;if(u===3)return this.setRGB(parseInt(l.charAt(0),16)/15,parseInt(l.charAt(1),16)/15,parseInt(l.charAt(2),16)/15,t);if(u===6)return this.setHex(parseInt(l,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=ci){const s=C_[e.toLowerCase()];return s!==void 0?this.setHex(s,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=sr(e.r),this.g=sr(e.g),this.b=sr(e.b),this}copyLinearToSRGB(e){return this.r=So(e.r),this.g=So(e.g),this.b=So(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=ci){return Mt.workingToColorSpace(An.copy(this),e),Math.round(_t(An.r*255,0,255))*65536+Math.round(_t(An.g*255,0,255))*256+Math.round(_t(An.b*255,0,255))}getHexString(e=ci){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Mt.workingColorSpace){Mt.workingToColorSpace(An.copy(this),t);const s=An.r,o=An.g,l=An.b,u=Math.max(s,o,l),d=Math.min(s,o,l);let f,p;const v=(d+u)/2;if(d===u)f=0,p=0;else{const g=u-d;switch(p=v<=.5?g/(u+d):g/(2-u-d),u){case s:f=(o-l)/g+(o<l?6:0);break;case o:f=(l-s)/g+2;break;case l:f=(s-o)/g+4;break}f/=6}return e.h=f,e.s=p,e.l=v,e}getRGB(e,t=Mt.workingColorSpace){return Mt.workingToColorSpace(An.copy(this),t),e.r=An.r,e.g=An.g,e.b=An.b,e}getStyle(e=ci){Mt.workingToColorSpace(An.copy(this),e);const t=An.r,s=An.g,o=An.b;return e!==ci?`color(${e} ${t.toFixed(3)} ${s.toFixed(3)} ${o.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(s*255)},${Math.round(o*255)})`}offsetHSL(e,t,s){return this.getHSL(Ir),this.setHSL(Ir.h+e,Ir.s+t,Ir.l+s)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,s){return this.r=e.r+(t.r-e.r)*s,this.g=e.g+(t.g-e.g)*s,this.b=e.b+(t.b-e.b)*s,this}lerpHSL(e,t){this.getHSL(Ir),e.getHSL(lc);const s=Ea(Ir.h,lc.h,t),o=Ea(Ir.s,lc.s,t),l=Ea(Ir.l,lc.l,t);return this.setHSL(s,o,l),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,s=this.g,o=this.b,l=e.elements;return this.r=l[0]*t+l[3]*s+l[6]*o,this.g=l[1]*t+l[4]*s+l[7]*o,this.b=l[2]*t+l[5]*s+l[8]*o,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const An=new Dt;Dt.NAMES=C_;let qM=0;class qc extends bo{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:qM++}),this.uuid=Po(),this.name="",this.type="Material",this.blending=xo,this.side=Wr,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Ah,this.blendDst=Ch,this.blendEquation=xs,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Dt(0,0,0),this.blendAlpha=0,this.depthFunc=wo,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=jv,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Js,this.stencilZFail=Js,this.stencilZPass=Js,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const s=e[t];if(s===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const o=this[t];if(o===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}o&&o.isColor?o.set(s):o&&o.isVector3&&s&&s.isVector3?o.copy(s):this[t]=s}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const s={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.color&&this.color.isColor&&(s.color=this.color.getHex()),this.roughness!==void 0&&(s.roughness=this.roughness),this.metalness!==void 0&&(s.metalness=this.metalness),this.sheen!==void 0&&(s.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(s.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(s.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(s.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(s.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(s.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(s.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(s.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(s.shininess=this.shininess),this.clearcoat!==void 0&&(s.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(s.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(s.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(s.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(s.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,s.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(s.dispersion=this.dispersion),this.iridescence!==void 0&&(s.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(s.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(s.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(s.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(s.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(s.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(s.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(s.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(s.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(s.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(s.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(s.lightMap=this.lightMap.toJSON(e).uuid,s.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(s.aoMap=this.aoMap.toJSON(e).uuid,s.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(s.bumpMap=this.bumpMap.toJSON(e).uuid,s.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(s.normalMap=this.normalMap.toJSON(e).uuid,s.normalMapType=this.normalMapType,s.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(s.displacementMap=this.displacementMap.toJSON(e).uuid,s.displacementScale=this.displacementScale,s.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(s.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(s.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(s.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(s.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(s.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(s.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(s.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(s.combine=this.combine)),this.envMapRotation!==void 0&&(s.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(s.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(s.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(s.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(s.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(s.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(s.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(s.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(s.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(s.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(s.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(s.size=this.size),this.shadowSide!==null&&(s.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(s.sizeAttenuation=this.sizeAttenuation),this.blending!==xo&&(s.blending=this.blending),this.side!==Wr&&(s.side=this.side),this.vertexColors===!0&&(s.vertexColors=!0),this.opacity<1&&(s.opacity=this.opacity),this.transparent===!0&&(s.transparent=!0),this.blendSrc!==Ah&&(s.blendSrc=this.blendSrc),this.blendDst!==Ch&&(s.blendDst=this.blendDst),this.blendEquation!==xs&&(s.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(s.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(s.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(s.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(s.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(s.blendAlpha=this.blendAlpha),this.depthFunc!==wo&&(s.depthFunc=this.depthFunc),this.depthTest===!1&&(s.depthTest=this.depthTest),this.depthWrite===!1&&(s.depthWrite=this.depthWrite),this.colorWrite===!1&&(s.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(s.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==jv&&(s.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(s.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(s.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Js&&(s.stencilFail=this.stencilFail),this.stencilZFail!==Js&&(s.stencilZFail=this.stencilZFail),this.stencilZPass!==Js&&(s.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(s.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(s.rotation=this.rotation),this.polygonOffset===!0&&(s.polygonOffset=!0),this.polygonOffsetFactor!==0&&(s.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(s.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(s.linewidth=this.linewidth),this.dashSize!==void 0&&(s.dashSize=this.dashSize),this.gapSize!==void 0&&(s.gapSize=this.gapSize),this.scale!==void 0&&(s.scale=this.scale),this.dithering===!0&&(s.dithering=!0),this.alphaTest>0&&(s.alphaTest=this.alphaTest),this.alphaHash===!0&&(s.alphaHash=!0),this.alphaToCoverage===!0&&(s.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(s.premultipliedAlpha=!0),this.forceSinglePass===!0&&(s.forceSinglePass=!0),this.wireframe===!0&&(s.wireframe=!0),this.wireframeLinewidth>1&&(s.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(s.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(s.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(s.flatShading=!0),this.visible===!1&&(s.visible=!1),this.toneMapped===!1&&(s.toneMapped=!1),this.fog===!1&&(s.fog=!1),Object.keys(this.userData).length>0&&(s.userData=this.userData);function o(l){const u=[];for(const d in l){const f=l[d];delete f.metadata,u.push(f)}return u}if(t){const l=o(e.textures),u=o(e.images);l.length>0&&(s.textures=l),u.length>0&&(s.images=u)}return s}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let s=null;if(t!==null){const o=t.length;s=new Array(o);for(let l=0;l!==o;++l)s[l]=t[l].clone()}return this.clippingPlanes=s,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class Ba extends qc{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Dt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new zi,this.combine=h_,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Jt=new Z,cc=new Lt;let KM=0;class Fi{constructor(e,t,s=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:KM++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=s,this.usage=Yv,this.updateRanges=[],this.gpuType=rr,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,s){e*=this.itemSize,s*=t.itemSize;for(let o=0,l=this.itemSize;o<l;o++)this.array[e+o]=t.array[s+o];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,s=this.count;t<s;t++)cc.fromBufferAttribute(this,t),cc.applyMatrix3(e),this.setXY(t,cc.x,cc.y);else if(this.itemSize===3)for(let t=0,s=this.count;t<s;t++)Jt.fromBufferAttribute(this,t),Jt.applyMatrix3(e),this.setXYZ(t,Jt.x,Jt.y,Jt.z);return this}applyMatrix4(e){for(let t=0,s=this.count;t<s;t++)Jt.fromBufferAttribute(this,t),Jt.applyMatrix4(e),this.setXYZ(t,Jt.x,Jt.y,Jt.z);return this}applyNormalMatrix(e){for(let t=0,s=this.count;t<s;t++)Jt.fromBufferAttribute(this,t),Jt.applyNormalMatrix(e),this.setXYZ(t,Jt.x,Jt.y,Jt.z);return this}transformDirection(e){for(let t=0,s=this.count;t<s;t++)Jt.fromBufferAttribute(this,t),Jt.transformDirection(e),this.setXYZ(t,Jt.x,Jt.y,Jt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let s=this.array[e*this.itemSize+t];return this.normalized&&(s=mo(s,this.array)),s}setComponent(e,t,s){return this.normalized&&(s=Ln(s,this.array)),this.array[e*this.itemSize+t]=s,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=mo(t,this.array)),t}setX(e,t){return this.normalized&&(t=Ln(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=mo(t,this.array)),t}setY(e,t){return this.normalized&&(t=Ln(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=mo(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Ln(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=mo(t,this.array)),t}setW(e,t){return this.normalized&&(t=Ln(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,s){return e*=this.itemSize,this.normalized&&(t=Ln(t,this.array),s=Ln(s,this.array)),this.array[e+0]=t,this.array[e+1]=s,this}setXYZ(e,t,s,o){return e*=this.itemSize,this.normalized&&(t=Ln(t,this.array),s=Ln(s,this.array),o=Ln(o,this.array)),this.array[e+0]=t,this.array[e+1]=s,this.array[e+2]=o,this}setXYZW(e,t,s,o,l){return e*=this.itemSize,this.normalized&&(t=Ln(t,this.array),s=Ln(s,this.array),o=Ln(o,this.array),l=Ln(l,this.array)),this.array[e+0]=t,this.array[e+1]=s,this.array[e+2]=o,this.array[e+3]=l,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Yv&&(e.usage=this.usage),e}}class R_ extends Fi{constructor(e,t,s){super(new Uint16Array(e),t,s)}}class b_ extends Fi{constructor(e,t,s){super(new Uint32Array(e),t,s)}}class ki extends Fi{constructor(e,t,s){super(new Float32Array(e),t,s)}}let ZM=0;const ai=new Zt,fh=new Jn,co=new Z,Kn=new Io,va=new Io,un=new Z;class $r extends bo{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:ZM++}),this.uuid=Po(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(w_(e)?b_:R_)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,s=0){this.groups.push({start:e,count:t,materialIndex:s})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const s=this.attributes.normal;if(s!==void 0){const l=new ut().getNormalMatrix(e);s.applyNormalMatrix(l),s.needsUpdate=!0}const o=this.attributes.tangent;return o!==void 0&&(o.transformDirection(e),o.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return ai.makeRotationFromQuaternion(e),this.applyMatrix4(ai),this}rotateX(e){return ai.makeRotationX(e),this.applyMatrix4(ai),this}rotateY(e){return ai.makeRotationY(e),this.applyMatrix4(ai),this}rotateZ(e){return ai.makeRotationZ(e),this.applyMatrix4(ai),this}translate(e,t,s){return ai.makeTranslation(e,t,s),this.applyMatrix4(ai),this}scale(e,t,s){return ai.makeScale(e,t,s),this.applyMatrix4(ai),this}lookAt(e){return fh.lookAt(e),fh.updateMatrix(),this.applyMatrix4(fh.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(co).negate(),this.translate(co.x,co.y,co.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const s=[];for(let o=0,l=e.length;o<l;o++){const u=e[o];s.push(u.x,u.y,u.z||0)}this.setAttribute("position",new ki(s,3))}else{const s=Math.min(e.length,t.count);for(let o=0;o<s;o++){const l=e[o];t.setXYZ(o,l.x,l.y,l.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Io);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new Z(-1/0,-1/0,-1/0),new Z(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){const l=t[s];Kn.setFromBufferAttribute(l),this.morphTargetsRelative?(un.addVectors(this.boundingBox.min,Kn.min),this.boundingBox.expandByPoint(un),un.addVectors(this.boundingBox.max,Kn.max),this.boundingBox.expandByPoint(un)):(this.boundingBox.expandByPoint(Kn.min),this.boundingBox.expandByPoint(Kn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Nf);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new Z,1/0);return}if(e){const s=this.boundingSphere.center;if(Kn.setFromBufferAttribute(e),t)for(let l=0,u=t.length;l<u;l++){const d=t[l];va.setFromBufferAttribute(d),this.morphTargetsRelative?(un.addVectors(Kn.min,va.min),Kn.expandByPoint(un),un.addVectors(Kn.max,va.max),Kn.expandByPoint(un)):(Kn.expandByPoint(va.min),Kn.expandByPoint(va.max))}Kn.getCenter(s);let o=0;for(let l=0,u=e.count;l<u;l++)un.fromBufferAttribute(e,l),o=Math.max(o,s.distanceToSquared(un));if(t)for(let l=0,u=t.length;l<u;l++){const d=t[l],f=this.morphTargetsRelative;for(let p=0,v=d.count;p<v;p++)un.fromBufferAttribute(d,p),f&&(co.fromBufferAttribute(e,p),un.add(co)),o=Math.max(o,s.distanceToSquared(un))}this.boundingSphere.radius=Math.sqrt(o),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const s=t.position,o=t.normal,l=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Fi(new Float32Array(4*s.count),4));const u=this.getAttribute("tangent"),d=[],f=[];for(let Y=0;Y<s.count;Y++)d[Y]=new Z,f[Y]=new Z;const p=new Z,v=new Z,g=new Z,y=new Lt,x=new Lt,w=new Lt,A=new Z,E=new Z;function _(Y,b,C){p.fromBufferAttribute(s,Y),v.fromBufferAttribute(s,b),g.fromBufferAttribute(s,C),y.fromBufferAttribute(l,Y),x.fromBufferAttribute(l,b),w.fromBufferAttribute(l,C),v.sub(p),g.sub(p),x.sub(y),w.sub(y);const D=1/(x.x*w.y-w.x*x.y);isFinite(D)&&(A.copy(v).multiplyScalar(w.y).addScaledVector(g,-x.y).multiplyScalar(D),E.copy(g).multiplyScalar(x.x).addScaledVector(v,-w.x).multiplyScalar(D),d[Y].add(A),d[b].add(A),d[C].add(A),f[Y].add(E),f[b].add(E),f[C].add(E))}let N=this.groups;N.length===0&&(N=[{start:0,count:e.count}]);for(let Y=0,b=N.length;Y<b;++Y){const C=N[Y],D=C.start,de=C.count;for(let ie=D,le=D+de;ie<le;ie+=3)_(e.getX(ie+0),e.getX(ie+1),e.getX(ie+2))}const I=new Z,R=new Z,k=new Z,B=new Z;function H(Y){k.fromBufferAttribute(o,Y),B.copy(k);const b=d[Y];I.copy(b),I.sub(k.multiplyScalar(k.dot(b))).normalize(),R.crossVectors(B,b);const D=R.dot(f[Y])<0?-1:1;u.setXYZW(Y,I.x,I.y,I.z,D)}for(let Y=0,b=N.length;Y<b;++Y){const C=N[Y],D=C.start,de=C.count;for(let ie=D,le=D+de;ie<le;ie+=3)H(e.getX(ie+0)),H(e.getX(ie+1)),H(e.getX(ie+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let s=this.getAttribute("normal");if(s===void 0)s=new Fi(new Float32Array(t.count*3),3),this.setAttribute("normal",s);else for(let y=0,x=s.count;y<x;y++)s.setXYZ(y,0,0,0);const o=new Z,l=new Z,u=new Z,d=new Z,f=new Z,p=new Z,v=new Z,g=new Z;if(e)for(let y=0,x=e.count;y<x;y+=3){const w=e.getX(y+0),A=e.getX(y+1),E=e.getX(y+2);o.fromBufferAttribute(t,w),l.fromBufferAttribute(t,A),u.fromBufferAttribute(t,E),v.subVectors(u,l),g.subVectors(o,l),v.cross(g),d.fromBufferAttribute(s,w),f.fromBufferAttribute(s,A),p.fromBufferAttribute(s,E),d.add(v),f.add(v),p.add(v),s.setXYZ(w,d.x,d.y,d.z),s.setXYZ(A,f.x,f.y,f.z),s.setXYZ(E,p.x,p.y,p.z)}else for(let y=0,x=t.count;y<x;y+=3)o.fromBufferAttribute(t,y+0),l.fromBufferAttribute(t,y+1),u.fromBufferAttribute(t,y+2),v.subVectors(u,l),g.subVectors(o,l),v.cross(g),s.setXYZ(y+0,v.x,v.y,v.z),s.setXYZ(y+1,v.x,v.y,v.z),s.setXYZ(y+2,v.x,v.y,v.z);this.normalizeNormals(),s.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,s=e.count;t<s;t++)un.fromBufferAttribute(e,t),un.normalize(),e.setXYZ(t,un.x,un.y,un.z)}toNonIndexed(){function e(d,f){const p=d.array,v=d.itemSize,g=d.normalized,y=new p.constructor(f.length*v);let x=0,w=0;for(let A=0,E=f.length;A<E;A++){d.isInterleavedBufferAttribute?x=f[A]*d.data.stride+d.offset:x=f[A]*v;for(let _=0;_<v;_++)y[w++]=p[x++]}return new Fi(y,v,g)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new $r,s=this.index.array,o=this.attributes;for(const d in o){const f=o[d],p=e(f,s);t.setAttribute(d,p)}const l=this.morphAttributes;for(const d in l){const f=[],p=l[d];for(let v=0,g=p.length;v<g;v++){const y=p[v],x=e(y,s);f.push(x)}t.morphAttributes[d]=f}t.morphTargetsRelative=this.morphTargetsRelative;const u=this.groups;for(let d=0,f=u.length;d<f;d++){const p=u[d];t.addGroup(p.start,p.count,p.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const f=this.parameters;for(const p in f)f[p]!==void 0&&(e[p]=f[p]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const s=this.attributes;for(const f in s){const p=s[f];e.data.attributes[f]=p.toJSON(e.data)}const o={};let l=!1;for(const f in this.morphAttributes){const p=this.morphAttributes[f],v=[];for(let g=0,y=p.length;g<y;g++){const x=p[g];v.push(x.toJSON(e.data))}v.length>0&&(o[f]=v,l=!0)}l&&(e.data.morphAttributes=o,e.data.morphTargetsRelative=this.morphTargetsRelative);const u=this.groups;u.length>0&&(e.data.groups=JSON.parse(JSON.stringify(u)));const d=this.boundingSphere;return d!==null&&(e.data.boundingSphere=d.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const s=e.index;s!==null&&this.setIndex(s.clone());const o=e.attributes;for(const p in o){const v=o[p];this.setAttribute(p,v.clone(t))}const l=e.morphAttributes;for(const p in l){const v=[],g=l[p];for(let y=0,x=g.length;y<x;y++)v.push(g[y].clone(t));this.morphAttributes[p]=v}this.morphTargetsRelative=e.morphTargetsRelative;const u=e.groups;for(let p=0,v=u.length;p<v;p++){const g=u[p];this.addGroup(g.start,g.count,g.materialIndex)}const d=e.boundingBox;d!==null&&(this.boundingBox=d.clone());const f=e.boundingSphere;return f!==null&&(this.boundingSphere=f.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const lg=new Zt,fs=new A_,uc=new Nf,cg=new Z,dc=new Z,hc=new Z,fc=new Z,ph=new Z,pc=new Z,ug=new Z,mc=new Z;class di extends Jn{constructor(e=new $r,t=new Ba){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,s=Object.keys(t);if(s.length>0){const o=t[s[0]];if(o!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let l=0,u=o.length;l<u;l++){const d=o[l].name||String(l);this.morphTargetInfluences.push(0),this.morphTargetDictionary[d]=l}}}}getVertexPosition(e,t){const s=this.geometry,o=s.attributes.position,l=s.morphAttributes.position,u=s.morphTargetsRelative;t.fromBufferAttribute(o,e);const d=this.morphTargetInfluences;if(l&&d){pc.set(0,0,0);for(let f=0,p=l.length;f<p;f++){const v=d[f],g=l[f];v!==0&&(ph.fromBufferAttribute(g,e),u?pc.addScaledVector(ph,v):pc.addScaledVector(ph.sub(t),v))}t.add(pc)}return t}raycast(e,t){const s=this.geometry,o=this.material,l=this.matrixWorld;o!==void 0&&(s.boundingSphere===null&&s.computeBoundingSphere(),uc.copy(s.boundingSphere),uc.applyMatrix4(l),fs.copy(e.ray).recast(e.near),!(uc.containsPoint(fs.origin)===!1&&(fs.intersectSphere(uc,cg)===null||fs.origin.distanceToSquared(cg)>(e.far-e.near)**2))&&(lg.copy(l).invert(),fs.copy(e.ray).applyMatrix4(lg),!(s.boundingBox!==null&&fs.intersectsBox(s.boundingBox)===!1)&&this._computeIntersections(e,t,fs)))}_computeIntersections(e,t,s){let o;const l=this.geometry,u=this.material,d=l.index,f=l.attributes.position,p=l.attributes.uv,v=l.attributes.uv1,g=l.attributes.normal,y=l.groups,x=l.drawRange;if(d!==null)if(Array.isArray(u))for(let w=0,A=y.length;w<A;w++){const E=y[w],_=u[E.materialIndex],N=Math.max(E.start,x.start),I=Math.min(d.count,Math.min(E.start+E.count,x.start+x.count));for(let R=N,k=I;R<k;R+=3){const B=d.getX(R),H=d.getX(R+1),Y=d.getX(R+2);o=vc(this,_,e,s,p,v,g,B,H,Y),o&&(o.faceIndex=Math.floor(R/3),o.face.materialIndex=E.materialIndex,t.push(o))}}else{const w=Math.max(0,x.start),A=Math.min(d.count,x.start+x.count);for(let E=w,_=A;E<_;E+=3){const N=d.getX(E),I=d.getX(E+1),R=d.getX(E+2);o=vc(this,u,e,s,p,v,g,N,I,R),o&&(o.faceIndex=Math.floor(E/3),t.push(o))}}else if(f!==void 0)if(Array.isArray(u))for(let w=0,A=y.length;w<A;w++){const E=y[w],_=u[E.materialIndex],N=Math.max(E.start,x.start),I=Math.min(f.count,Math.min(E.start+E.count,x.start+x.count));for(let R=N,k=I;R<k;R+=3){const B=R,H=R+1,Y=R+2;o=vc(this,_,e,s,p,v,g,B,H,Y),o&&(o.faceIndex=Math.floor(R/3),o.face.materialIndex=E.materialIndex,t.push(o))}}else{const w=Math.max(0,x.start),A=Math.min(f.count,x.start+x.count);for(let E=w,_=A;E<_;E+=3){const N=E,I=E+1,R=E+2;o=vc(this,u,e,s,p,v,g,N,I,R),o&&(o.faceIndex=Math.floor(E/3),t.push(o))}}}}function QM(n,e,t,s,o,l,u,d){let f;if(e.side===Vn?f=s.intersectTriangle(u,l,o,!0,d):f=s.intersectTriangle(o,l,u,e.side===Wr,d),f===null)return null;mc.copy(d),mc.applyMatrix4(n.matrixWorld);const p=t.ray.origin.distanceTo(mc);return p<t.near||p>t.far?null:{distance:p,point:mc.clone(),object:n}}function vc(n,e,t,s,o,l,u,d,f,p){n.getVertexPosition(d,dc),n.getVertexPosition(f,hc),n.getVertexPosition(p,fc);const v=QM(n,e,t,s,dc,hc,fc,ug);if(v){const g=new Z;Mi.getBarycoord(ug,dc,hc,fc,g),o&&(v.uv=Mi.getInterpolatedAttribute(o,d,f,p,g,new Lt)),l&&(v.uv1=Mi.getInterpolatedAttribute(l,d,f,p,g,new Lt)),u&&(v.normal=Mi.getInterpolatedAttribute(u,d,f,p,g,new Z),v.normal.dot(s.direction)>0&&v.normal.multiplyScalar(-1));const y={a:d,b:f,c:p,normal:new Z,materialIndex:0};Mi.getNormal(dc,hc,fc,y.normal),v.face=y,v.barycoord=g}return v}class Ha extends $r{constructor(e=1,t=1,s=1,o=1,l=1,u=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:s,widthSegments:o,heightSegments:l,depthSegments:u};const d=this;o=Math.floor(o),l=Math.floor(l),u=Math.floor(u);const f=[],p=[],v=[],g=[];let y=0,x=0;w("z","y","x",-1,-1,s,t,e,u,l,0),w("z","y","x",1,-1,s,t,-e,u,l,1),w("x","z","y",1,1,e,s,t,o,u,2),w("x","z","y",1,-1,e,s,-t,o,u,3),w("x","y","z",1,-1,e,t,s,o,l,4),w("x","y","z",-1,-1,e,t,-s,o,l,5),this.setIndex(f),this.setAttribute("position",new ki(p,3)),this.setAttribute("normal",new ki(v,3)),this.setAttribute("uv",new ki(g,2));function w(A,E,_,N,I,R,k,B,H,Y,b){const C=R/H,D=k/Y,de=R/2,ie=k/2,le=B/2,fe=H+1,ce=Y+1;let oe=0,O=0;const ae=new Z;for(let se=0;se<ce;se++){const U=se*D-ie;for(let J=0;J<fe;J++){const Oe=J*C-de;ae[A]=Oe*N,ae[E]=U*I,ae[_]=le,p.push(ae.x,ae.y,ae.z),ae[A]=0,ae[E]=0,ae[_]=B>0?1:-1,v.push(ae.x,ae.y,ae.z),g.push(J/H),g.push(1-se/Y),oe+=1}}for(let se=0;se<Y;se++)for(let U=0;U<H;U++){const J=y+U+fe*se,Oe=y+U+fe*(se+1),Fe=y+(U+1)+fe*(se+1),V=y+(U+1)+fe*se;f.push(J,Oe,V),f.push(Oe,Fe,V),O+=6}d.addGroup(x,O,b),x+=O,y+=oe}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ha(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Co(n){const e={};for(const t in n){e[t]={};for(const s in n[t]){const o=n[t][s];o&&(o.isColor||o.isMatrix3||o.isMatrix4||o.isVector2||o.isVector3||o.isVector4||o.isTexture||o.isQuaternion)?o.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][s]=null):e[t][s]=o.clone():Array.isArray(o)?e[t][s]=o.slice():e[t][s]=o}}return e}function In(n){const e={};for(let t=0;t<n.length;t++){const s=Co(n[t]);for(const o in s)e[o]=s[o]}return e}function JM(n){const e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function P_(n){const e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Mt.workingColorSpace}const ew={clone:Co,merge:In};var tw=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,nw=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class jr extends qc{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=tw,this.fragmentShader=nw,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Co(e.uniforms),this.uniformsGroups=JM(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const o in this.uniforms){const u=this.uniforms[o].value;u&&u.isTexture?t.uniforms[o]={type:"t",value:u.toJSON(e).uuid}:u&&u.isColor?t.uniforms[o]={type:"c",value:u.getHex()}:u&&u.isVector2?t.uniforms[o]={type:"v2",value:u.toArray()}:u&&u.isVector3?t.uniforms[o]={type:"v3",value:u.toArray()}:u&&u.isVector4?t.uniforms[o]={type:"v4",value:u.toArray()}:u&&u.isMatrix3?t.uniforms[o]={type:"m3",value:u.toArray()}:u&&u.isMatrix4?t.uniforms[o]={type:"m4",value:u.toArray()}:t.uniforms[o]={value:u}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const s={};for(const o in this.extensions)this.extensions[o]===!0&&(s[o]=!0);return Object.keys(s).length>0&&(t.extensions=s),t}}class L_ extends Jn{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Zt,this.projectionMatrix=new Zt,this.projectionMatrixInverse=new Zt,this.coordinateSystem=Ni,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Ur=new Z,dg=new Lt,hg=new Lt;class ui extends L_{constructor(e=50,t=1,s=.1,o=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=s,this.far=o,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Oa*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(xa*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Oa*2*Math.atan(Math.tan(xa*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,s){Ur.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Ur.x,Ur.y).multiplyScalar(-e/Ur.z),Ur.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),s.set(Ur.x,Ur.y).multiplyScalar(-e/Ur.z)}getViewSize(e,t){return this.getViewBounds(e,dg,hg),t.subVectors(hg,dg)}setViewOffset(e,t,s,o,l,u){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=s,this.view.offsetY=o,this.view.width=l,this.view.height=u,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(xa*.5*this.fov)/this.zoom,s=2*t,o=this.aspect*s,l=-.5*o;const u=this.view;if(this.view!==null&&this.view.enabled){const f=u.fullWidth,p=u.fullHeight;l+=u.offsetX*o/f,t-=u.offsetY*s/p,o*=u.width/f,s*=u.height/p}const d=this.filmOffset;d!==0&&(l+=e*d/this.getFilmWidth()),this.projectionMatrix.makePerspective(l,l+o,t,t-s,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const uo=-90,ho=1;class iw extends Jn{constructor(e,t,s){super(),this.type="CubeCamera",this.renderTarget=s,this.coordinateSystem=null,this.activeMipmapLevel=0;const o=new ui(uo,ho,e,t);o.layers=this.layers,this.add(o);const l=new ui(uo,ho,e,t);l.layers=this.layers,this.add(l);const u=new ui(uo,ho,e,t);u.layers=this.layers,this.add(u);const d=new ui(uo,ho,e,t);d.layers=this.layers,this.add(d);const f=new ui(uo,ho,e,t);f.layers=this.layers,this.add(f);const p=new ui(uo,ho,e,t);p.layers=this.layers,this.add(p)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[s,o,l,u,d,f]=t;for(const p of t)this.remove(p);if(e===Ni)s.up.set(0,1,0),s.lookAt(1,0,0),o.up.set(0,1,0),o.lookAt(-1,0,0),l.up.set(0,0,-1),l.lookAt(0,1,0),u.up.set(0,0,1),u.lookAt(0,-1,0),d.up.set(0,1,0),d.lookAt(0,0,1),f.up.set(0,1,0),f.lookAt(0,0,-1);else if(e===Bc)s.up.set(0,-1,0),s.lookAt(-1,0,0),o.up.set(0,-1,0),o.lookAt(1,0,0),l.up.set(0,0,1),l.lookAt(0,1,0),u.up.set(0,0,-1),u.lookAt(0,-1,0),d.up.set(0,-1,0),d.lookAt(0,0,1),f.up.set(0,-1,0),f.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const p of t)this.add(p),p.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:s,activeMipmapLevel:o}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[l,u,d,f,p,v]=this.children,g=e.getRenderTarget(),y=e.getActiveCubeFace(),x=e.getActiveMipmapLevel(),w=e.xr.enabled;e.xr.enabled=!1;const A=s.texture.generateMipmaps;s.texture.generateMipmaps=!1,e.setRenderTarget(s,0,o),e.render(t,l),e.setRenderTarget(s,1,o),e.render(t,u),e.setRenderTarget(s,2,o),e.render(t,d),e.setRenderTarget(s,3,o),e.render(t,f),e.setRenderTarget(s,4,o),e.render(t,p),s.texture.generateMipmaps=A,e.setRenderTarget(s,5,o),e.render(t,v),e.setRenderTarget(g,y,x),e.xr.enabled=w,s.texture.needsPMREMUpdate=!0}}class I_ extends Dn{constructor(e=[],t=To,s,o,l,u,d,f,p,v){super(e,t,s,o,l,u,d,f,p,v),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class rw extends Xr{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const s={width:e,height:e,depth:1},o=[s,s,s,s,s,s];this.texture=new I_(o),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const s={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},o=new Ha(5,5,5),l=new jr({name:"CubemapFromEquirect",uniforms:Co(s.uniforms),vertexShader:s.vertexShader,fragmentShader:s.fragmentShader,side:Vn,blending:Fr});l.uniforms.tEquirect.value=t;const u=new di(o,l),d=t.minFilter;return t.minFilter===Or&&(t.minFilter=wi),new iw(1,10,this).update(e,u),t.minFilter=d,u.geometry.dispose(),u.material.dispose(),this}clear(e,t=!0,s=!0,o=!0){const l=e.getRenderTarget();for(let u=0;u<6;u++)e.setRenderTarget(this,u),e.clear(t,s,o);e.setRenderTarget(l)}}class go extends Jn{constructor(){super(),this.isGroup=!0,this.type="Group"}}const sw={type:"move"};class mh{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new go,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new go,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new Z,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new Z),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new go,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new Z,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new Z),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const s of e.hand.values())this._getHandJoint(t,s)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,s){let o=null,l=null,u=null;const d=this._targetRay,f=this._grip,p=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(p&&e.hand){u=!0;for(const A of e.hand.values()){const E=t.getJointPose(A,s),_=this._getHandJoint(p,A);E!==null&&(_.matrix.fromArray(E.transform.matrix),_.matrix.decompose(_.position,_.rotation,_.scale),_.matrixWorldNeedsUpdate=!0,_.jointRadius=E.radius),_.visible=E!==null}const v=p.joints["index-finger-tip"],g=p.joints["thumb-tip"],y=v.position.distanceTo(g.position),x=.02,w=.005;p.inputState.pinching&&y>x+w?(p.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!p.inputState.pinching&&y<=x-w&&(p.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else f!==null&&e.gripSpace&&(l=t.getPose(e.gripSpace,s),l!==null&&(f.matrix.fromArray(l.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,l.linearVelocity?(f.hasLinearVelocity=!0,f.linearVelocity.copy(l.linearVelocity)):f.hasLinearVelocity=!1,l.angularVelocity?(f.hasAngularVelocity=!0,f.angularVelocity.copy(l.angularVelocity)):f.hasAngularVelocity=!1));d!==null&&(o=t.getPose(e.targetRaySpace,s),o===null&&l!==null&&(o=l),o!==null&&(d.matrix.fromArray(o.transform.matrix),d.matrix.decompose(d.position,d.rotation,d.scale),d.matrixWorldNeedsUpdate=!0,o.linearVelocity?(d.hasLinearVelocity=!0,d.linearVelocity.copy(o.linearVelocity)):d.hasLinearVelocity=!1,o.angularVelocity?(d.hasAngularVelocity=!0,d.angularVelocity.copy(o.angularVelocity)):d.hasAngularVelocity=!1,this.dispatchEvent(sw)))}return d!==null&&(d.visible=o!==null),f!==null&&(f.visible=l!==null),p!==null&&(p.visible=u!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const s=new go;s.matrixAutoUpdate=!1,s.visible=!1,e.joints[t.jointName]=s,e.add(s)}return e.joints[t.jointName]}}class fg extends Jn{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new zi,this.environmentIntensity=1,this.environmentRotation=new zi,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}const vh=new Z,ow=new Z,aw=new ut;class gs{constructor(e=new Z(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,s,o){return this.normal.set(e,t,s),this.constant=o,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,s){const o=vh.subVectors(s,t).cross(ow.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(o,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const s=e.delta(vh),o=this.normal.dot(s);if(o===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const l=-(e.start.dot(this.normal)+this.constant)/o;return l<0||l>1?null:t.copy(e.start).addScaledVector(s,l)}intersectsLine(e){const t=this.distanceToPoint(e.start),s=this.distanceToPoint(e.end);return t<0&&s>0||s<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const s=t||aw.getNormalMatrix(e),o=this.coplanarPoint(vh).applyMatrix4(e),l=this.normal.applyMatrix3(s).normalize();return this.constant=-o.dot(l),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const ps=new Nf,lw=new Lt(.5,.5),gc=new Z;class Ff{constructor(e=new gs,t=new gs,s=new gs,o=new gs,l=new gs,u=new gs){this.planes=[e,t,s,o,l,u]}set(e,t,s,o,l,u){const d=this.planes;return d[0].copy(e),d[1].copy(t),d[2].copy(s),d[3].copy(o),d[4].copy(l),d[5].copy(u),this}copy(e){const t=this.planes;for(let s=0;s<6;s++)t[s].copy(e.planes[s]);return this}setFromProjectionMatrix(e,t=Ni,s=!1){const o=this.planes,l=e.elements,u=l[0],d=l[1],f=l[2],p=l[3],v=l[4],g=l[5],y=l[6],x=l[7],w=l[8],A=l[9],E=l[10],_=l[11],N=l[12],I=l[13],R=l[14],k=l[15];if(o[0].setComponents(p-u,x-v,_-w,k-N).normalize(),o[1].setComponents(p+u,x+v,_+w,k+N).normalize(),o[2].setComponents(p+d,x+g,_+A,k+I).normalize(),o[3].setComponents(p-d,x-g,_-A,k-I).normalize(),s)o[4].setComponents(f,y,E,R).normalize(),o[5].setComponents(p-f,x-y,_-E,k-R).normalize();else if(o[4].setComponents(p-f,x-y,_-E,k-R).normalize(),t===Ni)o[5].setComponents(p+f,x+y,_+E,k+R).normalize();else if(t===Bc)o[5].setComponents(f,y,E,R).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),ps.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),ps.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ps)}intersectsSprite(e){ps.center.set(0,0,0);const t=lw.distanceTo(e.center);return ps.radius=.7071067811865476+t,ps.applyMatrix4(e.matrixWorld),this.intersectsSphere(ps)}intersectsSphere(e){const t=this.planes,s=e.center,o=-e.radius;for(let l=0;l<6;l++)if(t[l].distanceToPoint(s)<o)return!1;return!0}intersectsBox(e){const t=this.planes;for(let s=0;s<6;s++){const o=t[s];if(gc.x=o.normal.x>0?e.max.x:e.min.x,gc.y=o.normal.y>0?e.max.y:e.min.y,gc.z=o.normal.z>0?e.max.z:e.min.z,o.distanceToPoint(gc)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let s=0;s<6;s++)if(t[s].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class U_ extends Dn{constructor(e,t,s=ws,o,l,u,d=Ai,f=Ai,p,v=Da,g=1){if(v!==Da&&v!==Na)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const y={width:e,height:t,depth:g};super(y,o,l,u,d,f,v,s,p),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Df(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class Kc extends $r{constructor(e=1,t=1,s=1,o=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:s,heightSegments:o};const l=e/2,u=t/2,d=Math.floor(s),f=Math.floor(o),p=d+1,v=f+1,g=e/d,y=t/f,x=[],w=[],A=[],E=[];for(let _=0;_<v;_++){const N=_*y-u;for(let I=0;I<p;I++){const R=I*g-l;w.push(R,-N,0),A.push(0,0,1),E.push(I/d),E.push(1-_/f)}}for(let _=0;_<f;_++)for(let N=0;N<d;N++){const I=N+p*_,R=N+p*(_+1),k=N+1+p*(_+1),B=N+1+p*_;x.push(I,R,B),x.push(R,k,B)}this.setIndex(x),this.setAttribute("position",new ki(w,3)),this.setAttribute("normal",new ki(A,3)),this.setAttribute("uv",new ki(E,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Kc(e.width,e.height,e.widthSegments,e.heightSegments)}}class Va extends $r{constructor(e=1,t=32,s=16,o=0,l=Math.PI*2,u=0,d=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:s,phiStart:o,phiLength:l,thetaStart:u,thetaLength:d},t=Math.max(3,Math.floor(t)),s=Math.max(2,Math.floor(s));const f=Math.min(u+d,Math.PI);let p=0;const v=[],g=new Z,y=new Z,x=[],w=[],A=[],E=[];for(let _=0;_<=s;_++){const N=[],I=_/s;let R=0;_===0&&u===0?R=.5/t:_===s&&f===Math.PI&&(R=-.5/t);for(let k=0;k<=t;k++){const B=k/t;g.x=-e*Math.cos(o+B*l)*Math.sin(u+I*d),g.y=e*Math.cos(u+I*d),g.z=e*Math.sin(o+B*l)*Math.sin(u+I*d),w.push(g.x,g.y,g.z),y.copy(g).normalize(),A.push(y.x,y.y,y.z),E.push(B+R,1-I),N.push(p++)}v.push(N)}for(let _=0;_<s;_++)for(let N=0;N<t;N++){const I=v[_][N+1],R=v[_][N],k=v[_+1][N],B=v[_+1][N+1];(_!==0||u>0)&&x.push(I,R,B),(_!==s-1||f<Math.PI)&&x.push(R,k,B)}this.setIndex(x),this.setAttribute("position",new ki(w,3)),this.setAttribute("normal",new ki(A,3)),this.setAttribute("uv",new ki(E,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Va(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class cw extends qc{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=aM,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class uw extends qc{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}const zr={enabled:!1,files:{},add:function(n,e){this.enabled!==!1&&(this.files[n]=e)},get:function(n){if(this.enabled!==!1)return this.files[n]},remove:function(n){delete this.files[n]},clear:function(){this.files={}}};class dw{constructor(e,t,s){const o=this;let l=!1,u=0,d=0,f;const p=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=s,this.abortController=new AbortController,this.itemStart=function(v){d++,l===!1&&o.onStart!==void 0&&o.onStart(v,u,d),l=!0},this.itemEnd=function(v){u++,o.onProgress!==void 0&&o.onProgress(v,u,d),u===d&&(l=!1,o.onLoad!==void 0&&o.onLoad())},this.itemError=function(v){o.onError!==void 0&&o.onError(v)},this.resolveURL=function(v){return f?f(v):v},this.setURLModifier=function(v){return f=v,this},this.addHandler=function(v,g){return p.push(v,g),this},this.removeHandler=function(v){const g=p.indexOf(v);return g!==-1&&p.splice(g,2),this},this.getHandler=function(v){for(let g=0,y=p.length;g<y;g+=2){const x=p[g],w=p[g+1];if(x.global&&(x.lastIndex=0),x.test(v))return w}return null},this.abort=function(){return this.abortController.abort(),this.abortController=new AbortController,this}}}const hw=new dw;let kf=class{constructor(e){this.manager=e!==void 0?e:hw,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){const s=this;return new Promise(function(o,l){s.load(e,o,t,l)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};kf.DEFAULT_MATERIAL_NAME="__DEFAULT";const tr={};class fw extends Error{constructor(e,t){super(e),this.response=t}}class pw extends kf{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,s,o){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const l=zr.get(`file:${e}`);if(l!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(l),this.manager.itemEnd(e)},0),l;if(tr[e]!==void 0){tr[e].push({onLoad:t,onProgress:s,onError:o});return}tr[e]=[],tr[e].push({onLoad:t,onProgress:s,onError:o});const u=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),d=this.mimeType,f=this.responseType;fetch(u).then(p=>{if(p.status===200||p.status===0){if(p.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||p.body===void 0||p.body.getReader===void 0)return p;const v=tr[e],g=p.body.getReader(),y=p.headers.get("X-File-Size")||p.headers.get("Content-Length"),x=y?parseInt(y):0,w=x!==0;let A=0;const E=new ReadableStream({start(_){N();function N(){g.read().then(({done:I,value:R})=>{if(I)_.close();else{A+=R.byteLength;const k=new ProgressEvent("progress",{lengthComputable:w,loaded:A,total:x});for(let B=0,H=v.length;B<H;B++){const Y=v[B];Y.onProgress&&Y.onProgress(k)}_.enqueue(R),N()}},I=>{_.error(I)})}}});return new Response(E)}else throw new fw(`fetch for "${p.url}" responded with ${p.status}: ${p.statusText}`,p)}).then(p=>{switch(f){case"arraybuffer":return p.arrayBuffer();case"blob":return p.blob();case"document":return p.text().then(v=>new DOMParser().parseFromString(v,d));case"json":return p.json();default:if(d==="")return p.text();{const g=/charset="?([^;"\s]*)"?/i.exec(d),y=g&&g[1]?g[1].toLowerCase():void 0,x=new TextDecoder(y);return p.arrayBuffer().then(w=>x.decode(w))}}}).then(p=>{zr.add(`file:${e}`,p);const v=tr[e];delete tr[e];for(let g=0,y=v.length;g<y;g++){const x=v[g];x.onLoad&&x.onLoad(p)}}).catch(p=>{const v=tr[e];if(v===void 0)throw this.manager.itemError(e),p;delete tr[e];for(let g=0,y=v.length;g<y;g++){const x=v[g];x.onError&&x.onError(p)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}const fo=new WeakMap;class mw extends kf{constructor(e){super(e)}load(e,t,s,o){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const l=this,u=zr.get(`image:${e}`);if(u!==void 0){if(u.complete===!0)l.manager.itemStart(e),setTimeout(function(){t&&t(u),l.manager.itemEnd(e)},0);else{let g=fo.get(u);g===void 0&&(g=[],fo.set(u,g)),g.push({onLoad:t,onError:o})}return u}const d=Fa("img");function f(){v(),t&&t(this);const g=fo.get(this)||[];for(let y=0;y<g.length;y++){const x=g[y];x.onLoad&&x.onLoad(this)}fo.delete(this),l.manager.itemEnd(e)}function p(g){v(),o&&o(g),zr.remove(`image:${e}`);const y=fo.get(this)||[];for(let x=0;x<y.length;x++){const w=y[x];w.onError&&w.onError(g)}fo.delete(this),l.manager.itemError(e),l.manager.itemEnd(e)}function v(){d.removeEventListener("load",f,!1),d.removeEventListener("error",p,!1)}return d.addEventListener("load",f,!1),d.addEventListener("error",p,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(d.crossOrigin=this.crossOrigin),zr.add(`image:${e}`,d),l.manager.itemStart(e),d.src=e,d}}class vw extends L_{constructor(e=-1,t=1,s=1,o=-1,l=.1,u=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=s,this.bottom=o,this.near=l,this.far=u,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,s,o,l,u){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=s,this.view.offsetY=o,this.view.width=l,this.view.height=u,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),s=(this.right+this.left)/2,o=(this.top+this.bottom)/2;let l=s-e,u=s+e,d=o+t,f=o-t;if(this.view!==null&&this.view.enabled){const p=(this.right-this.left)/this.view.fullWidth/this.zoom,v=(this.top-this.bottom)/this.view.fullHeight/this.zoom;l+=p*this.view.offsetX,u=l+p*this.view.width,d-=v*this.view.offsetY,f=d-v*this.view.height}this.projectionMatrix.makeOrthographic(l,u,d,f,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class gw extends ui{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}const pg=new Zt;class _w{constructor(e,t,s=0,o=1/0){this.ray=new A_(e,t),this.near=s,this.far=o,this.camera=null,this.layers=new Of,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return pg.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(pg),this}intersectObject(e,t=!0,s=[]){return hf(e,this,s,t),s.sort(mg),s}intersectObjects(e,t=!0,s=[]){for(let o=0,l=e.length;o<l;o++)hf(e[o],this,s,t);return s.sort(mg),s}}function mg(n,e){return n.distance-e.distance}function hf(n,e,t,s){let o=!0;if(n.layers.test(e.layers)&&n.raycast(e,t)===!1&&(o=!1),o===!0&&s===!0){const l=n.children;for(let u=0,d=l.length;u<d;u++)hf(l[u],e,t,!0)}}function vg(n,e,t,s){const o=yw(s);switch(t){case __:return n*e;case x_:return n*e/o.components*o.byteLength;case Pf:return n*e/o.components*o.byteLength;case E_:return n*e*2/o.components*o.byteLength;case Lf:return n*e*2/o.components*o.byteLength;case y_:return n*e*3/o.components*o.byteLength;case Ti:return n*e*4/o.components*o.byteLength;case If:return n*e*4/o.components*o.byteLength;case Cc:case Rc:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case bc:case Pc:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Bh:case Vh:return Math.max(n,16)*Math.max(e,8)/4;case zh:case Hh:return Math.max(n,8)*Math.max(e,8)/2;case Gh:case Wh:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Xh:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case jh:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Yh:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case $h:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case qh:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case Kh:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case Zh:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case Qh:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case Jh:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case ef:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case tf:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case nf:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case rf:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case sf:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case of:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Lc:case af:case lf:return Math.ceil(n/4)*Math.ceil(e/4)*16;case S_:case cf:return Math.ceil(n/4)*Math.ceil(e/4)*8;case uf:case df:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function yw(n){switch(n){case ar:case m_:return{byteLength:1,components:1};case Ia:case v_:case za:return{byteLength:2,components:1};case Rf:case bf:return{byteLength:2,components:4};case ws:case Cf:case rr:return{byteLength:4,components:1};case g_:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Af}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Af);/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function D_(){let n=null,e=!1,t=null,s=null;function o(l,u){t(l,u),s=n.requestAnimationFrame(o)}return{start:function(){e!==!0&&t!==null&&(s=n.requestAnimationFrame(o),e=!0)},stop:function(){n.cancelAnimationFrame(s),e=!1},setAnimationLoop:function(l){t=l},setContext:function(l){n=l}}}function xw(n){const e=new WeakMap;function t(d,f){const p=d.array,v=d.usage,g=p.byteLength,y=n.createBuffer();n.bindBuffer(f,y),n.bufferData(f,p,v),d.onUploadCallback();let x;if(p instanceof Float32Array)x=n.FLOAT;else if(typeof Float16Array<"u"&&p instanceof Float16Array)x=n.HALF_FLOAT;else if(p instanceof Uint16Array)d.isFloat16BufferAttribute?x=n.HALF_FLOAT:x=n.UNSIGNED_SHORT;else if(p instanceof Int16Array)x=n.SHORT;else if(p instanceof Uint32Array)x=n.UNSIGNED_INT;else if(p instanceof Int32Array)x=n.INT;else if(p instanceof Int8Array)x=n.BYTE;else if(p instanceof Uint8Array)x=n.UNSIGNED_BYTE;else if(p instanceof Uint8ClampedArray)x=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+p);return{buffer:y,type:x,bytesPerElement:p.BYTES_PER_ELEMENT,version:d.version,size:g}}function s(d,f,p){const v=f.array,g=f.updateRanges;if(n.bindBuffer(p,d),g.length===0)n.bufferSubData(p,0,v);else{g.sort((x,w)=>x.start-w.start);let y=0;for(let x=1;x<g.length;x++){const w=g[y],A=g[x];A.start<=w.start+w.count+1?w.count=Math.max(w.count,A.start+A.count-w.start):(++y,g[y]=A)}g.length=y+1;for(let x=0,w=g.length;x<w;x++){const A=g[x];n.bufferSubData(p,A.start*v.BYTES_PER_ELEMENT,v,A.start,A.count)}f.clearUpdateRanges()}f.onUploadCallback()}function o(d){return d.isInterleavedBufferAttribute&&(d=d.data),e.get(d)}function l(d){d.isInterleavedBufferAttribute&&(d=d.data);const f=e.get(d);f&&(n.deleteBuffer(f.buffer),e.delete(d))}function u(d,f){if(d.isInterleavedBufferAttribute&&(d=d.data),d.isGLBufferAttribute){const v=e.get(d);(!v||v.version<d.version)&&e.set(d,{buffer:d.buffer,type:d.type,bytesPerElement:d.elementSize,version:d.version});return}const p=e.get(d);if(p===void 0)e.set(d,t(d,f));else if(p.version<d.version){if(p.size!==d.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");s(p.buffer,d,f),p.version=d.version}}return{get:o,remove:l,update:u}}var Ew=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Sw=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Mw=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,ww=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Tw=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Aw=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Cw=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Rw=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,bw=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Pw=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Lw=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Iw=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Uw=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Dw=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Nw=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Ow=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Fw=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,kw=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,zw=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Bw=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Hw=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Vw=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Gw=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Ww=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Xw=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,jw=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Yw=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,$w=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,qw=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Kw=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Zw="gl_FragColor = linearToOutputTexel( gl_FragColor );",Qw=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Jw=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,eT=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,tT=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,nT=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,iT=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,rT=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,sT=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,oT=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,aT=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,lT=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,cT=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,uT=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,dT=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,hT=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,fT=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,pT=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,mT=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,vT=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,gT=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,_T=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,yT=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,xT=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,ET=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,ST=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,MT=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,wT=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,TT=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,AT=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,CT=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,RT=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,bT=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,PT=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,LT=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,IT=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,UT=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,DT=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,NT=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,OT=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,FT=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,kT=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,zT=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,BT=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,HT=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,VT=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,GT=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,WT=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,XT=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,jT=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,YT=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,$T=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,qT=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,KT=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,ZT=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,QT=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,JT=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,e1=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,t1=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,n1=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSEDEPTHBUF
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSEDEPTHBUF
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare , distribution.x );
		#endif
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,i1=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,r1=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,s1=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,o1=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,a1=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,l1=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,c1=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,u1=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,d1=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,h1=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,f1=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,p1=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,m1=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,v1=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,g1=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,_1=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,y1=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const x1=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,E1=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,S1=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,M1=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,w1=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,T1=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,A1=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,C1=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSEDEPTHBUF
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,R1=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,b1=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,P1=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,L1=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,I1=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,U1=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,D1=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,N1=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,O1=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,F1=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,k1=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,z1=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,B1=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,H1=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,V1=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,G1=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,W1=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,X1=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,j1=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Y1=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,$1=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,q1=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,K1=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Z1=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Q1=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,J1=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,dt={alphahash_fragment:Ew,alphahash_pars_fragment:Sw,alphamap_fragment:Mw,alphamap_pars_fragment:ww,alphatest_fragment:Tw,alphatest_pars_fragment:Aw,aomap_fragment:Cw,aomap_pars_fragment:Rw,batching_pars_vertex:bw,batching_vertex:Pw,begin_vertex:Lw,beginnormal_vertex:Iw,bsdfs:Uw,iridescence_fragment:Dw,bumpmap_pars_fragment:Nw,clipping_planes_fragment:Ow,clipping_planes_pars_fragment:Fw,clipping_planes_pars_vertex:kw,clipping_planes_vertex:zw,color_fragment:Bw,color_pars_fragment:Hw,color_pars_vertex:Vw,color_vertex:Gw,common:Ww,cube_uv_reflection_fragment:Xw,defaultnormal_vertex:jw,displacementmap_pars_vertex:Yw,displacementmap_vertex:$w,emissivemap_fragment:qw,emissivemap_pars_fragment:Kw,colorspace_fragment:Zw,colorspace_pars_fragment:Qw,envmap_fragment:Jw,envmap_common_pars_fragment:eT,envmap_pars_fragment:tT,envmap_pars_vertex:nT,envmap_physical_pars_fragment:fT,envmap_vertex:iT,fog_vertex:rT,fog_pars_vertex:sT,fog_fragment:oT,fog_pars_fragment:aT,gradientmap_pars_fragment:lT,lightmap_pars_fragment:cT,lights_lambert_fragment:uT,lights_lambert_pars_fragment:dT,lights_pars_begin:hT,lights_toon_fragment:pT,lights_toon_pars_fragment:mT,lights_phong_fragment:vT,lights_phong_pars_fragment:gT,lights_physical_fragment:_T,lights_physical_pars_fragment:yT,lights_fragment_begin:xT,lights_fragment_maps:ET,lights_fragment_end:ST,logdepthbuf_fragment:MT,logdepthbuf_pars_fragment:wT,logdepthbuf_pars_vertex:TT,logdepthbuf_vertex:AT,map_fragment:CT,map_pars_fragment:RT,map_particle_fragment:bT,map_particle_pars_fragment:PT,metalnessmap_fragment:LT,metalnessmap_pars_fragment:IT,morphinstance_vertex:UT,morphcolor_vertex:DT,morphnormal_vertex:NT,morphtarget_pars_vertex:OT,morphtarget_vertex:FT,normal_fragment_begin:kT,normal_fragment_maps:zT,normal_pars_fragment:BT,normal_pars_vertex:HT,normal_vertex:VT,normalmap_pars_fragment:GT,clearcoat_normal_fragment_begin:WT,clearcoat_normal_fragment_maps:XT,clearcoat_pars_fragment:jT,iridescence_pars_fragment:YT,opaque_fragment:$T,packing:qT,premultiplied_alpha_fragment:KT,project_vertex:ZT,dithering_fragment:QT,dithering_pars_fragment:JT,roughnessmap_fragment:e1,roughnessmap_pars_fragment:t1,shadowmap_pars_fragment:n1,shadowmap_pars_vertex:i1,shadowmap_vertex:r1,shadowmask_pars_fragment:s1,skinbase_vertex:o1,skinning_pars_vertex:a1,skinning_vertex:l1,skinnormal_vertex:c1,specularmap_fragment:u1,specularmap_pars_fragment:d1,tonemapping_fragment:h1,tonemapping_pars_fragment:f1,transmission_fragment:p1,transmission_pars_fragment:m1,uv_pars_fragment:v1,uv_pars_vertex:g1,uv_vertex:_1,worldpos_vertex:y1,background_vert:x1,background_frag:E1,backgroundCube_vert:S1,backgroundCube_frag:M1,cube_vert:w1,cube_frag:T1,depth_vert:A1,depth_frag:C1,distanceRGBA_vert:R1,distanceRGBA_frag:b1,equirect_vert:P1,equirect_frag:L1,linedashed_vert:I1,linedashed_frag:U1,meshbasic_vert:D1,meshbasic_frag:N1,meshlambert_vert:O1,meshlambert_frag:F1,meshmatcap_vert:k1,meshmatcap_frag:z1,meshnormal_vert:B1,meshnormal_frag:H1,meshphong_vert:V1,meshphong_frag:G1,meshphysical_vert:W1,meshphysical_frag:X1,meshtoon_vert:j1,meshtoon_frag:Y1,points_vert:$1,points_frag:q1,shadow_vert:K1,shadow_frag:Z1,sprite_vert:Q1,sprite_frag:J1},Pe={common:{diffuse:{value:new Dt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new ut},alphaMap:{value:null},alphaMapTransform:{value:new ut},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new ut}},envmap:{envMap:{value:null},envMapRotation:{value:new ut},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new ut}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new ut}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new ut},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new ut},normalScale:{value:new Lt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new ut},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new ut}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new ut}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new ut}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Dt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Dt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new ut},alphaTest:{value:0},uvTransform:{value:new ut}},sprite:{diffuse:{value:new Dt(16777215)},opacity:{value:1},center:{value:new Lt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new ut},alphaMap:{value:null},alphaMapTransform:{value:new ut},alphaTest:{value:0}}},Di={basic:{uniforms:In([Pe.common,Pe.specularmap,Pe.envmap,Pe.aomap,Pe.lightmap,Pe.fog]),vertexShader:dt.meshbasic_vert,fragmentShader:dt.meshbasic_frag},lambert:{uniforms:In([Pe.common,Pe.specularmap,Pe.envmap,Pe.aomap,Pe.lightmap,Pe.emissivemap,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,Pe.fog,Pe.lights,{emissive:{value:new Dt(0)}}]),vertexShader:dt.meshlambert_vert,fragmentShader:dt.meshlambert_frag},phong:{uniforms:In([Pe.common,Pe.specularmap,Pe.envmap,Pe.aomap,Pe.lightmap,Pe.emissivemap,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,Pe.fog,Pe.lights,{emissive:{value:new Dt(0)},specular:{value:new Dt(1118481)},shininess:{value:30}}]),vertexShader:dt.meshphong_vert,fragmentShader:dt.meshphong_frag},standard:{uniforms:In([Pe.common,Pe.envmap,Pe.aomap,Pe.lightmap,Pe.emissivemap,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,Pe.roughnessmap,Pe.metalnessmap,Pe.fog,Pe.lights,{emissive:{value:new Dt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:dt.meshphysical_vert,fragmentShader:dt.meshphysical_frag},toon:{uniforms:In([Pe.common,Pe.aomap,Pe.lightmap,Pe.emissivemap,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,Pe.gradientmap,Pe.fog,Pe.lights,{emissive:{value:new Dt(0)}}]),vertexShader:dt.meshtoon_vert,fragmentShader:dt.meshtoon_frag},matcap:{uniforms:In([Pe.common,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,Pe.fog,{matcap:{value:null}}]),vertexShader:dt.meshmatcap_vert,fragmentShader:dt.meshmatcap_frag},points:{uniforms:In([Pe.points,Pe.fog]),vertexShader:dt.points_vert,fragmentShader:dt.points_frag},dashed:{uniforms:In([Pe.common,Pe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:dt.linedashed_vert,fragmentShader:dt.linedashed_frag},depth:{uniforms:In([Pe.common,Pe.displacementmap]),vertexShader:dt.depth_vert,fragmentShader:dt.depth_frag},normal:{uniforms:In([Pe.common,Pe.bumpmap,Pe.normalmap,Pe.displacementmap,{opacity:{value:1}}]),vertexShader:dt.meshnormal_vert,fragmentShader:dt.meshnormal_frag},sprite:{uniforms:In([Pe.sprite,Pe.fog]),vertexShader:dt.sprite_vert,fragmentShader:dt.sprite_frag},background:{uniforms:{uvTransform:{value:new ut},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:dt.background_vert,fragmentShader:dt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new ut}},vertexShader:dt.backgroundCube_vert,fragmentShader:dt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:dt.cube_vert,fragmentShader:dt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:dt.equirect_vert,fragmentShader:dt.equirect_frag},distanceRGBA:{uniforms:In([Pe.common,Pe.displacementmap,{referencePosition:{value:new Z},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:dt.distanceRGBA_vert,fragmentShader:dt.distanceRGBA_frag},shadow:{uniforms:In([Pe.lights,Pe.fog,{color:{value:new Dt(0)},opacity:{value:1}}]),vertexShader:dt.shadow_vert,fragmentShader:dt.shadow_frag}};Di.physical={uniforms:In([Di.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new ut},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new ut},clearcoatNormalScale:{value:new Lt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new ut},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new ut},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new ut},sheen:{value:0},sheenColor:{value:new Dt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new ut},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new ut},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new ut},transmissionSamplerSize:{value:new Lt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new ut},attenuationDistance:{value:0},attenuationColor:{value:new Dt(0)},specularColor:{value:new Dt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new ut},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new ut},anisotropyVector:{value:new Lt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new ut}}]),vertexShader:dt.meshphysical_vert,fragmentShader:dt.meshphysical_frag};const _c={r:0,b:0,g:0},ms=new zi,eA=new Zt;function tA(n,e,t,s,o,l,u){const d=new Dt(0);let f=l===!0?0:1,p,v,g=null,y=0,x=null;function w(I){let R=I.isScene===!0?I.background:null;return R&&R.isTexture&&(R=(I.backgroundBlurriness>0?t:e).get(R)),R}function A(I){let R=!1;const k=w(I);k===null?_(d,f):k&&k.isColor&&(_(k,1),R=!0);const B=n.xr.getEnvironmentBlendMode();B==="additive"?s.buffers.color.setClear(0,0,0,1,u):B==="alpha-blend"&&s.buffers.color.setClear(0,0,0,0,u),(n.autoClear||R)&&(s.buffers.depth.setTest(!0),s.buffers.depth.setMask(!0),s.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function E(I,R){const k=w(R);k&&(k.isCubeTexture||k.mapping===$c)?(v===void 0&&(v=new di(new Ha(1,1,1),new jr({name:"BackgroundCubeMaterial",uniforms:Co(Di.backgroundCube.uniforms),vertexShader:Di.backgroundCube.vertexShader,fragmentShader:Di.backgroundCube.fragmentShader,side:Vn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),v.geometry.deleteAttribute("normal"),v.geometry.deleteAttribute("uv"),v.onBeforeRender=function(B,H,Y){this.matrixWorld.copyPosition(Y.matrixWorld)},Object.defineProperty(v.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),o.update(v)),ms.copy(R.backgroundRotation),ms.x*=-1,ms.y*=-1,ms.z*=-1,k.isCubeTexture&&k.isRenderTargetTexture===!1&&(ms.y*=-1,ms.z*=-1),v.material.uniforms.envMap.value=k,v.material.uniforms.flipEnvMap.value=k.isCubeTexture&&k.isRenderTargetTexture===!1?-1:1,v.material.uniforms.backgroundBlurriness.value=R.backgroundBlurriness,v.material.uniforms.backgroundIntensity.value=R.backgroundIntensity,v.material.uniforms.backgroundRotation.value.setFromMatrix4(eA.makeRotationFromEuler(ms)),v.material.toneMapped=Mt.getTransfer(k.colorSpace)!==Ut,(g!==k||y!==k.version||x!==n.toneMapping)&&(v.material.needsUpdate=!0,g=k,y=k.version,x=n.toneMapping),v.layers.enableAll(),I.unshift(v,v.geometry,v.material,0,0,null)):k&&k.isTexture&&(p===void 0&&(p=new di(new Kc(2,2),new jr({name:"BackgroundMaterial",uniforms:Co(Di.background.uniforms),vertexShader:Di.background.vertexShader,fragmentShader:Di.background.fragmentShader,side:Wr,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),p.geometry.deleteAttribute("normal"),Object.defineProperty(p.material,"map",{get:function(){return this.uniforms.t2D.value}}),o.update(p)),p.material.uniforms.t2D.value=k,p.material.uniforms.backgroundIntensity.value=R.backgroundIntensity,p.material.toneMapped=Mt.getTransfer(k.colorSpace)!==Ut,k.matrixAutoUpdate===!0&&k.updateMatrix(),p.material.uniforms.uvTransform.value.copy(k.matrix),(g!==k||y!==k.version||x!==n.toneMapping)&&(p.material.needsUpdate=!0,g=k,y=k.version,x=n.toneMapping),p.layers.enableAll(),I.unshift(p,p.geometry,p.material,0,0,null))}function _(I,R){I.getRGB(_c,P_(n)),s.buffers.color.setClear(_c.r,_c.g,_c.b,R,u)}function N(){v!==void 0&&(v.geometry.dispose(),v.material.dispose(),v=void 0),p!==void 0&&(p.geometry.dispose(),p.material.dispose(),p=void 0)}return{getClearColor:function(){return d},setClearColor:function(I,R=1){d.set(I),f=R,_(d,f)},getClearAlpha:function(){return f},setClearAlpha:function(I){f=I,_(d,f)},render:A,addToRenderList:E,dispose:N}}function nA(n,e){const t=n.getParameter(n.MAX_VERTEX_ATTRIBS),s={},o=y(null);let l=o,u=!1;function d(C,D,de,ie,le){let fe=!1;const ce=g(ie,de,D);l!==ce&&(l=ce,p(l.object)),fe=x(C,ie,de,le),fe&&w(C,ie,de,le),le!==null&&e.update(le,n.ELEMENT_ARRAY_BUFFER),(fe||u)&&(u=!1,R(C,D,de,ie),le!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(le).buffer))}function f(){return n.createVertexArray()}function p(C){return n.bindVertexArray(C)}function v(C){return n.deleteVertexArray(C)}function g(C,D,de){const ie=de.wireframe===!0;let le=s[C.id];le===void 0&&(le={},s[C.id]=le);let fe=le[D.id];fe===void 0&&(fe={},le[D.id]=fe);let ce=fe[ie];return ce===void 0&&(ce=y(f()),fe[ie]=ce),ce}function y(C){const D=[],de=[],ie=[];for(let le=0;le<t;le++)D[le]=0,de[le]=0,ie[le]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:de,attributeDivisors:ie,object:C,attributes:{},index:null}}function x(C,D,de,ie){const le=l.attributes,fe=D.attributes;let ce=0;const oe=de.getAttributes();for(const O in oe)if(oe[O].location>=0){const se=le[O];let U=fe[O];if(U===void 0&&(O==="instanceMatrix"&&C.instanceMatrix&&(U=C.instanceMatrix),O==="instanceColor"&&C.instanceColor&&(U=C.instanceColor)),se===void 0||se.attribute!==U||U&&se.data!==U.data)return!0;ce++}return l.attributesNum!==ce||l.index!==ie}function w(C,D,de,ie){const le={},fe=D.attributes;let ce=0;const oe=de.getAttributes();for(const O in oe)if(oe[O].location>=0){let se=fe[O];se===void 0&&(O==="instanceMatrix"&&C.instanceMatrix&&(se=C.instanceMatrix),O==="instanceColor"&&C.instanceColor&&(se=C.instanceColor));const U={};U.attribute=se,se&&se.data&&(U.data=se.data),le[O]=U,ce++}l.attributes=le,l.attributesNum=ce,l.index=ie}function A(){const C=l.newAttributes;for(let D=0,de=C.length;D<de;D++)C[D]=0}function E(C){_(C,0)}function _(C,D){const de=l.newAttributes,ie=l.enabledAttributes,le=l.attributeDivisors;de[C]=1,ie[C]===0&&(n.enableVertexAttribArray(C),ie[C]=1),le[C]!==D&&(n.vertexAttribDivisor(C,D),le[C]=D)}function N(){const C=l.newAttributes,D=l.enabledAttributes;for(let de=0,ie=D.length;de<ie;de++)D[de]!==C[de]&&(n.disableVertexAttribArray(de),D[de]=0)}function I(C,D,de,ie,le,fe,ce){ce===!0?n.vertexAttribIPointer(C,D,de,le,fe):n.vertexAttribPointer(C,D,de,ie,le,fe)}function R(C,D,de,ie){A();const le=ie.attributes,fe=de.getAttributes(),ce=D.defaultAttributeValues;for(const oe in fe){const O=fe[oe];if(O.location>=0){let ae=le[oe];if(ae===void 0&&(oe==="instanceMatrix"&&C.instanceMatrix&&(ae=C.instanceMatrix),oe==="instanceColor"&&C.instanceColor&&(ae=C.instanceColor)),ae!==void 0){const se=ae.normalized,U=ae.itemSize,J=e.get(ae);if(J===void 0)continue;const Oe=J.buffer,Fe=J.type,V=J.bytesPerElement,re=Fe===n.INT||Fe===n.UNSIGNED_INT||ae.gpuType===Cf;if(ae.isInterleavedBufferAttribute){const ne=ae.data,_e=ne.stride,Ae=ae.offset;if(ne.isInstancedInterleavedBuffer){for(let Ie=0;Ie<O.locationSize;Ie++)_(O.location+Ie,ne.meshPerAttribute);C.isInstancedMesh!==!0&&ie._maxInstanceCount===void 0&&(ie._maxInstanceCount=ne.meshPerAttribute*ne.count)}else for(let Ie=0;Ie<O.locationSize;Ie++)E(O.location+Ie);n.bindBuffer(n.ARRAY_BUFFER,Oe);for(let Ie=0;Ie<O.locationSize;Ie++)I(O.location+Ie,U/O.locationSize,Fe,se,_e*V,(Ae+U/O.locationSize*Ie)*V,re)}else{if(ae.isInstancedBufferAttribute){for(let ne=0;ne<O.locationSize;ne++)_(O.location+ne,ae.meshPerAttribute);C.isInstancedMesh!==!0&&ie._maxInstanceCount===void 0&&(ie._maxInstanceCount=ae.meshPerAttribute*ae.count)}else for(let ne=0;ne<O.locationSize;ne++)E(O.location+ne);n.bindBuffer(n.ARRAY_BUFFER,Oe);for(let ne=0;ne<O.locationSize;ne++)I(O.location+ne,U/O.locationSize,Fe,se,U*V,U/O.locationSize*ne*V,re)}}else if(ce!==void 0){const se=ce[oe];if(se!==void 0)switch(se.length){case 2:n.vertexAttrib2fv(O.location,se);break;case 3:n.vertexAttrib3fv(O.location,se);break;case 4:n.vertexAttrib4fv(O.location,se);break;default:n.vertexAttrib1fv(O.location,se)}}}}N()}function k(){Y();for(const C in s){const D=s[C];for(const de in D){const ie=D[de];for(const le in ie)v(ie[le].object),delete ie[le];delete D[de]}delete s[C]}}function B(C){if(s[C.id]===void 0)return;const D=s[C.id];for(const de in D){const ie=D[de];for(const le in ie)v(ie[le].object),delete ie[le];delete D[de]}delete s[C.id]}function H(C){for(const D in s){const de=s[D];if(de[C.id]===void 0)continue;const ie=de[C.id];for(const le in ie)v(ie[le].object),delete ie[le];delete de[C.id]}}function Y(){b(),u=!0,l!==o&&(l=o,p(l.object))}function b(){o.geometry=null,o.program=null,o.wireframe=!1}return{setup:d,reset:Y,resetDefaultState:b,dispose:k,releaseStatesOfGeometry:B,releaseStatesOfProgram:H,initAttributes:A,enableAttribute:E,disableUnusedAttributes:N}}function iA(n,e,t){let s;function o(p){s=p}function l(p,v){n.drawArrays(s,p,v),t.update(v,s,1)}function u(p,v,g){g!==0&&(n.drawArraysInstanced(s,p,v,g),t.update(v,s,g))}function d(p,v,g){if(g===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(s,p,0,v,0,g);let x=0;for(let w=0;w<g;w++)x+=v[w];t.update(x,s,1)}function f(p,v,g,y){if(g===0)return;const x=e.get("WEBGL_multi_draw");if(x===null)for(let w=0;w<p.length;w++)u(p[w],v[w],y[w]);else{x.multiDrawArraysInstancedWEBGL(s,p,0,v,0,y,0,g);let w=0;for(let A=0;A<g;A++)w+=v[A]*y[A];t.update(w,s,1)}}this.setMode=o,this.render=l,this.renderInstances=u,this.renderMultiDraw=d,this.renderMultiDrawInstances=f}function rA(n,e,t,s){let o;function l(){if(o!==void 0)return o;if(e.has("EXT_texture_filter_anisotropic")===!0){const H=e.get("EXT_texture_filter_anisotropic");o=n.getParameter(H.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else o=0;return o}function u(H){return!(H!==Ti&&s.convert(H)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function d(H){const Y=H===za&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(H!==ar&&s.convert(H)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&H!==rr&&!Y)}function f(H){if(H==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";H="mediump"}return H==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let p=t.precision!==void 0?t.precision:"highp";const v=f(p);v!==p&&(console.warn("THREE.WebGLRenderer:",p,"not supported, using",v,"instead."),p=v);const g=t.logarithmicDepthBuffer===!0,y=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),x=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),w=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),A=n.getParameter(n.MAX_TEXTURE_SIZE),E=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),_=n.getParameter(n.MAX_VERTEX_ATTRIBS),N=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),I=n.getParameter(n.MAX_VARYING_VECTORS),R=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),k=w>0,B=n.getParameter(n.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:l,getMaxPrecision:f,textureFormatReadable:u,textureTypeReadable:d,precision:p,logarithmicDepthBuffer:g,reversedDepthBuffer:y,maxTextures:x,maxVertexTextures:w,maxTextureSize:A,maxCubemapSize:E,maxAttributes:_,maxVertexUniforms:N,maxVaryings:I,maxFragmentUniforms:R,vertexTextures:k,maxSamples:B}}function sA(n){const e=this;let t=null,s=0,o=!1,l=!1;const u=new gs,d=new ut,f={value:null,needsUpdate:!1};this.uniform=f,this.numPlanes=0,this.numIntersection=0,this.init=function(g,y){const x=g.length!==0||y||s!==0||o;return o=y,s=g.length,x},this.beginShadows=function(){l=!0,v(null)},this.endShadows=function(){l=!1},this.setGlobalState=function(g,y){t=v(g,y,0)},this.setState=function(g,y,x){const w=g.clippingPlanes,A=g.clipIntersection,E=g.clipShadows,_=n.get(g);if(!o||w===null||w.length===0||l&&!E)l?v(null):p();else{const N=l?0:s,I=N*4;let R=_.clippingState||null;f.value=R,R=v(w,y,I,x);for(let k=0;k!==I;++k)R[k]=t[k];_.clippingState=R,this.numIntersection=A?this.numPlanes:0,this.numPlanes+=N}};function p(){f.value!==t&&(f.value=t,f.needsUpdate=s>0),e.numPlanes=s,e.numIntersection=0}function v(g,y,x,w){const A=g!==null?g.length:0;let E=null;if(A!==0){if(E=f.value,w!==!0||E===null){const _=x+A*4,N=y.matrixWorldInverse;d.getNormalMatrix(N),(E===null||E.length<_)&&(E=new Float32Array(_));for(let I=0,R=x;I!==A;++I,R+=4)u.copy(g[I]).applyMatrix4(N,d),u.normal.toArray(E,R),E[R+3]=u.constant}f.value=E,f.needsUpdate=!0}return e.numPlanes=A,e.numIntersection=0,E}}function oA(n){let e=new WeakMap;function t(u,d){return d===Nh?u.mapping=To:d===Oh&&(u.mapping=Ao),u}function s(u){if(u&&u.isTexture){const d=u.mapping;if(d===Nh||d===Oh)if(e.has(u)){const f=e.get(u).texture;return t(f,u.mapping)}else{const f=u.image;if(f&&f.height>0){const p=new rw(f.height);return p.fromEquirectangularTexture(n,u),e.set(u,p),u.addEventListener("dispose",o),t(p.texture,u.mapping)}else return null}}return u}function o(u){const d=u.target;d.removeEventListener("dispose",o);const f=e.get(d);f!==void 0&&(e.delete(d),f.dispose())}function l(){e=new WeakMap}return{get:s,dispose:l}}const _o=4,gg=[.125,.215,.35,.446,.526,.582],Es=20,gh=new vw,_g=new Dt;let _h=null,yh=0,xh=0,Eh=!1;const _s=(1+Math.sqrt(5))/2,po=1/_s,yg=[new Z(-_s,po,0),new Z(_s,po,0),new Z(-po,0,_s),new Z(po,0,_s),new Z(0,_s,-po),new Z(0,_s,po),new Z(-1,1,-1),new Z(1,1,-1),new Z(-1,1,1),new Z(1,1,1)],aA=new Z;class xg{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,s=.1,o=100,l={}){const{size:u=256,position:d=aA}=l;_h=this._renderer.getRenderTarget(),yh=this._renderer.getActiveCubeFace(),xh=this._renderer.getActiveMipmapLevel(),Eh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(u);const f=this._allocateTargets();return f.depthBuffer=!0,this._sceneToCubeUV(e,s,o,f,d),t>0&&this._blur(f,0,0,t),this._applyPMREM(f),this._cleanup(f),f}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Mg(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Sg(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(_h,yh,xh),this._renderer.xr.enabled=Eh,e.scissorTest=!1,yc(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===To||e.mapping===Ao?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),_h=this._renderer.getRenderTarget(),yh=this._renderer.getActiveCubeFace(),xh=this._renderer.getActiveMipmapLevel(),Eh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const s=t||this._allocateTargets();return this._textureToCubeUV(e,s),this._applyPMREM(s),this._cleanup(s),s}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,s={magFilter:wi,minFilter:wi,generateMipmaps:!1,type:za,format:Ti,colorSpace:Ts,depthBuffer:!1},o=Eg(e,t,s);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Eg(e,t,s);const{_lodMax:l}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=lA(l)),this._blurMaterial=cA(l,e,t)}return o}_compileMaterial(e){const t=new di(this._lodPlanes[0],e);this._renderer.compile(t,gh)}_sceneToCubeUV(e,t,s,o,l){const f=new ui(90,1,t,s),p=[1,-1,1,1,1,1],v=[1,1,1,-1,-1,-1],g=this._renderer,y=g.autoClear,x=g.toneMapping;g.getClearColor(_g),g.toneMapping=kr,g.autoClear=!1,g.state.buffers.depth.getReversed()&&(g.setRenderTarget(o),g.clearDepth(),g.setRenderTarget(null));const A=new Ba({name:"PMREM.Background",side:Vn,depthWrite:!1,depthTest:!1}),E=new di(new Ha,A);let _=!1;const N=e.background;N?N.isColor&&(A.color.copy(N),e.background=null,_=!0):(A.color.copy(_g),_=!0);for(let I=0;I<6;I++){const R=I%3;R===0?(f.up.set(0,p[I],0),f.position.set(l.x,l.y,l.z),f.lookAt(l.x+v[I],l.y,l.z)):R===1?(f.up.set(0,0,p[I]),f.position.set(l.x,l.y,l.z),f.lookAt(l.x,l.y+v[I],l.z)):(f.up.set(0,p[I],0),f.position.set(l.x,l.y,l.z),f.lookAt(l.x,l.y,l.z+v[I]));const k=this._cubeSize;yc(o,R*k,I>2?k:0,k,k),g.setRenderTarget(o),_&&g.render(E,f),g.render(e,f)}E.geometry.dispose(),E.material.dispose(),g.toneMapping=x,g.autoClear=y,e.background=N}_textureToCubeUV(e,t){const s=this._renderer,o=e.mapping===To||e.mapping===Ao;o?(this._cubemapMaterial===null&&(this._cubemapMaterial=Mg()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Sg());const l=o?this._cubemapMaterial:this._equirectMaterial,u=new di(this._lodPlanes[0],l),d=l.uniforms;d.envMap.value=e;const f=this._cubeSize;yc(t,0,0,3*f,2*f),s.setRenderTarget(t),s.render(u,gh)}_applyPMREM(e){const t=this._renderer,s=t.autoClear;t.autoClear=!1;const o=this._lodPlanes.length;for(let l=1;l<o;l++){const u=Math.sqrt(this._sigmas[l]*this._sigmas[l]-this._sigmas[l-1]*this._sigmas[l-1]),d=yg[(o-l-1)%yg.length];this._blur(e,l-1,l,u,d)}t.autoClear=s}_blur(e,t,s,o,l){const u=this._pingPongRenderTarget;this._halfBlur(e,u,t,s,o,"latitudinal",l),this._halfBlur(u,e,s,s,o,"longitudinal",l)}_halfBlur(e,t,s,o,l,u,d){const f=this._renderer,p=this._blurMaterial;u!=="latitudinal"&&u!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const v=3,g=new di(this._lodPlanes[o],p),y=p.uniforms,x=this._sizeLods[s]-1,w=isFinite(l)?Math.PI/(2*x):2*Math.PI/(2*Es-1),A=l/w,E=isFinite(l)?1+Math.floor(v*A):Es;E>Es&&console.warn(`sigmaRadians, ${l}, is too large and will clip, as it requested ${E} samples when the maximum is set to ${Es}`);const _=[];let N=0;for(let H=0;H<Es;++H){const Y=H/A,b=Math.exp(-Y*Y/2);_.push(b),H===0?N+=b:H<E&&(N+=2*b)}for(let H=0;H<_.length;H++)_[H]=_[H]/N;y.envMap.value=e.texture,y.samples.value=E,y.weights.value=_,y.latitudinal.value=u==="latitudinal",d&&(y.poleAxis.value=d);const{_lodMax:I}=this;y.dTheta.value=w,y.mipInt.value=I-s;const R=this._sizeLods[o],k=3*R*(o>I-_o?o-I+_o:0),B=4*(this._cubeSize-R);yc(t,k,B,3*R,2*R),f.setRenderTarget(t),f.render(g,gh)}}function lA(n){const e=[],t=[],s=[];let o=n;const l=n-_o+1+gg.length;for(let u=0;u<l;u++){const d=Math.pow(2,o);t.push(d);let f=1/d;u>n-_o?f=gg[u-n+_o-1]:u===0&&(f=0),s.push(f);const p=1/(d-2),v=-p,g=1+p,y=[v,v,g,v,g,g,v,v,g,g,v,g],x=6,w=6,A=3,E=2,_=1,N=new Float32Array(A*w*x),I=new Float32Array(E*w*x),R=new Float32Array(_*w*x);for(let B=0;B<x;B++){const H=B%3*2/3-1,Y=B>2?0:-1,b=[H,Y,0,H+2/3,Y,0,H+2/3,Y+1,0,H,Y,0,H+2/3,Y+1,0,H,Y+1,0];N.set(b,A*w*B),I.set(y,E*w*B);const C=[B,B,B,B,B,B];R.set(C,_*w*B)}const k=new $r;k.setAttribute("position",new Fi(N,A)),k.setAttribute("uv",new Fi(I,E)),k.setAttribute("faceIndex",new Fi(R,_)),e.push(k),o>_o&&o--}return{lodPlanes:e,sizeLods:t,sigmas:s}}function Eg(n,e,t){const s=new Xr(n,e,t);return s.texture.mapping=$c,s.texture.name="PMREM.cubeUv",s.scissorTest=!0,s}function yc(n,e,t,s,o){n.viewport.set(e,t,s,o),n.scissor.set(e,t,s,o)}function cA(n,e,t){const s=new Float32Array(Es),o=new Z(0,1,0);return new jr({name:"SphericalGaussianBlur",defines:{n:Es,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:s},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:o}},vertexShader:zf(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Fr,depthTest:!1,depthWrite:!1})}function Sg(){return new jr({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:zf(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Fr,depthTest:!1,depthWrite:!1})}function Mg(){return new jr({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:zf(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Fr,depthTest:!1,depthWrite:!1})}function zf(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function uA(n){let e=new WeakMap,t=null;function s(d){if(d&&d.isTexture){const f=d.mapping,p=f===Nh||f===Oh,v=f===To||f===Ao;if(p||v){let g=e.get(d);const y=g!==void 0?g.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==y)return t===null&&(t=new xg(n)),g=p?t.fromEquirectangular(d,g):t.fromCubemap(d,g),g.texture.pmremVersion=d.pmremVersion,e.set(d,g),g.texture;if(g!==void 0)return g.texture;{const x=d.image;return p&&x&&x.height>0||v&&x&&o(x)?(t===null&&(t=new xg(n)),g=p?t.fromEquirectangular(d):t.fromCubemap(d),g.texture.pmremVersion=d.pmremVersion,e.set(d,g),d.addEventListener("dispose",l),g.texture):null}}}return d}function o(d){let f=0;const p=6;for(let v=0;v<p;v++)d[v]!==void 0&&f++;return f===p}function l(d){const f=d.target;f.removeEventListener("dispose",l);const p=e.get(f);p!==void 0&&(e.delete(f),p.dispose())}function u(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:s,dispose:u}}function dA(n){const e={};function t(s){if(e[s]!==void 0)return e[s];let o;switch(s){case"WEBGL_depth_texture":o=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":o=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":o=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":o=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:o=n.getExtension(s)}return e[s]=o,o}return{has:function(s){return t(s)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(s){const o=t(s);return o===null&&Eo("THREE.WebGLRenderer: "+s+" extension not supported."),o}}}function hA(n,e,t,s){const o={},l=new WeakMap;function u(g){const y=g.target;y.index!==null&&e.remove(y.index);for(const w in y.attributes)e.remove(y.attributes[w]);y.removeEventListener("dispose",u),delete o[y.id];const x=l.get(y);x&&(e.remove(x),l.delete(y)),s.releaseStatesOfGeometry(y),y.isInstancedBufferGeometry===!0&&delete y._maxInstanceCount,t.memory.geometries--}function d(g,y){return o[y.id]===!0||(y.addEventListener("dispose",u),o[y.id]=!0,t.memory.geometries++),y}function f(g){const y=g.attributes;for(const x in y)e.update(y[x],n.ARRAY_BUFFER)}function p(g){const y=[],x=g.index,w=g.attributes.position;let A=0;if(x!==null){const N=x.array;A=x.version;for(let I=0,R=N.length;I<R;I+=3){const k=N[I+0],B=N[I+1],H=N[I+2];y.push(k,B,B,H,H,k)}}else if(w!==void 0){const N=w.array;A=w.version;for(let I=0,R=N.length/3-1;I<R;I+=3){const k=I+0,B=I+1,H=I+2;y.push(k,B,B,H,H,k)}}else return;const E=new(w_(y)?b_:R_)(y,1);E.version=A;const _=l.get(g);_&&e.remove(_),l.set(g,E)}function v(g){const y=l.get(g);if(y){const x=g.index;x!==null&&y.version<x.version&&p(g)}else p(g);return l.get(g)}return{get:d,update:f,getWireframeAttribute:v}}function fA(n,e,t){let s;function o(y){s=y}let l,u;function d(y){l=y.type,u=y.bytesPerElement}function f(y,x){n.drawElements(s,x,l,y*u),t.update(x,s,1)}function p(y,x,w){w!==0&&(n.drawElementsInstanced(s,x,l,y*u,w),t.update(x,s,w))}function v(y,x,w){if(w===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(s,x,0,l,y,0,w);let E=0;for(let _=0;_<w;_++)E+=x[_];t.update(E,s,1)}function g(y,x,w,A){if(w===0)return;const E=e.get("WEBGL_multi_draw");if(E===null)for(let _=0;_<y.length;_++)p(y[_]/u,x[_],A[_]);else{E.multiDrawElementsInstancedWEBGL(s,x,0,l,y,0,A,0,w);let _=0;for(let N=0;N<w;N++)_+=x[N]*A[N];t.update(_,s,1)}}this.setMode=o,this.setIndex=d,this.render=f,this.renderInstances=p,this.renderMultiDraw=v,this.renderMultiDrawInstances=g}function pA(n){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function s(l,u,d){switch(t.calls++,u){case n.TRIANGLES:t.triangles+=d*(l/3);break;case n.LINES:t.lines+=d*(l/2);break;case n.LINE_STRIP:t.lines+=d*(l-1);break;case n.LINE_LOOP:t.lines+=d*l;break;case n.POINTS:t.points+=d*l;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",u);break}}function o(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:o,update:s}}function mA(n,e,t){const s=new WeakMap,o=new Kt;function l(u,d,f){const p=u.morphTargetInfluences,v=d.morphAttributes.position||d.morphAttributes.normal||d.morphAttributes.color,g=v!==void 0?v.length:0;let y=s.get(d);if(y===void 0||y.count!==g){let C=function(){Y.dispose(),s.delete(d),d.removeEventListener("dispose",C)};var x=C;y!==void 0&&y.texture.dispose();const w=d.morphAttributes.position!==void 0,A=d.morphAttributes.normal!==void 0,E=d.morphAttributes.color!==void 0,_=d.morphAttributes.position||[],N=d.morphAttributes.normal||[],I=d.morphAttributes.color||[];let R=0;w===!0&&(R=1),A===!0&&(R=2),E===!0&&(R=3);let k=d.attributes.position.count*R,B=1;k>e.maxTextureSize&&(B=Math.ceil(k/e.maxTextureSize),k=e.maxTextureSize);const H=new Float32Array(k*B*4*g),Y=new T_(H,k,B,g);Y.type=rr,Y.needsUpdate=!0;const b=R*4;for(let D=0;D<g;D++){const de=_[D],ie=N[D],le=I[D],fe=k*B*4*D;for(let ce=0;ce<de.count;ce++){const oe=ce*b;w===!0&&(o.fromBufferAttribute(de,ce),H[fe+oe+0]=o.x,H[fe+oe+1]=o.y,H[fe+oe+2]=o.z,H[fe+oe+3]=0),A===!0&&(o.fromBufferAttribute(ie,ce),H[fe+oe+4]=o.x,H[fe+oe+5]=o.y,H[fe+oe+6]=o.z,H[fe+oe+7]=0),E===!0&&(o.fromBufferAttribute(le,ce),H[fe+oe+8]=o.x,H[fe+oe+9]=o.y,H[fe+oe+10]=o.z,H[fe+oe+11]=le.itemSize===4?o.w:1)}}y={count:g,texture:Y,size:new Lt(k,B)},s.set(d,y),d.addEventListener("dispose",C)}if(u.isInstancedMesh===!0&&u.morphTexture!==null)f.getUniforms().setValue(n,"morphTexture",u.morphTexture,t);else{let w=0;for(let E=0;E<p.length;E++)w+=p[E];const A=d.morphTargetsRelative?1:1-w;f.getUniforms().setValue(n,"morphTargetBaseInfluence",A),f.getUniforms().setValue(n,"morphTargetInfluences",p)}f.getUniforms().setValue(n,"morphTargetsTexture",y.texture,t),f.getUniforms().setValue(n,"morphTargetsTextureSize",y.size)}return{update:l}}function vA(n,e,t,s){let o=new WeakMap;function l(f){const p=s.render.frame,v=f.geometry,g=e.get(f,v);if(o.get(g)!==p&&(e.update(g),o.set(g,p)),f.isInstancedMesh&&(f.hasEventListener("dispose",d)===!1&&f.addEventListener("dispose",d),o.get(f)!==p&&(t.update(f.instanceMatrix,n.ARRAY_BUFFER),f.instanceColor!==null&&t.update(f.instanceColor,n.ARRAY_BUFFER),o.set(f,p))),f.isSkinnedMesh){const y=f.skeleton;o.get(y)!==p&&(y.update(),o.set(y,p))}return g}function u(){o=new WeakMap}function d(f){const p=f.target;p.removeEventListener("dispose",d),t.remove(p.instanceMatrix),p.instanceColor!==null&&t.remove(p.instanceColor)}return{update:l,dispose:u}}const N_=new Dn,wg=new U_(1,1),O_=new T_,F_=new HM,k_=new I_,Tg=[],Ag=[],Cg=new Float32Array(16),Rg=new Float32Array(9),bg=new Float32Array(4);function Uo(n,e,t){const s=n[0];if(s<=0||s>0)return n;const o=e*t;let l=Tg[o];if(l===void 0&&(l=new Float32Array(o),Tg[o]=l),e!==0){s.toArray(l,0);for(let u=1,d=0;u!==e;++u)d+=t,n[u].toArray(l,d)}return l}function sn(n,e){if(n.length!==e.length)return!1;for(let t=0,s=n.length;t<s;t++)if(n[t]!==e[t])return!1;return!0}function on(n,e){for(let t=0,s=e.length;t<s;t++)n[t]=e[t]}function Zc(n,e){let t=Ag[e];t===void 0&&(t=new Int32Array(e),Ag[e]=t);for(let s=0;s!==e;++s)t[s]=n.allocateTextureUnit();return t}function gA(n,e){const t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function _A(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(sn(t,e))return;n.uniform2fv(this.addr,e),on(t,e)}}function yA(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(sn(t,e))return;n.uniform3fv(this.addr,e),on(t,e)}}function xA(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(sn(t,e))return;n.uniform4fv(this.addr,e),on(t,e)}}function EA(n,e){const t=this.cache,s=e.elements;if(s===void 0){if(sn(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),on(t,e)}else{if(sn(t,s))return;bg.set(s),n.uniformMatrix2fv(this.addr,!1,bg),on(t,s)}}function SA(n,e){const t=this.cache,s=e.elements;if(s===void 0){if(sn(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),on(t,e)}else{if(sn(t,s))return;Rg.set(s),n.uniformMatrix3fv(this.addr,!1,Rg),on(t,s)}}function MA(n,e){const t=this.cache,s=e.elements;if(s===void 0){if(sn(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),on(t,e)}else{if(sn(t,s))return;Cg.set(s),n.uniformMatrix4fv(this.addr,!1,Cg),on(t,s)}}function wA(n,e){const t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function TA(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(sn(t,e))return;n.uniform2iv(this.addr,e),on(t,e)}}function AA(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(sn(t,e))return;n.uniform3iv(this.addr,e),on(t,e)}}function CA(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(sn(t,e))return;n.uniform4iv(this.addr,e),on(t,e)}}function RA(n,e){const t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function bA(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(sn(t,e))return;n.uniform2uiv(this.addr,e),on(t,e)}}function PA(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(sn(t,e))return;n.uniform3uiv(this.addr,e),on(t,e)}}function LA(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(sn(t,e))return;n.uniform4uiv(this.addr,e),on(t,e)}}function IA(n,e,t){const s=this.cache,o=t.allocateTextureUnit();s[0]!==o&&(n.uniform1i(this.addr,o),s[0]=o);let l;this.type===n.SAMPLER_2D_SHADOW?(wg.compareFunction=M_,l=wg):l=N_,t.setTexture2D(e||l,o)}function UA(n,e,t){const s=this.cache,o=t.allocateTextureUnit();s[0]!==o&&(n.uniform1i(this.addr,o),s[0]=o),t.setTexture3D(e||F_,o)}function DA(n,e,t){const s=this.cache,o=t.allocateTextureUnit();s[0]!==o&&(n.uniform1i(this.addr,o),s[0]=o),t.setTextureCube(e||k_,o)}function NA(n,e,t){const s=this.cache,o=t.allocateTextureUnit();s[0]!==o&&(n.uniform1i(this.addr,o),s[0]=o),t.setTexture2DArray(e||O_,o)}function OA(n){switch(n){case 5126:return gA;case 35664:return _A;case 35665:return yA;case 35666:return xA;case 35674:return EA;case 35675:return SA;case 35676:return MA;case 5124:case 35670:return wA;case 35667:case 35671:return TA;case 35668:case 35672:return AA;case 35669:case 35673:return CA;case 5125:return RA;case 36294:return bA;case 36295:return PA;case 36296:return LA;case 35678:case 36198:case 36298:case 36306:case 35682:return IA;case 35679:case 36299:case 36307:return UA;case 35680:case 36300:case 36308:case 36293:return DA;case 36289:case 36303:case 36311:case 36292:return NA}}function FA(n,e){n.uniform1fv(this.addr,e)}function kA(n,e){const t=Uo(e,this.size,2);n.uniform2fv(this.addr,t)}function zA(n,e){const t=Uo(e,this.size,3);n.uniform3fv(this.addr,t)}function BA(n,e){const t=Uo(e,this.size,4);n.uniform4fv(this.addr,t)}function HA(n,e){const t=Uo(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function VA(n,e){const t=Uo(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function GA(n,e){const t=Uo(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function WA(n,e){n.uniform1iv(this.addr,e)}function XA(n,e){n.uniform2iv(this.addr,e)}function jA(n,e){n.uniform3iv(this.addr,e)}function YA(n,e){n.uniform4iv(this.addr,e)}function $A(n,e){n.uniform1uiv(this.addr,e)}function qA(n,e){n.uniform2uiv(this.addr,e)}function KA(n,e){n.uniform3uiv(this.addr,e)}function ZA(n,e){n.uniform4uiv(this.addr,e)}function QA(n,e,t){const s=this.cache,o=e.length,l=Zc(t,o);sn(s,l)||(n.uniform1iv(this.addr,l),on(s,l));for(let u=0;u!==o;++u)t.setTexture2D(e[u]||N_,l[u])}function JA(n,e,t){const s=this.cache,o=e.length,l=Zc(t,o);sn(s,l)||(n.uniform1iv(this.addr,l),on(s,l));for(let u=0;u!==o;++u)t.setTexture3D(e[u]||F_,l[u])}function eC(n,e,t){const s=this.cache,o=e.length,l=Zc(t,o);sn(s,l)||(n.uniform1iv(this.addr,l),on(s,l));for(let u=0;u!==o;++u)t.setTextureCube(e[u]||k_,l[u])}function tC(n,e,t){const s=this.cache,o=e.length,l=Zc(t,o);sn(s,l)||(n.uniform1iv(this.addr,l),on(s,l));for(let u=0;u!==o;++u)t.setTexture2DArray(e[u]||O_,l[u])}function nC(n){switch(n){case 5126:return FA;case 35664:return kA;case 35665:return zA;case 35666:return BA;case 35674:return HA;case 35675:return VA;case 35676:return GA;case 5124:case 35670:return WA;case 35667:case 35671:return XA;case 35668:case 35672:return jA;case 35669:case 35673:return YA;case 5125:return $A;case 36294:return qA;case 36295:return KA;case 36296:return ZA;case 35678:case 36198:case 36298:case 36306:case 35682:return QA;case 35679:case 36299:case 36307:return JA;case 35680:case 36300:case 36308:case 36293:return eC;case 36289:case 36303:case 36311:case 36292:return tC}}class iC{constructor(e,t,s){this.id=e,this.addr=s,this.cache=[],this.type=t.type,this.setValue=OA(t.type)}}class rC{constructor(e,t,s){this.id=e,this.addr=s,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=nC(t.type)}}class sC{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,s){const o=this.seq;for(let l=0,u=o.length;l!==u;++l){const d=o[l];d.setValue(e,t[d.id],s)}}}const Sh=/(\w+)(\])?(\[|\.)?/g;function Pg(n,e){n.seq.push(e),n.map[e.id]=e}function oC(n,e,t){const s=n.name,o=s.length;for(Sh.lastIndex=0;;){const l=Sh.exec(s),u=Sh.lastIndex;let d=l[1];const f=l[2]==="]",p=l[3];if(f&&(d=d|0),p===void 0||p==="["&&u+2===o){Pg(t,p===void 0?new iC(d,n,e):new rC(d,n,e));break}else{let g=t.map[d];g===void 0&&(g=new sC(d),Pg(t,g)),t=g}}}class Ic{constructor(e,t){this.seq=[],this.map={};const s=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let o=0;o<s;++o){const l=e.getActiveUniform(t,o),u=e.getUniformLocation(t,l.name);oC(l,u,this)}}setValue(e,t,s,o){const l=this.map[t];l!==void 0&&l.setValue(e,s,o)}setOptional(e,t,s){const o=t[s];o!==void 0&&this.setValue(e,s,o)}static upload(e,t,s,o){for(let l=0,u=t.length;l!==u;++l){const d=t[l],f=s[d.id];f.needsUpdate!==!1&&d.setValue(e,f.value,o)}}static seqWithValue(e,t){const s=[];for(let o=0,l=e.length;o!==l;++o){const u=e[o];u.id in t&&s.push(u)}return s}}function Lg(n,e,t){const s=n.createShader(e);return n.shaderSource(s,t),n.compileShader(s),s}const aC=37297;let lC=0;function cC(n,e){const t=n.split(`
`),s=[],o=Math.max(e-6,0),l=Math.min(e+6,t.length);for(let u=o;u<l;u++){const d=u+1;s.push(`${d===e?">":" "} ${d}: ${t[u]}`)}return s.join(`
`)}const Ig=new ut;function uC(n){Mt._getMatrix(Ig,Mt.workingColorSpace,n);const e=`mat3( ${Ig.elements.map(t=>t.toFixed(4))} )`;switch(Mt.getTransfer(n)){case zc:return[e,"LinearTransferOETF"];case Ut:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function Ug(n,e,t){const s=n.getShaderParameter(e,n.COMPILE_STATUS),l=(n.getShaderInfoLog(e)||"").trim();if(s&&l==="")return"";const u=/ERROR: 0:(\d+)/.exec(l);if(u){const d=parseInt(u[1]);return t.toUpperCase()+`

`+l+`

`+cC(n.getShaderSource(e),d)}else return l}function dC(n,e){const t=uC(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function hC(n,e){let t;switch(e){case f_:t="Linear";break;case eM:t="Reinhard";break;case tM:t="Cineon";break;case nM:t="ACESFilmic";break;case rM:t="AgX";break;case sM:t="Neutral";break;case iM:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const xc=new Z;function fC(){Mt.getLuminanceCoefficients(xc);const n=xc.x.toFixed(4),e=xc.y.toFixed(4),t=xc.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function pC(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(_a).join(`
`)}function mC(n){const e=[];for(const t in n){const s=n[t];s!==!1&&e.push("#define "+t+" "+s)}return e.join(`
`)}function vC(n,e){const t={},s=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let o=0;o<s;o++){const l=n.getActiveAttrib(e,o),u=l.name;let d=1;l.type===n.FLOAT_MAT2&&(d=2),l.type===n.FLOAT_MAT3&&(d=3),l.type===n.FLOAT_MAT4&&(d=4),t[u]={type:l.type,location:n.getAttribLocation(e,u),locationSize:d}}return t}function _a(n){return n!==""}function Dg(n,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Ng(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const gC=/^[ \t]*#include +<([\w\d./]+)>/gm;function ff(n){return n.replace(gC,yC)}const _C=new Map;function yC(n,e){let t=dt[e];if(t===void 0){const s=_C.get(e);if(s!==void 0)t=dt[s],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,s);else throw new Error("Can not resolve #include <"+e+">")}return ff(t)}const xC=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Og(n){return n.replace(xC,EC)}function EC(n,e,t,s){let o="";for(let l=parseInt(e);l<parseInt(t);l++)o+=s.replace(/\[\s*i\s*\]/g,"[ "+l+" ]").replace(/UNROLLED_LOOP_INDEX/g,l);return o}function Fg(n){let e=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?e+=`
#define HIGH_PRECISION`:n.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function SC(n){let e="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===d_?e="SHADOWMAP_TYPE_PCF":n.shadowMapType===US?e="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===nr&&(e="SHADOWMAP_TYPE_VSM"),e}function MC(n){let e="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case To:case Ao:e="ENVMAP_TYPE_CUBE";break;case $c:e="ENVMAP_TYPE_CUBE_UV";break}return e}function wC(n){let e="ENVMAP_MODE_REFLECTION";if(n.envMap)switch(n.envMapMode){case Ao:e="ENVMAP_MODE_REFRACTION";break}return e}function TC(n){let e="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case h_:e="ENVMAP_BLENDING_MULTIPLY";break;case QS:e="ENVMAP_BLENDING_MIX";break;case JS:e="ENVMAP_BLENDING_ADD";break}return e}function AC(n){const e=n.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,s=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:s,maxMip:t}}function CC(n,e,t,s){const o=n.getContext(),l=t.defines;let u=t.vertexShader,d=t.fragmentShader;const f=SC(t),p=MC(t),v=wC(t),g=TC(t),y=AC(t),x=pC(t),w=mC(l),A=o.createProgram();let E,_,N=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(E=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,w].filter(_a).join(`
`),E.length>0&&(E+=`
`),_=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,w].filter(_a).join(`
`),_.length>0&&(_+=`
`)):(E=[Fg(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,w,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+v:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+f:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reversedDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(_a).join(`
`),_=[Fg(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,w,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+p:"",t.envMap?"#define "+v:"",t.envMap?"#define "+g:"",y?"#define CUBEUV_TEXEL_WIDTH "+y.texelWidth:"",y?"#define CUBEUV_TEXEL_HEIGHT "+y.texelHeight:"",y?"#define CUBEUV_MAX_MIP "+y.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+f:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reversedDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==kr?"#define TONE_MAPPING":"",t.toneMapping!==kr?dt.tonemapping_pars_fragment:"",t.toneMapping!==kr?hC("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",dt.colorspace_pars_fragment,dC("linearToOutputTexel",t.outputColorSpace),fC(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(_a).join(`
`)),u=ff(u),u=Dg(u,t),u=Ng(u,t),d=ff(d),d=Dg(d,t),d=Ng(d,t),u=Og(u),d=Og(d),t.isRawShaderMaterial!==!0&&(N=`#version 300 es
`,E=[x,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+E,_=["#define varying in",t.glslVersion===$v?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===$v?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+_);const I=N+E+u,R=N+_+d,k=Lg(o,o.VERTEX_SHADER,I),B=Lg(o,o.FRAGMENT_SHADER,R);o.attachShader(A,k),o.attachShader(A,B),t.index0AttributeName!==void 0?o.bindAttribLocation(A,0,t.index0AttributeName):t.morphTargets===!0&&o.bindAttribLocation(A,0,"position"),o.linkProgram(A);function H(D){if(n.debug.checkShaderErrors){const de=o.getProgramInfoLog(A)||"",ie=o.getShaderInfoLog(k)||"",le=o.getShaderInfoLog(B)||"",fe=de.trim(),ce=ie.trim(),oe=le.trim();let O=!0,ae=!0;if(o.getProgramParameter(A,o.LINK_STATUS)===!1)if(O=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(o,A,k,B);else{const se=Ug(o,k,"vertex"),U=Ug(o,B,"fragment");console.error("THREE.WebGLProgram: Shader Error "+o.getError()+" - VALIDATE_STATUS "+o.getProgramParameter(A,o.VALIDATE_STATUS)+`

Material Name: `+D.name+`
Material Type: `+D.type+`

Program Info Log: `+fe+`
`+se+`
`+U)}else fe!==""?console.warn("THREE.WebGLProgram: Program Info Log:",fe):(ce===""||oe==="")&&(ae=!1);ae&&(D.diagnostics={runnable:O,programLog:fe,vertexShader:{log:ce,prefix:E},fragmentShader:{log:oe,prefix:_}})}o.deleteShader(k),o.deleteShader(B),Y=new Ic(o,A),b=vC(o,A)}let Y;this.getUniforms=function(){return Y===void 0&&H(this),Y};let b;this.getAttributes=function(){return b===void 0&&H(this),b};let C=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return C===!1&&(C=o.getProgramParameter(A,aC)),C},this.destroy=function(){s.releaseStatesOfProgram(this),o.deleteProgram(A),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=lC++,this.cacheKey=e,this.usedTimes=1,this.program=A,this.vertexShader=k,this.fragmentShader=B,this}let RC=0;class bC{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,s=e.fragmentShader,o=this._getShaderStage(t),l=this._getShaderStage(s),u=this._getShaderCacheForMaterial(e);return u.has(o)===!1&&(u.add(o),o.usedTimes++),u.has(l)===!1&&(u.add(l),l.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const s of t)s.usedTimes--,s.usedTimes===0&&this.shaderCache.delete(s.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let s=t.get(e);return s===void 0&&(s=new Set,t.set(e,s)),s}_getShaderStage(e){const t=this.shaderCache;let s=t.get(e);return s===void 0&&(s=new PC(e),t.set(e,s)),s}}class PC{constructor(e){this.id=RC++,this.code=e,this.usedTimes=0}}function LC(n,e,t,s,o,l,u){const d=new Of,f=new bC,p=new Set,v=[],g=o.logarithmicDepthBuffer,y=o.vertexTextures;let x=o.precision;const w={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function A(b){return p.add(b),b===0?"uv":`uv${b}`}function E(b,C,D,de,ie){const le=de.fog,fe=ie.geometry,ce=b.isMeshStandardMaterial?de.environment:null,oe=(b.isMeshStandardMaterial?t:e).get(b.envMap||ce),O=oe&&oe.mapping===$c?oe.image.height:null,ae=w[b.type];b.precision!==null&&(x=o.getMaxPrecision(b.precision),x!==b.precision&&console.warn("THREE.WebGLProgram.getParameters:",b.precision,"not supported, using",x,"instead."));const se=fe.morphAttributes.position||fe.morphAttributes.normal||fe.morphAttributes.color,U=se!==void 0?se.length:0;let J=0;fe.morphAttributes.position!==void 0&&(J=1),fe.morphAttributes.normal!==void 0&&(J=2),fe.morphAttributes.color!==void 0&&(J=3);let Oe,Fe,V,re;if(ae){const yt=Di[ae];Oe=yt.vertexShader,Fe=yt.fragmentShader}else Oe=b.vertexShader,Fe=b.fragmentShader,f.update(b),V=f.getVertexShaderID(b),re=f.getFragmentShaderID(b);const ne=n.getRenderTarget(),_e=n.state.buffers.depth.getReversed(),Ae=ie.isInstancedMesh===!0,Ie=ie.isBatchedMesh===!0,Nt=!!b.map,ft=!!b.matcap,F=!!oe,Et=!!b.aoMap,Xe=!!b.lightMap,gt=!!b.bumpMap,Ke=!!b.normalMap,Ot=!!b.displacementMap,ke=!!b.emissiveMap,lt=!!b.metalnessMap,Bt=!!b.roughnessMap,Ht=b.anisotropy>0,P=b.clearcoat>0,M=b.dispersion>0,q=b.iridescence>0,he=b.sheen>0,ge=b.transmission>0,ue=Ht&&!!b.anisotropyMap,$e=P&&!!b.clearcoatMap,Te=P&&!!b.clearcoatNormalMap,Be=P&&!!b.clearcoatRoughnessMap,qe=q&&!!b.iridescenceMap,Me=q&&!!b.iridescenceThicknessMap,Le=he&&!!b.sheenColorMap,it=he&&!!b.sheenRoughnessMap,je=!!b.specularMap,Re=!!b.specularColorMap,ct=!!b.specularIntensityMap,G=ge&&!!b.transmissionMap,Ee=ge&&!!b.thicknessMap,Ce=!!b.gradientMap,Ue=!!b.alphaMap,xe=b.alphaTest>0,pe=!!b.alphaHash,Ge=!!b.extensions;let at=kr;b.toneMapped&&(ne===null||ne.isXRRenderTarget===!0)&&(at=n.toneMapping);const Rt={shaderID:ae,shaderType:b.type,shaderName:b.name,vertexShader:Oe,fragmentShader:Fe,defines:b.defines,customVertexShaderID:V,customFragmentShaderID:re,isRawShaderMaterial:b.isRawShaderMaterial===!0,glslVersion:b.glslVersion,precision:x,batching:Ie,batchingColor:Ie&&ie._colorsTexture!==null,instancing:Ae,instancingColor:Ae&&ie.instanceColor!==null,instancingMorph:Ae&&ie.morphTexture!==null,supportsVertexTextures:y,outputColorSpace:ne===null?n.outputColorSpace:ne.isXRRenderTarget===!0?ne.texture.colorSpace:Ts,alphaToCoverage:!!b.alphaToCoverage,map:Nt,matcap:ft,envMap:F,envMapMode:F&&oe.mapping,envMapCubeUVHeight:O,aoMap:Et,lightMap:Xe,bumpMap:gt,normalMap:Ke,displacementMap:y&&Ot,emissiveMap:ke,normalMapObjectSpace:Ke&&b.normalMapType===uM,normalMapTangentSpace:Ke&&b.normalMapType===cM,metalnessMap:lt,roughnessMap:Bt,anisotropy:Ht,anisotropyMap:ue,clearcoat:P,clearcoatMap:$e,clearcoatNormalMap:Te,clearcoatRoughnessMap:Be,dispersion:M,iridescence:q,iridescenceMap:qe,iridescenceThicknessMap:Me,sheen:he,sheenColorMap:Le,sheenRoughnessMap:it,specularMap:je,specularColorMap:Re,specularIntensityMap:ct,transmission:ge,transmissionMap:G,thicknessMap:Ee,gradientMap:Ce,opaque:b.transparent===!1&&b.blending===xo&&b.alphaToCoverage===!1,alphaMap:Ue,alphaTest:xe,alphaHash:pe,combine:b.combine,mapUv:Nt&&A(b.map.channel),aoMapUv:Et&&A(b.aoMap.channel),lightMapUv:Xe&&A(b.lightMap.channel),bumpMapUv:gt&&A(b.bumpMap.channel),normalMapUv:Ke&&A(b.normalMap.channel),displacementMapUv:Ot&&A(b.displacementMap.channel),emissiveMapUv:ke&&A(b.emissiveMap.channel),metalnessMapUv:lt&&A(b.metalnessMap.channel),roughnessMapUv:Bt&&A(b.roughnessMap.channel),anisotropyMapUv:ue&&A(b.anisotropyMap.channel),clearcoatMapUv:$e&&A(b.clearcoatMap.channel),clearcoatNormalMapUv:Te&&A(b.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Be&&A(b.clearcoatRoughnessMap.channel),iridescenceMapUv:qe&&A(b.iridescenceMap.channel),iridescenceThicknessMapUv:Me&&A(b.iridescenceThicknessMap.channel),sheenColorMapUv:Le&&A(b.sheenColorMap.channel),sheenRoughnessMapUv:it&&A(b.sheenRoughnessMap.channel),specularMapUv:je&&A(b.specularMap.channel),specularColorMapUv:Re&&A(b.specularColorMap.channel),specularIntensityMapUv:ct&&A(b.specularIntensityMap.channel),transmissionMapUv:G&&A(b.transmissionMap.channel),thicknessMapUv:Ee&&A(b.thicknessMap.channel),alphaMapUv:Ue&&A(b.alphaMap.channel),vertexTangents:!!fe.attributes.tangent&&(Ke||Ht),vertexColors:b.vertexColors,vertexAlphas:b.vertexColors===!0&&!!fe.attributes.color&&fe.attributes.color.itemSize===4,pointsUvs:ie.isPoints===!0&&!!fe.attributes.uv&&(Nt||Ue),fog:!!le,useFog:b.fog===!0,fogExp2:!!le&&le.isFogExp2,flatShading:b.flatShading===!0&&b.wireframe===!1,sizeAttenuation:b.sizeAttenuation===!0,logarithmicDepthBuffer:g,reversedDepthBuffer:_e,skinning:ie.isSkinnedMesh===!0,morphTargets:fe.morphAttributes.position!==void 0,morphNormals:fe.morphAttributes.normal!==void 0,morphColors:fe.morphAttributes.color!==void 0,morphTargetsCount:U,morphTextureStride:J,numDirLights:C.directional.length,numPointLights:C.point.length,numSpotLights:C.spot.length,numSpotLightMaps:C.spotLightMap.length,numRectAreaLights:C.rectArea.length,numHemiLights:C.hemi.length,numDirLightShadows:C.directionalShadowMap.length,numPointLightShadows:C.pointShadowMap.length,numSpotLightShadows:C.spotShadowMap.length,numSpotLightShadowsWithMaps:C.numSpotLightShadowsWithMaps,numLightProbes:C.numLightProbes,numClippingPlanes:u.numPlanes,numClipIntersection:u.numIntersection,dithering:b.dithering,shadowMapEnabled:n.shadowMap.enabled&&D.length>0,shadowMapType:n.shadowMap.type,toneMapping:at,decodeVideoTexture:Nt&&b.map.isVideoTexture===!0&&Mt.getTransfer(b.map.colorSpace)===Ut,decodeVideoTextureEmissive:ke&&b.emissiveMap.isVideoTexture===!0&&Mt.getTransfer(b.emissiveMap.colorSpace)===Ut,premultipliedAlpha:b.premultipliedAlpha,doubleSided:b.side===ir,flipSided:b.side===Vn,useDepthPacking:b.depthPacking>=0,depthPacking:b.depthPacking||0,index0AttributeName:b.index0AttributeName,extensionClipCullDistance:Ge&&b.extensions.clipCullDistance===!0&&s.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Ge&&b.extensions.multiDraw===!0||Ie)&&s.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:s.has("KHR_parallel_shader_compile"),customProgramCacheKey:b.customProgramCacheKey()};return Rt.vertexUv1s=p.has(1),Rt.vertexUv2s=p.has(2),Rt.vertexUv3s=p.has(3),p.clear(),Rt}function _(b){const C=[];if(b.shaderID?C.push(b.shaderID):(C.push(b.customVertexShaderID),C.push(b.customFragmentShaderID)),b.defines!==void 0)for(const D in b.defines)C.push(D),C.push(b.defines[D]);return b.isRawShaderMaterial===!1&&(N(C,b),I(C,b),C.push(n.outputColorSpace)),C.push(b.customProgramCacheKey),C.join()}function N(b,C){b.push(C.precision),b.push(C.outputColorSpace),b.push(C.envMapMode),b.push(C.envMapCubeUVHeight),b.push(C.mapUv),b.push(C.alphaMapUv),b.push(C.lightMapUv),b.push(C.aoMapUv),b.push(C.bumpMapUv),b.push(C.normalMapUv),b.push(C.displacementMapUv),b.push(C.emissiveMapUv),b.push(C.metalnessMapUv),b.push(C.roughnessMapUv),b.push(C.anisotropyMapUv),b.push(C.clearcoatMapUv),b.push(C.clearcoatNormalMapUv),b.push(C.clearcoatRoughnessMapUv),b.push(C.iridescenceMapUv),b.push(C.iridescenceThicknessMapUv),b.push(C.sheenColorMapUv),b.push(C.sheenRoughnessMapUv),b.push(C.specularMapUv),b.push(C.specularColorMapUv),b.push(C.specularIntensityMapUv),b.push(C.transmissionMapUv),b.push(C.thicknessMapUv),b.push(C.combine),b.push(C.fogExp2),b.push(C.sizeAttenuation),b.push(C.morphTargetsCount),b.push(C.morphAttributeCount),b.push(C.numDirLights),b.push(C.numPointLights),b.push(C.numSpotLights),b.push(C.numSpotLightMaps),b.push(C.numHemiLights),b.push(C.numRectAreaLights),b.push(C.numDirLightShadows),b.push(C.numPointLightShadows),b.push(C.numSpotLightShadows),b.push(C.numSpotLightShadowsWithMaps),b.push(C.numLightProbes),b.push(C.shadowMapType),b.push(C.toneMapping),b.push(C.numClippingPlanes),b.push(C.numClipIntersection),b.push(C.depthPacking)}function I(b,C){d.disableAll(),C.supportsVertexTextures&&d.enable(0),C.instancing&&d.enable(1),C.instancingColor&&d.enable(2),C.instancingMorph&&d.enable(3),C.matcap&&d.enable(4),C.envMap&&d.enable(5),C.normalMapObjectSpace&&d.enable(6),C.normalMapTangentSpace&&d.enable(7),C.clearcoat&&d.enable(8),C.iridescence&&d.enable(9),C.alphaTest&&d.enable(10),C.vertexColors&&d.enable(11),C.vertexAlphas&&d.enable(12),C.vertexUv1s&&d.enable(13),C.vertexUv2s&&d.enable(14),C.vertexUv3s&&d.enable(15),C.vertexTangents&&d.enable(16),C.anisotropy&&d.enable(17),C.alphaHash&&d.enable(18),C.batching&&d.enable(19),C.dispersion&&d.enable(20),C.batchingColor&&d.enable(21),C.gradientMap&&d.enable(22),b.push(d.mask),d.disableAll(),C.fog&&d.enable(0),C.useFog&&d.enable(1),C.flatShading&&d.enable(2),C.logarithmicDepthBuffer&&d.enable(3),C.reversedDepthBuffer&&d.enable(4),C.skinning&&d.enable(5),C.morphTargets&&d.enable(6),C.morphNormals&&d.enable(7),C.morphColors&&d.enable(8),C.premultipliedAlpha&&d.enable(9),C.shadowMapEnabled&&d.enable(10),C.doubleSided&&d.enable(11),C.flipSided&&d.enable(12),C.useDepthPacking&&d.enable(13),C.dithering&&d.enable(14),C.transmission&&d.enable(15),C.sheen&&d.enable(16),C.opaque&&d.enable(17),C.pointsUvs&&d.enable(18),C.decodeVideoTexture&&d.enable(19),C.decodeVideoTextureEmissive&&d.enable(20),C.alphaToCoverage&&d.enable(21),b.push(d.mask)}function R(b){const C=w[b.type];let D;if(C){const de=Di[C];D=ew.clone(de.uniforms)}else D=b.uniforms;return D}function k(b,C){let D;for(let de=0,ie=v.length;de<ie;de++){const le=v[de];if(le.cacheKey===C){D=le,++D.usedTimes;break}}return D===void 0&&(D=new CC(n,C,b,l),v.push(D)),D}function B(b){if(--b.usedTimes===0){const C=v.indexOf(b);v[C]=v[v.length-1],v.pop(),b.destroy()}}function H(b){f.remove(b)}function Y(){f.dispose()}return{getParameters:E,getProgramCacheKey:_,getUniforms:R,acquireProgram:k,releaseProgram:B,releaseShaderCache:H,programs:v,dispose:Y}}function IC(){let n=new WeakMap;function e(u){return n.has(u)}function t(u){let d=n.get(u);return d===void 0&&(d={},n.set(u,d)),d}function s(u){n.delete(u)}function o(u,d,f){n.get(u)[d]=f}function l(){n=new WeakMap}return{has:e,get:t,remove:s,update:o,dispose:l}}function UC(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.z!==e.z?n.z-e.z:n.id-e.id}function kg(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function zg(){const n=[];let e=0;const t=[],s=[],o=[];function l(){e=0,t.length=0,s.length=0,o.length=0}function u(g,y,x,w,A,E){let _=n[e];return _===void 0?(_={id:g.id,object:g,geometry:y,material:x,groupOrder:w,renderOrder:g.renderOrder,z:A,group:E},n[e]=_):(_.id=g.id,_.object=g,_.geometry=y,_.material=x,_.groupOrder=w,_.renderOrder=g.renderOrder,_.z=A,_.group=E),e++,_}function d(g,y,x,w,A,E){const _=u(g,y,x,w,A,E);x.transmission>0?s.push(_):x.transparent===!0?o.push(_):t.push(_)}function f(g,y,x,w,A,E){const _=u(g,y,x,w,A,E);x.transmission>0?s.unshift(_):x.transparent===!0?o.unshift(_):t.unshift(_)}function p(g,y){t.length>1&&t.sort(g||UC),s.length>1&&s.sort(y||kg),o.length>1&&o.sort(y||kg)}function v(){for(let g=e,y=n.length;g<y;g++){const x=n[g];if(x.id===null)break;x.id=null,x.object=null,x.geometry=null,x.material=null,x.group=null}}return{opaque:t,transmissive:s,transparent:o,init:l,push:d,unshift:f,finish:v,sort:p}}function DC(){let n=new WeakMap;function e(s,o){const l=n.get(s);let u;return l===void 0?(u=new zg,n.set(s,[u])):o>=l.length?(u=new zg,l.push(u)):u=l[o],u}function t(){n=new WeakMap}return{get:e,dispose:t}}function NC(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new Z,color:new Dt};break;case"SpotLight":t={position:new Z,direction:new Z,color:new Dt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new Z,color:new Dt,distance:0,decay:0};break;case"HemisphereLight":t={direction:new Z,skyColor:new Dt,groundColor:new Dt};break;case"RectAreaLight":t={color:new Dt,position:new Z,halfWidth:new Z,halfHeight:new Z};break}return n[e.id]=t,t}}}function OC(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Lt};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Lt};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Lt,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}let FC=0;function kC(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function zC(n){const e=new NC,t=OC(),s={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let p=0;p<9;p++)s.probe.push(new Z);const o=new Z,l=new Zt,u=new Zt;function d(p){let v=0,g=0,y=0;for(let b=0;b<9;b++)s.probe[b].set(0,0,0);let x=0,w=0,A=0,E=0,_=0,N=0,I=0,R=0,k=0,B=0,H=0;p.sort(kC);for(let b=0,C=p.length;b<C;b++){const D=p[b],de=D.color,ie=D.intensity,le=D.distance,fe=D.shadow&&D.shadow.map?D.shadow.map.texture:null;if(D.isAmbientLight)v+=de.r*ie,g+=de.g*ie,y+=de.b*ie;else if(D.isLightProbe){for(let ce=0;ce<9;ce++)s.probe[ce].addScaledVector(D.sh.coefficients[ce],ie);H++}else if(D.isDirectionalLight){const ce=e.get(D);if(ce.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){const oe=D.shadow,O=t.get(D);O.shadowIntensity=oe.intensity,O.shadowBias=oe.bias,O.shadowNormalBias=oe.normalBias,O.shadowRadius=oe.radius,O.shadowMapSize=oe.mapSize,s.directionalShadow[x]=O,s.directionalShadowMap[x]=fe,s.directionalShadowMatrix[x]=D.shadow.matrix,N++}s.directional[x]=ce,x++}else if(D.isSpotLight){const ce=e.get(D);ce.position.setFromMatrixPosition(D.matrixWorld),ce.color.copy(de).multiplyScalar(ie),ce.distance=le,ce.coneCos=Math.cos(D.angle),ce.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),ce.decay=D.decay,s.spot[A]=ce;const oe=D.shadow;if(D.map&&(s.spotLightMap[k]=D.map,k++,oe.updateMatrices(D),D.castShadow&&B++),s.spotLightMatrix[A]=oe.matrix,D.castShadow){const O=t.get(D);O.shadowIntensity=oe.intensity,O.shadowBias=oe.bias,O.shadowNormalBias=oe.normalBias,O.shadowRadius=oe.radius,O.shadowMapSize=oe.mapSize,s.spotShadow[A]=O,s.spotShadowMap[A]=fe,R++}A++}else if(D.isRectAreaLight){const ce=e.get(D);ce.color.copy(de).multiplyScalar(ie),ce.halfWidth.set(D.width*.5,0,0),ce.halfHeight.set(0,D.height*.5,0),s.rectArea[E]=ce,E++}else if(D.isPointLight){const ce=e.get(D);if(ce.color.copy(D.color).multiplyScalar(D.intensity),ce.distance=D.distance,ce.decay=D.decay,D.castShadow){const oe=D.shadow,O=t.get(D);O.shadowIntensity=oe.intensity,O.shadowBias=oe.bias,O.shadowNormalBias=oe.normalBias,O.shadowRadius=oe.radius,O.shadowMapSize=oe.mapSize,O.shadowCameraNear=oe.camera.near,O.shadowCameraFar=oe.camera.far,s.pointShadow[w]=O,s.pointShadowMap[w]=fe,s.pointShadowMatrix[w]=D.shadow.matrix,I++}s.point[w]=ce,w++}else if(D.isHemisphereLight){const ce=e.get(D);ce.skyColor.copy(D.color).multiplyScalar(ie),ce.groundColor.copy(D.groundColor).multiplyScalar(ie),s.hemi[_]=ce,_++}}E>0&&(n.has("OES_texture_float_linear")===!0?(s.rectAreaLTC1=Pe.LTC_FLOAT_1,s.rectAreaLTC2=Pe.LTC_FLOAT_2):(s.rectAreaLTC1=Pe.LTC_HALF_1,s.rectAreaLTC2=Pe.LTC_HALF_2)),s.ambient[0]=v,s.ambient[1]=g,s.ambient[2]=y;const Y=s.hash;(Y.directionalLength!==x||Y.pointLength!==w||Y.spotLength!==A||Y.rectAreaLength!==E||Y.hemiLength!==_||Y.numDirectionalShadows!==N||Y.numPointShadows!==I||Y.numSpotShadows!==R||Y.numSpotMaps!==k||Y.numLightProbes!==H)&&(s.directional.length=x,s.spot.length=A,s.rectArea.length=E,s.point.length=w,s.hemi.length=_,s.directionalShadow.length=N,s.directionalShadowMap.length=N,s.pointShadow.length=I,s.pointShadowMap.length=I,s.spotShadow.length=R,s.spotShadowMap.length=R,s.directionalShadowMatrix.length=N,s.pointShadowMatrix.length=I,s.spotLightMatrix.length=R+k-B,s.spotLightMap.length=k,s.numSpotLightShadowsWithMaps=B,s.numLightProbes=H,Y.directionalLength=x,Y.pointLength=w,Y.spotLength=A,Y.rectAreaLength=E,Y.hemiLength=_,Y.numDirectionalShadows=N,Y.numPointShadows=I,Y.numSpotShadows=R,Y.numSpotMaps=k,Y.numLightProbes=H,s.version=FC++)}function f(p,v){let g=0,y=0,x=0,w=0,A=0;const E=v.matrixWorldInverse;for(let _=0,N=p.length;_<N;_++){const I=p[_];if(I.isDirectionalLight){const R=s.directional[g];R.direction.setFromMatrixPosition(I.matrixWorld),o.setFromMatrixPosition(I.target.matrixWorld),R.direction.sub(o),R.direction.transformDirection(E),g++}else if(I.isSpotLight){const R=s.spot[x];R.position.setFromMatrixPosition(I.matrixWorld),R.position.applyMatrix4(E),R.direction.setFromMatrixPosition(I.matrixWorld),o.setFromMatrixPosition(I.target.matrixWorld),R.direction.sub(o),R.direction.transformDirection(E),x++}else if(I.isRectAreaLight){const R=s.rectArea[w];R.position.setFromMatrixPosition(I.matrixWorld),R.position.applyMatrix4(E),u.identity(),l.copy(I.matrixWorld),l.premultiply(E),u.extractRotation(l),R.halfWidth.set(I.width*.5,0,0),R.halfHeight.set(0,I.height*.5,0),R.halfWidth.applyMatrix4(u),R.halfHeight.applyMatrix4(u),w++}else if(I.isPointLight){const R=s.point[y];R.position.setFromMatrixPosition(I.matrixWorld),R.position.applyMatrix4(E),y++}else if(I.isHemisphereLight){const R=s.hemi[A];R.direction.setFromMatrixPosition(I.matrixWorld),R.direction.transformDirection(E),A++}}}return{setup:d,setupView:f,state:s}}function Bg(n){const e=new zC(n),t=[],s=[];function o(v){p.camera=v,t.length=0,s.length=0}function l(v){t.push(v)}function u(v){s.push(v)}function d(){e.setup(t)}function f(v){e.setupView(t,v)}const p={lightsArray:t,shadowsArray:s,camera:null,lights:e,transmissionRenderTarget:{}};return{init:o,state:p,setupLights:d,setupLightsView:f,pushLight:l,pushShadow:u}}function BC(n){let e=new WeakMap;function t(o,l=0){const u=e.get(o);let d;return u===void 0?(d=new Bg(n),e.set(o,[d])):l>=u.length?(d=new Bg(n),u.push(d)):d=u[l],d}function s(){e=new WeakMap}return{get:t,dispose:s}}const HC=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,VC=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function GC(n,e,t){let s=new Ff;const o=new Lt,l=new Lt,u=new Kt,d=new cw({depthPacking:lM}),f=new uw,p={},v=t.maxTextureSize,g={[Wr]:Vn,[Vn]:Wr,[ir]:ir},y=new jr({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Lt},radius:{value:4}},vertexShader:HC,fragmentShader:VC}),x=y.clone();x.defines.HORIZONTAL_PASS=1;const w=new $r;w.setAttribute("position",new Fi(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const A=new di(w,y),E=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=d_;let _=this.type;this.render=function(B,H,Y){if(E.enabled===!1||E.autoUpdate===!1&&E.needsUpdate===!1||B.length===0)return;const b=n.getRenderTarget(),C=n.getActiveCubeFace(),D=n.getActiveMipmapLevel(),de=n.state;de.setBlending(Fr),de.buffers.depth.getReversed()?de.buffers.color.setClear(0,0,0,0):de.buffers.color.setClear(1,1,1,1),de.buffers.depth.setTest(!0),de.setScissorTest(!1);const ie=_!==nr&&this.type===nr,le=_===nr&&this.type!==nr;for(let fe=0,ce=B.length;fe<ce;fe++){const oe=B[fe],O=oe.shadow;if(O===void 0){console.warn("THREE.WebGLShadowMap:",oe,"has no shadow.");continue}if(O.autoUpdate===!1&&O.needsUpdate===!1)continue;o.copy(O.mapSize);const ae=O.getFrameExtents();if(o.multiply(ae),l.copy(O.mapSize),(o.x>v||o.y>v)&&(o.x>v&&(l.x=Math.floor(v/ae.x),o.x=l.x*ae.x,O.mapSize.x=l.x),o.y>v&&(l.y=Math.floor(v/ae.y),o.y=l.y*ae.y,O.mapSize.y=l.y)),O.map===null||ie===!0||le===!0){const U=this.type!==nr?{minFilter:Ai,magFilter:Ai}:{};O.map!==null&&O.map.dispose(),O.map=new Xr(o.x,o.y,U),O.map.texture.name=oe.name+".shadowMap",O.camera.updateProjectionMatrix()}n.setRenderTarget(O.map),n.clear();const se=O.getViewportCount();for(let U=0;U<se;U++){const J=O.getViewport(U);u.set(l.x*J.x,l.y*J.y,l.x*J.z,l.y*J.w),de.viewport(u),O.updateMatrices(oe,U),s=O.getFrustum(),R(H,Y,O.camera,oe,this.type)}O.isPointLightShadow!==!0&&this.type===nr&&N(O,Y),O.needsUpdate=!1}_=this.type,E.needsUpdate=!1,n.setRenderTarget(b,C,D)};function N(B,H){const Y=e.update(A);y.defines.VSM_SAMPLES!==B.blurSamples&&(y.defines.VSM_SAMPLES=B.blurSamples,x.defines.VSM_SAMPLES=B.blurSamples,y.needsUpdate=!0,x.needsUpdate=!0),B.mapPass===null&&(B.mapPass=new Xr(o.x,o.y)),y.uniforms.shadow_pass.value=B.map.texture,y.uniforms.resolution.value=B.mapSize,y.uniforms.radius.value=B.radius,n.setRenderTarget(B.mapPass),n.clear(),n.renderBufferDirect(H,null,Y,y,A,null),x.uniforms.shadow_pass.value=B.mapPass.texture,x.uniforms.resolution.value=B.mapSize,x.uniforms.radius.value=B.radius,n.setRenderTarget(B.map),n.clear(),n.renderBufferDirect(H,null,Y,x,A,null)}function I(B,H,Y,b){let C=null;const D=Y.isPointLight===!0?B.customDistanceMaterial:B.customDepthMaterial;if(D!==void 0)C=D;else if(C=Y.isPointLight===!0?f:d,n.localClippingEnabled&&H.clipShadows===!0&&Array.isArray(H.clippingPlanes)&&H.clippingPlanes.length!==0||H.displacementMap&&H.displacementScale!==0||H.alphaMap&&H.alphaTest>0||H.map&&H.alphaTest>0||H.alphaToCoverage===!0){const de=C.uuid,ie=H.uuid;let le=p[de];le===void 0&&(le={},p[de]=le);let fe=le[ie];fe===void 0&&(fe=C.clone(),le[ie]=fe,H.addEventListener("dispose",k)),C=fe}if(C.visible=H.visible,C.wireframe=H.wireframe,b===nr?C.side=H.shadowSide!==null?H.shadowSide:H.side:C.side=H.shadowSide!==null?H.shadowSide:g[H.side],C.alphaMap=H.alphaMap,C.alphaTest=H.alphaToCoverage===!0?.5:H.alphaTest,C.map=H.map,C.clipShadows=H.clipShadows,C.clippingPlanes=H.clippingPlanes,C.clipIntersection=H.clipIntersection,C.displacementMap=H.displacementMap,C.displacementScale=H.displacementScale,C.displacementBias=H.displacementBias,C.wireframeLinewidth=H.wireframeLinewidth,C.linewidth=H.linewidth,Y.isPointLight===!0&&C.isMeshDistanceMaterial===!0){const de=n.properties.get(C);de.light=Y}return C}function R(B,H,Y,b,C){if(B.visible===!1)return;if(B.layers.test(H.layers)&&(B.isMesh||B.isLine||B.isPoints)&&(B.castShadow||B.receiveShadow&&C===nr)&&(!B.frustumCulled||s.intersectsObject(B))){B.modelViewMatrix.multiplyMatrices(Y.matrixWorldInverse,B.matrixWorld);const ie=e.update(B),le=B.material;if(Array.isArray(le)){const fe=ie.groups;for(let ce=0,oe=fe.length;ce<oe;ce++){const O=fe[ce],ae=le[O.materialIndex];if(ae&&ae.visible){const se=I(B,ae,b,C);B.onBeforeShadow(n,B,H,Y,ie,se,O),n.renderBufferDirect(Y,null,ie,se,B,O),B.onAfterShadow(n,B,H,Y,ie,se,O)}}}else if(le.visible){const fe=I(B,le,b,C);B.onBeforeShadow(n,B,H,Y,ie,fe,null),n.renderBufferDirect(Y,null,ie,fe,B,null),B.onAfterShadow(n,B,H,Y,ie,fe,null)}}const de=B.children;for(let ie=0,le=de.length;ie<le;ie++)R(de[ie],H,Y,b,C)}function k(B){B.target.removeEventListener("dispose",k);for(const Y in p){const b=p[Y],C=B.target.uuid;C in b&&(b[C].dispose(),delete b[C])}}}const WC={[Rh]:bh,[Ph]:Uh,[Lh]:Dh,[wo]:Ih,[bh]:Rh,[Uh]:Ph,[Dh]:Lh,[Ih]:wo};function XC(n,e){function t(){let G=!1;const Ee=new Kt;let Ce=null;const Ue=new Kt(0,0,0,0);return{setMask:function(xe){Ce!==xe&&!G&&(n.colorMask(xe,xe,xe,xe),Ce=xe)},setLocked:function(xe){G=xe},setClear:function(xe,pe,Ge,at,Rt){Rt===!0&&(xe*=at,pe*=at,Ge*=at),Ee.set(xe,pe,Ge,at),Ue.equals(Ee)===!1&&(n.clearColor(xe,pe,Ge,at),Ue.copy(Ee))},reset:function(){G=!1,Ce=null,Ue.set(-1,0,0,0)}}}function s(){let G=!1,Ee=!1,Ce=null,Ue=null,xe=null;return{setReversed:function(pe){if(Ee!==pe){const Ge=e.get("EXT_clip_control");pe?Ge.clipControlEXT(Ge.LOWER_LEFT_EXT,Ge.ZERO_TO_ONE_EXT):Ge.clipControlEXT(Ge.LOWER_LEFT_EXT,Ge.NEGATIVE_ONE_TO_ONE_EXT),Ee=pe;const at=xe;xe=null,this.setClear(at)}},getReversed:function(){return Ee},setTest:function(pe){pe?ne(n.DEPTH_TEST):_e(n.DEPTH_TEST)},setMask:function(pe){Ce!==pe&&!G&&(n.depthMask(pe),Ce=pe)},setFunc:function(pe){if(Ee&&(pe=WC[pe]),Ue!==pe){switch(pe){case Rh:n.depthFunc(n.NEVER);break;case bh:n.depthFunc(n.ALWAYS);break;case Ph:n.depthFunc(n.LESS);break;case wo:n.depthFunc(n.LEQUAL);break;case Lh:n.depthFunc(n.EQUAL);break;case Ih:n.depthFunc(n.GEQUAL);break;case Uh:n.depthFunc(n.GREATER);break;case Dh:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}Ue=pe}},setLocked:function(pe){G=pe},setClear:function(pe){xe!==pe&&(Ee&&(pe=1-pe),n.clearDepth(pe),xe=pe)},reset:function(){G=!1,Ce=null,Ue=null,xe=null,Ee=!1}}}function o(){let G=!1,Ee=null,Ce=null,Ue=null,xe=null,pe=null,Ge=null,at=null,Rt=null;return{setTest:function(yt){G||(yt?ne(n.STENCIL_TEST):_e(n.STENCIL_TEST))},setMask:function(yt){Ee!==yt&&!G&&(n.stencilMask(yt),Ee=yt)},setFunc:function(yt,ei,_n){(Ce!==yt||Ue!==ei||xe!==_n)&&(n.stencilFunc(yt,ei,_n),Ce=yt,Ue=ei,xe=_n)},setOp:function(yt,ei,_n){(pe!==yt||Ge!==ei||at!==_n)&&(n.stencilOp(yt,ei,_n),pe=yt,Ge=ei,at=_n)},setLocked:function(yt){G=yt},setClear:function(yt){Rt!==yt&&(n.clearStencil(yt),Rt=yt)},reset:function(){G=!1,Ee=null,Ce=null,Ue=null,xe=null,pe=null,Ge=null,at=null,Rt=null}}}const l=new t,u=new s,d=new o,f=new WeakMap,p=new WeakMap;let v={},g={},y=new WeakMap,x=[],w=null,A=!1,E=null,_=null,N=null,I=null,R=null,k=null,B=null,H=new Dt(0,0,0),Y=0,b=!1,C=null,D=null,de=null,ie=null,le=null;const fe=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let ce=!1,oe=0;const O=n.getParameter(n.VERSION);O.indexOf("WebGL")!==-1?(oe=parseFloat(/^WebGL (\d)/.exec(O)[1]),ce=oe>=1):O.indexOf("OpenGL ES")!==-1&&(oe=parseFloat(/^OpenGL ES (\d)/.exec(O)[1]),ce=oe>=2);let ae=null,se={};const U=n.getParameter(n.SCISSOR_BOX),J=n.getParameter(n.VIEWPORT),Oe=new Kt().fromArray(U),Fe=new Kt().fromArray(J);function V(G,Ee,Ce,Ue){const xe=new Uint8Array(4),pe=n.createTexture();n.bindTexture(G,pe),n.texParameteri(G,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(G,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Ge=0;Ge<Ce;Ge++)G===n.TEXTURE_3D||G===n.TEXTURE_2D_ARRAY?n.texImage3D(Ee,0,n.RGBA,1,1,Ue,0,n.RGBA,n.UNSIGNED_BYTE,xe):n.texImage2D(Ee+Ge,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,xe);return pe}const re={};re[n.TEXTURE_2D]=V(n.TEXTURE_2D,n.TEXTURE_2D,1),re[n.TEXTURE_CUBE_MAP]=V(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),re[n.TEXTURE_2D_ARRAY]=V(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),re[n.TEXTURE_3D]=V(n.TEXTURE_3D,n.TEXTURE_3D,1,1),l.setClear(0,0,0,1),u.setClear(1),d.setClear(0),ne(n.DEPTH_TEST),u.setFunc(wo),gt(!1),Ke(Vv),ne(n.CULL_FACE),Et(Fr);function ne(G){v[G]!==!0&&(n.enable(G),v[G]=!0)}function _e(G){v[G]!==!1&&(n.disable(G),v[G]=!1)}function Ae(G,Ee){return g[G]!==Ee?(n.bindFramebuffer(G,Ee),g[G]=Ee,G===n.DRAW_FRAMEBUFFER&&(g[n.FRAMEBUFFER]=Ee),G===n.FRAMEBUFFER&&(g[n.DRAW_FRAMEBUFFER]=Ee),!0):!1}function Ie(G,Ee){let Ce=x,Ue=!1;if(G){Ce=y.get(Ee),Ce===void 0&&(Ce=[],y.set(Ee,Ce));const xe=G.textures;if(Ce.length!==xe.length||Ce[0]!==n.COLOR_ATTACHMENT0){for(let pe=0,Ge=xe.length;pe<Ge;pe++)Ce[pe]=n.COLOR_ATTACHMENT0+pe;Ce.length=xe.length,Ue=!0}}else Ce[0]!==n.BACK&&(Ce[0]=n.BACK,Ue=!0);Ue&&n.drawBuffers(Ce)}function Nt(G){return w!==G?(n.useProgram(G),w=G,!0):!1}const ft={[xs]:n.FUNC_ADD,[NS]:n.FUNC_SUBTRACT,[OS]:n.FUNC_REVERSE_SUBTRACT};ft[FS]=n.MIN,ft[kS]=n.MAX;const F={[zS]:n.ZERO,[BS]:n.ONE,[HS]:n.SRC_COLOR,[Ah]:n.SRC_ALPHA,[YS]:n.SRC_ALPHA_SATURATE,[XS]:n.DST_COLOR,[GS]:n.DST_ALPHA,[VS]:n.ONE_MINUS_SRC_COLOR,[Ch]:n.ONE_MINUS_SRC_ALPHA,[jS]:n.ONE_MINUS_DST_COLOR,[WS]:n.ONE_MINUS_DST_ALPHA,[$S]:n.CONSTANT_COLOR,[qS]:n.ONE_MINUS_CONSTANT_COLOR,[KS]:n.CONSTANT_ALPHA,[ZS]:n.ONE_MINUS_CONSTANT_ALPHA};function Et(G,Ee,Ce,Ue,xe,pe,Ge,at,Rt,yt){if(G===Fr){A===!0&&(_e(n.BLEND),A=!1);return}if(A===!1&&(ne(n.BLEND),A=!0),G!==DS){if(G!==E||yt!==b){if((_!==xs||R!==xs)&&(n.blendEquation(n.FUNC_ADD),_=xs,R=xs),yt)switch(G){case xo:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Gv:n.blendFunc(n.ONE,n.ONE);break;case Wv:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Xv:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",G);break}else switch(G){case xo:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Gv:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case Wv:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Xv:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",G);break}N=null,I=null,k=null,B=null,H.set(0,0,0),Y=0,E=G,b=yt}return}xe=xe||Ee,pe=pe||Ce,Ge=Ge||Ue,(Ee!==_||xe!==R)&&(n.blendEquationSeparate(ft[Ee],ft[xe]),_=Ee,R=xe),(Ce!==N||Ue!==I||pe!==k||Ge!==B)&&(n.blendFuncSeparate(F[Ce],F[Ue],F[pe],F[Ge]),N=Ce,I=Ue,k=pe,B=Ge),(at.equals(H)===!1||Rt!==Y)&&(n.blendColor(at.r,at.g,at.b,Rt),H.copy(at),Y=Rt),E=G,b=!1}function Xe(G,Ee){G.side===ir?_e(n.CULL_FACE):ne(n.CULL_FACE);let Ce=G.side===Vn;Ee&&(Ce=!Ce),gt(Ce),G.blending===xo&&G.transparent===!1?Et(Fr):Et(G.blending,G.blendEquation,G.blendSrc,G.blendDst,G.blendEquationAlpha,G.blendSrcAlpha,G.blendDstAlpha,G.blendColor,G.blendAlpha,G.premultipliedAlpha),u.setFunc(G.depthFunc),u.setTest(G.depthTest),u.setMask(G.depthWrite),l.setMask(G.colorWrite);const Ue=G.stencilWrite;d.setTest(Ue),Ue&&(d.setMask(G.stencilWriteMask),d.setFunc(G.stencilFunc,G.stencilRef,G.stencilFuncMask),d.setOp(G.stencilFail,G.stencilZFail,G.stencilZPass)),ke(G.polygonOffset,G.polygonOffsetFactor,G.polygonOffsetUnits),G.alphaToCoverage===!0?ne(n.SAMPLE_ALPHA_TO_COVERAGE):_e(n.SAMPLE_ALPHA_TO_COVERAGE)}function gt(G){C!==G&&(G?n.frontFace(n.CW):n.frontFace(n.CCW),C=G)}function Ke(G){G!==LS?(ne(n.CULL_FACE),G!==D&&(G===Vv?n.cullFace(n.BACK):G===IS?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):_e(n.CULL_FACE),D=G}function Ot(G){G!==de&&(ce&&n.lineWidth(G),de=G)}function ke(G,Ee,Ce){G?(ne(n.POLYGON_OFFSET_FILL),(ie!==Ee||le!==Ce)&&(n.polygonOffset(Ee,Ce),ie=Ee,le=Ce)):_e(n.POLYGON_OFFSET_FILL)}function lt(G){G?ne(n.SCISSOR_TEST):_e(n.SCISSOR_TEST)}function Bt(G){G===void 0&&(G=n.TEXTURE0+fe-1),ae!==G&&(n.activeTexture(G),ae=G)}function Ht(G,Ee,Ce){Ce===void 0&&(ae===null?Ce=n.TEXTURE0+fe-1:Ce=ae);let Ue=se[Ce];Ue===void 0&&(Ue={type:void 0,texture:void 0},se[Ce]=Ue),(Ue.type!==G||Ue.texture!==Ee)&&(ae!==Ce&&(n.activeTexture(Ce),ae=Ce),n.bindTexture(G,Ee||re[G]),Ue.type=G,Ue.texture=Ee)}function P(){const G=se[ae];G!==void 0&&G.type!==void 0&&(n.bindTexture(G.type,null),G.type=void 0,G.texture=void 0)}function M(){try{n.compressedTexImage2D(...arguments)}catch(G){console.error("THREE.WebGLState:",G)}}function q(){try{n.compressedTexImage3D(...arguments)}catch(G){console.error("THREE.WebGLState:",G)}}function he(){try{n.texSubImage2D(...arguments)}catch(G){console.error("THREE.WebGLState:",G)}}function ge(){try{n.texSubImage3D(...arguments)}catch(G){console.error("THREE.WebGLState:",G)}}function ue(){try{n.compressedTexSubImage2D(...arguments)}catch(G){console.error("THREE.WebGLState:",G)}}function $e(){try{n.compressedTexSubImage3D(...arguments)}catch(G){console.error("THREE.WebGLState:",G)}}function Te(){try{n.texStorage2D(...arguments)}catch(G){console.error("THREE.WebGLState:",G)}}function Be(){try{n.texStorage3D(...arguments)}catch(G){console.error("THREE.WebGLState:",G)}}function qe(){try{n.texImage2D(...arguments)}catch(G){console.error("THREE.WebGLState:",G)}}function Me(){try{n.texImage3D(...arguments)}catch(G){console.error("THREE.WebGLState:",G)}}function Le(G){Oe.equals(G)===!1&&(n.scissor(G.x,G.y,G.z,G.w),Oe.copy(G))}function it(G){Fe.equals(G)===!1&&(n.viewport(G.x,G.y,G.z,G.w),Fe.copy(G))}function je(G,Ee){let Ce=p.get(Ee);Ce===void 0&&(Ce=new WeakMap,p.set(Ee,Ce));let Ue=Ce.get(G);Ue===void 0&&(Ue=n.getUniformBlockIndex(Ee,G.name),Ce.set(G,Ue))}function Re(G,Ee){const Ue=p.get(Ee).get(G);f.get(Ee)!==Ue&&(n.uniformBlockBinding(Ee,Ue,G.__bindingPointIndex),f.set(Ee,Ue))}function ct(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),u.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),v={},ae=null,se={},g={},y=new WeakMap,x=[],w=null,A=!1,E=null,_=null,N=null,I=null,R=null,k=null,B=null,H=new Dt(0,0,0),Y=0,b=!1,C=null,D=null,de=null,ie=null,le=null,Oe.set(0,0,n.canvas.width,n.canvas.height),Fe.set(0,0,n.canvas.width,n.canvas.height),l.reset(),u.reset(),d.reset()}return{buffers:{color:l,depth:u,stencil:d},enable:ne,disable:_e,bindFramebuffer:Ae,drawBuffers:Ie,useProgram:Nt,setBlending:Et,setMaterial:Xe,setFlipSided:gt,setCullFace:Ke,setLineWidth:Ot,setPolygonOffset:ke,setScissorTest:lt,activeTexture:Bt,bindTexture:Ht,unbindTexture:P,compressedTexImage2D:M,compressedTexImage3D:q,texImage2D:qe,texImage3D:Me,updateUBOMapping:je,uniformBlockBinding:Re,texStorage2D:Te,texStorage3D:Be,texSubImage2D:he,texSubImage3D:ge,compressedTexSubImage2D:ue,compressedTexSubImage3D:$e,scissor:Le,viewport:it,reset:ct}}function jC(n,e,t,s,o,l,u){const d=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,f=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),p=new Lt,v=new WeakMap;let g;const y=new WeakMap;let x=!1;try{x=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function w(P,M){return x?new OffscreenCanvas(P,M):Fa("canvas")}function A(P,M,q){let he=1;const ge=Ht(P);if((ge.width>q||ge.height>q)&&(he=q/Math.max(ge.width,ge.height)),he<1)if(typeof HTMLImageElement<"u"&&P instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&P instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&P instanceof ImageBitmap||typeof VideoFrame<"u"&&P instanceof VideoFrame){const ue=Math.floor(he*ge.width),$e=Math.floor(he*ge.height);g===void 0&&(g=w(ue,$e));const Te=M?w(ue,$e):g;return Te.width=ue,Te.height=$e,Te.getContext("2d").drawImage(P,0,0,ue,$e),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+ge.width+"x"+ge.height+") to ("+ue+"x"+$e+")."),Te}else return"data"in P&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+ge.width+"x"+ge.height+")."),P;return P}function E(P){return P.generateMipmaps}function _(P){n.generateMipmap(P)}function N(P){return P.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:P.isWebGL3DRenderTarget?n.TEXTURE_3D:P.isWebGLArrayRenderTarget||P.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function I(P,M,q,he,ge=!1){if(P!==null){if(n[P]!==void 0)return n[P];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+P+"'")}let ue=M;if(M===n.RED&&(q===n.FLOAT&&(ue=n.R32F),q===n.HALF_FLOAT&&(ue=n.R16F),q===n.UNSIGNED_BYTE&&(ue=n.R8)),M===n.RED_INTEGER&&(q===n.UNSIGNED_BYTE&&(ue=n.R8UI),q===n.UNSIGNED_SHORT&&(ue=n.R16UI),q===n.UNSIGNED_INT&&(ue=n.R32UI),q===n.BYTE&&(ue=n.R8I),q===n.SHORT&&(ue=n.R16I),q===n.INT&&(ue=n.R32I)),M===n.RG&&(q===n.FLOAT&&(ue=n.RG32F),q===n.HALF_FLOAT&&(ue=n.RG16F),q===n.UNSIGNED_BYTE&&(ue=n.RG8)),M===n.RG_INTEGER&&(q===n.UNSIGNED_BYTE&&(ue=n.RG8UI),q===n.UNSIGNED_SHORT&&(ue=n.RG16UI),q===n.UNSIGNED_INT&&(ue=n.RG32UI),q===n.BYTE&&(ue=n.RG8I),q===n.SHORT&&(ue=n.RG16I),q===n.INT&&(ue=n.RG32I)),M===n.RGB_INTEGER&&(q===n.UNSIGNED_BYTE&&(ue=n.RGB8UI),q===n.UNSIGNED_SHORT&&(ue=n.RGB16UI),q===n.UNSIGNED_INT&&(ue=n.RGB32UI),q===n.BYTE&&(ue=n.RGB8I),q===n.SHORT&&(ue=n.RGB16I),q===n.INT&&(ue=n.RGB32I)),M===n.RGBA_INTEGER&&(q===n.UNSIGNED_BYTE&&(ue=n.RGBA8UI),q===n.UNSIGNED_SHORT&&(ue=n.RGBA16UI),q===n.UNSIGNED_INT&&(ue=n.RGBA32UI),q===n.BYTE&&(ue=n.RGBA8I),q===n.SHORT&&(ue=n.RGBA16I),q===n.INT&&(ue=n.RGBA32I)),M===n.RGB&&q===n.UNSIGNED_INT_5_9_9_9_REV&&(ue=n.RGB9_E5),M===n.RGBA){const $e=ge?zc:Mt.getTransfer(he);q===n.FLOAT&&(ue=n.RGBA32F),q===n.HALF_FLOAT&&(ue=n.RGBA16F),q===n.UNSIGNED_BYTE&&(ue=$e===Ut?n.SRGB8_ALPHA8:n.RGBA8),q===n.UNSIGNED_SHORT_4_4_4_4&&(ue=n.RGBA4),q===n.UNSIGNED_SHORT_5_5_5_1&&(ue=n.RGB5_A1)}return(ue===n.R16F||ue===n.R32F||ue===n.RG16F||ue===n.RG32F||ue===n.RGBA16F||ue===n.RGBA32F)&&e.get("EXT_color_buffer_float"),ue}function R(P,M){let q;return P?M===null||M===ws||M===Ua?q=n.DEPTH24_STENCIL8:M===rr?q=n.DEPTH32F_STENCIL8:M===Ia&&(q=n.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):M===null||M===ws||M===Ua?q=n.DEPTH_COMPONENT24:M===rr?q=n.DEPTH_COMPONENT32F:M===Ia&&(q=n.DEPTH_COMPONENT16),q}function k(P,M){return E(P)===!0||P.isFramebufferTexture&&P.minFilter!==Ai&&P.minFilter!==wi?Math.log2(Math.max(M.width,M.height))+1:P.mipmaps!==void 0&&P.mipmaps.length>0?P.mipmaps.length:P.isCompressedTexture&&Array.isArray(P.image)?M.mipmaps.length:1}function B(P){const M=P.target;M.removeEventListener("dispose",B),Y(M),M.isVideoTexture&&v.delete(M)}function H(P){const M=P.target;M.removeEventListener("dispose",H),C(M)}function Y(P){const M=s.get(P);if(M.__webglInit===void 0)return;const q=P.source,he=y.get(q);if(he){const ge=he[M.__cacheKey];ge.usedTimes--,ge.usedTimes===0&&b(P),Object.keys(he).length===0&&y.delete(q)}s.remove(P)}function b(P){const M=s.get(P);n.deleteTexture(M.__webglTexture);const q=P.source,he=y.get(q);delete he[M.__cacheKey],u.memory.textures--}function C(P){const M=s.get(P);if(P.depthTexture&&(P.depthTexture.dispose(),s.remove(P.depthTexture)),P.isWebGLCubeRenderTarget)for(let he=0;he<6;he++){if(Array.isArray(M.__webglFramebuffer[he]))for(let ge=0;ge<M.__webglFramebuffer[he].length;ge++)n.deleteFramebuffer(M.__webglFramebuffer[he][ge]);else n.deleteFramebuffer(M.__webglFramebuffer[he]);M.__webglDepthbuffer&&n.deleteRenderbuffer(M.__webglDepthbuffer[he])}else{if(Array.isArray(M.__webglFramebuffer))for(let he=0;he<M.__webglFramebuffer.length;he++)n.deleteFramebuffer(M.__webglFramebuffer[he]);else n.deleteFramebuffer(M.__webglFramebuffer);if(M.__webglDepthbuffer&&n.deleteRenderbuffer(M.__webglDepthbuffer),M.__webglMultisampledFramebuffer&&n.deleteFramebuffer(M.__webglMultisampledFramebuffer),M.__webglColorRenderbuffer)for(let he=0;he<M.__webglColorRenderbuffer.length;he++)M.__webglColorRenderbuffer[he]&&n.deleteRenderbuffer(M.__webglColorRenderbuffer[he]);M.__webglDepthRenderbuffer&&n.deleteRenderbuffer(M.__webglDepthRenderbuffer)}const q=P.textures;for(let he=0,ge=q.length;he<ge;he++){const ue=s.get(q[he]);ue.__webglTexture&&(n.deleteTexture(ue.__webglTexture),u.memory.textures--),s.remove(q[he])}s.remove(P)}let D=0;function de(){D=0}function ie(){const P=D;return P>=o.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+P+" texture units while this GPU supports only "+o.maxTextures),D+=1,P}function le(P){const M=[];return M.push(P.wrapS),M.push(P.wrapT),M.push(P.wrapR||0),M.push(P.magFilter),M.push(P.minFilter),M.push(P.anisotropy),M.push(P.internalFormat),M.push(P.format),M.push(P.type),M.push(P.generateMipmaps),M.push(P.premultiplyAlpha),M.push(P.flipY),M.push(P.unpackAlignment),M.push(P.colorSpace),M.join()}function fe(P,M){const q=s.get(P);if(P.isVideoTexture&&lt(P),P.isRenderTargetTexture===!1&&P.isExternalTexture!==!0&&P.version>0&&q.__version!==P.version){const he=P.image;if(he===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(he.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{re(q,P,M);return}}else P.isExternalTexture&&(q.__webglTexture=P.sourceTexture?P.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,q.__webglTexture,n.TEXTURE0+M)}function ce(P,M){const q=s.get(P);if(P.isRenderTargetTexture===!1&&P.version>0&&q.__version!==P.version){re(q,P,M);return}t.bindTexture(n.TEXTURE_2D_ARRAY,q.__webglTexture,n.TEXTURE0+M)}function oe(P,M){const q=s.get(P);if(P.isRenderTargetTexture===!1&&P.version>0&&q.__version!==P.version){re(q,P,M);return}t.bindTexture(n.TEXTURE_3D,q.__webglTexture,n.TEXTURE0+M)}function O(P,M){const q=s.get(P);if(P.version>0&&q.__version!==P.version){ne(q,P,M);return}t.bindTexture(n.TEXTURE_CUBE_MAP,q.__webglTexture,n.TEXTURE0+M)}const ae={[Fh]:n.REPEAT,[Ms]:n.CLAMP_TO_EDGE,[kh]:n.MIRRORED_REPEAT},se={[Ai]:n.NEAREST,[oM]:n.NEAREST_MIPMAP_NEAREST,[ec]:n.NEAREST_MIPMAP_LINEAR,[wi]:n.LINEAR,[$d]:n.LINEAR_MIPMAP_NEAREST,[Or]:n.LINEAR_MIPMAP_LINEAR},U={[dM]:n.NEVER,[gM]:n.ALWAYS,[hM]:n.LESS,[M_]:n.LEQUAL,[fM]:n.EQUAL,[vM]:n.GEQUAL,[pM]:n.GREATER,[mM]:n.NOTEQUAL};function J(P,M){if(M.type===rr&&e.has("OES_texture_float_linear")===!1&&(M.magFilter===wi||M.magFilter===$d||M.magFilter===ec||M.magFilter===Or||M.minFilter===wi||M.minFilter===$d||M.minFilter===ec||M.minFilter===Or)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(P,n.TEXTURE_WRAP_S,ae[M.wrapS]),n.texParameteri(P,n.TEXTURE_WRAP_T,ae[M.wrapT]),(P===n.TEXTURE_3D||P===n.TEXTURE_2D_ARRAY)&&n.texParameteri(P,n.TEXTURE_WRAP_R,ae[M.wrapR]),n.texParameteri(P,n.TEXTURE_MAG_FILTER,se[M.magFilter]),n.texParameteri(P,n.TEXTURE_MIN_FILTER,se[M.minFilter]),M.compareFunction&&(n.texParameteri(P,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(P,n.TEXTURE_COMPARE_FUNC,U[M.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(M.magFilter===Ai||M.minFilter!==ec&&M.minFilter!==Or||M.type===rr&&e.has("OES_texture_float_linear")===!1)return;if(M.anisotropy>1||s.get(M).__currentAnisotropy){const q=e.get("EXT_texture_filter_anisotropic");n.texParameterf(P,q.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(M.anisotropy,o.getMaxAnisotropy())),s.get(M).__currentAnisotropy=M.anisotropy}}}function Oe(P,M){let q=!1;P.__webglInit===void 0&&(P.__webglInit=!0,M.addEventListener("dispose",B));const he=M.source;let ge=y.get(he);ge===void 0&&(ge={},y.set(he,ge));const ue=le(M);if(ue!==P.__cacheKey){ge[ue]===void 0&&(ge[ue]={texture:n.createTexture(),usedTimes:0},u.memory.textures++,q=!0),ge[ue].usedTimes++;const $e=ge[P.__cacheKey];$e!==void 0&&(ge[P.__cacheKey].usedTimes--,$e.usedTimes===0&&b(M)),P.__cacheKey=ue,P.__webglTexture=ge[ue].texture}return q}function Fe(P,M,q){return Math.floor(Math.floor(P/q)/M)}function V(P,M,q,he){const ue=P.updateRanges;if(ue.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,M.width,M.height,q,he,M.data);else{ue.sort((Me,Le)=>Me.start-Le.start);let $e=0;for(let Me=1;Me<ue.length;Me++){const Le=ue[$e],it=ue[Me],je=Le.start+Le.count,Re=Fe(it.start,M.width,4),ct=Fe(Le.start,M.width,4);it.start<=je+1&&Re===ct&&Fe(it.start+it.count-1,M.width,4)===Re?Le.count=Math.max(Le.count,it.start+it.count-Le.start):(++$e,ue[$e]=it)}ue.length=$e+1;const Te=n.getParameter(n.UNPACK_ROW_LENGTH),Be=n.getParameter(n.UNPACK_SKIP_PIXELS),qe=n.getParameter(n.UNPACK_SKIP_ROWS);n.pixelStorei(n.UNPACK_ROW_LENGTH,M.width);for(let Me=0,Le=ue.length;Me<Le;Me++){const it=ue[Me],je=Math.floor(it.start/4),Re=Math.ceil(it.count/4),ct=je%M.width,G=Math.floor(je/M.width),Ee=Re,Ce=1;n.pixelStorei(n.UNPACK_SKIP_PIXELS,ct),n.pixelStorei(n.UNPACK_SKIP_ROWS,G),t.texSubImage2D(n.TEXTURE_2D,0,ct,G,Ee,Ce,q,he,M.data)}P.clearUpdateRanges(),n.pixelStorei(n.UNPACK_ROW_LENGTH,Te),n.pixelStorei(n.UNPACK_SKIP_PIXELS,Be),n.pixelStorei(n.UNPACK_SKIP_ROWS,qe)}}function re(P,M,q){let he=n.TEXTURE_2D;(M.isDataArrayTexture||M.isCompressedArrayTexture)&&(he=n.TEXTURE_2D_ARRAY),M.isData3DTexture&&(he=n.TEXTURE_3D);const ge=Oe(P,M),ue=M.source;t.bindTexture(he,P.__webglTexture,n.TEXTURE0+q);const $e=s.get(ue);if(ue.version!==$e.__version||ge===!0){t.activeTexture(n.TEXTURE0+q);const Te=Mt.getPrimaries(Mt.workingColorSpace),Be=M.colorSpace===Nr?null:Mt.getPrimaries(M.colorSpace),qe=M.colorSpace===Nr||Te===Be?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,M.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,qe);let Me=A(M.image,!1,o.maxTextureSize);Me=Bt(M,Me);const Le=l.convert(M.format,M.colorSpace),it=l.convert(M.type);let je=I(M.internalFormat,Le,it,M.colorSpace,M.isVideoTexture);J(he,M);let Re;const ct=M.mipmaps,G=M.isVideoTexture!==!0,Ee=$e.__version===void 0||ge===!0,Ce=ue.dataReady,Ue=k(M,Me);if(M.isDepthTexture)je=R(M.format===Na,M.type),Ee&&(G?t.texStorage2D(n.TEXTURE_2D,1,je,Me.width,Me.height):t.texImage2D(n.TEXTURE_2D,0,je,Me.width,Me.height,0,Le,it,null));else if(M.isDataTexture)if(ct.length>0){G&&Ee&&t.texStorage2D(n.TEXTURE_2D,Ue,je,ct[0].width,ct[0].height);for(let xe=0,pe=ct.length;xe<pe;xe++)Re=ct[xe],G?Ce&&t.texSubImage2D(n.TEXTURE_2D,xe,0,0,Re.width,Re.height,Le,it,Re.data):t.texImage2D(n.TEXTURE_2D,xe,je,Re.width,Re.height,0,Le,it,Re.data);M.generateMipmaps=!1}else G?(Ee&&t.texStorage2D(n.TEXTURE_2D,Ue,je,Me.width,Me.height),Ce&&V(M,Me,Le,it)):t.texImage2D(n.TEXTURE_2D,0,je,Me.width,Me.height,0,Le,it,Me.data);else if(M.isCompressedTexture)if(M.isCompressedArrayTexture){G&&Ee&&t.texStorage3D(n.TEXTURE_2D_ARRAY,Ue,je,ct[0].width,ct[0].height,Me.depth);for(let xe=0,pe=ct.length;xe<pe;xe++)if(Re=ct[xe],M.format!==Ti)if(Le!==null)if(G){if(Ce)if(M.layerUpdates.size>0){const Ge=vg(Re.width,Re.height,M.format,M.type);for(const at of M.layerUpdates){const Rt=Re.data.subarray(at*Ge/Re.data.BYTES_PER_ELEMENT,(at+1)*Ge/Re.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,xe,0,0,at,Re.width,Re.height,1,Le,Rt)}M.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,xe,0,0,0,Re.width,Re.height,Me.depth,Le,Re.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,xe,je,Re.width,Re.height,Me.depth,0,Re.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else G?Ce&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,xe,0,0,0,Re.width,Re.height,Me.depth,Le,it,Re.data):t.texImage3D(n.TEXTURE_2D_ARRAY,xe,je,Re.width,Re.height,Me.depth,0,Le,it,Re.data)}else{G&&Ee&&t.texStorage2D(n.TEXTURE_2D,Ue,je,ct[0].width,ct[0].height);for(let xe=0,pe=ct.length;xe<pe;xe++)Re=ct[xe],M.format!==Ti?Le!==null?G?Ce&&t.compressedTexSubImage2D(n.TEXTURE_2D,xe,0,0,Re.width,Re.height,Le,Re.data):t.compressedTexImage2D(n.TEXTURE_2D,xe,je,Re.width,Re.height,0,Re.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):G?Ce&&t.texSubImage2D(n.TEXTURE_2D,xe,0,0,Re.width,Re.height,Le,it,Re.data):t.texImage2D(n.TEXTURE_2D,xe,je,Re.width,Re.height,0,Le,it,Re.data)}else if(M.isDataArrayTexture)if(G){if(Ee&&t.texStorage3D(n.TEXTURE_2D_ARRAY,Ue,je,Me.width,Me.height,Me.depth),Ce)if(M.layerUpdates.size>0){const xe=vg(Me.width,Me.height,M.format,M.type);for(const pe of M.layerUpdates){const Ge=Me.data.subarray(pe*xe/Me.data.BYTES_PER_ELEMENT,(pe+1)*xe/Me.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,pe,Me.width,Me.height,1,Le,it,Ge)}M.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,Me.width,Me.height,Me.depth,Le,it,Me.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,je,Me.width,Me.height,Me.depth,0,Le,it,Me.data);else if(M.isData3DTexture)G?(Ee&&t.texStorage3D(n.TEXTURE_3D,Ue,je,Me.width,Me.height,Me.depth),Ce&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,Me.width,Me.height,Me.depth,Le,it,Me.data)):t.texImage3D(n.TEXTURE_3D,0,je,Me.width,Me.height,Me.depth,0,Le,it,Me.data);else if(M.isFramebufferTexture){if(Ee)if(G)t.texStorage2D(n.TEXTURE_2D,Ue,je,Me.width,Me.height);else{let xe=Me.width,pe=Me.height;for(let Ge=0;Ge<Ue;Ge++)t.texImage2D(n.TEXTURE_2D,Ge,je,xe,pe,0,Le,it,null),xe>>=1,pe>>=1}}else if(ct.length>0){if(G&&Ee){const xe=Ht(ct[0]);t.texStorage2D(n.TEXTURE_2D,Ue,je,xe.width,xe.height)}for(let xe=0,pe=ct.length;xe<pe;xe++)Re=ct[xe],G?Ce&&t.texSubImage2D(n.TEXTURE_2D,xe,0,0,Le,it,Re):t.texImage2D(n.TEXTURE_2D,xe,je,Le,it,Re);M.generateMipmaps=!1}else if(G){if(Ee){const xe=Ht(Me);t.texStorage2D(n.TEXTURE_2D,Ue,je,xe.width,xe.height)}Ce&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,Le,it,Me)}else t.texImage2D(n.TEXTURE_2D,0,je,Le,it,Me);E(M)&&_(he),$e.__version=ue.version,M.onUpdate&&M.onUpdate(M)}P.__version=M.version}function ne(P,M,q){if(M.image.length!==6)return;const he=Oe(P,M),ge=M.source;t.bindTexture(n.TEXTURE_CUBE_MAP,P.__webglTexture,n.TEXTURE0+q);const ue=s.get(ge);if(ge.version!==ue.__version||he===!0){t.activeTexture(n.TEXTURE0+q);const $e=Mt.getPrimaries(Mt.workingColorSpace),Te=M.colorSpace===Nr?null:Mt.getPrimaries(M.colorSpace),Be=M.colorSpace===Nr||$e===Te?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,M.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Be);const qe=M.isCompressedTexture||M.image[0].isCompressedTexture,Me=M.image[0]&&M.image[0].isDataTexture,Le=[];for(let pe=0;pe<6;pe++)!qe&&!Me?Le[pe]=A(M.image[pe],!0,o.maxCubemapSize):Le[pe]=Me?M.image[pe].image:M.image[pe],Le[pe]=Bt(M,Le[pe]);const it=Le[0],je=l.convert(M.format,M.colorSpace),Re=l.convert(M.type),ct=I(M.internalFormat,je,Re,M.colorSpace),G=M.isVideoTexture!==!0,Ee=ue.__version===void 0||he===!0,Ce=ge.dataReady;let Ue=k(M,it);J(n.TEXTURE_CUBE_MAP,M);let xe;if(qe){G&&Ee&&t.texStorage2D(n.TEXTURE_CUBE_MAP,Ue,ct,it.width,it.height);for(let pe=0;pe<6;pe++){xe=Le[pe].mipmaps;for(let Ge=0;Ge<xe.length;Ge++){const at=xe[Ge];M.format!==Ti?je!==null?G?Ce&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,Ge,0,0,at.width,at.height,je,at.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,Ge,ct,at.width,at.height,0,at.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):G?Ce&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,Ge,0,0,at.width,at.height,je,Re,at.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,Ge,ct,at.width,at.height,0,je,Re,at.data)}}}else{if(xe=M.mipmaps,G&&Ee){xe.length>0&&Ue++;const pe=Ht(Le[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,Ue,ct,pe.width,pe.height)}for(let pe=0;pe<6;pe++)if(Me){G?Ce&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,0,0,0,Le[pe].width,Le[pe].height,je,Re,Le[pe].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,0,ct,Le[pe].width,Le[pe].height,0,je,Re,Le[pe].data);for(let Ge=0;Ge<xe.length;Ge++){const Rt=xe[Ge].image[pe].image;G?Ce&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,Ge+1,0,0,Rt.width,Rt.height,je,Re,Rt.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,Ge+1,ct,Rt.width,Rt.height,0,je,Re,Rt.data)}}else{G?Ce&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,0,0,0,je,Re,Le[pe]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,0,ct,je,Re,Le[pe]);for(let Ge=0;Ge<xe.length;Ge++){const at=xe[Ge];G?Ce&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,Ge+1,0,0,je,Re,at.image[pe]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+pe,Ge+1,ct,je,Re,at.image[pe])}}}E(M)&&_(n.TEXTURE_CUBE_MAP),ue.__version=ge.version,M.onUpdate&&M.onUpdate(M)}P.__version=M.version}function _e(P,M,q,he,ge,ue){const $e=l.convert(q.format,q.colorSpace),Te=l.convert(q.type),Be=I(q.internalFormat,$e,Te,q.colorSpace),qe=s.get(M),Me=s.get(q);if(Me.__renderTarget=M,!qe.__hasExternalTextures){const Le=Math.max(1,M.width>>ue),it=Math.max(1,M.height>>ue);ge===n.TEXTURE_3D||ge===n.TEXTURE_2D_ARRAY?t.texImage3D(ge,ue,Be,Le,it,M.depth,0,$e,Te,null):t.texImage2D(ge,ue,Be,Le,it,0,$e,Te,null)}t.bindFramebuffer(n.FRAMEBUFFER,P),ke(M)?d.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,he,ge,Me.__webglTexture,0,Ot(M)):(ge===n.TEXTURE_2D||ge>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&ge<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,he,ge,Me.__webglTexture,ue),t.bindFramebuffer(n.FRAMEBUFFER,null)}function Ae(P,M,q){if(n.bindRenderbuffer(n.RENDERBUFFER,P),M.depthBuffer){const he=M.depthTexture,ge=he&&he.isDepthTexture?he.type:null,ue=R(M.stencilBuffer,ge),$e=M.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,Te=Ot(M);ke(M)?d.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,Te,ue,M.width,M.height):q?n.renderbufferStorageMultisample(n.RENDERBUFFER,Te,ue,M.width,M.height):n.renderbufferStorage(n.RENDERBUFFER,ue,M.width,M.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,$e,n.RENDERBUFFER,P)}else{const he=M.textures;for(let ge=0;ge<he.length;ge++){const ue=he[ge],$e=l.convert(ue.format,ue.colorSpace),Te=l.convert(ue.type),Be=I(ue.internalFormat,$e,Te,ue.colorSpace),qe=Ot(M);q&&ke(M)===!1?n.renderbufferStorageMultisample(n.RENDERBUFFER,qe,Be,M.width,M.height):ke(M)?d.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,qe,Be,M.width,M.height):n.renderbufferStorage(n.RENDERBUFFER,Be,M.width,M.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function Ie(P,M){if(M&&M.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(n.FRAMEBUFFER,P),!(M.depthTexture&&M.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const he=s.get(M.depthTexture);he.__renderTarget=M,(!he.__webglTexture||M.depthTexture.image.width!==M.width||M.depthTexture.image.height!==M.height)&&(M.depthTexture.image.width=M.width,M.depthTexture.image.height=M.height,M.depthTexture.needsUpdate=!0),fe(M.depthTexture,0);const ge=he.__webglTexture,ue=Ot(M);if(M.depthTexture.format===Da)ke(M)?d.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,ge,0,ue):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,ge,0);else if(M.depthTexture.format===Na)ke(M)?d.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,ge,0,ue):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,ge,0);else throw new Error("Unknown depthTexture format")}function Nt(P){const M=s.get(P),q=P.isWebGLCubeRenderTarget===!0;if(M.__boundDepthTexture!==P.depthTexture){const he=P.depthTexture;if(M.__depthDisposeCallback&&M.__depthDisposeCallback(),he){const ge=()=>{delete M.__boundDepthTexture,delete M.__depthDisposeCallback,he.removeEventListener("dispose",ge)};he.addEventListener("dispose",ge),M.__depthDisposeCallback=ge}M.__boundDepthTexture=he}if(P.depthTexture&&!M.__autoAllocateDepthBuffer){if(q)throw new Error("target.depthTexture not supported in Cube render targets");const he=P.texture.mipmaps;he&&he.length>0?Ie(M.__webglFramebuffer[0],P):Ie(M.__webglFramebuffer,P)}else if(q){M.__webglDepthbuffer=[];for(let he=0;he<6;he++)if(t.bindFramebuffer(n.FRAMEBUFFER,M.__webglFramebuffer[he]),M.__webglDepthbuffer[he]===void 0)M.__webglDepthbuffer[he]=n.createRenderbuffer(),Ae(M.__webglDepthbuffer[he],P,!1);else{const ge=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ue=M.__webglDepthbuffer[he];n.bindRenderbuffer(n.RENDERBUFFER,ue),n.framebufferRenderbuffer(n.FRAMEBUFFER,ge,n.RENDERBUFFER,ue)}}else{const he=P.texture.mipmaps;if(he&&he.length>0?t.bindFramebuffer(n.FRAMEBUFFER,M.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,M.__webglFramebuffer),M.__webglDepthbuffer===void 0)M.__webglDepthbuffer=n.createRenderbuffer(),Ae(M.__webglDepthbuffer,P,!1);else{const ge=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ue=M.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,ue),n.framebufferRenderbuffer(n.FRAMEBUFFER,ge,n.RENDERBUFFER,ue)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function ft(P,M,q){const he=s.get(P);M!==void 0&&_e(he.__webglFramebuffer,P,P.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),q!==void 0&&Nt(P)}function F(P){const M=P.texture,q=s.get(P),he=s.get(M);P.addEventListener("dispose",H);const ge=P.textures,ue=P.isWebGLCubeRenderTarget===!0,$e=ge.length>1;if($e||(he.__webglTexture===void 0&&(he.__webglTexture=n.createTexture()),he.__version=M.version,u.memory.textures++),ue){q.__webglFramebuffer=[];for(let Te=0;Te<6;Te++)if(M.mipmaps&&M.mipmaps.length>0){q.__webglFramebuffer[Te]=[];for(let Be=0;Be<M.mipmaps.length;Be++)q.__webglFramebuffer[Te][Be]=n.createFramebuffer()}else q.__webglFramebuffer[Te]=n.createFramebuffer()}else{if(M.mipmaps&&M.mipmaps.length>0){q.__webglFramebuffer=[];for(let Te=0;Te<M.mipmaps.length;Te++)q.__webglFramebuffer[Te]=n.createFramebuffer()}else q.__webglFramebuffer=n.createFramebuffer();if($e)for(let Te=0,Be=ge.length;Te<Be;Te++){const qe=s.get(ge[Te]);qe.__webglTexture===void 0&&(qe.__webglTexture=n.createTexture(),u.memory.textures++)}if(P.samples>0&&ke(P)===!1){q.__webglMultisampledFramebuffer=n.createFramebuffer(),q.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,q.__webglMultisampledFramebuffer);for(let Te=0;Te<ge.length;Te++){const Be=ge[Te];q.__webglColorRenderbuffer[Te]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,q.__webglColorRenderbuffer[Te]);const qe=l.convert(Be.format,Be.colorSpace),Me=l.convert(Be.type),Le=I(Be.internalFormat,qe,Me,Be.colorSpace,P.isXRRenderTarget===!0),it=Ot(P);n.renderbufferStorageMultisample(n.RENDERBUFFER,it,Le,P.width,P.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Te,n.RENDERBUFFER,q.__webglColorRenderbuffer[Te])}n.bindRenderbuffer(n.RENDERBUFFER,null),P.depthBuffer&&(q.__webglDepthRenderbuffer=n.createRenderbuffer(),Ae(q.__webglDepthRenderbuffer,P,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(ue){t.bindTexture(n.TEXTURE_CUBE_MAP,he.__webglTexture),J(n.TEXTURE_CUBE_MAP,M);for(let Te=0;Te<6;Te++)if(M.mipmaps&&M.mipmaps.length>0)for(let Be=0;Be<M.mipmaps.length;Be++)_e(q.__webglFramebuffer[Te][Be],P,M,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+Te,Be);else _e(q.__webglFramebuffer[Te],P,M,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+Te,0);E(M)&&_(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if($e){for(let Te=0,Be=ge.length;Te<Be;Te++){const qe=ge[Te],Me=s.get(qe);let Le=n.TEXTURE_2D;(P.isWebGL3DRenderTarget||P.isWebGLArrayRenderTarget)&&(Le=P.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(Le,Me.__webglTexture),J(Le,qe),_e(q.__webglFramebuffer,P,qe,n.COLOR_ATTACHMENT0+Te,Le,0),E(qe)&&_(Le)}t.unbindTexture()}else{let Te=n.TEXTURE_2D;if((P.isWebGL3DRenderTarget||P.isWebGLArrayRenderTarget)&&(Te=P.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(Te,he.__webglTexture),J(Te,M),M.mipmaps&&M.mipmaps.length>0)for(let Be=0;Be<M.mipmaps.length;Be++)_e(q.__webglFramebuffer[Be],P,M,n.COLOR_ATTACHMENT0,Te,Be);else _e(q.__webglFramebuffer,P,M,n.COLOR_ATTACHMENT0,Te,0);E(M)&&_(Te),t.unbindTexture()}P.depthBuffer&&Nt(P)}function Et(P){const M=P.textures;for(let q=0,he=M.length;q<he;q++){const ge=M[q];if(E(ge)){const ue=N(P),$e=s.get(ge).__webglTexture;t.bindTexture(ue,$e),_(ue),t.unbindTexture()}}}const Xe=[],gt=[];function Ke(P){if(P.samples>0){if(ke(P)===!1){const M=P.textures,q=P.width,he=P.height;let ge=n.COLOR_BUFFER_BIT;const ue=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,$e=s.get(P),Te=M.length>1;if(Te)for(let qe=0;qe<M.length;qe++)t.bindFramebuffer(n.FRAMEBUFFER,$e.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+qe,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,$e.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+qe,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,$e.__webglMultisampledFramebuffer);const Be=P.texture.mipmaps;Be&&Be.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,$e.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,$e.__webglFramebuffer);for(let qe=0;qe<M.length;qe++){if(P.resolveDepthBuffer&&(P.depthBuffer&&(ge|=n.DEPTH_BUFFER_BIT),P.stencilBuffer&&P.resolveStencilBuffer&&(ge|=n.STENCIL_BUFFER_BIT)),Te){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,$e.__webglColorRenderbuffer[qe]);const Me=s.get(M[qe]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,Me,0)}n.blitFramebuffer(0,0,q,he,0,0,q,he,ge,n.NEAREST),f===!0&&(Xe.length=0,gt.length=0,Xe.push(n.COLOR_ATTACHMENT0+qe),P.depthBuffer&&P.resolveDepthBuffer===!1&&(Xe.push(ue),gt.push(ue),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,gt)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,Xe))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),Te)for(let qe=0;qe<M.length;qe++){t.bindFramebuffer(n.FRAMEBUFFER,$e.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+qe,n.RENDERBUFFER,$e.__webglColorRenderbuffer[qe]);const Me=s.get(M[qe]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,$e.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+qe,n.TEXTURE_2D,Me,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,$e.__webglMultisampledFramebuffer)}else if(P.depthBuffer&&P.resolveDepthBuffer===!1&&f){const M=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[M])}}}function Ot(P){return Math.min(o.maxSamples,P.samples)}function ke(P){const M=s.get(P);return P.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&M.__useRenderToTexture!==!1}function lt(P){const M=u.render.frame;v.get(P)!==M&&(v.set(P,M),P.update())}function Bt(P,M){const q=P.colorSpace,he=P.format,ge=P.type;return P.isCompressedTexture===!0||P.isVideoTexture===!0||q!==Ts&&q!==Nr&&(Mt.getTransfer(q)===Ut?(he!==Ti||ge!==ar)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",q)),M}function Ht(P){return typeof HTMLImageElement<"u"&&P instanceof HTMLImageElement?(p.width=P.naturalWidth||P.width,p.height=P.naturalHeight||P.height):typeof VideoFrame<"u"&&P instanceof VideoFrame?(p.width=P.displayWidth,p.height=P.displayHeight):(p.width=P.width,p.height=P.height),p}this.allocateTextureUnit=ie,this.resetTextureUnits=de,this.setTexture2D=fe,this.setTexture2DArray=ce,this.setTexture3D=oe,this.setTextureCube=O,this.rebindTextures=ft,this.setupRenderTarget=F,this.updateRenderTargetMipmap=Et,this.updateMultisampleRenderTarget=Ke,this.setupDepthRenderbuffer=Nt,this.setupFrameBufferTexture=_e,this.useMultisampledRTT=ke}function YC(n,e){function t(s,o=Nr){let l;const u=Mt.getTransfer(o);if(s===ar)return n.UNSIGNED_BYTE;if(s===Rf)return n.UNSIGNED_SHORT_4_4_4_4;if(s===bf)return n.UNSIGNED_SHORT_5_5_5_1;if(s===g_)return n.UNSIGNED_INT_5_9_9_9_REV;if(s===m_)return n.BYTE;if(s===v_)return n.SHORT;if(s===Ia)return n.UNSIGNED_SHORT;if(s===Cf)return n.INT;if(s===ws)return n.UNSIGNED_INT;if(s===rr)return n.FLOAT;if(s===za)return n.HALF_FLOAT;if(s===__)return n.ALPHA;if(s===y_)return n.RGB;if(s===Ti)return n.RGBA;if(s===Da)return n.DEPTH_COMPONENT;if(s===Na)return n.DEPTH_STENCIL;if(s===x_)return n.RED;if(s===Pf)return n.RED_INTEGER;if(s===E_)return n.RG;if(s===Lf)return n.RG_INTEGER;if(s===If)return n.RGBA_INTEGER;if(s===Cc||s===Rc||s===bc||s===Pc)if(u===Ut)if(l=e.get("WEBGL_compressed_texture_s3tc_srgb"),l!==null){if(s===Cc)return l.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(s===Rc)return l.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(s===bc)return l.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(s===Pc)return l.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(l=e.get("WEBGL_compressed_texture_s3tc"),l!==null){if(s===Cc)return l.COMPRESSED_RGB_S3TC_DXT1_EXT;if(s===Rc)return l.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(s===bc)return l.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(s===Pc)return l.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(s===zh||s===Bh||s===Hh||s===Vh)if(l=e.get("WEBGL_compressed_texture_pvrtc"),l!==null){if(s===zh)return l.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(s===Bh)return l.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(s===Hh)return l.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(s===Vh)return l.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(s===Gh||s===Wh||s===Xh)if(l=e.get("WEBGL_compressed_texture_etc"),l!==null){if(s===Gh||s===Wh)return u===Ut?l.COMPRESSED_SRGB8_ETC2:l.COMPRESSED_RGB8_ETC2;if(s===Xh)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:l.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(s===jh||s===Yh||s===$h||s===qh||s===Kh||s===Zh||s===Qh||s===Jh||s===ef||s===tf||s===nf||s===rf||s===sf||s===of)if(l=e.get("WEBGL_compressed_texture_astc"),l!==null){if(s===jh)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:l.COMPRESSED_RGBA_ASTC_4x4_KHR;if(s===Yh)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:l.COMPRESSED_RGBA_ASTC_5x4_KHR;if(s===$h)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:l.COMPRESSED_RGBA_ASTC_5x5_KHR;if(s===qh)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:l.COMPRESSED_RGBA_ASTC_6x5_KHR;if(s===Kh)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:l.COMPRESSED_RGBA_ASTC_6x6_KHR;if(s===Zh)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:l.COMPRESSED_RGBA_ASTC_8x5_KHR;if(s===Qh)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:l.COMPRESSED_RGBA_ASTC_8x6_KHR;if(s===Jh)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:l.COMPRESSED_RGBA_ASTC_8x8_KHR;if(s===ef)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:l.COMPRESSED_RGBA_ASTC_10x5_KHR;if(s===tf)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:l.COMPRESSED_RGBA_ASTC_10x6_KHR;if(s===nf)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:l.COMPRESSED_RGBA_ASTC_10x8_KHR;if(s===rf)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:l.COMPRESSED_RGBA_ASTC_10x10_KHR;if(s===sf)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:l.COMPRESSED_RGBA_ASTC_12x10_KHR;if(s===of)return u===Ut?l.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:l.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(s===Lc||s===af||s===lf)if(l=e.get("EXT_texture_compression_bptc"),l!==null){if(s===Lc)return u===Ut?l.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:l.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(s===af)return l.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(s===lf)return l.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(s===S_||s===cf||s===uf||s===df)if(l=e.get("EXT_texture_compression_rgtc"),l!==null){if(s===Lc)return l.COMPRESSED_RED_RGTC1_EXT;if(s===cf)return l.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(s===uf)return l.COMPRESSED_RED_GREEN_RGTC2_EXT;if(s===df)return l.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return s===Ua?n.UNSIGNED_INT_24_8:n[s]!==void 0?n[s]:null}return{convert:t}}class z_ extends Dn{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}}const $C=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,qC=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class KC{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const s=new z_(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=s}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,s=new jr({vertexShader:$C,fragmentShader:qC,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new di(new Kc(20,20),s)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class ZC extends bo{constructor(e,t){super();const s=this;let o=null,l=1,u=null,d="local-floor",f=1,p=null,v=null,g=null,y=null,x=null,w=null;const A=new KC,E={},_=t.getContextAttributes();let N=null,I=null;const R=[],k=[],B=new Lt;let H=null;const Y=new ui;Y.viewport=new Kt;const b=new ui;b.viewport=new Kt;const C=[Y,b],D=new gw;let de=null,ie=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(V){let re=R[V];return re===void 0&&(re=new mh,R[V]=re),re.getTargetRaySpace()},this.getControllerGrip=function(V){let re=R[V];return re===void 0&&(re=new mh,R[V]=re),re.getGripSpace()},this.getHand=function(V){let re=R[V];return re===void 0&&(re=new mh,R[V]=re),re.getHandSpace()};function le(V){const re=k.indexOf(V.inputSource);if(re===-1)return;const ne=R[re];ne!==void 0&&(ne.update(V.inputSource,V.frame,p||u),ne.dispatchEvent({type:V.type,data:V.inputSource}))}function fe(){o.removeEventListener("select",le),o.removeEventListener("selectstart",le),o.removeEventListener("selectend",le),o.removeEventListener("squeeze",le),o.removeEventListener("squeezestart",le),o.removeEventListener("squeezeend",le),o.removeEventListener("end",fe),o.removeEventListener("inputsourceschange",ce);for(let V=0;V<R.length;V++){const re=k[V];re!==null&&(k[V]=null,R[V].disconnect(re))}de=null,ie=null,A.reset();for(const V in E)delete E[V];e.setRenderTarget(N),x=null,y=null,g=null,o=null,I=null,Fe.stop(),s.isPresenting=!1,e.setPixelRatio(H),e.setSize(B.width,B.height,!1),s.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(V){l=V,s.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(V){d=V,s.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return p||u},this.setReferenceSpace=function(V){p=V},this.getBaseLayer=function(){return y!==null?y:x},this.getBinding=function(){return g},this.getFrame=function(){return w},this.getSession=function(){return o},this.setSession=async function(V){if(o=V,o!==null){if(N=e.getRenderTarget(),o.addEventListener("select",le),o.addEventListener("selectstart",le),o.addEventListener("selectend",le),o.addEventListener("squeeze",le),o.addEventListener("squeezestart",le),o.addEventListener("squeezeend",le),o.addEventListener("end",fe),o.addEventListener("inputsourceschange",ce),_.xrCompatible!==!0&&await t.makeXRCompatible(),H=e.getPixelRatio(),e.getSize(B),typeof XRWebGLBinding<"u"&&(g=new XRWebGLBinding(o,t)),g!==null&&"createProjectionLayer"in XRWebGLBinding.prototype){let ne=null,_e=null,Ae=null;_.depth&&(Ae=_.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,ne=_.stencil?Na:Da,_e=_.stencil?Ua:ws);const Ie={colorFormat:t.RGBA8,depthFormat:Ae,scaleFactor:l};y=g.createProjectionLayer(Ie),o.updateRenderState({layers:[y]}),e.setPixelRatio(1),e.setSize(y.textureWidth,y.textureHeight,!1),I=new Xr(y.textureWidth,y.textureHeight,{format:Ti,type:ar,depthTexture:new U_(y.textureWidth,y.textureHeight,_e,void 0,void 0,void 0,void 0,void 0,void 0,ne),stencilBuffer:_.stencil,colorSpace:e.outputColorSpace,samples:_.antialias?4:0,resolveDepthBuffer:y.ignoreDepthValues===!1,resolveStencilBuffer:y.ignoreDepthValues===!1})}else{const ne={antialias:_.antialias,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:l};x=new XRWebGLLayer(o,t,ne),o.updateRenderState({baseLayer:x}),e.setPixelRatio(1),e.setSize(x.framebufferWidth,x.framebufferHeight,!1),I=new Xr(x.framebufferWidth,x.framebufferHeight,{format:Ti,type:ar,colorSpace:e.outputColorSpace,stencilBuffer:_.stencil,resolveDepthBuffer:x.ignoreDepthValues===!1,resolveStencilBuffer:x.ignoreDepthValues===!1})}I.isXRRenderTarget=!0,this.setFoveation(f),p=null,u=await o.requestReferenceSpace(d),Fe.setContext(o),Fe.start(),s.isPresenting=!0,s.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(o!==null)return o.environmentBlendMode},this.getDepthTexture=function(){return A.getDepthTexture()};function ce(V){for(let re=0;re<V.removed.length;re++){const ne=V.removed[re],_e=k.indexOf(ne);_e>=0&&(k[_e]=null,R[_e].disconnect(ne))}for(let re=0;re<V.added.length;re++){const ne=V.added[re];let _e=k.indexOf(ne);if(_e===-1){for(let Ie=0;Ie<R.length;Ie++)if(Ie>=k.length){k.push(ne),_e=Ie;break}else if(k[Ie]===null){k[Ie]=ne,_e=Ie;break}if(_e===-1)break}const Ae=R[_e];Ae&&Ae.connect(ne)}}const oe=new Z,O=new Z;function ae(V,re,ne){oe.setFromMatrixPosition(re.matrixWorld),O.setFromMatrixPosition(ne.matrixWorld);const _e=oe.distanceTo(O),Ae=re.projectionMatrix.elements,Ie=ne.projectionMatrix.elements,Nt=Ae[14]/(Ae[10]-1),ft=Ae[14]/(Ae[10]+1),F=(Ae[9]+1)/Ae[5],Et=(Ae[9]-1)/Ae[5],Xe=(Ae[8]-1)/Ae[0],gt=(Ie[8]+1)/Ie[0],Ke=Nt*Xe,Ot=Nt*gt,ke=_e/(-Xe+gt),lt=ke*-Xe;if(re.matrixWorld.decompose(V.position,V.quaternion,V.scale),V.translateX(lt),V.translateZ(ke),V.matrixWorld.compose(V.position,V.quaternion,V.scale),V.matrixWorldInverse.copy(V.matrixWorld).invert(),Ae[10]===-1)V.projectionMatrix.copy(re.projectionMatrix),V.projectionMatrixInverse.copy(re.projectionMatrixInverse);else{const Bt=Nt+ke,Ht=ft+ke,P=Ke-lt,M=Ot+(_e-lt),q=F*ft/Ht*Bt,he=Et*ft/Ht*Bt;V.projectionMatrix.makePerspective(P,M,q,he,Bt,Ht),V.projectionMatrixInverse.copy(V.projectionMatrix).invert()}}function se(V,re){re===null?V.matrixWorld.copy(V.matrix):V.matrixWorld.multiplyMatrices(re.matrixWorld,V.matrix),V.matrixWorldInverse.copy(V.matrixWorld).invert()}this.updateCamera=function(V){if(o===null)return;let re=V.near,ne=V.far;A.texture!==null&&(A.depthNear>0&&(re=A.depthNear),A.depthFar>0&&(ne=A.depthFar)),D.near=b.near=Y.near=re,D.far=b.far=Y.far=ne,(de!==D.near||ie!==D.far)&&(o.updateRenderState({depthNear:D.near,depthFar:D.far}),de=D.near,ie=D.far),D.layers.mask=V.layers.mask|6,Y.layers.mask=D.layers.mask&3,b.layers.mask=D.layers.mask&5;const _e=V.parent,Ae=D.cameras;se(D,_e);for(let Ie=0;Ie<Ae.length;Ie++)se(Ae[Ie],_e);Ae.length===2?ae(D,Y,b):D.projectionMatrix.copy(Y.projectionMatrix),U(V,D,_e)};function U(V,re,ne){ne===null?V.matrix.copy(re.matrixWorld):(V.matrix.copy(ne.matrixWorld),V.matrix.invert(),V.matrix.multiply(re.matrixWorld)),V.matrix.decompose(V.position,V.quaternion,V.scale),V.updateMatrixWorld(!0),V.projectionMatrix.copy(re.projectionMatrix),V.projectionMatrixInverse.copy(re.projectionMatrixInverse),V.isPerspectiveCamera&&(V.fov=Oa*2*Math.atan(1/V.projectionMatrix.elements[5]),V.zoom=1)}this.getCamera=function(){return D},this.getFoveation=function(){if(!(y===null&&x===null))return f},this.setFoveation=function(V){f=V,y!==null&&(y.fixedFoveation=V),x!==null&&x.fixedFoveation!==void 0&&(x.fixedFoveation=V)},this.hasDepthSensing=function(){return A.texture!==null},this.getDepthSensingMesh=function(){return A.getMesh(D)},this.getCameraTexture=function(V){return E[V]};let J=null;function Oe(V,re){if(v=re.getViewerPose(p||u),w=re,v!==null){const ne=v.views;x!==null&&(e.setRenderTargetFramebuffer(I,x.framebuffer),e.setRenderTarget(I));let _e=!1;ne.length!==D.cameras.length&&(D.cameras.length=0,_e=!0);for(let ft=0;ft<ne.length;ft++){const F=ne[ft];let Et=null;if(x!==null)Et=x.getViewport(F);else{const gt=g.getViewSubImage(y,F);Et=gt.viewport,ft===0&&(e.setRenderTargetTextures(I,gt.colorTexture,gt.depthStencilTexture),e.setRenderTarget(I))}let Xe=C[ft];Xe===void 0&&(Xe=new ui,Xe.layers.enable(ft),Xe.viewport=new Kt,C[ft]=Xe),Xe.matrix.fromArray(F.transform.matrix),Xe.matrix.decompose(Xe.position,Xe.quaternion,Xe.scale),Xe.projectionMatrix.fromArray(F.projectionMatrix),Xe.projectionMatrixInverse.copy(Xe.projectionMatrix).invert(),Xe.viewport.set(Et.x,Et.y,Et.width,Et.height),ft===0&&(D.matrix.copy(Xe.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale)),_e===!0&&D.cameras.push(Xe)}const Ae=o.enabledFeatures;if(Ae&&Ae.includes("depth-sensing")&&o.depthUsage=="gpu-optimized"&&g){const ft=g.getDepthInformation(ne[0]);ft&&ft.isValid&&ft.texture&&A.init(ft,o.renderState)}if(Ae&&Ae.includes("camera-access")&&(e.state.unbindTexture(),g))for(let ft=0;ft<ne.length;ft++){const F=ne[ft].camera;if(F){let Et=E[F];Et||(Et=new z_,E[F]=Et);const Xe=g.getCameraImage(F);Et.sourceTexture=Xe}}}for(let ne=0;ne<R.length;ne++){const _e=k[ne],Ae=R[ne];_e!==null&&Ae!==void 0&&Ae.update(_e,re,p||u)}J&&J(V,re),re.detectedPlanes&&s.dispatchEvent({type:"planesdetected",data:re}),w=null}const Fe=new D_;Fe.setAnimationLoop(Oe),this.setAnimationLoop=function(V){J=V},this.dispose=function(){}}}const vs=new zi,QC=new Zt;function JC(n,e){function t(E,_){E.matrixAutoUpdate===!0&&E.updateMatrix(),_.value.copy(E.matrix)}function s(E,_){_.color.getRGB(E.fogColor.value,P_(n)),_.isFog?(E.fogNear.value=_.near,E.fogFar.value=_.far):_.isFogExp2&&(E.fogDensity.value=_.density)}function o(E,_,N,I,R){_.isMeshBasicMaterial||_.isMeshLambertMaterial?l(E,_):_.isMeshToonMaterial?(l(E,_),g(E,_)):_.isMeshPhongMaterial?(l(E,_),v(E,_)):_.isMeshStandardMaterial?(l(E,_),y(E,_),_.isMeshPhysicalMaterial&&x(E,_,R)):_.isMeshMatcapMaterial?(l(E,_),w(E,_)):_.isMeshDepthMaterial?l(E,_):_.isMeshDistanceMaterial?(l(E,_),A(E,_)):_.isMeshNormalMaterial?l(E,_):_.isLineBasicMaterial?(u(E,_),_.isLineDashedMaterial&&d(E,_)):_.isPointsMaterial?f(E,_,N,I):_.isSpriteMaterial?p(E,_):_.isShadowMaterial?(E.color.value.copy(_.color),E.opacity.value=_.opacity):_.isShaderMaterial&&(_.uniformsNeedUpdate=!1)}function l(E,_){E.opacity.value=_.opacity,_.color&&E.diffuse.value.copy(_.color),_.emissive&&E.emissive.value.copy(_.emissive).multiplyScalar(_.emissiveIntensity),_.map&&(E.map.value=_.map,t(_.map,E.mapTransform)),_.alphaMap&&(E.alphaMap.value=_.alphaMap,t(_.alphaMap,E.alphaMapTransform)),_.bumpMap&&(E.bumpMap.value=_.bumpMap,t(_.bumpMap,E.bumpMapTransform),E.bumpScale.value=_.bumpScale,_.side===Vn&&(E.bumpScale.value*=-1)),_.normalMap&&(E.normalMap.value=_.normalMap,t(_.normalMap,E.normalMapTransform),E.normalScale.value.copy(_.normalScale),_.side===Vn&&E.normalScale.value.negate()),_.displacementMap&&(E.displacementMap.value=_.displacementMap,t(_.displacementMap,E.displacementMapTransform),E.displacementScale.value=_.displacementScale,E.displacementBias.value=_.displacementBias),_.emissiveMap&&(E.emissiveMap.value=_.emissiveMap,t(_.emissiveMap,E.emissiveMapTransform)),_.specularMap&&(E.specularMap.value=_.specularMap,t(_.specularMap,E.specularMapTransform)),_.alphaTest>0&&(E.alphaTest.value=_.alphaTest);const N=e.get(_),I=N.envMap,R=N.envMapRotation;I&&(E.envMap.value=I,vs.copy(R),vs.x*=-1,vs.y*=-1,vs.z*=-1,I.isCubeTexture&&I.isRenderTargetTexture===!1&&(vs.y*=-1,vs.z*=-1),E.envMapRotation.value.setFromMatrix4(QC.makeRotationFromEuler(vs)),E.flipEnvMap.value=I.isCubeTexture&&I.isRenderTargetTexture===!1?-1:1,E.reflectivity.value=_.reflectivity,E.ior.value=_.ior,E.refractionRatio.value=_.refractionRatio),_.lightMap&&(E.lightMap.value=_.lightMap,E.lightMapIntensity.value=_.lightMapIntensity,t(_.lightMap,E.lightMapTransform)),_.aoMap&&(E.aoMap.value=_.aoMap,E.aoMapIntensity.value=_.aoMapIntensity,t(_.aoMap,E.aoMapTransform))}function u(E,_){E.diffuse.value.copy(_.color),E.opacity.value=_.opacity,_.map&&(E.map.value=_.map,t(_.map,E.mapTransform))}function d(E,_){E.dashSize.value=_.dashSize,E.totalSize.value=_.dashSize+_.gapSize,E.scale.value=_.scale}function f(E,_,N,I){E.diffuse.value.copy(_.color),E.opacity.value=_.opacity,E.size.value=_.size*N,E.scale.value=I*.5,_.map&&(E.map.value=_.map,t(_.map,E.uvTransform)),_.alphaMap&&(E.alphaMap.value=_.alphaMap,t(_.alphaMap,E.alphaMapTransform)),_.alphaTest>0&&(E.alphaTest.value=_.alphaTest)}function p(E,_){E.diffuse.value.copy(_.color),E.opacity.value=_.opacity,E.rotation.value=_.rotation,_.map&&(E.map.value=_.map,t(_.map,E.mapTransform)),_.alphaMap&&(E.alphaMap.value=_.alphaMap,t(_.alphaMap,E.alphaMapTransform)),_.alphaTest>0&&(E.alphaTest.value=_.alphaTest)}function v(E,_){E.specular.value.copy(_.specular),E.shininess.value=Math.max(_.shininess,1e-4)}function g(E,_){_.gradientMap&&(E.gradientMap.value=_.gradientMap)}function y(E,_){E.metalness.value=_.metalness,_.metalnessMap&&(E.metalnessMap.value=_.metalnessMap,t(_.metalnessMap,E.metalnessMapTransform)),E.roughness.value=_.roughness,_.roughnessMap&&(E.roughnessMap.value=_.roughnessMap,t(_.roughnessMap,E.roughnessMapTransform)),_.envMap&&(E.envMapIntensity.value=_.envMapIntensity)}function x(E,_,N){E.ior.value=_.ior,_.sheen>0&&(E.sheenColor.value.copy(_.sheenColor).multiplyScalar(_.sheen),E.sheenRoughness.value=_.sheenRoughness,_.sheenColorMap&&(E.sheenColorMap.value=_.sheenColorMap,t(_.sheenColorMap,E.sheenColorMapTransform)),_.sheenRoughnessMap&&(E.sheenRoughnessMap.value=_.sheenRoughnessMap,t(_.sheenRoughnessMap,E.sheenRoughnessMapTransform))),_.clearcoat>0&&(E.clearcoat.value=_.clearcoat,E.clearcoatRoughness.value=_.clearcoatRoughness,_.clearcoatMap&&(E.clearcoatMap.value=_.clearcoatMap,t(_.clearcoatMap,E.clearcoatMapTransform)),_.clearcoatRoughnessMap&&(E.clearcoatRoughnessMap.value=_.clearcoatRoughnessMap,t(_.clearcoatRoughnessMap,E.clearcoatRoughnessMapTransform)),_.clearcoatNormalMap&&(E.clearcoatNormalMap.value=_.clearcoatNormalMap,t(_.clearcoatNormalMap,E.clearcoatNormalMapTransform),E.clearcoatNormalScale.value.copy(_.clearcoatNormalScale),_.side===Vn&&E.clearcoatNormalScale.value.negate())),_.dispersion>0&&(E.dispersion.value=_.dispersion),_.iridescence>0&&(E.iridescence.value=_.iridescence,E.iridescenceIOR.value=_.iridescenceIOR,E.iridescenceThicknessMinimum.value=_.iridescenceThicknessRange[0],E.iridescenceThicknessMaximum.value=_.iridescenceThicknessRange[1],_.iridescenceMap&&(E.iridescenceMap.value=_.iridescenceMap,t(_.iridescenceMap,E.iridescenceMapTransform)),_.iridescenceThicknessMap&&(E.iridescenceThicknessMap.value=_.iridescenceThicknessMap,t(_.iridescenceThicknessMap,E.iridescenceThicknessMapTransform))),_.transmission>0&&(E.transmission.value=_.transmission,E.transmissionSamplerMap.value=N.texture,E.transmissionSamplerSize.value.set(N.width,N.height),_.transmissionMap&&(E.transmissionMap.value=_.transmissionMap,t(_.transmissionMap,E.transmissionMapTransform)),E.thickness.value=_.thickness,_.thicknessMap&&(E.thicknessMap.value=_.thicknessMap,t(_.thicknessMap,E.thicknessMapTransform)),E.attenuationDistance.value=_.attenuationDistance,E.attenuationColor.value.copy(_.attenuationColor)),_.anisotropy>0&&(E.anisotropyVector.value.set(_.anisotropy*Math.cos(_.anisotropyRotation),_.anisotropy*Math.sin(_.anisotropyRotation)),_.anisotropyMap&&(E.anisotropyMap.value=_.anisotropyMap,t(_.anisotropyMap,E.anisotropyMapTransform))),E.specularIntensity.value=_.specularIntensity,E.specularColor.value.copy(_.specularColor),_.specularColorMap&&(E.specularColorMap.value=_.specularColorMap,t(_.specularColorMap,E.specularColorMapTransform)),_.specularIntensityMap&&(E.specularIntensityMap.value=_.specularIntensityMap,t(_.specularIntensityMap,E.specularIntensityMapTransform))}function w(E,_){_.matcap&&(E.matcap.value=_.matcap)}function A(E,_){const N=e.get(_).light;E.referencePosition.value.setFromMatrixPosition(N.matrixWorld),E.nearDistance.value=N.shadow.camera.near,E.farDistance.value=N.shadow.camera.far}return{refreshFogUniforms:s,refreshMaterialUniforms:o}}function eR(n,e,t,s){let o={},l={},u=[];const d=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function f(N,I){const R=I.program;s.uniformBlockBinding(N,R)}function p(N,I){let R=o[N.id];R===void 0&&(w(N),R=v(N),o[N.id]=R,N.addEventListener("dispose",E));const k=I.program;s.updateUBOMapping(N,k);const B=e.render.frame;l[N.id]!==B&&(y(N),l[N.id]=B)}function v(N){const I=g();N.__bindingPointIndex=I;const R=n.createBuffer(),k=N.__size,B=N.usage;return n.bindBuffer(n.UNIFORM_BUFFER,R),n.bufferData(n.UNIFORM_BUFFER,k,B),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,I,R),R}function g(){for(let N=0;N<d;N++)if(u.indexOf(N)===-1)return u.push(N),N;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function y(N){const I=o[N.id],R=N.uniforms,k=N.__cache;n.bindBuffer(n.UNIFORM_BUFFER,I);for(let B=0,H=R.length;B<H;B++){const Y=Array.isArray(R[B])?R[B]:[R[B]];for(let b=0,C=Y.length;b<C;b++){const D=Y[b];if(x(D,B,b,k)===!0){const de=D.__offset,ie=Array.isArray(D.value)?D.value:[D.value];let le=0;for(let fe=0;fe<ie.length;fe++){const ce=ie[fe],oe=A(ce);typeof ce=="number"||typeof ce=="boolean"?(D.__data[0]=ce,n.bufferSubData(n.UNIFORM_BUFFER,de+le,D.__data)):ce.isMatrix3?(D.__data[0]=ce.elements[0],D.__data[1]=ce.elements[1],D.__data[2]=ce.elements[2],D.__data[3]=0,D.__data[4]=ce.elements[3],D.__data[5]=ce.elements[4],D.__data[6]=ce.elements[5],D.__data[7]=0,D.__data[8]=ce.elements[6],D.__data[9]=ce.elements[7],D.__data[10]=ce.elements[8],D.__data[11]=0):(ce.toArray(D.__data,le),le+=oe.storage/Float32Array.BYTES_PER_ELEMENT)}n.bufferSubData(n.UNIFORM_BUFFER,de,D.__data)}}}n.bindBuffer(n.UNIFORM_BUFFER,null)}function x(N,I,R,k){const B=N.value,H=I+"_"+R;if(k[H]===void 0)return typeof B=="number"||typeof B=="boolean"?k[H]=B:k[H]=B.clone(),!0;{const Y=k[H];if(typeof B=="number"||typeof B=="boolean"){if(Y!==B)return k[H]=B,!0}else if(Y.equals(B)===!1)return Y.copy(B),!0}return!1}function w(N){const I=N.uniforms;let R=0;const k=16;for(let H=0,Y=I.length;H<Y;H++){const b=Array.isArray(I[H])?I[H]:[I[H]];for(let C=0,D=b.length;C<D;C++){const de=b[C],ie=Array.isArray(de.value)?de.value:[de.value];for(let le=0,fe=ie.length;le<fe;le++){const ce=ie[le],oe=A(ce),O=R%k,ae=O%oe.boundary,se=O+ae;R+=ae,se!==0&&k-se<oe.storage&&(R+=k-se),de.__data=new Float32Array(oe.storage/Float32Array.BYTES_PER_ELEMENT),de.__offset=R,R+=oe.storage}}}const B=R%k;return B>0&&(R+=k-B),N.__size=R,N.__cache={},this}function A(N){const I={boundary:0,storage:0};return typeof N=="number"||typeof N=="boolean"?(I.boundary=4,I.storage=4):N.isVector2?(I.boundary=8,I.storage=8):N.isVector3||N.isColor?(I.boundary=16,I.storage=12):N.isVector4?(I.boundary=16,I.storage=16):N.isMatrix3?(I.boundary=48,I.storage=48):N.isMatrix4?(I.boundary=64,I.storage=64):N.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",N),I}function E(N){const I=N.target;I.removeEventListener("dispose",E);const R=u.indexOf(I.__bindingPointIndex);u.splice(R,1),n.deleteBuffer(o[I.id]),delete o[I.id],delete l[I.id]}function _(){for(const N in o)n.deleteBuffer(o[N]);u=[],o={},l={}}return{bind:f,update:p,dispose:_}}class tR{constructor(e={}){const{canvas:t=DM(),context:s=null,depth:o=!0,stencil:l=!1,alpha:u=!1,antialias:d=!1,premultipliedAlpha:f=!0,preserveDrawingBuffer:p=!1,powerPreference:v="default",failIfMajorPerformanceCaveat:g=!1,reversedDepthBuffer:y=!1}=e;this.isWebGLRenderer=!0;let x;if(s!==null){if(typeof WebGLRenderingContext<"u"&&s instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");x=s.getContextAttributes().alpha}else x=u;const w=new Uint32Array(4),A=new Int32Array(4);let E=null,_=null;const N=[],I=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=kr,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const R=this;let k=!1;this._outputColorSpace=ci;let B=0,H=0,Y=null,b=-1,C=null;const D=new Kt,de=new Kt;let ie=null;const le=new Dt(0);let fe=0,ce=t.width,oe=t.height,O=1,ae=null,se=null;const U=new Kt(0,0,ce,oe),J=new Kt(0,0,ce,oe);let Oe=!1;const Fe=new Ff;let V=!1,re=!1;const ne=new Zt,_e=new Z,Ae=new Kt,Ie={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Nt=!1;function ft(){return Y===null?O:1}let F=s;function Et(T,j){return t.getContext(T,j)}try{const T={alpha:!0,depth:o,stencil:l,antialias:d,premultipliedAlpha:f,preserveDrawingBuffer:p,powerPreference:v,failIfMajorPerformanceCaveat:g};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Af}`),t.addEventListener("webglcontextlost",Ce,!1),t.addEventListener("webglcontextrestored",Ue,!1),t.addEventListener("webglcontextcreationerror",xe,!1),F===null){const j="webgl2";if(F=Et(j,T),F===null)throw Et(j)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(T){throw console.error("THREE.WebGLRenderer: "+T.message),T}let Xe,gt,Ke,Ot,ke,lt,Bt,Ht,P,M,q,he,ge,ue,$e,Te,Be,qe,Me,Le,it,je,Re,ct;function G(){Xe=new dA(F),Xe.init(),je=new YC(F,Xe),gt=new rA(F,Xe,e,je),Ke=new XC(F,Xe),gt.reversedDepthBuffer&&y&&Ke.buffers.depth.setReversed(!0),Ot=new pA(F),ke=new IC,lt=new jC(F,Xe,Ke,ke,gt,je,Ot),Bt=new oA(R),Ht=new uA(R),P=new xw(F),Re=new nA(F,P),M=new hA(F,P,Ot,Re),q=new vA(F,M,P,Ot),Me=new mA(F,gt,lt),Te=new sA(ke),he=new LC(R,Bt,Ht,Xe,gt,Re,Te),ge=new JC(R,ke),ue=new DC,$e=new BC(Xe),qe=new tA(R,Bt,Ht,Ke,q,x,f),Be=new GC(R,q,gt),ct=new eR(F,Ot,gt,Ke),Le=new iA(F,Xe,Ot),it=new fA(F,Xe,Ot),Ot.programs=he.programs,R.capabilities=gt,R.extensions=Xe,R.properties=ke,R.renderLists=ue,R.shadowMap=Be,R.state=Ke,R.info=Ot}G();const Ee=new ZC(R,F);this.xr=Ee,this.getContext=function(){return F},this.getContextAttributes=function(){return F.getContextAttributes()},this.forceContextLoss=function(){const T=Xe.get("WEBGL_lose_context");T&&T.loseContext()},this.forceContextRestore=function(){const T=Xe.get("WEBGL_lose_context");T&&T.restoreContext()},this.getPixelRatio=function(){return O},this.setPixelRatio=function(T){T!==void 0&&(O=T,this.setSize(ce,oe,!1))},this.getSize=function(T){return T.set(ce,oe)},this.setSize=function(T,j,ee=!0){if(Ee.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}ce=T,oe=j,t.width=Math.floor(T*O),t.height=Math.floor(j*O),ee===!0&&(t.style.width=T+"px",t.style.height=j+"px"),this.setViewport(0,0,T,j)},this.getDrawingBufferSize=function(T){return T.set(ce*O,oe*O).floor()},this.setDrawingBufferSize=function(T,j,ee){ce=T,oe=j,O=ee,t.width=Math.floor(T*ee),t.height=Math.floor(j*ee),this.setViewport(0,0,T,j)},this.getCurrentViewport=function(T){return T.copy(D)},this.getViewport=function(T){return T.copy(U)},this.setViewport=function(T,j,ee,te){T.isVector4?U.set(T.x,T.y,T.z,T.w):U.set(T,j,ee,te),Ke.viewport(D.copy(U).multiplyScalar(O).round())},this.getScissor=function(T){return T.copy(J)},this.setScissor=function(T,j,ee,te){T.isVector4?J.set(T.x,T.y,T.z,T.w):J.set(T,j,ee,te),Ke.scissor(de.copy(J).multiplyScalar(O).round())},this.getScissorTest=function(){return Oe},this.setScissorTest=function(T){Ke.setScissorTest(Oe=T)},this.setOpaqueSort=function(T){ae=T},this.setTransparentSort=function(T){se=T},this.getClearColor=function(T){return T.copy(qe.getClearColor())},this.setClearColor=function(){qe.setClearColor(...arguments)},this.getClearAlpha=function(){return qe.getClearAlpha()},this.setClearAlpha=function(){qe.setClearAlpha(...arguments)},this.clear=function(T=!0,j=!0,ee=!0){let te=0;if(T){let W=!1;if(Y!==null){const Se=Y.texture.format;W=Se===If||Se===Lf||Se===Pf}if(W){const Se=Y.texture.type,be=Se===ar||Se===ws||Se===Ia||Se===Ua||Se===Rf||Se===bf,He=qe.getClearColor(),De=qe.getClearAlpha(),nt=He.r,rt=He.g,Ze=He.b;be?(w[0]=nt,w[1]=rt,w[2]=Ze,w[3]=De,F.clearBufferuiv(F.COLOR,0,w)):(A[0]=nt,A[1]=rt,A[2]=Ze,A[3]=De,F.clearBufferiv(F.COLOR,0,A))}else te|=F.COLOR_BUFFER_BIT}j&&(te|=F.DEPTH_BUFFER_BIT),ee&&(te|=F.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),F.clear(te)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",Ce,!1),t.removeEventListener("webglcontextrestored",Ue,!1),t.removeEventListener("webglcontextcreationerror",xe,!1),qe.dispose(),ue.dispose(),$e.dispose(),ke.dispose(),Bt.dispose(),Ht.dispose(),q.dispose(),Re.dispose(),ct.dispose(),he.dispose(),Ee.dispose(),Ee.removeEventListener("sessionstart",_n),Ee.removeEventListener("sessionend",Rs),Wn.stop()};function Ce(T){T.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),k=!0}function Ue(){console.log("THREE.WebGLRenderer: Context Restored."),k=!1;const T=Ot.autoReset,j=Be.enabled,ee=Be.autoUpdate,te=Be.needsUpdate,W=Be.type;G(),Ot.autoReset=T,Be.enabled=j,Be.autoUpdate=ee,Be.needsUpdate=te,Be.type=W}function xe(T){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",T.statusMessage)}function pe(T){const j=T.target;j.removeEventListener("dispose",pe),Ge(j)}function Ge(T){at(T),ke.remove(T)}function at(T){const j=ke.get(T).programs;j!==void 0&&(j.forEach(function(ee){he.releaseProgram(ee)}),T.isShaderMaterial&&he.releaseShaderCache(T))}this.renderBufferDirect=function(T,j,ee,te,W,Se){j===null&&(j=Ie);const be=W.isMesh&&W.matrixWorld.determinant()<0,He=Hi(T,j,ee,te,W);Ke.setMaterial(te,be);let De=ee.index,nt=1;if(te.wireframe===!0){if(De=M.getWireframeAttribute(ee),De===void 0)return;nt=2}const rt=ee.drawRange,Ze=ee.attributes.position;let st=rt.start*nt,Tt=(rt.start+rt.count)*nt;Se!==null&&(st=Math.max(st,Se.start*nt),Tt=Math.min(Tt,(Se.start+Se.count)*nt)),De!==null?(st=Math.max(st,0),Tt=Math.min(Tt,De.count)):Ze!=null&&(st=Math.max(st,0),Tt=Math.min(Tt,Ze.count));const xt=Tt-st;if(xt<0||xt===1/0)return;Re.setup(W,te,He,ee,De);let Ft,bt=Le;if(De!==null&&(Ft=P.get(De),bt=it,bt.setIndex(Ft)),W.isMesh)te.wireframe===!0?(Ke.setLineWidth(te.wireframeLinewidth*ft()),bt.setMode(F.LINES)):bt.setMode(F.TRIANGLES);else if(W.isLine){let Je=te.linewidth;Je===void 0&&(Je=1),Ke.setLineWidth(Je*ft()),W.isLineSegments?bt.setMode(F.LINES):W.isLineLoop?bt.setMode(F.LINE_LOOP):bt.setMode(F.LINE_STRIP)}else W.isPoints?bt.setMode(F.POINTS):W.isSprite&&bt.setMode(F.TRIANGLES);if(W.isBatchedMesh)if(W._multiDrawInstances!==null)Eo("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),bt.renderMultiDrawInstances(W._multiDrawStarts,W._multiDrawCounts,W._multiDrawCount,W._multiDrawInstances);else if(Xe.get("WEBGL_multi_draw"))bt.renderMultiDraw(W._multiDrawStarts,W._multiDrawCounts,W._multiDrawCount);else{const Je=W._multiDrawStarts,It=W._multiDrawCounts,mt=W._multiDrawCount,tn=De?P.get(De).bytesPerElement:1,hi=ke.get(te).currentProgram.getUniforms();for(let Cn=0;Cn<mt;Cn++)hi.setValue(F,"_gl_DrawID",Cn),bt.render(Je[Cn]/tn,It[Cn])}else if(W.isInstancedMesh)bt.renderInstances(st,xt,W.count);else if(ee.isInstancedBufferGeometry){const Je=ee._maxInstanceCount!==void 0?ee._maxInstanceCount:1/0,It=Math.min(ee.instanceCount,Je);bt.renderInstances(st,xt,It)}else bt.render(st,xt)};function Rt(T,j,ee){T.transparent===!0&&T.side===ir&&T.forceSinglePass===!1?(T.side=Vn,T.needsUpdate=!0,Ps(T,j,ee),T.side=Wr,T.needsUpdate=!0,Ps(T,j,ee),T.side=ir):Ps(T,j,ee)}this.compile=function(T,j,ee=null){ee===null&&(ee=T),_=$e.get(ee),_.init(j),I.push(_),ee.traverseVisible(function(W){W.isLight&&W.layers.test(j.layers)&&(_.pushLight(W),W.castShadow&&_.pushShadow(W))}),T!==ee&&T.traverseVisible(function(W){W.isLight&&W.layers.test(j.layers)&&(_.pushLight(W),W.castShadow&&_.pushShadow(W))}),_.setupLights();const te=new Set;return T.traverse(function(W){if(!(W.isMesh||W.isPoints||W.isLine||W.isSprite))return;const Se=W.material;if(Se)if(Array.isArray(Se))for(let be=0;be<Se.length;be++){const He=Se[be];Rt(He,ee,W),te.add(He)}else Rt(Se,ee,W),te.add(Se)}),_=I.pop(),te},this.compileAsync=function(T,j,ee=null){const te=this.compile(T,j,ee);return new Promise(W=>{function Se(){if(te.forEach(function(be){ke.get(be).currentProgram.isReady()&&te.delete(be)}),te.size===0){W(T);return}setTimeout(Se,10)}Xe.get("KHR_parallel_shader_compile")!==null?Se():setTimeout(Se,10)})};let yt=null;function ei(T){yt&&yt(T)}function _n(){Wn.stop()}function Rs(){Wn.start()}const Wn=new D_;Wn.setAnimationLoop(ei),typeof self<"u"&&Wn.setContext(self),this.setAnimationLoop=function(T){yt=T,Ee.setAnimationLoop(T),T===null?Wn.stop():Wn.start()},Ee.addEventListener("sessionstart",_n),Ee.addEventListener("sessionend",Rs),this.render=function(T,j){if(j!==void 0&&j.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(k===!0)return;if(T.matrixWorldAutoUpdate===!0&&T.updateMatrixWorld(),j.parent===null&&j.matrixWorldAutoUpdate===!0&&j.updateMatrixWorld(),Ee.enabled===!0&&Ee.isPresenting===!0&&(Ee.cameraAutoUpdate===!0&&Ee.updateCamera(j),j=Ee.getCamera()),T.isScene===!0&&T.onBeforeRender(R,T,j,Y),_=$e.get(T,I.length),_.init(j),I.push(_),ne.multiplyMatrices(j.projectionMatrix,j.matrixWorldInverse),Fe.setFromProjectionMatrix(ne,Ni,j.reversedDepth),re=this.localClippingEnabled,V=Te.init(this.clippingPlanes,re),E=ue.get(T,N.length),E.init(),N.push(E),Ee.enabled===!0&&Ee.isPresenting===!0){const Se=R.xr.getDepthSensingMesh();Se!==null&&Do(Se,j,-1/0,R.sortObjects)}Do(T,j,0,R.sortObjects),E.finish(),R.sortObjects===!0&&E.sort(ae,se),Nt=Ee.enabled===!1||Ee.isPresenting===!1||Ee.hasDepthSensing()===!1,Nt&&qe.addToRenderList(E,T),this.info.render.frame++,V===!0&&Te.beginShadows();const ee=_.state.shadowsArray;Be.render(ee,T,j),V===!0&&Te.endShadows(),this.info.autoReset===!0&&this.info.reset();const te=E.opaque,W=E.transmissive;if(_.setupLights(),j.isArrayCamera){const Se=j.cameras;if(W.length>0)for(let be=0,He=Se.length;be<He;be++){const De=Se[be];qr(te,W,T,De)}Nt&&qe.render(T);for(let be=0,He=Se.length;be<He;be++){const De=Se[be];lr(E,T,De,De.viewport)}}else W.length>0&&qr(te,W,T,j),Nt&&qe.render(T),lr(E,T,j);Y!==null&&H===0&&(lt.updateMultisampleRenderTarget(Y),lt.updateRenderTargetMipmap(Y)),T.isScene===!0&&T.onAfterRender(R,T,j),Re.resetDefaultState(),b=-1,C=null,I.pop(),I.length>0?(_=I[I.length-1],V===!0&&Te.setGlobalState(R.clippingPlanes,_.state.camera)):_=null,N.pop(),N.length>0?E=N[N.length-1]:E=null};function Do(T,j,ee,te){if(T.visible===!1)return;if(T.layers.test(j.layers)){if(T.isGroup)ee=T.renderOrder;else if(T.isLOD)T.autoUpdate===!0&&T.update(j);else if(T.isLight)_.pushLight(T),T.castShadow&&_.pushShadow(T);else if(T.isSprite){if(!T.frustumCulled||Fe.intersectsSprite(T)){te&&Ae.setFromMatrixPosition(T.matrixWorld).applyMatrix4(ne);const be=q.update(T),He=T.material;He.visible&&E.push(T,be,He,ee,Ae.z,null)}}else if((T.isMesh||T.isLine||T.isPoints)&&(!T.frustumCulled||Fe.intersectsObject(T))){const be=q.update(T),He=T.material;if(te&&(T.boundingSphere!==void 0?(T.boundingSphere===null&&T.computeBoundingSphere(),Ae.copy(T.boundingSphere.center)):(be.boundingSphere===null&&be.computeBoundingSphere(),Ae.copy(be.boundingSphere.center)),Ae.applyMatrix4(T.matrixWorld).applyMatrix4(ne)),Array.isArray(He)){const De=be.groups;for(let nt=0,rt=De.length;nt<rt;nt++){const Ze=De[nt],st=He[Ze.materialIndex];st&&st.visible&&E.push(T,be,st,ee,Ae.z,Ze)}}else He.visible&&E.push(T,be,He,ee,Ae.z,null)}}const Se=T.children;for(let be=0,He=Se.length;be<He;be++)Do(Se[be],j,ee,te)}function lr(T,j,ee,te){const W=T.opaque,Se=T.transmissive,be=T.transparent;_.setupLightsView(ee),V===!0&&Te.setGlobalState(R.clippingPlanes,ee),te&&Ke.viewport(D.copy(te)),W.length>0&&Bi(W,j,ee),Se.length>0&&Bi(Se,j,ee),be.length>0&&Bi(be,j,ee),Ke.buffers.depth.setTest(!0),Ke.buffers.depth.setMask(!0),Ke.buffers.color.setMask(!0),Ke.setPolygonOffset(!1)}function qr(T,j,ee,te){if((ee.isScene===!0?ee.overrideMaterial:null)!==null)return;_.state.transmissionRenderTarget[te.id]===void 0&&(_.state.transmissionRenderTarget[te.id]=new Xr(1,1,{generateMipmaps:!0,type:Xe.has("EXT_color_buffer_half_float")||Xe.has("EXT_color_buffer_float")?za:ar,minFilter:Or,samples:4,stencilBuffer:l,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Mt.workingColorSpace}));const Se=_.state.transmissionRenderTarget[te.id],be=te.viewport||D;Se.setSize(be.z*R.transmissionResolutionScale,be.w*R.transmissionResolutionScale);const He=R.getRenderTarget(),De=R.getActiveCubeFace(),nt=R.getActiveMipmapLevel();R.setRenderTarget(Se),R.getClearColor(le),fe=R.getClearAlpha(),fe<1&&R.setClearColor(16777215,.5),R.clear(),Nt&&qe.render(ee);const rt=R.toneMapping;R.toneMapping=kr;const Ze=te.viewport;if(te.viewport!==void 0&&(te.viewport=void 0),_.setupLightsView(te),V===!0&&Te.setGlobalState(R.clippingPlanes,te),Bi(T,ee,te),lt.updateMultisampleRenderTarget(Se),lt.updateRenderTargetMipmap(Se),Xe.has("WEBGL_multisampled_render_to_texture")===!1){let st=!1;for(let Tt=0,xt=j.length;Tt<xt;Tt++){const Ft=j[Tt],bt=Ft.object,Je=Ft.geometry,It=Ft.material,mt=Ft.group;if(It.side===ir&&bt.layers.test(te.layers)){const tn=It.side;It.side=Vn,It.needsUpdate=!0,bs(bt,ee,te,Je,It,mt),It.side=tn,It.needsUpdate=!0,st=!0}}st===!0&&(lt.updateMultisampleRenderTarget(Se),lt.updateRenderTargetMipmap(Se))}R.setRenderTarget(He,De,nt),R.setClearColor(le,fe),Ze!==void 0&&(te.viewport=Ze),R.toneMapping=rt}function Bi(T,j,ee){const te=j.isScene===!0?j.overrideMaterial:null;for(let W=0,Se=T.length;W<Se;W++){const be=T[W],He=be.object,De=be.geometry,nt=be.group;let rt=be.material;rt.allowOverride===!0&&te!==null&&(rt=te),He.layers.test(ee.layers)&&bs(He,j,ee,De,rt,nt)}}function bs(T,j,ee,te,W,Se){T.onBeforeRender(R,j,ee,te,W,Se),T.modelViewMatrix.multiplyMatrices(ee.matrixWorldInverse,T.matrixWorld),T.normalMatrix.getNormalMatrix(T.modelViewMatrix),W.onBeforeRender(R,j,ee,te,T,Se),W.transparent===!0&&W.side===ir&&W.forceSinglePass===!1?(W.side=Vn,W.needsUpdate=!0,R.renderBufferDirect(ee,j,te,W,T,Se),W.side=Wr,W.needsUpdate=!0,R.renderBufferDirect(ee,j,te,W,T,Se),W.side=ir):R.renderBufferDirect(ee,j,te,W,T,Se),T.onAfterRender(R,j,ee,te,W,Se)}function Ps(T,j,ee){j.isScene!==!0&&(j=Ie);const te=ke.get(T),W=_.state.lights,Se=_.state.shadowsArray,be=W.state.version,He=he.getParameters(T,W.state,Se,j,ee),De=he.getProgramCacheKey(He);let nt=te.programs;te.environment=T.isMeshStandardMaterial?j.environment:null,te.fog=j.fog,te.envMap=(T.isMeshStandardMaterial?Ht:Bt).get(T.envMap||te.environment),te.envMapRotation=te.environment!==null&&T.envMap===null?j.environmentRotation:T.envMapRotation,nt===void 0&&(T.addEventListener("dispose",pe),nt=new Map,te.programs=nt);let rt=nt.get(De);if(rt!==void 0){if(te.currentProgram===rt&&te.lightsStateVersion===be)return Ya(T,He),rt}else He.uniforms=he.getUniforms(T),T.onBeforeCompile(He,R),rt=he.acquireProgram(He,De),nt.set(De,rt),te.uniforms=He.uniforms;const Ze=te.uniforms;return(!T.isShaderMaterial&&!T.isRawShaderMaterial||T.clipping===!0)&&(Ze.clippingPlanes=Te.uniform),Ya(T,He),te.needsLights=qa(T),te.lightsStateVersion=be,te.needsLights&&(Ze.ambientLightColor.value=W.state.ambient,Ze.lightProbe.value=W.state.probe,Ze.directionalLights.value=W.state.directional,Ze.directionalLightShadows.value=W.state.directionalShadow,Ze.spotLights.value=W.state.spot,Ze.spotLightShadows.value=W.state.spotShadow,Ze.rectAreaLights.value=W.state.rectArea,Ze.ltc_1.value=W.state.rectAreaLTC1,Ze.ltc_2.value=W.state.rectAreaLTC2,Ze.pointLights.value=W.state.point,Ze.pointLightShadows.value=W.state.pointShadow,Ze.hemisphereLights.value=W.state.hemi,Ze.directionalShadowMap.value=W.state.directionalShadowMap,Ze.directionalShadowMatrix.value=W.state.directionalShadowMatrix,Ze.spotShadowMap.value=W.state.spotShadowMap,Ze.spotLightMatrix.value=W.state.spotLightMatrix,Ze.spotLightMap.value=W.state.spotLightMap,Ze.pointShadowMap.value=W.state.pointShadowMap,Ze.pointShadowMatrix.value=W.state.pointShadowMatrix),te.currentProgram=rt,te.uniformsList=null,rt}function ja(T){if(T.uniformsList===null){const j=T.currentProgram.getUniforms();T.uniformsList=Ic.seqWithValue(j.seq,T.uniforms)}return T.uniformsList}function Ya(T,j){const ee=ke.get(T);ee.outputColorSpace=j.outputColorSpace,ee.batching=j.batching,ee.batchingColor=j.batchingColor,ee.instancing=j.instancing,ee.instancingColor=j.instancingColor,ee.instancingMorph=j.instancingMorph,ee.skinning=j.skinning,ee.morphTargets=j.morphTargets,ee.morphNormals=j.morphNormals,ee.morphColors=j.morphColors,ee.morphTargetsCount=j.morphTargetsCount,ee.numClippingPlanes=j.numClippingPlanes,ee.numIntersection=j.numClipIntersection,ee.vertexAlphas=j.vertexAlphas,ee.vertexTangents=j.vertexTangents,ee.toneMapping=j.toneMapping}function Hi(T,j,ee,te,W){j.isScene!==!0&&(j=Ie),lt.resetTextureUnits();const Se=j.fog,be=te.isMeshStandardMaterial?j.environment:null,He=Y===null?R.outputColorSpace:Y.isXRRenderTarget===!0?Y.texture.colorSpace:Ts,De=(te.isMeshStandardMaterial?Ht:Bt).get(te.envMap||be),nt=te.vertexColors===!0&&!!ee.attributes.color&&ee.attributes.color.itemSize===4,rt=!!ee.attributes.tangent&&(!!te.normalMap||te.anisotropy>0),Ze=!!ee.morphAttributes.position,st=!!ee.morphAttributes.normal,Tt=!!ee.morphAttributes.color;let xt=kr;te.toneMapped&&(Y===null||Y.isXRRenderTarget===!0)&&(xt=R.toneMapping);const Ft=ee.morphAttributes.position||ee.morphAttributes.normal||ee.morphAttributes.color,bt=Ft!==void 0?Ft.length:0,Je=ke.get(te),It=_.state.lights;if(V===!0&&(re===!0||T!==C)){const $t=T===C&&te.id===b;Te.setState(te,T,$t)}let mt=!1;te.version===Je.__version?(Je.needsLights&&Je.lightsStateVersion!==It.state.version||Je.outputColorSpace!==He||W.isBatchedMesh&&Je.batching===!1||!W.isBatchedMesh&&Je.batching===!0||W.isBatchedMesh&&Je.batchingColor===!0&&W.colorTexture===null||W.isBatchedMesh&&Je.batchingColor===!1&&W.colorTexture!==null||W.isInstancedMesh&&Je.instancing===!1||!W.isInstancedMesh&&Je.instancing===!0||W.isSkinnedMesh&&Je.skinning===!1||!W.isSkinnedMesh&&Je.skinning===!0||W.isInstancedMesh&&Je.instancingColor===!0&&W.instanceColor===null||W.isInstancedMesh&&Je.instancingColor===!1&&W.instanceColor!==null||W.isInstancedMesh&&Je.instancingMorph===!0&&W.morphTexture===null||W.isInstancedMesh&&Je.instancingMorph===!1&&W.morphTexture!==null||Je.envMap!==De||te.fog===!0&&Je.fog!==Se||Je.numClippingPlanes!==void 0&&(Je.numClippingPlanes!==Te.numPlanes||Je.numIntersection!==Te.numIntersection)||Je.vertexAlphas!==nt||Je.vertexTangents!==rt||Je.morphTargets!==Ze||Je.morphNormals!==st||Je.morphColors!==Tt||Je.toneMapping!==xt||Je.morphTargetsCount!==bt)&&(mt=!0):(mt=!0,Je.__version=te.version);let tn=Je.currentProgram;mt===!0&&(tn=Ps(te,j,W));let hi=!1,Cn=!1,Kr=!1;const kt=tn.getUniforms(),Rn=Je.uniforms;if(Ke.useProgram(tn.program)&&(hi=!0,Cn=!0,Kr=!0),te.id!==b&&(b=te.id,Cn=!0),hi||C!==T){Ke.buffers.depth.getReversed()&&T.reversedDepth!==!0&&(T._reversedDepth=!0,T.updateProjectionMatrix()),kt.setValue(F,"projectionMatrix",T.projectionMatrix),kt.setValue(F,"viewMatrix",T.matrixWorldInverse);const xn=kt.map.cameraPosition;xn!==void 0&&xn.setValue(F,_e.setFromMatrixPosition(T.matrixWorld)),gt.logarithmicDepthBuffer&&kt.setValue(F,"logDepthBufFC",2/(Math.log(T.far+1)/Math.LN2)),(te.isMeshPhongMaterial||te.isMeshToonMaterial||te.isMeshLambertMaterial||te.isMeshBasicMaterial||te.isMeshStandardMaterial||te.isShaderMaterial)&&kt.setValue(F,"isOrthographic",T.isOrthographicCamera===!0),C!==T&&(C=T,Cn=!0,Kr=!0)}if(W.isSkinnedMesh){kt.setOptional(F,W,"bindMatrix"),kt.setOptional(F,W,"bindMatrixInverse");const $t=W.skeleton;$t&&($t.boneTexture===null&&$t.computeBoneTexture(),kt.setValue(F,"boneTexture",$t.boneTexture,lt))}W.isBatchedMesh&&(kt.setOptional(F,W,"batchingTexture"),kt.setValue(F,"batchingTexture",W._matricesTexture,lt),kt.setOptional(F,W,"batchingIdTexture"),kt.setValue(F,"batchingIdTexture",W._indirectTexture,lt),kt.setOptional(F,W,"batchingColorTexture"),W._colorsTexture!==null&&kt.setValue(F,"batchingColorTexture",W._colorsTexture,lt));const yn=ee.morphAttributes;if((yn.position!==void 0||yn.normal!==void 0||yn.color!==void 0)&&Me.update(W,ee,tn),(Cn||Je.receiveShadow!==W.receiveShadow)&&(Je.receiveShadow=W.receiveShadow,kt.setValue(F,"receiveShadow",W.receiveShadow)),te.isMeshGouraudMaterial&&te.envMap!==null&&(Rn.envMap.value=De,Rn.flipEnvMap.value=De.isCubeTexture&&De.isRenderTargetTexture===!1?-1:1),te.isMeshStandardMaterial&&te.envMap===null&&j.environment!==null&&(Rn.envMapIntensity.value=j.environmentIntensity),Cn&&(kt.setValue(F,"toneMappingExposure",R.toneMappingExposure),Je.needsLights&&$a(Rn,Kr),Se&&te.fog===!0&&ge.refreshFogUniforms(Rn,Se),ge.refreshMaterialUniforms(Rn,te,O,oe,_.state.transmissionRenderTarget[T.id]),Ic.upload(F,ja(Je),Rn,lt)),te.isShaderMaterial&&te.uniformsNeedUpdate===!0&&(Ic.upload(F,ja(Je),Rn,lt),te.uniformsNeedUpdate=!1),te.isSpriteMaterial&&kt.setValue(F,"center",W.center),kt.setValue(F,"modelViewMatrix",W.modelViewMatrix),kt.setValue(F,"normalMatrix",W.normalMatrix),kt.setValue(F,"modelMatrix",W.matrixWorld),te.isShaderMaterial||te.isRawShaderMaterial){const $t=te.uniformsGroups;for(let xn=0,Zr=$t.length;xn<Zr;xn++){const vt=$t[xn];ct.update(vt,tn),ct.bind(vt,tn)}}return tn}function $a(T,j){T.ambientLightColor.needsUpdate=j,T.lightProbe.needsUpdate=j,T.directionalLights.needsUpdate=j,T.directionalLightShadows.needsUpdate=j,T.pointLights.needsUpdate=j,T.pointLightShadows.needsUpdate=j,T.spotLights.needsUpdate=j,T.spotLightShadows.needsUpdate=j,T.rectAreaLights.needsUpdate=j,T.hemisphereLights.needsUpdate=j}function qa(T){return T.isMeshLambertMaterial||T.isMeshToonMaterial||T.isMeshPhongMaterial||T.isMeshStandardMaterial||T.isShadowMaterial||T.isShaderMaterial&&T.lights===!0}this.getActiveCubeFace=function(){return B},this.getActiveMipmapLevel=function(){return H},this.getRenderTarget=function(){return Y},this.setRenderTargetTextures=function(T,j,ee){const te=ke.get(T);te.__autoAllocateDepthBuffer=T.resolveDepthBuffer===!1,te.__autoAllocateDepthBuffer===!1&&(te.__useRenderToTexture=!1),ke.get(T.texture).__webglTexture=j,ke.get(T.depthTexture).__webglTexture=te.__autoAllocateDepthBuffer?void 0:ee,te.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(T,j){const ee=ke.get(T);ee.__webglFramebuffer=j,ee.__useDefaultFramebuffer=j===void 0};const ou=F.createFramebuffer();this.setRenderTarget=function(T,j=0,ee=0){Y=T,B=j,H=ee;let te=!0,W=null,Se=!1,be=!1;if(T){const De=ke.get(T);if(De.__useDefaultFramebuffer!==void 0)Ke.bindFramebuffer(F.FRAMEBUFFER,null),te=!1;else if(De.__webglFramebuffer===void 0)lt.setupRenderTarget(T);else if(De.__hasExternalTextures)lt.rebindTextures(T,ke.get(T.texture).__webglTexture,ke.get(T.depthTexture).__webglTexture);else if(T.depthBuffer){const Ze=T.depthTexture;if(De.__boundDepthTexture!==Ze){if(Ze!==null&&ke.has(Ze)&&(T.width!==Ze.image.width||T.height!==Ze.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");lt.setupDepthRenderbuffer(T)}}const nt=T.texture;(nt.isData3DTexture||nt.isDataArrayTexture||nt.isCompressedArrayTexture)&&(be=!0);const rt=ke.get(T).__webglFramebuffer;T.isWebGLCubeRenderTarget?(Array.isArray(rt[j])?W=rt[j][ee]:W=rt[j],Se=!0):T.samples>0&&lt.useMultisampledRTT(T)===!1?W=ke.get(T).__webglMultisampledFramebuffer:Array.isArray(rt)?W=rt[ee]:W=rt,D.copy(T.viewport),de.copy(T.scissor),ie=T.scissorTest}else D.copy(U).multiplyScalar(O).floor(),de.copy(J).multiplyScalar(O).floor(),ie=Oe;if(ee!==0&&(W=ou),Ke.bindFramebuffer(F.FRAMEBUFFER,W)&&te&&Ke.drawBuffers(T,W),Ke.viewport(D),Ke.scissor(de),Ke.setScissorTest(ie),Se){const De=ke.get(T.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_CUBE_MAP_POSITIVE_X+j,De.__webglTexture,ee)}else if(be){const De=j;for(let nt=0;nt<T.textures.length;nt++){const rt=ke.get(T.textures[nt]);F.framebufferTextureLayer(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0+nt,rt.__webglTexture,ee,De)}}else if(T!==null&&ee!==0){const De=ke.get(T.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,De.__webglTexture,ee)}b=-1},this.readRenderTargetPixels=function(T,j,ee,te,W,Se,be,He=0){if(!(T&&T.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let De=ke.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&be!==void 0&&(De=De[be]),De){Ke.bindFramebuffer(F.FRAMEBUFFER,De);try{const nt=T.textures[He],rt=nt.format,Ze=nt.type;if(!gt.textureFormatReadable(rt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!gt.textureTypeReadable(Ze)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}j>=0&&j<=T.width-te&&ee>=0&&ee<=T.height-W&&(T.textures.length>1&&F.readBuffer(F.COLOR_ATTACHMENT0+He),F.readPixels(j,ee,te,W,je.convert(rt),je.convert(Ze),Se))}finally{const nt=Y!==null?ke.get(Y).__webglFramebuffer:null;Ke.bindFramebuffer(F.FRAMEBUFFER,nt)}}},this.readRenderTargetPixelsAsync=async function(T,j,ee,te,W,Se,be,He=0){if(!(T&&T.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let De=ke.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&be!==void 0&&(De=De[be]),De)if(j>=0&&j<=T.width-te&&ee>=0&&ee<=T.height-W){Ke.bindFramebuffer(F.FRAMEBUFFER,De);const nt=T.textures[He],rt=nt.format,Ze=nt.type;if(!gt.textureFormatReadable(rt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!gt.textureTypeReadable(Ze))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const st=F.createBuffer();F.bindBuffer(F.PIXEL_PACK_BUFFER,st),F.bufferData(F.PIXEL_PACK_BUFFER,Se.byteLength,F.STREAM_READ),T.textures.length>1&&F.readBuffer(F.COLOR_ATTACHMENT0+He),F.readPixels(j,ee,te,W,je.convert(rt),je.convert(Ze),0);const Tt=Y!==null?ke.get(Y).__webglFramebuffer:null;Ke.bindFramebuffer(F.FRAMEBUFFER,Tt);const xt=F.fenceSync(F.SYNC_GPU_COMMANDS_COMPLETE,0);return F.flush(),await NM(F,xt,4),F.bindBuffer(F.PIXEL_PACK_BUFFER,st),F.getBufferSubData(F.PIXEL_PACK_BUFFER,0,Se),F.deleteBuffer(st),F.deleteSync(xt),Se}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(T,j=null,ee=0){const te=Math.pow(2,-ee),W=Math.floor(T.image.width*te),Se=Math.floor(T.image.height*te),be=j!==null?j.x:0,He=j!==null?j.y:0;lt.setTexture2D(T,0),F.copyTexSubImage2D(F.TEXTURE_2D,ee,0,0,be,He,W,Se),Ke.unbindTexture()};const Ka=F.createFramebuffer(),Za=F.createFramebuffer();this.copyTextureToTexture=function(T,j,ee=null,te=null,W=0,Se=null){Se===null&&(W!==0?(Eo("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),Se=W,W=0):Se=0);let be,He,De,nt,rt,Ze,st,Tt,xt;const Ft=T.isCompressedTexture?T.mipmaps[Se]:T.image;if(ee!==null)be=ee.max.x-ee.min.x,He=ee.max.y-ee.min.y,De=ee.isBox3?ee.max.z-ee.min.z:1,nt=ee.min.x,rt=ee.min.y,Ze=ee.isBox3?ee.min.z:0;else{const yn=Math.pow(2,-W);be=Math.floor(Ft.width*yn),He=Math.floor(Ft.height*yn),T.isDataArrayTexture?De=Ft.depth:T.isData3DTexture?De=Math.floor(Ft.depth*yn):De=1,nt=0,rt=0,Ze=0}te!==null?(st=te.x,Tt=te.y,xt=te.z):(st=0,Tt=0,xt=0);const bt=je.convert(j.format),Je=je.convert(j.type);let It;j.isData3DTexture?(lt.setTexture3D(j,0),It=F.TEXTURE_3D):j.isDataArrayTexture||j.isCompressedArrayTexture?(lt.setTexture2DArray(j,0),It=F.TEXTURE_2D_ARRAY):(lt.setTexture2D(j,0),It=F.TEXTURE_2D),F.pixelStorei(F.UNPACK_FLIP_Y_WEBGL,j.flipY),F.pixelStorei(F.UNPACK_PREMULTIPLY_ALPHA_WEBGL,j.premultiplyAlpha),F.pixelStorei(F.UNPACK_ALIGNMENT,j.unpackAlignment);const mt=F.getParameter(F.UNPACK_ROW_LENGTH),tn=F.getParameter(F.UNPACK_IMAGE_HEIGHT),hi=F.getParameter(F.UNPACK_SKIP_PIXELS),Cn=F.getParameter(F.UNPACK_SKIP_ROWS),Kr=F.getParameter(F.UNPACK_SKIP_IMAGES);F.pixelStorei(F.UNPACK_ROW_LENGTH,Ft.width),F.pixelStorei(F.UNPACK_IMAGE_HEIGHT,Ft.height),F.pixelStorei(F.UNPACK_SKIP_PIXELS,nt),F.pixelStorei(F.UNPACK_SKIP_ROWS,rt),F.pixelStorei(F.UNPACK_SKIP_IMAGES,Ze);const kt=T.isDataArrayTexture||T.isData3DTexture,Rn=j.isDataArrayTexture||j.isData3DTexture;if(T.isDepthTexture){const yn=ke.get(T),$t=ke.get(j),xn=ke.get(yn.__renderTarget),Zr=ke.get($t.__renderTarget);Ke.bindFramebuffer(F.READ_FRAMEBUFFER,xn.__webglFramebuffer),Ke.bindFramebuffer(F.DRAW_FRAMEBUFFER,Zr.__webglFramebuffer);for(let vt=0;vt<De;vt++)kt&&(F.framebufferTextureLayer(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,ke.get(T).__webglTexture,W,Ze+vt),F.framebufferTextureLayer(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,ke.get(j).__webglTexture,Se,xt+vt)),F.blitFramebuffer(nt,rt,be,He,st,Tt,be,He,F.DEPTH_BUFFER_BIT,F.NEAREST);Ke.bindFramebuffer(F.READ_FRAMEBUFFER,null),Ke.bindFramebuffer(F.DRAW_FRAMEBUFFER,null)}else if(W!==0||T.isRenderTargetTexture||ke.has(T)){const yn=ke.get(T),$t=ke.get(j);Ke.bindFramebuffer(F.READ_FRAMEBUFFER,Ka),Ke.bindFramebuffer(F.DRAW_FRAMEBUFFER,Za);for(let xn=0;xn<De;xn++)kt?F.framebufferTextureLayer(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,yn.__webglTexture,W,Ze+xn):F.framebufferTexture2D(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,yn.__webglTexture,W),Rn?F.framebufferTextureLayer(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,$t.__webglTexture,Se,xt+xn):F.framebufferTexture2D(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,$t.__webglTexture,Se),W!==0?F.blitFramebuffer(nt,rt,be,He,st,Tt,be,He,F.COLOR_BUFFER_BIT,F.NEAREST):Rn?F.copyTexSubImage3D(It,Se,st,Tt,xt+xn,nt,rt,be,He):F.copyTexSubImage2D(It,Se,st,Tt,nt,rt,be,He);Ke.bindFramebuffer(F.READ_FRAMEBUFFER,null),Ke.bindFramebuffer(F.DRAW_FRAMEBUFFER,null)}else Rn?T.isDataTexture||T.isData3DTexture?F.texSubImage3D(It,Se,st,Tt,xt,be,He,De,bt,Je,Ft.data):j.isCompressedArrayTexture?F.compressedTexSubImage3D(It,Se,st,Tt,xt,be,He,De,bt,Ft.data):F.texSubImage3D(It,Se,st,Tt,xt,be,He,De,bt,Je,Ft):T.isDataTexture?F.texSubImage2D(F.TEXTURE_2D,Se,st,Tt,be,He,bt,Je,Ft.data):T.isCompressedTexture?F.compressedTexSubImage2D(F.TEXTURE_2D,Se,st,Tt,Ft.width,Ft.height,bt,Ft.data):F.texSubImage2D(F.TEXTURE_2D,Se,st,Tt,be,He,bt,Je,Ft);F.pixelStorei(F.UNPACK_ROW_LENGTH,mt),F.pixelStorei(F.UNPACK_IMAGE_HEIGHT,tn),F.pixelStorei(F.UNPACK_SKIP_PIXELS,hi),F.pixelStorei(F.UNPACK_SKIP_ROWS,Cn),F.pixelStorei(F.UNPACK_SKIP_IMAGES,Kr),Se===0&&j.generateMipmaps&&F.generateMipmap(It),Ke.unbindTexture()},this.copyTextureToTexture3D=function(T,j,ee=null,te=null,W=0){return Eo('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(T,j,ee,te,W)},this.initRenderTarget=function(T){ke.get(T).__webglFramebuffer===void 0&&lt.setupRenderTarget(T)},this.initTexture=function(T){T.isCubeTexture?lt.setTextureCube(T,0):T.isData3DTexture?lt.setTexture3D(T,0):T.isDataArrayTexture||T.isCompressedArrayTexture?lt.setTexture2DArray(T,0):lt.setTexture2D(T,0),Ke.unbindTexture()},this.resetState=function(){B=0,H=0,Y=null,Ke.reset(),Re.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Ni}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=Mt._getDrawingBufferColorSpace(e),t.unpackColorSpace=Mt._getUnpackColorSpace()}}/*!
 * Photo Sphere Viewer 5.14.1
 * @copyright 2014-2015 Jérémy Heleine
 * @copyright 2015-2026 Damien "Mistic" Sorel
 * @licence MIT (https://opensource.org/licenses/MIT)
 */var nR=Object.defineProperty,Bf=(n,e)=>{for(var t in e)nR(n,t,{get:e[t],enumerable:!0})},iR={};Bf(iR,{ACTIONS:()=>X_,ANIMATION_MIN_DURATION:()=>pf,CAPTURE_EVENTS_CLASS:()=>Ga,CTRLZOOM_TIMEOUT:()=>W_,DBLCLICK_DELAY:()=>H_,EASINGS:()=>Uc,ICONS:()=>Ci,IDS:()=>mn,KEY_CODES:()=>dn,LONGTOUCH_DELAY:()=>V_,MOVE_THRESHOLD:()=>B_,SPHERE_RADIUS:()=>As,TWOFINGERSOVERLAY_DELAY:()=>G_,VIEWER_DATA:()=>Yr});var rR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 40 432 432"><g transform="rotate(0, 256, 256)"><path fill="currentColor" d="M425.23 210.55H227.39a5 5 0 01-3.53-8.53l56.56-56.57a45.5 45.5 0 000-64.28 45.15 45.15 0 00-32.13-13.3 45.15 45.15 0 00-32.14 13.3L41.32 256l174.83 174.83a45.15 45.15 0 0032.14 13.3 45.15 45.15 0 0032.13-13.3 45.5 45.5 0 000-64.28l-56.57-56.57a5 5 0 013.54-8.53h197.84c25.06 0 45.45-20.39 45.45-45.45s-20.4-45.45-45.45-45.45z"/></g><!-- Created by Flatart from the Noun Project --></svg>
`,sR='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="currentColor" transform=" translate(50, 50) rotate(45)"><rect x="-5" y="-65" width="10" height="130"/><rect x="-65" y="-5" width="130" height="10"/></g></svg>',oR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M83.3 35.6h-17V3H32.2v32.6H16.6l33.6 32.7 33-32.7z"/><path fill="currentColor" d="M83.3 64.2v16.3H16.6V64.2H-.1v32.6H100V64.2H83.3z"/><!--Created by Michael Zenaty from the Noun Project--></svg>
`,aR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M100 40H87.1V18.8h-21V6H100zM100 93.2H66V80.3h21.1v-21H100zM34 93.2H0v-34h12.9v21.1h21zM12.9 40H0V6h34v12.9H12.8z"/><!--Created by Garrett Knoll from the Noun Project--></svg>
`,lR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M66 7h13v21h21v13H66zM66 60.3h34v12.9H79v21H66zM0 60.3h34v34H21V73.1H0zM21 7h13v34H0V28h21z"/><!--Created by Garrett Knoll from the Noun Project--></svg>
`,cR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="currentColor" d="M28.3 26.1c-1 2.6-1.9 4.8-2.6 7-2.5 7.4-5 14.7-7.2 22-1.3 4.4.5 7.2 4.3 7.8 1.3.2 2.8.2 4.2-.1 8.2-2 11.9-8.6 15.7-15.2l-2.2 2a18.8 18.8 0 0 1-7.4 5.2 2 2 0 0 1-1.6-.2c-.2-.1 0-1 0-1.4l.8-1.8L41.9 28c.5-1.4.9-3 .7-4.4-.2-2.6-3-4.4-6.3-4.4-8.8.2-15 4.5-19.5 11.8-.2.3-.2.6-.3 1.3 3.7-2.8 6.8-6.1 11.8-6.2z"/><circle fill="currentColor" cx="39.3" cy="9.2" r="8.2"/><!--Created by Arafat Uddin from the Noun Project--></svg>
`,uR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 80 80"><g fill="currentColor"><circle r="10" cx="20" cy="20"/><circle r="10" cx="50" cy="20"/><circle r="10" cx="80" cy="20"/><circle r="10" cx="20" cy="50"/><circle r="10" cx="50" cy="50"/><circle r="10" cx="80" cy="50"/><circle r="10" cx="20" cy="80"/><circle r="10" cx="50" cy="80"/><circle r="10" cx="80" cy="80"/></g><!-- Created by Richard Kunák from the Noun Project--></svg>
`,dR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="currentColor" d="M14.043 12.22a7.738 7.738 0 1 0-1.823 1.822l4.985 4.985c.503.504 1.32.504 1.822 0a1.285 1.285 0 0 0 0-1.822l-4.984-4.985zm-6.305 1.043a5.527 5.527 0 1 1 0-11.053 5.527 5.527 0 0 1 0 11.053z"/><path fill="currentColor" d="M8.728 4.009H6.744v2.737H4.006V8.73h2.738v2.736h1.984V8.73h2.737V6.746H8.728z"/><!--Created by Ryan Canning from the Noun Project--></svg>
`,hR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="currentColor" d="M14.043 12.22a7.738 7.738 0 1 0-1.823 1.822l4.985 4.985c.503.504 1.32.504 1.822 0a1.285 1.285 0 0 0 0-1.822l-4.984-4.985zm-6.305 1.043a5.527 5.527 0 1 1 0-11.053 5.527 5.527 0 0 1 0 11.053z"/><path fill="currentColor" d="M4.006 6.746h7.459V8.73H4.006z"/><!--Created by Ryan Canning from the Noun Project--></svg>
`,pf=500,B_=4,H_=300,V_=500,G_=100,W_=2e3,As=10,Yr="photoSphereViewer",Ga="psv--capture-event",X_=(n=>(n.ROTATE_UP="ROTATE_UP",n.ROTATE_DOWN="ROTATE_DOWN",n.ROTATE_RIGHT="ROTATE_RIGHT",n.ROTATE_LEFT="ROTATE_LEFT",n.ZOOM_IN="ZOOM_IN",n.ZOOM_OUT="ZOOM_OUT",n))(X_||{}),mn={MENU:"menu",TWO_FINGERS:"twoFingers",CTRL_ZOOM:"ctrlZoom",ERROR:"error",DESCRIPTION:"description"},dn={Enter:"Enter",Control:"Control",Escape:"Escape",Space:" ",PageUp:"PageUp",PageDown:"PageDown",ArrowLeft:"ArrowLeft",ArrowUp:"ArrowUp",ArrowRight:"ArrowRight",ArrowDown:"ArrowDown",Delete:"Delete",Plus:"+",Minus:"-"},Ci={arrow:rR,close:sR,download:oR,fullscreenIn:aR,fullscreenOut:lR,info:cR,menu:uR,zoomIn:dR,zoomOut:hR},Uc={linear:n=>n,inQuad:n=>n*n,outQuad:n=>n*(2-n),inOutQuad:n=>n<.5?2*n*n:-1+(4-2*n)*n,inCubic:n=>n*n*n,outCubic:n=>--n*n*n+1,inOutCubic:n=>n<.5?4*n*n*n:(n-1)*(2*n-2)*(2*n-2)+1,inQuart:n=>n*n*n*n,outQuart:n=>1- --n*n*n*n,inOutQuart:n=>n<.5?8*n*n*n*n:1-8*--n*n*n*n,inQuint:n=>n*n*n*n*n,outQuint:n=>1+--n*n*n*n*n,inOutQuint:n=>n<.5?16*n*n*n*n*n:1+16*--n*n*n*n*n,inSine:n=>1-Math.cos(n*(Math.PI/2)),outSine:n=>Math.sin(n*(Math.PI/2)),inOutSine:n=>.5-.5*Math.cos(Math.PI*n),inExpo:n=>Math.pow(2,10*(n-1)),outExpo:n=>1-Math.pow(2,-10*n),inOutExpo:n=>(n=n*2-1)<0?.5*Math.pow(2,10*n):1-.5*Math.pow(2,-10*n),inCirc:n=>1-Math.sqrt(1-n*n),outCirc:n=>Math.sqrt(1-(n-1)*(n-1)),inOutCirc:n=>(n*=2)<1?.5-.5*Math.sqrt(1-n*n):.5+.5*Math.sqrt(1-(n-=2)*n)},fR={};Bf(fR,{Animation:()=>Xc,Dynamic:()=>ya,MultiDynamic:()=>p0,PressHandler:()=>nu,Slider:()=>v0,SliderDirection:()=>m0,addClasses:()=>Hf,angle:()=>Y_,applyEulerInverse:()=>yf,checkClosedShadowDom:()=>h0,checkStylesheet:()=>d0,checkVersion:()=>Yf,cleanCssPosition:()=>c0,clone:()=>Jc,createTexture:()=>_f,cssPositionIsOrdered:()=>jf,dasherize:()=>_R,deepEqual:()=>o0,deepmerge:()=>r0,distance:()=>j_,exitFullscreen:()=>n0,firstNonNull:()=>Ii,getAbortError:()=>vf,getAngle:()=>q_,getClosest:()=>Z_,getConfigParser:()=>tu,getElement:()=>K_,getEventTarget:()=>Hc,getMatchingTarget:()=>Q_,getPosition:()=>J_,getShortestArc:()=>$_,getStyleProperty:()=>Oi,getTouchData:()=>mf,getXMPValue:()=>Zn,greatArcDistance:()=>mR,hasParent:()=>gR,invertResolvableBoolean:()=>eu,isAbortError:()=>l0,isEmpty:()=>s0,isExtendedPosition:()=>Xf,isFullscreenEnabled:()=>e0,isNil:()=>hn,isPlainObject:()=>Gf,keyPressMatch:()=>Vf,logWarn:()=>vn,mergePanoData:()=>f0,parseAngle:()=>Ui,parsePoint:()=>yR,parseSpeed:()=>u0,removeClasses:()=>vR,requestFullscreen:()=>t0,resolveBoolean:()=>Wf,speedToDuration:()=>gf,sum:()=>pR,throttle:()=>i0,toggleClass:()=>Qc,wrap:()=>Sa});function Sa(n,e){let t=n%e;return t<0&&(t+=e),t}function pR(n){return n.reduce((e,t)=>e+t,0)}function j_(n,e){return Math.sqrt(Math.pow(n.x-e.x,2)+Math.pow(n.y-e.y,2))}function Y_(n,e){return Math.atan2(e.y-n.y,e.x-n.x)}function $_(n,e){return[0,Math.PI*2,-Math.PI*2].reduce((s,o)=>{const l=e-n+o;return Math.abs(l)<Math.abs(s)?l:s},1/0)}function q_(n,e){return Math.acos(Math.cos(n.pitch)*Math.cos(e.pitch)*Math.cos(n.yaw-e.yaw)+Math.sin(n.pitch)*Math.sin(e.pitch))}function mR([n,e],[t,s]){n-t>Math.PI?n-=2*Math.PI:n-t<-Math.PI&&(n+=2*Math.PI);const o=(t-n)*Math.cos((e+s)/2),l=s-e;return Math.sqrt(o*o+l*l)}function K_(n){return typeof n=="string"?n.match(/^[a-z]/i)?document.getElementById(n):document.querySelector(n):n}function Qc(n,e,t){t===void 0?n.classList.toggle(e):t?n.classList.add(e):t||n.classList.remove(e)}function Hf(n,e){n.classList.add(...e.split(" ").filter(t=>!!t))}function vR(n,e){n.classList.remove(...e.split(" ").filter(t=>!!t))}function gR(n,e){let t=n;do{if(t===e)return!0;t=t.parentElement}while(t);return!1}function Z_(n,e){if(!(n!=null&&n.matches))return null;let t=n;do{if(t.matches(e))return t;t=t.parentElement}while(t);return null}function Hc(n){return(n==null?void 0:n.composedPath()[0])||null}function Q_(n,e){return n?n.composedPath().find(t=>!(t instanceof HTMLElement)&&!(t instanceof SVGElement)?!1:t.matches(e)):null}function J_(n){let e=0,t=0,s=n;for(;s;)e+=s.offsetLeft-s.scrollLeft+s.clientLeft,t+=s.offsetTop-s.scrollTop+s.clientTop,s=s.offsetParent;return e-=window.scrollX,t-=window.scrollY,{x:e,y:t}}function Oi(n,e){return window.getComputedStyle(n).getPropertyValue(e)}function mf(n){if(n.touches.length<2)return null;const e={x:n.touches[0].clientX,y:n.touches[0].clientY},t={x:n.touches[1].clientX,y:n.touches[1].clientY};return{distance:j_(e,t),angle:Y_(e,t),center:{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}}var Vc;function e0(n,e=!1){return e?n===Vc:document.fullscreenElement===n}function t0(n,e=!1){e?(Vc=n,n.classList.add("psv-fullscreen-emulation"),document.dispatchEvent(new Event("fullscreenchange"))):n.requestFullscreen()}function n0(n=!1){n?(Vc.classList.remove("psv-fullscreen-emulation"),Vc=null,document.dispatchEvent(new Event("fullscreenchange"))):document.exitFullscreen()}function Vf(n,e){let t,s=!1,o=!1,l=!1,u=!1;return e==="+"?t=e:e.split("+").forEach(d=>{switch(d){case"Shift":s=!0;break;case"Ctrl":o=!0;break;case"Alt":l=!0;break;case"Meta":u=!0;break;case"Space":t=" ";break;case"Plus":t="+";break;case"Minus":t="-";break;default:t=d;break}}),s===n.shiftKey&&o===n.ctrlKey&&l===n.altKey&&u===n.metaKey&&t===n.key}function _R(n){return n.replace(/[A-Z](?:(?=[^A-Z])|[A-Z]*(?=[A-Z][^A-Z]|$))/g,(e,t)=>(t>0?"-":"")+e.toLowerCase())}function i0(n,e){let t=!1;return function(...s){t||(t=!0,setTimeout(()=>{n.apply(this,s),t=!1},e))}}function Gf(n){if(typeof n!="object"||n===null||Object.prototype.toString.call(n)!=="[object Object]")return!1;if(Object.getPrototypeOf(n)===null)return!0;let e=n;for(;Object.getPrototypeOf(e)!==null;)e=Object.getPrototypeOf(e);return Object.getPrototypeOf(n)===e}function r0(n,e){const t=e;return(function s(o,l){return Array.isArray(l)?(!o||!Array.isArray(o)?o=[]:o.length=0,l.forEach((u,d)=>{o[d]=s(null,u)})):typeof l=="object"?((!o||Array.isArray(o))&&(o={}),Object.keys(l).forEach(u=>{u!=="__proto__"&&(typeof l[u]!="object"||!l[u]||!Gf(l[u])?o[u]=l[u]:l[u]!==t&&(o[u]?s(o[u],l[u]):o[u]=s(null,l[u])))})):o=l,o})(n,e)}function Jc(n){return r0(null,n)}function s0(n){return!n||Object.keys(n).length===0&&n.constructor===Object}function hn(n){return n==null}function Ii(...n){for(const e of n)if(!hn(e))return e;return null}function o0(n,e){if(n===e)return!0;if(Hg(n)&&Hg(e)){if(Object.keys(n).length!==Object.keys(e).length)return!1;for(const t of Object.keys(n))if(!o0(n[t],e[t]))return!1;return!0}else return!1}function Hg(n){return typeof n=="object"&&n!==null}var At=class a0 extends Error{constructor(e,t){var s;super(t&&t instanceof Error?`${e}: ${t.message}`:e),this.name="PSVError",(s=Error.captureStackTrace)==null||s.call(Error,this,a0)}};function Wf(n,e){Gf(n)?(e(n.initial,!0),n.promise.then(t=>e(t,!1))):e(n,!0)}function eu(n){return{initial:!n.initial,promise:n.promise.then(e=>!e)}}function vf(){const n=new Error("Loading was aborted.");return n.name="AbortError",n}function l0(n){return(n==null?void 0:n.name)==="AbortError"}function vn(n){console.warn(`PhotoSphereViewer: ${n}`)}function Xf(n){return!n||Array.isArray(n)?!1:[["textureX","textureY"],["yaw","pitch"]].some(([e,t])=>n[e]!==void 0&&n[t]!==void 0)}function Zn(n,e,t=!0){let s=n.match("<GPano:"+e+">(.*)</GPano:"+e+">");if(s!==null){const o=t?parseInt(s[1],10):parseFloat(s[1]);return isNaN(o)?null:o}if(s=n.match("GPano:"+e+'="(.*?)"'),s!==null){const o=t?parseInt(s[1],10):parseFloat(s[1]);return isNaN(o)?null:o}return null}var Vg={top:"0%",bottom:"100%",left:"0%",right:"100%",center:"50%"},Gc=["left","center","right"],Wc=["top","center","bottom"],Gg=[...Gc,...Wc],li="center";function yR(n){if(!n)return{x:.5,y:.5};if(typeof n=="object")return n;let e=n.toLocaleLowerCase().split(" ").slice(0,2);e.length===1&&(Vg[e[0]]?e=[e[0],li]:e=[e[0],e[0]]);const t=e[1]!=="left"&&e[1]!=="right"&&e[0]!=="top"&&e[0]!=="bottom";e=e.map(o=>Vg[o]||o),t||e.reverse();const s=e.join(" ").match(/^([0-9.]+)% ([0-9.]+)%$/);return s?{x:parseFloat(s[1])/100,y:parseFloat(s[2])/100}:{x:.5,y:.5}}function c0(n,{allowCenter:e,cssOrder:t}={allowCenter:!0,cssOrder:!0}){return n?(typeof n=="string"&&(n=n.split(" ")),n.length===1&&(n[0]===li?n=[li,li]:Gc.indexOf(n[0])!==-1?n=[li,n[0]]:Wc.indexOf(n[0])!==-1&&(n=[n[0],li])),n.length!==2||Gg.indexOf(n[0])===-1||Gg.indexOf(n[1])===-1?(vn(`Unparsable position ${n}`),null):!e&&n[0]===li&&n[1]===li?(vn("Invalid position center center"),null):(t&&!jf(n)&&(n=[n[1],n[0]]),n[1]===li&&Gc.indexOf(n[0])!==-1&&(n=[li,n[0]]),n[0]===li&&Wc.indexOf(n[1])!==-1&&(n=[n[1],li]),n)):null}function jf(n){return Wc.indexOf(n[0])!==-1&&Gc.indexOf(n[1])!==-1}function u0(n){let e;if(typeof n=="string"){const t=n.toString().trim();let s=parseFloat(t.replace(/^(-?[0-9]+(?:\.[0-9]*)?).*$/,"$1"));const o=t.replace(/^-?[0-9]+(?:\.[0-9]*)?(.*)$/,"$1").trim();switch(o.match(/(pm|per minute)$/)&&(s/=60),o){case"dpm":case"degrees per minute":case"dps":case"degrees per second":e=Pt.degToRad(s);break;case"rdpm":case"radians per minute":case"rdps":case"radians per second":e=s;break;case"rpm":case"revolutions per minute":case"rps":case"revolutions per second":e=s*Math.PI*2;break;default:throw new At(`Unknown speed unit "${o}"`)}}else e=n;return e}function gf(n,e){if(typeof n!="number"){const t=u0(n);return e/Math.abs(t)*1e3}else return Math.abs(n)}function Ui(n,e=!1,t=e){let s;if(typeof n=="string"){const o=n.toLowerCase().trim().match(/^(-?[0-9]+(?:\.[0-9]*)?)(.*)$/);if(!o)throw new At(`Unknown angle "${n}"`);const l=parseFloat(o[1]),u=o[2];if(u)switch(u){case"deg":case"degs":s=Pt.degToRad(l);break;case"rad":case"rads":s=l;break;default:throw new At(`Unknown angle unit "${u}"`)}else s=l}else if(typeof n=="number"&&!isNaN(n))s=n;else throw new At(`Unknown angle "${n}"`);return s=Sa(e?s+Math.PI:s,Math.PI*2),e?Pt.clamp(s-Math.PI,-Math.PI/(t?2:1),Math.PI/(t?2:1)):s}function _f(n,e=!1){const t=new Dn(n);return t.needsUpdate=!0,t.minFilter=e?Or:wi,t.generateMipmaps=e,t.anisotropy=e?2:1,t}var Wg=new Lo;function yf(n,e){Wg.setFromEuler(e).invert(),n.applyQuaternion(Wg)}function tu(n,e){const t=function(s){const o=Jc({...n,...s}),l={};for(let[u,d]of Object.entries(o)){if(e&&u in e)d=e[u](d,{rawConfig:o,defValue:n[u]});else if(!(u in n)){vn(`Unknown option ${u}`);continue}l[u]=d}return l};return t.defaults=n,t.parsers=e||{},t}function d0(n,e){Oi(n,`--psv-${e}-loaded`)!=="true"&&console.error(`PhotoSphereViewer: stylesheet "@photo-sphere-viewer/${e}/index.css" is not loaded`)}function Yf(n,e,t){e&&e!==t&&console.error(`PhotoSphereViewer: @photo-sphere-viewer/${n} is in version ${e} but @photo-sphere-viewer/core is in version ${t}`)}function h0(n){do{if(n instanceof ShadowRoot&&n.mode==="closed"){console.error("PhotoSphereViewer: closed shadow DOM detected, the viewer might not work as expected");return}n=n.parentNode}while(n)}function f0(n,e,t,s){const o={isEquirectangular:!0,fullWidth:Ii(t==null?void 0:t.fullWidth,s==null?void 0:s.fullWidth),fullHeight:Ii(t==null?void 0:t.fullHeight,s==null?void 0:s.fullHeight),croppedWidth:Ii(t==null?void 0:t.croppedWidth,s==null?void 0:s.croppedWidth,n),croppedHeight:Ii(t==null?void 0:t.croppedHeight,s==null?void 0:s.croppedHeight,e),croppedX:Ii(t==null?void 0:t.croppedX,s==null?void 0:s.croppedX),croppedY:Ii(t==null?void 0:t.croppedY,s==null?void 0:s.croppedY),poseHeading:Ii(t==null?void 0:t.poseHeading,s==null?void 0:s.poseHeading,0),posePitch:Ii(t==null?void 0:t.posePitch,s==null?void 0:s.posePitch,0),poseRoll:Ii(t==null?void 0:t.poseRoll,s==null?void 0:s.poseRoll,0),initialHeading:s==null?void 0:s.initialHeading,initialPitch:s==null?void 0:s.initialPitch,initialFov:s==null?void 0:s.initialFov};if(o.croppedWidth!==n){const l=n/o.croppedWidth;["fullWidth","fullHeight","croppedWidth","croppedHeight","croppedX","croppedY"].forEach(u=>{o[u]&&(o[u]=Math.round(o[u]*l))})}return!o.fullWidth&&!o.fullHeight&&(o.fullWidth=Math.max(o.croppedWidth,o.croppedHeight*2),o.fullHeight=Math.round(o.fullWidth/2)),o.fullWidth||(o.fullWidth=o.fullHeight*2),o.fullHeight||(o.fullHeight=Math.round(o.fullWidth/2)),o.croppedX===null&&(o.croppedX=Math.round((o.fullWidth-n)/2)),o.croppedY===null&&(o.croppedY=Math.round((o.fullHeight-e)/2)),Math.abs(o.fullWidth-o.fullHeight*2)>1&&(vn("Invalid panoData, fullWidth should be twice fullHeight"),o.fullHeight=Math.round(o.fullWidth/2)),o.croppedX+o.croppedWidth>o.fullWidth&&(vn("Invalid panoData, croppedX + croppedWidth > fullWidth"),o.croppedX=o.fullWidth-o.croppedWidth),o.croppedY+o.croppedHeight>o.fullHeight&&(vn("Invalid panoData, croppedY + croppedHeight > fullHeight"),o.croppedY=o.fullHeight-o.croppedHeight),o.croppedX<0&&(vn("Invalid panoData, croppedX < 0"),o.croppedX=0),o.croppedY<0&&(vn("Invalid panoData, croppedY < 0"),o.croppedY=0),o}var Xc=class{constructor(n){this.easing=Uc.linear,this.callbacks=[],this.resolved=!1,this.cancelled=!1,this.options=n,n?(n.easing&&(this.easing=typeof n.easing=="function"?n.easing:Uc[n.easing]||Uc.linear),this.delayTimeout=setTimeout(()=>{this.delayTimeout=void 0,this.animationFrame=window.requestAnimationFrame(e=>this.__run(e))},n.delay||0)):this.resolved=!0}__run(n){if(this.cancelled)return;this.start||(this.start=n);const e=(n-this.start)/this.options.duration,t={};if(e<1){for(const[s,o]of Object.entries(this.options.properties))if(o){const l=o.start+(o.end-o.start)*this.easing(e);t[s]=l}this.options.onTick(t,e),this.animationFrame=window.requestAnimationFrame(s=>this.__run(s))}else{for(const[s,o]of Object.entries(this.options.properties))o&&(t[s]=o.end);this.options.onTick(t,1),this.__resolve(!0),this.animationFrame=void 0}}__resolve(n){n?this.resolved=!0:this.cancelled=!0,this.callbacks.forEach(e=>e(n)),this.callbacks.length=0}then(n){return this.resolved||this.cancelled?Promise.resolve(this.resolved).then(n):new Promise(e=>{this.callbacks.push(e)}).then(n)}cancel(){!this.cancelled&&!this.resolved&&(this.__resolve(!1),this.delayTimeout&&(window.clearTimeout(this.delayTimeout),this.delayTimeout=void 0),this.animationFrame&&(window.cancelAnimationFrame(this.animationFrame),this.animationFrame=void 0))}},ya=class{constructor(n,e){if(this.fn=n,this.mode=0,this.speed=0,this.speedMult=0,this.currentSpeed=0,this.target=0,this.__current=0,this.min=e.min,this.max=e.max,this.wrap=e.wrap,this.current=e.defaultValue,this.wrap&&this.min!==0)throw new At("invalid config");this.fn&&this.fn(this.current)}get current(){return this.__current}set current(n){this.__current=n}setSpeed(n){this.speed=n}goto(n,e=1){this.mode=2,this.target=this.wrap?Sa(n,this.max):Pt.clamp(n,this.min,this.max),this.speedMult=e}step(n,e=1){e===0?this.setValue(this.current+n):(this.mode!==2&&(this.target=this.current),this.goto(this.target+n,e))}roll(n=!1,e=1){this.mode=1,this.target=n?-1/0:1/0,this.speedMult=e}stop(){this.mode=0}setValue(n){return this.target=this.wrap?Sa(n,this.max):Pt.clamp(n,this.min,this.max),this.mode=0,this.currentSpeed=0,this.target!==this.current?(this.current=this.target,this.fn&&this.fn(this.current),!0):!1}update(n){if(this.mode===2){this.wrap&&Math.abs(this.target-this.current)>this.max/2&&(this.current=this.current<this.target?this.current+this.max:this.current-this.max);const s=this.currentSpeed*this.currentSpeed/(this.speed*this.speedMult*4);Math.abs(this.target-this.current)<=s&&(this.mode=0)}let e=this.mode===0?0:this.speed*this.speedMult;this.target<this.current&&(e=-e),this.currentSpeed<e?this.currentSpeed=Math.min(e,this.currentSpeed+n/1e3*this.speed*this.speedMult*2):this.currentSpeed>e&&(this.currentSpeed=Math.max(e,this.currentSpeed-n/1e3*this.speed*this.speedMult*2));let t=null;return this.current>this.target&&this.currentSpeed?t=Math.max(this.target,this.current+this.currentSpeed*n/1e3):this.current<this.target&&this.currentSpeed&&(t=Math.min(this.target,this.current+this.currentSpeed*n/1e3)),t!==null&&(t=this.wrap?Sa(t,this.max):Pt.clamp(t,this.min,this.max),t!==this.current)?(this.current=t,this.fn&&this.fn(this.current),!0):!1}},p0=class{constructor(n,e){this.fn=n,this.dynamics=e,this.fn&&this.fn(this.current)}get current(){return Object.entries(this.dynamics).reduce((n,[e,t])=>(n[e]=t.current,n),{})}setSpeed(n){for(const e of Object.values(this.dynamics))e.setSpeed(n)}goto(n,e=1){for(const[t,s]of Object.entries(n))this.dynamics[t].goto(s,e)}step(n,e=1){if(e===0)this.setValue(Object.keys(n).reduce((t,s)=>(t[s]=n[s]+this.dynamics[s].current,t),{}));else for(const[t,s]of Object.entries(n))this.dynamics[t].step(s,e)}roll(n,e=1){for(const[t,s]of Object.entries(n))this.dynamics[t].roll(s,e)}stop(){for(const n of Object.values(this.dynamics))n.stop()}setValue(n){let e=!1;for(const[t,s]of Object.entries(n))e=this.dynamics[t].setValue(s)||e;return e&&this.fn&&this.fn(this.current),e}update(n){let e=!1;for(const t of Object.values(this.dynamics))e=t.update(n)||e;return e&&this.fn&&this.fn(this.current),e}},nu=class{constructor(n=200){this.delay=n,this.time=0,this.delay=n}get pending(){return this.time!==0}down(n){this.timeout&&(clearTimeout(this.timeout),this.timeout=void 0),this.time=new Date().getTime(),this.data=n}up(n){if(!this.time)return;Date.now()-this.time<this.delay?this.timeout=setTimeout(()=>{n(this.data),this.timeout=void 0,this.time=0,this.data=void 0},this.delay):(n(this.data),this.time=0,this.data=void 0)}},m0=(n=>(n.VERTICAL="VERTICAL",n.HORIZONTAL="HORIZONTAL",n))(m0||{}),v0=class{constructor(n,e,t){this.container=n,this.direction=e,this.listener=t,this.mousedown=!1,this.mouseover=!1,this.container.addEventListener("click",this),this.container.addEventListener("mousedown",this),this.container.addEventListener("mouseenter",this),this.container.addEventListener("mouseleave",this),this.container.addEventListener("touchstart",this),this.container.addEventListener("mousemove",this,!0),this.container.addEventListener("touchmove",this,!0),window.addEventListener("mouseup",this),window.addEventListener("touchend",this)}get isVertical(){return this.direction==="VERTICAL"}get isHorizontal(){return this.direction==="HORIZONTAL"}destroy(){window.removeEventListener("mouseup",this),window.removeEventListener("touchend",this)}handleEvent(n){switch(n.type){case"click":n.stopPropagation();break;case"mousedown":this.__onMouseDown(n);break;case"mouseenter":this.__onMouseEnter(n);break;case"mouseleave":this.__onMouseLeave(n);break;case"touchstart":this.__onTouchStart(n);break;case"mousemove":this.__onMouseMove(n);break;case"touchmove":this.__onTouchMove(n);break;case"mouseup":this.__onMouseUp(n);break;case"touchend":this.__onTouchEnd(n);break}}__onMouseDown(n){this.mousedown=!0,this.__update(n.clientX,n.clientY,!0)}__onMouseEnter(n){this.mouseover=!0,this.__update(n.clientX,n.clientY,!0)}__onTouchStart(n){this.mouseover=!0,this.mousedown=!0;const e=n.changedTouches[0];this.__update(e.clientX,e.clientY,!0)}__onMouseMove(n){(this.mousedown||this.mouseover)&&(n.stopPropagation(),this.__update(n.clientX,n.clientY,!0))}__onTouchMove(n){if(this.mousedown||this.mouseover){n.stopPropagation();const e=n.changedTouches[0];this.__update(e.clientX,e.clientY,!0)}}__onMouseUp(n){this.mousedown&&(this.mousedown=!1,this.__update(n.clientX,n.clientY,!1))}__onMouseLeave(n){this.mouseover&&(this.mouseover=!1,this.__update(n.clientX,n.clientY,!0))}__onTouchEnd(n){if(this.mousedown){this.mouseover=!1,this.mousedown=!1;const e=n.changedTouches[0];this.__update(e.clientX,e.clientY,!1)}}__update(n,e,t){const s=this.container.getBoundingClientRect();let o;this.isVertical?o=Pt.clamp((s.bottom-e)/s.height,0,1):o=Pt.clamp((n-s.left)/s.width,0,1),this.listener({value:o,click:!t,mousedown:this.mousedown,mouseover:this.mouseover,cursor:{clientX:n,clientY:e}})}},xR={};Bf(xR,{BeforeAnimateEvent:()=>$f,BeforeRenderEvent:()=>Ma,BeforeRotateEvent:()=>w0,ClickEvent:()=>C0,ConfigChangedEvent:()=>Gn,DoubleClickEvent:()=>I0,FullscreenEvent:()=>wa,HideNotificationEvent:()=>Ta,HideOverlayEvent:()=>z0,HidePanelEvent:()=>Br,HideTooltipEvent:()=>W0,KeypressEvent:()=>Hr,LoadProgressEvent:()=>q0,ObjectEnterEvent:()=>Dy,ObjectEvent:()=>iu,ObjectHoverEvent:()=>zy,ObjectLeaveEvent:()=>xf,PanoramaErrorEvent:()=>iy,PanoramaLoadEvent:()=>Q0,PanoramaLoadedEvent:()=>Mo,PositionUpdatedEvent:()=>Aa,ReadyEvent:()=>Ra,RenderEvent:()=>my,RollUpdatedEvent:()=>Ca,ShowNotificationEvent:()=>ba,ShowOverlayEvent:()=>xy,ShowPanelEvent:()=>Vr,ShowTooltipEvent:()=>Ty,SizeUpdatedEvent:()=>Pa,StopAllEvent:()=>La,TransitionDoneEvent:()=>oy,ViewerEvent:()=>Ct,ZoomUpdatedEvent:()=>or});var ER=class extends Event{constructor(n,e=!1){super(n,{cancelable:e})}},g0=class extends EventTarget{dispatchEvent(n){return super.dispatchEvent(n)}addEventListener(n,e,t){super.addEventListener(n,e,t)}removeEventListener(n,e,t){super.removeEventListener(n,e,t)}},Ct=class extends ER{},_0=class y0 extends Ct{constructor(e,t){super(y0.type,!0),this.position=e,this.zoomLevel=t}};_0.type="before-animate";var $f=_0,x0=class E0 extends Ct{constructor(e,t){super(E0.type),this.timestamp=e,this.elapsed=t}};x0.type="before-render";var Ma=x0,S0=class M0 extends Ct{constructor(e){super(M0.type,!0),this.position=e}};S0.type="before-rotate";var w0=S0,T0=class A0 extends Ct{constructor(e){super(A0.type),this.data=e}};T0.type="click";var C0=T0,R0=class b0 extends Ct{constructor(e){super(b0.type),this.options=e}containsOptions(...e){return e.some(t=>this.options.includes(t))}};R0.type="config-changed";var Gn=R0,P0=class L0 extends Ct{constructor(e){super(L0.type),this.data=e}};P0.type="dblclick";var I0=P0,U0=class D0 extends Ct{constructor(e){super(D0.type),this.fullscreenEnabled=e}};U0.type="fullscreen";var wa=U0,N0=class O0 extends Ct{constructor(e){super(O0.type),this.notificationId=e}};N0.type="hide-notification";var Ta=N0,F0=class k0 extends Ct{constructor(e){super(k0.type),this.overlayId=e}};F0.type="hide-overlay";var z0=F0,B0=class H0 extends Ct{constructor(e){super(H0.type),this.panelId=e}};B0.type="hide-panel";var Br=B0,V0=class G0 extends Ct{constructor(e){super(G0.type),this.tooltipData=e}};V0.type="hide-tooltip";var W0=V0,X0=class j0 extends Ct{constructor(e,t){super(j0.type,!0),this.key=e,this.originalEvent=t}matches(e){return Vf(this.originalEvent,e)}};X0.type="key-press";var Hr=X0,Y0=class $0 extends Ct{constructor(e){super($0.type),this.progress=e}};Y0.type="load-progress";var q0=Y0,K0=class Z0 extends Ct{constructor(e){super(Z0.type),this.panorama=e}};K0.type="panorama-load";var Q0=K0,J0=class ey extends Ct{constructor(e){super(ey.type),this.data=e}};J0.type="panorama-loaded";var Mo=J0,ty=class ny extends Ct{constructor(e,t){super(ny.type),this.panorama=e,this.error=t}};ty.type="panorama-error";var iy=ty,ry=class sy extends Ct{constructor(e){super(sy.type),this.completed=e}};ry.type="transition-done";var oy=ry,ay=class ly extends Ct{constructor(e){super(ly.type),this.position=e}};ay.type="position-updated";var Aa=ay,cy=class uy extends Ct{constructor(e){super(uy.type),this.roll=e}};cy.type="roll-updated";var Ca=cy,dy=class hy extends Ct{constructor(){super(hy.type)}};dy.type="ready";var Ra=dy,fy=class py extends Ct{constructor(){super(py.type)}};fy.type="render";var my=fy,vy=class gy extends Ct{constructor(e){super(gy.type),this.notificationId=e}};vy.type="show-notification";var ba=vy,_y=class yy extends Ct{constructor(e){super(yy.type),this.overlayId=e}};_y.type="show-overlay";var xy=_y,Ey=class Sy extends Ct{constructor(e){super(Sy.type),this.panelId=e}};Ey.type="show-panel";var Vr=Ey,My=class wy extends Ct{constructor(e,t){super(wy.type),this.tooltip=e,this.tooltipData=t}};My.type="show-tooltip";var Ty=My,Ay=class Cy extends Ct{constructor(e){super(Cy.type),this.size=e}};Ay.type="size-updated";var Pa=Ay,Ry=class by extends Ct{constructor(){super(by.type)}};Ry.type="stop-all";var La=Ry,Py=class Ly extends Ct{constructor(e){super(Ly.type),this.zoomLevel=e}};Py.type="zoom-updated";var or=Py,iu=class extends Ct{constructor(n,e,t,s,o){super(n),this.originalEvent=e,this.object=t,this.viewerPoint=s,this.userDataKey=o}},Iy=class Uy extends iu{constructor(e,t,s,o){super(Uy.type,e,t,s,o)}};Iy.type="enter-object";var Dy=Iy,Ny=class Oy extends iu{constructor(e,t,s,o){super(Oy.type,e,t,s,o)}};Ny.type="leave-object";var xf=Ny,Fy=class ky extends iu{constructor(e,t,s,o){super(ky.type,e,t,s,o)}};Fy.type="hover-object";var zy=Fy,qf=class{constructor(n){this.viewer=n}init(){}destroy(){}supportsTransition(n){return!1}supportsPreload(n){return!1}textureCoordsToSphericalCoords(n,e){throw new At("Current adapter does not support texture coordinates.")}sphericalCoordsToTextureCoords(n,e){throw new At("Current adapter does not support texture coordinates.")}};qf.supportsDownload=!1;function Xg(n){if(n){for(const[,e]of[["_",n],...Object.entries(n)])if(e.prototype instanceof qf)return Yf(e.id,e.VERSION,"5.14.1"),e}return null}var ga=`${Yr}_touchSupport`,Un={loaded:!1,pixelRatio:1,isWebGLSupported:!1,maxTextureWidth:0,isTouchEnabled:null,__maxCanvasWidth:null,isIphone:!1,get maxCanvasWidth(){return this.__maxCanvasWidth===null&&(this.__maxCanvasWidth=wR(this.maxTextureWidth)),this.__maxCanvasWidth},load(){if(!this.loaded){const n=SR();this.pixelRatio=window.devicePixelRatio||1,this.isWebGLSupported=!!n,this.maxTextureWidth=n?n.getParameter(n.MAX_TEXTURE_SIZE):0,this.isTouchEnabled=MR(),this.isIphone=/iPhone/i.test(navigator.userAgent),this.loaded=!0}if(!Un.isWebGLSupported)throw new At("WebGL 2 is not supported.");if(Un.maxTextureWidth===0)throw new At("Unable to detect system capabilities")}};function SR(){try{return document.createElement("canvas").getContext("webgl2")}catch{return null}}function MR(){let n="ontouchstart"in window||navigator.maxTouchPoints>0;ga in localStorage&&(n=localStorage[ga]==="true");const e=new Promise(t=>{const s=()=>{window.removeEventListener("mousedown",o),window.removeEventListener("touchstart",l),clearTimeout(d)},o=()=>{s(),localStorage[ga]=!1,t(!1)},l=()=>{s(),localStorage[ga]=!0,t(!0)},u=()=>{s(),localStorage[ga]=n,t(n)};window.addEventListener("mousedown",o,!1),window.addEventListener("touchstart",l,!1);const d=setTimeout(u,1e4)});return{initial:n,promise:e}}function wR(n){let e=n,t=!1;const s=document.createElement("canvas"),o=s.getContext("2d");for(s.width=1,s.height=1;e>1024&&!t;){const l=document.createElement("canvas"),u=l.getContext("2d");l.width=e,l.height=e/2;try{u.fillStyle="white",u.fillRect(e-1,e/2-1,1,1),o.drawImage(l,e-1,e/2-1,1,1,0,0,1,1),o.getImageData(0,0,1,1).data[0]>0&&(t=!0)}catch{}l.width=0,l.height=0,t||(e/=2)}if(t)return e;throw new At("Unable to detect system capabilities")}var TR=tu({resolution:64,useXmpData:!0,blur:!1},{resolution:n=>{if(!n||!Pt.isPowerOfTwo(n))throw new At("EquirectangularAdapter resolution must be power of two.");return n}}),ru=class By extends qf{static withConfig(e){return[By,e]}constructor(e,t){super(e),this.config=TR(t),this.SPHERE_SEGMENTS=this.config.resolution,this.SPHERE_HORIZONTAL_SEGMENTS=this.SPHERE_SEGMENTS/2}supportsTransition(){return!0}supportsPreload(){return!0}textureCoordsToSphericalCoords(e,t){if(hn(e.textureX)||hn(e.textureY))throw new At("Texture position is missing 'textureX' or 'textureY'");const s=(e.textureX+t.croppedX)/t.fullWidth*Math.PI*2,o=(e.textureY+t.croppedY)/t.fullHeight*Math.PI;return{yaw:s>=Math.PI?s-Math.PI:s+Math.PI,pitch:Math.PI/2-o}}sphericalCoordsToTextureCoords(e,t){const s=e.yaw/Math.PI/2*t.fullWidth,o=e.pitch/Math.PI*t.fullHeight;let l=Math.round(e.yaw<Math.PI?s+t.fullWidth/2:s-t.fullWidth/2)-t.croppedX,u=Math.round(t.fullHeight/2-o)-t.croppedY;return(l<0||l>t.croppedWidth||u<0||u>t.croppedHeight)&&(l=u=void 0),{textureX:l,textureY:u}}async loadTexture(e,t=!0,s,o=this.config.useXmpData){if(typeof e!="string"&&(typeof e!="object"||!e.path))return Promise.reject(new At("Invalid panorama url, are you using the right adapter?"));let l;typeof e=="string"?l={path:e,data:s}:l={data:s,...e};const u=await this.viewer.textureLoader.loadFile(l.path,t?g=>this.viewer.textureLoader.dispatchProgress(g):null,l.path),d=o?await this.loadXMP(u):null,f=await this.viewer.textureLoader.blobToImage(u);typeof l.data=="function"&&(l.data=l.data(f,d));const p=f0(f.width,f.height,l.data,d),v=this.createEquirectangularTexture(f);return{panorama:e,texture:v,panoData:p,cacheKey:l.path}}async loadXMP(e){const t=await this.loadBlobAsString(e),s=t.indexOf("<x:xmpmeta");if(s===-1)return null;const o=t.indexOf("</x:xmpmeta>",s);if(o===-1)return null;const l=t.substring(s,o);return l.includes("GPano:")?{fullWidth:Zn(l,"FullPanoWidthPixels"),fullHeight:Zn(l,"FullPanoHeightPixels"),croppedWidth:Zn(l,"CroppedAreaImageWidthPixels"),croppedHeight:Zn(l,"CroppedAreaImageHeightPixels"),croppedX:Zn(l,"CroppedAreaLeftPixels"),croppedY:Zn(l,"CroppedAreaTopPixels"),poseHeading:Zn(l,"PoseHeadingDegrees",!1),posePitch:Zn(l,"PosePitchDegrees",!1),poseRoll:Zn(l,"PoseRollDegrees",!1),initialHeading:Zn(l,"InitialViewHeadingDegrees",!1),initialPitch:Zn(l,"InitialViewPitchDegrees",!1),initialFov:Zn(l,"InitialHorizontalFOVDegrees",!1)}:null}loadBlobAsString(e){return new Promise((t,s)=>{const o=new FileReader;o.onload=()=>t(o.result),o.onerror=s,o.readAsText(e)})}createEquirectangularTexture(e){if(this.config.blur||e.width>Un.maxTextureWidth){const t=Math.min(1,Un.maxCanvasWidth/e.width),s=new OffscreenCanvas(Math.floor(e.width*t),Math.floor(e.height*t)),o=s.getContext("2d");return this.config.blur&&(o.filter=`blur(${s.width/2048}px)`),o.drawImage(e,0,0,s.width,s.height),_f(s)}return _f(e)}createMesh(e){const t=e.croppedX/e.fullWidth*2*Math.PI,s=e.croppedWidth/e.fullWidth*2*Math.PI,o=e.croppedY/e.fullHeight*Math.PI,l=e.croppedHeight/e.fullHeight*Math.PI,u=new Va(As,Math.round(this.SPHERE_SEGMENTS/(2*Math.PI)*s),Math.round(this.SPHERE_HORIZONTAL_SEGMENTS/Math.PI*l),-Math.PI/2+t,s,o,l).scale(-1,1,1),d=new Ba({depthTest:!1,depthWrite:!1});return new di(u,d)}setTexture(e,t){e.material.map=t.texture}setTextureOpacity(e,t){e.material.opacity=t,e.material.transparent=t<1}disposeTexture({texture:e}){e.dispose()}disposeMesh(e){e.geometry.dispose(),e.material.dispose()}};ru.id="equirectangular";ru.VERSION="5.14.1";ru.supportsDownload=!0;var Hy=ru,Vy=class Gy extends Hy{static withConfig(e){return[Gy,e]}constructor(e,t){super(e,{resolution:(t==null?void 0:t.resolution)??64,useXmpData:!1})}async loadTexture(e,t){const s=await super.loadTexture(e,t,null,!1);return s.panoData=null,s}createMesh(){const e=new Va(As,this.SPHERE_SEGMENTS,this.SPHERE_HORIZONTAL_SEGMENTS).scale(-1,1,1).toNonIndexed(),t=e.getAttribute("uv"),s=e.getAttribute("normal");for(let l=0;l<t.count;l++)for(let u=0;u<3;u++){const d=l*3+u,f=s.getX(d),p=s.getY(d),v=s.getZ(d),g=.947;if(l<t.count/6){const y=f===0&&v===0?1:Math.acos(p)/Math.sqrt(f*f+v*v)*(2/Math.PI);t.setXY(d,f*(g/4)*y+1/4,v*(g/2)*y+1/2)}else{const y=f===0&&v===0?1:Math.acos(-p)/Math.sqrt(f*f+v*v)*(2/Math.PI);t.setXY(d,-f*(g/4)*y+3/4,v*(g/2)*y+1/2)}}e.rotateX(-Math.PI/2),e.rotateY(Math.PI);const o=new Ba({depthTest:!1,depthWrite:!1});return new di(e,o)}};Vy.id="dual-fisheye";Vy.VERSION="5.14.1";var Cs=class Wy{constructor(e,t){this.parent=e,this.children=[],this.state={visible:!0},this.viewer=e instanceof Wy?e.viewer:e,this.container=document.createElement(t.tagName??"div"),this.container.className=t.className||"",this.parent.children.push(this),this.parent.container.appendChild(this.container)}destroy(){this.parent.container.removeChild(this.container);const e=this.parent.children.indexOf(this);e!==-1&&this.parent.children.splice(e,1),this.children.slice().forEach(t=>t.destroy()),this.children.length=0}toggle(e=!this.isVisible()){e?this.show():this.hide()}hide(e){this.container.style.display="none",this.state.visible=!1}show(e){this.container.style.display="",this.state.visible=!0}isVisible(){return this.state.visible}},AR=tu({id:null,tagName:null,className:null,title:null,hoverScale:!1,collapsable:!1,tabbable:!0,icon:null,iconActive:null}),Qn=class extends Cs{constructor(n,e){super(n,{tagName:e.tagName,className:`psv-button ${e.hoverScale?"psv-button--hover-scale":""} ${e.className||""}`}),this.state={visible:!0,enabled:!0,supported:!0,collapsed:!1,active:!1,width:0},this.config=AR(e),e.id||(this.config.id=this.constructor.id),e.icon&&this.__setIcon(e.icon),this.state.width=this.container.offsetWidth,this.config.title?this.container.title=this.viewer.config.lang[this.config.title]??this.config.title:this.id&&this.id in this.viewer.config.lang&&(this.container.title=this.viewer.config.lang[this.id]),e.tabbable&&(this.container.tabIndex=0),this.container.addEventListener("click",t=>{this.state.enabled&&this.onClick(),t.stopPropagation()}),this.container.addEventListener("keydown",t=>{t.key===dn.Enter&&this.state.enabled&&(this.onClick(),t.stopPropagation())})}get id(){return this.config.id}get title(){return this.container.title}get content(){return this.container.innerHTML}get width(){return this.state.width}get collapsable(){return this.config.collapsable}show(n=!0){this.isVisible()||(this.state.visible=!0,this.state.collapsed||(this.container.style.display=""),n&&this.viewer.navbar.autoSize())}hide(n=!0){this.isVisible()&&(this.state.visible=!1,this.container.style.display="none",n&&this.viewer.navbar.autoSize())}checkSupported(){Wf(this.isSupported(),(n,e)=>{this.state&&(this.state.supported=n,e?n||this.hide():this.toggle(n))})}autoSize(){}isSupported(){return!0}toggleActive(n=!this.state.active){n!==this.state.active&&(this.state.active=n,Qc(this.container,"psv-button--active",this.state.active),this.config.iconActive&&this.__setIcon(this.state.active?this.config.iconActive:this.config.icon))}disable(){this.container.classList.add("psv-button--disabled"),this.state.enabled=!1}enable(){this.container.classList.remove("psv-button--disabled"),this.state.enabled=!0}collapse(){this.state.collapsed=!0,this.container.style.display="none"}uncollapse(){this.state.collapsed=!1,this.state.visible&&(this.container.style.display="")}__setIcon(n){this.container.innerHTML=n,Hf(this.container.querySelector("svg"),"psv-button-svg")}},CR=class extends Qn{constructor(n,e){var t,s;super(n,{id:e.id??`psvButton-${Math.random().toString(36).substring(2)}`,className:`psv-custom-button ${e.className||""}`,hoverScale:!1,collapsable:e.collapsable!==!1,tabbable:e.tabbable!==!1,title:e.title}),this.customOnClick=e.onClick,e.content&&(typeof e.content=="string"?this.container.innerHTML=e.content:(this.container.classList.add("psv-custom-button--no-padding"),e.content.style.height="100%",(s=(t=e.content).attachViewer)==null||s.call(t,this.viewer),this.container.appendChild(e.content))),this.state.width=this.container.offsetWidth,e.disabled&&this.disable(),e.visible===!1&&this.hide()}onClick(){var n;(n=this.customOnClick)==null||n.call(this,this.viewer)}},ka=class extends Qn{constructor(n){super(n,{className:"psv-description-button",hoverScale:!0,collapsable:!1,tabbable:!0,icon:Ci.info}),this.mode=0,this.viewer.addEventListener(Ta.type,this),this.viewer.addEventListener(ba.type,this),this.viewer.addEventListener(Br.type,this),this.viewer.addEventListener(Vr.type,this),this.viewer.addEventListener(Gn.type,this)}destroy(){this.viewer.removeEventListener(Ta.type,this),this.viewer.removeEventListener(ba.type,this),this.viewer.removeEventListener(Br.type,this),this.viewer.removeEventListener(Vr.type,this),this.viewer.removeEventListener(Gn.type,this),super.destroy()}handleEvent(n){if(n instanceof Gn){n.containsOptions("description")&&this.autoSize(!0);return}if(!this.mode)return;let e=!1;n instanceof Ta?e=this.mode===1:n instanceof ba?e=this.mode===1&&n.notificationId!==mn.DESCRIPTION:n instanceof Br?e=this.mode===2:n instanceof Vr&&(e=this.mode===2&&n.panelId!==mn.DESCRIPTION),e&&(this.toggleActive(!1),this.mode=0)}onClick(){this.mode?this.__close():this.__open()}hide(n){super.hide(n),this.mode&&this.__close()}autoSize(n=!1){if(n){const e=this.viewer.navbar.getButton("caption",!1),t=e&&!e.isVisible(),s=!!this.viewer.config.description;t||s?this.show(!1):this.hide(!1)}}__close(){switch(this.mode){case 1:this.viewer.notification.hide(mn.DESCRIPTION);break;case 2:this.viewer.panel.hide(mn.DESCRIPTION);break}}__open(){this.toggleActive(!0),this.viewer.config.description?(this.mode=2,this.viewer.panel.show({id:mn.DESCRIPTION,content:`${this.viewer.config.caption?`<p>${this.viewer.config.caption}</p>`:""}${this.viewer.config.description}`})):(this.mode=1,this.viewer.notification.show({id:mn.DESCRIPTION,content:this.viewer.config.caption}))}};ka.id="description";var Xy=class extends Qn{constructor(n){super(n,{tagName:"a",className:"psv-download-button",hoverScale:!0,collapsable:!0,tabbable:!0,icon:Ci.download}),this.viewer.addEventListener(Gn.type,this),this.viewer.addEventListener(Mo.type,this)}destroy(){this.viewer.removeEventListener(Gn.type,this),this.viewer.removeEventListener(Mo.type,this),super.destroy()}handleEvent(n){n instanceof Gn?(n.containsOptions("downloadUrl")&&this.checkSupported(),n.containsOptions("downloadUrl","downloadName")&&this.__update()):n instanceof Mo&&this.__update()}onClick(){}checkSupported(){this.viewer.adapter.constructor.supportsDownload||this.viewer.config.downloadUrl?this.show():this.hide()}__update(){const n=this.container;n.href=this.viewer.config.downloadUrl||this.viewer.config.panorama,n.target="_blank",n.href.startsWith("data:")&&!this.viewer.config.downloadName?n.download="panorama."+n.href.substring(0,n.href.indexOf(";")).split("/").pop():n.download=this.viewer.config.downloadName||n.href.split("/").pop()}};Xy.id="download";var jy=class extends Qn{constructor(n){super(n,{className:"psv-fullscreen-button",hoverScale:!0,collapsable:!1,tabbable:!0,icon:Ci.fullscreenIn,iconActive:Ci.fullscreenOut}),this.viewer.addEventListener(wa.type,this)}destroy(){this.viewer.removeEventListener(wa.type,this),super.destroy()}handleEvent(n){n instanceof wa&&this.toggleActive(n.fullscreenEnabled)}onClick(){this.viewer.toggleFullscreen()}};jy.id="fullscreen";var RR="psvButton",bR=(n,e)=>`
<div class="psv-panel-menu psv-panel-menu--stripped">
  <h1 class="psv-panel-menu-title">${Ci.menu} ${e}</h1>
  <ul class="psv-panel-menu-list">
    ${n.map(t=>`
    <li data-psv-button="${t.id}" class="psv-panel-menu-item" tabindex="0">
      <span class="psv-panel-menu-item-icon">${t.content}</span>
      <span class="psv-panel-menu-item-label">${t.title}</span>
    </li>
    `).join("")}
  </ul>
</div>
`,Dc=class extends Qn{constructor(n){super(n,{className:"psv-menu-button",hoverScale:!0,collapsable:!1,tabbable:!0,icon:Ci.menu}),this.viewer.addEventListener(Vr.type,this),this.viewer.addEventListener(Br.type,this),super.hide()}destroy(){this.viewer.removeEventListener(Vr.type,this),this.viewer.removeEventListener(Br.type,this),super.destroy()}handleEvent(n){n instanceof Vr?this.toggleActive(n.panelId===mn.MENU):n instanceof Br&&this.toggleActive(!1)}onClick(){this.state.active?this.__hideMenu():this.__showMenu()}hide(n){super.hide(n),this.__hideMenu()}show(n){super.show(n),this.state.active&&this.__showMenu()}__showMenu(){this.viewer.panel.show({id:mn.MENU,content:bR(this.viewer.navbar.collapsed,this.viewer.config.lang.menu),noMargin:!0,clickHandler:n=>{const e=n?Z_(n,".psv-panel-menu-item"):void 0,t=e?e.dataset[RR]:void 0;t&&(this.viewer.navbar.getButton(t).onClick(),this.__hideMenu())}})}__hideMenu(){this.viewer.panel.hide(mn.MENU)}};Dc.id="menu";function PR(n){let e=0;switch(n){case 0:e=90;break;case 1:e=-90;break;case 3:e=180;break;default:e=0;break}return Ci.arrow.replace("rotate(0",`rotate(${e}`)}var Wa=class extends Qn{constructor(n,e){super(n,{className:"psv-move-button",hoverScale:!0,collapsable:!1,tabbable:!0,icon:PR(e)}),this.direction=e,this.handler=new nu,this.container.addEventListener("mousedown",this),this.container.addEventListener("keydown",this),this.container.addEventListener("keyup",this),this.viewer.container.addEventListener("mouseup",this),this.viewer.container.addEventListener("touchend",this)}destroy(){this.__onMouseUp(),this.viewer.container.removeEventListener("mouseup",this),this.viewer.container.removeEventListener("touchend",this),super.destroy()}handleEvent(n){switch(n.type){case"mousedown":this.__onMouseDown();break;case"mouseup":this.__onMouseUp();break;case"touchend":this.__onMouseUp();break;case"keydown":n.key===dn.Enter&&this.__onMouseDown();break;case"keyup":n.key===dn.Enter&&this.__onMouseUp();break}}onClick(){}isSupported(){return eu(Un.isTouchEnabled)}__onMouseDown(){if(!this.state.enabled)return;const n={};switch(this.direction){case 0:n.pitch=!1;break;case 1:n.pitch=!0;break;case 3:n.yaw=!1;break;default:n.yaw=!0;break}this.viewer.stopAll(),this.viewer.dynamics.position.roll(n),this.handler.down()}__onMouseUp(){this.state.enabled&&this.handler.up(()=>{this.viewer.dynamics.position.stop(),this.viewer.resetIdleTimer()})}};Wa.groupId="move";var Yy=class extends Wa{constructor(n){super(n,1)}};Yy.id="moveDown";var $y=class extends Wa{constructor(n){super(n,2)}};$y.id="moveLeft";var qy=class extends Wa{constructor(n){super(n,3)}};qy.id="moveRight";var Ky=class extends Wa{constructor(n){super(n,0)}};Ky.id="moveUp";var Kf=class extends Qn{constructor(n,e,t){super(n,{className:"psv-zoom-button",hoverScale:!0,collapsable:!1,tabbable:!0,icon:e}),this.direction=t,this.handler=new nu,this.container.addEventListener("mousedown",this),this.container.addEventListener("keydown",this),this.container.addEventListener("keyup",this),this.viewer.container.addEventListener("mouseup",this),this.viewer.container.addEventListener("touchend",this)}destroy(){this.__onMouseUp(),this.viewer.container.removeEventListener("mouseup",this),this.viewer.container.removeEventListener("touchend",this),super.destroy()}handleEvent(n){switch(n.type){case"mousedown":this.__onMouseDown();break;case"mouseup":this.__onMouseUp();break;case"touchend":this.__onMouseUp();break;case"keydown":n.key===dn.Enter&&this.__onMouseDown();break;case"keyup":n.key===dn.Enter&&this.__onMouseUp();break}}onClick(){}isSupported(){return eu(Un.isTouchEnabled)}__onMouseDown(){this.state.enabled&&(this.viewer.dynamics.zoom.roll(this.direction===1),this.handler.down())}__onMouseUp(){this.state.enabled&&this.handler.up(()=>this.viewer.dynamics.zoom.stop())}};Kf.groupId="zoom";var Zy=class extends Kf{constructor(n){super(n,Ci.zoomIn,0)}};Zy.id="zoomIn";var Qy=class extends Kf{constructor(n){super(n,Ci.zoomOut,1)}};Qy.id="zoomOut";var Zf=class extends Qn{constructor(n){super(n,{className:"psv-zoom-range",hoverScale:!1,collapsable:!1,tabbable:!1}),this.zoomRange=document.createElement("div"),this.zoomRange.className="psv-zoom-range-line",this.container.appendChild(this.zoomRange),this.zoomValue=document.createElement("div"),this.zoomValue.className="psv-zoom-range-handle",this.zoomRange.appendChild(this.zoomValue),this.slider=new v0(this.container,"HORIZONTAL",e=>this.__onSliderUpdate(e)),this.mediaMinWidth=parseInt(Oi(this.container,"max-width"),10),this.viewer.addEventListener(or.type,this),this.viewer.state.ready?this.__moveZoomValue(this.viewer.getZoomLevel()):this.viewer.addEventListener(Ra.type,this)}destroy(){this.slider.destroy(),this.viewer.removeEventListener(or.type,this),this.viewer.removeEventListener(Ra.type,this),super.destroy()}handleEvent(n){n instanceof or?this.__moveZoomValue(n.zoomLevel):n instanceof Ra&&this.__moveZoomValue(this.viewer.getZoomLevel())}onClick(){}isSupported(){return eu(Un.isTouchEnabled)}autoSize(){this.state.supported&&(this.viewer.state.size.width<=this.mediaMinWidth&&this.state.visible?this.hide(!1):this.viewer.state.size.width>this.mediaMinWidth&&!this.state.visible&&this.show(!1))}__moveZoomValue(n){this.zoomValue.style.left=n/100*this.zoomRange.offsetWidth-this.zoomValue.offsetWidth/2+"px"}__onSliderUpdate(n){n.mousedown&&this.viewer.zoom(n.value*100)}};Zf.id="zoomRange";Zf.groupId="zoom";var Jy=class extends g0{constructor(n){super(),this.viewer=n}init(){}destroy(){}},LR=class extends Jy{constructor(n,e){super(n),this.config=this.constructor.configParser(e)}setOption(n,e){this.setOptions({[n]:e})}setOptions(n){const e={...this.config,...n},t=this.constructor,s=t.configParser,o=t.readonlyOptions,l=t.id;for(let[u,d]of Object.entries(n)){if(!(u in s.defaults)){vn(`${l}: Unknown option "${u}"`);continue}if(o.includes(u)){vn(`${l}: Option "${u}" cannot be updated`);continue}u in s.parsers&&(d=s.parsers[u](d,{rawConfig:e,defValue:s.defaults[u]})),this.config[u]=d}}};LR.readonlyOptions=[];function Ef(n){if(n){for(const[,e]of[["_",n],...Object.entries(n)])if(e.prototype instanceof Jy)return Yf(e.id,e.VERSION,"5.14.1"),e}return null}var Ro={panorama:null,container:null,adapter:[Hy,null],plugins:[],caption:null,description:null,downloadUrl:null,downloadName:null,loadingImg:null,loadingTxt:"",size:null,fisheye:0,minFov:30,maxFov:90,defaultZoomLvl:50,defaultYaw:0,defaultPitch:0,sphereCorrection:null,moveSpeed:1,zoomSpeed:1,moveInertia:.8,mousewheel:!0,mousemove:!0,mousewheelCtrlKey:!1,touchmoveTwoFingers:!1,panoData:null,requestHeaders:null,canvasBackground:"#000",defaultTransition:{speed:1500,rotation:!0,effect:"fade"},rendererParameters:{alpha:!0,antialias:!0},withCredentials:()=>!1,navbar:["zoom","move","download","description","caption","fullscreen"],lang:{zoom:"Zoom",zoomOut:"Zoom out",zoomIn:"Zoom in",moveUp:"Move up",moveDown:"Move down",moveLeft:"Move left",moveRight:"Move right",description:"Description",download:"Download",fullscreen:"Fullscreen",loading:"Loading...",menu:"Menu",close:"Close",twoFingers:"Use two fingers to navigate",ctrlZoom:"Use ctrl + scroll to zoom the image",loadError:"The panorama cannot be loaded",webglError:"Your browser does not seem to support WebGL"},keyboard:"fullscreen",keyboardActions:{[dn.ArrowUp]:"ROTATE_UP",[dn.ArrowDown]:"ROTATE_DOWN",[dn.ArrowRight]:"ROTATE_RIGHT",[dn.ArrowLeft]:"ROTATE_LEFT",[dn.PageUp]:"ZOOM_IN",[dn.PageDown]:"ZOOM_OUT",[dn.Plus]:"ZOOM_IN",[dn.Minus]:"ZOOM_OUT"}},jg={panorama:"Use setPanorama method to change the panorama",panoData:"Use setPanorama method to change the panorama",container:"Cannot change viewer container",adapter:"Cannot change adapter",plugins:"Cannot change plugins"},Sf={container:n=>{if(!n)throw new At("No value given for container.");return n},adapter:(n,{defValue:e})=>{if(n?Array.isArray(n)?n=[Xg(n[0]),n[1]]:n=[Xg(n),null]:n=e,!n[0])throw new At("An undefined value was given for adapter.");if(!n[0].id)throw new At("Adapter has no id.");return n},defaultYaw:n=>Ui(n),defaultPitch:n=>Ui(n,!0),defaultZoomLvl:n=>Pt.clamp(n,0,100),minFov:(n,{rawConfig:e})=>(e.maxFov<n&&(vn("maxFov cannot be lower than minFov"),n=e.maxFov),Pt.clamp(n,1,179)),maxFov:(n,{rawConfig:e})=>(n<e.minFov&&(n=e.minFov),Pt.clamp(n,1,179)),moveInertia:(n,{defValue:e})=>n===!0?e:n===!1?0:n,lang:n=>({...Ro.lang,...n}),fisheye:n=>n===!0?1:n===!1?0:n,requestHeaders:n=>n&&typeof n=="object"?()=>n:typeof n=="function"?n:null,withCredentials:n=>typeof n=="boolean"?()=>n:typeof n=="function"?n:()=>!1,defaultTransition:(n,{defValue:e})=>n===null||n.speed===0?null:{...e,...n},rendererParameters:(n,{defValue:e})=>({...n,...e}),plugins:n=>n.map((e,t)=>{if(Array.isArray(e)?e=[Ef(e[0]),e[1]]:e=[Ef(e),null],!e[0])throw new At(`An undefined value was given for plugin ${t}.`);if(!e[0].id)throw new At(`Plugin ${t} has no id.`);return e}),navbar:n=>n===!1?null:n===!0?Jc(Ro.navbar):typeof n=="string"?n.split(/[ ,]/):n},IR=tu(Ro,Sf),yo=class extends Qn{constructor(n){super(n,{className:"psv-caption",hoverScale:!1,collapsable:!1,tabbable:!0}),this.contentWidth=0,this.state.width=0,this.contentElt=document.createElement("div"),this.contentElt.className="psv-caption-content",this.container.appendChild(this.contentElt),this.setCaption(this.viewer.config.caption)}hide(){this.contentElt.style.display="none",this.state.visible=!1}show(){this.contentElt.style.display="",this.state.visible=!0}onClick(){}setCaption(n){this.show(),this.contentElt.innerHTML=n??"",this.contentElt.innerHTML?this.contentWidth=this.contentElt.offsetWidth:this.contentWidth=0,this.autoSize()}autoSize(){this.toggle(this.container.offsetWidth>=this.contentWidth),this.__refreshButton()}__refreshButton(){var n;(n=this.viewer.navbar.getButton(ka.id,!1))==null||n.autoSize(!0)}};yo.id="caption";var Mf={},jc={};function UR(n,e){if(!n.id)throw new At("Button id is required");Mf[n.id]=n,n.groupId&&(jc[n.groupId]=jc[n.groupId]||[]).push(n)}[Qy,Zf,Zy,ka,yo,Xy,jy,$y,qy,Ky,Yy].forEach(n=>UR(n));var DR=class extends Cs{constructor(n){super(n,{className:`psv-navbar ${Ga}`}),this.collapsed=[],this.state.visible=!1}show(){this.viewer.container.classList.add("psv--has-navbar"),this.container.classList.add("psv-navbar--open"),this.state.visible=!0}hide(){this.viewer.container.classList.remove("psv--has-navbar"),this.container.classList.remove("psv-navbar--open"),this.state.visible=!1}setButtons(n){this.children.slice().forEach(e=>e.destroy()),this.children.length=0,n.indexOf(yo.id)!==-1&&n.indexOf(ka.id)===-1&&n.splice(n.indexOf(yo.id),0,ka.id),n.forEach(e=>{typeof e=="object"?new CR(this,e):Mf[e]?new Mf[e](this):jc[e]?jc[e].forEach(t=>{new t(this)}):vn(`Unknown button ${e}`)}),new Dc(this),this.children.forEach(e=>{e instanceof Qn&&e.checkSupported()}),this.autoSize()}setCaption(n){this.children.some(e=>e instanceof yo?(e.setCaption(n),!0):!1)}getButton(n,e=!0){const t=this.children.find(s=>s instanceof Qn&&s.id===n);return!t&&e&&vn(`button "${n}" not found in the navbar`),t}focusButton(n){var e,t;this.isVisible()&&((t=((e=this.getButton(n,!1))==null?void 0:e.container)||this.container.firstElementChild)==null||t.focus())}autoSize(){var s;this.children.forEach(o=>{o instanceof Qn&&o.autoSize()});const n=this.container.offsetWidth;let e=0;const t=[];this.children.forEach(o=>{o.isVisible()&&o instanceof Qn&&(e+=o.width,o.collapsable&&t.push(o))}),e!==0&&(n<e&&t.length>0?(t.forEach(o=>o.collapse()),this.collapsed=t,this.getButton(Dc.id).show(!1)):n>=e&&this.collapsed.length>0&&(this.collapsed.forEach(o=>o.uncollapse()),this.collapsed=[],this.getButton(Dc.id).hide(!1)),(s=this.getButton(yo.id,!1))==null||s.autoSize())}};zr.enabled=!1;var vo={enabled:!0,maxItems:10,ttl:600,items:{},purgeInterval:null,init(){zr.enabled&&(vn("ThreeJS cache should be disabled"),zr.enabled=!1),!this.purgeInterval&&this.enabled&&(this.purgeInterval=setInterval(()=>this.purge(),60*1e3))},add(n,e,t){this.enabled&&e&&(this.items[e]=this.items[e]??{files:{},lastAccess:null},this.items[e].files[n]=t,this.items[e].lastAccess=Date.now())},get(n,e){if(this.enabled&&e&&this.items[e])return this.items[e].lastAccess=Date.now(),this.items[e].files[n]},remove(n,e){this.enabled&&e&&this.items[e]&&(delete this.items[e].files[n],Object.keys(this.items[e].files).length===0&&delete this.items[e])},purge(){Object.entries(this.items).sort(([,n],[,e])=>e.lastAccess-n.lastAccess).forEach(([n,{lastAccess:e}],t)=>{t>0&&(Date.now()-e>=this.ttl*1e3||t>=this.maxItems)&&delete this.items[n]})}},NR=class extends Cs{constructor(n){super(n,{className:"psv-loader-container"}),this.loader=document.createElement("div"),this.loader.className="psv-loader",this.container.appendChild(this.loader),this.size=this.loader.offsetWidth,this.canvas=document.createElementNS("http://www.w3.org/2000/svg","svg"),this.canvas.setAttribute("class","psv-loader-canvas"),this.canvas.setAttribute("viewBox",`0 0 ${this.size} ${this.size}`),this.loader.appendChild(this.canvas),this.textColor=Oi(this.loader,"color"),this.color=Oi(this.canvas,"color"),this.border=parseInt(Oi(this.loader,"--psv-loader-border"),10),this.thickness=parseInt(Oi(this.loader,"--psv-loader-tickness"),10);const e=this.size/2;this.canvas.innerHTML=`
            <circle cx="${e}" cy="${e}" r="${e}" fill="${this.color}"/>
            <path d="" fill="none" stroke="${this.textColor}" stroke-width="${this.thickness}" stroke-linecap="round"/>
        `,this.viewer.addEventListener(Gn.type,this),this.__updateContent(),this.hide()}destroy(){this.viewer.removeEventListener(Gn.type,this),super.destroy()}handleEvent(n){n instanceof Gn&&n.containsOptions("loadingImg","loadingTxt","lang")&&this.__updateContent()}setProgress(n){this.container.classList.remove("psv-loader--undefined");const e=Pt.clamp(n,0,99.999)/100*Math.PI*2,t=this.size/2,s=t,o=this.thickness/2+this.border,l=(this.size-this.thickness)/2-this.border,u=Math.sin(e)*l+t,d=-Math.cos(e)*l+t,f=n>50?"1":"0";this.canvas.querySelector("path").setAttributeNS(null,"d",`M ${s} ${o} A ${l} ${l} 0 ${f} 1 ${u} ${d}`)}showUndefined(){this.show(),this.setProgress(25),this.container.classList.add("psv-loader--undefined")}__updateContent(){const n=this.loader.querySelector(".psv-loader-image, .psv-loader-text");n&&this.loader.removeChild(n);let e;if(this.viewer.config.loadingImg?(e=document.createElement("img"),e.className="psv-loader-image",e.src=this.viewer.config.loadingImg):this.viewer.config.loadingTxt!==null&&(e=document.createElement("div"),e.className="psv-loader-text",e.innerHTML=this.viewer.config.loadingTxt||this.viewer.config.lang.loading),e){const t=Math.round(Math.sqrt(2*Math.pow(this.size/2-this.thickness/2-this.border,2)));e.style.maxWidth=t+"px",e.style.maxHeight=t+"px",this.loader.appendChild(e)}}},OR=class extends Cs{constructor(n){super(n,{className:"psv-notification"}),this.state={visible:!1,contentId:null,timeout:null},this.content=document.createElement("div"),this.content.className="psv-notification-content",this.container.appendChild(this.content),this.content.addEventListener("click",()=>this.hide())}isVisible(n){return this.state.visible&&(!n||!this.state.contentId||this.state.contentId===n)}toggle(){throw new At("Notification cannot be toggled")}show(n){this.state.timeout&&(clearTimeout(this.state.timeout),this.state.timeout=null),typeof n=="string"&&(n={content:n}),this.state.contentId=n.id||null,this.content.innerHTML=n.content,this.container.classList.add("psv-notification--visible"),this.state.visible=!0,this.viewer.dispatchEvent(new ba(this.state.contentId)),n.timeout&&(this.state.timeout=setTimeout(()=>this.hide(this.state.contentId),n.timeout))}hide(n){if(this.isVisible(n)){const e=this.state.contentId;this.container.classList.remove("psv-notification--visible"),this.state.visible=!1,this.state.contentId=null,this.viewer.dispatchEvent(new Ta(e))}}},FR=class extends Cs{constructor(n){super(n,{className:`psv-overlay ${Ga}`}),this.state={visible:!1,contentId:null,dismissible:!0},this.image=document.createElement("div"),this.image.className="psv-overlay-image",this.container.appendChild(this.image),this.title=document.createElement("div"),this.title.className="psv-overlay-title",this.container.appendChild(this.title),this.text=document.createElement("div"),this.text.className="psv-overlay-text",this.container.appendChild(this.text),this.container.addEventListener("click",this),this.viewer.addEventListener(Hr.type,this),super.hide()}destroy(){this.viewer.removeEventListener(Hr.type,this),super.destroy()}handleEvent(n){n.type==="click"?this.isVisible()&&this.state.dismissible&&(this.hide(),n.stopPropagation()):n instanceof Hr&&this.isVisible()&&this.state.dismissible&&n.matches(dn.Escape)&&(this.hide(),n.preventDefault())}isVisible(n){return this.state.visible&&(!n||!this.state.contentId||this.state.contentId===n)}toggle(){throw new At("Overlay cannot be toggled")}show(n){typeof n=="string"&&(n={title:n}),this.state.contentId=n.id||null,this.state.dismissible=n.dismissible!==!1,this.image.innerHTML=n.image||"",this.title.innerHTML=n.title||"",this.text.innerHTML=n.text||"",super.show(),this.viewer.dispatchEvent(new xy(this.state.contentId))}hide(n){if(this.isVisible(n)){const e=this.state.contentId;super.hide(),this.state.contentId=null,this.viewer.dispatchEvent(new z0(e))}}},kR=200,Mh="psv-panel-content--no-interaction",zR=class extends Cs{constructor(n){super(n,{className:`psv-panel ${Ga}`}),this.state={visible:!1,contentId:null,mouseX:0,mouseY:0,mousedown:!1,clickHandler:null,keyHandler:null,width:{}};const e=document.createElement("div");e.className="psv-panel-resizer",this.container.appendChild(e);const t=document.createElement("div");t.className="psv-panel-close-button",t.innerHTML=Ci.close,t.title=n.config.lang.close,this.container.appendChild(t),this.content=document.createElement("div"),this.content.className="psv-panel-content",this.container.appendChild(this.content),t.addEventListener("click",()=>this.hide()),e.addEventListener("mousedown",this),e.addEventListener("touchstart",this),this.viewer.container.addEventListener("mouseup",this),this.viewer.container.addEventListener("touchend",this),this.viewer.container.addEventListener("mousemove",this),this.viewer.container.addEventListener("touchmove",this),this.viewer.addEventListener(Hr.type,this)}destroy(){this.viewer.removeEventListener(Hr.type,this),this.viewer.container.removeEventListener("mousemove",this),this.viewer.container.removeEventListener("touchmove",this),this.viewer.container.removeEventListener("mouseup",this),this.viewer.container.removeEventListener("touchend",this),super.destroy()}handleEvent(n){switch(n.type){case"mousedown":this.__onMouseDown(n);break;case"touchstart":this.__onTouchStart(n);break;case"mousemove":this.__onMouseMove(n);break;case"touchmove":this.__onTouchMove(n);break;case"mouseup":this.__onMouseUp(n);break;case"touchend":this.__onTouchEnd(n);break;case Hr.type:this.__onKeyPress(n);break}}isVisible(n){return this.state.visible&&(!n||!this.state.contentId||this.state.contentId===n)}toggle(){throw new At("Panel cannot be toggled")}show(n){typeof n=="string"&&(n={content:n});const e=this.isVisible(n.id);this.state.contentId=n.id||null,this.state.visible=!0,this.state.clickHandler&&(this.content.removeEventListener("click",this.state.clickHandler),this.content.removeEventListener("keydown",this.state.keyHandler),this.state.clickHandler=null,this.state.keyHandler=null),n.id&&this.state.width[n.id]?this.container.style.width=this.state.width[n.id]:n.width?this.container.style.width=n.width:this.container.style.width=null,this.content.innerHTML=n.content,this.content.scrollTop=0,this.container.classList.add("psv-panel--open"),Qc(this.content,"psv-panel-content--no-margin",n.noMargin===!0),n.clickHandler&&(this.state.clickHandler=t=>{n.clickHandler(Hc(t))},this.state.keyHandler=t=>{t.key===dn.Enter&&n.clickHandler(Hc(t))},this.content.addEventListener("click",this.state.clickHandler),this.content.addEventListener("keydown",this.state.keyHandler),e||setTimeout(()=>{var t;(t=this.content.querySelector("a,button,[tabindex]"))==null||t.focus()},300)),this.viewer.dispatchEvent(new Vr(this.state.contentId))}hide(n){if(this.isVisible(n)){const e=this.state.contentId;this.state.visible=!1,this.state.contentId=null,this.content.innerHTML=null,this.container.classList.remove("psv-panel--open"),this.state.clickHandler&&(this.content.removeEventListener("click",this.state.clickHandler),this.content.removeEventListener("keydown",this.state.keyHandler),this.state.clickHandler=null,this.state.keyHandler=null),this.viewer.dispatchEvent(new Br(e))}}__onMouseDown(n){n.stopPropagation(),this.__startResize(n.clientX,n.clientY)}__onTouchStart(n){if(n.stopPropagation(),n.touches.length===1){const e=n.touches[0];this.__startResize(e.clientX,e.clientY)}}__onMouseUp(n){this.state.mousedown&&(n.stopPropagation(),this.state.mousedown=!1,this.content.classList.remove(Mh))}__onTouchEnd(n){this.state.mousedown&&(n.stopPropagation(),n.touches.length===0&&(this.state.mousedown=!1,this.content.classList.remove(Mh)))}__onMouseMove(n){this.state.mousedown&&(n.stopPropagation(),this.__resize(n.clientX,n.clientY))}__onTouchMove(n){if(this.state.mousedown){const e=n.touches[0];this.__resize(e.clientX,e.clientY)}}__onKeyPress(n){this.isVisible()&&n.matches(dn.Escape)&&(this.hide(),n.preventDefault())}__startResize(n,e){this.state.mouseX=n,this.state.mouseY=e,this.state.mousedown=!0,this.content.classList.add(Mh)}__resize(n,e){const t=n,s=e,o=Math.max(kR,this.container.offsetWidth-(t-this.state.mouseX))+"px";this.state.contentId&&(this.state.width[this.state.contentId]=o),this.container.style.width=o,this.state.mouseX=t,this.state.mouseY=s}},BR=class extends Cs{constructor(n,e){super(n,{className:"psv-tooltip"}),this.state={visible:!0,arrow:0,border:0,state:0,width:0,height:0,pos:"",config:null,data:null,hideTimeout:null},this.content=document.createElement("div"),this.content.className="psv-tooltip-content",this.container.appendChild(this.content),this.arrow=document.createElement("div"),this.arrow.className="psv-tooltip-arrow",this.container.appendChild(this.arrow),this.container.addEventListener("transitionend",this),this.container.addEventListener("touchdown",t=>t.stopPropagation()),this.container.addEventListener("mousedown",t=>t.stopPropagation()),this.container.style.top="-1000px",this.container.style.left="-1000px",this.show(e)}handleEvent(n){n.type==="transitionend"&&this.__onTransitionEnd(n)}destroy(){clearTimeout(this.state.hideTimeout),delete this.state.data,super.destroy()}toggle(){throw new At("Tooltip cannot be toggled")}show(n){if(this.state.state!==0)throw new At("Initialized tooltip cannot be re-initialized");n.className&&Hf(this.container,n.className),n.style&&Object.assign(this.container.style,n.style),this.state.state=3,this.update(n.content,n),this.state.data=n.data,this.state.state=1,this.viewer.dispatchEvent(new Ty(this,this.state.data)),this.__waitImages()}update(n,e){this.content.innerHTML=n;const t=this.container.getBoundingClientRect();this.state.width=t.right-t.left,this.state.height=t.bottom-t.top,this.state.arrow=parseInt(Oi(this.arrow,"border-top-width"),10),this.state.border=parseInt(Oi(this.container,"border-top-left-radius"),10),this.move(e??this.state.config),this.__waitImages()}move(n){var d;if(this.state.state!==1&&this.state.state!==3)throw new At("Uninitialized tooltip cannot be moved");n.box=n.box??((d=this.state.config)==null?void 0:d.box)??{width:0,height:0},this.state.config=n;const e=this.container,t=this.arrow,s={posClass:c0(n.position,{allowCenter:!1,cssOrder:!1})||["top","center"],width:this.state.width,height:this.state.height,top:0,left:0,arrowTop:0,arrowLeft:0};this.__computeTooltipPosition(s,n);let o=null,l=null;if(s.top<0?o="bottom":s.top+s.height>this.viewer.state.size.height&&(o="top"),s.left<0?l="right":s.left+s.width>this.viewer.state.size.width&&(l="left"),l||o){const f=jf(s.posClass);o&&(s.posClass[f?0:1]=o),l&&(s.posClass[f?1:0]=l),this.__computeTooltipPosition(s,n)}e.style.top=s.top+"px",e.style.left=s.left+"px",t.style.top=s.arrowTop+"px",t.style.left=s.arrowLeft+"px";const u=s.posClass.join("-");u!==this.state.pos&&(e.classList.remove(`psv-tooltip--${this.state.pos}`),this.state.pos=u,e.classList.add(`psv-tooltip--${this.state.pos}`))}hide(){this.container.classList.remove("psv-tooltip--visible"),this.state.state=2,this.viewer.dispatchEvent(new W0(this.state.data));const n=parseFloat(Oi(this.container,"transition-duration"));this.state.hideTimeout=setTimeout(()=>{this.destroy()},n*2)}__onTransitionEnd(n){if(n.propertyName==="transform")switch(this.state.state){case 1:this.container.classList.add("psv-tooltip--visible"),this.state.state=3;break;case 2:this.state.state=0,this.destroy();break}}__computeTooltipPosition(n,e){const t=this.state.arrow,s=e.top,o=n.height,l=e.left,u=n.width,d=t+this.state.border,f=e.box.width/2+t*2,p=e.box.height/2+t*2;switch(n.posClass.join("-")){case"top-left":n.top=s-p-o,n.left=l+d-u,n.arrowTop=o,n.arrowLeft=u-d-t;break;case"top-center":n.top=s-p-o,n.left=l-u/2,n.arrowTop=o,n.arrowLeft=u/2-t;break;case"top-right":n.top=s-p-o,n.left=l-d,n.arrowTop=o,n.arrowLeft=t;break;case"bottom-left":n.top=s+p,n.left=l+d-u,n.arrowTop=-t*2,n.arrowLeft=u-d-t;break;case"bottom-center":n.top=s+p,n.left=l-u/2,n.arrowTop=-t*2,n.arrowLeft=u/2-t;break;case"bottom-right":n.top=s+p,n.left=l-d,n.arrowTop=-t*2,n.arrowLeft=t;break;case"left-top":n.top=s+d-o,n.left=l-f-u,n.arrowTop=o-d-t,n.arrowLeft=u;break;case"center-left":n.top=s-o/2,n.left=l-f-u,n.arrowTop=o/2-t,n.arrowLeft=u;break;case"left-bottom":n.top=s-d,n.left=l-f-u,n.arrowTop=t,n.arrowLeft=u;break;case"right-top":n.top=s+d-o,n.left=l+f,n.arrowTop=o-d-t,n.arrowLeft=-t*2;break;case"center-right":n.top=s-o/2,n.left=l+f,n.arrowTop=o/2-t,n.arrowLeft=-t*2;break;case"right-bottom":n.top=s-d,n.left=l+f,n.arrowTop=t,n.arrowLeft=-t*2;break}}__waitImages(){const n=this.content.querySelectorAll("img");if(n.length>0){const e=[];n.forEach(t=>{t.complete||e.push(new Promise(s=>{t.onload=s,t.onerror=s}))}),e.length&&Promise.all(e).then(()=>{if(this.state.state===1||this.state.state===3){const t=this.container.getBoundingClientRect();this.state.width=t.right-t.left,this.state.height=t.bottom-t.top,this.move(this.state.config)}})}}},HR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="15 15 70 70"><path fill="currentColor" d="M50,16.2c-18.6,0-33.8,15.1-33.8,33.8S31.4,83.7,50,83.7S83.8,68.6,83.8,50S68.6,16.2,50,16.2z M50,80.2c-16.7,0-30.2-13.6-30.2-30.2S33.3,19.7,50,19.7S80.3,33.3,80.3,50S66.7,80.2,50,80.2z"/><rect fill="currentColor" x="48" y="31.7" width="4" height="28"/><rect fill="currentColor" x="48" y="63.2" width="4" height="5"/><!--Created by Shastry from the Noun Project--></svg>
`,Xa=class{constructor(n){this.viewer=n,this.config=n.config,this.state=n.state}destroy(){}},Si=new Z,Ec=new zi(0,0,0,"ZXY"),VR=class extends Xa{constructor(n){super(n)}fovToZoomLevel(n){const e=Math.round((n-this.config.minFov)/(this.config.maxFov-this.config.minFov)*100);return Pt.clamp(e-2*(e-50),0,100)}zoomLevelToFov(n){return this.config.maxFov+n/100*(this.config.minFov-this.config.maxFov)}vFovToHFov(n){return Pt.radToDeg(2*Math.atan(Math.tan(Pt.degToRad(n)/2)*this.state.aspect))}hFovToVFov(n){return Pt.radToDeg(2*Math.atan(Math.tan(Pt.degToRad(n)/2)/this.state.aspect))}getAnimationProperties(n,e,t){const s=!hn(e),o=!hn(t),l={};let u=null;if(s){const d=this.viewer.getPosition(),f=$_(d.yaw,e.yaw);l.yaw={start:d.yaw,end:d.yaw+f},l.pitch={start:d.pitch,end:e.pitch},u=gf(n,q_(d,e))}if(o){const d=this.viewer.getZoomLevel(),f=Math.abs(t-d);l.zoom={start:d,end:t},u===null&&(u=gf(n,Math.PI/4*f/100))}return u===null?typeof n=="number"?u=n:u=pf:u=Math.max(pf,u),{duration:u,properties:l}}getTransitionOptions(n){let e;const t=this.config.defaultTransition??Ro.defaultTransition;return n.transition===!1||n.transition===null?e=null:n.transition===!0?e={...t}:typeof n.transition=="object"?e={...t,...n.transition}:e=this.config.defaultTransition,e}textureCoordsToSphericalCoords(n){var t;if(!((t=this.state.textureData)!=null&&t.panoData))throw new At("Current adapter does not support texture coordinates or no texture has been loaded");const e=this.viewer.adapter.textureCoordsToSphericalCoords(n,this.state.textureData.panoData);return!Ec.equals(this.viewer.renderer.panoramaPose)||!Ec.equals(this.viewer.renderer.sphereCorrection)?(this.sphericalCoordsToVector3(e,Si),Si.applyEuler(this.viewer.renderer.panoramaPose),Si.applyEuler(this.viewer.renderer.sphereCorrection),this.vector3ToSphericalCoords(Si)):e}sphericalCoordsToTextureCoords(n){var e;if(!((e=this.state.textureData)!=null&&e.panoData))throw new At("Current adapter does not support texture coordinates or no texture has been loaded");return(!Ec.equals(this.viewer.renderer.panoramaPose)||!Ec.equals(this.viewer.renderer.sphereCorrection))&&(this.sphericalCoordsToVector3(n,Si),yf(Si,this.viewer.renderer.sphereCorrection),yf(Si,this.viewer.renderer.panoramaPose),n=this.vector3ToSphericalCoords(Si)),this.viewer.adapter.sphericalCoordsToTextureCoords(n,this.state.textureData.panoData)}sphericalCoordsToVector3(n,e,t=As){return e||(e=new Z),e.x=t*-Math.cos(n.pitch)*Math.sin(n.yaw),e.y=t*Math.sin(n.pitch),e.z=t*Math.cos(n.pitch)*Math.cos(n.yaw),e}vector3ToSphericalCoords(n){const e=Math.acos(n.y/Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z)),t=Math.atan2(n.x,n.z);return{yaw:t<0?-t:Math.PI*2-t,pitch:Math.PI/2-e}}viewerCoordsToVector3(n){const e=this.viewer.renderer.getIntersections(n).filter(t=>t.object.userData[Yr]);return e.length?e[0].point:null}viewerCoordsToSphericalCoords(n){const e=this.viewerCoordsToVector3(n);return e?this.vector3ToSphericalCoords(e):null}vector3ToViewerCoords(n){const e=n.clone();return e.project(this.viewer.renderer.camera),{x:Math.round((e.x+1)/2*this.state.size.width),y:Math.round((1-e.y)/2*this.state.size.height)}}sphericalCoordsToViewerCoords(n){return this.sphericalCoordsToVector3(n,Si),this.vector3ToViewerCoords(Si)}isPointVisible(n){let e,t;if(n instanceof Z)e=n,t=this.vector3ToViewerCoords(n);else if(Xf(n))e=this.sphericalCoordsToVector3(n,Si),t=this.vector3ToViewerCoords(e);else return!1;return e.dot(this.viewer.state.direction)>0&&t.x>=0&&t.x<=this.viewer.state.size.width&&t.y>=0&&t.y<=this.viewer.state.size.height}cleanPosition(n){if("yaw"in n||"pitch"in n){if(!("yaw"in n)||!("pitch"in n))throw new At("Position is missing 'yaw' or 'pitch'");return{yaw:Ui(n.yaw),pitch:Ui(n.pitch,!0)}}else return this.textureCoordsToSphericalCoords(n)}cleanSphereCorrection(n){return{pan:Ui((n==null?void 0:n.pan)||0),tilt:Ui((n==null?void 0:n.tilt)||0,!0),roll:Ui((n==null?void 0:n.roll)||0,!0,!1)}}cleanPanoramaPose(n){return{pan:Pt.degToRad((n==null?void 0:n.poseHeading)||0),tilt:Pt.degToRad((n==null?void 0:n.posePitch)||0),roll:Pt.degToRad((n==null?void 0:n.poseRoll)||0)}}cleanPanoramaOptions(n,e){return e!=null&&e.isEquirectangular&&(hn(n.zoom)&&!hn(e.initialFov)&&(n={...n,zoom:this.fovToZoomLevel(this.hFovToVFov(e.initialFov))}),hn(n.position)&&!hn(e.initialHeading)&&!hn(e.initialPitch)&&(n={...n,position:{yaw:Ui(e.initialHeading),pitch:Ui(e.initialPitch,!0)}})),n}},GR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M33.38 33.2a1.96 1.96 0 0 0 1.5-3.23 10.61 10.61 0 0 1 7.18-17.51c.7-.06 1.31-.49 1.61-1.12a13.02 13.02 0 0 1 11.74-7.43c7.14 0 12.96 5.8 12.96 12.9 0 3.07-1.1 6.05-3.1 8.38-.7.82-.61 2.05.21 2.76.83.7 2.07.6 2.78-.22a16.77 16.77 0 0 0 4.04-10.91C72.3 7.54 64.72 0 55.4 0a16.98 16.98 0 0 0-14.79 8.7 14.6 14.6 0 0 0-12.23 14.36c0 3.46 1.25 6.82 3.5 9.45.4.45.94.69 1.5.69m45.74 43.55a22.13 22.13 0 0 1-5.23 12.4c-4 4.55-9.53 6.86-16.42 6.86-12.6 0-20.1-10.8-20.17-10.91a1.82 1.82 0 0 0-.08-.1c-5.3-6.83-14.55-23.82-17.27-28.87-.05-.1 0-.21.02-.23a6.3 6.3 0 0 1 8.24 1.85l9.38 12.59a1.97 1.97 0 0 0 3.54-1.17V25.34a4 4 0 0 1 1.19-2.87 3.32 3.32 0 0 1 2.4-.95c1.88.05 3.4 1.82 3.4 3.94v24.32a1.96 1.96 0 0 0 3.93 0v-33.1a3.5 3.5 0 0 1 7 0v35.39a1.96 1.96 0 0 0 3.93 0v-.44c.05-2.05 1.6-3.7 3.49-3.7 1.93 0 3.5 1.7 3.5 3.82v5.63c0 .24.04.48.13.71l.1.26a1.97 1.97 0 0 0 3.76-.37c.33-1.78 1.77-3.07 3.43-3.07 1.9 0 3.45 1.67 3.5 3.74l-1.77 18.1zM77.39 51c-1.25 0-2.45.32-3.5.9v-.15c0-4.27-3.33-7.74-7.42-7.74-1.26 0-2.45.33-3.5.9V16.69a7.42 7.42 0 0 0-14.85 0v1.86a7 7 0 0 0-3.28-.94 7.21 7.21 0 0 0-5.26 2.07 7.92 7.92 0 0 0-2.38 5.67v37.9l-5.83-7.82a10.2 10.2 0 0 0-13.35-2.92 4.1 4.1 0 0 0-1.53 5.48C20 64.52 28.74 80.45 34.07 87.34c.72 1.04 9.02 12.59 23.4 12.59 7.96 0 14.66-2.84 19.38-8.2a26.06 26.06 0 0 0 6.18-14.6l1.78-18.2v-.2c0-4.26-3.32-7.73-7.42-7.73z"/><!--Created by AomAm from the Noun Project--></svg>
`,WR=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 17 79 79"><path fill="currentColor" d="M38.1 29.27c-.24 0-.44.2-.44.45v10.7a.45.45 0 00.9 0v-10.7c0-.25-.2-.45-.45-.45zm10.2 26.66a11.54 11.54 0 01-8.48-6.14.45.45 0 10-.8.41 12.45 12.45 0 009.22 6.62.45.45 0 00.07-.9zm24.55-13.08a23.04 23.04 0 00-22.56-23v7.07l-.01.05a2.83 2.83 0 012.39 2.78v14.03l.09-.02h8.84v-9.22a.45.45 0 11.9 0v9.22h10.35v-.9zm0 27.33V44.66H62.5c-.02 2.01-.52 4-1.47 5.76a.45.45 0 01-.61.18.45.45 0 01-.19-.61 11.54 11.54 0 001.36-5.33h-8.83l-.1-.01a2.83 2.83 0 01-2.83 2.84h-.04-.04a2.83 2.83 0 01-2.83-2.83v-14.9a2.82 2.82 0 012.47-2.8v-7.11a23.04 23.04 0 00-22.57 23v.91h14.72V29.88a8.2 8.2 0 015.02-7.57c.22-.1.5.01.59.24.1.23-.01.5-.24.6a7.3 7.3 0 00-4.47 6.73v13.88h3.9a.45.45 0 110 .9h-3.9v.15a7.32 7.32 0 0011.23 6.17.45.45 0 01.49.76 8.22 8.22 0 01-12.62-6.93v-.15H26.82v25.52a23.04 23.04 0 0023.01 23.01 23.04 23.04 0 0023.02-23.01zm1.8-27.33v27.33A24.85 24.85 0 0149.84 95a24.85 24.85 0 01-24.82-24.82V42.85a24.85 24.85 0 0124.82-24.82 24.85 24.85 0 0124.83 24.82zM57.98 29.88v9.36a.45.45 0 11-.9 0v-9.36a7.28 7.28 0 00-3.4-6.17.45.45 0 01.49-.76 8.18 8.18 0 013.8 6.93z"/><!-- Created by Icon Island from the Noun Project --></svg>
`,su=class ex{constructor(){this.$=ex.IDLE}is(...e){return e.some(t=>this.$&t)}set(e){this.$=e}add(e){this.$|=e}remove(e){this.$&=~e}};su.IDLE=0;su.CLICK=1;su.MOVING=2;var en=su,XR=class extends Xa{constructor(n){super(n),this.data={startMouseX:0,startMouseY:0,mouseX:0,mouseY:0,pinchDist:0,moveDelta:{yaw:0,pitch:0,zoom:0},accumulatorFactor:0,ctrlKeyDown:!1,dblclickData:null,dblclickTimeout:null,longtouchTimeout:null,twofingersTimeout:null,ctrlZoomTimeout:null},this.step=new en,this.keyHandler=new nu,this.resizeObserver=new ResizeObserver(i0(()=>this.viewer.autoSize(),50)),this.moveThreshold=B_*Un.pixelRatio}init(){window.addEventListener("keydown",this,{passive:!1}),window.addEventListener("keyup",this),this.viewer.container.addEventListener("mousedown",this),window.addEventListener("mousemove",this,{passive:!1}),window.addEventListener("mouseup",this),this.viewer.container.addEventListener("touchstart",this,{passive:!1}),window.addEventListener("touchmove",this,{passive:!1}),window.addEventListener("touchend",this,{passive:!1}),this.viewer.container.addEventListener("wheel",this,{passive:!1}),document.addEventListener("fullscreenchange",this),this.resizeObserver.observe(this.viewer.container),this.viewer.addEventListener(Ma.type,this),this.viewer.addEventListener(La.type,this)}destroy(){window.removeEventListener("keydown",this),window.removeEventListener("keyup",this),this.viewer.container.removeEventListener("mousedown",this),window.removeEventListener("mousemove",this),window.removeEventListener("mouseup",this),this.viewer.container.removeEventListener("touchstart",this),window.removeEventListener("touchmove",this),window.removeEventListener("touchend",this),this.viewer.container.removeEventListener("wheel",this),document.removeEventListener("fullscreenchange",this),this.resizeObserver.disconnect(),this.viewer.removeEventListener(Ma.type,this),this.viewer.removeEventListener(La.type,this),clearTimeout(this.data.dblclickTimeout),clearTimeout(this.data.longtouchTimeout),clearTimeout(this.data.twofingersTimeout),clearTimeout(this.data.ctrlZoomTimeout),super.destroy()}handleEvent(n){switch(n.type){case"keydown":this.__onKeyDown(n);break;case"keyup":this.__onKeyUp();break;case"mousemove":this.__onMouseMove(n);break;case"mouseup":this.__onMouseUp(n);break;case"touchmove":this.__onTouchMove(n);break;case"touchend":this.__onTouchEnd(n);break;case"fullscreenchange":this.__onFullscreenChange();break;case Ma.type:this.__applyMoveDelta();break;case La.type:this.__clearMoveDelta();break}if(!Q_(n,"."+Ga))switch(n.type){case"mousedown":this.__onMouseDown(n);break;case"touchstart":this.__onTouchStart(n);break;case"wheel":this.__onMouseWheel(n);break}}__onKeyDown(n){if(this.config.mousewheelCtrlKey&&(this.data.ctrlKeyDown=n.key===dn.Control,this.data.ctrlKeyDown&&(clearTimeout(this.data.ctrlZoomTimeout),this.viewer.overlay.hide(mn.CTRL_ZOOM))),!!this.viewer.dispatchEvent(new Hr(n.key,n))&&!(!this.state.keyboardEnabled||!this.config.keyboardActions||this.keyHandler.pending)){for(const[e,t]of Object.entries(this.config.keyboardActions))if(Vf(n,e)){if(typeof t=="function")t(this.viewer,n);else{switch(t!=="ZOOM_IN"&&t!=="ZOOM_OUT"&&this.viewer.stopAll(),t){case"ROTATE_UP":this.viewer.dynamics.position.roll({pitch:!1});break;case"ROTATE_DOWN":this.viewer.dynamics.position.roll({pitch:!0});break;case"ROTATE_RIGHT":this.viewer.dynamics.position.roll({yaw:!1});break;case"ROTATE_LEFT":this.viewer.dynamics.position.roll({yaw:!0});break;case"ZOOM_IN":this.viewer.dynamics.zoom.roll(!1);break;case"ZOOM_OUT":this.viewer.dynamics.zoom.roll(!0);break}this.keyHandler.down(t)}n.preventDefault();return}}}__onKeyUp(){this.data.ctrlKeyDown=!1,this.state.keyboardEnabled&&this.keyHandler.up(n=>{n==="ZOOM_IN"||n==="ZOOM_OUT"?this.viewer.dynamics.zoom.stop():(this.viewer.dynamics.position.stop(),this.viewer.resetIdleTimer())})}__onMouseDown(n){this.step.add(en.CLICK),this.data.startMouseX=n.clientX,this.data.startMouseY=n.clientY,this.config.mousemove&&n.preventDefault()}__onMouseUp(n){this.step.is(en.CLICK,en.MOVING)&&this.__stopMove(n.clientX,n.clientY,n,n.button===2)}__onMouseMove(n){this.config.mousemove&&this.step.is(en.CLICK,en.MOVING)&&(n.preventDefault(),this.__doMove(n.clientX,n.clientY)),this.__handleObjectsEvents(n)}__onTouchStart(n){n.touches.length===1?(this.step.add(en.CLICK),this.data.startMouseX=n.touches[0].clientX,this.data.startMouseY=n.touches[0].clientY,this.data.longtouchTimeout||(this.data.longtouchTimeout=setTimeout(()=>{const e=n.touches[0];this.__stopMove(e.clientX,e.clientY,n,!0),this.data.longtouchTimeout=null},V_))):n.touches.length===2&&(this.step.set(en.IDLE),this.__cancelLongTouch(),this.config.mousemove&&(this.__cancelTwoFingersOverlay(),this.__startMoveZoom(n),n.preventDefault()))}__onTouchEnd(n){if(this.__cancelLongTouch(),this.step.is(en.CLICK,en.MOVING)){if(n.preventDefault(),this.__cancelTwoFingersOverlay(),n.touches.length===1)this.__stopMove(this.data.mouseX,this.data.mouseY);else if(n.touches.length===0){const e=n.changedTouches[0];this.__stopMove(e.clientX,e.clientY,n)}}}__onTouchMove(n){if(this.__cancelLongTouch(),!!this.config.mousemove)if(n.touches.length===1){if(this.config.touchmoveTwoFingers)this.step.is(en.CLICK)&&!this.data.twofingersTimeout&&(this.data.twofingersTimeout=setTimeout(()=>{this.viewer.overlay.show({id:mn.TWO_FINGERS,image:GR,title:this.config.lang.twoFingers})},G_));else if(this.step.is(en.CLICK,en.MOVING)){n.preventDefault();const e=n.touches[0];this.__doMove(e.clientX,e.clientY)}}else this.__doMoveZoom(n),this.__cancelTwoFingersOverlay()}__cancelLongTouch(){this.data.longtouchTimeout&&(clearTimeout(this.data.longtouchTimeout),this.data.longtouchTimeout=null)}__cancelTwoFingersOverlay(){this.config.touchmoveTwoFingers&&(this.data.twofingersTimeout&&(clearTimeout(this.data.twofingersTimeout),this.data.twofingersTimeout=null),this.viewer.overlay.hide(mn.TWO_FINGERS))}__onMouseWheel(n){if(!this.config.mousewheel||!n.deltaY)return;if(this.config.mousewheelCtrlKey&&!this.data.ctrlKeyDown){this.viewer.overlay.show({id:mn.CTRL_ZOOM,image:WR,title:this.config.lang.ctrlZoom}),clearTimeout(this.data.ctrlZoomTimeout),this.data.ctrlZoomTimeout=setTimeout(()=>this.viewer.overlay.hide(mn.CTRL_ZOOM),W_);return}n.preventDefault(),n.stopPropagation();const e=n.deltaY/Math.abs(n.deltaY)*5*this.config.zoomSpeed;e!==0&&this.viewer.dynamics.zoom.step(-e,5)}__onFullscreenChange(){const n=this.viewer.isFullscreenEnabled();this.config.keyboard==="fullscreen"&&(n?this.viewer.startKeyboardControl():this.viewer.stopKeyboardControl()),this.viewer.dispatchEvent(new wa(n))}__resetMove(){this.step.set(en.IDLE),this.data.mouseX=0,this.data.mouseY=0,this.data.startMouseX=0,this.data.startMouseY=0}__startMoveZoom(n){this.viewer.stopAll(),this.__resetMove();const e=mf(n);this.step.set(en.MOVING),this.data.accumulatorFactor=this.config.moveInertia,{distance:this.data.pinchDist,center:{x:this.data.mouseX,y:this.data.mouseY}}=e}__stopMove(n,e,t,s=!1){this.step.is(en.CLICK)&&!this.__moveThresholdReached(n,e)&&this.__doClick(n,e,t,s),this.config.moveInertia&&(this.data.accumulatorFactor=Math.pow(this.config.moveInertia,.5)),this.__resetMove(),this.viewer.resetIdleTimer()}__doClick(n,e,t,s=!1){const o=this.viewer.container.getBoundingClientRect(),l=n-o.left,u=e-o.top,d=this.viewer.renderer.getIntersections({x:l,y:u}),f=d.find(p=>p.object.userData[Yr]);if(f){const p=this.viewer.dataHelper.vector3ToSphericalCoords(f.point),v={rightclick:s,originalEvent:t,target:Hc(t),clientX:n,clientY:e,viewerX:l,viewerY:u,yaw:p.yaw,pitch:p.pitch,objects:d.map(g=>g.object).filter(g=>!g.userData[Yr])};try{const g=this.viewer.dataHelper.sphericalCoordsToTextureCoords(v);Object.assign(v,g)}catch{}this.data.dblclickTimeout?(Math.abs(this.data.dblclickData.clientX-v.clientX)<this.moveThreshold&&Math.abs(this.data.dblclickData.clientY-v.clientY)<this.moveThreshold&&this.viewer.dispatchEvent(new I0(this.data.dblclickData)),clearTimeout(this.data.dblclickTimeout),this.data.dblclickTimeout=null,this.data.dblclickData=null):(this.viewer.dispatchEvent(new C0(v)),this.data.dblclickData=Jc(v),this.data.dblclickTimeout=setTimeout(()=>{this.data.dblclickTimeout=null,this.data.dblclickData=null},H_))}}__handleObjectsEvents(n){if(!s0(this.state.objectsObservers)&&n.composedPath().includes(this.viewer.container)){const e=J_(this.viewer.container),t={x:n.clientX-e.x,y:n.clientY-e.y},s=this.viewer.renderer.getIntersections(t),o=(l,u,d)=>{this.viewer.dispatchEvent(new d(n,l,t,u))};for(const[l,u]of Object.entries(this.state.objectsObservers)){const d=s.find(f=>f.object.userData[l]);d?(u&&d.object!==u&&(o(u,l,xf),this.state.objectsObservers[l]=null),u?o(d.object,l,zy):(this.state.objectsObservers[l]=d.object,o(d.object,l,Dy))):u&&(o(u,l,xf),this.state.objectsObservers[l]=null)}}}__doMove(n,e){if(this.step.is(en.CLICK)&&this.__moveThresholdReached(n,e))this.viewer.stopAll(),this.__resetMove(),this.step.set(en.MOVING),this.data.mouseX=n,this.data.mouseY=e,this.data.accumulatorFactor=this.config.moveInertia;else if(this.step.is(en.MOVING)){const t=(n-this.data.mouseX)*Math.cos(this.state.roll)-(e-this.data.mouseY)*Math.sin(this.state.roll),s=(e-this.data.mouseY)*Math.cos(this.state.roll)+(n-this.data.mouseX)*Math.sin(this.state.roll),o={yaw:this.config.moveSpeed*(t/this.state.size.width)*Pt.degToRad(this.state.hFov),pitch:this.config.moveSpeed*(s/this.state.size.height)*Pt.degToRad(this.state.vFov)};this.data.moveDelta.yaw+=o.yaw,this.data.moveDelta.pitch+=o.pitch,this.data.mouseX=n,this.data.mouseY=e}}__moveThresholdReached(n,e){return Math.abs(n-this.data.startMouseX)>=this.moveThreshold||Math.abs(e-this.data.startMouseY)>=this.moveThreshold}__doMoveZoom(n){if(this.step.is(en.MOVING)){n.preventDefault();const e=mf(n);this.__doMove(e.center.x,e.center.y),this.data.moveDelta.zoom+=this.config.zoomSpeed*((e.distance-this.data.pinchDist)/Un.pixelRatio),this.data.pinchDist=e.distance}}__applyMoveDelta(){if(Math.abs(this.data.moveDelta.yaw)>0||Math.abs(this.data.moveDelta.pitch)>0){const e=this.viewer.getPosition();this.viewer.rotate({yaw:e.yaw-this.data.moveDelta.yaw*(1-this.config.moveInertia),pitch:e.pitch+this.data.moveDelta.pitch*(1-this.config.moveInertia)}),this.data.moveDelta.yaw*=this.data.accumulatorFactor,this.data.moveDelta.pitch*=this.data.accumulatorFactor,Math.abs(this.data.moveDelta.yaw)<=.001&&(this.data.moveDelta.yaw=0),Math.abs(this.data.moveDelta.pitch)<=.001&&(this.data.moveDelta.pitch=0)}if(Math.abs(this.data.moveDelta.zoom)>0){const e=this.viewer.getZoomLevel();this.viewer.zoom(e+this.data.moveDelta.zoom*(1-this.config.moveInertia)),this.data.moveDelta.zoom*=this.config.moveInertia,Math.abs(this.data.moveDelta.zoom)<=.001&&(this.data.moveDelta.zoom=0)}}__clearMoveDelta(){this.data.moveDelta.yaw=0,this.data.moveDelta.pitch=0,this.data.moveDelta.zoom=0}};Mt.enabled=!1;var Sc=new Lt,Yg=new Zt,$g=new Io,jR=class extends Xa{constructor(n){super(n),this.frustumNeedsUpdate=!0,this.renderer=new tR(this.config.rendererParameters),this.renderer.setPixelRatio(Un.pixelRatio),this.renderer.outputColorSpace=Ts,this.renderer.toneMapping=f_,this.renderer.domElement.className="psv-canvas",this.renderer.domElement.style.background=this.config.canvasBackground,this.scene=new fg,this.camera=new ui(50,16/9,.1,2*As),this.camera.matrixAutoUpdate=!1;const e=new di(new Va(As).scale(-1,1,1),new Ba({opacity:0,transparent:!0,depthTest:!1,depthWrite:!1}));e.userData={[Yr]:!0},this.scene.add(e),this.raycaster=new _w,this.frustum=new Ff,this.container=document.createElement("div"),this.container.className="psv-canvas-container",this.container.appendChild(this.renderer.domElement),this.viewer.container.appendChild(this.container),this.container.addEventListener("contextmenu",t=>t.preventDefault()),this.viewer.addEventListener(Pa.type,this),this.viewer.addEventListener(or.type,this),this.viewer.addEventListener(Aa.type,this),this.viewer.addEventListener(Ca.type,this),this.viewer.addEventListener(Gn.type,this),this.hide()}get panoramaPose(){return this.mesh.rotation}get sphereCorrection(){return this.meshContainer.rotation}init(){this.show(),this.renderer.setAnimationLoop(n=>this.__renderLoop(n))}destroy(){this.renderer.setAnimationLoop(null),this.cleanScene(this.scene),this.renderer.dispose(),this.viewer.container.removeChild(this.container),this.viewer.removeEventListener(Pa.type,this),this.viewer.removeEventListener(or.type,this),this.viewer.removeEventListener(Aa.type,this),this.viewer.removeEventListener(Ca.type,this),this.viewer.removeEventListener(Gn.type,this),super.destroy()}handleEvent(n){switch(n.type){case Pa.type:this.__onSizeUpdated();break;case or.type:this.__onZoomUpdated();break;case Aa.type:this.__onPositionUpdated();break;case Ca.type:this.__onPositionUpdated();break;case Gn.type:n.containsOptions("fisheye")&&this.__onPositionUpdated(),n.containsOptions("canvasBackground")&&(this.renderer.domElement.style.background=this.config.canvasBackground);break}}hide(){this.container.style.opacity="0"}show(){this.container.style.opacity="1"}setCustomRenderer(n){n?this.customRenderer=n(this.renderer):this.customRenderer=null,this.viewer.needsUpdate()}__onSizeUpdated(){this.renderer.setSize(this.state.size.width,this.state.size.height),this.camera.aspect=this.state.aspect,this.camera.updateProjectionMatrix(),this.viewer.needsUpdate(),this.frustumNeedsUpdate=!0}__onZoomUpdated(){this.camera.fov=this.state.vFov,this.camera.updateProjectionMatrix(),this.viewer.needsUpdate(),this.frustumNeedsUpdate=!0}__onPositionUpdated(){this.camera.position.set(0,0,0),this.camera.lookAt(this.state.direction),this.config.fisheye&&this.camera.position.copy(this.state.direction).multiplyScalar(this.config.fisheye/2).negate(),this.camera.rotateZ(-this.state.roll),this.camera.updateMatrix(),this.camera.updateMatrixWorld(),this.viewer.needsUpdate(),this.frustumNeedsUpdate=!0}__renderLoop(n){const e=this.timestamp?n-this.timestamp:0;this.timestamp=n,this.viewer.dispatchEvent(new Ma(n,e)),this.viewer.dynamics.update(e),(this.state.needsUpdate||this.state.continuousUpdateCount>0)&&(this.state.needsUpdate=!1,(this.customRenderer||this.renderer).render(this.scene,this.camera),this.viewer.dispatchEvent(new my))}setTexture(n){this.meshContainer||(this.meshContainer=new go,this.scene.add(this.meshContainer)),this.state.textureData&&this.viewer.adapter.disposeTexture(this.state.textureData),this.mesh&&(this.meshContainer.remove(this.mesh),this.viewer.adapter.disposeMesh(this.mesh)),this.mesh=this.viewer.adapter.createMesh(n.panoData),this.viewer.adapter.setTexture(this.mesh,n,!1),this.meshContainer.add(this.mesh),this.state.textureData=n,this.viewer.needsUpdate()}setPanoramaPose(n,e=this.mesh){const t=this.viewer.dataHelper.cleanPanoramaPose(n);e.rotation.set(-t.tilt,t.pan,t.roll,"YXZ")}setSphereCorrection(n,e=this.meshContainer){const t=this.viewer.dataHelper.cleanSphereCorrection(n);e.rotation.set(t.tilt,t.pan,t.roll,"YXZ")}transition(n,e,t){const s=t.effect==="fade"||t.rotation,o=!hn(e.position),l=!hn(e.zoom),u=new $f(o?this.viewer.dataHelper.cleanPosition(e.position):void 0,e.zoom);this.viewer.dispatchEvent(u);const d=new go,f=this.viewer.adapter.createMesh(n.panoData);if(this.viewer.adapter.setTexture(f,n,!0),this.viewer.adapter.setTextureOpacity(f,0),this.setPanoramaPose(n.panoData,f),this.setSphereCorrection(e.sphereCorrection,d),o&&!t.rotation){const y=this.viewer.getPosition(),x=new Z(0,1,0);d.rotateOnWorldAxis(x,u.position.yaw-y.yaw);const w=new Z(0,1,0).cross(this.camera.getWorldDirection(new Z)).normalize();d.rotateOnWorldAxis(w,u.position.pitch-y.pitch)}d.add(f),this.scene.add(d),this.renderer.setRenderTarget(new Xr),this.renderer.render(this.scene,this.camera),this.renderer.setRenderTarget(null);const{duration:p,properties:v}=this.viewer.dataHelper.getAnimationProperties(t.speed,t.rotation?u.position:null,s?u.zoomLevel:null),g=new Xc({properties:{...v,opacity:{start:0,end:1}},duration:p,easing:"inOutCubic",onTick:y=>{switch(t.effect){case"fade":this.viewer.adapter.setTextureOpacity(f,y.opacity);break;case"black":case"white":y.opacity<.5?this.renderer.toneMappingExposure=t.effect==="black"?Pt.mapLinear(y.opacity,0,.5,1,0):Pt.mapLinear(y.opacity,0,.5,1,5):(this.renderer.toneMappingExposure=t.effect==="black"?Pt.mapLinear(y.opacity,.5,1,0,1):Pt.mapLinear(y.opacity,.5,1,5,1),this.mesh.visible=!1,this.viewer.adapter.setTextureOpacity(f,1),l&&!s&&this.viewer.dynamics.zoom.setValue(u.zoomLevel));break}o&&t.rotation&&this.viewer.dynamics.position.setValue({yaw:y.yaw,pitch:y.pitch}),l&&s&&this.viewer.dynamics.zoom.setValue(y.zoom),this.viewer.needsUpdate()}});return g.then(y=>{d.remove(f),this.scene.remove(d),y?(this.viewer.adapter.disposeTexture(this.state.textureData),this.meshContainer.remove(this.mesh),this.viewer.adapter.disposeMesh(this.mesh),this.mesh=f,this.meshContainer.add(f),this.state.textureData=n,this.setPanoramaPose(n.panoData),this.setSphereCorrection(e.sphereCorrection),o&&!t.rotation&&this.viewer.rotate(e.position)):(this.viewer.adapter.disposeTexture(n),this.viewer.adapter.disposeMesh(f))}),g}getIntersections(n){var t;Sc.x=2*n.x/this.state.size.width-1,Sc.y=-2*n.y/this.state.size.height+1,this.raycaster.setFromCamera(Sc,this.camera);const e=this.raycaster.intersectObjects(this.scene.children,!0).filter(s=>s.object.visible).filter(s=>s.object.isMesh&&!!s.object.userData);return(t=this.customRenderer)!=null&&t.getIntersections&&e.push(...this.customRenderer.getIntersections(this.raycaster,Sc)),e}isObjectVisible(n){if(!n)return!1;if(this.frustumNeedsUpdate&&(Yg.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse),this.frustum.setFromProjectionMatrix(Yg),this.frustumNeedsUpdate=!1),n.isVector3)return this.frustum.containsPoint(n);if(n.isMesh&&n.geometry){const e=n;return e.geometry.boundingBox||e.geometry.computeBoundingBox(),$g.copy(e.geometry.boundingBox).applyMatrix4(e.matrixWorld),this.frustum.intersectsBox($g)}else return n.isObject3D?this.frustum.intersectsObject(n):!1}addObject(n){this.scene.add(n)}removeObject(n){this.scene.remove(n)}cleanScene(n){const e=t=>{var s;(s=t.map)==null||s.dispose(),t.uniforms&&Object.values(t.uniforms).forEach(o=>{var l,u;(u=(l=o.value)==null?void 0:l.dispose)==null||u.call(l)}),t.dispose()};n.traverse(t=>{var s,o;(s=t.geometry)==null||s.dispose(),t.material&&(Array.isArray(t.material)?t.material.forEach(l=>{e(l)}):e(t.material)),t instanceof fg||(o=t.dispose)==null||o.call(t),t!==n&&this.cleanScene(t)})}},YR=class extends mw{constructor(){super(...arguments),this._abortController=new AbortController}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}load(n,e,t,s){const o=this._abortController.signal,l=super.load(n,f=>{d(),e(f)},t,f=>{if(d(),o.aborted){const p=new Error;p.name="AbortError",p.message="The operation was aborted.",s(p)}else s(f)});function u(){l.src=""}function d(){o.removeEventListener("abort",u,!1)}return o.addEventListener("abort",u,!1),l}},$R=class extends Xa{constructor(n){super(n),this.fileLoader=new pw,this.fileLoader.setResponseType("blob"),this.imageLoader=new YR}destroy(){this.abortLoading(),super.destroy()}abortLoading(){var n,e;(e=(n=this.fileLoader).abort)==null||e.call(n),this.imageLoader.abort()}loadFile(n,e,t){const s=vo.get(n,t);if(s){if(s instanceof Blob)return e==null||e(100),Promise.resolve(s);vo.remove(n,t)}this.config.requestHeaders&&this.fileLoader.setRequestHeader(this.config.requestHeaders(n)),this.fileLoader.setWithCredentials(this.config.withCredentials(n));let o=0;return e==null||e(o),this.fileLoader.loadAsync(n,l=>{if(l.lengthComputable){const u=l.loaded/l.total*100;u>o&&(o=u,e==null||e(o))}}).then(l=>(o=100,e==null||e(o),vo.add(n,t,l),l))}loadImage(n,e,t){const s=vo.get(n,t);return s?(e==null||e(100),s instanceof Blob?this.blobToImage(s):Promise.resolve(s)):!e&&!this.config.requestHeaders?(this.imageLoader.setWithCredentials(this.config.withCredentials(n)),this.imageLoader.loadAsync(n).then(o=>(vo.add(n,t,o),o))):this.loadFile(n,e,t).then(o=>this.blobToImage(o))}blobToImage(n){return new Promise((e,t)=>{const s=document.createElement("img");s.onload=()=>{URL.revokeObjectURL(s.src),e(s)},s.onerror=t,s.src=URL.createObjectURL(n)})}preloadPanorama(n){return this.viewer.adapter.supportsPreload(n)?this.viewer.adapter.loadTexture(n,!1):Promise.reject(new At("Current adapter does not support preload"))}dispatchProgress(n){this.viewer.loader.setProgress(n),this.viewer.dispatchEvent(new q0(Math.round(n)))}},qR=class extends Xa{constructor(n){super(n),this.zoom=new ya(e=>{this.viewer.state.vFov=this.viewer.dataHelper.zoomLevelToFov(e),this.viewer.state.hFov=this.viewer.dataHelper.vFovToHFov(this.viewer.state.vFov),this.viewer.dispatchEvent(new or(e))},{defaultValue:this.viewer.config.defaultZoomLvl,min:0,max:100,wrap:!1}),this.position=new p0(e=>{this.viewer.dataHelper.sphericalCoordsToVector3(e,this.viewer.state.direction),this.viewer.dispatchEvent(new Aa(e))},{yaw:new ya(null,{defaultValue:this.config.defaultYaw,min:0,max:2*Math.PI,wrap:!0}),pitch:new ya(null,{defaultValue:this.config.defaultPitch,min:-Math.PI/2,max:Math.PI/2,wrap:!1})}),this.roll=new ya(e=>{this.viewer.state.roll=e,this.viewer.dispatchEvent(new Ca(e))},{defaultValue:0,min:-Math.PI,max:Math.PI,wrap:!1}),this.updateSpeeds()}updateSpeeds(){this.zoom.setSpeed(this.config.zoomSpeed*50),this.position.setSpeed(Pt.degToRad(this.config.moveSpeed*50)),this.roll.setSpeed(Pt.degToRad(this.config.moveSpeed*50))}update(n){this.zoom.update(n),this.position.update(n),this.roll.update(n)}},KR=class{constructor(){this.ready=!1,this.needsUpdate=!1,this.continuousUpdateCount=0,this.keyboardEnabled=!1,this.direction=new Z(0,0,As),this.roll=0,this.vFov=60,this.hFov=60,this.aspect=1,this.animation=null,this.transitionAnimation=null,this.loadingPromise=null,this.idleTime=-1,this.objectsObservers={},this.size={width:0,height:0}}},ZR=class extends g0{constructor(n){var e,t,s;if(super(),this.plugins={},this.children=[],this.parent=K_(n.container),!this.parent)throw new At('"container" element not found.');this.parent[Yr]=this,this.container=document.createElement("div"),this.container.classList.add("psv-container"),this.parent.appendChild(this.container),h0(this.parent),d0(this.container,"core"),this.state=new KR,this.config=IR(n),this.__setSize(this.config.size),this.overlay=new FR(this);try{Un.load()}catch(o){console.error(o),this.showError(this.config.lang.webglError);return}vo.init(),this.adapter=new this.config.adapter[0](this,this.config.adapter[1]),this.renderer=new jR(this),this.textureLoader=new $R(this),this.eventsHandler=new XR(this),this.dataHelper=new VR(this),this.dynamics=new qR(this),(t=(e=this.adapter).init)==null||t.call(e),this.loader=new NR(this),this.navbar=new DR(this),this.panel=new zR(this),this.notification=new OR(this),this.autoSize(),this.setCursor(null),Wf(Un.isTouchEnabled,o=>{Qc(this.container,"psv--is-touch",o)}),this.config.plugins.forEach(([o,l])=>{this.plugins[o.id]=new o(this,l)});for(const o of Object.values(this.plugins))(s=o.init)==null||s.call(o);this.config.navbar&&this.navbar.setButtons(this.config.navbar),this.state.loadingPromise||(this.config.panorama?this.setPanorama(this.config.panorama,{sphereCorrection:this.config.sphereCorrection,panoData:this.config.panoData}):this.loader.show())}destroy(){var n,e,t,s,o,l;this.stopAll(),this.stopKeyboardControl(),this.exitFullscreen();for(const[u,d]of Object.entries(this.plugins))d.destroy(),delete this.plugins[u];this.children.slice().forEach(u=>u.destroy()),this.children.length=0,(n=this.eventsHandler)==null||n.destroy(),(e=this.renderer)==null||e.destroy(),(t=this.textureLoader)==null||t.destroy(),(s=this.dataHelper)==null||s.destroy(),(o=this.adapter)==null||o.destroy(),(l=this.dynamics)==null||l.destroy(),this.parent.removeChild(this.container),delete this.parent[Yr]}init(){this.eventsHandler.init(),this.renderer.init(),this.config.navbar&&this.navbar.show(),this.config.keyboard==="always"&&this.startKeyboardControl(),this.resetIdleTimer(),this.state.ready=!0,this.dispatchEvent(new Ra)}resetIdleTimer(){this.state.idleTime=performance.now()}disableIdleTimer(){this.state.idleTime=-1}getPlugin(n){if(typeof n=="string")return this.plugins[n];{const e=Ef(n);return e?this.plugins[e.id]:null}}getPosition(){return this.dataHelper.cleanPosition(this.dynamics.position.current)}getZoomLevel(){return this.dynamics.zoom.current}getSize(){return{...this.state.size}}isFullscreenEnabled(){return e0(this.parent,Un.isIphone)}needsUpdate(){this.state.needsUpdate=!0}needsContinuousUpdate(n){n?this.state.continuousUpdateCount++:this.state.continuousUpdateCount>0&&this.state.continuousUpdateCount--}autoSize(){(this.container.clientWidth!==this.state.size.width||this.container.clientHeight!==this.state.size.height)&&(this.state.size.width=Math.round(this.container.clientWidth),this.state.size.height=Math.round(this.container.clientHeight),this.state.aspect=this.state.size.width/this.state.size.height,this.state.hFov=this.dataHelper.vFovToHFov(this.state.vFov),this.dispatchEvent(new Pa(this.getSize())),this.navbar.autoSize())}setPanorama(n,e={}){var l;this.textureLoader.abortLoading(),(l=this.state.transitionAnimation)==null||l.cancel();const t=this.dataHelper.getTransitionOptions(e);e.showLoader===void 0&&(e.showLoader=!0),e.caption===void 0&&(e.caption=this.config.caption),e.description===void 0&&(e.description=this.config.description),!e.panoData&&typeof this.config.panoData=="function"&&(e.panoData=this.config.panoData),this.hideError(),this.resetIdleTimer(),this.config.panorama=n,this.config.caption=e.caption,this.config.description=e.description,this.config.sphereCorrection=e.sphereCorrection,(typeof this.config.panoData!="function"||typeof e.panoData=="function")&&(this.config.panoData=e.panoData);const s=u=>{if(l0(u))return!1;if(this.loader.hide(),this.state.loadingPromise=null,u)throw this.navbar.setCaption(null),this.showError(this.config.lang.loadError),console.error(u),this.dispatchEvent(new iy(n,u)),u;return this.navbar.setCaption(this.config.caption),!0};this.navbar.setCaption(`<em>${this.config.lang.loading}</em>`),(e.showLoader||!this.state.ready)&&this.loader.show(),this.dispatchEvent(new Q0(n));const o=this.adapter.loadTexture(this.config.panorama,!0,e.panoData).then(u=>{if(u.panorama!==this.config.panorama)throw this.adapter.disposeTexture(u),vf();const d=this.dataHelper.cleanPanoramaOptions(e,u.panoData);return(!hn(d.zoom)||!hn(d.position))&&this.stopAll(),{textureData:u,cleanOptions:d}});return!t||!this.state.ready||!this.adapter.supportsTransition(this.config.panorama)?this.state.loadingPromise=o.then(({textureData:u,cleanOptions:d})=>{this.renderer.show(),this.renderer.setTexture(u),this.renderer.setPanoramaPose(u.panoData),this.renderer.setSphereCorrection(e.sphereCorrection),this.state.ready||this.init(),this.dispatchEvent(new Mo(u)),hn(d.zoom)||this.zoom(d.zoom),hn(d.position)||this.rotate(d.position)}).then(()=>s(),u=>s(u)):this.state.loadingPromise=o.then(({textureData:u,cleanOptions:d})=>(this.loader.hide(),this.dispatchEvent(new Mo(u)),this.state.transitionAnimation=this.renderer.transition(u,d,t),this.state.transitionAnimation)).then(u=>{if(this.state.transitionAnimation=null,this.dispatchEvent(new oy(u)),!u)throw vf()}).then(()=>s(),u=>s(u)),this.state.loadingPromise}setOptions(n){const e={...this.config,...n};for(let[t,s]of Object.entries(n)){if(!(t in Ro)){vn(`Unknown option ${t}`);continue}if(t in jg){vn(jg[t]);continue}switch(t in Sf&&(s=Sf[t](s,{rawConfig:e,defValue:Ro[t]})),this.config[t]=s,t){case"mousemove":this.state.cursorOverride||this.setCursor(null);break;case"caption":this.navbar.setCaption(this.config.caption);break;case"size":this.resize(this.config.size);break;case"sphereCorrection":this.renderer.setSphereCorrection(this.config.sphereCorrection);break;case"navbar":case"lang":this.navbar.setButtons(this.config.navbar);break;case"moveSpeed":case"zoomSpeed":this.dynamics.updateSpeeds();break;case"minFov":case"maxFov":this.dynamics.zoom.setValue(this.dataHelper.fovToZoomLevel(this.state.vFov)),this.dispatchEvent(new or(this.getZoomLevel()));break;case"keyboard":this.config.keyboard==="always"?this.startKeyboardControl():this.stopKeyboardControl();break}}this.needsUpdate(),this.dispatchEvent(new Gn(Object.keys(n)))}setOption(n,e){this.setOptions({[n]:e})}showError(n){this.overlay.show({id:mn.ERROR,image:HR,title:n,dismissible:!1})}hideError(){this.overlay.hide(mn.ERROR)}rotate(n){const e=new w0(this.dataHelper.cleanPosition(n));this.dispatchEvent(e),!e.defaultPrevented&&this.dynamics.position.setValue(e.position)}zoom(n){this.dynamics.zoom.setValue(n)}zoomIn(n=1){this.dynamics.zoom.step(n)}zoomOut(n=1){this.dynamics.zoom.step(-n)}animate(n){const e=Xf(n),t=!hn(n.zoom),s=new $f(e?this.dataHelper.cleanPosition(n):void 0,n.zoom);if(this.dispatchEvent(s),s.defaultPrevented)return;this.stopAll();const{duration:o,properties:l}=this.dataHelper.getAnimationProperties(n.speed,s.position,s.zoomLevel);return o?(this.state.animation=new Xc({properties:l,duration:o,easing:n.easing||"inOutSine",onTick:u=>{e&&this.dynamics.position.setValue({yaw:u.yaw,pitch:u.pitch}),t&&this.dynamics.zoom.setValue(u.zoom)}}),this.state.animation.then(()=>{this.state.animation=null,this.resetIdleTimer()}),this.state.animation):(e&&this.rotate(s.position),t&&this.zoom(s.zoomLevel),new Xc(null))}stopAnimation(){return this.state.animation?(this.state.animation.cancel(),this.state.animation):Promise.resolve()}resize(n){this.__setSize(n),this.autoSize()}__setSize(n){["width","height"].forEach(e=>{n!=null&&n[e]&&(/^[0-9.]+$/.test(n[e])&&(n[e]+="px"),this.parent.style[e]=n[e])})}enterFullscreen(){this.isFullscreenEnabled()||t0(this.parent,Un.isIphone)}exitFullscreen(){this.isFullscreenEnabled()&&n0(Un.isIphone)}toggleFullscreen(){this.isFullscreenEnabled()?this.exitFullscreen():this.enterFullscreen()}startKeyboardControl(){this.state.keyboardEnabled=!0}stopKeyboardControl(){this.state.keyboardEnabled=!1}createTooltip(n){return new BR(this,n)}setCursor(n){this.state.cursorOverride=n,n?this.container.style.cursor=n:this.container.style.cursor=this.config.mousemove?"move":"default"}observeObjects(n){this.state.objectsObservers[n]||(this.state.objectsObservers[n]=null)}unobserveObjects(n){delete this.state.objectsObservers[n]}stopAll(){return this.dispatchEvent(new La),this.disableIdleTimer(),this.stopAnimation()}};function QR({panoramaUrl:n,className:e="",children:t}){const s=ht.useRef(null),o=ht.useRef(null);return ht.useEffect(()=>{var u,d;const l=s.current;if(!l||!n){(u=o.current)==null||u.destroy(),o.current=null;return}return(d=o.current)==null||d.destroy(),o.current=new ZR({container:l,panorama:n,navbar:["zoom","move","fullscreen"],mousewheel:!0,defaultZoomLvl:45,loadingTxt:"Loading"}),()=>{var f;(f=o.current)==null||f.destroy(),o.current=null}},[n]),Qe.jsx("div",{className:e,ref:s,children:t})}const qg="urbanfabric-human-verify-rater-v1",JR="urbanfabric-human-verify-responses-v2";function eb(){var t;const n=(t=window.localStorage.getItem(qg))==null?void 0:t.trim();if(n)return n;const e=typeof crypto.randomUUID=="function"?`rater-${crypto.randomUUID().slice(0,8)}`:`rater-${Date.now().toString(36)}`;return window.localStorage.setItem(qg,e),e}function Kg(){return typeof crypto.randomUUID=="function"?`session-${crypto.randomUUID()}`:`session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}function tb(n,e){window.localStorage.setItem(ib(n),JSON.stringify(e))}function nb(n,e){const t=["session_id","study_id","rater_id","task_id","task_order","dataset_group_id","dataset_id","city_id","pano_id","lon","lat","date","prompt_id","prompt","score","zscore","ai_bucket","bucket_min","bucket_max","stratum_population","stratum_sample_count","human_rating","elapsed_ms","rated_at","result_revision"],s=Object.values(e).sort((f,p)=>f.task_order-p.task_order),o=[t.join(","),...s.map(f=>t.map(p=>rb(f[p])).join(","))].join(`\r
`),l=new Blob(["\uFEFF",o],{type:"text/csv;charset=utf-8"}),u=URL.createObjectURL(l),d=document.createElement("a");d.href=u,d.download=`human-verify-${sb(n)}-${new Date().toISOString().slice(0,10)}.csv`,document.body.appendChild(d),d.click(),d.remove(),URL.revokeObjectURL(u)}function ib(n){return`${JR}:${n}`}function rb(n){if(n==null)return"";const e=String(n);return/[",\r\n]/.test(e)?`"${e.replace(/"/g,'""')}"`:e}function sb(n){return n.replace(/[^a-z0-9._-]+/gi,"-").replace(/^-+|-+$/g,"")||"human-verify"}const tx=5,wf=20,ob=1,wh=100;function Zg(n){var e;return((e=new URLSearchParams(window.location.search).get(n))==null?void 0:e.trim())||""}function ab(){const[n,e]=ht.useState(()=>Zg("backend")||Zg("runpod")),[t,s]=ht.useState([]),[o,l]=ht.useState({}),[u,d]=ht.useState(0),[f,p]=ht.useState(Kg),[v,g]=ht.useState(!1),[y,x]=ht.useState(!1),[w,A]=ht.useState(0),[E,_]=ht.useState(null),[N,I]=ht.useState(null),[R,k]=ht.useState(0),[,B]=ht.useState(0),H=ht.useMemo(eb,[]),Y=ht.useRef(!1),b=ht.useRef(performance.now()),C=ht.useRef(new Map),D=ht.useRef(new Map),de=ht.useRef(null),ie=ht.useRef(!1),le=ht.useCallback(async(V,re)=>{const ne=await fetch(`${V.baseUrl}/api/verification/sample`,{method:"POST",headers:e_(V),body:JSON.stringify({samples_per_bucket_per_dataset:ob,exclude_prompts:re})});if(!ne.ok){const Ae=await ne.json().catch(()=>null);throw new Error((Ae==null?void 0:Ae.detail)||`Verification sample request failed (${ne.status}).`)}const _e=await ne.json();if(_e.tasks.length<wf)throw new Error(`Prompt sampling returned ${_e.tasks.length} images; 20 are required for a prompt block.`);return _e},[]),fe=ht.useCallback(async()=>{const V=n.trim();if(!l_(V)){_("Enter a valid RunPod URL.");return}g(!0),_(null),I(null);try{const re=await Yd(),ne=await u_({...re,baseUrl:V,enabled:!0}),_e=await le(ne,[]);de.current=await Qg(ne,_e),t_(C.current),D.current.clear();const Ae=Kg();p(Ae),s(Jg(_e,[])),l({}),d(0),k(0),e(ne.baseUrl),hb(ne.baseUrl)}catch(re){_(re instanceof Error?re.message:"Unable to load the verification stream.")}finally{g(!1)}},[n,le]);ht.useEffect(()=>{Y.current||!n.trim()||(Y.current=!0,fe())},[n,fe]),ht.useEffect(()=>{var re;if(!t.length||t.length-u>wf||ie.current)return;const V=(re=[...t].reverse().find(ne=>!ne.is_encore))==null?void 0:re.prompt;ie.current=!0,x(!0),_(null),(async()=>{try{const ne=de.current??await Yd(),_e=await le(ne,V?[V]:[]);de.current=await Qg(ne,_e),s(Ae=>Jg(_e,Ae))}catch(ne){_(ne instanceof Error?ne.message:"Unable to load the next prompt.")}finally{ie.current=!1,x(!1)}})()},[u,w,t,le]);const ce=ht.useCallback(V=>{const re=Nc(V),ne=C.current.get(re);if((ne==null?void 0:ne.status)==="ready"||D.current.has(re))return;C.current.set(re,{status:"loading"}),B(Ie=>Ie+1);const _e=fS(V.dataset_id,V.lon,V.lat),Ae=bS(V.pano_id,_e,{lon:V.lon,lat:V.lat,date:V.date??null}).then(Ie=>{C.current.set(re,{status:"ready",objectUrl:Ie.object_url||Ie.image_url||void 0,message:Ie.message})}).catch(Ie=>{C.current.set(re,{status:"failed",message:Ie instanceof Error?Ie.message:"Panorama failed to load."})}).finally(()=>{D.current.delete(re),B(Ie=>Ie+1)});D.current.set(re,Ae)},[]);ht.useEffect(()=>{if(!(u>=t.length)){for(const V of t.slice(u,u+tx))ce(V);db(C.current,t,u)}},[u,ce,t]),ht.useEffect(()=>{b.current=performance.now()},[u]),ht.useEffect(()=>()=>t_(C.current),[]);const oe=t[u]??null,O=oe?C.current.get(Nc(oe)):null,ae=Object.keys(o).length,se=Math.max(wh,Math.ceil(ae/wh)*wh),U=ht.useCallback(async V=>{const re=de.current??await Yd(),ne=await fetch(`${re.baseUrl}/api/verification/ratings`,{method:"POST",headers:e_(re),keepalive:!0,body:JSON.stringify({ratings:[{study_id:V.study_id,task_id:V.task_id,source_task_id:V.source_task_id,rater_id:V.rater_id,human_rating:V.human_rating,elapsed_ms:V.elapsed_ms,rated_at:V.rated_at}]})});if(!ne.ok){const _e=await ne.json().catch(()=>null);throw new Error((_e==null?void 0:_e.detail)||`Backend rating sync failed (${ne.status}).`)}},[]),J=ht.useCallback(V=>{if(!oe||(O==null?void 0:O.status)!=="ready")return;const{source_task_id:re,study_id:ne,prompt:_e,dataset_group_id:Ae,sequence_number:Ie,is_encore:Nt,...ft}=oe,F={...ft,source_task_id:re,study_id:ne,prompt:_e,dataset_group_id:Ae,session_id:f,rater_id:H,task_order:Ie,human_rating:V,elapsed_ms:Math.max(0,Math.round(performance.now()-b.current)),rated_at:new Date().toISOString()},Et={...o,[oe.task_id]:F};l(Et),tb(f,Et),U(F).then(()=>I(null)).catch(Xe=>{const gt=Xe instanceof Error?Xe.message:"Backend rating sync failed.";I(`Saved locally, but not yet stored by RunPod: ${gt}`)}),k(Xe=>Xe+1),d(Xe=>Xe+1)},[O==null?void 0:O.status,oe,H,o,f,U]);ht.useEffect(()=>{const V=re=>{if(re.target instanceof HTMLInputElement||re.target instanceof HTMLTextAreaElement)return;const ne=Number(re.key);ne>=1&&ne<=5&&J(ne)};return window.addEventListener("keydown",V),()=>window.removeEventListener("keydown",V)},[J]);function Oe(V){V.preventDefault(),fe()}function Fe(){if(!oe)return;const V=Nc(oe),re=C.current.get(V);Qf(re==null?void 0:re.objectUrl),C.current.delete(V),ce(oe)}return t.length?Qe.jsxs("main",{className:"verify-app-shell",children:[Qe.jsxs("header",{className:"verify-toolbar",children:[Qe.jsxs("div",{className:"verify-brand-block",children:[Qe.jsx("span",{children:"UrbanFabric"}),Qe.jsx("strong",{children:"Human Verify"})]}),Qe.jsxs("form",{className:"verify-backend-control",onSubmit:Oe,children:[Qe.jsx("label",{htmlFor:"verify-backend-url",children:"RunPod"}),Qe.jsx("input",{id:"verify-backend-url",value:n,onChange:V=>e(V.target.value)}),Qe.jsx("button",{type:"submit",title:"Start a new verification session","aria-label":"Start a new verification session",disabled:v||y,children:Qe.jsx(qE,{className:v||y?"verify-spin":"",size:17})})]}),Qe.jsxs("div",{className:"verify-progress-block","aria-label":`${ae} of ${se} rated`,children:[Qe.jsx("span",{children:"Rated"}),Qe.jsxs("strong",{children:[ae,Qe.jsxs("small",{children:[" / ",se]})]}),R?Qe.jsx("i",{className:"verify-progress-plus-one","aria-hidden":"true",children:"+1"},R):null]}),Qe.jsxs("button",{className:"verify-export-button",type:"button",onClick:()=>nb(f,o),disabled:!ae,children:[Qe.jsx($E,{size:17}),"Export results"]})]}),Qe.jsx("section",{className:"verify-viewer-section",children:oe?Qe.jsxs(QR,{className:"verify-panorama",panoramaUrl:(O==null?void 0:O.status)==="ready"?O.objectUrl:null,children:[!O||O.status==="loading"?Qe.jsxs("div",{className:"verify-viewer-state",children:[Qe.jsx(Vd,{className:"verify-spin",size:26}),Qe.jsx("span",{children:"Loading street view"})]}):null,(O==null?void 0:O.status)==="failed"?Qe.jsxs("div",{className:"verify-viewer-state verify-viewer-error",children:[Qe.jsx("span",{children:O.message||"Panorama failed to load."}),Qe.jsxs("button",{type:"button",onClick:Fe,children:[Qe.jsx(Pv,{size:17}),"Retry"]})]}):null]}):Qe.jsxs("div",{className:"verify-viewer-state",children:[y?Qe.jsx(Vd,{className:"verify-spin",size:26}):null,Qe.jsx("span",{children:y?"Loading the next prompt":"The next prompt could not be loaded"}),y?null:Qe.jsxs("button",{className:"verify-primary-button",type:"button",onClick:()=>A(V=>V+1),children:[Qe.jsx(Pv,{size:17}),"Retry"]})]})}),oe?Qe.jsxs("section",{className:"verify-rating-panel",children:[Qe.jsxs("div",{className:"verify-prompt-block",children:[Qe.jsx("span",{children:"Rate this statement"}),Qe.jsx("h1",{children:oe.prompt})]}),Qe.jsxs("div",{className:"verify-scale-block",children:[Qe.jsx("div",{className:"verify-scale",role:"group","aria-label":"Human rating from 1 to 5",children:lb.map(V=>Qe.jsx("button",{type:"button",onClick:()=>J(V),disabled:(O==null?void 0:O.status)!=="ready","aria-label":`Rate ${V} out of 5`,children:Qe.jsx("strong",{children:V})},V))}),Qe.jsxs("div",{className:"verify-scale-guide","aria-hidden":"true",children:[Qe.jsx("span",{children:"Image and description are not related"}),Qe.jsx("span",{children:"Image and description are highly related"})]})]})]}):null,E||N?Qe.jsx("div",{className:"verify-floating-error",children:E||N}):null]}):Qe.jsx("main",{className:"verify-setup-shell",children:Qe.jsxs("form",{className:"verify-setup-card",onSubmit:Oe,children:[Qe.jsx("div",{className:"verify-wordmark",children:"UrbanFabric"}),Qe.jsx("h1",{children:"Human Verify"}),Qe.jsx("p",{children:"Rate how closely each 360° street scene matches the statement. Prompts rotate as you continue."}),Qe.jsxs("label",{children:[Qe.jsx("span",{children:"RunPod URL"}),Qe.jsx("input",{value:n,onChange:V=>e(V.target.value),placeholder:"https://pod-id-8000.proxy.runpod.net",autoFocus:!0})]}),E?Qe.jsx("div",{className:"verify-error",children:E}):null,Qe.jsxs("button",{className:"verify-primary-button",type:"submit",disabled:v,children:[v?Qe.jsx(Vd,{className:"verify-spin",size:18}):null,v?"Preparing stream":"Start verification"]}),Qe.jsx("small",{children:"Five score buckets · twenty new scenes per prompt · continuous verification"})]})})}const lb=[1,2,3,4,5];async function Qg(n,e){return u_({...n,datasetId:e.dataset_ids[0]||n.datasetId,datasetIds:e.dataset_ids,datasetGroupId:e.dataset_group_id||n.datasetGroupId,enabled:!0})}function Jg(n,e){const t=[...e],s=n.tasks.slice(0,wf);let o=0;for(;o<s.length;){const l=t.length+1,u=t.filter(f=>!f.is_encore&&f.sequence_number<=l-10);if(u.length&&Math.random()<cb(l)){const f=u[Math.floor(Math.random()*u.length)];t.push({...f,task_id:ub("encore"),source_task_id:f.source_task_id,sequence_number:l,is_encore:!0});continue}const d=s[o];o+=1,t.push({...d,source_task_id:d.task_id,study_id:n.study_id,prompt:n.prompt,dataset_group_id:n.dataset_group_id,sequence_number:l,is_encore:!1})}return t}function cb(n){const e=n-1;return e<10?0:.05+.05*Math.min(1,(e-10)/40)}function ub(n){return typeof crypto.randomUUID=="function"?`${n}-${crypto.randomUUID()}`:`${n}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}function e_(n){var t;const e={"Content-Type":"application/json"};return(t=n.token)!=null&&t.trim()&&(e.Authorization=`Bearer ${n.token.trim()}`),e}function Nc(n){return[n.dataset_id,n.pano_id,n.lon,n.lat,n.date??""].join(":")}function db(n,e,t){const s=new Set(e.slice(Math.max(0,t-3),t+tx+1).map(Nc));for(const[o,l]of n)s.has(o)||(Qf(l.objectUrl),n.delete(o))}function t_(n){for(const e of n.values())Qf(e.objectUrl);n.clear()}function Qf(n){n!=null&&n.startsWith("blob:")&&URL.revokeObjectURL(n)}function hb(n){const e=new URL(window.location.href);e.searchParams.set("backend",n),e.searchParams.delete("prompt"),e.searchParams.delete("seed"),window.history.replaceState(window.history.state,"",e)}WE.createRoot(document.getElementById("root")).render(Qe.jsx(FE.StrictMode,{children:Qe.jsx(ab,{})}));
