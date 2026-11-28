import {execFile} from "node:child_process";
import {promisify} from "node:util";

const exec = promisify(execFile);
const base = "/workspace/experiments/spatial_semantic_matching_20261127/boundary_live_20261127";
const gpu = process.env.REGION_BOUNDARY_GPU_URL || "http://127.0.0.1:18771";
const cpu = process.env.REGION_ATLAS_CPU_URL || "https://rjkia0dgxlwugo-8000.proxy.runpod.net/api/region-atlas";

// The independently versioned atlas lives on the CPU-mounted volume.
// Read individual files only; no CPU daemon, deployment or local atlas copy.
async function fixedFile(relative) {
  const {stdout} = await exec("ssh",["-o","BatchMode=yes","-o","StrictHostKeyChecking=yes","-o","ConnectTimeout=4",
    process.env.REGION_FIXED_SSH || "urbanfabric-codex-cpu","cat",base+"/"+relative],
    {encoding:"buffer",maxBuffer:3*1024*1024,timeout:18000,windowsHide:true});
  return stdout;
}
export function liveBoundaryApi() {
  return {name:"live-boundary-api",apply:"serve",configureServer(server) {
    server.middlewares.use("/__area-live",async(req,res)=>{
      const url = new URL(req.url,"http://localhost"), path=url.pathname;
      res.setHeader("Cache-Control","no-store");
      const send=(status,body,type="application/json")=>{res.writeHead(status,{"Content-Type":type});res.end(body)};
      const json=(status,value)=>send(status,JSON.stringify(value));
      try {
        if(path==="/ready" && req.method==="GET"){
          let live=false;
          try {const r=await fetch(gpu+"/ready",{signal:AbortSignal.timeout(4000)}); live=r.ok&&(await r.json()).online===true;} catch {}
          return json(200,{online:live});
        }
        if(path==="/index" && req.method==="GET"){
          try {return send(200,await fixedFile("fixed_v3/index.json"));} catch {
            const r=await fetch(cpu+"/index",{signal:AbortSignal.timeout(10000)});
            return send(r.status,Buffer.from(await r.arrayBuffer()));
          }
        }
        const fixed=path.match(/^\/query\/([a-z][a-z0-9_]{0,63})$/);
        const dynamic=/^\/query\/live_[a-f0-9]{32}$/.test(path);
        const version=url.searchParams.get("version");
        if(req.method==="GET" && fixed && !dynamic && ["atlas150-geocheck-v2","atlas150-geocheck-v3"].includes(version)){
          const release=version==="atlas150-geocheck-v3"?"fixed_v3":"fixed";
          return send(200,await fixedFile(release+"/query/"+fixed[1]+".bin"),"application/octet-stream");
        }
        const legacy = !dynamic && req.method==="GET" && (fixed || /^\/(city|panoramas)\/(london|rome|new_york|shanghai)$/.test(path));
        const post=req.method==="POST" && ["/analyze","/search"].includes(path);
        if(!legacy && !(dynamic && req.method==="GET") && !post)return json(404,{detail:"Unknown boundary resource."});
        let body;
        if(post){
          if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)return json(403,{detail:"Use the local map."});
          const chunks=[];let length=0;
          for await(const chunk of req){length+=chunk.length;if(length>16000)return json(413,{detail:"Boundary exceeds 64 corners."});chunks.push(chunk)}
          body=Buffer.concat(chunks);
        }
        const r=await fetch((legacy?cpu:gpu)+path,{method:req.method,headers:post?{"Content-Type":"application/json"}:{},body,signal:AbortSignal.timeout(post?180000:30000)});
        send(r.status,Buffer.from(await r.arrayBuffer()),r.headers.get("content-type")||"application/octet-stream");
      } catch {json(503,{detail:"Service unavailable. Choose a saved reference landmark or retry."});}
    });
  }};
}
