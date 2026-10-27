import {TITLES,NAMES,INSTRUCTIONS,createGame,legalActions,applyAction,chessObject,square,scores} from './rules.mjs';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const kind=TITLES[params.get('game')]?params.get('game'):'connect4';
let Chess,state,selected=null,room,channel,peerId=null,hostId=null,mySide=0,isHost=false,network=false,connected=false,role='local',remoteName='',resetConsent=false,remoteReset=false,epoch=0,token='';
const myName=()=>($('name').value.trim()||'Player').slice(0,20);
const tokenForSession=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
const symbols={wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'};
const chessNames={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
const boardSizes={chess:8,checkers:8,reversi:8,connect4:7,tictactoe:3,gomoku:15};
function canPlay(){return !state.ended&&(!network||(connected&&mySide===state.turn));}
function notice(text){$('notice').textContent=text;}
function send(data,target=peerId){if(!channel||!target)return;Promise.resolve(channel.send(data,{target})).catch(()=>{$('connection').textContent='Connection interrupted. Waiting for your friend to reconnect.';});}
function announce(){send({type:'state',epoch,session:token,state});}
function newLocalGame(){state=createGame(kind,Chess);selected=null;render();}
function act(action){
 if(!canPlay()){notice(network&&!connected?'Waiting for a friend to connect.':'It is the other player’s turn.');return;}
 if(network&&!isHost){send({type:'move',epoch,revision:state.revision,action});notice('Move sent…');return;}
 const next=applyAction(state,action,Chess);if(!next)return;
 state=next;selected=null;render();if(network)announce();
}
function cellButton(at,label,content=''){
 const button=document.createElement('button');button.type='button';button.dataset.cell=String(at);button.setAttribute('aria-label',label);button.textContent=content;return button;
}
function clickCell(at){
 if(!canPlay())return;
 const actions=legalActions(state,Chess);
 if(kind==='chess'||kind==='checkers'){
  if(selected!==null){const options=actions.filter(a=>a.from===selected&&a.to===at),action=options.find(a=>kind==='chess'&&a.promotion===$('promotion').value)||options[0];if(action){act(action);return;}}
  selected=actions.some(a=>a.from===at)?at:null;render();return;
 }
 act(kind==='connect4'?{column:at%7}:{at});
}
function renderGrid(){
 const host=$('board'),width=boardSizes[kind],height=kind==='connect4'?6:width;host.className='board '+kind;host.style.gridTemplateColumns=`repeat(${width},1fr)`;host.setAttribute('role','grid');host.setAttribute('aria-rowcount',height);host.setAttribute('aria-colcount',width);host.replaceChildren();
 const actions=legalActions(state,Chess),targets=new Set(actions.filter(a=>selected===null||a.from===selected).map(a=>a.to??a.at??a.column));
 const board=kind==='chess'?chessObject(state,Chess).board().flat().map(p=>p?p.color+p.type:''):state.board;
 for(let at=0;at<width*height;at++){
  const x=at%width,y=Math.floor(at/width),value=board[at],coordinate=kind==='chess'?square(at):`${String.fromCharCode(65+x)}${y+1}`;
  let label=coordinate,content='';
  if(kind==='chess'){content=value?symbols[value]:'';label+=' '+(value?(value[0]==='w'?'White ':'Black ')+chessNames[value[1]]:'empty');}
  else if(kind==='tictactoe'){content=value===1?'×':value===2?'○':'';label+=' '+(value===1?'cross':value===2?'nought':'empty');}
  else label+=' '+(value?NAMES[kind][(value-1)%2]+(value>2?' king':''):'empty');
  const button=cellButton(at,label,content);button.setAttribute('role','gridcell');button.setAttribute('aria-rowindex',y+1);button.setAttribute('aria-colindex',x+1);
  if((x+y)%2===1)button.classList.add('dark');
  if(selected===at)button.classList.add('selected');if(state.last.includes(at))button.classList.add('last');
  if(targets.has(kind==='connect4'?x:at))button.classList.add('legal');
  if(kind==='chess'&&value)button.classList.add(value[0]==='w'?'whitePiece':'blackPiece');
  if(value&&kind!=='chess'&&kind!=='tictactoe'){
   const disc=document.createElement('span');disc.className='piece p'+((value-1)%2+1);disc.textContent=kind==='checkers'&&value>2?'♛':'';disc.setAttribute('aria-hidden','true');button.append(disc);
  }
  if(kind==='chess'&&(x===0||y===7)){const coord=document.createElement('small');coord.className='coord';coord.textContent=x===0?8-y:String.fromCharCode(97+x);button.append(coord);}
  button.disabled=!canPlay();button.onclick=()=>clickCell(at);
  button.onkeydown=event=>{const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-width,ArrowDown:width}[event.key];if(delta!==undefined){event.preventDefault();host.querySelector(`[data-cell="${Math.max(0,Math.min(width*height-1,at+delta))}"]`)?.focus();}};
  host.append(button);
 }
 if(state.forced!==null&&state.forced!==undefined){selected=state.forced;host.querySelector(`[data-cell="${selected}"]`)?.classList.add('selected');}
}
function renderMancala(){
 const host=$('board');host.className='mancalaBoard';host.style.gridTemplateColumns='';host.removeAttribute('role');host.replaceChildren();const legal=new Set(legalActions(state).map(a=>a.at));
 for(let at=0;at<14;at++){
  const button=cellButton(at,`${at===6?'South store':at===13?'North store':(at<6?'South':'North')+' pit '+(at%7+1)}: ${state.board[at]} stones`,String(state.board[at]));
  if(at===6||at===13){button.className='store';button.style.gridColumn=at===13?'1':'8';const small=document.createElement('small');small.textContent=at===6?'SOUTH':'NORTH';button.append(small);}
  else{button.style.gridRow=at<6?'2':'1';button.style.gridColumn=String(at<6?at+2:14-at);}
  if(legal.has(at))button.classList.add('legal');if(state.last.includes(at))button.classList.add('last');button.disabled=!canPlay()||!legal.has(at);button.onclick=()=>act({at});host.append(button);
 }
}
function renderNim(){
 const host=$('board');host.className='nimBoard';host.style.gridTemplateColumns='';host.removeAttribute('role');host.replaceChildren();
 state.board.forEach((count,heap)=>{
  const row=document.createElement('section');row.className='heap';const heading=document.createElement('div');heading.className='heapHead';heading.textContent=`HEAP ${heap+1} · ${count} STONES`;row.append(heading);
  const stones=document.createElement('div');stones.className='stones';stones.setAttribute('aria-hidden','true');for(let i=0;i<count;i++){const stone=document.createElement('span');stone.className='stone';stones.append(stone);}row.append(stones);
  const controls=document.createElement('div');controls.className='removeControls';for(let n=1;n<=count;n++){const button=document.createElement('button');button.textContent='Take '+n;button.setAttribute('aria-label',`Take ${n} from heap ${heap+1}`);button.disabled=!canPlay();button.onclick=()=>act({heap,count:n});controls.append(button);}row.append(controls);host.append(row);
 });
}
function renderDots(){
 const host=$('board');host.className='dotsBoard';host.style.gridTemplateColumns='';host.removeAttribute('role');host.replaceChildren();
 for(let y=0;y<3;y++)for(let x=0;x<3;x++){const box=document.createElement('span'),owner=state.boxes[y*3+x];box.className='box p'+owner;box.style.left=(16.67+x*25)+'%';box.style.top=(16.67+y*25)+'%';box.textContent=owner?'★':'';host.append(box);}
 for(let edge=0;edge<24;edge++){
  const horizontal=edge<12,n=horizontal?edge:edge-12,x=horizontal?n%3:n%4,y=horizontal?Math.floor(n/3):Math.floor(n/4);
  const button=document.createElement('button');button.className='edge '+(horizontal?'horizontal':'vertical')+' p'+state.board[edge];button.style.left=(horizontal?16.67+x*25:4.17+x*25)+'%';button.style.top=(horizontal?4.17+y*25:16.67+y*25)+'%';button.setAttribute('aria-label',`${horizontal?'Horizontal':'Vertical'} edge row ${y+1} column ${x+1}${state.board[edge]?' claimed':''}`);button.disabled=!canPlay()||!!state.board[edge];button.onclick=()=>act({edge});host.append(button);
 }
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){const dot=document.createElement('span');dot.className='dot';dot.style.left=(4.17+x*25)+'%';dot.style.top=(4.17+y*25)+'%';host.append(dot);}
}
function render(){
 $('title').textContent=TITLES[kind];document.title=TITLES[kind]+' · Local Arcade';$('instructions').textContent=INSTRUCTIONS[kind];
 const names=[...NAMES[kind]];if(network){names[mySide]=(myName()+' · you').slice(0,29);names[1-mySide]=remoteName||'Friend';}
 for(let i=0;i<2;i++){$('name'+i).textContent=names[i];$('player'+i).classList.toggle('active',!state.ended&&state.turn===i);$('score'+i).textContent=scores(state)?.[i]??'';}
 $('turn').textContent=state.ended?(state.winner==='draw'?'Draw — well played':names[state.winner]+' wins!'):network&&!connected?'Waiting for friend…':names[state.turn]+(network&&state.turn===mySide?' — your turn':' to move');
 $('modeBadge').textContent=network?(connected?'FRIENDS ONLINE':'CONNECTING'):'PASS & PLAY';$('promotionLabel').hidden=kind!=='chess';
 if(kind==='mancala')renderMancala();else if(kind==='nim')renderNim();else if(kind==='dots')renderDots();else renderGrid();
 notice(state.notice||(state.ended?'Start a new game for a rematch.':INSTRUCTIONS[kind]));
 $('restart').textContent=network?(resetConsent?'Waiting for agreement…':remoteReset?'Agree to new game':'New game'):'New game';$('restart').disabled=network&&(!connected||resetConsent);
}
function validState(value){
 if(!value||value.kind!==kind||!Number.isInteger(value.revision)||value.revision<0||value.revision>100000||![0,1].includes(value.turn)||typeof value.ended!=='boolean'||![null,0,1,'draw'].includes(value.winner)||!Array.isArray(value.last)||JSON.stringify(value).length>65536)return false;
 if(kind==='chess'){try{chessObject(value,Chess);return typeof value.fen==='string'&&typeof value.pgn==='string';}catch{return false;}}
 const sizes={connect4:42,reversi:64,checkers:64,tictactoe:9,gomoku:225,mancala:14,nim:3,dots:24};
 const max=kind==='mancala'?48:kind==='nim'?7:kind==='checkers'?4:2;
 return Array.isArray(value.board)&&value.board.length===sizes[kind]&&value.board.every(v=>Number.isInteger(v)&&v>=0&&v<=max)&&(kind!=='dots'||Array.isArray(value.boxes)&&value.boxes.length===9&&value.boxes.every(v=>[0,1,2].includes(v)));
}
function hello(){return {type:'hello',protocol:1,kind,role,token,name:myName()};}
function settleReset(){
 if(isHost&&resetConsent&&remoteReset){epoch++;state=createGame(kind,Chess);selected=null;resetConsent=remoteReset=false;render();announce();}
}
function handle(data,{peerId:sender}){
 if(!data||typeof data!=='object'||JSON.stringify(data).length>65536)return;
 if(data.type==='hello'){
  if(data.protocol!==1||data.kind!==kind||!['host','guest','auto'].includes(data.role)||typeof data.token!=='string'||data.token.length>80)return;
  if(peerId&&peerId!==sender){send({type:'full'},sender);return;}
  if(role==='host'&&data.role==='host'||role==='guest'&&data.role==='guest'){$('connection').textContent='Both players selected the same role. One should host and the other join, or both open the invite link.';return;}
  const newPeer=peerId!==sender;peerId=sender;remoteName=String(data.name||'Friend').slice(0,20);
  isHost=role==='host'||data.role==='guest'||role==='auto'&&data.role==='auto'&&token<data.token;hostId=isHost?null:sender;mySide=isHost?0:1;connected=true;
  if(newPeer)send(hello());if(isHost)announce();
  $('connection').textContent=`Connected to ${remoteName}. You play ${NAMES[kind][mySide]}. The host validates moves. Keep this tab open.`;render();return;
 }
 if(sender!==peerId)return;
 if(data.type==='state'&&!isHost&&sender===hostId&&validState(data.state)&&Number.isInteger(data.epoch)){
  if(data.epoch<epoch||data.epoch>epoch+1||data.epoch===epoch&&data.state.revision<state.revision)return;
  if(data.epoch>epoch&&!resetConsent)return;
  if(data.epoch>epoch){epoch=data.epoch;resetConsent=remoteReset=false;}
  state=data.state;selected=null;render();return;
 }
 if(data.type==='move'&&isHost&&connected&&state.turn===1&&data.epoch===epoch&&data.revision===state.revision){const next=applyAction(state,data.action,Chess);if(next){state=next;selected=null;render();announce();}else announce();return;}
 if(data.type==='reset'&&data.epoch===epoch){remoteReset=true;settleReset();render();if(!resetConsent)notice(`${remoteName} wants a new game. Click “Agree to new game” to accept.`);return;}
 if(data.type==='full')$('connection').textContent='That room already has two players. Try a different room code.';
}
function disconnect(){
 if(room)room.leave();room=channel=null;peerId=hostId=null;network=connected=isHost=false;role='local';resetConsent=remoteReset=false;remoteName='';mySide=0;
}
async function connect(nextRole){
 $('host').disabled=$('join').disabled=true;$('connection').textContent='Loading the peer connection…';
 try{
  const {joinRoom}=await import('../../vendor/trystero.js');disconnect();network=true;role=nextRole;token=tokenForSession();epoch=0;state=createGame(kind,Chess);
  const code=$('room').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)||'ARCADE';$('room').value=code;
  room=joinRoom({appId:'julianattemptscoding-retro-room-tabletop-v1'},kind+'-'+code);channel=room.makeAction('tabletop-v1');channel.onMessage=handle;
  room.onPeerJoin=id=>send(hello(),id);
  room.onPeerLeave=id=>{if(id!==peerId)return;connected=false;peerId=hostId=null;$('connection').textContent='Your friend disconnected. Waiting for them to reconnect; local mode is available.';render();};
  $('connection').textContent=`Room ${code} is waiting for a friend. Send the invite link. Public signaling or restrictive networks can prevent a connection.`;$('rooms')?.setAttribute('open','');document.querySelector('.rooms').open=true;render();
  setTimeout(()=>{if(network&&!connected)$('connection').textContent=`Still waiting in room ${code}. Your friend must open the same game and room. If both are here, the public relay or network may be blocking WebRTC. Local play still works.`;},20000);
 }catch(error){$('connection').textContent='Could not start the online room. Local play still works. '+error.message;disconnect();render();}
 finally{$('host').disabled=$('join').disabled=false;}
}
$('restart').onclick=()=>{if(!network){newLocalGame();return;}if(!connected)return;resetConsent=true;send({type:'reset',epoch});settleReset();render();if(resetConsent)notice('New-game request sent. Your friend must also agree.');};
$('local').onclick=()=>{disconnect();newLocalGame();$('connection').textContent='Local pass-and-play. Take turns on this device; no internet required.';};
$('host').onclick=()=>connect('host');$('join').onclick=()=>connect('guest');
$('share').onclick=async()=>{const link=new URL(location.href);link.searchParams.set('game',kind);link.searchParams.set('room',$('room').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)||'ARCADE');link.searchParams.set('autojoin','1');link.searchParams.delete('name');try{await navigator.clipboard.writeText(link.href);$('connection').textContent='Invite link copied. Send it to one friend.';}catch{$('connection').textContent='Invite: '+link.href;}};
$('name').value=(params.get('name')||'').slice(0,20);$('room').value=(params.get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
try{
 if(kind==='chess')({Chess}=await import('../../vendor/chess.js'));
 state=createGame(kind,Chess);newLocalGame();
 const link=document.createElement('a');link.href=kind==='chess'?'https://github.com/jhlywa/chess.js':'RULES.md';link.target='_blank';link.rel='noopener';link.textContent=kind==='chess'?'Chess rules: chess.js · BSD-2-Clause · ~4.4k stars':'Canonical rules, independently implemented · source notes';$('source').append(link);
 if(params.get('autojoin')==='1'&&params.get('room'))connect('auto');
}catch(error){$('turn').textContent='Game could not load';notice(error.message+' Please rebuild the bundled game dependencies.');}
