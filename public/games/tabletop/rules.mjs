// Independent rule implementations. Chess rules delegate to chess.js.
// Sources, variants and attribution are documented in RULES.md alongside this file.
export const TITLES={chess:'Chess',connect4:'Four in a Row',reversi:'Reversi',checkers:'Checkers',tictactoe:'Tic-tac-toe',gomoku:'Gomoku',mancala:'Mancala',nim:'Nim',dots:'Dots & Boxes'};
export const NAMES={chess:['White','Black'],reversi:['Black','White'],checkers:['Red','Ivory'],connect4:['Coral','Gold'],gomoku:['Black','White'],tictactoe:['Crosses','Noughts'],mancala:['South','North'],nim:['Player one','Player two'],dots:['Coral','Gold']};
export const INSTRUCTIONS={
 chess:'Select a piece, then a highlighted destination. Castling, en passant and promotion follow standard chess rules.',
 connect4:'Choose a column to drop a disc. Connect four horizontally, vertically or diagonally.',
 reversi:'Place a disc to bracket and flip the other colour. Legal moves are marked. A player without a move passes automatically.',
 checkers:'American checkers: captures are mandatory. Continue a multi-jump with the same piece; crowning ends the turn.',
 tictactoe:'Take turns placing a mark. Get three in a row, column or diagonal.',
 gomoku:'Freestyle Gomoku: take turns placing stones. The first line of five or more wins. No Renju restrictions.',
 mancala:'Kalah: sow a pit on your side counterclockwise, skipping the other store. End in your store for another turn. Land in an empty own pit to capture the opposite stones.',
 nim:'Normal-play Nim: remove one or more stones from exactly one heap. The player taking the last stone wins.',
 dots:'Join two neighbouring dots. Complete a box to claim it and take another turn. Most boxes wins.',
};
const clone=x=>JSON.parse(JSON.stringify(x));
const validCell=(n,size)=>Number.isInteger(n)&&n>=0&&n<size;
export const square=i=>String.fromCharCode(97+i%8)+(8-Math.floor(i/8));
export const index=s=>(8-Number(s[1]))*8+s.charCodeAt(0)-97;
export function chessObject(state,Chess){const game=new Chess();if(state.pgn)game.loadPgn(state.pgn);else if(state.fen)game.load(state.fen);return game;}
export function createGame(kind,Chess){
 if(!TITLES[kind])kind='connect4';
 const state={kind,turn:0,winner:null,ended:false,revision:0,last:[],notice:'',history:[]};
 if(kind==='chess'){if(!Chess)throw Error('Chess rules could not load.');state.fen=new Chess().fen();state.pgn='';}
 else if(kind==='connect4')state.board=Array(42).fill(0);
 else if(kind==='tictactoe')state.board=Array(9).fill(0);
 else if(kind==='gomoku')state.board=Array(225).fill(0);
 else if(kind==='reversi'){state.board=Array(64).fill(0);state.board[27]=state.board[36]=2;state.board[28]=state.board[35]=1;}
 else if(kind==='checkers'){state.board=Array(64).fill(0);for(let i=0;i<64;i++){let y=Math.floor(i/8);if((i%8+y)%2===1&&(y<3||y>4))state.board[i]=y<3?2:1;}state.forced=null;state.quiet=0;}
 else if(kind==='mancala'){state.board=Array(14).fill(4);state.board[6]=state.board[13]=0;}
 else if(kind==='nim')state.board=[3,5,7];
 else if(kind==='dots'){state.board=Array(24).fill(0);state.boxes=Array(9).fill(0);}
 return state;
}
function winLine(board,at,width,height,length){const x=at%width,y=Math.floor(at/width),v=board[at];for(const [dx,dy]of [[1,0],[0,1],[1,1],[1,-1]]){let count=1;for(const sign of [-1,1])for(let step=1;;step++){const nx=x+sign*dx*step,ny=y+sign*dy*step;if(nx<0||nx>=width||ny<0||ny>=height||board[ny*width+nx]!==v)break;count++;}if(count>=length)return true;}return false;}
function finish(state,winner){state.ended=true;state.winner=winner;}
function finishByCount(state,a,b){finish(state,a===b?'draw':a>b?0:1);}
export function reversiFlips(board,at,player){
 if(!validCell(at,64)||board[at])return [];
 const own=player+1,other=2-player,out=[];
 for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
  const line=[];let x=at%8+dx,y=Math.floor(at/8)+dy;
  while(x>=0&&x<8&&y>=0&&y<8&&board[y*8+x]===other){line.push(y*8+x);x+=dx;y+=dy;}
  if(line.length&&x>=0&&x<8&&y>=0&&y<8&&board[y*8+x]===own)out.push(...line);
 }
 return out;
}
export function checkerMoves(state,from,captureOnly=false){
 const piece=state.board[from],own=state.turn+1;if(piece!==own&&piece!==own+2)return [];
 const dirs=piece>2?[-1,1]:state.turn===0?[-1]:[1],x=from%8,y=Math.floor(from/8),moves=[];
 for(const dy of dirs)for(const dx of [-1,1]){
  const nx=x+dx,ny=y+dy;if(nx<0||nx>7||ny<0||ny>7)continue;
  const middle=ny*8+nx,value=state.board[middle];
  if(!captureOnly&&!value)moves.push({from,to:middle});
  const tx=x+2*dx,ty=y+2*dy;
  if(value&&value!==own&&value!==own+2&&tx>=0&&tx<8&&ty>=0&&ty<8&&!state.board[ty*8+tx])moves.push({from,to:ty*8+tx,capture:middle});
 }
 return moves;
}
export function legalActions(state,Chess){
 if(state.ended)return [];
 if(state.kind==='chess')return chessObject(state,Chess).moves({verbose:true}).map(m=>({from:index(m.from),to:index(m.to),promotion:m.promotion||'q'}));
 if(state.kind==='connect4')return Array.from({length:7},(_,column)=>({column})).filter(a=>!state.board[a.column]);
 if(['tictactoe','gomoku'].includes(state.kind))return state.board.flatMap((v,at)=>v?[]:[{at}]);
 if(state.kind==='reversi')return state.board.flatMap((v,at)=>!v&&reversiFlips(state.board,at,state.turn).length?[{at}]:[]);
 if(state.kind==='checkers'){
  const captures=state.board.flatMap((_,i)=>state.forced===null||state.forced===i?checkerMoves(state,i,true):[]);
  return captures.length?captures:state.forced!==null?[]:state.board.flatMap((_,i)=>checkerMoves(state,i));
 }
 if(state.kind==='mancala'){const start=state.turn===0?0:7;return Array.from({length:6},(_,i)=>({at:start+i})).filter(a=>state.board[a.at]);}
 if(state.kind==='nim')return state.board.flatMap((count,heap)=>Array.from({length:count},(_,i)=>({heap,count:i+1})));
 if(state.kind==='dots')return state.board.flatMap((v,edge)=>v?[]:[{edge}]);
 return [];
}
function isLegal(state,action,Chess){
 if(!action||typeof action!=='object'||Array.isArray(action))return false;
 return legalActions(state,Chess).some(m=>Object.keys(m).every(key=>m[key]===(key==='promotion'?(action[key]||'q'):action[key])));
}
export function applyAction(previous,action,Chess){
 if(!isLegal(previous,action,Chess))return null;
 const state=clone(previous);state.notice='';state.revision++;const player=state.turn;
 if(state.kind==='chess'){
  const game=chessObject(state,Chess);let move;try{move=game.move({from:square(action.from),to:square(action.to),promotion:action.promotion||'q'});}catch{return null;}
  if(!move)return null;state.fen=game.fen();state.pgn=game.pgn();state.last=[action.from,action.to];state.turn=game.turn()==='w'?0:1;
  if(game.isCheckmate())finish(state,player);else if(game.isGameOver())finish(state,'draw');else if(game.isCheck())state.notice='Check';
  return state;
 }
 if(state.kind==='connect4'){
  let at=action.column;while(at+7<42&&!state.board[at+7])at+=7;state.board[at]=player+1;state.last=[at];
  if(winLine(state.board,at,7,6,4))finish(state,player);else if(state.board.every(Boolean))finish(state,'draw');state.turn=1-player;
 }else if(['tictactoe','gomoku'].includes(state.kind)){
  state.board[action.at]=player+1;state.last=[action.at];const size=state.kind==='gomoku'?15:3;
  if(winLine(state.board,action.at,size,size,state.kind==='gomoku'?5:3))finish(state,player);else if(state.board.every(Boolean))finish(state,'draw');state.turn=1-player;
 }else if(state.kind==='reversi'){
  const flips=reversiFlips(state.board,action.at,player);state.board[action.at]=player+1;for(const i of flips)state.board[i]=player+1;state.last=[action.at];state.turn=1-player;
  if(!legalActions(state).length){state.turn=player;state.notice=NAMES.reversi[1-player]+' has no legal move — pass.';if(!legalActions(state).length)finishByCount(state,state.board.filter(v=>v===1).length,state.board.filter(v=>v===2).length);}
 }else if(state.kind==='checkers'){
  const move=legalActions(previous).find(m=>m.from===action.from&&m.to===action.to),piece=state.board[action.from];state.board[action.to]=piece;state.board[action.from]=0;state.last=[action.from,action.to];
  if(move.capture!==undefined)state.board[move.capture]=0;
  const crowned=piece<3&&(player===0?action.to<8:action.to>=56);if(crowned)state.board[action.to]+=2;
  state.quiet=move.capture!==undefined||piece<3?0:state.quiet+1;
  state.forced=move.capture!==undefined&&!crowned&&checkerMoves(state,action.to,true).length?action.to:null;
  if(state.forced===null)state.turn=1-player;else state.notice='Continue the capture with the selected piece.';
  if(!legalActions(state).length)finish(state,player);else if(state.quiet>=80)finish(state,'draw');
  const position=state.board.join(',')+':'+state.turn;state.history.push(position);if(state.history.filter(p=>p===position).length>=3)finish(state,'draw');
 }else if(state.kind==='mancala'){
  let stones=state.board[action.at];state.board[action.at]=0;let at=action.at,store=player===0?6:13,oppositeStore=player===0?13:6;
  while(stones){at=(at+1)%14;if(at===oppositeStore)continue;state.board[at]++;stones--;}
  const own=player===0?at>=0&&at<6:at>=7&&at<13;
  if(own&&state.board[at]===1&&state.board[12-at]>0){state.board[store]+=1+state.board[12-at];state.board[at]=state.board[12-at]=0;}
  state.last=[action.at,at];if(at!==store)state.turn=1-player;else state.notice='Last stone in your store — play again.';
  if(state.board.slice(0,6).every(v=>!v)||state.board.slice(7,13).every(v=>!v)){
   state.board[6]+=state.board.slice(0,6).reduce((a,b)=>a+b,0);state.board[13]+=state.board.slice(7,13).reduce((a,b)=>a+b,0);for(let i=0;i<14;i++)if(i!==6&&i!==13)state.board[i]=0;finishByCount(state,state.board[6],state.board[13]);
  }
 }else if(state.kind==='nim'){
  state.board[action.heap]-=action.count;state.last=[action.heap];if(state.board.every(v=>v===0))finish(state,player);state.turn=1-player;
 }else if(state.kind==='dots'){
  state.board[action.edge]=player+1;let captured=0;
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){
   const box=y*3+x,edges=[y*3+x,(y+1)*3+x,12+y*4+x,12+y*4+x+1];
   if(!state.boxes[box]&&edges.every(i=>state.board[i])){state.boxes[box]=player+1;captured++;}
  }
  if(!captured)state.turn=1-player;else state.notice='Box claimed — take another edge.';state.last=[action.edge];
  if(state.boxes.every(Boolean))finishByCount(state,state.boxes.filter(v=>v===1).length,state.boxes.filter(v=>v===2).length);
 }
 return state;
}
export function scores(state){if(state.kind==='mancala')return [state.board[6],state.board[13]];if(state.kind==='dots')return [state.boxes.filter(v=>v===1).length,state.boxes.filter(v=>v===2).length];if(state.kind==='reversi'||state.kind==='checkers')return [state.board.filter(v=>v===1||v===3).length,state.board.filter(v=>v===2||v===4).length];return null;}
