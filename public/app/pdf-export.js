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
// Approved 50 x 80 mm design (black, white logo, stars, "Оценете ни").
// The static art is one pre-rendered image; only the QR code differs per table.
// QR modules (without the SVG quiet zone) fill 27.52 mm, centred at (24.98, 53.20) mm.
const QR_MODULES_MM=27.52, QR_CX=24.98, QR_CY=53.20;
function sticker(ctx,t,qr,tpl,x,y){
 const px=n=>n*scale,w=50,h=80;
 if(tpl)ctx.drawImage(tpl,px(x),px(y),px(w),px(h));
 else{ctx.fillStyle='#121112';ctx.fillRect(px(x),px(y),px(w),px(h));}
 const size=QR_MODULES_MM*qr.n/(qr.n-2);
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(qr.img,px(x+QR_CX-size/2),px(y+QR_CY-size/2),px(size),px(size));
 ctx.imageSmoothingEnabled=true;
 // Crop marks outside the sticker, so nothing is drawn on the art itself.
 ctx.strokeStyle='#9da1aa';ctx.lineWidth=2;
 [[x,y,-1,-1],[x+w,y,1,-1],[x,y+h,-1,1],[x+w,y+h,1,1]].forEach(function(c){
  ctx.beginPath();ctx.moveTo(px(c[0]+c[2]*1),px(c[1]));ctx.lineTo(px(c[0]+c[2]*4),px(c[1]));
  ctx.moveTo(px(c[0]),px(c[1]+c[3]*1));ctx.lineTo(px(c[0]),px(c[1]+c[3]*4));ctx.stroke();
 });
 // Small table label in the LEFT white gutter, outside the cut line.
 ctx.save();ctx.translate(px(x-5),px(y+40));ctx.rotate(-Math.PI/2);
 ctx.fillStyle='#444951';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.font='700 '+Math.round(px(2.7))+'px Montserrat,Arial,sans-serif';
 ctx.fillText('МАСА '+t.label,0,0);ctx.restore();
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
   const vb=/viewBox="0 0 (\d+) (\d+)"/.exec(svg);if(!vb)throw Error('Невалиден QR');
   const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
   try{return {img:await image(url),n:Number(vb[1])};}finally{URL.revokeObjectURL(url);}
  }));
  let tpl=null;try{tpl=await image('/app/sticker-5x8.png?v=2');}catch(e){}
  const pictures=[];
  for(let i=0;i<tables.length;i+=9){
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
   const spots=[[20,7],[80,7],[140,7],[20,100],[80,100],[140,100],[20,193],[80,193],[140,193]];
   for(let j=0;j<9&&i+j<tables.length;j++)sticker(ctx,tables[i+j],qrs[i+j],tpl,spots[j][0],spots[j][1]);
   write(ctx,'РАЙ Оценка · 50 × 80 мм · печат 100%',105,291,2.5,'#8a8c92','600');
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