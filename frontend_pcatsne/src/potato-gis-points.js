// The same 12-byte Mercator XY / RGBA contract as the scale viewer.
export function geographicPointsLayer(bytes, count) {
  if (bytes.byteLength!==count*12) throw new Error('Invalid geographic point record count');
  let gl,program,buffer,map;
  return {
    id:'potato-panorama-points',type:'custom',renderingMode:'2d',visible:false,
    onAdd(instance,context) {
      map=instance;gl=context;
      const shader=(type,source)=>{
        const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const vertex=shader(gl.VERTEX_SHADER,`precision highp float; uniform mat4 u_matrix; uniform float u_size; attribute vec2 a_pos; attribute vec4 a_color; varying vec4 v_color; void main(){ gl_Position=u_matrix*vec4(a_pos,0.,1.); gl_PointSize=u_size; v_color=a_color; }`);
      const fragment=shader(gl.FRAGMENT_SHADER,`precision highp float; varying vec4 v_color; void main(){ float d=length(gl_PointCoord-vec2(.5)); if(d>.5) discard; gl_FragColor=vec4(v_color.rgb,.9); }`);
      program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.deleteShader(vertex);gl.deleteShader(fragment);
      buffer=gl.createBuffer();this.replace(bytes);
    },
    replace(data) {
      if(data.byteLength!==count*12) throw new Error('Point coordinates/color count mismatch');
      bytes=data;
      if(buffer){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,bytes,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,null);map.triggerRepaint();}
    },
    render(context,matrix) {
      if(!this.visible) return;
      gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.uniformMatrix4fv(gl.getUniformLocation(program,'u_matrix'),false,matrix);
      gl.uniform1f(gl.getUniformLocation(program,'u_size'),Math.min(8,Math.max(1.3,Math.pow(2,map.getZoom()-11)))*(devicePixelRatio||1));
      const pos=gl.getAttribLocation(program,'a_pos'), color=gl.getAttribLocation(program,'a_color');
      gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(color);
      gl.vertexAttribPointer(pos,2,gl.FLOAT,false,12,0);gl.vertexAttribPointer(color,4,gl.UNSIGNED_BYTE,true,12,8);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
      gl.drawArrays(gl.POINTS,0,count);gl.bindBuffer(gl.ARRAY_BUFFER,null);gl.depthMask(true);
    },
    onRemove() {gl.deleteBuffer(buffer);gl.deleteProgram(program);}
  };
}
