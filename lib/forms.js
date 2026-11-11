import { randomUUID } from 'node:crypto';
const EMAIL=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
const SUBJECTS=new Set(['Reader enquiry','Book-club enquiry','Press or interview enquiry','Other enquiry']);
const reply=(status,message)=>Response.json({message},{status,headers:{'Cache-Control':'no-store'}});
const validEmail=value=>typeof value==='string'&&value.length<=200&&EMAIL.test(value);
const validText=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;
async function readBody(request){
 if(Number(request.headers.get('content-length'))>16384)throw new Error('large');
 if(!request.body)throw new Error('json');
 const reader=request.body.getReader();let bytes=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16384){await reader.cancel();throw new Error('large');}chunks.push(value);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createFormHandler({env=process.env,fetchImpl=globalThis.fetch}={}){
 return async request=>{
  if(request.method!=='POST')return reply(405,'Use the website form to submit your request.');
  const allowed=(env.ALLOWED_ORIGINS||'https://thevillageswechoose.com,https://www.thevillageswechoose.com').split(',').map(s=>s.trim()).filter(Boolean);
  if(!allowed.includes(request.headers.get('origin')))return reply(403,'This request did not come from the website.');
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply(415,'Please submit the website form.');
  let data;try{data=await readBody(request)}catch(error){return reply(error.message==='large'?413:400,'The form data could not be processed.');}
  if(!data||typeof data!=='object'||Array.isArray(data)||!['contact','subscribe'].includes(data.kind))return reply(400,'Invalid form.');
  if(data.company)return reply(400,'This submission could not be processed.');
  if(!validEmail(typeof data.email==='string'?data.email.trim():null))return reply(400,'Please enter a valid email address.');
  const email=data.email.trim();
  if(data.kind==='contact'&&(!validText(data.name,1,100)||/[\r\n]/.test(data.name)||!validText(data.message,10,3000)||!SUBJECTS.has(data.subject)))return reply(400,'Please enter your name, subject and a message of at least 10 characters.');
  if(data.kind==='subscribe'&&data.consent!==true)return reply(400,'Please confirm that you want to receive book updates.');
  if(env.ENABLE_LIVE_FORMS!=='true')return reply(503,'This preview form is not connected yet. Nothing has been sent or subscribed.');
  const contactReady=env.RESEND_API_KEY&&validEmail(env.CONTACT_TO)&&env.CONTACT_FROM&&!/[\r\n]/.test(env.CONTACT_FROM);
  const signupReady=env.MAILERLITE_API_KEY&&/^\d+$/.test(env.MAILERLITE_GROUP_ID||'')&&env.MAILERLITE_DOUBLE_OPT_IN_CONFIRMED==='true';
  if(!env.TURNSTILE_SECRET_KEY||(data.kind==='contact'?!contactReady:!signupReady))return reply(503,'This form is not connected yet. Please try again later.');
  if(!validText(data.token,1,2048))return reply(400,'Please complete the verification.');
  const timedFetch=(url,options={})=>fetchImpl(url,{...options,signal:AbortSignal.timeout(7000)});
  try{
   const verifyResponse=await timedFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:data.token})});
   if(!verifyResponse.ok)return reply(502,'Verification is temporarily unavailable. Please try again.');
   const verification=await verifyResponse.json();
   const hosts=allowed.map(origin=>new URL(origin).hostname);
   if(!verification.success||verification.action!==data.kind||!hosts.includes(verification.hostname))return reply(400,'Verification expired or failed. Please try again.');
   if(data.kind==='contact'){
    const key=request.headers.get('idempotency-key');
    const requestId=/^[a-zA-Z0-9-]{16,64}$/.test(key||'')?key:randomUUID();
    const response=await timedFetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`website-contact-${requestId}`},body:JSON.stringify({from:env.CONTACT_FROM,to:[env.CONTACT_TO],reply_to:email,subject:`The Villages We Choose — ${data.subject}`,text:`Name: ${data.name.trim()}\nEmail: ${email}\nSubject: ${data.subject}\n\n${data.message.trim()}`})});
    if(!response.ok){console.error('contact_provider_error',{status:response.status});return reply(502,'Your message could not be submitted. Please try again later.');}
    const result=await response.json();if(!result.id)return reply(502,'We could not confirm your submission. Please try again.');
    return reply(202,'Your message has been submitted. Thank you for getting in touch.');
   }
   const auth={Authorization:`Bearer ${env.MAILERLITE_API_KEY}`,Accept:'application/json','Content-Type':'application/json'};
   // Never overwrite a prior unsubscribe, bounce, junk or active status through this public form.
   const existing=await timedFetch(`https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}`,{headers:auth});
   if(existing.ok)return reply(202,'Your request was received. Check your inbox for any required confirmation.');
   if(existing.status!==404){console.error('signup_lookup_error',{status:existing.status});return reply(502,'Signup is temporarily unavailable. Please try again later.');}
   const response=await timedFetch('https://connect.mailerlite.com/api/subscribers',{method:'POST',headers:auth,body:JSON.stringify({email,groups:[env.MAILERLITE_GROUP_ID],status:'unconfirmed',resubscribe:false,subscribed_at:new Date().toISOString().slice(0,19).replace('T',' ')})});
   if(!response.ok){console.error('signup_provider_error',{status:response.status});return reply(502,'Signup could not be completed. Please try again later.');}
   const result=await response.json();if(!result.data?.id)return reply(502,'We could not confirm signup. Please try again later.');
   return reply(202,'Please check your inbox to confirm your email subscription.');
  }catch{console.error('website_form_request_failed',{kind:data.kind});return reply(502,'The service is temporarily unavailable. Please try again later.');}
 };
}
