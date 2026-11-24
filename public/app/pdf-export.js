/* RAI Ocenka: standalone press-ready A4 PDF exporter, no dependency or QR regeneration */
(function(){
'use strict';
const dpi=300, scale=dpi/25.4, W=Math.round(210*scale), H=Math.round(297*scale);
const encoder=new TextEncoder();
function pdf(pictures){
 const sections=[],offsets=[0];let length=0;
 function add(v){if(typeof v==='string')v=encoder.encode(v);sections.push(v);length+=v.length;}
 function obj(id,dict,stream){offsets[id]=length;add(id+' 0 obj\n'+dict);if(stream){add('\nstream\n');add(stream);add('\nendstream');}add('\nendobj\n');}
 add('%PDF-1.4\n');
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 const refs=pictures.map((_,i)=>(3+3*i)+' 0 R').join(' ');
 obj(2,'<< /Type /Pages /Kids ['+refs+'] /Count '+pictures.length+' >>');
 pictures.forEach((jpg,i)=>{
  const p=3+3*i,img=p+1,content=p+2;
  obj(p,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.2756 841.8898] /Resources << /XObject << /Im'+i+' '+img+' 0 R >> >> /Contents '+content+' 0 R >>');
  obj(img,'<< /Type /XObject /Subtype /Image /Width '+W+' /Height '+H+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>',jpg);
  const command='q\n595.2756 0 0 841.8898 0 0 cm\n/Im'+i+' Do\nQ\n';
  obj(content,'<< /Length '+encoder.encode(command).length+' >>',encoder.encode(command));
 });
 const xref=length;add('xref\n0 '+(3+3*pictures.length)+'\n0000000000 65535 f \n');
 for(let i=1;i<3+3*pictures.length;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 add('trailer\n<< /Size '+(3+3*pictures.length)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
 return new Blob(sections,{type:'application/pdf'});
}
function bytes(b64){const binary=atob(b64),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}
async function image(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Невалидно изображение'));im.src=src;});}
function write(ctx,v,x,y,size,color,weight){ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=(weight||'700')+' '+Math.round(size*scale)+'px Montserrat,Arial,sans-serif';ctx.fillText(v,x*scale,y*scale);}
function sticker(ctx,t,qr,logo,x,y){
 const px=n=>n*scale,cx=x+35;
 ctx.fillStyle='#111217';ctx.fillRect(px(x),px(y),px(70),px(90));
 ctx.strokeStyle='#9da1aa';ctx.lineWidth=2;ctx.setLineDash([9,7]);ctx.strokeRect(px(x)+1,px(y)+1,px(70)-2,px(90)-2);ctx.setLineDash([]);
 if(logo){const ww=34,hh=logo.height/logo.width*ww;ctx.drawImage(logo,px(cx-ww/2),px(y+5),px(ww),px(hh));}
 else write(ctx,'РАЙ',cx,y+14,8,'#fff','800');
 write(ctx,'Вашето мнение',cx,y+28,4.1,'#fff','700');
 write(ctx,'е важно за нас',cx,y+33,4.1,'#fff','700');
 // Keep a clear quiet zone and 6 mm breathing space below the QR.
 ctx.fillStyle='#fff';ctx.fillRect(px(cx-22),px(y+36),px(44),px(44));
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(qr,px(cx-20),px(y+38),px(40),px(40));
 ctx.imageSmoothingEnabled=true;
 write(ctx,'BG  ·  EN  ·  GR',cx,y+84,3.0,'#e3e4e8','700');
 // This identifying label must stay OUTSIDE the cut line.
 write(ctx,(t.zone_name||'')+' — МАСА '+t.label,cx,y+97,3.4,'#171a20','800');
}
let ongoing=false;
async function exportPdf(ids,opts){
 if(ongoing)throw Error('PDF вече се подготвя.');
 if(!Array.isArray(ids)||!ids.length)throw Error('Маркирай поне една маса.');
 ongoing=true;
 try{
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;
  const response=await fetch('/api/admin/tables',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('Влез в администрацията за да изтеглиш PDF.');
  const all=await response.json(),chosen=new Set(ids.map(String));
  const tables=all.filter(t=>chosen.has(String(t.id))&&t.active);
  if(tables.length!==chosen.size)throw Error('Някоя избрана маса е неактивна или липсва.');
  const qrs=await Promise.all(tables.map(async t=>{
   const r=await fetch('/api/admin/tables/'+encodeURIComponent(t.id)+'/qr.svg',{credentials:'same-origin',cache:'no-store'});
   if(!r.ok)throw Error('Неуспешно зареждане на QR за маса '+t.label);
   const svg=await r.text();if(!svg.includes('<svg'))throw Error('Невалиден QR');
   const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
   try{return await image(url);}finally{URL.revokeObjectURL(url);}
  }));
  let logo=null;try{logo=await image('/app/logo.png');}catch(e){}
  const pictures=[];
  for(let i=0;i<tables.length;i+=4){
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
   const spots=[[22,15],[118,15],[22,157],[118,157]];
   for(let j=0;j<4&&i+j<tables.length;j++)sticker(ctx,tables[i+j],qrs[i+j],logo,spots[j][0],spots[j][1]);
   write(ctx,'РАЙ Оценка · 70 × 90 мм · печат 100%',105,291,2.5,'#8a8c92','600');
   const uri=canvas.toDataURL('image/jpeg',.96);pictures.push(bytes(uri.slice(uri.indexOf(',')+1)));
   canvas.width=canvas.height=1;
  }
  const blob=pdf(pictures),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.download=(opts&&opts.filename)||('RAI_QR_'+tables.length+'_masi.pdf');a.href=url;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  return {count:tables.length,pages:pictures.length};
 }finally{ongoing=false;}
}
window.RAIPdf={export:exportPdf};
})();