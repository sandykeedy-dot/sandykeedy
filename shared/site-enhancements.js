(() => {
  const config=window.SITE_CONFIG||{previewMode:true};
  document.querySelectorAll('[data-placeholder]').forEach(link=>{
    link.title=`Preview link: ${link.dataset.placeholder} will be added before launch`;
    link.addEventListener('click',event=>{
      event.preventDefault();
      let dialog=document.querySelector('#preview-link-dialog');
      if(!dialog){dialog=document.createElement('dialog');dialog.id='preview-link-dialog';dialog.className='preview-dialog';dialog.setAttribute('aria-labelledby','preview-link-title');dialog.innerHTML='<form method="dialog"><span class="eyebrow">DESIGN PREVIEW</span><h2 id="preview-link-title">Link to be added</h2><p class="preview-link-message"></p><button class="scope-button">Back to the website</button></form>';document.body.append(dialog);}
      dialog.querySelector('.preview-link-message').textContent=`The ${link.dataset.placeholder} link is a placeholder for this review. The confirmed destination will be added before the site goes live.`;
      dialog.showModal();
    });
  });
  document.querySelector('[data-print-guide]')?.addEventListener('click',()=>window.print());
  if(new URLSearchParams(location.search).get('subject')==='book-club'){
    const select=document.querySelector('select[name="subject"]');if(select)select.value='Book-club enquiry';
  }
  const forms=[...document.querySelectorAll('[data-site-form]')];
  if(!config.previewMode&&config.turnstileSiteKey){
    window.onWebsiteBotCheckReady=()=>forms.forEach(form=>{
      const node=form.querySelector('.bot-check');if(!node)return;
      form.botWidget=window.turnstile.render(node,{sitekey:config.turnstileSiteKey,action:form.dataset.siteForm,theme:'auto',callback:token=>form.dataset.botToken=token,'expired-callback':()=>delete form.dataset.botToken});
    });
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onWebsiteBotCheckReady&render=explicit';script.async=true;document.head.append(script);
  }
  forms.forEach(form=>{
    const status=form.querySelector('.form-status'), button=form.querySelector('button[type="submit"]');
    form.addEventListener('input',event=>{event.target.setCustomValidity?.('');status.textContent='';delete form.dataset.requestId;});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(button.disabled)return;
      if(!form.reportValidity())return;
      const kind=form.dataset.siteForm;
      const name=form.elements.name?.value.trim(),email=form.elements.email.value.trim(),message=form.elements.message?.value.trim();
      if(kind==='contact'&&(!name||message.length<10)){status.textContent='Please enter your name and a message of at least 10 characters.';return;}
      if(config.previewMode){status.textContent=kind==='contact'?'Preview only: the form is complete, but no message has been sent.':'Preview only: the form is complete, but no subscription has been created.';return;}
      if(!config.turnstileSiteKey){status.textContent='This form is not connected yet. Please try again later.';return;}
      if(!form.dataset.botToken){status.textContent='Please complete the verification before submitting.';return;}
      button.disabled=true;form.setAttribute('aria-busy','true');status.textContent='Submitting…';
      form.dataset.requestId ||= crypto.randomUUID();
      try{
        const response=await fetch('/api/forms',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':form.dataset.requestId},body:JSON.stringify({kind,name,email,message,subject:form.elements.subject?.value,consent:form.elements.consent?.checked===true,company:form.elements.company?.value,token:form.dataset.botToken}),signal:AbortSignal.timeout(20000)});
        const result=await response.json();status.textContent=result.message||(response.ok?'Your request was received.':'Unable to submit. Please try again.');
        if(response.ok){form.reset();delete form.dataset.requestId;}
      }catch{status.textContent='We couldn’t confirm submission. Please check your connection and try again.';}
      finally{button.disabled=false;form.removeAttribute('aria-busy');delete form.dataset.botToken;if(form.botWidget!==undefined)window.turnstile?.reset(form.botWidget);}
    });
  });
})();
