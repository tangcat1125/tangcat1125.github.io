const A='./characters/',G='./assets/';
const assets={idle:A+'rabbit-idle.png',blink:A+'rabbit-blink.png',close:A+'rabbit-close.png',scissors:G+'scissors.png',rock:G+'rock.png',paper:G+'paper.png'};
const rabbit=document.querySelector('#rabbit'),stage=document.querySelector('.stage'),img=document.querySelector('#rabbitImg'),choice=document.querySelector('#choice'),message=document.querySelector('#message'),replay=document.querySelector('#replay'),hint=document.querySelector('#hint'),music=document.querySelector('#music');
img.src=assets.idle;let busy=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){
  if(busy)return; busy=true;
  replay.classList.add('hidden'); choice.classList.remove('show'); message.classList.remove('show');
  hint.textContent='兔兔要眨眼睛囉！'; music.currentTime=0; music.play().catch(()=>{});
  rabbit.style.opacity='1'; rabbit.classList.add('blink'); img.src=assets.blink;
  await wait(750); rabbit.classList.remove('blink');
  hint.textContent='兔兔的臉靠近一點……'; rabbit.classList.add('closeup'); img.src=assets.idle;
  await wait(2200);
  rabbit.classList.remove('closeup'); rabbit.style.opacity='0';
  const picks=['scissors','rock','paper']; let index=0; let rolling=true;
  const showPick=()=>{const name=picks[index]; choice.innerHTML=`<img src="${assets[name]}" alt="${name}">`;};
  showPick(); choice.classList.add('show'); hint.textContent='拳頭一直轉，老師再點一下畫面！';
  const timer=setInterval(()=>{index=(index+1)%picks.length;showPick();},220);
  await new Promise(resolve=>{const lock=()=>{if(!rolling)return;rolling=false;clearInterval(timer);stage.removeEventListener('click',lock);resolve();};stage.addEventListener('click',lock);});
  hint.textContent='老師選到的是這一拳！'; await wait(1000);
  choice.classList.remove('show'); rabbit.style.opacity='1'; img.src=assets.idle;
  message.textContent='你贏了嗎？'; message.classList.add('show'); hint.textContent='看看兔兔的表情！';
  await wait(2000);
  message.classList.remove('show'); rabbit.classList.add('closeup'); img.src=assets.idle; await wait(650);
  message.textContent='再玩一次喔！'; message.classList.add('show'); replay.classList.remove('hidden'); hint.textContent='點擊按鈕，和兔兔再玩一次！'; busy=false;
}
rabbit.addEventListener('click',start);rabbit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')start()});replay.addEventListener('click',start);
